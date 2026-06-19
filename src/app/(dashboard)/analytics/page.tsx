import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { getJournalEntries, getUserTrades } from "@/lib/queries/trades"
import { getFillsForTrades } from "@/lib/queries/trade-fills"
import { getUserAccounts, getUserPlaybooks } from "@/lib/queries/accounts"
import { LogTradeButton } from "@/components/trades/log-trade-button"
import { AnalyticsView } from "@/components/analytics/analytics-view"
import { TradingCalendar } from "@/components/dashboard/trading-calendar"
import { RangeFilterBar } from "@/components/shell/range-filter-bar"
import { parseRangeSelection, rangeBoundsIso, rangeLabel } from "@/lib/range"

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}) {
  const m = SECTION_META.analytics
  const params = await searchParams
  const range = parseRangeSelection({ range: params.range, from: params.from, to: params.to })
  const { from: fromIso, to: toIso } = rangeBoundsIso(range)

  // Previous-period bounds for trend comparisons (rule-break leaderboard, etc.).
  // For "All" range there is no previous window — comparisons hide.
  const prev = previousPeriodIso(fromIso, toIso)

  // Trading Calendar always shows the last 12 weeks of entry-day P&L,
  // independent of the analytics range filter.
  const calFromIso = new Date(Date.now() - 84 * 24 * 60 * 60 * 1000).toISOString()
  const calToIso = new Date().toISOString()

  const [trades, entries, prevEntries, playbooks, accounts, calendarTrades] = await Promise.all([
    getUserTrades({ limit: 5000, from: fromIso, to: toIso }),
    getJournalEntries({ limit: 5000, from: fromIso, to: toIso }),
    prev ? getJournalEntries({ limit: 5000, from: prev.from, to: prev.to }) : Promise.resolve([]),
    getUserPlaybooks(),
    getUserAccounts(),
    getUserTrades({ limit: 2000, from: calFromIso, to: calToIso }),
  ])

  const closedCount = trades.filter((t) => t.status === "closed").length
  if (closedCount < 5) {
    return (
      <>
        <SectionHeader
          title={m.title}
          subtitle={`${m.subtitle} · ${rangeLabel(range)}`}
          actions={<><RangeFilterBar /><LogTradeButton /></>}
        />
        <SectionStub
          icon={m.icon}
          title={`Analytics unlock at 5 closed trades in this range — you have ${closedCount}`}
          description="Try widening the range filter (or switching to All) to surface a larger sample. Win rate, profit factor, expectancy, equity curve, per-pair / per-setup / per-account breakdowns, day-of-week heatmap, R distribution, win/loss streaks, and Coach AI insights all turn on once we have a sample."
        />
      </>
    )
  }

  const entriesByTrade = new Map<string, typeof entries[number]>()
  for (const e of entries) {
    if (!e.trade_id) continue
    const existing = entriesByTrade.get(e.trade_id)
    if (!existing || new Date(e.last_edited_at) > new Date(existing.last_edited_at)) {
      entriesByTrade.set(e.trade_id, e)
    }
  }

  const playbookMap = new Map(playbooks.map((p) => [p.id, p.name]))
  const accountMap = new Map(accounts.map((a) => [a.id, `${a.broker} · ${a.label}`]))
  // Fan chart needs a dollar starting balance. Use total live equity across
  // accounts; fall back to $10k for the empty-account demo case.
  const totalEquity = accounts.reduce((s, a) => s + Number(a.equity ?? 0), 0)
  const simStartBalance = totalEquity > 0 ? totalEquity : 10000

  // Fetch fills for closed trades only — scale-out analysis needs per-fill data.
  const closedIds = trades.filter((t) => t.status === "closed").map((t) => t.id)
  const fillsByTrade = await getFillsForTrades(closedIds)

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={`${m.subtitle} · ${rangeLabel(range)}`}
        actions={
          <>
            <RangeFilterBar />
            <button className="btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }} title="Coming soon">
              <Icon name="external" size={13} /> <span>Export PDF</span>
            </button>
          </>
        }
      />

      <TradingCalendar trades={calendarTrades} />

      <AnalyticsView
        trades={trades}
        entriesByTrade={entriesByTrade}
        prevEntries={prevEntries}
        playbookMap={playbookMap}
        accountMap={accountMap}
        fillsByTrade={fillsByTrade}
        simStartBalance={simStartBalance}
      />
    </>
  )
}

/**
 * Previous equivalent window for trend deltas. Bumps the bounds back by the
 * window length: 30D current → days 31–60 prior. Returns null for "All-time"
 * (no comparison possible) or when bounds are absent.
 */
function previousPeriodIso(fromIso: string | null, toIso: string | null): { from: string; to: string } | null {
  if (!fromIso) return null
  const fromMs = new Date(fromIso).getTime()
  const toMs = toIso ? new Date(toIso).getTime() : Date.now()
  const span = toMs - fromMs
  if (span <= 0) return null
  return {
    from: new Date(fromMs - span).toISOString(),
    to: new Date(fromMs).toISOString(),
  }
}
