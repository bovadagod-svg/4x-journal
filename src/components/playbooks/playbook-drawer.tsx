"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon, PairFlag, type IconName } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import { deletePlaybook } from "@/lib/actions/playbooks"
import { PlaybookFormModal } from "./playbook-form-modal"
import type { Playbook, PlaybookStats } from "@/lib/queries/playbooks"
import type { Trade } from "@/lib/queries/trades"

type Tab = "rules" | "context" | "performance" | "history"

export function PlaybookDrawer({
  playbook,
  onClose,
  recentTrades,
}: {
  playbook: (Playbook & { stats: PlaybookStats }) | null
  onClose: () => void
  recentTrades: Trade[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("rules")
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!playbook) return
    setTab("rules")
  }, [playbook?.id])

  useEffect(() => {
    if (!playbook) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [playbook, onClose])

  if (!playbook) return null

  const onDelete = async () => {
    if (!confirm(`Delete "${playbook.name}"?`)) return
    const r = await deletePlaybook(playbook.id)
    if (r.ok) { onClose(); router.refresh() }
    else alert(r.error)
  }

  const tradesForPlaybook = recentTrades.filter((t) => t.playbook_id === playbook.id).slice(0, 8)
  const statusChip = playbook.status === "active" ? "chip-green" : playbook.status === "review" ? "chip-amber" : ""

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 100 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(560px, 92vw)",
        background: "var(--c-bg-elev-1)", borderLeft: "1px solid var(--c-border-strong)",
        zIndex: 101, overflowY: "auto", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: 22, paddingBottom: 0, position: "sticky", top: 0, background: "var(--c-bg-elev-1)", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${playbook.color}22`, border: `1px solid ${playbook.color}44`,
                display: "grid", placeItems: "center", flexShrink: 0,
              }}>
                <Icon name={(playbook.icon as IconName) ?? "lightning"} size={22} color={playbook.color === "#9A97A1" ? "var(--c-fg-muted)" : playbook.color} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600 }}>{playbook.name}</h2>
                  <span className={`chip ${statusChip}`} style={{ fontSize: 10, padding: "1px 7px", textTransform: "uppercase" }}>{playbook.status}</span>
                </div>
                {playbook.description && (
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.4 }}>{playbook.description}</p>
                )}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "var(--c-bg-elev-3)", border: "1px solid var(--c-border)", borderRadius: 8, width: 32, height: 32, display: "grid", placeItems: "center", color: "var(--c-fg)", flexShrink: 0, cursor: "pointer" }}>
              <Icon name="x" size={14} />
            </button>
          </div>

          {/* Stats strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            <Stat label="Net P&L" value={playbook.stats.closedTrades > 0 ? formatUSD(playbook.stats.totalPnL, { signed: true }) : "—"} color={playbook.stats.totalPnL >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)"} />
            <Stat label="Win Rate" value={playbook.stats.winRate != null ? `${playbook.stats.winRate}%` : "—"} />
            <Stat label="Expectancy" value={playbook.stats.expectancy != null ? `${playbook.stats.expectancy > 0 ? "+" : ""}${playbook.stats.expectancy}R` : "—"} color="var(--c-green-bright)" />
            <Stat label="Trades" value={String(playbook.stats.trades)} color="var(--c-purple-bright)" />
          </div>

          {/* Tabs */}
          <div className="tab-row" style={{ marginTop: 16, gap: 2, borderBottom: "1px solid var(--c-border)", marginInline: -22, paddingInline: 22 }}>
            {(["rules", "context", "performance", "history"] as Tab[]).map((t) => (
              <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)} style={{ borderRadius: "8px 8px 0 0", textTransform: "capitalize", padding: "8px 14px" }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          {tab === "rules" && (
            <>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <Icon name="check" size={14} color="var(--c-green-bright)" />
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Entry Rules</h4>
                </div>
                {playbook.rules.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12.5, color: "var(--c-fg-muted)" }}>No rules yet — edit the playbook to add some.</p>
                ) : (
                  <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {playbook.rules.map((r, i) => (
                      <li key={i} style={{ display: "flex", gap: 10, padding: "9px 12px", background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, fontSize: 12.5, lineHeight: 1.5 }}>
                        <span style={{ color: "var(--c-accent-bright)", fontWeight: 600, fontFamily: "var(--font-mono)", fontSize: 11, flexShrink: 0, paddingTop: 1 }}>{String(i + 1).padStart(2, "0")}</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {playbook.invalidations.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <Icon name="x" size={14} color="var(--c-red-bright)" />
                    <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Invalidations — Skip if</h4>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {playbook.invalidations.map((r, i) => (
                      <li key={i} style={{ display: "flex", gap: 10, padding: "9px 12px", background: "rgba(190, 51, 61, 0.06)", border: "1px solid rgba(190, 51, 61, 0.2)", borderRadius: 8, fontSize: 12.5, lineHeight: 1.5 }}>
                        <Icon name="x" size={12} color="var(--c-red-bright)" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {playbook.notes && (
                <div>
                  <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600 }}>Notes</h4>
                  <p style={{ margin: 0, padding: "10px 12px", background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, fontSize: 12.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{playbook.notes}</p>
                </div>
              )}
            </>
          )}

          {tab === "context" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {([
                  ["Risk per trade", playbook.risk_per_trade_pct != null ? `${playbook.risk_per_trade_pct}% of account` : "—"],
                  ["Target R", playbook.target_r != null ? `${playbook.target_r}R` : "—"],
                  ["Timeframe", playbook.timeframe ?? "—"],
                  ["Last used", playbook.stats.closedTrades > 0 ? "Recent" : "Never"],
                ] as const).map(([k, v]) => (
                  <div key={k} style={{ background: "var(--c-bg-elev-2)", padding: 12, borderRadius: 8, border: "1px solid var(--c-border)" }}>
                    <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>

              {playbook.pairs.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Pairs</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {playbook.pairs.map((p) => (
                      <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 10px", borderRadius: 999, background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)" }}>
                        <PairFlag pair={p} size={13} /> {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {playbook.sessions.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Sessions</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {playbook.sessions.map((s) => (
                      <span key={s} className="chip chip-purple" style={{ fontSize: 11.5 }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "performance" && (
            <PerformanceTab playbook={playbook} trades={tradesForPlaybook} />
          )}

          {tab === "history" && (
            <>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Recent trades using this playbook</h4>
              {tradesForPlaybook.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--c-fg-muted)", padding: 24, textAlign: "center" }}>No recorded trades yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {tradesForPlaybook.map((t) => {
                    const pnl = Number(t.pnl)
                    const r = Number(t.r)
                    return (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, fontSize: 12 }}>
                        <PairFlag pair={t.pair} size={14} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500 }}>{t.pair} · {t.side.toUpperCase()}</div>
                          <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }} className="mono">
                            {t.opened_at ? (
                              <>
                                {new Date(t.opened_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
                                {new Date(t.opened_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </>
                            ) : "Pending"}
                          </div>
                        </div>
                        <span className="tnum" style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>{t.r != null ? `${r > 0 ? "+" : ""}${r.toFixed(2)}R` : ""}</span>
                        <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: pnl > 0 ? "var(--c-green-bright)" : pnl < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)", width: 80, textAlign: "right" }}>
                          {t.pnl != null ? formatUSD(pnl, { signed: true }) : "—"}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: "auto", padding: 16, borderTop: "1px solid var(--c-border)", display: "flex", gap: 8, position: "sticky", bottom: 0, background: "var(--c-bg-elev-1)" }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => setEditing(true)}>
            <Icon name="edit" size={13} /> <span>Edit</span>
          </button>
          <button className="btn" style={{ flex: 1, color: "var(--c-red-bright)", borderColor: "rgba(224,74,85,0.35)" }} onClick={onDelete}>
            <Icon name="x" size={13} /> <span>Delete</span>
          </button>
        </div>
      </div>

      <PlaybookFormModal open={editing} onClose={() => setEditing(false)} playbook={playbook} />
    </>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", padding: 10, borderRadius: 8, border: "1px solid var(--c-border)" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 600, color: color ?? "var(--c-fg)", fontFamily: "var(--font-display)" }}>{value}</div>
    </div>
  )
}

function PerformanceTab({ playbook, trades }: { playbook: Playbook & { stats: PlaybookStats }; trades: Trade[] }) {
  const byPair = new Map<string, Trade[]>()
  for (const t of trades) {
    const arr = byPair.get(t.pair) ?? []
    arr.push(t)
    byPair.set(t.pair, arr)
  }
  const rows = Array.from(byPair.entries()).map(([pair, ts]) => {
    const closed = ts.filter((t) => t.status === "closed")
    const wins = closed.filter((t) => Number(t.pnl) > 0).length
    const wr = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0
    const pnl = closed.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
    return { pair, count: ts.length, winRate: wr, pnl }
  })

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {([
          ["Avg R", playbook.stats.avgR != null ? `${playbook.stats.avgR > 0 ? "+" : ""}${playbook.stats.avgR}R` : "—"],
          ["Trades", String(playbook.stats.trades)],
          ["Win Rate", playbook.stats.winRate != null ? `${playbook.stats.winRate}%` : "—"],
          ["Expectancy", playbook.stats.expectancy != null ? `${playbook.stats.expectancy > 0 ? "+" : ""}${playbook.stats.expectancy}R` : "—"],
          ["Wins", String(playbook.stats.wins)],
          ["Losses", String(playbook.stats.losses)],
        ] as const).map(([k, v]) => (
          <div key={k} style={{ background: "var(--c-bg-elev-2)", padding: 10, borderRadius: 8, border: "1px solid var(--c-border)" }}>
            <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</div>
            <div className="tnum" style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div>
          <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>Win Rate by Pair</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rows.map((r) => (
              <div key={r.pair} style={{ display: "grid", gridTemplateColumns: "120px 1fr 60px 80px", gap: 10, alignItems: "center", fontSize: 12 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <PairFlag pair={r.pair} size={12} /> {r.pair}
                </span>
                <div style={{ height: 14, background: "var(--c-bg-elev-3)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${r.winRate}%`, height: "100%", background: r.pnl >= 0 ? "rgba(17, 196, 88, 0.6)" : "rgba(190, 51, 61, 0.6)" }} />
                </div>
                <span className="tnum" style={{ fontSize: 11, color: "var(--c-fg-muted)", textAlign: "right" }}>{r.winRate}% · {r.count}t</span>
                <span className="tnum" style={{ fontSize: 12, fontWeight: 600, textAlign: "right", color: r.pnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                  {formatUSD(r.pnl, { signed: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
