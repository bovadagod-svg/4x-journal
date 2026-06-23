/**
 * Categorical filters for the Analytics page — Pair / Playbook / Result / Side
 * / Account / Session. These run *client-side* over the already-fetched,
 * range-scoped trades (the date range itself is a separate, URL-driven filter
 * handled by RangeFilterBar). Each dimension is multi-select: an empty array
 * means "no constraint" (show all), a non-empty array restricts to matches.
 *
 * Session attribution reuses the shared FX session model in `@/lib/sessions`
 * so the filter agrees with Session Edge and the topbar clock. A trade can fall
 * in more than one session (e.g. the London/New York overlap), so it matches a
 * session filter when *any* of its sessions is selected.
 */
import type { Trade } from "@/lib/queries/trades"
import { classifyOutcome, type Outcome } from "@/lib/outcome"
import { FX_SESSIONS, openSessionsAt, SESSION, type SessionId } from "@/lib/sessions"

export type AnalyticsFilters = {
  pairs: string[] // pair codes, e.g. "EUR/USD"
  playbooks: string[] // resolved playbook labels (incl. "Untagged")
  results: Outcome[] // "win" | "loss" | "breakeven"
  sides: string[] // "long" | "short"
  accounts: string[] // resolved account labels (incl. "Unknown")
  sessions: SessionId[] // "sydney" | "tokyo" | "london" | "newyork"
}

export const EMPTY_ANALYTICS_FILTERS: AnalyticsFilters = {
  pairs: [],
  playbooks: [],
  results: [],
  sides: [],
  accounts: [],
  sessions: [],
}

/** Maps needed to resolve a trade's playbook / account to its display label. */
export type FilterMaps = {
  playbookMap: Map<string, string>
  accountMap: Map<string, string>
}

export const UNTAGGED_PLAYBOOK = "Untagged"
export const UNKNOWN_ACCOUNT = "Unknown"

export function playbookLabel(t: Trade, playbookMap: Map<string, string>): string {
  return t.playbook_id ? playbookMap.get(t.playbook_id) ?? UNTAGGED_PLAYBOOK : UNTAGGED_PLAYBOOK
}

export function accountLabel(t: Trade, accountMap: Map<string, string>): string {
  return accountMap.get(t.account_id) ?? UNKNOWN_ACCOUNT
}

/** Every FX session a trade's entry falls in (empty over the weekend gap). */
export function tradeSessions(t: Trade): SessionId[] {
  if (!t.opened_at) return []
  return openSessionsAt(new Date(t.opened_at)).map((s) => s.id)
}

/** True when at least one categorical dimension is constrained. */
export function analyticsFiltersActive(f: AnalyticsFilters): boolean {
  return (
    f.pairs.length > 0 ||
    f.playbooks.length > 0 ||
    f.results.length > 0 ||
    f.sides.length > 0 ||
    f.accounts.length > 0 ||
    f.sessions.length > 0
  )
}

/** Number of constrained dimensions — drives the "N filters" summary chip. */
export function countActiveDimensions(f: AnalyticsFilters): number {
  return [f.pairs, f.playbooks, f.results, f.sides, f.accounts, f.sessions].filter(
    (a) => a.length > 0,
  ).length
}

/**
 * Keep only the trades that satisfy every constrained dimension. Unconstrained
 * dimensions (empty arrays) are skipped, so with no filters this returns the
 * input untouched.
 */
export function applyAnalyticsFilters(
  trades: Trade[],
  f: AnalyticsFilters,
  maps: FilterMaps,
): Trade[] {
  if (!analyticsFiltersActive(f)) return trades
  return trades.filter((t) => {
    if (f.pairs.length && !f.pairs.includes(t.pair)) return false
    if (f.sides.length && !f.sides.includes(t.side)) return false
    if (f.playbooks.length && !f.playbooks.includes(playbookLabel(t, maps.playbookMap))) return false
    if (f.accounts.length && !f.accounts.includes(accountLabel(t, maps.accountMap))) return false
    if (f.results.length) {
      const o = classifyOutcome(Number(t.pnl))
      if (!o || !f.results.includes(o)) return false
    }
    if (f.sessions.length) {
      const ss = tradeSessions(t)
      if (!ss.some((s) => f.sessions.includes(s))) return false
    }
    return true
  })
}

/** Available options for each dimension, derived from the trades in view so the
 * dropdowns only ever offer values that actually exist in the current data. */
export type AnalyticsFilterOptions = {
  pairs: string[]
  playbooks: string[]
  results: Outcome[]
  sides: string[]
  accounts: string[]
  sessions: SessionId[]
}

const RESULT_ORDER: Outcome[] = ["win", "loss", "breakeven"]
const SIDE_ORDER = ["long", "short"]

export function deriveAnalyticsFilterOptions(trades: Trade[], maps: FilterMaps): AnalyticsFilterOptions {
  const pairs = new Set<string>()
  const playbooks = new Set<string>()
  const results = new Set<Outcome>()
  const sides = new Set<string>()
  const accounts = new Set<string>()
  const sessions = new Set<SessionId>()

  for (const t of trades) {
    pairs.add(t.pair)
    playbooks.add(playbookLabel(t, maps.playbookMap))
    sides.add(t.side)
    accounts.add(accountLabel(t, maps.accountMap))
    const o = classifyOutcome(Number(t.pnl))
    if (o) results.add(o)
    for (const s of tradeSessions(t)) sessions.add(s)
  }

  return {
    pairs: [...pairs].sort(),
    playbooks: [...playbooks].sort(sortUntaggedLast),
    results: RESULT_ORDER.filter((r) => results.has(r)),
    sides: SIDE_ORDER.filter((s) => sides.has(s)),
    accounts: [...accounts].sort(sortUnknownLast),
    sessions: FX_SESSIONS.map((s) => s.id).filter((id) => sessions.has(id)),
  }
}

/** Human label for a result outcome ("win" → "Win"). */
export function resultLabel(o: Outcome): string {
  return o.charAt(0).toUpperCase() + o.slice(1)
}

/** Human label for a side ("long" → "Long"). */
export function sideLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Display name for a session id ("london" → "London"). */
export function sessionLabel(id: SessionId): string {
  return SESSION[id].name
}

// "Untagged" / "Unknown" are catch-all buckets — keep them at the end of the
// alphabetical list so real names lead.
function sortUntaggedLast(a: string, b: string): number {
  if (a === UNTAGGED_PLAYBOOK) return 1
  if (b === UNTAGGED_PLAYBOOK) return -1
  return a.localeCompare(b)
}

function sortUnknownLast(a: string, b: string): number {
  if (a === UNKNOWN_ACCOUNT) return 1
  if (b === UNKNOWN_ACCOUNT) return -1
  return a.localeCompare(b)
}
