"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const PairSchema = z.object({
  pair: z.string().min(3).max(12).toUpperCase(),
  bias: z.enum(["long", "short", "neutral"]).default("neutral"),
  setup_note: z.string().max(400).nullish().or(z.literal("").transform(() => null)),
})

export type WatchlistFormState =
  | { ok: true; id: string }
  | { ok: false; error: string }
  | undefined

export async function addWatchlistPair(
  _prev: WatchlistFormState,
  formData: FormData,
): Promise<WatchlistFormState> {
  const parsed = PairSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, error: "Pair is required." }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { count } = await supabase
    .from("watchlist_pairs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)

  const { data, error } = await supabase
    .from("watchlist_pairs")
    .insert({ ...parsed.data, user_id: user.id, sort_order: count ?? 0 })
    .select("id")
    .single()

  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "That pair is already on your watchlist." }
    return { ok: false, error: error?.message ?? "Failed to add pair." }
  }

  revalidatePath("/watchlist")
  revalidatePath("/dashboard")
  revalidatePath("/calendar")
  return { ok: true, id: data.id }
}

const UpdateSchema = z.object({
  id: z.string().uuid(),
  bias: z.enum(["long", "short", "neutral"]).optional(),
  setup_note: z.string().max(400).nullish().or(z.literal("").transform(() => null)),
})

export async function updateWatchlistPair(formData: FormData) {
  const parsed = UpdateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false as const, error: "Invalid update." }
  const { id, ...rest } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from("watchlist_pairs").update(rest).eq("id", id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath("/watchlist")
  revalidatePath("/dashboard")
  return { ok: true as const }
}

export async function removeWatchlistPair(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("watchlist_pairs").delete().eq("id", id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath("/watchlist")
  revalidatePath("/dashboard")
  revalidatePath("/calendar")
  return { ok: true as const }
}

const MAJORS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF", "NZD/USD", "EUR/GBP", "GBP/JPY"]

export async function applyMajorsPreset() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: "Not signed in." }

  const rows = MAJORS.map((pair, i) => ({ user_id: user.id, pair, bias: "neutral" as const, sort_order: i }))
  const { error } = await supabase.from("watchlist_pairs").upsert(rows, { onConflict: "user_id,pair", ignoreDuplicates: true })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath("/watchlist")
  revalidatePath("/dashboard")
  revalidatePath("/calendar")
  return { ok: true as const }
}
