"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
        <PlannedVsRealized rows={stats.scatterRows} />
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

function PlannedVsRealized({ rows }: { rows: ScatterPoint[] }) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Planned vs. Realized R</h3>
        <p className="card-subtitle">Did you hit your target, take less, or worse?</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>Need closed trades with stops + targets.</p>
      </div>
    )
  }

  const n = rows.length
  const avgPlanned = rows.reduce((s, r) => s + r.plannedRR, 0) / n
  const avgRealized = rows.reduce((s, r) => s + r.realizedR, 0) / n
  const capturePct = avgPlanned > 0 ? (avgRealized / avgPlanned) * 100 : null

  // Outcome split — categories are exhaustive (every trade lands in exactly one).
  const counts = { hit: 0, partial: 0, stopped: 0 }
  for (const r of rows) counts[captureClass(r)]++

  const captureColor =
    capturePct == null ? "var(--c-fg)"
    : capturePct >= 80 ? "var(--c-green-bright)"
    : capturePct >= 40 ? "var(--c-amber)"
    : "var(--c-red-bright)"

  const note =
    capturePct == null ? null
    : capturePct >= 80 ? "You're banking close to your full planned reward — targets and exits are well matched."
    : capturePct >= 40 ? "You leave some reward on the table — trailing stops or scaling out may be cutting winners early."
    : "You capture only a fraction of what you plan — targets may be too ambitious, or you're exiting winners too soon."

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Planned vs. Realized R</h3>
        <p className="card-subtitle">Each dot is a trade — planned R:R across the bottom, the R you actually booked up the side.</p>
      </div>

      {/* At-a-glance summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
        <MiniStat label="Avg planned" value={`1 : ${avgPlanned.toFixed(1)}`} />
        <MiniStat label="Avg realized" value={`${avgRealized >= 0 ? "+" : ""}${avgRealized.toFixed(2)}R`} color={avgRealized >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)"} />
        <MiniStat label="Capture rate" value={capturePct == null ? "—" : `${Math.round(capturePct)}%`} color={captureColor} />
      </div>

      <CaptureScatter rows={rows} />

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 10, fontSize: 11, color: "var(--c-fg-muted)" }}>
        <LegendDot color="var(--c-green-bright)" label="Hit target" />
        <LegendDot color="var(--c-amber)" label="Partial" />
        <LegendDot color="var(--c-red-bright)" label="Stopped out" />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, borderTop: "1.5px dashed rgba(183, 156, 255, 0.9)" }} />
          target line (realized = planned)
        </span>
      </div>

      {note && (
        <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>{note}</p>
      )}

      {/* Outcome split */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 11.5, marginTop: 14 }}>
        <ScatterStat label="Hit target" count={counts.hit} total={n} color="var(--c-green-bright)" />
        <ScatterStat label="Partial win" count={counts.partial} total={n} color="var(--c-amber)" />
        <ScatterStat label="Stopped out" count={counts.stopped} total={n} color="var(--c-red-bright)" />
      </div>
    </div>
  )
}

type CaptureClass = "hit" | "partial" | "stopped"

/** A trade hit its target if it booked ≥90% of planned R; a positive-but-short
 * result is a partial; anything ≤0 was stopped or scratched. */
function captureClass(r: ScatterPoint): CaptureClass {
  if (r.realizedR <= 0) return "stopped"
  if (r.realizedR >= r.plannedRR * 0.9) return "hit"
  return "partial"
}

const CAPTURE_COLOR: Record<CaptureClass, string> = {
  hit: "var(--c-green-bright)",
  partial: "var(--c-amber)",
  stopped: "var(--c-red-bright)",
}

/**
 * Responsive scatter of planned R:R (x) vs. realized R (y). Width tracks the
 * card via ResizeObserver so it always fills the column (no dead space), while
 * height stays fixed so dots and ticks render at true pixel sizes. Gridlines,
 * a highlighted zero line, a shaded loss band, and the dashed "realized =
 * planned" diagonal give the dots a frame to be read against.
 */
function CaptureScatter({ rows }: { rows: ScatterPoint[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const H = 280
  const padL = 40, padR = 14, padT = 14, padB = 28
  const W = Math.max(width, 260)
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const xMax = Math.max(3, Math.ceil(Math.max(...rows.map((r) => r.plannedRR))))
  const yMax = Math.max(2, Math.ceil(Math.max(...rows.map((r) => Math.abs(r.realizedR)))))
  const yMin = -yMax

  const sx = (x: number) => padL + (Math.max(0, Math.min(xMax, x)) / xMax) * plotW
  const sy = (y: number) => padT + (1 - (Math.max(yMin, Math.min(yMax, y)) - yMin) / (yMax - yMin)) * plotH

  const xTicks = Array.from({ length: xMax + 1 }, (_, i) => i)
  const yStep = yMax <= 3 ? 1 : Math.ceil(yMax / 3)
  const yTicks = [0]
  for (let y = yStep; y <= yMax; y += yStep) { yTicks.push(y); yTicks.push(-y) }

  // Perfect-hit diagonal (realized = planned), clipped to the top edge.
  const xd = Math.min(xMax, yMax)

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg
        width={W}
        height={H}
        role="img"
        aria-label="Scatter of planned reward-to-risk versus realized R, one dot per trade"
        style={{ display: "block", background: "var(--c-bg-elev-2)", borderRadius: 8, border: "1px solid var(--c-border)" }}
      >
        {/* Loss band (realized < 0) */}
        <rect x={padL} y={sy(0)} width={plotW} height={sy(yMin) - sy(0)} fill="rgba(190, 51, 61, 0.06)" />

        {/* X gridlines + labels */}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={padT} y2={padT + plotH} stroke="var(--c-border)" strokeWidth={1} strokeOpacity={0.4} />
            <text x={sx(t)} y={H - 9} fontSize={9.5} fill="var(--c-fg-dim)" fontFamily="var(--font-mono)" textAnchor="middle">{t}R</text>
          </g>
        ))}

        {/* Y gridlines + labels (zero line emphasised) */}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line
              x1={padL} x2={padL + plotW} y1={sy(t)} y2={sy(t)}
              stroke={t === 0 ? "var(--c-fg-dim)" : "var(--c-border)"}
              strokeWidth={1} strokeOpacity={t === 0 ? 0.65 : 0.35}
              strokeDasharray={t === 0 ? undefined : "2 3"}
            />
            <text x={padL - 6} y={sy(t) + 3} fontSize={9.5} fill="var(--c-fg-dim)" fontFamily="var(--font-mono)" textAnchor="end">{t > 0 ? "+" : ""}{t}R</text>
          </g>
        ))}

        {/* Perfect-hit diagonal */}
        <line x1={sx(0)} y1={sy(0)} x2={sx(xd)} y2={sy(xd)} stroke="rgba(183, 156, 255, 0.85)" strokeWidth={1.5} strokeDasharray="4 4" />

        {/* Dots */}
        {rows.map((r, i) => (
          <circle
            key={i}
            cx={sx(r.plannedRR)}
            cy={sy(r.realizedR)}
            r={4}
            fill={CAPTURE_COLOR[captureClass(r)]}
            fillOpacity={0.82}
            stroke="var(--c-bg-elev-2)"
            strokeWidth={1}
          >
            <title>{`Planned 1:${r.plannedRR.toFixed(1)} · Realized ${r.realizedR >= 0 ? "+" : ""}${r.realizedR.toFixed(2)}R`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      {label}
    </span>
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
