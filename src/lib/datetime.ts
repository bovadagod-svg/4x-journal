/**
 * Timezone-aware display formatting for stored UTC timestamps.
 *
 * Every trade/journal/sync time is stored in UTC. For display we render it in
 * the user's chosen zone (`user_settings.timezone`, surfaced via
 * `@/lib/timezone-context`) rather than the browser's zone, so the same trade
 * reads the same wall-clock time on every device. These helpers are pure — the
 * zone is always passed in — so they're usable from server and client alike.
 */

export type DateInput = string | number | Date | null | undefined

/** The browser's IANA timezone, or "UTC" if it can't be resolved (e.g. on the server). */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/**
 * Format a UTC instant (ISO string / epoch ms / Date) as a wall-clock string in
 * `timeZone`. Returns "" for null/invalid input, and falls back to the host
 * zone if `timeZone` isn't a valid IANA name (so an odd setting never throws
 * mid-render).
 */
export function formatInZone(
  value: DateInput,
  timeZone: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  if (value == null) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  try {
    return d.toLocaleString("en-US", { timeZone, ...opts })
  } catch {
    return d.toLocaleString("en-US", opts)
  }
}

// Shared presets so call sites format consistently.
export const DATE_MED: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
export const DATE_SHORT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
export const TIME_SHORT: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" }
export const DATETIME_MED: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
