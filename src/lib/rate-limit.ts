import "server-only"
import { createClient as createServiceRoleClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

/**
 * Simple Postgres-backed rate limiter for auth-less endpoints (TradingView
 * webhook, public RPCs). Token-bucket-ish: consume 1, returns post-increment
 * count, resets the window when older than `windowSeconds`.
 *
 * Why Postgres over in-memory:
 *   - Vercel Functions are short-lived; in-memory state doesn't persist
 *     across cold starts.
 *   - We already have Supabase; adding Upstash for one feature isn't worth
 *     the new dependency.
 *
 * Activation: requires SUPABASE_SERVICE_ROLE_KEY (the same env var the
 * webhook needs anyway). Without it, `checkRateLimit` returns a permissive
 * "no enforcement" result so we don't accidentally hard-block traffic when
 * the env isn't fully wired.
 */

export type RateLimitResult = {
  /** True when the caller is under the limit. */
  ok: boolean
  /** How many invocations remain in the current window. */
  remaining: number
  /** Number consumed this window (post-increment). */
  count: number
  /** True when enforcement was skipped (env not configured). */
  skipped?: boolean
}

export async function checkRateLimit(
  key: string,
  opts: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Don't fail-closed on misconfiguration — webhook owners should be the
    // ones who notice, and they will via the existing env var checks.
    return { ok: true, remaining: opts.limit, count: 0, skipped: true }
  }
  const supabase = createServiceRoleClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_key: key,
    p_window_seconds: opts.windowSeconds,
  })
  if (error) {
    // On error, fail-open. Better to let traffic through than hard-block on
    // a transient DB issue.
    return { ok: true, remaining: opts.limit, count: 0, skipped: true }
  }
  const count = Number(data) || 0
  return {
    ok: count <= opts.limit,
    remaining: Math.max(0, opts.limit - count),
    count,
  }
}

/**
 * Build a stable rate-limit key from a request. Falls back to user agent
 * when no obvious caller identifier is available.
 */
export function rateLimitKey(scope: string, ...parts: (string | null | undefined)[]): string {
  return `${scope}:${parts.filter(Boolean).join(":")}`
}
