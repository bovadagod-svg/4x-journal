import { SectionHeader } from "@/components/shell/section-header"
import { SECTION_META } from "@/lib/sections"
import { getOpenTrades, getJournalEntries, getTodayPnL, getUserTrades } from "@/lib/queries/trades"
import { getEquityCurve, getOverallStats } from "@/lib/queries/analytics"
import { getPlaybooksWithStats } from "@/lib/queries/playbooks"
import { currenciesFromWatchlist, getUpcomingEvents, getWatchlist } from "@/lib/queries/watchlist"
import { TickerTape } from "@/components/dashboard/ticker-tape"
import { CoachNudge } from "@/components/dashboard/coach-nudge"
import { ScopeBanner } from "@/components/dashboard/scope-banner"
import { PnLStrip } from "@/components/dashboard/pnl-strip"
import { OpenPositions } from "@/components/dashboard/open-positions"
import { JournalFeed } from "@/components/dashboard/journal-feed"
import { RiskGauge } from "@/components/dashboard/risk-gauge"
import { WatchlistWidget } from "@/components/dashboard/watchlist-widget"
import { RecentTrades } from "@/components/dashboard/recent-trades"
import { EquityCurveCard } from "@/components/dashboard/equity-curve-card"
import { AnalyticsSummary } from "@/components/dashboard/analytics-summary"
import { SessionClock } from "@/components/dashboard/session-clock"
import { PlaybooksCard } from "@/components/dashboard/playbooks-card"
import { CalendarCard } from "@/components/dashboard/calendar-card"
import { LogTradeButton } from "@/components/trades/log-trade-button"

export default async function DashboardPage() {
  const m = SECTION_META.dashboard
  const watchlist = await getWatchlist()
  const watchCurrencies = currenciesFromWatchlist(watchlist)

  const [today, openTrades, recentEntries, recentTrades, equity, stats, playbooks, events] = await Promise.all([
    getTodayPnL(),
    getOpenTrades(),
    getJournalEntries({ limit: 5 }),
    getUserTrades({ limit: 50 }),
    getEquityCurve(),
    getOverallStats(),
    getPlaybooksWithStats(),
    getUpcomingEvents({ currencies: watchCurrencies.length > 0 ? watchCurrencies : undefined, limit: 8 }),
  ])

  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} actions={<LogTradeButton />} />

      <ScopeBanner />

      <TickerTape />

      <CoachNudge stats={stats} />

      <PnLStrip today={today} />

      <div className="grid-2-1">
        <EquityCurveCard points={equity} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--density-gap)" }}>
          <RiskGauge />
          <SessionClock />
        </div>
      </div>

      <OpenPositions trades={openTrades} />

      <RecentTrades trades={recentTrades} />

      <AnalyticsSummary stats={stats} />

      <div className="grid-2-1">
        <JournalFeed entries={recentEntries} trades={recentTrades} />
        <WatchlistWidget />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--density-gap)" }}>
        <PlaybooksCard playbooks={playbooks} />
        <CalendarCard events={events} />
      </div>
    </>
  )
}
