import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { getJournalEntries, getUserTrades } from "@/lib/queries/trades"
import { getUserAccounts, getUserPlaybooks } from "@/lib/queries/accounts"
import { LogTradeButton } from "@/components/trades/log-trade-button"
import { AnalyticsView } from "@/components/analytics/analytics-view"

export default async function AnalyticsPage() {
  const m = SECTION_META.analytics
  const [trades, entries, playbooks, accounts] = await Promise.all([
    getUserTrades({ limit: 5000 }),
    getJournalEntries({ limit: 5000 }),
    getUserPlaybooks(),
    getUserAccounts(),
  ])

  const closedCount = trades.filter((t) => t.status === "closed").length
  if (closedCount < 5) {
    return (
      <>
        <SectionHeader title={m.title} subtitle={m.subtitle} actions={<LogTradeButton />} />
        <SectionStub
          icon={m.icon}
          title={`Analytics unlock at 5 closed trades — you have ${closedCount}`}
          description="Win rate, profit factor, expectancy, equity curve, per-pair / per-setup / per-account breakdowns, day-of-week heatmap, R distribution, win/loss streaks, and Coach AI insights all turn on once we have a sample."
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

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={m.subtitle}
        actions={
          <button className="btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }} title="Coming soon">
            <Icon name="external" size={13} /> <span>Export PDF</span>
          </button>
        }
      />

      <AnalyticsView
        trades={trades}
        entriesByTrade={entriesByTrade}
        playbookMap={playbookMap}
        accountMap={accountMap}
      />
    </>
  )
}
