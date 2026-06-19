"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * Persist the user's dashboard widget visibility preferences. The JSONB column
 * is shaped `{ hidden: string[], order?: string[] }`. `hidden` lists widget
 * IDs to hide; `order` lists row IDs in their preferred order (resolved via
 * `resolveRowOrder` so missing/new rows still render).
 */
export async function setDashboardLayoutHidden(hidden: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

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

/**
 * Persist row order. Pass the user's preferred order of row IDs (matching the
 * IDs in `ROW_CATALOG`). Unknown IDs are tolerated — `resolveRowOrder` filters
 * them at render time.
 */
export async function setDashboardLayoutOrder(order: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: existing } = await supabase
    .from("user_settings")
    .select("dashboard_layout")
    .eq("user_id", user.id)
    .maybeSingle()
  const prev = (existing?.dashboard_layout ?? {}) as Record<string, unknown>
  const next = { ...prev, order: Array.from(new Set(order)) }

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, dashboard_layout: next }, { onConflict: "user_id" })
  if (error) return { ok: false, error: error.message }

  revalidatePath("/dashboard")
  return { ok: true }
}
