"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon, PairFlag } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import {
  getTradeDetail,
  addExitFill,
  addEntryFill,
  cancelPendingOrder,
  markPendingFilled,
  deleteTrade,
  type TradeDetail,
} from "@/lib/actions/trades"
import { useJournalDrawer } from "@/components/journal/journal-drawer-context"
import { usePnLDisplay } from "@/lib/pnl-display-context"

type Tab = "order" | "fills" | "actions"

export function TradeDetailDrawer({ tradeId, onClose }: { tradeId: string | null; onClose: () => void }) {
  const router = useRouter()
  const [detail, setDetail] = useState<TradeDetail>(null)
  const [tab, setTab] = useState<Tab>("order")
  const [, startTransition] = useTransition()
  const journal = useJournalDrawer()
  const pnlDisplay = usePnLDisplay()

  // Fetch detail when tradeId changes
  useEffect(() => {
    if (!tradeId) { setDetail(null); return }
    let cancelled = false
    void getTradeDetail(tradeId).then((d) => { if (!cancelled) { setDetail(d); setTab("order") } })
    return () => { cancelled = true }
  }, [tradeId])

  const refresh = () => {
    if (!tradeId) return
    void getTradeDetail(tradeId).then((d) => setDetail(d))
    router.refresh()
  }

  // Lock body scroll
  useEffect(() => {
    if (!tradeId) return
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [tradeId])

  if (!tradeId) return null

  const t = detail?.trade
  const fills = detail?.fills ?? []
  const entryFills = fills.filter((f) => f.kind === "entry")
  const exitFills = fills.filter((f) => f.kind === "exit")
  const totalEntrySize = entryFills.reduce((s, f) => s + Number(f.size), 0)
  const totalExitSize = exitFills.reduce((s, f) => s + Number(f.size), 0)
  const remainingSize = totalEntrySize - totalExitSize

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 600, maxWidth: "94vw",
        background: "var(--c-bg-elev-1)",
        borderLeft: "1px solid var(--c-border)",
        zIndex: 101, overflowY: "auto",
        display: "flex", flexDirection: "column",
        animation: "slideIn 0.2s cubic-bezier(0.2, 0.7, 0.2, 1)",
      }}>
        {!detail || !t ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: 22, borderBottom: "1px solid var(--c-border)", position: "sticky", top: 0, background: "var(--c-bg-elev-1)", zIndex: 2 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <PairFlag pair={t.pair} size={28} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>{t.pair}</h2>
                      <SideChip side={t.side} />
                      <StatusChip status={t.status} />
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", marginTop: 2 }}>
                      {detail.account ? `${detail.account.broker} · ${detail.account.label}` : "—"}
                      {detail.playbook && (
                        <>
                          {" · "}
                          <span style={{ color: detail.playbook.color }}>● </span>
                          {detail.playbook.name}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={onClose} style={{ background: "var(--c-bg-elev-3)", border: "1px solid var(--c-border)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-fg)", cursor: "pointer" }}>
                  <Icon name="x" size={14} />
                </button>
              </div>

              {/* P&L / R headline */}
              <div style={{ display: "flex", gap: 18, alignItems: "flex-end", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{pnlDisplay.label("Realized P&L")}</div>
                  <div className="tnum" style={{
                    fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em",
                    color: t.pnl == null ? "var(--c-fg-muted)" : t.pnl > 0 ? "var(--c-green-bright)" : t.pnl < 0 ? "var(--c-red-bright)" : "var(--c-fg)",
                  }}>
                    {pnlDisplay.format({
                      pnl: t.pnl != null ? Number(t.pnl) : null,
                      r: t.r != null ? Number(t.r) : null,
                      // percent mode falls back to "—" when account equity isn't
                      // plumbed through; rmultiple + money work for every trade.
                      equity: null,
                      signed: true,
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Realized R</div>
                  <div className="tnum" style={{
                    fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600,
                    color: t.r == null ? "var(--c-fg-muted)" : t.r > 0 ? "var(--c-green-bright)" : t.r < 0 ? "var(--c-red-bright)" : "var(--c-fg)",
                  }}>
                    {t.r != null ? `${t.r > 0 ? "+" : ""}${Number(t.r).toFixed(2)}R` : "—"}
                  </div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Open</div>
                  <div className="tnum" style={{ fontSize: 14, fontWeight: 500 }}>
                    {t.status === "pending" ? "—" : remainingSize > 0 ? remainingSize.toFixed(2) : "0"} <span style={{ color: "var(--c-fg-muted)", fontSize: 11 }}>/ {totalEntrySize.toFixed(2) || Number(t.size).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="tab-row" style={{ gap: 2, borderBottom: "1px solid var(--c-border)", marginInline: -22, paddingInline: 22 }}>
                {(["order", "fills", "actions"] as Tab[]).map((tb) => (
                  <button
                    key={tb}
                    onClick={() => setTab(tb)}
                    className={`tab ${tab === tb ? "active" : ""}`}
                    style={{ borderRadius: "8px 8px 0 0", textTransform: "capitalize", padding: "8px 14px" }}
                  >
                    {tb} {tb === "fills" && fills.length > 0 ? <span style={{ marginLeft: 4, color: "var(--c-fg-dim)", fontSize: 10 }}>{fills.length}</span> : null}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
              {tab === "order" && <OrderPanel detail={detail} totalEntrySize={totalEntrySize} totalExitSize={totalExitSize} />}
              {tab === "fills" && (
                <FillsPanel
                  detail={detail}
                  remainingSize={remainingSize}
                  entryFills={entryFills}
                  exitFills={exitFills}
                  refresh={refresh}
                />
              )}
              {tab === "actions" && (
                <ActionsPanel
                  detail={detail}
                  refresh={refresh}
                  onClose={onClose}
                  onOpenJournal={() => { journal.openForTrade(t.id) }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── Order tab ───────────────────────────────────────────────────────────

function OrderPanel({
  detail, totalEntrySize, totalExitSize,
}: {
  detail: NonNullable<TradeDetail>
  totalEntrySize: number
  totalExitSize: number
}) {
  const t = detail.trade
  const placedAt = new Date(t.created_at).toLocaleString()
  const openedAt = t.opened_at ? new Date(t.opened_at).toLocaleString() : null
  const closedAt = t.closed_at ? new Date(t.closed_at).toLocaleString() : null
  const cancelledAt = t.cancelled_at ? new Date(t.cancelled_at).toLocaleString() : null

  const plannedR = useMemo(() => {
    if (t.stop_price == null || t.target_price == null) return null
    if (t.side === "long" && t.entry_price > t.stop_price) {
      return (t.target_price - t.entry_price) / (t.entry_price - t.stop_price)
    }
    if (t.side === "short" && t.stop_price > t.entry_price) {
      return (t.entry_price - t.target_price) / (t.stop_price - t.entry_price)
    }
    return null
  }, [t])

  return (
    <>
      {/* Lifecycle */}
      <Section title="Lifecycle">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          <Cell label="Placed" value={placedAt} />
          {openedAt && <Cell label={t.status === "pending" ? "—" : "Opened"} value={openedAt} />}
          {closedAt && <Cell label="Closed" value={closedAt} />}
          {cancelledAt && <Cell label="Cancelled" value={cancelledAt} />}
        </div>
        {t.cancel_reason && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--c-fg-muted)" }}>
            Reason: <span style={{ color: "var(--c-fg)" }}>{t.cancel_reason}</span>
          </div>
        )}
      </Section>

      {/* Prices */}
      <Section title="Order">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          <Cell label={t.status === "pending" ? "Limit / stop price" : "Avg entry"} value={fmtPrice(Number(t.entry_price), t.pair)} mono />
          <Cell label="Stop" value={t.stop_price != null ? fmtPrice(Number(t.stop_price), t.pair) : "—"} mono />
          <Cell label="Target" value={t.target_price != null ? fmtPrice(Number(t.target_price), t.pair) : "—"} mono />
          <Cell label="Avg exit" value={t.exit_price != null ? fmtPrice(Number(t.exit_price), t.pair) : "—"} mono />
          <Cell label="Size" value={Number(t.size).toFixed(2)} mono />
          <Cell label="Risk $" value={t.risk_amount != null ? formatUSD(Number(t.risk_amount)) : "—"} mono />
          <Cell label="Planned R" value={plannedR != null ? `${plannedR > 0 ? "+" : ""}${plannedR.toFixed(2)}R` : "—"} />
          <Cell label="Mood" value={t.mood ?? "—"} />
        </div>
      </Section>

      {/* Fill summary */}
      {(totalEntrySize > 0 || totalExitSize > 0) && (
        <Section title="Fill summary">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <Cell label="Entry fills" value={String(detail.fills.filter((f) => f.kind === "entry").length)} />
            <Cell label="Exit fills" value={String(detail.fills.filter((f) => f.kind === "exit").length)} />
            <Cell
              label={totalExitSize >= totalEntrySize && totalEntrySize > 0 ? "Fully closed" : "Open"}
              value={totalEntrySize > 0 ? `${((totalExitSize / totalEntrySize) * 100).toFixed(0)}% closed` : "—"}
            />
          </div>
        </Section>
      )}

      {/* Tags + notes */}
      {t.tags && t.tags.length > 0 && (
        <Section title="Tags">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {t.tags.map((tag) => <span key={tag} className="chip" style={{ fontSize: 10.5 }}>{tag}</span>)}
          </div>
        </Section>
      )}
      {t.notes && (
        <Section title="Notes">
          <div style={{ fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{t.notes}</div>
        </Section>
      )}
    </>
  )
}

// ─── Fills tab ────────────────────────────────────────────────────────────

function FillsPanel({
  detail, remainingSize, entryFills, exitFills, refresh,
}: {
  detail: NonNullable<TradeDetail>
  remainingSize: number
  entryFills: NonNullable<TradeDetail>["fills"]
  exitFills: NonNullable<TradeDetail>["fills"]
  refresh: () => void
}) {
  const t = detail.trade
  return (
    <>
      <Section title="Entry fills">
        {entryFills.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--c-fg-dim)", padding: "8px 0" }}>None yet — pending order awaiting fill.</div>
        ) : (
          <FillsTable fills={entryFills} pair={t.pair} kind="entry" />
        )}
      </Section>

      <Section title="Exit fills">
        {exitFills.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--c-fg-dim)", padding: "8px 0" }}>None yet.</div>
        ) : (
          <FillsTable fills={exitFills} pair={t.pair} kind="exit" />
        )}
      </Section>

      {/* Quick scale-out form */}
      {t.status === "open" && remainingSize > 0 && (
        <Section title="Scale out">
          <ScaleOutForm tradeId={t.id} remaining={remainingSize} pair={t.pair} onDone={refresh} />
        </Section>
      )}

      {/* Scale-in for open positions */}
      {t.status === "open" && (
        <Section title="Scale in">
          <ScaleInForm tradeId={t.id} pair={t.pair} onDone={refresh} />
        </Section>
      )}
    </>
  )
}

function FillsTable({
  fills, pair, kind,
}: {
  fills: NonNullable<TradeDetail>["fills"]
  pair: string
  kind: "entry" | "exit"
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, overflowX: "auto" }}>
      <div style={{
        minWidth: 440,
        display: "grid", gridTemplateColumns: "120px 1fr 80px 80px 60px",
        gap: 10, padding: "8px 10px",
        fontSize: 10, color: "var(--c-fg-muted)",
        textTransform: "uppercase", letterSpacing: "0.05em",
        background: "var(--c-bg-elev-2)",
        borderBottom: "1px solid var(--c-border)",
        borderRadius: "8px 8px 0 0",
      }}>
        <span>Time</span>
        <span style={{ textAlign: "right" }}>Price</span>
        <span style={{ textAlign: "right" }}>Size</span>
        <span style={{ textAlign: "right" }}>Reason</span>
        <span></span>
      </div>
      {fills.map((f, i) => (
        <div
          key={f.id}
          style={{
            minWidth: 440,
            display: "grid", gridTemplateColumns: "120px 1fr 80px 80px 60px",
            gap: 10, padding: "10px",
            borderBottom: i === fills.length - 1 ? "1px solid var(--c-border)" : "1px solid var(--c-border)",
            background: "var(--c-bg-elev-1)",
            alignItems: "center", fontSize: 12,
          }}
        >
          <span className="mono" style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>
            {new Date(f.filled_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </span>
          <span className="mono tnum" style={{ textAlign: "right", fontWeight: 500 }}>
            {fmtPrice(Number(f.price), pair)}
          </span>
          <span className="tnum" style={{ textAlign: "right" }}>{Number(f.size).toFixed(2)}</span>
          <span style={{ textAlign: "right", fontSize: 10.5, color: kind === "entry" ? "var(--c-green-bright)" : "var(--c-red-bright)", textTransform: "capitalize" }}>
            {f.reason ?? kind}
          </span>
          <span></span>
        </div>
      ))}
    </div>
  )
}

function ScaleOutForm({ tradeId, remaining, pair, onDone }: { tradeId: string; remaining: number; pair: string; onDone: () => void }) {
  const [price, setPrice] = useState("")
  const [size, setSize] = useState(remaining.toFixed(2))
  const [reason, setReason] = useState<"manual" | "stop" | "target">("manual")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    if (!price) { setErr("Exit price required."); return }
    setBusy(true); setErr(null)
    const fd = new FormData()
    fd.set("trade_id", tradeId)
    fd.set("price", price)
    fd.set("size", size)
    fd.set("reason", reason)
    const r = await addExitFill(fd)
    setBusy(false)
    if (!r.ok) { setErr(r.error ?? "Failed."); return }
    setPrice(""); setSize(remaining.toFixed(2))
    onDone()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 130px auto", gap: 8 }}>
        <input
          type="number" step="any"
          placeholder={`Exit price (${pair})`}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={priceInput}
        />
        <input
          type="number" step="any" min="0"
          placeholder="Size"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          style={priceInput}
        />
        <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} style={inputStyle}>
          <option value="manual">Manual</option>
          <option value="target">Target hit</option>
          <option value="stop">Stop hit</option>
        </select>
        <button type="button" onClick={submit} disabled={busy} className="btn btn-primary">
          {busy ? "…" : "Add exit"}
        </button>
      </div>
      <div style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>
        Open size: <span className="tnum">{remaining.toFixed(2)}</span>
      </div>
      {err && <div style={{ fontSize: 11.5, color: "var(--c-red-bright)" }}>{err}</div>}
    </div>
  )
}

function ScaleInForm({ tradeId, pair, onDone }: { tradeId: string; pair: string; onDone: () => void }) {
  const [price, setPrice] = useState("")
  const [size, setSize] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn">
        <Icon name="plus" size={11} /> Add entry fill
      </button>
    )
  }

  const submit = async () => {
    if (!price || !size) { setErr("Both fields required."); return }
    setBusy(true); setErr(null)
    const fd = new FormData()
    fd.set("trade_id", tradeId)
    fd.set("price", price)
    fd.set("size", size)
    fd.set("reason", "manual")
    const r = await addEntryFill(fd)
    setBusy(false)
    if (!r.ok) { setErr(r.error ?? "Failed."); return }
    setPrice(""); setSize(""); setOpen(false)
    onDone()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px auto auto", gap: 8 }}>
        <input type="number" step="any" placeholder={`Entry price (${pair})`} value={price} onChange={(e) => setPrice(e.target.value)} style={priceInput} />
        <input type="number" step="any" placeholder="Size" value={size} onChange={(e) => setSize(e.target.value)} style={priceInput} />
        <button type="button" onClick={() => setOpen(false)} className="btn">Cancel</button>
        <button type="button" onClick={submit} disabled={busy} className="btn btn-primary">{busy ? "…" : "Add"}</button>
      </div>
      {err && <div style={{ fontSize: 11.5, color: "var(--c-red-bright)" }}>{err}</div>}
    </div>
  )
}

// ─── Actions tab ──────────────────────────────────────────────────────────

function ActionsPanel({
  detail, refresh, onClose, onOpenJournal,
}: {
  detail: NonNullable<TradeDetail>
  refresh: () => void
  onClose: () => void
  onOpenJournal: () => void
}) {
  const router = useRouter()
  const t = detail.trade
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // Mark pending filled
  const [fillPrice, setFillPrice] = useState(String(t.entry_price))
  const [fillSize, setFillSize] = useState(String(t.size))

  const onMarkFilled = async () => {
    setBusy("fill"); setErr(null)
    const fd = new FormData()
    fd.set("trade_id", t.id)
    fd.set("price", fillPrice)
    fd.set("size", fillSize)
    const r = await markPendingFilled(fd)
    setBusy(null)
    if (!r.ok) setErr(r.error ?? "Failed.")
    else refresh()
  }

  const onCancelPending = async () => {
    if (!confirm("Cancel this pending order?")) return
    setBusy("cancel"); setErr(null)
    const fd = new FormData()
    fd.set("trade_id", t.id)
    fd.set("reason", "manual")
    const r = await cancelPendingOrder(fd)
    setBusy(null)
    if (!r.ok) setErr(r.error ?? "Failed.")
    else refresh()
  }

  const onDelete = async () => {
    if (!confirm("Delete this trade and all its fills? This cannot be undone.")) return
    setBusy("delete"); setErr(null)
    const r = await deleteTrade(t.id)
    setBusy(null)
    if (!r.ok) setErr(r.error ?? "Failed.")
    else { router.refresh(); onClose() }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Pending: fill or cancel */}
      {t.status === "pending" && (
        <Section title="Pending order">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px auto", gap: 8 }}>
              <input type="number" step="any" value={fillPrice} onChange={(e) => setFillPrice(e.target.value)} style={priceInput} />
              <input type="number" step="any" value={fillSize} onChange={(e) => setFillSize(e.target.value)} style={priceInput} />
              <button type="button" onClick={onMarkFilled} disabled={busy === "fill"} className="btn btn-primary">
                {busy === "fill" ? "…" : "Mark filled"}
              </button>
            </div>
            <button type="button" onClick={onCancelPending} disabled={busy === "cancel"} className="btn" style={{ alignSelf: "flex-start", color: "var(--c-amber)", borderColor: "rgba(229, 162, 59, 0.3)" }}>
              {busy === "cancel" ? "…" : "Cancel pending order"}
            </button>
          </div>
        </Section>
      )}

      <Section title="Journal">
        <button type="button" onClick={onOpenJournal} className="btn" style={{ width: "100%", justifyContent: "flex-start", padding: "10px 12px" }}>
          <Icon name="journal" size={13} />
          <span>Open journal entry for this trade</span>
        </button>
      </Section>

      <Section title="Danger">
        <button type="button" onClick={onDelete} disabled={busy === "delete"} className="btn" style={{ alignSelf: "flex-start", color: "var(--c-red-bright)", borderColor: "rgba(190, 51, 61, 0.3)" }}>
          <Icon name="x" size={12} />
          <span>{busy === "delete" ? "Deleting…" : "Delete trade"}</span>
        </button>
      </Section>

      {err && <div style={{ fontSize: 12, color: "var(--c-red-bright)" }}>{err}</div>}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <h4 style={{ margin: 0, fontSize: 11, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{title}</h4>
      {children}
    </div>
  )
}

function Cell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className={mono ? "mono" : "tnum"} style={{ fontSize: 12.5, marginTop: 2 }}>{value}</div>
    </div>
  )
}

function SideChip({ side }: { side: string }) {
  const m = side === "long"
    ? { c: "var(--c-green-bright)", bg: "rgba(17, 196, 88, 0.12)" }
    : { c: "var(--c-red-bright)", bg: "rgba(190, 51, 61, 0.12)" }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "1px 8px", borderRadius: 999,
      fontSize: 10.5, fontWeight: 600,
      color: m.c, background: m.bg,
      border: `1px solid ${m.c}33`,
      textTransform: "uppercase",
    }}>
      {side}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { c: string; bg: string }> = {
    pending: { c: "var(--c-amber)", bg: "rgba(229, 162, 59, 0.12)" },
    open: { c: "var(--c-green-bright)", bg: "rgba(17, 196, 88, 0.12)" },
    closed: { c: "var(--c-fg-muted)", bg: "var(--c-bg-elev-3)" },
    cancelled: { c: "var(--c-red-bright)", bg: "rgba(190, 51, 61, 0.12)" },
  }
  const m = map[status] ?? map.open
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "1px 8px", borderRadius: 999,
      fontSize: 10, fontWeight: 600,
      color: m.c, background: m.bg,
      border: `1px solid ${m.c}33`,
      textTransform: "uppercase", letterSpacing: "0.04em",
    }}>
      {status}
    </span>
  )
}

function fmtPrice(price: number, pair: string): string {
  const dp = pair.toUpperCase().includes("JPY") || pair.toUpperCase().includes("XAU") ? 2 : 5
  return price.toFixed(dp)
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-elev-2)",
  color: "var(--c-fg)",
  fontSize: 12.5,
  outline: "none",
}
const priceInput: React.CSSProperties = { ...inputStyle, fontFamily: "var(--font-mono)" }
