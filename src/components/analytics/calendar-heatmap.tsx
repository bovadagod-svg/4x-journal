"use client"

import { useMemo } from "react"
import { formatUSD } from "@/lib/finance"
import type { Trade } from "@/lib/queries/trades"

/**
 * GitHub-style calendar heatmap of daily P&L. ~52 columns × 7 rows showing
 * the last 365 days. Each cell is colored by the day's net P&L: green for
 * profit, red for loss, neutral for no-trade days. Intensity scales with
 * magnitude (5 buckets per side).
 *
 * Hover any cell to see the date + trade count + P&L. Compact, dense, and
 * built entirely from trades — no extra queries needed.
 */
export function CalendarHeatmap({ trades }: { trades: Trade[] }) {
  const data = useMemo(() => compute(trades), [trades])
  if (data.totals.activeDays === 0) return null

  const cellSize = 12
  const gap = 2
  const weeks = data.weeks

  // Bucket P&L into 5 intensities (signed). Use absolute pnl-day percentile so
  // a single huge day doesn't wash out the rest.
  const sortedAbs = data.allDays
    .filter((d) => d.pnl !== 0)
    .map((d) => Math.abs(d.pnl))
    .sort((a, b) => a - b)
  const p25 = sortedAbs[Math.floor(sortedAbs.length * 0.25)] ?? 1
  const p50 = sortedAbs[Math.floor(sortedAbs.length * 0.50)] ?? p25
  const p75 = sortedAbs[Math.floor(sortedAbs.length * 0.75)] ?? p50
  const p90 = sortedAbs[Math.floor(sortedAbs.length * 0.90)] ?? p75

  function cellColor(pnl: number, count: number): string {
    if (count === 0) return "var(--c-bg-elev-3)"
    if (pnl === 0) return "rgba(154, 151, 161, 0.4)"
    const m = Math.abs(pnl)
    const intensity = m < p25 ? 0.25 : m < p50 ? 0.4 : m < p75 ? 0.6 : m < p90 ? 0.8 : 1.0
    return pnl > 0
      ? `rgba(17, 196, 88, ${intensity})`
      : `rgba(190, 51, 61, ${intensity})`
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 className="card-title">Daily P&L · last 12 months</h3>
          <p className="card-subtitle">{data.totals.activeDays} trading days · {data.totals.profitableDays} green · {data.totals.losingDays} red</p>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--c-fg-muted)" }}>
          <Headline label="Best day" value={data.totals.bestDay ? formatUSD(data.totals.bestDay.pnl, { signed: true }) : "—"} sub={data.totals.bestDay?.label ?? ""} color="var(--c-green-bright)" />
          <Headline label="Worst day" value={data.totals.worstDay ? formatUSD(data.totals.worstDay.pnl, { signed: true }) : "—"} sub={data.totals.worstDay?.label ?? ""} color="var(--c-red-bright)" />
          <Headline label="Day-WR" value={data.totals.activeDays > 0 ? `${Math.round((data.totals.profitableDays / data.totals.activeDays) * 100)}%` : "—"} sub="profitable days" />
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: weeks.length * (cellSize + gap) + 30 }}>
          {/* Month labels strip */}
          <div style={{ display: "grid", gridTemplateColumns: `30px repeat(${weeks.length}, ${cellSize + gap}px)`, marginBottom: 4, fontSize: 9.5, color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)" }}>
            <span></span>
            {data.monthLabels.map((m, i) => (
              <span key={i} style={{ gridColumn: `${m.weekIdx + 2}`, gridRow: 1 }}>{m.label}</span>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: `30px repeat(${weeks.length}, ${cellSize + gap}px)`, alignItems: "center", gap }}>
            {/* Day-of-week labels */}
            <div style={{ display: "flex", flexDirection: "column", gap, fontSize: 9.5, color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)" }}>
              {["", "M", "", "W", "", "F", ""].map((d, i) => (
                <span key={i} style={{ height: cellSize, lineHeight: `${cellSize}px` }}>{d}</span>
              ))}
            </div>
            {/* Week columns */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap }}>
                {Array.from({ length: 7 }).map((_, dow) => {
                  const day = week[dow]
                  if (!day) return <div key={dow} style={{ width: cellSize, height: cellSize }} />
                  return (
                    <div
                      key={dow}
                      title={day.count === 0 ? `${day.label} · no trades` : `${day.label} · ${day.count} trade${day.count === 1 ? "" : "s"} · ${formatUSD(day.pnl, { signed: true })}`}
                      style={{
                        width: cellSize, height: cellSize, borderRadius: 2,
                        background: cellColor(day.pnl, day.count),
                        cursor: day.count > 0 ? "pointer" : "default",
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 10, fontSize: 10, color: "var(--c-fg-dim)" }}>
            <span>Less</span>
            {[0.25, 0.4, 0.6, 0.8, 1.0].map((i) => (
              <div key={`r-${i}`} style={{ width: cellSize, height: cellSize, borderRadius: 2, background: `rgba(190, 51, 61, ${i})` }} />
            ))}
            <div style={{ width: cellSize, height: cellSize, borderRadius: 2, background: "var(--c-bg-elev-3)" }} />
            {[0.25, 0.4, 0.6, 0.8, 1.0].map((i) => (
              <div key={`g-${i}`} style={{ width: cellSize, height: cellSize, borderRadius: 2, background: `rgba(17, 196, 88, ${i})` }} />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Headline({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "6px 10px", lineHeight: 1.2, textAlign: "right" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: color ?? "var(--c-fg)" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)" }}>{sub}</div>}
    </div>
  )
}

function compute(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed" && t.closed_at)
  const dayMs = 86_400_000

  // Aggregate P&L per day (UTC)
  const byDay = new Map<string, { count: number; pnl: number; date: Date }>()
  for (const t of closed) {
    const d = new Date(t.closed_at!)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
    const slot = byDay.get(key) ?? { count: 0, pnl: 0, date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) }
    slot.count += 1
    slot.pnl += Number(t.pnl) || 0
    byDay.set(key, slot)
  }

  // Build last-365-day grid, ending today and starting on Sunday for clean columns
  const today = new Date()
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const end = todayUTC
  const start = new Date(end.getTime() - 364 * dayMs)
  // Snap start to previous Sunday
  const startDow = start.getUTCDay()
  start.setUTCDate(start.getUTCDate() - startDow)

  const allDays: { label: string; pnl: number; count: number; date: Date }[] = []
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const date = new Date(t)
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`
    const slot = byDay.get(key)
    allDays.push({
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      pnl: slot?.pnl ?? 0,
      count: slot?.count ?? 0,
      date,
    })
  }

  // Group into weeks (7-day columns starting Sunday)
  const weeks: typeof allDays[] = []
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7))
  }

  // Month labels — pick the first week of each month transition
  const monthLabels: { label: string; weekIdx: number }[] = []
  let lastMonth = -1
  for (let wi = 0; wi < weeks.length; wi++) {
    const firstDayOfWeek = weeks[wi][0]
    if (!firstDayOfWeek) continue
    const m = firstDayOfWeek.date.getUTCMonth()
    if (m !== lastMonth) {
      monthLabels.push({ label: firstDayOfWeek.date.toLocaleDateString("en-US", { month: "short" }), weekIdx: wi })
      lastMonth = m
    }
  }

  // Totals
  const tradingDays = allDays.filter((d) => d.count > 0)
  const profitableDays = tradingDays.filter((d) => d.pnl > 0)
  const losingDays = tradingDays.filter((d) => d.pnl < 0)
  const sortedDays = [...tradingDays].sort((a, b) => b.pnl - a.pnl)
  const bestDay = sortedDays[0] ?? null
  const worstDay = sortedDays[sortedDays.length - 1] ?? null

  return {
    weeks,
    monthLabels,
    allDays,
    totals: {
      activeDays: tradingDays.length,
      profitableDays: profitableDays.length,
      losingDays: losingDays.length,
      bestDay: bestDay && bestDay.pnl > 0 ? bestDay : null,
      worstDay: worstDay && worstDay.pnl < 0 ? worstDay : null,
    },
  }
}
