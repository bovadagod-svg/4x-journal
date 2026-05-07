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
import { PropPhaseCard } from "@/components/dashboard/prop-phase-card"
import { CustomizeWidgetsButton } from "@/components/dashboard/customize-widgets-button"
import { parseDashboardLayout, isWidgetVisible } from "@/lib/dashboard-layout"
import { createClient } from "@/lib/supabase/server"
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
  // Per-user widget visibility from user_settings.dashboard_layout (#64).
  const supabase = await createClient()
  const { data: { user: dashUser } } = await supabase.auth.getUser()
  let layout = parseDashboardLayout(null)
  if (dashUser) {
    const { data: row } = await supabase
      .from("user_settings")
      .select("dashboard_layout")
      .eq("user_id", dashUser.id)
      .maybeSingle()
    layout = parseDashboardLayout(row?.dashboard_layout)
  }
  const v = (id: string) => isWidgetVisible(id, layout)

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
          <CustomizeWidgetsButton layout={layout} />
          <DashboardModeToggle current={modePref} effective={mode} />
          <RangeFilterBar />
          <LogTradeButton />
        </>}
      />

      <ScopeBanner />

      {v("ticker-tape") && <TickerTape />}

      {showAdvanced && v("coach-nudge") && <CoachNudge stats={stats} />}

      {showAdvanced && v("weekly-retro") && <WeeklyRetrospectiveCard />}

      {v("pnl-strip") && <PnLStrip today={pnl.today} week={pnl.week} month={pnl.month} />}

      {v("today-plan") && <TodayPlanCard />}

      {v("prop-phase") && <PropPhaseCard />}

      {showAdvanced && v("correlation-warning") && <CorrelationWarning />}

      {(v("pip-stats") || v("streak-card")) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--density-gap)" }}>
          {v("pip-stats") && <PipStatsCard trades={recentTrades} />}
          {v("streak-card") && <StreakCard trades={recentTrades} periodLabel="recent" />}
        </div>
      )}

      {(v("equity-curve") || v("risk-gauge") || v("margin-call") || v("session-clock")) && (
        <div className="grid-2-1">
          {v("equity-curve") && <EquityCurveCard points={equity} />}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--density-gap)" }}>
            {v("risk-gauge") && <RiskGauge />}
            {v("margin-call") && <MarginCallCard />}
            {v("session-clock") && <SessionClock />}
          </div>
        </div>
      )}

      {v("live-pnl") && <LivePnlStrip />}

      {v("open-positions") && <OpenPositions trades={openTrades} />}

      {v("recent-trades") && <RecentTrades trades={recentTrades} />}

      {showAdvanced && v("analytics-summary") && <AnalyticsSummary stats={stats} pairs={pairs} />}

      {(v("journal-feed") || v("mood-checkin") || v("watchlist")) && (
        <div className="grid-2-1">
          {v("journal-feed") && <JournalFeed entries={recentEntries} trades={recentTrades} />}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--density-gap)" }}>
            {v("mood-checkin") && (
              <MoodCheckIn
                initialMood={discipline.todayMood as never}
                rulesFollowedPct={discipline.rulesFollowedPct}
                streakDays={discipline.streakDays}
              />
            )}
            {v("watchlist") && <WatchlistWidget />}
          </div>
        </div>
      )}

      {(v("playbooks-card") || v("calendar-card")) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--density-gap)" }}>
          {v("playbooks-card") && <PlaybooksCard playbooks={playbooks} />}
          {v("calendar-card") && <CalendarCard events={events} />}
        </div>
      )}
    </>
  )
}
