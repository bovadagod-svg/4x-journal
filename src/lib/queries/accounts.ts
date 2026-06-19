import { createClient } from "@/lib/supabase/server"
import { ensureSystemPlaybooks } from "./playbooks"

export async function getUserAccounts() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
  return data ?? []
}

/** accountId → owner user_id. Drives trade attribution (trades roll up to the
 * account's owner). RLS scopes this to the user's team. */
export async function getAccountOwnerMap(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase.from("accounts").select("id, user_id")
  const map: Record<string, string> = {}
  for (const a of data ?? []) map[a.id] = a.user_id
  return map
}

/**
 * Build a 7-day cumulative-balance series for each account. The series ends
 * at the account's current balance and walks backward by subtracting each
 * day's net P&L. Days with no trades inherit the previous day's balance.
 *
 * Returns a Map<accountId, number[]> where each array has 7 values, ordered
 * oldest → newest.
 */
export async function getAccountSparks(accountIds: string[]): Promise<Map<string, number[]>> {
  const supabase = await createClient()
  const result = new Map<string, number[]>()
  if (accountIds.length === 0) return result

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, balance")
    .in("id", accountIds)

  const balances = new Map<string, number>()
  ;(accounts ?? []).forEach((a) => balances.set(a.id, Number(a.balance) || 0))

  const { data: trades } = await supabase
    .from("trades")
    .select("account_id, pnl, closed_at")
    .in("account_id", accountIds)
    .eq("status", "closed")
    .gte("closed_at", sevenDaysAgo.toISOString())

  // Group P&L by account+day
  const dayMs = 86_400_000
  const dailyPnL = new Map<string, Map<number, number>>()
  ;(trades ?? []).forEach((t) => {
    if (!t.closed_at) return
    const dKey = Math.floor(new Date(t.closed_at).getTime() / dayMs)
    let acc = dailyPnL.get(t.account_id)
    if (!acc) { acc = new Map(); dailyPnL.set(t.account_id, acc) }
    acc.set(dKey, (acc.get(dKey) ?? 0) + (Number(t.pnl) || 0))
  })

  const todayKey = Math.floor(Date.now() / dayMs)

  for (const id of accountIds) {
    const current = balances.get(id) ?? 0
    const accDaily = dailyPnL.get(id) ?? new Map<number, number>()
    // Build forward by starting 7 days back at (current - sumPnL last 7 days)
    const sumPnl = Array.from(accDaily.values()).reduce((s, x) => s + x, 0)
    let running = current - sumPnl
    const series: number[] = []
    for (let i = 6; i >= 0; i--) {
      const dKey = todayKey - i
      running += accDaily.get(dKey) ?? 0
      series.push(Number(running.toFixed(2)))
    }
    result.set(id, series)
  }

  return result
}

export async function getUserPlaybooks() {
  await ensureSystemPlaybooks()
  const supabase = await createClient()
  const { data } = await supabase
    .from("playbooks")
    .select("id, name, color, target_r")
    .order("name")
  return data ?? []
}
