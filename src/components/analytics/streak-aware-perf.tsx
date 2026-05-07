"use client"

import { useMemo } from "react"
import { Icon } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import type { Trade } from "@/lib/queries/trades"

/**
 * Streak-aware performance. Walks closed trades chronologically; classifies the
 * current streak state (≥3 wins = "hot", ≥3 losses = "cold") and bucketizes
 * the *next* trade's outcome accordingly. Often reveals overconfidence (worse
 * after wins) or tilt (worse after losses) — pure aggregation off existing data.
 *
 * Baseline = all trades. After-win and after-loss buckets compared against it.
 */
export function StreakAwarePerf({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => compute(trades), [trades])

  if (stats.baseline.n < 30 || (stats.afterWins.n < 3 && stats.afterLosses.n < 3)) return null

  const afterWinDelta = stats.afterWins.n >= 3 ? stats.afterWins.winRate - stats.baseline.winRate : null
  const afterLossDelta = stats.afterLosses.n >= 3 ? stats.afterLosses.winRate - stats.baseline.winRate : null

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Streak-Aware Performance</h3>
        <p className="card-subtitle">
          How you trade after a hot or cold streak vs. your baseline ({stats.baseline.n} trades · {Math.round(stats.baseline.winRate)}% WR)
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <BucketCard
          title="After 3+ wins"
          subtitle="Overconfidence check"
          n={stats.afterWins.n}
          winRate={stats.afterWins.winRate}
          avgPnL={stats.afterWins.avgPnL}
          delta={afterWinDelta}
        />
        <BucketCard
          title="After 3+ losses"
          subtitle="Tilt check"
          n={stats.afterLosses.n}
          winRate={stats.afterLosses.winRate}
          avgPnL={stats.afterLosses.avgPnL}
          delta={afterLossDelta}
        />
      </div>

      {(stats.narrative) && (
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

function BucketCard({
  title, subtitle, n, winRate, avgPnL, delta,
}: {
  title: string
  subtitle: string
  n: number
  winRate: number
  avgPnL: number
  delta: number | null
}) {
  const insufficient = n < 3
  return (
    <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 10, padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{subtitle}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Sub label="WR" value={insufficient ? "—" : `${Math.round(winRate)}%`} sub={insufficient ? "" : `${n} trades`} />
        <Sub label="Avg P&L" value={insufficient ? "—" : formatUSD(avgPnL, { signed: true })} sub="per next trade" color={!insufficient && avgPnL > 0 ? "var(--c-green-bright)" : !insufficient && avgPnL < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)"} />
      </div>
      {delta != null && (
        <div style={{
          marginTop: 8, fontSize: 11,
          color: delta < -5 ? "var(--c-red-bright)" : delta > 5 ? "var(--c-green-bright)" : "var(--c-fg-muted)",
        }}>
          {delta > 0 ? "+" : ""}{Math.round(delta)}pp vs. baseline
        </div>
      )}
    </div>
  )
}

function Sub({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 14, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--c-fg-dim)" }}>{sub}</div>}
    </div>
  )
}

type Bucket = { n: number; winRate: number; avgPnL: number }

function compute(trades: Trade[]): { baseline: Bucket; afterWins: Bucket; afterLosses: Bucket; narrative: { text: string; tone: "good" | "bad" } | null } {
  const closed = trades
    .filter((t) => t.status === "closed" && t.closed_at != null)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime())

  const afterWinTrades: Trade[] = []
  const afterLossTrades: Trade[] = []
  let winStreak = 0
  let lossStreak = 0

  for (let i = 0; i < closed.length; i++) {
    if (i > 0) {
      const prev = closed[i - 1]
      const prevPnl = Number(prev.pnl) || 0
      if (prevPnl > 0) { winStreak += 1; lossStreak = 0 }
      else if (prevPnl < 0) { lossStreak += 1; winStreak = 0 }
      else { winStreak = 0; lossStreak = 0 }
    }
    if (winStreak >= 3) afterWinTrades.push(closed[i])
    if (lossStreak >= 3) afterLossTrades.push(closed[i])
  }

  const baseline = bucketize(closed)
  const afterWins = bucketize(afterWinTrades)
  const afterLosses = bucketize(afterLossTrades)

  let narrative: { text: string; tone: "good" | "bad" } | null = null
  const winDelta = afterWins.n >= 5 ? afterWins.winRate - baseline.winRate : null
  const lossDelta = afterLosses.n >= 5 ? afterLosses.winRate - baseline.winRate : null
  if (lossDelta != null && lossDelta < -10) {
    narrative = {
      tone: "bad",
      text: `After 3+ losses, your win rate drops ${Math.abs(Math.round(lossDelta))}pp below baseline (${Math.round(afterLosses.winRate)}% vs ${Math.round(baseline.winRate)}%). That's tilt — consider a hard cooldown after losing streaks.`,
    }
  } else if (winDelta != null && winDelta < -10) {
    narrative = {
      tone: "bad",
      text: `After 3+ wins, your win rate drops ${Math.abs(Math.round(winDelta))}pp below baseline. Classic overconfidence — sizing up after a streak gives back the gains.`,
    }
  } else if (winDelta != null && winDelta > 5) {
    narrative = {
      tone: "good",
      text: `You actually trade better after wins (+${Math.round(winDelta)}pp WR) — momentum-friendly temperament. Losses don't seem to push you off-balance either.`,
    }
  }

  return { baseline, afterWins, afterLosses, narrative }
}

function bucketize(ts: Trade[]): Bucket {
  if (ts.length === 0) return { n: 0, winRate: 0, avgPnL: 0 }
  const wins = ts.filter((t) => Number(t.pnl) > 0).length
  const totalPnL = ts.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  return {
    n: ts.length,
    winRate: (wins / ts.length) * 100,
    avgPnL: totalPnL / ts.length,
  }
}
