"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { EquityCurve } from "@/components/analytics/equity-curve"
import { formatUSD } from "@/lib/finance"
import type { EquityPoint } from "@/lib/queries/analytics"

const RANGES = ["7D", "30D", "90D", "YTD", "All"] as const
type Range = typeof RANGES[number]

export function EquityCurveCard({ points }: { points: EquityPoint[] }) {
  const [range, setRange] = useState<Range>("30D")

  const filtered = useMemo(() => filterByRange(points, range), [points, range])

  const last = filtered.length > 0 ? filtered[filtered.length - 1].equity : 0
  const first = filtered.length > 0 ? filtered[0].equity : 0
  const periodReturn = last - first
  const tone = last > 0 ? "var(--c-green-bright)" : last < 0 ? "var(--c-red-bright)" : "var(--c-fg)"

  // Peak drawdown within the filtered window
  let peak = filtered[0]?.equity ?? 0
  let maxDD = 0
  for (const p of filtered) {
    if (p.equity > peak) peak = p.equity
    const dd = peak > 0 ? ((peak - p.equity) / peak) * 100 : 0
    if (dd > maxDD) maxDD = dd
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--c-border)", gap: 12 }}>
        <div>
          <h3 className="card-title">Equity Curve</h3>
          <p className="card-subtitle">Cumulative P&L from closed trades</p>
        </div>
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
        <EquityCurve points={filtered} height={200} />
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
