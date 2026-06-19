"use client"

import { Icon, PairFlag } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import { marginStatusColor, MARGIN_COLOR_VAR } from "@/lib/status"
import { withAlpha } from "@/lib/color"
import type { RiskRule, RiskUsage } from "@/lib/risk"
import type { Account } from "@/components/accounts/accounts-context"
import { RiskRulesForm } from "./risk-rules-form"

export type ExposureRow = {
  id: string
  pair: string
  side: string
  size: number
  risk: number
  stop: number | null
  entry: number
  account_id: string
}

export function RiskAccountCard({
  account,
  rules,
  usage,
  exposure,
  todayClosedPnl,
}: {
  account: Account
  rules: RiskRule | null
  usage: RiskUsage
  exposure: ExposureRow[]
  todayClosedPnl: number
}) {
  // 4 gauge cards: Daily DD, Open Positions, Per-Trade cap, Equity
  const dailyPct = usage.dailyLossLimitUsd
    ? Math.min(100, (usage.dailyLossUsedUsd / usage.dailyLossLimitUsd) * 100)
    : 0
  const openPct = usage.maxOpenPositions
    ? Math.min(100, (usage.openPositions / usage.maxOpenPositions) * 100)
    : 0
  const perTradeUsd = rules?.max_risk_per_trade_usd
    ? Number(rules.max_risk_per_trade_usd)
    : rules?.max_risk_per_trade_pct
      ? account.equity * (Number(rules.max_risk_per_trade_pct) / 100)
      : null

  const totalOpenRisk = exposure.reduce((s, r) => s + r.risk, 0)

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 4, height: 32, borderRadius: 2, background: account.color }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)" }}>{account.label}</div>
          <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>
            {account.broker} · equity <span className="tnum">{formatUSD(account.equity)}</span>
          </div>
        </div>
        <span className={`chip ${rules?.enabled ? "chip-green" : ""}`} style={{ fontSize: 10.5 }}>
          {rules ? (rules.enabled ? "Rules active" : "Rules disabled") : "No rules set"}
        </span>
      </div>

      {/* Gauges */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 0, borderBottom: "1px solid var(--c-border)" }}>
        <GaugeCell
          label="Daily DD used"
          pct={dailyPct}
          value={usage.dailyLossLimitUsd ? formatUSD(-usage.dailyLossUsedUsd, { signed: true }) : "—"}
          sub={usage.dailyLossLimitUsd ? `of ${formatUSD(-usage.dailyLossLimitUsd, { signed: true })}` : "no limit set"}
          inverse={false}
        />
        <GaugeCell
          label="Open positions"
          pct={openPct}
          value={String(usage.openPositions)}
          sub={usage.maxOpenPositions ? `of ${usage.maxOpenPositions} cap` : "no cap"}
          inverse={false}
        />
        <GaugeCell
          label="Today's P&L"
          pct={null}
          value={formatUSD(todayClosedPnl, { signed: true })}
          sub={`${exposure.length} open · ${todayClosedPnl >= 0 ? "green" : "red"} day`}
          color={todayClosedPnl > 0 ? "var(--c-green-bright)" : todayClosedPnl < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)"}
        />
        <GaugeCell
          label="Per-trade cap"
          pct={null}
          value={perTradeUsd ? formatUSD(perTradeUsd) : rules?.max_risk_per_trade_pct ? `${rules.max_risk_per_trade_pct}%` : "—"}
          sub={rules?.max_risk_per_trade_pct ? `${rules.max_risk_per_trade_pct}% of equity` : "no cap"}
        />
        {account.margin_level != null && (
          <GaugeCell
            label="Margin level"
            pct={marginLevelToFillPct(Number(account.margin_level))}
            value={`${Number(account.margin_level).toFixed(0)}%`}
            sub={account.margin_used != null ? `${formatUSD(Number(account.margin_used))} used` : "broker live"}
            color={MARGIN_COLOR_VAR[marginStatusColor(Number(account.margin_level))]}
          />
        )}
      </div>

      {/* Live exposure */}
      {exposure.length > 0 && (
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--c-border)" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
            <h4 style={{ margin: 0, fontSize: 12, fontFamily: "var(--font-display)", fontWeight: 600 }}>Live exposure</h4>
            <span style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>
              total at risk: <span className="tnum" style={{ color: "var(--c-amber)", fontWeight: 600 }}>{formatUSD(-totalOpenRisk, { signed: true })}</span>
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
          <div style={{
            minWidth: 440,
            display: "grid", gridTemplateColumns: "120px 60px 80px 1fr 100px",
            gap: 10, padding: "6px 0",
            fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
            borderBottom: "1px solid var(--c-border)",
          }}>
            <span>Pair</span><span>Side</span><span>Size</span><span style={{ textAlign: "right" }}>Stop</span><span style={{ textAlign: "right" }}>Risk</span>
          </div>
          {exposure.map((e) => (
            <div key={e.id} style={{
              minWidth: 440,
              display: "grid", gridTemplateColumns: "120px 60px 80px 1fr 100px",
              gap: 10, padding: "9px 0",
              borderBottom: "1px solid var(--c-border)",
              alignItems: "center", fontSize: 12,
            }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <PairFlag pair={e.pair} size={14} /> {e.pair}
              </span>
              <span className={`chip ${e.side === "long" ? "chip-green" : "chip-red"}`} style={{ fontSize: 10 }}>{e.side}</span>
              <span className="tnum">{e.size}</span>
              <span className="tnum" style={{ textAlign: "right", color: "var(--c-fg-muted)" }}>{e.stop ?? "—"}</span>
              <span className="tnum" style={{ textAlign: "right", color: "var(--c-amber)", fontWeight: 600 }}>
                {e.risk > 0 ? formatUSD(-e.risk, { signed: true }) : "—"}
              </span>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Form */}
      <div style={{ padding: 18 }}>
        <RiskRulesForm account={account} rules={rules} />
      </div>
    </div>
  )
}

function GaugeCell({
  label,
  pct,
  value,
  sub,
  inverse = false,
  color,
}: {
  label: string
  pct: number | null
  value: string
  sub: string
  inverse?: boolean
  color?: string
}) {
  const barColor = color ?? (
    pct == null
      ? "var(--c-fg-muted)"
      : inverse
        ? pct >= 80 ? "var(--c-green-bright)" : pct >= 50 ? "var(--c-amber)" : "var(--c-fg-muted)"
        : pct >= 80 ? "var(--c-red-bright)" : pct >= 50 ? "var(--c-amber)" : "var(--c-green-bright)"
  )
  return (
    <div style={{ padding: "12px 16px", borderRight: "1px solid var(--c-border)", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: barColor, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {pct != null && (
        <div style={{ height: 4, background: "var(--c-bg-elev-3)", borderRadius: 2, overflow: "hidden", marginTop: 2 }}>
          <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: barColor, transition: "width 0.3s" }} />
        </div>
      )}
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{sub}</div>
    </div>
  )
}

// Map a margin level (a percent like 487%) to a 0–100 gauge fill where lower
// margin = fuller red bar. 100% (margin call) = fill 100; 600%+ = fill 0.
function marginLevelToFillPct(level: number): number {
  return Math.max(0, Math.min(100, 100 - (level - 100) / 5))
}

export function BehavioralSignalsPanel({ signals }: { signals: Array<{ key: string; title: string; level: "good" | "watch" | "high"; desc: string; icon: string }> }) {
  return (
    <div className="card">
      <div style={{ marginBottom: 12 }}>
        <h3 className="card-title">Behavioral Signals</h3>
        <p className="card-subtitle">Patterns derived from your last 7 days of trades and journal entries</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
        {signals.map((s, i) => {
          const colors = { good: "var(--c-green-bright)", watch: "var(--c-amber)", high: "var(--c-red-bright)" }
          const c = colors[s.level]
          return (
            <div key={s.key} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: 12, borderRadius: 8,
              background: "var(--c-bg-elev-2)",
              border: `1px solid ${withAlpha(c, 13)}`,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--c-bg-elev-3)", border: `1px solid ${withAlpha(c, 20)}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name={s.icon as Parameters<typeof Icon>[0]["name"]} size={13} color={c} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{s.title}</span>
                  <span style={{ fontSize: 9, color: c, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{s.level}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            </div>
          )
        })}
        {signals.length === 0 && (
          <div style={{ gridColumn: "1 / -1", padding: 20, textAlign: "center", fontSize: 12, color: "var(--c-fg-muted)" }}>
            Log a few trades to see behavioral signals here.
          </div>
        )}
      </div>
    </div>
  )
}
