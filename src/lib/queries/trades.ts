import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"
import { getCurrentScope } from "./scope"

export type Trade = Database["public"]["Tables"]["trades"]["Row"]
export type JournalEntry = Database["public"]["Tables"]["journal_entries"]["Row"]

/**
 * Streak + rules-followed for the discipline check-in. Streak = consecutive
 * days (UTC) with at least one journal entry. Rules-followed % = entries
 * without rule_break / total entries in the last 7 days.
 */
export async function getDisciplineStats(): Promise<{
  streakDays: number
  rulesFollowedPct: number | null
  todayMood: string | null
}> {
  const supabase = await createClient()
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 30); sevenDaysAgo.setHours(0, 0, 0, 0)
  const { data } = await supabase
    .from("journal_entries")
    .select("created_at, rule_break, mood")
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false })

  const entries = data ?? []
  if (entries.length === 0) return { streakDays: 0, rulesFollowedPct: null, todayMood: null }

  // Streak: walk back day-by-day from today; break the moment we hit a day
  // with no entries.
  const dayHas = new Set<string>()
  for (const e of entries) {
    const d = new Date(e.created_at)
    dayHas.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`)
  }
  let streak = 0
  const cursor = new Date()
  while (true) {
    const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}-${cursor.getUTCDate()}`
    if (dayHas.has(key)) {
      streak += 1
      cursor.setUTCDate(cursor.getUTCDate() - 1)
    } else break
    if (streak > 365) break // safety
  }

  // Rules followed in last 7 days
  const sevenDays = new Date(); sevenDays.setDate(sevenDays.getDate() - 7); sevenDays.setHours(0, 0, 0, 0)
  const recent = entries.filter((e) => new Date(e.created_at).getTime() >= sevenDays.getTime())
  const rulesPct = recent.length > 0
    ? Math.round((recent.filter((e) => !e.rule_break).length / recent.length) * 100)
    : null

  // Today's mood = mood from most recent entry today
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayEntry = entries.find((e) => new Date(e.created_at).getTime() >= today.getTime())
  const todayMood = todayEntry?.mood ?? null

  return { streakDays: streak, rulesFollowedPct: rulesPct, todayMood }
}

async function resolveScope(provided: string | null | undefined): Promise<string> {
  if (provided === undefined) return await getCurrentScope()
  return provided ?? "all"
}

export async function getUserTrades(opts: { accountId?: string | null; limit?: number } = {}) {
  const scope = await resolveScope(opts.accountId)
  const supabase = await createClient()
  let q = supabase.from("trades").select("*").order("opened_at", { ascending: false })
  if (scope !== "all") q = q.eq("account_id", scope)
  if (opts.limit) q = q.limit(opts.limit)
  const { data } = await q
  return data ?? []
}

export async function getOpenTrades(opts: { accountId?: string | null } = {}) {
  const scope = await resolveScope(opts.accountId)
  const supabase = await createClient()
  let q = supabase.from("trades").select("*").eq("status", "open").order("opened_at", { ascending: false })
  if (scope !== "all") q = q.eq("account_id", scope)
  const { data } = await q
  return data ?? []
}

export async function getJournalEntries(opts: { accountId?: string | null; limit?: number } = {}) {
  const scope = await resolveScope(opts.accountId)
  const supabase = await createClient()
  let q = supabase.from("journal_entries").select("*").order("created_at", { ascending: false })
  if (scope !== "all") q = q.eq("account_id", scope)
  if (opts.limit) q = q.limit(opts.limit)
  const { data } = await q
  return data ?? []
}

export async function getTodayPnL(opts: { accountId?: string | null } = {}) {
  const scope = await resolveScope(opts.accountId)
  const supabase = await createClient()
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  let q = supabase
    .from("trades")
    .select("pnl, status")
    .gte("closed_at", startOfDay.toISOString())
    .eq("status", "closed")
  if (scope !== "all") q = q.eq("account_id", scope)
  const { data } = await q
  const closed = data ?? []
  return {
    value: closed.reduce((s, t) => s + (Number(t.pnl) || 0), 0),
    trades: closed.length,
    wins: closed.filter((t) => Number(t.pnl) > 0).length,
    losses: closed.filter((t) => Number(t.pnl) < 0).length,
  }
}

/**
 * Returns cumulative-P&L sparklines + totals for today / week / month, scoped
 * to the user's current account. Each "spark" is an array of running totals
 * sampled from the closed trades inside that window — Sparkline renders it.
 */
export async function getPnLByPeriod(opts: { accountId?: string | null } = {}): Promise<{
  today: { value: number; trades: number; spark: number[] }
  week: { value: number; trades: number; spark: number[] }
  month: { value: number; trades: number; spark: number[] }
}> {
  const scope = await resolveScope(opts.accountId)
  const supabase = await createClient()
  const now = new Date()
  const monthStart = new Date(now); monthStart.setDate(now.getDate() - 30); monthStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7); weekStart.setHours(0, 0, 0, 0)
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)

  let q = supabase
    .from("trades")
    .select("pnl, closed_at")
    .eq("status", "closed")
    .gte("closed_at", monthStart.toISOString())
    .order("closed_at", { ascending: true })
  if (scope !== "all") q = q.eq("account_id", scope)
  const { data } = await q

  const monthRows = (data ?? [])
    .filter((t): t is typeof t & { closed_at: string } => t.closed_at != null)
    .map((t) => ({ pnl: Number(t.pnl) || 0, ts: new Date(t.closed_at).getTime() }))

  const buildSpark = (rows: { pnl: number; ts: number }[]): { value: number; trades: number; spark: number[] } => {
    if (rows.length === 0) return { value: 0, trades: 0, spark: [] }
    let sum = 0
    const spark: number[] = []
    for (const r of rows) { sum += r.pnl; spark.push(Number(sum.toFixed(2))) }
    return { value: Number(sum.toFixed(2)), trades: rows.length, spark }
  }

  const dayRows = monthRows.filter((r) => r.ts >= dayStart.getTime())
  const weekRows = monthRows.filter((r) => r.ts >= weekStart.getTime())

  return {
    today: buildSpark(dayRows),
    week: buildSpark(weekRows),
    month: buildSpark(monthRows),
  }
}
