"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { deletePlaybook } from "@/lib/actions/playbooks"
import { formatUSD } from "@/lib/finance"
import { PlaybookFormModal } from "./playbook-form-modal"
import type { Playbook, PlaybookStats } from "@/lib/queries/playbooks"

export function PlaybookCard({ playbook }: { playbook: Playbook & { stats: PlaybookStats } }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  const onDelete = () => {
    const msg = playbook.stats.trades > 0
      ? `Delete "${playbook.name}"? ${playbook.stats.trades} trade${playbook.stats.trades === 1 ? " is" : "s are"} tagged with it; they'll keep their data but lose the link.`
      : `Delete "${playbook.name}"?`
    if (!confirm(msg)) return
    startTransition(async () => {
      const r = await deletePlaybook(playbook.id)
      if (!r.ok) alert(r.error)
      else router.refresh()
    })
  }

  const { stats } = playbook
  const pnlTone = stats.totalPnL > 0 ? "green" : stats.totalPnL < 0 ? "red" : undefined

  return (
    <>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative", overflow: "hidden" }}>
        {/* Color band */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: playbook.color,
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: playbook.color,
            display: "grid", placeItems: "center",
            color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "var(--font-display)",
            flexShrink: 0,
          }}>
            {playbook.name.charAt(0)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {playbook.name}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>
              {playbook.target_r != null ? `Target ${playbook.target_r}R` : "No target set"}
            </div>
          </div>
        </div>

        {playbook.notes && (
          <p style={{
            margin: 0, fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.5,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {playbook.notes}
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "10px 0", borderTop: "1px solid var(--c-border)", borderBottom: "1px solid var(--c-border)" }}>
          <Stat label="Trades" value={String(stats.trades)} />
          <Stat label="Win rate" value={stats.winRate != null ? `${stats.winRate}%` : "—"} />
          <Stat label="Avg R" value={stats.avgR != null ? `${stats.avgR > 0 ? "+" : ""}${stats.avgR}` : "—"} tone={stats.avgR != null && stats.avgR > 0 ? "green" : stats.avgR != null && stats.avgR < 0 ? "red" : undefined} />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5 }}>
          <span style={{ color: "var(--c-fg-muted)" }}>Total P&L</span>
          <span className="tnum" style={{
            fontFamily: "var(--font-mono)", fontWeight: 600,
            color: pnlTone === "green" ? "var(--c-green-bright)" : pnlTone === "red" ? "var(--c-red-bright)" : "var(--c-fg)",
          }}>
            {stats.closedTrades > 0 ? formatUSD(stats.totalPnL, { signed: true }) : "—"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
          <button onClick={() => setEditing(true)} className="btn" style={{ flex: 1, justifyContent: "center" }}>
            <Icon name="edit" size={12} />
            <span>Edit</span>
          </button>
          <button onClick={onDelete} disabled={pending} className="btn" title="Delete">
            <Icon name="x" size={12} />
          </button>
        </div>
      </div>

      <PlaybookFormModal open={editing} onClose={() => setEditing(false)} playbook={playbook} />
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  const color = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg)"
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500, color }}>{value}</div>
    </div>
  )
}
