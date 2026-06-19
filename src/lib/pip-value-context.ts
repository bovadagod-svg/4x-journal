/**
 * Forward-write helpers for `trade_fills.pip_value_acct` (#60).
 *
 * Used by every fill insert path (TL importer, CSV importer, manual createTrade)
 * so new fills land with pip_value_acct populated instead of null. The backfill
 * action at `pip-value-backfill.ts` covers historical fills + any null rows the
 * forward-write couldn't resolve (e.g. metals/indices with no FX rate set).
 *
 * Pattern: call `loadPipValueContext()` once per sync/import to fetch the user's
 * fx_rates + per-account currency map, then call the pure `computePipValueAcct()`
 * helper for each fill row before insert.
 */

import { pipValueInAccountCurrency } from "@/lib/pip"
import { parseFxRates, type FxRates } from "@/lib/money"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type Supa = SupabaseClient<Database>

export type PipValueContext = {
  fxRates: FxRates
  /** account_id → currency code, lowercased to upper at lookup. */
  currencyByAccountId: Map<string, string>
  /** Default account currency when no per-account row exists (rare). */
  fallbackCurrency: string
}

/**
 * Fetch the user's fx_rates + account currency map. Cron + user contexts both
 * supported — caller passes whichever Supabase client (RLS-gated or service-role).
 */
export async function loadPipValueContext(args: {
  supabase: Supa
  userId: string
}): Promise<PipValueContext> {
  const { supabase, userId } = args
  const [{ data: settings }, { data: accounts }] = await Promise.all([
    supabase.from("user_settings").select("fx_rates, display_currency").eq("user_id", userId).maybeSingle(),
    supabase.from("accounts").select("id, currency").eq("user_id", userId),
  ])
  const currencyByAccountId = new Map<string, string>()
  for (const a of accounts ?? []) {
    currencyByAccountId.set(a.id, a.currency ?? "USD")
  }
  return {
    fxRates: parseFxRates(settings?.fx_rates),
    currencyByAccountId,
    fallbackCurrency: settings?.display_currency ?? "USD",
  }
}

/**
 * Pure per-fill pip-value resolver. Returns null when the rate map can't price
 * the pair into the account currency (caller should leave the column NULL, the
 * backfill action will retry once the user adds the missing rate).
 */
export function computePipValueAcct(args: {
  pair: string
  accountId: string
  /** Position size in lots × contract_size. */
  sizeUnits: number
  ctx: PipValueContext
}): number | null {
  const acct = args.ctx.currencyByAccountId.get(args.accountId) ?? args.ctx.fallbackCurrency
  return pipValueInAccountCurrency({
    pair: args.pair,
    sizeUnits: args.sizeUnits,
    accountCurrency: acct,
    fxRates: args.ctx.fxRates,
  })
}
