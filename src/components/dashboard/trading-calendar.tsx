"use client"

import { useRouter } from "next/navigation"
import { CalendarHeatmap } from "@/components/ledger/calendar-heatmap"
import type { Trade } from "@/lib/queries/trades"

/**
 * Dashboard / Analytics copy of the ledger's Trading Calendar. Same visual; on
 * these pages there's no in-page table to filter, so clicking a day jumps to
 * the ledger filtered to that day's entries.
 */
export function TradingCalendar({ trades }: { trades: Trade[] }) {
  const router = useRouter()
  return (
    <CalendarHeatmap
      trades={trades}
      selectedDate={null}
      onSelectDate={(iso) => { if (iso) router.push(`/ledger?date=${iso}`) }}
    />
  )
}
