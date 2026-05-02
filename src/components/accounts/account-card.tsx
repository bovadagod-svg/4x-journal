"use client"

import { useState } from "react"
import { Icon } from "@/components/icons"
import { Sparkline } from "@/components/charts/sparkline"
import { formatUSD } from "@/lib/finance"
import { AccountFormModal } from "./account-form-modal"
import { AccountDrawer } from "./account-drawer"
import type { Account } from "./accounts-context"

export type AccountConnection = {
  id: string
  provider: string
  last_synced_at: string | null
  last_sync_status: string | null
  last_sync_error: string | null
  trades_synced: number
}

export function AccountCard({
  account,
  tradeCount,
  connection,
  spark,
}: {
  account: Account
  tradeCount: number
  connection?: AccountConnection | null
  spark: number[]
}) {
  const [open, setOpen] = useState(false)

  const balance = Number(account.balance)
  const equity = Number(account.equity)
  const openPnL = equity - balance
  const startBal = spark.length > 0 ? spark[0] : balance
  const change = balance - startBal
  const changePct = startBal > 0 ? (change / startBal) * 100 : 0
  const isPositive = change >= 0

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          textAlign: "left",
          background: "var(--c-bg-elev-1)",
          border: "1px solid var(--c-border)",
          borderRadius: "var(--radius-lg)",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
          transition: "all 0.15s",
          color: "inherit",
        }}
      >
        {/* color stripe */}
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: account.color }} />

        {/* Header block */}
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--c-border)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>
                {account.broker}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {account.label}
                </div>
                {account.is_default && <span className="chip chip-purple" style={{ fontSize: 9.5 }}>Default</span>}
              </div>
            </div>
            <StatusDot status={account.status} />
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {formatUSD(balance)}
              </div>
              <div className="tnum" style={{ fontSize: 11.5, marginTop: 2, color: isPositive ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                {isPositive ? "▲" : "▼"} {formatUSD(change, { signed: true })} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%) <span style={{ color: "var(--c-fg-dim)" }}>· 7d</span>
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <Sparkline points={spark.length >= 2 ? spark : [balance, balance]} color={isPositive ? "#11C458" : "#BE333D"} width={110} height={36} />
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ padding: "12px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 8 }}>
          <Stat label="Equity" value={formatUSD(equity)} />
          <Stat
            label="Open P&L"
            value={Math.abs(openPnL) > 0.01 ? formatUSD(openPnL, { signed: true }) : "—"}
            color={openPnL > 0 ? "var(--c-green-bright)" : openPnL < 0 ? "var(--c-red-bright)" : undefined}
          />
          <Stat label="Trades" value={String(tradeCount)} />
        </div>

        {/* Footer chips */}
        <div style={{ padding: "10px 18px 14px", borderTop: "1px solid var(--c-border)", background: "var(--c-bg-elev-2)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span className="chip" style={{ fontSize: 10, textTransform: "uppercase" }}>{account.currency}</span>
          {connection ? (
            <span className="chip chip-purple" style={{ fontSize: 10 }}>
              <Icon name="external" size={9} /> {connection.provider}
            </span>
          ) : (
            <span className="chip" style={{ fontSize: 10, color: "var(--c-fg-dim)" }}>Manual</span>
          )}
          {connection?.last_sync_status === "ok" && (
            <span className="chip chip-green" style={{ fontSize: 10 }}>
              <Icon name="check" size={9} /> synced
            </span>
          )}
          {connection?.last_sync_status === "error" && (
            <span className="chip chip-red" style={{ fontSize: 10 }}>sync error</span>
          )}
          <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--c-fg-dim)" }}>
            <Icon name="chevronRight" size={11} />
          </span>
        </div>
      </button>

      {open && (
        <AccountDrawer
          account={account}
          spark={spark}
          tradeCount={tradeCount}
          connection={connection ?? null}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

export function AddAccountButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        <Icon name="plus" size={13} />
        <span>Add account</span>
      </button>
      <AccountFormModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export function ConnectTile({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: "transparent",
      border: "1.5px dashed var(--c-border-strong)",
      borderRadius: "var(--radius-lg)",
      padding: 18, minHeight: 220,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
      color: "var(--c-fg-muted)", cursor: "pointer",
      transition: "all 0.15s",
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--c-bg-elev-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="plus" size={20} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Add Account</div>
      <div style={{ fontSize: 11.5, textAlign: "center", maxWidth: 220, lineHeight: 1.4 }}>
        Manual entry · CSV import · TradeLocker connection
      </div>
    </button>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 12.5, fontWeight: 500, color: color ?? "var(--c-fg)", marginTop: 1 }}>{value}</div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { c: string; t: string }> = {
    live: { c: "#11C458", t: "Live" },
    funded: { c: "#11C458", t: "Funded" },
    demo: { c: "#9A97A1", t: "Demo" },
    challenge: { c: "#E5A23B", t: "Challenge" },
    breached: { c: "#BE333D", t: "Breached" },
    paused: { c: "#E5A23B", t: "Paused" },
  }
  const s = map[status] ?? { c: "#9A97A1", t: status }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "capitalize" }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: s.c,
        boxShadow: status === "live" || status === "funded" ? `0 0 8px ${s.c}` : "none",
      }} />
      {s.t}
    </span>
  )
}
