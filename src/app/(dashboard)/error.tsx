"use client"

import { ErrorFallback } from "@/components/shell/error-fallback"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorFallback error={error} reset={reset} section="dashboard" />
}
