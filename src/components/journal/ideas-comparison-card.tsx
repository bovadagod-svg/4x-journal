"use client"

import { useMemo, useState, useTransition } from "react"
import { Icon } from "@/components/icons"
import type { JournalEntry } from "@/lib/queries/trades"
import { resolveAllPendingIdeas } from "@/lib/actions/idea-resolution"

const STILL_WATCHING_DAYS = 14

type IdeaStats = {
  total: number
  executed: number
  watching: number
  skipped: number
  executionRate: number  // 0..1
  /** Sum of resolved_r across SKIPPED ideas with idea_outcome populated.
   *  This is the #58 "would have averaged +0.8R" punchline. */
  skippedResolvedRTotal: number
  skippedResolvedRCount: number
}

type IdeaOutcomeShape = { resolution?: string; resolved_r?: number }

function ideaStats(entries: JournalEntry[]): IdeaStats {
  const ideas = entries.filter((e) => e.kind === "idea")
  if (ideas.length === 0) {
    return { total: 0, executed: 0, watching: 0, skipped: 0, executionRate: 0, skippedResolvedRTotal: 0, skippedResolvedRCount: 0 }
  }
  const watchCutoff = Date.now() - STILL_WATCHING_DAYS * 86_400_000
  let executed = 0
  let watching = 0
  let skipped = 0
  let skippedResolvedRTotal = 0
  let skippedResolvedRCount = 0
  for (const e of ideas) {
    if (e.trade_id) {
      executed++
    } else if (new Date(e.created_at).getTime() >= watchCutoff) {
      watching++
    } else {
      skipped++
      const outcome = e.idea_outcome as IdeaOutcomeShape | null
      if (outcome && typeof outcome.resolved_r === "number" && Number.isFinite(outcome.resolved_r)) {
        skippedResolvedRTotal += outcome.resolved_r
        skippedResolvedRCount += 1
      }
    }
  }
  const decided = executed + skipped
  const executionRate = decided > 0 ? executed / decided : 0
  return { total: ideas.length, executed, watching, skipped, executionRate, skippedResolvedRTotal, skippedResolvedRCount }
}

export function IdeasComparisonCard({ entries }: { entries: JournalEntry[] }) {
  const [resolving, startResolve] = useTransition()
  const [resolveMsg, setResolveMsg] = useState<string | null>(null)
  const stats30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 86_400_000
    return ideaStats(entries.filter((e) => new Date(e.created_at).getTime() >= cutoff))
  }, [entries])
  const statsAllTime = useMemo(() => ideaStats(entries), [entries])
  // Pending ideas = setup-filled but no outcome yet, in the 30d window
  const pendingResolution = useMemo(() => entries.filter((e) =>
    e.kind === "idea" &&
    !e.trade_id &&
    !e.idea_outcome &&
    e.idea_pair && e.idea_side && e.idea_entry && e.idea_stop && e.idea_target
  ).length, [entries])

  const onResolve = () => {
    setResolveMsg("Resolving…")
    startResolve(async () => {
      const r = await resolveAllPendingIdeas()
      setResolveMsg(r.ok ? `Resolved ${r.resolved} · ${r.failed} failed` : "Resolution failed")
    })
  }

  if (statsAllTime.total === 0) return null

  const ratePct = Math.round(stats30d.executionRate * 100)
  const rateColor = stats30d.executionRate >= 0.5
    ? "var(--c-green-bright)"
    : stats30d.executionRate >= 0.25
      ? "var(--c-amber)"
      : "var(--c-fg-muted)"

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="lightning" size={14} color="var(--c-amber)" />
            <span>Ideas vs Executions</span>
          </h3>
          <p className="card-subtitle">
            Tracking the gap between setups you spot and trades you actually take · last 30 days
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Execution rate</div>
          <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: rateColor }}>
            {stats30d.total === 0 ? "—" : `${ratePct}%`}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
        <Cell label="Ideas this 30d" value={String(stats30d.total)} sub={`${statsAllTime.total} all-time`} />
        <Cell label="Executed" value={String(stats30d.executed)} color="var(--c-green-bright)" sub="linked to a trade" />
        <Cell label="Skipped" value={String(stats30d.skipped)} color="var(--c-fg-muted)" sub={`older than ${STILL_WATCHING_DAYS}d, no trade`} />
        <Cell label="Watching" value={String(stats30d.watching)} color="var(--c-amber)" sub="still actionable" />
      </div>

      {stats30d.executed + stats30d.skipped >= 5 && (
        <p style={{ marginTop: 12, fontSize: 11.5, color: "var(--c-fg-dim)", lineHeight: 1.5 }}>
          {ratePct >= 70
            ? "You're following through on most setups you flag — keep it up."
            : ratePct >= 40
              ? `You skipped ${stats30d.skipped} of ${stats30d.executed + stats30d.skipped} judged ideas. Worth reviewing whether those were good decisions or lost edge.`
              : `Only ${ratePct}% of your judged ideas turned into trades. Either your idea bar is too low, or hesitation is leaving setups on the table.`}
        </p>
      )}

      {/* #58 Skipped-ideas hypothetical R — needs idea_outcome populated */}
      {stats30d.skippedResolvedRCount >= 3 && (() => {
        const avg = stats30d.skippedResolvedRTotal / stats30d.skippedResolvedRCount
        const tone = avg >= 0.3 ? "good" : avg <= -0.3 ? "ok" : "neutral"
        const text = avg >= 0.3
          ? `The ${stats30d.skippedResolvedRCount} skipped ideas you fully specified would have averaged ${avg > 0 ? "+" : ""}${avg.toFixed(2)}R. Those were good setups you didn't take.`
          : avg <= -0.3
            ? `The ${stats30d.skippedResolvedRCount} skipped ideas you specified would have lost ${Math.abs(avg).toFixed(2)}R on average. Skipping was the right call.`
            : `${stats30d.skippedResolvedRCount} skipped ideas resolved to ~breakeven on average (${avg > 0 ? "+" : ""}${avg.toFixed(2)}R). The setups were neither edges nor traps.`
        return (
          <div style={{
            marginTop: 10, padding: 10,
            background: tone === "good" ? "var(--c-amber-soft)" : tone === "ok" ? "var(--c-green-soft)" : "var(--c-bg-elev-2)",
            border: `1px solid ${tone === "good" ? "rgba(229, 162, 59, 0.3)" : tone === "ok" ? "rgba(17, 196, 88, 0.3)" : "var(--c-border)"}`,
            borderRadius: 8, fontSize: 12, color: "var(--c-fg-muted)",
          }}>
            {text}
          </div>
        )
      })()}

      {/* Resolve pending ideas (Polygon backfill) */}
      {pendingResolution > 0 && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
          <button
            type="button"
            className="btn"
            disabled={resolving}
            onClick={onResolve}
            style={{ fontSize: 11, padding: "4px 10px" }}
          >
            <Icon name="refresh" size={11} /> {resolving ? "Resolving…" : `Resolve ${pendingResolution} idea${pendingResolution === 1 ? "" : "s"}`}
          </button>
          {resolveMsg && <span style={{ color: "var(--c-fg-muted)" }}>{resolveMsg}</span>}
          <span style={{ color: "var(--c-fg-dim)", marginLeft: "auto" }}>Uses Polygon historical bars</span>
        </div>
      )}
    </div>
  )
}

function Cell({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{
      background: "var(--c-bg-elev-2)",
      border: "1px solid var(--c-border)",
      borderRadius: 8,
      padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 2 }}>{sub}</div>
    </div>
  )
}
