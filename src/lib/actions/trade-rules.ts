"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

/**
 * #72 Coach AI suggestions → enforceable rules.
 *
 * v1 supports one rule kind: `block_pair_side`. Payload shape:
 *   { pair: "EUR/USD", side: "short" | "long" }
 *
 * Severity:
 *   - "warn" — soft confirm() before submit
 *   - "block" — hard fail on the server (not implemented in v1; UI-only)
 *
 * Source:
 *   - "manual" — user added directly via Settings
 *   - "coach" — promoted from a Coach AI suggestion
 *
 * Future kinds (not implemented yet):
 *   - cooldown_after_loss: { minutes: 15 }
 *   - daily_max_trades: { count: 5 }
 *   - max_risk_per_trade_pct: { pct: 1.5 }
 */

export type TradeRule = {
  id: string
  kind: string
  payload: Record<string, unknown>
  reason: string | null
  source: "manual" | "coach"
  enabled: boolean
  severity: "warn" | "block"
  created_at: string
}

const CreateSchema = z.object({
  kind: z.enum(["block_pair_side"]),
  payload: z.object({
    pair: z.string().min(3).max(20),
    side: z.enum(["long", "short"]),
  }).passthrough(),
  reason: z.string().max(280).nullish(),
  source: z.enum(["manual", "coach"]).default("manual"),
  severity: z.enum(["warn", "block"]).default("warn"),
})

export async function createTradeRule(input: z.input<typeof CreateSchema>): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = CreateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rule." }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  // Cast through JSON.parse(JSON.stringify(...)) to satisfy the Json column type
  // — the parsed payload has an index signature from .passthrough() which TS
  // doesn't structurally accept as the recursive Json union.
  const payloadJson = JSON.parse(JSON.stringify(parsed.data.payload))
  const { data, error } = await supabase
    .from("user_trade_rules")
    .insert({
      user_id: user.id,
      kind: parsed.data.kind,
      payload: payloadJson,
      reason: parsed.data.reason ?? null,
      source: parsed.data.source,
      severity: parsed.data.severity,
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create rule." }
  revalidatePath("/settings")
  return { ok: true, id: data.id }
}

export async function listTradeRules(): Promise<TradeRule[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from("user_trade_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  return (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind,
    payload: (r.payload as Record<string, unknown>) ?? {},
    reason: r.reason,
    source: (r.source as "manual" | "coach") ?? "manual",
    enabled: r.enabled,
    severity: (r.severity as "warn" | "block") ?? "warn",
    created_at: r.created_at,
  }))
}

export async function toggleTradeRule(id: string, enabled: boolean): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  await supabase.from("user_trade_rules").update({ enabled }).eq("id", id).eq("user_id", user.id)
  revalidatePath("/settings")
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function deleteTradeRule(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  await supabase.from("user_trade_rules").delete().eq("id", id).eq("user_id", user.id)
  revalidatePath("/settings")
  return { ok: true }
}

/**
 * Pre-flight check used by LogTradeModal. Returns the matching warning
 * messages for a proposed trade. Caller decides whether to confirm() or
 * fail-soft.
 */
export async function getTradeRuleWarnings(opts: { pair: string; side: "long" | "short" }): Promise<{
  warnings: Array<{ rule_id: string; severity: "warn" | "block"; message: string }>
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { warnings: [] }
  const { data } = await supabase
    .from("user_trade_rules")
    .select("id, kind, payload, severity, reason")
    .eq("user_id", user.id)
    .eq("enabled", true)
  const rules = data ?? []
  const warnings: Array<{ rule_id: string; severity: "warn" | "block"; message: string }> = []
  for (const r of rules) {
    if (r.kind !== "block_pair_side") continue
    const p = (r.payload as { pair?: string; side?: string }) ?? {}
    if (typeof p.pair !== "string" || typeof p.side !== "string") continue
    if (p.pair.toUpperCase() === opts.pair.toUpperCase() && p.side === opts.side) {
      warnings.push({
        rule_id: r.id,
        severity: (r.severity as "warn" | "block") ?? "warn",
        message: `Your rule says: no ${p.side} on ${p.pair}${r.reason ? ` (${r.reason})` : ""}.`,
      })
    }
  }
  return { warnings }
}
