import { formatUSD } from "@/lib/finance"

/**
 * Full equity-curve card with zero-line reference, gradient area to zero,
 * and Net + Max DD stats in the header. Pure SVG, server-renderable.
 */
export function CumulativeCurve({ values, height = 220 }: { values: number[]; height?: number }) {
  if (values.length < 2) {
    return (
      <div className="card">
        <div style={{ marginBottom: 8 }}>
          <h3 className="card-title">Cumulative P&L</h3>
          <p className="card-subtitle">Running net across all filtered trades</p>
        </div>
        <div style={{ height, display: "grid", placeItems: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
          Need at least 2 closed trades for a cumulative curve.
        </div>
      </div>
    )
  }

  // Running max for max DD
  let runMax = -Infinity
  let maxDD = 0
  for (const v of values) {
    if (v > runMax) runMax = v
    const dd = v - runMax
    if (dd < maxDD) maxDD = dd
  }
  const net = values[values.length - 1]

  const W = 760
  const H = height
  const padX = 6
  const padY = 14
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1
  const stepX = (W - padX * 2) / (values.length - 1)
  const yFor = (v: number) => H - padY - ((v - min) / range) * (H - padY * 2)
  const xFor = (i: number) => padX + i * stepX

  const path = values.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(2)},${yFor(v).toFixed(2)}`).join(" ")
  const zeroY = yFor(0)
  const areaPath = `${path} L${xFor(values.length - 1).toFixed(2)},${zeroY.toFixed(2)} L${xFor(0).toFixed(2)},${zeroY.toFixed(2)} Z`
  const tone = net >= 0 ? "green" : "red"
  const stroke = tone === "green" ? "var(--c-green-bright)" : "var(--c-red-bright)"
  const fill = tone === "green" ? "rgba(45, 219, 115, 0.18)" : "rgba(224, 74, 85, 0.18)"
  const gridLines = 4

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="card-title">Cumulative P&L</h3>
          <p className="card-subtitle">Running net across all filtered trades</p>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          <div>
            <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>Net</div>
            <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: net >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
              {formatUSD(net, { signed: true })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)" }}>Max DD</div>
            <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--c-red-bright)" }}>
              {formatUSD(maxDD, { signed: true })}
            </div>
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label="Cumulative P&L">
        {Array.from({ length: gridLines + 1 }).map((_, i) => (
          <line
            key={i}
            x1={padX}
            x2={W - padX}
            y1={padY + ((H - padY * 2) / gridLines) * i}
            y2={padY + ((H - padY * 2) / gridLines) * i}
            stroke="var(--c-border)"
            strokeDasharray="2 4"
          />
        ))}
        <line x1={padX} x2={W - padX} y1={zeroY} y2={zeroY} stroke="var(--c-fg-dim)" strokeDasharray="3 3" strokeWidth={1} />
        <path d={areaPath} fill={fill} />
        <path d={path} fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
        <span>Trade 1</span>
        <span>Trade {Math.floor(values.length / 2)}</span>
        <span>Trade {values.length}</span>
      </div>
    </div>
  )
}
