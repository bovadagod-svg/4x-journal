import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function LedgerPage() {
  const m = SECTION_META.ledger
  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />
      <SectionStub icon={m.icon} title={m.title} description="Phase 1: the ledger lists every trade you log, account-scoped, with sort, filter, and inline edit." />
    </>
  )
}
