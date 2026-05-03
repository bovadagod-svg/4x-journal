/**
 * Risk-of-Ruin Monte Carlo.
 *
 * Most retail traders intuit that 58% WR + 0.3R expectancy is "fine," not
 * realizing the math says ~14% chance of a 50% drawdown over 100 trades at
 * 1% risk. This module quantifies that gap.
 *
 * Pure functions, framework-free, deterministic when `seed` is provided.
 */

export type RuinInput = {
  /** Win rate as a fraction in [0, 1]. */
  winRate: number
  /** Average winning trade in R-multiples (positive). */
  avgWinR: number
  /** Average losing trade in R-multiples — magnitude (positive). 1.0 means a loss equals 1× risk. */
  avgLossR: number
  /** Risk per trade as a fraction of equity. 0.01 = 1%. */
  riskPerTradePct: number
  /** Number of trades to simulate forward. */
  n: number
  /** Drawdown thresholds to report, as fractions in (0, 1). Defaults to [0.25, 0.5, 0.75]. */
  thresholds?: number[]
  /** Number of Monte Carlo paths. Defaults to 5000 — good speed/accuracy for UI. */
  paths?: number
  /** Optional seed for deterministic results (tests). */
  seed?: number
}

export type RuinResult = {
  /** P(max drawdown ≥ threshold) for each requested threshold. */
  thresholds: { threshold: number; probability: number }[]
  /** Median ending equity multiple across paths (1 = breakeven). */
  medianEnding: number
  /** Number of paths simulated (≥ inputs.paths or default 5000). */
  paths: number
}

/**
 * Compute risk-of-ruin probabilities by Monte Carlo.
 *
 * Each path starts at equity = 1. At each trade, with probability `winRate`
 * the balance multiplies by (1 + avgWinR × riskPerTradePct); otherwise by
 * (1 − avgLossR × riskPerTradePct). After every trade we update the peak
 * and check `1 − balance/peak ≥ threshold` for each requested threshold.
 *
 * Compounding (rather than fixed-fractional) is the conservative choice —
 * matches how most retail journals size: risk %-of-current-equity.
 */
export function probabilityOfRuin(input: RuinInput): RuinResult {
  const winRate = clamp(input.winRate, 0, 1)
  const avgWinR = Math.max(0, input.avgWinR)
  const avgLossR = Math.max(0, input.avgLossR)
  const riskPct = Math.max(0, input.riskPerTradePct)
  const n = Math.max(1, Math.floor(input.n))
  const thresholds = (input.thresholds ?? [0.25, 0.5, 0.75])
    .filter((t) => t > 0 && t < 1)
  const paths = Math.max(1, Math.floor(input.paths ?? 5000))

  // Per-trade balance multipliers — pre-compute once.
  const winMul = 1 + avgWinR * riskPct
  const lossMul = Math.max(0, 1 - avgLossR * riskPct)

  // Degenerate cases — return zeros without burning CPU.
  if (riskPct === 0 || (winMul === 1 && lossMul === 1)) {
    return {
      thresholds: thresholds.map((t) => ({ threshold: t, probability: 0 })),
      medianEnding: 1,
      paths,
    }
  }

  const rng = makeRng(input.seed)
  const hits = thresholds.map(() => 0)
  const endings: number[] = new Array(paths)

  for (let p = 0; p < paths; p++) {
    let balance = 1
    let peak = 1
    const reachedThreshold = new Array(thresholds.length).fill(false) as boolean[]
    for (let i = 0; i < n; i++) {
      balance *= rng() < winRate ? winMul : lossMul
      if (balance > peak) peak = balance
      const dd = 1 - balance / peak
      for (let k = 0; k < thresholds.length; k++) {
        if (!reachedThreshold[k] && dd >= thresholds[k]) {
          reachedThreshold[k] = true
          hits[k]++
        }
      }
      // Once balance hits zero (or near-zero with riskPct extreme), nothing
      // will recover it; short-circuit the rest of the path.
      if (balance < 1e-9) {
        for (let k = 0; k < thresholds.length; k++) {
          if (!reachedThreshold[k]) { reachedThreshold[k] = true; hits[k]++ }
        }
        break
      }
    }
    endings[p] = balance
  }

  endings.sort((a, b) => a - b)
  const median = endings[Math.floor(paths / 2)]

  return {
    thresholds: thresholds.map((t, i) => ({ threshold: t, probability: hits[i] / paths })),
    medianEnding: Number.isFinite(median) ? median : 1,
    paths,
  }
}

/**
 * Derive the four probabilityOfRuin inputs from a closed-trades stats object.
 * Returns null when there's not enough data (need ≥ 1 win and ≥ 1 loss to
 * have meaningful avgWinR / avgLossR).
 */
export function ruinInputsFromStats(stats: {
  winRate: number          // percent (0–100), as the analytics agg() emits
  rs: number[]
}, riskPerTradePct: number, n: number): RuinInput | null {
  const wins = stats.rs.filter((r) => r > 0)
  const losses = stats.rs.filter((r) => r < 0)
  if (wins.length === 0 || losses.length === 0) return null
  const avgWinR = wins.reduce((s, r) => s + r, 0) / wins.length
  const avgLossR = Math.abs(losses.reduce((s, r) => s + r, 0) / losses.length)
  return {
    winRate: stats.winRate / 100,
    avgWinR,
    avgLossR,
    riskPerTradePct,
    n,
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/**
 * Mulberry32 — small, fast, well-distributed PRNG with explicit seed.
 * Enough quality for Monte Carlo at 5–10k paths, deterministic for tests.
 */
function makeRng(seed?: number): () => number {
  if (seed == null) {
    return Math.random
  }
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
