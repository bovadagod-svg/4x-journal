import { Icon } from "@/components/icons"
import type { Trade } from "@/lib/queries/trades"
import { LogTradeButton } from "@/components/trades/log-trade-button"
import { TradeRowActions } from "@/components/trades/trade-row-actions"

export function OpenPositions({ trades }: { trades: Trade[] }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
        <div>
          <h3 className="card-title">Open positions</h3>
          <p className="card-subtitle">{trades.length} open · close from the row to mark filled</p>
        </div>
        <LogTradeButton primary={false} label="New" />
      </div>
      {trades.length === 0 ? (
        <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
          No open positions. Click <strong style={{ color: "var(--c-fg)" }}>Log Trade</strong> to record one.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid var(--c-border)" }}>
                <td style={{ padding: "10px 18px" }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{t.pair}</span>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span className={`chip ${t.side === "long" ? "chip-green" : "chip-red"}`} style={{ fontSize: 10.5 }}>
                    <Icon name={t.side === "long" ? "arrowUp" : "arrowDown"} size={11} />
                    {t.side}
                  </span>
                </td>
                <td className="mono" style={{ padding: "10px 12px", textAlign: "right", fontSize: 12 }}>
                  Entry: {Number(t.entry_price).toFixed(5)}
                </td>
                <td className="mono" style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, color: "var(--c-fg-muted)" }}>
                  Size: {Number(t.size).toLocaleString()}
                </td>
                <td style={{ padding: "10px 18px", textAlign: "right" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <TradeRowActions tradeId={t.id} status={t.status} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
