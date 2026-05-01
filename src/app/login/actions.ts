"use server"

import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export type LoginState =
  | { ok: true; sentTo: string }
  | { ok: false; error: string }
  | undefined

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." }
  }

  const supabase = await createClient()
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "http"
  const host = h.get("host") ?? "localhost:3000"
  const origin = `${proto}://${host}`

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: true,
    },
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true, sentTo: email }
}
