"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const RiskSchema = z.object({
  account_id: z.string().uuid(),
  enabled: z.coerce.boolean(),
  max_risk_per_trade_pct: z.coerce.number().min(0).max(100).nullish().or(z.literal("").transform(() => null)),
  max_risk_per_trade_usd: z.coerce.number().min(0).nullish().or(z.literal("").transform(() => null)),
  daily_loss_limit_pct: z.coerce.number().min(0).max(100).nullish().or(z.literal("").transform(() => null)),
  daily_loss_limit_usd: z.coerce.number().min(0).nullish().or(z.literal("").transform(() => null)),
  max_open_positions: z.coerce.number().int().min(0).nullish().or(z.literal("").transform(() => null)),
  prop_firm_template: z.string().nullish().or(z.literal("").transform(() => null)),
})

export type RiskFormState =
  | { ok: true }
  | { ok: false; error: string }
  | undefined

export async function upsertRiskRules(
  _prev: RiskFormState,
  formData: FormData,
): Promise<RiskFormState> {
  const parsed = RiskSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, error: "Some fields are invalid." }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { error } = await supabase
    .from("risk_rules")
    .upsert({ ...parsed.data, user_id: user.id }, { onConflict: "account_id" })

  if (error) return { ok: false, error: error.message }

  revalidatePath("/risk")
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function deleteRiskRules(accountId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("risk_rules").delete().eq("account_id", accountId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath("/risk")
  revalidatePath("/dashboard")
  return { ok: true as const }
}
