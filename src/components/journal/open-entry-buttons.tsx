"use client"

import { Icon } from "@/components/icons"
import { useJournalDrawer } from "./journal-drawer-context"

export function OpenTradeEntryButton({ tradeId }: { tradeId: string }) {
  const { openForTrade } = useJournalDrawer()
  return (
    <button onClick={() => openForTrade(tradeId)} className="btn" title="Open journal entry" style={{ width: 28, height: 28, padding: 0, justifyContent: "center" }}>
      <Icon name="journal" size={12} />
    </button>
  )
}

export function OpenJournalEntryButton({ entryId, label }: { entryId: string; label?: string }) {
  const { open } = useJournalDrawer()
  if (label) {
    return (
      <button onClick={() => open(entryId)} className="btn" style={{ fontSize: 12 }}>
        <Icon name="edit" size={12} />
        <span>{label}</span>
      </button>
    )
  }
  return (
    <button onClick={() => open(entryId)} aria-label="Open entry" style={{
      width: 28, height: 28, padding: 0,
      background: "var(--c-bg-elev-3)",
      border: "1px solid var(--c-border)",
      borderRadius: 6, color: "var(--c-fg-muted)",
      display: "grid", placeItems: "center",
      cursor: "pointer",
    }}>
      <Icon name="edit" size={12} />
    </button>
  )
}

export function OpenEntryRowWrapper({
  entryId,
  tradeId,
  children,
}: {
  entryId?: string
  tradeId?: string
  children: React.ReactNode
}) {
  const { open, openForTrade } = useJournalDrawer()
  const onClick = () => {
    if (entryId) open(entryId)
    else if (tradeId) openForTrade(tradeId)
  }
  return (
    <div onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } }}
      style={{ cursor: "pointer", outline: "none" }}
    >
      {children}
    </div>
  )
}
