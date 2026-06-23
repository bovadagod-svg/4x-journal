import { describe, it, expect } from "vitest"
import type { Trade } from "@/lib/queries/trades"
import {
  EMPTY_ANALYTICS_FILTERS,
  analyticsFiltersActive,
  countActiveDimensions,
  applyAnalyticsFilters,
  deriveAnalyticsFilterOptions,
  playbookLabel,
  accountLabel,
  tradeSessions,
  type AnalyticsFilters,
} from "./analytics-filters"

// A complete trade row; tests override only the fields they care about.
const BASE: Trade = {
  account_id: "acct-1",
  cancel_reason: null,
  cancelled_at: null,
  closed_at: "2026-01-16T14:00:00Z",
  contract_size: 100000,
  created_at: "2026-01-15T10:00:00Z",
  entry_price: 1.1,
  exit_price: 1.11,
  external_id: null,
  external_provider: null,
  id: "trade-1",
  lifecycle_events: [],
  mae_mfe_resolved_at: null,
  mae_price: null,
  mae_r: null,
  mfe_price: null,
  mfe_r: null,
  mood: null,
  notes: null,
  opened_at: "2026-01-15T14:00:00Z", // Thursday, London + New York
  pair: "EUR/USD",
  playbook_id: "pb-1",
  pnl: 200,
  r: 2,
  risk_amount: 100,
  side: "long",
  size: 1,
  status: "closed",
  stop_price: null,
  tags: [],
  target_price: null,
  team_id: null,
  updated_at: "2026-01-16T14:00:00Z",
  user_id: "user-1",
}

const T = (over: Partial<Trade> = {}): Trade => ({ ...BASE, ...over })

const playbookMap = new Map([
  ["pb-1", "Breakout"],
  ["pb-2", "Mean Reversion"],
])
const accountMap = new Map([
  ["acct-1", "OANDA · Main"],
  ["acct-2", "FTMO · Challenge"],
])
const maps = { playbookMap, accountMap }

const merge = (over: Partial<AnalyticsFilters>): AnalyticsFilters => ({ ...EMPTY_ANALYTICS_FILTERS, ...over })

describe("analyticsFiltersActive / countActiveDimensions", () => {
  it("empty filters are inactive", () => {
    expect(analyticsFiltersActive(EMPTY_ANALYTICS_FILTERS)).toBe(false)
    expect(countActiveDimensions(EMPTY_ANALYTICS_FILTERS)).toBe(0)
  })
  it("counts each constrained dimension once", () => {
    const f = merge({ pairs: ["EUR/USD"], sides: ["long"], results: ["win"] })
    expect(analyticsFiltersActive(f)).toBe(true)
    expect(countActiveDimensions(f)).toBe(3)
  })
})

describe("label resolution", () => {
  it("resolves playbook label, falling back to Untagged", () => {
    expect(playbookLabel(T({ playbook_id: "pb-2" }), playbookMap)).toBe("Mean Reversion")
    expect(playbookLabel(T({ playbook_id: null }), playbookMap)).toBe("Untagged")
    expect(playbookLabel(T({ playbook_id: "ghost" }), playbookMap)).toBe("Untagged")
  })
  it("resolves account label, falling back to Unknown", () => {
    expect(accountLabel(T({ account_id: "acct-2" }), accountMap)).toBe("FTMO · Challenge")
    expect(accountLabel(T({ account_id: "ghost" }), accountMap)).toBe("Unknown")
  })
})

describe("tradeSessions — derived from opened_at (UTC)", () => {
  it("tags the London/New York overlap", () => {
    expect(tradeSessions(T({ opened_at: "2026-01-15T14:00:00Z" }))).toEqual(["london", "newyork"])
  })
  it("tags the Asian block (Sydney + Tokyo)", () => {
    expect(tradeSessions(T({ opened_at: "2026-01-15T02:00:00Z" }))).toEqual(["sydney", "tokyo"])
  })
  it("tags New York alone late in the day", () => {
    expect(tradeSessions(T({ opened_at: "2026-01-15T20:00:00Z" }))).toEqual(["newyork"])
  })
  it("returns nothing without an open time or over the weekend gap", () => {
    expect(tradeSessions(T({ opened_at: null }))).toEqual([])
    expect(tradeSessions(T({ opened_at: "2026-01-17T12:00:00Z" }))).toEqual([]) // Saturday
  })
})

describe("applyAnalyticsFilters", () => {
  it("returns the input untouched when no filter is active", () => {
    const trades = [T(), T({ id: "t2" })]
    expect(applyAnalyticsFilters(trades, EMPTY_ANALYTICS_FILTERS, maps)).toBe(trades)
  })

  it("filters by pair", () => {
    const trades = [T({ pair: "EUR/USD" }), T({ pair: "USD/JPY" }), T({ pair: "GBP/USD" })]
    const out = applyAnalyticsFilters(trades, merge({ pairs: ["EUR/USD", "GBP/USD"] }), maps)
    expect(out.map((t) => t.pair)).toEqual(["EUR/USD", "GBP/USD"])
  })

  it("filters by side", () => {
    const trades = [T({ side: "long" }), T({ side: "short" })]
    const out = applyAnalyticsFilters(trades, merge({ sides: ["short"] }), maps)
    expect(out.map((t) => t.side)).toEqual(["short"])
  })

  it("filters by result using the ±$100 breakeven band", () => {
    const trades = [T({ pnl: 500 }), T({ pnl: -500 }), T({ pnl: 50 })]
    expect(applyAnalyticsFilters(trades, merge({ results: ["win"] }), maps).map((t) => t.pnl)).toEqual([500])
    expect(applyAnalyticsFilters(trades, merge({ results: ["loss"] }), maps).map((t) => t.pnl)).toEqual([-500])
    expect(applyAnalyticsFilters(trades, merge({ results: ["breakeven"] }), maps).map((t) => t.pnl)).toEqual([50])
    // open trade (null pnl) never matches a result constraint
    expect(applyAnalyticsFilters([T({ pnl: null })], merge({ results: ["win"] }), maps)).toEqual([])
  })

  it("filters by playbook label (incl. Untagged)", () => {
    const trades = [T({ playbook_id: "pb-1" }), T({ playbook_id: "pb-2" }), T({ playbook_id: null })]
    const out = applyAnalyticsFilters(trades, merge({ playbooks: ["Breakout", "Untagged"] }), maps)
    expect(out.map((t) => t.playbook_id)).toEqual(["pb-1", null])
  })

  it("filters by account label", () => {
    const trades = [T({ account_id: "acct-1" }), T({ account_id: "acct-2" })]
    const out = applyAnalyticsFilters(trades, merge({ accounts: ["FTMO · Challenge"] }), maps)
    expect(out.map((t) => t.account_id)).toEqual(["acct-2"])
  })

  it("filters by session — matches when ANY of the trade's sessions is selected", () => {
    const ldnNy = T({ id: "ldnny", opened_at: "2026-01-15T14:00:00Z" }) // london + newyork
    const asia = T({ id: "asia", opened_at: "2026-01-15T02:00:00Z" }) // sydney + tokyo
    const trades = [ldnNy, asia]
    expect(applyAnalyticsFilters(trades, merge({ sessions: ["london"] }), maps).map((t) => t.id)).toEqual(["ldnny"])
    expect(applyAnalyticsFilters(trades, merge({ sessions: ["tokyo"] }), maps).map((t) => t.id)).toEqual(["asia"])
    expect(applyAnalyticsFilters(trades, merge({ sessions: ["newyork", "sydney"] }), maps).map((t) => t.id)).toEqual([
      "ldnny",
      "asia",
    ])
  })

  it("combines dimensions with AND", () => {
    const trades = [
      T({ id: "keep", pair: "EUR/USD", side: "long", pnl: 300 }),
      T({ id: "wrong-side", pair: "EUR/USD", side: "short", pnl: 300 }),
      T({ id: "wrong-result", pair: "EUR/USD", side: "long", pnl: -300 }),
      T({ id: "wrong-pair", pair: "USD/JPY", side: "long", pnl: 300 }),
    ]
    const out = applyAnalyticsFilters(trades, merge({ pairs: ["EUR/USD"], sides: ["long"], results: ["win"] }), maps)
    expect(out.map((t) => t.id)).toEqual(["keep"])
  })
})

describe("deriveAnalyticsFilterOptions", () => {
  it("derives sorted, de-duplicated options from the trades in view", () => {
    const trades = [
      T({ pair: "USD/JPY", side: "long", pnl: 300, playbook_id: "pb-2", account_id: "acct-2", opened_at: "2026-01-15T14:00:00Z" }),
      T({ pair: "EUR/USD", side: "short", pnl: -300, playbook_id: null, account_id: "acct-1", opened_at: "2026-01-15T02:00:00Z" }),
      T({ pair: "EUR/USD", side: "long", pnl: 50, playbook_id: "pb-1", account_id: "ghost", opened_at: "2026-01-15T20:00:00Z" }),
    ]
    const opts = deriveAnalyticsFilterOptions(trades, maps)

    expect(opts.pairs).toEqual(["EUR/USD", "USD/JPY"])
    expect(opts.sides).toEqual(["long", "short"]) // canonical order, present only
    expect(opts.results).toEqual(["win", "loss", "breakeven"]) // canonical order, present only
    // real names alphabetical, catch-all buckets sorted last
    expect(opts.playbooks).toEqual(["Breakout", "Mean Reversion", "Untagged"])
    expect(opts.accounts).toEqual(["FTMO · Challenge", "OANDA · Main", "Unknown"])
    // FX clock order, present only
    expect(opts.sessions).toEqual(["sydney", "tokyo", "london", "newyork"])
  })

  it("omits dimensions/values with no data", () => {
    const trades = [T({ side: "long", pnl: 300, opened_at: "2026-01-15T20:00:00Z" })]
    const opts = deriveAnalyticsFilterOptions(trades, maps)
    expect(opts.sides).toEqual(["long"]) // no shorts present
    expect(opts.results).toEqual(["win"]) // only winners present
    expect(opts.sessions).toEqual(["newyork"]) // only NY present
  })
})
