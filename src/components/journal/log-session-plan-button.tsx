"use client"

import { useTransition } from "react"
import { Icon } from "@/components/icons"
import { createEmptySessionPlanEntry } from "@/lib/actions/journal-entries"
import { useJournalDrawer } from "./journal-drawer-context"

/**
 * Sibling of LogIdeaButton — creates a `session_plan` journal entry and opens
 * it in the drawer. Distinct color (cyan) so the trader can tell at a glance
 * whether they're capturing a setup idea (amber) vs. drafting today's session
 * plan (cyan).
 */
export function LogSessionPlanButton({
  label = "Plan today",
  existingId = null,
}: {
  label?: string
  /** When set, opens the existing entry instead of creating a new one. */
  existingId?: string | null
}) {
  const { open } = useJournalDrawer()
  const [pending, startTransition] = useTransition()

  return (
    <button
      className="btn"
      type="button"
      disabled={pending}
      onClick={() => {
        if (existingId) {
          open(existingId)
          return
        }
        startTransition(async () => {
          const r = await createEmptySessionPlanEntry()
          if (r.ok) open(r.id)
          else alert(r.error)
        })
      }}
      style={{
        background: "var(--c-cyan-soft)",
        color: "var(--c-cyan-bright)",
        borderColor: "rgba(91, 200, 224, 0.4)",
      }}
    >
      <Icon name="book" size={13} />
      <span>{pending ? "Opening…" : label}</span>
    </button>
  )
}
