"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { createPlaybook, updatePlaybook, type PlaybookFormState } from "@/lib/actions/playbooks"
import type { Playbook } from "@/lib/queries/playbooks"

const ICONS = ["lightning", "trade", "target", "play", "book", "refresh"] as const
const STATUSES = ["active", "review", "draft"] as const

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
    if (state?.ok) { onClose(); router.refresh() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.ok])

  useEffect(() => {
    if (open) setColor(seed?.color ?? "#6932D4")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, playbook?.id, template?.name])

  if (!open) return null

  return (
    <div role="dialog" aria-modal onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
      zIndex: 100, display: "grid", placeItems: "center", padding: 16,
    }}>
      <form
        action={action}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)",
          maxHeight: "92vh", overflowY: "auto",
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
              {isEdit ? "Edit playbook" : template ? `New playbook from "${template.name}"` : "New playbook"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-fg-muted)" }}>
              Document one setup. Stats below populate from trades you tag with this playbook.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Name">
            <input name="name" defaultValue={seed?.name ?? ""} required maxLength={60} placeholder="London Breakout" style={input} />
          </Field>

          <Field label="Description">
            <input name="description" defaultValue={(playbook?.description) ?? ""} maxLength={400} placeholder="Trade the breakout of Asian session range..." style={input} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Status">
              <select name="status" defaultValue={playbook?.status ?? "active"} style={input}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Icon">
              <select name="icon" defaultValue={playbook?.icon ?? "lightning"} style={input}>
                {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Color">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 36, height: 36, padding: 2, background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, cursor: "pointer", flexShrink: 0 }} />
                <input name="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ ...input, fontFamily: "var(--font-mono)", flex: 1 }} pattern="^#[0-9a-fA-F]{6}$" required />
              </div>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="Risk %">
              <input name="risk_per_trade_pct" type="number" step="0.1" min="0" max="100" defaultValue={playbook?.risk_per_trade_pct ?? ""} placeholder="0.5" style={priceInput} />
            </Field>
            <Field label="Target R">
              <input name="target_r" type="number" step="0.1" min="0" defaultValue={playbook?.target_r ?? seed?.target_r ?? ""} placeholder="2" style={priceInput} />
            </Field>
            <Field label="Timeframe">
              <input name="timeframe" defaultValue={playbook?.timeframe ?? ""} placeholder="5m / 15m" style={input} />
            </Field>
          </div>

          <Field label="Pairs (comma-separated)">
            <input name="pairs" defaultValue={(playbook?.pairs ?? []).join(", ")} placeholder="EUR/USD, GBP/USD, XAU/USD" style={{ ...input, fontFamily: "var(--font-mono)" }} />
          </Field>

          <Field label="Sessions (comma-separated)">
            <input name="sessions" defaultValue={(playbook?.sessions ?? []).join(", ")} placeholder="London, New York" style={input} />
          </Field>

          <Field label="Entry rules (one per line)">
            <textarea
              name="rules"
              rows={5}
              defaultValue={(playbook?.rules ?? []).join("\n")}
              placeholder={`Asian session range must be < 50 pips\nWait for 5m close above/below range before entry\nStop loss = opposite side + 5 pip buffer`}
              style={textareaStyle}
            />
          </Field>

          <Field label="Invalidations / skip if (one per line)">
            <textarea
              name="invalidations"
              rows={3}
              defaultValue={(playbook?.invalidations ?? []).join("\n")}
              placeholder={`Price re-enters range within 15 minutes\nNo follow-through past prior day's high/low`}
              style={textareaStyle}
            />
          </Field>

          <Field label="Notes (free-form)">
            <textarea
              name="notes"
              rows={3}
              defaultValue={playbook?.notes ?? seed?.notes ?? ""}
              placeholder="Anything that doesn't fit the structured fields…"
              style={textareaStyle}
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

const input: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-elev-2)",
  color: "var(--c-fg)",
  fontSize: 13,
  outline: "none",
  width: "100%",
}
const priceInput: React.CSSProperties = { ...input, fontFamily: "var(--font-mono)" }
const textareaStyle: React.CSSProperties = {
  ...input, resize: "vertical", minHeight: 80, fontFamily: "var(--font-body)", lineHeight: 1.5,
}
const iconBtn: React.CSSProperties = {
  width: 30, height: 30, display: "grid", placeItems: "center",
  background: "transparent", border: "1px solid var(--c-border)",
  borderRadius: 8, color: "var(--c-fg-muted)", cursor: "pointer",
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: "var(--c-fg-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      {children}
    </label>
  )
}
