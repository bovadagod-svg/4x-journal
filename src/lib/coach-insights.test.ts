import { describe, expect, it } from "vitest"
import { deterministicInsights, type DetTrade } from "./coach-insights"

const T = (over: Partial<DetTrade> = {}): DetTrade => ({
  pair: "EUR/USD",
  side: "long",
  r: 1,
  pnl: 100,
  opened_at: "2026-01-15T10:00:00Z",
  closed_at: "2026-01-16T14:00:00Z",
  ...over,
})

describe("deterministicInsights", () => {
  it("under-sample case returns the friendly message and zero suggestions", () => {
    const r = deterministicInsights({ trades: [T(), T(), T()] })
    expect(r.observations.length).toBe(1)
    expect(r.observations[0]).toMatch(/Only 3 closed trade/)
    expect(r.suggestions).toEqual([])
  })

  it("always emits a headline observation when sample is sufficient", () => {
    const trades: DetTrade[] = Array.from({ length: 10 }, (_, i) => T({ pnl: i % 2 === 0 ? 100 : -50, r: i % 2 === 0 ? 1 : -0.5 }))
    const r = deterministicInsights({ trades })
    expect(r.observations[0]).toMatch(/closed trades/)
    expect(r.observations[0]).toMatch(/win rate/)
  })

  it("flags worst pair when it has ≥3 trades and is losing money", () => {
    const trades: DetTrade[] = [
      T({ pair: "EUR/USD", pnl: 200, r: 2 }),
      T({ pair: "EUR/USD", pnl: 200, r: 2 }),
      T({ pair: "EUR/USD", pnl: 200, r: 2 }),
      T({ pair: "EUR/USD", pnl: 200, r: 2 }),
      T({ pair: "USD/JPY", pnl: -150, r: -1, side: "long" }),
      T({ pair: "USD/JPY", pnl: -150, r: -1, side: "long" }),
      T({ pair: "USD/JPY", pnl: -100, r: -1, side: "long" }),
      T({ pair: "USD/JPY", pnl: -50, r: -0.5, side: "long" }),
    ]
    const r = deterministicInsights({ trades })
    const worstObs = r.observations.find((o) => o.includes("USD/JPY") && o.includes("leak"))
    expect(worstObs).toBeDefined()
    // WR=0% on USD/JPY → suggestion fires
    const sug = r.suggestions.find((s) => s.action.includes("USD/JPY"))
    expect(sug).toBeDefined()
    expect(sug!.severity).toBe("warn")
  })

  it("does not flag a losing pair as the leak when it's also the best pair", () => {
    // Single pair, all losers. Best pair = worst pair = same pair.
    const trades: DetTrade[] = Array.from({ length: 6 }, () => T({ pnl: -50, r: -0.5 }))
    const r = deterministicInsights({ trades })
    const leaks = r.observations.filter((o) => o.includes("leak"))
    expect(leaks.length).toBe(0)
  })

  it("surfaces a side bias when there's ≥15pp WR delta and ≥5 trades on each side", () => {
    const trades: DetTrade[] = [
      ...Array.from({ length: 6 }, () => T({ side: "long",  pnl: 250, r: 1 })),
      ...Array.from({ length: 6 }, () => T({ side: "short", pnl: -250, r: -0.5 })),
    ]
    const r = deterministicInsights({ trades })
    const bias = r.observations.find((o) => /Long bias|Shorts are working/.test(o))
    expect(bias).toBeDefined()
  })

  it("does not surface a side bias when it's symmetric", () => {
    const trades: DetTrade[] = [
      ...Array.from({ length: 6 }, () => T({ side: "long",  pnl: 100, r: 1 })),
      ...Array.from({ length: 6 }, () => T({ side: "short", pnl: 100, r: 1 })),
    ]
    const r = deterministicInsights({ trades })
    const bias = r.observations.find((o) => /Long bias|Shorts are working/.test(o))
    expect(bias).toBeUndefined()
  })

  it("flags the worst day-of-week when it's both losing and ≥3 trades", () => {
    // Mondays = bad, Tuesdays = good
    const monday = "2026-02-02T10:00:00Z"   // a Monday
    const tuesday = "2026-02-03T10:00:00Z"  // a Tuesday
    const trades: DetTrade[] = [
      ...Array.from({ length: 4 }, () => T({ opened_at: monday, pnl: -100, r: -1 })),
      ...Array.from({ length: 6 }, () => T({ opened_at: tuesday, pnl: 100, r: 1 })),
    ]
    const r = deterministicInsights({ trades })
    const dow = r.observations.find((o) => o.startsWith("Mondays"))
    expect(dow).toBeDefined()
    // 0% WR → suggestion fires
    const sug = r.suggestions.find((s) => /Monday/i.test(s.action))
    expect(sug).toBeDefined()
  })

  it("flags streak drift when last 10 are materially below all-time WR", () => {
    // First 20 are wins; last 10 are losses → drift = 33% - 67% = -33pp
    const earlyWins: DetTrade[] = Array.from({ length: 20 }, (_, i) => T({
      pnl: 250, r: 1,
      opened_at: `2026-02-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      closed_at: `2026-02-${String(i + 1).padStart(2, "0")}T11:00:00Z`,
    }))
    const recentLosses: DetTrade[] = Array.from({ length: 10 }, (_, i) => T({
      pnl: -250, r: -0.5,
      opened_at: `2026-03-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      closed_at: `2026-03-${String(i + 1).padStart(2, "0")}T11:00:00Z`,
    }))
    const r = deterministicInsights({ trades: [...earlyWins, ...recentLosses] })
    const drift = r.observations.find((o) => o.includes("Recent drift"))
    expect(drift).toBeDefined()
    const sug = r.suggestions.find((s) => /Cut size/.test(s.action))
    expect(sug).toBeDefined()
  })

  it("includes rule-break impact when entries provided", () => {
    const entries = [
      { trade_id: "t1", rule_break: true },
      { trade_id: "t2", rule_break: true },
      { trade_id: "t3", rule_break: true },
      { trade_id: "t4", rule_break: false },
      { trade_id: "t5", rule_break: false },
      { trade_id: "t6", rule_break: false },
    ]
    const trades: DetTrade[] = entries.map((e, i) => T({
      pnl: e.rule_break ? -200 : 200,
      r: e.rule_break ? -2 : 2,
    }))
    const idMap = new Map(trades.map((t, i) => [t, entries[i].trade_id]))
    const r = deterministicInsights({
      trades,
      entries,
      tradeIdByTrade: (t) => idMap.get(t) ?? null,
    })
    const rbObs = r.observations.find((o) => o.startsWith("Rule-break trades"))
    expect(rbObs).toBeDefined()
    const sug = r.suggestions.find((s) => /Cool-down/.test(s.action))
    expect(sug).toBeDefined()
  })

  it("caps observations at 4 and suggestions at 3", () => {
    const trades: DetTrade[] = Array.from({ length: 30 }, (_, i) => T({
      pair: i % 3 === 0 ? "EUR/USD" : i % 3 === 1 ? "USD/JPY" : "GBP/USD",
      side: i % 2 === 0 ? "long" : "short",
      pnl: i % 2 === 0 ? 100 : -100,
      r: i % 2 === 0 ? 1 : -1,
      opened_at: `2026-02-${String(((i % 28) + 1)).padStart(2, "0")}T10:00:00Z`,
      closed_at: `2026-02-${String(((i % 28) + 1)).padStart(2, "0")}T11:00:00Z`,
    }))
    const r = deterministicInsights({ trades })
    expect(r.observations.length).toBeLessThanOrEqual(4)
    expect(r.suggestions.length).toBeLessThanOrEqual(3)
  })
})
