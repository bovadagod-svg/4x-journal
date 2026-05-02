"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { createPlaybook, updatePlaybook, type PlaybookFormState } from "@/lib/actions/playbooks"
import type { Playbook } from "@/lib/queries/playbooks"

export function PlaybookFormModal({
  open,
  onClose,
  playbook,
  template,
}: {
  open: boolean
  onClose: () => void
  playbook?: Playbook
  template?: { name: string; color: string; notes: string; target_r: number }
}) {
  const router = useRouter()
  const isEdit = !!playbook
  const [state, action, pending] = useActionState<PlaybookFormState, FormData>(
    isEdit ? updatePlaybook : createPlaybook,
    undefined,
  )
  const seed = playbook ?? template
  const [color, setColor] = useState(seed?.color ?? "#6932D4")

  useEffect(() => {
    if (state?.ok) {
      onClose()
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.ok])

  useEffect(() => {
    if (open) setColor(seed?.color ?? "#6932D4")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, playbook?.id, template?.name])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "grid", placeItems: "center", padding: 16,
      }}
    >
      <form
        action={action}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          maxHeight: "90vh", overflowY: "auto",
          background: "var(--c-bg-elev-1)",
          border: "1px solid var(--c-border-strong)",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          display: "flex", flexDirection: "column",
        }}
      >
        {isEdit && playbook && <input type="hidden" name="id" value={playbook.id} />}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>
              {isEdit ? "Edit playbook" : template ? `New playbook from “${template.name}”` : "New playbook"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-fg-muted)" }}>
              Document one setup. Stats below will populate from trades you tag with this playbook.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Name">
            <input
              name="name"
              defaultValue={seed?.name ?? ""}
              required
              maxLength={60}
              placeholder="London Breakout"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Color">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ width: 44, height: 36, padding: 2, background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, cursor: "pointer" }}
                />
                <input
                  name="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{ ...inputStyle, fontFamily: "var(--font-mono)", flex: 1 }}
                  pattern="^#[0-9a-fA-F]{6}$"
                  required
                />
              </div>
            </Field>
            <Field label="Target R">
              <input
                name="target_r"
                type="number"
                step="0.1"
                min="0"
                defaultValue={seed?.target_r ?? ""}
                placeholder="2"
                style={priceInput}
              />
            </Field>
          </div>

          <Field label="Rules / Notes">
            <textarea
              name="notes"
              rows={6}
              defaultValue={seed?.notes ?? ""}
              placeholder="Entry criteria, stop placement, target logic, do-not-trade-when conditions…"
              style={{ ...inputStyle, resize: "vertical", minHeight: 120, fontFamily: "var(--font-body)", lineHeight: 1.5 }}
            />
          </Field>

          {state && !state.ok && (
            <div style={{ fontSize: 12, color: "var(--c-red-bright)" }}>{state.error}</div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--c-border)", background: "var(--c-bg-elev-1)" }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            <Icon name={isEdit ? "check" : "plus"} size={13} />
            <span>{pending ? "Saving…" : isEdit ? "Save" : "Create playbook"}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-elev-2)",
  color: "var(--c-fg)",
  fontSize: 13,
  outline: "none",
  width: "100%",
}
const priceInput: React.CSSProperties = { ...inputStyle, fontFamily: "var(--font-mono)" }
const iconBtn: React.CSSProperties = {
  width: 30, height: 30, display: "grid", placeItems: "center",
  background: "transparent", border: "1px solid var(--c-border)",
  borderRadius: 8, color: "var(--c-fg-muted)",
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: "var(--c-fg-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      {children}
    </label>
  )
}
