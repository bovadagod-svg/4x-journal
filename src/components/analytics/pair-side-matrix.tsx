"use client"

import { useMemo } from "react"
import { PairFlag } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import type { Trade } from "@/lib/queries/trades"

/**
 * Pair × Side matrix. For each pair, show long stats vs short stats side-by-side
 * so asymmetric edges jump out: e.g. "EUR/USD long 65% WR, short 38% WR" → tells
 * the user to consider stopping shorts on EUR/USD or studying why longs work.
 *
 * Columns per row: pair · long count/WR/R/P&L · short count/WR/R/P&L · skew chip
 * The skew chip flags pairs where one side meaningfully outperforms the other
 * (≥10pp WR gap with ≥3 trades on each side).
 */
export function PairSideMatrix({ trades }: { trades: Trade[] }) {
  const rows = useMemo(() => compute(trades), [trades])
  if (rows.length === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Pair × Side Matrix</h3>
        <p className="card-subtitle">Long vs short edge by instrument</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>No closed trades in range.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Pair × Side Matrix</h3>
        <p className="card-subtitle">Long vs short edge by instrument · skew flags asymmetric edges</p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 640 }}>
          <div style={{
            display: "grid", gridTemplateColumns: "120px 56px 64px 60px 70px 56px 64px 60px 70px 70px",
            gap: 6, padding: "6px 0",
            fontSize: 10, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.04em",
            borderBottom: "1px solid var(--c-border)",
          }}>
            <span>Pair</span>
            <span style={{ textAlign: "right", color: "var(--c-green-bright)" }}>Long n</span>
            <span style={{ textAlign: "right", color: "var(--c-green-bright)" }}>WR</span>
            <span style={{ textAlign: "right", color: "var(--c-green-bright)" }}>Avg R</span>
            <span style={{ textAlign: "right", color: "var(--c-green-bright)" }}>P&L</span>
            <span style={{ textAlign: "right", color: "var(--c-red-bright)" }}>Short n</span>
            <span style={{ textAlign: "right", color: "var(--c-red-bright)" }}>WR</span>
            <span style={{ textAlign: "right", color: "var(--c-red-bright)" }}>Avg R</span>
            <span style={{ textAlign: "right", color: "var(--c-red-bright)" }}>P&L</span>
            <span style={{ textAlign: "right" }}>Skew</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.pair}
              style={{
                display: "grid", gridTemplateColumns: "120px 56px 64px 60px 70px 56px 64px 60px 70px 70px",
                gap: 6, padding: "10px 0",
                borderBottom: "1px solid var(--c-border)",
                alignItems: "center", fontSize: 12,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <PairFlag pair={r.pair} size={14} />
                <span style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.pair}</span>
              </span>

              {/* Long side */}
              <span className="tnum" style={{ textAlign: "right", color: r.long.count === 0 ? "var(--c-fg-dim)" : "var(--c-fg-muted)" }}>{r.long.count || "—"}</span>
              <span className="tnum" style={{ textAlign: "right", fontWeight: 600, color: r.long.count === 0 ? "var(--c-fg-dim)" : r.long.winRate >= 50 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                {r.long.count === 0 ? "—" : `${Math.round(r.long.winRate)}%`}
              </span>
              <span className="tnum" style={{ textAlign: "right", color: r.long.count === 0 ? "var(--c-fg-dim)" : r.long.avgR >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                {r.long.count === 0 ? "—" : `${r.long.avgR > 0 ? "+" : ""}${r.long.avgR.toFixed(2)}R`}
              </span>
              <span className="tnum" style={{ textAlign: "right", fontWeight: 600, color: r.long.count === 0 ? "var(--c-fg-dim)" : r.long.pnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                {r.long.count === 0 ? "—" : formatUSD(r.long.pnl, { signed: true })}
              </span>

              {/* Short side */}
              <span className="tnum" style={{ textAlign: "right", color: r.short.count === 0 ? "var(--c-fg-dim)" : "var(--c-fg-muted)" }}>{r.short.count || "—"}</span>
              <span className="tnum" style={{ textAlign: "right", fontWeight: 600, color: r.short.count === 0 ? "var(--c-fg-dim)" : r.short.winRate >= 50 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                {r.short.count === 0 ? "—" : `${Math.round(r.short.winRate)}%`}
              </span>
              <span className="tnum" style={{ textAlign: "right", color: r.short.count === 0 ? "var(--c-fg-dim)" : r.short.avgR >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                {r.short.count === 0 ? "—" : `${r.short.avgR > 0 ? "+" : ""}${r.short.avgR.toFixed(2)}R`}
              </span>
              <span className="tnum" style={{ textAlign: "right", fontWeight: 600, color: r.short.count === 0 ? "var(--c-fg-dim)" : r.short.pnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)" }}>
                {r.short.count === 0 ? "—" : formatUSD(r.short.pnl, { signed: true })}
              </span>

              {/* Skew chip */}
              <span style={{ textAlign: "right" }}>{r.skewChip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function compute(trades: Trade[]) {
  const closed = trades.filter((t) => t.status === "closed")
  const byPair = new Map<string, { long: Trade[]; short: Trade[] }>()
  for (const t of closed) {
    const slot = byPair.get(t.pair) ?? { long: [], short: [] }
    if (t.side === "long") slot.long.push(t)
    else if (t.side === "short") slot.short.push(t)
    byPair.set(t.pair, slot)
  }

  const rows = Array.from(byPair.entries()).map(([pair, sides]) => {
    const long = aggSide(sides.long)
    const short = aggSide(sides.short)
    const skewChip = buildSkewChip(long, short)
    return { pair, long, short, skewChip, total: long.pnl + short.pnl }
  })
  return rows.sort((a, b) => b.total - a.total)
}

function aggSide(ts: Trade[]) {
  const wins = ts.filter((t) => Number(t.pnl) > 0).length
  const pnl = ts.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
  const totalR = ts.reduce((s, t) => s + (Number(t.r) || 0), 0)
  return {
    count: ts.length,
    winRate: ts.length > 0 ? (wins / ts.length) * 100 : 0,
    avgR: ts.length > 0 ? totalR / ts.length : 0,
    pnl,
  }
}

type Side = ReturnType<typeof aggSide>

function buildSkewChip(long: Side, short: Side) {
  if (long.count < 3 || short.count < 3) {
    return <span style={{ fontSize: 10, color: "var(--c-fg-dim)" }}>—</span>
  }
  const gap = long.winRate - short.winRate
  if (Math.abs(gap) < 10) {
    return <span style={{ fontSize: 10, color: "var(--c-fg-dim)" }}>balanced</span>
  }
  const dominantSide = gap > 0 ? "long" : "short"
  const color = gap > 0 ? "var(--c-green-bright)" : "var(--c-red-bright)"
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 4,
      fontSize: 10, fontWeight: 600, color,
      background: gap > 0 ? "rgba(17, 196, 88, 0.1)" : "rgba(190, 51, 61, 0.1)",
      border: `1px solid ${color}33`,
    }}>
      {dominantSide} +{Math.abs(Math.round(gap))}pp
    </span>
  )
}
