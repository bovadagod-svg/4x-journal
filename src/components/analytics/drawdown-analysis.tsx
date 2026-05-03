"use client"

import { useMemo } from "react"
import { formatUSD } from "@/lib/finance"
import type { Trade } from "@/lib/queries/trades"

/**
 * Drawdown analysis: peaks, troughs, and recovery factor.
 *
 *   - Current drawdown from peak ($ + %)
 *   - Max drawdown ($ + %)
 *   - Avg drawdown duration (trades from peak to recovery)
 *   - Recovery factor = total profit / max drawdown
 *   - Mini equity-curve sparkline with peak + max-DD trough markers
 */
export function DrawdownAnalysis({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => compute(trades), [trades])
  if (stats.points.length < 2) {
    return (
      <div className="card">
        <h3 className="card-title">Drawdown</h3>
        <p className="card-subtitle">Peak-to-trough analysis + recovery factor</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>Need at least 2 closed trades.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Drawdown</h3>
        <p className="card-subtitle">Peaks, troughs, and recovery factor</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
        <Stat label="Current DD"
          value={stats.currentDD < 0 ? formatUSD(stats.currentDD) : "—"}
          sub={stats.currentDD < 0 ? `${stats.currentDDPct.toFixed(1)}% off peak` : "at high-water mark"}
          color={stats.currentDD < 0 ? "var(--c-amber)" : "var(--c-green-bright)"}
        />
        <Stat
          label="Max DD"
          value={formatUSD(stats.maxDD)}
          sub={`${stats.maxDDPct.toFixed(1)}% peak-to-trough`}
          color="var(--c-red-bright)"
        />
        <Stat
          label="Recovery factor"
          value={stats.recoveryFactor != null ? stats.recoveryFactor.toFixed(2) : "—"}
          sub={stats.recoveryFactor != null && stats.recoveryFactor >= 3 ? "robust" : stats.recoveryFactor != null && stats.recoveryFactor < 1 ? "underwater" : "moderate"}
          color={stats.recoveryFactor != null && stats.recoveryFactor >= 3 ? "var(--c-green-bright)" : stats.recoveryFactor != null && stats.recoveryFactor < 1 ? "var(--c-red-bright)" : "var(--c-fg)"}
        />
        <Stat
          label="DD duration"
          value={stats.maxDDDuration > 0 ? `${stats.maxDDDuration} trades` : "—"}
          sub="peak → recovery"
        />
      </div>

      {/* Sparkline */}
      <DrawdownSpark points={stats.points} peakIdx={stats.peakIdx} troughIdx={stats.troughIdx} />
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 18, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{sub}</div>
    </div>
  )
}

function DrawdownSpark({ points, peakIdx, troughIdx }: { points: number[]; peakIdx: number; troughIdx: number }) {
  if (points.length < 2) return null
  const W = 600
  const H = 90
  const PAD = 6
  const min = Math.min(...points, 0)
  const max = Math.max(...points, 0)
  const range = max - min || 1
  const stepX = (W - PAD * 2) / (points.length - 1)
  const yFor = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2)
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${(PAD + i * stepX).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ")
  const area = `${path} L${(PAD + (points.length - 1) * stepX).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
        {/* y=0 baseline */}
        <line x1={PAD} x2={W - PAD} y1={yFor(0)} y2={yFor(0)} stroke="var(--c-border)" strokeDasharray="2 3" />
        <path d={area} fill="rgba(105, 50, 212, 0.12)" />
        <path d={path} stroke="var(--c-purple-bright)" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Peak marker */}
        {peakIdx >= 0 && (
          <circle cx={PAD + peakIdx * stepX} cy={yFor(points[peakIdx])} r={4} fill="var(--c-green-bright)" stroke="var(--c-bg-elev-1)" strokeWidth={2} />
        )}
        {/* Max-DD trough marker */}
        {troughIdx >= 0 && troughIdx !== peakIdx && (
          <circle cx={PAD + troughIdx * stepX} cy={yFor(points[troughIdx])} r={4} fill="var(--c-red-bright)" stroke="var(--c-bg-elev-1)" strokeWidth={2} />
        )}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 4 }}>
        <span>● Peak</span>
        <span style={{ color: "var(--c-fg-muted)" }}>● Max DD trough</span>
      </div>
    </div>
  )
}

function compute(trades: Trade[]) {
  const closed = trades
    .filter((t) => t.status === "closed")
    .sort((a, b) => new Date(a.closed_at ?? 0).getTime() - new Date(b.closed_at ?? 0).getTime())

  let running = 0
  const points: number[] = [0]
  for (const t of closed) {
    running += Number(t.pnl) || 0
    points.push(Number(running.toFixed(2)))
  }

  // Drawdown calc — track peak, current drawdown, max drawdown + indices
  let peak = 0
  let peakIdx = 0
  let maxDD = 0
  let maxDDPct = 0
  let troughIdx = 0
  let maxDDStart = 0
  let maxDDEnd = 0
  let inDDStart = -1

  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (p > peak) {
      peak = p
      peakIdx = i
      inDDStart = -1
    } else if (p < peak) {
      if (inDDStart === -1) inDDStart = i
      const dd = p - peak
      const ddPct = peak > 0 ? (dd / peak) * 100 : 0
      if (dd < maxDD) {
        maxDD = dd
        maxDDPct = ddPct
        troughIdx = i
        maxDDStart = peakIdx
        maxDDEnd = i
      }
    }
  }

  const currentDD = points[points.length - 1] - peak
  const currentDDPct = peak > 0 ? (currentDD / peak) * 100 : 0
  const totalProfit = Math.max(0, points[points.length - 1])
  const recoveryFactor = maxDD < 0 ? totalProfit / Math.abs(maxDD) : null
  const maxDDDuration = maxDDEnd > maxDDStart ? maxDDEnd - maxDDStart : 0

  return {
    points,
    peakIdx,
    troughIdx,
    maxDD: Math.abs(maxDD),
    maxDDPct: Math.abs(maxDDPct),
    currentDD,
    currentDDPct,
    recoveryFactor,
    maxDDDuration,
  }
}
