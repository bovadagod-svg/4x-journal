"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon, type IconName } from "@/components/icons"
import { useLogTrade } from "@/components/trades/log-trade-context"
import { useJournalDrawer } from "@/components/journal/journal-drawer-context"
import { createEmptyIdeaEntry } from "@/lib/actions/journal-entries"

/**
 * Global command palette. Opens with ⌘K / Ctrl+K from anywhere — even from
 * inside a text input (this is the one shortcut that intentionally
 * overrides typing-target detection).
 *
 * Filters a fixed command list with substring matching on label + keywords.
 * Arrow keys + Enter to run, Esc to dismiss.
 */

type Command = {
  id: string
  label: string
  hint?: string
  icon: IconName
  /** Extra match terms (synonyms) so e.g. "trades" hits the Ledger row. */
  keywords?: string[]
  run: (ctx: CommandContext) => void | Promise<void>
}

type CommandContext = {
  router: ReturnType<typeof useRouter>
  logTrade: ReturnType<typeof useLogTrade>
  journal: ReturnType<typeof useJournalDrawer>
  close: () => void
}

const NAV: Array<{ path: string; label: string; icon: IconName; kw?: string[] }> = [
  { path: "/dashboard", label: "Dashboard",  icon: "dashboard" },
  { path: "/ledger",    label: "Ledger",     icon: "trade",     kw: ["trades", "history"] },
  { path: "/journal",   label: "Journal",    icon: "journal",   kw: ["notes", "entries"] },
  { path: "/analytics", label: "Analytics",  icon: "analytics", kw: ["stats", "reports", "performance"] },
  { path: "/playbooks", label: "Playbooks",  icon: "playbook",  kw: ["setups", "strategies"] },
  { path: "/risk",      label: "Risk",       icon: "risk",      kw: ["rules", "limits"] },
  { path: "/calendar",  label: "Calendar",   icon: "calendar",  kw: ["events", "news"] },
  { path: "/watchlist", label: "Watchlist",  icon: "watchlist", kw: ["pairs"] },
  { path: "/accounts",  label: "Accounts",   icon: "accounts",  kw: ["brokers"] },
  { path: "/reports",   label: "Reports",    icon: "reports",   kw: ["csv", "tax", "export"] },
  { path: "/settings",  label: "Settings",   icon: "settings",  kw: ["preferences", "profile"] },
]

function buildCommands(): Command[] {
  const navCmds: Command[] = NAV.map((n) => ({
    id: `nav:${n.path}`,
    label: `Go to ${n.label}`,
    hint: n.path,
    icon: n.icon,
    keywords: n.kw,
    run: ({ router, close }) => { router.push(n.path); close() },
  }))

  const actionCmds: Command[] = [
    {
      id: "act:log-trade",
      label: "Log a new trade",
      hint: "shortcut: c",
      icon: "trade",
      keywords: ["new", "create"],
      run: ({ logTrade, close }) => { logTrade.open(); close() },
    },
    {
      id: "act:log-idea",
      label: "Log a new idea",
      hint: "kind=idea, watching",
      icon: "lightning",
      keywords: ["new", "create", "setup", "thesis"],
      run: async ({ journal, close }) => {
        const r = await createEmptyIdeaEntry()
        if (r.ok) { journal.open(r.id) }
        close()
      },
    },
    {
      id: "act:settings-tax",
      label: "Open Tax settings",
      hint: "/settings?tab=tax",
      icon: "settings",
      keywords: ["election", "988", "1256"],
      run: ({ router, close }) => { router.push("/settings?tab=tax"); close() },
    },
    {
      id: "act:settings-integrations",
      label: "Open Integrations settings",
      hint: "/settings?tab=integrations",
      icon: "external",
      keywords: ["webhook", "tradelocker", "broker"],
      run: ({ router, close }) => { router.push("/settings?tab=integrations"); close() },
    },
    {
      id: "act:help",
      label: "Open Help docs",
      hint: "/help",
      icon: "info",
      keywords: ["docs", "guide", "manual"],
      run: ({ router, close }) => { router.push("/help"); close() },
    },
  ]

  return [...actionCmds, ...navCmds]
}

function score(cmd: Command, query: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const hay = [cmd.label, ...(cmd.keywords ?? [])].join(" ").toLowerCase()
  if (hay.includes(q)) return hay.startsWith(q) ? 3 : hay.includes(` ${q}`) ? 2 : 1
  // Soft fallback: every char of query in order somewhere in label
  let i = 0
  for (const c of cmd.label.toLowerCase()) { if (c === q[i]) i++; if (i === q.length) return 0.5 }
  return 0
}

export function CommandPalette() {
  const router = useRouter()
  const logTrade = useLogTrade()
  const journal = useJournalDrawer()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const allCommands = useMemo(buildCommands, [])
  const filtered = useMemo(() => {
    return allCommands
      .map((c) => ({ cmd: c, s: score(c, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.cmd)
  }, [allCommands, query])

  // Global open shortcut. Intentionally fires even when an input is focused.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isToggle = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"
      if (isToggle) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Reset state on close, focus input on open.
  useEffect(() => {
    if (open) {
      setQuery("")
      setHighlight(0)
      // Defer focus to next tick so the input is mounted.
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Clamp highlight when filtered list shrinks.
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(Math.max(0, filtered.length - 1))
  }, [filtered.length, highlight])

  if (!open) return null

  const ctx: CommandContext = {
    router, logTrade, journal,
    close: () => setOpen(false),
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Escape") { setOpen(false); return }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(filtered.length - 1, h + 1)); return }
    if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); return }
    if (e.key === "Enter") {
      e.preventDefault()
      const cmd = filtered[highlight]
      if (cmd) void cmd.run(ctx)
    }
  }

  return (
    <div
      onClick={() => setOpen(false)}
      onKeyDown={onKeyDown}
      style={{
        position: "fixed", inset: 0, zIndex: 250,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "12vh 16px 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: "min(560px, 100%)",
          padding: 0, overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px", borderBottom: "1px solid var(--c-border)",
        }}>
          <Icon name="search" size={14} color="var(--c-fg-muted)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions, pages, settings…"
            style={{
              flex: 1, minWidth: 0,
              background: "transparent", border: "none", outline: "none",
              color: "var(--c-fg)", fontSize: 14,
              fontFamily: "inherit",
            }}
          />
          <kbd style={kbdStyle}>esc</kbd>
        </div>
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--c-fg-muted)", fontSize: 12.5 }}>
              No matches.
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => void cmd.run(ctx)}
                onMouseEnter={() => setHighlight(i)}
                style={{
                  width: "100%",
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px",
                  background: i === highlight ? "var(--c-bg-elev-3)" : "transparent",
                  border: "none",
                  borderLeft: i === highlight ? "2px solid var(--c-purple-bright)" : "2px solid transparent",
                  textAlign: "left", cursor: "pointer",
                  color: "var(--c-fg)",
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: "var(--c-bg-elev-2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon name={cmd.icon} size={11} color="var(--c-fg-muted)" />
                </span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>{cmd.label}</span>
                {cmd.hint && (
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{cmd.hint}</span>
                )}
              </button>
            ))
          )}
        </div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderTop: "1px solid var(--c-border)",
          fontSize: 10.5, color: "var(--c-fg-dim)",
        }}>
          <span style={{ display: "flex", gap: 6 }}>
            <kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> navigate
          </span>
          <span style={{ display: "flex", gap: 6 }}>
            <kbd style={kbdStyle}>↵</kbd> run
          </span>
          <span style={{ display: "flex", gap: 6 }}>
            <kbd style={kbdStyle}>⌘K</kbd> toggle
          </span>
        </div>
      </div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  display: "inline-block", padding: "2px 6px",
  background: "var(--c-bg-elev-3)", border: "1px solid var(--c-border)",
  borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 10,
  color: "var(--c-fg-muted)",
}
