"use server"

import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"

/**
 * Coach AI auto-tagging.
 *
 * Reads a journal entry's text (pre/post-trade + cold review + lessons),
 * asks Claude haiku to extract tags + mistakes + mood. Cheap — under 500
 * tokens out, ~80 tokens in for typical entries. Returns the suggestion;
 * the user accepts or rejects via the editor UI (we never auto-apply).
 *
 * Gated on:
 *   - ANTHROPIC_API_KEY (no key → returns configured:false)
 *   - user_settings.coach_auto_tag = true (off by default — avoids surprise
 *     API spend for users who haven't opted in)
 */

export type CoachTagSuggestion = {
  tags: string[]
  mistakes: string[]
  mood: string | null
}

export type CoachTagResult =
  | { ok: true; suggestion: CoachTagSuggestion }
  | { ok: false; error: string; configured: boolean }

const SYSTEM_PROMPT = `You are reading a single Forex trade's journal entry. Extract structured tags from the text.

Return a JSON object with exactly:
{
  "tags": [...],         // 0-5 short lowercase keywords describing the SETUP, NOT the outcome (e.g. "breakout", "london-open", "trend-pullback", "key-level"). Skip generic words like "good" or "bad".
  "mistakes": [...],     // 0-3 lowercase keywords for execution errors mentioned (e.g. "early-entry", "moved-stop", "no-plan", "fomo", "revenge", "tilt"). Empty array if no errors mentioned.
  "mood": "..."          // single word capturing the trader's emotional state when the trade happened. One of: focused | tilted | fomo | confident | hesitant | bored | anxious | calm | frustrated | revenge | null
}

Rules:
  - If the text is too short to extract meaningfully, return empty arrays + null mood.
  - Don't invent — stick to what's in the prose.
  - Output JSON only, no commentary.`

export async function suggestEntryTags(entryId: string): Promise<CoachTagResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "ANTHROPIC_API_KEY not set", configured: false }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in.", configured: true }

  // Gate on user setting — opt-in only.
  const { data: settings } = await supabase
    .from("user_settings")
    .select("coach_auto_tag")
    .eq("user_id", user.id)
    .maybeSingle()
  if (!settings?.coach_auto_tag) {
    return { ok: false, error: "Auto-tagging is disabled. Enable it in Settings → Behavior.", configured: false }
  }

  const { data: entry } = await supabase
    .from("journal_entries")
    .select("pre_trade, post_trade, cold_review, lessons, user_id")
    .eq("id", entryId)
    .maybeSingle()
  if (!entry || entry.user_id !== user.id) return { ok: false, error: "Entry not found.", configured: true }

  const text = [entry.pre_trade, entry.post_trade, entry.cold_review, entry.lessons]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join("\n\n")
    .slice(0, 4000)
  if (text.trim().length < 30) {
    return { ok: true, suggestion: { tags: [], mistakes: [], mood: null } }
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    })
    const block = response.content.find((b) => b.type === "text")
    if (!block || block.type !== "text") {
      return { ok: false, error: "Coach AI returned no text.", configured: true }
    }
    const match = block.text.match(/\{[\s\S]*\}/)
    if (!match) return { ok: false, error: "Coach AI didn't return JSON.", configured: true }
    const parsed = JSON.parse(match[0]) as unknown
    if (typeof parsed !== "object" || parsed === null) {
      return { ok: false, error: "Coach AI returned non-object JSON.", configured: true }
    }
    const obj = parsed as Record<string, unknown>
    const tags = Array.isArray(obj.tags)
      ? (obj.tags as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 5)
      : []
    const mistakes = Array.isArray(obj.mistakes)
      ? (obj.mistakes as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 3)
      : []
    const moodRaw = typeof obj.mood === "string" ? obj.mood.trim().toLowerCase() : ""
    const mood = moodRaw && moodRaw !== "null" ? moodRaw : null
    return { ok: true, suggestion: { tags, mistakes, mood } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Coach AI request failed.", configured: true }
  }
}
