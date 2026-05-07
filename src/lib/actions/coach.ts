"use server"

import Anthropic from "@anthropic-ai/sdk"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { deterministicInsights } from "@/lib/coach-insights"

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

export type CoachInsightsPayload = {
  /** Descriptive — what the data shows. */
  observations: string[]
  /** Prescriptive — what to actually do about it. */
  suggestions: CoachSuggestion[]
}

export type CoachState =
  | { ok: true; payload: CoachInsightsPayload; generatedAt: string; cached: boolean }
  | { ok: false; error: string; configured: boolean }

const SYSTEM_PROMPT = `You are a Coach AI for a Forex trader's journal. The user trades discretionarily and journals every trade. Each invocation, you receive:
  - the user's last 30 days of closed trades (pair, side, entry, exit, R, P&L, mood, playbook)
  - the user's journal entries linked to those trades (pre-trade thesis, post-trade review, rule-break flag)

Output: a JSON object with TWO fields.

  observations[]: 2-3 short, specific descriptions about EDGES (what's working) and LEAKS (what's not). Each observation must:
    - Cite at least one concrete data point ("your last 5 EUR/USD shorts averaged +1.4R" or "your 3 worst losses this month all happened on Mondays before 10am ET")
    - Be actionable in spirit, not generic
    - Be honest. Don't sugarcoat losing patterns.

  suggestions[]: 1-3 prescriptive recommendations. Each suggestion is an object:
    - action: an imperative sentence ("Stop shorts on EUR/USD until WR climbs above 40%")
    - basis: a one-sentence justification citing the data ("11 trades, 28% WR, expectancy -0.4R, total -3.2R")
    - severity: "warn" when the pattern materially hurts P&L; "info" for low-impact nudges

Do NOT:
  - Predict markets or give trade ideas
  - Suggest changes to playbook rules unless trades obviously cluster
  - Use vague advice or pep-talk language
  - Output more than 3 of each

Format your response as a single JSON object exactly like:
{"observations":["...","..."],"suggestions":[{"action":"...","basis":"...","severity":"warn"}]}`

export async function generateCoachInsights(force = false): Promise<CoachState> {
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

  // Cache check — keyed by day + mode so flipping the toggle regenerates,
  // and a missing key falling back to deterministic doesn't get masked by
  // a stale AI cache (or vice-versa).
  const todayKey = new Date().toISOString().slice(0, 10)
  if (!force) {
    const cache = settingsRow?.coach_cache as
      | {
          day?: string
          mode?: "ai" | "deterministic"
          payload?: CoachInsightsPayload
          insights?: string[]
          generatedAt?: string
        }
      | null
    // Old cached blobs (pre-mode field) get a free pass on the mode check —
    // we'll regenerate naturally on the next forced refresh.
    const modeMatches = cache?.mode == null || cache.mode === mode
    if (cache?.day === todayKey && modeMatches && (cache.payload || cache.insights)) {
      const payload: CoachInsightsPayload = cache.payload ?? {
        observations: cache.insights ?? [],
        suggestions: [],
      }
      return { ok: true, payload, generatedAt: cache.generatedAt ?? "", cached: true }
    }
  }

  // Fetch last-30-days dataset
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); thirtyDaysAgo.setHours(0, 0, 0, 0)
  const [{ data: trades }, { data: entries }, { data: playbooks }] = await Promise.all([
    supabase.from("trades")
      .select("id, pair, side, entry_price, exit_price, r, pnl, mood, playbook_id, opened_at, closed_at")
      .eq("status", "closed")
      .gte("closed_at", thirtyDaysAgo.toISOString())
      .order("closed_at", { ascending: true }),
    supabase.from("journal_entries")
      .select("trade_id, pre_trade, post_trade, during_trade, rule_break, rule_break_tags, mistakes")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("playbooks").select("id, name").eq("user_id", user.id),
  ])

  if (!trades || trades.length === 0) {
    return {
      ok: true,
      payload: {
        observations: [
          "Not enough closed trades in the last 30 days to find patterns yet — log a few more and I'll spot what's working and what's not.",
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
    const playbook = t.playbook_id ? playbookByID.get(t.playbook_id) : null
    return {
      pair: t.pair,
      side: t.side,
      entry: t.entry_price,
      exit: t.exit_price,
      r: t.r,
      pnl: t.pnl,
      mood: t.mood,
      playbook,
      opened: t.opened_at,
      thesis: e?.pre_trade?.slice(0, 200) ?? null,
      review: e?.post_trade?.slice(0, 200) ?? null,
      // Mid-trade emotional captures — highest-signal text for tilt detection.
      // Format `[HH:MM] text` so the LLM can reason about timing.
      liveNotes: formatLiveNotes(e?.during_trade) || null,
      ruleBreak: !!e?.rule_break,
      ruleBreakTags: e?.rule_break_tags ?? [],
      mistakes: e?.mistakes ?? [],
    }
  })

  // Deterministic branch — pure arithmetic, no API call. Same payload shape
  // so the widget renders identically.
  if (mode === "deterministic") {
    const detPayload = deterministicInsights({
      trades: trades.map((t) => ({
        pair: t.pair,
        side: t.side,
        r: t.r != null ? Number(t.r) : null,
        pnl: t.pnl != null ? Number(t.pnl) : null,
        opened_at: t.opened_at,
        closed_at: t.closed_at,
      })),
      entries: (entries ?? []).map((e) => ({ trade_id: e.trade_id, rule_break: !!e.rule_break })),
      tradeIdByTrade: (t) => {
        const match = trades.find((x) => x.pair === t.pair && x.opened_at === t.opened_at && x.closed_at === t.closed_at)
        return match?.id ?? null
      },
    })
    const generatedAt = new Date().toISOString()
    await supabase.from("user_settings").upsert(
      { user_id: user.id, coach_cache: { day: todayKey, mode, payload: detPayload, insights: detPayload.observations, generatedAt } },
      { onConflict: "user_id" },
    )
    revalidatePath("/dashboard")
    return { ok: true, payload: detPayload, generatedAt, cached: false }
  }

  // AI branch — send the dataset to Claude.
  const userMessage = `Here are the user's last ${compactDataset.length} closed trades and journal entries (most recent last):\n\n${JSON.stringify(compactDataset, null, 2)}\n\nReturn the JSON object with observations + suggestions arrays as specified in the system prompt.`

  let payload: CoachInsightsPayload
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    })
    const textBlock = response.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Coach AI returned no text content.", configured: true }
    }
    // Extract the outermost JSON object Claude wrote.
    const match = textBlock.text.match(/\{[\s\S]*\}/)
    if (!match) {
      return { ok: false, error: "Coach AI didn't return a JSON object.", configured: true }
    }
    const parsed = JSON.parse(match[0]) as unknown
    if (typeof parsed !== "object" || parsed === null) {
      return { ok: false, error: "Coach AI returned non-object JSON.", configured: true }
    }
    const obj = parsed as Record<string, unknown>

    // Tolerant parse: if the model regressed to just an array of strings,
    // upgrade it to the new shape with no suggestions.
    if (Array.isArray(parsed)) {
      payload = {
        observations: (parsed as unknown[]).filter((x): x is string => typeof x === "string"),
        suggestions: [],
      }
    } else {
      const observations = Array.isArray(obj.observations)
        ? (obj.observations as unknown[]).filter((x): x is string => typeof x === "string")
        : []
      const suggestions = Array.isArray(obj.suggestions)
        ? (obj.suggestions as unknown[]).flatMap((x): CoachSuggestion[] => {
            if (typeof x !== "object" || x === null) return []
            const o = x as Record<string, unknown>
            const action = typeof o.action === "string" ? o.action : null
            const basis = typeof o.basis === "string" ? o.basis : null
            if (!action || !basis) return []
            const sev = o.severity === "warn" ? "warn" : "info"
            return [{ action, basis, severity: sev }]
          })
        : []
      if (observations.length === 0 && suggestions.length === 0) {
        return { ok: false, error: "Coach AI returned an empty payload.", configured: true }
      }
      payload = { observations, suggestions }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Coach AI request failed.", configured: true }
  }

  const generatedAt = new Date().toISOString()
  // Cache result with mode field. Both new (`payload`) and legacy (`insights`)
  // shapes for forward-compatibility with the older widget code.
  await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, coach_cache: { day: todayKey, mode, payload, insights: payload.observations, generatedAt } },
      { onConflict: "user_id" },
    )

  revalidatePath("/dashboard")
  return { ok: true, payload, generatedAt, cached: false }
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
