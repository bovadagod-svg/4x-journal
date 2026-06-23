import { describe, it, expect } from "vitest"
import { classifyStopTargetMoves, type StopTargetEvent } from "./stop-modify"

/**
 * Fixtures mirror real TradeLocker `lifecycle_events` shapes (synced XAU/USD
 * trades): the SL/TP a trader sets surface as protective Stop / Limit *exit*
 * orders (isOpen=false) whose trigger `price` is the level, NOT as "Replaced"
 * events. The opening order (isOpen=true) carries the initial SL/TP on its
 * stopLoss/takeProfit fields. Market exits are the close, not a level.
 */

describe("classifyStopTargetMoves — counts", () => {
  it("long: trails SL up and widens TP (real trade aa97f1ba)", () => {
    const events: StopTargetEvent[] = [
      { occurredAt: "2026-04-06T02:17:51.000Z", status: "Filled", type: "Stop", isOpen: true, price: 4654.91, stopLoss: 4540.87, takeProfit: 4891.99 },
      { occurredAt: "2026-04-07T22:40:32.000Z", status: "Filled", type: "Market", isOpen: false, price: 4777.36, stopLoss: null, takeProfit: null },
      { occurredAt: "2026-04-08T09:44:45.000Z", status: "Cancelled", type: "Limit", isOpen: false, price: 4995.19, stopLoss: null, takeProfit: null },
      { occurredAt: "2026-04-08T09:44:45.000Z", status: "Filled", type: "Stop", isOpen: false, price: 4780, stopLoss: null, takeProfit: null },
    ]
    const { counts, finalSL, finalTP } = classifyStopTargetMoves(events, { side: "long", entryPrice: 4655.6 })
    expect(counts).toMatchObject({ slMoves: 1, slTrail: 1, slLoose: 0, slBe: 0, tpMoves: 1, tpWider: 1, tpTighter: 0 })
    expect(finalSL).toBe(4780)
    expect(finalTP).toBe(4995.19)
  })

  it("short: trails SL down; ignores sub-noise-floor TP drift (real trade f1df0395)", () => {
    const events: StopTargetEvent[] = [
      { occurredAt: "2026-06-22T15:45:30.000Z", status: "Filled", type: "Stop", isOpen: true, price: 4180, stopLoss: 4230, takeProfit: 4130 },
      { occurredAt: "2026-06-23T03:20:11.000Z", status: "Filled", type: "Market", isOpen: false, price: 4134.98, stopLoss: null, takeProfit: null },
      { occurredAt: "2026-06-23T03:20:11.000Z", status: "Cancelled", type: "Limit", isOpen: false, price: 4129.21, stopLoss: null, takeProfit: null }, // 4130 -> 4129.21 = noise
      { occurredAt: "2026-06-23T03:20:11.000Z", status: "Cancelled", type: "Stop", isOpen: false, price: 4152.96, stopLoss: null, takeProfit: null },
    ]
    const { counts, finalSL } = classifyStopTargetMoves(events, { side: "short", entryPrice: 4179.21 })
    expect(counts).toMatchObject({ slMoves: 1, slTrail: 1, tpMoves: 0 })
    expect(finalSL).toBe(4152.96)
  })

  it("long: loosening the stop away from price is flagged as loose", () => {
    const events: StopTargetEvent[] = [
      { occurredAt: "t0", type: "Stop", isOpen: true, stopLoss: 95, takeProfit: 110 },
      { occurredAt: "t1", type: "Stop", isOpen: false, price: 90 },
    ]
    const { counts } = classifyStopTargetMoves(events, { side: "long", entryPrice: 100 })
    expect(counts).toMatchObject({ slMoves: 1, slLoose: 1, slTrail: 0, slBe: 0 })
  })

  it("short: loosening the stop (up, away from price) is flagged as loose", () => {
    const events: StopTargetEvent[] = [
      { occurredAt: "t0", type: "Stop", isOpen: true, stopLoss: 105, takeProfit: 90 },
      { occurredAt: "t1", type: "Stop", isOpen: false, price: 112 },
    ]
    const { counts } = classifyStopTargetMoves(events, { side: "short", entryPrice: 100 })
    expect(counts).toMatchObject({ slMoves: 1, slLoose: 1 })
  })

  it("classifies a move to ~entry as break-even", () => {
    const events: StopTargetEvent[] = [
      { occurredAt: "t0", type: "Stop", isOpen: true, stopLoss: 95 },
      { occurredAt: "t1", type: "Stop", isOpen: false, price: 100.002 },
    ]
    const { counts } = classifyStopTargetMoves(events, { side: "long", entryPrice: 100 })
    expect(counts).toMatchObject({ slMoves: 1, slBe: 1, slTrail: 0, slLoose: 0 })
  })

  it("no initial SL: adding a protective stop is a baseline, not a counted move", () => {
    const events: StopTargetEvent[] = [
      { occurredAt: "t0", type: "Market", isOpen: true, price: 100 },
      { occurredAt: "t1", type: "Stop", isOpen: false, price: 95 },
    ]
    const { counts, finalSL } = classifyStopTargetMoves(events, { side: "long", entryPrice: 100 })
    expect(counts.slMoves).toBe(0)
    expect(finalSL).toBe(95)
  })

  it("never-modified trade: SL set at open and hit produces no move", () => {
    const events: StopTargetEvent[] = [
      { occurredAt: "t0", type: "Stop", isOpen: true, stopLoss: 95, takeProfit: 110 },
      { occurredAt: "t1", type: "Stop", isOpen: false, price: 95 },
    ]
    const { counts } = classifyStopTargetMoves(events, { side: "long", entryPrice: 100 })
    expect(counts).toMatchObject({ slMoves: 0, tpMoves: 0 })
  })

  it("tightens TP (long pulls target in)", () => {
    const events: StopTargetEvent[] = [
      { occurredAt: "t0", type: "Stop", isOpen: true, stopLoss: 95, takeProfit: 120 },
      { occurredAt: "t1", type: "Limit", isOpen: false, price: 110 },
    ]
    const { counts } = classifyStopTargetMoves(events, { side: "long", entryPrice: 100 })
    expect(counts).toMatchObject({ tpMoves: 1, tpTighter: 1, tpWider: 0 })
  })
})

describe("classifyStopTargetMoves — per-event annotations (drawer timeline)", () => {
  it("attaches the movement label, signed delta, and running level to the protective order", () => {
    const events: StopTargetEvent[] = [
      { occurredAt: "2026-04-06T02:17:51.000Z", type: "Stop", isOpen: true, stopLoss: 4540.87, takeProfit: 4891.99 },
      { occurredAt: "2026-04-08T09:44:45.000Z", type: "Limit", isOpen: false, price: 4995.19 }, // TP widened
      { occurredAt: "2026-04-08T09:44:46.000Z", type: "Stop", isOpen: false, price: 4780 }, // SL trailed
    ]
    const { annotated } = classifyStopTargetMoves(events, { side: "long", entryPrice: 4655.6 })

    // chronological order preserved
    expect(annotated).toHaveLength(3)

    // opener: baseline, no movement, levels seeded from its SL/TP
    expect(annotated[0].slClass).toBeUndefined()
    expect(annotated[0].tpClass).toBeUndefined()
    expect(annotated[0].slLevel).toBe(4540.87)
    expect(annotated[0].tpLevel).toBe(4891.99)

    // TP limit: widened, running TP level updated, SL level carried forward
    expect(annotated[1].tpClass).toBe("wider")
    expect(annotated[1].tpDelta).toBeCloseTo(4995.19 - 4891.99, 5)
    expect(annotated[1].tpLevel).toBe(4995.19)
    expect(annotated[1].slLevel).toBe(4540.87)

    // SL stop: trailed, running SL level updated
    expect(annotated[2].slClass).toBe("trail")
    expect(annotated[2].slDelta).toBeCloseTo(4780 - 4540.87, 5)
    expect(annotated[2].slLevel).toBe(4780)
    expect(annotated[2].tpLevel).toBe(4995.19)
  })

  it("never labels an unchanged protective order", () => {
    const events: StopTargetEvent[] = [
      { occurredAt: "t0", type: "Stop", isOpen: true, stopLoss: 95 },
      { occurredAt: "t1", type: "Stop", isOpen: false, price: 95 },
    ]
    const { annotated } = classifyStopTargetMoves(events, { side: "long", entryPrice: 100 })
    expect(annotated[1].slClass).toBeUndefined()
    expect(annotated[1].slDelta).toBeUndefined()
  })
})
