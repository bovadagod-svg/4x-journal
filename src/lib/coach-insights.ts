/**
 * Deterministic Coach insights.
 *
 * Pure functions — no API calls, no I/O. Used as the Coach widget's data
 * source when the user has the AI toggle off OR ANTHROPIC_API_KEY is missing.
 *
 * Output shape matches the AI payload exactly (`{observations, suggestions}`)
 * so the widget renders identically — the user sees the same bullets and
 * action chips, just computed from arithmetic instead of an LLM.
 *
 * Inputs are intentionally permissive — the action layer will pass whatever
 * fields it has; missing fields just suppress the relevant insight.
 */

import type { CoachInsightsPayload, CoachSuggestion } from "@/lib/actions/coach"

export type DetTrade = {
  pair: string
  side: "long" | "short" | string
  r: number | null
  pnl: number | null
  opened_at: string | null
  closed_at: string | null
}

export type DetEntry = {
  trade_id: string | null
  rule_break: boolean
}

export function deterministicInsights(args: {
  trades: DetTrade[]
  entries?: DetEntry[]
  /** Trade ID lookup so we can correlate journal-entry rule_break flags with their trades. */
  tradeIdByTrade?: (t: DetTrade) => string | null
}): CoachInsightsPayload {
  const trades = args.trades.filter((t) => t.r != null && t.pnl != null && t.closed_at)

  // Below-sample-threshold case — return the same friendly message the AI path uses.
  if (trades.length < 5) {
    return {
      observations: [
        `Only ${trades.length} closed trade${trades.length === 1 ? "" : "s"} in the last 30 days — log a few more and I'll surface what's working.`,
      ],
      suggestions: [],
    }
  }

  const observations: string[] = []
  const suggestions: CoachSuggestion[] = []

  const wins = trades.filter((t) => Number(t.pnl) > 0)
  const losses = trades.filter((t) => Number(t.pnl) < 0)
  const winRate = (wins.length / trades.length) * 100
  const avgR = trades.reduce((s, t) => s + Number(t.r), 0) / trades.length
  const totalPnl = trades.reduce((s, t) => s + Number(t.pnl), 0)
  const grossWin = wins.reduce((s, t) => s + Number(t.pnl), 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.pnl), 0))
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0
  const expectancy = avgR  // R-units per trade

  // Insight 1: aggregate snapshot. Always included — it's the headline.
  observations.push(formatHeadline({
    count: trades.length,
    winRate,
    expectancy,
    totalPnl,
    profitFactor,
  }))

  // Insight 2: best pair (when there's a clear winner with ≥3 trades)
  const byPair = groupBy(trades, (t) => t.pair)
  const pairAgg = Array.from(byPair.entries())
    .map(([pair, ts]) => ({
      pair,
      count: ts.length,
      pnl: ts.reduce((s, t) => s + Number(t.pnl), 0),
      wr: (ts.filter((t) => Number(t.pnl) > 0).length / ts.length) * 100,
      avgR: ts.reduce((s, t) => s + Number(t.r), 0) / ts.length,
    }))
    .filter((p) => p.count >= 3)

  const bestPair = [...pairAgg].sort((a, b) => b.pnl - a.pnl)[0]
  if (bestPair && bestPair.pnl > 0) {
    observations.push(
      `Your best pair is ${bestPair.pair}: ${bestPair.count} trades, ${Math.round(bestPair.wr)}% win rate, ${formatRSum(bestPair.avgR * bestPair.count)} cumulative.`,
    )
  }

  // Insight 3: worst pair (only if it's materially leaking — losing money + ≥3 trades)
  const worstPair = [...pairAgg].sort((a, b) => a.pnl - b.pnl)[0]
  if (worstPair && worstPair.pnl < 0 && worstPair.pair !== bestPair?.pair) {
    observations.push(
      `${worstPair.pair} is the leak: ${worstPair.count} trades, ${Math.round(worstPair.wr)}% win rate, ${formatRSum(worstPair.avgR * worstPair.count)} cumulative.`,
    )
    if (worstPair.wr < 35 || worstPair.avgR < -0.3) {
      suggestions.push({
        action: `Pause ${worstPair.pair} until the pattern recovers.`,
        basis: `${worstPair.count} trades at ${Math.round(worstPair.wr)}% WR with ${formatR(worstPair.avgR)} expectancy. The math is against you on this one.`,
        severity: "warn",
      })
    }
  }

  // Insight 4: long vs short bias (only when there's a meaningful spread)
  const sideBias = computeSideBias(trades)
  if (sideBias) observations.push(sideBias)

  // Insight 5: day-of-week edge (only when the worst day is materially negative)
  const dowLeak = computeDowLeak(trades)
  if (dowLeak) {
    observations.push(dowLeak.observation)
    if (dowLeak.suggestion) suggestions.push(dowLeak.suggestion)
  }

  // Insight 6: recent-streak drift (last 10 vs all-time)
  const drift = computeStreakDrift(trades)
  if (drift) {
    observations.push(drift.observation)
    if (drift.suggestion) suggestions.push(drift.suggestion)
  }

  // Insight 7: rule-break impact (when entries are provided)
  if (args.entries && args.tradeIdByTrade) {
    const ruleBreak = computeRuleBreakImpact(trades, args.entries, args.tradeIdByTrade)
    if (ruleBreak) {
      observations.push(ruleBreak.observation)
      if (ruleBreak.suggestion) suggestions.push(ruleBreak.suggestion)
    }
  }

  // Trim to keep payload roughly matching the AI prompt's contract (2-3 obs, 1-3 suggestions)
  return {
    observations: observations.slice(0, 4),
    suggestions: suggestions.slice(0, 3),
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────

function formatHeadline(s: {
  count: number
  winRate: number
  expectancy: number
  totalPnl: number
  profitFactor: number
}): string {
  const tone = s.totalPnl >= 0 ? "in the green" : "underwater"
  const pf = isFinite(s.profitFactor)
    ? s.profitFactor.toFixed(2)
    : s.profitFactor > 0 ? "∞" : "0"
  return `${s.count} closed trades · ${Math.round(s.winRate)}% win rate · ${formatR(s.expectancy)} expectancy · profit factor ${pf}. You're ${tone} at ${formatUsd(s.totalPnl, true)}.`
}

function computeSideBias(trades: DetTrade[]): string | null {
  const longs = trades.filter((t) => t.side === "long")
  const shorts = trades.filter((t) => t.side === "short")
  if (longs.length < 5 || shorts.length < 5) return null
  const longWr = (longs.filter((t) => Number(t.pnl) > 0).length / longs.length) * 100
  const shortWr = (shorts.filter((t) => Number(t.pnl) > 0).length / shorts.length) * 100
  const delta = longWr - shortWr
  if (Math.abs(delta) < 15) return null
  if (delta > 0) {
    return `Long bias is paying off: longs ${Math.round(longWr)}% WR vs shorts ${Math.round(shortWr)}% — ${Math.round(delta)}pp gap.`
  }
  return `Shorts are working better: shorts ${Math.round(shortWr)}% WR vs longs ${Math.round(longWr)}% — ${Math.round(-delta)}pp gap.`
}

function computeDowLeak(trades: DetTrade[]): { observation: string; suggestion?: CoachSuggestion } | null {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const byDay = new Map<number, DetTrade[]>()
  for (const t of trades) {
    if (!t.opened_at) continue
    const d = new Date(t.opened_at).getUTCDay()
    let arr = byDay.get(d); if (!arr) { arr = []; byDay.set(d, arr) }
    arr.push(t)
  }
  const dayAgg = Array.from(byDay.entries())
    .filter(([, ts]) => ts.length >= 3)
    .map(([d, ts]) => ({
      day: d,
      count: ts.length,
      wr: (ts.filter((t) => Number(t.pnl) > 0).length / ts.length) * 100,
      pnl: ts.reduce((s, t) => s + Number(t.pnl), 0),
    }))
  if (dayAgg.length === 0) return null
  const worst = [...dayAgg].sort((a, b) => a.pnl - b.pnl)[0]
  if (worst.pnl >= 0 || worst.wr >= 40) return null
  const observation = `${dayNames[worst.day]}s are the worst day: ${worst.count} trades, ${Math.round(worst.wr)}% WR, ${formatUsd(worst.pnl, true)}.`
  const suggestion: CoachSuggestion | undefined =
    worst.wr < 30 || worst.pnl < -200
      ? {
          action: `Cut ${dayNames[worst.day]} trading or trade smaller until the pattern flips.`,
          basis: `${worst.count} ${dayNames[worst.day]} trades, ${Math.round(worst.wr)}% WR, ${formatUsd(worst.pnl, true)} cumulative.`,
          severity: "warn",
        }
      : undefined
  return { observation, suggestion }
}

function computeStreakDrift(trades: DetTrade[]): { observation: string; suggestion?: CoachSuggestion } | null {
  if (trades.length < 15) return null
  const sorted = [...trades].sort((a, b) =>
    new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime(),
  )
  const last10 = sorted.slice(-10)
  const last10Wr = (last10.filter((t) => Number(t.pnl) > 0).length / 10) * 100
  const allWr = (sorted.filter((t) => Number(t.pnl) > 0).length / sorted.length) * 100
  const delta = last10Wr - allWr
  if (delta < -20) {
    return {
      observation: `Recent drift: last 10 trades ${Math.round(last10Wr)}% WR vs ${Math.round(allWr)}% over 30 days — ${Math.round(-delta)}pp drop.`,
      suggestion: {
        action: "Cut size in half until the next 10 trades land back near your baseline WR.",
        basis: `Last 10 closed at ${Math.round(last10Wr)}% vs ${Math.round(allWr)}% over the prior period — sample is small but the drop is real.`,
        severity: "warn",
      },
    }
  }
  if (delta > 20) {
    return {
      observation: `Hot streak: last 10 trades ${Math.round(last10Wr)}% WR vs ${Math.round(allWr)}% over 30 days. Don't size up off the streak alone.`,
    }
  }
  return null
}

function computeRuleBreakImpact(
  trades: DetTrade[],
  entries: DetEntry[],
  tradeIdByTrade: (t: DetTrade) => string | null,
): { observation: string; suggestion?: CoachSuggestion } | null {
  const ruleBreakIds = new Set(entries.filter((e) => e.rule_break && e.trade_id).map((e) => e.trade_id!))
  if (ruleBreakIds.size === 0) return null

  const rb = trades.filter((t) => {
    const id = tradeIdByTrade(t); return id ? ruleBreakIds.has(id) : false
  })
  const rf = trades.filter((t) => {
    const id = tradeIdByTrade(t); return id ? !ruleBreakIds.has(id) : true
  })
  if (rb.length < 3 || rf.length < 3) return null

  const rbPnl = rb.reduce((s, t) => s + Number(t.pnl), 0)
  const rfPnl = rf.reduce((s, t) => s + Number(t.pnl), 0)
  const observation = `Rule-break trades: ${rb.length} for ${formatUsd(rbPnl, true)}. Rule-followed: ${rf.length} for ${formatUsd(rfPnl, true)}.`
  const suggestion: CoachSuggestion | undefined =
    rbPnl < 0 && rbPnl < rfPnl - 100
      ? {
          action: "Cool-down for 1 hour after any rule-break trade before placing the next one.",
          basis: `Rule-breaks lost ${formatUsd(rbPnl, true)} this period vs ${formatUsd(rfPnl, true)} on rule-followed. Discipline is the lever.`,
          severity: "warn",
        }
      : undefined
  return { observation, suggestion }
}

function groupBy<T, K>(arr: T[], keyFn: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const x of arr) {
    const k = keyFn(x)
    let arr2 = m.get(k); if (!arr2) { arr2 = []; m.set(k, arr2) }
    arr2.push(x)
  }
  return m
}

function formatR(r: number): string {
  if (!isFinite(r)) return "—"
  const sign = r > 0 ? "+" : ""
  return `${sign}${r.toFixed(2)}R`
}
function formatRSum(r: number): string { return formatR(r) }
function formatUsd(n: number, signed = false): string {
  const sign = signed && n > 0 ? "+" : ""
  return `${sign}${n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
