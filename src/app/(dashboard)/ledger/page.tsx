import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { getJournalEntries, getUserTrades } from "@/lib/queries/trades"
import { getUserPlaybooks, getAccountOwnerMap } from "@/lib/queries/accounts"
import { getTeamMemberMap } from "@/lib/queries/teams"
import { LogTradeButton } from "@/components/trades/log-trade-button"
import { LedgerView } from "@/components/ledger/ledger-view"

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const m = SECTION_META.ledger
  const { date: initialDate } = await searchParams
  const [trades, entries, playbooks, traderMap, accountOwnerMap] = await Promise.all([
    getUserTrades({ limit: 1000 }),
    getJournalEntries({ limit: 5000 }),
    getUserPlaybooks(),
    getTeamMemberMap(),
    getAccountOwnerMap(),
  ])

  if (trades.length === 0) {
    return (
      <>
        <SectionHeader
          title={m.title}
          subtitle={m.subtitle}
          actions={<LogTradeButton label="Log first trade" />}
        />
        <SectionStub
          icon={m.icon}
          title="No trades yet"
          description="Every trade you log lands here — entry, exit, R, P&L, mood, rules. Three ways to fill it: press c to open the log-trade modal, sync a TradeLocker account from /accounts, or paste a CSV from any broker."
        />
      </>
    )
  }

  // Build entry-by-trade map (most recent entry wins per trade — extras stay
  // visible on the Journal page).
  const entriesByTrade = new Map<string, typeof entries[number]>()
  for (const e of entries) {
    if (!e.trade_id) continue
    const existing = entriesByTrade.get(e.trade_id)
    if (!existing || new Date(e.last_edited_at) > new Date(existing.last_edited_at)) {
      entriesByTrade.set(e.trade_id, e)
    }
  }

  const playbookMap = new Map(playbooks.map((p) => [p.id, p.name]))

  // Calculate dynamic subtitle: count trades and date range.
  const earliest = trades[trades.length - 1]?.opened_at
  const days = earliest ? Math.max(1, Math.round((Date.now() - new Date(earliest).getTime()) / (24 * 60 * 60 * 1000))) : 0

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={`${trades.length} trade${trades.length === 1 ? "" : "s"}${days > 0 ? ` · last ${days} day${days === 1 ? "" : "s"}` : ""} · across all accounts`}
        actions={
          <>
            <button className="btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }} title="Coming soon">
              <Icon name="filter" size={13} /> <span>Saved views</span>
            </button>
            <button className="btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }} title="Coming soon">
              <Icon name="external" size={13} /> <span>Import from MT4</span>
            </button>
            <LogTradeButton />
          </>
        }
      />

      <LedgerView
        trades={trades}
        entriesByTrade={entriesByTrade}
        playbookMap={playbookMap}
        traderMap={traderMap}
        accountOwnerMap={accountOwnerMap}
        initialDate={initialDate ?? null}
      />
    </>
  )
}
