"use client"

import { useMemo } from "react"
import { formatUSD } from "@/lib/finance"
import type { Trade } from "@/lib/queries/trades"

/**
 * FX session analysis: split closed trades into the 4 major trading sessions
 * (UTC) and surface WR + edge per session. Helps the user see whether their
 * edge concentrates in London opens, NY pivots, the LDN/NY overlap, or even
 * Asian-session ranges.
 *
 * Sessions used here (UTC, standard retail conventions):
 *   - Sydney/Tokyo: 22:00 → 08:00 (wraps midnight)
 *   - London:       07:00 → 16:00
 *   - New York:     13:00 → 22:00
 *   - LDN/NY overlap (high-volume window): 13:00 → 16:00
 *
 * A trade can belong to MULTIPLE sessions (e.g. a London-open scalp at 14:00
 * is in both London and the overlap). We show each session independently;
 * the "total trades" sum across rows will exceed the trade count, which is
 * intentional and called out in the subtitle.
 */
type SessionDef = { id: string; label: string; start: number; end: number; color: string }

const SESSIONS: SessionDef[] = [
  { id: "sydney", label: "Sydney / Tokyo", start: 22, end: 8,  color: "rgba(229, 162, 59, 0.55)" },
  { id: "london", label: "London",         start: 7,  end: 16, color: "rgba(105, 50, 212, 0.55)" },
  { id: "ny",     label: "New York",       start: 13, end: 22, color: "rgba(17, 196, 88, 0.55)" },
  { id: "overlap",label: "LDN/NY overlap", start: 13, end: 16, color: "rgba(190, 51, 61, 0.55)" },
]

function inSession(hourUTC: number, s: SessionDef): boolean {
  if (s.start <= s.end) return hourUTC >= s.start && hourUTC < s.end
  // wraps midnight (Sydney/Tokyo)
  return hourUTC >= s.start || hourUTC < s.end
}

export function SessionAnalysis({ trades }: { trades: Trade[] }) {
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
          return (
            <div
              key={r.id}
              style={{
                display: "grid", gridTemplateColumns: "140px 60px 1fr 80px 80px",
                gap: 8, padding: "8px 0",
                borderBottom: "1px solid var(--c-border)",
                alignItems: "center", fontSize: 12.5,
                background: isBest ? "rgba(17, 196, 88, 0.04)" : "transparent",
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
    const wins = inS.filter((t) => Number(t.pnl) > 0).length
    const totalPnL = inS.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0)
    const totalR = inS.reduce((sum, t) => sum + (Number(t.r) || 0), 0)
    return {
      id: s.id,
      label: s.label,
      color: s.color,
      startHour: s.start,
      endHour: s.end,
      count: inS.length,
      winRate: inS.length > 0 ? (wins / inS.length) * 100 : 0,
      avgR: inS.length > 0 ? totalR / inS.length : 0,
      avgPnL: inS.length > 0 ? totalPnL / inS.length : 0,
      expectancy: inS.length > 0 ? totalPnL / inS.length : 0,
    }
  })

  // Hourly histogram (24 bars)
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const inH = eligible.filter((t) => new Date(t.opened_at!).getUTCHours() === hour)
    const wins = inH.filter((t) => Number(t.pnl) > 0).length
    const pnl = inH.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0)
    return {
      hour,
      count: inH.length,
      pnl,
      winRate: inH.length > 0 ? (wins / inH.length) * 100 : 0,
    }
  })

  return { eligible: eligible.length, rows, hourly }
}
