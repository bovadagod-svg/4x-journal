import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function DashboardPage() {
  const meta = SECTION_META.dashboard
  return (
    <>
      <SectionHeader title={meta.title} subtitle={meta.subtitle} />
      <SectionStub
        icon={meta.icon}
        title="Dashboard"
        description="Phase 1 wires the core trade-logging loop: log a trade, see it on the dashboard, write a journal entry. Until then, head to Settings to confirm your preferences are saving correctly."
      />
    </>
  )
}
