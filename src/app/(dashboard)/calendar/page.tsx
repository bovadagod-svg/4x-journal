import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function CalendarPage() {
  const m = SECTION_META.calendar
  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />
      <SectionStub icon={m.icon} title={m.title} description="Phase 6: high-impact events filtered by the currencies in your watchlist. Real ForexFactory ingest in Phase 9." />
    </>
  )
}
