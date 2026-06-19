"use client"

import { useState, useTransition } from "react"
import { Icon } from "@/components/icons"
import { setDashboardLayoutHidden, setDashboardLayoutOrder } from "@/lib/actions/dashboard-layout"
import {
  WIDGET_CATALOG,
  ROW_CATALOG,
  resolveRowOrder,
  type DashboardLayout,
  type DashboardRow,
} from "@/lib/dashboard-layout"

/**
 * Header dropdown with two tabs: Widgets (per-widget hide toggles, grouped by
 * purpose) and Layout (drag-reorder rows). The JSONB column persists both
 * `hidden` and `order` independently — saving one doesn't clobber the other.
 */
export function CustomizeWidgetsButton({ layout }: { layout: DashboardLayout }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"widgets" | "layout">("widgets")
  const [hidden, setHidden] = useState<Set<string>>(new Set(layout.hidden))
  const [order, setOrder] = useState<DashboardRow[]>(() => resolveRowOrder(layout))
  const [pending, startTransition] = useTransition()

  const toggleHidden = (id: string) => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setHidden(next)
  }

  const saveHidden = () => {
    startTransition(async () => {
      const r = await setDashboardLayoutHidden(Array.from(hidden))
      if (r.ok) setOpen(false)
      else alert(r.error)
    })
  }

  const saveOrder = () => {
    startTransition(async () => {
      const r = await setDashboardLayoutOrder(order.map((row) => row.id))
      if (r.ok) setOpen(false)
      else alert(r.error)
    })
  }

  const resetOrder = () => setOrder(ROW_CATALOG.slice())

  const widgetGroups: Array<{ key: string; label: string }> = [
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
        title="Show, hide, or reorder dashboard widgets"
        style={{ fontSize: 12 }}
      >
        <Icon name="filter" size={13} /> <span>Layout</span>
      </button>

      {open && (
        <>
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
              minWidth: 320,
              maxHeight: "70vh",
              overflowY: "auto",
              background: "var(--c-bg-elev-1)",
              border: "1px solid var(--c-border)",
              borderRadius: 10,
              boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
              padding: 12,
            }}
          >
            <div style={{ display: "flex", gap: 4, marginBottom: 10, borderBottom: "1px solid var(--c-border)", paddingBottom: 8 }}>
              <TabBtn active={tab === "widgets"} onClick={() => setTab("widgets")}>Widgets</TabBtn>
              <TabBtn active={tab === "layout"} onClick={() => setTab("layout")}>Reorder</TabBtn>
            </div>

            {tab === "widgets" && (
              <>
                <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", marginBottom: 8 }}>
                  Hide widgets you don&apos;t use.
                </div>
                {widgetGroups.map((g) => {
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
                              onChange={() => toggleHidden(w.id)}
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
                    onClick={saveHidden}
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
              </>
            )}

            {tab === "layout" && (
              <ReorderRows
                rows={order}
                onReorder={setOrder}
                onSave={saveOrder}
                onReset={resetOrder}
                onCancel={() => { setOrder(resolveRowOrder(layout)); setOpen(false) }}
                pending={pending}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        background: active ? "var(--c-bg-elev-2)" : "transparent",
        border: "1px solid",
        borderColor: active ? "var(--c-border)" : "transparent",
        color: active ? "var(--c-fg)" : "var(--c-fg-muted)",
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  )
}

function ReorderRows({
  rows,
  onReorder,
  onSave,
  onReset,
  onCancel,
  pending,
}: {
  rows: DashboardRow[]
  onReorder: (next: DashboardRow[]) => void
  onSave: () => void
  onReset: () => void
  onCancel: () => void
  pending: boolean
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const onDragStart = (id: string) => (e: React.DragEvent) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = "move"
    e.dataTransfer.setData("text/plain", id)
  }
  const onDragOver = (id: string) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setOverId(id)
  }
  const onDrop = (id: string) => (e: React.DragEvent) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData("text/plain") || dragId
    setDragId(null)
    setOverId(null)
    if (!sourceId || sourceId === id) return
    const next = rows.slice()
    const fromIdx = next.findIndex((r) => r.id === sourceId)
    const toIdx = next.findIndex((r) => r.id === id)
    if (fromIdx < 0 || toIdx < 0) return
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    onReorder(next)
  }

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= rows.length) return
    const next = rows.slice()
    const [m] = next.splice(idx, 1)
    next.splice(j, 0, m)
    onReorder(next)
  }

  return (
    <>
      <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", marginBottom: 8 }}>
        Drag rows to reorder. Hidden widgets still take their slot — toggle them in the Widgets tab.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((row, idx) => {
          const isDragging = dragId === row.id
          const isOver = overId === row.id && dragId !== row.id
          return (
            <div
              key={row.id}
              draggable
              onDragStart={onDragStart(row.id)}
              onDragEnd={() => { setDragId(null); setOverId(null) }}
              onDragOver={onDragOver(row.id)}
              onDrop={onDrop(row.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                fontSize: 12.5,
                background: isOver ? "var(--c-bg-elev-2)" : "transparent",
                border: "1px solid",
                borderColor: isOver ? "var(--c-purple-bright)" : "var(--c-border)",
                borderRadius: 6,
                opacity: isDragging ? 0.4 : 1,
                cursor: "grab",
              }}
            >
              <span style={{ color: "var(--c-fg-muted)", fontSize: 14, lineHeight: 1, userSelect: "none" }}>⋮⋮</span>
              <span style={{ flex: 1, color: "var(--c-fg)" }}>{row.label}</span>
              <span style={{ display: "flex", gap: 2 }}>
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  title="Move up"
                  style={iconBtn}
                >↑</button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === rows.length - 1}
                  title="Move down"
                  style={iconBtn}
                >↓</button>
              </span>
            </div>
          )
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10, borderTop: "1px solid var(--c-border)", paddingTop: 10 }}>
        <button
          type="button"
          className="btn"
          onClick={onSave}
          disabled={pending}
          style={{ flex: 1, justifyContent: "center", background: "var(--c-purple-bright)", color: "white" }}
        >
          {pending ? "Saving…" : "Save order"}
        </button>
        <button type="button" className="btn" onClick={onReset} style={{ justifyContent: "center" }}>
          Reset
        </button>
        <button type="button" className="btn" onClick={onCancel} style={{ justifyContent: "center" }}>
          Cancel
        </button>
      </div>
    </>
  )
}

const iconBtn: React.CSSProperties = {
  width: 22,
  height: 22,
  padding: 0,
  fontSize: 12,
  background: "var(--c-bg-elev-2)",
  border: "1px solid var(--c-border)",
  borderRadius: 4,
  color: "var(--c-fg)",
  cursor: "pointer",
}
