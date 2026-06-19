"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { evaluateTrade } from "@/lib/risk"
import { loadPipValueContext, computePipValueAcct } from "@/lib/pip-value-context"
import { ensureSystemPlaybooks } from "@/lib/queries/playbooks"
import { getTeamMemberMap } from "@/lib/queries/teams"
import type { Database } from "@/lib/supabase/database.types"

export type PlaybookOption = Pick<Database["public"]["Tables"]["playbooks"]["Row"], "id" | "name" | "color" | "icon">

export type TradeDetail = {
  trade: Database["public"]["Tables"]["trades"]["Row"]
  fills: Database["public"]["Tables"]["trade_fills"]["Row"][]
  account: Pick<Database["public"]["Tables"]["accounts"]["Row"], "id" | "label" | "broker" | "color" | "currency"> | null
  playbook: PlaybookOption | null
  /** All of the user's playbooks, for the attribution selector in the drawer. */
  playbookOptions: PlaybookOption[]
  /** Display name of the teammate who created this trade (team mode). */
  createdByName: string | null
} | null

export async function getTradeDetail(tradeId: string): Promise<TradeDetail> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Make sure the user's system playbooks (e.g. "Invalid Trades") exist so the
  // attribution selector can always offer them.
  await ensureSystemPlaybooks()

  const [{ data: trade }, { data: fills }, { data: playbookOptions }] = await Promise.all([
    supabase.from("trades").select("*").eq("id", tradeId).maybeSingle(),
    supabase.from("trade_fills").select("*").eq("trade_id", tradeId).order("filled_at", { ascending: true }),
    supabase.from("playbooks").select("id, name, color, icon").order("name"),
  ])

  if (!trade || trade.user_id !== user.id) return null

  const playbook = trade.playbook_id
    ? (playbookOptions ?? []).find((p) => p.id === trade.playbook_id) ?? null
    : null

  const [{ data: account }, memberMap] = await Promise.all([
    supabase.from("accounts").select("id, label, broker, color, currency, user_id").eq("id", trade.account_id).maybeSingle(),
    getTeamMemberMap(),
  ])

  // Attribution rolls up to the account's owner; fall back to whoever logged it.
  const attributedUserId = account?.user_id ?? trade.user_id

  return {
    trade,
    fills: fills ?? [],
    account: account ?? null,
    playbook,
    playbookOptions: playbookOptions ?? [],
    createdByName: memberMap[attributedUserId] ?? null,
  }
}

/**
 * Attribute (or clear) a playbook on an existing trade. Pass null to detach.
 * RLS scopes the update to the owner; we also re-check user_id defensively.
 */
export async function setTradePlaybook(
  tradeId: string,
  playbookId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { error } = await supabase
    .from("trades")
    .update({ playbook_id: playbookId })
    .eq("id", tradeId)
    .eq("user_id", user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath("/ledger")
  revalidatePath("/dashboard")
  revalidatePath("/playbooks")
  revalidatePath("/analytics")
  return { ok: true }
}

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
  status: z.enum(["pending", "open", "closed"]),
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

/**
 * Create a trade in any of three states:
 *   - pending : limit/stop order placed, no fills yet (opened_at NULL)
 *   - open    : entry filled now (1 entry fill written)
 *   - closed  : entry + exit both filled now (1 entry + 1 exit fill)
 *
 * The recompute_trade_aggregates trigger maintains derived fields
 * (entry_price avg, exit_price avg, pnl, r, status, opened_at, closed_at)
 * after each fill insert.
 */
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

  // Status normalization: if exit_price provided, force closed; if open, clear exit.
  const status: "pending" | "open" | "closed" =
    v.exit_price && v.status !== "pending" ? "closed" : v.status
  const exit_price = status === "closed" ? v.exit_price ?? null : null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("require_journal_note, require_journal_mood")
    .eq("user_id", user.id)
    .maybeSingle()

  const fieldErrors: Record<string, string[]> = {}
  if (settings?.require_journal_note && (!v.notes || v.notes.trim().length === 0)) {
    fieldErrors.notes = ["Notes are required."]
  }
  if (settings?.require_journal_mood && (!v.mood || v.mood.trim().length === 0)) {
    fieldErrors.mood = ["Mood is required."]
  }
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Some fields are required by your settings.",
      fieldErrors,
    }
  }

  // Pre-flight risk only fires for actually-open positions (not pending/closed).
  if (status === "open") {
    const violations = await evaluateTrade({
      accountId: v.account_id,
      riskAmount: v.risk_amount ?? null,
      status: "open",
    })
    if (violations.length > 0) {
      return {
        ok: false,
        error: `Risk rule${violations.length > 1 ? "s" : ""} blocked this trade: ${violations.map((x) => x.message).join(" ")}`,
      }
    }
  }

  const now = new Date().toISOString()
  const placedAt = v.opened_at || now

  // 1) Insert parent row. opened_at stays NULL while pending.
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
      size: v.size,
      risk_amount: v.risk_amount ?? null,
      status,
      playbook_id: v.playbook_id || null,
      mood: v.mood,
      tags: v.tags,
      notes: v.notes,
      opened_at: status === "pending" ? null : placedAt,
    })
    .select("id")
    .single()

  if (error || !trade) {
    return { ok: false, error: error?.message ?? "Failed to save trade." }
  }

  // 2) Write fills. Trigger will recompute aggregates.
  if (status === "open" || status === "closed") {
    // Forward-write pip_value_acct (#60). Manual trades don't have a separate
    // contract_size on the form — treat sizeUnits = size (matches how
    // manual-entry trades render today).
    const pipCtx = await loadPipValueContext({ supabase, userId: user.id })
    const pipValueAcct = computePipValueAcct({
      pair: v.pair,
      accountId: v.account_id,
      sizeUnits: v.size,
      ctx: pipCtx,
    })
    const fills: Array<{
      trade_id: string
      user_id: string
      kind: "entry" | "exit"
      reason: "manual"
      price: number
      size: number
      filled_at: string
      pip_value_acct?: number | null
    }> = [
      {
        trade_id: trade.id,
        user_id: user.id,
        kind: "entry",
        reason: "manual",
        price: v.entry_price,
        size: v.size,
        filled_at: placedAt,
        pip_value_acct: pipValueAcct,
      },
    ]
    if (status === "closed" && exit_price != null) {
      fills.push({
        trade_id: trade.id,
        user_id: user.id,
        kind: "exit",
        reason: "manual",
        price: exit_price,
        size: v.size,
        filled_at: now,
        pip_value_acct: pipValueAcct,
      })
    }
    const { error: fillErr } = await supabase.from("trade_fills").insert(fills)
    if (fillErr) {
      // Roll back the parent insert to keep state consistent.
      await supabase.from("trades").delete().eq("id", trade.id)
      return { ok: false, error: fillErr.message }
    }
  }

  // 3) Auto-create journal entry from notes
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

// ─── Fill-level operations ─────────────────────────────────────────────────

const ExitFillSchema = z.object({
  trade_id: z.string().uuid(),
  price: z.coerce.number().positive(),
  size: z.coerce.number().positive(),
  filled_at: z.string().optional(),
  reason: z.enum(["manual", "stop", "target", "liquidation"]).default("manual"),
  notes: z.string().optional(),
})

/**
 * Add an exit fill — used for scale-outs, full closes, stop hits, target hits.
 * Trigger recomputes parent aggregates and flips status to 'closed' when total
 * exit size reaches entry size.
 */
export async function addExitFill(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const parsed = ExitFillSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  // Guard: don't over-exit. Sum existing exits + this new size <= total entry size.
  const { data: trade } = await supabase
    .from("trades")
    .select("size, status, user_id")
    .eq("id", parsed.data.trade_id)
    .single()
  if (!trade) return { ok: false, error: "Trade not found." }
  if (trade.user_id !== user.id) return { ok: false, error: "Not your trade." }
  if (trade.status === "pending") return { ok: false, error: "Pending order has no entry yet — fill it first." }
  if (trade.status === "cancelled") return { ok: false, error: "Trade was cancelled." }

  const { data: exits } = await supabase
    .from("trade_fills")
    .select("size")
    .eq("trade_id", parsed.data.trade_id)
    .eq("kind", "exit")
  const exitedSoFar = (exits ?? []).reduce((s, f) => s + Number(f.size), 0)
  const remaining = Number(trade.size) - exitedSoFar
  if (parsed.data.size > remaining + 0.000001) {
    return { ok: false, error: `Cannot exit ${parsed.data.size} — only ${remaining.toFixed(2)} of position is open.` }
  }

  const { error } = await supabase.from("trade_fills").insert({
    trade_id: parsed.data.trade_id,
    user_id: user.id,
    kind: "exit",
    reason: parsed.data.reason,
    price: parsed.data.price,
    size: parsed.data.size,
    filled_at: parsed.data.filled_at || new Date().toISOString(),
    notes: parsed.data.notes ?? null,
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath("/ledger")
  revalidatePath("/dashboard")
  return { ok: true }
}

const EntryFillSchema = z.object({
  trade_id: z.string().uuid(),
  price: z.coerce.number().positive(),
  size: z.coerce.number().positive(),
  filled_at: z.string().optional(),
  reason: z.enum(["manual", "broker_sync"]).default("manual"),
  notes: z.string().optional(),
})

/**
 * Add an entry fill — for scale-ins, or filling a pending order.
 */
export async function addEntryFill(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const parsed = EntryFillSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: trade } = await supabase
    .from("trades")
    .select("status, user_id")
    .eq("id", parsed.data.trade_id)
    .single()
  if (!trade) return { ok: false, error: "Trade not found." }
  if (trade.user_id !== user.id) return { ok: false, error: "Not your trade." }
  if (trade.status === "cancelled") return { ok: false, error: "Trade was cancelled." }
  if (trade.status === "closed") return { ok: false, error: "Trade is already closed." }

  const { error } = await supabase.from("trade_fills").insert({
    trade_id: parsed.data.trade_id,
    user_id: user.id,
    kind: "entry",
    reason: parsed.data.reason,
    price: parsed.data.price,
    size: parsed.data.size,
    filled_at: parsed.data.filled_at || new Date().toISOString(),
    notes: parsed.data.notes ?? null,
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath("/ledger")
  revalidatePath("/dashboard")
  return { ok: true }
}

const CancelPendingSchema = z.object({
  trade_id: z.string().uuid(),
  reason: z.string().max(120).optional(),
})

export async function cancelPendingOrder(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const parsed = CancelPendingSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: trade } = await supabase
    .from("trades")
    .select("status, user_id")
    .eq("id", parsed.data.trade_id)
    .single()
  if (!trade || trade.user_id !== user.id) return { ok: false, error: "Trade not found." }
  if (trade.status !== "pending") return { ok: false, error: "Can only cancel pending orders." }

  const { error } = await supabase
    .from("trades")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: parsed.data.reason ?? "manual",
    })
    .eq("id", parsed.data.trade_id)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/ledger")
  revalidatePath("/dashboard")
  return { ok: true }
}

const FillPendingSchema = z.object({
  trade_id: z.string().uuid(),
  price: z.coerce.number().positive().optional(),
  size: z.coerce.number().positive().optional(),
  filled_at: z.string().optional(),
})

/**
 * Mark a pending order as filled — inserts an entry fill at the limit price
 * and the requested size (defaults to the pending row's entry_price + size).
 * Trigger flips status to 'open'.
 */
export async function markPendingFilled(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const parsed = FillPendingSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: trade } = await supabase
    .from("trades")
    .select("user_id, status, entry_price, size")
    .eq("id", parsed.data.trade_id)
    .single()
  if (!trade || trade.user_id !== user.id) return { ok: false, error: "Trade not found." }
  if (trade.status !== "pending") return { ok: false, error: "Order is not pending." }

  const { error } = await supabase.from("trade_fills").insert({
    trade_id: parsed.data.trade_id,
    user_id: user.id,
    kind: "entry",
    reason: "manual",
    price: parsed.data.price ?? Number(trade.entry_price),
    size: parsed.data.size ?? Number(trade.size),
    filled_at: parsed.data.filled_at || new Date().toISOString(),
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath("/ledger")
  revalidatePath("/dashboard")
  return { ok: true }
}

// Legacy quick-close: kept for the existing TradeRowActions caller.
const CloseSchema = z.object({
  id: z.string().uuid(),
  exit_price: z.coerce.number().positive(),
})

export async function closeTrade(formData: FormData) {
  const parsed = CloseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: "Invalid close." }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  // Compute remaining open size and write a single exit fill for it.
  const { data: trade } = await supabase
    .from("trades")
    .select("size, status, user_id")
    .eq("id", parsed.data.id)
    .single()
  if (!trade) return { ok: false, error: "Trade not found." }
  if (trade.user_id !== user.id) return { ok: false, error: "Not your trade." }
  if (trade.status !== "open") return { ok: false, error: "Trade is not open." }

  const { data: exits } = await supabase
    .from("trade_fills")
    .select("size")
    .eq("trade_id", parsed.data.id)
    .eq("kind", "exit")
  const exitedSoFar = (exits ?? []).reduce((s, f) => s + Number(f.size), 0)
  const remaining = Number(trade.size) - exitedSoFar
  if (remaining <= 0) return { ok: false, error: "Already fully closed." }

  const { error } = await supabase.from("trade_fills").insert({
    trade_id: parsed.data.id,
    user_id: user.id,
    kind: "exit",
    reason: "manual",
    price: parsed.data.exit_price,
    size: remaining,
    filled_at: new Date().toISOString(),
  })

  if (error) return { ok: false, error: error.message }
  revalidatePath("/ledger")
  revalidatePath("/dashboard")
  return { ok: true as const }
}
