import { describe, it, expect } from "vitest"
import { classifyTrade, type LifecycleEvent } from "./stop-modify-behavior"

/**
 * These fixtures mirror real TradeLocker `lifecycle_events` shapes (taken from
 * synced XAU/USD trades): the SL/TP a trader sets surface as protective Stop /
 * Limit *exit* orders (isOpen=false) whose trigger `price` is the level, NOT as
 * "Replaced" events. The opening order (isOpen=true) carries the initial SL/TP
 * on its stopLoss/takeProfit fields. Market exits are the close, not a level.
 */

describe("classifyTrade — SL/TP modification recovery from protective orders", () => {
  it("long: trails SL up and widens TP (real trade aa97f1ba)", () => {
    const events: LifecycleEvent[] = [
      { occurredAt: "2026-04-06T02:17:51.000Z", status: "Filled", type: "Stop", isOpen: true, price: 4654.91, stopLoss: 4540.87, takeProfit: 4891.99 },
      { occurredAt: "2026-04-07T22:40:32.000Z", status: "Filled", type: "Market", isOpen: false, price: 4777.36, stopLoss: null, takeProfit: null }, // close — ignored
      { occurredAt: "2026-04-08T09:44:45.000Z", status: "Cancelled", type: "Limit", isOpen: false, price: 4995.19, stopLoss: null, takeProfit: null }, // TP order
      { occurredAt: "2026-04-08T09:44:45.000Z", status: "Filled", type: "Stop", isOpen: false, price: 4780, stopLoss: null, takeProfit: null }, // SL order
    ]
    const r = classifyTrade(events, { side: "long", entryPrice: 4655.6 })
    expect(r).toMatchObject({ slMoves: 1, slTrail: 1, slLoose: 0, slBe: 0, tpMoves: 1, tpWider: 1, tpTighter: 0 })
  })

  it("short: trails SL down; ignores sub-noise-floor TP drift (real trade f1df0395)", () => {
    const events: LifecycleEvent[] = [
      { occurredAt: "2026-06-22T15:45:30.000Z", status: "Filled", type: "Stop", isOpen: true, price: 4180, stopLoss: 4230, takeProfit: 4130 },
      { occurredAt: "2026-06-23T03:20:11.000Z", status: "Filled", type: "Market", isOpen: false, price: 4134.98, stopLoss: null, takeProfit: null }, // close
      { occurredAt: "2026-06-23T03:20:11.000Z", status: "Cancelled", type: "Limit", isOpen: false, price: 4129.21, stopLoss: null, takeProfit: null }, // TP order: 4130 -> 4129.21 = noise
      { occurredAt: "2026-06-23T03:20:11.000Z", status: "Cancelled", type: "Stop", isOpen: false, price: 4152.96, stopLoss: null, takeProfit: null }, // SL order: 4230 -> 4152.96
    ]
    const r = classifyTrade(events, { side: "short", entryPrice: 4179.21 })
    expect(r).toMatchObject({ slMoves: 1, slTrail: 1, tpMoves: 0 })
  })

  it("long: loosening the stop away from price is flagged as loose", () => {
    const events: LifecycleEvent[] = [
      { occurredAt: "t0", type: "Stop", isOpen: true, stopLoss: 95, takeProfit: 110 },
      { occurredAt: "t1", type: "Stop", isOpen: false, price: 90 }, // moved further from a long's price = loosen
    ]
    const r = classifyTrade(events, { side: "long", entryPrice: 100 })
    expect(r).toMatchObject({ slMoves: 1, slLoose: 1, slTrail: 0, slBe: 0 })
  })

  it("short: loosening the stop (up, away from price) is flagged as loose", () => {
    const events: LifecycleEvent[] = [
      { occurredAt: "t0", type: "Stop", isOpen: true, stopLoss: 105, takeProfit: 90 },
      { occurredAt: "t1", type: "Stop", isOpen: false, price: 112 }, // up = away from a short's profit = loosen
    ]
    const r = classifyTrade(events, { side: "short", entryPrice: 100 })
    expect(r).toMatchObject({ slMoves: 1, slLoose: 1 })
  })

  it("classifies a move to ~entry as break-even", () => {
    const events: LifecycleEvent[] = [
      { occurredAt: "t0", type: "Stop", isOpen: true, stopLoss: 95 },
      { occurredAt: "t1", type: "Stop", isOpen: false, price: 100.002 }, // within 1bp of entry 100
    ]
    const r = classifyTrade(events, { side: "long", entryPrice: 100 })
    expect(r).toMatchObject({ slMoves: 1, slBe: 1, slTrail: 0, slLoose: 0 })
  })

  it("no initial SL: adding a protective stop is a baseline, not a counted move", () => {
    const events: LifecycleEvent[] = [
      { occurredAt: "t0", type: "Market", isOpen: true, price: 100 }, // opener with no SL/TP
      { occurredAt: "t1", type: "Stop", isOpen: false, price: 95 },
    ]
    const r = classifyTrade(events, { side: "long", entryPrice: 100 })
    expect(r).toMatchObject({ slMoves: 0 })
  })

  it("never-modified trade: SL set at open and hit produces no move", () => {
    const events: LifecycleEvent[] = [
      { occurredAt: "t0", type: "Stop", isOpen: true, stopLoss: 95, takeProfit: 110 },
      { occurredAt: "t1", type: "Stop", isOpen: false, price: 95 }, // stop hit at its original level
    ]
    const r = classifyTrade(events, { side: "long", entryPrice: 100 })
    expect(r).toMatchObject({ slMoves: 0, tpMoves: 0 })
  })

  it("tightens TP (long pulls target in)", () => {
    const events: LifecycleEvent[] = [
      { occurredAt: "t0", type: "Stop", isOpen: true, stopLoss: 95, takeProfit: 120 },
      { occurredAt: "t1", type: "Limit", isOpen: false, price: 110 }, // 120 -> 110 = tighter for a long
    ]
    const r = classifyTrade(events, { side: "long", entryPrice: 100 })
    expect(r).toMatchObject({ tpMoves: 1, tpTighter: 1, tpWider: 0 })
  })
})
