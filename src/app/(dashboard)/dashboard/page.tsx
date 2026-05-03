import { SectionHeader } from "@/components/shell/section-header"
import { SECTION_META } from "@/lib/sections"
import { getDisciplineStats, getOpenTrades, getJournalEntries, getPnLByPeriod, getUserTrades } from "@/lib/queries/trades"
import { getEquityCurve, getOverallStats, getPairPerformance } from "@/lib/queries/analytics"
import { getPlaybooksWithStats } from "@/lib/queries/playbooks"
import { currenciesFromWatchlist, getUpcomingEvents, getWatchlist } from "@/lib/queries/watchlist"
import { TickerTape } from "@/components/dashboard/ticker-tape"
import { CoachNudge } from "@/components/dashboard/coach-nudge"
import { ScopeBanner } from "@/components/dashboard/scope-banner"
import { PnLStrip } from "@/components/dashboard/pnl-strip"
import { OpenPositions } from "@/components/dashboard/open-positions"
import { LivePnlStrip } from "@/components/dashboard/live-pnl-strip"
import { JournalFeed } from "@/components/dashboard/journal-feed"
import { RiskGauge } from "@/components/dashboard/risk-gauge"
import { MarginCallCard } from "@/components/dashboard/margin-call-card"
import { CorrelationWarning } from "@/components/dashboard/correlation-warning"
import { WatchlistWidget } from "@/components/dashboard/watchlist-widget"
import { RecentTrades } from "@/components/dashboard/recent-trades"
import { EquityCurveCard } from "@/components/dashboard/equity-curve-card"
import { AnalyticsSummary } from "@/components/dashboard/analytics-summary"
import { SessionClock } from "@/components/dashboard/session-clock"
import { PlaybooksCard } from "@/components/dashboard/playbooks-card"
import { CalendarCard } from "@/components/dashboard/calendar-card"
import { MoodCheckIn } from "@/components/dashboard/mood-checkin"
import { PipStatsCard } from "@/components/dashboard/pip-stats-card"
import { StreakCard } from "@/components/dashboard/streak-card"
import { LogTradeButton } from "@/components/trades/log-trade-button"
import { RangeTabs } from "@/components/shell/range-tabs"
import { parseRange, rangeFromIso, rangeLabel } from "@/lib/range"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const m = SECTION_META.dashboard
  const params = await searchParams
  const range = parseRange(params.range)
  const fromIso = rangeFromIso(range)

  const watchlist = await getWatchlist()
  const watchCurrencies = currenciesFromWatchlist(watchlist)

  const [pnl, openTrades, recentEntries, recentTrades, equity, stats, pairs, playbooks, events, discipline] = await Promise.all([
    getPnLByPeriod(),                              // today/week/month — fixed buckets, ignores range
    getOpenTrades(),                               // current open positions — always live
    getJournalEntries({ limit: 5 }),               // 5 most recent — always recent
    getUserTrades({ limit: 200, from: fromIso }),  // history list — respects range
    getEquityCurve({ from: fromIso }),             // equity curve — respects range
    getOverallStats({ from: fromIso }),            // KPI stats + Coach AI — respects range
    getPairPerformance({ from: fromIso }),         // analytics summary — respects range
    getPlaybooksWithStats(),                       // overall playbook stats
    getUpcomingEvents({ currencies: watchCurrencies.length > 0 ? watchCurrencies : undefined, limit: 8 }),
    getDisciplineStats(),
  ])

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={`${m.subtitle} · ${rangeLabel(range)}`}
        actions={<><RangeTabs scope="dashboard analytics" /><LogTradeButton /></>}
      />

      <ScopeBanner />

      <TickerTape />

      <CoachNudge stats={stats} />

      <PnLStrip today={pnl.today} week={pnl.week} month={pnl.month} />

      <CorrelationWarning />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--density-gap)" }}>
        <PipStatsCard trades={recentTrades} />
        <StreakCard trades={recentTrades} periodLabel="recent" />
      </div>

      <div className="grid-2-1">
        <EquityCurveCard points={equity} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--density-gap)" }}>
          <RiskGauge />
          <MarginCallCard />
          <SessionClock />
        </div>
      </div>

      <LivePnlStrip />

      <OpenPositions trades={openTrades} />

      <RecentTrades trades={recentTrades} />

      <AnalyticsSummary stats={stats} pairs={pairs} />

      <div className="grid-2-1">
        <JournalFeed entries={recentEntries} trades={recentTrades} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--density-gap)" }}>
          <MoodCheckIn
            initialMood={discipline.todayMood as never}
            rulesFollowedPct={discipline.rulesFollowedPct}
            streakDays={discipline.streakDays}
          />
          <WatchlistWidget />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--density-gap)" }}>
        <PlaybooksCard playbooks={playbooks} />
        <CalendarCard events={events} />
      </div>
    </>
  )
}
