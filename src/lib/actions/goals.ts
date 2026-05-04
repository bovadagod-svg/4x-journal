"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const PERIODS = ["weekly", "monthly", "quarterly"] as const
const METRICS = [
  "pnl_pct", "pnl_dollars",
  "win_rate", "avg_r", "avg_pips", "profit_factor",
  "rules_followed_pct", "max_rule_breaks", "max_drawdown_pct",
  "min_trade_count",
] as const

const GoalUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  period: z.enum(PERIODS),
  metric: z.enum(METRICS),
  target_value: z.coerce.number().refine((n) => Number.isFinite(n), { error: "Target must be a number" }),
  enabled: z.boolean().default(true),
})

export type GoalActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

export async function upsertGoal(input: z.input<typeof GoalUpsertSchema>): Promise<GoalActionResult> {
  const parsed = GoalUpsertSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid goal" }
  const { id, period, metric, target_value, enabled } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  if (id) {
    const { error } = await supabase
      .from("goals")
      .update({ period, metric, target_value, enabled })
      .eq("id", id)
      .eq("user_id", user.id)
    if (error) return { ok: false, error: error.message }
    revalidatePath("/goals")
    revalidatePath("/settings")
    return { ok: true, id }
  }

  // Insert with onConflict on the (user_id, period, metric) unique constraint —
  // re-creating an existing pair just updates target/enabled in place.
  const { data, error } = await supabase
    .from("goals")
    .upsert(
      { user_id: user.id, period, metric, target_value, enabled },
      { onConflict: "user_id,period,metric" },
    )
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" }
  revalidatePath("/goals")
  revalidatePath("/settings")
  return { ok: true, id: data.id }
}

export async function deleteGoal(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", user.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/goals")
  revalidatePath("/settings")
  return { ok: true }
}

export async function toggleGoal(id: string, enabled: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { error } = await supabase
    .from("goals")
    .update({ enabled })
    .eq("id", id)
    .eq("user_id", user.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/goals")
  revalidatePath("/settings")
  return { ok: true }
}
