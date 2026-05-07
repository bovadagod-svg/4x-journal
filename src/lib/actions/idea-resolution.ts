"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getAggregates, pairToPolygonTicker } from "@/lib/integrations/polygon"

/**
 * #58 Hypothetical-idea resolver. For each idea entry with idea_pair / side /
 * entry / stop / target filled, walks Polygon hourly bars from creation
 * forward N days and decides whether the idea would have hit stop, target,
 * or timed out. Persists `idea_outcome` JSONB so IdeasComparisonCard can
 * surface "skipped would have averaged +0.8R".
 *
 * Idempotent: skips entries that already have `idea_outcome`. Only resolves
 * ideas older than `minAgeDays` (default 1) so we don't try to backfill an
 * idea logged 5 minutes ago.
 */

export type IdeaOutcome = {
  resolved_at: string
  resolution: "stop" | "target" | "timeout"
  resolved_r: number
  lookback_days: number
}

const DEFAULT_LOOKBACK_DAYS = 14
const DEFAULT_MIN_AGE_DAYS = 1
const HOURS_PER_DAY = 24

export async function resolveIdeaOutcome(entryId: string, lookbackDays = DEFAULT_LOOKBACK_DAYS): Promise<
  | { ok: true; outcome: IdeaOutcome }
  | { ok: false; error: string; configured?: boolean }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: entry } = await supabase
    .from("journal_entries")
    .select("id, user_id, kind, created_at, idea_pair, idea_side, idea_entry, idea_stop, idea_target, idea_outcome")
    .eq("id", entryId)
    .maybeSingle()
  if (!entry || entry.user_id !== user.id) return { ok: false, error: "Entry not found." }
  if (entry.kind !== "idea") return { ok: false, error: "Only idea entries can be resolved." }
  if (!entry.idea_pair || !entry.idea_side || !entry.idea_entry || !entry.idea_stop || !entry.idea_target) {
    return { ok: false, error: "Idea is missing pair/side/entry/stop/target." }
  }

  const ticker = pairToPolygonTicker(entry.idea_pair)
  if (!ticker) return { ok: false, error: `Unsupported pair "${entry.idea_pair}".` }

  const fromMs = new Date(entry.created_at).getTime()
  const toMs = fromMs + lookbackDays * HOURS_PER_DAY * 3600_000
  const r = await getAggregates({
    ticker,
    multiplier: 1,
    timespan: "hour",
    from: fromMs,
    to: toMs,
  })
  if (!r.ok) return { ok: false, error: r.error ?? "Polygon fetch failed", configured: r.configured ?? false }
  const bars = r.bars ?? []
  if (bars.length === 0) {
    return { ok: false, error: "No Polygon bars available in the lookback window." }
  }

  const side = entry.idea_side as "long" | "short"
  const entryPrice = Number(entry.idea_entry)
  const stopPrice = Number(entry.idea_stop)
  const targetPrice = Number(entry.idea_target)

  // Walk bars in chronological order; first to touch wins. For the same bar
  // touching both stop + target (gap or huge wick), we pessimistically assign
  // stop — better to under-credit than over-credit.
  let outcome: IdeaOutcome | null = null
  for (const b of bars) {
    const stopHit = side === "long" ? b.low <= stopPrice : b.high >= stopPrice
    const targetHit = side === "long" ? b.high >= targetPrice : b.low <= targetPrice
    if (stopHit) {
      outcome = { resolved_at: new Date(b.ts).toISOString(), resolution: "stop", resolved_r: -1, lookback_days: lookbackDays }
      break
    }
    if (targetHit) {
      const targetR = Math.abs(targetPrice - entryPrice) / Math.abs(entryPrice - stopPrice)
      outcome = {
        resolved_at: new Date(b.ts).toISOString(),
        resolution: "target",
        resolved_r: Number(targetR.toFixed(2)),
        lookback_days: lookbackDays,
      }
      break
    }
  }

  if (!outcome) {
    // Timeout — close-of-window price determines partial R.
    const last = bars[bars.length - 1]
    const move = side === "long" ? last.close - entryPrice : entryPrice - last.close
    const risk = Math.abs(entryPrice - stopPrice)
    outcome = {
      resolved_at: new Date(last.ts).toISOString(),
      resolution: "timeout",
      resolved_r: risk > 0 ? Number((move / risk).toFixed(2)) : 0,
      lookback_days: lookbackDays,
    }
  }

  await supabase
    .from("journal_entries")
    .update({ idea_outcome: outcome })
    .eq("id", entryId)
  revalidatePath("/journal")
  return { ok: true, outcome }
}

/**
 * Batch helper — resolves all eligible idea entries for the current user.
 * Eligible = kind="idea", all 5 idea_* fields set, idea_outcome NULL, created
 * at least minAgeDays ago. Caps at 50 per invocation to bound Polygon API spend.
 */
export async function resolveAllPendingIdeas(opts: { minAgeDays?: number; lookbackDays?: number; max?: number } = {}): Promise<{
  ok: true
  resolved: number
  failed: number
  skipped: number
}> {
  const minAgeDays = opts.minAgeDays ?? DEFAULT_MIN_AGE_DAYS
  const lookbackDays = opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS
  const max = opts.max ?? 50

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: true, resolved: 0, failed: 0, skipped: 0 }

  const cutoff = new Date(Date.now() - minAgeDays * HOURS_PER_DAY * 3600_000).toISOString()
  const { data: pending } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("user_id", user.id)
    .eq("kind", "idea")
    .is("idea_outcome", null)
    .not("idea_pair", "is", null)
    .not("idea_side", "is", null)
    .not("idea_entry", "is", null)
    .not("idea_stop", "is", null)
    .not("idea_target", "is", null)
    .lte("created_at", cutoff)
    .limit(max)

  if (!pending || pending.length === 0) {
    return { ok: true, resolved: 0, failed: 0, skipped: 0 }
  }

  let resolved = 0
  let failed = 0
  for (const e of pending) {
    const r = await resolveIdeaOutcome(e.id, lookbackDays)
    if (r.ok) resolved += 1
    else failed += 1
  }
  return { ok: true, resolved, failed, skipped: 0 }
}
