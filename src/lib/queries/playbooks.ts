import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"
import { getCurrentScope } from "./scope"

export type Playbook = Database["public"]["Tables"]["playbooks"]["Row"]

export type PlaybookStats = {
  trades: number
  closedTrades: number
  wins: number
  losses: number
  winRate: number | null
  avgR: number | null
  expectancy: number | null
  totalPnL: number
}

export async function getPlaybooksWithStats(): Promise<Array<Playbook & { stats: PlaybookStats }>> {
  const supabase = await createClient()
  const scope = await getCurrentScope()

  // Pull playbooks + their trades in two parallel queries.
  const playbooksReq = supabase.from("playbooks").select("*").order("name")
  let tradesQ = supabase.from("trades").select("playbook_id, status, pnl, r")
  if (scope !== "all") tradesQ = tradesQ.eq("account_id", scope)

  const [{ data: playbooks }, { data: trades }] = await Promise.all([playbooksReq, tradesQ])

  const byPlaybook = new Map<string, ReturnType<typeof emptyStats>>()
  ;(trades ?? []).forEach((t) => {
    if (!t.playbook_id) return
    let s = byPlaybook.get(t.playbook_id)
    if (!s) { s = emptyStats(); byPlaybook.set(t.playbook_id, s) }
    s.trades += 1
    if (t.status === "closed") {
      s.closedTrades += 1
      const pnl = Number(t.pnl) || 0
      const r = Number(t.r) || 0
      s.totalPnL += pnl
      s.rSum += r
      if (pnl > 0) s.wins += 1
      else if (pnl < 0) s.losses += 1
    }
  })

  return (playbooks ?? []).map((p) => {
    const raw = byPlaybook.get(p.id) ?? emptyStats()
    const winRate = raw.closedTrades > 0 ? Math.round((raw.wins / raw.closedTrades) * 100) : null
    const avgR = raw.closedTrades > 0 ? Number((raw.rSum / raw.closedTrades).toFixed(2)) : null
    // Expectancy = (winRate × avgWinR) + (lossRate × avgLossR). Approximate
    // with avgR per trade for now — this is the same number the prototype showed.
    const expectancy = avgR
    const stats: PlaybookStats = {
      trades: raw.trades,
      closedTrades: raw.closedTrades,
      wins: raw.wins,
      losses: raw.losses,
      winRate,
      avgR,
      expectancy,
      totalPnL: Number(raw.totalPnL.toFixed(2)),
    }
    return { ...p, stats }
  })
}

function emptyStats() {
  return { trades: 0, closedTrades: 0, wins: 0, losses: 0, totalPnL: 0, rSum: 0 }
}

export const PLAYBOOK_TEMPLATES: Array<{ name: string; color: string; notes: string; target_r: number }> = [
  {
    name: "London Breakout",
    color: "#4312A0",
    target_r: 2,
    notes: "Wait for Asia high/low. Enter on break with momentum + retest. Stop below structure. Scale at 1R, trail to BE. Skip if news within 30 min.",
  },
  {
    name: "Liquidity Sweep",
    color: "#BE333D",
    target_r: 2.5,
    notes: "Identify obvious resting liquidity (equal highs/lows). Wait for sweep + reversal candle. Enter on retest of swept level. Stop beyond extreme of sweep.",
  },
  {
    name: "Order Block",
    color: "#11C458",
    target_r: 3,
    notes: "Mark last opposing candle before strong impulsive move. Wait for return to OB. Look for rejection + lower-timeframe shift. Stop beyond OB extreme.",
  },
  {
    name: "FVG Retest",
    color: "#E5A23B",
    target_r: 2,
    notes: "Mark fair-value gaps on impulse legs. Wait for price to fill 50% of gap. Look for reaction candle. Stop beyond gap extreme. Target prior swing.",
  },
]
