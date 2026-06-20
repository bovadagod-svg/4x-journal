"use client"

import { useEffect, useState, useTransition } from "react"
import { Icon } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import { generateCoachInsights, type CoachState, type CoachInsightsPayload, type CoachStat } from "@/lib/actions/coach"
import { createTradeRule } from "@/lib/actions/trade-rules"
import type { OverallStats } from "@/lib/queries/analytics"

/** Best-effort extractor for "EUR/USD" from a Coach suggestion sentence. */
function extractPair(text: string): string | null {
  const m = text.match(/\b([A-Z]{3})\s*\/\s*([A-Z]{3})\b/i)
  return m ? `${m[1].toUpperCase()}/${m[2].toUpperCase()}` : null
}

/** Best-effort extractor for long/short from a Coach suggestion sentence. */
function extractSide(text: string): "long" | "short" | null {
  if (/\bshort(s|ing|ed)?\b/i.test(text)) return "short"
  if (/\blong(s|ing|ed)?\b/i.test(text)) return "long"
  return null
}

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
export function CoachNudge({ stats, from = null, to = null }: { stats: OverallStats | null; from?: string | null; to?: string | null }) {
  const [state, setState] = useState<CoachState | null>(null)
  const [pending, startTransition] = useTransition()

  // Fetch (and re-fetch when the dashboard view/range changes) — the brief is
  // scoped to whatever range the user is currently looking at.
  useEffect(() => {
    let cancelled = false
    startTransition(async () => {
      const r = await generateCoachInsights({ from, to })
      if (!cancelled) setState(r)
    })
    return () => { cancelled = true }
  }, [from, to])

  const onRefresh = () => {
    startTransition(async () => {
      const r = await generateCoachInsights({ from, to, force: true })
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
              Analyzing this view…
            </p>
          ) : aiAvailable && state.ok ? (
            <BriefBody payload={state.payload} />
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

/** Rich daily-brief body: headline → stat grid → positives / watch-outs /
 * notable → suggested actions. Falls back to a flat list for the legacy
 * (observations-only) shape used by the weekly retrospective. */
function BriefBody({ payload }: { payload: CoachInsightsPayload }) {
  const hasRich =
    !!payload.headline ||
    (payload.positives?.length ?? 0) > 0 ||
    (payload.watchouts?.length ?? 0) > 0 ||
    (payload.notable?.length ?? 0) > 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {payload.headline && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--c-fg)", lineHeight: 1.5 }}>
          {payload.headline}
        </p>
      )}

      {payload.stats && payload.stats.length > 0 && <StatGrid stats={payload.stats} />}

      {hasRich ? (
        <>
          <BriefSection title="What's working" items={payload.positives} dot="var(--c-green-bright)" />
          <BriefSection title="Watch out for" items={payload.watchouts} dot="var(--c-amber)" />
          <BriefSection title="Also worth noting" items={payload.notable} dot="var(--c-fg-dim)" />
        </>
      ) : (
        payload.observations.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
            {payload.observations.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
          </ul>
        )
      )}

      {payload.suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Suggested actions
          </div>
          {payload.suggestions.map((s, i) => <SuggestionPill key={i} suggestion={s} />)}
        </div>
      )}
    </div>
  )
}

function StatGrid({ stats }: { stats: CoachStat[] }) {
  const toneColor = (t?: string) => t === "good" ? "var(--c-green-bright)" : t === "bad" ? "var(--c-red-bright)" : "var(--c-fg)"
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 6 }}>
      {stats.map((s) => (
        <div key={s.label} style={{ background: "rgba(0,0,0,0.18)", border: "1px solid var(--c-border)", borderRadius: 8, padding: "6px 8px" }}>
          <div style={{ fontSize: 9, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
          <div className="tnum" style={{ fontSize: 14, fontWeight: 600, color: toneColor(s.tone), marginTop: 1 }}>{s.value}</div>
        </div>
      ))}
    </div>
  )
}

function BriefSection({ title, items, dot }: { title: string; items?: string[]; dot: string }) {
  if (!items || items.length === 0) return null
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((s, i) => (
          <li key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
            <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: "50%", background: dot, marginTop: 6 }} />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type Suggestion = { action: string; basis: string; severity: "info" | "warn" }

function SuggestionPill({ suggestion: s }: { suggestion: Suggestion }) {
  const isWarn = s.severity === "warn"
  const accent = isWarn ? "var(--c-amber)" : "var(--c-purple-bright)"

  const detectedPair = extractPair(s.action)
  const detectedSide = extractSide(s.action)
  // Only offer the CTA when we can derive a pair-side bet — that's the only
  // rule kind v1 of #72 supports. Keeps the surface honest about scope.
  const ruleable = !!(detectedPair && detectedSide)

  const [showForm, setShowForm] = useState(false)
  const [pair, setPair] = useState(detectedPair ?? "")
  const [side, setSide] = useState<"long" | "short">(detectedSide ?? "long")
  const [pending, startTransition] = useTransition()
  const [savedAs, setSavedAs] = useState<"none" | "saved">("none")

  const onSave = () => {
    const cleanPair = pair.trim().toUpperCase()
    if (!/^[A-Z]{3,4}\/[A-Z]{3,4}$/.test(cleanPair)) {
      alert("Pair must look like EUR/USD.")
      return
    }
    startTransition(async () => {
      const r = await createTradeRule({
        kind: "block_pair_side",
        payload: { pair: cleanPair, side },
        reason: s.action.length > 240 ? s.action.slice(0, 237) + "…" : s.action,
        source: "coach",
        severity: "warn",
      })
      if (r.ok) {
        setSavedAs("saved")
        setShowForm(false)
      } else {
        alert(r.error)
      }
    })
  }

  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        background: isWarn ? "rgba(229, 162, 59, 0.08)" : "rgba(105, 50, 212, 0.08)",
        border: `1px solid ${isWarn ? "rgba(229, 162, 59, 0.3)" : "rgba(105, 50, 212, 0.25)"}`,
        display: "flex", flexDirection: "column", gap: 6,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{
          fontSize: 9, fontWeight: 700,
          color: accent,
          textTransform: "uppercase", letterSpacing: "0.06em",
          marginTop: 2, flexShrink: 0,
        }}>{s.severity}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-fg)" }}>{s.action}</div>
          <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.45, marginTop: 2 }}>{s.basis}</div>
        </div>
        {ruleable && savedAs === "none" && !showForm && (
          <button
            type="button"
            className="btn"
            onClick={() => setShowForm(true)}
            title="Add this as a rule that warns on Log Trade"
            style={{ padding: "3px 8px", fontSize: 10.5, flexShrink: 0 }}
          >
            <Icon name="check" size={10} />
            <span>Add as rule</span>
          </button>
        )}
        {savedAs === "saved" && (
          <span
            title="Rule saved — manage in Settings → Trade rules"
            style={{ fontSize: 10.5, color: "var(--c-green-bright)", flexShrink: 0, marginTop: 3 }}
          >
            ✓ Rule saved
          </span>
        )}
      </div>

      {showForm && (
        <div
          style={{
            display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
            paddingTop: 6, borderTop: "1px solid var(--c-border)",
          }}
        >
          <span style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Block:
          </span>
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as "long" | "short")}
            style={selectStyle}
          >
            <option value="long">Longs</option>
            <option value="short">Shorts</option>
          </select>
          <span style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>on</span>
          <input
            type="text"
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            placeholder="EUR/USD"
            style={{ ...selectStyle, width: 90 }}
          />
          <button
            type="button"
            className="btn"
            onClick={onSave}
            disabled={pending}
            style={{ padding: "3px 8px", fontSize: 10.5, background: "var(--c-purple-bright)", color: "white" }}
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setShowForm(false)}
            style={{ padding: "3px 8px", fontSize: 10.5 }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  padding: "3px 6px",
  fontSize: 11,
  background: "var(--c-bg-elev-1)",
  color: "var(--c-fg)",
  border: "1px solid var(--c-border)",
  borderRadius: 4,
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
