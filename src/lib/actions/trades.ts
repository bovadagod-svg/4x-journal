"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { computePnL, computeR } from "@/lib/finance"
import { evaluateTrade } from "@/lib/risk"

const TradeSchema = z.object({
  account_id: z.string().uuid({ error: "Pick an account." }),
  pair: z.string().min(3, { error: "Enter a pair." }).max(12).toUpperCase(),
  side: z.enum(["long", "short"]),
  entry_price: z.coerce.number().positive({ error: "Entry price required." }),
  stop_price: z.coerce.number().positive().nullish(),
  target_price: z.coerce.number().positive().nullish(),
  exit_price: z.coerce.number().positive().nullish(),
  size: z.coerce.number().positive({ error: "Size required." }),
  risk_amount: z.coerce.number().nonnegative().nullish(),
  status: z.enum(["open", "closed", "cancelled"]),
  playbook_id: z.string().uuid().nullish().or(z.literal("").transform(() => null)),
  mood: z.string().max(40).nullish().or(z.literal("").transform(() => null)),
  tags: z.string().nullish().transform((s) =>
    s ? s.split(",").map((t) => t.trim()).filter(Boolean) : [],
  ),
  notes: z.string().nullish().or(z.literal("").transform(() => null)),
  opened_at: z.string().nullish(),
})

export type TradeFormState =
  | { ok: true; tradeId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
  | undefined

export async function createTrade(
  _prev: TradeFormState,
  formData: FormData,
): Promise<TradeFormState> {
  const parsed = TradeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: "Some fields need fixing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }
  const v = parsed.data

  // Status sanity: if exit_price provided, force status to closed; if open, clear exit.
  const status = v.exit_price ? "closed" : v.status === "closed" ? "open" : v.status
  const exit_price = status === "closed" ? v.exit_price ?? null : null

  const r = computeR({ side: v.side, entry: v.entry_price, stop: v.stop_price, exit: exit_price })
  const pnl = computePnL({ side: v.side, entry: v.entry_price, exit: exit_price, size: v.size })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  // Pre-flight risk check — block obvious rule breaks before insert.
  const violations = await evaluateTrade({
    accountId: v.account_id,
    riskAmount: v.risk_amount ?? null,
    status,
  })
  if (violations.length > 0) {
    return {
      ok: false,
      error: `Risk rule${violations.length > 1 ? "s" : ""} blocked this trade: ${violations.map((x) => x.message).join(" ")}`,
    }
  }

  const { data: trade, error } = await supabase
    .from("trades")
    .insert({
      user_id: user.id,
      account_id: v.account_id,
      pair: v.pair,
      side: v.side,
      entry_price: v.entry_price,
      stop_price: v.stop_price ?? null,
      target_price: v.target_price ?? null,
      exit_price,
      size: v.size,
      risk_amount: v.risk_amount ?? null,
      pnl,
      r,
      status,
      playbook_id: v.playbook_id || null,
      mood: v.mood,
      tags: v.tags,
      notes: v.notes,
      opened_at: v.opened_at || new Date().toISOString(),
      closed_at: status === "closed" ? new Date().toISOString() : null,
    })
    .select("id")
    .single()

  if (error || !trade) {
    return { ok: false, error: error?.message ?? "Failed to save trade." }
  }

  // If user wrote notes, also create a stub journal entry linked to this trade.
  if (v.notes && v.notes.trim().length > 0) {
    await supabase.from("journal_entries").insert({
      user_id: user.id,
      trade_id: trade.id,
      account_id: v.account_id,
      kind: "trade",
      title: `${v.pair} ${v.side}`,
      pre_trade: v.notes,
      mood: v.mood,
      playbook_id: v.playbook_id || null,
    })
  }

  revalidatePath("/dashboard")
  revalidatePath("/ledger")
  revalidatePath("/journal")
  return { ok: true, tradeId: trade.id }
}

export async function deleteTrade(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("trades").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/ledger")
  revalidatePath("/dashboard")
  revalidatePath("/journal")
  return { ok: true as const }
}

const CloseSchema = z.object({
  id: z.string().uuid(),
  exit_price: z.coerce.number().positive(),
})

export async function closeTrade(formData: FormData) {
  const parsed = CloseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: "Invalid close." }

  const supabase = await createClient()
  const { data: trade } = await supabase
    .from("trades")
    .select("side, entry_price, stop_price, size")
    .eq("id", parsed.data.id)
    .single()

  if (!trade) return { ok: false, error: "Trade not found." }

  const r = computeR({
    side: trade.side as "long" | "short",
    entry: trade.entry_price,
    stop: trade.stop_price,
    exit: parsed.data.exit_price,
  })
  const pnl = computePnL({
    side: trade.side as "long" | "short",
    entry: trade.entry_price,
    exit: parsed.data.exit_price,
    size: trade.size,
  })

  const { error } = await supabase
    .from("trades")
    .update({
      exit_price: parsed.data.exit_price,
      status: "closed",
      closed_at: new Date().toISOString(),
      r,
      pnl,
    })
    .eq("id", parsed.data.id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/ledger")
  revalidatePath("/dashboard")
  return { ok: true as const }
}
