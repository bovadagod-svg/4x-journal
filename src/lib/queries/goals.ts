import "server-only"
import { createClient } from "@/lib/supabase/server"
import { getCurrentScope } from "./scope"
import type { GoalRow, PeriodActuals, PeriodWindow } from "@/lib/goals/metadata"

// Re-export so existing call sites that import from "@/lib/queries/goals" keep working.
// Client code should import directly from "@/lib/goals/metadata".
export type { GoalPeriod, GoalMetric, MetricMeta, GoalRow, PeriodWindow, PeriodActuals } from "@/lib/goals/metadata"
export {
  GOAL_METRICS,
  PERIOD_LABELS,
  weekOf,
  monthOf,
  quarterOf,
  periodWindow,
  recentPeriods,
  actualForMetric,
} from "@/lib/goals/metadata"

/**
 * Compute every actual we need for goal evaluation in one shot. Reads
 * trades + journal entries scoped to the user's account scope filter, plus
 * the current account balances for the % return baseline.
 */
export async function getPeriodActuals(window: PeriodWindow): Promise<PeriodActuals> {
  const supabase = await createClient()
  const scope = await getCurrentScope()

  let q = supabase
    .from("trades")
    .select("id, pnl, r, pair, side, entry_price, exit_price, closed_at")
    .eq("status", "closed")
    .gte("closed_at", window.start.toISOString())
    .lt("closed_at", window.end.toISOString())
    .order("closed_at", { ascending: true })
  if (scope !== "all") q = q.eq("account_id", scope)
  const { data: trades } = await q
  const closed = trades ?? []

  const wins = closed.filter((t) => Number(t.pnl) > 0)
  const losses = closed.filter((t) => Number(t.pnl) < 0)
  const pnl = closed.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  const totalR = closed.reduce((s, t) => s + (Number(t.r) || 0), 0)
  const grossWins = wins.reduce((s, t) => s + Number(t.pnl), 0)
  const grossLosses = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0))

  const { realizedPips } = await import("@/lib/pip")
  const totalPips = closed.reduce((s, t) => {
    const p = realizedPips({
      side: t.side === "long" ? "long" : "short",
      entry: Number(t.entry_price),
      exit: t.exit_price != null ? Number(t.exit_price) : null,
      pair: t.pair,
    })
    return s + (p ?? 0)
  }, 0)

  let ruleBreaks = 0
  if (closed.length > 0) {
    const { data: entries } = await supabase
      .from("journal_entries")
      .select("trade_id, rule_break")
      .in("trade_id", closed.map((t) => t.id))
      .eq("rule_break", true)
    ruleBreaks = (entries ?? []).length
  }

  let balQ = supabase.from("accounts").select("balance, equity")
  if (scope !== "all") balQ = balQ.eq("id", scope)
  const { data: accs } = await balQ
  const currentBalance = (accs ?? []).reduce((s, a) => s + (Number(a.balance) || 0), 0)
  const startingBalance = currentBalance - pnl

  let runningPnl = 0
  let peak = 0
  let maxDD = 0
  for (const t of closed) {
    runningPnl += Number(t.pnl) || 0
    if (runningPnl > peak) peak = runningPnl
    const ddDollars = peak - runningPnl
    const denom = startingBalance + peak
    if (denom > 0) {
      const ddPct = (ddDollars / denom) * 100
      if (ddPct > maxDD) maxDD = ddPct
    }
  }

  return {
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    pnl: Number(pnl.toFixed(2)),
    totalR: Number(totalR.toFixed(2)),
    totalPips: Number(totalPips.toFixed(1)),
    grossWins: Number(grossWins.toFixed(2)),
    grossLosses: Number(grossLosses.toFixed(2)),
    ruleBreaks,
    startingBalance: Number(startingBalance.toFixed(2)),
    currentBalance: Number(currentBalance.toFixed(2)),
    maxDrawdownPct: Number(maxDD.toFixed(2)),
  }
}

export async function getUserGoals(): Promise<GoalRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("goals")
    .select("*")
    .order("period", { ascending: true })
    .order("metric", { ascending: true })
  return data ?? []
}
