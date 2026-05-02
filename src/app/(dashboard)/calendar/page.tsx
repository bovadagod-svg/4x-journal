import Link from "next/link"
import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { Icon, Flag } from "@/components/icons"
import { currenciesFromWatchlist, getUpcomingEvents, getWatchlist } from "@/lib/queries/watchlist"

const IMPACT_TONE = { high: "red", medium: "amber", low: "green" } as const

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>
}) {
  const m = SECTION_META.calendar
  const params = await searchParams
  const showAll = params.all === "1"

  const watchlist = await getWatchlist()
  const watchCurrencies = currenciesFromWatchlist(watchlist)

  const events = await getUpcomingEvents(
    showAll || watchCurrencies.length === 0
      ? {}
      : { currencies: watchCurrencies },
  )

  if (watchlist.length === 0 && !showAll) {
    return (
      <>
        <SectionHeader
          title={m.title}
          subtitle={m.subtitle}
          actions={
            <Link href="/calendar?all=1" className="btn">
              <Icon name="calendar" size={13} /> <span>Show all events</span>
            </Link>
          }
        />
        <SectionStub
          icon={m.icon}
          title="Calendar isn't filtered to your pairs yet"
          description="Add pairs to your watchlist and we'll auto-filter to those currencies. Or click 'Show all events' above to see everything."
        />
      </>
    )
  }

  // Group events by day for clean rendering.
  const groups = new Map<string, typeof events>()
  events.forEach((e) => {
    const d = new Date(e.scheduled_at)
    const dayKey = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    let arr = groups.get(dayKey)
    if (!arr) { arr = []; groups.set(dayKey, arr) }
    arr.push(e)
  })

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={
          showAll || watchCurrencies.length === 0
            ? `${events.length} upcoming event${events.length === 1 ? "" : "s"}`
            : `${events.length} events for ${watchCurrencies.join(" · ")}`
        }
        actions={
          showAll
            ? <Link href="/calendar" className="btn">Filter to watchlist</Link>
            : <Link href="/calendar?all=1" className="btn">Show all events</Link>
        }
      />

      {events.length === 0 ? (
        <SectionStub
          icon={m.icon}
          title="No upcoming events"
          description="Either your watchlist's currencies have nothing scheduled, or the seed data is exhausted. Real ingest comes in Phase 9."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Array.from(groups.entries()).map(([day, dayEvents]) => (
            <div key={day} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 className="card-title" style={{ fontSize: 13 }}>{day}</h3>
                <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>{dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <tbody>
                  {dayEvents.map((e) => {
                    const tone = IMPACT_TONE[e.impact as keyof typeof IMPACT_TONE]
                    const dotColor = tone === "red" ? "var(--c-red-bright)" : tone === "amber" ? "var(--c-amber)" : "var(--c-green-bright)"
                    const time = new Date(e.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                    return (
                      <tr key={e.id} style={{ borderTop: "1px solid var(--c-border)" }}>
                        <td className="mono" style={{ padding: "10px 18px", color: "var(--c-fg-muted)", whiteSpace: "nowrap" }}>{time}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Flag code={e.currency} size={18} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{e.currency}</span>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5 }}>{e.event}</span>
                        </td>
                        <td className="mono" style={{ padding: "10px 12px", textAlign: "right", color: "var(--c-fg-muted)", whiteSpace: "nowrap", fontSize: 11.5 }}>
                          {e.forecast ? `Fc: ${e.forecast}` : ""}
                        </td>
                        <td className="mono" style={{ padding: "10px 18px", textAlign: "right", color: "var(--c-fg-dim)", whiteSpace: "nowrap", fontSize: 11.5 }}>
                          {e.previous ? `Prev: ${e.previous}` : ""}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
