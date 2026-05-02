import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { getWatchlist } from "@/lib/queries/watchlist"
import { AddPairForm } from "@/components/watchlist/add-pair-form"
import { WatchlistView } from "@/components/watchlist/watchlist-view"

export default async function WatchlistPage() {
  const m = SECTION_META.watchlist
  const pairs = await getWatchlist()

  if (pairs.length === 0) {
    return (
      <>
        <SectionHeader title={m.title} subtitle={m.subtitle} />
        <div className="card" style={{ padding: 16 }}>
          <AddPairForm />
        </div>
        <SectionStub
          icon={m.icon}
          title="Watchlist is empty"
          description="Track the pairs you actually trade. Each one shows up on the dashboard each morning, and the Calendar auto-filters to your watchlist's currencies."
        />
      </>
    )
  }

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={`${pairs.length} pair${pairs.length === 1 ? "" : "s"} on your radar`}
      />

      <div className="card" style={{ padding: 14 }}>
        <AddPairForm />
      </div>

      <WatchlistView pairs={pairs} />
    </>
  )
}
