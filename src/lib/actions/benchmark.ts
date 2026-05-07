"use server"

import { getAggregates, type Aggregate } from "@/lib/integrations/polygon"

export type BenchmarkSymbol = "spx" | "dxy" | "vix"
export type BenchmarkPoint = { date: string; pctFromStart: number }

const TICKER: Record<BenchmarkSymbol, string> = {
  spx: "I:SPX",
  dxy: "I:DXY",
  vix: "I:VIX",
}

const LABEL: Record<BenchmarkSymbol, string> = {
  spx: "S&P 500",
  dxy: "DXY",
  vix: "VIX",
}

export function benchmarkLabel(s: BenchmarkSymbol): string {
  return LABEL[s]
}

/**
 * Fetch a benchmark price series and convert to %-change-from-first-bar so it
 * can be overlaid on the equity-curve card. Daily bars only — equity curve is
 * sampled per closed trade, so daily granularity is plenty.
 *
 * Returns `{ ok: false, configured }` when Polygon isn't set up so the client
 * can render an explanatory message instead of an empty chart.
 */
export async function getBenchmarkSeries(
  symbol: BenchmarkSymbol,
  fromIso: string,
  toIso: string,
): Promise<
  | { ok: true; symbol: BenchmarkSymbol; label: string; points: BenchmarkPoint[] }
  | { ok: false; configured: boolean; error?: string }
> {
  const ticker = TICKER[symbol]
  const r = await getAggregates({
    ticker,
    multiplier: 1,
    timespan: "day",
    from: new Date(fromIso).getTime(),
    to: new Date(toIso).getTime(),
  })
  if (!r.ok) return { ok: false, configured: r.configured ?? false, error: r.error }
  const bars = r.bars ?? []
  if (bars.length < 2) return { ok: true, symbol, label: LABEL[symbol], points: [] }
  const first = bars[0].close
  const points: BenchmarkPoint[] = bars.map((b: Aggregate) => ({
    date: new Date(b.ts).toISOString().slice(0, 10),
    pctFromStart: first > 0 ? ((b.close - first) / first) * 100 : 0,
  }))
  return { ok: true, symbol, label: LABEL[symbol], points }
}
