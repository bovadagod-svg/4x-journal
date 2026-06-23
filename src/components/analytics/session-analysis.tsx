"use client"

import { useMemo, useState } from "react"
import { formatUSD } from "@/lib/finance"
import type { Trade } from "@/lib/queries/trades"
import { SESSION, inWindow } from "@/lib/sessions"
import { isWin, isLoss } from "@/lib/outcome"

/**
 * FX session analysis: split closed trades into the major trading sessions
 * (UTC) and surface WR + edge per session. Helps the user see whether their
 * edge concentrates in London opens, NY pivots, the LDN/NY overlap, or even
 * Asian-session ranges.
 *
 * Session windows are derived from the shared model in `@/lib/sessions` so this
 * view, the dashboard clock, and the topbar pill all agree on the hours:
 *   - Sydney/Tokyo: 22:00 → 09:00 (Asian block, wraps midnight)
 *   - London:       08:00 → 17:00
 *   - New York:     13:00 → 22:00
 *   - LDN/NY overlap (high-volume window): 13:00 → 17:00
 *
 * A trade can belong to MULTIPLE sessions (e.g. a London-open scalp at 14:00
 * is in both London and the overlap). We show each session independently;
 * the "total trades" sum across rows will exceed the trade count, which is
 * intentional and called out in the subtitle.
 */
type SessionDef = { id: string; label: string; start: number; end: number; color: string }

const SESSIONS: SessionDef[] = [
  // Asian block = Sydney (22→07) ∪ Tokyo (00→09), which are contiguous → 22→09.
  { id: "sydney", label: "Sydney / Tokyo", start: SESSION.sydney.open,  end: SESSION.tokyo.close,  color: "rgba(229, 162, 59, 0.55)" },
  { id: "london", label: "London",         start: SESSION.london.open,  end: SESSION.london.close, color: "rgba(105, 50, 212, 0.55)" },
  { id: "ny",     label: "New York",       start: SESSION.newyork.open, end: SESSION.newyork.close, color: "rgba(17, 196, 88, 0.55)" },
  // LDN/NY overlap = London ∩ New York = 13→17.
  { id: "overlap",label: "LDN/NY overlap", start: SESSION.newyork.open, end: SESSION.london.close, color: "rgba(190, 51, 61, 0.55)" },
]

function inSession(hourUTC: number, s: SessionDef): boolean {
  return inWindow(hourUTC, s.start, s.end)
}

export function SessionAnalysis({ trades }: { trades: Trade[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const stats = useMemo(() => compute(trades), [trades])
  if (stats.eligible === 0) return null
  const best = [...stats.rows].filter((r) => r.count >= 3).sort((a, b) => b.expectancy - a.expectancy)[0]

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Session Edge</h3>
        <p className="card-subtitle">
          {stats.eligible} closed trades by FX session (UTC). Trades inside the LDN/NY overlap appear in two rows.
        </p>
      </div>

      {/* Hourly mini-bars */}
      <HourlyBars hourly={stats.hourly} />

      {/* Session rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "140px 60px 1fr 80px 80px",
          gap: 8, padding: "6px 0",
          fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
          borderBottom: "1px solid var(--c-border)",
        }}>
          <span>Session</span>
          <span style={{ textAlign: "right" }}>n</span>
          <span>Win rate</span>
          <span style={{ textAlign: "right" }}>Avg R</span>
          <span style={{ textAlign: "right" }}>Avg P&L</span>
        </div>
        {stats.rows.map((r) => {
          const isBest = best && r.id === best.id
          const isExpanded = expanded === r.id
          const sessionHours = sessionHoursFor(r.id, stats.hourly)
          return (
            <div key={r.id}>
              <div
                onClick={() => r.count >= 3 && setExpanded(isExpanded ? null : r.id)}
                style={{
                  display: "grid", gridTemplateColumns: "140px 60px 1fr 80px 80px 18px",
                  gap: 8, padding: "8px 0",
                  borderBottom: "1px solid var(--c-border)",
                  alignItems: "center", fontSize: 12.5,
                  background: isBest ? "rgba(17, 196, 88, 0.04)" : "transparent",
                  cursor: r.count >= 3 ? "pointer" : "default",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color }} />
                  <span style={{ fontWeight: 500 }}>{r.label}</span>
                  <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)" }}>
                    {String(r.startHour).padStart(2, "0")}–{String(r.endHour).padStart(2, "0")}
                  </span>
                </span>
                <span className="tnum" style={{ textAlign: "right", color: "var(--c-fg-muted)" }}>{r.count}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ position: "relative", flex: 1, height: 8, background: "var(--c-bg-elev-3)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      position: "absolute", inset: 0, width: `${r.winRate}%`,
                      background: r.winRate >= 50 ? "rgba(17, 196, 88, 0.6)" : "rgba(190, 51, 61, 0.6)",
                    }} />
                  </div>
                  <span className="tnum" style={{ fontSize: 11.5, fontWeight: 600, minWidth: 36, textAlign: "right" }}>
                    {r.count === 0 ? "—" : `${Math.round(r.winRate)}%`}
                  </span>
                </div>
                <span className="tnum" style={{
                  textAlign: "right",
                  color: r.avgR > 0 ? "var(--c-green-bright)" : r.avgR < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
                }}>
                  {r.count === 0 ? "—" : `${r.avgR > 0 ? "+" : ""}${r.avgR.toFixed(2)}R`}
                </span>
                <span className="tnum" style={{
                  textAlign: "right", fontWeight: 600,
                  color: r.avgPnL > 0 ? "var(--c-green-bright)" : r.avgPnL < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
                }}>
                  {r.count === 0 ? "—" : formatUSD(r.avgPnL, { signed: true })}
                </span>
                <span style={{ textAlign: "center", color: "var(--c-fg-dim)", fontSize: 10 }}>
                  {r.count >= 3 ? (isExpanded ? "▾" : "▸") : ""}
                </span>
              </div>
              {isExpanded && sessionHours.length > 0 && (
                <IntraSessionDetail hours={sessionHours} />
              )}
            </div>
          )
        })}
      </div>

      {best && (
        <div style={{ marginTop: 12, padding: 10, background: "var(--c-bg-elev-2)", borderRadius: 8, fontSize: 12, color: "var(--c-fg-muted)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: best.color }} />
          <span>
            Strongest edge in <strong style={{ color: "var(--c-fg)" }}>{best.label}</strong> session — {Math.round(best.winRate)}% WR, {best.avgR > 0 ? "+" : ""}{best.avgR.toFixed(2)}R avg, {formatUSD(best.expectancy, { signed: true })} expectancy across {best.count} trades.
          </span>
        </div>
      )}
    </div>
  )
}

function IntraSessionDetail({ hours }: { hours: { hour: number; count: number; pnl: number; winRate: number }[] }) {
  const populated = hours.filter((h) => h.count > 0).sort((a, b) => b.pnl - a.pnl)
  if (populated.length === 0) return null
  const best = populated[0]
  const worst = populated[populated.length - 1]
  const sortedByHour = [...hours].sort((a, b) => a.hour - b.hour)
  const maxAbs = Math.max(...sortedByHour.map((h) => Math.abs(h.pnl)), 1)

  return (
    <div style={{
      padding: "12px 16px 14px",
      background: "var(--c-bg-elev-2)",
      borderBottom: "1px solid var(--c-border)",
    }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
        Hour-by-hour P&amp;L within session
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60 }}>
        {sortedByHour.map((h) => {
          const pct = (Math.abs(h.pnl) / maxAbs) * 100
          return (
            <div
              key={h.hour}
              title={h.count > 0
                ? `${String(h.hour).padStart(2, "0")}:00 UTC · ${h.count} trade${h.count === 1 ? "" : "s"} · ${Math.round(h.winRate)}% WR · ${formatUSD(h.pnl, { signed: true })}`
                : `${String(h.hour).padStart(2, "0")}:00 UTC · 0 trades`}
              style={{
                flex: 1,
                display: "flex", flexDirection: "column", justifyContent: "flex-end",
                height: "100%",
              }}
            >
              <div style={{
                width: "100%",
                height: `${pct}%`,
                minHeight: h.count > 0 ? 2 : 0,
                background: h.count === 0 ? "var(--c-bg-elev-3)"
                  : h.pnl >= 0 ? "rgba(17, 196, 88, 0.7)" : "rgba(190, 51, 61, 0.7)",
                borderRadius: "2px 2px 0 0",
              }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: "flex", marginTop: 4, gap: 3 }}>
        {sortedByHour.map((h) => (
          <span key={h.hour} style={{ flex: 1, fontSize: 9, textAlign: "center", color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)" }}>
            {String(h.hour).padStart(2, "0")}
          </span>
        ))}
      </div>
      {populated.length >= 2 && best.hour !== worst.hour && best.pnl > 0 && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
          Best hour: <strong style={{ color: "var(--c-green-bright)" }}>{String(best.hour).padStart(2, "0")}:00</strong> ({formatUSD(best.pnl, { signed: true })} across {best.count} trade{best.count === 1 ? "" : "s"}){worst.pnl < 0 && (
            <> · Worst hour: <strong style={{ color: "var(--c-red-bright)" }}>{String(worst.hour).padStart(2, "0")}:00</strong> ({formatUSD(worst.pnl, { signed: true })} across {worst.count})</>
          )}
        </div>
      )}
    </div>
  )
}

function sessionHoursFor(sessionId: string, hourly: { hour: number; count: number; pnl: number; winRate: number }[]) {
  const session = SESSIONS.find((s) => s.id === sessionId)
  if (!session) return []
  return hourly.filter((h) => inSession(h.hour, session))
}

function HourlyBars({ hourly }: { hourly: { hour: number; count: number; pnl: number; winRate: number }[] }) {
  const maxCount = Math.max(...hourly.map((h) => h.count), 1)
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        Trades per hour (UTC)
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
        {hourly.map((h) => {
          const pct = (h.count / maxCount) * 100
          return (
            <div
              key={h.hour}
              title={h.count > 0 ? `${h.hour}:00 UTC · ${h.count} trades · ${Math.round(h.winRate)}% WR · ${h.pnl >= 0 ? "+" : ""}$${h.pnl.toFixed(0)}` : `${h.hour}:00 UTC · 0 trades`}
              style={{
                flex: 1, height: `${pct}%`, minHeight: h.count > 0 ? 2 : 0,
                background: h.count === 0
                  ? "var(--c-bg-elev-3)"
                  : h.winRate >= 50
                    ? "rgba(17, 196, 88, 0.55)"
                    : "rgba(190, 51, 61, 0.55)",
                borderRadius: "2px 2px 0 0",
              }}
            />
          )
        })}
      </div>
      <div style={{ display: "flex", marginTop: 4, gap: 2 }}>
        {hourly.map((h) => (
          <span key={h.hour} style={{ flex: 1, fontSize: 9, textAlign: "center", color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)" }}>
            {h.hour % 6 === 0 ? h.hour : ""}
          </span>
        ))}
      </div>
    </div>
  )
}

function compute(trades: Trade[]) {
  const eligible = trades.filter((t) => t.status === "closed" && t.opened_at)

  const rows = SESSIONS.map((s) => {
    const inS = eligible.filter((t) => inSession(new Date(t.opened_at!).getUTCHours(), s))
    const wins = inS.filter((t) => isWin(Number(t.pnl))).length
    const losses = inS.filter((t) => isLoss(Number(t.pnl))).length
    const totalPnL = inS.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0)
    const totalR = inS.reduce((sum, t) => sum + (Number(t.r) || 0), 0)
    return {
      id: s.id,
      label: s.label,
      color: s.color,
      startHour: s.start,
      endHour: s.end,
      count: inS.length,
      winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
      avgR: inS.length > 0 ? totalR / inS.length : 0,
      avgPnL: inS.length > 0 ? totalPnL / inS.length : 0,
      expectancy: inS.length > 0 ? totalPnL / inS.length : 0,
    }
  })

  // Hourly histogram (24 bars)
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const inH = eligible.filter((t) => new Date(t.opened_at!).getUTCHours() === hour)
    const wins = inH.filter((t) => isWin(Number(t.pnl))).length
    const losses = inH.filter((t) => isLoss(Number(t.pnl))).length
    const pnl = inH.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0)
    return {
      hour,
      count: inH.length,
      pnl,
      winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
    }
  })

  return { eligible: eligible.length, rows, hourly }
}
