"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/icons"
import { useTweaks } from "@/lib/tweaks/tweaks-context"

// Phase 0 stub: real account list comes in Phase 2. For now we show the
// "All accounts" pseudo-entry only, so the switcher is visually present and
// the scope context is wired end-to-end without depending on accounts data.
export function AccountSwitcher() {
  const { tweaks, setTweak } = useTweaks()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const isAll = tweaks.accountScope === "all"
  const label = isAll ? "All accounts" : tweaks.accountScope

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "7px 12px",
          background: "var(--c-bg-elev-2)",
          border: `1px solid ${open ? "var(--c-accent-bright)" : "var(--c-border)"}`,
          borderRadius: 10,
          color: "inherit",
          maxWidth: 240,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-accent-bright)", flexShrink: 0 }} />
        <div style={{ minWidth: 0, textAlign: "left" }}>
          <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          <div className="tnum" style={{ fontSize: 10.5, color: "var(--c-fg-muted)", fontFamily: "var(--font-mono)", lineHeight: 1.2, marginTop: 1 }}>
            $0
          </div>
        </div>
        <Icon name={open ? "chevronUp" : "chevronDown"} size={12} color="var(--c-fg-muted)" />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          width: 320,
          background: "var(--c-bg-elev-1)",
          border: "1px solid var(--c-border-strong)",
          borderRadius: 12,
          boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          padding: 6,
          zIndex: 50,
        }}>
          <div style={{ padding: "8px 12px 6px" }}>
            <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Switch scope</span>
          </div>
          <button
            onClick={() => { setTweak("accountScope", "all"); setOpen(false) }}
            style={{
              display: "grid",
              gridTemplateColumns: "10px 1fr auto",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              background: isAll ? "var(--c-bg-elev-3)" : "transparent",
              border: "none",
              borderRadius: 8,
              color: "inherit",
              textAlign: "left",
              width: "100%",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-accent-bright)" }} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>All accounts</div>
              <div style={{ fontSize: 11, color: "var(--c-fg-muted)", marginTop: 3 }}>0 accounts · connect one to begin</div>
            </div>
            {isAll && <Icon name="check" size={14} color="var(--c-accent-bright)" />}
          </button>
          <div style={{ height: 1, background: "var(--c-border)", margin: "6px 8px" }} />
          <a
            href="/accounts"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 12px",
              borderRadius: 8,
              color: "var(--c-fg-muted)",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            <Icon name="plus" size={13} />
            <span>Connect an account</span>
          </a>
        </div>
      )}
    </div>
  )
}
