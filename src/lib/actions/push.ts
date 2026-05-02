"use server"

import webpush from "web-push"
import { createClient } from "@/lib/supabase/server"

/**
 * Web Push subscribe / unsubscribe / send.
 *
 * Activation requires:
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY  — shipped to the browser
 *   - VAPID_PRIVATE_KEY             — server-only signing key
 *   - VAPID_SUBJECT                 — mailto:you@example.com (per spec)
 *
 * Generate keys with: `npx web-push generate-vapid-keys`
 */

export type PushSubscribeState =
  | { ok: true; id: string }
  | { ok: false; error: string; configured: boolean }

function configureWebPush(): boolean {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_SUBJECT) {
    return false
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
  return true
}

/**
 * Persist a browser's push subscription. Called from the client after
 * `serviceWorker.pushManager.subscribe(...)` succeeds.
 */
export async function subscribePush(formData: FormData): Promise<PushSubscribeState> {
  const endpoint = String(formData.get("endpoint") ?? "")
  const p256dh = String(formData.get("p256dh") ?? "")
  const auth = String(formData.get("auth") ?? "")
  const userAgent = String(formData.get("user_agent") ?? "")
  if (!endpoint || !p256dh || !auth) {
    return { ok: false, error: "Missing subscription fields.", configured: true }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in.", configured: true }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth, user_agent: userAgent || null },
      { onConflict: "endpoint" },
    )
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Failed to save", configured: true }
  return { ok: true, id: data.id }
}

export async function unsubscribePush(endpoint: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Send a push notification to all the user's registered subscriptions. Used
 * by future alert flows (daily-DD warning, news-window heads-up, etc).
 *
 * Returns counts so callers can log delivery success.
 */
export async function pushToUser(userId: string, payload: { title: string; body: string; url?: string; tag?: string }): Promise<{ sent: number; failed: number }> {
  if (!configureWebPush()) return { sent: 0, failed: 0 }
  const supabase = await createClient()
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        JSON.stringify(payload),
      )
      sent++
    } catch (e) {
      failed++
      // 410 Gone → subscription is dead, clean it up
      if (e instanceof Error && /410|404/.test(e.message)) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint)
      }
    }
  }))
  return { sent, failed }
}
