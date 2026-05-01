import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function AnalyticsPage() {
  const m = SECTION_META.analytics
  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />
      <SectionStub icon={m.icon} title={m.title} description="Phase 4: win rate, expectancy, profit factor, equity curve, pair heatmap — all computed from your real trades." />
    </>
  )
}
