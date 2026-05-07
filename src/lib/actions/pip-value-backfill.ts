"use server"

import { createClient } from "@/lib/supabase/server"
import { pipValueInAccountCurrency } from "@/lib/pip"
import { parseFxRates } from "@/lib/money"

/**
 * Backfill `trade_fills.pip_value_acct` for fills that haven't been computed
 * yet. Pulls the user's current FX rates and account currencies, then walks
 * fills in batches.
 *
 * Forward-write integration in the TL importer / CSV importer / createTrade
 * is intentionally a follow-up — those paths need user fx_rates threaded in,
 * which the cron-context TL importer doesn't have natively. The backfill
 * action covers existing fills today; new fills land with null and get
 * filled by the next backfill run (manual trigger from Settings).
 */
export async function backfillPipValueAcct(): Promise<{
  ok: true
  scanned: number
  updated: number
  skippedNoRate: number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: true, scanned: 0, updated: 0, skippedNoRate: 0 }

  // Pull user's FX rates + account currency map in parallel.
  const [{ data: settings }, { data: accounts }, { data: fills }] = await Promise.all([
    supabase.from("user_settings").select("fx_rates, display_currency").eq("user_id", user.id).maybeSingle(),
    supabase.from("accounts").select("id, currency").eq("user_id", user.id),
    supabase
      .from("trade_fills")
      .select("id, trade_id, size, pip_value_acct")
      .is("pip_value_acct", null)
      .eq("user_id", user.id)
      .limit(2000), // safety cap per invocation
  ])

  if (!fills || fills.length === 0) {
    return { ok: true, scanned: 0, updated: 0, skippedNoRate: 0 }
  }

  // We need the trade's pair + the trade's account currency for each fill.
  const tradeIds = Array.from(new Set(fills.map((f) => f.trade_id)))
  const { data: trades } = await supabase
    .from("trades")
    .select("id, pair, contract_size, account_id")
    .in("id", tradeIds)
  const tradeById = new Map((trades ?? []).map((t) => [t.id, t]))
  const acctCurrencyById = new Map((accounts ?? []).map((a) => [a.id, a.currency]))
  const fxRates = parseFxRates(settings?.fx_rates)

  let updated = 0
  let skippedNoRate = 0

  // Batch updates one-by-one for now — Supabase doesn't expose a batched
  // .update() with per-row values in JS without raw SQL, and the volume per
  // user is small (typically ≤2k fills total).
  for (const f of fills) {
    const trade = tradeById.get(f.trade_id)
    if (!trade) continue
    const acctCurrency = acctCurrencyById.get(trade.account_id) ?? settings?.display_currency ?? "USD"
    const sizeUnits = Number(f.size) * Number(trade.contract_size || 1)
    const pipValue = pipValueInAccountCurrency({
      pair: trade.pair,
      sizeUnits,
      accountCurrency: acctCurrency,
      fxRates,
    })
    if (pipValue == null) { skippedNoRate += 1; continue }
    await supabase
      .from("trade_fills")
      .update({ pip_value_acct: pipValue })
      .eq("id", f.id)
    updated += 1
  }

  return { ok: true, scanned: fills.length, updated, skippedNoRate }
}
