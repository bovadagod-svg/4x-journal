"use client"

import { useMemo } from "react"
import { NarrativeBanner } from "./narrative-banner"
import { pipsBetween } from "@/lib/pip"
import type { Trade } from "@/lib/queries/trades"
import type { TradeFill } from "@/lib/queries/trade-fills"

/**
 * Slippage aggregate. The Trade Detail Drawer surfaces per-fill slippage as a
 * badge (entry-fill request_price vs. actual price). This card aggregates it
 * across the analytics window — broken out by order_type so the user can see
 * "market fills slip 1.4 pips on average; my limit fills slip 0.0."
 *
 * Only fills with a non-null `request_price` count (broker carried an intended
 * price for the order). Dollar estimation deferred to #60 (pip_value at trade
 * time) — pip-only for v1.
 */
export function SlippageAnalysis({
  trades,
  fillsByTrade,
}: {
  trades: Trade[]
  fillsByTrade: Map<string, TradeFill[]>
}) {
  const stats = useMemo(() => compute(trades, fillsByTrade), [trades, fillsByTrade])

  if (stats.totalFills < 5) return null

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Slippage Analysis</h3>
        <p className="card-subtitle">
          {stats.totalFills} broker-synced fills with intended price · pip cost between
          requested and actual fill
        </p>
      </div>

      {/* Bucket strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 8,
        marginBottom: 12,
      }}>
        {stats.buckets.map((b) => (
          <Bucket key={b.label} label={b.label} count={b.count} median={b.median} mean={b.mean} />
        ))}
      </div>

      {stats.narrative && (
        <NarrativeBanner tone={stats.narrative.tone === "bad" ? "warn" : "good"}>
          {stats.narrative.text}
        </NarrativeBanner>
      )}
    </div>
  )
}

function Bucket({ label, count, median, mean }: { label: string; count: number; median: number; mean: number }) {
  const color = mean > 0.5 ? "var(--c-amber)" : mean > 1.5 ? "var(--c-red-bright)" : "var(--c-fg)"
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div className="tnum" style={{ fontSize: 18, fontWeight: 600, color, marginTop: 4 }}>
        {median >= 0 ? "+" : ""}{median.toFixed(2)}p
      </div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 2 }}>
        median · mean {mean >= 0 ? "+" : ""}{mean.toFixed(2)}p · {count} fill{count === 1 ? "" : "s"}
      </div>
    </div>
  )
}

type Bucket = { label: string; count: number; median: number; mean: number; samples: number[] }

function compute(trades: Trade[], fillsByTrade: Map<string, TradeFill[]>): {
  totalFills: number
  buckets: Array<{ label: string; count: number; median: number; mean: number }>
  narrative: { text: string; tone: "good" | "bad" } | null
} {
  // Build a quick side+pair lookup by trade id.
  const byId = new Map<string, Trade>()
  for (const t of trades) byId.set(t.id, t)

  const buckets: Record<string, Bucket> = {
    Market: { label: "Market", count: 0, median: 0, mean: 0, samples: [] },
    Limit: { label: "Limit", count: 0, median: 0, mean: 0, samples: [] },
    Stop: { label: "Stop", count: 0, median: 0, mean: 0, samples: [] },
    Other: { label: "Other", count: 0, median: 0, mean: 0, samples: [] },
  }

  let totalFills = 0
  for (const [tradeId, fills] of fillsByTrade.entries()) {
    const trade = byId.get(tradeId)
    if (!trade) continue
    for (const f of fills) {
      if (f.request_price == null) continue
      // Sign convention: positive = trader paid worse than requested.
      // Long entry filled above request → bad. Short entry filled below → bad.
      // Long exit filled below request → bad. Short exit filled above → bad.
      const isEntry = f.kind === "entry"
      const sideMul = trade.side === "long" ? (isEntry ? 1 : -1) : (isEntry ? -1 : 1)
      const rawPips = pipsBetween(Number(f.request_price), Number(f.price), trade.pair)
      // pipsBetween returns absolute pips — recover sign by direction of move.
      const moved = Number(f.price) - Number(f.request_price)
      const signedPips = (moved >= 0 ? 1 : -1) * Math.abs(rawPips) * sideMul

      const bucket = pickBucket(f.order_type)
      buckets[bucket].samples.push(signedPips)
      totalFills++
    }
  }

  const summarized = Object.values(buckets)
    .filter((b) => b.samples.length > 0)
    .map((b) => {
      const sorted = [...b.samples].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      const mean = sorted.reduce((s, x) => s + x, 0) / sorted.length
      return {
        label: b.label,
        count: sorted.length,
        median: round2(median),
        mean: round2(mean),
      }
    })

  // Narrative: if Market is materially worse than Limit, call it out.
  const market = summarized.find((b) => b.label === "Market")
  const limit = summarized.find((b) => b.label === "Limit")
  let narrative: { text: string; tone: "good" | "bad" } | null = null
  if (market && limit && market.count >= 5 && limit.count >= 5) {
    const gap = market.mean - limit.mean
    if (gap >= 0.5) {
      narrative = {
        tone: "bad",
        text: `Market orders cost ${gap.toFixed(2)}p more on average than your limit fills (${market.mean.toFixed(2)}p vs. ${limit.mean.toFixed(2)}p). Patience pays — when you can wait for a limit, do.`,
      }
    } else if (gap <= -0.3) {
      narrative = {
        tone: "good",
        text: `Your market fills land cleanly — only ${market.mean.toFixed(2)}p slippage vs. ${limit.mean.toFixed(2)}p on limits. Liquidity at your size and times is solid.`,
      }
    }
  }
  if (!narrative && market && market.count >= 10 && market.mean >= 1.5) {
    narrative = {
      tone: "bad",
      text: `Average market-order slippage of ${market.mean.toFixed(2)}p is high. Worth checking whether you're trading during thin liquidity (Asia roll, news windows).`,
    }
  }

  return { totalFills, buckets: summarized, narrative }
}

function pickBucket(orderType: string | null): "Market" | "Limit" | "Stop" | "Other" {
  if (!orderType) return "Other"
  const t = orderType.toLowerCase()
  if (t.includes("market")) return "Market"
  if (t.includes("limit")) return "Limit"
  if (t.includes("stop")) return "Stop"
  return "Other"
}

function round2(n: number): number {
  return Number(n.toFixed(2))
}
