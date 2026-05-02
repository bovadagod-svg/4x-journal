"use client"

import { useEffect, useMemo, useState } from "react"
import { Icon, Flag } from "@/components/icons"
import type { EconomicEvent } from "@/lib/queries/watchlist"

type ImpactFilter = "all" | "high" | "medium" | "low"

const IMPACT_META = {
  high:   { color: "#BE333D", n: 3 },
  medium: { color: "#E5A23B", n: 2 },
  low:    { color: "#9A97A1", n: 1 },
} as const

export function CalendarView({
  events,
  watchCurrencies,
}: {
  events: EconomicEvent[]
  watchCurrencies: string[]
}) {
  const [impact, setImpact] = useState<ImpactFilter>("all")
  const [currency, setCurrency] = useState<string>("all")
  const [watchOnly, setWatchOnly] = useState(false)

  // Currency dropdown options = unique currencies present in events.
  const currencyOptions = useMemo(() => {
    const set = new Set<string>(["all"])
    events.forEach((e) => set.add(e.currency))
    return Array.from(set)
  }, [events])

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (impact !== "all" && e.impact !== impact) return false
      if (currency !== "all" && e.currency !== currency) return false
      if (watchOnly && !watchCurrencies.includes(e.currency)) return false
      return true
    })
  }, [events, impact, currency, watchOnly, watchCurrencies])

  // Group by day (UTC)
  const grouped = useMemo(() => {
    const map = new Map<string, EconomicEvent[]>()
    for (const e of filtered) {
      const key = new Date(e.scheduled_at).toDateString()
      const arr = map.get(key) ?? []
      arr.push(e)
      map.set(key, arr)
    }
    return Array.from(map.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
  }, [filtered])

  // KPIs (use full events list, not filtered)
  const kpis = useMemo(() => {
    const now = Date.now()
    const next24End = now + 24 * 3600_000
    const next7End = now + 7 * 24 * 3600_000
    const next24 = events.filter((e) => {
      const t = new Date(e.scheduled_at).getTime()
      return t > now && t <= next24End
    })
    const highWeek = events.filter((e) => {
      const t = new Date(e.scheduled_at).getTime()
      return e.impact === "high" && t > now && t <= next7End
    })
    const nextMajor = events
      .filter((e) => e.impact === "high" && new Date(e.scheduled_at).getTime() > now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null
    const watchedNext24 = next24.filter((e) => watchCurrencies.includes(e.currency)).length
    return { next24: next24.length, highWeek: highWeek.length, nextMajor, watchedNext24 }
  }, [events, watchCurrencies])

  const todayKey = new Date().toDateString()

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <Kpi label="Next 24h" value={String(kpis.next24)} sub="events scheduled" />
        <Kpi label="High Impact" value={String(kpis.highWeek)} sub="this week" color="var(--c-red-bright)" />
        <NextMajorCard ev={kpis.nextMajor} />
        <Kpi label="On your watchlist" value={String(kpis.watchedNext24)} sub="in next 24h" color="var(--c-accent-bright)" />
      </div>

      {/* Filters bar */}
      <div className="card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Impact</span>
        <div className="tab-row" style={{ background: "var(--c-bg-elev-2)", padding: 3, borderRadius: 8 }}>
          {(["all", "high", "medium", "low"] as ImpactFilter[]).map((i) => (
            <button key={i} className={`tab ${impact === i ? "active" : ""}`} onClick={() => setImpact(i)} style={{ padding: "5px 11px", fontSize: 11.5, textTransform: "capitalize" }}>
              {i}
            </button>
          ))}
        </div>

        <span style={{ width: 1, height: 22, background: "var(--c-border)" }} />

        <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Currency</span>
        <div className="tab-row" style={{ background: "var(--c-bg-elev-2)", padding: 3, borderRadius: 8 }}>
          {currencyOptions.map((c) => (
            <button key={c} className={`tab ${currency === c ? "active" : ""}`} onClick={() => setCurrency(c)} style={{ padding: "5px 11px", fontSize: 11.5 }}>
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>

        {watchCurrencies.length > 0 && (
          <>
            <span style={{ width: 1, height: 22, background: "var(--c-border)" }} />
            <button
              onClick={() => setWatchOnly(!watchOnly)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 11px", borderRadius: 6,
                border: `1px solid ${watchOnly ? "var(--c-accent-bright)" : "var(--c-border)"}`,
                background: watchOnly ? "var(--c-accent-soft)" : "transparent",
                color: watchOnly ? "var(--c-accent-bright)" : "var(--c-fg-muted)",
                fontSize: 11.5, cursor: "pointer",
              }}
            >
              <Icon name="check" size={11} /> Watchlist only
            </button>
          </>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--c-fg-muted)" }}>{filtered.length} event{filtered.length === 1 ? "" : "s"}</span>
      </div>

      {/* Table */}
      {grouped.length === 0 ? (
        <div className="card" style={{ padding: "60px 20px", textAlign: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
          No events match these filters.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 760 }}>
              <HeaderRow />
              {grouped.map(([dayKey, evs]) => (
                <div key={dayKey}>
                  <DayDivider dayKey={dayKey} count={evs.length} isToday={dayKey === todayKey} />
                  {evs.map((e) => <EventRow key={e.id} ev={e} watched={watchCurrencies.includes(e.currency)} />)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function HeaderRow() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "70px 28px 24px 1fr 80px 80px 80px 90px",
      gap: 12, padding: "10px 16px",
      borderBottom: "1px solid var(--c-border)",
      background: "var(--c-bg-elev-2)",
      fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500,
    }}>
      <span>Time</span>
      <span>Imp</span>
      <span></span>
      <span>Event</span>
      <span style={{ textAlign: "right" }}>Forecast</span>
      <span style={{ textAlign: "right" }}>Previous</span>
      <span style={{ textAlign: "right" }}>Actual</span>
      <span>Countdown</span>
    </div>
  )
}

function DayDivider({ dayKey, count, isToday }: { dayKey: string; count: number; isToday: boolean }) {
  const d = new Date(dayKey)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000)
  const label = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday"
    : Math.abs(diff) < 7 ? d.toLocaleDateString("en-US", { weekday: "long" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return (
    <div style={{
      padding: "10px 16px",
      background: isToday ? "var(--c-accent-soft)" : "var(--c-bg-elev-2)",
      borderBottom: "1px solid var(--c-border)",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: isToday ? "var(--c-accent-bright)" : "var(--c-fg)" }}>
        {label}
      </span>
      <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>
        {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </span>
      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--c-fg-muted)" }}>{count} event{count === 1 ? "" : "s"}</span>
    </div>
  )
}

function EventRow({ ev, watched }: { ev: EconomicEvent; watched: boolean }) {
  const date = new Date(ev.scheduled_at)
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  const actual = ev.actual && ev.forecast
    ? compareToForecast(ev.actual, ev.forecast)
    : { color: "var(--c-fg-dim)" }
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "70px 28px 24px 1fr 80px 80px 80px 90px",
      gap: 12, alignItems: "center", padding: "12px 16px",
      background: watched ? "var(--c-accent-soft)" : "transparent",
      borderLeft: `2px solid ${watched ? "var(--c-accent-bright)" : "transparent"}`,
      borderBottom: "1px solid var(--c-border)",
      fontSize: 12.5,
    }}>
      <span className="mono" style={{ color: "var(--c-fg-muted)", fontSize: 11.5 }}>{time}</span>
      <ImpactBars impact={ev.impact as keyof typeof IMPACT_META} />
      <Flag code={ev.currency} size={20} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.event}</div>
        <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{ev.currency}</div>
      </div>
      <span className="tnum" style={{ color: "var(--c-fg-muted)", fontSize: 11.5, textAlign: "right" }}>{ev.forecast ?? "—"}</span>
      <span className="tnum" style={{ color: "var(--c-fg-muted)", fontSize: 11.5, textAlign: "right" }}>{ev.previous ?? "—"}</span>
      <span className="tnum" style={{ fontWeight: 600, fontSize: 12.5, textAlign: "right", color: actual.color }}>
        {ev.actual ?? "—"}
      </span>
      <CountdownPill targetTs={date.getTime()} />
    </div>
  )
}

function ImpactBars({ impact }: { impact: keyof typeof IMPACT_META }) {
  const m = IMPACT_META[impact] ?? IMPACT_META.low
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "flex-end", height: 12 }}>
      {[1, 2, 3].map((i) => (
        <span key={i} style={{
          width: 3, height: i === 1 ? 5 : i === 2 ? 8 : 11, borderRadius: 1,
          background: i <= m.n ? m.color : "var(--c-bg-elev-3)",
        }} />
      ))}
    </span>
  )
}

function CountdownPill({ targetTs }: { targetTs: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  const diffMin = Math.round((targetTs - now) / 60_000)
  if (diffMin < 0) return <span className="chip" style={{ fontSize: 10.5, background: "var(--c-bg-elev-3)" }}>past</span>
  if (diffMin < 60) return <span className="chip chip-amber" style={{ fontSize: 10.5 }}>in {diffMin}m</span>
  if (diffMin < 24 * 60) return <span className="chip" style={{ fontSize: 10.5 }}>in {Math.round(diffMin / 60)}h</span>
  return <span className="chip" style={{ fontSize: 10.5, background: "var(--c-bg-elev-3)" }}>in {Math.round(diffMin / 1440)}d</span>
}

function NextMajorCard({ ev }: { ev: EconomicEvent | null }) {
  if (!ev) {
    return <Kpi label="Next Major" value="—" sub="no high-impact upcoming" />
  }
  const t = new Date(ev.scheduled_at)
  return (
    <div className="card" style={{ padding: "14px 16px", background: "linear-gradient(135deg, rgba(229, 162, 59, 0.15), transparent)" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Next Major</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {ev.event}
      </div>
      <div style={{ fontSize: 11, color: "var(--c-amber)", marginTop: 2 }}>
        {ev.currency} · {t.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} {t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--c-fg-dim)", marginTop: 2 }}>{sub}</div>
    </div>
  )
}

// Compare actual vs forecast (numeric prefixes only — handles "0.3%", "190K", etc).
function compareToForecast(actual: string, forecast: string): { color: string } {
  const a = parseFloat(actual)
  const f = parseFloat(forecast)
  if (isNaN(a) || isNaN(f)) return { color: "var(--c-fg)" }
  if (a > f) return { color: "var(--c-green-bright)" }
  if (a < f) return { color: "var(--c-red-bright)" }
  return { color: "var(--c-fg)" }
}
