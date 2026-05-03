"use client"

import { useTransition } from "react"
import { Icon } from "@/components/icons"
import { createEmptyIdeaEntry } from "@/lib/actions/journal-entries"
import { useJournalDrawer } from "./journal-drawer-context"

export function LogIdeaButton({ label = "Log idea" }: { label?: string }) {
  const { open } = useJournalDrawer()
  const [pending, startTransition] = useTransition()

  return (
    <button
      className="btn"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const r = await createEmptyIdeaEntry()
          if (r.ok) open(r.id)
          else alert(r.error)
        })
      }}
      style={{
        background: "rgba(229, 162, 59, 0.12)",
        color: "var(--c-amber)",
        borderColor: "rgba(229, 162, 59, 0.4)",
      }}
    >
      <Icon name="lightning" size={13} />
      <span>{pending ? "Opening…" : label}</span>
    </button>
  )
}
