import "server-only"
import { createClient } from "@/lib/supabase/server"
import type { RiskRule } from "@/lib/risk-types"

export type { RiskRule } from "@/lib/risk-types"

export type Violation = {
  rule: "max_risk_pct" | "max_risk_usd" | "daily_loss_usd" | "daily_loss_pct" | "max_open_positions"
  message: string
}

export type RiskUsage = {
  dailyLossUsedUsd: number
  dailyLossLimitUsd: number | null
  dailyLossPct: number | null
  openPositions: number
  maxOpenPositions: number | null
}

export async function getRiskRules(accountId: string): Promise<RiskRule | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("risk_rules")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle()
  return data ?? null
}

export async function getAllRiskRules(): Promise<RiskRule[]> {
  const supabase = await createClient()
  const { data } = await supabase.from("risk_rules").select("*")
  return data ?? []
}

/**
 * Compute today's realized loss + open-position count for a given account.
 * Returns absolute USD values (loss is positive number).
 */
export async function getRiskUsage(accountId: string, rule: RiskRule | null = null): Promise<RiskUsage> {
  const supabase = await createClient()
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { data: closedToday } = await supabase
    .from("trades")
    .select("pnl")
    .eq("account_id", accountId)
    .eq("status", "closed")
    .gte("closed_at", startOfDay.toISOString())

  const lossSum = (closedToday ?? [])
    .map((t) => Number(t.pnl) || 0)
    .filter((p) => p < 0)
    .reduce((s, p) => s + Math.abs(p), 0)

  const { count: openCount } = await supabase
    .from("trades")
    .select("*", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("status", "open")

  // If a daily_loss_limit_pct is set, derive USD from the account equity.
  let dailyLossLimitUsd: number | null = rule?.daily_loss_limit_usd != null ? Number(rule.daily_loss_limit_usd) : null
  if (dailyLossLimitUsd == null && rule?.daily_loss_limit_pct != null) {
    const { data: account } = await supabase.from("accounts").select("equity").eq("id", accountId).maybeSingle()
    if (account) dailyLossLimitUsd = Number(account.equity) * (Number(rule.daily_loss_limit_pct) / 100)
  }

  return {
    dailyLossUsedUsd: Number(lossSum.toFixed(2)),
    dailyLossLimitUsd: dailyLossLimitUsd != null ? Number(dailyLossLimitUsd.toFixed(2)) : null,
    dailyLossPct: dailyLossLimitUsd != null && dailyLossLimitUsd > 0
      ? Number(((lossSum / dailyLossLimitUsd) * 100).toFixed(1))
      : null,
    openPositions: openCount ?? 0,
    maxOpenPositions: rule?.max_open_positions ?? null,
  }
}

/**
 * Pre-flight check: would this trade violate any active risk rules?
 * Returns an array of violations; an empty array means the trade is OK.
 */
export async function evaluateTrade(args: {
  accountId: string
  riskAmount: number | null
  status: "open" | "closed" | "cancelled"
}): Promise<Violation[]> {
  const rule = await getRiskRules(args.accountId)
  if (!rule || !rule.enabled) return []

  const supabase = await createClient()
  const { data: account } = await supabase
    .from("accounts")
    .select("equity")
    .eq("id", args.accountId)
    .maybeSingle()
  const equity = account ? Number(account.equity) : 0

  const violations: Violation[] = []

  if (args.riskAmount != null && args.riskAmount > 0) {
    if (rule.max_risk_per_trade_usd != null && args.riskAmount > Number(rule.max_risk_per_trade_usd)) {
      violations.push({
        rule: "max_risk_usd",
        message: `Risk $${args.riskAmount.toFixed(0)} exceeds the $${Number(rule.max_risk_per_trade_usd).toFixed(0)} per-trade cap.`,
      })
    }
    if (rule.max_risk_per_trade_pct != null && equity > 0) {
      const maxAllowed = equity * (Number(rule.max_risk_per_trade_pct) / 100)
      if (args.riskAmount > maxAllowed) {
        violations.push({
          rule: "max_risk_pct",
          message: `Risk $${args.riskAmount.toFixed(0)} exceeds ${rule.max_risk_per_trade_pct}% of account equity ($${maxAllowed.toFixed(0)}).`,
        })
      }
    }
  }

  // Open-position cap (only for new opens, not closes).
  if (args.status === "open" && rule.max_open_positions != null) {
    const usage = await getRiskUsage(args.accountId, rule)
    if (usage.openPositions >= rule.max_open_positions) {
      violations.push({
        rule: "max_open_positions",
        message: `You already have ${usage.openPositions} open positions; the cap is ${rule.max_open_positions}.`,
      })
    }
  }

  // Daily-loss limit blocks new opens once the limit is hit.
  if (args.status === "open") {
    const usage = await getRiskUsage(args.accountId, rule)
    if (usage.dailyLossLimitUsd != null && usage.dailyLossUsedUsd >= usage.dailyLossLimitUsd) {
      violations.push({
        rule: "daily_loss_usd",
        message: `Daily loss limit hit ($${usage.dailyLossUsedUsd.toFixed(0)} of $${usage.dailyLossLimitUsd.toFixed(0)}). Stop trading until tomorrow.`,
      })
    }
  }

  return violations
}

/**
 * Derive simple behavioral signals from the user's recent trades + journal.
 * These are heuristics for the Risk page UI — not enforcement.
 */
export type BehavioralSignal = {
  key: string
  title: string
  level: "good" | "watch" | "high"
  desc: string
  icon: string
}

export async function getBehavioralSignals(): Promise<BehavioralSignal[]> {
  const supabase = await createClient()
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); sevenDaysAgo.setHours(0, 0, 0, 0)

  const [{ data: todayClosed }, { data: recentClosed }, { data: recentEntries }] = await Promise.all([
    supabase.from("trades").select("pnl, opened_at, playbook_id").eq("status", "closed").gte("closed_at", startOfDay.toISOString()),
    supabase.from("trades").select("pnl, opened_at, playbook_id, risk_amount").eq("status", "closed").gte("closed_at", sevenDaysAgo.toISOString()).order("closed_at", { ascending: false }),
    supabase.from("journal_entries").select("rule_break, created_at").gte("created_at", sevenDaysAgo.toISOString()),
  ])

  const signals: BehavioralSignal[] = []

  // 1. Revenge trade risk: count today's losses
  const todayLosses = (todayClosed ?? []).filter((t) => Number(t.pnl) < 0).length
  signals.push({
    key: "revenge",
    title: "Revenge trade risk",
    level: todayLosses >= 3 ? "high" : todayLosses >= 2 ? "watch" : "good",
    desc: todayLosses === 0
      ? "No losses today — clean slate."
      : todayLosses === 1
        ? "1 loss today — well below tilt threshold."
        : `${todayLosses} losses today — be deliberate, take a break if needed.`,
    icon: "flame",
  })

  // 2. Setup adherence (% of recent trades tagged with a playbook)
  const recent = recentClosed ?? []
  const tagged = recent.filter((t) => t.playbook_id != null).length
  const adherencePct = recent.length > 0 ? Math.round((tagged / recent.length) * 100) : null
  signals.push({
    key: "adherence",
    title: "Setup adherence",
    level: adherencePct == null ? "good" : adherencePct >= 80 ? "good" : adherencePct >= 50 ? "watch" : "high",
    desc: adherencePct == null
      ? "Log a few trades to see setup adherence."
      : `${adherencePct}% of last 7 days' trades match a documented playbook.`,
    icon: "info",
  })

  // 3. Position sizing drift: compare avg risk last 3 to last 14 trades
  const sized = recent.filter((t) => t.risk_amount != null && Number(t.risk_amount) > 0)
  let sizeLevel: "good" | "watch" | "high" = "good"
  let sizeDesc = "Position sizing looks consistent."
  if (sized.length >= 5) {
    const last3 = sized.slice(0, 3).map((t) => Number(t.risk_amount))
    const baseline = sized.slice(3).map((t) => Number(t.risk_amount))
    const avg3 = last3.reduce((s, x) => s + x, 0) / last3.length
    const avgBase = baseline.length > 0 ? baseline.reduce((s, x) => s + x, 0) / baseline.length : avg3
    const drift = avgBase > 0 ? (avg3 - avgBase) / avgBase : 0
    if (drift > 0.4) {
      sizeLevel = "high"
      sizeDesc = `Last 3 trades risked ~${Math.round(drift * 100)}% above your baseline.`
    } else if (drift > 0.2) {
      sizeLevel = "watch"
      sizeDesc = `Last 3 trades sized ~${Math.round(drift * 100)}% above baseline — keep an eye on it.`
    } else {
      sizeDesc = `Last 3 trades sized within ${Math.round(Math.abs(drift) * 100)}% of baseline.`
    }
  }
  signals.push({
    key: "sizing",
    title: "Position sizing drift",
    level: sizeLevel,
    desc: sizeDesc,
    icon: "target",
  })

  // 4. Rule-break rate (last 7 days)
  const entries = recentEntries ?? []
  const breaks = entries.filter((e) => e.rule_break).length
  const breakPct = entries.length > 0 ? Math.round((breaks / entries.length) * 100) : null
  signals.push({
    key: "rules",
    title: "Rules followed (7d)",
    level: breakPct == null ? "good" : breakPct === 0 ? "good" : breakPct < 20 ? "watch" : "high",
    desc: breakPct == null
      ? "Tag a journal entry with rule breaks to track this."
      : breakPct === 0
        ? "100% rules followed across recent entries."
        : `${breakPct}% of recent entries had rule breaks logged.`,
    icon: "lightning",
  })

  return signals
}

/**
 * Aggregate live exposure across all open trades for a user, optionally
 * scoped to a single account.
 */
export async function getOpenExposure(accountId?: string | null): Promise<{
  rows: Array<{
    id: string
    pair: string
    side: string
    size: number
    risk: number
    stop: number | null
    entry: number
    account_id: string
  }>
  totalRisk: number
}> {
  const supabase = await createClient()
  let q = supabase
    .from("trades")
    .select("id, pair, side, size, risk_amount, stop_price, entry_price, account_id")
    .eq("status", "open")
    .order("opened_at", { ascending: false })
  if (accountId) q = q.eq("account_id", accountId)
  const { data } = await q
  const rows = (data ?? []).map((t) => ({
    id: t.id,
    pair: t.pair,
    side: t.side,
    size: Number(t.size) || 0,
    risk: Number(t.risk_amount) || 0,
    stop: t.stop_price != null ? Number(t.stop_price) : null,
    entry: Number(t.entry_price) || 0,
    account_id: t.account_id,
  }))
  const totalRisk = rows.reduce((s, r) => s + r.risk, 0)
  return { rows, totalRisk }
}
