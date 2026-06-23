"use client"

import { useMemo } from "react"
import { formatUSD } from "@/lib/finance"
import { slPips, tpPips, realizedPips, pipBucket, bucketSortKey, formatPips } from "@/lib/pip"
import type { Trade } from "@/lib/queries/trades"
import { isWin, isLoss } from "@/lib/outcome"

/**
 * Stop-Loss & Take-Profit analysis section for the Analytics page.
 *
 * Premium data points the user asked for:
 *   - Avg SL pips, Avg TP pips, Avg planned R:R, Stop-hit rate
 *   - Pip stats: avg pips won, avg pips lost, total pips, ratio
 *   - Win rate by SL bucket — does your edge come from tight or wide stops?
 *   - Win rate by TP bucket — same for targets
 *   - R:R distribution histogram — how skewed are your planned trades?
 *   - Realized R vs planned R:R scatter — do you actually achieve your R:R?
 *
 * All computed in-component from the closed-trades array — no extra queries.
 */
export function StopTargetAnalysis({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => computeStats(trades), [trades])
  if (stats.tradedWithStops === 0) {
    return (
      <div className="card" style={{ padding: 18 }}>
        <h3 className="card-title">Stop-Loss & Take-Profit Analysis</h3>
        <p className="card-subtitle">Set stop_price + target_price on your trades to unlock pip-distance breakdowns.</p>
      </div>
    )
  }

  return (
    <>
      {/* Headline KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <Kpi label="Avg SL distance" value={stats.avgSlPips != null ? `${stats.avgSlPips.toFixed(1)}p` : "—"} sub={`${stats.tradedWithStops} trades w/ stop`} />
        <Kpi label="Avg TP distance" value={stats.avgTpPips != null ? `${stats.avgTpPips.toFixed(1)}p` : "—"} sub={`${stats.tradedWithTargets} trades w/ target`} />
        <Kpi
          label="Avg planned R:R"
          value={stats.avgRR != null ? `1 : ${stats.avgRR.toFixed(2)}` : "—"}
          sub="target ÷ stop"
          color={stats.avgRR != null && stats.avgRR >= 1.5 ? "var(--c-green-bright)" : stats.avgRR != null && stats.avgRR < 1 ? "var(--c-red-bright)" : "var(--c-fg)"}
        />
        <Kpi
          label="Stop-hit rate"
          value={stats.stopHitRate != null ? `${stats.stopHitRate.toFixed(0)}%` : "—"}
          sub={`${stats.stopsHit} stopped of ${stats.closedWithStops}`}
          color={stats.stopHitRate != null && stats.stopHitRate < 50 ? "var(--c-green-bright)" : stats.stopHitRate != null && stats.stopHitRate > 70 ? "var(--c-red-bright)" : "var(--c-fg)"}
        />
        <Kpi label="Avg pips won" value={stats.avgPipsWon != null ? `+${stats.avgPipsWon.toFixed(1)}p` : "—"} sub={`${stats.winsCount} winners`} color="var(--c-green-bright)" />
        <Kpi label="Avg pips lost" value={stats.avgPipsLost != null ? `${stats.avgPipsLost.toFixed(1)}p` : "—"} sub={`${stats.lossesCount} losers`} color="var(--c-red-bright)" />
        <Kpi
          label="Pip win/loss ratio"
          value={stats.pipRatio != null ? `${stats.pipRatio.toFixed(2)}×` : "—"}
          sub={stats.pipRatio != null && stats.pipRatio >= 1 ? "winners outweigh losers" : "losers outweigh winners"}
          color={stats.pipRatio != null && stats.pipRatio >= 1.5 ? "var(--c-green-bright)" : stats.pipRatio != null && stats.pipRatio < 1 ? "var(--c-red-bright)" : "var(--c-fg)"}
        />
        <Kpi label="Total pips" value={stats.totalPips != null ? (stats.totalPips >= 0 ? `+${stats.totalPips.toFixed(0)}p` : `${stats.totalPips.toFixed(0)}p`) : "—"} sub="net for this period" color={stats.totalPips != null && stats.totalPips >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)"} />
      </div>

      {/* Win rate by SL / TP bucket */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
        <BucketTable
          title="Win Rate by Stop Distance"
          subtitle="Tight stops vs wide stops — where is your edge?"
          bucketKey="sl"
          rows={stats.slBuckets}
        />
        <BucketTable
          title="Win Rate by Target Distance"
          subtitle="Do your bigger targets actually fill?"
          bucketKey="tp"
          rows={stats.tpBuckets}
        />
      </div>

      {/* R:R distribution + realized vs planned scatter */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14 }}>
        <RRDistribution rows={stats.rrDist} />
        <PlannedVsRealizedScatter rows={stats.scatterRows} />
      </div>
    </>
  )
}

// ── Computation ───────────────────────────────────────────────────────────

type BucketRow = { bucket: string; count: number; wins: number; winRate: number; avgPnL: number; avgR: number }
type ScatterPoint = { plannedRR: number; realizedR: number; pnl: number }

type Stats = {
  tradedWithStops: number
  tradedWithTargets: number
  avgSlPips: number | null
  avgTpPips: number | null
  avgRR: number | null
  stopsHit: number
  closedWithStops: number
  stopHitRate: number | null
  avgPipsWon: number | null
  avgPipsLost: number | null
  totalPips: number | null
  pipRatio: number | null
  winsCount: number
  lossesCount: number
  slBuckets: BucketRow[]
  tpBuckets: BucketRow[]
  rrDist: { label: string; count: number }[]
  scatterRows: ScatterPoint[]
}

function computeStats(trades: Trade[]): Stats {
  const slPipsList: number[] = []
  const tpPipsList: number[] = []
  const rrList: number[] = []
  const realizedPipsList: number[] = []
  let stopsHit = 0
  let closedWithStops = 0
  const winningPips: number[] = []
  const losingPips: number[] = []

  type SlBucketAcc = { bucket: string; trades: Trade[]; pipsList: number[] }
  const slBuckets = new Map<string, SlBucketAcc>()
  const tpBuckets = new Map<string, SlBucketAcc>()
  const rrCounts = new Map<string, number>()
  const scatterRows: ScatterPoint[] = []

  let tradedWithStops = 0
  let tradedWithTargets = 0

  for (const t of trades) {
    const side = t.side as "long" | "short"
    const sl = slPips({ side, entry: Number(t.entry_price), stop: t.stop_price != null ? Number(t.stop_price) : null, pair: t.pair })
    const tp = tpPips({ side, entry: Number(t.entry_price), target: t.target_price != null ? Number(t.target_price) : null, pair: t.pair })
    const realized = realizedPips({ side, entry: Number(t.entry_price), exit: t.exit_price != null ? Number(t.exit_price) : null, pair: t.pair })

    if (sl != null) {
      tradedWithStops++
      slPipsList.push(sl)
      const b = pipBucket(sl, t.pair)
      const acc = slBuckets.get(b) ?? { bucket: b, trades: [], pipsList: [] }
      acc.trades.push(t)
      acc.pipsList.push(sl)
      slBuckets.set(b, acc)

      // Stop-hit detection: closed trade where exit ≈ stop (within 1 pip)
      // — this is approximate since we don't have a `closed_by` field. A stop
      // hit means the exit price equals (or worse than) the stop.
      if (t.status === "closed" && t.exit_price != null) {
        closedWithStops++
        const exit = Number(t.exit_price)
        const stop = Number(t.stop_price)
        const stopHit =
          (side === "long" && exit <= stop) ||
          (side === "short" && exit >= stop)
        if (stopHit) stopsHit++
      }
    }

    if (tp != null) {
      tradedWithTargets++
      tpPipsList.push(tp)
      const b = pipBucket(tp, t.pair)
      const acc = tpBuckets.get(b) ?? { bucket: b, trades: [], pipsList: [] }
      acc.trades.push(t)
      acc.pipsList.push(tp)
      tpBuckets.set(b, acc)
    }

    if (sl != null && tp != null && sl > 0) {
      const rr = tp / sl
      rrList.push(rr)
      const rrLabel = rrBucket(rr)
      rrCounts.set(rrLabel, (rrCounts.get(rrLabel) ?? 0) + 1)

      if (t.r != null) {
        scatterRows.push({
          plannedRR: rr,
          realizedR: Number(t.r),
          pnl: Number(t.pnl) || 0,
        })
      }
    }

    if (realized != null) {
      realizedPipsList.push(realized)
      if (realized > 0) winningPips.push(realized)
      else if (realized < 0) losingPips.push(realized)
    }
  }

  const avg = (arr: number[]) => arr.length === 0 ? null : arr.reduce((s, x) => s + x, 0) / arr.length
  const sum = (arr: number[]) => arr.reduce((s, x) => s + x, 0)

  const slRows = bucketRows(slBuckets)
  const tpRows = bucketRows(tpBuckets)
  const rrDist = Array.from(rrCounts.entries()).map(([label, count]) => ({ label, count }))
    .sort((a, b) => rrSortKey(a.label) - rrSortKey(b.label))

  const avgPipsLost = losingPips.length > 0 ? avg(losingPips) : null
  const avgPipsWon = winningPips.length > 0 ? avg(winningPips) : null
  const pipRatio = avgPipsLost != null && avgPipsLost !== 0 && avgPipsWon != null
    ? avgPipsWon / Math.abs(avgPipsLost)
    : null

  return {
    tradedWithStops,
    tradedWithTargets,
    avgSlPips: avg(slPipsList),
    avgTpPips: avg(tpPipsList),
    avgRR: avg(rrList),
    stopsHit,
    closedWithStops,
    stopHitRate: closedWithStops > 0 ? (stopsHit / closedWithStops) * 100 : null,
    avgPipsWon,
    avgPipsLost,
    totalPips: realizedPipsList.length > 0 ? sum(realizedPipsList) : null,
    pipRatio,
    winsCount: winningPips.length,
    lossesCount: losingPips.length,
    slBuckets: slRows,
    tpBuckets: tpRows,
    rrDist,
    scatterRows,
  }
}

function bucketRows(map: Map<string, { bucket: string; trades: Trade[]; pipsList: number[] }>): BucketRow[] {
  return Array.from(map.values())
    .map(({ bucket, trades }) => {
      const wins = trades.filter((t) => isWin(Number(t.pnl))).length
      const losses = trades.filter((t) => isLoss(Number(t.pnl))).length
      const totalPnl = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
      const totalR = trades.reduce((s, t) => s + (Number(t.r) || 0), 0)
      return {
        bucket,
        count: trades.length,
        wins,
        winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
        avgPnL: trades.length > 0 ? totalPnl / trades.length : 0,
        avgR: trades.length > 0 ? totalR / trades.length : 0,
      }
    })
    .sort((a, b) => bucketSortKey(a.bucket) - bucketSortKey(b.bucket))
}

function rrBucket(rr: number): string {
  if (rr < 0.5) return "<0.5"
  if (rr < 1) return "0.5–1.0"
  if (rr < 1.5) return "1.0–1.5"
  if (rr < 2) return "1.5–2.0"
  if (rr < 3) return "2.0–3.0"
  return "3.0+"
}
function rrSortKey(label: string): number {
  if (label.startsWith("<")) return 0
  if (label.endsWith("+")) return 99
  return parseFloat(label.split("–")[0])
}

// ── UI components ─────────────────────────────────────────────────────────

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--c-fg-dim)", marginTop: 2 }}>{sub}</div>
    </div>
  )
}

function BucketTable({ title, subtitle, bucketKey, rows }: { title: string; subtitle: string; bucketKey: "sl" | "tp"; rows: BucketRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">{title}</h3>
        <p className="card-subtitle">{subtitle}</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>No data — add stops/targets to your trades.</p>
      </div>
    )
  }
  const bestWR = Math.max(...rows.map((r) => r.winRate))
  const worstWR = Math.min(...rows.map((r) => r.winRate))

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">{title}</h3>
        <p className="card-subtitle">{subtitle}</p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 320 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "70px 60px 1fr 80px 80px",
            gap: 8, padding: "6px 0",
            fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
            borderBottom: "1px solid var(--c-border)",
          }}>
            <span>{bucketKey === "sl" ? "SL pips" : "TP pips"}</span>
            <span style={{ textAlign: "right" }}>Trades</span>
            <span>Win rate</span>
            <span style={{ textAlign: "right" }}>Avg R</span>
            <span style={{ textAlign: "right" }}>Avg P&L</span>
          </div>
          {rows.map((r) => {
            const isBest = r.winRate === bestWR && r.count >= 3 && rows.length > 1
            const isWorst = r.winRate === worstWR && r.count >= 3 && rows.length > 1 && bestWR !== worstWR
            return (
              <div
                key={r.bucket}
                style={{
                  display: "grid", gridTemplateColumns: "70px 60px 1fr 80px 80px",
                  gap: 8, padding: "10px 0",
                  borderBottom: "1px solid var(--c-border)",
                  alignItems: "center", fontSize: 12.5,
                  background: isBest ? "rgba(17, 196, 88, 0.04)" : isWorst ? "rgba(190, 51, 61, 0.04)" : "transparent",
                }}
              >
                <span className="mono" style={{ fontWeight: 500 }}>{r.bucket}</span>
                <span className="tnum" style={{ textAlign: "right", color: "var(--c-fg-muted)" }}>{r.count}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ position: "relative", flex: 1, height: 8, background: "var(--c-bg-elev-3)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      position: "absolute", inset: 0, width: `${r.winRate}%`,
                      background: r.winRate >= 50 ? "rgba(17, 196, 88, 0.6)" : "rgba(190, 51, 61, 0.6)",
                    }} />
                  </div>
                  <span className="tnum" style={{ fontSize: 11.5, fontWeight: 600, minWidth: 36, textAlign: "right" }}>{Math.round(r.winRate)}%</span>
                </div>
                <span
                  className="tnum"
                  style={{
                    textAlign: "right",
                    color: r.avgR > 0 ? "var(--c-green-bright)" : r.avgR < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
                  }}
                >
                  {r.avgR > 0 ? "+" : ""}{r.avgR.toFixed(2)}R
                </span>
                <span
                  className="tnum"
                  style={{
                    textAlign: "right",
                    fontWeight: 600,
                    color: r.avgPnL > 0 ? "var(--c-green-bright)" : r.avgPnL < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
                  }}
                >
                  {formatUSD(r.avgPnL, { signed: true })}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function RRDistribution({ rows }: { rows: { label: string; count: number }[] }) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">R:R Distribution</h3>
        <p className="card-subtitle">Planned reward vs. risk on each trade</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>Need stops + targets on your trades.</p>
      </div>
    )
  }
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">R:R Distribution</h3>
        <p className="card-subtitle">Planned reward vs. risk on each trade</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "grid", gridTemplateColumns: "70px 1fr 40px", gap: 10, alignItems: "center" }}>
            <span className="mono" style={{ fontSize: 12 }}>1 : {r.label}</span>
            <div style={{ position: "relative", height: 18, background: "var(--c-bg-elev-3)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                position: "absolute", inset: 0, width: `${(r.count / max) * 100}%`,
                background: "linear-gradient(90deg, rgba(105, 50, 212, 0.45), rgba(183, 156, 255, 0.6))",
              }} />
            </div>
            <span className="tnum" style={{ fontSize: 11.5, color: "var(--c-fg-muted)", textAlign: "right" }}>{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlannedVsRealizedScatter({ rows }: { rows: ScatterPoint[] }) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Planned vs. Realized R</h3>
        <p className="card-subtitle">Did you hit your target, take less, or worse?</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>Need closed trades with stops + targets.</p>
      </div>
    )
  }
  const W = 280
  const H = 180
  const PAD = 24
  const xMax = Math.max(...rows.map((r) => r.plannedRR), 4)
  const xMin = 0
  const yMax = Math.max(...rows.map((r) => Math.abs(r.realizedR)), 2)
  const yMin = -yMax

  const sx = (x: number) => PAD + ((x - xMin) / (xMax - xMin)) * (W - PAD * 2)
  const sy = (y: number) => H - PAD - ((y - yMin) / (yMax - yMin)) * (H - PAD * 2)

  const hits = rows.filter((r) => r.realizedR >= r.plannedRR * 0.9).length
  const partial = rows.filter((r) => r.realizedR > 0 && r.realizedR < r.plannedRR * 0.9).length
  const losses = rows.filter((r) => r.realizedR < 0).length

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Planned vs. Realized R</h3>
        <p className="card-subtitle">Each dot is a trade. X = planned R:R, Y = actual R achieved.</p>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <svg width={W} height={H} style={{ overflow: "visible" }}>
          {/* Y=0 line */}
          <line x1={PAD} x2={W - PAD} y1={sy(0)} y2={sy(0)} stroke="var(--c-border)" strokeWidth={1} strokeDasharray="2 3" />
          {/* y=x diagonal (perfect target hit) */}
          <line
            x1={sx(xMin)} y1={sy(xMin)}
            x2={sx(xMax)} y2={sy(xMax)}
            stroke="rgba(105, 50, 212, 0.35)" strokeWidth={1} strokeDasharray="3 4"
          />
          {/* Axes labels */}
          <text x={PAD} y={H - 4} fontSize={9} fill="var(--c-fg-dim)" fontFamily="var(--font-mono)">0</text>
          <text x={W - PAD - 12} y={H - 4} fontSize={9} fill="var(--c-fg-dim)" fontFamily="var(--font-mono)">{xMax.toFixed(1)}R</text>
          <text x={2} y={sy(yMax)} fontSize={9} fill="var(--c-fg-dim)" fontFamily="var(--font-mono)">+{yMax.toFixed(1)}R</text>
          <text x={2} y={sy(yMin) + 4} fontSize={9} fill="var(--c-fg-dim)" fontFamily="var(--font-mono)">{yMin.toFixed(1)}R</text>
          {rows.map((r, i) => (
            <circle
              key={i}
              cx={sx(r.plannedRR)}
              cy={sy(r.realizedR)}
              r={3}
              fill={r.realizedR >= 0 ? "rgba(17, 196, 88, 0.7)" : "rgba(190, 51, 61, 0.7)"}
            />
          ))}
        </svg>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 11.5 }}>
        <ScatterStat label="Hit target" count={hits} total={rows.length} color="var(--c-green-bright)" />
        <ScatterStat label="Partial win" count={partial} total={rows.length} color="var(--c-amber)" />
        <ScatterStat label="Stopped out" count={losses} total={rows.length} color="var(--c-red-bright)" />
      </div>
    </div>
  )
}

function ScatterStat({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 600, color }}>{count}</div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>{label}</div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{pct}%</div>
    </div>
  )
}

// Re-export for caller convenience (currently unused by view but tested via pip.test.ts)
export { formatPips }
