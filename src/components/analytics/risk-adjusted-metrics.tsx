"use client"

import { useMemo } from "react"
import { sharpeR, sortinoR, calmar, ulcerIndex } from "@/lib/risk-metrics"
import type { Trade } from "@/lib/queries/trades"

/**
 * Risk-adjusted metrics — Sharpe, Sortino, Calmar, Ulcer. The KPI strip up top
 * already shows R-Sharpe; this card surfaces the full set with one-line
 * interpretations so the numbers actually mean something to the user instead
 * of being four mystery decimals.
 */
export function RiskAdjustedMetrics({ trades }: { trades: Trade[] }) {
  const data = useMemo(() => compute(trades), [trades])

  if (!data) return null

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Risk-Adjusted Metrics</h3>
        <p className="card-subtitle">How efficient is your edge per unit of risk?</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <Metric
          label="Sharpe (R-based)"
          value={data.sharpe != null ? data.sharpe.toString() : "—"}
          interpretation={interpretSharpe(data.sharpe)}
          color={data.sharpe == null ? "var(--c-fg-muted)" : data.sharpe >= 0.5 ? "var(--c-green-bright)" : data.sharpe <= 0 ? "var(--c-red-bright)" : "var(--c-amber)"}
        />
        <Metric
          label="Sortino (R-based)"
          value={data.sortino != null ? data.sortino.toString() : "—"}
          interpretation="Like Sharpe, but only penalizes losing trades. Higher = asymmetric edge (small losers, big winners)."
          color={data.sortino == null ? "var(--c-fg-muted)" : data.sortino >= 0.7 ? "var(--c-green-bright)" : data.sortino <= 0 ? "var(--c-red-bright)" : "var(--c-amber)"}
        />
        <Metric
          label="Calmar"
          value={data.calmar != null ? data.calmar.toString() + "×" : "—"}
          interpretation="Net P&L per dollar of max drawdown. >1 means recovering more than you've lost in your worst stretch."
          color={data.calmar == null ? "var(--c-fg-muted)" : data.calmar >= 1 ? "var(--c-green-bright)" : data.calmar <= 0 ? "var(--c-red-bright)" : "var(--c-amber)"}
        />
        <Metric
          label="Ulcer Index"
          value={data.ulcer != null ? data.ulcer.toString() : "—"}
          interpretation="Weighted measure of how deep + how long you stay underwater. Lower = smoother equity curve."
          color={data.ulcer == null ? "var(--c-fg-muted)" : data.ulcer <= 5 ? "var(--c-green-bright)" : data.ulcer >= 15 ? "var(--c-red-bright)" : "var(--c-amber)"}
          inverted
        />
      </div>
    </div>
  )
}

function Metric({ label, value, interpretation, color, inverted }: { label: string; value: string; interpretation: string; color?: string; inverted?: boolean }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        {inverted && <span style={{ fontSize: 9.5, color: "var(--c-fg-dim)" }}>lower is better</span>}
      </div>
      <div className="tnum" style={{ fontSize: 22, fontWeight: 600, color: color ?? "var(--c-fg)", marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--c-fg-muted)", lineHeight: 1.45 }}>{interpretation}</div>
    </div>
  )
}

function interpretSharpe(v: number | null): string {
  if (v == null) return "Need ≥5 trades with R values for a meaningful number."
  if (v <= 0) return "You're net-losing per unit of variability — the edge isn't there yet."
  if (v < 0.3) return "Below typical retail benchmark (~0.5). Lots of variance for what you're earning."
  if (v < 0.7) return "Solid retail-trader range. Your edge is real but choppy."
  if (v < 1.2) return "Strong — you're getting paid well per unit of risk."
  return "Exceptional. Either a small sample fluking high, or a genuinely tight, repeatable system."
}

function compute(trades: Trade[]) {
  const closed = trades
    .filter((t) => t.status === "closed" && t.closed_at != null)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime())
  if (closed.length < 5) return null

  const rs = closed.map((t) => Number(t.r) || 0).filter((r) => r !== 0)
  let running = 0
  const equity = closed.map((t) => { running += Number(t.pnl) || 0; return running })

  return {
    sharpe: sharpeR(rs),
    sortino: sortinoR(rs),
    calmar: calmar(equity),
    ulcer: ulcerIndex(equity),
  }
}
