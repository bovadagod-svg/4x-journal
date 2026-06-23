"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { useDateFmt } from "@/lib/timezone-context"
import {
  disconnectTradeLockerConnection,
  reimportTradeLockerConnection,
  syncTradeLockerConnection,
} from "@/lib/actions/tradelocker"

export function SyncTradeLockerButton({ connectionId, lastSyncedAt, lastStatus, lastError, tradesSynced }: {
  connectionId: string
  lastSyncedAt: string | null
  lastStatus: string | null
  lastError: string | null
  tradesSynced: number
}) {
  const router = useRouter()
  const fmt = useDateFmt()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ kind: "ok"; n: number; debug?: unknown } | { kind: "err"; msg: string; debug?: unknown } | null>(null)

  const onSync = () => {
    setResult(null)
    startTransition(async () => {
      const r = await syncTradeLockerConnection(connectionId)
      if (r.ok) {
        setResult({ kind: "ok", n: r.tradesUpserted ?? 0, debug: (r.tradesUpserted ?? 0) === 0 ? r.attempts : undefined })
      } else {
        setResult({ kind: "err", msg: r.error ?? "Sync failed.", debug: r.debug })
      }
      router.refresh()
    })
  }

  const onDisconnect = () => {
    const wipe = confirm("Disconnect this TradeLocker account?\n\nClick OK to disconnect AND delete all synced trades.\nClick Cancel and use 'Disconnect (keep trades)' button to keep them.")
    if (!wipe) return
    startTransition(async () => {
      await disconnectTradeLockerConnection(connectionId, { deleteTrades: true })
      router.refresh()
    })
  }

  const onReimport = () => {
    if (!confirm("Wipe and re-import all TradeLocker trades for this account?\n\nUse this when the importer has been upgraded (e.g. better scale-out tracking) and you want existing trades to pick up the new shape. Manual trades aren't touched. Your journal entries linked to wiped trades will lose their trade_id link but the entry text stays.")) return
    setResult(null)
    startTransition(async () => {
      const r = await reimportTradeLockerConnection(connectionId)
      if (r.ok) {
        setResult({ kind: "ok", n: r.tradesUpserted ?? 0 })
      } else {
        setResult({ kind: "err", msg: r.error ?? "Re-import failed." })
      }
      router.refresh()
    })
  }

  const onDisconnectKeep = () => {
    if (!confirm("Disconnect TradeLocker but keep synced trades in your ledger?")) return
    startTransition(async () => {
      await disconnectTradeLockerConnection(connectionId, { deleteTrades: false })
      router.refresh()
    })
  }

  const tone =
    lastStatus === "ok" ? "var(--c-green-bright)"
    : lastStatus === "error" ? "var(--c-red-bright)"
    : lastStatus === "syncing" ? "var(--c-amber)"
    : "var(--c-fg-muted)"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--c-fg-muted)" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone }} />
        <span>
          {lastSyncedAt
            ? `Last synced ${fmt.dateTime(lastSyncedAt)}`
            : "Not synced yet"}
          {tradesSynced > 0 && ` · ${tradesSynced} trades imported`}
        </span>
      </div>

      {lastStatus === "error" && lastError && (
        <div style={{ fontSize: 11, color: "var(--c-red-bright)", lineHeight: 1.4 }}>
          {lastError}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={onSync} disabled={pending} className="btn" style={{ flex: 1, justifyContent: "center" }}>
          <Icon name="refresh" size={12} />
          <span>{pending ? "Syncing…" : "Sync now"}</span>
        </button>
        <button onClick={onDisconnectKeep} disabled={pending} className="btn" title="Disconnect, keep trades">
          <Icon name="x" size={12} />
        </button>
      </div>

      {result?.kind === "ok" && (
        <div style={{ fontSize: 11, color: result.n > 0 ? "var(--c-green-bright)" : "var(--c-amber)" }}>
          {result.n > 0
            ? `✓ ${result.n} trade${result.n === 1 ? "" : "s"} upserted.`
            : "Sync ran but no trades found. Either the account is empty or the API path is wrong — see Raw API response below."}
          {result.debug != null && (
            <details style={{ marginTop: 4 }}>
              <summary style={{ cursor: "pointer", color: "var(--c-fg-muted)" }}>Raw API response (paste this back to debug)</summary>
              <pre style={{ margin: "4px 0 0", fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 320, overflow: "auto", color: "var(--c-fg)" }}>
                {JSON.stringify(result.debug, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
      {result?.kind === "err" && (
        <div style={{ fontSize: 11, color: "var(--c-red-bright)", lineHeight: 1.5 }}>
          {result.msg}
          {result.debug != null && (
            <details style={{ marginTop: 4 }}>
              <summary style={{ cursor: "pointer" }}>Raw response</summary>
              <pre style={{ margin: "4px 0 0", fontSize: 10, fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 240, overflow: "auto" }}>
                {JSON.stringify(result.debug, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      <button
        onClick={onReimport}
        disabled={pending}
        style={{ background: "none", border: "none", color: "var(--c-amber)", fontSize: 11, padding: 0, textAlign: "left", cursor: "pointer", marginTop: 4 }}
        title="Wipe synced TL trades and re-fetch from broker. Useful after importer upgrades (e.g. scale-out tracking)."
      >
        ↻ Re-import all trades from TradeLocker
      </button>

      {/* keep the destructive variant available but visually de-emphasized */}
      <button onClick={onDisconnect} disabled={pending} style={{ background: "none", border: "none", color: "var(--c-fg-dim)", fontSize: 10, padding: 0, textAlign: "left", cursor: "pointer" }}>
        Disconnect &amp; wipe synced trades
      </button>
    </div>
  )
}
