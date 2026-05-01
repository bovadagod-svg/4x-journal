import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function SettingsPage() {
  const m = SECTION_META.settings
  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />
      <SectionStub
        icon={m.icon}
        title={m.title}
        description="Theme, accent, and density already save to your account — open the floating ⚙ button at the bottom-right. Full settings panels (risk rules, prop firm, tax) land in Phase 8."
      />
    </>
  )
}
