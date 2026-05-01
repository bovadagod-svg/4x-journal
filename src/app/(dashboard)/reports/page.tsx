import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function ReportsPage() {
  const m = SECTION_META.reports
  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />
      <SectionStub icon={m.icon} title={m.title} description="Phase 7: tax-ready P&L exports, prop-firm progress reports, monthly journals — generated from real trade data." />
    </>
  )
}
