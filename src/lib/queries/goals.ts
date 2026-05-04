import { createClient } from "@/lib/supabase/server"
import { getCurrentScope } from "./scope"
import type { Database } from "@/lib/supabase/database.types"

export type GoalRow = Database["public"]["Tables"]["goals"]["Row"]

export type GoalPeriod = "weekly" | "monthly" | "quarterly"

export type GoalMetric =
  | "pnl_pct" | "pnl_dollars"
  | "win_rate" | "avg_r" | "avg_pips" | "profit_factor"
  | "rules_followed_pct" | "max_rule_breaks" | "max_drawdown_pct"
  | "min_trade_count"

/**
 * Catalog of metric options exposed in the Settings → Goals panel and the
 * Goals page. `direction = "higher"` means the actual must be ≥ target to
 * pass; `"lower"` means it must be ≤ target (drawdown caps, max rule breaks).
 */
export type MetricMeta = {
  metric: GoalMetric
  label: string
  unit: "%" | "$" | "R" | "pips" | "count"
  direction: "higher" | "lower"
  /** When the bar should anchor at the user's starting balance (P&L only). */
  symmetricBar: boolean
  description: string
}

export const GOAL_METRICS: MetricMeta[] = [
  { metric: "pnl_pct",            label: "P&L (% of starting balance)", unit: "%", direction: "higher", symmetricBar: true,  description: "Net realized return for the period as a % of the balance at period start." },
  { metric: "pnl_dollars",        label: "P&L (dollars)",                unit: "$", direction: "higher", symmetricBar: true,  description: "Net realized P&L in dollars for the period." },
  { metric: "win_rate",           label: "Win rate",                     unit: "%", direction: "higher", symmetricBar: false, description: "Percent of closed trades that were profitable." },
  { metric: "avg_r",              label: "Average R per trade",          unit: "R", direction: "higher", symmetricBar: false, description: "Mean R-multiple across closed trades." },
  { metric: "avg_pips",           label: "Average pips per trade",       unit: "pips", direction: "higher", symmetricBar: false, description: "Mean realized pips across closed trades." },
  { metric: "profit_factor",      label: "Profit factor",                unit: "count", direction: "higher", symmetricBar: false, description: "Gross wins ÷ gross losses. ≥ 1.5 is healthy." },
  { metric: "rules_followed_pct", label: "Rules-followed %",             unit: "%", direction: "higher", symmetricBar: false, description: "Percent of closed trades without a rule_break flag." },
  { metric: "max_rule_breaks",    label: "Max rule breaks",              unit: "count", direction: "lower", symmetricBar: false, description: "Cap on rule-break count for the period." },
  { metric: "max_drawdown_pct",   label: "Max drawdown %",               unit: "%", direction: "lower", symmetricBar: false, description: "Cap on peak-to-trough drawdown during the period." },
  { metric: "min_trade_count",    label: "Min trades taken",             unit: "count", direction: "higher", symmetricBar: false, description: "Minimum closed trades to log this period (consistency target)." },
]

export const PERIOD_LABELS: Record<GoalPeriod, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
}

// ── Period boundaries ────────────────────────────────────────────────────

export type PeriodWindow = {
  start: Date     // inclusive
  end: Date       // exclusive (next period's start)
  label: string   // "Week of Mar 9, 2026" / "March 2026" / "Q1 2026"
  key: string     // "2026-W11" / "2026-03" / "2026-Q1"
}

/** Monday-aligned week containing the given timestamp (UTC). */
export function weekOf(d: Date): PeriodWindow {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = x.getUTCDay()                       // 0=Sun..6=Sat
  const offset = dow === 0 ? -6 : 1 - dow         // back to Monday
  x.setUTCDate(x.getUTCDate() + offset)
  const start = new Date(x)
  const end = new Date(x); end.setUTCDate(end.getUTCDate() + 7)
  // ISO week label is overkill; "Week of …" reads better in cards.
  const label = `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
  const key = isoWeekKey(start)
  return { start, end, label, key }
}

export function monthOf(d: Date): PeriodWindow {
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`
  return { start, end, label, key }
}

export function quarterOf(d: Date): PeriodWindow {
  const q = Math.floor(d.getUTCMonth() / 3)
  const start = new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1))
  const end = new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 1))
  const label = `Q${q + 1} ${start.getUTCFullYear()}`
  const key = `${start.getUTCFullYear()}-Q${q + 1}`
  return { start, end, label, key }
}

export function periodWindow(period: GoalPeriod, asOf: Date = new Date()): PeriodWindow {
  return period === "weekly" ? weekOf(asOf)
    : period === "monthly" ? monthOf(asOf)
    : quarterOf(asOf)
}

/** Generate the past N period windows ending with the current period (newest last). */
export function recentPeriods(period: GoalPeriod, n: number): PeriodWindow[] {
  const out: PeriodWindow[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const offset = new Date(now)
    if (period === "weekly")    offset.setUTCDate(offset.getUTCDate() - i * 7)
    if (period === "monthly")   offset.setUTCMonth(offset.getUTCMonth() - i)
    if (period === "quarterly") offset.setUTCMonth(offset.getUTCMonth() - i * 3)
    out.push(periodWindow(period, offset))
  }
  return out
}

function isoWeekKey(weekStart: Date): string {
  // ISO week number relative to Jan 1 — simplistic but stable per user's locale UTC.
  const startOfYear = Date.UTC(weekStart.getUTCFullYear(), 0, 1)
  const days = Math.floor((weekStart.getTime() - startOfYear) / 86_400_000)
  const week = Math.floor(days / 7) + 1
  return `${weekStart.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

// ── Period actuals ───────────────────────────────────────────────────────

export type PeriodActuals = {
  closedTrades: number
  wins: number
  losses: number
  pnl: number
  totalR: number
  totalPips: number
  grossWins: number
  grossLosses: number
  ruleBreaks: number
  // For pnl_pct + max_drawdown_pct.
  startingBalance: number
  currentBalance: number
  /** Peak-to-trough drawdown % over the period (peak walking the chronological pnl curve). */
  maxDrawdownPct: number
}

/**
 * Compute every actual we need for goal evaluation in one shot. Reads
 * trades + journal entries scoped to the user's account scope filter, plus
 * the current account balances for the % return baseline.
 */
export async function getPeriodActuals(window: PeriodWindow): Promise<PeriodActuals> {
  const supabase = await createClient()
  const scope = await getCurrentScope()

  // 1. closed trades in window
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

  // Pip totals via realizedPips for each trade. Lazy-import to keep server bundle lean.
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

  // 2. rule-break count (journal_entries for trades in this window)
  let ruleBreaks = 0
  if (closed.length > 0) {
    const { data: entries } = await supabase
      .from("journal_entries")
      .select("trade_id, rule_break")
      .in("trade_id", closed.map((t) => t.id))
      .eq("rule_break", true)
    ruleBreaks = (entries ?? []).length
  }

  // 3. balances. Use current account equity as today's snapshot; subtract
  //    period pnl to estimate balance at period start (assumes no
  //    deposits/withdrawals — best we can do without a balance ledger).
  let balQ = supabase.from("accounts").select("balance, equity")
  if (scope !== "all") balQ = balQ.eq("id", scope)
  const { data: accs } = await balQ
  const currentBalance = (accs ?? []).reduce((s, a) => s + (Number(a.balance) || 0), 0)
  const startingBalance = currentBalance - pnl

  // 4. peak-to-trough drawdown over the chronological cumulative-pnl curve.
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

/**
 * Convert raw period actuals into the value for a specific metric.
 */
export function actualForMetric(metric: GoalMetric, actuals: PeriodActuals): number | null {
  switch (metric) {
    case "pnl_dollars":         return actuals.pnl
    case "pnl_pct":
      return actuals.startingBalance > 0
        ? Number(((actuals.pnl / actuals.startingBalance) * 100).toFixed(2))
        : null
    case "win_rate":
      return actuals.closedTrades > 0
        ? Number(((actuals.wins / actuals.closedTrades) * 100).toFixed(1))
        : null
    case "avg_r":
      return actuals.closedTrades > 0
        ? Number((actuals.totalR / actuals.closedTrades).toFixed(2))
        : null
    case "avg_pips":
      return actuals.closedTrades > 0
        ? Number((actuals.totalPips / actuals.closedTrades).toFixed(1))
        : null
    case "profit_factor":
      return actuals.grossLosses > 0
        ? Number((actuals.grossWins / actuals.grossLosses).toFixed(2))
        : actuals.grossWins > 0 ? 99 : null
    case "rules_followed_pct":
      return actuals.closedTrades > 0
        ? Number((((actuals.closedTrades - actuals.ruleBreaks) / actuals.closedTrades) * 100).toFixed(1))
        : null
    case "max_rule_breaks":     return actuals.ruleBreaks
    case "max_drawdown_pct":    return actuals.maxDrawdownPct
    case "min_trade_count":     return actuals.closedTrades
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────

export async function getUserGoals(): Promise<GoalRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("goals")
    .select("*")
    .order("period", { ascending: true })
    .order("metric", { ascending: true })
  return data ?? []
}
