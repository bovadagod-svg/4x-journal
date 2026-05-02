import type { CSSProperties } from "react"

/**
 * Shared loading-skeleton primitives. Used in route-level loading.tsx files
 * so the user sees structured placeholders instead of blank screen during
 * server-side data fetches.
 */

export function SkeletonBlock({ width, height, radius = 8, style }: {
  width?: number | string
  height?: number | string
  radius?: number
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        width: width ?? "100%",
        height: height ?? 16,
        borderRadius: radius,
        background: "var(--c-bg-elev-2)",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      <span style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(90deg, transparent, var(--c-bg-elev-3), transparent)",
        animation: "skeleton-shimmer 1.4s infinite",
        backgroundSize: "200% 100%",
      }} />
      <style>{`
        @keyframes skeleton-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

export function SkeletonHeader() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 4 }}>
      <SkeletonBlock width={180} height={24} />
      <SkeletonBlock width={280} height={14} />
    </div>
  )
}

export function SkeletonKpi() {
  return (
    <div className="card" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
      <SkeletonBlock width={80} height={11} />
      <SkeletonBlock width={120} height={26} />
      <SkeletonBlock width={140} height={11} />
    </div>
  )
}

export function SkeletonKpiStrip({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonKpi key={i} />)}
    </div>
  )
}

export function SkeletonTableRows({ rows = 6, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div className="card" style={{ padding: 0 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 12,
            padding: "12px 16px",
            borderTop: i === 0 ? "none" : "1px solid var(--c-border)",
            alignItems: "center",
          }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonBlock key={j} height={14} width={j === cols - 1 ? "60%" : undefined} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ height = 180 }: { height?: number }) {
  return <div className="card" style={{ height, position: "relative", overflow: "hidden" }}>
    <SkeletonBlock height="100%" radius={0} />
  </div>
}

export function SkeletonGrid({ count = 6, height = 240 }: { count?: number; height?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} height={height} />)}
    </div>
  )
}

export function SkeletonPage({
  showKpis = true,
  showTable = true,
  showGrid = false,
  kpiCount = 4,
  rowCount = 6,
  colCount = 7,
}: {
  showKpis?: boolean
  showTable?: boolean
  showGrid?: boolean
  kpiCount?: number
  rowCount?: number
  colCount?: number
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SkeletonHeader />
      {showKpis && <SkeletonKpiStrip count={kpiCount} />}
      {showTable && <SkeletonTableRows rows={rowCount} cols={colCount} />}
      {showGrid && <SkeletonGrid />}
    </div>
  )
}
