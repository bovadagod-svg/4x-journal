"use client"

import { useState, useTransition } from "react"
import { Icon } from "@/components/icons"
import { setDashboardLayoutHidden } from "@/lib/actions/dashboard-layout"
import { WIDGET_CATALOG, type DashboardLayout } from "@/lib/dashboard-layout"

/**
 * Header dropdown to hide / show dashboard widgets. v1 is checkbox toggles
 * grouped by purpose (intel / live / history / discipline / context). Drag-
 * reorder can land later — same JSONB column accommodates `order` field.
 */
export function CustomizeWidgetsButton({ layout }: { layout: DashboardLayout }) {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState<Set<string>>(new Set(layout.hidden))
  const [pending, startTransition] = useTransition()

  const toggle = (id: string) => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setHidden(next)
  }

  const save = () => {
    startTransition(async () => {
      const r = await setDashboardLayoutHidden(Array.from(hidden))
      if (r.ok) setOpen(false)
      else alert(r.error)
    })
  }

  const groups: Array<{ key: string; label: string }> = [
    { key: "intel", label: "Intel" },
    { key: "live", label: "Live" },
    { key: "history", label: "History" },
    { key: "discipline", label: "Discipline" },
    { key: "context", label: "Context" },
  ]

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="btn"
        onClick={() => setOpen((s) => !s)}
        title="Show or hide dashboard widgets"
        style={{ fontSize: 12 }}
      >
        <Icon name="filter" size={13} /> <span>Widgets</span>
      </button>

      {open && (
        <>
          {/* click-outside backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 50 }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              zIndex: 51,
              minWidth: 280,
              maxHeight: "70vh",
              overflowY: "auto",
              background: "var(--c-bg-elev-1)",
              border: "1px solid var(--c-border)",
              borderRadius: 10,
              boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
              padding: 12,
            }}
          >
            <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", marginBottom: 8 }}>
              Hide widgets you don&apos;t use. Settings persist per device.
            </div>

            {groups.map((g) => {
              const items = WIDGET_CATALOG.filter((w) => w.group === g.key)
              if (items.length === 0) return null
              return (
                <div key={g.key} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                    {g.label}
                  </div>
                  {items.map((w) => {
                    const isHidden = hidden.has(w.id)
                    return (
                      <label
                        key={w.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "5px 4px",
                          fontSize: 12.5, cursor: "pointer",
                          color: isHidden ? "var(--c-fg-dim)" : "var(--c-fg)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          onChange={() => toggle(w.id)}
                          style={{ accentColor: "var(--c-accent-bright)" }}
                        />
                        <span>{w.label}</span>
                      </label>
                    )
                  })}
                </div>
              )
            })}

            <div style={{ display: "flex", gap: 8, marginTop: 8, borderTop: "1px solid var(--c-border)", paddingTop: 10 }}>
              <button
                type="button"
                className="btn"
                onClick={save}
                disabled={pending}
                style={{ flex: 1, justifyContent: "center", background: "var(--c-purple-bright)", color: "white" }}
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => { setHidden(new Set(layout.hidden)); setOpen(false) }}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
