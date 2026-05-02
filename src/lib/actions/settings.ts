"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function regenerateWebhookSecret() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: "Not signed in." }

  // Use crypto.randomUUID + timestamp for entropy. 36 chars hex-ish.
  const secret = `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`.slice(0, 48)

  const { error } = await supabase
    .from("user_settings")
    .update({ webhook_secret: secret })
    .eq("user_id", user.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath("/settings")
  return { ok: true as const, secret }
}

export async function deleteAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Delete signs the user out + cascades user_id rows via FK on delete cascade.
  // Note: requires service role for `auth.users` deletion. With anon key we
  // can only delete our own related rows + sign out. The auth row stays
  // until an admin cleans it up; effectively the user account is bricked.
  await supabase.from("user_settings").delete().eq("user_id", user.id)
  await supabase.from("watchlist_pairs").delete().eq("user_id", user.id)
  await supabase.from("playbooks").delete().eq("user_id", user.id)
  await supabase.from("trades").delete().eq("user_id", user.id)
  await supabase.from("journal_entries").delete().eq("user_id", user.id)
  await supabase.from("risk_rules").delete().eq("user_id", user.id)
  await supabase.from("accounts").delete().eq("user_id", user.id)
  await supabase.auth.signOut()
  redirect("/login")
}
