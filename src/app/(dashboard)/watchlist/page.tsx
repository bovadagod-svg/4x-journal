import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { getWatchlist } from "@/lib/queries/watchlist"
import { AddPairForm } from "@/components/watchlist/add-pair-form"
import { WatchlistRow } from "@/components/watchlist/watchlist-row"

export default async function WatchlistPage() {
  const m = SECTION_META.watchlist
  const pairs = await getWatchlist()

  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />

      <div className="card" style={{ padding: 16 }}>
        <AddPairForm />
      </div>

      {pairs.length === 0 ? (
        <SectionStub
          icon={m.icon}
          title="Watchlist is empty"
          description="Track the pairs you actually trade. Each one shows up on the dashboard each morning, and the Calendar auto-filters to your watchlist's currencies."
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th>Pair</Th>
                <Th>Bias</Th>
                <Th>Setup note</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => <WatchlistRow key={p.id} pair={p} />)}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{
      textAlign: align,
      padding: "10px 18px",
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--c-fg-dim)",
      background: "var(--c-bg-elev-2)",
      whiteSpace: "nowrap",
    }}>{children}</th>
  )
}
