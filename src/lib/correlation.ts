/**
 * Per-currency exposure decomposition for open positions.
 *
 * The intuition: long EUR/USD, long GBP/USD, long AUD/USD, long XAU/USD
 * all share the same DXY-short side. They look like 4 trades but trade as 1.
 * This module turns a list of open positions into a per-currency net
 * exposure (in dollars), then surfaces concentrations that exceed a
 * configurable multiple of the user's typical per-trade risk.
 *
 * Pure functions, framework-free, no I/O.
 */

export type Position = {
  id: string
  pair: string
  side: "long" | "short"
  risk: number
}

export type ExposureContribution = {
  tradeId: string
  pair: string
  role: "base" | "quote"
  signed: number  // signed dollar amount: + means long this currency, − means short
}

export type CurrencyExposure = {
  currency: string
  netDollars: number               // signed
  contributions: ExposureContribution[]
}

export type CorrelationWarning = {
  currency: string
  netDollars: number
  tradeCount: number
  exposureMultiple: number   // |netDollars| / avg per-trade risk across all open positions
  direction: "long" | "short"
}

const PAIR_RE = /^([A-Z]{3,4})\s*\/\s*([A-Z]{3,4})$/

/**
 * Split a pair like "EUR/USD" into [base, quote]. Returns null when the
 * symbol doesn't decompose cleanly (indices, single-leg crypto, etc.).
 */
export function splitPair(pair: string): [string, string] | null {
  const m = PAIR_RE.exec(pair.trim().toUpperCase())
  if (!m) return null
  return [m[1], m[2]]
}

/**
 * Decompose each position into base + quote currency contributions, then
 * group and sum per currency.
 *
 *   long EUR/USD risk 100  → +100 EUR, −100 USD
 *   short USD/JPY risk 100 → −100 USD, +100 JPY
 *
 * Positions whose pair does not decompose are skipped (they don't contribute
 * to currency exposure).
 */
export function decomposePositions(positions: Position[]): CurrencyExposure[] {
  const map = new Map<string, CurrencyExposure>()
  for (const p of positions) {
    const split = splitPair(p.pair)
    if (!split) continue
    const [base, quote] = split
    const baseSign = p.side === "long" ? +1 : -1
    const quoteSign = -baseSign
    push(map, base, { tradeId: p.id, pair: p.pair, role: "base", signed: baseSign * p.risk })
    push(map, quote, { tradeId: p.id, pair: p.pair, role: "quote", signed: quoteSign * p.risk })
  }
  return Array.from(map.values()).sort((a, b) => Math.abs(b.netDollars) - Math.abs(a.netDollars))
}

function push(map: Map<string, CurrencyExposure>, currency: string, c: ExposureContribution) {
  let exp = map.get(currency)
  if (!exp) { exp = { currency, netDollars: 0, contributions: [] }; map.set(currency, exp) }
  exp.netDollars += c.signed
  exp.contributions.push(c)
}

/**
 * Find currencies whose net exposure dominates the open book.
 *
 * Defaults:
 *  - minTrades: at least 3 contributing trades (anything below isn't a
 *    "concentration" it's just having a position)
 *  - minMultiple: 2.0 — net exposure ≥ 2× average per-trade risk
 *
 * Returns warnings sorted by exposureMultiple, descending.
 */
export function findCorrelationWarnings(
  positions: Position[],
  opts: { minTrades?: number; minMultiple?: number } = {},
): CorrelationWarning[] {
  const minTrades = opts.minTrades ?? 3
  const minMultiple = opts.minMultiple ?? 2
  if (positions.length < minTrades) return []

  const totalRisk = positions.reduce((s, p) => s + Math.abs(p.risk), 0)
  if (totalRisk <= 0) return []
  const avgRisk = totalRisk / positions.length

  const exposures = decomposePositions(positions)
  const warnings: CorrelationWarning[] = []
  for (const e of exposures) {
    const abs = Math.abs(e.netDollars)
    const mult = abs / avgRisk
    const tradeCount = new Set(e.contributions.map((c) => c.tradeId)).size
    if (mult >= minMultiple && tradeCount >= minTrades) {
      warnings.push({
        currency: e.currency,
        netDollars: e.netDollars,
        tradeCount,
        exposureMultiple: mult,
        direction: e.netDollars >= 0 ? "long" : "short",
      })
    }
  }
  warnings.sort((a, b) => b.exposureMultiple - a.exposureMultiple)
  return warnings
}

/**
 * Format an exposureMultiple as a percentage string ("240%" / "180%").
 * Used in the warning banner.
 */
export function formatExposurePct(multiple: number): string {
  return `${Math.round(multiple * 100)}%`
}
