import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function WatchlistPage() {
  const m = SECTION_META.watchlist
  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />
      <SectionStub icon={m.icon} title={m.title} description="Phase 6: track the pairs you trade with bias, key levels, and news flags. Pre-session targets at a glance." />
    </>
  )
}
