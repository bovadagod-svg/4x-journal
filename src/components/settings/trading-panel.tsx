"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { updateTrading, type SettingsFormState } from "@/lib/actions/settings"
import { SettingsSection, SettingsRow, Toggle, NumberSlider, SaveBar, useDirty, inputStyle } from "./settings-primitives"

export type TradingState = {
  sizing_method: "fixed-risk" | "fixed-lots" | "kelly" | "volatility-scaled"
  default_risk_pct: number
  default_fixed_lots: number
  kelly_fraction: number
  atr_multiplier: number
  atr_period: number
  round_lots_to: number
  cap_by_prop_rule: boolean
  confirm_above_pct: number
}

const METHODS: { id: TradingState["sizing_method"]; label: string; desc: string }[] = [
  { id: "fixed-risk", label: "Fixed % risk", desc: "Risk a constant share of equity. Stop distance determines lots." },
  { id: "fixed-lots", label: "Fixed lots", desc: "Same lot size every trade regardless of stop distance." },
  { id: "kelly", label: "Fractional Kelly", desc: "Size from win-rate × avg R-multiple. Half-Kelly recommended." },
  { id: "volatility-scaled", label: "Volatility-scaled", desc: "Scale lots by ATR so swing per trade is comparable." },
]

export function TradingPanel({ initial }: { initial: TradingState }) {
  const router = useRouter()
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateTrading, undefined)
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

  const set = <K extends keyof TradingState>(key: K, value: TradingState[K]) =>
    tracker.set({ ...tracker.current, [key]: value })

  const m = tracker.current.sizing_method

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SaveBar
        dirty={tracker.dirty}
        pending={pending}
        savedFlash={savedFlash}
        error={state && !state.ok ? state.error : undefined}
        onReset={tracker.reset}
      />

      <SettingsSection icon="target" title="Sizing method" subtitle="How the Log Trade modal pre-fills size">
        <input type="hidden" name="sizing_method" value={tracker.current.sizing_method} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {METHODS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => set("sizing_method", opt.id)}
              style={{
                textAlign: "left", padding: 14,
                background: m === opt.id ? "rgba(105, 50, 212, 0.08)" : "var(--c-bg-elev-2)",
                border: `1px solid ${m === opt.id ? "var(--c-purple-bright)" : "var(--c-border)"}`,
                borderRadius: 10, cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: `2px solid ${m === opt.id ? "var(--c-purple-bright)" : "var(--c-border-strong)"}`,
                  background: m === opt.id ? "var(--c-purple-bright)" : "transparent",
                  boxShadow: m === opt.id ? "inset 0 0 0 2px var(--c-bg-elev-1)" : "none",
                  flexShrink: 0,
                }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.45 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection icon="info" title="Method parameters">
        {m === "fixed-risk" && (
          <SettingsRow label="Default risk per trade" hint="Pre-fills the trade ticket — overridden per trade if needed" last>
            <NumberSlider name="default_risk_pct" value={tracker.current.default_risk_pct} onChange={(v) => set("default_risk_pct", v)} min={0.1} max={3} step={0.1} suffix="%" />
          </SettingsRow>
        )}
        {m === "fixed-lots" && (
          <SettingsRow label="Lots per trade" last>
            <NumberSlider name="default_fixed_lots" value={tracker.current.default_fixed_lots} onChange={(v) => set("default_fixed_lots", v)} min={0.01} max={5} step={0.01} suffix=" lots" />
          </SettingsRow>
        )}
        {m === "kelly" && (
          <SettingsRow label="Kelly fraction" hint="0.25 = quarter-Kelly · 0.5 = half-Kelly · 1.0 = full Kelly (don't)" last>
            <NumberSlider name="kelly_fraction" value={tracker.current.kelly_fraction} onChange={(v) => set("kelly_fraction", v)} min={0.05} max={1} step={0.05} suffix="x" />
          </SettingsRow>
        )}
        {m === "volatility-scaled" && (
          <>
            <SettingsRow label="ATR multiplier for stop">
              <NumberSlider name="atr_multiplier" value={tracker.current.atr_multiplier} onChange={(v) => set("atr_multiplier", v)} min={0.5} max={5} step={0.1} suffix="x ATR" />
            </SettingsRow>
            <SettingsRow label="ATR period" last>
              <NumberSlider name="atr_period" value={tracker.current.atr_period} onChange={(v) => set("atr_period", v)} min={5} max={50} step={1} />
            </SettingsRow>
          </>
        )}
        {/* Hidden carry-throughs so the form posts every value */}
        {m !== "fixed-risk" && <input type="hidden" name="default_risk_pct" value={tracker.current.default_risk_pct} />}
        {m !== "fixed-lots" && <input type="hidden" name="default_fixed_lots" value={tracker.current.default_fixed_lots} />}
        {m !== "kelly" && <input type="hidden" name="kelly_fraction" value={tracker.current.kelly_fraction} />}
        {m !== "volatility-scaled" && (
          <>
            <input type="hidden" name="atr_multiplier" value={tracker.current.atr_multiplier} />
            <input type="hidden" name="atr_period" value={tracker.current.atr_period} />
          </>
        )}
      </SettingsSection>

      <SettingsSection icon="risk" title="Constraints">
        <SettingsRow label="Round lot size to">
          <select
            name="round_lots_to"
            value={String(tracker.current.round_lots_to)}
            onChange={(e) => set("round_lots_to", parseFloat(e.target.value))}
            style={{ ...inputStyle, width: 200, cursor: "pointer" }}
          >
            <option value="0.01">0.01 (micro)</option>
            <option value="0.1">0.1 (mini)</option>
            <option value="1">1.0 (standard)</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Confirm trades above" hint="Show extra confirm dialog for outsized trades">
          <NumberSlider name="confirm_above_pct" value={tracker.current.confirm_above_pct} onChange={(v) => set("confirm_above_pct", v)} min={0} max={5} step={0.1} suffix="%" />
        </SettingsRow>
        <SettingsRow label="Cap by prop firm rules" hint="Never let suggested size violate the active firm's per-account rules" last>
          <Toggle name="cap_by_prop_rule" checked={tracker.current.cap_by_prop_rule} onChange={(v) => set("cap_by_prop_rule", v)} />
        </SettingsRow>
      </SettingsSection>

      <div className="card" style={{ padding: 14, background: "rgba(105, 50, 212, 0.06)", border: "1px solid rgba(105, 50, 212, 0.2)", display: "flex", gap: 12, alignItems: "flex-start", fontSize: 12, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
        <Icon name="info" size={14} color="var(--c-purple-bright)" />
        <span>
          Per-account hard caps live on the <a href="/risk" style={{ color: "var(--c-purple-bright)" }}>Risk page</a>. Daily-loss limits and max-open-position rules are enforced at trade entry regardless of these defaults.
        </span>
      </div>
    </form>
  )
}
