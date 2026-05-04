import { formatUSD } from "@/lib/finance"
import { Icon } from "@/components/icons"
import {
  GOAL_METRICS,
  type GoalMetric,
  type GoalRow,
  type PeriodActuals,
  type PeriodWindow,
  actualForMetric,
} from "@/lib/queries/goals"

/**
 * One goal rendered as a premium card with its progress bar + headline
 * stats + remaining-distance line. The bar variant is chosen by the
 * metric's `symmetricBar` flag — monetary goals render a centered bar
 * (start in middle, target right, drawdown left) while everything else
 * uses a linear bar (0 left → target right).
 */
export function GoalCard({
  goal, actuals, window: w,
}: {
  goal: GoalRow
  actuals: PeriodActuals
  window: PeriodWindow
}) {
  const meta = GOAL_METRICS.find((m) => m.metric === goal.metric)
  if (!meta) return null

  const target = Number(goal.target_value)
  const actual = actualForMetric(goal.metric as GoalMetric, actuals)

  const remainingMs = w.end.getTime() - Date.now()
  const remainingLabel = formatRemaining(remainingMs)

  return (
    <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            {meta.label}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>
              {w.label}
            </span>
            {remainingMs > 0 && (
              <span style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>{remainingLabel}</span>
            )}
          </div>
        </div>
        <ProgressBadge actual={actual} target={target} meta={meta} />
      </div>

      {/* The bar */}
      {meta.symmetricBar ? (
        <SymmetricBar actual={actual} target={target} metric={goal.metric as GoalMetric} actuals={actuals} />
      ) : (
        <LinearBar actual={actual} target={target} meta={meta} />
      )}

      {/* Distance line */}
      <DistanceLine actual={actual} target={target} metric={goal.metric as GoalMetric} actuals={actuals} meta={meta} />
    </div>
  )
}

// ── Progress badge ────────────────────────────────────────────────────────

function ProgressBadge({ actual, target, meta }: { actual: number | null; target: number; meta: typeof GOAL_METRICS[number] }) {
  if (actual == null) {
    return (
      <span style={{ fontSize: 11, color: "var(--c-fg-muted)", padding: "4px 10px", background: "var(--c-bg-elev-3)", border: "1px solid var(--c-border)", borderRadius: 999 }}>
        no data yet
      </span>
    )
  }
  const passed = meta.direction === "higher" ? actual >= target : actual <= target
  const pct = pctToTarget(actual, target, meta.direction)
  const color = passed ? "var(--c-green-bright)" : (meta.direction === "higher" ? actual >= 0 : actual <= target * 1.5) ? "var(--c-amber)" : "var(--c-red-bright)"
  const bg = passed ? "rgba(17, 196, 88, 0.10)" : "rgba(229, 162, 59, 0.10)"
  return (
    <span style={{
      fontSize: 11, color, padding: "4px 10px",
      background: bg,
      border: `1px solid ${color}55`,
      borderRadius: 999, fontWeight: 600,
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      {passed && <Icon name="check" size={10} />}
      <span>{Math.round(pct)}% to goal</span>
    </span>
  )
}

function pctToTarget(actual: number, target: number, dir: "higher" | "lower"): number {
  if (dir === "higher") {
    if (target <= 0) return actual >= target ? 100 : 0
    return Math.max(0, (actual / target) * 100)
  }
  // Lower-is-better: 100% if at-or-below target; degrades as we exceed it.
  if (target === 0) return actual <= 0 ? 100 : 0
  return Math.max(0, Math.min(100, (1 - actual / (target * 2)) * 100))
}

// ── Symmetric bar (monetary goals) ────────────────────────────────────────

function SymmetricBar({ actual, target, metric, actuals }: {
  actual: number | null
  target: number
  metric: GoalMetric
  actuals: PeriodActuals
}) {
  // Scale: -target on the left, 0 (start) in the middle, +target on the right.
  // Symmetric drawdown range = same magnitude as target. If actual exceeds
  // ±target, we clamp the bar fill but show the real number above it.
  const target_ = Math.max(0.0001, Math.abs(target))
  const a = actual ?? 0
  const clamped = Math.max(-target_, Math.min(target_, a))
  const pctFromMiddle = (clamped / target_) * 50  // -50..+50

  const isProfit = a >= 0
  const fillColor = isProfit ? "var(--c-green-bright)" : "var(--c-red-bright)"
  const fillBg = isProfit ? "rgba(17, 196, 88, 0.18)" : "rgba(190, 51, 61, 0.18)"

  // Marker labels under the bar
  const startLabel = `start ${formatStartingBalance(metric, actuals)}`
  const drawdownLabel = formatTargetSide(metric, -target_, actuals.startingBalance)
  const targetLabel = formatTargetSide(metric, target_, actuals.startingBalance)

  return (
    <div>
      {/* Number + percent shown above the fill */}
      <div style={{ position: "relative", height: 22, marginBottom: 6 }}>
        {actual != null && (
          <div
            style={{
              position: "absolute",
              left: `calc(50% + ${pctFromMiddle}% - 60px)`,
              width: 120,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 600,
              color: fillColor,
              transform: a > target_ ? "translateX(-12px)" : a < -target_ ? "translateX(12px)" : "none",
              transition: "left 0.4s",
            }}
            className="tnum"
          >
            {formatActual(metric, a, actuals)}
          </div>
        )}
      </div>

      {/* The bar itself */}
      <div style={{ position: "relative", height: 14, background: "var(--c-bg-elev-3)", borderRadius: 7, overflow: "hidden" }}>
        {/* The fill — extends from the middle in either direction */}
        {actual != null && (
          <div style={{
            position: "absolute",
            top: 0, bottom: 0,
            left: pctFromMiddle >= 0 ? "50%" : `calc(50% + ${pctFromMiddle}%)`,
            width: `${Math.abs(pctFromMiddle)}%`,
            background: `linear-gradient(90deg, ${fillBg}, ${fillColor}88)`,
            transition: "left 0.4s, width 0.4s",
          }} />
        )}
        {/* Center anchor (start of period) */}
        <div style={{ position: "absolute", left: "calc(50% - 1px)", top: 0, bottom: 0, width: 2, background: "var(--c-fg-dim)", opacity: 0.7 }} />
        {/* Right edge target line (subtle accent) */}
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 2, background: "var(--c-green-bright)", opacity: 0.6 }} />
        {/* Left edge drawdown limit line */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "var(--c-red-bright)", opacity: 0.5 }} />
      </div>

      {/* Axis labels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 6, fontSize: 10.5, color: "var(--c-fg-dim)" }}>
        <span style={{ textAlign: "left" }}>{drawdownLabel}</span>
        <span style={{ textAlign: "center" }}>{startLabel}</span>
        <span style={{ textAlign: "right", color: "var(--c-green-bright)", fontWeight: 600 }}>{targetLabel}</span>
      </div>
    </div>
  )
}

// ── Linear bar (non-monetary goals) ───────────────────────────────────────

function LinearBar({ actual, target, meta }: {
  actual: number | null
  target: number
  meta: typeof GOAL_METRICS[number]
}) {
  const a = actual ?? 0
  const max = Math.max(target, a, target * 0.01)
  const pct = max > 0 ? Math.max(0, Math.min(100, (a / max) * 100)) : 0
  const targetPct = max > 0 ? (target / max) * 100 : 0

  const passed = meta.direction === "higher" ? a >= target : a <= target
  // For lower-is-better: tone is green when within target, red when over.
  // For higher-is-better: tone is green when at/over target, amber while approaching.
  const fillColor = passed ? "var(--c-green-bright)" : (meta.direction === "lower" ? "var(--c-red-bright)" : "var(--c-amber)")
  const fillBg = passed ? "rgba(17, 196, 88, 0.18)" : (meta.direction === "lower" ? "rgba(190, 51, 61, 0.18)" : "rgba(229, 162, 59, 0.18)")

  return (
    <div>
      <div style={{ position: "relative", height: 22, marginBottom: 6 }}>
        {actual != null && (
          <div style={{
            position: "absolute",
            left: `calc(${pct}% - 40px)`,
            width: 80, textAlign: "center",
            fontSize: 12, fontWeight: 600,
            color: fillColor,
            transition: "left 0.4s",
          }} className="tnum">
            {formatLinearActual(meta.metric, a)}
          </div>
        )}
      </div>
      <div style={{ position: "relative", height: 14, background: "var(--c-bg-elev-3)", borderRadius: 7, overflow: "hidden" }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`,
          background: `linear-gradient(90deg, ${fillBg}, ${fillColor}88)`,
          transition: "width 0.4s",
        }} />
        <div style={{
          position: "absolute", left: `calc(${targetPct}% - 1px)`, top: 0, bottom: 0, width: 2,
          background: "var(--c-green-bright)", opacity: 0.7,
        }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginTop: 6, fontSize: 10.5, color: "var(--c-fg-dim)" }}>
        <span style={{ textAlign: "left" }}>0</span>
        <span style={{ textAlign: "right", color: "var(--c-green-bright)", fontWeight: 600 }}>
          {meta.direction === "lower" ? "≤ " : ""}{formatLinearActual(meta.metric, target)}
        </span>
      </div>
    </div>
  )
}

// ── Distance from goal ───────────────────────────────────────────────────

function DistanceLine({ actual, target, metric, actuals, meta }: {
  actual: number | null
  target: number
  metric: GoalMetric
  actuals: PeriodActuals
  meta: typeof GOAL_METRICS[number]
}) {
  if (actual == null) {
    return <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>No data for this period yet — log or sync trades to start tracking.</span>
  }
  const passed = meta.direction === "higher" ? actual >= target : actual <= target
  const distance = meta.direction === "higher" ? target - actual : actual - target
  const tone = passed ? "var(--c-green-bright)" : "var(--c-fg)"

  if (passed) {
    if (meta.direction === "higher") {
      const over = actual - target
      return (
        <span style={{ fontSize: 11.5, color: tone, fontWeight: 500 }}>
          ✓ Goal hit — {formatActual(metric, over, actuals)} over target.
        </span>
      )
    }
    return <span style={{ fontSize: 11.5, color: tone, fontWeight: 500 }}>✓ Within cap — {formatActual(metric, target - actual, actuals)} of headroom.</span>
  }

  // Pretty distance in dollar terms when applicable.
  const dollarDelta = metric === "pnl_pct" && actuals.startingBalance > 0
    ? (distance / 100) * actuals.startingBalance
    : null

  return (
    <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>
      {meta.direction === "higher" ? "Need" : "Reduce"} <strong style={{ color: "var(--c-fg)" }}>{formatActual(metric, distance, actuals)}</strong>
      {dollarDelta != null && <> · <strong style={{ color: "var(--c-fg)" }}>{formatUSD(dollarDelta, { signed: false })}</strong> at current balance</>}
      {" "}to {meta.direction === "higher" ? "hit" : "stay under"} the target.
    </span>
  )
}

// ── Formatting helpers ───────────────────────────────────────────────────

function formatActual(metric: GoalMetric, value: number, actuals: PeriodActuals): string {
  switch (metric) {
    case "pnl_dollars":         return formatUSD(value, { signed: true })
    case "pnl_pct": {
      const dollars = actuals.startingBalance > 0 ? (value / 100) * actuals.startingBalance : null
      return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%${dollars != null ? ` (${formatUSD(dollars, { signed: true })})` : ""}`
    }
    case "win_rate":            return `${value.toFixed(1)}%`
    case "avg_r":               return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`
    case "avg_pips":            return `${value >= 0 ? "+" : ""}${value.toFixed(1)}p`
    case "profit_factor":       return value.toFixed(2)
    case "rules_followed_pct":  return `${value.toFixed(1)}%`
    case "max_rule_breaks":     return `${value.toFixed(0)}`
    case "max_drawdown_pct":    return `${value.toFixed(2)}%`
    case "min_trade_count":     return `${value.toFixed(0)}`
  }
}

function formatLinearActual(metric: GoalMetric, value: number): string {
  switch (metric) {
    case "win_rate":            return `${value.toFixed(0)}%`
    case "avg_r":               return `${value >= 0 ? "+" : ""}${value.toFixed(2)}R`
    case "avg_pips":            return `${value >= 0 ? "+" : ""}${value.toFixed(0)}p`
    case "profit_factor":       return value.toFixed(2)
    case "rules_followed_pct":  return `${value.toFixed(0)}%`
    case "max_rule_breaks":     return `${value.toFixed(0)}`
    case "max_drawdown_pct":    return `${value.toFixed(1)}%`
    case "min_trade_count":     return `${value.toFixed(0)}`
    default:                    return value.toString()
  }
}

function formatStartingBalance(metric: GoalMetric, actuals: PeriodActuals): string {
  if (metric === "pnl_dollars") return formatUSD(actuals.startingBalance, { signed: false })
  if (metric === "pnl_pct")     return `0% (${formatUSD(actuals.startingBalance, { signed: false })})`
  return ""
}

function formatTargetSide(metric: GoalMetric, value: number, startingBalance: number): string {
  if (metric === "pnl_dollars") return formatUSD(value, { signed: true })
  if (metric === "pnl_pct") {
    const dollars = startingBalance > 0 ? (value / 100) * startingBalance : null
    return `${value >= 0 ? "+" : ""}${value.toFixed(0)}%${dollars != null ? ` (${formatUSD(dollars, { signed: true })})` : ""}`
  }
  return value.toString()
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "period closed"
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return `${days}d left`
  const hours = Math.floor(ms / 3_600_000)
  return `${hours}h left`
}
