import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { getEquityCurve, getOverallStats, getPairPerformance } from "@/lib/queries/analytics"
import { EquityCurve } from "@/components/analytics/equity-curve"
import { PairHeatmap } from "@/components/analytics/pair-heatmap"
import { formatUSD } from "@/lib/finance"
import { LogTradeButton } from "@/components/trades/log-trade-button"

export default async function AnalyticsPage() {
  const m = SECTION_META.analytics
  const [stats, curve, pairs] = await Promise.all([
    getOverallStats(),
    getEquityCurve(),
    getPairPerformance(),
  ])

  if (stats.closedTrades < 5) {
    return (
      <>
        <SectionHeader title={m.title} subtitle={m.subtitle} actions={<LogTradeButton />} />
        <SectionStub
          icon={m.icon}
          title={`Analytics unlocks at 5 closed trades — you have ${stats.closedTrades}`}
          description="Win rate, profit factor, expectancy, equity curve, and per-pair breakdowns become meaningful once you have a sample. Until then, log + close trades and check back."
        />
      </>
    )
  }

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={`${stats.closedTrades} closed trade${stats.closedTrades === 1 ? "" : "s"} · scope-aware`}
        actions={<LogTradeButton />}
      />

      {/* Top stat grid */}
      <div className="stat-strip">
        <Stat label="Win rate" value={stats.winRate != null ? `${stats.winRate}%` : "—"} sublabel={`${stats.wins}W · ${stats.losses}L · ${stats.breakeven}BE`} />
        <Stat label="Total P&L" value={formatUSD(stats.totalPnL, { signed: true })} sublabel="all closed trades" tone={stats.totalPnL > 0 ? "green" : stats.totalPnL < 0 ? "red" : undefined} />
        <Stat label="Profit factor" value={stats.profitFactor != null ? stats.profitFactor.toString() : "—"} sublabel="wins ÷ |losses|" />
        <Stat label="Expectancy" value={stats.expectancy != null ? `${stats.expectancy > 0 ? "+" : ""}${stats.expectancy}R` : "—"} sublabel="per trade, weighted" tone={stats.expectancy != null && stats.expectancy > 0 ? "green" : stats.expectancy != null && stats.expectancy < 0 ? "red" : undefined} />
      </div>

      <div className="stat-strip">
        <Stat label="Avg R" value={stats.avgR != null ? `${stats.avgR > 0 ? "+" : ""}${stats.avgR}` : "—"} />
        <Stat label="Max drawdown" value={stats.maxDrawdown != null ? `${stats.maxDrawdown}%` : "—"} sublabel="peak-to-trough" tone={stats.maxDrawdown != null && stats.maxDrawdown > 10 ? "red" : undefined} />
        <Stat label="Sharpe (R-based)" value={stats.sharpe != null ? stats.sharpe.toString() : "—"} sublabel="mean R ÷ stdev" />
        <Stat label="Best pair" value={stats.bestPair?.pair ?? "—"} sublabel={stats.bestPair ? formatUSD(stats.bestPair.pnl, { signed: true }) : "—"} tone="green" />
      </div>

      {/* Equity curve */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
          <h3 className="card-title">Equity curve</h3>
          <p className="card-subtitle">Cumulative P&L from closed trades, in time order</p>
        </div>
        <div style={{ padding: 18 }}>
          <EquityCurve points={curve} height={240} />
        </div>
      </div>

      {/* Pair heatmap */}
      <PairHeatmap pairs={pairs} />
    </>
  )
}

function Stat({ label, value, sublabel, tone }: { label: string; value: string; sublabel?: string; tone?: "green" | "red" }) {
  const color = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg)"
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "16px 18px" }}>
      <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</span>
      <div className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color, lineHeight: 1.1 }}>{value}</div>
      {sublabel && <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>{sublabel}</div>}
    </div>
  )
}
