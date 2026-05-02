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
