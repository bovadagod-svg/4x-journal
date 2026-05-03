import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { toCsv } from "@/lib/csv"
import { matchLots, form8949CsvHeaders, form8949CsvRow } from "@/lib/tax/fifo-matcher"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const url = new URL(request.url)
  const yearStr = url.searchParams.get("year") ?? String(new Date().getFullYear())
  const accountId = url.searchParams.get("account") ?? "all"
  const year = Number(yearStr)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return new NextResponse("Bad year", { status: 400 })
  }

  // Read the user's tax election: §988 → forex is ordinary income; wash-sale
  // rules don't apply. §1256 → 60/40 split (handled elsewhere). For Form 8949
  // generation we keep wash-sale flagging on by default and toggle it off
  // only for the §988 case.
  const { data: settings } = await supabase
    .from("user_settings")
    .select("tax_fx_election")
    .eq("user_id", user.id)
    .maybeSingle()
  const election = settings?.tax_fx_election ?? "988"
  const applyWashSale = election !== "988"

  // Pull the user's closed trades for the year, plus a 30-day buffer on each
  // side so wash-sale matching can see neighboring trades that fall outside
  // the export window.
  const fromBuffer = new Date(`${year}-01-01T00:00:00Z`)
  fromBuffer.setUTCDate(fromBuffer.getUTCDate() - 31)
  const toBuffer = new Date(`${year}-12-31T23:59:59Z`)
  toBuffer.setUTCDate(toBuffer.getUTCDate() + 31)

  let q = supabase
    .from("trades")
    .select("id, pair, side, size, entry_price, exit_price, opened_at, closed_at, pnl, account_id")
    .eq("status", "closed")
    .gte("closed_at", fromBuffer.toISOString())
    .lte("closed_at", toBuffer.toISOString())
  if (accountId !== "all" && accountId !== "") q = q.eq("account_id", accountId)

  const { data: trades, error: tradesErr } = await q
  if (tradesErr) return new NextResponse(tradesErr.message, { status: 500 })

  // Pull broker-cost fills for these trades so we can subtract commission +
  // swap from the gross P&L the matcher returns.
  const tradeIds = (trades ?? []).map((t) => t.id)
  let costsByTrade = new Map<string, { commission: number; swap: number }>()
  if (tradeIds.length > 0) {
    const { data: fills } = await supabase
      .from("trade_fills")
      .select("trade_id, commission, swap")
      .in("trade_id", tradeIds)
    for (const f of fills ?? []) {
      const existing = costsByTrade.get(f.trade_id) ?? { commission: 0, swap: 0 }
      existing.commission += Number(f.commission ?? 0)
      existing.swap += Number(f.swap ?? 0)
      costsByTrade.set(f.trade_id, existing)
    }
  }

  const inputs = (trades ?? []).map((t) => {
    const c = costsByTrade.get(t.id)
    return {
      id: t.id,
      pair: t.pair,
      side: t.side === "long" ? ("long" as const) : ("short" as const),
      size: Number(t.size) || 0,
      entry_price: Number(t.entry_price),
      exit_price: t.exit_price != null ? Number(t.exit_price) : null,
      opened_at: t.opened_at ?? "",
      closed_at: t.closed_at,
      pnl: t.pnl != null ? Number(t.pnl) : null,
      commission_total: c ? c.commission : null,
      swap_total: c ? c.swap : null,
    }
  })

  const result = matchLots(inputs, { applyWashSale })

  // Now narrow rows to the actual export year (we kept neighbors only for
  // wash-sale awareness — they don't belong on this year's Form 8949).
  const yearRows = result.rows.filter((r) => {
    const [, , yyyy] = r.dateSold.split("/")
    return Number(yyyy) === year
  })

  const headers = form8949CsvHeaders()
  const dataRows = yearRows.map(form8949CsvRow)

  // Append a blank line + a totals block so the CSV reconciles to the form.
  const blank = headers.map(() => "")
  const totals: Array<(string | number)[]> = [
    blank,
    ["", "Short-term totals", "", "", result.totals.shortTermProceeds.toFixed(2), result.totals.shortTermBasis.toFixed(2), "", "", result.totals.shortTermGain.toFixed(2), "", ""],
    ["", "Long-term totals",  "", "", result.totals.longTermProceeds.toFixed(2),  result.totals.longTermBasis.toFixed(2),  "", "", result.totals.longTermGain.toFixed(2),  "", ""],
    ["", "Wash-sale adjustment",  "", "", "", "", "", result.totals.washSaleAdjustment.toFixed(2), "", "", ""],
    ["", `Election: §${election}`, "", "", "", "", "", "", "", "", ""],
  ]

  const csv = toCsv(headers, [...dataRows, ...totals])

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="4x-journal-form-8949-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
