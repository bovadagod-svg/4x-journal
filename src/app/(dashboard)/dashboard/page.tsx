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
import { TodayPlanCard } from "@/components/dashboard/today-plan-card"
import { WeeklyRetrospectiveCard } from "@/components/dashboard/weekly-retrospective-card"
import { LogTradeButton } from "@/components/trades/log-trade-button"
import { RangeFilterBar } from "@/components/shell/range-filter-bar"
import { parseRangeSelection, rangeBoundsIso, rangeLabel } from "@/lib/range"
import { DashboardModeToggle } from "@/components/dashboard/dashboard-mode-toggle"
import { getDashboardMode, resolveDashboardMode } from "@/lib/dashboard-mode"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const m = SECTION_META.dashboard
  const params = await searchParams
  const range = parseRangeSelection({ range: params.range, from: params.from, to: params.to })
  const { from: fromIso, to: toIso } = rangeBoundsIso(range)

  const watchlist = await getWatchlist()
  const watchCurrencies = currenciesFromWatchlist(watchlist)
  const modePref = await getDashboardMode()

  const [pnl, openTrades, recentEntries, recentTrades, equity, stats, pairs, playbooks, events, discipline] = await Promise.all([
    getPnLByPeriod(),                                          // today/week/month — fixed buckets, ignores range
    getOpenTrades(),                                           // current open positions — always live
    getJournalEntries({ limit: 5 }),                           // 5 most recent — always recent
    getUserTrades({ limit: 200, from: fromIso, to: toIso }),   // history list — respects range
    getEquityCurve({ from: fromIso, to: toIso }),              // equity curve — respects range
    getOverallStats({ from: fromIso, to: toIso }),             // KPI stats + Coach AI — respects range
    getPairPerformance({ from: fromIso, to: toIso }),          // analytics summary — respects range
    getPlaybooksWithStats(),                                   // overall playbook stats
    getUpcomingEvents({ currencies: watchCurrencies.length > 0 ? watchCurrencies : undefined, limit: 8 }),
    getDisciplineStats(),
  ])

  // Effective mode: in auto, lite when sample is below 50 closed trades.
  // Lite mode hides advanced widgets that need bigger samples to be useful.
  const closedCount = recentTrades.filter((t) => t.status === "closed").length
  const mode = resolveDashboardMode(modePref, closedCount)
  const showAdvanced = mode === "full"

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={`${m.subtitle} · ${rangeLabel(range)}`}
        actions={<>
          <DashboardModeToggle current={modePref} effective={mode} />
          <RangeFilterBar />
          <LogTradeButton />
        </>}
      />

      <ScopeBanner />

      <TickerTape />

      {showAdvanced && <CoachNudge stats={stats} />}

      {showAdvanced && <WeeklyRetrospectiveCard />}

      <PnLStrip today={pnl.today} week={pnl.week} month={pnl.month} />

      <TodayPlanCard />

      {showAdvanced && <CorrelationWarning />}

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

      {showAdvanced && <AnalyticsSummary stats={stats} pairs={pairs} />}

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
