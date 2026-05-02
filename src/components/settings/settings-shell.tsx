"use client"

import { useState, type ReactNode } from "react"
import { Icon, type IconName } from "@/components/icons"

export type SettingsTabId =
  | "profile"
  | "appearance"
  | "notifications"
  | "trading"
  | "behavior"
  | "journal"
  | "tax"
  | "integrations"
  | "data"
  | "brokers"
  | "risk"

type Item =
  | { group: string }
  | {
      id: SettingsTabId
      label: string
      icon: IconName
      hint?: string
      external?: string
      warn?: boolean
    }

const NAV: Item[] = [
  { group: "Account" },
  { id: "profile", label: "Profile", icon: "user" },
  { id: "appearance", label: "Appearance", icon: "sparkle" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { group: "Trading" },
  { id: "trading", label: "Trading defaults", icon: "target" },
  { id: "behavior", label: "Behavior rules", icon: "flame" },
  { id: "journal", label: "Journal defaults", icon: "journal" },
  { id: "risk", label: "Risk rules", icon: "risk", external: "/risk", hint: "Per-account caps + pre-flight" },
  { group: "Connections" },
  { id: "brokers", label: "Brokers & accounts", icon: "accounts", external: "/accounts", hint: "Connect TradeLocker · CSV import" },
  { id: "integrations", label: "Integrations", icon: "lightning" },
  { group: "Admin" },
  { id: "tax", label: "Tax", icon: "info" },
  { id: "data", label: "Data & danger zone", icon: "flag", warn: true },
]

export function SettingsShell({
  panels, defaultTab = "profile",
}: {
  panels: Partial<Record<SettingsTabId, ReactNode>>
  defaultTab?: SettingsTabId
}) {
  const [tab, setTab] = useState<SettingsTabId>(defaultTab)

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 18, alignItems: "flex-start" }}>
      <nav style={{
        position: "sticky", top: 16,
        display: "flex", flexDirection: "column", gap: 2,
        background: "var(--c-bg-elev-1)",
        border: "1px solid var(--c-border)",
        borderRadius: "var(--radius-lg)",
        padding: 8,
      }}>
        {NAV.map((item, i) => {
          if ("group" in item) {
            return (
              <div key={`g-${item.group}`} style={{
                fontSize: 10, color: "var(--c-fg-dim)",
                textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600,
                padding: i === 0 ? "4px 12px 6px" : "12px 12px 6px",
              }}>
                {item.group}
              </div>
            )
          }
          if (item.external) {
            return (
              <a
                key={item.id}
                href={item.external}
                style={navLink({ active: false, color: "var(--c-fg-muted)" })}
                title={item.hint ?? ""}
              >
                <Icon name={item.icon} size={14} color="var(--c-fg-muted)" />
                <span style={{ flex: 1 }}>{item.label}</span>
                <Icon name="external" size={11} color="var(--c-fg-dim)" />
              </a>
            )
          }
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              style={navLink({ active, color: active ? "var(--c-fg)" : "var(--c-fg-muted)" })}
            >
              <Icon name={item.icon} size={14} color={active ? "var(--c-purple-bright)" : "var(--c-fg-muted)"} />
              <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
              {item.warn && !active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-red-bright)" }} />}
            </button>
          )
        })}
      </nav>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
        {panels[tab] ?? (
          <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
            Section unavailable.
          </div>
        )}
      </div>
    </div>
  )
}

function navLink({ active, color }: { active: boolean; color: string }): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 12px", borderRadius: 8,
    background: active ? "var(--c-bg-elev-3)" : "transparent",
    border: "none",
    color, cursor: "pointer",
    fontSize: 12.5,
    fontWeight: active ? 500 : 400,
    textAlign: "left", width: "100%",
    textDecoration: "none",
  }
}
