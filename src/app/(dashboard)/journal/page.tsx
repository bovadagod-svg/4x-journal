import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function JournalPage() {
  const m = SECTION_META.journal
  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />
      <SectionStub icon={m.icon} title={m.title} description="Phase 1: pre-trade thinking, live notes, post-trade lessons. Each entry links to a ledger trade." />
    </>
  )
}
