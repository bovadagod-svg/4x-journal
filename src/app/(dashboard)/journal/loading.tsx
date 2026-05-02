import { SkeletonPage } from "@/components/shell/skeleton"

export default function Loading() {
  return <SkeletonPage kpiCount={4} rowCount={8} colCount={4} />
}
