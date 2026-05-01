import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function RiskPage() {
  const m = SECTION_META.risk
  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />
      <SectionStub icon={m.icon} title={m.title} description="Phase 5: daily drawdown stops, max risk per trade, prop firm rule mirrors, tilt-detection blocks." />
    </>
  )
}
