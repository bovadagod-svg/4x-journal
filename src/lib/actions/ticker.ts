"use server"

import { getTickerSnapshot, type TickerSnapshot } from "@/lib/integrations/polygon"
import { getWatchlist } from "@/lib/queries/watchlist"

/**
 * Live ticker tape for the dashboard. Returns last close + 1-day % change
 * for the user's watchlist pairs (or a sensible default set when the
 * watchlist is empty).
 *
 * Activates when POLYGON_API_KEY is set; without it every snapshot has
 * `price=null` and the caller should render a "configure POLYGON_API_KEY"
 * hint instead of fake data.
 *
 * Capped at 6 pairs to stay within Polygon's free-tier rate limit even
 * when the client polls.
 */

const DEFAULT_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF"]
const MAX_PAIRS = 6

export type TickerTapeResult = {
  configured: boolean
  snapshots: TickerSnapshot[]
  fetchedAt: string
}

export async function getTickerTapeSnapshots(): Promise<TickerTapeResult> {
  const fetchedAt = new Date().toISOString()
  if (!process.env.POLYGON_API_KEY) {
    return { configured: false, snapshots: [], fetchedAt }
  }

  // Watchlist if non-empty, otherwise default majors. Cap at MAX_PAIRS.
  const watchlist = await getWatchlist().catch(() => [])
  const pairs = watchlist.length > 0
    ? watchlist.slice(0, MAX_PAIRS).map((w) => w.pair)
    : DEFAULT_PAIRS.slice(0, MAX_PAIRS)

  // Fetch in parallel — snapshots are independent and Polygon handles
  // concurrency fine. Each call is independent; one bad pair doesn't break
  // the others.
  const snapshots = await Promise.all(pairs.map((p) => getTickerSnapshot(p)))
  return { configured: true, snapshots, fetchedAt }
}
