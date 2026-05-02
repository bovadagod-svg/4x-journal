"use client"

import { useState } from "react"
import Link from "next/link"
import { Flag, Icon } from "@/components/icons"
import type { EconomicEvent } from "@/lib/queries/watchlist"

const FILTERS = ["all", "high", "medium"] as const
type Filter = typeof FILTERS[number]

export function CalendarCard({ events }: { events: EconomicEvent[] }) {
  const [filter, setFilter] = useState<Filter>("all")
  const filtered = filter === "all" ? events : events.filter((e) => e.impact === filter)
  const upcoming = filtered.slice(0, 6)

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--c-border)", gap: 10 }}>
        <div>
          <h3 className="card-title">Economic Calendar</h3>
          <p className="card-subtitle">Filtered by your watchlist</p>
        </div>
        <div className="tab-row" style={{ background: "var(--c-bg-elev-2)", padding: 3, borderRadius: 7 }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              className={"tab " + (filter === f ? "active" : "")}
              onClick={() => setFilter(f)}
              style={{ padding: "4px 9px", fontSize: 11, textTransform: "capitalize" }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      {upcoming.length === 0 ? (
        <div style={{ padding: "24px 18px", textAlign: "center", color: "var(--c-fg-muted)", fontSize: 12.5 }}>
          {filter === "all" ? "No events for your watchlist currencies." : `No ${filter}-impact events upcoming.`}
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {upcoming.map((e) => {
            const tone = e.impact === "high" ? "var(--c-red-bright)" : e.impact === "medium" ? "var(--c-amber)" : "var(--c-green-bright)"
            const d = new Date(e.scheduled_at)
            const time = d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })
            return (
              <li key={e.id} style={{ borderTop: "1px solid var(--c-border)", padding: "10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                <Flag code={e.currency} size={18} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone, flexShrink: 0 }} />
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.event}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>{time}</div>
                </div>
                {e.forecast && (
                  <span className="mono" style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>{e.forecast}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div style={{ padding: "10px 18px", borderTop: "1px solid var(--c-border)" }}>
        <Link href="/calendar" style={{ fontSize: 11.5, color: "var(--c-fg-muted)", textDecoration: "none" }}>
          View full calendar <Icon name="chevronRight" size={11} />
        </Link>
      </div>
    </div>
  )
}
