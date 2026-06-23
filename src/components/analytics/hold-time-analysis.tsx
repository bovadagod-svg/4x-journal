"use client"

import { useMemo } from "react"
import { formatUSD } from "@/lib/finance"
import type { Trade } from "@/lib/queries/trades"
import { isWin, isLoss } from "@/lib/outcome"

/**
 * Hold-time analysis: how long does each trade live, and which durations
 * pay off?
 *
 *   - Histogram of hold-time buckets
 *   - Win rate / avg P&L / avg R per bucket
 *   - Median + p25 + p75 hold time KPIs
 *
 * "Hold time" = closed_at - opened_at, ignoring weekends if you wanted
 * trading-hours-only. Plain wall-clock for now since it's still useful.
 */

const BUCKETS: { label: string; minMin: number; maxMin: number }[] = [
  { label: "<5 min", minMin: 0, maxMin: 5 },
  { label: "5–30 min", minMin: 5, maxMin: 30 },
  { label: "30 m–1 h", minMin: 30, maxMin: 60 },
  { label: "1–4 h", minMin: 60, maxMin: 240 },
  { label: "4–24 h", minMin: 240, maxMin: 1440 },
  { label: "1–3 days", minMin: 1440, maxMin: 4320 },
  { label: "3+ days", minMin: 4320, maxMin: Infinity },
]

export function HoldTimeAnalysis({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => compute(trades), [trades])
  if (stats.eligible === 0) return null

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 className="card-title">Hold-Time Analysis</h3>
          <p className="card-subtitle">How long do trades live, and which durations pay off?</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Quick label="Median" value={fmtMin(stats.median)} />
          <Quick label="p25 / p75" value={`${fmtMin(stats.p25)} / ${fmtMin(stats.p75)}`} />
          <Quick label="Quickest win" value={fmtMin(stats.fastestWin)} color="var(--c-green-bright)" />
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 480, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "100px 50px 1fr 80px 80px",
            gap: 8, padding: "6px 0",
            fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
            borderBottom: "1px solid var(--c-border)",
          }}>
            <span>Bucket</span>
            <span style={{ textAlign: "right" }}>n</span>
            <span>Win rate</span>
            <span style={{ textAlign: "right" }}>Avg R</span>
            <span style={{ textAlign: "right" }}>Avg P&L</span>
          </div>
          {stats.rows.map((r) => (
            <div
              key={r.label}
              style={{
                display: "grid", gridTemplateColumns: "100px 50px 1fr 80px 80px",
                gap: 8, padding: "8px 0",
                borderBottom: "1px solid var(--c-border)",
                alignItems: "center", fontSize: 12.5,
                opacity: r.count === 0 ? 0.4 : 1,
              }}
            >
              <span style={{ fontWeight: 500 }}>{r.label}</span>
              <span className="tnum" style={{ textAlign: "right", color: "var(--c-fg-muted)" }}>{r.count}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative", flex: 1, height: 8, background: "var(--c-bg-elev-3)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", inset: 0, width: `${r.winRate}%`,
                    background: r.winRate >= 50 ? "rgba(17, 196, 88, 0.6)" : "rgba(190, 51, 61, 0.6)",
                  }} />
                </div>
                <span className="tnum" style={{ fontSize: 11.5, fontWeight: 600, minWidth: 36, textAlign: "right" }}>
                  {r.count === 0 ? "—" : `${Math.round(r.winRate)}%`}
                </span>
              </div>
              <span className="tnum" style={{
                textAlign: "right",
                color: r.avgR > 0 ? "var(--c-green-bright)" : r.avgR < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
              }}>
                {r.count === 0 ? "—" : `${r.avgR > 0 ? "+" : ""}${r.avgR.toFixed(2)}R`}
              </span>
              <span className="tnum" style={{
                textAlign: "right", fontWeight: 600,
                color: r.avgPnL > 0 ? "var(--c-green-bright)" : r.avgPnL < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
              }}>
                {r.count === 0 ? "—" : formatUSD(r.avgPnL, { signed: true })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {stats.bestBucket && (
        <div style={{ marginTop: 12, padding: 10, background: "var(--c-bg-elev-2)", borderRadius: 8, fontSize: 12, color: "var(--c-fg-muted)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--c-purple-bright)" }} />
          <span>
            Edge clusters in <strong style={{ color: "var(--c-fg)" }}>{stats.bestBucket.label}</strong> trades —{" "}
            {Math.round(stats.bestBucket.winRate)}% win rate across {stats.bestBucket.count} sample{stats.bestBucket.count === 1 ? "" : "s"}.
          </span>
        </div>
      )}
    </div>
  )
}

function Quick({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "8px 12px" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 14, fontWeight: 600, color: color ?? "var(--c-fg)" }}>{value}</div>
    </div>
  )
}

function compute(trades: Trade[]) {
  const eligible = trades.filter((t) => t.status === "closed" && t.opened_at && t.closed_at)
  const minutes = eligible.map((t) => (new Date(t.closed_at!).getTime() - new Date(t.opened_at!).getTime()) / 60_000)

  const rows = BUCKETS.map((b) => {
    const inBucket = eligible.filter((t, i) => minutes[i] >= b.minMin && minutes[i] < b.maxMin)
    const wins = inBucket.filter((t) => isWin(Number(t.pnl))).length
    const losses = inBucket.filter((t) => isLoss(Number(t.pnl))).length
    const totalPnl = inBucket.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
    const totalR = inBucket.reduce((s, t) => s + (Number(t.r) || 0), 0)
    return {
      label: b.label,
      count: inBucket.length,
      wins,
      winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
      avgPnL: inBucket.length > 0 ? totalPnl / inBucket.length : 0,
      avgR: inBucket.length > 0 ? totalR / inBucket.length : 0,
    }
  })

  const sorted = [...minutes].sort((a, b) => a - b)
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0
  const p25 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.25)] : 0
  const p75 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.75)] : 0

  const winnerMinutes = eligible
    .filter((t) => isWin(Number(t.pnl)))
    .map((t) => (new Date(t.closed_at!).getTime() - new Date(t.opened_at!).getTime()) / 60_000)
  const fastestWin = winnerMinutes.length > 0 ? Math.min(...winnerMinutes) : 0

  // Best bucket = highest win rate among buckets with ≥3 trades
  const eligibleBuckets = rows.filter((r) => r.count >= 3)
  const bestBucket = eligibleBuckets.length > 0
    ? [...eligibleBuckets].sort((a, b) => b.winRate - a.winRate)[0]
    : null

  return { eligible: eligible.length, rows, median, p25, p75, fastestWin, bestBucket }
}

function fmtMin(m: number): string {
  if (m < 1) return "<1m"
  if (m < 60) return `${Math.round(m)}m`
  if (m < 1440) return `${(m / 60).toFixed(1)}h`
  return `${(m / 1440).toFixed(1)}d`
}
