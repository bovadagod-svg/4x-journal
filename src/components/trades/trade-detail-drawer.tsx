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
  setTradePlaybook,
  type TradeDetail,
} from "@/lib/actions/trades"
import { brokerClosePosition, brokerModifyPosition } from "@/lib/actions/tradelocker"
import { getReplayCandles, getTradeContext, type ReplayResult, type ContextResult } from "@/lib/actions/trade-replay"

type Aggregate = { ts: number; open: number; high: number; low: number; close: number; volume: number }
import { useJournalDrawer } from "@/components/journal/journal-drawer-context"
import { usePnLDisplay } from "@/lib/pnl-display-context"
import { useDateFmt } from "@/lib/timezone-context"
import { pipsBetween } from "@/lib/pip"
import { formatLotsOrSize } from "@/lib/lots"
import { withAlpha } from "@/lib/color"

type Tab = "order" | "fills" | "lifecycle" | "replay" | "actions"

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
  const primaryEntry = entryFills.find((f) => f.order_type) ?? entryFills[0] ?? null
  const entryOrderType = primaryEntry?.order_type ?? null

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        // Wide drawer that adapts:
        //   • Outer min(94vw, …) clamps to viewport on phones so it never overflows
        //   • Inner clamp(720, 65vw, 1100):
        //       - at least 720px on tablets/laptops so the Order tab + Lifecycle
        //         table don't get cramped
        //       - 65% of viewport on regular desktops
        //       - capped at 1100px on ultrawides so reading distance stays sane
        width: "min(94vw, clamp(720px, 65vw, 1100px))",
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
                      <OrderTypeChip type={entryOrderType} />
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
                      {detail.createdByName && (
                        <>
                          {" · "}
                          <span style={{ color: "var(--c-fg-dim)" }}>by {detail.createdByName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <a
                    href={`/trades/${t.id}/print`}
                    target="_blank"
                    rel="noopener"
                    title="Print or save as PDF"
                    style={{
                      background: "var(--c-bg-elev-3)", border: "1px solid var(--c-border)",
                      borderRadius: 8, width: 32, height: 32,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--c-fg-muted)", textDecoration: "none",
                    }}
                  >
                    <Icon name="external" size={13} />
                  </a>
                  <button onClick={onClose} style={{ background: "var(--c-bg-elev-3)", border: "1px solid var(--c-border)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--c-fg)", cursor: "pointer" }}>
                    <Icon name="x" size={14} />
                  </button>
                </div>
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
                    {t.status === "pending"
                      ? "—"
                      : remainingSize > 0
                        ? formatLotsOrSize(remainingSize, t.contract_size, { withUnit: false })
                        : "0"}
                    <span style={{ color: "var(--c-fg-muted)", fontSize: 11, marginLeft: 4 }}>
                      / {formatLotsOrSize(totalEntrySize || Number(t.size), t.contract_size)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="tab-row" style={{ gap: 2, borderBottom: "1px solid var(--c-border)", marginInline: -22, paddingInline: 22 }}>
                {(["order", "fills", "lifecycle", "replay", "actions"] as Tab[]).map((tb) => (
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
              {tab === "order" && <OrderPanel detail={detail} totalEntrySize={totalEntrySize} totalExitSize={totalExitSize} primaryEntry={primaryEntry} refresh={refresh} />}
              {tab === "fills" && (
                <FillsPanel
                  detail={detail}
                  remainingSize={remainingSize}
                  entryFills={entryFills}
                  exitFills={exitFills}
                  refresh={refresh}
                />
              )}
              {tab === "lifecycle" && (
                <LifecyclePanel
                  events={(t.lifecycle_events ?? []) as unknown[]}
                  pair={t.pair}
                  side={t.side}
                  entryPrice={Number(t.entry_price)}
                  contractSize={Number(t.contract_size) || 1}
                  openedAt={t.opened_at}
                  closedAt={t.closed_at}
                />
              )}
              {tab === "replay" && <ReplayPanel tradeId={t.id} pair={t.pair} side={t.side} entryPrice={Number(t.entry_price)} exitPrice={t.exit_price != null ? Number(t.exit_price) : null} stopPrice={t.stop_price != null ? Number(t.stop_price) : null} targetPrice={t.target_price != null ? Number(t.target_price) : null} />}
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
  detail, totalEntrySize, totalExitSize, primaryEntry, refresh,
}: {
  detail: NonNullable<TradeDetail>
  totalEntrySize: number
  totalExitSize: number
  primaryEntry: NonNullable<TradeDetail>["fills"][number] | null
  refresh: () => void
}) {
  const t = detail.trade
  const fmt = useDateFmt()
  const placedAt = fmt.dateTime(t.created_at)
  const openedAt = t.opened_at ? fmt.dateTime(t.opened_at) : null
  const closedAt = t.closed_at ? fmt.dateTime(t.closed_at) : null
  const cancelledAt = t.cancelled_at ? fmt.dateTime(t.cancelled_at) : null

  // Slippage = signed pip distance between requested and filled price.
  // Positive = fill better than requested; negative = filled worse (cost).
  const slippagePips = useMemo(() => {
    const req = primaryEntry?.request_price != null ? Number(primaryEntry.request_price) : null
    const filled = primaryEntry?.price != null ? Number(primaryEntry.price) : null
    if (req == null || filled == null || !isFinite(req) || !isFinite(filled)) return null
    const abs = pipsBetween(req, filled, t.pair)
    if (abs === 0) return 0
    // Long: fill above request = worse (paid more). Short: fill below request = worse.
    const worse = t.side === "long" ? filled > req : filled < req
    return worse ? -abs : abs
  }, [primaryEntry, t.pair, t.side])

  // Aggregate broker costs across all fills (entry + exit).
  const costs = useMemo(() => {
    let commission = 0
    let swap = 0
    let tax = 0
    let any = false
    for (const f of detail.fills) {
      if (f.commission != null) { commission += Number(f.commission); any = true }
      if (f.swap != null) { swap += Number(f.swap); any = true }
      if (f.tax != null) { tax += Number(f.tax); any = true }
    }
    return { commission, swap, tax, any }
  }, [detail.fills])

  const grossPnl = t.pnl != null ? Number(t.pnl) : null
  const netPnl = grossPnl != null && costs.any
    ? grossPnl - costs.commission - costs.swap - costs.tax
    : null

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
      {/* Playbook attribution — first so it's immediately actionable */}
      <Section title="Playbook">
        <PlaybookAttribution
          currentId={t.playbook_id}
          options={detail.playbookOptions}
          tradeId={t.id}
          refresh={refresh}
        />
      </Section>

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
          <Cell
            label={t.status === "pending" ? "Limit / stop price" : "Avg entry"}
            value={fmtPrice(Number(t.entry_price), t.pair)}
            mono
            badge={slippagePips != null
              ? {
                  text: `${slippagePips > 0 ? "+" : ""}${slippagePips.toFixed(1)}p`,
                  color: slippagePips > 0
                    ? "var(--c-green-bright)"
                    : slippagePips < 0
                      ? "var(--c-red-bright)"
                      : "var(--c-fg-muted)",
                  title: primaryEntry?.request_price != null
                    ? `Requested ${fmtPrice(Number(primaryEntry.request_price), t.pair)} · filled ${fmtPrice(Number(t.entry_price), t.pair)}`
                    : undefined,
                }
              : undefined}
          />
          <Cell label="Stop" value={t.stop_price != null ? fmtPrice(Number(t.stop_price), t.pair) : "—"} mono />
          <Cell label="Target" value={t.target_price != null ? fmtPrice(Number(t.target_price), t.pair) : "—"} mono />
          <Cell label="Avg exit" value={t.exit_price != null ? fmtPrice(Number(t.exit_price), t.pair) : "—"} mono />
          <Cell label="Size" value={formatLotsOrSize(t.size, t.contract_size)} mono />
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

      {/* Broker costs (only shown when broker reports any of commission/swap/tax) */}
      {costs.any && (
        <Section title="Costs">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            <Cell label="Commission" value={formatUSD(-Math.abs(costs.commission), { signed: true })} mono />
            <Cell label="Swap" value={formatUSD(costs.swap, { signed: true })} mono />
            {costs.tax !== 0 && <Cell label="Tax" value={formatUSD(-Math.abs(costs.tax), { signed: true })} mono />}
            {netPnl != null && (
              <Cell label="Net P&L" value={formatUSD(netPnl, { signed: true })} mono />
            )}
          </div>
        </Section>
      )}

      {/* Macro context (DXY / SPX / VIX at trade entry) — Polygon scaffold */}
      <ContextRow tradeId={t.id} />

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
          <FillsTable fills={entryFills} pair={t.pair} kind="entry" contractSize={Number(t.contract_size) || 1} />
        )}
      </Section>

      <Section title="Exit fills">
        {exitFills.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--c-fg-dim)", padding: "8px 0" }}>None yet.</div>
        ) : (
          <FillsTable fills={exitFills} pair={t.pair} kind="exit" contractSize={Number(t.contract_size) || 1} />
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
  fills, pair, kind, contractSize,
}: {
  fills: NonNullable<TradeDetail>["fills"]
  pair: string
  kind: "entry" | "exit"
  contractSize: number
}) {
  const fmt = useDateFmt()
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
            {fmt.custom(f.filled_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </span>
          <span className="mono tnum" style={{ textAlign: "right", fontWeight: 500 }}>
            {fmtPrice(Number(f.price), pair)}
          </span>
          <span className="tnum" style={{ textAlign: "right" }}>{formatLotsOrSize(f.size, contractSize, { withUnit: false })}</span>
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

      {/* Broker actions — only for open TradeLocker-synced trades */}
      {t.status === "open" && t.external_provider === "tradelocker" && t.external_id && (
        <BrokerActions
          tradeId={t.id}
          pair={t.pair}
          side={t.side}
          entryPrice={Number(t.entry_price)}
          stopPrice={t.stop_price != null ? Number(t.stop_price) : null}
          targetPrice={t.target_price != null ? Number(t.target_price) : null}
          refresh={refresh}
        />
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

// ─── Playbook attribution (Actions tab) ──────────────────────────────────

function PlaybookAttribution({
  currentId, options, tradeId, refresh,
}: {
  currentId: string | null
  options: NonNullable<TradeDetail>["playbookOptions"]
  tradeId: string
  refresh: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value || null
    setBusy(true); setErr(null); setSaved(false)
    const r = await setTradePlaybook(tradeId, next)
    setBusy(false)
    if (!r.ok) setErr(r.error ?? "Failed to update playbook.")
    else { setSaved(true); refresh() }
  }

  const selected = currentId ? options.find((p) => p.id === currentId) ?? null : null

  if (options.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>
        No playbooks yet. Create one on the Playbooks page, then attribute it here.
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          style={{
            width: 10, height: 10, borderRadius: 999, flexShrink: 0,
            background: selected ? selected.color : "var(--c-fg-dim)",
            opacity: selected ? 1 : 0.4,
          }}
        />
        <select
          value={currentId ?? ""}
          onChange={onChange}
          disabled={busy}
          style={{ ...inputStyle, flex: 1, opacity: busy ? 0.6 : 1 }}
        >
          <option value="">— No playbook —</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      {busy && <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>Saving…</span>}
      {saved && !busy && <span style={{ fontSize: 11.5, color: "var(--c-green-bright)" }}>✓ Playbook updated</span>}
      {err && <span style={{ fontSize: 11.5, color: "var(--c-red-bright)" }}>{err}</span>}
    </div>
  )
}

// ─── Lifecycle tab (order-event timeline from broker) ────────────────────

type LifecycleEvent = {
  occurredAt?: string
  orderId?: string
  status?: string
  type?: string
  side?: string
  isOpen?: boolean | null
  size?: number | null
  price?: number | null
  filledPrice?: number | null
  stopLoss?: number | null
  takeProfit?: number | null
}

type EnrichedEvent = LifecycleEvent & {
  /** Realized P&L in dollars on this single fill (exit Filled events only). */
  perFillPnl?: number
  /** Where this exit fill landed relative to entry, in price units. */
  perFillMove?: number
  /** Slippage (filledPrice − price) when the order had a limit / stop trigger. */
  slippage?: number
  /** Signed change in SL from the previous SL value on this trade. */
  slDelta?: number
  /** Movement label for SL Replaced events. */
  slClass?: "initial" | "be" | "trail" | "loose"
  /** Signed change in TP. */
  tpDelta?: number
  tpClass?: "initial" | "wider" | "tighter"
  /** "T+2d 7h" relative to the trade open. */
  relTime?: string
  /** Ms since trade open, for sorting / display. */
  msFromOpen?: number
}

type TradeContext = {
  pair: string
  side: string
  entryPrice: number
  contractSize: number
  openedAt: string | null
  closedAt: string | null
}

function LifecyclePanel({
  events, pair, side, entryPrice, contractSize, openedAt, closedAt,
}: {
  events: unknown[]
  pair: string
  side: string
  entryPrice: number
  contractSize: number
  openedAt: string | null
  closedAt: string | null
}) {
  if (!Array.isArray(events) || events.length === 0) {
    return (
      <Section title="Lifecycle">
        <div style={{ fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
          <p style={{ margin: "0 0 6px" }}>No order-event timeline for this trade yet.</p>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--c-fg-dim)" }}>
            Lifecycle history comes from broker-synced trades. Open the account drawer →
            Connection tab → <em>Re-import all trades from TradeLocker</em> to populate
            timelines for trades imported before this feature shipped.
          </p>
        </div>
      </Section>
    )
  }

  const ctx: TradeContext = { pair, side, entryPrice, contractSize, openedAt, closedAt }
  const enriched = enrichEvents(events as LifecycleEvent[], ctx)
  const summary = summarize(enriched, ctx)

  // Newest first reads more naturally for a single-trade view (entry at the bottom).
  const display = [...enriched].reverse()

  return (
    <Section title={`Lifecycle (${enriched.length} events)`}>
      <LifecycleSummary summary={summary} pair={pair} />

      <div style={{
        marginTop: 12,
        display: "flex", flexDirection: "column",
        background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)",
        borderRadius: 8, overflow: "hidden",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(110px, 130px) 60px 90px 110px 60px minmax(180px, 1fr)",
          gap: 10, padding: "8px 12px",
          fontSize: 10, color: "var(--c-fg-muted)",
          textTransform: "uppercase", letterSpacing: "0.05em",
          borderBottom: "1px solid var(--c-border)",
        }}>
          <span>Time</span>
          <span style={{ textAlign: "right" }}>T+</span>
          <span>Status</span>
          <span>Type</span>
          <span style={{ textAlign: "right" }}>Lots</span>
          <span>Detail</span>
        </div>
        {display.map((e, i) => (
          <LifecycleRow
            key={`${e.orderId ?? i}-${e.status ?? i}-${e.occurredAt ?? i}-${i}`}
            event={e}
            ctx={ctx}
            last={i === display.length - 1}
          />
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "var(--c-fg-dim)", lineHeight: 1.5 }}>
        Read top-down (newest first). Per-leg P&amp;L is computed against the trade&apos;s
        weighted-average entry price; SL / TP deltas show the change from the previous adjustment.
      </div>
    </Section>
  )
}

// ── Enrichment + summary computation ──────────────────────────────────────

type LifecycleSummaryData = {
  duration: string | null
  scaleOutCount: number
  slMoveCount: number
  tpMoveCount: number
  finalSL: number | null
  finalTP: number | null
  realizedPnl: number
  perLegBreakdown: Array<{ price: number; size: number; pnl: number; ts: string }>
}

function enrichEvents(events: LifecycleEvent[], ctx: TradeContext): EnrichedEvent[] {
  // Walk chronologically (oldest → newest) so we can carry forward state.
  const chrono = [...events].sort(
    (a, b) => new Date(a.occurredAt ?? 0).getTime() - new Date(b.occurredAt ?? 0).getTime(),
  )
  const openedAtMs = ctx.openedAt ? new Date(ctx.openedAt).getTime() : null
  const sideMul = ctx.side === "long" ? 1 : -1

  let prevSL: number | null = null
  let prevTP: number | null = null

  return chrono.map((e): EnrichedEvent => {
    const enriched: EnrichedEvent = { ...e }

    // Relative time from trade open
    if (e.occurredAt && openedAtMs != null) {
      const ms = new Date(e.occurredAt).getTime() - openedAtMs
      enriched.msFromOpen = ms
      enriched.relTime = formatRelativeTime(ms)
    }

    const status = (e.status ?? "").toLowerCase()
    const isFilled = status.includes("fill")
    const isReplaced = status.includes("replac") || status.includes("modif")

    // Per-fill realized P&L: only meaningful for exit Filled events with a
    // numeric size + filled price.
    if (isFilled && e.isOpen === false && e.filledPrice != null && e.size != null && e.size > 0) {
      const sizeUnits = e.size * ctx.contractSize
      enriched.perFillMove = (e.filledPrice - ctx.entryPrice) * sideMul
      enriched.perFillPnl = Number((enriched.perFillMove * sizeUnits).toFixed(2))
    }

    // Slippage: fill price vs the order's intended price (limit/stop trigger).
    // Skip when there's no requested price (pure market orders).
    if (isFilled && e.filledPrice != null && e.price != null && e.price !== e.filledPrice) {
      enriched.slippage = e.filledPrice - e.price
    }

    // SL / TP movement classification on Replaced events.
    if (isReplaced) {
      if (e.stopLoss != null && e.stopLoss !== prevSL) {
        if (prevSL == null) {
          enriched.slClass = "initial"
        } else {
          enriched.slDelta = e.stopLoss - prevSL
          // BE: within 1 basis point of the entry price (handles both sides).
          const beThreshold = Math.abs(ctx.entryPrice) * 0.0001
          if (Math.abs(e.stopLoss - ctx.entryPrice) <= beThreshold) {
            enriched.slClass = "be"
          } else {
            // For long: SL up = trail (favors). Short: SL down = trail.
            const movedTowardProfit = ctx.side === "long" ? e.stopLoss > prevSL : e.stopLoss < prevSL
            enriched.slClass = movedTowardProfit ? "trail" : "loose"
          }
        }
        prevSL = e.stopLoss
      }
      if (e.takeProfit != null && e.takeProfit !== prevTP) {
        if (prevTP == null) {
          enriched.tpClass = "initial"
        } else {
          enriched.tpDelta = e.takeProfit - prevTP
          // For long: TP up = wider (let it run). Short: TP down = wider.
          const widened = ctx.side === "long" ? e.takeProfit > prevTP : e.takeProfit < prevTP
          enriched.tpClass = widened ? "wider" : "tighter"
        }
        prevTP = e.takeProfit
      }
    } else if (e.stopLoss != null && prevSL == null) {
      // First time we see a stop on any non-Replaced event (e.g. initial Placed).
      prevSL = e.stopLoss
    } else if (e.takeProfit != null && prevTP == null) {
      prevTP = e.takeProfit
    }

    return enriched
  })
}

function summarize(enriched: EnrichedEvent[], ctx: TradeContext): LifecycleSummaryData {
  const opened = ctx.openedAt ? new Date(ctx.openedAt).getTime() : null
  const closed = ctx.closedAt ? new Date(ctx.closedAt).getTime() : null
  const duration = opened != null && closed != null
    ? formatDuration(closed - opened)
    : null

  const exitFills = enriched.filter(
    (e) => e.isOpen === false && /fill/i.test(e.status ?? "") && e.perFillPnl != null,
  )
  const realizedPnl = exitFills.reduce((s, e) => s + (e.perFillPnl ?? 0), 0)

  const slMoves = enriched.filter((e) => e.slClass != null && e.slClass !== "initial")
  const tpMoves = enriched.filter((e) => e.tpClass != null && e.tpClass !== "initial")

  // Final SL/TP from the latest Replaced (or initial Placed if no Replaced).
  let finalSL: number | null = null
  let finalTP: number | null = null
  for (const e of enriched) {
    if (e.stopLoss != null) finalSL = e.stopLoss
    if (e.takeProfit != null) finalTP = e.takeProfit
  }

  return {
    duration,
    scaleOutCount: Math.max(0, exitFills.length - 1),  // last close isn't a "scale-out"
    slMoveCount: slMoves.length,
    tpMoveCount: tpMoves.length,
    finalSL,
    finalTP,
    realizedPnl,
    perLegBreakdown: exitFills.map((e) => ({
      price: e.filledPrice ?? 0,
      size: e.size ?? 0,
      pnl: e.perFillPnl ?? 0,
      ts: e.occurredAt ?? "",
    })),
  }
}

function LifecycleSummary({ summary, pair }: { summary: LifecycleSummaryData; pair: string }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
      gap: 8,
    }}>
      <Cell label="Duration" value={summary.duration ?? "—"} />
      <Cell
        label="Scale-outs"
        value={summary.scaleOutCount > 0 ? String(summary.scaleOutCount) : "0"}
        mono
      />
      <Cell
        label="SL moves"
        value={summary.slMoveCount > 0 ? `${summary.slMoveCount}` : "—"}
        mono
      />
      <Cell
        label="TP moves"
        value={summary.tpMoveCount > 0 ? `${summary.tpMoveCount}` : "—"}
        mono
      />
      <Cell
        label="Final SL"
        value={summary.finalSL != null ? fmtPrice(summary.finalSL, pair) : "—"}
        mono
      />
      <Cell
        label="Final TP"
        value={summary.finalTP != null ? fmtPrice(summary.finalTP, pair) : "—"}
        mono
      />
      {summary.perLegBreakdown.length > 0 && (
        <Cell
          label="Realized (legs sum)"
          value={formatUSD(summary.realizedPnl, { signed: true })}
          mono
          badge={{
            text: summary.perLegBreakdown.length === 1
              ? "1 leg"
              : `${summary.perLegBreakdown.length} legs`,
            color: "var(--c-fg-muted)",
          }}
        />
      )}
    </div>
  )
}

function LifecycleRow({
  event, ctx, last,
}: {
  event: EnrichedEvent
  ctx: TradeContext
  last: boolean
}) {
  const fmt = useDateFmt()
  const status = (event.status ?? "").trim()
  const accent = statusAccent(status)
  const dateStr = event.occurredAt
    ? fmt.custom(event.occurredAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "—"

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "minmax(110px, 130px) 60px 90px 110px 60px minmax(180px, 1fr)",
      gap: 10, padding: "10px 12px",
      borderBottom: last ? "none" : "1px solid var(--c-border)",
      alignItems: "flex-start", fontSize: 12,
    }}>
      <span className="mono" style={{ fontSize: 11, color: "var(--c-fg-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {dateStr}
      </span>
      <span className="mono" style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textAlign: "right" }}>
        {event.relTime ?? ""}
      </span>
      <span style={{
        fontSize: 10.5, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.04em",
        color: accent.color,
        padding: "2px 6px",
        background: accent.bg,
        border: `1px solid ${accent.border}`,
        borderRadius: 999, justifySelf: "flex-start",
      }}>{status || "—"}</span>
      <span style={{ fontSize: 11.5, color: "var(--c-fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {event.type || "—"}
        {event.isOpen != null && (
          <span style={{ marginLeft: 4, fontSize: 9, color: "var(--c-fg-dim)" }}>
            {event.isOpen ? "OPEN" : "CLOSE"}
          </span>
        )}
      </span>
      <span className="tnum" style={{ textAlign: "right", fontSize: 11.5 }}>
        {event.size != null && event.size > 0 ? event.size.toFixed(2) : "—"}
      </span>
      <LifecycleDetail event={event} ctx={ctx} />
    </div>
  )
}

/** Multi-line, event-aware detail cell. */
function LifecycleDetail({ event, ctx }: { event: EnrichedEvent; ctx: TradeContext }) {
  const status = (event.status ?? "").toLowerCase()
  const isFilled = status.includes("fill")
  const isPlaced = status.includes("placed")
  const isTriggered = status.includes("trigger")
  const isReplaced = status.includes("replac") || status.includes("modif")
  const isCancelled = status.includes("cancel") || status.includes("reject")

  const lines: React.ReactNode[] = []

  // Filled OPEN: entry execution
  if (isFilled && event.isOpen === true && event.filledPrice != null) {
    lines.push(
      <span key="fill-open" className="mono" style={primary}>
        Entry filled @ {fmtPrice(event.filledPrice, ctx.pair)}
      </span>,
    )
    if (event.slippage != null && Math.abs(event.slippage) > 0) {
      const dirGood = (ctx.side === "long" ? event.slippage < 0 : event.slippage > 0)
      lines.push(
        <span key="fill-slip" style={{ ...secondary, color: dirGood ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
          slippage {event.slippage >= 0 ? "+" : ""}{event.slippage.toFixed(5)} vs request
        </span>,
      )
    }
  }
  // Filled CLOSE: scale-out / final close — show per-leg P&L
  else if (isFilled && event.isOpen === false && event.filledPrice != null) {
    lines.push(
      <span key="fill-close" className="mono" style={primary}>
        Closed {event.size != null ? event.size.toFixed(2) : "?"} lot{event.size === 1 ? "" : "s"} @ {fmtPrice(event.filledPrice, ctx.pair)}
      </span>,
    )
    if (event.perFillPnl != null) {
      const tone = event.perFillPnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)"
      lines.push(
        <span key="fill-pnl" style={{ ...secondary, color: tone, fontWeight: 600 }}>
          this leg: {formatUSD(event.perFillPnl, { signed: true })}
        </span>,
      )
    }
  }
  // Replaced SL or TP: show old → new with classification
  else if (isReplaced) {
    if (event.slClass != null && event.stopLoss != null) {
      lines.push(
        <span key="sl-line" style={{ ...primary, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="mono">SL → {fmtPrice(event.stopLoss, ctx.pair)}</span>
          {slClassBadge(event.slClass)}
        </span>,
      )
      if (event.slDelta != null) {
        lines.push(
          <span key="sl-delta" style={secondary}>
            {event.slDelta >= 0 ? "+" : ""}{event.slDelta.toFixed(5)} from prior
          </span>,
        )
      }
    } else if (event.tpClass != null && event.takeProfit != null) {
      lines.push(
        <span key="tp-line" style={{ ...primary, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="mono">TP → {fmtPrice(event.takeProfit, ctx.pair)}</span>
          {tpClassBadge(event.tpClass)}
        </span>,
      )
      if (event.tpDelta != null) {
        lines.push(
          <span key="tp-delta" style={secondary}>
            {event.tpDelta >= 0 ? "+" : ""}{event.tpDelta.toFixed(5)} from prior
          </span>,
        )
      }
    } else if (event.price != null) {
      lines.push(
        <span key="price" className="mono" style={primary}>
          @ {fmtPrice(event.price, ctx.pair)}
        </span>,
      )
    }
  }
  // Triggered: order's trigger price reached
  else if (isTriggered && event.price != null) {
    lines.push(
      <span key="trig" className="mono" style={primary}>
        Triggered @ {fmtPrice(event.price, ctx.pair)}
      </span>,
    )
    if (event.type === "StopLoss" || event.type === "Stop") {
      lines.push(<span key="trig-tag" style={secondary}>stop hit</span>)
    } else if (event.type === "TakeProfit") {
      lines.push(<span key="trig-tag" style={secondary}>target reached</span>)
    }
  }
  // Placed: usually the initial entry order
  else if (isPlaced) {
    if (event.price != null) {
      lines.push(
        <span key="placed" className="mono" style={primary}>
          {event.isOpen ? "Entry order" : "Order"} @ {fmtPrice(event.price, ctx.pair)}
        </span>,
      )
    } else {
      lines.push(<span key="placed-mkt" style={primary}>Market order placed</span>)
    }
    if (event.stopLoss != null && event.takeProfit != null) {
      lines.push(
        <span key="placed-bracket" style={secondary}>
          bracket SL {fmtPrice(event.stopLoss, ctx.pair)} · TP {fmtPrice(event.takeProfit, ctx.pair)}
        </span>,
      )
    } else if (event.stopLoss != null) {
      lines.push(<span key="placed-sl" style={secondary}>SL {fmtPrice(event.stopLoss, ctx.pair)}</span>)
    } else if (event.takeProfit != null) {
      lines.push(<span key="placed-tp" style={secondary}>TP {fmtPrice(event.takeProfit, ctx.pair)}</span>)
    }
  }
  // Cancelled: usually OCO sibling
  else if (isCancelled) {
    if (event.type === "TakeProfit" || event.type === "StopLoss") {
      lines.push(
        <span key="cancel" style={primary}>
          {event.type === "TakeProfit" ? "TP" : "SL"} cancelled
        </span>,
      )
      lines.push(<span key="cancel-oco" style={secondary}>OCO sibling — opposite side hit</span>)
    } else {
      lines.push(<span key="cancel-other" style={primary}>Order cancelled</span>)
    }
  }
  // Fallback
  else {
    if (event.price != null) {
      lines.push(<span key="any-px" className="mono" style={primary}>@ {fmtPrice(event.price, ctx.pair)}</span>)
    }
    if (event.stopLoss != null) lines.push(<span key="any-sl" style={secondary}>SL {fmtPrice(event.stopLoss, ctx.pair)}</span>)
    if (event.takeProfit != null) lines.push(<span key="any-tp" style={secondary}>TP {fmtPrice(event.takeProfit, ctx.pair)}</span>)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      {lines.length > 0 ? lines : <span style={{ color: "var(--c-fg-dim)" }}>—</span>}
    </div>
  )
}

const primary: React.CSSProperties = {
  fontSize: 12,
  color: "var(--c-fg)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}
const secondary: React.CSSProperties = {
  fontSize: 10.5,
  color: "var(--c-fg-muted)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}

function slClassBadge(c: NonNullable<EnrichedEvent["slClass"]>): React.ReactNode {
  const map: Record<typeof c, { label: string; color: string; bg: string }> = {
    initial: { label: "initial", color: "var(--c-fg-muted)", bg: "var(--c-bg-elev-3)" },
    be: { label: "BE", color: "var(--c-purple-bright)", bg: "rgba(105, 50, 212, 0.12)" },
    trail: { label: "trail", color: "var(--c-green-bright)", bg: "rgba(17, 196, 88, 0.12)" },
    loose: { label: "loosened", color: "var(--c-amber)", bg: "rgba(229, 162, 59, 0.12)" },
  }
  const m = map[c]
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
      color: m.color, background: m.bg, padding: "1px 6px", borderRadius: 999, border: `1px solid ${withAlpha(m.color, 20)}`,
    }}>{m.label}</span>
  )
}

function tpClassBadge(c: NonNullable<EnrichedEvent["tpClass"]>): React.ReactNode {
  const map: Record<typeof c, { label: string; color: string; bg: string }> = {
    initial: { label: "initial", color: "var(--c-fg-muted)", bg: "var(--c-bg-elev-3)" },
    wider: { label: "wider", color: "var(--c-green-bright)", bg: "rgba(17, 196, 88, 0.12)" },
    tighter: { label: "tighter", color: "var(--c-amber)", bg: "rgba(229, 162, 59, 0.12)" },
  }
  const m = map[c]
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
      color: m.color, background: m.bg, padding: "1px 6px", borderRadius: 999, border: `1px solid ${withAlpha(m.color, 20)}`,
    }}>{m.label}</span>
  )
}

function formatRelativeTime(ms: number): string {
  if (ms < 0) return ""
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const remM = min % 60
  if (h < 24) return remM > 0 ? `${h}h${remM}m` : `${h}h`
  const d = Math.floor(h / 24)
  const remH = h % 24
  return remH > 0 ? `${d}d${remH}h` : `${d}d`
}

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const remM = min % 60
  if (h < 24) return remM > 0 ? `${h}h ${remM}m` : `${h}h`
  const d = Math.floor(h / 24)
  const remH = h % 24
  return remH > 0 ? `${d}d ${remH}h` : `${d}d`
}

function statusAccent(status: string): { color: string; bg: string; border: string } {
  const s = status.toLowerCase()
  if (s.includes("fill")) return { color: "var(--c-green-bright)", bg: "rgba(17, 196, 88, 0.10)", border: "rgba(17, 196, 88, 0.35)" }
  if (s.includes("trigger")) return { color: "var(--c-amber)", bg: "rgba(229, 162, 59, 0.12)", border: "rgba(229, 162, 59, 0.35)" }
  if (s.includes("cancel") || s.includes("reject")) return { color: "var(--c-red-bright)", bg: "rgba(190, 51, 61, 0.10)", border: "rgba(190, 51, 61, 0.35)" }
  if (s.includes("replac") || s.includes("modif")) return { color: "var(--c-purple-bright)", bg: "rgba(105, 50, 212, 0.10)", border: "rgba(105, 50, 212, 0.35)" }
  if (s.includes("placed")) return { color: "var(--c-fg-muted)", bg: "var(--c-bg-elev-3)", border: "var(--c-border)" }
  return { color: "var(--c-fg-muted)", bg: "var(--c-bg-elev-3)", border: "var(--c-border)" }
}

// ─── Replay tab (Polygon candles + entry/stop/target/exit markers) ───────

function ReplayPanel({
  tradeId, pair, side, entryPrice, exitPrice, stopPrice, targetPrice,
}: {
  tradeId: string
  pair: string
  side: string
  entryPrice: number
  exitPrice: number | null
  stopPrice: number | null
  targetPrice: number | null
}) {
  const [tf, setTf] = useState<"M5" | "M15" | "H1" | "H4" | "D1">("H1")
  const [state, setState] = useState<ReplayResult | null>(null)
  const [pending, startLoad] = useTransition()

  useEffect(() => {
    startLoad(async () => {
      const r = await getReplayCandles({ tradeId, timeframe: tf })
      setState(r)
    })
  }, [tradeId, tf])

  if (!state || pending) {
    return <Section title="Replay"><div style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>Loading {pair} candles…</div></Section>
  }

  if (!state.ok) {
    return (
      <Section title="Replay">
        {state.configured ? (
          <div style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>{state.error}</div>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
            <p style={{ margin: "0 0 8px" }}>Trade replay needs a Polygon.io API key.</p>
            <p style={{ margin: 0, color: "var(--c-fg-dim)" }}>
              Set <code style={{ fontFamily: "var(--font-mono)" }}>POLYGON_API_KEY</code> in your environment to fetch
              candles for past trades. Free tier covers FX majors.
            </p>
          </div>
        )}
      </Section>
    )
  }

  return (
    <Section title="Replay">
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
        {(["M5", "M15", "H1", "H4", "D1"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTf(t)}
            className={`tab ${t === tf ? "active" : ""}`}
            style={{ padding: "4px 10px", fontSize: 11.5, borderRadius: 6 }}
          >{t}</button>
        ))}
      </div>
      <CandleChart
        bars={state.bars}
        entryTs={state.entryTs}
        exitTs={state.exitTs}
        entryPrice={entryPrice}
        exitPrice={exitPrice}
        stopPrice={stopPrice}
        targetPrice={targetPrice}
        side={side}
      />
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 8,
        fontSize: 10.5,
        color: "var(--c-fg-dim)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}>
        <span>{state.ticker.replace(/^[A-Z]:/, "")} · {state.timeframe}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--c-purple-bright)" }} />
            Entry
          </span>
          {state.exitTs != null && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--c-fg-muted)" }} />
              Exit
            </span>
          )}
        </span>
      </div>
    </Section>
  )
}

// Pure SVG candle chart — minimal, premium look. No price labels, no axes,
// no stop/target lines. Just the candles and faint entry/exit dots.
function CandleChart({
  bars, entryTs, exitTs, entryPrice, exitPrice, side,
}: {
  bars: Aggregate[]
  entryTs: number
  exitTs: number | null
  entryPrice: number
  exitPrice: number | null
  stopPrice: number | null
  targetPrice: number | null
  side: string
}) {
  if (bars.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>
        No candles in window. Polygon may not carry this symbol on your plan.
      </div>
    )
  }

  // Trim to a clean number of candles centered around entry/exit so it
  // reads as "a few candles" rather than a noisy 500-bar wall.
  const MAX_BARS = 60
  let visible = bars
  if (bars.length > MAX_BARS) {
    let entryIdx = 0
    let bestDelta = Infinity
    for (let i = 0; i < bars.length; i++) {
      const d = Math.abs(bars[i].ts - entryTs)
      if (d < bestDelta) { entryIdx = i; bestDelta = d }
    }
    let center = entryIdx
    if (exitTs != null) {
      let exitIdx = 0
      let bestExit = Infinity
      for (let i = 0; i < bars.length; i++) {
        const d = Math.abs(bars[i].ts - exitTs)
        if (d < bestExit) { exitIdx = i; bestExit = d }
      }
      center = Math.round((entryIdx + exitIdx) / 2)
    }
    const half = Math.floor(MAX_BARS / 2)
    let start = Math.max(0, center - half)
    const end = Math.min(bars.length, start + MAX_BARS)
    start = Math.max(0, end - MAX_BARS)
    visible = bars.slice(start, end)
  }

  const W = 540
  const H = 220
  const padX = 14
  const padY = 18

  // Range driven by visible candles only — keeps the chart tight even when
  // entry/stop/target sit far outside the recent action.
  const hiBars = Math.max(...visible.map((b) => b.high))
  const loBars = Math.min(...visible.map((b) => b.low))
  const rangeBars = hiBars - loBars || 1
  // Add small headroom so candles never kiss the top/bottom edges.
  const hi = hiBars + rangeBars * 0.08
  const lo = loBars - rangeBars * 0.08
  const range = hi - lo || 1
  const stepX = (W - padX * 2) / visible.length
  const xFor = (i: number) => padX + i * stepX + stepX / 2
  const yFor = (v: number) => H - padY - ((v - lo) / range) * (H - padY * 2)

  const tsToIdx = (ts: number): number => {
    let best = 0
    let bestDelta = Infinity
    for (let i = 0; i < visible.length; i++) {
      const d = Math.abs(visible[i].ts - ts)
      if (d < bestDelta) { best = i; bestDelta = d }
    }
    return best
  }

  // Only render a marker if its price actually falls within the visible range —
  // off-chart dots are visual noise.
  const inRange = (v: number) => v >= lo && v <= hi
  const entryX = xFor(tsToIdx(entryTs))
  const exitX = exitTs != null ? xFor(tsToIdx(exitTs)) : null
  const candleWidth = Math.max(1.5, stepX * 0.55)
  const wickWidth = Math.max(0.75, candleWidth * 0.18)

  const exitColor = exitPrice != null && (
    (side === "long" && exitPrice >= entryPrice) ||
    (side === "short" && exitPrice <= entryPrice)
  ) ? "var(--c-green-bright)" : "var(--c-red-bright)"

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      style={{
        borderRadius: 12,
        border: "1px solid var(--c-border)",
        background: "linear-gradient(180deg, var(--c-bg-elev-2) 0%, var(--c-bg-elev-1) 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
        display: "block",
      }}
    >
      <defs>
        <linearGradient id="upBody" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--c-green-bright)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--c-green-bright)" stopOpacity="0.78" />
        </linearGradient>
        <linearGradient id="downBody" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--c-red-bright)" stopOpacity="0.78" />
          <stop offset="100%" stopColor="var(--c-red-bright)" stopOpacity="1" />
        </linearGradient>
        <radialGradient id="entryGlow">
          <stop offset="0%" stopColor="var(--c-purple-bright)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--c-purple-bright)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="exitGlow">
          <stop offset="0%" stopColor={exitColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={exitColor} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Candles */}
      {visible.map((b, i) => {
        const x = xFor(i)
        const up = b.close >= b.open
        const stroke = up ? "var(--c-green-bright)" : "var(--c-red-bright)"
        const fill = up ? "url(#upBody)" : "url(#downBody)"
        const yTop = yFor(Math.max(b.open, b.close))
        const yBot = yFor(Math.min(b.open, b.close))
        const bodyH = Math.max(1, yBot - yTop)
        return (
          <g key={i}>
            <rect
              x={x - wickWidth / 2}
              y={yFor(b.high)}
              width={wickWidth}
              height={Math.max(1, yFor(b.low) - yFor(b.high))}
              fill={stroke}
              opacity={0.85}
              rx={wickWidth / 2}
            />
            <rect
              x={x - candleWidth / 2}
              y={yTop}
              width={candleWidth}
              height={bodyH}
              fill={fill}
              rx={Math.min(1.5, candleWidth / 4)}
            />
          </g>
        )
      })}

      {/* Entry marker — soft glow + dot, no axis-spanning line */}
      {inRange(entryPrice) && (
        <g>
          <circle cx={entryX} cy={yFor(entryPrice)} r={10} fill="url(#entryGlow)" />
          <circle cx={entryX} cy={yFor(entryPrice)} r={3} fill="var(--c-purple-bright)" />
          <circle cx={entryX} cy={yFor(entryPrice)} r={3} fill="none" stroke="var(--c-bg-elev-1)" strokeWidth={0.75} />
        </g>
      )}

      {/* Exit marker */}
      {exitX != null && exitPrice != null && inRange(exitPrice) && (
        <g>
          <circle cx={exitX} cy={yFor(exitPrice)} r={10} fill="url(#exitGlow)" />
          <circle cx={exitX} cy={yFor(exitPrice)} r={3} fill={exitColor} />
          <circle cx={exitX} cy={yFor(exitPrice)} r={3} fill="none" stroke="var(--c-bg-elev-1)" strokeWidth={0.75} />
        </g>
      )}

    </svg>
  )
}

// ─── Macro context row (DXY / SPX / VIX at entry) ─────────────────────────

function ContextRow({ tradeId }: { tradeId: string }) {
  const [state, setState] = useState<ContextResult | null>(null)
  useEffect(() => {
    void getTradeContext(tradeId).then(setState)
  }, [tradeId])

  if (!state) return null

  if (!state.ok) {
    if (!state.configured) return null  // hide entirely when Polygon isn't set up
    return null
  }

  const s = state.snapshot
  // If we got nothing meaningful, don't render an empty card.
  if (s.dxy == null && s.spx == null && s.vix == null) return null

  return (
    <Section title="Context at entry">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
        {s.dxy != null && (
          <Cell
            label="DXY"
            value={s.dxy.toFixed(2)}
            mono
            badge={s.dxyPctChange1d != null ? {
              text: `${s.dxyPctChange1d >= 0 ? "+" : ""}${s.dxyPctChange1d.toFixed(2)}%`,
              color: s.dxyPctChange1d >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)",
            } : undefined}
          />
        )}
        {s.spx != null && (
          <Cell
            label="S&P 500"
            value={s.spx.toFixed(2)}
            mono
            badge={s.spxPctChange1d != null ? {
              text: `${s.spxPctChange1d >= 0 ? "+" : ""}${s.spxPctChange1d.toFixed(2)}%`,
              color: s.spxPctChange1d >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)",
            } : undefined}
          />
        )}
        {s.vix != null && (
          <Cell
            label="VIX"
            value={s.vix.toFixed(2)}
            mono
            badge={{
              text: s.vix < 15 ? "calm" : s.vix < 25 ? "normal" : "elevated",
              color: s.vix < 15 ? "var(--c-green-bright)" : s.vix < 25 ? "var(--c-fg-muted)" : "var(--c-red-bright)",
            }}
          />
        )}
      </div>
    </Section>
  )
}

// ─── Broker actions (TradeLocker live modify / close) ────────────────────

function BrokerActions({
  tradeId, pair, side, entryPrice, stopPrice, targetPrice, refresh,
}: {
  tradeId: string
  pair: string
  side: string
  entryPrice: number
  stopPrice: number | null
  targetPrice: number | null
  refresh: () => void
}) {
  const [busy, setBusy] = useState<"modify" | "be" | "close" | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [newStop, setNewStop] = useState(stopPrice != null ? String(stopPrice) : "")
  const [newTarget, setNewTarget] = useState(targetPrice != null ? String(targetPrice) : "")

  const onMoveSlToBe = async () => {
    if (!confirm(`Move stop to break-even (entry ${entryPrice})? This sends a live modify to TradeLocker.`)) return
    setBusy("be"); setErr(null)
    const r = await brokerModifyPosition({ tradeId, stop_price: entryPrice })
    setBusy(null)
    if (!r.ok) setErr(r.error)
    else refresh()
  }

  const onSaveModify = async () => {
    const stop = newStop ? Number(newStop) : null
    const target = newTarget ? Number(newTarget) : null
    if (!confirm(`Send modify to TradeLocker? SL=${stop ?? "—"}, TP=${target ?? "—"}`)) return
    setBusy("modify"); setErr(null)
    const r = await brokerModifyPosition({
      tradeId,
      stop_price: stop,
      target_price: target,
    })
    setBusy(null)
    if (!r.ok) setErr(r.error)
    else { setEditing(false); refresh() }
  }

  const onClose = async () => {
    if (!confirm("Close this position at market via TradeLocker? This is irreversible.")) return
    setBusy("close"); setErr(null)
    const r = await brokerClosePosition(tradeId)
    setBusy(null)
    if (!r.ok) setErr(r.error)
    else refresh()
  }

  const sideAdjusted = side === "long" ? "+" : "−"

  return (
    <Section title="Broker actions">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Quick action: SL to BE */}
        {stopPrice != null && stopPrice !== entryPrice && (
          <button
            type="button"
            onClick={onMoveSlToBe}
            disabled={busy != null}
            className="btn"
            style={{ justifyContent: "flex-start", padding: "8px 12px" }}
            title={`Move stop from ${stopPrice} to ${entryPrice} (entry)`}
          >
            <Icon name="risk" size={12} />
            <span>{busy === "be" ? "Sending…" : `Move SL to break-even (${pair} ${entryPrice})`}</span>
          </button>
        )}

        {/* Edit SL/TP inline */}
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy != null}
            className="btn"
            style={{ justifyContent: "flex-start", padding: "8px 12px" }}
          >
            <Icon name="edit" size={12} />
            <span>Modify SL / TP at broker</span>
          </button>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8 }}>
            <input
              type="number" step="any" placeholder="New SL"
              value={newStop} onChange={(e) => setNewStop(e.target.value)} style={priceInput}
            />
            <input
              type="number" step="any" placeholder="New TP"
              value={newTarget} onChange={(e) => setNewTarget(e.target.value)} style={priceInput}
            />
            <button type="button" onClick={() => setEditing(false)} className="btn">Cancel</button>
            <button type="button" onClick={onSaveModify} disabled={busy != null} className="btn btn-primary">
              {busy === "modify" ? "…" : "Send modify"}
            </button>
          </div>
        )}

        {/* Close at market */}
        <button
          type="button"
          onClick={onClose}
          disabled={busy != null}
          className="btn"
          style={{
            justifyContent: "flex-start", padding: "8px 12px",
            color: "var(--c-amber)",
            borderColor: "rgba(229, 162, 59, 0.3)",
          }}
        >
          <Icon name="x" size={12} />
          <span>{busy === "close" ? "Closing…" : `Close ${sideAdjusted} position at market`}</span>
        </button>

        {err && (
          <div style={{ fontSize: 12, color: "var(--c-red-bright)" }}>{err}</div>
        )}
        <div style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>
          Each action is sent live to TradeLocker. The next sync (or realtime push) will reflect the broker&apos;s confirmation.
        </div>
      </div>
    </Section>
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

function Cell({
  label, value, mono, badge,
}: {
  label: string
  value: string
  mono?: boolean
  badge?: { text: string; color: string; title?: string }
}) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
        <span className={mono ? "mono" : "tnum"} style={{ fontSize: 12.5 }}>{value}</span>
        {badge && (
          <span title={badge.title} style={{ fontSize: 10.5, color: badge.color, fontWeight: 600 }}>{badge.text}</span>
        )}
      </div>
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

function OrderTypeChip({ type }: { type: string | null }) {
  if (!type) return null
  const t = type.toLowerCase()
  const label = t === "market" ? "Market"
    : t === "limit" ? "Limit"
    : t === "stop" ? "Stop"
    : t.charAt(0).toUpperCase() + t.slice(1)
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "1px 8px", borderRadius: 999,
      fontSize: 10, fontWeight: 600,
      color: "var(--c-fg-dim)", background: "var(--c-bg-elev-3)",
      border: "1px solid var(--c-border)",
      textTransform: "uppercase", letterSpacing: "0.04em",
    }}>
      {label}
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
