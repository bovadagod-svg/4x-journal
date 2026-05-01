import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"

export default function AccountsPage() {
  const m = SECTION_META.accounts
  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} />
      <SectionStub icon={m.icon} title={m.title} description="Phase 2: connect a broker or prop firm. Manual + CSV first; live broker APIs in Phase 9." />
    </>
  )
}
