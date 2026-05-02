"use client"

import { useEffect, useState } from "react"

const SESSIONS = [
  { name: "Sydney",   open: 22, close: 7,  color: "#9A97A1" },
  { name: "Tokyo",    open: 0,  close: 9,  color: "#BE333D" },
  { name: "London",   open: 8,  close: 17, color: "#4312A0" },
  { name: "New York", open: 13, close: 22, color: "#11C458" },
] as const

function isOpen(now: number, open: number, close: number): boolean {
  if (open <= close) return now >= open && now < close
  return now >= open || now < close // wraps midnight (Sydney)
}

export function SessionClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <div className="card" style={{ minHeight: 130 }} />

  const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60
  const sessionsWithStatus = SESSIONS.map((s) => ({ ...s, open_now: isOpen(utcHour, s.open, s.close) }))
  const openSessions = sessionsWithStatus.filter((s) => s.open_now)

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <h3 className="card-title">Sessions</h3>
        <p className="card-subtitle">
          {openSessions.length === 0
            ? "All closed (weekend?)"
            : `${openSessions.map((s) => s.name).join(" + ")} open`}
        </p>
      </div>

      {/* 24-hour bar */}
      <div style={{ position: "relative", height: 28, background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 6, overflow: "hidden" }}>
        {sessionsWithStatus.map((s, i) => {
          const left = (s.open / 24) * 100
          const widthPct = s.open <= s.close
            ? ((s.close - s.open) / 24) * 100
            : ((24 - s.open) / 24) * 100
          const wraps = s.open > s.close
          const wrapWidth = wraps ? (s.close / 24) * 100 : 0
          const top = i * 6.5 + 1
          return (
            <div key={s.name}>
              <div title={`${s.name} ${s.open}:00–${s.close}:00 UTC`} style={{
                position: "absolute", left: `${left}%`, top, width: `${widthPct}%`, height: 4.5,
                background: s.color, borderRadius: 2, opacity: s.open_now ? 1 : 0.35,
              }} />
              {wraps && (
                <div title={`${s.name} (wraps)`} style={{
                  position: "absolute", left: 0, top, width: `${wrapWidth}%`, height: 4.5,
                  background: s.color, borderRadius: 2, opacity: s.open_now ? 1 : 0.35,
                }} />
              )}
            </div>
          )
        })}
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: `${(utcHour / 24) * 100}%`,
          width: 1.5, background: "var(--c-fg)", boxShadow: "0 0 6px var(--c-fg)",
        }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)" }}>
        <span>00 UTC</span><span>06</span><span>12</span><span>18</span><span>24</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {sessionsWithStatus.map((s) => (
          <span key={s.name} className="chip" style={{
            fontSize: 10.5,
            background: s.open_now ? `${s.color}33` : "var(--c-bg-elev-3)",
            color: s.open_now ? "var(--c-fg)" : "var(--c-fg-muted)",
            borderColor: s.open_now ? s.color : "var(--c-border)",
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
