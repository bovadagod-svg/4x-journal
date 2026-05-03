"use client"

import { useEffect } from "react"
import { Icon } from "@/components/icons"
import { captureException } from "@/lib/observability"

/**
 * Generic route-level error fallback. Used by every section's `error.tsx` so
 * the user sees a humane message + recovery options instead of a blank
 * Next.js error page when a server action throws or a query fails.
 *
 * The `digest` field that Next attaches in production is shown in small
 * monospace under the message — useful when the user reports a bug since
 * we can correlate to server logs.
 */
export function ErrorFallback({
  error,
  reset,
  section,
}: {
  error: Error & { digest?: string }
  reset: () => void
  section: string
}) {
  useEffect(() => {
    // Log to console in dev so the actual stack is visible. In prod, also
    // POSTs to Sentry's HTTP envelope endpoint when SENTRY_DSN is set.
    captureException(error, { section, digest: error.digest })
  }, [error, section])

  return (
    <div className="card" style={{
      padding: 32,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
      textAlign: "center",
      border: "1px solid rgba(190, 51, 61, 0.3)",
      background: "rgba(190, 51, 61, 0.04)",
      maxWidth: 560, margin: "40px auto",
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: "rgba(190, 51, 61, 0.15)",
        border: "1px solid rgba(190, 51, 61, 0.3)",
        display: "grid", placeItems: "center",
      }}>
        <Icon name="flag" size={22} color="var(--c-red-bright)" />
      </div>
      <div>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--c-red-bright)" }}>
          Something went wrong on the {section} page
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
          A query or server action crashed. Try again — if it keeps failing, the message below
          might help you (or me) figure out why.
        </p>
      </div>
      {error.message && (
        <div style={{
          padding: 10, borderRadius: 8,
          background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)",
          fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--c-fg-muted)",
          maxWidth: "100%", textAlign: "left", overflowX: "auto", whiteSpace: "pre-wrap",
        }}>
          {error.message}
          {error.digest && (
            <div style={{ marginTop: 6, color: "var(--c-fg-dim)" }}>digest: {error.digest}</div>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={reset} className="btn btn-primary">
          <Icon name="refresh" size={12} /> <span>Try again</span>
        </button>
        <a href="/" className="btn">
          <Icon name="dashboard" size={12} /> <span>Dashboard</span>
        </a>
      </div>
    </div>
  )
}
