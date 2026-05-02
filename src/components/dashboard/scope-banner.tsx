"use client"

import { useRouter } from "next/navigation"
import { useTweaks } from "@/lib/tweaks/tweaks-context"
import { useAccounts } from "@/components/accounts/accounts-context"
import { formatUSD } from "@/lib/finance"

export function ScopeBanner() {
  const { tweaks, setTweak } = useTweaks()
  const { accounts } = useAccounts()
  const router = useRouter()

  const isAll = tweaks.accountScope === "all"
  const current = !isAll ? accounts.find((a) => a.id === tweaks.accountScope) : null
  const totalEquity = accounts.reduce((s, a) => s + Number(a.equity || 0), 0)

  const others = isAll ? [] : accounts.filter((a) => a.id !== tweaks.accountScope)

  const switchScope = (next: string) => {
    setTweak("accountScope", next)
    router.refresh()
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 14px",
        background: "var(--c-bg-elev-1)",
        border: "1px solid var(--c-border)",
        borderRadius: 10,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase",
          letterSpacing: "0.06em", fontWeight: 600,
        }}>Showing</span>
        <span style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "3px 8px",
          background: "var(--c-bg-elev-2)",
          border: "1px solid var(--c-border)",
          borderRadius: 999,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: isAll ? "var(--c-accent-bright)" : (current?.color ?? "var(--c-fg-dim)"),
          }} />
          <span style={{ fontSize: 11.5, fontWeight: 500 }}>
            {isAll ? "All accounts" : current ? `${current.broker} · ${current.label}` : "Account"}
          </span>
          <span className="tnum" style={{ fontSize: 11, color: "var(--c-fg-muted)", fontFamily: "var(--font-mono)" }}>
            {formatUSD(isAll ? totalEquity : Number(current?.equity ?? 0))}
          </span>
        </span>
        <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>
          {isAll
            ? `Aggregating across ${accounts.length} account${accounts.length === 1 ? "" : "s"}`
            : current
              ? `${current.broker} · ${current.status === "demo" ? "Demo" : current.status === "challenge" ? "Challenge" : current.status === "funded" ? "Funded" : "Live"}`
              : ""}
        </span>
      </div>

      {others.length > 0 && (
        <>
          <div style={{ width: 1, height: 22, background: "var(--c-border)" }} />
          <span style={{
            fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase",
            letterSpacing: "0.06em", fontWeight: 600,
          }}>Other accounts</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {others.map((a) => (
              <button
                key={a.id}
                onClick={() => switchScope(a.id)}
                title={`${a.broker} · ${a.label}`}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "3px 8px",
                  background: "transparent",
                  border: "1px solid var(--c-border)",
                  borderRadius: 999,
                  cursor: "pointer", color: "inherit",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: a.color }} />
                <span style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>
                  {a.broker} · {a.label}
                </span>
              </button>
            ))}
            {!isAll && (
              <button
                onClick={() => switchScope("all")}
                style={{
                  padding: "3px 8px",
                  background: "transparent",
                  border: "1px dashed var(--c-border-strong)",
                  borderRadius: 999,
                  cursor: "pointer",
                  color: "var(--c-fg-muted)",
                  fontSize: 11,
                }}
              >
                ← Back to All
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
