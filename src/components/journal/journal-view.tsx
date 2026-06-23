"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Icon, PairFlag } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import { useJournalDrawer } from "./journal-drawer-context"
import { useDateFmt } from "@/lib/timezone-context"
import type { JournalEntry, Trade } from "@/lib/queries/trades"
import { isWin, isLoss } from "@/lib/outcome"

type EntryKind = "trade" | "idea" | "session_plan" | "cold_review" | "session_recap"

type KindMeta = {
  label: string
  color: string
  soft: string
  border: string
  icon: "lightning" | "trade" | "book" | "edit"
}

const KIND_META: Record<"idea" | "trade" | "session", KindMeta> = {
  idea:    { label: "Idea",    color: "#E5A23B", soft: "rgba(229, 162, 59, 0.14)", border: "rgba(229, 162, 59, 0.4)", icon: "lightning" },
  trade:   { label: "Trade",   color: "#6932D4", soft: "rgba(105, 50, 212, 0.14)", border: "rgba(105, 50, 212, 0.4)", icon: "trade" },
  session: { label: "Session", color: "#11C458", soft: "rgba(17, 196, 88, 0.14)",  border: "rgba(17, 196, 88, 0.4)",  icon: "book" },
}

function bucket(k: EntryKind): "idea" | "trade" | "session" {
  if (k === "trade") return "trade"
  if (k === "idea") return "idea"
  return "session" // session_plan + cold_review + session_recap → session bucket
}

function fmtDateLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  const today = new Date(); today.setHours(12, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return d.toLocaleDateString("en-US", { weekday: "long" })
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function JournalView({
  entries,
  trades,
  playbookMap,
}: {
  entries: JournalEntry[]
  trades: Trade[]
  playbookMap: Map<string, string>
}) {
  const tradeMap = useMemo(() => new Map(trades.map((t) => [t.id, t])), [trades])

  // Group entries by ISO date (UTC).
  const byDate = useMemo(() => {
    const map = new Map<string, JournalEntry[]>()
    for (const e of entries) {
      const iso = e.created_at.slice(0, 10)
      let arr = map.get(iso)
      if (!arr) { arr = []; map.set(iso, arr) }
      arr.push(e)
    }
    return map
  }, [entries])

  const dates = useMemo(() => {
    return Array.from(byDate.keys())
      .sort((a, b) => b.localeCompare(a))
      .map((iso) => {
        const list = byDate.get(iso) ?? []
        const kinds = Array.from(new Set(list.map((e) => bucket(e.kind as EntryKind))))
        return { iso, count: list.length, kinds }
      })
  }, [byDate])

  const [selectedDate, setSelectedDate] = useState<string | null>(dates[0]?.iso ?? null)
  const [filterKind, setFilterKind] = useState<"all" | "idea" | "trade" | "session">("all")
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(byDate.get(dates[0]?.iso ?? "")?.slice(0, 1).map((e) => e.id) ?? []))

  const dayEntries = useMemo(() => {
    if (!selectedDate) return []
    let list = byDate.get(selectedDate) ?? []
    if (filterKind !== "all") list = list.filter((e) => bucket(e.kind as EntryKind) === filterKind)
    return list.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [selectedDate, byDate, filterKind])

  const kindCounts = useMemo(() => {
    if (!selectedDate) return { all: 0, idea: 0, trade: 0, session: 0 }
    const list = byDate.get(selectedDate) ?? []
    return {
      all: list.length,
      idea: list.filter((e) => bucket(e.kind as EntryKind) === "idea").length,
      trade: list.filter((e) => bucket(e.kind as EntryKind) === "trade").length,
      session: list.filter((e) => bucket(e.kind as EntryKind) === "session").length,
    }
  }, [selectedDate, byDate])

  const toggleExp = (id: string) => {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id); else next.add(id)
    setExpanded(next)
  }

  return (
    <>
      <JournalStatsStrip entries={entries} />

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <DateRail dates={dates} selected={selectedDate} onSelect={setSelectedDate} />

        <div style={{ flex: 1, minWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Kind filter pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {([
              { id: "all" as const, label: "All", color: null },
              { id: "trade" as const, label: "Trades", color: KIND_META.trade.color },
              { id: "idea" as const, label: "Ideas", color: KIND_META.idea.color },
              { id: "session" as const, label: "Session", color: KIND_META.session.color },
            ]).map((f) => {
              const isActive = filterKind === f.id
              return (
                <button
                  key={f.id}
                  onClick={() => setFilterKind(f.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 11.5,
                    fontWeight: 500,
                    background: isActive ? (f.color ? `${f.color}22` : "var(--c-bg-elev-3)") : "var(--c-bg-elev-2)",
                    border: `1px solid ${isActive ? (f.color ? `${f.color}55` : "var(--c-border-strong)") : "var(--c-border)"}`,
                    color: isActive && f.color ? f.color : "var(--c-fg)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {f.color && <span style={{ width: 6, height: 6, borderRadius: "50%", background: f.color }} />}
                  {f.label}
                  <span style={{ fontSize: 10.5, color: "var(--c-fg-muted)", fontFamily: "var(--font-mono)" }}>
                    {kindCounts[f.id]}
                  </span>
                </button>
              )
            })}
            <div style={{ flex: 1 }} />
            <button className="btn" style={{ fontSize: 11.5, padding: "5px 10px" }} onClick={() => setExpanded(new Set())}>
              <Icon name="chevronUp" size={11} /> <span>Collapse all</span>
            </button>
            <button className="btn" style={{ fontSize: 11.5, padding: "5px 10px" }} onClick={() => setExpanded(new Set(dayEntries.map((e) => e.id)))}>
              <Icon name="chevronDown" size={11} /> <span>Expand all</span>
            </button>
          </div>

          {selectedDate && <DayHeader iso={selectedDate} entries={dayEntries} tradeMap={tradeMap} />}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dayEntries.length === 0 && (
              <div style={{
                padding: "60px 20px",
                textAlign: "center",
                color: "var(--c-fg-muted)",
                fontSize: 13,
                background: "var(--c-bg-elev-1)",
                border: "1px dashed var(--c-border-strong)",
                borderRadius: 12,
              }}>
                <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>—</div>
                No journal entries for this day{filterKind !== "all" ? ` matching "${filterKind}"` : ""}.
              </div>
            )}
            {dayEntries.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                expanded={expanded.has(e.id)}
                onToggle={() => toggleExp(e.id)}
                trade={e.trade_id ? tradeMap.get(e.trade_id) : undefined}
                playbookMap={playbookMap}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Stats strip ───────────────────────────────────────────────────────────
function JournalStatsStrip({ entries }: { entries: JournalEntry[] }) {
  const total = entries.length
  const tradeEntries = entries.filter((e) => bucket(e.kind as EntryKind) === "trade").length
  const ideaEntries = entries.filter((e) => bucket(e.kind as EntryKind) === "idea").length
  const coldReviews = entries.filter((e) => (e.cold_review ?? "").trim().length > 0).length
  const phaseCount =
    entries.reduce((s, e) => {
      let n = 0
      if (e.pre_trade?.trim()) n += 1
      if (Array.isArray(e.during_trade) && (e.during_trade as unknown[]).length > 0) n += 1
      if (e.post_trade?.trim()) n += 1
      if (e.cold_review?.trim()) n += 1
      return s + n
    }, 0) / Math.max(1, total)

  const items = [
    { l: "Total entries", v: String(total), s: "all time", c: "var(--c-fg)" },
    { l: "Trade entries", v: String(tradeEntries), s: "linked to ledger", c: KIND_META.trade.color },
    { l: "Open ideas", v: String(ideaEntries), s: "watching", c: KIND_META.idea.color },
    { l: "Cold reviews", v: String(coldReviews), s: "completed reflections", c: "var(--c-fg)" },
    { l: "Avg phases / entry", v: phaseCount.toFixed(1), s: "depth of capture", c: "var(--c-fg)" },
  ]

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
      {items.map((s) => (
        <div key={s.l} className="card" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.l}</div>
          <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: s.c, marginTop: 2 }}>{s.v}</div>
          <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 1 }}>{s.s}</div>
        </div>
      ))}
    </div>
  )
}

// ── Date rail ─────────────────────────────────────────────────────────────
function DateRail({ dates, selected, onSelect }: { dates: { iso: string; count: number; kinds: ("idea" | "trade" | "session")[] }[]; selected: string | null; onSelect: (iso: string) => void }) {
  return (
    <div style={{ width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, padding: "2px 12px 6px" }}>
        Timeline
      </div>
      <div style={{ position: "relative", flex: 1, overflowY: "auto", paddingLeft: 14, maxHeight: "calc(100vh - 280px)" }}>
        <div style={{ position: "absolute", left: 19, top: 6, bottom: 6, width: 1, background: "var(--c-border)" }} />
        {dates.map((d) => {
          const isActive = d.iso === selected
          const m = new Date(`${d.iso}T12:00:00`)
          return (
            <button
              key={d.iso}
              onClick={() => onSelect(d.iso)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: isActive ? "var(--c-bg-elev-2)" : "transparent",
                border: "none",
                padding: "8px 10px 8px 0",
                borderRadius: 8,
                cursor: "pointer",
                width: "100%",
                textAlign: "left",
                color: "var(--c-fg)",
                marginLeft: -14,
                paddingLeft: 0,
              }}
            >
              <span
                style={{
                  width: 11, height: 11, borderRadius: "50%",
                  background: isActive ? "var(--c-accent-bright)" : d.count > 0 ? "var(--c-fg-muted)" : "var(--c-bg-elev-3)",
                  border: `2.5px solid ${isActive ? "var(--c-accent-soft)" : "var(--c-bg)"}`,
                  marginLeft: 14,
                  flexShrink: 0,
                  boxShadow: isActive ? "0 0 0 2px var(--c-accent-bright)" : "none",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: isActive ? 600 : 500, color: isActive ? "var(--c-fg)" : "var(--c-fg-muted)" }}>
                  {fmtDateLabel(d.iso)}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }} className="mono">
                  {m.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {d.count} {d.count === 1 ? "entry" : "entries"}
                </div>
              </div>
              {d.kinds.map((k) => (
                <span key={k} title={KIND_META[k].label} style={{ width: 6, height: 6, borderRadius: "50%", background: KIND_META[k].color }} />
              ))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Day header ────────────────────────────────────────────────────────────
function DayHeader({ iso, entries, tradeMap }: { iso: string; entries: JournalEntry[]; tradeMap: Map<string, Trade> }) {
  const d = new Date(`${iso}T12:00:00`)
  const fullLabel = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
  const tradeEntries = entries.filter((e) => bucket(e.kind as EntryKind) === "trade")
  const tradesForDay = tradeEntries.map((e) => (e.trade_id ? tradeMap.get(e.trade_id) : null)).filter(Boolean) as Trade[]
  const wins = tradesForDay.filter((t) => t.status === "closed" && isWin(Number(t.pnl))).length
  const losses = tradesForDay.filter((t) => t.status === "closed" && isLoss(Number(t.pnl))).length
  const pnl = tradesForDay.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  const ideas = entries.filter((e) => bucket(e.kind as EntryKind) === "idea").length

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "4px 0 14px", marginBottom: 4, borderBottom: "1px solid var(--c-border)",
      flexWrap: "wrap", gap: 12,
    }}>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
          {fmtDateLabel(iso)}
        </div>
        <div style={{ fontSize: 12, color: "var(--c-fg-muted)", marginTop: 2 }}>
          {fullLabel} · {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {tradesForDay.length > 0 && (
          <>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Net</div>
              <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: pnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                {formatUSD(pnl, { signed: true })}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Record</div>
              <div className="tnum" style={{ fontSize: 13, fontWeight: 500 }}>{wins}W · {losses}L</div>
            </div>
          </>
        )}
        {ideas > 0 && (
          <span className="chip" style={{
            fontSize: 10.5, padding: "3px 9px",
            background: KIND_META.idea.soft, color: KIND_META.idea.color,
            border: `1px solid ${KIND_META.idea.border}`,
          }}>
            <Icon name="lightning" size={10} /> {ideas} idea{ideas > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Entry card ────────────────────────────────────────────────────────────
function EntryCard({
  entry,
  expanded,
  onToggle,
  trade,
  playbookMap,
}: {
  entry: JournalEntry
  expanded: boolean
  onToggle: () => void
  trade: Trade | undefined
  playbookMap: Map<string, string>
}) {
  const { open } = useJournalDrawer()
  const fmt = useDateFmt()
  const k = bucket(entry.kind as EntryKind)
  const meta = KIND_META[k]
  const time = fmt.custom(entry.created_at, { hour: "numeric", minute: "2-digit", hour12: true })
  const playbook = entry.playbook_id ? (playbookMap.get(entry.playbook_id) ?? null) : null

  const phaseCount = [
    entry.pre_trade?.trim(),
    Array.isArray(entry.during_trade) && (entry.during_trade as unknown[]).length > 0 ? "x" : "",
    entry.post_trade?.trim(),
    entry.cold_review?.trim(),
  ].filter(Boolean).length

  const screenshotCount = Array.isArray(entry.screenshots) ? (entry.screenshots as unknown[]).length : 0

  const pnl = trade?.pnl != null ? Number(trade.pnl) : null
  const r = trade?.r != null ? Number(trade.r) : null

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", borderColor: expanded ? meta.border : "var(--c-border)" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          background: expanded ? meta.soft : "transparent",
          border: "none",
          borderBottom: expanded ? "1px solid var(--c-border)" : "none",
          cursor: "pointer",
          textAlign: "left",
          color: "var(--c-fg)",
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 9, background: meta.soft, border: `1px solid ${meta.border}`, display: "grid", placeItems: "center", flexShrink: 0 }}>
          <Icon name={meta.icon} size={15} color={meta.color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: 600 }}>{entry.title || "Untitled"}</span>
            <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 4, background: meta.soft, color: meta.color, border: `1px solid ${meta.border}`, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em" }}>
              {meta.label}
            </span>
            {playbook && <span style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>· {playbook}</span>}
          </div>
          <div style={{ fontSize: 11, color: "var(--c-fg-dim)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="mono">{time}</span>
            <span>·</span>
            <span>{phaseCount} phase{phaseCount === 1 ? "" : "s"} captured</span>
            {entry.mood && (<><span>·</span><span style={{ textTransform: "capitalize" }}>{entry.mood}</span></>)}
            {screenshotCount > 0 && (<><span>·</span><span>{screenshotCount} screenshot{screenshotCount === 1 ? "" : "s"}</span></>)}
          </div>
        </div>
        {pnl != null && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
            <span className="tnum" style={{ fontSize: 14, fontWeight: 600, color: pnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)", fontFamily: "var(--font-display)" }}>
              {formatUSD(pnl, { signed: true })}
            </span>
            {r != null && (
              <span className="tnum" style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>
                {r > 0 ? "+" : ""}{r.toFixed(2)}R
              </span>
            )}
          </div>
        )}
        <span
          role="button"
          aria-label="Open in editor"
          onClick={(e) => { e.stopPropagation(); open(entry.id) }}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26, borderRadius: 6,
            color: "var(--c-fg-muted)", cursor: "pointer",
          }}
          title="Open in editor"
        >
          <Icon name="external" size={12} />
        </span>
        <Icon name="chevronDown" size={14} color="var(--c-fg-muted)" style={{ transition: "transform 0.15s", transform: expanded ? "rotate(180deg)" : "rotate(0)" }} />
      </button>

      {expanded && (
        <div style={{ padding: 18 }}>
          {/* Linked trade */}
          {trade ? (
            <LinkedTradeCard trade={trade} playbookMap={playbookMap} />
          ) : (
            <NoLinkCard kind={entry.kind as EntryKind} />
          )}

          {/* Pre-trade */}
          {entry.pre_trade && (
            <PhaseBlock icon="target" label={k === "session" ? "Session plan" : k === "idea" ? "Idea / setup thesis" : "Pre-trade thesis"} color="#11C458">
              <ReadOnlyText body={entry.pre_trade} />
            </PhaseBlock>
          )}

          {/* During trade */}
          {Array.isArray(entry.during_trade) && (entry.during_trade as unknown[]).length > 0 && (
            <PhaseBlock icon="play" label="During trade" color="#E5A23B" count={`${(entry.during_trade as unknown[]).length} notes`}>
              <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {(entry.during_trade as Array<{ ts?: string; text?: string }>).map((n, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
                    <span className="mono" style={{ color: "var(--c-amber)", fontSize: 10.5, paddingTop: 2, fontWeight: 600, flexShrink: 0, width: 70 }}>
                      {n.ts ? fmt.time(n.ts) : ""}
                    </span>
                    <span style={{ flex: 1, lineHeight: 1.5 }}>{n.text}</span>
                  </div>
                ))}
              </div>
            </PhaseBlock>
          )}

          {/* Post-trade */}
          {entry.post_trade && (
            <PhaseBlock icon="check" label="Post-trade review" color="#6932D4">
              <ReadOnlyText body={entry.post_trade} />
            </PhaseBlock>
          )}

          {/* Lessons */}
          {entry.lessons && (
            <PhaseBlock icon="sparkle" label="Lessons" color="#B79CFF">
              <ReadOnlyText body={entry.lessons} />
            </PhaseBlock>
          )}

          {/* Cold review */}
          {entry.cold_review && (
            <PhaseBlock icon="book" label="Cold review · 24–48hr" color="#9A97A1">
              <ReadOnlyText body={entry.cold_review} />
            </PhaseBlock>
          )}

          {/* Mistakes / rule break */}
          {(entry.mistakes?.length > 0 || entry.rule_break) && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              {entry.rule_break && (
                <div style={{
                  flex: 1, minWidth: 200,
                  padding: 10,
                  background: "var(--c-red-soft)",
                  border: "1px solid rgba(190, 51, 61, 0.3)",
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 10.5, color: "var(--c-red-bright)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 4 }}>
                    Rule break
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(entry.rule_break_tags ?? []).map((t) => (
                      <span key={t} className="chip chip-red" style={{ fontSize: 10.5 }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {entry.mistakes && entry.mistakes.length > 0 && (
                <div style={{
                  flex: 1, minWidth: 200,
                  padding: 10,
                  background: "var(--c-bg-elev-2)",
                  border: "1px solid var(--c-border)",
                  borderRadius: 8,
                }}>
                  <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 4 }}>
                    Mistakes
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {entry.mistakes.map((m) => (
                      <span key={m} className="chip" style={{ fontSize: 10.5 }}>{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {entry.tags && entry.tags.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, paddingTop: 10, borderTop: "1px solid var(--c-border)", marginTop: 12 }}>
              <span style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginRight: 4 }}>
                Tags
              </span>
              {entry.tags.map((t) => (
                <span key={t} style={{ fontSize: 10.5, padding: "3px 9px", borderRadius: 999, background: "var(--c-bg-elev-3)", color: "var(--c-fg-muted)", border: "1px solid var(--c-border)" }}>
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--c-border)",
            fontSize: 10.5, color: "var(--c-fg-dim)",
          }}>
            <span>
              edited {fmt.custom(entry.last_edited_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => open(entry.id)} className="btn" style={{ fontSize: 11, padding: "5px 10px" }}>
                <Icon name="edit" size={11} /> <span>Edit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Linked-trade / no-link cards ──────────────────────────────────────────
function LinkedTradeCard({ trade, playbookMap }: { trade: Trade; playbookMap: Map<string, string> }) {
  const setup = trade.playbook_id ? (playbookMap.get(trade.playbook_id) ?? null) : null
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <PairFlag pair={trade.pair} size={20} />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {trade.pair}
          <span className={`chip ${trade.side === "long" ? "chip-green" : "chip-red"}`} style={{ fontSize: 9.5, padding: "1px 6px" }}>
            {trade.side.toUpperCase()}
          </span>
          {setup && <span style={{ fontSize: 11, color: "var(--c-fg-muted)", fontWeight: 400 }}>· {setup}</span>}
          <span title="Linked to Ledger" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--c-purple-soft)", color: "#B79CFF", border: "1px solid rgba(105, 50, 212, 0.3)" }}>
            <Icon name="check" size={9} strokeWidth={2.5} /> LINKED
          </span>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }} className="mono">
          {trade.opened_at ? (
            <>
              {new Date(trade.opened_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
              {new Date(trade.opened_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {Number(trade.size).toLocaleString()} units
            </>
          ) : (
            <>Pending · {Number(trade.size).toLocaleString()} units</>
          )}
        </div>
      </div>
      {trade.pnl != null && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.2 }}>
          <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: Number(trade.pnl) >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
            {formatUSD(Number(trade.pnl), { signed: true })}
          </span>
          {trade.r != null && (
            <span className="tnum" style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>
              {Number(trade.r) > 0 ? "+" : ""}{Number(trade.r).toFixed(2)}R
            </span>
          )}
        </div>
      )}
      <Link href="/ledger" className="btn" style={{ fontSize: 11, padding: "5px 9px" }}>
        <Icon name="external" size={11} /> <span>Ledger</span>
      </Link>
    </div>
  )
}

function NoLinkCard({ kind }: { kind: EntryKind }) {
  const copy = (() => {
    if (kind === "idea") return { title: "Watching setup — no trade yet", sub: "Promote to a live trade when you take it" }
    if (kind === "session_plan") return { title: "Today's session plan", sub: "Bias, levels, no-trade zones — reconcile at end of day" }
    return { title: "No trade linked", sub: "Link an existing trade from the Ledger" }
  })()
  const iconColor = kind === "session_plan" ? "var(--c-cyan-bright)" : "var(--c-fg-muted)"
  const icon = kind === "session_plan" ? "book" : "trade"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, background: "var(--c-bg-elev-2)", border: "1px dashed var(--c-border-strong)", borderRadius: 8, marginBottom: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--c-bg-elev-3)", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={14} color={iconColor} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{copy.title}</div>
        <div style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>{copy.sub}</div>
      </div>
    </div>
  )
}

// ── Phase block ───────────────────────────────────────────────────────────
function PhaseBlock({ icon, label, color, count, children }: { icon: "target" | "play" | "check" | "book" | "sparkle"; label: string; color: string; count?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: `${color}20`,
          border: `1px solid ${color}44`,
          display: "grid", placeItems: "center",
        }}>
          <Icon name={icon} size={13} color={color} />
        </div>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600 }}>{label}</span>
        {count && <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)" }}>{count}</span>}
      </div>
      {children}
    </div>
  )
}

function ReadOnlyText({ body }: { body: string }) {
  return (
    <div style={{
      width: "100%",
      background: "var(--c-bg-elev-2)",
      border: "1px solid var(--c-border)",
      borderRadius: 8,
      padding: "10px 12px",
      fontSize: 13,
      color: "var(--c-fg)",
      lineHeight: 1.55,
      whiteSpace: "pre-wrap",
    }}>
      {body}
    </div>
  )
}
