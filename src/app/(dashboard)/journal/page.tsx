import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { getJournalEntries, getUserTrades } from "@/lib/queries/trades"
import { getUserPlaybooks } from "@/lib/queries/accounts"
import { LogTradeButton } from "@/components/trades/log-trade-button"
import { LogIdeaButton } from "@/components/journal/log-idea-button"
import { JournalView } from "@/components/journal/journal-view"
import { IdeasComparisonCard } from "@/components/journal/ideas-comparison-card"

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
        <SectionHeader title={m.title} subtitle={m.subtitle} actions={<><LogIdeaButton /><LogTradeButton label="Log trade with notes" /></>} />
        <SectionStub
          icon={m.icon}
          title="No journal entries yet"
          description="Notes you write in the Log Trade modal land here automatically. Or click Log Idea to capture a setup you're watching but haven't taken yet — Coach AI uses the gap between ideas and executions to flag patterns."
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
            <LogIdeaButton />
            <LogTradeButton label="Log trade" />
          </>
        }
      />

      <IdeasComparisonCard entries={entries} />

      <JournalView entries={entries} trades={trades} playbookMap={playbookMap} />
    </>
  )
}
