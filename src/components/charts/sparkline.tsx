/**
 * Tiny inline area+line. Pure SVG, server-renderable.
 * Used by PnLStrip, account rows, anywhere a thumbnail trend belongs.
 *
 * Ported from prototype's `charts.jsx#Sparkline`.
 */
export function Sparkline({
  points,
  color = "var(--c-green)",
  width = 64,
  height = 22,
  fill = true,
  fillOpacity = 0.18,
  strokeWidth = 1.5,
}: {
  points: number[]
  color?: string
  width?: number
  height?: number
  fill?: boolean
  fillOpacity?: number
  strokeWidth?: number
}) {
  if (!points || points.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ display: "block" }}
      >
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="var(--c-border)" strokeWidth={1} strokeDasharray="2 3" />
      </svg>
    )
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const stepX = points.length > 1 ? width / (points.length - 1) : 0
  const yFor = (v: number) => height - ((v - min) / range) * height

  const path = points.map((v, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ")
  const area = `${path} L${width},${height} L0,${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {fill && <path d={area} fill={color} opacity={fillOpacity} />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
