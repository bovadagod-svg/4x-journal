"use client"

import { useState, useTransition } from "react"
import { Icon } from "@/components/icons"
import { deleteAccount } from "@/lib/actions/settings"

export function DangerZone({ email }: { email: string }) {
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [, startTransition] = useTransition()

  const onDelete = () => {
    if (confirmText !== email) return
    startTransition(async () => { await deleteAccount() })
  }

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className="btn" style={{ color: "var(--c-red-bright)", borderColor: "rgba(224, 74, 85, 0.35)" }}>
        <Icon name="x" size={12} />
        <span>Delete account…</span>
      </button>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, background: "var(--c-red-soft)", border: "1px solid rgba(224, 74, 85, 0.35)", borderRadius: 10 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--c-fg)", lineHeight: 1.5 }}>
        This wipes <strong>all</strong> your trades, journal entries, accounts, playbooks, watchlist, and rules. There is no undo.
      </p>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--c-fg-muted)" }}>
        Type your email to confirm: <span className="mono" style={{ color: "var(--c-fg)" }}>{email}</span>
      </p>
      <input
        autoFocus
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={email}
        style={{
          padding: "8px 10px", borderRadius: 8,
          background: "var(--c-bg-elev-2)",
          border: "1px solid var(--c-border)",
          color: "var(--c-fg)",
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { setConfirming(false); setConfirmText("") }} className="btn">Cancel</button>
        <button
          onClick={onDelete}
          disabled={confirmText !== email}
          className="btn"
          style={{
            background: "var(--c-red)",
            color: "#fff",
            borderColor: "var(--c-red-bright)",
            opacity: confirmText === email ? 1 : 0.4,
          }}
        >
          <Icon name="x" size={12} />
          <span>Delete forever</span>
        </button>
      </div>
    </div>
  )
}
