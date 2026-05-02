"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { Icon } from "@/components/icons"
import { COMMON_PAIRS, computePnL, computeR, formatUSD } from "@/lib/finance"
import { createTrade, type TradeFormState } from "@/lib/actions/trades"
import type { Database } from "@/lib/supabase/database.types"
import type { TradeDefaults } from "./log-trade-context"

type Account = Database["public"]["Tables"]["accounts"]["Row"]
type Playbook = Pick<Database["public"]["Tables"]["playbooks"]["Row"], "id" | "name" | "color" | "target_r">

const MOODS = ["focused", "calm", "confident", "rushed", "anxious", "neutral"] as const

export function LogTradeModal({
  open,
  onClose,
  accounts,
  playbooks,
  defaultAccountId,
  defaults,
}: {
  open: boolean
  onClose: () => void
  accounts: Account[]
  playbooks: Playbook[]
  defaultAccountId: string | null
  defaults: TradeDefaults
}) {
  const [state, action, pending] = useActionState<TradeFormState, FormData>(createTrade, undefined)

  // Local UI state for fields the action just reads off the form
  const [side, setSide] = useState<"long" | "short">("long")
  const [status, setStatus] = useState<"pending" | "open" | "closed">("open")
  const [pair, setPair] = useState("EUR/USD")
  const [entry, setEntry] = useState("")
  const [stop, setStop] = useState("")
  const [target, setTarget] = useState("")
  const [exit, setExit] = useState("")
  const [size, setSize] = useState("")
  const [accountId, setAccountId] = useState<string>(defaultAccountId ?? "")

  // Reset form when closing/reopening — pre-fill from user defaults
  useEffect(() => {
    if (!open) {
      setSide("long"); setStatus("open"); setPair("EUR/USD")
      setEntry(""); setStop(""); setTarget(""); setExit("")
      setSize(defaults.sizing_method === "fixed-lots" ? String(defaults.default_fixed_lots * 100000) : "")
      setAccountId(defaultAccountId ?? "")
    }
  }, [open, defaults.sizing_method, defaults.default_fixed_lots, defaultAccountId])

  // Suggested risk dollars from user's default % × selected account's equity,
  // optionally capped by the active prop-firm rules on that account.
  const sizing = useMemo(() => {
    if (defaults.sizing_method !== "fixed-risk") return { suggested: null as number | null, capped: false, capLabel: null as string | null }
    const acc = accounts.find((a) => a.id === accountId)
    if (!acc) return { suggested: null, capped: false, capLabel: null }
    const equity = Number(acc.equity) || 0
    const desired = equity * (defaults.default_risk_pct / 100)
    if (desired <= 0) return { suggested: null, capped: false, capLabel: null }

    // Capping logic: when cap_by_prop_rule is on and the account has rules,
    // take the min of desired vs. each cap.
    let final = desired
    let capLabel: string | null = null
    if (defaults.cap_by_prop_rule) {
      const cap = defaults.account_risk_caps[accountId]
      if (cap) {
        if (cap.max_risk_per_trade_usd != null && cap.max_risk_per_trade_usd < final) {
          final = cap.max_risk_per_trade_usd
          capLabel = `capped at $${cap.max_risk_per_trade_usd.toFixed(0)} per-trade cap`
        }
        if (cap.max_risk_per_trade_pct != null) {
          const usdCap = equity * (cap.max_risk_per_trade_pct / 100)
          if (usdCap < final) {
            final = usdCap
            capLabel = `capped at ${cap.max_risk_per_trade_pct}% rule`
          }
        }
      }
    }

    return {
      suggested: Math.round(final * 100) / 100,
      capped: capLabel != null,
      capLabel,
    }
  }, [accounts, accountId, defaults.sizing_method, defaults.default_risk_pct, defaults.cap_by_prop_rule, defaults.account_risk_caps])

  const suggestedRiskUsd = sizing.suggested

  // Close on success
  useEffect(() => {
    if (state?.ok) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.ok])

  // Live R + PnL preview
  const preview = useMemo(() => {
    const e = parseFloat(entry); const s = parseFloat(stop); const t = parseFloat(target)
    const x = parseFloat(exit); const sz = parseFloat(size)
    const plannedR = !isNaN(e) && !isNaN(s) && !isNaN(t)
      ? computeR({ side, entry: e, stop: s, exit: t })
      : null
    const realizedR = status === "closed" && !isNaN(e) && !isNaN(s) && !isNaN(x)
      ? computeR({ side, entry: e, stop: s, exit: x })
      : null
    const realizedPnL = status === "closed" && !isNaN(e) && !isNaN(x) && !isNaN(sz)
      ? computePnL({ side, entry: e, exit: x, size: sz })
      : null
    return { plannedR, realizedR, realizedPnL }
  }, [side, status, entry, stop, target, exit, size])

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
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <form
        action={action}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          // News avoidance: warn when the trade's pair currencies collide with
          // an upcoming high-impact event inside the user's warn window.
          // Pending orders skip this — they fill later, news is irrelevant now.
          if (status !== "pending" && defaults.news_avoidance.enabled && defaults.news_avoidance.events.length > 0) {
            const ccys = pair.split("/").map((c) => c.trim().toUpperCase()).filter(Boolean)
            const colliding = defaults.news_avoidance.events.filter((ev) => ccys.includes(ev.currency.toUpperCase()))
            if (colliding.length > 0) {
              const now = Date.now()
              const lines = colliding.map((ev) => {
                const t = new Date(ev.scheduled_at).getTime()
                const diffMin = Math.round((t - now) / 60_000)
                const when = diffMin === 0
                  ? "now"
                  : diffMin > 0
                    ? `in ${diffMin}m`
                    : `${Math.abs(diffMin)}m ago`
                return `• ${ev.currency} ${ev.event} (${when})`
              }).join("\n")
              const ok = window.confirm(
                `News-avoidance window: high-impact event${colliding.length > 1 ? "s" : ""} on this pair.\n\n${lines}\n\nSubmit anyway?`,
              )
              if (!ok) {
                e.preventDefault()
                return
              }
            }
          }

          // confirm_above_pct: warn before submit when risk_amount as % of equity
          // exceeds the user's threshold. Pending orders skip this — no risk yet.
          if (status === "pending") return
          const threshold = defaults.confirm_above_pct
          if (!threshold || threshold <= 0) return
          const formEl = e.currentTarget
          const riskInput = formEl.elements.namedItem("risk_amount") as HTMLInputElement | null
          const acctSelect = formEl.elements.namedItem("account_id") as HTMLSelectElement | null
          const risk = parseFloat(riskInput?.value ?? "")
          const acct = accounts.find((a) => a.id === acctSelect?.value)
          if (!risk || !acct) return
          const equity = Number(acct.equity) || 0
          if (equity <= 0) return
          const pct = (risk / equity) * 100
          if (pct < threshold) return
          const ok = window.confirm(
            `Risk ${formatUSD(risk)} is ${pct.toFixed(2)}% of equity (${formatUSD(equity)}) — above your ${threshold}% confirm threshold. Submit anyway?`,
          )
          if (!ok) e.preventDefault()
        }}
        style={{
          width: "min(640px, 100%)",
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
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>
              {status === "pending" ? "Place a pending order" : status === "closed" ? "Log a closed trade" : "Log a trade"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-fg-muted)" }}>
              {status === "pending"
                ? "Limit/stop order at this price. We'll mark it filled when it executes."
                : "Pair, side, prices, size — you can edit later from the Ledger."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Account + status */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <Field label="Account">
              <select name="account_id" value={accountId} onChange={(e) => setAccountId(e.target.value)} required style={inputStyle}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.broker} · {a.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <Segment
                value={status}
                onChange={(v) => setStatus(v)}
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Closed" },
                ]}
              />
              <input type="hidden" name="status" value={status} />
            </Field>
          </div>

          {/* Pair + side */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <Field label="Pair">
              <input
                name="pair"
                value={pair}
                onChange={(e) => setPair(e.target.value.toUpperCase())}
                list="pairs"
                placeholder="EUR/USD"
                required
                style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
              />
              <datalist id="pairs">
                {COMMON_PAIRS.map((p) => <option key={p} value={p} />)}
              </datalist>
              {state && !state.ok && state.fieldErrors?.pair && (
                <FieldError msg={state.fieldErrors.pair[0]} />
              )}
            </Field>
            <Field label="Side">
              <Segment
                value={side}
                onChange={(v) => setSide(v)}
                options={[{ value: "long", label: "Long" }, { value: "short", label: "Short" }]}
                tone="side"
              />
              <input type="hidden" name="side" value={side} />
            </Field>
          </div>

          {/* Prices */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label={status === "pending" ? "Limit / stop price" : "Entry"}>
              <input name="entry_price" value={entry} onChange={(e) => setEntry(e.target.value)} type="number" step="any" required placeholder="1.08412" style={priceInput} />
              {state && !state.ok && state.fieldErrors?.entry_price && <FieldError msg={state.fieldErrors.entry_price[0]} />}
            </Field>
            <Field label="Stop">
              <input name="stop_price" value={stop} onChange={(e) => setStop(e.target.value)} type="number" step="any" placeholder="1.08200" style={priceInput} />
            </Field>
            <Field label="Target">
              <input name="target_price" value={target} onChange={(e) => setTarget(e.target.value)} type="number" step="any" placeholder="1.08800" style={priceInput} />
            </Field>
          </div>

          {/* Size + risk + (exit if closed) */}
          <div style={{ display: "grid", gridTemplateColumns: status === "closed" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10 }}>
            <Field label="Size (units)">
              <input name="size" value={size} onChange={(e) => setSize(e.target.value)} type="number" step="any" required placeholder="10000" style={priceInput} />
              {state && !state.ok && state.fieldErrors?.size && <FieldError msg={state.fieldErrors.size[0]} />}
            </Field>
            <Field label="Risk ($)">
              <input
                key={`risk-${accountId}-${suggestedRiskUsd ?? ""}`}
                name="risk_amount"
                type="number" step="any"
                defaultValue={suggestedRiskUsd != null ? suggestedRiskUsd.toFixed(2) : ""}
                placeholder={suggestedRiskUsd != null ? `${defaults.default_risk_pct}% of equity` : "200"}
                style={priceInput}
              />
              {sizing.capped && sizing.capLabel && (
                <span style={{ fontSize: 10.5, color: "var(--c-amber)", marginTop: 2 }}>
                  <Icon name="info" size={9} /> {sizing.capLabel}
                </span>
              )}
            </Field>
            {status === "closed" && (
              <Field label="Exit price">
                <input name="exit_price" value={exit} onChange={(e) => setExit(e.target.value)} type="number" step="any" placeholder="1.08600" style={priceInput} />
              </Field>
            )}
          </div>

          {/* Live preview */}
          <div style={{
            background: "var(--c-bg-elev-2)",
            border: "1px solid var(--c-border)",
            borderRadius: 10,
            padding: "10px 12px",
            display: "flex",
            gap: 18,
            fontSize: 12,
            color: "var(--c-fg-muted)",
          }}>
            <Stat label="Planned R" value={preview.plannedR != null ? `${preview.plannedR}R` : "—"} />
            <Stat
              label={status === "closed" ? "Realized R" : "—"}
              value={preview.realizedR != null ? `${preview.realizedR}R` : "—"}
              tone={preview.realizedR != null && preview.realizedR > 0 ? "green" : preview.realizedR != null && preview.realizedR < 0 ? "red" : undefined}
            />
            <Stat
              label="Realized P&L"
              value={preview.realizedPnL != null ? formatUSD(preview.realizedPnL, { signed: true }) : "—"}
              tone={preview.realizedPnL != null && preview.realizedPnL > 0 ? "green" : preview.realizedPnL != null && preview.realizedPnL < 0 ? "red" : undefined}
            />
          </div>

          {/* Playbook + mood */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Playbook (optional)">
              <select name="playbook_id" defaultValue={defaults.default_playbook_id ?? ""} style={inputStyle}>
                <option value="">—</option>
                {playbooks.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label={defaults.require_journal_mood ? "Mood *" : "Mood"}>
              <select name="mood" defaultValue="" required={defaults.require_journal_mood} style={inputStyle}>
                <option value="">{defaults.require_journal_mood ? "— pick one —" : "—"}</option>
                {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              {state && !state.ok && state.fieldErrors?.mood && (
                <FieldError msg={state.fieldErrors.mood[0]} />
              )}
            </Field>
          </div>

          {/* Tags */}
          <Field label="Tags (comma-separated)">
            <input name="tags" placeholder="A+ setup, high conviction" style={inputStyle} />
          </Field>

          {/* Notes */}
          <Field label={defaults.require_journal_note ? "Notes (becomes a journal entry) *" : "Notes (becomes a journal entry)"}>
            <textarea
              name="notes"
              rows={3}
              required={defaults.require_journal_note}
              placeholder={defaults.require_journal_note ? "Required by your settings — why are you in?" : "Why are you in? What's the thesis?"}
              style={{ ...inputStyle, resize: "vertical", minHeight: 64, fontFamily: "var(--font-body)" }}
            />
            {state && !state.ok && state.fieldErrors?.notes && (
              <FieldError msg={state.fieldErrors.notes[0]} />
            )}
          </Field>

          {state && !state.ok && (
            <div style={{ fontSize: 12, color: "var(--c-red-bright)" }}>{state.error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid var(--c-border)", background: "var(--c-bg-elev-1)" }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            <Icon name="plus" size={13} />
            <span>{pending ? "Saving…" : status === "pending" ? "Place order" : "Log trade"}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

// ── small bits ──────────────────────────────────────────────────────────────

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

function FieldError({ msg }: { msg: string }) {
  return <span style={{ fontSize: 11, color: "var(--c-red-bright)" }}>{msg}</span>
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  const color = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg)"
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 10, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color }}>{value}</span>
    </div>
  )
}

function Segment<T extends string>({
  value, onChange, options, tone,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  tone?: "side"
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 3, background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 3 }}>
      {options.map((o) => {
        const active = value === o.value
        const sideTone = tone === "side"
          ? o.value === "long" ? "var(--c-green-bright)" : "var(--c-red-bright)"
          : "var(--c-fg)"
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: "6px 8px", borderRadius: 6, border: "none",
              background: active ? "var(--c-bg-elev-3)" : "transparent",
              color: active ? sideTone : "var(--c-fg-muted)",
              fontSize: 12, fontWeight: 500,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
