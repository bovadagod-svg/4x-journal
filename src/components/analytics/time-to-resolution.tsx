"use client"

import { useMemo } from "react"
import { Icon } from "@/components/icons"
import type { Trade } from "@/lib/queries/trades"

/**
 * Time-to-resolution distribution. Histogram of how long winners hold vs.
 * losers. The classic "I cut my winners short" pathology shows up here as
 * winners-distribution-shifted-left and losers-distribution-shifted-right.
 *
 * Buckets are log-friendly (5m, 30m, 2h, 8h, 1d, 4d, 7d+) since trade
 * durations span 4+ orders of magnitude in the wild.
 */
export function TimeToResolution({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => compute(trades), [trades])
  if (stats.winners.n < 10 || stats.losers.n < 10) return null

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Time to Resolution</h3>
        <p className="card-subtitle">
          How long winners run vs. losers — when reversed, you&apos;re cutting winners early
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 14 }}>
        <Stat label="Median winner" value={formatDuration(stats.winners.median)} sub={`${stats.winners.n} trades`} color="var(--c-green-bright)" />
        <Stat label="Median loser" value={formatDuration(stats.losers.median)} sub={`${stats.losers.n} trades`} color="var(--c-red-bright)" />
        <Stat
          label="Win/Loss ratio"
          value={stats.losers.median > 0 ? `${(stats.winners.median / stats.losers.median).toFixed(1)}×` : "—"}
          sub={stats.winners.median >= stats.losers.median ? "winners run longer ✓" : "winners cut short ⚠"}
          color={stats.winners.median >= stats.losers.median ? "var(--c-green-bright)" : "var(--c-red-bright)"}
        />
      </div>

      {/* Overlaid histogram */}
      <Histogram winners={stats.winners.bucketCounts} losers={stats.losers.bucketCounts} bucketLabels={BUCKET_LABELS} />

      {stats.narrative && (
        <div style={{
          marginTop: 12, padding: 10,
          background: stats.narrative.tone === "bad" ? "rgba(190, 51, 61, 0.06)" : "rgba(17, 196, 88, 0.06)",
          border: `1px solid ${stats.narrative.tone === "bad" ? "rgba(190, 51, 61, 0.25)" : "rgba(17, 196, 88, 0.25)"}`,
          borderRadius: 8, fontSize: 12, color: "var(--c-fg-muted)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Icon name={stats.narrative.tone === "bad" ? "flame" : "sparkle"} size={13} color={stats.narrative.tone === "bad" ? "var(--c-red-bright)" : "var(--c-green-bright)"} />
          <span>{stats.narrative.text}</span>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{sub}</div>
    </div>
  )
}

function Histogram({ winners, losers, bucketLabels }: { winners: number[]; losers: number[]; bucketLabels: string[] }) {
  const max = Math.max(...winners, ...losers, 1)
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${bucketLabels.length}, 1fr)`, gap: 4 }}>
      {bucketLabels.map((lbl, i) => {
        const w = winners[i] ?? 0
        const l = losers[i] ?? 0
        return (
          <div key={lbl} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ height: 90, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2 }}>
              <div
                title={`${w} winner${w === 1 ? "" : "s"} resolved in ${lbl}`}
                style={{
                  width: "45%",
                  height: `${(w / max) * 100}%`,
                  background: "var(--c-green-bright)",
                  opacity: 0.85,
                  borderRadius: "2px 2px 0 0",
                  minHeight: w > 0 ? 2 : 0,
                }}
              />
              <div
                title={`${l} loser${l === 1 ? "" : "s"} resolved in ${lbl}`}
                style={{
                  width: "45%",
                  height: `${(l / max) * 100}%`,
                  background: "var(--c-red-bright)",
                  opacity: 0.85,
                  borderRadius: "2px 2px 0 0",
                  minHeight: l > 0 ? 2 : 0,
                }}
              />
            </div>
            <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textAlign: "center" }}>{lbl}</div>
          </div>
        )
      })}
    </div>
  )
}

// Approximate, log-spaced upper bounds in minutes. The label is the bucket name.
const BUCKETS_MIN = [5, 30, 120, 480, 1440, 5760, Infinity]
const BUCKET_LABELS = ["≤5m", "≤30m", "≤2h", "≤8h", "≤1d", "≤4d", "7d+"]

type SideStats = { n: number; median: number; bucketCounts: number[] }

function compute(trades: Trade[]): { winners: SideStats; losers: SideStats; narrative: { text: string; tone: "good" | "bad" } | null } {
  const winnerDurs: number[] = []
  const loserDurs: number[] = []
  for (const t of trades) {
    if (t.status !== "closed" || !t.opened_at || !t.closed_at) continue
    const ms = new Date(t.closed_at).getTime() - new Date(t.opened_at).getTime()
    if (!Number.isFinite(ms) || ms < 0) continue
    const minutes = ms / 60000
    const pnl = Number(t.pnl) || 0
    if (pnl > 0) winnerDurs.push(minutes)
    else if (pnl < 0) loserDurs.push(minutes)
  }

  const winners = aggregateSide(winnerDurs)
  const losers = aggregateSide(loserDurs)

  let narrative: { text: string; tone: "good" | "bad" } | null = null
  if (winners.n >= 10 && losers.n >= 10) {
    if (losers.median > winners.median * 1.5) {
      narrative = {
        tone: "bad",
        text: `Your losers run ${(losers.median / winners.median).toFixed(1)}× longer than your winners (${formatDuration(losers.median)} vs ${formatDuration(winners.median)}). Classic "cut winners early, let losers ride" pattern — fix this and your edge compounds.`,
      }
    } else if (winners.median > losers.median * 2) {
      narrative = {
        tone: "good",
        text: `Winners run ${(winners.median / losers.median).toFixed(1)}× longer than losers — you're letting trades work and cutting bad ones quickly. Healthy pattern.`,
      }
    }
  }

  return { winners, losers, narrative }
}

function aggregateSide(durs: number[]): SideStats {
  if (durs.length === 0) return { n: 0, median: 0, bucketCounts: BUCKETS_MIN.map(() => 0) }
  const sorted = [...durs].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const bucketCounts = BUCKETS_MIN.map(() => 0)
  for (const d of durs) {
    for (let i = 0; i < BUCKETS_MIN.length; i++) {
      if (d <= BUCKETS_MIN[i]) { bucketCounts[i] += 1; break }
    }
  }
  return { n: durs.length, median, bucketCounts }
}

function formatDuration(min: number): string {
  if (min < 60) return `${Math.round(min)}m`
  if (min < 1440) return `${(min / 60).toFixed(1)}h`
  return `${(min / 1440).toFixed(1)}d`
}
