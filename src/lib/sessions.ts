/**
 * Single source of truth for FX trading sessions.
 *
 * The Forex market trades 24h, 5 days a week. The week opens when Sydney comes
 * online (Sunday 22:00 UTC) and closes when New York wraps (Friday 22:00 UTC);
 * all of Saturday and the Sunday-morning hours are flat. Within the week the
 * sessions overlap — the London/New York overlap (13:00–17:00 UTC) is the
 * highest-volume window of the day — so at any open instant *one or more*
 * sessions can be live at once.
 *
 * Hours are fixed UTC following the standard retail convention; we intentionally
 * don't shift them for daylight saving (this matches how the rest of the app
 * buckets trades by UTC hour). The topbar status pill, the dashboard session
 * clock, and the session-edge analytics all read from here so they agree on
 * (a) when the market is open, and (b) which session a trade was taken in.
 */

export type SessionId = "sydney" | "tokyo" | "london" | "newyork"

export type FxSession = {
  id: SessionId
  name: string
  /** Display label for the session's home timezone (cosmetic only). */
  tz: string
  /** UTC hour the session opens, [0, 24). */
  open: number
  /** UTC hour the session closes, [0, 24). */
  close: number
  color: string
}

const SYDNEY: FxSession   = { id: "sydney",  name: "Sydney",   tz: "AEST", open: 22, close: 7,  color: "#9A97A1" }
const TOKYO: FxSession    = { id: "tokyo",   name: "Tokyo",    tz: "JST",  open: 0,  close: 9,  color: "#BE333D" }
const LONDON: FxSession   = { id: "london",  name: "London",   tz: "BST",  open: 8,  close: 17, color: "#4312A0" }
const NEW_YORK: FxSession = { id: "newyork", name: "New York", tz: "EDT",  open: 13, close: 22, color: "#11C458" }

/** All four major sessions in clock order. */
export const FX_SESSIONS: readonly FxSession[] = [SYDNEY, TOKYO, LONDON, NEW_YORK]

/** Sessions keyed by id, for callers that need a specific window's hours. */
export const SESSION = { sydney: SYDNEY, tokyo: TOKYO, london: LONDON, newyork: NEW_YORK } as const

/** Fractional UTC hour for a Date (e.g. 13.5 for 13:30). */
export function utcHour(d: Date): number {
  return d.getUTCHours() + d.getUTCMinutes() / 60
}

/**
 * True if `hour` (UTC, fractional) falls inside the [open, close) window,
 * handling windows that wrap past midnight (e.g. Sydney 22:00 → 07:00).
 */
export function inWindow(hour: number, open: number, close: number): boolean {
  if (open <= close) return hour >= open && hour < close
  return hour >= open || hour < close
}

/**
 * Is the FX market shut for the weekend at instant `d`?
 *
 * Closed from Friday's New York close (22:00 UTC) through Sunday's Sydney open
 * (22:00 UTC), plus all of Saturday.
 */
export function isWeekendClosed(d: Date): boolean {
  const day = d.getUTCDay() // 0 = Sunday … 6 = Saturday
  const hour = utcHour(d)
  if (day === 6) return true                            // all of Saturday
  if (day === 5 && hour >= NEW_YORK.close) return true  // Friday, after NY close
  if (day === 0 && hour < SYDNEY.open) return true      // Sunday, before Sydney open
  return false
}

/**
 * The sessions live at instant `d`, in clock order. Empty over the weekend.
 * More than one entry means overlapping sessions (e.g. London + New York).
 */
export function openSessionsAt(d: Date): FxSession[] {
  if (isWeekendClosed(d)) return []
  const hour = utcHour(d)
  return FX_SESSIONS.filter((s) => inWindow(hour, s.open, s.close))
}

export type MarketStatus = {
  open: boolean
  /** Sessions currently live (empty when closed). */
  sessions: FxSession[]
  /** Names of the live sessions joined for display, e.g. "London / New York". */
  sessionLabel: string
  /** Why the market is shut: "Weekend", "Between sessions", or "" when open. */
  closedReason: string
}

/**
 * Market status for the topbar pill / clock header. Weekend- and overlap-aware:
 * returns every session that's open so the label can read "London / New York".
 */
export function marketStatusAt(d: Date): MarketStatus {
  if (isWeekendClosed(d)) {
    return { open: false, sessions: [], sessionLabel: "", closedReason: "Weekend" }
  }
  const sessions = openSessionsAt(d)
  return {
    open: sessions.length > 0,
    sessions,
    sessionLabel: sessions.map((s) => s.name).join(" / "),
    // Weekday coverage is continuous, so this is a defensive fallback only.
    closedReason: sessions.length > 0 ? "" : "Between sessions",
  }
}

/**
 * Session attribution for a single instant — used to label *when a trade was
 * taken*. Returns every session the timestamp falls in (an overlap trade is
 * tagged with both), or "Closed" if it lands in the weekend gap.
 */
export function sessionLabelForInstant(d: Date): string {
  const sessions = openSessionsAt(d)
  return sessions.length > 0 ? sessions.map((s) => s.name).join(" / ") : "Closed"
}
