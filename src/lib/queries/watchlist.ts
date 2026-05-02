import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

export type WatchlistPair = Database["public"]["Tables"]["watchlist_pairs"]["Row"]
export type EconomicEvent = Database["public"]["Tables"]["economic_events"]["Row"]

export async function getWatchlist(): Promise<WatchlistPair[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("watchlist_pairs")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
  return data ?? []
}

/**
 * Extract unique currency codes from pairs like "EUR/USD" → ["EUR", "USD"].
 */
export function currenciesFromWatchlist(pairs: WatchlistPair[]): string[] {
  const set = new Set<string>()
  pairs.forEach((p) => p.pair.split("/").forEach((c) => set.add(c.trim().toUpperCase())))
  return Array.from(set).sort()
}

export async function getUpcomingEvents(opts: { currencies?: string[]; limit?: number } = {}): Promise<EconomicEvent[]> {
  const supabase = await createClient()
  let q = supabase
    .from("economic_events")
    .select("*")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
  if (opts.currencies && opts.currencies.length > 0) q = q.in("currency", opts.currencies)
  if (opts.limit) q = q.limit(opts.limit)
  const { data } = await q
  return data ?? []
}
