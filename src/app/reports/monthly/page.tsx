import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getUserTrades } from "@/lib/queries/trades"
import { getUserAccounts } from "@/lib/queries/accounts"
import { formatUSD } from "@/lib/finance"
import { isWin, isLoss, winRatePct } from "@/lib/outcome"
import { EquityCurve } from "@/components/analytics/equity-curve"
import { Icon } from "@/components/icons"

/**
 * Print-friendly monthly summary. Outside the dashboard layout — minimal
 * shell so browser print yields a clean page.
 *
 * Query: ?month=YYYY-MM
 */
export default async function MonthlyReport({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { month } = await searchParams
  const target = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7)
  const [yearStr, monthStr] = target.split("-")
  const year = parseInt(yearStr, 10)
  const monthNum = parseInt(monthStr, 10)
  const start = new Date(Date.UTC(year, monthNum - 1, 1))
  const end = new Date(Date.UTC(year, monthNum, 1))

  const [allTrades, accounts] = await Promise.all([
    getUserTrades({ accountId: "all", limit: 5000 }),
    getUserAccounts(),
  ])

  const trades = allTrades.filter((t) => {
    if (!t.opened_at) return false
    const at = new Date(t.opened_at)
    return at >= start && at < end
  })
  const closed = trades.filter((t) => t.status === "closed")
  const wins = closed.filter((t) => isWin(Number(t.pnl)))
  const losses = closed.filter((t) => isLoss(Number(t.pnl)))
  const totalPnL = closed.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  const winRate = winRatePct(wins.length, losses.length)
  const sumWins = wins.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  const sumLosses = Math.abs(losses.reduce((s, t) => s + (Number(t.pnl) || 0), 0))
  const profitFactor = sumLosses > 0 ? Number((sumWins / sumLosses).toFixed(2)) : null
  const accountMap = new Map(accounts.map((a) => [a.id, a]))

  // Equity curve from these closed trades.
  let running = 0
  const curve = closed
    .filter((t): t is typeof t & { closed_at: string } => t.closed_at != null)
    .sort((a, b) => a.closed_at.localeCompare(b.closed_at))
    .map((t) => {
      running += Number(t.pnl) || 0
      return { date: t.closed_at, equity: Number(running.toFixed(2)), tradeId: t.id }
    })

  const monthLabel = start.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })

  return (
    <div className="report-page" style={{ background: "var(--c-bg)", minHeight: "100vh", padding: "24px 32px" }}>
      {/* Print-only stylesheet */}
      <style>{`
        @media print {
          @page { margin: 18mm; }
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .report-page { padding: 0 !important; background: white !important; }
          .card { border: 1px solid #ddd !important; box-shadow: none !important; background: white !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Link href="/reports" className="btn">
          <Icon name="chevronRight" size={12} style={{ transform: "rotate(180deg)" }} /> <span>Back to reports</span>
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <PrintButton />
        </div>
      </div>

      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Monthly summary — {monthLabel}
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--c-fg-muted)" }}>
          {trades.length} trade{trades.length === 1 ? "" : "s"} opened ·{" "}
          {closed.length} closed · {user.email}
        </p>
      </header>

      {trades.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--c-fg-muted)" }}>
          No trades opened in {monthLabel}.
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
            <Stat label="Total P&L" value={formatUSD(totalPnL, { signed: true })} tone={totalPnL > 0 ? "green" : totalPnL < 0 ? "red" : undefined} />
            <Stat label="Win rate" value={winRate != null ? `${winRate}%` : "—"} sublabel={`${wins.length}W · ${losses.length}L`} />
            <Stat label="Closed trades" value={String(closed.length)} sublabel={`${trades.length - closed.length} still open`} />
            <Stat label="Profit factor" value={profitFactor != null ? profitFactor.toString() : "—"} />
          </div>

          {/* Equity curve */}
          {curve.length >= 2 && (
            <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--c-border)" }}>
                <h3 className="card-title">Equity curve · this month</h3>
              </div>
              <div style={{ padding: 16 }}>
                <EquityCurve points={curve} height={220} />
              </div>
            </div>
          )}

          {/* Trades table */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--c-border)" }}>
              <h3 className="card-title">All trades</h3>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Account</Th>
                  <Th>Pair</Th>
                  <Th>Side</Th>
                  <Th align="right">Entry</Th>
                  <Th align="right">Exit</Th>
                  <Th align="right">R</Th>
                  <Th align="right">P&L</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const acc = accountMap.get(t.account_id)
                  return (
                    <tr key={t.id} style={{ borderTop: "1px solid var(--c-border)" }}>
                      <Td>
                        {t.opened_at ? new Date(t.opened_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </Td>
                      <Td>{acc ? acc.label : ""}</Td>
                      <Td><span className="mono">{t.pair}</span></Td>
                      <Td>{t.side}</Td>
                      <Td align="right" mono>{Number(t.entry_price).toFixed(5)}</Td>
                      <Td align="right" mono>{t.exit_price != null ? Number(t.exit_price).toFixed(5) : "—"}</Td>
                      <Td align="right" mono tone={Number(t.r) > 0 ? "green" : Number(t.r) < 0 ? "red" : undefined}>
                        {t.r != null ? `${Number(t.r) > 0 ? "+" : ""}${t.r}R` : "—"}
                      </Td>
                      <Td align="right" mono tone={Number(t.pnl) > 0 ? "green" : Number(t.pnl) < 0 ? "red" : undefined}>
                        {t.pnl != null ? formatUSD(Number(t.pnl), { signed: true }) : "—"}
                      </Td>
                      <Td>{t.status}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <footer style={{ marginTop: 24, fontSize: 11, color: "var(--c-fg-dim)", textAlign: "center" }}>
        Generated {new Date().toLocaleString("en-US")} · 4x Journal
      </footer>
    </div>
  )
}

function PrintButton() {
  return (
    <form action="javascript:window.print()">
      <button type="submit" className="btn btn-primary">
        <Icon name="external" size={13} /> <span>Print / Save PDF</span>
      </button>
    </form>
  )
}

function Stat({ label, value, sublabel, tone }: { label: string; value: string; sublabel?: string; tone?: "green" | "red" }) {
  const color = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg)"
  return (
    <div className="card" style={{ padding: "12px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color, lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sublabel && <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", marginTop: 2 }}>{sublabel}</div>}
    </div>
  )
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{
      textAlign: align,
      padding: "8px 12px",
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--c-fg-dim)",
      background: "var(--c-bg-elev-2)",
    }}>{children}</th>
  )
}

function Td({ children, align = "left", mono, tone }: {
  children: React.ReactNode
  align?: "left" | "right"
  mono?: boolean
  tone?: "green" | "red"
}) {
  const color = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg)"
  return (
    <td style={{
      padding: "8px 12px",
      textAlign: align,
      fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
      color,
      whiteSpace: "nowrap",
    }}>{children}</td>
  )
}
