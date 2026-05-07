import { describe, it, expect } from "vitest"
import { sharpeR, sortinoR, calmar, ulcerIndex, maxDrawdown } from "./risk-metrics"

describe("sharpeR", () => {
  it("returns null for samples below 5", () => {
    expect(sharpeR([])).toBeNull()
    expect(sharpeR([1, 1, 1, 1])).toBeNull()
  })
  it("returns null when stdev is zero (all equal)", () => {
    expect(sharpeR([1, 1, 1, 1, 1])).toBeNull()
  })
  it("positive mean / variance produces positive ratio", () => {
    const r = sharpeR([1, 1, 2, 2, 3])
    expect(r).not.toBeNull()
    expect(r!).toBeGreaterThan(0)
  })
  it("negative mean produces negative ratio", () => {
    const r = sharpeR([-1, -2, -1, -2, -1])
    expect(r!).toBeLessThan(0)
  })
})

describe("sortinoR", () => {
  it("null for too few samples", () => {
    expect(sortinoR([1, 2, 3])).toBeNull()
  })
  it("null when no losses (no downside denominator)", () => {
    expect(sortinoR([1, 2, 3, 4, 5])).toBeNull()
  })
  it("higher than Sharpe when distribution is right-skewed", () => {
    const rs = [-1, -1, 5, 5, 5, 5]
    const sharpe = sharpeR(rs)!
    const sortino = sortinoR(rs)!
    expect(sortino).toBeGreaterThan(sharpe)
  })
})

describe("maxDrawdown", () => {
  it("zero on monotonic-up curve", () => {
    expect(maxDrawdown([0, 100, 200, 300])).toBe(0)
  })
  it("matches the worst peak-to-trough", () => {
    expect(maxDrawdown([0, 100, 50, 80, 30, 90])).toBe(70) // peak 100 → trough 30
  })
  it("zero for empty input", () => {
    expect(maxDrawdown([])).toBe(0)
  })
})

describe("calmar", () => {
  it("null for no drawdown", () => {
    expect(calmar([0, 100, 200])).toBeNull()
  })
  it("net P&L over max DD", () => {
    // ending = 90, max DD = 70 (peak 100 → trough 30), so 90/70 = 1.29
    const c = calmar([0, 100, 50, 80, 30, 90])
    expect(c).toBeCloseTo(1.29, 1)
  })
})

describe("ulcerIndex", () => {
  it("zero on monotonic-up", () => {
    expect(ulcerIndex([0, 100, 200, 300])).toBe(0)
  })
  it("higher when underwater longer/deeper", () => {
    const shallow = ulcerIndex([100, 95, 100, 95, 100])!
    const deep = ulcerIndex([100, 50, 50, 50, 50])!
    expect(deep).toBeGreaterThan(shallow)
  })
})
