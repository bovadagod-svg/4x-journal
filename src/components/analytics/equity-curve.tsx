import type { EquityPoint } from "@/lib/queries/analytics"
import type { BenchmarkPoint } from "@/lib/actions/benchmark"

/**
 * SVG sparkline-style equity curve. Pure render — no JS in browser unless the
 * caller wires it. Supports an optional benchmark overlay (S&P / DXY) drawn
 * on a normalized %-from-start scale so the trader can see whether they
 * outperformed the macro. Drawdown markers (vertical amber lines) flag the
 * worst N peak-to-trough excursions within the window.
 */
export function EquityCurve({
  points,
  benchmark,
  benchmarkLabel,
  showDdMarkers = true,
  height = 220,
}: {
  points: EquityPoint[]
  benchmark?: BenchmarkPoint[] | null
  benchmarkLabel?: string | null
  showDdMarkers?: boolean
  height?: number
}) {
  if (points.length < 2) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
        Equity curve appears once you have 2+ closed trades.
      </div>
    )
  }

  const W = 1000
  const H = height
  const padX = 12
  const padY = 14

  const values = points.map((p) => p.equity)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1

  const stepX = (W - padX * 2) / (points.length - 1)
  const yFor = (v: number) => H - padY - ((v - min) / range) * (H - padY * 2)
  const xFor = (i: number) => padX + i * stepX

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(2)},${yFor(p.equity).toFixed(2)}`)
    .join(" ")

  const zeroY = yFor(0)
  const areaPath = `${path} L${xFor(points.length - 1).toFixed(2)},${zeroY.toFixed(2)} L${xFor(0).toFixed(2)},${zeroY.toFixed(2)} Z`

  const finalEquity = values[values.length - 1]
  const tone = finalEquity > 0 ? "green" : finalEquity < 0 ? "red" : "neutral"
  const stroke = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg-muted)"
  const fill = tone === "green" ? "rgba(45, 219, 115, 0.12)" : tone === "red" ? "rgba(224, 74, 85, 0.12)" : "rgba(154, 151, 161, 0.10)"

  // Drawdown markers — find the trough of the deepest 1–2 drawdowns and draw a
  // vertical line at each. Helps the eye locate "where did the pain happen".
  const ddMarkers = showDdMarkers ? findDeepestDrawdowns(values, 2) : []

  // Benchmark overlay — normalized to the equity Y range. We map benchmark's
  // %-from-start onto the equity scale so the two lines share the chart space.
  // Project benchmark onto trade-index x positions by date alignment.
  const benchmarkPath = benchmark && benchmark.length >= 2
    ? buildBenchmarkPath(benchmark, points, range, min, padX, padY, W, H)
    : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Equity curve">
      {/* Drawdown markers — drawn underneath everything else */}
      {ddMarkers.map((idx) => (
        <line
          key={`dd-${idx}`}
          x1={xFor(idx)} x2={xFor(idx)}
          y1={padY} y2={H - padY}
          stroke="var(--c-amber)"
          strokeWidth={1}
          strokeDasharray="2 3"
          opacity={0.45}
        />
      ))}
      {/* Zero line */}
      <line x1={padX} x2={W - padX} y1={zeroY} y2={zeroY} stroke="var(--c-border)" strokeWidth={1} strokeDasharray="3 4" />
      <path d={areaPath} fill={fill} />
      {/* Benchmark overlay — drawn UNDER the equity line so the user's curve stays prominent */}
      {benchmarkPath && (
        <>
          <path d={benchmarkPath} fill="none" stroke="var(--c-purple-bright)" strokeWidth={1.2} opacity={0.55} strokeDasharray="4 3" />
          {benchmarkLabel && (
            <text x={W - padX} y={padY + 10} fontSize={10} textAnchor="end" fill="var(--c-purple-bright)" opacity={0.8}>
              {benchmarkLabel}
            </text>
          )}
        </>
      )}
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle cx={xFor(points.length - 1)} cy={yFor(finalEquity)} r={4} fill={stroke} />
    </svg>
  )
}

/**
 * Find the trade indices where the equity dipped furthest below its running
 * peak. Returns up to N indices, dedup'd against neighbors so we don't draw
 * three lines on top of each other in a long stretch underwater.
 */
function findDeepestDrawdowns(values: number[], n: number): number[] {
  const candidates: { idx: number; dd: number }[] = []
  let peak = values[0]
  for (let i = 1; i < values.length; i++) {
    if (values[i] > peak) peak = values[i]
    const dd = peak - values[i]
    if (dd > 0) candidates.push({ idx: i, dd })
  }
  candidates.sort((a, b) => b.dd - a.dd)
  const picked: number[] = []
  const minGap = Math.max(5, Math.floor(values.length / 10))
  for (const c of candidates) {
    if (picked.length >= n) break
    if (picked.every((p) => Math.abs(p - c.idx) > minGap)) picked.push(c.idx)
  }
  return picked
}

/**
 * Project benchmark %-from-start values onto the equity-curve coordinate space.
 * For each equity point, find the closest benchmark date and use that
 * benchmark % as the y-value (re-scaled into equity dollar units so it shares
 * the chart area).
 */
function buildBenchmarkPath(
  benchmark: BenchmarkPoint[],
  equity: EquityPoint[],
  equityRange: number,
  equityMin: number,
  padX: number,
  padY: number,
  W: number,
  H: number,
): string {
  const stepX = (W - padX * 2) / (equity.length - 1)
  const yFor = (v: number) => H - padY - ((v - equityMin) / equityRange) * (H - padY * 2)
  // Convert benchmark % into pseudo-equity dollars by scaling to the equity span.
  // If equity moved from 0 → +$1000, a +5% benchmark renders at +$50 (5% of the
  // equity excursion magnitude), keeping the two visually comparable rather than
  // clipping at the chart edges.
  const equityAbsRange = Math.max(Math.abs(equity[equity.length - 1].equity - equity[0].equity), 100)
  const sortedBench = [...benchmark].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let bIdx = 0
  const cmds: string[] = []
  for (let i = 0; i < equity.length; i++) {
    const targetTs = new Date(equity[i].date).getTime()
    while (bIdx < sortedBench.length - 1 && new Date(sortedBench[bIdx + 1].date).getTime() <= targetTs) {
      bIdx++
    }
    const pseudoDollars = (sortedBench[bIdx].pctFromStart / 100) * equityAbsRange
    cmds.push(`${i === 0 ? "M" : "L"}${(padX + i * stepX).toFixed(2)},${yFor(pseudoDollars).toFixed(2)}`)
  }
  return cmds.join(" ")
}
