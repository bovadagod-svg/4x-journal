import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { toCsv } from "@/lib/csv"

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const url = new URL(request.url)
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")
  const accountId = url.searchParams.get("account") // "" or "all" → all accounts
  const status = url.searchParams.get("status") // "all" | "open" | "closed"

  let q = supabase
    .from("trades")
    .select("*, accounts!inner(broker, label, currency)")
    .order("opened_at", { ascending: false })

  if (from) q = q.gte("opened_at", `${from}T00:00:00Z`)
  if (to) q = q.lte("opened_at", `${to}T23:59:59Z`)
  if (accountId && accountId !== "all" && accountId !== "") q = q.eq("account_id", accountId)
  if (status && status !== "all") q = q.eq("status", status)

  const { data, error } = await q
  if (error) return new NextResponse(error.message, { status: 500 })

  const rows = (data ?? []).map((t) => {
    const acc = (t.accounts as unknown as { broker: string; label: string; currency: string }) ?? null
    return [
      t.opened_at,
      t.closed_at ?? "",
      acc ? `${acc.broker} · ${acc.label}` : "",
      acc?.currency ?? "",
      t.pair,
      t.side,
      t.entry_price,
      t.stop_price ?? "",
      t.target_price ?? "",
      t.exit_price ?? "",
      t.size,
      t.risk_amount ?? "",
      t.pnl ?? "",
      t.r ?? "",
      t.status,
      t.mood ?? "",
      (t.tags ?? []).join("; "),
      (t.notes ?? "").replace(/\n/g, " "),
    ]
  })

  const csv = toCsv(
    [
      "opened_at", "closed_at", "account", "currency",
      "pair", "side",
      "entry_price", "stop_price", "target_price", "exit_price",
      "size", "risk_amount", "pnl", "r",
      "status", "mood", "tags", "notes",
    ],
    rows,
  )

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="4x-journal-trades-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
