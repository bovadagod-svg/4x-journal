import { describe, expect, it } from "vitest"
import { splitPair, decomposePositions, findCorrelationWarnings, formatExposurePct } from "./correlation"

describe("splitPair", () => {
  it("splits standard FX pairs", () => {
    expect(splitPair("EUR/USD")).toEqual(["EUR", "USD"])
    expect(splitPair("usd/jpy")).toEqual(["USD", "JPY"])
  })
  it("splits metals + crypto when they use the slash format", () => {
    expect(splitPair("XAU/USD")).toEqual(["XAU", "USD"])
    expect(splitPair("BTC/USD")).toEqual(["BTC", "USD"])
  })
  it("returns null for indices and other non-decomposable symbols", () => {
    expect(splitPair("US100")).toBeNull()
    expect(splitPair("SPX500")).toBeNull()
    expect(splitPair("")).toBeNull()
  })
})

describe("decomposePositions", () => {
  it("a single long EUR/USD contributes +EUR, −USD", () => {
    const r = decomposePositions([
      { id: "t1", pair: "EUR/USD", side: "long", risk: 100 },
    ])
    const eur = r.find((e) => e.currency === "EUR")!
    const usd = r.find((e) => e.currency === "USD")!
    expect(eur.netDollars).toBe(100)
    expect(usd.netDollars).toBe(-100)
  })

  it("4 USD-quoted longs aggregate to a 4× short USD position", () => {
    const r = decomposePositions([
      { id: "t1", pair: "EUR/USD", side: "long", risk: 100 },
      { id: "t2", pair: "GBP/USD", side: "long", risk: 100 },
      { id: "t3", pair: "AUD/USD", side: "long", risk: 100 },
      { id: "t4", pair: "XAU/USD", side: "long", risk: 100 },
    ])
    const usd = r.find((e) => e.currency === "USD")!
    expect(usd.netDollars).toBe(-400)
    expect(usd.contributions.length).toBe(4)
  })

  it("offsetting positions cancel out", () => {
    const r = decomposePositions([
      { id: "t1", pair: "EUR/USD", side: "long", risk: 100 },
      { id: "t2", pair: "USD/JPY", side: "long", risk: 100 },  // long USD, short JPY
    ])
    const usd = r.find((e) => e.currency === "USD")!
    expect(usd.netDollars).toBe(0)  // -100 from EUR/USD, +100 from USD/JPY
  })

  it("skips non-decomposable symbols (indices)", () => {
    const r = decomposePositions([
      { id: "t1", pair: "US100", side: "long", risk: 100 },
      { id: "t2", pair: "EUR/USD", side: "long", risk: 100 },
    ])
    // Only EUR + USD, no US100
    const currencies = r.map((e) => e.currency).sort()
    expect(currencies).toEqual(["EUR", "USD"])
  })

  it("sorted by absolute exposure (largest first)", () => {
    const r = decomposePositions([
      { id: "t1", pair: "EUR/USD", side: "long", risk: 50 },
      { id: "t2", pair: "GBP/USD", side: "long", risk: 100 },
      { id: "t3", pair: "AUD/USD", side: "long", risk: 100 },
    ])
    expect(r[0].currency).toBe("USD")  // |−250|
  })
})

describe("findCorrelationWarnings", () => {
  it("returns no warnings when fewer than minTrades positions", () => {
    const w = findCorrelationWarnings([
      { id: "t1", pair: "EUR/USD", side: "long", risk: 100 },
      { id: "t2", pair: "GBP/USD", side: "long", risk: 100 },
    ])
    expect(w).toEqual([])
  })

  it("flags net USD exposure when 4 USD-quoted longs are open", () => {
    const w = findCorrelationWarnings([
      { id: "t1", pair: "EUR/USD", side: "long", risk: 100 },
      { id: "t2", pair: "GBP/USD", side: "long", risk: 100 },
      { id: "t3", pair: "AUD/USD", side: "long", risk: 100 },
      { id: "t4", pair: "XAU/USD", side: "long", risk: 100 },
    ])
    expect(w.length).toBeGreaterThan(0)
    const usd = w.find((x) => x.currency === "USD")!
    expect(usd.direction).toBe("short")
    // 4 positions, |net| = 400, avg risk = 100, multiple = 4.
    expect(usd.exposureMultiple).toBe(4)
    expect(usd.tradeCount).toBe(4)
  })

  it("does not flag a balanced book", () => {
    const w = findCorrelationWarnings([
      { id: "t1", pair: "EUR/USD", side: "long", risk: 100 },   // -USD
      { id: "t2", pair: "USD/JPY", side: "long", risk: 100 },    // +USD
      { id: "t3", pair: "USD/CAD", side: "long", risk: 100 },    // +USD (net USD = +100)
      { id: "t4", pair: "GBP/USD", side: "short", risk: 100 },   // +USD (net USD = +200, mult = 2)
      { id: "t5", pair: "AUD/USD", side: "short", risk: 100 },   // +USD (net = +300, mult = 3 → flag)
      { id: "t6", pair: "NZD/USD", side: "long", risk: 100 },    // -USD (net = +200)
    ])
    // With 6 positions all $100, avg = 100. Net USD = +200, multiple = 2 → just at threshold.
    // Warnings sorted by multiple — the test cares that *something* below 2× isn't flagged.
    // Replace test to use a definitely-balanced book:
    const balanced = findCorrelationWarnings([
      { id: "t1", pair: "EUR/USD", side: "long", risk: 100 },
      { id: "t2", pair: "USD/JPY", side: "long", risk: 100 },
      { id: "t3", pair: "GBP/USD", side: "short", risk: 100 },
      { id: "t4", pair: "USD/CHF", side: "short", risk: 100 },
    ])
    // EUR/USD long: −USD; USD/JPY long: +USD; GBP/USD short: +USD; USD/CHF short: −USD
    // Net USD = -100+100+100-100 = 0
    expect(balanced.find((x) => x.currency === "USD")).toBeUndefined()
    // Sanity check that the contrived w above did flag something (USD).
    expect(w.find((x) => x.currency === "USD")).toBeDefined()
  })

  it("respects custom minMultiple", () => {
    const positions = [
      { id: "t1", pair: "EUR/USD", side: "long" as const, risk: 100 },
      { id: "t2", pair: "GBP/USD", side: "long" as const, risk: 100 },
      { id: "t3", pair: "AUD/USD", side: "long" as const, risk: 100 },
    ]
    // Net USD = -300, avg = 100 → multiple 3
    const lax = findCorrelationWarnings(positions, { minMultiple: 5 })
    expect(lax).toEqual([])
    const strict = findCorrelationWarnings(positions, { minMultiple: 1.5 })
    const usd = strict.find((x) => x.currency === "USD")!
    expect(usd.exposureMultiple).toBe(3)
  })
})

describe("formatExposurePct", () => {
  it("renders a percent with no decimals", () => {
    expect(formatExposurePct(2.4)).toBe("240%")
    expect(formatExposurePct(1)).toBe("100%")
    expect(formatExposurePct(0.55)).toBe("55%")
  })
})
