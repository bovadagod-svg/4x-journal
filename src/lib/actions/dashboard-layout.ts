"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * Persist the user's dashboard widget visibility preferences. v1 is
 * hide-only (drag-reorder is a follow-up); the JSONB column is shaped
 * `{ hidden: string[], order?: string[] }` so reorder can land later
 * without a schema change.
 */
export async function setDashboardLayoutHidden(hidden: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  // Pull existing layout to preserve any future fields (e.g. order).
  const { data: existing } = await supabase
    .from("user_settings")
    .select("dashboard_layout")
    .eq("user_id", user.id)
    .maybeSingle()
  const prev = (existing?.dashboard_layout ?? {}) as Record<string, unknown>
  const next = { ...prev, hidden: Array.from(new Set(hidden)) }

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, dashboard_layout: next }, { onConflict: "user_id" })
  if (error) return { ok: false, error: error.message }

  revalidatePath("/dashboard")
  return { ok: true }
}
