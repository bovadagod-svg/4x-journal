import "server-only"
import { Resend } from "resend"
import { createClient as createServiceRoleClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { isWin, isLoss, winRatePct } from "@/lib/outcome"

type Supa = SupabaseClient<Database>

/**
 * Weekly digest sender. Used by the cron route at /api/cron/weekly-digest.
 *
 * Activation requires:
 *   - RESEND_API_KEY        — your Resend API key
 *   - SUPABASE_SERVICE_ROLE_KEY — same key #8 needs (we use it to query users)
 *   - EMAIL_FROM            — verified sender address (e.g. "Coach <coach@example.com>")
 *
 * Without these the cron route returns a "not configured" response and skips.
 *
 * Recipient selection: sends to users where `notify_weekly_report = true` AND
 * `email_digest IN ('weekly')`. Daily/monthly support is structured but the
 * actual scheduling lives in vercel.json — currently weekly-only.
 */

export type DigestStatus =
  | { ok: true; sent: number; skipped: number; errors: Array<{ email: string; error: string }> }
  | { ok: false; error: string }

function adminSupabase(): Supa | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createServiceRoleClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function sendWeeklyDigests(): Promise<DigestStatus> {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY not set" }
  if (!process.env.EMAIL_FROM) return { ok: false, error: "EMAIL_FROM not set" }
  const supabase = adminSupabase()
  if (!supabase) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY not set" }

  const resend = new Resend(process.env.RESEND_API_KEY)

  // Find recipients
  const { data: settings, error: settingsErr } = await supabase
    .from("user_settings")
    .select("user_id, display_name, email_digest, notify_weekly_report")
    .eq("notify_weekly_report", true)
    .eq("email_digest", "weekly")
  if (settingsErr) return { ok: false, error: settingsErr.message }
  if (!settings || settings.length === 0) {
    return { ok: true, sent: 0, skipped: 0, errors: [] }
  }

  const errors: Array<{ email: string; error: string }> = []
  let sent = 0
  let skipped = 0

  for (const s of settings) {
    // Resolve user email via auth.users (service role can read this)
    const { data: userResp, error: userErr } = await supabase.auth.admin.getUserById(s.user_id)
    if (userErr || !userResp?.user?.email) {
      skipped++
      continue
    }
    const email = userResp.user.email

    // Compute weekly stats
    const stats = await computeWeeklyStats(supabase, s.user_id)
    if (stats.tradeCount === 0) {
      // Don't send empty digests
      skipped++
      continue
    }

    const html = renderDigestHtml({ displayName: s.display_name ?? email.split("@")[0], stats })
    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: email,
        subject: `Your weekly trading digest — ${stats.weekLabel}`,
        html,
      })
      sent++
    } catch (e) {
      errors.push({ email, error: e instanceof Error ? e.message : "Resend error" })
    }
  }

  return { ok: true, sent, skipped, errors }
}

async function computeWeeklyStats(supabase: Supa, userId: string) {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const { data } = await supabase
    .from("trades")
    .select("pnl, r, status, pair, side, closed_at")
    .eq("user_id", userId)
    .eq("status", "closed")
    .gte("closed_at", sevenDaysAgo.toISOString())

  const closed = data ?? []
  const wins = closed.filter((t) => isWin(Number(t.pnl)))
  const losses = closed.filter((t) => isLoss(Number(t.pnl)))
  const totalPnL = closed.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  const totalR = closed.reduce((s, t) => s + (Number(t.r) || 0), 0)
  const winRate = winRatePct(wins.length, losses.length) ?? 0

  // Top pair by absolute P&L
  const byPair = new Map<string, number>()
  for (const t of closed) {
    byPair.set(t.pair, (byPair.get(t.pair) ?? 0) + (Number(t.pnl) || 0))
  }
  const topPair = Array.from(byPair.entries()).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]

  const weekLabel = `${sevenDaysAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – today`

  return {
    weekLabel,
    tradeCount: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPnL: Number(totalPnL.toFixed(2)),
    avgR: closed.length > 0 ? Number((totalR / closed.length).toFixed(2)) : 0,
    topPair: topPair ? { pair: topPair[0], pnl: Number(topPair[1].toFixed(2)) } : null,
  }
}

function renderDigestHtml({
  displayName,
  stats,
}: {
  displayName: string
  stats: Awaited<ReturnType<typeof computeWeeklyStats>>
}): string {
  const profitable = stats.totalPnL > 0
  const pnlStr = `${profitable ? "+" : ""}$${stats.totalPnL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const pnlColor = profitable ? "#11C458" : stats.totalPnL < 0 ? "#BE333D" : "#9A97A1"

  return `<!DOCTYPE html>
<html>
  <body style="margin: 0; padding: 0; background: #0E0B14; color: #E2DEEA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #0E0B14;">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table width="560" cellpadding="0" cellspacing="0" style="background: #15121C; border: 1px solid #2A2434; border-radius: 14px; overflow: hidden;">
            <tr>
              <td style="padding: 28px 28px 18px;">
                <div style="font-size: 11px; color: #B79CFF; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Weekly digest · ${stats.weekLabel}</div>
                <h1 style="margin: 8px 0 0; font-size: 22px; font-weight: 600; color: #fff;">Hey ${escapeHtml(displayName)},</h1>
                <p style="margin: 6px 0 0; font-size: 14px; color: #9A97A1;">Here's how your week looked.</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 0 28px 18px;">
                <div style="background: #1A1624; border: 1px solid #2A2434; border-radius: 10px; padding: 18px;">
                  <div style="font-size: 11px; color: #6E6878; text-transform: uppercase; letter-spacing: 0.08em;">Net P&amp;L</div>
                  <div style="font-size: 32px; font-weight: 600; color: ${pnlColor}; margin-top: 4px;">${pnlStr}</div>
                  <div style="font-size: 13px; color: #9A97A1; margin-top: 6px;">
                    ${stats.tradeCount} closed · ${stats.wins} wins · ${stats.losses} losses · ${stats.winRate}% WR · avg ${stats.avgR > 0 ? "+" : ""}${stats.avgR}R
                  </div>
                </div>
              </td>
            </tr>
            ${stats.topPair ? `
            <tr>
              <td style="padding: 0 28px 18px;">
                <div style="font-size: 13px; color: #9A97A1;">
                  Top pair this week: <strong style="color: #fff;">${escapeHtml(stats.topPair.pair)}</strong>
                  (${stats.topPair.pnl > 0 ? "+" : ""}$${stats.topPair.pnl.toFixed(2)})
                </div>
              </td>
            </tr>` : ""}
            <tr>
              <td style="padding: 0 28px 28px;">
                <a href="https://4x-journal.vercel.app/dashboard" style="display: inline-block; padding: 10px 18px; background: #6932D4; color: #fff; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 500;">Open dashboard →</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 18px 28px; background: #0E0B14; border-top: 1px solid #2A2434; text-align: center;">
                <div style="font-size: 11px; color: #6E6878;">
                  4x Journal · <a href="https://4x-journal.vercel.app/settings?tab=notifications" style="color: #B79CFF; text-decoration: none;">manage email preferences</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
