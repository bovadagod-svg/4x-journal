import type { PairPerformance } from "@/lib/queries/analytics"
import { formatUSD } from "@/lib/finance"

export function PairHeatmap({ pairs }: { pairs: PairPerformance[] }) {
  if (pairs.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Pair performance</h3>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--c-fg-muted)" }}>
          Once you log a few trades, win rate and P&L by pair appears here.
        </p>
      </div>
    )
  }

  const max = Math.max(...pairs.map((p) => Math.abs(p.pnl))) || 1

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
        <h3 className="card-title">Pair performance</h3>
        <p className="card-subtitle">Sorted by P&L · color shows magnitude</p>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            <Th>Pair</Th>
            <Th align="right">Trades</Th>
            <Th align="right">Win rate</Th>
            <Th align="right">Avg R</Th>
            <Th align="right">P&L</Th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => {
            const pct = Math.abs(p.pnl) / max
            const tone = p.pnl > 0 ? "green" : p.pnl < 0 ? "red" : undefined
            const bg = tone === "green"
              ? `rgba(45, 219, 115, ${0.05 + pct * 0.18})`
              : tone === "red"
                ? `rgba(224, 74, 85, ${0.05 + pct * 0.18})`
                : "transparent"
            return (
              <tr key={p.pair} style={{ borderTop: "1px solid var(--c-border)", background: bg }}>
                <td style={{ padding: "10px 18px" }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{p.pair}</span>
                </td>
                <td className="mono" style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>{p.trades}</td>
                <td className="mono" style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>{p.winRate != null ? `${p.winRate}%` : "—"}</td>
                <td className="mono" style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>{p.avgR != null ? `${p.avgR > 0 ? "+" : ""}${p.avgR}` : "—"}</td>
                <td className="mono" style={{
                  padding: "10px 18px", textAlign: "right", fontSize: 12, fontWeight: 600,
                  color: tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg)",
                }}>
                  {p.closedTrades > 0 ? formatUSD(p.pnl, { signed: true, max: 0 }) : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{
      textAlign: align,
      padding: "10px 12px",
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--c-fg-dim)",
      background: "var(--c-bg-elev-2)",
      whiteSpace: "nowrap",
    }}>{children}</th>
  )
}
