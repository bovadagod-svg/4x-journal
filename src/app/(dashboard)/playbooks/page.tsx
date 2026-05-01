import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function PlaybooksPage() {
  const m = SECTION_META.playbooks
  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />
      <SectionStub icon={m.icon} title={m.title} description="Phase 3: each setup as a documented playbook with rules, screenshots, and live expectancy from linked trades." />
    </>
  )
}
