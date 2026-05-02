import { SkeletonPage } from "@/components/shell/skeleton"

export default function Loading() {
  return <SkeletonPage kpiCount={4} showTable={false} showGrid />
}
