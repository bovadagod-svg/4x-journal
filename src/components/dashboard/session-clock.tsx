"use client"

import { FX_SESSIONS, inWindow, isWeekendClosed, marketStatusAt, utcHour } from "@/lib/sessions"
import { useNow } from "@/lib/use-now"

export function SessionClock() {
  const now = useNow()

  if (!now) return <div className="card" style={{ minHeight: 220 }} />

  const hour = utcHour(now)
  const weekendClosed = isWeekendClosed(now)
  const status = marketStatusAt(now)
  const utcLabel = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h3 className="card-title">Sessions</h3>
          <p className="card-subtitle mono">{utcLabel} UTC</p>
        </div>
        {status.open ? (
          <span className="chip chip-green"><span className="live-dot" /> Live</span>
        ) : (
          <span className="chip">Closed · {status.closedReason}</span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {FX_SESSIONS.map((s) => {
          const open = !weekendClosed && inWindow(hour, s.open, s.close)
          const len = s.open <= s.close ? s.close - s.open : 24 - s.open + s.close
          const startPct = (s.open / 24) * 100
          const wraps = s.open + len > 24
          const endPct = (((s.open + len) % 24) / 24) * 100
          return (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 70 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: open ? "var(--c-fg)" : "var(--c-fg-muted)" }}>{s.name}</div>
                <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }} className="mono">{s.tz}</div>
              </div>
              <div style={{ flex: 1, position: "relative", height: 8, background: "var(--c-bg-elev-3)", borderRadius: 4, overflow: "hidden" }}>
                {wraps ? (
                  <>
                    <div style={{ position: "absolute", left: `${startPct}%`, right: 0, top: 0, bottom: 0, background: s.color, opacity: open ? 1 : 0.35 }} />
                    <div style={{ position: "absolute", left: 0, width: `${endPct}%`, top: 0, bottom: 0, background: s.color, opacity: open ? 1 : 0.35 }} />
                  </>
                ) : (
                  <div style={{ position: "absolute", left: `${startPct}%`, width: `${(len / 24) * 100}%`, top: 0, bottom: 0, background: s.color, opacity: open ? 1 : 0.35 }} />
                )}
                <div style={{ position: "absolute", left: `${(hour / 24) * 100}%`, top: -2, bottom: -2, width: 2, background: "var(--c-fg)" }} />
              </div>
              <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: open ? "var(--c-green-bright)" : "var(--c-fg-dim)", width: 36, textAlign: "right" }}>
                {open ? "OPEN" : "—"}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
