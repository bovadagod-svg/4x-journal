import Link from "next/link"
import { EquityCurve } from "@/components/analytics/equity-curve"
import { formatUSD } from "@/lib/finance"
import type { EquityPoint } from "@/lib/queries/analytics"

export function EquityCurveCard({ points }: { points: EquityPoint[] }) {
  const last = points.length > 0 ? points[points.length - 1].equity : 0
  const tone = last > 0 ? "var(--c-green-bright)" : last < 0 ? "var(--c-red-bright)" : "var(--c-fg)"

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
        <div>
          <h3 className="card-title">Equity curve</h3>
          <p className="card-subtitle">Cumulative P&L from closed trades</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600, color: tone }}>
            {points.length > 0 ? formatUSD(last, { signed: true }) : "—"}
          </div>
          <Link href="/analytics" style={{ fontSize: 11, color: "var(--c-fg-muted)", textDecoration: "none" }}>
            Full breakdown →
          </Link>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <EquityCurve points={points} height={180} />
      </div>
    </div>
  )
}
