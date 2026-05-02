import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

export type TradeFill = Database["public"]["Tables"]["trade_fills"]["Row"]

/**
 * Fetch all fills for a single trade, ordered chronologically.
 */
export async function getTradeFills(tradeId: string): Promise<TradeFill[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("trade_fills")
    .select("*")
    .eq("trade_id", tradeId)
    .order("filled_at", { ascending: true })
  return data ?? []
}

/**
 * Fetch fills for many trades at once, grouped by trade_id.
 */
export async function getFillsForTrades(tradeIds: string[]): Promise<Map<string, TradeFill[]>> {
  const out = new Map<string, TradeFill[]>()
  if (tradeIds.length === 0) return out
  const supabase = await createClient()
  const { data } = await supabase
    .from("trade_fills")
    .select("*")
    .in("trade_id", tradeIds)
    .order("filled_at", { ascending: true })
  for (const f of data ?? []) {
    const arr = out.get(f.trade_id) ?? []
    arr.push(f)
    out.set(f.trade_id, arr)
  }
  return out
}

/**
 * Pending orders only — placed limit/stop entries that haven't filled yet.
 */
export async function getPendingOrders(opts: { accountId?: string | null } = {}) {
  const supabase = await createClient()
  let q = supabase
    .from("trades")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
  if (opts.accountId && opts.accountId !== "all") q = q.eq("account_id", opts.accountId)
  const { data } = await q
  return data ?? []
}

/**
 * Fill counts (entry / exit) for a list of trades — used in the Ledger row chip.
 */
export async function getFillCounts(tradeIds: string[]): Promise<Map<string, { entries: number; exits: number }>> {
  const out = new Map<string, { entries: number; exits: number }>()
  if (tradeIds.length === 0) return out
  const supabase = await createClient()
  const { data } = await supabase
    .from("trade_fills")
    .select("trade_id, kind")
    .in("trade_id", tradeIds)
  for (const f of data ?? []) {
    const cur = out.get(f.trade_id) ?? { entries: 0, exits: 0 }
    if (f.kind === "entry") cur.entries += 1
    else if (f.kind === "exit") cur.exits += 1
    out.set(f.trade_id, cur)
  }
  return out
}
