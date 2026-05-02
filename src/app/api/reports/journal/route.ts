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

  let q = supabase
    .from("journal_entries")
    .select("*")
    .order("created_at", { ascending: false })

  if (from) q = q.gte("created_at", `${from}T00:00:00Z`)
  if (to) q = q.lte("created_at", `${to}T23:59:59Z`)

  const { data, error } = await q
  if (error) return new NextResponse(error.message, { status: 500 })

  const rows = (data ?? []).map((e) => [
    e.created_at,
    e.last_edited_at,
    e.kind,
    e.title ?? "",
    e.mood ?? "",
    (e.tags ?? []).join("; "),
    (e.pre_trade ?? "").replace(/\n/g, " "),
    (e.post_trade ?? "").replace(/\n/g, " "),
    (e.cold_review ?? "").replace(/\n/g, " "),
    (e.lessons ?? "").replace(/\n/g, " "),
    e.rule_break ? "yes" : "",
    (e.rule_break_tags ?? []).join("; "),
    e.trade_id ?? "",
  ])

  const csv = toCsv(
    [
      "created_at", "last_edited_at", "kind", "title", "mood", "tags",
      "pre_trade", "post_trade", "cold_review", "lessons",
      "rule_break", "rule_break_tags", "trade_id",
    ],
    rows,
  )

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="4x-journal-entries-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
