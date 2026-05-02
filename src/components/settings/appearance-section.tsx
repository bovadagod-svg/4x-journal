"use client"

import { useTweaks } from "@/lib/tweaks/tweaks-context"
import type { Accent, Density, Theme } from "@/lib/tweaks/types"

const THEMES: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
]
const ACCENTS: { value: Accent; label: string }[] = [
  { value: "purple", label: "Purple" },
  { value: "green", label: "Green" },
  { value: "red", label: "Red" },
]
const DENSITIES: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "regular", label: "Regular" },
  { value: "spacious", label: "Spacious" },
]

export function AppearanceSection() {
  const { tweaks, setTweak } = useTweaks()
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Row label="Theme">
        <Segment value={tweaks.theme} options={THEMES} onChange={(v) => setTweak("theme", v)} />
      </Row>
      <Row label="Accent">
        <Segment value={tweaks.accent} options={ACCENTS} onChange={(v) => setTweak("accent", v)} />
      </Row>
      <Row label="Density">
        <Segment value={tweaks.density} options={DENSITIES} onChange={(v) => setTweak("density", v)} />
      </Row>
      <p style={{ margin: 0, fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
        Saved to your account · synced across devices.
      </p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 12.5, color: "var(--c-fg-muted)" }}>{label}</span>
      <div>{children}</div>
    </div>
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
    <div style={{ display: "inline-grid", gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 4, background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 3 }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: "6px 14px", borderRadius: 6, border: "none",
            background: value === o.value ? "var(--c-bg-elev-3)" : "transparent",
            color: value === o.value ? "var(--c-fg)" : "var(--c-fg-muted)",
            fontSize: 12, fontWeight: 500,
            minWidth: 80,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
