import { describe, expect, it } from "vitest"
import { probabilityOfRuin, ruinInputsFromStats } from "./ruin"

describe("probabilityOfRuin", () => {
  it("riskPerTradePct = 0 → zero ruin probability for any threshold", () => {
    const r = probabilityOfRuin({
      winRate: 0.5, avgWinR: 1.5, avgLossR: 1, riskPerTradePct: 0, n: 100, seed: 1,
    })
    for (const row of r.thresholds) expect(row.probability).toBe(0)
    expect(r.medianEnding).toBe(1)
  })

  it("100% win rate → zero ruin probability (no losses ever)", () => {
    const r = probabilityOfRuin({
      winRate: 1, avgWinR: 1.5, avgLossR: 1, riskPerTradePct: 0.01, n: 100, seed: 1,
    })
    for (const row of r.thresholds) expect(row.probability).toBe(0)
    expect(r.medianEnding).toBeGreaterThan(1)
  })

  it("0% win rate at 1% risk → near-certain large drawdown", () => {
    const r = probabilityOfRuin({
      winRate: 0, avgWinR: 1.5, avgLossR: 1, riskPerTradePct: 0.01, n: 200, seed: 1,
      thresholds: [0.5, 0.75],
    })
    // 200 losses of 1% each compound to ~13% remaining → 87% drawdown.
    // Both 50% and 75% should be hit on every path.
    expect(r.thresholds[0].probability).toBe(1)
    expect(r.thresholds[1].probability).toBe(1)
  })

  it("at 3% risk the 25% DD probability is non-trivial but not certain", () => {
    // 1% risk would produce ~0% over 100 trades — peak-to-trough 25% needs
    // ~10 net compounded losses, infeasible at that risk level. 3% gives
    // a realistic non-zero baseline.
    const r = probabilityOfRuin({
      winRate: 0.58, avgWinR: 1.3, avgLossR: 1, riskPerTradePct: 0.03, n: 100, seed: 42,
      thresholds: [0.25],
      paths: 3000,
    })
    expect(r.thresholds[0].probability).toBeGreaterThan(0.05)
    expect(r.thresholds[0].probability).toBeLessThan(0.95)
  })

  it("higher risk % monotonically (or close to) increases drawdown probability", () => {
    const lo = probabilityOfRuin({
      winRate: 0.55, avgWinR: 1.5, avgLossR: 1, riskPerTradePct: 0.005, n: 100, seed: 7,
      thresholds: [0.5], paths: 3000,
    })
    const hi = probabilityOfRuin({
      winRate: 0.55, avgWinR: 1.5, avgLossR: 1, riskPerTradePct: 0.03, n: 100, seed: 7,
      thresholds: [0.5], paths: 3000,
    })
    expect(hi.thresholds[0].probability).toBeGreaterThan(lo.thresholds[0].probability)
  })

  it("is deterministic when given a seed", () => {
    const a = probabilityOfRuin({
      winRate: 0.55, avgWinR: 1.4, avgLossR: 1, riskPerTradePct: 0.01, n: 50, seed: 12345, paths: 1000,
    })
    const b = probabilityOfRuin({
      winRate: 0.55, avgWinR: 1.4, avgLossR: 1, riskPerTradePct: 0.01, n: 50, seed: 12345, paths: 1000,
    })
    for (let i = 0; i < a.thresholds.length; i++) {
      expect(b.thresholds[i].probability).toBe(a.thresholds[i].probability)
    }
    expect(b.medianEnding).toBe(a.medianEnding)
  })
})

describe("ruinInputsFromStats", () => {
  it("returns null when there are no losses", () => {
    expect(
      ruinInputsFromStats({ winRate: 100, rs: [1, 1.5, 2] }, 0.01, 100),
    ).toBeNull()
  })

  it("returns null when there are no wins", () => {
    expect(
      ruinInputsFromStats({ winRate: 0, rs: [-1, -1, -1] }, 0.01, 100),
    ).toBeNull()
  })

  it("derives avgWinR and avgLossR correctly", () => {
    const inp = ruinInputsFromStats(
      { winRate: 60, rs: [2, 1, 3, -1, -2] },
      0.01,
      100,
    )
    expect(inp).not.toBeNull()
    expect(inp!.winRate).toBeCloseTo(0.6)
    expect(inp!.avgWinR).toBeCloseTo(2) // (2+1+3)/3
    expect(inp!.avgLossR).toBeCloseTo(1.5) // |(-1 + -2)/2|
    expect(inp!.riskPerTradePct).toBe(0.01)
    expect(inp!.n).toBe(100)
  })
})
