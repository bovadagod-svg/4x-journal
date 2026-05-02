"use client"

import { useTweaks } from "@/lib/tweaks/tweaks-context"
import type { Accent, Density, Theme } from "@/lib/tweaks/types"
import { SettingsSection, SettingsRow } from "./settings-primitives"

const THEMES: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
]
const ACCENTS: { value: Accent; label: string; color: string }[] = [
  { value: "purple", label: "Purple", color: "#6932D4" },
  { value: "green", label: "Green", color: "#11C458" },
  { value: "red", label: "Red", color: "#BE333D" },
]
const DENSITIES: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "regular", label: "Regular" },
  { value: "spacious", label: "Spacious" },
]

export function AppearanceSection() {
  const { tweaks, setTweak } = useTweaks()

  return (
    <SettingsSection icon="sparkle" title="Appearance" subtitle="Theme, accent, and information density">
      <SettingsRow label="Theme">
        <Segment value={tweaks.theme} options={THEMES} onChange={(v) => setTweak("theme", v)} />
      </SettingsRow>
      <SettingsRow label="Accent color" hint="Used on primary buttons, the active sidebar item, and chart highlights">
        <div style={{ display: "flex", gap: 8 }}>
          {ACCENTS.map((a) => {
            const active = tweaks.accent === a.value
            return (
              <button
                key={a.value}
                type="button"
                onClick={() => setTweak("accent", a.value)}
                title={a.label}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: a.color,
                  border: active ? "2px solid var(--c-fg)" : "1px solid var(--c-border)",
                  cursor: "pointer", padding: 0,
                  boxShadow: active ? "0 0 0 2px var(--c-bg-elev-1)" : "none",
                }}
              />
            )
          })}
        </div>
      </SettingsRow>
      <SettingsRow label="Density" hint="How tightly information packs in tables and lists" last>
        <Segment value={tweaks.density} options={DENSITIES} onChange={(v) => setTweak("density", v)} />
      </SettingsRow>
    </SettingsSection>
  )
}

function Segment<T extends string>({
  value, options, onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div style={{
      display: "inline-grid",
      gridTemplateColumns: `repeat(${options.length}, 1fr)`,
      gap: 4,
      background: "var(--c-bg-elev-2)",
      border: "1px solid var(--c-border)",
      borderRadius: 8,
      padding: 3,
    }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "none",
            background: value === o.value ? "var(--c-bg-elev-3)" : "transparent",
            color: value === o.value ? "var(--c-fg)" : "var(--c-fg-muted)",
            fontSize: 12, fontWeight: 500,
            minWidth: 80, cursor: "pointer",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
