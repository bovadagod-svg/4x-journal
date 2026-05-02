import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { getPlaybooksWithStats } from "@/lib/queries/playbooks"
import { PlaybookCard } from "@/components/playbooks/playbook-card"
import { AddPlaybookButton, StarterTemplates } from "@/components/playbooks/add-playbook-buttons"

export default async function PlaybooksPage() {
  const m = SECTION_META.playbooks
  const playbooks = await getPlaybooksWithStats()
  const existingNames = new Set(playbooks.map((p) => p.name))

  if (playbooks.length === 0) {
    return (
      <>
        <SectionHeader title={m.title} subtitle={m.subtitle} actions={<AddPlaybookButton />} />
        <SectionStub
          icon={m.icon}
          title="No playbooks defined"
          description="A playbook documents one setup — entry criteria, stop logic, target R:R. Tag trades with a playbook and stats will populate here. Start from a template below or create your own."
        />
        <StarterTemplates existingNames={existingNames} />
      </>
    )
  }

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={`${playbooks.length} playbook${playbooks.length === 1 ? "" : "s"}`}
        actions={<AddPlaybookButton />}
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 14,
      }}>
        {playbooks.map((p) => (
          <PlaybookCard key={p.id} playbook={p} />
        ))}
      </div>

      <StarterTemplates existingNames={existingNames} />
    </>
  )
}
