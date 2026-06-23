import { formatUSD } from "@/lib/finance"
import type { Trade, JournalEntry } from "@/lib/queries/trades"
import { isWin, isLoss, winRatePct } from "@/lib/outcome"

export function LedgerStatsStrip({
  trades,
  entriesByTrade,
}: {
  trades: Trade[]
  entriesByTrade: Map<string, JournalEntry>
}) {
  const closed = trades.filter((t) => t.status === "closed")
  const total = closed.length
  const wins = closed.filter((t) => isWin(Number(t.pnl))).length
  const losses = closed.filter((t) => isLoss(Number(t.pnl))).length
  const bes = closed.length - wins - losses
  const decisive = wins + losses
  const totalPnl = closed.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  const winRate = winRatePct(wins, losses) ?? 0
  const avgR = total > 0 ? closed.reduce((s, t) => s + (Number(t.r) || 0), 0) / total : 0
  const grossWin = closed.filter((t) => isWin(Number(t.pnl))).reduce((s, t) => s + Number(t.pnl), 0)
  const grossLoss = Math.abs(closed.filter((t) => isLoss(Number(t.pnl))).reduce((s, t) => s + Number(t.pnl), 0))
  const pf = grossLoss > 0 ? grossWin / grossLoss : 0

  // Rule adherence from linked journal entries (no entry = assume followed).
  const linked = trades.map((t) => entriesByTrade.get(t.id)).filter(Boolean) as JournalEntry[]
  const followed = linked.filter((e) => !e.rule_break).length
  const ruleAdherence = linked.length > 0 ? Math.round((followed / linked.length) * 100) : null

  const stats = [
    { label: "Total Trades", value: String(total), sub: `${wins}W · ${losses}L · ${bes}BE`, color: "var(--c-fg)" },
    { label: "Net P&L", value: formatUSD(totalPnl, { signed: true }), sub: "filtered period", color: totalPnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" },
    { label: "Win Rate", value: `${winRate}%`, sub: `${wins} of ${decisive} decisive`, color: "var(--c-fg)" },
    { label: "Avg R", value: `${avgR.toFixed(2)}R`, sub: "per trade", color: avgR >= 1 ? "var(--c-green-bright)" : "var(--c-fg)" },
    { label: "Profit Factor", value: pf.toFixed(2), sub: pf >= 1.5 ? "healthy" : "below target", color: "var(--c-purple-bright)" },
    { label: "Rule Adherence", value: ruleAdherence != null ? `${ruleAdherence}%` : "—", sub: ruleAdherence != null ? "rules followed" : "no entries", color: ruleAdherence != null && ruleAdherence >= 90 ? "var(--c-green-bright)" : "var(--c-amber)" },
  ]

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
      {stats.map((s) => (
        <div key={s.label} className="card" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
          <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: s.color, marginTop: 2 }}>{s.value}</div>
          <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 1 }}>{s.sub}</div>
        </div>
      ))}
    </div>
  )
}
