"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { deleteAllJournalEntries, resetAnalytics } from "@/lib/actions/settings"
import { SettingsSection, SettingsRow } from "./settings-primitives"
import { DangerZone } from "./danger-zone"

export function DataPanel({ email }: { email: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const onResetAnalytics = () => {
    if (!confirm("Force-recompute analytics? This rebuilds derived stats but keeps every trade and journal entry.")) return
    setBusy("analytics")
    startTransition(async () => {
      await resetAnalytics()
      setBusy(null); setFlash("Analytics refreshed.")
      router.refresh()
      setTimeout(() => setFlash(null), 1800)
    })
  }

  const onDeleteJournal = () => {
    const ok1 = confirm("Delete ALL journal entries? Trades stay, but every note, tag, screenshot, and rule-break flag is removed.")
    if (!ok1) return
    const ok2 = confirm("Are you sure? This cannot be undone.")
    if (!ok2) return
    setBusy("journal")
    startTransition(async () => {
      const r = await deleteAllJournalEntries()
      setBusy(null)
      if (!r.ok) alert(r.error)
      else { setFlash("Journal entries deleted."); router.refresh(); setTimeout(() => setFlash(null), 1800) }
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {flash && (
        <div style={{ padding: "8px 14px", background: "rgba(17, 196, 88, 0.08)", border: "1px solid rgba(17, 196, 88, 0.25)", borderRadius: 10, fontSize: 12, color: "var(--c-green-bright)" }}>
          {flash}
        </div>
      )}

      <SettingsSection icon="external" title="Export data" subtitle="Take everything you've journaled with you">
        <SettingsRow label="Export trade history" hint="CSV of every logged trade with tags, R, P&L">
          <a href="/api/reports/trades?from=2020-01-01&to=2099-12-31&account=all&status=all" className="btn">
            <Icon name="external" size={12} />
            <span>Download CSV</span>
          </a>
        </SettingsRow>
        <SettingsRow label="Export journal entries" hint="CSV with notes, mood, mistakes, lessons" last>
          <a href="/api/reports/journal?from=2020-01-01&to=2099-12-31" className="btn">
            <Icon name="external" size={12} />
            <span>Download CSV</span>
          </a>
        </SettingsRow>
      </SettingsSection>

      <div className="card" style={{ padding: 0, border: "1px solid rgba(190, 51, 61, 0.3)" }}>
        <div style={{ padding: "16px 22px", borderBottom: "1px solid rgba(190, 51, 61, 0.2)", display: "flex", alignItems: "center", gap: 12, background: "rgba(190, 51, 61, 0.04)" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(190, 51, 61, 0.15)", border: "1px solid rgba(190, 51, 61, 0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="flag" size={15} color="var(--c-red-bright)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--c-red-bright)" }}>Danger zone</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--c-fg-muted)" }}>These actions are permanent and cannot be undone</p>
          </div>
        </div>
        <div style={{ padding: 22 }}>
          <SettingsRow label="Refresh analytics" hint="Recompute stats from scratch — keeps every trade and entry">
            <button onClick={onResetAnalytics} disabled={busy === "analytics"} className="btn" style={{ color: "var(--c-amber)", borderColor: "rgba(229, 162, 59, 0.3)" }}>
              {busy === "analytics" ? "Recomputing…" : "Refresh"}
            </button>
          </SettingsRow>
          <SettingsRow label="Delete all journal entries" hint="Removes notes, tags, mistakes, lessons — keeps account-level P&L">
            <button onClick={onDeleteJournal} disabled={busy === "journal"} className="btn" style={{ color: "var(--c-red-bright)", borderColor: "rgba(190, 51, 61, 0.3)" }}>
              {busy === "journal" ? "Deleting…" : "Delete entries"}
            </button>
          </SettingsRow>
          <SettingsRow label="Delete account" hint="Permanently delete your 4x Journal account and all data" last>
            <DangerZone email={email} />
          </SettingsRow>
        </div>
      </div>
    </div>
  )
}
