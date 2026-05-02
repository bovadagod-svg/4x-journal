/**
 * SVG donut for percentage indicators (risk usage, drawdown, etc).
 * Pure server-renderable — no JS in browser.
 */
export function Donut({
  value,
  size = 140,
  thickness = 10,
  color = "var(--c-accent-bright)",
  trackColor = "var(--c-bg-elev-3)",
  label,
  sublabel,
}: {
  value: number       // 0–100
  size?: number
  thickness?: number
  color?: string
  trackColor?: string
  label?: string
  sublabel?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (v / 100) * circumference
  const center = size / 2

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }} aria-label={`${v}%`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.4s" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        {label && (
          <div className="tnum" style={{
            fontFamily: "var(--font-mono)", fontSize: size * 0.18, fontWeight: 600,
            color: "var(--c-fg)", lineHeight: 1,
          }}>
            {label}
          </div>
        )}
        {sublabel && (
          <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>{sublabel}</div>
        )}
      </div>
    </div>
  )
}
