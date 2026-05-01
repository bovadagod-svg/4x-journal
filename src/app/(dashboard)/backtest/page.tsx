import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function BacktestPage() {
  const m = SECTION_META.backtest
  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />
      <SectionStub icon={m.icon} title={m.title} description="Backtesting is parked beyond Phase 9 — first we make sure the journaling loop is solid." />
    </>
  )
}
