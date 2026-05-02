"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { closeTrade, deleteTrade } from "@/lib/actions/trades"
import { useJournalDrawer } from "@/components/journal/journal-drawer-context"

export function TradeRowActions({ tradeId, status }: { tradeId: string; status: string }) {
  const { openForTrade } = useJournalDrawer()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [closing, setClosing] = useState(false)
  const [exitPrice, setExitPrice] = useState("")

  const onClose = () => {
    if (!exitPrice) return
    const fd = new FormData()
    fd.set("id", tradeId)
    fd.set("exit_price", exitPrice)
    startTransition(async () => {
      const r = await closeTrade(fd)
      if (r.ok) {
        setClosing(false)
        setExitPrice("")
        router.refresh()
      }
    })
  }

  const onDelete = () => {
    if (!confirm("Delete this trade?")) return
    startTransition(async () => {
      await deleteTrade(tradeId)
      router.refresh()
    })
  }

  if (closing) {
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input
          type="number"
          step="any"
          autoFocus
          placeholder="Exit price"
          value={exitPrice}
          onChange={(e) => setExitPrice(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onClose()
            if (e.key === "Escape") setClosing(false)
          }}
          style={{
            width: 100, padding: "4px 8px",
            background: "var(--c-bg-elev-2)",
            border: "1px solid var(--c-accent-bright)",
            borderRadius: 6,
            color: "var(--c-fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        />
        <button onClick={onClose} disabled={pending} style={miniBtnPrimary}>✓</button>
        <button onClick={() => { setClosing(false); setExitPrice("") }} style={miniBtn}>✕</button>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", gap: 4 }}>
      <button onClick={() => openForTrade(tradeId)} title="Open journal entry" style={miniBtn}>
        <Icon name="journal" size={12} />
      </button>
      {status === "open" && (
        <button onClick={() => setClosing(true)} title="Close trade" style={miniBtn}>
          <Icon name="check" size={12} />
        </button>
      )}
      <button onClick={onDelete} disabled={pending} title="Delete trade" style={miniBtn}>
        <Icon name="x" size={12} />
      </button>
    </div>
  )
}

const miniBtn: React.CSSProperties = {
  width: 26, height: 26, display: "grid", placeItems: "center",
  background: "var(--c-bg-elev-3)",
  border: "1px solid var(--c-border)",
  borderRadius: 6,
  color: "var(--c-fg-muted)",
}
const miniBtnPrimary: React.CSSProperties = {
  ...miniBtn,
  background: "var(--c-accent)",
  borderColor: "var(--c-accent-bright)",
  color: "#fff",
}
