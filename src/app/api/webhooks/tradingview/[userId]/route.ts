import { NextResponse } from "next/server"
import { createClient as createServerClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { computePnL, computeR } from "@/lib/finance"

/**
 * TradingView webhook ingest.
 *
 * Per-user URL: /api/webhooks/tradingview/<userId>?secret=<secret>
 *
 * Payload (TradingView alert message, paste this into the alert as JSON):
 * {
 *   "pair": "EUR/USD",
 *   "side": "long",
 *   "entry": 1.08412,
 *   "stop": 1.08200,
 *   "target": 1.08800,
 *   "size": 10000,
 *   "exit": 1.08600,           // optional — if present, trade is closed
 *   "account": "<account_id>", // optional — defaults to user's default account
 *   "playbook": "<playbook_id>", // optional
 *   "mood": "focused",         // optional
 *   "tags": ["A+ setup"],      // optional
 *   "notes": "..."             // optional
 * }
 *
 * Uses the service-role key to insert on behalf of the user, since this
 * endpoint is called by an external system without an auth cookie.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params
  const url = new URL(request.url)
  const providedSecret = url.searchParams.get("secret") ?? request.headers.get("x-webhook-secret")

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "service-role key not configured" }, { status: 500 })
  }

  const admin = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Verify secret
  const { data: settings } = await admin
    .from("user_settings")
    .select("webhook_secret")
    .eq("user_id", userId)
    .maybeSingle()
  if (!settings?.webhook_secret || settings.webhook_secret !== providedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const pair = String(body.pair ?? "").toUpperCase()
  const side = String(body.side ?? "").toLowerCase()
  if (!pair || (side !== "long" && side !== "short")) {
    return NextResponse.json({ error: "pair and side (long|short) required" }, { status: 400 })
  }
  const entry = Number(body.entry)
  if (!isFinite(entry) || entry <= 0) {
    return NextResponse.json({ error: "entry price required" }, { status: 400 })
  }
  const size = Number(body.size ?? 0)
  const stop = body.stop != null ? Number(body.stop) : null
  const target = body.target != null ? Number(body.target) : null
  const exit = body.exit != null ? Number(body.exit) : null
  const status = exit != null ? "closed" : "open"

  // Resolve account: explicit, else default for user.
  let accountId = typeof body.account === "string" ? body.account : null
  if (!accountId) {
    const { data: defaultAcc } = await admin
      .from("accounts")
      .select("id")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle()
    accountId = defaultAcc?.id ?? null
  }
  if (!accountId) {
    return NextResponse.json({ error: "no account on file for user" }, { status: 400 })
  }

  const r = computeR({ side: side as "long" | "short", entry, stop, exit })
  const pnl = computePnL({ side: side as "long" | "short", entry, exit, size })

  const { data: trade, error } = await admin
    .from("trades")
    .insert({
      user_id: userId,
      account_id: accountId,
      pair,
      side,
      entry_price: entry,
      stop_price: stop,
      target_price: target,
      exit_price: exit,
      size: size || 0,
      pnl,
      r,
      status,
      playbook_id: typeof body.playbook === "string" ? body.playbook : null,
      mood: typeof body.mood === "string" ? body.mood : null,
      tags: Array.isArray(body.tags) ? (body.tags as unknown[]).map(String) : [],
      notes: typeof body.notes === "string" ? body.notes : null,
      opened_at: new Date().toISOString(),
      closed_at: status === "closed" ? new Date().toISOString() : null,
    })
    .select("id")
    .single()

  if (error || !trade) {
    return NextResponse.json({ error: error?.message ?? "failed to insert" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, trade_id: trade.id }, { status: 201 })
}

export async function GET() {
  return NextResponse.json(
    { hint: "POST a JSON body with at least pair, side, entry. See route source for schema." },
    { status: 405 },
  )
}
