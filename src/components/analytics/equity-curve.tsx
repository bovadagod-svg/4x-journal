import type { EquityPoint } from "@/lib/queries/analytics"

/**
 * SVG sparkline-style equity curve. Pure — no JS in browser, just an SVG.
 * Shaded area below (positive vs negative) makes the trend pop.
 */
export function EquityCurve({ points, height = 220 }: { points: EquityPoint[]; height?: number }) {
  if (points.length < 2) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
        Equity curve appears once you have 2+ closed trades.
      </div>
    )
  }

  const W = 1000 // virtual width — SVG scales via viewBox
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

  // Area path closes back along the zero line (or floor).
  const zeroY = yFor(0)
  const areaPath = `${path} L${xFor(points.length - 1).toFixed(2)},${zeroY.toFixed(2)} L${xFor(0).toFixed(2)},${zeroY.toFixed(2)} Z`

  const finalEquity = values[values.length - 1]
  const tone = finalEquity > 0 ? "green" : finalEquity < 0 ? "red" : "neutral"
  const stroke = tone === "green" ? "var(--c-green-bright)" : tone === "red" ? "var(--c-red-bright)" : "var(--c-fg-muted)"
  const fill = tone === "green" ? "rgba(45, 219, 115, 0.12)" : tone === "red" ? "rgba(224, 74, 85, 0.12)" : "rgba(154, 151, 161, 0.10)"

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Equity curve">
      {/* Zero line */}
      <line x1={padX} x2={W - padX} y1={zeroY} y2={zeroY} stroke="var(--c-border)" strokeWidth={1} strokeDasharray="3 4" />
      <path d={areaPath} fill={fill} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle cx={xFor(points.length - 1)} cy={yFor(finalEquity)} r={4} fill={stroke} />
    </svg>
  )
}
