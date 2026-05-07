"use client"

import { useMemo } from "react"
import { NarrativeBanner } from "./narrative-banner"
import type { Trade } from "@/lib/queries/trades"

/**
 * Underwater curve — continuous "% from peak" line. Companion to the existing
 * DrawdownAnalysis card (which surfaces max DD as a number). The shape of
 * this chart is what matters: are you flat near the surface or stuck deep
 * underwater for long stretches? Time spent in DD is often the more painful
 * metric than depth.
 *
 * Pure SVG, derived from cumulative P&L. Filled area below the zero line.
 */
export function UnderwaterCurve({ trades }: { trades: Trade[] }) {
  const data = useMemo(() => compute(trades), [trades])
  if (data.points.length < 5) return null

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Underwater Curve</h3>
        <p className="card-subtitle">
          % below your peak equity over time · max DD {data.maxDd.toFixed(1)}% · time underwater {Math.round(data.timeUnderwaterPct)}%
        </p>
      </div>

      <Chart points={data.points} maxDd={data.maxDd} />

      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <Stat label="Max drawdown" value={`${data.maxDd.toFixed(1)}%`} sub="peak to trough" color="var(--c-red-bright)" />
        <Stat label="Current DD" value={`${data.currentDd.toFixed(1)}%`} sub={data.currentDd > 0 ? "underwater" : "at peak"} color={data.currentDd > 0 ? "var(--c-amber)" : "var(--c-green-bright)"} />
        <Stat label="Time underwater" value={`${Math.round(data.timeUnderwaterPct)}%`} sub="of trades below peak" />
        <Stat label="Longest stretch" value={data.longestStretch > 0 ? `${data.longestStretch} trades` : "—"} sub="below peak" />
      </div>

      {data.narrative && (
        <div style={{ marginTop: 12 }}>
          <NarrativeBanner tone="warn">{data.narrative}</NarrativeBanner>
        </div>
      )}
    </div>
  )
}

function Chart({ points, maxDd }: { points: number[]; maxDd: number }) {
  const W = 720
  const H = 160
  const padX = 8
  const padT = 8
  const padB = 18
  const innerW = W - padX * 2
  const innerH = H - padT - padB
  const n = points.length
  const range = Math.max(maxDd, 1)

  const xFor = (i: number) => padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const yFor = (v: number) => padT + (v / range) * innerH

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p).toFixed(1)}`).join(" ")
  const areaPath = `M ${xFor(0).toFixed(1)} ${padT} L ${linePath.slice(2)} L ${xFor(n - 1).toFixed(1)} ${padT} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, border: "1px solid var(--c-border)" }}>
      <defs>
        <linearGradient id="underwaterFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--c-red-bright)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--c-red-bright)" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#underwaterFill)" />
      <path d={linePath} stroke="var(--c-red-bright)" strokeWidth={1.4} fill="none" opacity={0.85} />
      {/* Surface line */}
      <line x1={padX} x2={W - padX} y1={padT} y2={padT} stroke="var(--c-fg-dim)" strokeWidth={0.5} />
      {/* Y labels */}
      <text x={padX + 4} y={padT + 9} fontSize={9} fill="var(--c-fg-dim)">peak</text>
      <text x={padX + 4} y={H - padB - 4} fontSize={9} fill="var(--c-red-bright)">−{maxDd.toFixed(1)}%</text>
      <text x={padX} y={H - 5} fontSize={9} fill="var(--c-fg-dim)">trade 1</text>
      <text x={W - padX} y={H - 5} fontSize={9} textAnchor="end" fill="var(--c-fg-dim)">trade {n}</text>
    </svg>
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

function compute(trades: Trade[]): {
  points: number[]
  maxDd: number
  currentDd: number
  timeUnderwaterPct: number
  longestStretch: number
  narrative: string | null
} {
  const sorted = trades
    .filter((t) => t.status === "closed" && t.closed_at != null)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime())
  if (sorted.length === 0) {
    return { points: [], maxDd: 0, currentDd: 0, timeUnderwaterPct: 0, longestStretch: 0, narrative: null }
  }

  // Build cumulative PnL series (assume base 0). Then compute %-from-peak
  // relative to running max — we report DD as positive numbers.
  let running = 0
  let peak = 0
  let maxDd = 0
  let currentDd = 0
  let underwaterCount = 0
  let stretch = 0
  let longestStretch = 0
  const points: number[] = []
  for (const t of sorted) {
    running += Number(t.pnl) || 0
    if (running > peak) peak = running
    // % below peak: when peak == 0 (trader is net-loss from start), use absolute.
    const dollarsBelow = peak - running
    const pct = peak > 0 ? (dollarsBelow / peak) * 100 : dollarsBelow > 0 ? 100 : 0
    points.push(pct)
    if (pct > maxDd) maxDd = pct
    if (pct > 0.01) {
      underwaterCount++
      stretch++
      if (stretch > longestStretch) longestStretch = stretch
    } else {
      stretch = 0
    }
    currentDd = pct
  }

  const timeUnderwaterPct = (underwaterCount / sorted.length) * 100

  let narrative: string | null = null
  if (timeUnderwaterPct > 60 && maxDd > 10) {
    narrative = `You spent ${Math.round(timeUnderwaterPct)}% of these trades underwater — equity-curve psychology compounds. Smaller per-trade risk could shorten your recovery time.`
  } else if (longestStretch >= 30 && maxDd > 5) {
    narrative = `Your longest stretch underwater ran ${longestStretch} trades. Surviving stretches like that is mostly a sizing problem — make sure your risk per trade leaves room for the worst stretch you've already lived through.`
  }

  return { points, maxDd, currentDd, timeUnderwaterPct, longestStretch, narrative }
}
