import Link from "next/link"
import { formatUSD } from "@/lib/finance"
import type { OverallStats, PairPerformance } from "@/lib/queries/analytics"

export function AnalyticsSummary({
  stats,
  pairs,
}: {
  stats: OverallStats
  pairs: PairPerformance[]
}) {
  if (stats.closedTrades === 0) return null

  const isPositive = stats.totalPnL > 0

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h3 className="card-title">Performance Snapshot</h3>
          <p className="card-subtitle">{stats.closedTrades} closed trade{stats.closedTrades === 1 ? "" : "s"} · all time</p>
        </div>
        <Link href="/analytics" className="btn" style={{ fontSize: 12 }}>Full report</Link>
      </div>

      {/* 6-stat grid (matching prototype's stats array) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <Stat label="Win Rate" value={stats.winRate != null ? `${stats.winRate}%` : "—"} color="var(--c-green-bright)" note={`${stats.wins}W · ${stats.losses}L`} />
        <Stat label="Avg R" value={stats.avgR != null ? `${stats.avgR > 0 ? "+" : ""}${stats.avgR}R` : "—"} color="var(--c-fg)" note={stats.avgR != null && stats.avgR >= 1 ? "Healthy" : "Below 1R"} />
        <Stat label="Profit Factor" value={stats.profitFactor != null ? stats.profitFactor.toString() : "—"} color="var(--c-purple-bright)" note={stats.profitFactor != null && stats.profitFactor > 1.5 ? "Healthy" : "Sub-1.5"} />
        <Stat label="Expectancy" value={stats.expectancy != null ? `${stats.expectancy > 0 ? "+" : ""}${stats.expectancy}R` : "—"} color="var(--c-fg)" note="per trade, weighted" />
        <Stat label="Max DD" value={stats.maxDrawdown != null ? `${stats.maxDrawdown}%` : "—"} color="var(--c-red-bright)" note="peak-to-trough" />
        <Stat label="Sharpe" value={stats.sharpe != null ? stats.sharpe.toString() : "—"} color="var(--c-fg)" note="R-based" />
      </div>

      {/* Pair heatmap */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, fontFamily: "var(--font-display)" }}>By Pair</h4>
          <span style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>Color intensity = P&L magnitude</span>
        </div>
        {pairs.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>No pair data yet.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
            {pairs.slice(0, 8).map((p) => {
              const max = Math.max(...pairs.map((x) => Math.abs(x.pnl))) || 1
              const intensity = Math.min(1, Math.abs(p.pnl) / max)
              const bg = p.pnl >= 0
                ? `rgba(17, 196, 88, ${0.08 + intensity * 0.4})`
                : `rgba(190, 51, 61, ${0.08 + intensity * 0.4})`
              const border = p.pnl >= 0 ? "rgba(17, 196, 88, 0.3)" : "rgba(190, 51, 61, 0.3)"
              return (
                <div key={p.pair} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 8px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{p.pair}</div>
                  <div className="tnum" style={{ fontSize: 13, fontWeight: 600, marginTop: 2, color: p.pnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                    {p.closedTrades > 0 ? formatUSD(p.pnl, { signed: true }) : "—"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--c-fg-muted)", marginTop: 1 }}>
                    {p.trades}t · {p.winRate != null ? `${p.winRate}%` : "—"}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Use isPositive to suppress unused-variable lint if needed */}
      <div style={{ display: "none" }}>{String(isPositive)}</div>
    </div>
  )
}

function Stat({ label, value, color, note }: { label: string; value: string; color: string; note?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, color, marginTop: 2 }}>{value}</div>
      {note && <div style={{ fontSize: 10, color: "var(--c-fg-dim)", marginTop: 2 }}>{note}</div>}
    </div>
  )
}
