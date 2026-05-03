/**
 * Time-range filter shared between the Dashboard, Analytics, and Reports
 * pages. The range string is the same shape Analytics already uses, so a
 * URL like ?range=30D works the same wherever it's read.
 */

export type Range = "7D" | "30D" | "90D" | "All"
export const RANGES: Range[] = ["7D", "30D", "90D", "All"]
export const DEFAULT_RANGE: Range = "30D"

export function parseRange(input: string | null | undefined): Range {
  if (!input) return DEFAULT_RANGE
  return RANGES.includes(input as Range) ? (input as Range) : DEFAULT_RANGE
}

/**
 * Convert a range to an ISO timestamp lower-bound. Returns null for "All"
 * so callers can skip the gte filter entirely.
 */
export function rangeFromIso(range: Range): string | null {
  if (range === "All") return null
  const days = range === "7D" ? 7 : range === "30D" ? 30 : 90
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function rangeLabel(range: Range): string {
  return range === "All" ? "all-time" : `last ${range}`
}
