"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { syncAllTradeLockerConnections } from "@/lib/actions/tradelocker"

type Result =
  | { kind: "ok"; connections: number; succeeded: number; failed: number; trades: number }
  | { kind: "err"; msg: string }

/**
 * Header "Sync Trades" button — syncs every connected account at once, instead
 * of one-at-a-time from the Accounts page. Fire-and-forget: kicks off the
 * server sweep, refreshes the route on completion, and flashes a short result
 * summary below the button (auto-dismisses). Always rendered; if the user has
 * no connected accounts the sweep returns a "nothing to sync" message.
 */
export function SyncAllButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<Result | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const flash = (r: Result) => {
    setResult(r)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setResult(null), 6000)
  }

  const onClick = () => {
    if (pending) return
    setResult(null)
    startTransition(async () => {
      const r = await syncAllTradeLockerConnections()
      if (r.ok) {
        flash({ kind: "ok", connections: r.connections, succeeded: r.succeeded, failed: r.failed, trades: r.totalTradesUpserted })
      } else {
        flash({ kind: "err", msg: r.error ?? "Sync failed." })
      }
      router.refresh()
    })
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={onClick}
        disabled={pending}
        title="Sync all connected accounts now"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 8,
          fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
          background: "var(--c-green)",
          border: "1px solid var(--c-green-bright)",
          color: "#fff",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.8 : 1,
          transition: "all 0.15s",
        }}
      >
        <Icon name="refresh" size={14} style={pending ? { animation: "spin 0.8s linear infinite" } : undefined} />
        <span>{pending ? "Syncing…" : "Sync Trades"}</span>
      </button>

      {result && <ResultChip result={result} />}
    </div>
  )
}

function ResultChip({ result }: { result: Result }) {
  const { tone, text } = describe(result)
  return (
    <div
      role="status"
      style={{
        position: "absolute", top: "calc(100% + 8px)", right: 0,
        zIndex: 50, minWidth: 220, maxWidth: 320,
        padding: "9px 12px", borderRadius: 10,
        background: "var(--c-bg-elev-2)",
        border: `1px solid ${tone}`,
        color: "var(--c-fg)",
        fontSize: 12, lineHeight: 1.45,
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
      }}
    >
      <span style={{ color: tone }}>{text}</span>
    </div>
  )
}

function describe(result: Result): { tone: string; text: string } {
  if (result.kind === "err") {
    return { tone: "var(--c-red-bright)", text: result.msg }
  }
  const { connections, succeeded, failed, trades } = result
  if (connections === 0) {
    return { tone: "var(--c-amber)", text: "No connected accounts to sync. Connect one on the Accounts page." }
  }
  if (failed === 0) {
    const acct = `${succeeded} account${succeeded === 1 ? "" : "s"}`
    const tail = trades > 0 ? `${trades} trade${trades === 1 ? "" : "s"} updated` : "no new trades"
    return { tone: "var(--c-green-bright)", text: `✓ Synced ${acct} · ${tail}` }
  }
  if (succeeded === 0) {
    return { tone: "var(--c-red-bright)", text: `Sync failed for all ${failed} account${failed === 1 ? "" : "s"}. Check the Accounts page.` }
  }
  return {
    tone: "var(--c-amber)",
    text: `Synced ${succeeded} of ${connections} · ${failed} failed. Check the Accounts page for details.`,
  }
}
