"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { updateBehavior, type SettingsFormState } from "@/lib/actions/settings"
import { SettingsSection, SettingsRow, Toggle, NumberSlider, SaveBar, useDirty } from "./settings-primitives"

export type BehaviorState = {
  news_avoidance_enabled: boolean
  news_avoidance_minutes_before: number
  news_avoidance_minutes_after: number
  tilt_enabled: boolean
  tilt_cutoff: number
  tilt_cooldown_hours: number
  coach_auto_tag: boolean
}

export function BehaviorPanel({ initial }: { initial: BehaviorState }) {
  const router = useRouter()
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateBehavior, undefined)
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

  const set = <K extends keyof BehaviorState>(key: K, value: BehaviorState[K]) =>
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

      <SettingsSection icon="bell" title="News avoidance" subtitle="Step away from the desk around scheduled releases">
        <SettingsRow label="Avoid trading around news" hint="Soft warning at log-time when within window of a high-impact event">
          <Toggle name="news_avoidance_enabled" checked={tracker.current.news_avoidance_enabled} onChange={(v) => set("news_avoidance_enabled", v)} />
        </SettingsRow>
        <SettingsRow label="Minutes before release">
          <NumberSlider name="news_avoidance_minutes_before" value={tracker.current.news_avoidance_minutes_before} onChange={(v) => set("news_avoidance_minutes_before", v)} min={0} max={60} step={1} suffix=" min" />
        </SettingsRow>
        <SettingsRow label="Minutes after release" last>
          <NumberSlider name="news_avoidance_minutes_after" value={tracker.current.news_avoidance_minutes_after} onChange={(v) => set("news_avoidance_minutes_after", v)} min={0} max={60} step={1} suffix=" min" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection icon="flame" title="Tilt protection" subtitle="Cool-down after consecutive losses">
        <SettingsRow label="Enable cool-down">
          <Toggle name="tilt_enabled" checked={tracker.current.tilt_enabled} onChange={(v) => set("tilt_enabled", v)} />
        </SettingsRow>
        <SettingsRow label="Trigger after N losses in a row">
          <NumberSlider name="tilt_cutoff" value={tracker.current.tilt_cutoff} onChange={(v) => set("tilt_cutoff", v)} min={2} max={10} step={1} />
        </SettingsRow>
        <SettingsRow label="Cool-down length" hint="Block new trade entries during this window" last>
          <NumberSlider name="tilt_cooldown_hours" value={tracker.current.tilt_cooldown_hours} onChange={(v) => set("tilt_cooldown_hours", v)} min={1} max={24} step={1} suffix=" h" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection icon="sparkle" title="Coach AI auto-tagging" subtitle="Read your prose and suggest tags / mistakes / mood">
        <SettingsRow
          label="Enable auto-tag suggestions"
          hint="Adds a 'Coach: suggest tags' button on the entry editor's Tags tab. Each click costs ~1 cent in API spend; gated behind this toggle to avoid surprise charges. Requires ANTHROPIC_API_KEY set in your environment."
          last
        >
          <Toggle name="coach_auto_tag" checked={tracker.current.coach_auto_tag} onChange={(v) => set("coach_auto_tag", v)} />
        </SettingsRow>
      </SettingsSection>

      <div className="card" style={{ padding: 14, background: "rgba(105, 50, 212, 0.06)", border: "1px solid rgba(105, 50, 212, 0.2)", display: "flex", gap: 12, alignItems: "flex-start", fontSize: 12, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
        <Icon name="info" size={14} color="var(--c-purple-bright)" />
        <span>
          Behavioral signals on the <a href="/risk" style={{ color: "var(--c-purple-bright)" }}>Risk page</a> already surface these patterns. Toggling enforcement here will block trade entry when conditions are met (rolls out in Phase 10 alongside per-symbol caps).
        </span>
      </div>
    </form>
  )
}
