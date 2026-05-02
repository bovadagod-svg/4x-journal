import { SkeletonHeader, SkeletonCard } from "@/components/shell/skeleton"

export default function Loading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SkeletonHeader />
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 18 }}>
        <SkeletonCard height={400} />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SkeletonCard height={140} />
          <SkeletonCard height={220} />
        </div>
      </div>
    </div>
  )
}
