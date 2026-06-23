"use client"

import { useMemo, useState } from "react"
import { NarrativeBanner } from "./narrative-banner"
import { formatUSD } from "@/lib/finance"
import type { Trade } from "@/lib/queries/trades"
import { isWin, isLoss } from "@/lib/outcome"

/**
 * Revenge-trade detector. Trades opened within N minutes of a previous loss
 * (same account) get bucketed and compared against the baseline. The classic
 * tilt signal — and the most fixable one once you see the gap.
 *
 * Cooldown setting deferred (separate user_settings column needed); v1 just
 * surfaces the pattern. The ↑ implementation note added on item #50 in the
 * punchlist tracks the Settings-level cooldown that pairs with this card.
 */

const WINDOWS = [10, 15, 30, 60] as const
type Window = typeof WINDOWS[number]

export function RevengeDetector({ trades }: { trades: Trade[] }) {
  const [windowMin, setWindow] = useState<Window>(15)
  const stats = useMemo(() => compute(trades, windowMin), [trades, windowMin])

  if (stats.baseline.n < 30 || stats.revenge.n < 3) return null

  const wrDelta = stats.revenge.winRate - stats.baseline.winRate
  const expDelta = stats.revenge.avgPnL - stats.baseline.avgPnL

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h3 className="card-title">Revenge-Trade Detector</h3>
          <p className="card-subtitle">
            Trades opened within {windowMin} min of a loss · {stats.revenge.n} of {stats.baseline.n} ({Math.round((stats.revenge.n / stats.baseline.n) * 100)}%)
          </p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              className="btn btn-sm"
              onClick={() => setWindow(w)}
              style={{
                fontSize: 10.5, padding: "3px 9px",
                background: w === windowMin ? "var(--c-purple-bright)" : "var(--c-bg-elev-2)",
                color: w === windowMin ? "white" : "var(--c-fg-muted)",
                border: "1px solid var(--c-border)",
              }}
            >
              {w}m
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
        <BucketCard
          title="Baseline"
          subtitle="All trades in this range"
          n={stats.baseline.n}
          winRate={stats.baseline.winRate}
          avgPnL={stats.baseline.avgPnL}
        />
        <BucketCard
          title={`Revenge (≤${windowMin}m after loss)`}
          subtitle="Quick re-entries after a stop-out"
          n={stats.revenge.n}
          winRate={stats.revenge.winRate}
          avgPnL={stats.revenge.avgPnL}
          wrDelta={wrDelta}
        />
      </div>

      {(wrDelta < -8 || expDelta < -10) && stats.revenge.n >= 5 && (
        <NarrativeBanner tone="bad">
          Your revenge trades win{" "}
          <strong style={{ color: "var(--c-red-bright)" }}>
            {Math.abs(Math.round(wrDelta))}pp less often
          </strong>{" "}
          than baseline (avg P&amp;L {formatUSD(stats.revenge.avgPnL, { signed: true })} vs.{" "}
          {formatUSD(stats.baseline.avgPnL, { signed: true })}). The math says wait —
          consider a hard rule: no new entry for {windowMin}m after a stop-out.
        </NarrativeBanner>
      )}
    </div>
  )
}

function BucketCard({
  title, subtitle, n, winRate, avgPnL, wrDelta,
}: {
  title: string
  subtitle: string
  n: number
  winRate: number
  avgPnL: number
  wrDelta?: number
}) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)", borderRadius: 10, padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{subtitle}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <Sub label="N" value={`${n}`} />
        <Sub label="WR" value={`${Math.round(winRate)}%`} color={winRate >= 50 ? "var(--c-green-bright)" : "var(--c-red-bright)"} />
        <Sub label="Avg P&L" value={formatUSD(avgPnL, { signed: true })} color={avgPnL > 0 ? "var(--c-green-bright)" : avgPnL < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)"} />
      </div>
      {wrDelta != null && (
        <div style={{
          marginTop: 8, fontSize: 11,
          color: wrDelta < -5 ? "var(--c-red-bright)" : wrDelta > 5 ? "var(--c-green-bright)" : "var(--c-fg-muted)",
        }}>
          {wrDelta > 0 ? "+" : ""}{Math.round(wrDelta)}pp vs. baseline WR
        </div>
      )}
    </div>
  )
}

function Sub({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: color ?? "var(--c-fg)" }}>{value}</div>
    </div>
  )
}

type Bucket = { n: number; winRate: number; avgPnL: number }

function compute(trades: Trade[], windowMin: number): { baseline: Bucket; revenge: Bucket } {
  // Sort by opened_at across all accounts. Account scoping is handled by the
  // page-level filter — a same-account constraint here would skip reasonable
  // multi-account-but-same-trader sequences.
  const sorted = trades
    .filter((t) => t.status === "closed" && t.closed_at != null && t.opened_at != null)
    .sort((a, b) => new Date(a.opened_at!).getTime() - new Date(b.opened_at!).getTime())

  const revenge: Trade[] = []
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]
    // Look backward for the most recent loss whose closed_at is within window
    // before this trade's opened_at. Same account only.
    for (let j = i - 1; j >= 0; j--) {
      const prev = sorted[j]
      if (prev.account_id !== t.account_id) continue
      const prevPnl = Number(prev.pnl) || 0
      if (!isLoss(prevPnl)) {
        // A win or breakeven (scratch) in the gap clears the "revenge" state —
        // only a decisive loss can trigger a revenge entry.
        break
      }
      const gapMin = (new Date(t.opened_at!).getTime() - new Date(prev.closed_at!).getTime()) / 60000
      if (gapMin <= windowMin) {
        revenge.push(t)
      }
      // Stop after first prior trade — only the immediately-preceding one matters.
      break
    }
  }

  return { baseline: bucketize(sorted), revenge: bucketize(revenge) }
}

function bucketize(ts: Trade[]): Bucket {
  if (ts.length === 0) return { n: 0, winRate: 0, avgPnL: 0 }
  const wins = ts.filter((t) => isWin(Number(t.pnl))).length
  const losses = ts.filter((t) => isLoss(Number(t.pnl))).length
  return {
    n: ts.length,
    winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
    avgPnL: ts.reduce((s, t) => s + (Number(t.pnl) || 0), 0) / ts.length,
  }
}
