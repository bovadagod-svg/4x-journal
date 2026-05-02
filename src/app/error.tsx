"use client"

import { ErrorFallback } from "@/components/shell/error-fallback"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--c-bg)", display: "grid", placeItems: "center", padding: 18 }}>
      <ErrorFallback error={error} reset={reset} section="app" />
    </div>
  )
}
