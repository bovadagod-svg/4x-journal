"use client"

import { useMemo } from "react"
import { formatUSD } from "@/lib/finance"
import type { Trade } from "@/lib/queries/trades"
import { isWin, isLoss } from "@/lib/outcome"

/**
 * Monthly comparison bars. Shows the last 12 calendar months as P&L bars
 * with trade-count + WR overlay. Best/worst month called out at the top.
 *
 * This view ignores the Analytics range filter — it's always last-12 because
 * comparing months is the whole point.
 */
export function MonthlyComparison({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => compute(trades), [trades])
  // Rank only months that actually had trades — an empty month at $0 must never
  // win "Best" over a profitable (or any active) month.
  const active = stats.months.filter((m) => m.count > 0)
  if (active.length === 0) {
    return null
  }
  const best = [...active].sort((a, b) => b.pnl - a.pnl)[0]
  const worst = [...active].sort((a, b) => a.pnl - b.pnl)[0]
  const max = Math.max(...active.map((m) => Math.abs(m.pnl)), 1)

  return (
    <div className="card">
      <div style={{ marginBottom: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 className="card-title">Monthly P&L</h3>
          <p className="card-subtitle">Last {stats.months.length} months · best vs worst at a glance</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Tag label="Best" name={best.label} value={formatUSD(best.pnl, { signed: true })} color="var(--c-green-bright)" />
          {worst.label !== best.label && <Tag label="Worst" name={worst.label} value={formatUSD(worst.pnl, { signed: true })} color="var(--c-red-bright)" />}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.months.length}, 1fr)`, gap: 4, alignItems: "end", height: 140 }}>
        {stats.months.map((m) => {
          const isBest = m.label === best.label && best.pnl > 0
          const isWorst = m.label === worst.label && worst.pnl < 0
          const heightPct = max > 0 ? (Math.abs(m.pnl) / max) * 100 : 0
          const positive = m.pnl >= 0
          return (
            <div key={m.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
              {/* Top half: positive bars */}
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", width: "100%" }}>
                {positive && m.count > 0 && (
                  <div
                    title={`${m.label}: ${formatUSD(m.pnl, { signed: true })} · ${m.count} trades · ${Math.round(m.winRate)}% WR`}
                    style={{
                      width: "70%", maxWidth: 32, height: `${heightPct}%`,
                      background: isBest ? "var(--c-green-bright)" : "rgba(17, 196, 88, 0.55)",
                      borderRadius: "4px 4px 0 0",
                      minHeight: 2,
                    }}
                  />
                )}
              </div>
              {/* Bottom half: negative bars */}
              <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", width: "100%" }}>
                {!positive && m.count > 0 && (
                  <div
                    title={`${m.label}: ${formatUSD(m.pnl, { signed: true })} · ${m.count} trades · ${Math.round(m.winRate)}% WR`}
                    style={{
                      width: "70%", maxWidth: 32, height: `${heightPct}%`,
                      background: isWorst ? "var(--c-red-bright)" : "rgba(190, 51, 61, 0.55)",
                      borderRadius: "0 0 4px 4px",
                      minHeight: 2,
                    }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${stats.months.length}, 1fr)`, gap: 4, marginTop: 6 }}>
        {stats.months.map((m) => (
          <span key={m.label} style={{ textAlign: "center", fontSize: 10, color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)" }}>
            {m.label}
          </span>
        ))}
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 14 }}>
        <Mini label="Profitable months" value={`${stats.profitableMonths} / ${stats.activeMonths}`} sub={`${Math.round((stats.profitableMonths / Math.max(1, stats.activeMonths)) * 100)}% hit rate`} />
        <Mini label="Avg monthly P&L" value={formatUSD(stats.avgMonthly, { signed: true })} sub="across active months" color={stats.avgMonthly >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)"} />
        <Mini label="Best month range" value={formatUSD(best.pnl - worst.pnl, { signed: false })} sub={`${best.label} − ${worst.label}`} />
      </div>
    </div>
  )
}

function Tag({ label, name, value, color }: { label: string; name: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "6px 10px", lineHeight: 1.2 }}>
      <div style={{ fontSize: 9, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>{name}</span>
        <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color }}>{value}</span>
      </div>
    </div>
  )
}

function Mini({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{sub}</div>
    </div>
  )
}

function compute(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed")

  // Group realized P&L by the month the trade was OPENED (entry month), so it
  // lines up with the Trading Calendar's entry-day bucketing. Local time, to
  // match the month-window loop below.
  const byMonth = new Map<string, Trade[]>()
  for (const t of closed) {
    const ref = t.opened_at ?? t.closed_at
    if (!ref) continue
    const d = new Date(ref)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const arr = byMonth.get(key) ?? []
    arr.push(t)
    byMonth.set(key, arr)
  }

  // Build last 12 months window (chronological)
  const now = new Date()
  const months: { label: string; key: string; count: number; pnl: number; winRate: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("en-US", { month: "short" })
    const ts = byMonth.get(key) ?? []
    const wins = ts.filter((t) => isWin(Number(t.pnl))).length
    const losses = ts.filter((t) => isLoss(Number(t.pnl))).length
    months.push({
      label,
      key,
      count: ts.length,
      pnl: ts.reduce((s, t) => s + (Number(t.pnl) || 0), 0),
      winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
    })
  }

  const activeMonths = months.filter((m) => m.count > 0).length
  const profitableMonths = months.filter((m) => m.pnl > 0).length
  const avgMonthly = activeMonths > 0
    ? months.filter((m) => m.count > 0).reduce((s, m) => s + m.pnl, 0) / activeMonths
    : 0

  return { months, activeMonths, profitableMonths, avgMonthly }
}
