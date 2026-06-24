"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type LoginState = { error: string } | undefined

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase()
  const password = String(formData.get("password") || "")
  if (!email || !password) {
    return { error: "Enter your email and password." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  // Don't leak whether it was the email or the password that was wrong.
  if (error) return { error: "Invalid email or password." }

  // signInWithPassword set the session cookies via the server client; the proxy
  // will see the user on the next request. Send them into the app.
  redirect("/dashboard")
}
