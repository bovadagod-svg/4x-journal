import { describe, expect, it } from "vitest"
import { simulate } from "./monte-carlo"

describe("simulate", () => {
  it("paths is rectangular: pathCount × (n+1) and starts at startBalance", () => {
    const r = simulate({
      winRate: 0.55, avgWinR: 1.5, avgLossR: 1, riskPerTradePct: 0.01,
      startBalance: 10000, n: 50, paths: 200, seed: 1,
    })
    expect(r.paths.length).toBe(200)
    for (const path of r.paths) {
      expect(path.length).toBe(51)
      expect(path[0]).toBe(10000)
    }
  })

  it("percentile envelopes are correctly ordered (p05 ≤ p25 ≤ p50 ≤ p75 ≤ p95)", () => {
    const r = simulate({
      winRate: 0.55, avgWinR: 1.5, avgLossR: 1, riskPerTradePct: 0.01,
      startBalance: 10000, n: 100, paths: 500, seed: 2,
    })
    for (let i = 0; i <= 100; i++) {
      expect(r.percentiles.p05[i]).toBeLessThanOrEqual(r.percentiles.p25[i])
      expect(r.percentiles.p25[i]).toBeLessThanOrEqual(r.percentiles.p50[i])
      expect(r.percentiles.p50[i]).toBeLessThanOrEqual(r.percentiles.p75[i])
      expect(r.percentiles.p75[i]).toBeLessThanOrEqual(r.percentiles.p95[i])
    }
  })

  it("riskPct = 0 → every path stays at startBalance", () => {
    const r = simulate({
      winRate: 0.55, avgWinR: 1.5, avgLossR: 1, riskPerTradePct: 0,
      startBalance: 10000, n: 50, paths: 100, seed: 3,
    })
    for (const path of r.paths) {
      for (const v of path) expect(v).toBe(10000)
    }
    expect(r.endingStats.p50).toBe(10000)
  })

  it("100% win rate at 1% risk produces only growing paths", () => {
    const r = simulate({
      winRate: 1, avgWinR: 1.5, avgLossR: 1, riskPerTradePct: 0.01,
      startBalance: 10000, n: 100, paths: 50, seed: 4,
    })
    for (const path of r.paths) {
      // Strictly increasing
      for (let i = 1; i < path.length; i++) {
        expect(path[i]).toBeGreaterThan(path[i - 1])
      }
    }
    expect(r.endingStats.p05).toBeGreaterThan(10000)
  })

  it("positive expectancy → median ending > starting balance over enough trades", () => {
    const r = simulate({
      winRate: 0.55, avgWinR: 1.5, avgLossR: 1, riskPerTradePct: 0.01,
      startBalance: 10000, n: 200, paths: 1000, seed: 5,
    })
    expect(r.endingStats.p50).toBeGreaterThan(10000)
  })

  it("is deterministic when seeded", () => {
    const a = simulate({
      winRate: 0.55, avgWinR: 1.4, avgLossR: 1, riskPerTradePct: 0.01,
      startBalance: 10000, n: 50, paths: 100, seed: 12345,
    })
    const b = simulate({
      winRate: 0.55, avgWinR: 1.4, avgLossR: 1, riskPerTradePct: 0.01,
      startBalance: 10000, n: 50, paths: 100, seed: 12345,
    })
    expect(b.endingStats.p50).toBe(a.endingStats.p50)
    expect(b.percentiles.p50[25]).toBe(a.percentiles.p50[25])
  })
})
