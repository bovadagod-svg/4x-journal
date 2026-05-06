"use server"

import { createClient } from "@/lib/supabase/server"
import {
  getAggregates,
  getMacroSnapshot,
  pairToPolygonTicker,
  type Aggregate,
  type MacroSnapshot,
} from "@/lib/integrations/polygon"

/**
 * Server actions powering the Trade Replay tab + the Trade Context panel.
 * Both pull from Polygon and gracefully degrade when POLYGON_API_KEY is unset
 * (the UI renders "configure to enable" instead of erroring).
 */

export type ReplayResult =
  | {
      ok: true
      bars: Aggregate[]
      ticker: string
      timeframe: "M5" | "M15" | "H1" | "H4" | "D1"
      entryTs: number
      exitTs: number | null
    }
  | { ok: false; error: string; configured: boolean }

const TF_MAP: Record<"M5" | "M15" | "H1" | "H4" | "D1", { multiplier: number; timespan: "minute" | "hour" | "day" }> = {
  M5: { multiplier: 5, timespan: "minute" },
  M15: { multiplier: 15, timespan: "minute" },
  H1: { multiplier: 1, timespan: "hour" },
  H4: { multiplier: 4, timespan: "hour" },
  D1: { multiplier: 1, timespan: "day" },
}

/**
 * Fetch candles for a closed trade across a sensible window around its
 * lifetime. We pad the from/to so the user can see context before entry
 * and after exit.
 */
export async function getReplayCandles(args: {
  tradeId: string
  timeframe?: "M5" | "M15" | "H1" | "H4" | "D1"
}): Promise<ReplayResult> {
  if (!process.env.POLYGON_API_KEY) {
    return { ok: false, error: "POLYGON_API_KEY not set in environment", configured: false }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in.", configured: true }

  const { data: trade } = await supabase
    .from("trades")
    .select("user_id, pair, opened_at, closed_at, status")
    .eq("id", args.tradeId)
    .maybeSingle()
  if (!trade || trade.user_id !== user.id) return { ok: false, error: "Trade not found.", configured: true }
  if (!trade.opened_at) return { ok: false, error: "Trade has no opened_at — replay needs entry timestamp.", configured: true }

  const ticker = pairToPolygonTicker(trade.pair)
  if (!ticker) return { ok: false, error: `No Polygon mapping for ${trade.pair}.`, configured: true }

  const tf = args.timeframe ?? "H1"
  const cfg = TF_MAP[tf]

  const entryMs = new Date(trade.opened_at).getTime()
  const exitMs = trade.closed_at ? new Date(trade.closed_at).getTime() : Date.now()
  if (!Number.isFinite(entryMs) || !Number.isFinite(exitMs)) {
    return { ok: false, error: "Trade has unparseable opened_at/closed_at timestamp.", configured: true }
  }
  const span = Math.max(0, exitMs - entryMs)

  // Pad the window: 25% of the trade's lifetime on each side, with sensible min/max.
  const minPad = cfg.timespan === "day" ? 7 * 86_400_000 : 4 * 3_600_000
  const maxPad = 30 * 86_400_000
  const pad = Math.max(minPad, Math.min(maxPad, span * 0.25))
  // Polygon's path params reject non-integer ms; floor to be safe.
  const from = Math.floor(entryMs - pad)
  const to = Math.floor(exitMs + pad)

  const r = await getAggregates({
    ticker,
    multiplier: cfg.multiplier,
    timespan: cfg.timespan,
    from,
    to,
    limit: 500,
  })
  if (!r.ok) return { ok: false, error: r.error, configured: r.configured }

  return {
    ok: true,
    bars: r.bars,
    ticker,
    timeframe: tf,
    entryTs: entryMs,
    exitTs: trade.closed_at ? exitMs : null,
  }
}

export type ContextResult =
  | { ok: true; snapshot: MacroSnapshot }
  | { ok: false; error: string; configured: boolean }

/**
 * Macro context (DXY/SPX/VIX) at the moment a trade was opened. Used in
 * the Trade Detail Drawer's Order tab to show "what was going on?" alongside
 * the trade's own price action.
 */
export async function getTradeContext(tradeId: string): Promise<ContextResult> {
  if (!process.env.POLYGON_API_KEY) {
    return { ok: false, error: "POLYGON_API_KEY not set in environment", configured: false }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in.", configured: true }

  const { data: trade } = await supabase
    .from("trades")
    .select("user_id, opened_at")
    .eq("id", tradeId)
    .maybeSingle()
  if (!trade || trade.user_id !== user.id) return { ok: false, error: "Trade not found.", configured: true }
  if (!trade.opened_at) return { ok: false, error: "Trade has no opened_at.", configured: true }

  const r = await getMacroSnapshot(new Date(trade.opened_at).getTime())
  if (!r.ok) return { ok: false, error: r.error, configured: r.configured }
  return { ok: true, snapshot: r.snapshot }
}
