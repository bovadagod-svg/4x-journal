"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const AccountSchema = z.object({
  broker: z.string().min(1, { error: "Broker required." }).max(40),
  label: z.string().min(1, { error: "Label required." }).max(60),
  currency: z.string().min(3).max(8).toUpperCase(),
  balance: z.coerce.number().nonnegative().nullish().transform((v) => v ?? 0),
  equity: z.coerce.number().nonnegative().nullish().transform((v) => v ?? 0),
  status: z.enum(["live", "demo", "funded", "challenge"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, { error: "Hex color required." }),
  // #59 Prop firm phase tracking — all optional, only relevant for prop accounts.
  prop_phase: z.enum(["eval", "verification", "funded"]).nullish().or(z.literal("").transform(() => null)),
  prop_starting_balance: z.coerce.number().positive().nullish(),
  prop_profit_target_pct: z.coerce.number().positive().nullish(),
  prop_max_drawdown_pct: z.coerce.number().positive().nullish(),
  prop_max_daily_drawdown_pct: z.coerce.number().positive().nullish(),
  prop_payout_cadence_days: z.coerce.number().int().positive().nullish(),
  prop_next_payout_at: z.string().nullish().or(z.literal("").transform(() => null)),
})

export type AccountFormState =
  | { ok: true; accountId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
  | undefined

export async function createAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = AccountSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: "Some fields need fixing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  // If this is the user's first account, mark it default.
  const { count } = await supabase
    .from("accounts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)

  const { data, error } = await supabase
    .from("accounts")
    .insert({ ...parsed.data, user_id: user.id, is_default: !count })
    .select("id")
    .single()

  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create account." }

  revalidatePath("/accounts")
  revalidatePath("/dashboard")
  return { ok: true, accountId: data.id }
}

const UpdateSchema = AccountSchema.partial().extend({ id: z.string().uuid() })

export async function updateAccount(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = UpdateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: "Some fields need fixing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }
  const { id, ...rest } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from("accounts").update(rest).eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/accounts")
  revalidatePath("/dashboard")
  return { ok: true, accountId: id }
}

export async function deleteAccount(id: string) {
  const supabase = await createClient()
  // Don't allow deleting the last account.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: "Not signed in." }

  const { count } = await supabase
    .from("accounts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
  if ((count ?? 0) <= 1) {
    return { ok: false as const, error: "Can't delete your only account. Add another first." }
  }

  const { error } = await supabase.from("accounts").delete().eq("id", id)
  if (error) return { ok: false as const, error: error.message }

  // If the deleted account was the user's current scope, reset to "all".
  await supabase
    .from("user_settings")
    .update({ account_scope: "all" })
    .eq("user_id", user.id)
    .eq("account_scope", id)

  revalidatePath("/accounts")
  revalidatePath("/dashboard")
  return { ok: true as const }
}

export async function setDefaultAccount(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: "Not signed in." }

  // Clear any existing default, then mark this one.
  await supabase.from("accounts").update({ is_default: false }).eq("user_id", user.id)
  const { error } = await supabase.from("accounts").update({ is_default: true }).eq("id", id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath("/accounts")
  return { ok: true as const }
}
