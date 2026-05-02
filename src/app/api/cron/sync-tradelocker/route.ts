import { NextResponse } from "next/server"
import { listTradeLockerConnections, syncTradeLockerConnectionAdmin } from "@/lib/actions/tradelocker"

/**
 * Daily TradeLocker sync — invoked by Vercel Cron (configured in vercel.json).
 *
 * Auth model:
 *   - Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET
 *     is set as an env var. We require that header to match.
 *   - In dev / preview, hitting this route from a browser without the secret
 *     returns 401 — that's intentional. To trigger manually, run:
 *       curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/sync-tradelocker
 *
 * Each connection sync runs sequentially with its own try/catch so a single
 * broken account doesn't fail the whole sweep. Per-connection errors are
 * already surfaced via broker_connections.last_sync_error so the user sees
 * them in the Accounts UI.
 */
export const dynamic = "force-dynamic"
export const maxDuration = 60 // seconds — Vercel Hobby cap

export async function GET(request: Request) {
  // Auth gate
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }
  const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  if (got !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  // List connections (uses service role)
  const list = await listTradeLockerConnections()
  if (!list.ok) {
    return NextResponse.json({ ok: false, error: list.error }, { status: 500 })
  }
  const ids = list.ids ?? []

  // Sync each, accumulating per-connection results.
  const results: Array<{ id: string; ok: boolean; tradesUpserted?: number; error?: string }> = []
  for (const id of ids) {
    try {
      const r = await syncTradeLockerConnectionAdmin(id)
      results.push({ id, ok: r.ok, tradesUpserted: r.tradesUpserted, error: r.error })
    } catch (e) {
      results.push({
        id,
        ok: false,
        error: e instanceof Error ? e.message : "Unknown error",
      })
    }
  }

  const ranAt = new Date().toISOString()
  const summary = {
    ranAt,
    connections: ids.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    totalTradesUpserted: results.reduce((s, r) => s + (r.tradesUpserted ?? 0), 0),
    results,
  }
  return NextResponse.json({ ok: true, ...summary })
}
