import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"
import { getCurrentScope } from "./scope"

export { PLAYBOOK_TEMPLATES } from "@/lib/playbook-templates"

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
  /** Worst peak-to-trough drawdown in $ along this playbook's equity curve. */
  maxDrawdown: number
  /** Same metric in R units — comparable across playbooks regardless of size. */
  maxDrawdownR: number
}

export async function getPlaybooksWithStats(): Promise<Array<Playbook & { stats: PlaybookStats }>> {
  const supabase = await createClient()
  const scope = await getCurrentScope()

  // Pull playbooks + their trades in two parallel queries. closed_at is needed
  // to walk each playbook's equity curve chronologically for max-DD math.
  const playbooksReq = supabase.from("playbooks").select("*").order("name")
  let tradesQ = supabase.from("trades").select("playbook_id, status, pnl, r, closed_at")
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
      if (t.closed_at) {
        s.closedSeries.push({ ts: new Date(t.closed_at).getTime(), pnl, r })
      }
    }
  })

  return (playbooks ?? []).map((p) => {
    const raw = byPlaybook.get(p.id) ?? emptyStats()
    const winRate = raw.closedTrades > 0 ? Math.round((raw.wins / raw.closedTrades) * 100) : null
    const avgR = raw.closedTrades > 0 ? Number((raw.rSum / raw.closedTrades).toFixed(2)) : null
    // Expectancy = (winRate × avgWinR) + (lossRate × avgLossR). Approximate
    // with avgR per trade for now — this is the same number the prototype showed.
    const expectancy = avgR
    const dd = computeMaxDrawdown(raw.closedSeries)
    const stats: PlaybookStats = {
      trades: raw.trades,
      closedTrades: raw.closedTrades,
      wins: raw.wins,
      losses: raw.losses,
      winRate,
      avgR,
      expectancy,
      totalPnL: Number(raw.totalPnL.toFixed(2)),
      maxDrawdown: dd.dollars,
      maxDrawdownR: dd.r,
    }
    return { ...p, stats }
  })
}

function emptyStats() {
  return {
    trades: 0, closedTrades: 0, wins: 0, losses: 0,
    totalPnL: 0, rSum: 0,
    closedSeries: [] as Array<{ ts: number; pnl: number; r: number }>,
  }
}

/**
 * Walk a chronologically sorted sequence of closed trades and find the worst
 * peak-to-trough excursion in both $ and R. Used per-playbook so users see
 * which setups have nasty losing streaks even when lifetime P&L looks fine.
 */
function computeMaxDrawdown(series: Array<{ ts: number; pnl: number; r: number }>): { dollars: number; r: number } {
  if (series.length === 0) return { dollars: 0, r: 0 }
  const sorted = [...series].sort((a, b) => a.ts - b.ts)
  let runningPnl = 0, peakPnl = 0, maxDd = 0
  let runningR = 0, peakR = 0, maxDdR = 0
  for (const t of sorted) {
    runningPnl += t.pnl
    if (runningPnl > peakPnl) peakPnl = runningPnl
    const dd = peakPnl - runningPnl
    if (dd > maxDd) maxDd = dd

    runningR += t.r
    if (runningR > peakR) peakR = runningR
    const ddR = peakR - runningR
    if (ddR > maxDdR) maxDdR = ddR
  }
  return { dollars: Number(maxDd.toFixed(2)), r: Number(maxDdR.toFixed(2)) }
}

