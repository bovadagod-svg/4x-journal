"use client"

import { useMemo, useState } from "react"
import { probabilityOfRuin } from "@/lib/ruin"

type Stats = {
  count: number
  winRate: number   // percent (0–100)
  rs: number[]
}

const THRESHOLDS = [0.25, 0.5, 0.75]
const PATHS = 5000  // enough to stabilize percentiles to ±1pp

export function RiskOfRuinCard({ stats }: { stats: Stats }) {
  // Default to user's actual sample if both wins + losses exist.
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

  const [riskPct, setRiskPct] = useState(0.01)   // 1%
  const [horizon, setHorizon] = useState(100)

  const result = useMemo(() => {
    if (!baseline) return null
    return probabilityOfRuin({
      winRate: baseline.winRate,
      avgWinR: baseline.avgWinR,
      avgLossR: baseline.avgLossR,
      riskPerTradePct: riskPct,
      n: horizon,
      thresholds: THRESHOLDS,
      paths: PATHS,
      seed: 1,  // stable rendering across re-renders at same inputs
    })
  }, [baseline, riskPct, horizon])

  if (stats.count < 30 || !baseline || !result) {
    return (
      <div className="card">
        <h3 className="card-title">Risk of Ruin</h3>
        <p className="card-subtitle">Probability your edge produces a deep drawdown over the next 100 trades</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>
          Need at least 30 closed trades with both wins and losses to compute this.
          {stats.count < 30 ? ` You have ${stats.count}.` : ""}
        </p>
      </div>
    )
  }

  const expectancy = baseline.winRate * baseline.avgWinR - (1 - baseline.winRate) * baseline.avgLossR

  return (
    <div className="card">
      <div style={{ marginBottom: 10 }}>
        <h3 className="card-title">Risk of Ruin</h3>
        <p className="card-subtitle">
          Monte Carlo simulation of {PATHS.toLocaleString()} forward paths · sized off your actual {stats.count} trade sample
        </p>
      </div>

      {/* Inputs row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
        <ReadonlyStat label="Win rate" value={`${(baseline.winRate * 100).toFixed(1)}%`} />
        <ReadonlyStat label="Avg win" value={`${baseline.avgWinR.toFixed(2)}R`} />
        <ReadonlyStat label="Avg loss" value={`${baseline.avgLossR.toFixed(2)}R`} />
        <ReadonlyStat label="Expectancy" value={`${expectancy >= 0 ? "+" : ""}${expectancy.toFixed(2)}R`} color={expectancy >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)"} />
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

      {/* Outputs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        {result.thresholds.map((t) => (
          <DDProbabilityCell key={t.threshold} threshold={t.threshold} probability={t.probability} />
        ))}
        <div style={{
          background: "var(--c-bg-elev-2)",
          border: "1px solid var(--c-border)",
          borderRadius: 8,
          padding: 12,
        }}>
          <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Median ending</div>
          <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, marginTop: 2, color: result.medianEnding >= 1 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
            {result.medianEnding >= 1 ? "+" : ""}{((result.medianEnding - 1) * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: "var(--c-fg-dim)", marginTop: 2 }}>after {horizon} trades</div>
        </div>
      </div>

      <p style={{ marginTop: 12, fontSize: 11.5, color: "var(--c-fg-dim)", lineHeight: 1.5 }}>
        Drawdowns are peak-to-trough on equity. Drag the risk slider to model what happens
        if you size up — the math is unforgiving above ~2% per trade.
      </p>
    </div>
  )
}

function DDProbabilityCell({ threshold, probability }: { threshold: number; probability: number }) {
  const pct = probability * 100
  const color = pct >= 25 ? "var(--c-red-bright)" : pct >= 10 ? "var(--c-amber)" : "var(--c-green-bright)"
  return (
    <div style={{
      background: "var(--c-bg-elev-2)",
      border: "1px solid var(--c-border)",
      borderRadius: 8,
      padding: 12,
    }}>
      <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        P({(threshold * 100).toFixed(0)}% drawdown)
      </div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, marginTop: 2, color }}>
        {pct < 1 ? "<1%" : `${pct.toFixed(0)}%`}
      </div>
      <div style={{ fontSize: 11, color: "var(--c-fg-dim)", marginTop: 2 }}>
        {pct >= 25 ? "likely" : pct >= 10 ? "non-trivial" : pct >= 1 ? "low" : "very low"}
      </div>
    </div>
  )
}

function ReadonlyStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 14, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
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
