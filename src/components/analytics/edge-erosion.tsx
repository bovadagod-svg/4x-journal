"use client"

import { useMemo, useState } from "react"
import type { Trade } from "@/lib/queries/trades"

/**
 * Rolling-window edge erosion. Lifetime stats hide decay — a 20- or 50-trade
 * rolling WR / expectancy makes "the market changed" or "your setup is fading"
 * visible. Two lines on one chart: WR % (left axis, cyan) and expectancy
 * dollars (right axis, purple).
 *
 * Implementation: at each chronological trade index i, recompute WR + expectancy
 * over the previous N closed trades. The first N-1 points have insufficient
 * sample → skipped. Window slider mutates N client-side.
 */

const WINDOW_OPTIONS = [10, 20, 50] as const
type Window = typeof WINDOW_OPTIONS[number]

export function EdgeErosion({ trades }: { trades: Trade[] }) {
  const [window, setWindow] = useState<Window>(20)

  const sorted = useMemo(() => {
    return [...trades]
      .filter((t) => t.status === "closed" && t.closed_at != null)
      .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime())
  }, [trades])

  const series = useMemo(() => buildSeries(sorted, window), [sorted, window])

  if (sorted.length < 30) return null

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h3 className="card-title">Edge Erosion</h3>
          <p className="card-subtitle">Rolling {window}-trade win rate and expectancy</p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w}
              type="button"
              className="btn btn-sm"
              onClick={() => setWindow(w)}
              style={{
                fontSize: 10.5,
                padding: "3px 9px",
                background: w === window ? "var(--c-purple-bright)" : "var(--c-bg-elev-2)",
                color: w === window ? "white" : "var(--c-fg-muted)",
                border: "1px solid var(--c-border)",
              }}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {series.points.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--c-fg-muted)", padding: "20px 0", textAlign: "center" }}>
          Need at least {window} closed trades for a {window}-trade rolling window. Try a smaller window.
        </div>
      ) : (
        <>
          <DualAxisChart series={series} />
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11 }}>
            <Legend color="var(--c-cyan-bright, #5BC8E0)" label={`Rolling WR (${series.firstWr.toFixed(0)}% → ${series.lastWr.toFixed(0)}%)`} />
            <Legend color="var(--c-purple-bright)" label={`Rolling expectancy (${series.firstExp >= 0 ? "+" : ""}${formatShort(series.firstExp)} → ${series.lastExp >= 0 ? "+" : ""}${formatShort(series.lastExp)})`} />
          </div>
          {series.narrative && (
            <div style={{
              marginTop: 10, padding: 10,
              background: series.narrative.tone === "bad" ? "rgba(190, 51, 61, 0.06)" : "rgba(17, 196, 88, 0.06)",
              border: `1px solid ${series.narrative.tone === "bad" ? "rgba(190, 51, 61, 0.25)" : "rgba(17, 196, 88, 0.25)"}`,
              borderRadius: 8, fontSize: 12, color: "var(--c-fg-muted)",
            }}>
              {series.narrative.text}
            </div>
          )}
        </>
      )}
    </div>
  )
}

type Series = ReturnType<typeof buildSeries>

function buildSeries(sorted: Trade[], window: number) {
  const points: { i: number; wr: number; exp: number; ts: number }[] = []
  if (sorted.length < window) {
    return {
      points,
      firstWr: 0, lastWr: 0, firstExp: 0, lastExp: 0,
      wrMin: 0, wrMax: 100, expMin: 0, expMax: 0,
      narrative: null as null | { text: string; tone: "good" | "bad" },
    }
  }
  for (let i = window - 1; i < sorted.length; i++) {
    const slice = sorted.slice(i - window + 1, i + 1)
    const wins = slice.filter((t) => Number(t.pnl) > 0)
    const losses = slice.filter((t) => Number(t.pnl) < 0)
    const wr = (wins.length / slice.length) * 100
    const grossWin = wins.reduce((s, t) => s + Number(t.pnl), 0)
    const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0))
    const avgWin = wins.length > 0 ? grossWin / wins.length : 0
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0
    const exp = (wr / 100) * avgWin - ((100 - wr) / 100) * avgLoss
    const ts = new Date(sorted[i].closed_at!).getTime()
    points.push({ i, wr, exp, ts })
  }

  const firstWr = points[0].wr
  const lastWr = points[points.length - 1].wr
  const firstExp = points[0].exp
  const lastExp = points[points.length - 1].exp
  const wrs = points.map((p) => p.wr)
  const exps = points.map((p) => p.exp)
  const wrMin = Math.min(...wrs)
  const wrMax = Math.max(...wrs)
  const expMin = Math.min(...exps)
  const expMax = Math.max(...exps)

  let narrative: { text: string; tone: "good" | "bad" } | null = null
  const wrDelta = lastWr - firstWr
  const expDelta = lastExp - firstExp
  if (wrDelta < -8 || (firstExp > 0 && lastExp < 0)) {
    narrative = {
      tone: "bad",
      text: `Edge is decaying — your rolling ${window}-trade win rate fell from ${firstWr.toFixed(0)}% to ${lastWr.toFixed(0)}% and expectancy went from ${formatShort(firstExp)} to ${formatShort(lastExp)} per trade. Time to revisit setups, sizing, or whether the market regime has changed.`,
    }
  } else if (wrDelta > 8 && expDelta > 0) {
    narrative = {
      tone: "good",
      text: `You're improving — rolling ${window}-trade WR up ${wrDelta.toFixed(0)}pp and expectancy up ${formatShort(expDelta)} per trade. Whatever you've been doing differently lately, keep doing it.`,
    }
  }

  return { points, firstWr, lastWr, firstExp, lastExp, wrMin, wrMax, expMin, expMax, narrative }
}

function DualAxisChart({ series }: { series: Series }) {
  const W = 720
  const H = 200
  const padL = 36
  const padR = 36
  const padT = 12
  const padB = 22
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const n = series.points.length

  // WR axis: clamp to a sensible visible range so noise doesn't dominate.
  const wrLo = Math.max(0, Math.min(series.wrMin - 5, 30))
  const wrHi = Math.min(100, Math.max(series.wrMax + 5, 70))
  const wrRange = wrHi - wrLo

  // Expectancy: include zero in range so the gain/loss flip is visible.
  const expLo = Math.min(series.expMin, 0)
  const expHi = Math.max(series.expMax, 0)
  const expRange = (expHi - expLo) || 1

  const xFor = (i: number) => padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const yWr = (v: number) => padT + innerH - ((v - wrLo) / wrRange) * innerH
  const yExp = (v: number) => padT + innerH - ((v - expLo) / expRange) * innerH

  const wrPath = series.points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yWr(p.wr).toFixed(1)}`).join(" ")
  const expPath = series.points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yExp(p.exp).toFixed(1)}`).join(" ")

  const zeroExpY = expLo < 0 && expHi > 0 ? yExp(0) : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, border: "1px solid var(--c-border)" }}>
      {/* 50% WR baseline */}
      {wrLo <= 50 && wrHi >= 50 && (
        <line x1={padL} x2={W - padR} y1={yWr(50)} y2={yWr(50)} stroke="var(--c-fg-dim)" strokeDasharray="2 4" strokeWidth={1} opacity={0.4} />
      )}
      {/* Expectancy zero line */}
      {zeroExpY != null && (
        <line x1={padL} x2={W - padR} y1={zeroExpY} y2={zeroExpY} stroke="var(--c-fg-dim)" strokeDasharray="2 4" strokeWidth={1} opacity={0.4} />
      )}
      {/* WR line */}
      <path d={wrPath} fill="none" stroke="var(--c-cyan-bright, #5BC8E0)" strokeWidth={1.5} />
      {/* Expectancy line */}
      <path d={expPath} fill="none" stroke="var(--c-purple-bright)" strokeWidth={1.5} />
      {/* Y-axis labels */}
      <text x={padL - 6} y={padT + 10} fontSize={9} textAnchor="end" fill="var(--c-cyan-bright, #5BC8E0)">{wrHi.toFixed(0)}%</text>
      <text x={padL - 6} y={H - padB} fontSize={9} textAnchor="end" fill="var(--c-cyan-bright, #5BC8E0)">{wrLo.toFixed(0)}%</text>
      <text x={W - padR + 6} y={padT + 10} fontSize={9} textAnchor="start" fill="var(--c-purple-bright)">{formatShort(expHi)}</text>
      <text x={W - padR + 6} y={H - padB} fontSize={9} textAnchor="start" fill="var(--c-purple-bright)">{formatShort(expLo)}</text>
      {/* X-axis trade labels */}
      <text x={padL} y={H - 6} fontSize={9} textAnchor="start" fill="var(--c-fg-dim)">trade {series.points[0].i + 1}</text>
      <text x={W - padR} y={H - 6} fontSize={9} textAnchor="end" fill="var(--c-fg-dim)">trade {series.points[series.points.length - 1].i + 1}</text>
    </svg>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--c-fg-muted)" }}>
      <span style={{ width: 14, height: 2, background: color, borderRadius: 1 }} />
      <span>{label}</span>
    </div>
  )
}

function formatShort(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  return `${sign}$${Math.round(abs)}`
}
