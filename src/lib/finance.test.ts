import { describe, expect, it } from "vitest"
import { computeR, computePnL, formatUSD } from "./finance"

describe("computeR", () => {
  it("returns null when stop is missing", () => {
    expect(computeR({ side: "long", entry: 1.08, stop: null, exit: 1.09 })).toBeNull()
  })
  it("returns null when exit is missing", () => {
    expect(computeR({ side: "long", entry: 1.08, stop: 1.07, exit: null })).toBeNull()
  })
  it("returns null when risk is non-positive (long with stop above entry)", () => {
    expect(computeR({ side: "long", entry: 1.08, stop: 1.09, exit: 1.10 })).toBeNull()
  })
  it("computes +1R correctly for a long winner", () => {
    // entry 1.08, stop 1.07, exit 1.09: risk=0.01, reward=0.01 → 1.0R
    expect(computeR({ side: "long", entry: 1.08, stop: 1.07, exit: 1.09 })).toBe(1)
  })
  it("computes +2R correctly for a long winner", () => {
    expect(computeR({ side: "long", entry: 1.08, stop: 1.07, exit: 1.10 })).toBe(2)
  })
  it("computes -1R correctly for a long loser at stop", () => {
    expect(computeR({ side: "long", entry: 1.08, stop: 1.07, exit: 1.07 })).toBe(-1)
  })
  it("flips sign for short side", () => {
    // short entry 1.08 stop 1.09 exit 1.07: risk=0.01, reward=0.01 → +1R
    expect(computeR({ side: "short", entry: 1.08, stop: 1.09, exit: 1.07 })).toBe(1)
  })
})

describe("computePnL", () => {
  it("returns null when exit is missing", () => {
    expect(computePnL({ side: "long", entry: 1.08, exit: null, size: 10000 })).toBeNull()
  })
  it("computes long winner", () => {
    expect(computePnL({ side: "long", entry: 1.08, exit: 1.09, size: 10000 })).toBe(100)
  })
  it("computes long loser", () => {
    expect(computePnL({ side: "long", entry: 1.08, exit: 1.07, size: 10000 })).toBe(-100)
  })
  it("computes short winner (flips sign)", () => {
    expect(computePnL({ side: "short", entry: 1.08, exit: 1.07, size: 10000 })).toBe(100)
  })
  it("computes short loser (flips sign)", () => {
    expect(computePnL({ side: "short", entry: 1.08, exit: 1.09, size: 10000 })).toBe(-100)
  })
  it("rounds to 2 decimals", () => {
    expect(computePnL({ side: "long", entry: 1.08001, exit: 1.08051, size: 12345 })).toBe(6.17)
  })
})

describe("formatUSD", () => {
  it("formats positive without sign by default", () => {
    expect(formatUSD(100)).toBe("$100.00")
  })
  it("adds + prefix when signed=true and value positive", () => {
    expect(formatUSD(100, { signed: true })).toBe("+$100.00")
  })
  it("uses native minus for negative regardless of signed flag", () => {
    expect(formatUSD(-100, { signed: true })).toBe("-$100.00")
  })
  it("respects min/max digits", () => {
    expect(formatUSD(1234.5, { min: 0, max: 0 })).toBe("$1,235")
  })
  it("preserves cents for exact integer with default settings", () => {
    expect(formatUSD(1234)).toBe("$1,234.00")
  })
})
