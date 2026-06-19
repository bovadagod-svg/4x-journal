"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient as createServiceRoleClient, type SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { computePnL } from "@/lib/finance"
import { loadPipValueContext, computePipValueAcct } from "@/lib/pip-value-context"
import type { Database, Json } from "@/lib/supabase/database.types"
import {
  tlGetAccounts,
  tlClosePosition,
  tlGetQuote,
  tlLogin,
  tlModifyPosition,
  tlSyncTrades,
  TLError,
  type TradeLockerEnv,
} from "@/lib/integrations/tradelocker/client"

type Supa = SupabaseClient<Database>

/**
 * Build a service-role Supabase client for cron / webhook use.
 * Returns null when the env var is missing (caller should fail loudly).
 */
function createAdminSupabase(): Supa | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createServiceRoleClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

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

/**
 * Core sync logic — works with either a cookie-authed Supabase client (RLS-gated)
 * or a service-role client (used by cron / webhooks). Reads user_id from the
 * connection row instead of from auth.getUser() so admin contexts work.
 */
async function _syncTradeLockerCore(connectionId: string, supabase: Supa): Promise<{ ok: boolean; error?: string; tradesUpserted?: number; attempts?: unknown; debug?: unknown }> {
  const { data: conn, error } = await supabase
    .from("broker_connections")
    .select("*")
    .eq("id", connectionId)
    .single()
  if (error || !conn) return { ok: false, error: error?.message ?? "Connection not found." }

  const userId = conn.user_id

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

  // Live-update local account balance/equity/margin from TradeLocker state.
  if (pull.state) {
    const patch: {
      balance?: number
      equity?: number
      margin_used?: number
      free_margin?: number
      margin_level?: number
      floating_pnl?: number
      swap_total?: number
    } = {}
    if (pull.state.balance != null) patch.balance = pull.state.balance
    if (pull.state.projectedBalance != null) patch.equity = pull.state.projectedBalance
    if (pull.state.marginUsed != null) patch.margin_used = pull.state.marginUsed
    if (pull.state.freeMargin != null) patch.free_margin = pull.state.freeMargin
    if (pull.state.marginLevel != null) patch.margin_level = pull.state.marginLevel
    if (pull.state.floatingPnl != null) patch.floating_pnl = pull.state.floatingPnl
    if (pull.state.swapTotal != null) patch.swap_total = pull.state.swapTotal
    if (Object.keys(patch).length > 0) {
      await supabase.from("accounts").update(patch).eq("id", conn.account_id)
    }
  }

  // Upsert trades + fills. Strategy:
  //   1. Upsert parent rows (dedup on positionId)
  //   2. Delete legacy fills for these positions (old `:entry`/`:exit` keys)
  //      so the upgrade from single-fill to multi-fill is clean
  //   3. Insert one trade_fills row per actual TL filled order, using the
  //      TL order id as the dedup key — this preserves scale-outs as
  //      separate fills with their own timestamps + prices
  //   4. Trigger recomputes parent aggregates from fills
  const all = [...pull.open, ...pull.closed]
  const rows = all.map((p) => ({
    user_id: userId,
    account_id: conn.account_id,
    external_id: p.externalId,
    external_provider: "tradelocker",
    pair: p.pair,
    side: p.side,
    entry_price: p.entryPrice,
    stop_price: p.stopPrice,
    target_price: p.targetPrice,
    size: p.size,
    contract_size: p.contractSize,
    status: p.status,
    notes: `Synced from TradeLocker (${env}).`,
    tags: ["tradelocker"],
    // Lifecycle is the full chronological order-event timeline for this
    // position. Coerced through JSON.parse(JSON.stringify(...)) so any
    // unexpected runtime types in `raw` don't break Supabase's Json type.
    lifecycle_events: JSON.parse(JSON.stringify(p.lifecycle)) as Json,
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

    // Cleanup legacy fills: pre-multi-fill imports used external_ids of
    // shape "{positionId}:entry" / "{positionId}:exit". Delete those so
    // re-sync replaces them cleanly with one row per actual order.
    const legacyKeys = all.flatMap((p) => [`${p.externalId}:entry`, `${p.externalId}:exit`])
    if (legacyKeys.length > 0) {
      await supabase
        .from("trade_fills")
        .delete()
        .eq("external_provider", "tradelocker")
        .in("external_id", legacyKeys)
    }

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
      commission?: number | null
      swap?: number | null
      tax?: number | null
      request_price?: number | null
      order_type?: string | null
      execution_type?: string | null
      magic_number?: string | null
      broker_comment?: string | null
      pip_value_acct?: number | null
    }
    // Forward-write pip_value_acct (#60). One ctx per sync — the user's
    // fx_rates + account currencies don't change mid-sync.
    const pipCtx = await loadPipValueContext({ supabase, userId })
    const fills: FillInsert[] = []
    for (const p of all) {
      const tradeId = tradeByExternal.get(p.externalId)
      if (!tradeId) continue
      for (const f of p.fills) {
        const sizeUnits = Number(f.size) * Number(p.contractSize || 1)
        const pipValueAcct = computePipValueAcct({
          pair: p.pair,
          accountId: conn.account_id,
          sizeUnits,
          ctx: pipCtx,
        })
        fills.push({
          trade_id: tradeId,
          user_id: userId,
          kind: f.kind,
          reason: "broker_sync",
          price: f.price,
          size: f.size,
          filled_at: f.filledAt,
          external_provider: "tradelocker",
          external_id: `${p.externalId}:fill:${f.orderId}`,
          commission: f.meta.commission,
          swap: f.meta.swap,
          tax: f.meta.tax,
          request_price: f.meta.requestPrice,
          order_type: f.meta.orderType,
          execution_type: f.meta.executionType,
          magic_number: f.meta.magicNumber,
          broker_comment: f.meta.comment,
          pip_value_acct: pipValueAcct,
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

/**
 * User-initiated sync — gated by Supabase auth cookie.
 */
export async function syncTradeLockerConnection(connectionId: string): Promise<{ ok: boolean; error?: string; tradesUpserted?: number; attempts?: unknown; debug?: unknown }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }
  return _syncTradeLockerCore(connectionId, supabase)
}

/**
 * Admin / cron sync — uses service-role client. RLS bypass means we trust the
 * caller (the cron route), so make sure that route gates on CRON_SECRET.
 */
export async function syncTradeLockerConnectionAdmin(connectionId: string): Promise<{ ok: boolean; error?: string; tradesUpserted?: number; attempts?: unknown; debug?: unknown }> {
  const supabase = createAdminSupabase()
  if (!supabase) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }
  }
  return _syncTradeLockerCore(connectionId, supabase)
}

/**
 * List all enabled TradeLocker connections — for the cron sweep.
 * Uses the service-role client; gate the caller with CRON_SECRET.
 */
export async function listTradeLockerConnections(): Promise<{ ok: boolean; error?: string; ids?: string[] }> {
  const supabase = createAdminSupabase()
  if (!supabase) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not configured" }

  const { data, error } = await supabase
    .from("broker_connections")
    .select("id")
    .eq("provider", "tradelocker")
    .eq("enabled", true)

  if (error) return { ok: false, error: error.message }
  return { ok: true, ids: (data ?? []).map((r) => r.id) }
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

// ── Re-import (full wipe + resync) ────────────────────────────────────────

/**
 * Nuke this connection's trades + fills and pull everything fresh from
 * TradeLocker. Used when the import shape changes (e.g. moving from one
 * exit fill per trade to per-order fills) and the easiest way to bring
 * existing data up to spec is to throw it out and re-fetch.
 *
 * Deletes are scoped to `external_provider='tradelocker'` so manual trades
 * on the same account stay untouched. Cascade through trade_fills via the
 * `trade_fills_trade_id_fkey` foreign key — Postgres deletes those rows
 * automatically when the parent trade is deleted.
 */
export async function reimportTradeLockerConnection(connectionId: string): Promise<{
  ok: boolean
  error?: string
  tradesDeleted?: number
  tradesUpserted?: number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: conn } = await supabase
    .from("broker_connections")
    .select("id, account_id, user_id")
    .eq("id", connectionId)
    .maybeSingle()
  if (!conn) return { ok: false, error: "Connection not found." }
  if (conn.user_id !== user.id) return { ok: false, error: "Not your connection." }

  // Delete trade_fills first to avoid the FK cascade race; then trades.
  await supabase
    .from("trade_fills")
    .delete()
    .eq("user_id", user.id)
    .eq("external_provider", "tradelocker")
  const { count: deleted } = await supabase
    .from("trades")
    .delete({ count: "exact" })
    .eq("user_id", user.id)
    .eq("account_id", conn.account_id)
    .eq("external_provider", "tradelocker")

  const sync = await syncTradeLockerConnection(connectionId)
  if (!sync.ok) {
    return { ok: false, error: `Wiped ${deleted ?? 0} trades but resync failed: ${sync.error}` }
  }

  return {
    ok: true,
    tradesDeleted: deleted ?? 0,
    tradesUpserted: sync.tradesUpserted ?? 0,
  }
}

// ── Per-trade actions (modify SL/TP, close at market) ─────────────────────

/**
 * Modify SL / TP on a TradeLocker-synced open trade. Pass new prices (null
 * = leave alone). Returns the broker error string when TL rejects, so the
 * UI can surface it inline.
 *
 * Auth: requires the trade's owning user to be signed in.
 */
export async function brokerModifyPosition(args: {
  tradeId: string
  stop_price?: number | null
  target_price?: number | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: trade } = await supabase
    .from("trades")
    .select("id, user_id, account_id, external_id, external_provider, status, stop_price, target_price")
    .eq("id", args.tradeId)
    .maybeSingle()
  if (!trade || trade.user_id !== user.id) return { ok: false, error: "Trade not found." }
  if (trade.external_provider !== "tradelocker" || !trade.external_id) {
    return { ok: false, error: "Only TradeLocker-synced trades can be modified from here." }
  }
  if (trade.status !== "open") return { ok: false, error: "Trade is not open." }

  const { data: conn } = await supabase
    .from("broker_connections")
    .select("credentials, external_account_id, external_account_meta")
    .eq("account_id", trade.account_id)
    .eq("provider", "tradelocker")
    .eq("enabled", true)
    .maybeSingle()
  if (!conn) return { ok: false, error: "No active TradeLocker connection on this account." }

  const creds = conn.credentials as { email?: string; password?: string; server?: string; env?: TradeLockerEnv }
  if (!creds.email || !creds.password || !creds.server || !creds.env) {
    return { ok: false, error: "Connection is missing credentials. Re-connect this account." }
  }

  let accessToken: string
  try {
    accessToken = (await tlLogin({ env: creds.env, email: creds.email, password: creds.password, server: creds.server })).accessToken
  } catch (e) {
    return { ok: false, error: errMsg(e) }
  }

  const meta = conn.external_account_meta as { accNum?: string }
  const result = await tlModifyPosition({
    env: creds.env,
    accessToken,
    accNum: meta.accNum ?? "1",
    positionId: trade.external_id,
    stopLoss: args.stop_price,
    takeProfit: args.target_price,
  })
  if (!result.ok) return { ok: false, error: `TradeLocker rejected the modify: ${result.error}` }

  // Mirror locally so the UI updates immediately. Realtime subscription on
  // /ledger and the trade detail drawer will pick this up too.
  const patch: { stop_price?: number | null; target_price?: number | null } = {}
  if (args.stop_price !== undefined) patch.stop_price = args.stop_price
  if (args.target_price !== undefined) patch.target_price = args.target_price
  if (Object.keys(patch).length > 0) {
    await supabase.from("trades").update(patch).eq("id", trade.id)
  }

  // Append a journal-audit note (newline-separated) so the modification is
  // captured for the user's records.
  const stamp = new Date().toISOString()
  const what = []
  if (args.stop_price !== undefined && args.stop_price !== Number(trade.stop_price)) what.push(`SL → ${args.stop_price ?? "—"}`)
  if (args.target_price !== undefined && args.target_price !== Number(trade.target_price)) what.push(`TP → ${args.target_price ?? "—"}`)
  if (what.length > 0) {
    const auditLine = `[${stamp}] Broker modify: ${what.join(", ")}`
    const { data: cur } = await supabase.from("trades").select("notes").eq("id", trade.id).maybeSingle()
    const newNotes = cur?.notes ? `${cur.notes}\n${auditLine}` : auditLine
    await supabase.from("trades").update({ notes: newNotes }).eq("id", trade.id)
  }

  revalidatePath("/ledger")
  revalidatePath("/dashboard")
  return { ok: true }
}

/**
 * Close a TradeLocker-synced open position at market. The next sync will
 * fetch the actual fill price + close timestamp; this function just sends
 * the close command and writes a "closing" placeholder note.
 */
export async function brokerClosePosition(tradeId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: trade } = await supabase
    .from("trades")
    .select("id, user_id, account_id, external_id, external_provider, status, notes")
    .eq("id", tradeId)
    .maybeSingle()
  if (!trade || trade.user_id !== user.id) return { ok: false, error: "Trade not found." }
  if (trade.external_provider !== "tradelocker" || !trade.external_id) {
    return { ok: false, error: "Only TradeLocker-synced trades can be closed from here." }
  }
  if (trade.status !== "open") return { ok: false, error: "Trade is not open." }

  const { data: conn } = await supabase
    .from("broker_connections")
    .select("id, credentials, external_account_meta")
    .eq("account_id", trade.account_id)
    .eq("provider", "tradelocker")
    .eq("enabled", true)
    .maybeSingle()
  if (!conn) return { ok: false, error: "No active TradeLocker connection on this account." }

  const creds = conn.credentials as { email?: string; password?: string; server?: string; env?: TradeLockerEnv }
  if (!creds.email || !creds.password || !creds.server || !creds.env) {
    return { ok: false, error: "Connection is missing credentials. Re-connect this account." }
  }

  let accessToken: string
  try {
    accessToken = (await tlLogin({ env: creds.env, email: creds.email, password: creds.password, server: creds.server })).accessToken
  } catch (e) {
    return { ok: false, error: errMsg(e) }
  }

  const meta = conn.external_account_meta as { accNum?: string }
  const result = await tlClosePosition({
    env: creds.env,
    accessToken,
    accNum: meta.accNum ?? "1",
    positionId: trade.external_id,
  })
  if (!result.ok) return { ok: false, error: `TradeLocker rejected the close: ${result.error}` }

  // Append a journal-audit note so the action is captured. The next sync
  // will fill in the actual exit price + closed_at, and the realtime
  // subscription will refresh the UI.
  const stamp = new Date().toISOString()
  const auditLine = `[${stamp}] Broker close requested at market`
  const newNotes = trade.notes ? `${trade.notes}\n${auditLine}` : auditLine
  await supabase.from("trades").update({ notes: newNotes }).eq("id", trade.id)

  // Best-effort immediate sync so the user doesn't have to wait for cron.
  // Failures here are silently ignored — close was already sent to broker.
  try {
    await syncTradeLockerConnection(conn.id)
  } catch { /* swallow */ }

  revalidatePath("/ledger")
  revalidatePath("/dashboard")
  return { ok: true }
}

// ── Live quotes ───────────────────────────────────────────────────────────

export type LiveQuote = {
  symbol: string
  bid: number | null
  ask: number | null
  mid: number | null
  ts: string
  /** Floating P&L in dollars at the mid price (only when computable). */
  floatingPnl?: number
}

export type LiveQuotesResult = {
  /** Map keyed by trade id → quote + computed floating P&L. */
  byTradeId: Record<string, LiveQuote>
  /** Wall-clock timestamp the server fetched at. */
  fetchedAt: string
  /** True when no TL connection exists for any open position (no work to do). */
  empty?: boolean
}

/**
 * Fetch live bid/ask for every open TradeLocker-synced position the user
 * holds, and compute a floating P&L per position at the mid price.
 * Designed to be called from a client polling loop (every 30s is safe).
 */
export async function getLiveQuotesForOpen(): Promise<LiveQuotesResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { byTradeId: {}, fetchedAt: new Date().toISOString(), empty: true }

  const { data: opens } = await supabase
    .from("trades")
    .select("id, account_id, external_id, side, size, entry_price, pair")
    .eq("user_id", user.id)
    .eq("status", "open")
    .eq("external_provider", "tradelocker")
  if (!opens || opens.length === 0) {
    return { byTradeId: {}, fetchedAt: new Date().toISOString(), empty: true }
  }

  // Group by account so we share one TL session per account.
  const byAccount = new Map<string, typeof opens>()
  for (const t of opens) {
    let arr = byAccount.get(t.account_id)
    if (!arr) { arr = []; byAccount.set(t.account_id, arr) }
    arr.push(t)
  }

  const byTradeId: Record<string, LiveQuote> = {}

  for (const [accountId, trades] of byAccount) {
    const { data: conn } = await supabase
      .from("broker_connections")
      .select("credentials, external_account_id, external_account_meta")
      .eq("account_id", accountId)
      .eq("provider", "tradelocker")
      .eq("enabled", true)
      .maybeSingle()
    if (!conn) continue

    const creds = conn.credentials as { email?: string; password?: string; server?: string; env?: TradeLockerEnv }
    if (!creds.email || !creds.password || !creds.server || !creds.env) continue

    let accessToken: string
    try {
      accessToken = (await tlLogin({ env: creds.env, email: creds.email, password: creds.password, server: creds.server })).accessToken
    } catch {
      continue
    }

    const meta = conn.external_account_meta as { accNum?: string; instrumentIdsByExternalId?: Record<string, string> }
    const accNum = meta.accNum ?? "1"

    // Best-effort instrument lookup. If we don't have the instrumentId
    // mapping cached, skip — the next sync will populate it.
    const idMap = meta.instrumentIdsByExternalId ?? {}

    for (const t of trades) {
      if (!t.external_id) continue
      const instrumentId = idMap[t.external_id]
      if (!instrumentId) continue

      const q = await tlGetQuote({
        env: creds.env,
        accessToken,
        accNum,
        instrumentId,
      })
      if (!q) continue

      const mid = q.bid != null && q.ask != null ? (q.bid + q.ask) / 2 : (q.bid ?? q.ask ?? null)
      const floatingPnl = mid != null
        ? Number((((t.side === "long" ? mid - Number(t.entry_price) : Number(t.entry_price) - mid) * Number(t.size)).toFixed(2)))
        : undefined

      byTradeId[t.id] = {
        symbol: t.pair,
        bid: q.bid,
        ask: q.ask,
        mid,
        ts: q.ts,
        floatingPnl,
      }
    }
  }

  return { byTradeId, fetchedAt: new Date().toISOString() }
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
