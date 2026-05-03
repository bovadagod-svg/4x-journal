"use client"

import { useMemo, useState } from "react"
import { simulate } from "@/lib/monte-carlo"
import { formatUSD } from "@/lib/finance"

type Stats = {
  count: number
  winRate: number    // percent (0–100)
  rs: number[]
}

const PATHS = 1000

export function MonteCarloCard({ stats, startBalance }: { stats: Stats; startBalance: number }) {
  const baseline = useMemo(() => {
    const wins = stats.rs.filter((r) => r > 0)
    const losses = stats.rs.filter((r) => r < 0)
    if (wins.length === 0 || losses.length === 0) return null
    return {
      winRate: stats.winRate / 100,
      avgWinR: wins.reduce((s, r) => s + r, 0) / wins.length,
      avgLossR: Math.abs(losses.reduce((s, r) => s + r, 0) / losses.length),
    }
  }, [stats])

  const [riskPct, setRiskPct] = useState(0.01)
  const [horizon, setHorizon] = useState(100)

  const result = useMemo(() => {
    if (!baseline) return null
    return simulate({
      winRate: baseline.winRate,
      avgWinR: baseline.avgWinR,
      avgLossR: baseline.avgLossR,
      riskPerTradePct: riskPct,
      startBalance: Math.max(1, startBalance),
      n: horizon,
      paths: PATHS,
      seed: 1,
    })
  }, [baseline, riskPct, horizon, startBalance])

  if (stats.count < 30 || !baseline || !result) {
    return (
      <div className="card">
        <h3 className="card-title">Forward Equity Simulation</h3>
        <p className="card-subtitle">Where 1,000 versions of your edge end up after the next 100 trades</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>
          Need at least 30 closed trades with both wins and losses to forward-simulate.
          {stats.count < 30 ? ` You have ${stats.count}.` : ""}
        </p>
      </div>
    )
  }

  const { p05, p25, p50, p75, p95 } = result.percentiles
  const e = result.endingStats
  const start = Math.max(1, startBalance)

  const W = 760
  const H = 220
  const padX = 8
  const padY = 14
  const yMin = Math.min(start, ...p05)
  const yMax = Math.max(start, ...p95)
  const range = yMax - yMin || 1
  const stepX = (W - padX * 2) / horizon
  const xFor = (i: number) => padX + i * stepX
  const yFor = (v: number) => H - padY - ((v - yMin) / range) * (H - padY * 2)

  const bandPath = (lo: number[], hi: number[]) => {
    const top = hi.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ")
    const bot = lo.map((v, i) => `L${xFor(lo.length - 1 - i).toFixed(1)},${yFor(lo[lo.length - 1 - i]).toFixed(1)}`).join(" ")
    return `${top} ${bot} Z`
  }
  const linePath = (vs: number[]) => vs.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ")
  const startY = yFor(start)

  // Pick a tone from the median trajectory.
  const medianEnd = p50[horizon]
  const tone = medianEnd >= start ? "up" : "down"
  const lineStroke = tone === "up" ? "var(--c-green-bright)" : "var(--c-red-bright)"
  const fillOuter = tone === "up" ? "rgba(45, 219, 115, 0.10)" : "rgba(224, 74, 85, 0.10)"
  const fillInner = tone === "up" ? "rgba(45, 219, 115, 0.20)" : "rgba(224, 74, 85, 0.20)"

  const gridLines = 4

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="card-title">Forward Equity Simulation</h3>
          <p className="card-subtitle">
            {PATHS.toLocaleString()} Monte Carlo paths · sized off your actual {stats.count} trade sample · starting balance {formatUSD(start)}
          </p>
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 14 }}>
        <SliderField
          label="Risk per trade"
          value={`${(riskPct * 100).toFixed(2)}%`}
          min={0.001} max={0.05} step={0.001}
          numericValue={riskPct}
          onChange={setRiskPct}
          subLeft="0.1%"
          subRight="5%"
        />
        <SliderField
          label="Horizon"
          value={`${horizon} trades`}
          min={50} max={500} step={10}
          numericValue={horizon}
          onChange={setHorizon}
          subLeft="50"
          subRight="500"
        />
      </div>

      {/* Fan chart */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Monte Carlo equity simulation">
        {Array.from({ length: gridLines + 1 }).map((_, i) => (
          <line
            key={i}
            x1={padX}
            x2={W - padX}
            y1={padY + ((H - padY * 2) / gridLines) * i}
            y2={padY + ((H - padY * 2) / gridLines) * i}
            stroke="var(--c-border)"
            strokeDasharray="2 4"
          />
        ))}
        <line x1={padX} x2={W - padX} y1={startY} y2={startY} stroke="var(--c-fg-dim)" strokeDasharray="3 3" strokeWidth={1} />
        <path d={bandPath(p05, p95)} fill={fillOuter} />
        <path d={bandPath(p25, p75)} fill={fillInner} />
        <path d={linePath(p50)} fill="none" stroke={lineStroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
        <span>Trade 0</span>
        <span>Trade {Math.floor(horizon / 2)}</span>
        <span>Trade {horizon}</span>
      </div>

      {/* Endpoint distribution */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginTop: 14 }}>
        <EndpointCell label="5th percentile" value={e.p05} start={start} highlight="bad" />
        <EndpointCell label="25th" value={e.p25} start={start} />
        <EndpointCell label="Median" value={e.p50} start={start} highlight="median" />
        <EndpointCell label="75th" value={e.p75} start={start} />
        <EndpointCell label="95th percentile" value={e.p95} start={start} highlight="good" />
      </div>

      <p style={{ marginTop: 12, fontSize: 11.5, color: "var(--c-fg-dim)", lineHeight: 1.5 }}>
        Each percentile says: out of 1,000 simulated futures with your stats, that many ended at or below the value shown.
        Median is the typical outcome; 5th–95th are the bad-luck and good-luck tails.
      </p>
    </div>
  )
}

function EndpointCell({
  label, value, start, highlight,
}: {
  label: string
  value: number
  start: number
  highlight?: "good" | "bad" | "median"
}) {
  const delta = value - start
  const pct = (delta / start) * 100
  const color = highlight === "bad" ? "var(--c-red-bright)"
    : highlight === "good" ? "var(--c-green-bright)"
    : highlight === "median" ? (delta >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)")
    : delta >= 0 ? "var(--c-fg)" : "var(--c-fg-muted)"
  const border = highlight === "median" ? `1px solid ${color}55` : "1px solid var(--c-border)"
  return (
    <div style={{
      background: "var(--c-bg-elev-2)",
      border,
      borderRadius: 8,
      padding: 12,
    }}>
      <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, marginTop: 2 }}>
        {formatUSD(value)}
      </div>
      <div className="tnum" style={{ fontSize: 11, color, marginTop: 1 }}>
        {delta >= 0 ? "+" : ""}{pct.toFixed(1)}%
      </div>
    </div>
  )
}

function SliderField({
  label, value, min, max, step, numericValue, onChange, subLeft, subRight,
}: {
  label: string
  value: string
  min: number
  max: number
  step: number
  numericValue: number
  onChange: (v: number) => void
  subLeft: string
  subRight: string
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        <span className="tnum" style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numericValue}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--c-accent)" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--c-fg-dim)" }}>
        <span>{subLeft}</span>
        <span>{subRight}</span>
      </div>
    </div>
  )
}
