"use client"

import { useMemo } from "react"
import { Icon, PairFlag } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import { isWin, isLoss, winRatePct } from "@/lib/outcome"
import { CumulativeCurve } from "./cumulative-curve"
import { StopTargetAnalysis } from "./stop-target-analysis"
import { HoldTimeAnalysis } from "./hold-time-analysis"
import { MoodAnalysis } from "./mood-analysis"
import { RiskSizingAnalysis } from "./risk-sizing-analysis"
import { DrawdownAnalysis } from "./drawdown-analysis"
import { MonthlyComparison } from "./monthly-comparison"
import { SessionAnalysis } from "./session-analysis"
import { PairSideMatrix } from "./pair-side-matrix"
import { RuleBreakImpact } from "./rule-break-impact"
import { CalendarHeatmap } from "./calendar-heatmap"
import { ScaleOutAnalysis } from "./scale-out-analysis"
import { StopModifyBehavior } from "./stop-modify-behavior"
import { SlippageAnalysis } from "./slippage-analysis"
import { FeeBleed } from "./fee-bleed"
import { EdgeErosion } from "./edge-erosion"
import { MaeMfeCard } from "./mae-mfe-card"
import { StreakAwarePerf } from "./streak-aware-perf"
import { TimeToResolution } from "./time-to-resolution"
import { UnderwaterCurve } from "./underwater-curve"
import { RiskAdjustedMetrics } from "./risk-adjusted-metrics"
import { RevengeDetector } from "./revenge-detector"
import { RiskOfRuinCard } from "./risk-of-ruin-card"
import { MonteCarloCard } from "./monte-carlo-card"
import type { Trade, JournalEntry } from "@/lib/queries/trades"
import type { TradeFill } from "@/lib/queries/trade-fills"

export function AnalyticsView({
  trades,
  last12moTrades,
  entriesByTrade,
  prevEntries,
  playbookMap,
  accountMap,
  fillsByTrade,
  simStartBalance,
  filtersActive = false,
  onClearFilters,
}: {
  trades: Trade[]
  /** Fixed last-12-months window for the Monthly P&L + Daily heatmap, which
   * always span 12 months regardless of the page range filter. */
  last12moTrades?: Trade[]
  entriesByTrade: Map<string, JournalEntry>
  prevEntries?: JournalEntry[]
  playbookMap: Map<string, string>
  accountMap: Map<string, string>
  fillsByTrade: Map<string, TradeFill[]>
  simStartBalance: number
  /** True when one or more categorical filters are constraining the trade set
   * (drives the count copy and the empty-state). */
  filtersActive?: boolean
  onClearFilters?: () => void
}) {
  // The page-level RangeFilterBar drives the date window via URL params,
  // so the `trades` prop is already scoped to the user's chosen range.
  // Closed trades only — analytics are meaningless for open positions.
  const filtered = useMemo(() => trades.filter((t) => t.status === "closed"), [trades])
  // The two "last 12 months" widgets ignore the range filter.
  const yearClosed = useMemo(
    () => (last12moTrades ?? trades).filter((t) => t.status === "closed"),
    [last12moTrades, trades],
  )
  const stats = useMemo(() => agg(filtered), [filtered])

  // Filters can narrow the set to nothing — short-circuit with a friendly
  // prompt instead of rendering a page full of empty cards.
  if (filtered.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "36px 20px" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--c-purple-soft)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
          <Icon name="filter" size={18} color="var(--c-purple-bright)" />
        </div>
        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>
          No closed trades match these filters
        </h3>
        <p style={{ margin: "6px auto 0", maxWidth: 420, fontSize: 13, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
          Nothing in the current range fits the selected Pair / Playbook / Result / Side / Account / Session. Loosen or clear the filters to see your analytics.
        </p>
        {filtersActive && onClearFilters && (
          <button className="btn" style={{ marginTop: 14, fontSize: 12 }} onClick={onClearFilters}>
            <Icon name="x" size={12} /> Clear filters
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="card-subtitle" style={{ marginLeft: 4 }}>
        {filtered.length} closed trade{filtered.length === 1 ? "" : "s"} {filtersActive ? "match your filters" : "in this range"}
      </div>

      {/* Plain-English review — read it at a glance, then dig into the cards */}
      <PlainEnglishReview stats={stats} trades={filtered} />

      {/* KPIs */}
      <KPIGrid stats={stats} />

      {/* Cumulative curve */}
      <CumulativeCurve values={filtered.length >= 2 ? cumulate(filtered) : []} />

      {/* Edge erosion — rolling-window WR + expectancy lines */}
      <EdgeErosion trades={filtered} />

      {/* Coach insights */}
      <CoachInsights trades={filtered} entriesByTrade={entriesByTrade} playbookMap={playbookMap} />

      {/* Stop-Loss & Take-Profit deep dive */}
      <StopTargetAnalysis trades={filtered} />

      {/* MAE / MFE — needs Polygon backfill */}
      <MaeMfeCard trades={filtered} />

      {/* Stop-modify behavior — needs broker lifecycle_events */}
      <StopModifyBehavior trades={filtered} />

      {/* Scale-out analysis — relies on trade_fills */}
      <ScaleOutAnalysis trades={filtered} fillsByTrade={fillsByTrade} />

      {/* Hold-time + Mood */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
        <HoldTimeAnalysis trades={filtered} />
        <MoodAnalysis trades={filtered} />
      </div>

      {/* Time-to-resolution distribution — winners vs losers */}
      <TimeToResolution trades={filtered} />

      {/* Streak-aware perf + Revenge detector — both behavioral, both off chronological data */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
        <StreakAwarePerf trades={filtered} />
        <RevengeDetector trades={filtered} />
      </div>

      {/* Risk sizing + Drawdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
        <RiskSizingAnalysis trades={filtered} />
        <DrawdownAnalysis trades={filtered} />
      </div>

      {/* Underwater curve — % below peak through time */}
      <UnderwaterCurve trades={filtered} />

      {/* Risk-adjusted ratios */}
      <RiskAdjustedMetrics trades={filtered} />

      {/* Risk-of-Ruin + Forward equity simulation — paired math cards.
          Both Monte Carlo, both derived from the same closed-trade stats. */}
      <RiskOfRuinCard stats={stats} />
      <MonteCarloCard stats={stats} startBalance={simStartBalance} />

      {/* Session edge + Pair × Side matrix */}
      <SessionAnalysis trades={filtered} />
      <PairSideMatrix trades={filtered} />

      {/* Rule-break impact (uses journal entries) */}
      <RuleBreakImpact trades={filtered} entriesByTrade={entriesByTrade} prevEntries={prevEntries} />

      {/* Monthly comparison — respects the range; widen to All for lifetime view */}
      <MonthlyComparison trades={yearClosed} />

      {/* Calendar heatmap — respects the range; widen to All for lifetime view */}
      <CalendarHeatmap trades={yearClosed} />

      {/* Pair + Setup breakdowns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
        <BreakdownBars title="By Pair" subtitle="Which instruments produce edge" groups={byPair(filtered)} pairFlags />
        <BreakdownBars title="By Setup" subtitle="Which playbooks are paying off" groups={bySetup(filtered, playbookMap)} />
      </div>

      {/* Side + Account breakdowns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
        <BreakdownBars title="By Side" subtitle="Long vs short edge" groups={bySide(filtered)} />
        <BreakdownBars title="By Account" subtitle="Performance per connected broker" groups={byAccount(filtered, accountMap)} />
      </div>

      {/* Order-type breakdown — needs broker-synced order_type on entry fills */}
      <OrderTypeBreakdown trades={filtered} fillsByTrade={fillsByTrade} />

      {/* Algo (magic number) vs manual — only renders when broker carried magic numbers */}
      <AlgoVsManualBreakdown trades={filtered} fillsByTrade={fillsByTrade} />

      {/* Slippage analysis — needs broker-synced request_price on fills */}
      <SlippageAnalysis trades={filtered} fillsByTrade={fillsByTrade} />

      {/* Fee bleed — commission/swap/tax aggregate, swap by day-of-week */}
      <FeeBleed fillsByTrade={fillsByTrade} />

      {/* Day-of-week × hour heatmap */}
      <DayHourGrid trades={filtered} />

      {/* R-distribution + Streaks */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
        <RDistribution trades={filtered} />
        <StreakCard trades={filtered} entriesByTrade={entriesByTrade} />
      </div>
    </>
  )
}

// ── KPI grid ──────────────────────────────────────────────────────────────
/**
 * Plain-English summary of the current (range-filtered) analytics — a short
 * paragraph the user can read at a glance before digging into the cards.
 * Deterministic (no API), so it always renders.
 */
function PlainEnglishReview({ stats, trades }: { stats: AggStats; trades: Trade[] }) {
  const review = useMemo(() => buildReview(stats, trades), [stats, trades])
  if (!review) return null
  return (
    <div
      className="card"
      style={{
        background: "linear-gradient(135deg, rgba(67, 18, 160, 0.14), rgba(105, 50, 212, 0.04))",
        border: "1px solid rgba(105, 50, 212, 0.28)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon name="sparkle" size={14} color="var(--c-purple-bright)" />
        <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600 }}>In plain English</span>
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--c-fg-muted)" }}>{review}</p>
    </div>
  )
}

function buildReview(s: AggStats, trades: Trade[]): React.ReactNode {
  if (s.count === 0) return null
  const fg = (t: React.ReactNode) => <strong style={{ color: "var(--c-fg)" }}>{t}</strong>
  const money = (n: number) => <strong style={{ color: n > 0 ? "var(--c-green-bright)" : n < 0 ? "var(--c-red-bright)" : "var(--c-fg)" }}>{formatUSD(n, { signed: true })}</strong>

  // Pair + side breakdowns (by summed P&L).
  const pairMap = new Map<string, number>()
  for (const t of trades) pairMap.set(t.pair, (pairMap.get(t.pair) ?? 0) + (Number(t.pnl) || 0))
  const pairs = [...pairMap.entries()].map(([pair, pnl]) => ({ pair, pnl })).sort((a, b) => b.pnl - a.pnl)
  const bestPair = pairs[0]
  const worstPair = pairs[pairs.length - 1]

  const longs = trades.filter((t) => t.side === "long")
  const shorts = trades.filter((t) => t.side === "short")
  const sidePnl = (ts: Trade[]) => ts.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0)
  const sideWR = (ts: Trade[]) => {
    const w = ts.filter((t) => isWin(Number(t.pnl))).length
    const l = ts.filter((t) => isLoss(Number(t.pnl))).length
    return winRatePct(w, l) ?? 0
  }

  const sorted = [...trades].sort((a, b) => (Number(b.pnl) || 0) - (Number(a.pnl) || 0))
  const biggestLoss = Number(sorted[sorted.length - 1]?.pnl) || 0

  const profitable = s.pnl > 0
  const rr = s.avgLoss > 0 ? s.avgWin / s.avgLoss : null
  const parts: React.ReactNode[] = []

  // 1. Headline performance.
  parts.push(
    <span key="overall">
      Over {fg(s.count)} closed trade{s.count === 1 ? "" : "s"} in this range you&apos;re {money(s.pnl)} — {profitable ? "in the green" : s.pnl < 0 ? "underwater" : "flat"} — winning {fg(`${Math.round(s.winRate)}%`)} of them.{" "}
    </span>,
  )

  // 2. Edge quality (profit factor + expectancy).
  if (s.pf >= 1.2) {
    parts.push(<span key="edge">The edge is real: a profit factor of {fg(s.pf.toFixed(2))} and {money(s.expectancy)} expected per trade.{" "}</span>)
  } else if (s.pf >= 1) {
    parts.push(<span key="edge">You&apos;re marginally ahead — profit factor {fg(s.pf.toFixed(2))}, about {money(s.expectancy)} per trade — so consistency matters more than size right now.{" "}</span>)
  } else {
    parts.push(<span key="edge">The math is upside-down: profit factor {fg(s.pf.toFixed(2))} (under 1.0) and {money(s.expectancy)} per trade on average.{" "}</span>)
  }

  // 3. Reward-to-risk shape.
  if (rr != null && s.avgWin > 0 && s.avgLoss > 0) {
    parts.push(
      <span key="rr">
        Your average win ({money(s.avgWin)}) is {rr >= 1 ? "larger" : "smaller"} than your average loss ({money(-s.avgLoss)}), roughly {fg(`${rr.toFixed(1)}:1`)}{rr < 1 ? `, so you need a high hit-rate to stay positive` : ""}.{" "}
      </span>,
    )
  }

  // 4. Where the edge lives.
  if (bestPair && bestPair.pnl > 0) {
    parts.push(<span key="best">Your strongest instrument is {fg(bestPair.pair)} at {money(bestPair.pnl)}.{" "}</span>)
  } else if (longs.length >= 3 && shorts.length >= 3) {
    const longBetter = sidePnl(longs) >= sidePnl(shorts)
    parts.push(<span key="side">Your {fg(longBetter ? "longs" : "shorts")} are doing the heavy lifting ({fg(`${longBetter ? sideWR(longs) : sideWR(shorts)}% WR`)}).{" "}</span>)
  }

  // 5. The leak to watch.
  if (worstPair && worstPair.pnl < 0 && worstPair.pair !== bestPair?.pair) {
    parts.push(<span key="worst">The biggest drag is {fg(worstPair.pair)} at {money(worstPair.pnl)} — worth a closer look below.{" "}</span>)
  } else if (longs.length >= 3 && shorts.length >= 3) {
    const weak = sideWR(longs) <= sideWR(shorts) ? "longs" : "shorts"
    const weakWR = weak === "longs" ? sideWR(longs) : sideWR(shorts)
    if (weakWR < 40) parts.push(<span key="weak">Keep an eye on your {fg(weak)} — only {fg(`${weakWR}%`)} are working out.{" "}</span>)
  }

  // 6. Tail-risk nudge when one loss dominates.
  if (biggestLoss < 0 && s.avgLoss > 0 && Math.abs(biggestLoss) > s.avgLoss * 2.5) {
    parts.push(<span key="tail">One outlier loss of {money(biggestLoss)} is skewing the picture — check your position sizing for consistency.</span>)
  }

  return <>{parts}</>
}

function KPIGrid({ stats }: { stats: AggStats }) {
  const sharpe =
    stats.count >= 5 && stats.rs.length > 0
      ? (() => {
          const mean = stats.rs.reduce((s, x) => s + x, 0) / stats.rs.length
          const variance = stats.rs.reduce((s, x) => s + (x - mean) ** 2, 0) / stats.rs.length
          const stdev = Math.sqrt(variance)
          return stdev > 0 ? Number((mean / stdev).toFixed(2)) : null
        })()
      : null

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
      <KPI label="Net P&L" value={formatUSD(stats.pnl, { signed: true })} sub="in this range" color={stats.pnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)"} />
      <KPI label="Win Rate" value={stats.count > 0 ? `${Math.round(stats.winRate)}%` : "—"} sub={stats.count > 0 ? `${stats.wins}W / ${stats.losses}L` : "no trades"} />
      <KPI label="Profit Factor" value={stats.count > 0 ? stats.pf.toFixed(2) : "—"} sub={stats.pf >= 1.5 ? "healthy" : stats.count === 0 ? "—" : "below target"} tone={stats.pf >= 1.5 ? "good" : stats.count === 0 ? undefined : "bad"} color="var(--c-purple-bright)" />
      <KPI label="Expectancy" value={stats.count > 0 ? formatUSD(stats.expectancy, { signed: true }) : "—"} sub="per trade" />
      <KPI label="Avg R" value={stats.count > 0 ? `${stats.avgR > 0 ? "+" : ""}${stats.avgR.toFixed(2)}R` : "—"} sub={stats.avgWin > 0 && stats.avgLoss > 0 ? `avg win ${(stats.avgWin / stats.avgLoss).toFixed(2)}× avg loss` : ""} />
      <KPI label="Sharpe (R-based)" value={sharpe != null ? sharpe.toString() : "—"} sub="risk-adjusted" />
    </div>
  )
}

function KPI({ label, value, sub, color, tone }: { label: string; value: string; sub?: string; color?: string; tone?: "good" | "bad" }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 4, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: tone === "good" ? "var(--c-green-bright)" : tone === "bad" ? "var(--c-red-bright)" : "var(--c-fg-dim)", marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Coach insights ────────────────────────────────────────────────────────
function CoachInsights({ trades, entriesByTrade, playbookMap }: { trades: Trade[]; entriesByTrade: Map<string, JournalEntry>; playbookMap: Map<string, string> }) {
  const pairs = byPair(trades)
  const setups = bySetup(trades, playbookMap).filter((s) => s.count >= 3)

  const bestPair = pairs[0]
  const worstPair = pairs[pairs.length - 1]
  const bestSetup = setups.length > 0 ? [...setups].sort((a, b) => b.expectancy - a.expectancy)[0] : null

  // Rule violations from linked journal entries.
  const violations = trades.filter((t) => entriesByTrade.get(t.id)?.rule_break === true)
  const violationLoss = violations.reduce((s, t) => s + (Number(t.pnl) || 0), 0)

  if (trades.length === 0) {
    return (
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icon name="sparkle" size={16} color="#B79CFF" />
          <h3 className="card-title">Coach AI Insights</h3>
          <span className="chip chip-purple" style={{ fontSize: 10, padding: "1px 7px", marginLeft: "auto" }}>BETA</span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--c-fg-muted)" }}>
          Log a few closed trades and insights will appear here — best pair / worst pair / strongest setup / rule-break cost.
        </p>
      </div>
    )
  }

  type Insight = { icon: "target" | "flag" | "lightning" | "info"; tone: "good" | "bad" | "neutral"; title: string; body: string }
  const insights: Insight[] = [
    {
      icon: "target",
      tone: "good",
      title: bestPair ? `Your edge is ${bestPair.name}` : "No edge data yet",
      body: bestPair
        ? `${bestPair.count} trades · ${Math.round(bestPair.winRate)}% win rate · ${formatUSD(bestPair.pnl, { signed: true })} net. Keep concentrating size here.`
        : "Need more closed trades for pair-level insights.",
    },
    {
      icon: "flag",
      tone: "bad",
      title: worstPair && worstPair !== bestPair ? `Cut exposure to ${worstPair.name}` : "Nothing flagged",
      body: worstPair && worstPair !== bestPair
        ? `${worstPair.count} trades · ${Math.round(worstPair.winRate)}% win rate · ${formatUSD(worstPair.pnl, { signed: true })} net. Either fix the setup or remove from your list.`
        : "Single-pair sample or all pairs trending positive.",
    },
    {
      icon: "lightning",
      tone: "neutral",
      title: bestSetup ? `Best setup: ${bestSetup.name}` : "Setup data thin",
      body: bestSetup
        ? `Expectancy ${formatUSD(bestSetup.expectancy, { signed: true })} per trade · ${bestSetup.pf.toFixed(2)} profit factor over ${bestSetup.count} trades.`
        : "Need 3+ trades per playbook for setup insights.",
    },
    {
      icon: "info",
      tone: violations.length > 0 && violationLoss < -200 ? "bad" : "good",
      title: violations.length > 0
        ? `${violations.length} rule-break trade${violations.length === 1 ? "" : "s"} ${violationLoss < 0 ? "cost" : "earned"} ${formatUSD(Math.abs(violationLoss))}`
        : "No rule breaks logged",
      body: violations.length > 0
        ? violationLoss < 0
          ? "Off-plan trades are a measurable drag. Tag them in real time and review weekly."
          : "Even your off-plan trades held up — but discipline is still the cheapest edge."
        : "Either you're flawless or you haven't tagged journal entries with rule-break flags.",
    },
  ]

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Icon name="sparkle" size={16} color="#B79CFF" />
        <h3 className="card-title">Coach AI Insights</h3>
        <span className="chip chip-purple" style={{ fontSize: 10, padding: "1px 7px", marginLeft: "auto" }}>BETA</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{
            background: "var(--c-bg-elev-2)",
            border: `1px solid ${ins.tone === "good" ? "rgba(17, 196, 88, 0.25)" : ins.tone === "bad" ? "rgba(190, 51, 61, 0.25)" : "var(--c-border)"}`,
            borderRadius: 10,
            padding: 12,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: ins.tone === "good" ? "var(--c-green-soft)" : ins.tone === "bad" ? "var(--c-red-soft)" : "var(--c-purple-soft)",
              display: "grid", placeItems: "center",
            }}>
              <Icon name={ins.icon} size={16} color={ins.tone === "good" ? "var(--c-green-bright)" : ins.tone === "bad" ? "var(--c-red-bright)" : "#B79CFF"} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{ins.title}</div>
              <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.45 }}>{ins.body}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Breakdown bars ────────────────────────────────────────────────────────
type BreakdownGroup = { name: string; count: number; pnl: number; winRate: number; pf: number; expectancy: number; avgR: number }

function BreakdownBars({ title, subtitle, groups, pairFlags }: { title: string; subtitle: string; groups: BreakdownGroup[]; pairFlags?: boolean }) {
  if (groups.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">{title}</h3>
        <p className="card-subtitle">{subtitle}</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>No data in range.</p>
      </div>
    )
  }
  const max = Math.max(...groups.map((g) => Math.abs(g.pnl)), 1)
  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">{title}</h3>
        <p className="card-subtitle">{subtitle}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {groups.map((g) => {
          const wPct = (Math.abs(g.pnl) / max) * 100
          return (
            <div key={g.name} style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 80px", gap: 10, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                {pairFlags && <PairFlag pair={g.name} size={14} />}
                <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</span>
              </div>
              <div style={{ position: "relative", height: 22, background: "var(--c-bg-elev-3)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  position: "absolute", inset: 0, width: `${wPct}%`,
                  background: g.pnl >= 0
                    ? "linear-gradient(90deg, rgba(17, 196, 88, 0.35), rgba(17, 196, 88, 0.7))"
                    : "linear-gradient(90deg, rgba(190, 51, 61, 0.35), rgba(190, 51, 61, 0.7))",
                  borderRadius: 4,
                }} />
              </div>
              <span className="tnum" style={{ fontSize: 11.5, color: "var(--c-fg-muted)", textAlign: "right" }}>
                {g.count}t · {Math.round(g.winRate)}%
              </span>
              <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, textAlign: "right", color: g.pnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                {formatUSD(g.pnl, { signed: true })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Order-type breakdown ──────────────────────────────────────────────────
function OrderTypeBreakdown({
  trades, fillsByTrade,
}: {
  trades: Trade[]
  fillsByTrade: Map<string, TradeFill[]>
}) {
  const groups = useMemo(() => byOrderType(trades, fillsByTrade), [trades, fillsByTrade])
  const totalTagged = groups.reduce((s, g) => s + g.count, 0)

  if (totalTagged < 5) {
    return (
      <div className="card">
        <h3 className="card-title">By Order Type</h3>
        <p className="card-subtitle">Market vs limit vs stop edge — patience pays</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>
          Connect TradeLocker to populate order-type breakdowns. Manual entries don&apos;t carry this field.
        </p>
      </div>
    )
  }

  const narrative = orderTypeNarrative(groups)
  return (
    <BreakdownBars
      title="By Order Type"
      subtitle={narrative ?? "Market vs limit vs stop edge — patience pays"}
      groups={groups}
    />
  )
}

// ── Algo vs Manual breakdown ──────────────────────────────────────────────
// Buckets trades by entry-fill magic_number. Manual = null / "0" / "". Each
// non-trivial magic_number gets its own bucket (label "EA #<number>") so users
// running multiple EAs see them separately. Hides until ≥1 algo bucket exists,
// since the all-manual case duplicates the lifetime KPIs above.
function AlgoVsManualBreakdown({
  trades, fillsByTrade,
}: {
  trades: Trade[]
  fillsByTrade: Map<string, TradeFill[]>
}) {
  const groups = useMemo(() => byMagicNumber(trades, fillsByTrade), [trades, fillsByTrade])
  const algoGroups = groups.filter((g) => g.name !== "Manual")
  const totalTagged = groups.reduce((s, g) => s + g.count, 0)

  // Hide entirely when nothing is algo-tagged — the breakdown adds no signal
  // for a 100%-manual trader.
  if (algoGroups.length === 0 || totalTagged < 5) return null

  const narrative = algoVsManualNarrative(groups)
  return (
    <BreakdownBars
      title="Algo vs Manual"
      subtitle={narrative ?? "Discretionary trades vs. automated entries (by broker magic number)"}
      groups={groups}
    />
  )
}

// ── Day-of-week × Hour heatmap ────────────────────────────────────────────
function DayHourGrid({ trades }: { trades: Trade[] }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
  const cells: Record<string, { count: number; pnl: number }> = {}

  for (const t of trades) {
    if (!t.closed_at) continue
    const d = new Date(t.closed_at)
    const dow = d.getUTCDay()
    if (dow === 0 || dow === 6) continue
    const k = `${dow - 1}:${d.getUTCHours()}`
    if (!cells[k]) cells[k] = { count: 0, pnl: 0 }
    cells[k].count += 1
    cells[k].pnl += Number(t.pnl) || 0
  }
  const max = Math.max(...Object.values(cells).map((c) => Math.abs(c.pnl)), 1)
  const cellColor = (c?: { count: number; pnl: number }) => {
    if (!c || c.count === 0) return "var(--c-bg-elev-3)"
    const i = Math.min(1, Math.abs(c.pnl) / max)
    return c.pnl >= 0 ? `rgba(17, 196, 88, ${0.15 + i * 0.65})` : `rgba(190, 51, 61, ${0.15 + i * 0.65})`
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">When You Trade Best</h3>
        <p className="card-subtitle">P&L by day-of-week × hour (UTC)</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "44px repeat(24, 1fr)", gap: 2, fontSize: 9, fontFamily: "var(--font-mono)" }}>
        <span></span>
        {Array.from({ length: 24 }).map((_, h) => (
          <span key={h} style={{ textAlign: "center", color: "var(--c-fg-dim)" }}>
            {h % 3 === 0 ? h : ""}
          </span>
        ))}
        {days.map((d, di) => (
          <ReactFragment key={d}>
            <span style={{ color: "var(--c-fg-muted)", display: "flex", alignItems: "center", fontSize: 11 }}>{d}</span>
            {Array.from({ length: 24 }).map((_, h) => {
              const c = cells[`${di}:${h}`]
              return (
                <div
                  key={h}
                  title={c
                    ? `${d} ${h}:00 · ${c.count} trade${c.count === 1 ? "" : "s"} · ${formatUSD(c.pnl, { signed: true })}`
                    : `${d} ${h}:00 · no trades`}
                  style={{
                    aspectRatio: "1",
                    background: cellColor(c),
                    borderRadius: 2,
                    border: "1px solid var(--c-border)",
                  }}
                />
              )
            })}
          </ReactFragment>
        ))}
      </div>
    </div>
  )
}

// Tiny fragment shim — using JSX <></> isn't allowed inside grid where each cell needs to be a direct child.
function ReactFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

// ── R distribution ────────────────────────────────────────────────────────
function RDistribution({ trades }: { trades: Trade[] }) {
  const bucketBoundaries = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3]
  const counts = bucketBoundaries.map(() => 0)
  for (const t of trades) {
    const r = Number(t.r) || 0
    let idx = bucketBoundaries.findIndex((b) => r < b + 0.25)
    if (idx === -1) idx = bucketBoundaries.length - 1
    counts[idx] += 1
  }
  const max = Math.max(...counts, 1)

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">R-Multiple Distribution</h3>
        <p className="card-subtitle">How your trades return relative to risk</p>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160, padding: "0 4px" }}>
        {counts.map((c, i) => {
          const isNeg = bucketBoundaries[i] < 0
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: "var(--c-fg-muted)", fontFamily: "var(--font-mono)" }}>{c}</span>
              <div style={{
                width: "100%",
                height: `${(c / max) * 120}px`,
                background: isNeg ? "rgba(190, 51, 61, 0.6)" : "rgba(17, 196, 88, 0.6)",
                borderRadius: "4px 4px 0 0",
                border: `1px solid ${isNeg ? "rgba(190, 51, 61, 0.9)" : "rgba(17, 196, 88, 0.9)"}`,
                borderBottom: "none",
                minHeight: c > 0 ? 4 : 0,
              }} />
              <span style={{ fontSize: 10, color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)" }}>
                {bucketBoundaries[i] >= 3 ? "3R+" : `${bucketBoundaries[i]}R`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Streak card ───────────────────────────────────────────────────────────
function StreakCard({ trades, entriesByTrade }: { trades: Trade[]; entriesByTrade: Map<string, JournalEntry> }) {
  const sorted = [...trades].sort((a, b) => new Date(a.closed_at ?? 0).getTime() - new Date(b.closed_at ?? 0).getTime())
  let curWin = 0, maxWin = 0, curLoss = 0, maxLoss = 0
  for (const t of sorted) {
    const pnl = Number(t.pnl) || 0
    if (isWin(pnl)) { curWin += 1; curLoss = 0; if (curWin > maxWin) maxWin = curWin }
    else if (isLoss(pnl)) { curLoss += 1; curWin = 0; if (curLoss > maxLoss) maxLoss = curLoss }
  }

  // Rule adherence from linked entries
  const linked = trades.map((t) => entriesByTrade.get(t.id)).filter(Boolean) as JournalEntry[]
  const followed = linked.filter((e) => !e.rule_break).length
  const ruleAdherence = linked.length > 0 ? Math.round((followed / linked.length) * 100) : null

  // Mood breakdown
  const byMood: Record<string, { count: number; wins: number; losses: number; pnl: number }> = {}
  for (const t of trades) {
    const m = t.mood ?? "—"
    if (!byMood[m]) byMood[m] = { count: 0, wins: 0, losses: 0, pnl: 0 }
    byMood[m].count += 1
    const pnl = Number(t.pnl) || 0
    byMood[m].pnl += pnl
    if (isWin(pnl)) byMood[m].wins += 1
    else if (isLoss(pnl)) byMood[m].losses += 1
  }
  const moodStats = Object.entries(byMood)
    .map(([mood, m]) => ({ mood, count: m.count, pnl: m.pnl, winRate: winRatePct(m.wins, m.losses) ?? 0 }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Discipline & Streaks</h3>
        <p className="card-subtitle">Mindset correlates with outcome</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
        <SubStat label="Best Streak" value={String(maxWin)} sub="consecutive wins" color="var(--c-green-bright)" />
        <SubStat label="Worst Streak" value={String(maxLoss)} sub="consecutive losses" color="var(--c-red-bright)" />
        <SubStat label="Rule Adherence" value={ruleAdherence != null ? `${ruleAdherence}%` : "—"} sub={ruleAdherence != null ? `${followed} of ${linked.length}` : "no entries"} color="var(--c-purple-bright)" />
      </div>

      {moodStats.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>P&L by Mood</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {moodStats.map((m) => (
              <div key={m.mood} style={{ display: "grid", gridTemplateColumns: "90px 1fr 60px 80px", gap: 10, alignItems: "center", fontSize: 12 }}>
                <span style={{ textTransform: "capitalize", color: "var(--c-fg)" }}>{m.mood}</span>
                <div style={{ position: "relative", height: 14, background: "var(--c-bg-elev-3)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    position: "absolute", inset: 0,
                    width: `${Math.min(100, m.winRate)}%`,
                    background: m.pnl >= 0 ? "rgba(17, 196, 88, 0.6)" : "rgba(190, 51, 61, 0.6)",
                  }} />
                </div>
                <span className="tnum" style={{ fontSize: 11, color: "var(--c-fg-muted)", textAlign: "right" }}>{Math.round(m.winRate)}%</span>
                <span className="tnum" style={{ fontSize: 12, fontWeight: 600, textAlign: "right", color: m.pnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                  {formatUSD(m.pnl, { signed: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SubStat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 22, fontWeight: 600, color, fontFamily: "var(--font-display)" }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{sub}</div>
    </div>
  )
}

// ── Aggregation helpers ───────────────────────────────────────────────────
type AggStats = {
  count: number
  wins: number
  losses: number
  pnl: number
  winRate: number
  avgR: number
  pf: number
  expectancy: number
  avgWin: number
  avgLoss: number
  rs: number[]
}

function agg(trades: Trade[]): AggStats {
  const empty: AggStats = { count: 0, wins: 0, losses: 0, pnl: 0, winRate: 0, avgR: 0, pf: 0, expectancy: 0, avgWin: 0, avgLoss: 0, rs: [] }
  if (trades.length === 0) return empty

  const wins = trades.filter((t) => isWin(Number(t.pnl)))
  const losses = trades.filter((t) => isLoss(Number(t.pnl)))
  const pnl = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  const grossWin = wins.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (Number(t.pnl) || 0), 0))
  const winRate = winRatePct(wins.length, losses.length) ?? 0
  const avgR = trades.reduce((s, t) => s + (Number(t.r) || 0), 0) / trades.length
  const pf = grossLoss > 0 ? grossWin / grossLoss : grossWin
  const avgWin = wins.length > 0 ? grossWin / wins.length : 0
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss

  return {
    count: trades.length,
    wins: wins.length,
    losses: losses.length,
    pnl,
    winRate,
    avgR,
    pf,
    expectancy,
    avgWin,
    avgLoss,
    rs: trades.map((t) => Number(t.r) || 0),
  }
}

function cumulate(trades: Trade[]): number[] {
  const sorted = [...trades].sort((a, b) => new Date(a.closed_at ?? 0).getTime() - new Date(b.closed_at ?? 0).getTime())
  let sum = 0
  return sorted.map((t) => { sum += Number(t.pnl) || 0; return Number(sum.toFixed(2)) })
}

function byPair(trades: Trade[]): BreakdownGroup[] {
  const map = new Map<string, Trade[]>()
  for (const t of trades) {
    const arr = map.get(t.pair) ?? []
    arr.push(t)
    map.set(t.pair, arr)
  }
  return Array.from(map.entries())
    .map(([name, ts]) => ({ name, ...aggGroup(ts) }))
    .sort((a, b) => b.pnl - a.pnl)
}

function bySetup(trades: Trade[], playbookMap: Map<string, string>): BreakdownGroup[] {
  const map = new Map<string, Trade[]>()
  for (const t of trades) {
    const key = t.playbook_id ? (playbookMap.get(t.playbook_id) ?? "Untagged") : "Untagged"
    const arr = map.get(key) ?? []
    arr.push(t)
    map.set(key, arr)
  }
  return Array.from(map.entries())
    .map(([name, ts]) => ({ name, ...aggGroup(ts) }))
    .sort((a, b) => b.pnl - a.pnl)
}

function bySide(trades: Trade[]): BreakdownGroup[] {
  const map = new Map<string, Trade[]>()
  for (const t of trades) {
    const arr = map.get(t.side) ?? []
    arr.push(t)
    map.set(t.side, arr)
  }
  return Array.from(map.entries())
    .map(([name, ts]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), ...aggGroup(ts) }))
}

function byAccount(trades: Trade[], accountMap: Map<string, string>): BreakdownGroup[] {
  const map = new Map<string, Trade[]>()
  for (const t of trades) {
    const key = accountMap.get(t.account_id) ?? "Unknown"
    const arr = map.get(key) ?? []
    arr.push(t)
    map.set(key, arr)
  }
  return Array.from(map.entries())
    .map(([name, ts]) => ({ name, ...aggGroup(ts) }))
    .sort((a, b) => b.pnl - a.pnl)
}

const ORDER_TYPE_DISPLAY_ORDER = ["Market", "Limit", "Stop", "Other"] as const

function byOrderType(trades: Trade[], fillsByTrade: Map<string, TradeFill[]>): BreakdownGroup[] {
  const map = new Map<string, Trade[]>()
  for (const t of trades) {
    const fills = fillsByTrade.get(t.id) ?? []
    const entryFill = fills.find((f) => f.kind === "entry" && f.order_type) ?? fills.find((f) => f.kind === "entry")
    const raw = entryFill?.order_type
    if (!raw) continue
    const lower = raw.toLowerCase()
    const bucket = lower === "market" ? "Market"
      : lower === "limit" ? "Limit"
      : lower === "stop" ? "Stop"
      : "Other"
    const arr = map.get(bucket) ?? []
    arr.push(t)
    map.set(bucket, arr)
  }
  return ORDER_TYPE_DISPLAY_ORDER
    .filter((k) => map.has(k))
    .map((name) => ({ name, ...aggGroup(map.get(name)!) }))
}

function orderTypeNarrative(groups: BreakdownGroup[]): string | null {
  // Need at least 2 buckets and ≥10pp spread on win-rate to be worth surfacing.
  if (groups.length < 2) return null
  const sorted = [...groups].sort((a, b) => b.winRate - a.winRate)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]
  const delta = best.winRate - worst.winRate
  if (delta < 10) return null
  const note = best.name === "Limit" && worst.name === "Market" ? " Be patient." : ""
  return `Your ${best.name.toLowerCase()} fills win ${Math.round(best.winRate)}% — your ${worst.name.toLowerCase()} fills win ${Math.round(worst.winRate)}%.${note}`
}

function byMagicNumber(trades: Trade[], fillsByTrade: Map<string, TradeFill[]>): BreakdownGroup[] {
  const map = new Map<string, Trade[]>()
  for (const t of trades) {
    const fills = fillsByTrade.get(t.id) ?? []
    const entryFill = fills.find((f) => f.kind === "entry") ?? null
    const raw = entryFill?.magic_number?.trim() ?? ""
    const isManual = raw === "" || raw === "0"
    const bucket = isManual ? "Manual" : `EA #${raw}`
    const arr = map.get(bucket) ?? []
    arr.push(t)
    map.set(bucket, arr)
  }
  // Manual first, then EAs sorted by trade count descending (most-active EA first).
  const manual = map.has("Manual") ? [{ name: "Manual", ...aggGroup(map.get("Manual")!) }] : []
  const eas = Array.from(map.entries())
    .filter(([k]) => k !== "Manual")
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, ts]) => ({ name, ...aggGroup(ts) }))
  return [...manual, ...eas]
}

function algoVsManualNarrative(groups: BreakdownGroup[]): string | null {
  const manual = groups.find((g) => g.name === "Manual")
  const algos = groups.filter((g) => g.name !== "Manual")
  if (algos.length === 0) return null
  // Compare best EA to manual, both need ≥3 trades to be worth a callout.
  const bestAlgo = [...algos].sort((a, b) => b.expectancy - a.expectancy)[0]
  if (bestAlgo.count < 3) return null
  if (!manual || manual.count < 3) {
    return `${bestAlgo.name}: ${Math.round(bestAlgo.winRate)}% WR over ${bestAlgo.count} trades. No manual baseline yet for comparison.`
  }
  const wrGap = bestAlgo.winRate - manual.winRate
  if (Math.abs(wrGap) < 8) return null
  const winner = wrGap > 0 ? bestAlgo : manual
  const loser = wrGap > 0 ? manual : bestAlgo
  return `${winner.name} (${Math.round(winner.winRate)}% WR, ${winner.count} trades) is beating ${loser.name} (${Math.round(loser.winRate)}%) by ${Math.round(Math.abs(wrGap))}pp. Worth concentrating size where the edge actually is.`
}

function aggGroup(ts: Trade[]) {
  const a = agg(ts)
  return { count: a.count, pnl: a.pnl, winRate: a.winRate, pf: a.pf, expectancy: a.expectancy, avgR: a.avgR }
}
