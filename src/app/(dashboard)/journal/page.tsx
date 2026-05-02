import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { getJournalEntries, getUserTrades } from "@/lib/queries/trades"
import { getUserPlaybooks } from "@/lib/queries/accounts"
import { LogTradeButton } from "@/components/trades/log-trade-button"
import { JournalView } from "@/components/journal/journal-view"

export default async function JournalPage() {
  const m = SECTION_META.journal
  const [entries, trades, playbooks] = await Promise.all([
    getJournalEntries({ limit: 5000 }),
    getUserTrades({ limit: 5000 }),
    getUserPlaybooks(),
  ])

  if (entries.length === 0) {
    return (
      <>
        <SectionHeader title={m.title} subtitle={m.subtitle} actions={<LogTradeButton label="Log trade with notes" />} />
        <SectionStub
          icon={m.icon}
          title="No journal entries yet"
          description="Notes you write in the Log Trade modal land here automatically. Click any trade in the Ledger (or the journal icon in the row actions) to open the 6-tab editor — pre-trade, live notes, post-trade, cold review, screenshots, tags."
        />
      </>
    )
  }

  const playbookMap = new Map(playbooks.map((p) => [p.id, p.name]))

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle="Pre-trade thinking, live notes, post-trade lessons — date-rail timeline"
        actions={
          <>
            <button className="btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }} title="Coming soon">
              <Icon name="search" size={13} /> <span>Search</span>
            </button>
            <button className="btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }} title="Coming soon">
              <Icon name="filter" size={13} /> <span>Filters</span>
            </button>
            <LogTradeButton label="Log trade" />
          </>
        }
      />

      <JournalView entries={entries} trades={trades} playbookMap={playbookMap} />
    </>
  )
}
