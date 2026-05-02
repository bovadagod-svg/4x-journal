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

  for (const tl of accounts) {
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
      const { data: newAcc, error: accErr } = await supabase
        .from("accounts")
        .insert({
          user_id: user.id,
          broker: "TradeLocker",
          label: tl.name ?? `TradeLocker ${tl.id}`,
          currency: tl.currency ?? "USD",
          status: env === "live" ? "live" : "demo",
          color: env === "live" ? "#11C458" : "#6932D4",
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

export async function syncTradeLockerConnection(connectionId: string): Promise<{ ok: boolean; error?: string; tradesUpserted?: number; debug?: unknown }> {
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

  // Upsert trades. external_id is unique per (account_id, external_provider, external_id).
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
    exit_price: p.exitPrice,
    size: p.size,
    pnl: p.pnl ?? (p.exitPrice != null ? computePnL({ side: p.side, entry: p.entryPrice, exit: p.exitPrice, size: p.size }) : null),
    status: p.status,
    opened_at: p.openedAt,
    closed_at: p.closedAt,
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
  return { ok: true, tradesUpserted: upserted }
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
