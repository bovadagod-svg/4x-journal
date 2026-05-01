"use client"

import { usePathname } from "next/navigation"
import { Icon } from "@/components/icons"
import { useTweaks } from "@/lib/tweaks/tweaks-context"
import { SECTION_META, type SectionId } from "@/lib/sections"
import { AccountSwitcher } from "./account-switcher"
import { useLogTrade } from "@/components/trades/log-trade-context"

export function TopBar() {
  const pathname = usePathname()
  const { tweaks, setTweak } = useTweaks()
  const logTrade = useLogTrade()

  const id = (pathname.split("/")[1] || "dashboard") as SectionId
  const meta = SECTION_META[id]

  return (
    <header
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "12px 28px",
        height: "var(--topbar-h)",
        borderBottom: "1px solid var(--c-border)",
        background: "var(--c-bg-elev-1)",
        position: "sticky", top: 0, zIndex: 10,
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "0 0 auto" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 500,
        }}>
          <span style={{ color: "var(--c-fg-dim)" }}>Workspace</span>
          <Icon name="chevronRight" size={12} color="var(--c-fg-dim)" />
          <span style={{ color: "var(--c-fg)" }}>{meta?.title ?? id}</span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 999,
          background: "rgba(17, 196, 88, 0.08)",
          color: "var(--c-green-bright)",
          border: "1px solid rgba(17, 196, 88, 0.18)",
        }}>
          <span className="live-dot" />
          <span style={{ fontSize: 11.5 }}>Markets open · London</span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "min(420px, 100%)",
          background: "var(--c-bg-elev-2)",
          border: "1px solid var(--c-border)",
          borderRadius: 10,
          padding: "7px 12px",
        }}>
          <Icon name="search" size={15} color="var(--c-fg-muted)" />
          <input
            placeholder="Search trades, pairs, playbooks…"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--c-fg)",
              fontSize: 13,
            }}
          />
          <kbd style={{
            fontFamily: "var(--font-mono)", fontSize: 10.5,
            color: "var(--c-fg-muted)",
            background: "var(--c-bg-elev-3)",
            padding: "1px 6px", borderRadius: 4,
            border: "1px solid var(--c-border)",
          }}>⌘K</kbd>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
        <AccountSwitcher />
        <button
          onClick={() => setTweak("theme", tweaks.theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          style={iconBtn}
        >
          <Icon name={tweaks.theme === "dark" ? "sun" : "moon"} size={16} />
        </button>
        <button aria-label="Notifications" style={iconBtn}>
          <Icon name="bell" size={16} />
          <span style={{
            position: "absolute", top: 7, right: 7,
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--c-red-bright)",
            border: "1.5px solid var(--c-bg-elev-2)",
          }} />
        </button>
        <button className="btn btn-primary" style={{ marginLeft: 4 }} onClick={logTrade.open}>
          <Icon name="plus" size={14} />
          <span>Log Trade</span>
        </button>
      </div>
    </header>
  )
}

const iconBtn: React.CSSProperties = {
  width: 34, height: 34,
  display: "flex", alignItems: "center", justifyContent: "center",
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-elev-2)",
  color: "var(--c-fg)",
  borderRadius: 10,
  position: "relative",
}
