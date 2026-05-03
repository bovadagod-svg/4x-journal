import { describe, expect, it } from "vitest"
import { pipSize, pipsBetween, slPips, tpPips, realizedPips, formatPips, pipBucket } from "./pip"

describe("pipSize", () => {
  it("returns 0.0001 for majors", () => {
    expect(pipSize("EUR/USD")).toBe(0.0001)
    expect(pipSize("GBP/USD")).toBe(0.0001)
    expect(pipSize("EURUSD")).toBe(0.0001) // no-slash form too
  })
  it("returns 0.01 for JPY pairs", () => {
    expect(pipSize("USD/JPY")).toBe(0.01)
    expect(pipSize("GBP/JPY")).toBe(0.01)
  })
  it("returns 0.10 for metals", () => {
    expect(pipSize("XAU/USD")).toBe(0.10)
    expect(pipSize("XAG/USD")).toBe(0.10)
  })
  it("returns 1 for crypto + indices", () => {
    expect(pipSize("BTC/USD")).toBe(1)
    expect(pipSize("US100")).toBe(1)
  })
})

describe("pipsBetween", () => {
  it("calculates EUR/USD pips correctly", () => {
    // 1.08412 - 1.08200 = 0.00212 → 21.2 pips
    expect(pipsBetween(1.08412, 1.08200, "EUR/USD")).toBeCloseTo(21.2, 1)
  })
  it("calculates JPY pips correctly", () => {
    // 154.50 - 154.00 = 0.50 → 50 pips
    expect(pipsBetween(154.50, 154.00, "USD/JPY")).toBe(50)
  })
  it("calculates XAU pips correctly (0.10 = 1 pip)", () => {
    // 2350.50 - 2340.00 = 10.50 → 105 pips
    expect(pipsBetween(2350.50, 2340.00, "XAU/USD")).toBe(105)
  })
  it("is sign-agnostic", () => {
    expect(pipsBetween(1.08412, 1.08200, "EUR/USD"))
      .toEqual(pipsBetween(1.08200, 1.08412, "EUR/USD"))
  })
})

describe("slPips", () => {
  it("returns long trade SL distance correctly", () => {
    expect(slPips({ side: "long", entry: 1.08412, stop: 1.08200, pair: "EUR/USD" })).toBe(21.2)
  })
  it("returns short trade SL distance correctly", () => {
    expect(slPips({ side: "short", entry: 1.08412, stop: 1.08600, pair: "EUR/USD" })).toBe(18.8)
  })
  it("returns null for missing stop", () => {
    expect(slPips({ side: "long", entry: 1.08, stop: null, pair: "EUR/USD" })).toBeNull()
  })
  it("returns null for stop on wrong side (long with stop above entry)", () => {
    expect(slPips({ side: "long", entry: 1.08, stop: 1.09, pair: "EUR/USD" })).toBeNull()
  })
  it("returns null for stop on wrong side (short with stop below entry)", () => {
    expect(slPips({ side: "short", entry: 1.08, stop: 1.07, pair: "EUR/USD" })).toBeNull()
  })
})

describe("tpPips", () => {
  it("returns long trade TP distance correctly", () => {
    expect(tpPips({ side: "long", entry: 1.08412, target: 1.09000, pair: "EUR/USD" })).toBe(58.8)
  })
  it("returns null for target on wrong side (long with target below entry)", () => {
    expect(tpPips({ side: "long", entry: 1.08, target: 1.07, pair: "EUR/USD" })).toBeNull()
  })
})

describe("realizedPips", () => {
  it("returns positive for winning long", () => {
    expect(realizedPips({ side: "long", entry: 1.08, exit: 1.09, pair: "EUR/USD" })).toBe(100)
  })
  it("returns negative for losing long", () => {
    expect(realizedPips({ side: "long", entry: 1.08, exit: 1.07, pair: "EUR/USD" })).toBe(-100)
  })
  it("flips for short side", () => {
    expect(realizedPips({ side: "short", entry: 1.08, exit: 1.07, pair: "EUR/USD" })).toBe(100)
    expect(realizedPips({ side: "short", entry: 1.08, exit: 1.09, pair: "EUR/USD" })).toBe(-100)
  })
})

describe("formatPips", () => {
  it("renders — when null", () => {
    expect(formatPips(null)).toBe("—")
  })
  it("renders without sign by default", () => {
    expect(formatPips(45.5)).toBe("45.5p")
    expect(formatPips(-12.5)).toBe("-12.5p")
  })
  it("renders + sign when signed=true and positive", () => {
    expect(formatPips(45.5, { signed: true })).toBe("+45.5p")
  })
})

describe("pipBucket", () => {
  it("buckets EUR/USD-style pairs into 10-pip widths", () => {
    expect(pipBucket(5, "EUR/USD")).toBe("<10")
    expect(pipBucket(15, "EUR/USD")).toBe("10–19")
    expect(pipBucket(25, "EUR/USD")).toBe("20–29")
    expect(pipBucket(45, "EUR/USD")).toBe("30–49")
    expect(pipBucket(75, "EUR/USD")).toBe("50–99")
    expect(pipBucket(120, "EUR/USD")).toBe("100+")
  })
  it("buckets JPY/metal/crypto pairs into wider ranges", () => {
    expect(pipBucket(15, "USD/JPY")).toBe("<20")
    expect(pipBucket(40, "USD/JPY")).toBe("20–49")
    expect(pipBucket(75, "XAU/USD")).toBe("50–99")
    expect(pipBucket(150, "XAU/USD")).toBe("100–199")
    expect(pipBucket(250, "XAU/USD")).toBe("200+")
  })
})
