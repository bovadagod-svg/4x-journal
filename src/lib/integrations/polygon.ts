import "server-only"

/**
 * Polygon.io client — minimal, just the two endpoints we need.
 *
 * Activation: requires POLYGON_API_KEY. Without it, every function returns
 * null so callers can render "not configured" UI instead of erroring.
 *
 * Free-tier coverage:
 *   - FX majors (C:EURUSD, C:GBPUSD, etc.) — 5-minute delayed
 *   - Indices (I:DXY, I:SPX, I:VIX) — varies; some require a paid plan
 *   - Metals (C:XAUUSD) — sometimes requires a paid plan
 *
 * If the response is 403/404 we surface a helpful error so the user knows
 * the symbol they want isn't on their plan.
 */

const POLYGON_BASE = "https://api.polygon.io"

export type Aggregate = {
  ts: number      // Unix ms
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type AggregatesResult =
  | { ok: true; bars: Aggregate[] }
  | { ok: false; status: number; error: string; configured: boolean }

/**
 * Polygon Aggregates (Bars) endpoint:
 * GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
 *
 * `from` / `to` accept either YYYY-MM-DD or Unix ms.
 */
export async function getAggregates(args: {
  ticker: string                                 // "C:EURUSD", "I:SPX", "X:BTCUSD"
  multiplier: number                             // 1, 5, 15
  timespan: "minute" | "hour" | "day"
  from: string | number
  to: string | number
  limit?: number                                 // up to 50000 on paid; 5000 default
}): Promise<AggregatesResult> {
  if (!process.env.POLYGON_API_KEY) {
    return { ok: false, status: 0, error: "POLYGON_API_KEY not set", configured: false }
  }
  const url = new URL(
    `/v2/aggs/ticker/${encodeURIComponent(args.ticker)}/range/${args.multiplier}/${args.timespan}/${encodeURIComponent(String(args.from))}/${encodeURIComponent(String(args.to))}`,
    POLYGON_BASE,
  )
  if (args.limit) url.searchParams.set("limit", String(args.limit))
  url.searchParams.set("apiKey", process.env.POLYGON_API_KEY)
  url.searchParams.set("sort", "asc")

  const r = await fetch(url.toString(), { cache: "no-store" })
  if (!r.ok) {
    let body: unknown = null
    try { body = await r.json() } catch { /* swallow */ }
    const msg = (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string")
      ? (body as { error: string }).error
      : `Polygon HTTP ${r.status}`
    return { ok: false, status: r.status, error: msg, configured: true }
  }
  const body = await r.json() as { results?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }> }
  const bars: Aggregate[] = (body.results ?? []).map((b) => ({
    ts: b.t, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v,
  }))
  return { ok: true, bars }
}

/**
 * Convenience: convert a TL/internal pair like "EUR/USD" into Polygon's
 * forex ticker format ("C:EURUSD"). Returns null for symbols Polygon
 * doesn't carry under the obvious mapping.
 */
export function pairToPolygonTicker(pair: string): string | null {
  const p = pair.toUpperCase().replace("/", "")
  // Forex: 6 letters → C:XXXYYY
  if (/^[A-Z]{6}$/.test(p)) return `C:${p}`
  // Metals (XAUUSD, XAGUSD) → C:
  if (/^X[A-Z]{2}USD$/.test(p)) return `C:${p}`
  // Crypto: most common 6-letter crypto pairs → X:
  if (/^(BTC|ETH|LTC|XRP|BCH|ADA|SOL|DOGE)USD$/.test(p)) return `X:${p}`
  // Common indices already in I: form
  if (/^(SPX|NDX|DJI|VIX|DXY)$/.test(p)) return `I:${p}`
  return null
}

export type TickerSnapshot = {
  pair: string
  price: number | null
  prevClose: number | null
  changePct: number | null  // 1-day %
  ts: number | null
}

/**
 * One-shot snapshot for a single FX pair: last close + prior daily close
 * + % change. Built on the Aggregates endpoint so it works on the free
 * tier (forex majors are covered).
 *
 * Returns price=null when Polygon doesn't carry the pair on the user's
 * plan, so the caller can render a placeholder cell instead of erroring.
 */
export async function getTickerSnapshot(pair: string): Promise<TickerSnapshot> {
  const ticker = pairToPolygonTicker(pair)
  if (!ticker) return { pair, price: null, prevClose: null, changePct: null, ts: null }
  // Pull a 14-day window so weekends + holidays don't leave us with < 2 bars.
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 14)
  const r = await getAggregates({
    ticker,
    multiplier: 1,
    timespan: "day",
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    limit: 14,
  })
  if (!r.ok || r.bars.length === 0) {
    return { pair, price: null, prevClose: null, changePct: null, ts: null }
  }
  const last = r.bars[r.bars.length - 1]
  const prev = r.bars.length >= 2 ? r.bars[r.bars.length - 2] : null
  const changePct = prev && prev.close > 0
    ? ((last.close - prev.close) / prev.close) * 100
    : null
  return {
    pair,
    price: last.close,
    prevClose: prev?.close ?? null,
    changePct,
    ts: last.ts,
  }
}

export type MacroSnapshot = {
  ts: number
  dxy: number | null
  spx: number | null
  vix: number | null
  dxyPctChange1d: number | null
  spxPctChange1d: number | null
}

export type MacroResult =
  | { ok: true; snapshot: MacroSnapshot }
  | { ok: false; error: string; configured: boolean }

/**
 * Best-effort macro snapshot at a given moment. Pulls a 1-day bar window
 * around the timestamp for each of DXY / SPX / VIX. Tolerant of partial
 * data — returns null for any series the user's Polygon plan doesn't carry.
 */
export async function getMacroSnapshot(timestampMs: number): Promise<MacroResult> {
  if (!process.env.POLYGON_API_KEY) {
    return { ok: false, error: "POLYGON_API_KEY not set", configured: false }
  }
  const dayMs = 86_400_000
  // Pull 2-day windows (the requested day + previous) so we can compute % change.
  const from = timestampMs - dayMs * 2
  const to = timestampMs + dayMs

  const [dxy, spx, vix] = await Promise.all([
    getAggregates({ ticker: "I:DXY", multiplier: 1, timespan: "day", from, to }).catch(() => null),
    getAggregates({ ticker: "I:SPX", multiplier: 1, timespan: "day", from, to }).catch(() => null),
    getAggregates({ ticker: "I:VIX", multiplier: 1, timespan: "day", from, to }).catch(() => null),
  ])

  const closeAt = (r: AggregatesResult | null): number | null => {
    if (!r || !r.ok || r.bars.length === 0) return null
    // Take the most recent bar at or before timestampMs.
    const bar = [...r.bars].reverse().find((b) => b.ts <= timestampMs)
    return bar?.close ?? r.bars[r.bars.length - 1].close
  }
  const pctChange = (r: AggregatesResult | null): number | null => {
    if (!r || !r.ok || r.bars.length < 2) return null
    const last = r.bars[r.bars.length - 1].close
    const prev = r.bars[r.bars.length - 2].close
    if (!prev) return null
    return ((last - prev) / prev) * 100
  }

  return {
    ok: true,
    snapshot: {
      ts: timestampMs,
      dxy: closeAt(dxy),
      spx: closeAt(spx),
      vix: closeAt(vix),
      dxyPctChange1d: pctChange(dxy),
      spxPctChange1d: pctChange(spx),
    },
  }
}
