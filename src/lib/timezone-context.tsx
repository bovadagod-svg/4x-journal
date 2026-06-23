"use client"

import { createContext, useContext, useMemo } from "react"
import {
  DATE_MED,
  DATE_SHORT,
  DATETIME_MED,
  TIME_SHORT,
  browserTimeZone,
  formatInZone,
  type DateInput,
} from "./datetime"

/**
 * Provides the user's display timezone (from `user_settings.timezone`) to the
 * client tree. The value is seeded on the server in the dashboard layout, so
 * server and client render the same wall-clock time — no hydration mismatch.
 */
const TimeZoneContext = createContext<string | null>(null)

export function TimeZoneProvider({
  timeZone,
  children,
}: {
  timeZone: string
  children: React.ReactNode
}) {
  return <TimeZoneContext.Provider value={timeZone}>{children}</TimeZoneContext.Provider>
}

/** Effective display zone: the user's setting, or the browser zone if unwrapped. */
export function useTimeZone(): string {
  const ctx = useContext(TimeZoneContext)
  return ctx ?? browserTimeZone()
}

export type DateFormatter = {
  /** The active IANA zone (e.g. "America/New_York"). */
  tz: string
  /** "Jun 20, 2026, 1:54 PM" — full date + time. */
  dateTime: (v: DateInput) => string
  /** "Jun 20, 2026" — date only. */
  date: (v: DateInput) => string
  /** "Jun 20" — month + day. */
  dateShort: (v: DateInput) => string
  /** "1:54 PM" — time only. */
  time: (v: DateInput) => string
  /** Arbitrary Intl options, rendered in the user's zone. */
  custom: (v: DateInput, opts: Intl.DateTimeFormatOptions) => string
}

/** Formatters bound to the user's display zone. Use in client components. */
export function useDateFmt(): DateFormatter {
  const tz = useTimeZone()
  return useMemo(
    () => ({
      tz,
      dateTime: (v) => formatInZone(v, tz, DATETIME_MED),
      date: (v) => formatInZone(v, tz, DATE_MED),
      dateShort: (v) => formatInZone(v, tz, DATE_SHORT),
      time: (v) => formatInZone(v, tz, TIME_SHORT),
      custom: (v, opts) => formatInZone(v, tz, opts),
    }),
    [tz],
  )
}

/**
 * Render a stored UTC instant as local wall-clock text. A client component, so
 * it also works when dropped into a server-rendered tree (recent trades,
 * journal feed). Pass `preset` for a common shape or `opts` for custom Intl
 * options; defaults to full date + time.
 */
export function LocalTime({
  value,
  opts,
  preset,
}: {
  value: DateInput
  opts?: Intl.DateTimeFormatOptions
  preset?: "dateTime" | "date" | "dateShort" | "time"
}) {
  const fmt = useDateFmt()
  const text = opts ? fmt.custom(value, opts) : fmt[preset ?? "dateTime"](value)
  return <>{text}</>
}
