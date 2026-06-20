"use server"

import Anthropic from "@anthropic-ai/sdk"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { deterministicInsights } from "@/lib/coach-insights"
import { getOverallStats, getPairPerformance, type OverallStats } from "@/lib/queries/analytics"
import { getCurrentScope } from "@/lib/queries/scope"
import { formatUSD } from "@/lib/finance"

/**
 * Coach insights: produces 2-3 observations + 1-3 suggestions on the user's
 * last 30 days of closed trades + journal entries.
 *
 * Two modes, decided by `user_settings.coach_use_ai` + `ANTHROPIC_API_KEY`:
 *
 *   1. "ai" — sends the dataset to Claude haiku, parses the JSON response.
 *      Used when `coach_use_ai = true` (the default) AND the env var is set.
 *
 *   2. "deterministic" — runs `deterministicInsights()` over the same dataset
 *      and produces the same `{observations, suggestions}` shape from pure
 *      arithmetic. Used when the toggle is off OR the key is missing. The
 *      widget renders both modes identically.
 *
 * Cache: keyed by user_id + day + mode so toggling the setting regenerates.
 */

export type CoachSuggestion = {
  action: string             // imperative: "Stop shorts on EUR/USD"
  basis: string              // why: "WR 28% over 11 trades, expectancy −0.4R"
  severity: "info" | "warn"  // warn = high-impact pattern; info = nice-to-have
}

export type CoachStat = { label: string; value: string; tone?: "good" | "bad" | "neutral" }

export type CoachInsightsPayload = {
  /** One/two-sentence overview of the current view. */
  headline?: string
  /** Key numbers for the view, rendered as a stat grid. */
  stats?: CoachStat[]
  /** What's working — edges, discipline wins. */
  positives?: string[]
  /** Leaks, risks, things to watch out for. */
  watchouts?: string[]
  /** Anything else worth noting. */
  notable?: string[]
  /** Legacy flat list (weekly retro + back-compat). */
  observations: string[]
  /** Prescriptive — what to actually do about it. */
  suggestions: CoachSuggestion[]
}

export type CoachState =
  | { ok: true; payload: CoachInsightsPayload; generatedAt: string; cached: boolean }
  | { ok: false; error: string; configured: boolean }

export type CoachRange = { from?: string | null; to?: string | null }

const SYSTEM_PROMPT = `You are a Coach AI writing a Forex trader's DAILY BRIEF on their journal. You receive a JSON dataset scoped to EXACTLY the view the trader is currently looking at (a date range + account selection). Everything you say must pertain to that scoped data only.

The dataset includes pre-computed performance numbers (win rate, profit factor, expectancy, avg R, drawdown), breakdowns by side / weekday / mood / pair, discipline (rule-break rate, common mistakes), the current win/loss streak, open positions with risk, and a sample of recent trades with journal text.

Write a thorough, multi-part brief. Output a JSON object with these fields:

  headline: ONE punchy sentence summarizing how this view is going (cite the headline number, e.g. net P&L + win rate).

  positives[]: 2-4 bullets — what is WORKING. Edges, profitable pairs/sides/sessions, discipline wins. Each cites a concrete number.

  watchouts[]: 2-4 bullets — LEAKS and RISKS to watch. Losing pairs/sides, drawdown, rule-breaks, tilt patterns, over-exposure on open positions. Honest, no sugar-coating. Each cites a number.

  notable[]: 1-3 bullets — anything else worth noting that isn't clearly positive or negative (a streak, a mood correlation, a concentration, a sample-size caveat).

  suggestions[]: 1-3 prescriptive actions. Each is an object:
    - action: imperative sentence ("Stop shorts on EUR/USD until WR climbs above 40%")
    - basis: one-sentence justification citing the data
    - severity: "warn" when it materially hurts P&L; "info" otherwise

Rules:
  - Cite real numbers from the dataset in EVERY bullet. Never be generic.
  - Do NOT predict markets or give trade ideas.
  - If the sample is small (<10 trades), say so in notable[] and keep claims tentative.
  - Be specific and useful — the trader has all this data; tell them what it MEANS.

Format as a single JSON object exactly like:
{"headline":"...","positives":["..."],"watchouts":["..."],"notable":["..."],"suggestions":[{"action":"...","basis":"...","severity":"warn"}]}`

export async function generateCoachInsights(opts: CoachRange & { force?: boolean } = {}): Promise<CoachState> {
  const { from = null, to = null, force = false } = opts
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in.", configured: true }

  // Decide mode up front. coach_use_ai defaults to true (treated as opt-out).
  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("coach_use_ai, coach_cache")
    .eq("user_id", user.id)
    .maybeSingle()
  const useAi = settingsRow?.coach_use_ai !== false
  const haveKey = !!process.env.ANTHROPIC_API_KEY
  const mode: "ai" | "deterministic" = useAi && haveKey ? "ai" : "deterministic"

  // The brief is scoped to the dashboard's current view (range + account scope).
  const scope = await getCurrentScope()
  const todayKey = new Date().toISOString().slice(0, 10)
  const viewKey = `${from ?? "all"}|${to ?? "now"}|${scope}`

  // Cache check — keyed by day + mode + view so changing the range/scope or
  // flipping the AI toggle regenerates, while plain re-renders hit cache.
  if (!force) {
    const cache = settingsRow?.coach_cache as
      | { day?: string; mode?: "ai" | "deterministic"; viewKey?: string; payload?: CoachInsightsPayload; generatedAt?: string }
      | null
    const modeMatches = cache?.mode == null || cache.mode === mode
    if (cache?.day === todayKey && modeMatches && cache.viewKey === viewKey && cache.payload) {
      return { ok: true, payload: cache.payload, generatedAt: cache.generatedAt ?? "", cached: true }
    }
  }

  // Hard numbers for the view — both helpers respect range + account scope.
  const [overall, pairPerf] = await Promise.all([
    getOverallStats({ from, to }),
    getPairPerformance({ from, to }),
  ])
  const statGrid = buildStatGrid(overall)

  if (overall.closedTrades === 0) {
    const payload: CoachInsightsPayload = {
      headline: "No closed trades in the current view.",
      stats: statGrid,
      positives: [],
      watchouts: [],
      notable: ["Widen the range filter (or switch accounts) — there's nothing to analyze in this window yet."],
      observations: ["No closed trades in the current view — widen the range or log/sync trades."],
      suggestions: [],
    }
    return { ok: true, payload, generatedAt: new Date().toISOString(), cached: false }
  }

  // Raw trades + entries in the window (scope-aware) for breakdowns + citations.
  let tq = supabase.from("trades")
    .select("id, pair, side, r, pnl, mood, playbook_id, opened_at, closed_at")
    .eq("status", "closed")
  if (scope !== "all") tq = tq.eq("account_id", scope)
  if (from) tq = tq.gte("closed_at", from)
  if (to) tq = tq.lte("closed_at", to)
  const { data: trades } = await tq.order("closed_at", { ascending: true })
  const closed = trades ?? []

  let oq = supabase.from("trades").select("id, pair, side, risk_amount").eq("status", "open")
  if (scope !== "all") oq = oq.eq("account_id", scope)
  const { data: openTrades } = await oq

  const tradeIds = closed.map((t) => t.id)
  const entriesRes = tradeIds.length
    ? await supabase.from("journal_entries")
        .select("trade_id, pre_trade, post_trade, during_trade, rule_break, rule_break_tags, mistakes")
        .in("trade_id", tradeIds)
    : { data: [] }
  const entries = entriesRes.data ?? []
  const { data: playbooks } = await supabase.from("playbooks").select("id, name")

  const playbookByID = new Map((playbooks ?? []).map((p) => [p.id, p.name]))
  const entriesByTradeID = new Map(entries.map((e) => [e.trade_id, e]))
  const breakdowns = buildBreakdowns(closed, entries, openTrades ?? [], pairPerf)

  // Deterministic branch — pure arithmetic, no API call.
  if (mode === "deterministic") {
    const det = deterministicInsights({
      trades: closed.map((t) => ({
        pair: t.pair, side: t.side,
        r: t.r != null ? Number(t.r) : null,
        pnl: t.pnl != null ? Number(t.pnl) : null,
        opened_at: t.opened_at, closed_at: t.closed_at,
      })),
      entries: entries.map((e) => ({ trade_id: e.trade_id, rule_break: !!e.rule_break })),
      tradeIdByTrade: (t) => closed.find((x) => x.pair === t.pair && x.opened_at === t.opened_at && x.closed_at === t.closed_at)?.id ?? null,
    })
    const payload = buildDeterministicBrief(overall, breakdowns, statGrid, det)
    const generatedAt = new Date().toISOString()
    await writeCache(supabase, user.id, settingsRow?.coach_cache, { day: todayKey, mode, viewKey, payload, generatedAt })
    revalidatePath("/dashboard")
    return { ok: true, payload, generatedAt, cached: false }
  }

  // AI branch — feed the rich, view-scoped dataset to Claude.
  const dataset = {
    view: {
      range: { from: from ?? "all-time", to: to ?? "now" },
      account: scope === "all" ? "all accounts" : "single account",
      closedTrades: overall.closedTrades,
    },
    overall: {
      netPnL: round(overall.totalPnL), winRate: overall.winRate, wins: overall.wins, losses: overall.losses, breakeven: overall.breakeven,
      profitFactor: overall.profitFactor, expectancyR: overall.expectancy, avgR: overall.avgR, avgWinR: overall.avgWinR, avgLossR: overall.avgLossR,
      maxDrawdownPct: overall.maxDrawdown, bestPair: overall.bestPair, worstPair: overall.worstPair,
    },
    ...breakdowns,
    sampleTrades: closed.slice(-40).map((t) => {
      const e = entriesByTradeID.get(t.id)
      return {
        pair: t.pair, side: t.side, r: t.r, pnl: t.pnl, mood: t.mood,
        playbook: t.playbook_id ? playbookByID.get(t.playbook_id) ?? null : null,
        opened: t.opened_at,
        thesis: e?.pre_trade?.slice(0, 140) ?? null,
        review: e?.post_trade?.slice(0, 140) ?? null,
        liveNotes: formatLiveNotes(e?.during_trade) || null,
        ruleBreak: !!e?.rule_break,
        mistakes: e?.rule_break_tags ?? [],
      }
    }),
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Dataset for the current view:\n\n${JSON.stringify(dataset)}\n\nWrite the daily brief JSON now.` }],
    })
    const textBlock = response.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") return { ok: false, error: "Coach AI returned no text content.", configured: true }
    const match = textBlock.text.match(/\{[\s\S]*\}/)
    if (!match) return { ok: false, error: "Coach AI didn't return a JSON object.", configured: true }
    const obj = JSON.parse(match[0]) as Record<string, unknown>

    const strArr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []
    const suggestions = Array.isArray(obj.suggestions)
      ? (obj.suggestions as unknown[]).flatMap((x): CoachSuggestion[] => {
          if (typeof x !== "object" || x === null) return []
          const o = x as Record<string, unknown>
          const action = typeof o.action === "string" ? o.action : null
          const basis = typeof o.basis === "string" ? o.basis : null
          if (!action || !basis) return []
          return [{ action, basis, severity: o.severity === "warn" ? "warn" : "info" }]
        })
      : []
    const positives = strArr(obj.positives)
    const watchouts = strArr(obj.watchouts)
    const notable = strArr(obj.notable)
    const headline = typeof obj.headline === "string" ? obj.headline : undefined
    if (!headline && positives.length === 0 && watchouts.length === 0 && suggestions.length === 0) {
      return { ok: false, error: "Coach AI returned an empty payload.", configured: true }
    }
    const payload: CoachInsightsPayload = {
      headline, stats: statGrid, positives, watchouts, notable,
      observations: [...positives, ...watchouts, ...notable],
      suggestions,
    }
    const generatedAt = new Date().toISOString()
    await writeCache(supabase, user.id, settingsRow?.coach_cache, { day: todayKey, mode, viewKey, payload, generatedAt })
    revalidatePath("/dashboard")
    return { ok: true, payload, generatedAt, cached: false }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Coach AI request failed.", configured: true }
  }
}

function round(n: number): number { return Math.round(n * 100) / 100 }

/** Headline stat cards for the brief (always accurate — computed, not AI). */
function buildStatGrid(o: OverallStats): CoachStat[] {
  const grid: CoachStat[] = [
    { label: "Net P&L", value: formatUSD(o.totalPnL, { signed: true }), tone: o.totalPnL > 0 ? "good" : o.totalPnL < 0 ? "bad" : "neutral" },
    { label: "Win rate", value: o.winRate != null ? `${o.winRate}%` : "—", tone: o.winRate != null ? (o.winRate >= 50 ? "good" : "bad") : "neutral" },
    { label: "Profit factor", value: o.profitFactor != null ? o.profitFactor.toFixed(2) : "—", tone: o.profitFactor != null ? (o.profitFactor >= 1 ? "good" : "bad") : "neutral" },
    { label: "Expectancy", value: o.expectancy != null ? `${o.expectancy > 0 ? "+" : ""}${o.expectancy.toFixed(2)}R` : "—", tone: o.expectancy != null ? (o.expectancy >= 0 ? "good" : "bad") : "neutral" },
    { label: "Avg R", value: o.avgR != null ? `${o.avgR > 0 ? "+" : ""}${o.avgR.toFixed(2)}R` : "—", tone: o.avgR != null ? (o.avgR >= 0 ? "good" : "bad") : "neutral" },
    { label: "Closed trades", value: String(o.closedTrades), tone: "neutral" },
  ]
  if (o.maxDrawdown != null) {
    grid.push({ label: "Max drawdown", value: `${o.maxDrawdown}%`, tone: o.maxDrawdown > 15 ? "bad" : "neutral" })
  }
  return grid
}

type SideAgg = { n: number; winRate: number; pnl: number; avgR: number }
function aggSide(ts: { pnl: number | null; r: number | null }[]): SideAgg {
  const n = ts.length
  const wins = ts.filter((t) => (Number(t.pnl) || 0) > 0).length
  const pnl = ts.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  const totalR = ts.reduce((s, t) => s + (Number(t.r) || 0), 0)
  return { n, winRate: n ? Math.round((wins / n) * 100) : 0, pnl: round(pnl), avgR: n ? round(totalR / n) : 0 }
}

type RawClosed = { pair: string; side: string; r: number | null; pnl: number | null; mood: string | null; opened_at: string | null; closed_at: string | null }
type RawEntry = { rule_break: boolean | null; rule_break_tags: string[] | null; mistakes: string[] | null }
type OpenT = { pair: string; side: string; risk_amount: number | null }
type PairPerf = { pair: string; closedTrades: number; winRate: number | null; pnl: number; avgR: number | null }

function buildBreakdowns(closed: RawClosed[], entries: RawEntry[], openTrades: OpenT[], pairPerf: PairPerf[]) {
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const weekdayMap = new Map<string, RawClosed[]>()
  for (const t of closed) {
    const ref = t.opened_at ?? t.closed_at
    if (!ref) continue
    const d = DOW[new Date(ref).getUTCDay()]
    const arr = weekdayMap.get(d) ?? []
    arr.push(t); weekdayMap.set(d, arr)
  }
  const weekday: Record<string, SideAgg> = {}
  for (const d of DOW) {
    const arr = weekdayMap.get(d)
    if (arr && arr.length) weekday[d] = aggSide(arr)
  }

  const moodMap = new Map<string, RawClosed[]>()
  for (const t of closed) {
    if (!t.mood) continue
    const arr = moodMap.get(t.mood) ?? []
    arr.push(t); moodMap.set(t.mood, arr)
  }
  const byMood = Array.from(moodMap.entries()).map(([mood, ts]) => ({ mood, ...aggSide(ts) }))

  const ruleBreaks = entries.filter((e) => e.rule_break).length
  const tagCounts = new Map<string, number>()
  for (const e of entries) {
    for (const tag of [...(e.rule_break_tags ?? []), ...(e.mistakes ?? [])]) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const topMistakes = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, n]) => ({ tag, n }))

  // Current streak (consecutive same-sign results, most recent run).
  let streakType: "win" | "loss" | "none" = "none"
  let streakLen = 0
  for (let i = closed.length - 1; i >= 0; i--) {
    const p = Number(closed[i].pnl) || 0
    const t = p > 0 ? "win" : p < 0 ? "loss" : "flat"
    if (t === "flat") continue
    if (streakType === "none") { streakType = t; streakLen = 1 }
    else if (t === streakType) streakLen += 1
    else break
  }

  const pairSorted = [...pairPerf].filter((p) => p.closedTrades > 0).sort((a, b) => b.pnl - a.pnl)
  const openRisk = openTrades.reduce((s, t) => s + (Number(t.risk_amount) || 0), 0)

  return {
    bySide: { long: aggSide(closed.filter((t) => t.side === "long")), short: aggSide(closed.filter((t) => t.side === "short")) },
    byWeekday: weekday,
    byMood,
    byPair: { best: pairSorted.slice(0, 3), worst: pairSorted.slice(-3).reverse() },
    discipline: { journaled: entries.length, ruleBreaks, ruleBreakPct: entries.length ? Math.round((ruleBreaks / entries.length) * 100) : 0, topMistakes },
    streak: { type: streakType, length: streakLen },
    open: { count: openTrades.length, totalRiskUsd: round(openRisk) },
  }
}

type Breakdowns = ReturnType<typeof buildBreakdowns>

/** Deterministic (no-API) version of the rich brief. */
function buildDeterministicBrief(o: OverallStats, b: Breakdowns, stats: CoachStat[], det: { observations: string[]; suggestions: CoachSuggestion[] }): CoachInsightsPayload {
  const positives: string[] = []
  const watchouts: string[] = []
  const notable: string[] = []

  if (o.totalPnL > 0) positives.push(`Net ${formatUSD(o.totalPnL, { signed: true })} across ${o.closedTrades} closed trades at a ${o.winRate ?? 0}% win rate.`)
  else watchouts.push(`Underwater at ${formatUSD(o.totalPnL, { signed: true })} across ${o.closedTrades} closed trades (${o.winRate ?? 0}% win rate).`)
  if (o.profitFactor != null && o.profitFactor >= 1.2) positives.push(`Profit factor ${o.profitFactor.toFixed(2)} — winners outweigh losers.`)
  if (o.bestPair) positives.push(`Best instrument: ${o.bestPair.pair} (${formatUSD(o.bestPair.pnl, { signed: true })}).`)
  if (b.bySide.long.n >= 3 && b.bySide.short.n >= 3 && Math.abs(b.bySide.long.winRate - b.bySide.short.winRate) >= 15) {
    const strong = b.bySide.long.winRate > b.bySide.short.winRate ? "long" : "short"
    positives.push(`Your ${strong}s are the stronger side (${strong === "long" ? b.bySide.long.winRate : b.bySide.short.winRate}% WR).`)
  }

  if (o.maxDrawdown != null && o.maxDrawdown > 15) watchouts.push(`Peak drawdown ${o.maxDrawdown}% — past the comfort zone.`)
  if (o.worstPair && o.worstPair.pnl < 0) watchouts.push(`Worst instrument: ${o.worstPair.pair} (${formatUSD(o.worstPair.pnl, { signed: true })}).`)
  if (b.discipline.ruleBreakPct >= 20 && b.discipline.journaled >= 3) watchouts.push(`Rule-breaks on ${b.discipline.ruleBreakPct}% of journaled trades${b.discipline.topMistakes[0] ? ` — most common: ${b.discipline.topMistakes[0].tag}` : ""}.`)
  if (b.open.count > 0) notable.push(`${b.open.count} open position${b.open.count === 1 ? "" : "s"} with ${formatUSD(b.open.totalRiskUsd)} at risk.`)
  if (b.streak.type !== "none" && b.streak.length >= 2) notable.push(`Currently on a ${b.streak.length}-trade ${b.streak.type} streak.`)
  if (o.closedTrades < 10) notable.push(`Small sample (${o.closedTrades} trades) — treat these as directional, not conclusive.`)

  return {
    headline: o.totalPnL >= 0
      ? `In the green: ${formatUSD(o.totalPnL, { signed: true })} over ${o.closedTrades} trades at ${o.winRate ?? 0}% WR.`
      : `Underwater: ${formatUSD(o.totalPnL, { signed: true })} over ${o.closedTrades} trades at ${o.winRate ?? 0}% WR.`,
    stats,
    positives,
    watchouts,
    notable: notable.length ? notable : det.observations,
    observations: [...positives, ...watchouts, ...notable],
    suggestions: det.suggestions,
  }
}

/** Upsert the daily cache without clobbering the weekly retrospective cache. */
async function writeCache(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  existingRaw: unknown,
  daily: { day: string; mode: "ai" | "deterministic"; viewKey: string; payload: CoachInsightsPayload; generatedAt: string },
) {
  const existing = (existingRaw ?? {}) as Record<string, unknown>
  await supabase.from("user_settings").upsert(
    { user_id: userId, coach_cache: { ...existing, ...daily, insights: daily.payload.observations } },
    { onConflict: "user_id" },
  )
}

const WEEKLY_RETROSPECTIVE_PROMPT = `You are a Coach AI for a Forex trader, writing the trader's MONDAY MORNING retrospective on the past week. You receive:
  - the user's last 7 days of closed trades (pair, side, entry, exit, R, P&L, mood, playbook)
  - the user's journal entries linked to those trades

Output: a JSON object with TWO fields.

  observations[]: 3 short, specific bullets in the form "Last week, X" — what HAPPENED, with citations.
    - One MUST be a positive (an edge, a discipline win, a setup that paid)
    - One MUST be a negative (a leak, a tilt episode, a setup that didn't)
    - Third is your call — most-cited pattern, biggest surprise, etc.
    - Cite specific numbers ("3 EUR/USD shorts averaged +1.4R" or "all 4 losses came after a prior loss within 30 min")

  suggestions[]: 2-3 prescriptive recommendations in the form "This week, [action]". Each is an object:
    - action: imperative starting with "This week," ("This week, no shorts on EUR/USD until 5 winners in a row" / "This week, hard cooldown of 30 min after any stop-out")
    - basis: one-sentence justification with the data
    - severity: "warn" when the pattern materially hurts P&L; "info" for low-impact nudges

Tone: a coach who has the trader's actual numbers in front of them. Direct, honest, no pep-talk. The trader wants to know what to keep doing and what to stop, not a recap of the week.

Format your response as a single JSON object exactly like:
{"observations":["Last week, ...","Last week, ...","Last week, ..."],"suggestions":[{"action":"This week, ...","basis":"...","severity":"warn"}]}`

export async function generateWeeklyRetrospective(force = false): Promise<CoachState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in.", configured: true }

  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("coach_use_ai, coach_cache")
    .eq("user_id", user.id)
    .maybeSingle()
  const useAi = settingsRow?.coach_use_ai !== false
  const haveKey = !!process.env.ANTHROPIC_API_KEY
  if (!useAi || !haveKey) {
    return { ok: false, error: "Weekly retrospective requires Coach AI enabled and ANTHROPIC_API_KEY configured.", configured: haveKey }
  }

  // Cache key: ISO week (year-Www). Stable for 7 days so re-renders don't burn API.
  const weekKey = isoWeekKey(new Date())
  if (!force) {
    const cache = settingsRow?.coach_cache as { weekly?: { week?: string; payload?: CoachInsightsPayload; generatedAt?: string } } | null
    const w = cache?.weekly
    if (w?.week === weekKey && w.payload) {
      return { ok: true, payload: w.payload, generatedAt: w.generatedAt ?? "", cached: true }
    }
  }

  // Pull last 7 days of closed trades + linked entries.
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); sevenDaysAgo.setHours(0, 0, 0, 0)
  const [{ data: trades }, { data: entries }, { data: playbooks }] = await Promise.all([
    supabase.from("trades")
      .select("id, pair, side, entry_price, exit_price, r, pnl, mood, playbook_id, opened_at, closed_at")
      .eq("status", "closed")
      .gte("closed_at", sevenDaysAgo.toISOString())
      .order("closed_at", { ascending: true }),
    supabase.from("journal_entries")
      .select("trade_id, pre_trade, post_trade, during_trade, rule_break, rule_break_tags, mistakes")
      .eq("user_id", user.id)
      .gte("created_at", sevenDaysAgo.toISOString()),
    supabase.from("playbooks").select("id, name").eq("user_id", user.id),
  ])

  if (!trades || trades.length === 0) {
    return {
      ok: true,
      payload: {
        observations: [
          "No closed trades last week — nothing to review yet. Either you stayed flat (good discipline if intentional) or you're between cycles.",
        ],
        suggestions: [],
      },
      generatedAt: new Date().toISOString(),
      cached: false,
    }
  }

  const playbookByID = new Map((playbooks ?? []).map((p) => [p.id, p.name]))
  const entriesByTradeID = new Map((entries ?? []).map((e) => [e.trade_id, e]))
  const compactDataset = trades.map((t) => {
    const e = entriesByTradeID.get(t.id)
    return {
      pair: t.pair,
      side: t.side,
      entry: t.entry_price,
      exit: t.exit_price,
      r: t.r,
      pnl: t.pnl,
      mood: t.mood,
      playbook: t.playbook_id ? playbookByID.get(t.playbook_id) : null,
      opened: t.opened_at,
      thesis: e?.pre_trade?.slice(0, 200) ?? null,
      review: e?.post_trade?.slice(0, 200) ?? null,
      liveNotes: formatLiveNotes(e?.during_trade) || null,
      ruleBreak: !!e?.rule_break,
      ruleBreakTags: e?.rule_break_tags ?? [],
      mistakes: e?.mistakes ?? [],
    }
  })

  let payload: CoachInsightsPayload
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 800,
      system: WEEKLY_RETROSPECTIVE_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(compactDataset) }],
    })
    const block = response.content.find((b) => b.type === "text")
    if (!block || block.type !== "text") return { ok: false, error: "Coach AI returned no text.", configured: true }
    const match = block.text.match(/\{[\s\S]*\}/)
    if (!match) return { ok: false, error: "Coach AI didn't return JSON.", configured: true }
    const parsed = JSON.parse(match[0]) as { observations?: unknown; suggestions?: unknown }
    const observations = Array.isArray(parsed.observations) ? parsed.observations.filter((o): o is string => typeof o === "string").slice(0, 3) : []
    const suggestions = Array.isArray(parsed.suggestions)
      ? (parsed.suggestions as unknown[])
          .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
          .map((s) => ({
            action: String(s.action ?? "").trim(),
            basis: String(s.basis ?? "").trim(),
            severity: (s.severity === "warn" ? "warn" : "info") as "warn" | "info",
          }))
          .filter((s) => s.action.length > 0)
          .slice(0, 3)
      : []
    payload = { observations, suggestions }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Coach AI request failed.", configured: true }
  }

  const generatedAt = new Date().toISOString()
  // Merge into existing coach_cache without clobbering the daily cache.
  const existing = (settingsRow?.coach_cache ?? {}) as Record<string, unknown>
  await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, coach_cache: { ...existing, weekly: { week: weekKey, payload, generatedAt } } },
      { onConflict: "user_id" },
    )
  revalidatePath("/dashboard")
  return { ok: true, payload, generatedAt, cached: false }
}

/**
 * ISO week key in `YYYY-Www` form. Stable Mon→Sun, used as the weekly cache key.
 */
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`
}

/**
 * Compact representation of `journal_entries.during_trade` (an array of
 * `{ts, text}` mid-trade captures) for inclusion in the LLM payload.
 * Capped at 300 chars total — these notes are the highest-signal text for
 * tilt detection ("moved stop at 14:32 because price was 'choppy'") so
 * we want the model to see them, but we don't want to balloon the prompt.
 */
function formatLiveNotes(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return ""
  const parts: string[] = []
  let used = 0
  const max = 300
  for (const note of raw) {
    if (typeof note !== "object" || note === null) continue
    const n = note as { ts?: unknown; text?: unknown }
    const text = typeof n.text === "string" ? n.text.trim() : ""
    if (!text) continue
    const ts = typeof n.ts === "string" ? n.ts : null
    const time = ts ? new Date(ts).toISOString().slice(11, 16) : "—:—"
    const line = `[${time}] ${text}`
    if (used + line.length + 1 > max) break
    parts.push(line)
    used += line.length + 1
  }
  return parts.join(" · ")
}
