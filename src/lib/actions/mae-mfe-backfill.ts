"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getAggregates, pairToPolygonTicker } from "@/lib/integrations/polygon"

/**
 * #49 MAE / MFE backfill. For each closed trade lacking
 * mae_mfe_resolved_at, fetch hourly Polygon bars across the trade's lifespan
 * and compute:
 *
 *   MAE = max adverse excursion (worst price against the trade)
 *   MFE = max favorable excursion (best price for the trade)
 *
 * R-units are computed against the trade's stop distance:
 *   risk = |entry − stop|; mae_r = (entryDir × (mae_price − entry)) / risk
 * Negative R = price went against; positive = went in favor. So MAE is
 * typically negative and MFE positive.
 *
 * Capped at 50 trades per invocation to bound Polygon API spend. Manual
 * trigger from the analytics card; idempotent (skips already-resolved trades).
 */

export async function backfillMaeMfe(opts: { max?: number } = {}): Promise<{
  ok: true
  resolved: number
  skipped: number
  failed: number
}> {
  const max = opts.max ?? 50
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: true, resolved: 0, skipped: 0, failed: 0 }

  const { data: pending } = await supabase
    .from("trades")
    .select("id, pair, side, entry_price, stop_price, opened_at, closed_at")
    .eq("user_id", user.id)
    .eq("status", "closed")
    .is("mae_mfe_resolved_at", null)
    .not("opened_at", "is", null)
    .not("closed_at", "is", null)
    .limit(max)

  if (!pending || pending.length === 0) {
    return { ok: true, resolved: 0, skipped: 0, failed: 0 }
  }

  let resolved = 0
  let failed = 0
  let skipped = 0

  for (const t of pending) {
    const ticker = pairToPolygonTicker(t.pair)
    if (!ticker || t.stop_price == null) {
      // Mark resolved with null values so we don't retry pointlessly.
      await supabase.from("trades")
        .update({ mae_mfe_resolved_at: new Date().toISOString() })
        .eq("id", t.id)
      skipped += 1
      continue
    }

    const fromMs = new Date(t.opened_at!).getTime()
    const toMs = new Date(t.closed_at!).getTime()
    if (toMs <= fromMs) { skipped += 1; continue }

    const r = await getAggregates({
      ticker,
      multiplier: 1,
      timespan: "hour",
      from: fromMs,
      to: toMs,
    })
    if (!r.ok) { failed += 1; continue }
    const bars = r.bars ?? []
    if (bars.length === 0) { skipped += 1; continue }

    const entry = Number(t.entry_price)
    const stop = Number(t.stop_price)
    const risk = Math.abs(entry - stop)
    if (risk === 0) { skipped += 1; continue }
    const side = t.side as "long" | "short"

    let highest = -Infinity
    let lowest = Infinity
    for (const b of bars) {
      if (b.high > highest) highest = b.high
      if (b.low < lowest) lowest = b.low
    }
    if (!Number.isFinite(highest) || !Number.isFinite(lowest)) { skipped += 1; continue }

    // For long: MFE = highest (in favor), MAE = lowest (against).
    // For short: MFE = lowest (in favor), MAE = highest (against).
    const mfePrice = side === "long" ? highest : lowest
    const maePrice = side === "long" ? lowest : highest
    const mfeR = side === "long" ? (mfePrice - entry) / risk : (entry - mfePrice) / risk
    const maeR = side === "long" ? (maePrice - entry) / risk : (entry - maePrice) / risk

    await supabase.from("trades").update({
      mae_price: Number(maePrice.toFixed(5)),
      mfe_price: Number(mfePrice.toFixed(5)),
      mae_r: Number(maeR.toFixed(2)),
      mfe_r: Number(mfeR.toFixed(2)),
      mae_mfe_resolved_at: new Date().toISOString(),
    }).eq("id", t.id)

    resolved += 1
  }

  revalidatePath("/analytics")
  return { ok: true, resolved, skipped, failed }
}
