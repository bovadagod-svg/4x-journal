"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { updateTax, type SettingsFormState } from "@/lib/actions/settings"
import { SettingsSection, SettingsRow, Toggle, NumberSlider, SaveBar, useDirty, inputStyle } from "./settings-primitives"

export type TaxState = {
  tax_jurisdiction: "US" | "UK" | "CA" | "AU" | "SG" | "AE" | "OTHER"
  tax_fx_election: "988" | "1256"
  tax_fiscal_year_start: "January" | "April" | "July" | "October"
  tax_estimated_rate: number
  tax_carry_losses: boolean
}

const ELECTIONS = [
  {
    id: "988" as const,
    title: "Section 988 — ordinary",
    summary: "Default treatment for spot FX. Gains/losses are ordinary income.",
    details: ["Taxed at ordinary income rates", "Losses fully deductible against any income", "Election can be opted out of in writing"],
  },
  {
    id: "1256" as const,
    title: "Section 1256 — 60/40 split",
    summary: "Opt-out election: 60% long-term capital gain, 40% short-term, regardless of holding period.",
    details: ["Lower blended tax rate for many traders", "Mark-to-market at year end", "Election made by attaching a statement to your return"],
  },
]

export function TaxPanel({ initial }: { initial: TaxState }) {
  const router = useRouter()
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateTax, undefined)
  const tracker = useDirty(initial)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    if (state?.ok) {
      setSavedFlash(true)
      const t = setTimeout(() => setSavedFlash(false), 1800)
      router.refresh()
      return () => clearTimeout(t)
    }
  }, [state, router])

  const set = <K extends keyof TaxState>(key: K, value: TaxState[K]) =>
    tracker.set({ ...tracker.current, [key]: value })

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SaveBar
        dirty={tracker.dirty}
        pending={pending}
        savedFlash={savedFlash}
        error={state && !state.ok ? state.error : undefined}
        onReset={tracker.reset}
      />

      <div className="card" style={{ padding: 14, background: "rgba(229, 162, 59, 0.06)", border: "1px solid rgba(229, 162, 59, 0.25)", display: "flex", gap: 12, alignItems: "flex-start", fontSize: 12, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
        <Icon name="info" size={14} color="var(--c-amber)" />
        <span>
          We surface tax-aware reports based on your election, but this isn&apos;t tax advice. Confirm your filing approach with a qualified accountant — IRS election deadlines and conditions matter.
        </span>
      </div>

      <SettingsSection icon="info" title="Jurisdiction">
        <SettingsRow label="Tax residency">
          <select
            name="tax_jurisdiction"
            value={tracker.current.tax_jurisdiction}
            onChange={(e) => set("tax_jurisdiction", e.target.value as TaxState["tax_jurisdiction"])}
            style={{ ...inputStyle, width: 200, cursor: "pointer" }}
          >
            <option value="US">United States</option>
            <option value="UK">United Kingdom</option>
            <option value="CA">Canada</option>
            <option value="AU">Australia</option>
            <option value="SG">Singapore</option>
            <option value="AE">UAE</option>
            <option value="OTHER">Other</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Fiscal year start" last>
          <select
            name="tax_fiscal_year_start"
            value={tracker.current.tax_fiscal_year_start}
            onChange={(e) => set("tax_fiscal_year_start", e.target.value as TaxState["tax_fiscal_year_start"])}
            style={{ ...inputStyle, width: 140, cursor: "pointer" }}
          >
            <option value="January">January</option>
            <option value="April">April</option>
            <option value="July">July</option>
            <option value="October">October</option>
          </select>
        </SettingsRow>
      </SettingsSection>

      {tracker.current.tax_jurisdiction === "US" && (
        <SettingsSection icon="trade" title="Spot FX election" subtitle="IRS treatment for spot forex P&L">
          <input type="hidden" name="tax_fx_election" value={tracker.current.tax_fx_election} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
            {ELECTIONS.map((opt) => {
              const active = tracker.current.tax_fx_election === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => set("tax_fx_election", opt.id)}
                  style={{
                    textAlign: "left", padding: 16,
                    background: active ? "rgba(105, 50, 212, 0.08)" : "var(--c-bg-elev-2)",
                    border: `1px solid ${active ? "var(--c-purple-bright)" : "var(--c-border)"}`,
                    borderRadius: 10, cursor: "pointer",
                    display: "flex", flexDirection: "column", gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: "50%",
                      border: `2px solid ${active ? "var(--c-purple-bright)" : "var(--c-border-strong)"}`,
                      background: active ? "var(--c-purple-bright)" : "transparent",
                      boxShadow: active ? "inset 0 0 0 2px var(--c-bg-elev-1)" : "none",
                      flexShrink: 0,
                    }} />
                    <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-display)" }}>{opt.title}</div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>{opt.summary}</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.6 }}>
                    {opt.details.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </button>
              )
            })}
          </div>
        </SettingsSection>
      )}
      {tracker.current.tax_jurisdiction !== "US" && (
        <input type="hidden" name="tax_fx_election" value={tracker.current.tax_fx_election} />
      )}

      <SettingsSection icon="target" title="Estimated tax">
        <SettingsRow label="Effective rate" hint="Used to compute after-tax P&L in reports">
          <NumberSlider
            name="tax_estimated_rate"
            value={Math.round(tracker.current.tax_estimated_rate * 100)}
            onChange={(v) => set("tax_estimated_rate", v / 100)}
            min={0} max={50} step={1} suffix="%"
          />
        </SettingsRow>
        <SettingsRow label="Carry forward losses" hint="Apply unused losses to next fiscal year automatically" last>
          <Toggle name="tax_carry_losses" checked={tracker.current.tax_carry_losses} onChange={(v) => set("tax_carry_losses", v)} />
        </SettingsRow>
      </SettingsSection>
    </form>
  )
}
