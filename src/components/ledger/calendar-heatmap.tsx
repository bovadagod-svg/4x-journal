"use client"

import { useMemo } from "react"
import type { Trade } from "@/lib/queries/trades"
import { formatUSD } from "@/lib/finance"

export function CalendarHeatmap({
  trades,
  selectedDate,
  onSelectDate,
  weeks = 12,
}: {
  trades: Trade[]
  selectedDate: string | null
  onSelectDate: (iso: string | null) => void
  weeks?: number
}) {
  const grid = useMemo(() => {
    // Today (UTC) → walk back N weeks from Monday-of-this-week.
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setUTCDate(start.getUTCDate() - weeks * 7 + 1)
    while (start.getUTCDay() !== 1) start.setUTCDate(start.getUTCDate() - 1)

    // Bucket closed trades by ISO date (YYYY-MM-DD)
    const byDay = new Map<string, { count: number; pnl: number }>()
    for (const t of trades) {
      if (t.status !== "closed" || !t.closed_at) continue
      const iso = t.closed_at.slice(0, 10)
      const acc = byDay.get(iso) ?? { count: 0, pnl: 0 }
      acc.count += 1
      acc.pnl += Number(t.pnl) || 0
      byDay.set(iso, acc)
    }

    const cells: Array<Array<{ iso: string; date: Date; count: number; pnl: number }>> = []
    for (let w = 0; w < weeks; w++) {
      const week: Array<{ iso: string; date: Date; count: number; pnl: number }> = []
      for (let d = 0; d < 5; d++) { // Mon–Fri only
        const date = new Date(start)
        date.setUTCDate(start.getUTCDate() + w * 7 + d)
        const iso = date.toISOString().slice(0, 10)
        const stats = byDay.get(iso) ?? { count: 0, pnl: 0 }
        week.push({ iso, date, count: stats.count, pnl: stats.pnl })
      }
      cells.push(week)
    }
    return cells
  }, [trades, weeks])

  const max = Math.max(...grid.flat().map((c) => Math.abs(c.pnl)), 1)
  const cellColor = (c: { count: number; pnl: number }) => {
    if (c.count === 0) return "var(--c-bg-elev-3)"
    const intensity = Math.min(1, Math.abs(c.pnl) / max)
    return c.pnl >= 0
      ? `rgba(17, 196, 88, ${0.15 + intensity * 0.65})`
      : `rgba(190, 51, 61, ${0.15 + intensity * 0.65})`
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
        <div>
          <h3 className="card-title">Trading Calendar</h3>
          <p className="card-subtitle">Last {weeks} weeks · click a day to filter</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "var(--c-fg-muted)" }}>
          <span>Loss</span>
          <div style={{ display: "flex", gap: 2 }}>
            {[0.2, 0.4, 0.6, 0.8].map((o) => (
              <span key={o} style={{ width: 10, height: 10, background: `rgba(190, 51, 61, ${o})`, borderRadius: 2 }} />
            ))}
            <span style={{ width: 10, height: 10, background: "var(--c-bg-elev-3)", borderRadius: 2 }} />
            {[0.2, 0.4, 0.6, 0.8].map((o) => (
              <span key={o} style={{ width: 10, height: 10, background: `rgba(17, 196, 88, ${o})`, borderRadius: 2 }} />
            ))}
          </div>
          <span>Profit</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 9.5, color: "var(--c-fg-dim)", paddingTop: 2 }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
            <span key={d} style={{ height: 22, display: "flex", alignItems: "center" }}>{d}</span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${weeks}, 1fr)`, gap: 3, flex: 1 }}>
          {grid.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {week.map((day) => {
                const active = selectedDate === day.iso
                return (
                  <button
                    key={day.iso}
                    onClick={() => onSelectDate(active ? null : day.iso)}
                    title={`${day.iso} · ${day.count} trade${day.count === 1 ? "" : "s"} · ${formatUSD(day.pnl, { signed: true })}`}
                    style={{
                      height: 22,
                      background: cellColor(day),
                      border: active ? "1.5px solid var(--c-fg)" : "1px solid var(--c-border)",
                      borderRadius: 3,
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      color: day.count > 0 ? "var(--c-fg)" : "transparent",
                      fontWeight: 600,
                    }}
                  >
                    {day.count > 0 ? day.date.getUTCDate() : ""}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
