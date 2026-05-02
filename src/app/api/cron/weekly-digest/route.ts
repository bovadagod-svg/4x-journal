import { NextResponse } from "next/server"
import { sendWeeklyDigests } from "@/lib/email/weekly-digest"

/**
 * Weekly digest cron — Sundays 18:00 UTC (configured in vercel.json).
 *
 * Auth: same Bearer-CRON_SECRET pattern as the TradeLocker cron.
 *
 * Required env (cron returns ok=false with explicit error otherwise):
 *   - CRON_SECRET
 *   - RESEND_API_KEY
 *   - EMAIL_FROM
 *   - SUPABASE_SERVICE_ROLE_KEY
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 500 })
  }
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (got !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const result = await sendWeeklyDigests()
  return NextResponse.json({ ranAt: new Date().toISOString(), ...result })
}
