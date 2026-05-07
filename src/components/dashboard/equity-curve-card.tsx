"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { EquityCurve } from "@/components/analytics/equity-curve"
import { formatUSD } from "@/lib/finance"
import { getBenchmarkSeries, type BenchmarkPoint, type BenchmarkSymbol } from "@/lib/actions/benchmark"
import type { EquityPoint } from "@/lib/queries/analytics"

const RANGES = ["7D", "30D", "90D", "YTD", "All"] as const
type Range = typeof RANGES[number]

const BENCHMARK_OPTIONS: Array<{ value: BenchmarkSymbol | "none"; label: string }> = [
  { value: "none", label: "No benchmark" },
  { value: "spx", label: "vs S&P 500" },
  { value: "dxy", label: "vs DXY" },
]

export function EquityCurveCard({ points }: { points: EquityPoint[] }) {
  const [range, setRange] = useState<Range>("30D")
  const [benchmarkChoice, setBenchmarkChoice] = useState<BenchmarkSymbol | "none">("none")
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkPoint[] | null>(null)
  const [benchmarkLabel, setBenchmarkLabel] = useState<string | null>(null)
  const [benchmarkUnavailable, setBenchmarkUnavailable] = useState(false)

  const filtered = useMemo(() => filterByRange(points, range), [points, range])

  const last = filtered.length > 0 ? filtered[filtered.length - 1].equity : 0
  const first = filtered.length > 0 ? filtered[0].equity : 0
  const periodReturn = last - first
  const tone = last > 0 ? "var(--c-green-bright)" : last < 0 ? "var(--c-red-bright)" : "var(--c-fg)"

  let peak = filtered[0]?.equity ?? 0
  let maxDD = 0
  for (const p of filtered) {
    if (p.equity > peak) peak = p.equity
    const dd = peak > 0 ? ((peak - p.equity) / peak) * 100 : 0
    if (dd > maxDD) maxDD = dd
  }

  // Re-fetch benchmark whenever the symbol or range changes.
  useEffect(() => {
    if (benchmarkChoice === "none" || filtered.length < 2) {
      setBenchmarkData(null)
      setBenchmarkLabel(null)
      setBenchmarkUnavailable(false)
      return
    }
    let cancelled = false
    const fromIso = filtered[0].date
    const toIso = filtered[filtered.length - 1].date
    getBenchmarkSeries(benchmarkChoice, fromIso, toIso).then((res) => {
      if (cancelled) return
      if (res.ok) {
        setBenchmarkData(res.points)
        setBenchmarkLabel(res.label)
        setBenchmarkUnavailable(res.points.length < 2)
      } else {
        setBenchmarkData(null)
        setBenchmarkLabel(null)
        setBenchmarkUnavailable(true)
      }
    })
    return () => { cancelled = true }
  }, [benchmarkChoice, filtered])

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--c-border)", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="card-title">Equity Curve</h3>
          <p className="card-subtitle">Cumulative P&L from closed trades · drawdown markers shown</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={benchmarkChoice}
            onChange={(e) => setBenchmarkChoice(e.target.value as BenchmarkSymbol | "none")}
            style={{
              fontSize: 11.5, padding: "4px 8px",
              background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)",
              borderRadius: 6, color: benchmarkChoice === "none" ? "var(--c-fg-muted)" : "var(--c-purple-bright)",
            }}
          >
            {BENCHMARK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <div className="tab-row" style={{ background: "var(--c-bg-elev-2)", padding: 3, borderRadius: 8 }}>
            {RANGES.map((r) => (
              <button
                key={r}
                className={"tab " + (r === range ? "active" : "")}
                onClick={() => setRange(r)}
                style={{ padding: "5px 10px", fontSize: 12 }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, padding: "14px 18px 0", flexWrap: "wrap" }}>
        <Stat label="Net Equity" value={formatUSD(last, { signed: true })} color={tone} />
        <Stat
          label="Period Return"
          value={formatUSD(periodReturn, { signed: true })}
          color={periodReturn > 0 ? "var(--c-green-bright)" : periodReturn < 0 ? "var(--c-red-bright)" : "var(--c-fg)"}
        />
        <Stat
          label="Peak Drawdown"
          value={maxDD > 0 ? `−${maxDD.toFixed(2)}%` : "—"}
          color="var(--c-red-bright)"
        />
        <Link href="/analytics" style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--c-fg-muted)", alignSelf: "center", textDecoration: "none" }}>
          Full breakdown →
        </Link>
      </div>

      <div style={{ padding: 16 }}>
        <EquityCurve points={filtered} height={200} benchmark={benchmarkData} benchmarkLabel={benchmarkLabel} />
        {benchmarkChoice !== "none" && benchmarkUnavailable && (
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--c-fg-dim)" }}>
            Benchmark unavailable — your Polygon plan may not cover {benchmarkChoice.toUpperCase()}, or no bars in this range.
          </div>
        )}
      </div>
    </div>
  )
}

function filterByRange(points: EquityPoint[], range: Range): EquityPoint[] {
  if (range === "All") return points
  const now = Date.now()
  let cutoff: number
  if (range === "YTD") {
    cutoff = new Date(new Date().getFullYear(), 0, 1).getTime()
  } else {
    const days = range === "7D" ? 7 : range === "30D" ? 30 : 90
    cutoff = now - days * 24 * 60 * 60 * 1000
  }
  return points.filter((p) => new Date(p.date).getTime() >= cutoff)
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color, marginTop: 2 }}>{value}</div>
    </div>
  )
}
