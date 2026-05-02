import Link from "next/link"
import { formatUSD } from "@/lib/finance"
import type { OverallStats } from "@/lib/queries/analytics"

export function AnalyticsSummary({ stats }: { stats: OverallStats }) {
  if (stats.closedTrades === 0) {
    return null
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h3 className="card-title">Performance summary</h3>
          <p className="card-subtitle">All closed trades · {stats.closedTrades} total</p>
        </div>
        <Link href="/analytics" className="btn" style={{ fontSize: 12 }}>Full analytics</Link>
      </div>

      <div className="stat-strip">
        <Stat label="Win rate" value={stats.winRate != null ? `${stats.winRate}%` : "—"} sub={`${stats.wins}W · ${stats.losses}L`} />
        <Stat
          label="Total P&L"
          value={formatUSD(stats.totalPnL, { signed: true })}
          tone={stats.totalPnL > 0 ? "green" : stats.totalPnL < 0 ? "red" : undefined}
        />
        <Stat label="Profit factor" value={stats.profitFactor != null ? stats.profitFactor.toString() : "—"} sub="wins ÷ |losses|" />
        <Stat
          label="Expectancy"
          value={stats.expectancy != null ? `${stats.expectancy > 0 ? "+" : ""}${stats.expectancy}R` : "—"}
          tone={stats.expectancy != null && stats.expectancy > 0 ? "green" : stats.expectancy != null && stats.expectancy < 0 ? "red" : undefined}
          sub="per trade"
        />
      </div>

      <div className="stat-strip">
        <Stat label="Avg R" value={stats.avgR != null ? `${stats.avgR > 0 ? "+" : ""}${stats.avgR}` : "—"} />
        <Stat
          label="Max DD"
          value={stats.maxDrawdown != null ? `${stats.maxDrawdown}%` : "—"}
          tone={stats.maxDrawdown != null && stats.maxDrawdown > 10 ? "red" : undefined}
          sub="peak-to-trough"
        />
        <Stat label="Sharpe" value={stats.sharpe != null ? stats.sharpe.toString() : "—"} sub="R-based" />
        <Stat
          label="Best pair"
          value={stats.bestPair?.pair ?? "—"}
          tone="green"
          sub={stats.bestPair ? formatUSD(stats.bestPair.pnl, { signed: true }) : ""}
        />
      </div>
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "green" | "red" }) {
  const color = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg)"
  return (
    <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 10, padding: "10px 14px" }}>
      <div style={{ fontSize: 10, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 600, color, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--c-fg-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
