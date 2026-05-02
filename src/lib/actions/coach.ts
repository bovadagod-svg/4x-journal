"use server"

import Anthropic from "@anthropic-ai/sdk"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

/**
 * Coach AI: takes the user's last 30 days of closed trades + journal entries
 * and asks Claude for 2–3 specific observations about edges and leaks.
 *
 * Activation requires `ANTHROPIC_API_KEY` env var. Without it, the action
 * returns a "not configured" error and the dashboard widget renders a
 * placeholder telling the user how to enable it.
 *
 * Cache: result is keyed by user_id + day so we don't blast the API on every
 * dashboard refresh. Stored in user_settings as a JSON blob via a separate
 * `coach_cache` column (added by migration `user_settings_coach_cache`).
 */

export type CoachState =
  | { ok: true; insights: string[]; generatedAt: string; cached: boolean }
  | { ok: false; error: string; configured: boolean }

const SYSTEM_PROMPT = `You are a Coach AI for a Forex trader's journal. The user trades discretionarily and journals every trade. Each invocation, you receive:
  - the user's last 30 days of closed trades (pair, side, entry, exit, R, P&L, mood, playbook)
  - the user's journal entries linked to those trades (pre-trade thesis, post-trade review, rule-break flag)

Output: 2-3 short, specific observations about EDGES (what's working) and LEAKS (what's not). Each observation must:
  - Cite at least one concrete data point ("your last 5 EUR/USD shorts averaged +1.4R" or "your 3 worst losses this month all happened on Mondays before 10am ET")
  - Be actionable, not generic ("avoid Mondays" not "be careful")
  - Be honest. Don't sugarcoat losing patterns.

Do NOT:
  - Predict markets or give trade ideas
  - Comment on individual playbooks unless trades obviously cluster
  - Use vague advice or pep-talk language
  - Output more than 3 bullets

Format your response as a JSON array of strings: ["observation 1", "observation 2", ...]`

export async function generateCoachInsights(force = false): Promise<CoachState> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "ANTHROPIC_API_KEY not set in environment", configured: false }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in.", configured: true }

  // Cache check — if we have a cached blob from today, return it unless forced
  const todayKey = new Date().toISOString().slice(0, 10)
  if (!force) {
    const { data: row } = await supabase
      .from("user_settings")
      .select("coach_cache")
      .eq("user_id", user.id)
      .maybeSingle()
    const cache = row?.coach_cache as { day?: string; insights?: string[]; generatedAt?: string } | null
    if (cache?.day === todayKey && Array.isArray(cache.insights) && cache.insights.length > 0) {
      return { ok: true, insights: cache.insights, generatedAt: cache.generatedAt ?? "", cached: true }
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
      .select("trade_id, pre_trade, post_trade, rule_break, rule_break_tags, mistakes")
      .eq("user_id", user.id)
      .gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("playbooks").select("id, name").eq("user_id", user.id),
  ])

  if (!trades || trades.length === 0) {
    return {
      ok: true,
      insights: [
        "Not enough closed trades in the last 30 days to find patterns yet — log a few more and I'll spot what's working and what's not.",
      ],
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
      ruleBreak: !!e?.rule_break,
      ruleBreakTags: e?.rule_break_tags ?? [],
      mistakes: e?.mistakes ?? [],
    }
  })

  const userMessage = `Here are the user's last ${compactDataset.length} closed trades and journal entries (most recent last):\n\n${JSON.stringify(compactDataset, null, 2)}\n\nReturn 2-3 observations as a JSON array of strings.`

  let insights: string[]
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    })
    const textBlock = response.content.find((b) => b.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "Coach AI returned no text content.", configured: true }
    }
    // Extract JSON array from response — Claude usually wraps cleanly
    const match = textBlock.text.match(/\[[\s\S]*\]/)
    if (!match) {
      return { ok: false, error: "Coach AI didn't return a JSON array.", configured: true }
    }
    const parsed: unknown = JSON.parse(match[0])
    if (!Array.isArray(parsed) || !parsed.every((x): x is string => typeof x === "string")) {
      return { ok: false, error: "Coach AI returned malformed JSON.", configured: true }
    }
    insights = parsed
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Coach AI request failed.", configured: true }
  }

  const generatedAt = new Date().toISOString()
  // Cache result
  await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, coach_cache: { day: todayKey, insights, generatedAt } },
      { onConflict: "user_id" },
    )

  revalidatePath("/dashboard")
  return { ok: true, insights, generatedAt, cached: false }
}
