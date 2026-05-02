"use client"

import { useState, type ReactNode } from "react"
import { Icon, type IconName } from "@/components/icons"

export function SettingsSection({
  icon, title, subtitle, children,
}: {
  icon: IconName
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={15} color="var(--c-purple-bright)" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{title}</h3>
          {subtitle && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-fg-muted)" }}>{subtitle}</p>}
        </div>
      </div>
      <div style={{ padding: 22 }}>{children}</div>
    </div>
  )
}

export function SettingsRow({
  label, hint, children, last,
}: {
  label: string
  hint?: string
  children: ReactNode
  last?: boolean
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 16, padding: "12px 0",
      borderBottom: last ? "none" : "1px solid var(--c-border)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: "var(--c-fg-muted)", marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

export function Toggle({ checked, onChange, name }: { checked: boolean; onChange: (v: boolean) => void; name?: string }) {
  return (
    <>
      <input type="hidden" name={name} value={checked ? "true" : ""} />
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width: 38, height: 22, borderRadius: 999, border: "none",
          background: checked ? "var(--c-purple-bright)" : "var(--c-bg-elev-3)",
          position: "relative", cursor: "pointer", padding: 0,
          transition: "background 0.15s",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: checked ? 18 : 2,
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          transition: "left 0.15s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }} />
      </button>
    </>
  )
}

export const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  background: "var(--c-bg-elev-2)",
  border: "1px solid var(--c-border)",
  borderRadius: 6,
  fontSize: 12.5,
  color: "var(--c-fg)",
  outline: "none",
}

export function NumberSlider({ value, onChange, name, min, max, step, suffix, width = 160 }: {
  value: number
  onChange: (v: number) => void
  name?: string
  min: number
  max: number
  step: number
  suffix?: string
  width?: number
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {name && <input type="hidden" name={name} value={value} />}
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width, accentColor: "var(--c-purple-bright)" }}
      />
      <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, minWidth: 70, textAlign: "right" }}>
        {value}{suffix ?? ""}
      </span>
    </div>
  )
}

/**
 * Save bar that appears at the top of a section when unsaved changes exist.
 * Subscribes to a "dirty" prop and a submit/reset action pair.
 */
export function SaveBar({
  dirty, pending, savedFlash, error, onReset,
}: {
  dirty: boolean
  pending: boolean
  savedFlash: boolean
  error?: string
  onReset?: () => void
}) {
  if (!dirty && !pending && !savedFlash && !error) return null
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 5,
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px",
      background: error ? "var(--c-red-soft)" : dirty ? "var(--c-amber-soft, rgba(229, 162, 59, 0.08))" : "rgba(17, 196, 88, 0.08)",
      border: `1px solid ${error ? "rgba(190, 51, 61, 0.3)" : dirty ? "rgba(229, 162, 59, 0.3)" : "rgba(17, 196, 88, 0.25)"}`,
      borderRadius: 10,
      fontSize: 12,
    }}>
      {error ? (
        <span style={{ color: "var(--c-red-bright)" }}>{error}</span>
      ) : pending ? (
        <span style={{ color: "var(--c-fg-muted)" }}>Saving…</span>
      ) : dirty ? (
        <span style={{ color: "var(--c-amber)" }}>Unsaved changes</span>
      ) : savedFlash ? (
        <span style={{ color: "var(--c-green-bright)" }}>Saved.</span>
      ) : null}
      {dirty && !pending && (
        <>
          <span style={{ marginLeft: "auto" }}>
            {onReset && <button type="button" onClick={onReset} className="btn" style={{ padding: "4px 10px", fontSize: 11 }}>Reset</button>}
          </span>
          <button type="submit" className="btn btn-primary" style={{ padding: "4px 12px", fontSize: 11 }}>
            <Icon name="check" size={11} /> Save
          </button>
        </>
      )}
    </div>
  )
}

/** Local hook-free dirty tracker — caller compares JSON.stringify */
export function useDirty<T>(initial: T): {
  current: T
  set: (next: T) => void
  reset: () => void
  dirty: boolean
} {
  const [current, setCurrent] = useState<T>(initial)
  return {
    current,
    set: (n) => setCurrent(n),
    reset: () => setCurrent(initial),
    dirty: JSON.stringify(current) !== JSON.stringify(initial),
  }
}
