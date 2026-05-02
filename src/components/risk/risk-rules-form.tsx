"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { upsertRiskRules, deleteRiskRules, type RiskFormState } from "@/lib/actions/risk"
import { PROP_FIRM_TEMPLATES, type RiskRule } from "@/lib/risk-types"
import type { Account } from "@/components/accounts/accounts-context"

export function RiskRulesForm({
  account,
  rules,
}: {
  account: Account
  rules: RiskRule | null
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState<RiskFormState, FormData>(upsertRiskRules, undefined)
  const [enabled, setEnabled] = useState(rules?.enabled ?? true)
  const [riskPct, setRiskPct] = useState<string>(rules?.max_risk_per_trade_pct?.toString() ?? "1")
  const [riskUsd, setRiskUsd] = useState<string>(rules?.max_risk_per_trade_usd?.toString() ?? "")
  const [dailyPct, setDailyPct] = useState<string>(rules?.daily_loss_limit_pct?.toString() ?? "5")
  const [dailyUsd, setDailyUsd] = useState<string>(rules?.daily_loss_limit_usd?.toString() ?? "")
  const [maxOpen, setMaxOpen] = useState<string>(rules?.max_open_positions?.toString() ?? "")
  const [propFirm, setPropFirm] = useState<string>(rules?.prop_firm_template ?? "")
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    if (state?.ok) {
      setSavedFlash(true)
      const t = setTimeout(() => setSavedFlash(false), 2000)
      router.refresh()
      return () => clearTimeout(t)
    }
  }, [state, router])

  const applyTemplate = (key: string) => {
    setPropFirm(key)
    const tpl = PROP_FIRM_TEMPLATES.find((t) => t.key === key)
    if (!tpl) return
    if (tpl.rules.max_risk_per_trade_pct != null) setRiskPct(tpl.rules.max_risk_per_trade_pct.toString())
    if (tpl.rules.daily_loss_limit_pct != null) setDailyPct(tpl.rules.daily_loss_limit_pct.toString())
    if (tpl.rules.max_open_positions != null) setMaxOpen(tpl.rules.max_open_positions.toString())
  }

  const onDelete = async () => {
    if (!confirm(`Remove all risk rules for "${account.label}"?`)) return
    const r = await deleteRiskRules(account.id)
    if (!r.ok) alert(r.error)
    else router.refresh()
  }

  return (
    <form action={action} className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input type="hidden" name="account_id" value={account.id} />
      <input type="hidden" name="enabled" value={enabled ? "true" : ""} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <span style={{ width: 12, height: 12, borderRadius: 4, background: account.color, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)" }}>{account.label}</div>
            <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>{account.broker} · <span style={{ textTransform: "capitalize" }}>{account.status}</span></div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className="btn"
          style={{
            background: enabled ? "var(--c-green-soft)" : "var(--c-bg-elev-3)",
            color: enabled ? "var(--c-green-bright)" : "var(--c-fg-muted)",
            borderColor: enabled ? "rgba(17, 196, 88, 0.25)" : "var(--c-border)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: enabled ? "var(--c-green-bright)" : "var(--c-fg-dim)" }} />
          {enabled ? "Active" : "Disabled"}
        </button>
      </div>

      {/* Templates */}
      <Field label="Prop firm template (optional)">
        <select
          name="prop_firm_template"
          value={propFirm}
          onChange={(e) => applyTemplate(e.target.value)}
          style={inputStyle}
        >
          <option value="">— Custom —</option>
          {PROP_FIRM_TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </Field>

      <Section title="Per trade">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Max risk %">
            <input name="max_risk_per_trade_pct" type="number" step="0.1" min="0" max="100" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} placeholder="1" style={priceInput} />
          </Field>
          <Field label="Max risk $">
            <input name="max_risk_per_trade_usd" type="number" step="any" min="0" value={riskUsd} onChange={(e) => setRiskUsd(e.target.value)} placeholder="—" style={priceInput} />
          </Field>
        </div>
      </Section>

      <Section title="Daily">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Loss limit %">
            <input name="daily_loss_limit_pct" type="number" step="0.1" min="0" max="100" value={dailyPct} onChange={(e) => setDailyPct(e.target.value)} placeholder="5" style={priceInput} />
          </Field>
          <Field label="Loss limit $">
            <input name="daily_loss_limit_usd" type="number" step="any" min="0" value={dailyUsd} onChange={(e) => setDailyUsd(e.target.value)} placeholder="—" style={priceInput} />
          </Field>
          <Field label="Max open positions">
            <input name="max_open_positions" type="number" step="1" min="0" value={maxOpen} onChange={(e) => setMaxOpen(e.target.value)} placeholder="—" style={priceInput} />
          </Field>
        </div>
      </Section>

      {state && !state.ok && (
        <div style={{ fontSize: 12, color: "var(--c-red-bright)" }}>{state.error}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onDelete} className="btn">
          <Icon name="x" size={12} />
          <span>Remove rules</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {savedFlash && <span style={{ fontSize: 11.5, color: "var(--c-green-bright)" }}>Saved.</span>}
          <button type="submit" disabled={pending} className="btn btn-primary">
            <Icon name="check" size={12} />
            <span>{pending ? "Saving…" : rules ? "Save changes" : "Save rules"}</span>
          </button>
        </div>
      </div>
    </form>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: "var(--c-fg-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      {children}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 11, color: "var(--c-fg-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</span>
      {children}
    </div>
  )
}
