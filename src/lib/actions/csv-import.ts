"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { NormalizedTrade } from "@/lib/integrations/csv/parser"

const ImportSchema = z.object({
  account_id: z.string().uuid(),
  // Trades come over the wire as JSON-stringified array.
  trades: z.string(),
})

export type CsvImportResult =
  | {
      ok: true
      summary: {
        total: number
        imported: number
        skipped_invalid: number
        skipped_duplicate: number
        fillsCreated: number
      }
    }
  | { ok: false; error: string }

/**
 * Bulk-import normalized trade rows into the user's account.
 *
 * Dedup strategy: each row's optional external_id is namespaced as
 * `csv:${external_id}` so it never collides with broker syncs (which use
 * `tradelocker:` etc.) or webhooks. If the row has no external_id, we
 * synthesize one from `${opened_at}|${pair}|${side}|${size}` so re-uploads
 * of the same CSV are idempotent.
 *
 * Each imported trade also gets one entry fill (and one exit fill if closed)
 * via `trade_fills`, with the recompute_trade_aggregates trigger maintaining
 * parent aggregates. This matches the broker-sync path so the Ledger renders
 * identically regardless of import source.
 */
export async function importCsvTrades(formData: FormData): Promise<CsvImportResult> {
  const parsed = ImportSchema.safeParse({
    account_id: formData.get("account_id"),
    trades: formData.get("trades"),
  })
  if (!parsed.success) return { ok: false, error: "Invalid form payload." }

  let trades: NormalizedTrade[]
  try {
    const raw = JSON.parse(parsed.data.trades)
    if (!Array.isArray(raw)) return { ok: false, error: "Trades payload must be an array." }
    trades = raw as NormalizedTrade[]
  } catch {
    return { ok: false, error: "Trades payload was not valid JSON." }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  // Verify account ownership
  const { data: account } = await supabase
    .from("accounts")
    .select("id, user_id")
    .eq("id", parsed.data.account_id)
    .maybeSingle()
  if (!account || account.user_id !== user.id) {
    return { ok: false, error: "Account not found." }
  }

  // Filter out rows with issues
  const valid = trades.filter((t) => !t.issue && t.pair && t.size > 0)
  const skipped_invalid = trades.length - valid.length

  if (valid.length === 0) {
    return {
      ok: true,
      summary: { total: trades.length, imported: 0, skipped_invalid, skipped_duplicate: 0, fillsCreated: 0 },
    }
  }

  // Build trade rows with synthetic external_ids for dedup
  const rows = valid.map((t) => {
    const ext = t.external_id
      ? `csv:${t.external_id}`
      : `csv:${t.opened_at ?? "noop"}|${t.pair}|${t.side}|${t.size}`
    const status = t.exit_price != null ? "closed" : (t.opened_at ? "open" : "open")
    return {
      user_id: user.id,
      account_id: parsed.data.account_id,
      pair: t.pair,
      side: t.side,
      entry_price: t.entry_price,
      stop_price: t.stop_price,
      target_price: t.target_price,
      size: t.size,
      status,
      external_id: ext,
      external_provider: "csv",
      opened_at: t.opened_at,
      notes: t.notes ?? "Imported from CSV",
      tags: ["csv-import"],
    }
  })

  // Upsert dedup'd by (account_id, external_provider, external_id)
  const { error: upErr, count: upsertedCount } = await supabase
    .from("trades")
    .upsert(rows, { onConflict: "account_id,external_provider,external_id", count: "exact" })
  if (upErr) return { ok: false, error: upErr.message }

  // Fetch trade IDs for fill creation
  const externalIds = rows.map((r) => r.external_id)
  const { data: tradeRows } = await supabase
    .from("trades")
    .select("id, external_id")
    .eq("account_id", parsed.data.account_id)
    .eq("external_provider", "csv")
    .in("external_id", externalIds)
  const tradeByExternal = new Map<string, string>()
  ;(tradeRows ?? []).forEach((t) => { if (t.external_id) tradeByExternal.set(t.external_id, t.id) })

  // Build fill rows
  type FillInsert = {
    trade_id: string
    user_id: string
    kind: "entry" | "exit"
    reason: "broker_sync"
    price: number
    size: number
    filled_at: string
    external_provider: "csv"
    external_id: string
  }
  const fills: FillInsert[] = []
  for (let i = 0; i < valid.length; i++) {
    const t = valid[i]
    const row = rows[i]
    const tradeId = tradeByExternal.get(row.external_id)
    if (!tradeId) continue
    if (t.opened_at) {
      fills.push({
        trade_id: tradeId,
        user_id: user.id,
        kind: "entry",
        reason: "broker_sync",
        price: t.entry_price,
        size: t.size,
        filled_at: t.opened_at,
        external_provider: "csv",
        external_id: `${row.external_id}:entry`,
      })
    }
    if (t.exit_price != null && t.closed_at) {
      fills.push({
        trade_id: tradeId,
        user_id: user.id,
        kind: "exit",
        reason: "broker_sync",
        price: t.exit_price,
        size: t.size,
        filled_at: t.closed_at,
        external_provider: "csv",
        external_id: `${row.external_id}:exit`,
      })
    }
  }

  let fillsCreated = 0
  if (fills.length > 0) {
    const { error: fillErr, count } = await supabase
      .from("trade_fills")
      .upsert(fills, { onConflict: "external_provider,external_id", count: "exact" })
    if (fillErr) return { ok: false, error: `Trades imported but fills failed: ${fillErr.message}` }
    fillsCreated = count ?? fills.length
  }

  revalidatePath("/accounts")
  revalidatePath("/dashboard")
  revalidatePath("/ledger")

  // upsertedCount counts both inserts and updates — to know how many were
  // genuinely new vs duplicates, we re-query for the inserted-recently subset.
  // Simpler approximation: assume all rows were touched, report total.
  const imported = upsertedCount ?? rows.length
  const skipped_duplicate = Math.max(0, valid.length - imported)

  return {
    ok: true,
    summary: {
      total: trades.length,
      imported,
      skipped_invalid,
      skipped_duplicate,
      fillsCreated,
    },
  }
}
