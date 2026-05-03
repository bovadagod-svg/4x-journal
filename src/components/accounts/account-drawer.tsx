"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { Sparkline } from "@/components/charts/sparkline"
import { formatUSD } from "@/lib/finance"
import { marginStatusColor, MARGIN_COLOR_VAR } from "@/lib/status"
import { deleteAccount, setDefaultAccount } from "@/lib/actions/accounts"
import { AccountFormModal } from "./account-form-modal"
import { SyncTradeLockerButton } from "./sync-button"
import type { AccountConnection } from "./account-card"
import type { Account } from "./accounts-context"

export function AccountDrawer({
  account,
  spark,
  tradeCount,
  connection,
  onClose,
}: {
  account: Account
  spark: number[]
  tradeCount: number
  connection: AccountConnection | null
  onClose: () => void
}) {
  const router = useRouter()
  const [tab, setTab] = useState<"overview" | "connection" | "danger">("overview")
  const [editing, setEditing] = useState(false)

  // Use updated_at as a rough "since" date if no created_at
  const since = new Date(account.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  // Trend metrics derived from sparkline (no real "starting balance" stored, so
  // use the start of the 7-day window as the baseline)
  const startBal = spark.length > 0 ? spark[0] : Number(account.balance)
  const change = Number(account.balance) - startBal
  const changePct = startBal > 0 ? (change / startBal) * 100 : 0

  const onSetDefault = async () => {
    const r = await setDefaultAccount(account.id)
    if (!r.ok) alert(r.error)
    else { router.refresh(); onClose() }
  }

  const onDelete = async () => {
    const msg = tradeCount > 0
      ? `Delete "${account.label}"? This will also delete all ${tradeCount} trade${tradeCount === 1 ? "" : "s"} on this account.`
      : `Delete "${account.label}"?`
    if (!confirm(msg)) return
    const r = await deleteAccount(account.id)
    if (!r.ok) { alert(r.error); return }
    router.refresh()
    onClose()
  }

  // Disable body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 580, maxWidth: "92vw",
        background: "var(--c-bg-elev-1)", borderLeft: "1px solid var(--c-border)",
        zIndex: 101, overflowY: "auto", display: "flex", flexDirection: "column",
        animation: "slideIn 0.2s cubic-bezier(0.2, 0.7, 0.2, 1)",
      }}>
        {/* Header */}
        <div style={{ padding: 22, borderBottom: "1px solid var(--c-border)", position: "sticky", top: 0, background: "var(--c-bg-elev-1)", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: account.color + "22", border: `1px solid ${account.color}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: account.color, fontWeight: 700, fontSize: 16, fontFamily: "var(--font-display)",
              }}>
                {account.broker.charAt(0)}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600 }}>{account.broker}</h2>
                  <StatusDot status={account.status} />
                </div>
                <div style={{ fontSize: 12.5, color: "var(--c-fg-muted)", marginTop: 2 }}>
                  {account.label}{account.is_default ? " · Default" : ""}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "var(--c-bg-elev-3)", border: "1px solid var(--c-border)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-fg)", cursor: "pointer" }}>
              <Icon name="x" size={14} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Balance</div>
              <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {formatUSD(Number(account.balance))}
              </div>
              <div className="tnum" style={{ fontSize: 12, color: change >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                {change >= 0 ? "▲" : "▼"} {formatUSD(change, { signed: true })} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%) · last 7d
              </div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Sparkline points={spark.length >= 2 ? spark : [0, 0]} color={change >= 0 ? "#11C458" : "#BE333D"} width={140} height={50} />
            </div>
          </div>

          <div className="tab-row" style={{ gap: 2, borderBottom: "1px solid var(--c-border)", marginInline: -22, paddingInline: 22 }}>
            {(["overview", "connection", "danger"] as const).map((t) => (
              <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)} style={{ borderRadius: "8px 8px 0 0", textTransform: "capitalize", padding: "8px 14px" }}>
                {t === "danger" ? "Manage" : t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          {tab === "overview" && (
            <>
              {account.margin_level != null && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  <Cell label="Equity" value={formatUSD(Number(account.equity))} />
                  <Cell
                    label="Free margin"
                    value={account.free_margin != null ? formatUSD(Number(account.free_margin)) : "—"}
                  />
                  <Cell
                    label="Margin used"
                    value={account.margin_used != null ? formatUSD(Number(account.margin_used)) : "—"}
                  />
                  <Cell
                    label="Margin level"
                    value={`${Number(account.margin_level).toFixed(0)}%`}
                    color={MARGIN_COLOR_VAR[marginStatusColor(Number(account.margin_level))]}
                  />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                <Cell label="Balance" value={formatUSD(Number(account.balance))} />
                <Cell label="Equity" value={formatUSD(Number(account.equity))} />
                <Cell label="Currency" value={account.currency.toUpperCase()} />
                <Cell label="Status" value={account.status} mono />
                <Cell label="Trades" value={String(tradeCount)} />
                <Cell label="Connected since" value={since} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <h4 style={{ margin: 0, fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600 }}>Quick links</h4>
                <a href={`/ledger?account=${account.id}`} className="btn" style={{ justifyContent: "flex-start", padding: 12 }}>
                  <Icon name="trade" size={13} />
                  <span>Open ledger filtered to this account</span>
                </a>
                <a href={`/risk`} className="btn" style={{ justifyContent: "flex-start", padding: 12 }}>
                  <Icon name="risk" size={13} />
                  <span>Configure risk rules</span>
                </a>
                <a href={`/analytics`} className="btn" style={{ justifyContent: "flex-start", padding: 12 }}>
                  <Icon name="analytics" size={13} />
                  <span>View analytics</span>
                </a>
              </div>
            </>
          )}

          {tab === "connection" && (
            <>
              {connection ? (
                <>
                  <div style={{
                    padding: 14, background: "var(--c-bg-elev-2)",
                    border: `1px solid ${connection.last_sync_status === "ok" ? "rgba(17, 196, 88, 0.25)" : connection.last_sync_status === "error" ? "rgba(190, 51, 61, 0.25)" : "var(--c-border)"}`,
                    borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: connection.last_sync_status === "ok" ? "var(--c-green-bright)" : connection.last_sync_status === "error" ? "var(--c-red-bright)" : "var(--c-fg-muted)",
                      boxShadow: connection.last_sync_status === "ok" ? "0 0 10px var(--c-green-bright)" : "none",
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {connection.last_sync_status === "ok" ? "Connection healthy" : connection.last_sync_status === "error" ? "Last sync failed" : "Awaiting first sync"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>
                        {connection.last_synced_at ? `Last sync ${new Date(connection.last_synced_at).toLocaleString()}` : "Never synced"} · {connection.trades_synced} trade{connection.trades_synced === 1 ? "" : "s"} imported
                      </div>
                      {connection.last_sync_error && (
                        <div style={{ fontSize: 11, color: "var(--c-red-bright)", marginTop: 4 }}>{connection.last_sync_error}</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <SyncTradeLockerButton
                      connectionId={connection.id}
                      lastSyncedAt={connection.last_synced_at}
                      lastStatus={connection.last_sync_status}
                      lastError={connection.last_sync_error}
                      tradesSynced={connection.trades_synced}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    <Cell label="Provider" value={connection.provider} mono />
                    <Cell label="Trades imported" value={String(connection.trades_synced)} />
                  </div>
                </>
              ) : (
                <div style={{ padding: 32, textAlign: "center", color: "var(--c-fg-muted)", fontSize: 13, background: "var(--c-bg-elev-2)", borderRadius: 8 }}>
                  No broker connection on this account.<br />
                  Trades are entered manually or imported via CSV.
                </div>
              )}
            </>
          )}

          {tab === "danger" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => setEditing(true)} className="btn" style={{ justifyContent: "flex-start", padding: 12 }}>
                <Icon name="edit" size={13} />
                <span>Edit account details</span>
              </button>
              {!account.is_default && (
                <button onClick={onSetDefault} className="btn" style={{ justifyContent: "flex-start", padding: 12 }}>
                  <Icon name="check" size={13} />
                  <span>Set as default</span>
                </button>
              )}
              {!connection && (
                <button onClick={onDelete} className="btn" style={{ justifyContent: "flex-start", padding: 12, color: "var(--c-red-bright)", borderColor: "rgba(190, 51, 61, 0.3)" }}>
                  <Icon name="x" size={13} />
                  <span>Delete account{tradeCount > 0 ? ` and ${tradeCount} trade${tradeCount === 1 ? "" : "s"}` : ""}</span>
                </button>
              )}
              {connection && (
                <div style={{ padding: 12, fontSize: 11.5, color: "var(--c-fg-muted)", background: "var(--c-bg-elev-2)", borderRadius: 8 }}>
                  Delete the broker connection first (in TradeLocker settings) before removing this account.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AccountFormModal open={editing} onClose={() => setEditing(false)} account={account} />
    </>
  )
}

function Cell({ label, value, mono, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className={mono ? "mono" : "tnum"} style={{ fontSize: 12.5, marginTop: 2, textTransform: mono ? "capitalize" : "none", color: color ?? "var(--c-fg)", fontWeight: color ? 600 : undefined }}>{value}</div>
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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--c-fg-muted)" }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: s.c,
        boxShadow: status === "live" || status === "funded" ? `0 0 8px ${s.c}` : "none",
      }} />
      {s.t}
    </span>
  )
}
