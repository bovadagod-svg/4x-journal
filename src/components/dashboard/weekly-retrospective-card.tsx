"use client"

import { useEffect, useState, useTransition } from "react"
import { Icon } from "@/components/icons"
import { generateWeeklyRetrospective, type CoachState } from "@/lib/actions/coach"

/**
 * Weekly retrospective card. Companion to CoachNudge but scoped to last 7 days
 * with a "this is what to keep / stop" framing. Cached per ISO week so it
 * stays stable Monday morning → Sunday night without re-burning the API.
 *
 * Hidden when ANTHROPIC_API_KEY isn't configured (no deterministic fallback —
 * the format requires the LLM's prose synthesis). Coach Daily Brief still
 * runs deterministically when the key is missing.
 */
export function WeeklyRetrospectiveCard() {
  const [state, setState] = useState<CoachState | null>(null)
  const [, startTransition] = useTransition()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (loaded) return
    setLoaded(true)
    startTransition(async () => {
      const r = await generateWeeklyRetrospective(false)
      setState(r)
    })
  }, [loaded])

  const onRefresh = () => {
    startTransition(async () => {
      const r = await generateWeeklyRetrospective(true)
      setState(r)
    })
  }

  // Hide entirely when AI isn't configured — daily Coach Nudge already handles
  // the "set up your key" prompt; we don't need to repeat it.
  if (state && !state.ok && state.configured === false) return null

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(91, 200, 224, 0.12), rgba(105, 50, 212, 0.05))",
        border: "1px solid rgba(91, 200, 224, 0.3)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: state?.ok ? 10 : 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: "linear-gradient(135deg, #5BC8E0, #6932D4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon name="book" size={15} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600 }}>
              Weekly Retrospective
            </span>
            <span className="chip" style={{ fontSize: 9.5, padding: "1px 6px", color: "var(--c-cyan-bright)", background: "var(--c-cyan-soft)", borderColor: "rgba(91, 200, 224, 0.3)" }}>
              LAST 7 DAYS
            </span>
            {state?.ok && (
              <button
                type="button"
                onClick={onRefresh}
                style={{
                  marginLeft: "auto",
                  fontSize: 10.5, padding: "2px 8px",
                  background: "transparent",
                  border: "1px solid var(--c-border)",
                  borderRadius: 6,
                  color: "var(--c-fg-muted)",
                  cursor: "pointer",
                }}
                title={state.cached ? `Cached (${state.generatedAt.slice(0, 10)})` : "Force regenerate"}
              >
                {state.cached ? "Refresh" : "Regenerate"}
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>
            What to keep doing · what to stop · what to try this week
          </div>
        </div>
      </div>

      {!state && (
        <div style={{ fontSize: 12, color: "var(--c-fg-muted)", padding: "8px 0 0 42px" }}>
          Reading your week…
        </div>
      )}

      {state?.ok && state.payload.observations.length > 0 && (
        <div style={{ paddingLeft: 42 }}>
          <ul style={{ margin: "0 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--c-fg)", lineHeight: 1.6 }}>
            {state.payload.observations.map((o, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{o}</li>
            ))}
          </ul>

          {state.payload.suggestions.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {state.payload.suggestions.map((s, i) => (
                <div
                  key={i}
                  style={{
                    padding: "8px 10px",
                    border: `1px solid ${s.severity === "warn" ? "rgba(229, 162, 59, 0.35)" : "rgba(91, 200, 224, 0.3)"}`,
                    background: s.severity === "warn" ? "var(--c-amber-soft)" : "var(--c-cyan-soft)",
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                    <span className="chip" style={{
                      fontSize: 9, padding: "1px 6px",
                      color: s.severity === "warn" ? "var(--c-amber)" : "var(--c-cyan-bright)",
                      background: "transparent",
                      borderColor: s.severity === "warn" ? "var(--c-amber)" : "var(--c-cyan-bright)",
                    }}>
                      {s.severity === "warn" ? "WARN" : "TRY"}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>{s.action}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--c-fg-muted)", marginLeft: 0 }}>{s.basis}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state && !state.ok && (
        <div style={{ fontSize: 11.5, color: "var(--c-amber)", padding: "8px 0 0 42px" }}>
          Couldn&apos;t generate the retrospective: {state.error}
        </div>
      )}
    </div>
  )
}
