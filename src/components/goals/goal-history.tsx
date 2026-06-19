import { Icon } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import { withAlpha } from "@/lib/color"
import {
  GOAL_METRICS,
  type GoalMetric,
  type GoalRow,
  type PeriodWindow,
  type PeriodActuals,
  actualForMetric,
} from "@/lib/queries/goals"

/**
 * Month-over-month (or week / quarter) goals + actuals + pass/fail rollup.
 * Rendered as a horizontal scroll-able table.
 */
export function GoalHistory({
  goal, periods, actualsByKey,
}: {
  goal: GoalRow
  periods: PeriodWindow[]
  actualsByKey: Map<string, PeriodActuals>
}) {
  const meta = GOAL_METRICS.find((m) => m.metric === goal.metric)
  if (!meta) return null

  const target = Number(goal.target_value)
  const passSummary = periods.reduce(
    (acc, p) => {
      const actuals = actualsByKey.get(p.key)
      if (!actuals) return acc
      const v = actualForMetric(goal.metric as GoalMetric, actuals)
      if (v == null) return acc
      const passed = meta.direction === "higher" ? v >= target : v <= target
      acc.total += 1
      if (passed) acc.passed += 1
      return acc
    },
    { passed: 0, total: 0 },
  )
  const passRate = passSummary.total > 0 ? Math.round((passSummary.passed / passSummary.total) * 100) : null

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--c-border)", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="card-title">{meta.label} — history</h3>
          <p className="card-subtitle">
            Target: {formatTarget(goal.metric as GoalMetric, target)} {meta.direction === "lower" ? "or less" : "or more"}, per {goal.period}
          </p>
        </div>
        {passRate != null && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12, fontWeight: 600,
            padding: "4px 10px",
            background: passRate >= 70 ? "rgba(17, 196, 88, 0.10)" : passRate >= 40 ? "rgba(229, 162, 59, 0.10)" : "rgba(190, 51, 61, 0.10)",
            color: passRate >= 70 ? "var(--c-green-bright)" : passRate >= 40 ? "var(--c-amber)" : "var(--c-red-bright)",
            border: `1px solid ${passRate >= 70 ? "rgba(17, 196, 88, 0.4)" : passRate >= 40 ? "rgba(229, 162, 59, 0.4)" : "rgba(190, 51, 61, 0.4)"}`,
            borderRadius: 999,
          }}>
            <span>{passSummary.passed} / {passSummary.total} hit</span>
            <span style={{ opacity: 0.7 }}>· {passRate}%</span>
          </div>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 600 }}>
          <thead>
            <tr style={{ background: "var(--c-bg-elev-2)" }}>
              <Th>Period</Th>
              <Th align="right">Target</Th>
              <Th align="right">Actual</Th>
              <Th align="right">Δ vs target</Th>
              <Th align="right">Trades</Th>
              <Th align="right">P&L</Th>
              <Th align="center">Result</Th>
            </tr>
          </thead>
          <tbody>
            {periods.slice().reverse().map((p) => {
              const actuals = actualsByKey.get(p.key)
              const v = actuals ? actualForMetric(goal.metric as GoalMetric, actuals) : null
              const passed = v != null && (meta.direction === "higher" ? v >= target : v <= target)
              const delta = v != null ? (meta.direction === "higher" ? v - target : target - v) : null
              const isCurrent = isCurrentPeriod(p)

              return (
                <tr key={p.key} style={{ borderTop: "1px solid var(--c-border)" }}>
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: isCurrent ? "var(--c-fg)" : "var(--c-fg-muted)", fontWeight: isCurrent ? 600 : 400 }}>{p.label}</span>
                      {isCurrent && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: "var(--c-purple-bright)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "1px 5px", background: "rgba(105, 50, 212, 0.12)", borderRadius: 999 }}>
                          current
                        </span>
                      )}
                    </div>
                  </Td>
                  <TdMono align="right">{formatTarget(goal.metric as GoalMetric, target)}</TdMono>
                  <TdMono align="right">
                    {v == null ? "—" : formatActual(goal.metric as GoalMetric, v)}
                  </TdMono>
                  <TdMono align="right" color={delta == null ? "var(--c-fg-muted)" : delta >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)"}>
                    {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${formatActual(goal.metric as GoalMetric, delta)}`}
                  </TdMono>
                  <TdMono align="right" muted>{actuals?.closedTrades ?? 0}</TdMono>
                  <TdMono align="right" color={!actuals ? "var(--c-fg-muted)" : actuals.pnl > 0 ? "var(--c-green-bright)" : actuals.pnl < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)"}>
                    {actuals ? formatUSD(actuals.pnl, { signed: true }) : "—"}
                  </TdMono>
                  <Td align="center">
                    {v == null ? <span style={{ color: "var(--c-fg-dim)", fontSize: 11 }}>no data</span>
                      : isCurrent ? <span style={{ fontSize: 11, color: "var(--c-purple-bright)", fontWeight: 600 }}>in progress</span>
                      : passed ? <span style={badge("var(--c-green-bright)", "rgba(17, 196, 88, 0.10)")}><Icon name="check" size={9} /> hit</span>
                      : <span style={badge("var(--c-red-bright)", "rgba(190, 51, 61, 0.10)")}><Icon name="x" size={9} /> miss</span>}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function badge(color: string, bg: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    fontSize: 11, fontWeight: 600,
    color, background: bg,
    border: `1px solid ${withAlpha(color, 33)}`,
    padding: "2px 8px", borderRadius: 999,
  }
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return <th style={{ padding: "10px 16px", textAlign: align, fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{children}</th>
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return <td style={{ padding: "10px 16px", textAlign: align, verticalAlign: "middle" }}>{children}</td>
}
function TdMono({ children, align = "left", muted, color }: { children: React.ReactNode; align?: "left" | "right" | "center"; muted?: boolean; color?: string }) {
  return (
    <td className="tnum" style={{
      padding: "10px 16px", textAlign: align, verticalAlign: "middle",
      fontFamily: "var(--font-mono)",
      color: color ?? (muted ? "var(--c-fg-muted)" : "var(--c-fg)"),
    }}>
      {children}
    </td>
  )
}

function formatTarget(metric: GoalMetric, value: number): string {
  switch (metric) {
    case "pnl_dollars":         return formatUSD(value, { signed: false })
    case "pnl_pct":             return `${value.toFixed(2)}%`
    case "win_rate":            return `${value.toFixed(0)}%`
    case "avg_r":               return `${value.toFixed(2)}R`
    case "avg_pips":            return `${value.toFixed(0)}p`
    case "profit_factor":       return value.toFixed(2)
    case "rules_followed_pct":  return `${value.toFixed(0)}%`
    case "max_rule_breaks":     return value.toFixed(0)
    case "max_drawdown_pct":    return `${value.toFixed(2)}%`
    case "min_trade_count":     return value.toFixed(0)
  }
}

function formatActual(metric: GoalMetric, value: number): string {
  switch (metric) {
    case "pnl_dollars":         return formatUSD(value, { signed: true })
    case "pnl_pct":             return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
    case "win_rate":            return `${value.toFixed(1)}%`
    case "avg_r":               return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`
    case "avg_pips":            return `${value >= 0 ? "+" : ""}${value.toFixed(1)}p`
    case "profit_factor":       return value.toFixed(2)
    case "rules_followed_pct":  return `${value.toFixed(1)}%`
    case "max_rule_breaks":     return value.toFixed(0)
    case "max_drawdown_pct":    return `${value.toFixed(2)}%`
    case "min_trade_count":     return value.toFixed(0)
  }
}

function isCurrentPeriod(p: PeriodWindow): boolean {
  const now = Date.now()
  return now >= p.start.getTime() && now < p.end.getTime()
}
