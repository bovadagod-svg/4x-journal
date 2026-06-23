"use client"

import { useMemo } from "react"
import { formatUSD } from "@/lib/finance"
import { isWin, isLoss } from "@/lib/outcome"
import type { Trade } from "@/lib/queries/trades"

/**
 * Risk-sizing analysis: how much $ do you risk per trade, and does win rate
 * change as size grows? Catches "revenge sizing" and "size creep" patterns
 * that show up before they show up in the equity curve.
 *
 *   - Avg $ risk per trade
 *   - Std deviation of risk
 *   - Risk creep — last 10 trades vs prior 30 (% change in avg)
 *   - Win rate by risk quartile (Q1 lowest risk → Q4 highest)
 */
export function RiskSizingAnalysis({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => compute(trades), [trades])
  if (stats.eligible === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Risk Sizing</h3>
        <p className="card-subtitle">Risk-per-trade trends and size-vs-edge correlation</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>Set the Risk ($) field on your trades to unlock sizing analysis.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Risk Sizing</h3>
        <p className="card-subtitle">{stats.eligible} of {trades.length} trades have a risk amount logged</p>
      </div>

      {/* Top KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
        <Stat label="Avg risk" value={formatUSD(stats.avgRisk)} sub={`σ ${formatUSD(stats.stdev)}`} />
        <Stat label="Largest risk" value={formatUSD(stats.maxRisk)} sub="single trade" />
        <Stat
          label="Risk creep"
          value={stats.creepPct != null ? `${stats.creepPct > 0 ? "+" : ""}${stats.creepPct.toFixed(1)}%` : "—"}
          sub={stats.creepPct != null ? "last 10 vs prior 30" : "need ≥ 15 trades"}
          color={stats.creepPct != null && stats.creepPct > 25 ? "var(--c-red-bright)" : stats.creepPct != null && stats.creepPct < -10 ? "var(--c-amber)" : "var(--c-fg)"}
        />
        <Stat label="Trades w/ risk" value={`${stats.eligible} / ${trades.length}`} sub={`${Math.round((stats.eligible / Math.max(1, trades.length)) * 100)}% logged`} />
      </div>

      {/* Quartile table */}
      {stats.quartiles.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Win rate × risk quartile
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{
              display: "grid", gridTemplateColumns: "60px 110px 50px 1fr 80px",
              gap: 8, padding: "4px 0",
              fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              <span>Bucket</span>
              <span>Range</span>
              <span style={{ textAlign: "right" }}>n</span>
              <span>Win rate</span>
              <span style={{ textAlign: "right" }}>Avg P&L</span>
            </div>
            {stats.quartiles.map((q) => (
              <div
                key={q.label}
                style={{
                  display: "grid", gridTemplateColumns: "60px 110px 50px 1fr 80px",
                  gap: 8, padding: "8px 0",
                  borderTop: "1px solid var(--c-border)",
                  alignItems: "center", fontSize: 12.5,
                }}
              >
                <span style={{ fontWeight: 500 }}>{q.label}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>
                  {formatUSD(q.lo)}–{formatUSD(q.hi)}
                </span>
                <span className="tnum" style={{ textAlign: "right", color: "var(--c-fg-muted)" }}>{q.count}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ position: "relative", flex: 1, height: 8, background: "var(--c-bg-elev-3)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      position: "absolute", inset: 0, width: `${q.winRate}%`,
                      background: q.winRate >= 50 ? "rgba(17, 196, 88, 0.6)" : "rgba(190, 51, 61, 0.6)",
                    }} />
                  </div>
                  <span className="tnum" style={{ fontSize: 11.5, fontWeight: 600, minWidth: 36, textAlign: "right" }}>
                    {Math.round(q.winRate)}%
                  </span>
                </div>
                <span className="tnum" style={{
                  textAlign: "right", fontWeight: 600,
                  color: q.avgPnL > 0 ? "var(--c-green-bright)" : q.avgPnL < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
                }}>
                  {formatUSD(q.avgPnL, { signed: true })}
                </span>
              </div>
            ))}
          </div>
          {stats.quartiles[0] && stats.quartiles[3] && Math.abs(stats.quartiles[3].winRate - stats.quartiles[0].winRate) > 15 && (
            <div style={{ marginTop: 10, padding: 10, background: "var(--c-bg-elev-2)", borderRadius: 8, fontSize: 11.5, color: "var(--c-fg-muted)" }}>
              <strong style={{ color: stats.quartiles[3].winRate > stats.quartiles[0].winRate ? "var(--c-green-bright)" : "var(--c-amber)" }}>
                {stats.quartiles[3].winRate > stats.quartiles[0].winRate ? "+" : ""}{Math.round(stats.quartiles[3].winRate - stats.quartiles[0].winRate)}%
              </strong>{" "}
              gap between your largest-risk trades (Q4) and smallest-risk trades (Q1).{" "}
              {stats.quartiles[3].winRate > stats.quartiles[0].winRate
                ? "Your bigger trades win more — conviction sizing is working."
                : "Your bigger trades win less — possible overconfidence sizing."}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{sub}</div>
    </div>
  )
}

function compute(trades: Trade[]) {
  const sorted = [...trades]
    .filter((t) => t.risk_amount != null && Number(t.risk_amount) > 0 && t.status === "closed")
    .sort((a, b) => new Date(a.closed_at ?? 0).getTime() - new Date(b.closed_at ?? 0).getTime())

  if (sorted.length === 0) {
    return { eligible: 0, avgRisk: 0, stdev: 0, maxRisk: 0, creepPct: null as number | null, quartiles: [] as Array<{ label: string; lo: number; hi: number; count: number; winRate: number; avgPnL: number }> }
  }

  const risks = sorted.map((t) => Number(t.risk_amount))
  const avgRisk = risks.reduce((s, x) => s + x, 0) / risks.length
  const variance = risks.reduce((s, x) => s + (x - avgRisk) ** 2, 0) / risks.length
  const stdev = Math.sqrt(variance)
  const maxRisk = Math.max(...risks)

  // Risk creep: avg of last 10 vs prior 30 (or what we have)
  let creepPct: number | null = null
  if (sorted.length >= 15) {
    const lastN = sorted.slice(-10).map((t) => Number(t.risk_amount))
    const priorN = sorted.slice(-Math.min(40, sorted.length), -10).map((t) => Number(t.risk_amount))
    if (priorN.length > 0) {
      const lastAvg = lastN.reduce((s, x) => s + x, 0) / lastN.length
      const priorAvg = priorN.reduce((s, x) => s + x, 0) / priorN.length
      creepPct = priorAvg > 0 ? ((lastAvg - priorAvg) / priorAvg) * 100 : null
    }
  }

  // Quartile buckets — sort risks, slice into 4 equal buckets
  const sortedRisk = [...sorted].sort((a, b) => Number(a.risk_amount) - Number(b.risk_amount))
  const qSize = Math.floor(sortedRisk.length / 4)
  const quartiles = qSize > 0 ? ["Q1", "Q2", "Q3", "Q4"].map((label, i) => {
    const slice = i === 3 ? sortedRisk.slice(qSize * 3) : sortedRisk.slice(qSize * i, qSize * (i + 1))
    if (slice.length === 0) return null
    const wins = slice.filter((t) => isWin(Number(t.pnl))).length
    const losses = slice.filter((t) => isLoss(Number(t.pnl))).length
    const lo = Number(slice[0].risk_amount)
    const hi = Number(slice[slice.length - 1].risk_amount)
    return {
      label,
      lo, hi,
      count: slice.length,
      winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
      avgPnL: slice.reduce((s, t) => s + (Number(t.pnl) || 0), 0) / slice.length,
    }
  }).filter((q): q is NonNullable<typeof q> => q !== null) : []

  return {
    eligible: sorted.length,
    avgRisk,
    stdev,
    maxRisk,
    creepPct,
    quartiles,
  }
}
