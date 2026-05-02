"use client"

import { useState } from "react"
import { Icon } from "@/components/icons"
import { PlaybookFormModal } from "./playbook-form-modal"
import { PLAYBOOK_TEMPLATES } from "@/lib/playbook-templates"

export function AddPlaybookButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon name="plus" size={13} />
        <span>New playbook</span>
      </button>
      <PlaybookFormModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function StarterTemplates({ existingNames }: { existingNames: Set<string> }) {
  const [active, setActive] = useState<typeof PLAYBOOK_TEMPLATES[number] | null>(null)
  const remaining = PLAYBOOK_TEMPLATES.filter((t) => !existingNames.has(t.name))

  if (remaining.length === 0) return null

  return (
    <>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ marginBottom: 12 }}>
          <h3 className="card-title">Starter templates</h3>
          <p className="card-subtitle">Pre-built setups — click any to scaffold a playbook you can edit before saving.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
          {remaining.map((t) => (
            <button
              key={t.name}
              onClick={() => setActive(t)}
              className="btn"
              style={{
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "12px 14px",
                height: "auto",
                gap: 6,
                borderLeft: `3px solid ${t.color}`,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 500 }}>{t.name}</span>
              <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textAlign: "left" }}>
                Target {t.target_r}R · pre-built rules
              </span>
            </button>
          ))}
        </div>
      </div>
      {active && (
        <PlaybookFormModal
          open={!!active}
          onClose={() => setActive(null)}
          template={active}
        />
      )}
    </>
  )
}
