"use client"

import { useMemo, useState } from "react"
import { TradingCalendar } from "@/components/dashboard/trading-calendar"
import { AnalyticsView } from "./analytics-view"
import { AnalyticsFilterBar } from "./analytics-filter-bar"
import {
  EMPTY_ANALYTICS_FILTERS,
  analyticsFiltersActive,
  applyAnalyticsFilters,
  deriveAnalyticsFilterOptions,
  type AnalyticsFilters,
} from "@/lib/analytics-filters"
import type { Trade, JournalEntry } from "@/lib/queries/trades"
import type { TradeFill } from "@/lib/queries/trade-fills"

/**
 * Client shell for the Analytics page. Owns the categorical filter state, draws
 * the filter bar directly under the page header, and feeds the filtered trade
 * set into both the Trading Calendar and the analytics cards. The date range is
 * still URL-driven (RangeFilterBar inside the bar) — these filters apply on top
 * of the already-range-scoped data the server handed us.
 */
export function AnalyticsWorkspace({
  trades,
  last12moTrades,
  entriesByTrade,
  prevEntries,
  playbookMap,
  accountMap,
  fillsByTrade,
  simStartBalance,
}: {
  trades: Trade[]
  last12moTrades: Trade[]
  entriesByTrade: Map<string, JournalEntry>
  prevEntries?: JournalEntry[]
  playbookMap: Map<string, string>
  accountMap: Map<string, string>
  fillsByTrade: Map<string, TradeFill[]>
  simStartBalance: number
}) {
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_ANALYTICS_FILTERS)
  const maps = useMemo(() => ({ playbookMap, accountMap }), [playbookMap, accountMap])

  // Offer only values that exist in the range-scoped closed trades, so the
  // dropdowns never list a pair / account / session with nothing behind it.
  const options = useMemo(
    () => deriveAnalyticsFilterOptions(trades.filter((t) => t.status === "closed"), maps),
    [trades, maps],
  )

  const filtersActive = analyticsFiltersActive(filters)
  const filteredTrades = useMemo(
    () => applyAnalyticsFilters(trades, filters, maps),
    [trades, filters, maps],
  )
  const filtered12mo = useMemo(
    () => applyAnalyticsFilters(last12moTrades, filters, maps),
    [last12moTrades, filters, maps],
  )

  return (
    <>
      <AnalyticsFilterBar options={options} filters={filters} onChange={setFilters} />

      <TradingCalendar trades={filtered12mo} />

      <AnalyticsView
        trades={filteredTrades}
        last12moTrades={filtered12mo}
        entriesByTrade={entriesByTrade}
        prevEntries={prevEntries}
        playbookMap={playbookMap}
        accountMap={accountMap}
        fillsByTrade={fillsByTrade}
        simStartBalance={simStartBalance}
        filtersActive={filtersActive}
        onClearFilters={() => setFilters(EMPTY_ANALYTICS_FILTERS)}
      />
    </>
  )
}
