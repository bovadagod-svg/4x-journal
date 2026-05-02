"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon, PairFlag } from "@/components/icons"
import { removeWatchlistPair, updateWatchlistPair } from "@/lib/actions/watchlist"
import type { WatchlistPair } from "@/lib/queries/watchlist"

const BIASES = [
  { value: "long", label: "Long", color: "var(--c-green-bright)" },
  { value: "short", label: "Short", color: "var(--c-red-bright)" },
  { value: "neutral", label: "Neutral", color: "var(--c-fg-muted)" },
] as const

export function WatchlistRow({ pair }: { pair: WatchlistPair }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editingNote, setEditingNote] = useState(false)
  const [note, setNote] = useState(pair.setup_note ?? "")

  const save = (patch: Partial<{ bias: string; setup_note: string | null }>) => {
    const fd = new FormData()
    fd.set("id", pair.id)
    if (patch.bias != null) fd.set("bias", patch.bias)
    if (patch.setup_note !== undefined) fd.set("setup_note", patch.setup_note ?? "")
    startTransition(async () => {
      await updateWatchlistPair(fd)
      router.refresh()
    })
  }

  const onDelete = () => {
    if (!confirm(`Remove ${pair.pair} from watchlist?`)) return
    startTransition(async () => {
      await removeWatchlistPair(pair.id)
      router.refresh()
    })
  }

  return (
    <tr style={{ borderTop: "1px solid var(--c-border)" }}>
      <td style={{ padding: "12px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PairFlag pair={pair.pair} size={20} />
          <span className="mono" style={{ fontSize: 13.5, fontWeight: 500 }}>{pair.pair}</span>
        </div>
      </td>
      <td style={{ padding: "12px 12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3, background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 3, width: 240 }}>
          {BIASES.map((b) => {
            const active = pair.bias === b.value
            return (
              <button
                key={b.value}
                onClick={() => save({ bias: b.value })}
                style={{
                  padding: "5px 8px", borderRadius: 6, border: "none",
                  background: active ? "var(--c-bg-elev-3)" : "transparent",
                  color: active ? b.color : "var(--c-fg-muted)",
                  fontSize: 12, fontWeight: 500,
                }}
              >
                {b.label}
              </button>
            )
          })}
        </div>
      </td>
      <td style={{ padding: "12px 12px", maxWidth: 480 }}>
        {editingNote ? (
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => { save({ setup_note: note || null }); setEditingNote(false) }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
              if (e.key === "Escape") { setNote(pair.setup_note ?? ""); setEditingNote(false) }
            }}
            placeholder="Pre-session bias / key levels…"
            style={{
              padding: "6px 10px", borderRadius: 8,
              background: "var(--c-bg-elev-2)",
              border: "1px solid var(--c-accent-bright)",
              color: "var(--c-fg)",
              fontSize: 12.5,
              width: "100%",
              outline: "none",
            }}
          />
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            style={{
              background: "transparent", border: "none",
              padding: "6px 0", textAlign: "left",
              color: pair.setup_note ? "var(--c-fg)" : "var(--c-fg-dim)",
              fontSize: 12.5,
              cursor: "text",
              width: "100%",
              fontStyle: pair.setup_note ? "normal" : "italic",
            }}
          >
            {pair.setup_note || "Add note…"}
          </button>
        )}
      </td>
      <td style={{ padding: "12px 18px", textAlign: "right" }}>
        <button onClick={onDelete} className="btn" title="Remove">
          <Icon name="x" size={12} />
        </button>
      </td>
    </tr>
  )
}
