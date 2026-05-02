"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { deleteAccount, setDefaultAccount } from "@/lib/actions/accounts"
import { formatUSD } from "@/lib/finance"
import { AccountFormModal } from "./account-form-modal"
import { SyncTradeLockerButton } from "./sync-button"
import type { Account } from "./accounts-context"

export type AccountConnection = {
  id: string
  provider: string
  last_synced_at: string | null
  last_sync_status: string | null
  last_sync_error: string | null
  trades_synced: number
}

export function AccountCard({ account, tradeCount, connection }: { account: Account; tradeCount: number; connection?: AccountConnection | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()

  const onDelete = () => {
    const msg = tradeCount > 0
      ? `Delete "${account.label}"? This will also delete all ${tradeCount} trade${tradeCount === 1 ? "" : "s"} on this account.`
      : `Delete "${account.label}"?`
    if (!confirm(msg)) return
    startTransition(async () => {
      const r = await deleteAccount(account.id)
      if (!r.ok) alert(r.error)
      else router.refresh()
    })
  }

  const onSetDefault = () => {
    startTransition(async () => {
      const r = await setDefaultAccount(account.id)
      if (!r.ok) alert(r.error)
      else router.refresh()
    })
  }

  return (
    <>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: account.color,
            display: "grid", placeItems: "center",
            color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "var(--font-display)",
            flexShrink: 0,
          }}>
            {account.broker.charAt(0)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {account.label}
              </span>
              {account.is_default && (
                <span className="chip chip-purple" style={{ fontSize: 9.5 }}>Default</span>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>
              {account.broker} · <span style={{ textTransform: "capitalize" }}>{account.status}</span>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "10px 0", borderTop: "1px solid var(--c-border)", borderBottom: "1px solid var(--c-border)" }}>
          <Stat label="Balance" value={formatUSD(Number(account.balance), { max: 0 })} />
          <Stat label="Equity" value={formatUSD(Number(account.equity), { max: 0 })} />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span className="chip" style={{ fontSize: 10.5 }}>
            {tradeCount} trade{tradeCount === 1 ? "" : "s"}
          </span>
          <span className="chip" style={{ fontSize: 10.5 }}>{account.currency}</span>
          {connection && (
            <span className="chip chip-purple" style={{ fontSize: 10.5 }}>
              <Icon name="external" size={10} />
              {connection.provider === "tradelocker" ? "TradeLocker linked" : connection.provider}
            </span>
          )}
        </div>

        {connection ? (
          <SyncTradeLockerButton
            connectionId={connection.id}
            lastSyncedAt={connection.last_synced_at}
            lastStatus={connection.last_sync_status}
            lastError={connection.last_sync_error}
            tradesSynced={connection.trades_synced}
          />
        ) : null}

        <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
          <button onClick={() => setEditing(true)} className="btn" style={{ flex: 1, justifyContent: "center" }}>
            <Icon name="edit" size={12} />
            <span>Edit</span>
          </button>
          {!account.is_default && (
            <button onClick={onSetDefault} disabled={pending} className="btn" title="Set as default">
              <Icon name="check" size={12} />
            </button>
          )}
          {!connection && (
            <button onClick={onDelete} disabled={pending} className="btn" title="Delete">
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
      </div>

      <AccountFormModal open={editing} onClose={() => setEditing(false)} account={account} />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 500, color: "var(--c-fg)" }}>{value}</div>
    </div>
  )
}
