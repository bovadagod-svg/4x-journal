"use client"

import { useMemo, useState } from "react"
import { LedgerStatsStrip } from "./ledger-stats-strip"
import { CalendarHeatmap } from "./calendar-heatmap"
import { LedgerFiltersBar, EMPTY_FILTERS, type LedgerFilters } from "./ledger-filters"
import { TradeTable } from "./trade-table"
import type { Trade, JournalEntry } from "@/lib/queries/trades"

export function LedgerView({
  trades,
  entriesByTrade,
  playbookMap,
  traderMap = {},
  accountOwnerMap = {},
  initialDate = null,
}: {
  trades: Trade[]
  entriesByTrade: Map<string, JournalEntry>
  playbookMap: Map<string, string>
  traderMap?: Record<string, string>
  accountOwnerMap?: Record<string, string>
  /** Seed the day filter (e.g. arriving from a calendar cell via ?date=). */
  initialDate?: string | null
}) {
  const [filters, setFilters] = useState<LedgerFilters>(
    initialDate ? { ...EMPTY_FILTERS, date: initialDate } : EMPTY_FILTERS,
  )

  const allPairs = useMemo(() => Array.from(new Set(trades.map((t) => t.pair))).sort(), [trades])
  const allSetups = useMemo(() => Array.from(new Set(Array.from(playbookMap.values()))).sort(), [playbookMap])

  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const setup = t.playbook_id ? (playbookMap.get(t.playbook_id) ?? "") : ""
        const tags = (t.tags ?? []).join(" ")
        const note = t.notes ?? ""
        if (
          !note.toLowerCase().includes(q) &&
          !t.pair.toLowerCase().includes(q) &&
          !setup.toLowerCase().includes(q) &&
          !tags.toLowerCase().includes(q)
        ) return false
      }
      if (filters.pair !== "All" && t.pair !== filters.pair) return false
      if (filters.setup !== "All") {
        const setup = t.playbook_id ? (playbookMap.get(t.playbook_id) ?? "") : ""
        if (setup !== filters.setup) return false
      }
      if (filters.side !== "All" && t.side !== filters.side.toLowerCase()) return false
      if (filters.result !== "All") {
        // Win/Loss/Breakeven only apply to closed trades.
        if (t.status !== "closed") return false
        const pnl = Number(t.pnl) || 0
        const result = pnl > 0 ? "Win" : pnl < 0 ? "Loss" : "Breakeven"
        if (result !== filters.result) return false
      }
      if (filters.date) {
        // Match by entry day so it lines up with the Trading Calendar (which
        // buckets P&L by the day a trade opened).
        const ref = t.opened_at ?? t.closed_at ?? t.created_at
        if (!ref || ref.slice(0, 10) !== filters.date) return false
      }
      return true
    })
  }, [trades, filters, playbookMap])

  const onExportCsv = () => {
    const params = new URLSearchParams()
    if (filters.date) {
      params.set("from", filters.date)
      params.set("to", filters.date)
    }
    if (filters.result !== "All") {
      // Win/Loss/Breakeven all imply status=closed at the CSV layer.
      params.set("status", "closed")
    }
    window.location.href = `/api/reports/trades?${params.toString()}`
  }

  return (
    <>
      <LedgerStatsStrip trades={filtered} entriesByTrade={entriesByTrade} />

      <CalendarHeatmap
        trades={trades}
        selectedDate={filters.date}
        onSelectDate={(d) => setFilters({ ...filters, date: d })}
      />

      <LedgerFiltersBar
        filters={filters}
        setFilters={setFilters}
        pairs={allPairs}
        setups={allSetups}
        onExportCsv={onExportCsv}
      />

      <TradeTable
        trades={filtered}
        entriesByTrade={entriesByTrade}
        playbookMap={playbookMap}
        totalCount={trades.length}
        traderMap={traderMap}
        accountOwnerMap={accountOwnerMap}
      />
    </>
  )
}
