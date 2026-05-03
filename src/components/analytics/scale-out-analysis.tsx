"use client"

import { useMemo } from "react"
import { Icon } from "@/components/icons"
import { formatUSD, computeR } from "@/lib/finance"
import type { Trade } from "@/lib/queries/trades"
import type { TradeFill } from "@/lib/queries/trade-fills"

/**
 * Scale-out analysis. Uses the trade_fills table to compare:
 *
 *   - Single-exit trades vs scaled-out trades — which actually performs better?
 *   - First scale-out R vs runner R — are you cutting winners short or letting
 *     them run?
 *   - Counterfactual: "if you'd held to your original target on every scaled
 *     trade, how much R would that have been?" vs realized R.
 *
 * Only meaningful when the user has trades with multiple exit fills. If the
 * user only takes single closes, we render a "no scale-outs yet" state.
 */
export function ScaleOutAnalysis({ trades, fillsByTrade }: { trades: Trade[]; fillsByTrade: Map<string, TradeFill[]> }) {
  const stats = useMemo(() => compute(trades, fillsByTrade), [trades, fillsByTrade])

  if (stats.totalClosed === 0) return null

  if (stats.scaledTrades === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Scale-Out Analysis</h3>
        <p className="card-subtitle">Compare single-exit vs scaled-out trade outcomes</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>
          You haven&apos;t scaled out of any trades yet. When you do — using "Add exit"
          on the trade detail drawer to take partial profit — this card lights up
          with first-fill R, runner R, and "would have been if held to target"
          counterfactuals.
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Scale-Out Analysis</h3>
        <p className="card-subtitle">
          {stats.scaledTrades} scaled-out · {stats.singleExitTrades} single-exit · {stats.totalClosed} closed total
        </p>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14 }}>
        <Stat
          label="Scale-out rate"
          value={`${Math.round((stats.scaledTrades / stats.totalClosed) * 100)}%`}
          sub={`${stats.scaledTrades} of ${stats.totalClosed}`}
        />
        <Stat
          label="Avg first-fill R"
          value={stats.avgFirstFillR != null ? `${stats.avgFirstFillR > 0 ? "+" : ""}${stats.avgFirstFillR.toFixed(2)}R` : "—"}
          sub="when scaling out"
          color={stats.avgFirstFillR != null && stats.avgFirstFillR > 0 ? "var(--c-green-bright)" : "var(--c-fg)"}
        />
        <Stat
          label="Avg runner R"
          value={stats.avgRunnerR != null ? `${stats.avgRunnerR > 0 ? "+" : ""}${stats.avgRunnerR.toFixed(2)}R` : "—"}
          sub="last fill"
          color={stats.avgRunnerR != null && stats.avgRunnerR > 0 ? "var(--c-green-bright)" : stats.avgRunnerR != null && stats.avgRunnerR < 0 ? "var(--c-red-bright)" : "var(--c-fg)"}
        />
        <Stat
          label="Vs hold-to-target"
          value={stats.counterfactual != null ? `${stats.counterfactual > 0 ? "+" : ""}${stats.counterfactual.toFixed(2)}R` : "—"}
          sub={stats.counterfactual != null ? (stats.counterfactual > 0 ? "scaling beat hold" : "hold would have beat scaling") : "need stops + targets"}
          color={stats.counterfactual != null && stats.counterfactual > 0 ? "var(--c-green-bright)" : stats.counterfactual != null && stats.counterfactual < 0 ? "var(--c-amber)" : "var(--c-fg)"}
        />
      </div>

      {/* Side-by-side comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
        <ComparisonCard
          title="Single exit"
          count={stats.singleExitTrades}
          winRate={stats.single.winRate}
          avgR={stats.single.avgR}
          avgPnL={stats.single.avgPnL}
        />
        <ComparisonCard
          title="Scaled out"
          count={stats.scaledTrades}
          winRate={stats.scaled.winRate}
          avgR={stats.scaled.avgR}
          avgPnL={stats.scaled.avgPnL}
        />
      </div>

      {/* Insight banner */}
      {stats.counterfactual != null && stats.scaledTrades >= 3 && (
        <div style={{
          padding: 10,
          background: stats.counterfactual > 0 ? "rgba(17, 196, 88, 0.06)" : "rgba(229, 162, 59, 0.06)",
          border: `1px solid ${stats.counterfactual > 0 ? "rgba(17, 196, 88, 0.25)" : "rgba(229, 162, 59, 0.25)"}`,
          borderRadius: 8, fontSize: 12, color: "var(--c-fg-muted)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Icon name={stats.counterfactual > 0 ? "sparkle" : "info"} size={13} color={stats.counterfactual > 0 ? "var(--c-green-bright)" : "var(--c-amber)"} />
          <span>
            {stats.counterfactual > 0 ? (
              <>
                Scaling out earned <strong style={{ color: "var(--c-green-bright)" }}>+{stats.counterfactual.toFixed(2)}R</strong> more
                than holding to your original target would have. Booking partials is paying off.
              </>
            ) : (
              <>
                Holding to original target would have been <strong style={{ color: "var(--c-amber)" }}>{Math.abs(stats.counterfactual).toFixed(2)}R</strong> better
                than scaling out. Trades have legs you&apos;re not letting run.
              </>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{sub}</div>
    </div>
  )
}

function ComparisonCard({ title, count, winRate, avgR, avgPnL }: { title: string; count: number; winRate: number; avgR: number; avgPnL: number }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>{count} trade{count === 1 ? "" : "s"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        <Sub label="WR" value={count === 0 ? "—" : `${Math.round(winRate)}%`} color={winRate >= 50 ? "var(--c-green-bright)" : "var(--c-red-bright)"} />
        <Sub label="Avg R" value={count === 0 ? "—" : `${avgR > 0 ? "+" : ""}${avgR.toFixed(2)}R`} color={avgR > 0 ? "var(--c-green-bright)" : avgR < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)"} />
        <Sub label="Avg P&L" value={count === 0 ? "—" : formatUSD(avgPnL, { signed: true })} color={avgPnL > 0 ? "var(--c-green-bright)" : avgPnL < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)"} />
      </div>
    </div>
  )
}

function Sub({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: color ?? "var(--c-fg)" }}>{value}</div>
    </div>
  )
}

function compute(trades: Trade[], fillsByTrade: Map<string, TradeFill[]>) {
  const closed = trades.filter((t) => t.status === "closed")
  const single: Trade[] = []
  const scaled: Trade[] = []
  const firstFillRs: number[] = []
  const runnerRs: number[] = []
  const counterfactualDiffs: number[] = []

  for (const t of closed) {
    const fills = fillsByTrade.get(t.id) ?? []
    const exitFills = fills.filter((f) => f.kind === "exit")
    const isScaled = exitFills.length >= 2

    if (isScaled) {
      scaled.push(t)
      // First-fill R: compute R using the first exit fill's price
      const sortedExits = [...exitFills].sort((a, b) => new Date(a.filled_at).getTime() - new Date(b.filled_at).getTime())
      const firstExit = sortedExits[0]
      const lastExit = sortedExits[sortedExits.length - 1]
      const side = t.side as "long" | "short"
      const entry = Number(t.entry_price)
      const stop = t.stop_price != null ? Number(t.stop_price) : null

      const firstR = computeR({ side, entry, stop, exit: Number(firstExit.price) })
      const runnerR = computeR({ side, entry, stop, exit: Number(lastExit.price) })
      if (firstR != null) firstFillRs.push(firstR)
      if (runnerR != null) runnerRs.push(runnerR)

      // Counterfactual: if we'd held the entire size to the target, what would
      // realized R have been? (Computed per-trade, then we sum the diff vs
      // actual R.)
      if (t.target_price != null && stop != null) {
        const targetR = computeR({ side, entry, stop, exit: Number(t.target_price) })
        const actualR = Number(t.r) || 0
        if (targetR != null) {
          counterfactualDiffs.push(actualR - targetR)
        }
      }
    } else {
      single.push(t)
    }
  }

  const avg = (arr: number[]) => arr.length === 0 ? null : arr.reduce((s, x) => s + x, 0) / arr.length

  return {
    totalClosed: closed.length,
    scaledTrades: scaled.length,
    singleExitTrades: single.length,
    avgFirstFillR: avg(firstFillRs),
    avgRunnerR: avg(runnerRs),
    counterfactual: avg(counterfactualDiffs), // positive = scaling beat hold; negative = hold would have beat
    single: groupAgg(single),
    scaled: groupAgg(scaled),
  }
}

function groupAgg(ts: Trade[]) {
  const wins = ts.filter((t) => Number(t.pnl) > 0).length
  const totalPnL = ts.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  const totalR = ts.reduce((s, t) => s + (Number(t.r) || 0), 0)
  return {
    count: ts.length,
    winRate: ts.length > 0 ? (wins / ts.length) * 100 : 0,
    avgR: ts.length > 0 ? totalR / ts.length : 0,
    avgPnL: ts.length > 0 ? totalPnL / ts.length : 0,
  }
}
