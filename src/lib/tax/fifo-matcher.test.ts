import { describe, expect, it } from "vitest"
import { matchLots, form8949CsvHeaders, form8949CsvRow } from "./fifo-matcher"

const T = (over: Partial<Parameters<typeof matchLots>[0][number]> = {}) => ({
  id: "trade-1",
  pair: "EUR/USD",
  side: "long" as const,
  size: 100000,
  entry_price: 1.08,
  exit_price: 1.082,
  opened_at: "2026-01-15T10:00:00Z",
  closed_at: "2026-01-16T14:00:00Z",
  pnl: 200,
  ...over,
})

describe("matchLots", () => {
  it("skips trades that aren't fully closed", () => {
    const r = matchLots([
      T({ id: "open-1", exit_price: null, closed_at: null, pnl: null }),
      T({ id: "closed-1" }),
    ])
    expect(r.rows.length).toBe(1)
    expect(r.rows[0].tradeId).toBe("closed-1")
  })

  it("classifies short-term (< 1 year) and long-term (≥ 1 year) correctly", () => {
    const r = matchLots([
      T({ id: "st", opened_at: "2026-01-01T00:00:00Z", closed_at: "2026-06-01T00:00:00Z" }),
      T({ id: "lt", opened_at: "2024-01-01T00:00:00Z", closed_at: "2025-06-01T00:00:00Z" }),
    ])
    expect(r.rows.find((x) => x.tradeId === "st")!.holdingPeriod).toBe("short_term")
    expect(r.rows.find((x) => x.tradeId === "st")!.box).toBe("C")
    expect(r.rows.find((x) => x.tradeId === "lt")!.holdingPeriod).toBe("long_term")
    expect(r.rows.find((x) => x.tradeId === "lt")!.box).toBe("F")
  })

  it("subtracts commission and swap from gross P&L", () => {
    const r = matchLots([
      T({ id: "fees", pnl: 200, commission_total: -8, swap_total: -3 }),
    ])
    // gross 200, commission |8|, swap |3| → net 189.
    expect(r.rows[0].gainLoss).toBe(189)
  })

  it("flags wash sale when a same-pair, same-side trade opens within 30 days of a losing close", () => {
    const r = matchLots([
      T({
        id: "loser",
        pair: "EUR/USD", side: "long",
        opened_at: "2026-02-01T00:00:00Z",
        closed_at: "2026-03-01T00:00:00Z",
        pnl: -150,
      }),
      T({
        id: "replacement",
        pair: "EUR/USD", side: "long",
        opened_at: "2026-03-10T00:00:00Z",  // 9 days after the loser's close
        closed_at: "2026-03-15T00:00:00Z",
        pnl: 50,
      }),
    ])
    const loser = r.rows.find((x) => x.tradeId === "loser")!
    expect(loser.code).toBe("W")
    expect(loser.adjustment).toBe(150)  // disallowed loss
    expect(loser.gainLoss).toBe(0)       // disallowed → 0
    const replacement = r.rows.find((x) => x.tradeId === "replacement")!
    expect(replacement.code).toBe("")    // winner doesn't get flagged
  })

  it("does not flag wash sale on a different side", () => {
    const r = matchLots([
      T({ id: "loser", side: "long", pnl: -100, opened_at: "2026-02-01T00:00:00Z", closed_at: "2026-03-01T00:00:00Z" }),
      T({ id: "rep",   side: "short", pnl: 50,  opened_at: "2026-03-10T00:00:00Z", closed_at: "2026-03-15T00:00:00Z" }),
    ])
    expect(r.rows.find((x) => x.tradeId === "loser")!.code).toBe("")
  })

  it("does not flag wash sale outside the 30-day window", () => {
    const r = matchLots([
      T({ id: "loser", pnl: -100, opened_at: "2026-02-01T00:00:00Z", closed_at: "2026-03-01T00:00:00Z" }),
      T({ id: "rep",   pnl: 50,  opened_at: "2026-04-15T00:00:00Z", closed_at: "2026-04-20T00:00:00Z" }),
    ])
    expect(r.rows.find((x) => x.tradeId === "loser")!.code).toBe("")
  })

  it("can disable wash-sale flagging entirely (forex Section 988 mode)", () => {
    const r = matchLots(
      [
        T({ id: "loser", pnl: -100, opened_at: "2026-02-01T00:00:00Z", closed_at: "2026-03-01T00:00:00Z" }),
        T({ id: "rep",   pnl: 50,  opened_at: "2026-03-10T00:00:00Z", closed_at: "2026-03-15T00:00:00Z" }),
      ],
      { applyWashSale: false },
    )
    expect(r.rows.find((x) => x.tradeId === "loser")!.code).toBe("")
    expect(r.rows.find((x) => x.tradeId === "loser")!.gainLoss).toBe(-100)
  })

  it("rows are sorted chronologically by date sold", () => {
    const r = matchLots([
      T({ id: "later",   opened_at: "2026-03-01T00:00:00Z", closed_at: "2026-03-10T00:00:00Z" }),
      T({ id: "earlier", opened_at: "2026-01-01T00:00:00Z", closed_at: "2026-01-05T00:00:00Z" }),
      T({ id: "middle",  opened_at: "2026-02-01T00:00:00Z", closed_at: "2026-02-10T00:00:00Z" }),
    ])
    expect(r.rows.map((x) => x.tradeId)).toEqual(["earlier", "middle", "later"])
  })

  it("totals reconcile: short-term gain = sum of per-row gains in short-term box", () => {
    const r = matchLots([
      T({ id: "a", pnl: 200, opened_at: "2026-01-01T00:00:00Z", closed_at: "2026-01-05T00:00:00Z" }),
      T({ id: "b", pnl: -50, opened_at: "2026-02-01T00:00:00Z", closed_at: "2026-02-05T00:00:00Z", side: "short" }),
      T({ id: "c", pnl: 75,  opened_at: "2026-03-01T00:00:00Z", closed_at: "2026-03-05T00:00:00Z", pair: "GBP/USD" }),
    ])
    expect(r.totals.shortTermGain).toBe(225)  // 200 - 50 + 75
    expect(r.totals.longTermGain).toBe(0)
    expect(r.totals.washSaleAdjustment).toBe(0)
  })

  it("formats IRS dates as MM/DD/YYYY", () => {
    const r = matchLots([T({ opened_at: "2026-01-15T00:00:00Z", closed_at: "2026-02-03T00:00:00Z" })])
    expect(r.rows[0].dateAcquired).toBe("01/15/2026")
    expect(r.rows[0].dateSold).toBe("02/03/2026")
  })
})

describe("form8949CsvHeaders + form8949CsvRow", () => {
  it("emit 11 columns aligned with the IRS line spec", () => {
    expect(form8949CsvHeaders().length).toBe(11)
    const r = matchLots([T()])
    const row = form8949CsvRow(r.rows[0])
    expect(row.length).toBe(11)
    // Box, description, dates, numbers as 2dp strings, code, holdingPeriod, tradeId
    expect(row[0]).toBe("C")
    expect(typeof row[1]).toBe("string")
    expect(row[4]).toMatch(/^\d+\.\d{2}$/)  // proceeds is "108200.00" etc.
    expect(row[5]).toMatch(/^\d+\.\d{2}$/)  // basis
  })
})
