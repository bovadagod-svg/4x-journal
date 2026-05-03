"use client"

import { Fragment, useMemo, useState } from "react"
import { Icon, PairFlag } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import { formatLotsOrSize } from "@/lib/lots"
import { useJournalDrawer } from "@/components/journal/journal-drawer-context"
import { useTradeDetailDrawer } from "@/components/trades/trade-detail-drawer-context"
import { usePnLDisplay } from "@/lib/pnl-display-context"
import { TradeRowActions } from "@/components/trades/trade-row-actions"
import type { Trade, JournalEntry } from "@/lib/queries/trades"

type Result = "win" | "loss" | "breakeven" | "open"
type SortKey = "opened_at" | "pair" | "side" | "setup" | "size" | "r" | "pnl" | "result" | "mood" | "rules"

export type ColumnEnriched = Trade & {
  setupName: string | null
  result: Result
  ruleBreak: boolean | null  // null = no linked entry
  hasEntry: boolean
}

export function TradeTable({
  trades,
  entriesByTrade,
  playbookMap,
  totalCount,
}: {
  trades: Trade[]
  entriesByTrade: Map<string, JournalEntry>
  playbookMap: Map<string, string>
  totalCount: number
}) {
  const enriched: ColumnEnriched[] = useMemo(
    () =>
      trades.map((t) => {
        const entry = entriesByTrade.get(t.id)
        const pnl = Number(t.pnl)
        const result: Result =
          t.status === "open" ? "open"
          : pnl > 0 ? "win"
          : pnl < 0 ? "loss"
          : "breakeven"
        return {
          ...t,
          setupName: t.playbook_id ? (playbookMap.get(t.playbook_id) ?? null) : null,
          result,
          ruleBreak: entry ? entry.rule_break : null,
          hasEntry: !!entry,
        }
      }),
    [trades, entriesByTrade, playbookMap],
  )

  const [sort, setSort] = useState<{ col: SortKey; dir: "asc" | "desc" }>({ col: "opened_at", dir: "desc" })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)
  const tradeDrawer = useTradeDetailDrawer()
  const pnlDisplay = usePnLDisplay()

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1
    return [...enriched].sort((a, b) => {
      const av = sortField(a, sort.col)
      const bv = sortField(b, sort.col)
      if (av === bv) return 0
      return av > bv ? dir : -dir
    })
  }, [enriched, sort])

  const toggleSort = (col: SortKey) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "desc" }))

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  const toggleAll = () => {
    if (selected.size === sorted.length) setSelected(new Set())
    else setSelected(new Set(sorted.map((t) => t.id)))
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {selected.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 16px",
            background: "var(--c-purple-soft)",
            borderBottom: "1px solid rgba(105, 50, 212, 0.3)",
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>{selected.size} selected</span>
          <button className="btn" style={{ fontSize: 11.5, padding: "5px 10px", opacity: 0.5, cursor: "not-allowed" }} title="Coming soon">
            <Icon name="edit" size={11} /> Tag
          </button>
          <button className="btn" style={{ fontSize: 11.5, padding: "5px 10px", opacity: 0.5, cursor: "not-allowed" }} title="Coming soon">
            Add to Playbook
          </button>
          <button
            className="btn"
            style={{ fontSize: 11.5, padding: "5px 10px", marginLeft: "auto", color: "var(--c-fg-muted)" }}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 1100 }}>
          <thead>
            <tr style={{ background: "var(--c-bg-elev-2)" }}>
              <Th>
                <input
                  type="checkbox"
                  checked={selected.size === sorted.length && sorted.length > 0}
                  onChange={toggleAll}
                  style={{ accentColor: "var(--c-accent-bright)" }}
                />
              </Th>
              <SortableTh col="opened_at" sort={sort} onClick={() => toggleSort("opened_at")}>Date / Time</SortableTh>
              <SortableTh col="pair" sort={sort} onClick={() => toggleSort("pair")}>Pair</SortableTh>
              <SortableTh col="side" sort={sort} onClick={() => toggleSort("side")}>Side</SortableTh>
              <SortableTh col="setup" sort={sort} onClick={() => toggleSort("setup")}>Setup</SortableTh>
              <SortableTh col="size" sort={sort} onClick={() => toggleSort("size")} align="right">Size</SortableTh>
              <SortableTh col="r" sort={sort} onClick={() => toggleSort("r")} align="right">R</SortableTh>
              <SortableTh col="pnl" sort={sort} onClick={() => toggleSort("pnl")} align="right">{pnlDisplay.label("P&L")}</SortableTh>
              <SortableTh col="result" sort={sort} onClick={() => toggleSort("result")}>Result</SortableTh>
              <SortableTh col="mood" sort={sort} onClick={() => toggleSort("mood")}>Mood</SortableTh>
              <SortableTh col="rules" sort={sort} onClick={() => toggleSort("rules")}>Rules</SortableTh>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={12} style={{ padding: 60, textAlign: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
                  No trades match your filters.
                </td>
              </tr>
            )}
            {sorted.map((t) => {
              const isExp = expanded === t.id
              const isSel = selected.has(t.id)
              const pnl = Number(t.pnl)
              const r = Number(t.r)
              return (
                <Fragment key={t.id}>
                  <tr
                    style={{
                      borderTop: "1px solid var(--c-border)",
                      background: isSel ? "var(--c-purple-soft)" : isExp ? "var(--c-bg-elev-2)" : "transparent",
                      cursor: "pointer",
                    }}
                    onClick={() => tradeDrawer.openTrade(t.id)}
                  >
                    <td style={{ padding: "11px 16px" }}>
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(t.id) }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ accentColor: "var(--c-accent-bright)" }}
                      />
                    </td>
                    <td style={{ padding: "11px 12px" }}>
                      {t.opened_at ? (
                        <>
                          <div style={{ fontWeight: 500 }}>
                            {new Date(t.opened_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }} className="mono">
                            {new Date(t.opened_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: 500, color: "var(--c-amber)" }}>Pending</div>
                          <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }} className="mono">
                            placed {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                        </>
                      )}
                    </td>
                    <td style={{ padding: "11px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <PairFlag pair={t.pair} size={14} />
                        <span style={{ fontWeight: 500 }}>{t.pair}</span>
                      </div>
                    </td>
                    <td style={{ padding: "11px 12px" }}>
                      <span className={"chip " + (t.side === "long" ? "chip-green" : "chip-red")} style={{ fontSize: 10, padding: "1px 7px" }}>
                        <Icon name={t.side === "long" ? "arrowUp" : "arrowDown"} size={9} /> {t.side.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "11px 12px", color: "var(--c-fg-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 200 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        {t.setupName ?? "—"}
                        {t.hasEntry && (
                          <span title="Linked journal entry" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-accent-bright)" }} />
                        )}
                      </span>
                    </td>
                    <td className="tnum" style={{ padding: "11px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {formatLotsOrSize(t.size, t.contract_size, { withUnit: false })}
                    </td>
                    <td
                      className="tnum"
                      style={{
                        padding: "11px 12px",
                        textAlign: "right",
                        fontFamily: "var(--font-mono)",
                        color: r > 0 ? "var(--c-green-bright)" : r < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
                      }}
                    >
                      {t.r != null ? `${r > 0 ? "+" : ""}${r.toFixed(2)}R` : "—"}
                    </td>
                    <td
                      className="tnum"
                      style={{
                        padding: "11px 12px",
                        textAlign: "right",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color: pnl > 0 ? "var(--c-green-bright)" : pnl < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
                      }}
                    >
                      {pnlDisplay.format({
                        pnl: t.pnl != null ? pnl : null,
                        r: t.r != null ? Number(t.r) : null,
                        equity: null, // per-trade equity at fill is not stored — % mode falls back to "—"
                        signed: true,
                      })}
                    </td>
                    <td style={{ padding: "11px 12px" }}>
                      <ResultPill result={t.result} />
                    </td>
                    <td style={{ padding: "11px 12px", fontSize: 11, color: "var(--c-fg-muted)", textTransform: "capitalize" }}>
                      {t.mood ?? "—"}
                    </td>
                    <td style={{ padding: "11px 12px" }}>
                      <RulesBadge ruleBreak={t.ruleBreak} />
                    </td>
                    <td style={{ padding: "11px 16px", textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                        <TradeRowActions tradeId={t.id} status={t.status} />
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={12} style={{ padding: 0 }}>
                        <LedgerExpand tradeId={t.id} entry={entriesByTrade.get(t.id)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          borderTop: "1px solid var(--c-border)",
          fontSize: 11.5,
          color: "var(--c-fg-muted)",
        }}
      >
        <span>
          {sorted.length === totalCount
            ? `${sorted.length} trade${sorted.length === 1 ? "" : "s"}`
            : `${sorted.length} of ${totalCount} matching filters`}
        </span>
      </div>
    </div>
  )
}

function sortField(t: ColumnEnriched, key: SortKey): string | number {
  switch (key) {
    case "opened_at": return t.opened_at ? new Date(t.opened_at).getTime() : new Date(t.created_at).getTime()
    case "pair": return t.pair
    case "side": return t.side
    case "setup": return t.setupName ?? ""
    case "size": return Number(t.size) || 0
    case "r": return Number(t.r) || 0
    case "pnl": return Number(t.pnl) || 0
    case "result": return t.result
    case "mood": return t.mood ?? ""
    case "rules": return t.ruleBreak === false ? 1 : t.ruleBreak === true ? 0 : 0.5
  }
}

function ResultPill({ result }: { result: Result }) {
  const styles =
    result === "win" ? { bg: "var(--c-green-soft)", fg: "var(--c-green-bright)" }
    : result === "loss" ? { bg: "var(--c-red-soft)", fg: "var(--c-red-bright)" }
    : result === "open" ? { bg: "var(--c-purple-soft)", fg: "#B79CFF" }
    : { bg: "var(--c-bg-elev-3)", fg: "var(--c-fg-muted)" }
  return (
    <span style={{
      fontSize: 10.5, padding: "2px 8px", borderRadius: 999,
      background: styles.bg, color: styles.fg, textTransform: "capitalize",
    }}>{result}</span>
  )
}

function RulesBadge({ ruleBreak }: { ruleBreak: boolean | null }) {
  if (ruleBreak === null) {
    return (
      <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>—</span>
    )
  }
  const followed = !ruleBreak
  return (
    <span
      title={followed ? "Rules followed" : "Rules broken"}
      style={{
        width: 18, height: 18, borderRadius: "50%",
        background: followed ? "var(--c-green-soft)" : "var(--c-red-soft)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Icon name={followed ? "check" : "x"} size={11} color={followed ? "var(--c-green-bright)" : "var(--c-red-bright)"} strokeWidth={2.2} />
    </span>
  )
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{
      textAlign: align,
      padding: "10px 12px",
      fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
      color: "var(--c-fg-dim)", whiteSpace: "nowrap",
    }}>{children}</th>
  )
}

function SortableTh({
  col, sort, onClick, children, align = "left",
}: {
  col: SortKey
  sort: { col: SortKey; dir: "asc" | "desc" }
  onClick: () => void
  children: React.ReactNode
  align?: "left" | "right"
}) {
  const active = sort.col === col
  const arrow = !active ? <span style={{ opacity: 0.3, marginLeft: 3 }}>↕</span> : <span style={{ marginLeft: 3 }}>{sort.dir === "asc" ? "↑" : "↓"}</span>
  return (
    <th style={{ padding: 0, background: "var(--c-bg-elev-2)" }}>
      <button
        onClick={onClick}
        style={{
          display: "block",
          width: "100%",
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          color: active ? "var(--c-fg)" : "var(--c-fg-muted)",
          fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
          textAlign: align,
          whiteSpace: "nowrap",
          cursor: "pointer",
        }}
      >
        {children}{arrow}
      </button>
    </th>
  )
}

function LedgerExpand({ tradeId, entry }: { tradeId: string; entry?: JournalEntry }) {
  const { open, openForTrade } = useJournalDrawer()

  if (!entry) {
    return (
      <div style={{ background: "var(--c-bg-elev-2)", padding: "12px 16px 16px", borderTop: "1px solid var(--c-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--c-fg-muted)", fontSize: 12.5 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: "var(--c-bg-elev-3)", border: "1px dashed var(--c-border-strong)", display: "grid", placeItems: "center" }}>
            <Icon name="edit" size={15} color="var(--c-fg-muted)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "var(--c-fg)", fontSize: 13, fontWeight: 500, marginBottom: 2 }}>No journal entry linked</div>
            <div style={{ fontSize: 11.5 }}>Capture pre-trade thesis, live notes, and a post-trade review.</div>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 11.5, padding: "6px 12px" }} onClick={() => openForTrade(tradeId)}>
            <Icon name="plus" size={11} /> Create journal entry
          </button>
        </div>
      </div>
    )
  }

  const phases: Array<{ key: string; label: string; body: string | null; icon: "target" | "play" | "check" | "sparkle" }> = [
    { key: "pre", label: "Pre-trade thesis", body: entry.pre_trade ?? null, icon: "target" },
    { key: "live", label: "During trade", body: formatDuringNotes(entry.during_trade), icon: "play" },
    { key: "post", label: "Post-trade review", body: entry.post_trade ?? null, icon: "check" },
    { key: "review", label: "Cold review (24–48h)", body: entry.cold_review ?? null, icon: "sparkle" },
  ]
  const populated = phases.filter((p) => p.body && p.body.trim().length > 0)

  return (
    <div style={{ background: "var(--c-bg-elev-2)", padding: "12px 16px 16px", borderTop: "1px solid var(--c-border)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 0 8px" }}>
            <span className="chip chip-purple" style={{ fontSize: 10 }}>
              <Icon name="edit" size={10} /> JOURNAL ENTRY
            </span>
            <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>{entry.title ?? "Untitled"}</span>
            <span style={{ fontSize: 11, color: "var(--c-fg-dim)", marginLeft: "auto" }} className="mono">
              edited {new Date(entry.last_edited_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          </div>

          {populated.length === 0 ? (
            <div style={{ color: "var(--c-fg-muted)", fontSize: 12.5, padding: "8px 2px" }}>
              Entry exists but is empty. Open it to start filling in pre-trade / live / post-trade notes.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {populated.map((p) => (
                <div key={p.key} style={{ background: "var(--c-bg-elev-1)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    <Icon name={p.icon} size={11} color="var(--c-accent-bright)" />
                    {p.label}
                  </div>
                  <div style={{
                    fontSize: 12, color: "var(--c-fg)", lineHeight: 1.5, whiteSpace: "pre-wrap",
                    display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {p.body}
                  </div>
                </div>
              ))}
            </div>
          )}

          {entry.tags && entry.tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
              {entry.tags.map((tag) => (
                <span key={tag} style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 999, background: "var(--c-bg-elev-3)", color: "var(--c-fg-muted)", border: "1px solid var(--c-border)" }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 0 }}>
          <button className="btn" style={{ fontSize: 11.5, padding: "6px 10px", whiteSpace: "nowrap" }} onClick={() => open(entry.id)}>
            <Icon name="external" size={11} /> Open in Journal
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDuringNotes(jsonb: unknown): string | null {
  if (!Array.isArray(jsonb)) return null
  const lines = jsonb
    .map((n) => {
      if (!n || typeof n !== "object") return null
      const o = n as { ts?: string; text?: string }
      if (!o.text) return null
      const t = o.ts ? new Date(o.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""
      return `${t ? t + " — " : ""}${o.text}`
    })
    .filter(Boolean)
  return lines.length > 0 ? (lines as string[]).join("\n") : null
}
