"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { createAccount, updateAccount, type AccountFormState } from "@/lib/actions/accounts"
import { connectTradeLocker, type ConnectTLState } from "@/lib/actions/tradelocker"
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

type ConnectionType = "manual" | "tradelocker"

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

  // Edit always uses createAccount/updateAccount (manual schema). Connection
  // type only matters for new-account flow.
  const [connectionType, setConnectionType] = useState<ConnectionType>("manual")

  const [manualState, manualAction, manualPending] = useActionState<AccountFormState, FormData>(
    isEdit ? updateAccount : createAccount,
    undefined,
  )
  const [tlState, tlAction, tlPending] = useActionState<ConnectTLState, FormData>(
    connectTradeLocker,
    undefined,
  )

  const [color, setColor] = useState(account?.color ?? "#6932D4")
  const [broker, setBroker] = useState(account?.broker ?? "Manual")

  const isTL = !isEdit && connectionType === "tradelocker"
  const pending = isTL ? tlPending : manualPending
  const action = isTL ? tlAction : manualAction
  const errorState = isTL ? tlState : manualState

  // Close on success
  useEffect(() => {
    const s = isTL ? tlState : manualState
    if (s?.ok) {
      onClose()
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualState?.ok, tlState?.ok])

  // Reset when modal reopens
  useEffect(() => {
    if (open) {
      setColor(account?.color ?? "#6932D4")
      setBroker(account?.broker ?? "Manual")
      setConnectionType("manual")
    }
  }, [open, account])

  // When user picks TradeLocker, lock broker to "TradeLocker" and set a
  // sensible default color (env will adjust below if user picks Live).
  useEffect(() => {
    if (isTL) {
      setBroker("TradeLocker")
      // Keep user-chosen color; default to demo purple if none set
      if (!color) setColor("#6932D4")
    } else if (!isEdit) {
      // Switching back to manual — restore Manual default
      setBroker("Manual")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTL])

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

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>
              {isEdit ? "Edit account" : isTL ? "Connect TradeLocker account" : "Add account"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-fg-muted)" }}>
              {isEdit
                ? "Tweak any field — saves on submit."
                : isTL
                  ? "We'll log into TradeLocker and pull your account list. Trades sync from the account card."
                  : "Manual entry. Choose TradeLocker below to auto-import from your broker."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Connection type — only when creating */}
          {!isEdit && (
            <Field label="Connection type">
              <select
                value={connectionType}
                onChange={(e) => setConnectionType(e.target.value as ConnectionType)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="manual">Manual entry</option>
                <option value="tradelocker">TradeLocker (auto-sync)</option>
              </select>
              <span style={{ fontSize: 11, color: "var(--c-fg-dim)", marginTop: 2 }}>
                {isTL
                  ? "Balance, equity, status, and currency populate from your TradeLocker account on connect."
                  : "Enter trade data yourself or import via CSV later."}
              </span>
            </Field>
          )}

          {/* Broker — locked when TL, free input otherwise */}
          <Field label="Broker / Prop firm">
            <input
              name="broker"
              list="brokers"
              required
              value={broker}
              onChange={(e) => {
                if (isTL) return
                setBroker(e.target.value)
                const preset = BROKER_PRESETS.find((p) => p.name === e.target.value)
                if (preset) setColor(preset.color)
              }}
              disabled={isTL}
              style={{ ...inputStyle, ...(isTL ? lockedStyle : {}) }}
            />
            <datalist id="brokers">
              {BROKER_PRESETS.map((p) => <option key={p.name} value={p.name} />)}
            </datalist>
            {isTL && <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>Locked — TradeLocker integration.</span>}
          </Field>

          <Field label="Label">
            <input
              name="label"
              defaultValue={account?.label ?? ""}
              required={!isTL}
              placeholder={isTL ? "e.g. FunderPro $100K — auto-named if blank" : "$100K Phase 1"}
              style={inputStyle}
            />
            {isTL && <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>Optional — TradeLocker name is used if you leave this blank.</span>}
          </Field>

          {/* TradeLocker credentials */}
          {isTL && (
            <>
              <Field label="Environment">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 3 }}>
                  <Radio name="env" value="demo" defaultChecked label="Demo" />
                  <Radio name="env" value="live" label="Live" />
                </div>
              </Field>
              <Field label="TradeLocker email">
                <input name="email" type="email" required autoComplete="email" placeholder="you@example.com" style={inputStyle} />
              </Field>
              <Field label="TradeLocker password">
                <input name="password" type="password" required autoComplete="current-password" style={inputStyle} />
              </Field>
              <Field label="Server (from your TradeLocker login screen)">
                <input name="server" required placeholder="OSP-DEMO" style={{ ...inputStyle, fontFamily: "var(--font-mono)" }} />
                <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>
                  Examples: <code style={{ fontFamily: "var(--font-mono)" }}>OSP-DEMO</code>, <code style={{ fontFamily: "var(--font-mono)" }}>FUNDED-LIVE</code>.
                </span>
              </Field>
            </>
          )}

          {/* Currency + Status — locked when TL */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Currency">
              <input
                name="currency"
                defaultValue={account?.currency ?? "USD"}
                required={!isTL}
                disabled={isTL}
                maxLength={8}
                placeholder={isTL ? "Auto" : "USD"}
                style={{ ...inputStyle, textTransform: "uppercase", ...(isTL ? lockedStyle : {}) }}
              />
              {isTL && <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>Set from broker.</span>}
            </Field>
            <Field label="Status">
              {isTL ? (
                <input
                  disabled
                  value="Auto from broker"
                  style={{ ...inputStyle, ...lockedStyle }}
                />
              ) : (
                <select name="status" defaultValue={account?.status ?? "demo"} required style={inputStyle}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              )}
              {isTL && <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>Demo / Live based on environment.</span>}
            </Field>
          </div>

          {/* Balance + Equity — locked when TL (auto-synced) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Balance">
              <input
                name="balance"
                type="number"
                step="any"
                defaultValue={account?.balance ?? 0}
                disabled={isTL}
                placeholder={isTL ? "Synced" : "0"}
                style={{ ...priceInput, ...(isTL ? lockedStyle : {}) }}
              />
              {isTL && <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>Synced from broker on connect.</span>}
            </Field>
            <Field label="Equity">
              <input
                name="equity"
                type="number"
                step="any"
                defaultValue={account?.equity ?? 0}
                disabled={isTL}
                placeholder={isTL ? "Synced" : "0"}
                style={{ ...priceInput, ...(isTL ? lockedStyle : {}) }}
              />
              {isTL && <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>Synced from broker on connect.</span>}
            </Field>
          </div>

          {/* Color — always editable */}
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

          {/* Prop firm phase — optional, only relevant for funded/eval accounts (#59) */}
          <details style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 10, padding: "10px 12px" }}>
            <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--c-fg-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <span>Prop firm tracking (optional)</span>
              <span style={{ color: "var(--c-fg-dim)", fontSize: 11 }}>· phase, profit target, drawdown caps, payout cadence</span>
            </summary>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              <Field label="Phase">
                <select name="prop_phase" defaultValue={account?.prop_phase ?? ""} style={inputStyle}>
                  <option value="">— Not a prop account —</option>
                  <option value="eval">Evaluation</option>
                  <option value="verification">Verification</option>
                  <option value="funded">Funded</option>
                </select>
              </Field>
              <Field label="Starting balance">
                <input name="prop_starting_balance" type="number" step="any" min="0" defaultValue={account?.prop_starting_balance ?? ""} placeholder="50000" style={inputStyle} />
              </Field>
              <Field label="Profit target %">
                <input name="prop_profit_target_pct" type="number" step="any" min="0" defaultValue={account?.prop_profit_target_pct ?? ""} placeholder="8" style={inputStyle} />
              </Field>
              <Field label="Max DD %">
                <input name="prop_max_drawdown_pct" type="number" step="any" min="0" defaultValue={account?.prop_max_drawdown_pct ?? ""} placeholder="10" style={inputStyle} />
              </Field>
              <Field label="Daily DD %">
                <input name="prop_max_daily_drawdown_pct" type="number" step="any" min="0" defaultValue={account?.prop_max_daily_drawdown_pct ?? ""} placeholder="5" style={inputStyle} />
              </Field>
              <Field label="Payout cadence (days)">
                <input name="prop_payout_cadence_days" type="number" step="1" min="0" defaultValue={account?.prop_payout_cadence_days ?? ""} placeholder="14" style={inputStyle} />
              </Field>
              <Field label="Next payout date">
                <input name="prop_next_payout_at" type="date" defaultValue={account?.prop_next_payout_at ?? ""} style={inputStyle} />
              </Field>
            </div>
          </details>

          {/* Errors */}
          {errorState && !errorState.ok && (
            <div style={{ padding: 10, borderRadius: 8, background: "var(--c-red-soft)", color: "var(--c-red-bright)", fontSize: 12, lineHeight: 1.5 }}>
              <div><strong>{isTL ? "Connection failed." : "Save failed."}</strong> {errorState.error}</div>
              {isTL && (errorState as { debug?: unknown }).debug != null ? (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: "pointer", fontSize: 11 }}>Raw response</summary>
                  <pre style={{ margin: "6px 0 0", fontSize: 10.5, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {JSON.stringify((errorState as { debug?: unknown }).debug, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          )}

          {/* TL security note */}
          {isTL && (
            <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "10px 12px", fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
              <strong style={{ color: "var(--c-fg)" }}>Heads up:</strong> credentials are stored encrypted-at-rest in your DB row so we can re-auth on each sync. Use a demo account if you'd rather not store live credentials.
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--c-border)", background: "var(--c-bg-elev-1)" }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            <Icon name={isTL ? "external" : isEdit ? "check" : "plus"} size={13} />
            <span>
              {pending
                ? isTL ? "Connecting…" : "Saving…"
                : isTL ? "Connect" : isEdit ? "Save" : "Add account"}
            </span>
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
const lockedStyle: React.CSSProperties = {
  opacity: 0.55,
  cursor: "not-allowed",
  background: "var(--c-bg-elev-3)",
}
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

function Radio({ name, value, defaultChecked, label }: { name: string; value: string; defaultChecked?: boolean; label: string }) {
  return (
    <label style={{ display: "block", position: "relative", cursor: "pointer" }}>
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} className="sr-only-radio" style={{ position: "absolute", opacity: 0 }} />
      <span style={{
        display: "block", padding: "6px 10px", borderRadius: 6, textAlign: "center",
        background: "transparent", color: "var(--c-fg-muted)", fontSize: 12, fontWeight: 500,
      }} className="radio-pill">
        {label}
      </span>
      <style>{`
        .sr-only-radio:checked + .radio-pill { background: var(--c-bg-elev-3); color: var(--c-fg); }
      `}</style>
    </label>
  )
}
