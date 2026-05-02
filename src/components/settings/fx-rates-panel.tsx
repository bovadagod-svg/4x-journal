"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { updateFxRates, type SettingsFormState } from "@/lib/actions/settings"
import type { FxRates } from "@/lib/money"
import { SettingsSection, SettingsRow, SaveBar, useDirty, inputStyle } from "./settings-primitives"

type Row = { from: string; to: string; rate: string }

const COMMON_PAIRS: Row[] = [
  { from: "USD", to: "EUR", rate: "" },
  { from: "USD", to: "GBP", rate: "" },
  { from: "USD", to: "JPY", rate: "" },
  { from: "EUR", to: "USD", rate: "" },
  { from: "GBP", to: "USD", rate: "" },
]

function ratesToRows(rates: FxRates): Row[] {
  return Object.entries(rates).map(([key, value]) => {
    const [from, to] = key.split("->")
    return { from, to, rate: String(value) }
  })
}

function rowsToRates(rows: Row[]): FxRates {
  const out: FxRates = {}
  for (const r of rows) {
    const key = `${r.from.toUpperCase()}->${r.to.toUpperCase()}`
    const num = parseFloat(r.rate)
    if (!Number.isFinite(num) || num <= 0) continue
    out[key] = num
  }
  return out
}

export function FxRatesPanel({ initial, displayCurrency }: { initial: FxRates; displayCurrency: string }) {
  const router = useRouter()
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateFxRates, undefined)
  const initialRows = ratesToRows(initial)
  const tracker = useDirty(initialRows.length > 0 ? initialRows : COMMON_PAIRS)
  const [savedFlash, setSavedFlash] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (state?.ok) {
      setSavedFlash(true)
      const t = setTimeout(() => setSavedFlash(false), 1800)
      router.refresh()
      return () => clearTimeout(t)
    }
  }, [state, router])

  const updateRow = (index: number, patch: Partial<Row>) => {
    tracker.set(tracker.current.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const addRow = () => tracker.set([...tracker.current, { from: "USD", to: "USD", rate: "" }])

  const removeRow = (index: number) => {
    tracker.set(tracker.current.filter((_, i) => i !== index))
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData()
    fd.set("rates", JSON.stringify(rowsToRates(tracker.current)))
    startTransition(() => action(fd))
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SaveBar
        dirty={tracker.dirty}
        pending={pending}
        savedFlash={savedFlash}
        error={state && !state.ok ? state.error : undefined}
        onReset={tracker.reset}
      />

      <SettingsSection
        icon="external"
        title="FX rates"
        subtitle={`Aggregate displays convert into your display currency (${displayCurrency}). Rates you don't set fall back to source currency.`}
      >
        {tracker.current.length === 0 ? (
          <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--c-fg-muted)" }}>
            No rates set yet — single-currency users can leave this empty.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 2fr 36px",
              gap: 8, padding: "0 4px 6px",
              fontSize: 10.5, color: "var(--c-fg-muted)",
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>
              <span>From</span><span>To</span><span>Rate (1 from = N to)</span><span></span>
            </div>
            {tracker.current.map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 36px", gap: 8, alignItems: "center" }}>
                <input
                  value={row.from}
                  onChange={(e) => updateRow(i, { from: e.target.value.toUpperCase().slice(0, 4) })}
                  placeholder="USD"
                  maxLength={4}
                  style={{ ...inputStyle, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}
                />
                <input
                  value={row.to}
                  onChange={(e) => updateRow(i, { to: e.target.value.toUpperCase().slice(0, 4) })}
                  placeholder={displayCurrency}
                  maxLength={4}
                  style={{ ...inputStyle, fontFamily: "var(--font-mono)", textTransform: "uppercase" }}
                />
                <input
                  value={row.rate}
                  onChange={(e) => updateRow(i, { rate: e.target.value })}
                  placeholder="0.79"
                  inputMode="decimal"
                  style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="btn"
                  style={{ padding: "6px 8px" }}
                  aria-label="Remove rate"
                >
                  <Icon name="x" size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--c-border)" }}>
          <button type="button" onClick={addRow} className="btn">
            <Icon name="plus" size={11} /> <span>Add rate</span>
          </button>
          <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>
            Reverse rates auto-derive (USD→GBP gives you GBP→USD too).
          </span>
        </div>
      </SettingsSection>

      <SettingsSection icon="info" title="How it works" subtitle="">
        <div style={{ fontSize: 12, color: "var(--c-fg-muted)", lineHeight: 1.6 }}>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Per-account values (each account card&apos;s balance, equity, P&L) always show in the account&apos;s native currency.</li>
            <li>Aggregate values (Total Equity, YTD Net P&L, Risk page totals) convert each contributing account into your display currency, sum, and show with a chip warning when rates are missing for any source.</li>
            <li>If a rate is missing entirely, the affected accounts fall back to their source currency and a warning chip appears.</li>
            <li>Same-currency entries (USD account when display is USD) skip conversion automatically.</li>
          </ul>
        </div>
      </SettingsSection>
    </form>
  )
}
