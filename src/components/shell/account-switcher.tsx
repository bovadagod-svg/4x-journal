"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { useTweaks } from "@/lib/tweaks/tweaks-context"
import { useAccounts } from "@/components/accounts/accounts-context"
import { formatUSD } from "@/lib/finance"
import Link from "next/link"

export function AccountSwitcher() {
  const { tweaks, setTweak } = useTweaks()
  const { accounts } = useAccounts()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const switchScope = (next: string) => {
    setTweak("accountScope", next)
    setOpen(false)
    router.refresh()
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  const isAll = tweaks.accountScope === "all"
  const current = !isAll ? accounts.find((a) => a.id === tweaks.accountScope) : null

  const totals = useMemo(() => {
    const equity = accounts.reduce((s, a) => s + Number(a.equity || 0), 0)
    return { equity, count: accounts.length }
  }, [accounts])

  // Display values
  const label = isAll ? "All accounts" : current ? `${current.broker} · ${current.label}` : "Account"
  const subEquity = isAll
    ? totals.equity
    : current
      ? Number(current.equity)
      : 0
  const dot = isAll
    ? "var(--c-accent-bright)"
    : current?.color ?? "var(--c-fg-dim)"

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
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
        <div style={{ minWidth: 0, textAlign: "left" }}>
          <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          <div className="tnum" style={{ fontSize: 10.5, color: "var(--c-fg-muted)", fontFamily: "var(--font-mono)", lineHeight: 1.2, marginTop: 1 }}>
            {formatUSD(subEquity, { max: 0 })}
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

          <Row
            active={isAll}
            onClick={() => switchScope("all")}
            dotColor="var(--c-accent-bright)"
            label="All accounts"
            sublabel={`${totals.count} account${totals.count === 1 ? "" : "s"} · aggregated`}
            equity={totals.equity}
          />

          {accounts.length > 0 && <div style={{ height: 1, background: "var(--c-border)", margin: "6px 8px" }} />}

          {accounts.map((a) => (
            <Row
              key={a.id}
              active={tweaks.accountScope === a.id}
              onClick={() => switchScope(a.id)}
              dotColor={a.color}
              label={`${a.broker} · ${a.label}`}
              sublabel={a.status === "demo" ? "Demo" : a.status === "challenge" ? "Challenge" : a.status === "funded" ? "Funded" : "Live"}
              equity={Number(a.equity)}
            />
          ))}

          <div style={{ height: 1, background: "var(--c-border)", margin: "6px 8px" }} />
          <Link
            href="/accounts"
            onClick={() => setOpen(false)}
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
            <span>Manage accounts</span>
          </Link>
        </div>
      )}
    </div>
  )
}

function Row({
  active, onClick, dotColor, label, sublabel, equity,
}: {
  active: boolean
  onClick: () => void
  dotColor: string
  label: string
  sublabel: string
  equity: number
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "10px 1fr auto",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: active ? "var(--c-bg-elev-3)" : "transparent",
        border: "none",
        borderRadius: 8,
        color: "inherit",
        textAlign: "left",
        width: "100%",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor }} />
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 500,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
          <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--c-fg-muted)" }}>
            {formatUSD(equity, { max: 0 })}
          </span>
          <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{sublabel}</span>
        </div>
      </div>
      {active && <Icon name="check" size={14} color="var(--c-accent-bright)" />}
    </button>
  )
}
