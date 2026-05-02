"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { createAccount, updateAccount, type AccountFormState } from "@/lib/actions/accounts"
import type { Account } from "./accounts-context"

const BROKER_PRESETS = [
  { name: "FunderPro", color: "#4312A0" },
  { name: "FTMO", color: "#11C458" },
  { name: "MyForexFunds", color: "#E5A23B" },
  { name: "MT4 / MT5", color: "#9A97A1" },
  { name: "cTrader", color: "#BE333D" },
  { name: "TradingView", color: "#6932D4" },
  { name: "Manual", color: "#6932D4" },
]

const STATUSES: { value: "live" | "demo" | "funded" | "challenge"; label: string }[] = [
  { value: "demo", label: "Demo" },
  { value: "live", label: "Live" },
  { value: "funded", label: "Funded" },
  { value: "challenge", label: "Challenge" },
]

export function AccountFormModal({
  open,
  onClose,
  account,
}: {
  open: boolean
  onClose: () => void
  account?: Account
}) {
  const router = useRouter()
  const isEdit = !!account
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    isEdit ? updateAccount : createAccount,
    undefined,
  )
  const [color, setColor] = useState(account?.color ?? "#6932D4")
  const [broker, setBroker] = useState(account?.broker ?? "Manual")

  useEffect(() => {
    if (state?.ok) {
      onClose()
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.ok])

  useEffect(() => {
    if (open) {
      setColor(account?.color ?? "#6932D4")
      setBroker(account?.broker ?? "Manual")
    }
  }, [open, account])

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
          width: "min(520px, 100%)",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--c-bg-elev-1)",
          border: "1px solid var(--c-border-strong)",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isEdit && account && <input type="hidden" name="id" value={account.id} />}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>
              {isEdit ? "Edit account" : "Add account"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-fg-muted)" }}>
              {isEdit ? "Tweak any field — saves on submit." : "Manual entry. Live broker integrations come in Phase 9."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Broker / Prop firm">
            <input
              name="broker"
              list="brokers"
              required
              value={broker}
              onChange={(e) => {
                setBroker(e.target.value)
                const preset = BROKER_PRESETS.find((p) => p.name === e.target.value)
                if (preset) setColor(preset.color)
              }}
              style={inputStyle}
            />
            <datalist id="brokers">
              {BROKER_PRESETS.map((p) => <option key={p.name} value={p.name} />)}
            </datalist>
          </Field>

          <Field label="Label">
            <input
              name="label"
              defaultValue={account?.label ?? ""}
              required
              placeholder="$100K Phase 1"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Currency">
              <input
                name="currency"
                defaultValue={account?.currency ?? "USD"}
                required
                maxLength={8}
                style={{ ...inputStyle, textTransform: "uppercase" }}
              />
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={account?.status ?? "demo"} required style={inputStyle}>
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Balance">
              <input
                name="balance"
                type="number"
                step="any"
                defaultValue={account?.balance ?? 0}
                style={priceInput}
              />
            </Field>
            <Field label="Equity">
              <input
                name="equity"
                type="number"
                step="any"
                defaultValue={account?.equity ?? 0}
                style={priceInput}
              />
            </Field>
          </div>

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

          {state && !state.ok && (
            <div style={{ fontSize: 12, color: "var(--c-red-bright)" }}>{state.error}</div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--c-border)", background: "var(--c-bg-elev-1)" }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            <Icon name={isEdit ? "check" : "plus"} size={13} />
            <span>{pending ? "Saving…" : isEdit ? "Save" : "Add account"}</span>
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
