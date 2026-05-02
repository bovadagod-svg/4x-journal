"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { computePnL } from "@/lib/finance"
import {
  tlGetAccounts,
  tlLogin,
  tlSyncTrades,
  TLError,
  type TradeLockerEnv,
} from "@/lib/integrations/tradelocker/client"

const ConnectSchema = z.object({
  env: z.enum(["demo", "live"]),
  email: z.email({ error: "Valid email required." }),
  password: z.string().min(1, { error: "Password required." }),
  server: z.string().min(1, { error: "Server (e.g. OSP-DEMO) required." }),
  // Optional user-provided overrides — applied to NEW account rows only.
  label: z.string().max(60).optional().or(z.literal("").transform(() => undefined)),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional().or(z.literal("").transform(() => undefined)),
})

export type ConnectTLState =
  | { ok: true; createdAccounts: number; connectionIds: string[] }
  | { ok: false; error: string; debug?: unknown }
  | undefined

export async function connectTradeLocker(
  _prev: ConnectTLState,
  formData: FormData,
): Promise<ConnectTLState> {
  const parsed = ConnectSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const env = parsed.data.env as TradeLockerEnv
  let accessToken: string
  let refreshToken: string | undefined
  try {
    const login = await tlLogin({
      env,
      email: parsed.data.email,
      password: parsed.data.password,
      server: parsed.data.server,
    })
    accessToken = login.accessToken
    refreshToken = login.refreshToken
  } catch (e) {
    return { ok: false, error: errMsg(e), debug: errDebug(e) }
  }

  let accounts: Awaited<ReturnType<typeof tlGetAccounts>>
  try {
    accounts = await tlGetAccounts(env, accessToken)
  } catch (e) {
    return { ok: false, error: `Logged in but couldn't list accounts: ${errMsg(e)}`, debug: errDebug(e) }
  }

  if (accounts.length === 0) {
    return { ok: false, error: "TradeLocker returned no accounts for these credentials." }
  }

  const connectionIds: string[] = []
  let created = 0
  const userLabel = parsed.data.label?.trim()
  const userColor = parsed.data.color

  for (const [idx, tl] of accounts.entries()) {
    // 1) Insert (or find) the matching account row in our DB. Default
    //    label = TradeLocker name; broker = "TradeLocker"; status = env.
    const { data: existing } = await supabase
      .from("broker_connections")
      .select("id, account_id")
      .eq("user_id", user.id)
      .eq("provider", "tradelocker")
      .eq("external_account_id", tl.id)
      .maybeSingle()

    let accountRowId: string
    if (existing) {
      accountRowId = existing.account_id
    } else {
      const autoLabel = prettyTLLabel({ name: tl.name, accountId: tl.id, accNum: tl.accNum })
      // User's label applies to the first new account; if multiple TL accounts
      // come back, subsequent ones get the auto label so they're distinguishable.
      const labelToUse = userLabel
        ? (idx === 0 ? userLabel : `${userLabel} · ${autoLabel}`)
        : autoLabel
      const colorToUse = userColor ?? (env === "live" ? "#11C458" : "#6932D4")

      const { data: newAcc, error: accErr } = await supabase
        .from("accounts")
        .insert({
          user_id: user.id,
          broker: "TradeLocker",
          label: labelToUse,
          currency: tl.currency ?? "USD",
          status: env === "live" ? "live" : "demo",
          color: colorToUse,
        })
        .select("id")
        .single()
      if (accErr || !newAcc) {
        return { ok: false, error: `Failed to create local account: ${accErr?.message}` }
      }
      accountRowId = newAcc.id
      created += 1
    }

    // 2) Upsert the broker_connections row.
    const { data: conn, error: connErr } = await supabase
      .from("broker_connections")
      .upsert({
        user_id: user.id,
        account_id: accountRowId,
        provider: "tradelocker",
        external_account_id: tl.id,
        external_account_meta: { accNum: tl.accNum, name: tl.name, env, server: parsed.data.server },
        credentials: { email: parsed.data.email, password: parsed.data.password, server: parsed.data.server, env },
        tokens: { accessToken, refreshToken: refreshToken ?? null, savedAt: new Date().toISOString() },
        last_sync_status: "idle",
      }, { onConflict: "user_id,provider,external_account_id" })
      .select("id")
      .single()
    if (connErr || !conn) {
      return { ok: false, error: `Failed to save connection: ${connErr?.message}` }
    }
    connectionIds.push(conn.id)
  }

  revalidatePath("/accounts")
  return { ok: true, createdAccounts: created, connectionIds }
}

export async function syncTradeLockerConnection(connectionId: string): Promise<{ ok: boolean; error?: string; tradesUpserted?: number; attempts?: unknown; debug?: unknown }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: conn, error } = await supabase
    .from("broker_connections")
    .select("*")
    .eq("id", connectionId)
    .single()
  if (error || !conn) return { ok: false, error: error?.message ?? "Connection not found." }

  const creds = conn.credentials as { email?: string; password?: string; server?: string; env?: TradeLockerEnv }
  const meta = conn.external_account_meta as { accNum?: string }
  if (!creds.email || !creds.password || !creds.server || !creds.env) {
    return { ok: false, error: "Connection is missing credentials. Re-connect this account." }
  }
  const env = creds.env

  // Update last_sync_status to "syncing"
  await supabase.from("broker_connections").update({ last_sync_status: "syncing" }).eq("id", connectionId)

  // Fresh login each sync — simpler than refresh-token plumbing for MVP.
  let accessToken: string
  try {
    const login = await tlLogin({ env, email: creds.email, password: creds.password, server: creds.server })
    accessToken = login.accessToken
  } catch (e) {
    await markError(supabase, connectionId, errMsg(e))
    return { ok: false, error: errMsg(e), debug: errDebug(e) }
  }

  let pull: Awaited<ReturnType<typeof tlSyncTrades>>
  try {
    pull = await tlSyncTrades({
      env,
      accessToken,
      accountId: conn.external_account_id,
      accNum: meta.accNum ?? "1",
    })
  } catch (e) {
    await markError(supabase, connectionId, errMsg(e))
    return { ok: false, error: errMsg(e), debug: errDebug(e) }
  }

  // Stash the latest API attempts (truncated) so we can inspect when 0
  // trades come back even though sync "succeeded".
  // JSON.parse(JSON.stringify(...)) coerces unknowns to Supabase's Json type.
  const debugMeta = JSON.parse(JSON.stringify({
    ...(typeof conn.external_account_meta === "object" && conn.external_account_meta ? conn.external_account_meta : {}),
    lastSyncAttempts: pull.attempts,
    lastSyncAt: new Date().toISOString(),
  }))
  await supabase
    .from("broker_connections")
    .update({ external_account_meta: debugMeta })
    .eq("id", connectionId)

  // Live-update local account balance/equity from TradeLocker state.
  if (pull.state) {
    const patch: { balance?: number; equity?: number } = {}
    if (pull.state.balance != null) patch.balance = pull.state.balance
    if (pull.state.projectedBalance != null) patch.equity = pull.state.projectedBalance
    if (Object.keys(patch).length > 0) {
      await supabase.from("accounts").update(patch).eq("id", conn.account_id)
    }
  }

  // Upsert trades + fills. Strategy:
  //   1. Upsert parent rows (existing behavior, dedup on external_id)
  //   2. Fetch back the resulting trade IDs
  //   3. Idempotently insert one entry fill (and one exit fill if closed)
  //      using `${externalId}:entry` and `${externalId}:exit` as fill external_ids
  //      so re-syncs don't create duplicate fills.
  //   4. Trigger recomputes parent aggregates from fills.
  const all = [...pull.open, ...pull.closed]
  const rows = all.map((p) => ({
    user_id: user.id,
    account_id: conn.account_id,
    external_id: p.externalId,
    external_provider: "tradelocker",
    pair: p.pair,
    side: p.side,
    entry_price: p.entryPrice,
    stop_price: p.stopPrice,
    target_price: p.targetPrice,
    size: p.size,
    status: p.status,
    notes: `Synced from TradeLocker (${env}).`,
    tags: ["tradelocker"],
  }))

  let upserted = 0
  if (rows.length > 0) {
    const { error: upErr, count } = await supabase
      .from("trades")
      .upsert(rows, { onConflict: "account_id,external_provider,external_id", count: "exact" })
    if (upErr) {
      await markError(supabase, connectionId, upErr.message)
      return { ok: false, error: upErr.message }
    }
    upserted = count ?? rows.length

    // Fetch the trade IDs we just upserted so we can attach fills.
    const externalIds = rows.map((r) => r.external_id)
    const { data: tradeRows } = await supabase
      .from("trades")
      .select("id, external_id")
      .eq("account_id", conn.account_id)
      .eq("external_provider", "tradelocker")
      .in("external_id", externalIds)
    const tradeByExternal = new Map<string, string>()
    ;(tradeRows ?? []).forEach((t) => { if (t.external_id) tradeByExternal.set(t.external_id, t.id) })

    type FillInsert = {
      trade_id: string
      user_id: string
      kind: "entry" | "exit"
      reason: "broker_sync"
      price: number
      size: number
      filled_at: string
      external_provider: "tradelocker"
      external_id: string
    }
    const fills: FillInsert[] = []
    for (const p of all) {
      const tradeId = tradeByExternal.get(p.externalId)
      if (!tradeId) continue
      // Entry fill — always present once the parent trade is open or closed.
      if (p.openedAt) {
        fills.push({
          trade_id: tradeId,
          user_id: user.id,
          kind: "entry",
          reason: "broker_sync",
          price: p.entryPrice,
          size: p.size,
          filled_at: p.openedAt,
          external_provider: "tradelocker",
          external_id: `${p.externalId}:entry`,
        })
      }
      // Exit fill — only for closed trades.
      if (p.status === "closed" && p.exitPrice != null && p.closedAt) {
        fills.push({
          trade_id: tradeId,
          user_id: user.id,
          kind: "exit",
          reason: "broker_sync",
          price: p.exitPrice,
          size: p.size,
          filled_at: p.closedAt,
          external_provider: "tradelocker",
          external_id: `${p.externalId}:exit`,
        })
      }
    }

    if (fills.length > 0) {
      // Upsert by external_provider+external_id so re-syncs are idempotent.
      const { error: fillErr } = await supabase
        .from("trade_fills")
        .upsert(fills, { onConflict: "external_provider,external_id" })
      if (fillErr) {
        await markError(supabase, connectionId, `Trades synced but fills failed: ${fillErr.message}`)
        return { ok: false, error: fillErr.message }
      }
    }
  }

  await supabase
    .from("broker_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: "ok",
      last_sync_error: null,
      trades_synced: (conn.trades_synced ?? 0) + upserted,
      tokens: { accessToken, savedAt: new Date().toISOString() },
    })
    .eq("id", connectionId)

  revalidatePath("/accounts")
  revalidatePath("/dashboard")
  revalidatePath("/ledger")
  return { ok: true, tradesUpserted: upserted, attempts: pull.attempts }
}

export async function disconnectTradeLockerConnection(connectionId: string, opts: { deleteTrades?: boolean } = {}) {
  const supabase = await createClient()
  const { data: conn } = await supabase
    .from("broker_connections")
    .select("account_id")
    .eq("id", connectionId)
    .maybeSingle()

  if (opts.deleteTrades && conn) {
    await supabase
      .from("trades")
      .delete()
      .eq("account_id", conn.account_id)
      .eq("external_provider", "tradelocker")
  }

  const { error } = await supabase.from("broker_connections").delete().eq("id", connectionId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath("/accounts")
  return { ok: true as const }
}

// ── helpers ────────────────────────────────────────────────────────────────

async function markError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  msg: string,
) {
  await supabase
    .from("broker_connections")
    .update({ last_sync_status: "error", last_sync_error: msg, last_synced_at: new Date().toISOString() })
    .eq("id", id)
}

function errMsg(e: unknown): string {
  if (e instanceof TLError) return `${e.message}${e.status ? ` (HTTP ${e.status})` : ""}`
  if (e instanceof Error) return e.message
  return String(e)
}

function errDebug(e: unknown): unknown {
  if (e instanceof TLError) return { url: e.url, status: e.status, body: e.body }
  return null
}

/**
 * TradeLocker name fields look like "FPR#<loginUuid>#<accNum>#<accNum>".
 * Distill that to "TradeLocker · accNum 8" or similar.
 */
function prettyTLLabel(args: { name?: string; accountId: string; accNum: string }): string {
  if (args.name && !args.name.includes("#")) return args.name
  if (args.accNum) return `TradeLocker · acc #${args.accNum}`
  if (args.accountId) return `TradeLocker · ${args.accountId}`
  return "TradeLocker"
}
