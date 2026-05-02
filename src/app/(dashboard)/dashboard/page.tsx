import { SectionHeader } from "@/components/shell/section-header"
import { SECTION_META } from "@/lib/sections"
import { getOpenTrades, getJournalEntries, getTodayPnL, getUserTrades } from "@/lib/queries/trades"
import { PnLStrip } from "@/components/dashboard/pnl-strip"
import { OpenPositions } from "@/components/dashboard/open-positions"
import { JournalFeed } from "@/components/dashboard/journal-feed"
import { RiskGauge } from "@/components/dashboard/risk-gauge"
import { WatchlistWidget } from "@/components/dashboard/watchlist-widget"
import { LogTradeButton } from "@/components/trades/log-trade-button"

export default async function DashboardPage() {
  const m = SECTION_META.dashboard
  const [today, openTrades, recentEntries, recentTrades] = await Promise.all([
    getTodayPnL(),
    getOpenTrades(),
    getJournalEntries({ limit: 5 }),
    getUserTrades({ limit: 50 }),
  ])

  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} actions={<LogTradeButton />} />

      <PnLStrip today={today} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 14 }}>
        <OpenPositions trades={openTrades} />
        <RiskGauge />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 14 }}>
        <JournalFeed entries={recentEntries} trades={recentTrades} />
        <WatchlistWidget />
      </div>
    </>
  )
}
