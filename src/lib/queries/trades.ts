import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

export type Trade = Database["public"]["Tables"]["trades"]["Row"]
export type JournalEntry = Database["public"]["Tables"]["journal_entries"]["Row"]

export async function getUserTrades(opts: { accountId?: string | null; limit?: number } = {}) {
  const supabase = await createClient()
  let q = supabase.from("trades").select("*").order("opened_at", { ascending: false })
  if (opts.accountId && opts.accountId !== "all") q = q.eq("account_id", opts.accountId)
  if (opts.limit) q = q.limit(opts.limit)
  const { data } = await q
  return data ?? []
}

export async function getOpenTrades(opts: { accountId?: string | null } = {}) {
  const supabase = await createClient()
  let q = supabase.from("trades").select("*").eq("status", "open").order("opened_at", { ascending: false })
  if (opts.accountId && opts.accountId !== "all") q = q.eq("account_id", opts.accountId)
  const { data } = await q
  return data ?? []
}

export async function getJournalEntries(opts: { accountId?: string | null; limit?: number } = {}) {
  const supabase = await createClient()
  let q = supabase.from("journal_entries").select("*").order("created_at", { ascending: false })
  if (opts.accountId && opts.accountId !== "all") q = q.eq("account_id", opts.accountId)
  if (opts.limit) q = q.limit(opts.limit)
  const { data } = await q
  return data ?? []
}

export async function getTodayPnL(opts: { accountId?: string | null } = {}) {
  const supabase = await createClient()
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  let q = supabase
    .from("trades")
    .select("pnl, status")
    .gte("closed_at", startOfDay.toISOString())
    .eq("status", "closed")
  if (opts.accountId && opts.accountId !== "all") q = q.eq("account_id", opts.accountId)
  const { data } = await q
  const closed = data ?? []
  return {
    value: closed.reduce((s, t) => s + (Number(t.pnl) || 0), 0),
    trades: closed.length,
    wins: closed.filter((t) => Number(t.pnl) > 0).length,
    losses: closed.filter((t) => Number(t.pnl) < 0).length,
  }
}
