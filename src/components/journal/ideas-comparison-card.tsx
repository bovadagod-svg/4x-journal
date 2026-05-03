"use client"

import { useMemo } from "react"
import { Icon } from "@/components/icons"
import type { JournalEntry } from "@/lib/queries/trades"

const STILL_WATCHING_DAYS = 14

type IdeaStats = {
  total: number
  executed: number
  watching: number
  skipped: number
  executionRate: number  // 0..1
}

function ideaStats(entries: JournalEntry[]): IdeaStats {
  const ideas = entries.filter((e) => e.kind === "idea")
  if (ideas.length === 0) {
    return { total: 0, executed: 0, watching: 0, skipped: 0, executionRate: 0 }
  }
  const watchCutoff = Date.now() - STILL_WATCHING_DAYS * 86_400_000
  let executed = 0
  let watching = 0
  let skipped = 0
  for (const e of ideas) {
    if (e.trade_id) {
      executed++
    } else if (new Date(e.created_at).getTime() >= watchCutoff) {
      watching++
    } else {
      skipped++
    }
  }
  // Execution rate is a fraction of "ideas with a verdict" (executed +
  // skipped) — still-watching ideas haven't been judged yet, so they
  // shouldn't drag the rate down.
  const decided = executed + skipped
  const executionRate = decided > 0 ? executed / decided : 0
  return { total: ideas.length, executed, watching, skipped, executionRate }
}

export function IdeasComparisonCard({ entries }: { entries: JournalEntry[] }) {
  const stats30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 86_400_000
    return ideaStats(entries.filter((e) => new Date(e.created_at).getTime() >= cutoff))
  }, [entries])
  const statsAllTime = useMemo(() => ideaStats(entries), [entries])

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
