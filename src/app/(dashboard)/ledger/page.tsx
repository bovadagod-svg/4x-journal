import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { getUserTrades } from "@/lib/queries/trades"
import { getUserAccounts } from "@/lib/queries/accounts"
import { formatUSD } from "@/lib/finance"
import { TradeRowActions } from "@/components/trades/trade-row-actions"
import { LogTradeButton } from "@/components/trades/log-trade-button"

export default async function LedgerPage() {
  const m = SECTION_META.ledger
  const [trades, accounts] = await Promise.all([getUserTrades(), getUserAccounts()])
  const accountMap = new Map(accounts.map((a) => [a.id, a]))

  if (trades.length === 0) {
    return (
      <>
        <SectionHeader
          title={m.title}
          subtitle={m.subtitle}
          actions={<LogTradeButton label="Log first trade" />}
        />
        <SectionStub
          icon={m.icon}
          title="Your ledger is empty"
          description="Every trade you log lands here — entry, exit, R, P&L, mood, rules. Tap “Log Trade” in the top bar (or the button up there ↑) to add your first."
        />
      </>
    )
  }

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={`${trades.length} trade${trades.length === 1 ? "" : "s"}`}
        actions={<LogTradeButton />}
      />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Account</Th>
                <Th>Pair</Th>
                <Th>Side</Th>
                <Th align="right">Entry</Th>
                <Th align="right">Exit</Th>
                <Th align="right">Size</Th>
                <Th align="right">R</Th>
                <Th align="right">P&L</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => {
                const acc = accountMap.get(t.account_id)
                const pnlNum = Number(t.pnl)
                const rNum = Number(t.r)
                return (
                  <tr key={t.id} style={{ borderTop: "1px solid var(--c-border)" }}>
                    <Td>
                      <span style={{ fontSize: 12, color: "var(--c-fg)" }}>
                        {new Date(t.opened_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)", display: "block", marginTop: 2 }}>
                        {new Date(t.opened_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </Td>
                    <Td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: acc?.color ?? "var(--c-fg-dim)" }} />
                        <span style={{ fontSize: 12 }}>{acc?.label ?? "?"}</span>
                      </div>
                    </Td>
                    <Td><span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{t.pair}</span></Td>
                    <Td>
                      <span className={`chip ${t.side === "long" ? "chip-green" : "chip-red"}`} style={{ fontSize: 10.5 }}>
                        <Icon name={t.side === "long" ? "arrowUp" : "arrowDown"} size={11} />
                        {t.side}
                      </span>
                    </Td>
                    <TdMono align="right">{Number(t.entry_price).toFixed(5)}</TdMono>
                    <TdMono align="right">{t.exit_price != null ? Number(t.exit_price).toFixed(5) : "—"}</TdMono>
                    <TdMono align="right">{Number(t.size).toLocaleString()}</TdMono>
                    <TdMono align="right" tone={rNum > 0 ? "green" : rNum < 0 ? "red" : undefined}>
                      {t.r != null ? `${rNum > 0 ? "+" : ""}${rNum}R` : "—"}
                    </TdMono>
                    <TdMono align="right" tone={pnlNum > 0 ? "green" : pnlNum < 0 ? "red" : undefined}>
                      {t.pnl != null ? formatUSD(pnlNum, { signed: true }) : "—"}
                    </TdMono>
                    <Td>
                      <span className={`chip ${t.status === "open" ? "chip-purple" : t.status === "closed" ? "chip-green" : ""}`} style={{ fontSize: 10.5 }}>
                        {t.status}
                      </span>
                    </Td>
                    <Td align="right">
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <TradeRowActions tradeId={t.id} status={t.status} />
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12.5,
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

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td style={{ padding: "10px 12px", textAlign: align, color: "var(--c-fg)", whiteSpace: "nowrap" }}>{children}</td>
}

function TdMono({ children, align = "left", tone }: { children: React.ReactNode; align?: "left" | "right"; tone?: "green" | "red" }) {
  const color = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg)"
  return (
    <td style={{
      padding: "10px 12px",
      textAlign: align,
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      color,
      whiteSpace: "nowrap",
    }}>{children}</td>
  )
}
