"use client"

import { useEffect, useState, useTransition } from "react"
import { Icon } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import { generateCoachInsights, type CoachState } from "@/lib/actions/coach"
import type { OverallStats } from "@/lib/queries/analytics"

/**
 * Coach AI banner.
 *
 * Behavior:
 *   - On mount, calls `generateCoachInsights()` (server action). If
 *     ANTHROPIC_API_KEY is set, this returns either a fresh or day-cached
 *     list of observations. If unset, returns a `configured: false` error.
 *   - When AI is unavailable, falls back to the deterministic narrative
 *     based on the user's own stats — same UX you've always had.
 *   - "Refresh" button forces a regeneration ignoring the daily cache.
 */
export function CoachNudge({ stats }: { stats: OverallStats | null }) {
  const [state, setState] = useState<CoachState | null>(null)
  const [pending, startTransition] = useTransition()
  const [loaded, setLoaded] = useState(false)

  // Lazy initial fetch — runs once when the widget appears
  useEffect(() => {
    if (loaded) return
    setLoaded(true)
    startTransition(async () => {
      const r = await generateCoachInsights(false)
      setState(r)
    })
  }, [loaded])

  const onRefresh = () => {
    startTransition(async () => {
      const r = await generateCoachInsights(true)
      setState(r)
    })
  }

  // What to render in the body
  const aiAvailable = !!state && state.ok
  const aiNotConfigured = state && !state.ok && state.configured === false
  const aiErrored = state && !state.ok && state.configured === true

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(67, 18, 160, 0.22), rgba(105, 50, 212, 0.06))",
        border: "1px solid rgba(105, 50, 212, 0.35)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #4312A0, #6932D4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name="sparkle" size={18} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600 }}>
              Coach AI · Daily Brief
            </span>
            <span className="chip chip-purple" style={{ fontSize: 9.5, padding: "1px 6px" }}>
              {aiAvailable ? "AI" : aiNotConfigured ? "BETA · Setup" : "BETA"}
            </span>
            {aiAvailable && state.ok && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={pending}
                title="Regenerate today's insights"
                className="btn"
                style={{ marginLeft: "auto", padding: "3px 8px", fontSize: 11 }}
              >
                <Icon name="refresh" size={10} />
                <span>{pending ? "…" : "Refresh"}</span>
              </button>
            )}
          </div>

          {pending && !state ? (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
              Reading your last 30 days…
            </p>
          ) : aiAvailable && state.ok ? (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
              {state.insights.map((s, i) => <li key={i} style={{ marginBottom: i < state.insights.length - 1 ? 4 : 0 }}>{s}</li>)}
            </ul>
          ) : aiNotConfigured ? (
            <div style={{ fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
              <p style={{ margin: "0 0 6px" }}>
                {narrative(stats)}
              </p>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--c-fg-dim)" }}>
                Set <code style={{ fontFamily: "var(--font-mono)" }}>ANTHROPIC_API_KEY</code> in your environment for tailored AI observations.
              </p>
            </div>
          ) : aiErrored ? (
            <div style={{ fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
              <p style={{ margin: "0 0 6px" }}>
                {narrative(stats)}
              </p>
              <p style={{ margin: 0, fontSize: 11.5, color: "var(--c-amber)" }}>
                AI nudges errored: {state.error}
              </p>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
              {narrative(stats)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function narrative(stats: OverallStats | null): React.ReactNode {
  if (!stats || stats.closedTrades === 0) {
    return (
      <>
        Log or sync a few trades and I&apos;ll start surfacing patterns —
        win rate by pair, edge per setup, time-of-day clustering, drawdown risk.
      </>
    )
  }
  if (stats.closedTrades < 5) {
    return (
      <>
        Just <strong style={{ color: "var(--c-fg)" }}>{stats.closedTrades}</strong> closed trade
        {stats.closedTrades === 1 ? "" : "s"} so far — analytics unlock at 5. Keep logging.
      </>
    )
  }

  const profitable = stats.totalPnL > 0
  const wrColor = profitable ? "var(--c-green-bright)" : "var(--c-red-bright)"
  const tone = profitable ? "in the green" : "underwater"
  const pair = stats.bestPair?.pair ?? "your top pair"

  return (
    <>
      You&apos;re currently <strong style={{ color: wrColor }}>{formatUSD(stats.totalPnL, { signed: true })}</strong> across{" "}
      <strong style={{ color: "var(--c-fg)" }}>{stats.closedTrades}</strong> closed trades — {tone} with a{" "}
      <strong style={{ color: "var(--c-fg)" }}>{stats.winRate ?? 0}%</strong> win rate.
      {stats.bestPair ? (
        <> Best edge is <strong style={{ color: "var(--c-fg)" }}>{pair}</strong> ({formatUSD(stats.bestPair.pnl, { signed: true })}).</>
      ) : null}
      {stats.maxDrawdown != null && stats.maxDrawdown > 10 ? (
        <> Watch drawdown — <strong style={{ color: "var(--c-red-bright)" }}>{stats.maxDrawdown}%</strong> peak-to-trough is past the comfort zone.</>
      ) : null}
    </>
  )
}
