/**
 * Time-range filter shared between the Dashboard, Analytics, and Reports
 * pages. Two modes:
 *
 *   1. Preset: 7D / 30D / 90D / All — "?range=30D"
 *   2. Custom: pick any from/to dates — "?from=2026-02-01&to=2026-02-07"
 *
 * The URL is the source of truth; both pages parse it server-side and
 * thread the resulting bounds into their queries.
 */

export type Range = "7D" | "30D" | "90D" | "All"
export const RANGES: Range[] = ["7D", "30D", "90D", "All"]
export const DEFAULT_RANGE: Range = "30D"

export type RangeSelection =
  | { kind: "preset"; preset: Range }
  | { kind: "custom"; from: string; to: string }   // YYYY-MM-DD strings

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(s: string): boolean {
  if (!ISO_DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !isNaN(d.getTime())
}

export function parseRangeSelection(params: {
  range?: string | null
  from?: string | null
  to?: string | null
}): RangeSelection {
  const from = params.from ?? null
  const to = params.to ?? null
  if (from && to && isValidDate(from) && isValidDate(to)) {
    // Normalize: make sure from <= to so the picker can't produce inverted
    // ranges by accident.
    return from <= to
      ? { kind: "custom", from, to }
      : { kind: "custom", from: to, to: from }
  }
  return { kind: "preset", preset: parseRange(params.range) }
}

export function parseRange(input: string | null | undefined): Range {
  if (!input) return DEFAULT_RANGE
  return RANGES.includes(input as Range) ? (input as Range) : DEFAULT_RANGE
}

/**
 * Convert a selection into ISO timestamp bounds for use as `gte` / `lte`
 * in Supabase queries. `from` is the start of the from-date in UTC;
 * `to` is the end of the to-date so a same-day pick still includes
 * everything that closed that day.
 */
export function rangeBoundsIso(sel: RangeSelection): { from: string | null; to: string | null } {
  if (sel.kind === "custom") {
    return {
      from: `${sel.from}T00:00:00.000Z`,
      to: `${sel.to}T23:59:59.999Z`,
    }
  }
  if (sel.preset === "All") return { from: null, to: null }
  const days = sel.preset === "7D" ? 7 : sel.preset === "30D" ? 30 : 90
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return { from: d.toISOString(), to: null }
}

export function rangeLabel(sel: RangeSelection): string {
  if (sel.kind === "custom") {
    const same = sel.from === sel.to
    if (same) return `on ${formatDate(sel.from)}`
    return `${formatDate(sel.from)} → ${formatDate(sel.to)}`
  }
  return sel.preset === "All" ? "all-time" : `last ${sel.preset}`
}

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  })
}

/**
 * Build URL search params from a selection — used by the picker when
 * navigating. Drops the default preset entirely (so the URL stays clean
 * for the common case).
 */
export function rangeToSearchParams(sel: RangeSelection): URLSearchParams {
  const p = new URLSearchParams()
  if (sel.kind === "custom") {
    p.set("from", sel.from)
    p.set("to", sel.to)
  } else if (sel.preset !== DEFAULT_RANGE) {
    p.set("range", sel.preset)
  }
  return p
}
