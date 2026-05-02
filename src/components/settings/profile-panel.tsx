"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { updateProfile, type SettingsFormState } from "@/lib/actions/settings"
import { SettingsSection, SettingsRow, SaveBar, useDirty, inputStyle } from "./settings-primitives"

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Europe/Paris",
  "Asia/Tokyo", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Dubai",
  "Australia/Sydney",
  "UTC",
]

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD"]

export function ProfilePanel({
  email, userId, initial,
}: {
  email: string
  userId: string
  initial: { display_name: string | null; handle: string | null; timezone: string; display_currency: string }
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateProfile, undefined)
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

  const set = <K extends keyof typeof tracker.current>(key: K, value: (typeof tracker.current)[K]) =>
    tracker.set({ ...tracker.current, [key]: value })

  const initials = (tracker.current.display_name?.trim() || email.split("@")[0])
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SaveBar
        dirty={tracker.dirty}
        pending={pending}
        savedFlash={savedFlash}
        error={state && !state.ok ? state.error : undefined}
        onReset={tracker.reset}
      />

      <SettingsSection icon="user" title="Profile" subtitle="How you show up in 4x Journal">
        {/* Avatar header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 0 16px", borderBottom: "1px solid var(--c-border)", marginBottom: 8 }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: "linear-gradient(135deg, #6932D4, #B79CFF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 600, color: "#fff", fontFamily: "var(--font-display)",
          }}>{initials || "?"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>
              {tracker.current.display_name || email.split("@")[0]}
            </div>
            <div style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>
              {tracker.current.handle ? `@${tracker.current.handle.replace(/^@/, "")}` : email} · Free plan
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 2 }}>
              {userId}
            </div>
          </div>
        </div>

        <SettingsRow label="Display name" hint="Shown next to journal entries you share">
          <input
            name="display_name"
            value={tracker.current.display_name ?? ""}
            onChange={(e) => set("display_name", e.target.value)}
            placeholder={email.split("@")[0]}
            style={{ ...inputStyle, width: 260 }}
          />
        </SettingsRow>
        <SettingsRow label="Username" hint="For shareable journal links (alphanumeric + dashes)">
          <input
            name="handle"
            value={tracker.current.handle ?? ""}
            onChange={(e) => set("handle", e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
            placeholder="your-handle"
            style={{ ...inputStyle, width: 220, fontFamily: "var(--font-mono)" }}
          />
        </SettingsRow>
        <SettingsRow label="Email" hint="Sign-in email — change via Auth (coming soon)">
          <span className="mono" style={{ fontSize: 12.5, color: "var(--c-fg-muted)" }}>{email}</span>
        </SettingsRow>
        <SettingsRow label="Timezone" hint="All session times and economic calendar use this">
          <select name="timezone" value={tracker.current.timezone} onChange={(e) => set("timezone", e.target.value)} style={{ ...inputStyle, width: 220, cursor: "pointer" }}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </SettingsRow>
        <SettingsRow label="Display currency" hint="P&L conversion across mixed-currency accounts" last>
          <select name="display_currency" value={tracker.current.display_currency} onChange={(e) => set("display_currency", e.target.value)} style={{ ...inputStyle, width: 110, cursor: "pointer" }}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </SettingsRow>
      </SettingsSection>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="btn">
            <Icon name="external" size={12} />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </form>
  )
}
