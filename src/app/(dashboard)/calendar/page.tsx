import Link from "next/link"
import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { currenciesFromWatchlist, getUpcomingEvents, getWatchlist } from "@/lib/queries/watchlist"
import { CalendarView } from "@/components/calendar/calendar-view"

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

  // Fetch a wide window of events; CalendarView handles filtering client-side.
  const events = await getUpcomingEvents({})

  if (events.length === 0) {
    return (
      <>
        <SectionHeader
          title={m.title}
          subtitle={m.subtitle}
          actions={
            <Link href="/calendar?all=1" className="btn">
              <Icon name="calendar" size={13} /> <span>Refresh</span>
            </Link>
          }
        />
        <SectionStub
          icon={m.icon}
          title="No upcoming events"
          description="Real ingest from ForexFactory / TradingEconomics arrives in Phase 9. Seed data may be exhausted."
        />
      </>
    )
  }

  const subtitle =
    watchCurrencies.length > 0 && !showAll
      ? `${events.length} events · watchlist: ${watchCurrencies.join(" · ")}`
      : `${events.length} events scheduled`

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={subtitle}
        actions={
          watchCurrencies.length > 0 ? (
            <Link href="/watchlist" className="btn">
              <Icon name="watchlist" size={13} /> <span>Edit watchlist</span>
            </Link>
          ) : null
        }
      />

      <CalendarView events={events} watchCurrencies={watchCurrencies} />
    </>
  )
}
