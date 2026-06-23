"use client"

import { useMemo } from "react"
import { NarrativeBanner } from "./narrative-banner"
import type { Trade } from "@/lib/queries/trades"
import { classifyStopTargetMoves, type StopTargetEvent } from "@/lib/stop-modify"

/**
 * Stop / take-profit modification behavior — looks across closed trades and
 * asks "how do you behave on losers vs. on winners?"
 *
 * Each SL move is classified BE / Trail / Loose and each TP move Wider /
 * Tighter, aggregated per outcome bucket: a 2× gap on "Loose stops" between
 * losers and winners is the canonical hope-trading signature.
 *
 * The actual SL/TP-modification recovery lives in `@/lib/stop-modify`
 * (classifyStopTargetMoves) — TradeLocker encodes adjustments as protective
 * Stop/Limit exit-order prices, not "Replaced" events; see that file for why.
 * This card just buckets the resulting counts by winner/loser outcome.
 *
 * Data source: trades.lifecycle_events JSONB, populated by the TradeLocker
 * importer. Manual / CSV trades have no lifecycle and are skipped.
 */

type Counts = {
  n: number
  slMoves: number
  slBe: number
  slTrail: number
  slLoose: number
  tpMoves: number
  tpWider: number
  tpTighter: number
}

const emptyCounts = (): Counts => ({
  n: 0, slMoves: 0, slBe: 0, slTrail: 0, slLoose: 0, tpMoves: 0, tpWider: 0, tpTighter: 0,
})

export function StopModifyBehavior({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => compute(trades), [trades])

  if (stats.tradesWithLifecycle === 0) return null

  if (stats.totalModifies === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Stop &amp; Target Behavior</h3>
        <p className="card-subtitle">How you adjust SL / TP on winners vs. losers</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>
          Of {stats.tradesWithLifecycle} closed trades with broker order history,
          none had an SL or TP modification. Once you start adjusting stops mid-trade
          (move to break-even, trail, widen targets), this card surfaces the patterns.
        </p>
      </div>
    )
  }

  const winnerLooseRate = ratePerTrade(stats.winners.slLoose, stats.winners.n)
  const loserLooseRate = ratePerTrade(stats.losers.slLoose, stats.losers.n)
  const winnerBeRate = ratePerTrade(stats.winners.slBe, stats.winners.n)
  const loserBeRate = ratePerTrade(stats.losers.slBe, stats.losers.n)
  const winnerTrailRate = ratePerTrade(stats.winners.slTrail, stats.winners.n)
  const loserTrailRate = ratePerTrade(stats.losers.slTrail, stats.losers.n)

  const narrative = chooseNarrative({
    winners: stats.winners,
    losers: stats.losers,
    winnerLooseRate, loserLooseRate,
    winnerTrailRate, loserTrailRate,
  })

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Stop &amp; Target Behavior</h3>
        <p className="card-subtitle">
          {stats.tradesWithLifecycle} broker-synced trades · {stats.totalModifies} SL/TP
          adjustments tracked
        </p>
      </div>

      {/* Side-by-side bucket comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10, marginBottom: 12 }}>
        <BucketCard
          title="On winners"
          color="var(--c-green-bright)"
          n={stats.winners.n}
          rows={[
            { label: "Move SL to BE", count: stats.winners.slBe, rate: winnerBeRate },
            { label: "Trail SL toward profit", count: stats.winners.slTrail, rate: winnerTrailRate },
            { label: "Loosen SL away from price", count: stats.winners.slLoose, rate: winnerLooseRate, bad: true },
            { label: "Widen TP", count: stats.winners.tpWider, rate: ratePerTrade(stats.winners.tpWider, stats.winners.n) },
            { label: "Tighten TP", count: stats.winners.tpTighter, rate: ratePerTrade(stats.winners.tpTighter, stats.winners.n) },
          ]}
        />
        <BucketCard
          title="On losers"
          color="var(--c-red-bright)"
          n={stats.losers.n}
          rows={[
            { label: "Move SL to BE", count: stats.losers.slBe, rate: loserBeRate },
            { label: "Trail SL toward profit", count: stats.losers.slTrail, rate: loserTrailRate },
            { label: "Loosen SL away from price", count: stats.losers.slLoose, rate: loserLooseRate, bad: true },
            { label: "Widen TP", count: stats.losers.tpWider, rate: ratePerTrade(stats.losers.tpWider, stats.losers.n) },
            { label: "Tighten TP", count: stats.losers.tpTighter, rate: ratePerTrade(stats.losers.tpTighter, stats.losers.n) },
          ]}
        />
      </div>

      {narrative && (
        <NarrativeBanner tone={narrative.tone}>{narrative.text}</NarrativeBanner>
      )}
    </div>
  )
}

function BucketCard({
  title, color, n, rows,
}: {
  title: string
  color: string
  n: number
  rows: Array<{ label: string; count: number; rate: number; bad?: boolean }>
}) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color }}>{title}</span>
        <span style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>{n} trade{n === 1 ? "" : "s"}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8,
              alignItems: "baseline", padding: "4px 0",
              fontSize: 11.5,
            }}
          >
            <span style={{ color: "var(--c-fg-muted)" }}>{r.label}</span>
            <span className="tnum" style={{ color: r.bad && r.count > 0 ? "var(--c-red-bright)" : "var(--c-fg)" }}>×{r.count}</span>
            <span className="tnum" style={{ color: "var(--c-fg-dim)", fontSize: 10.5, minWidth: 40, textAlign: "right" }}>
              {n > 0 ? `${r.rate.toFixed(2)}/t` : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ratePerTrade(count: number, n: number): number {
  return n > 0 ? count / n : 0
}

type NarrativeChoice = { text: string; tone: "good" | "bad" } | null

function chooseNarrative(args: {
  winners: Counts
  losers: Counts
  winnerLooseRate: number
  loserLooseRate: number
  winnerTrailRate: number
  loserTrailRate: number
}): NarrativeChoice {
  const minSample = 3
  if (args.winners.n < minSample || args.losers.n < minSample) return null

  // Loose-stop ratio on losers vs. winners is the canonical hope-trading signature.
  if (args.loserLooseRate > 0 && args.winnerLooseRate > 0) {
    const ratio = args.loserLooseRate / args.winnerLooseRate
    if (ratio >= 2) {
      return {
        tone: "bad",
        text: `You loosen stops on losers ${ratio.toFixed(1)}× more often than on winners — classic hope-trading. Each loosened stop turns a planned loss into a bigger one.`,
      }
    }
  } else if (args.losers.slLoose > 0 && args.winners.slLoose === 0 && args.losers.slLoose >= 3) {
    return {
      tone: "bad",
      text: `${args.losers.slLoose} loosened stops on losers, zero on winners. You only widen the leash when price moves against you — exactly when discipline matters most.`,
    }
  }

  // Trailing more on winners than losers is the healthy mirror image — celebrate it.
  if (args.winnerTrailRate > 0 && args.loserTrailRate >= 0) {
    const ratio = args.loserTrailRate > 0 ? args.winnerTrailRate / args.loserTrailRate : Infinity
    if (ratio >= 2 && args.winners.slTrail >= 3) {
      return {
        tone: "good",
        text: `You trail stops on winners ${isFinite(ratio) ? ratio.toFixed(1) + "×" : "much"} more often than on losers — letting the trade make its case before tightening. Healthy pattern.`,
      }
    }
  }

  return null
}

function compute(trades: Trade[]): {
  tradesWithLifecycle: number
  totalModifies: number
  winners: Counts
  losers: Counts
} {
  const winners = emptyCounts()
  const losers = emptyCounts()
  let tradesWithLifecycle = 0
  let totalModifies = 0

  for (const t of trades) {
    if (t.status !== "closed") continue
    const events = t.lifecycle_events
    if (!Array.isArray(events) || events.length === 0) continue
    tradesWithLifecycle++

    const pnl = Number(t.pnl) || 0
    const bucket: Counts = pnl >= 0 ? winners : losers
    bucket.n++

    const { counts } = classifyStopTargetMoves(events as StopTargetEvent[], {
      side: t.side === "long" ? "long" : "short",
      entryPrice: Number(t.entry_price),
    })
    bucket.slMoves += counts.slMoves
    bucket.slBe += counts.slBe
    bucket.slTrail += counts.slTrail
    bucket.slLoose += counts.slLoose
    bucket.tpMoves += counts.tpMoves
    bucket.tpWider += counts.tpWider
    bucket.tpTighter += counts.tpTighter
    totalModifies += counts.slMoves + counts.tpMoves
  }

  return { tradesWithLifecycle, totalModifies, winners, losers }
}
