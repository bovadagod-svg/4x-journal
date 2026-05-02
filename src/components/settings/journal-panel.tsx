"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { updateJournal, type SettingsFormState } from "@/lib/actions/settings"
import { SettingsSection, SettingsRow, Toggle, SaveBar, useDirty, inputStyle } from "./settings-primitives"

export type JournalState = {
  require_journal_note: boolean
  require_journal_screenshot: boolean
  require_journal_mood: boolean
  journal_timezone_mode: "broker" | "local" | "utc"
  default_playbook_id: string | null
}

export function JournalPanel({
  initial, playbooks,
}: {
  initial: JournalState
  playbooks: Array<{ id: string; name: string; color: string }>
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateJournal, undefined)
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

  const set = <K extends keyof JournalState>(key: K, value: JournalState[K]) =>
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

      <SettingsSection icon="journal" title="Journal defaults" subtitle="What the entry editor expects from each trade">
        <SettingsRow label="Require trade note" hint="Block save if the pre-trade note is empty">
          <Toggle name="require_journal_note" checked={tracker.current.require_journal_note} onChange={(v) => set("require_journal_note", v)} />
        </SettingsRow>
        <SettingsRow label="Require screenshot" hint="Attach at least one chart capture per trade">
          <Toggle name="require_journal_screenshot" checked={tracker.current.require_journal_screenshot} onChange={(v) => set("require_journal_screenshot", v)} />
        </SettingsRow>
        <SettingsRow label="Require mood tag" hint="Pick how you felt before/during the trade">
          <Toggle name="require_journal_mood" checked={tracker.current.require_journal_mood} onChange={(v) => set("require_journal_mood", v)} />
        </SettingsRow>
        <SettingsRow label="Default playbook" hint="Pre-selected when you log a new trade">
          <select
            name="default_playbook_id"
            value={tracker.current.default_playbook_id ?? ""}
            onChange={(e) => set("default_playbook_id", e.target.value || null)}
            style={{ ...inputStyle, width: 240, cursor: "pointer" }}
          >
            <option value="">— None —</option>
            {playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </SettingsRow>
        <SettingsRow label="Time displayed in journal" hint="Use broker server time, your local zone, or UTC" last>
          <select
            name="journal_timezone_mode"
            value={tracker.current.journal_timezone_mode}
            onChange={(e) => set("journal_timezone_mode", e.target.value as JournalState["journal_timezone_mode"])}
            style={{ ...inputStyle, width: 200, cursor: "pointer" }}
          >
            <option value="broker">Broker server time</option>
            <option value="local">My local timezone</option>
            <option value="utc">UTC</option>
          </select>
        </SettingsRow>
      </SettingsSection>

      <div className="card" style={{ padding: 14, background: "rgba(105, 50, 212, 0.06)", border: "1px solid rgba(105, 50, 212, 0.2)", display: "flex", gap: 12, alignItems: "flex-start", fontSize: 12, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
        <Icon name="info" size={14} color="var(--c-purple-bright)" />
        <span>
          The Log Trade modal and entry-editor drawer read these defaults on next open. Required-field enforcement is soft today (warns on save) — hard blocks land in Phase 10.
        </span>
      </div>
    </form>
  )
}
