/**
 * Monte Carlo equity-curve simulator.
 *
 * Forward-projects N paths of n trades using a fixed-fractional model:
 * each trade either wins (×(1 + avgWinR·riskPct)) or loses (×(1 − avgLossR·riskPct)).
 * Companion to lib/ruin.ts — same physics, different output (full path matrix
 * here vs threshold probabilities there).
 */

export type SimulateInput = {
  /** Win rate as a fraction in [0, 1]. */
  winRate: number
  /** Average winning trade in R-multiples (positive). */
  avgWinR: number
  /** Average losing trade in R-multiples — magnitude (positive). */
  avgLossR: number
  /** Risk per trade as a fraction of equity. 0.01 = 1%. */
  riskPerTradePct: number
  /** Starting balance. */
  startBalance: number
  /** Number of trades to simulate forward. */
  n: number
  /** Number of paths. Defaults to 1000. */
  paths?: number
  /** Optional seed for deterministic output (tests). */
  seed?: number
}

export type SimulateResult = {
  /** Equity curves: paths.length × (n+1). Every row starts at startBalance. */
  paths: number[][]
  /** Per-timestep percentile envelopes: each array has length n+1. */
  percentiles: {
    p05: number[]
    p25: number[]
    p50: number[]
    p75: number[]
    p95: number[]
  }
  /** Final-balance distribution stats. */
  endingStats: {
    p05: number
    p25: number
    p50: number
    p75: number
    p95: number
    mean: number
  }
}

export function simulate(input: SimulateInput): SimulateResult {
  const winRate = clamp(input.winRate, 0, 1)
  const avgWinR = Math.max(0, input.avgWinR)
  const avgLossR = Math.max(0, input.avgLossR)
  const riskPct = Math.max(0, input.riskPerTradePct)
  const start = Math.max(0, input.startBalance)
  const n = Math.max(1, Math.floor(input.n))
  const pathCount = Math.max(1, Math.floor(input.paths ?? 1000))

  const winMul = 1 + avgWinR * riskPct
  const lossMul = Math.max(0, 1 - avgLossR * riskPct)
  const rng = makeRng(input.seed)

  const paths: number[][] = new Array(pathCount)
  for (let p = 0; p < pathCount; p++) {
    const curve: number[] = new Array(n + 1)
    curve[0] = start
    let bal = start
    for (let i = 0; i < n; i++) {
      bal *= rng() < winRate ? winMul : lossMul
      if (bal < 1e-9) bal = 0
      curve[i + 1] = bal
    }
    paths[p] = curve
  }

  // Per-timestep percentiles. For each step, sort paths' values.
  const percentiles = {
    p05: new Array<number>(n + 1),
    p25: new Array<number>(n + 1),
    p50: new Array<number>(n + 1),
    p75: new Array<number>(n + 1),
    p95: new Array<number>(n + 1),
  }
  const col = new Array<number>(pathCount)
  for (let i = 0; i <= n; i++) {
    for (let p = 0; p < pathCount; p++) col[p] = paths[p][i]
    col.sort((a, b) => a - b)
    percentiles.p05[i] = col[idx(pathCount, 0.05)]
    percentiles.p25[i] = col[idx(pathCount, 0.25)]
    percentiles.p50[i] = col[idx(pathCount, 0.5)]
    percentiles.p75[i] = col[idx(pathCount, 0.75)]
    percentiles.p95[i] = col[idx(pathCount, 0.95)]
  }

  // Ending-balance stats (last column).
  const endings: number[] = new Array(pathCount)
  for (let p = 0; p < pathCount; p++) endings[p] = paths[p][n]
  endings.sort((a, b) => a - b)
  const endingStats = {
    p05: endings[idx(pathCount, 0.05)],
    p25: endings[idx(pathCount, 0.25)],
    p50: endings[idx(pathCount, 0.5)],
    p75: endings[idx(pathCount, 0.75)],
    p95: endings[idx(pathCount, 0.95)],
    mean: endings.reduce((s, x) => s + x, 0) / pathCount,
  }

  return { paths, percentiles, endingStats }
}

function idx(count: number, q: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(count * q)))
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

// Mulberry32 PRNG — same impl as lib/ruin.ts; duplicated to keep the
// simulator self-contained.
function makeRng(seed?: number): () => number {
  if (seed == null) return Math.random
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
