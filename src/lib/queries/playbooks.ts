import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"
import { getCurrentScope } from "./scope"
import { isWin, isLoss, winRatePct } from "@/lib/outcome"

export { PLAYBOOK_TEMPLATES } from "@/lib/playbook-templates"

/**
 * Playbooks every user always has. Created lazily (idempotent) the first time
 * we read a user's playbook list, so they show up everywhere a playbook can be
 * picked — the Log Trade modal and the trade detail drawer.
 */
export const SYSTEM_PLAYBOOKS = [
  {
    name: "Invalid Trades",
    color: "#BE333D",
    description: "These are invalid trades for any reason at all.",
  },
] as const

/**
 * Ensure the current user has every system playbook. Inserts only the missing
 * ones (matched by name), so it's safe to call on every read. No-op when the
 * user already has them all, or when there's no signed-in user.
 */
export async function ensureSystemPlaybooks(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Team-wide check (RLS already scopes to the user's team) so we don't create
  // a duplicate "Invalid Trades" per teammate.
  const { data: existing } = await supabase.from("playbooks").select("name")
  const names = new Set((existing ?? []).map((p) => p.name))
  const missing = SYSTEM_PLAYBOOKS.filter((sp) => !names.has(sp.name))
  if (missing.length === 0) return

  await supabase.from("playbooks").insert(
    missing.map((sp) => ({
      user_id: user.id,
      name: sp.name,
      color: sp.color,
      description: sp.description,
    })),
  )
}

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
      if (isWin(pnl)) s.wins += 1
      else if (isLoss(pnl)) s.losses += 1
      if (t.closed_at) {
        s.closedSeries.push({ ts: new Date(t.closed_at).getTime(), pnl, r })
      }
    }
  })

  return (playbooks ?? []).map((p) => {
    const raw = byPlaybook.get(p.id) ?? emptyStats()
    const winRate = winRatePct(raw.wins, raw.losses)
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

