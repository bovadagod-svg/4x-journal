import { Icon, PairFlag } from "@/components/icons"
import type { Trade } from "@/lib/queries/trades"
import { LogTradeButton } from "@/components/trades/log-trade-button"
import { TradeRowActions } from "@/components/trades/trade-row-actions"
import { formatUSD } from "@/lib/finance"
import { formatLotsOrSize } from "@/lib/lots"

/**
 * Full prototype column set: Pair / Side / Size / Entry / Stop / Target /
 * R / Unrealized P&L / Action. We don't have live mark-to-market yet, so the
 * "Current" column from the prototype is dropped — the row's pnl column shows
 * whatever the broker last reported for unrealized P&L (or "—" if unknown).
 */
export function OpenPositions({ trades }: { trades: Trade[] }) {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
        <div>
          <h3 className="card-title">Open positions</h3>
          <p className="card-subtitle">{trades.length === 0 ? "No open trades" : `${trades.length} open`}</p>
        </div>
        <LogTradeButton primary={false} label="New" />
      </div>
      {trades.length === 0 ? (
        <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
          No open positions. Click <strong style={{ color: "var(--c-fg)" }}>Log Trade</strong> to record one.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr>
                <Th>Pair</Th>
                <Th>Side</Th>
                <Th align="right">Size</Th>
                <Th align="right">Entry</Th>
                <Th align="right">Stop</Th>
                <Th align="right">Target</Th>
                <Th align="right">R</Th>
                <Th align="right">P&L</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const pnl = t.pnl != null ? Number(t.pnl) : null
                const r = t.r != null ? Number(t.r) : null
                const pnlTone = pnl == null ? undefined : pnl > 0 ? "green" : pnl < 0 ? "red" : undefined
                return (
                  <tr key={t.id} style={{ borderTop: "1px solid var(--c-border)" }}>
                    <td style={{ padding: "10px 18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <PairFlag pair={t.pair} size={18} />
                        <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{t.pair}</span>
                      </div>
                    </td>
                    <Td>
                      <span className={`chip ${t.side === "long" ? "chip-green" : "chip-red"}`} style={{ fontSize: 10.5 }}>
                        <Icon name={t.side === "long" ? "arrowUp" : "arrowDown"} size={11} />
                        {t.side}
                      </span>
                    </Td>
                    <TdMono align="right">{formatLotsOrSize(t.size, t.contract_size, { withUnit: false })}</TdMono>
                    <TdMono align="right">{Number(t.entry_price).toFixed(5)}</TdMono>
                    <TdMono align="right" tone="dim">{t.stop_price != null ? Number(t.stop_price).toFixed(5) : "—"}</TdMono>
                    <TdMono align="right" tone="dim">{t.target_price != null ? Number(t.target_price).toFixed(5) : "—"}</TdMono>
                    <TdMono align="right" tone={r == null ? undefined : r > 0 ? "green" : r < 0 ? "red" : undefined}>
                      {r != null ? `${r > 0 ? "+" : ""}${r}R` : "—"}
                    </TdMono>
                    <TdMono align="right" tone={pnlTone}>
                      {pnl != null ? formatUSD(pnl, { signed: true }) : "—"}
                    </TdMono>
                    <td style={{ padding: "10px 18px", textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <TradeRowActions tradeId={t.id} status={t.status} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{
      textAlign: align,
      padding: "10px 12px",
      fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
      color: "var(--c-fg-dim)", background: "var(--c-bg-elev-2)", whiteSpace: "nowrap",
    }}>{children}</th>
  )
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "10px 12px" }}>{children}</td>
}
function TdMono({ children, align = "left", tone }: { children: React.ReactNode; align?: "left" | "right"; tone?: "green" | "red" | "dim" }) {
  const color =
    tone === "green" ? "var(--c-green-bright)"
    : tone === "red" ? "var(--c-red-bright)"
    : tone === "dim" ? "var(--c-fg-muted)"
    : "var(--c-fg)"
  return (
    <td style={{
      padding: "10px 12px", textAlign: align,
      fontFamily: "var(--font-mono)", fontSize: 12, color, whiteSpace: "nowrap",
    }}>{children}</td>
  )
}
