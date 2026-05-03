"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { useLogTrade } from "@/components/trades/log-trade-context"

/**
 * Global keyboard shortcuts. Listens at the document level for single-key
 * presses when no input/textarea has focus. Supports a Vim-like `g` prefix
 * for navigation (e.g. `g d` → dashboard).
 *
 * Shortcuts:
 *   c       — open Log Trade modal
 *   ?       — toggle the help overlay
 *   g d     — go to /dashboard
 *   g l     — go to /ledger
 *   g j     — go to /journal
 *   g a     — go to /analytics
 *   g p     — go to /playbooks
 *   g w     — go to /watchlist
 *   g r     — go to /risk
 *   g x     — go to /accounts
 *   g e     — go to /reports
 *   g s     — go to /settings
 *   g k     — go to /calendar
 *   Esc     — dismiss help overlay
 */

const NAV_TARGETS: Record<string, string> = {
  d: "/dashboard",
  l: "/ledger",
  j: "/journal",
  a: "/analytics",
  p: "/playbooks",
  w: "/watchlist",
  r: "/risk",
  x: "/accounts",
  e: "/reports",
  s: "/settings",
  k: "/calendar",
}

export function KeyboardShortcuts() {
  const router = useRouter()
  const logTrade = useLogTrade()
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    let pendingPrefix: { key: string; at: number } | null = null

    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
      if (target.isContentEditable) return true
      return false
    }

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      // Esc closes help
      if (e.key === "Escape" && helpOpen) {
        setHelpOpen(false)
        return
      }

      // Help toggle
      if (e.key === "?") {
        e.preventDefault()
        setHelpOpen((v) => !v)
        return
      }

      // Single-key trade modal
      if (e.key === "c" && !pendingPrefix) {
        e.preventDefault()
        logTrade.open()
        return
      }

      // `g` prefix
      if (e.key === "g" && !pendingPrefix) {
        pendingPrefix = { key: "g", at: Date.now() }
        // Auto-clear prefix after 1.2s
        setTimeout(() => {
          if (pendingPrefix && Date.now() - pendingPrefix.at >= 1200) pendingPrefix = null
        }, 1200)
        return
      }

      // Resolve `g <letter>`
      if (pendingPrefix && pendingPrefix.key === "g" && Date.now() - pendingPrefix.at < 1200) {
        const target = NAV_TARGETS[e.key]
        if (target) {
          e.preventDefault()
          router.push(target)
        }
        pendingPrefix = null
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [router, logTrade, helpOpen])

  if (!helpOpen) return null

  return (
    <div
      onClick={() => setHelpOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "grid", placeItems: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "min(440px, 100%)", padding: 20 }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>Keyboard shortcuts</h3>
          <button onClick={() => setHelpOpen(false)} className="btn" style={{ padding: "4px 8px" }}>
            <Icon name="x" size={11} />
          </button>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <Row keys={["⌘", "K"]} label="Open command palette" />
          <Row keys={["c"]} label="Log a new trade" />
          <Row keys={["?"]} label="Show/hide this help" />
          <Row keys={["esc"]} label="Close modals + drawers" />
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Navigation</div>
          <Row keys={["g", "d"]} label="Dashboard" />
          <Row keys={["g", "l"]} label="Ledger" />
          <Row keys={["g", "j"]} label="Journal" />
          <Row keys={["g", "a"]} label="Analytics" />
          <Row keys={["g", "p"]} label="Playbooks" />
          <Row keys={["g", "k"]} label="Calendar" />
          <Row keys={["g", "w"]} label="Watchlist" />
          <Row keys={["g", "r"]} label="Risk" />
          <Row keys={["g", "x"]} label="Accounts" />
          <Row keys={["g", "e"]} label="Reports" />
          <Row keys={["g", "s"]} label="Settings" />
        </div>
        <div style={{ marginTop: 14, fontSize: 11, color: "var(--c-fg-dim)" }}>
          Shortcuts ignore keystrokes when an input is focused.
        </div>
      </div>
    </div>
  )
}

function Row({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
      <span style={{ color: "var(--c-fg-muted)" }}>{label}</span>
      <span style={{ display: "flex", gap: 4 }}>
        {keys.map((k, i) => (
          <kbd key={i} style={{
            display: "inline-block", minWidth: 18, padding: "2px 7px",
            background: "var(--c-bg-elev-3)", border: "1px solid var(--c-border)",
            borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--c-fg)",
            textAlign: "center",
          }}>{k}</kbd>
        ))}
      </span>
    </div>
  )
}
