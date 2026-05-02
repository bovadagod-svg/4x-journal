import { Icon } from "@/components/icons"
import type { Trade } from "@/lib/queries/trades"
import { formatUSD } from "@/lib/finance"
import Link from "next/link"

export function RecentTrades({ trades }: { trades: Trade[] }) {
  const closed = trades.filter((t) => t.status === "closed").slice(0, 6)

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
        <div>
          <h3 className="card-title">Recent closed trades</h3>
          <p className="card-subtitle">{closed.length === 0 ? "Nothing yet" : `Last ${closed.length} closed`}</p>
        </div>
        <Link href="/ledger" className="btn" style={{ fontSize: 12 }}>View all</Link>
      </div>
      {closed.length === 0 ? (
        <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
          Once you log or sync closed trades, they show up here.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <tbody>
            {closed.map((t) => {
              const pnl = Number(t.pnl)
              const r = Number(t.r)
              const tone = pnl > 0 ? "green" : pnl < 0 ? "red" : undefined
              const color = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg)"
              return (
                <tr key={t.id} style={{ borderTop: "1px solid var(--c-border)" }}>
                  <td style={{ padding: "10px 18px", whiteSpace: "nowrap" }}>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{t.pair}</span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className={`chip ${t.side === "long" ? "chip-green" : "chip-red"}`} style={{ fontSize: 10.5 }}>
                      <Icon name={t.side === "long" ? "arrowUp" : "arrowDown"} size={11} />
                      {t.side}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--c-fg-muted)", whiteSpace: "nowrap" }}>
                    {t.r != null ? `${r > 0 ? "+" : ""}${r}R` : "—"}
                  </td>
                  <td style={{ padding: "10px 18px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color, whiteSpace: "nowrap" }}>
                    {t.pnl != null ? formatUSD(pnl, { signed: true }) : "—"}
                  </td>
                  <td style={{ padding: "10px 18px", textAlign: "right", fontSize: 11, color: "var(--c-fg-dim)", whiteSpace: "nowrap" }}>
                    {t.closed_at
                      ? new Date(t.closed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : ""}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
