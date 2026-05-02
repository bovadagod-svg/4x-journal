"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { updateNotifications, type SettingsFormState } from "@/lib/actions/settings"
import { SettingsSection, SettingsRow, Toggle, SaveBar, useDirty, inputStyle } from "./settings-primitives"

export type NotificationsState = {
  notify_daily_dd: boolean
  notify_rules_violation: boolean
  notify_payout: boolean
  notify_weekly_report: boolean
  notify_news: boolean
  notify_coach: boolean
  email_digest: string
}

export function NotificationsPanel({ initial }: { initial: NotificationsState }) {
  const router = useRouter()
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateNotifications, undefined)
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

  const set = <K extends keyof NotificationsState>(key: K, value: NotificationsState[K]) =>
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

      <SettingsSection icon="bell" title="Trading alerts" subtitle="When should we tap you on the shoulder?">
        <SettingsRow label="Approaching daily drawdown" hint="Alert at 80% of max daily loss">
          <Toggle name="notify_daily_dd" checked={tracker.current.notify_daily_dd} onChange={(v) => set("notify_daily_dd", v)} />
        </SettingsRow>
        <SettingsRow label="Risk rule violation" hint="Pre-flight blocks attempted trades that exceed caps">
          <Toggle name="notify_rules_violation" checked={tracker.current.notify_rules_violation} onChange={(v) => set("notify_rules_violation", v)} />
        </SettingsRow>
        <SettingsRow label="Payout eligible" hint="When a funded account hits payout thresholds">
          <Toggle name="notify_payout" checked={tracker.current.notify_payout} onChange={(v) => set("notify_payout", v)} />
        </SettingsRow>
        <SettingsRow label="High-impact news within 30 min" hint="Heads-up before a red-folder release on a watchlist currency" last>
          <Toggle name="notify_news" checked={tracker.current.notify_news} onChange={(v) => set("notify_news", v)} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection icon="sparkle" title="Reports & coaching">
        <SettingsRow label="Weekly performance report" hint="Sent every Sunday">
          <Toggle name="notify_weekly_report" checked={tracker.current.notify_weekly_report} onChange={(v) => set("notify_weekly_report", v)} />
        </SettingsRow>
        <SettingsRow label="Coach AI insights" hint="Daily summary of your edges and leaks">
          <Toggle name="notify_coach" checked={tracker.current.notify_coach} onChange={(v) => set("notify_coach", v)} />
        </SettingsRow>
        <SettingsRow label="Email digest frequency" last>
          <select name="email_digest" value={tracker.current.email_digest} onChange={(e) => set("email_digest", e.target.value)} style={{ ...inputStyle, width: 140, cursor: "pointer" }}>
            <option value="off">Off</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </SettingsRow>
      </SettingsSection>

      <div className="card" style={{ padding: 14, background: "rgba(105, 50, 212, 0.06)", border: "1px solid rgba(105, 50, 212, 0.2)", display: "flex", gap: 12, alignItems: "flex-start", fontSize: 12, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--c-purple-bright)", marginTop: 5, flexShrink: 0 }} />
        <span>
          Push notifications and email delivery roll out in Phase 10. Your preferences here will activate the moment the channels go live.
        </span>
      </div>
    </form>
  )
}
