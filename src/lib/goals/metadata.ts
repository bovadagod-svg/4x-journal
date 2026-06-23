/**
 * Pure metadata for the Goals feature — types, constants, period boundary
 * math. No Supabase / no server-only imports, so client components can
 * safely import from here.
 */

import type { Database } from "@/lib/supabase/database.types"

export type GoalRow = Database["public"]["Tables"]["goals"]["Row"]

export type GoalPeriod = "weekly" | "monthly" | "quarterly"

export type GoalMetric =
  | "pnl_pct" | "pnl_dollars"
  | "win_rate" | "avg_r" | "avg_pips" | "profit_factor"
  | "rules_followed_pct" | "max_rule_breaks" | "max_drawdown_pct"
  | "min_trade_count"

export type MetricMeta = {
  metric: GoalMetric
  label: string
  unit: "%" | "$" | "R" | "pips" | "count"
  direction: "higher" | "lower"
  symmetricBar: boolean
  description: string
}

export const GOAL_METRICS: MetricMeta[] = [
  { metric: "pnl_pct",            label: "P&L (% of starting balance)", unit: "%", direction: "higher", symmetricBar: true,  description: "Net realized return for the period as a % of the balance at period start." },
  { metric: "pnl_dollars",        label: "P&L (dollars)",                unit: "$", direction: "higher", symmetricBar: true,  description: "Net realized P&L in dollars for the period." },
  { metric: "win_rate",           label: "Win rate",                     unit: "%", direction: "higher", symmetricBar: false, description: "Profitable share of decisive trades (wins ÷ wins + losses). Breakevens (±$100) are excluded." },
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
  start: Date
  end: Date
  label: string
  key: string
}

export function weekOf(d: Date): PeriodWindow {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dow = x.getUTCDay()
  const offset = dow === 0 ? -6 : 1 - dow
  x.setUTCDate(x.getUTCDate() + offset)
  const start = new Date(x)
  const end = new Date(x); end.setUTCDate(end.getUTCDate() + 7)
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
  const startOfYear = Date.UTC(weekStart.getUTCFullYear(), 0, 1)
  const days = Math.floor((weekStart.getTime() - startOfYear) / 86_400_000)
  const week = Math.floor(days / 7) + 1
  return `${weekStart.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

// ── PeriodActuals + actualForMetric (pure) ───────────────────────────────

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
  startingBalance: number
  currentBalance: number
  maxDrawdownPct: number
}

export function actualForMetric(metric: GoalMetric, actuals: PeriodActuals): number | null {
  switch (metric) {
    case "pnl_dollars":         return actuals.pnl
    case "pnl_pct":
      return actuals.startingBalance > 0
        ? Number(((actuals.pnl / actuals.startingBalance) * 100).toFixed(2))
        : null
    case "win_rate": {
      // Win rate excludes breakevens: wins / (wins + losses).
      const decisive = actuals.wins + actuals.losses
      return decisive > 0
        ? Number(((actuals.wins / decisive) * 100).toFixed(1))
        : null
    }
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
