"use client"

import { useState } from "react"
import { Icon } from "@/components/icons"
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

export function TweaksPanel() {
  const [open, setOpen] = useState(false)
  const { tweaks, setTweak } = useTweaks()

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Tweaks"
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "var(--c-bg-elev-2)",
          border: "1px solid var(--c-border-strong)",
          color: "var(--c-fg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          zIndex: 80,
        }}
      >
        <Icon name="settings" size={18} />
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 72,
            width: 280,
            background: "var(--c-bg-elev-1)",
            border: "1px solid var(--c-border-strong)",
            borderRadius: 14,
            padding: 14,
            boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
            zIndex: 80,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <Section label="Theme">
            <Segment value={tweaks.theme} options={THEMES} onChange={(v) => setTweak("theme", v)} />
          </Section>
          <Section label="Accent">
            <Segment value={tweaks.accent} options={ACCENTS} onChange={(v) => setTweak("accent", v)} />
          </Section>
          <Section label="Density">
            <Segment value={tweaks.density} options={DENSITIES} onChange={(v) => setTweak("density", v)} />
          </Section>
          <p style={{ margin: 0, fontSize: 11, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
            Saved to your account · synced across devices.
          </p>
        </div>
      )}
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 10.5,
          color: "var(--c-fg-dim)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  )
}

function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: 4,
        background: "var(--c-bg-elev-2)",
        border: "1px solid var(--c-border)",
        borderRadius: 8,
        padding: 3,
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: "6px 8px",
            borderRadius: 6,
            border: "none",
            background: value === o.value ? "var(--c-bg-elev-3)" : "transparent",
            color: value === o.value ? "var(--c-fg)" : "var(--c-fg-muted)",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
