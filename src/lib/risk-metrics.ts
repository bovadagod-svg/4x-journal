/**
 * Risk-adjusted performance metrics. Pure functions over an R series and an
 * equity-curve series. No DB / API dependencies — composable from any agg
 * the analytics layer already builds.
 *
 * Definitions follow the trader-journal convention (R-based, not annualized)
 * because annualization needs an assumed trade frequency that the user hasn't
 * declared. The numbers are still comparable across users since they're all
 * R-normalized.
 */

/**
 * Sharpe ratio in R-units: mean(R) / stdev(R). Treats the R series itself as
 * the return stream, with risk-free rate = 0 (since R is already
 * risk-normalized).
 *
 * Returns null when the sample is too small or stdev is zero (degenerate).
 */
export function sharpeR(rs: number[]): number | null {
  if (rs.length < 5) return null
  const mean = avg(rs)
  const variance = avg(rs.map((r) => (r - mean) ** 2))
  const stdev = Math.sqrt(variance)
  if (stdev === 0) return null
  return Number((mean / stdev).toFixed(2))
}

/**
 * Sortino ratio in R-units: mean(R) / downside-stdev(R). Like Sharpe but only
 * penalizes negative deviations. Better for the asymmetric distributions
 * trading produces (one big win shouldn't inflate the "risk" denominator).
 */
export function sortinoR(rs: number[]): number | null {
  if (rs.length < 5) return null
  const mean = avg(rs)
  const losses = rs.filter((r) => r < 0)
  if (losses.length === 0) return null
  const downsideVar = avg(losses.map((r) => r ** 2))
  const downsideStdev = Math.sqrt(downsideVar)
  if (downsideStdev === 0) return null
  return Number((mean / downsideStdev).toFixed(2))
}

/**
 * Calmar-style ratio: net P&L / max drawdown $. The trader-journal version of
 * the textbook Calmar (CAGR / max DD %) — without an annualized return assumption,
 * raw P&L vs raw DD is the apples-to-apples version.
 *
 * Returns null when no drawdown has occurred (no denominator).
 */
export function calmar(equityCurve: number[]): number | null {
  if (equityCurve.length < 2) return null
  const last = equityCurve[equityCurve.length - 1]
  const dd = maxDrawdown(equityCurve)
  if (dd === 0) return null
  return Number((last / dd).toFixed(2))
}

/**
 * Ulcer Index — penalizes sustained drawdowns. sqrt(mean(dd_pct^2)).
 *
 * dd_pct here is calculated against the running peak; we use absolute dollar
 * drawdown since equity curve units may be mixed (per-trade P&L vs balance
 * snapshots). Lower = healthier equity shape.
 */
export function ulcerIndex(equityCurve: number[]): number | null {
  if (equityCurve.length < 2) return null
  let peak = equityCurve[0]
  const ddSquares: number[] = []
  for (const v of equityCurve) {
    if (v > peak) peak = v
    const dd = peak > 0 ? ((peak - v) / peak) * 100 : (peak - v)
    ddSquares.push(dd ** 2)
  }
  return Number(Math.sqrt(avg(ddSquares)).toFixed(2))
}

/**
 * Max drawdown in dollars (or whatever unit the equity curve is in).
 * Walks the series tracking running peak and maximum peak-to-trough gap.
 */
export function maxDrawdown(equityCurve: number[]): number {
  if (equityCurve.length === 0) return 0
  let peak = equityCurve[0]
  let maxDd = 0
  for (const v of equityCurve) {
    if (v > peak) peak = v
    const dd = peak - v
    if (dd > maxDd) maxDd = dd
  }
  return Number(maxDd.toFixed(2))
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, x) => s + x, 0) / arr.length
}
