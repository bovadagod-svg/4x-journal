"use client"

import { useMemo } from "react"
import { formatUSD } from "@/lib/finance"
import { isWin, isLoss } from "@/lib/outcome"
import type { Trade } from "@/lib/queries/trades"

const MOOD_COLORS: Record<string, string> = {
  focused:   "rgba(17, 196, 88, 0.7)",
  calm:      "rgba(105, 50, 212, 0.7)",
  confident: "rgba(229, 162, 59, 0.7)",
  rushed:    "rgba(190, 51, 61, 0.6)",
  anxious:   "rgba(190, 51, 61, 0.7)",
  neutral:   "rgba(154, 151, 161, 0.5)",
}
const MOOD_ORDER = ["focused", "calm", "confident", "neutral", "rushed", "anxious"]

/**
 * Mood × performance: which emotional states do you trade well in,
 * and which ones bleed money? Read off `trade.mood` + journal mood as
 * a tiebreaker.
 */
export function MoodAnalysis({ trades }: { trades: Trade[] }) {
  const stats = useMemo(() => compute(trades), [trades])
  if (stats.tagged === 0) {
    return (
      <div className="card">
        <h3 className="card-title">Mood × Performance</h3>
        <p className="card-subtitle">Tag your trades with a mood to see which emotional state pays.</p>
        <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--c-fg-muted)" }}>No moods logged yet — toggle the requirement in Settings → Journal defaults.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ marginBottom: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 className="card-title">Mood × Performance</h3>
          <p className="card-subtitle">{stats.tagged} of {trades.length} trades have a mood logged</p>
        </div>
        {stats.bestMood && stats.worstMood && stats.bestMood !== stats.worstMood && (
          <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", textAlign: "right" }}>
            Best: <strong style={{ color: "var(--c-green-bright)" }}>{stats.bestMood}</strong> ·{" "}
            Worst: <strong style={{ color: "var(--c-red-bright)" }}>{stats.worstMood}</strong>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "100px 50px 1fr 70px 80px",
          gap: 8, padding: "6px 0",
          fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em",
          borderBottom: "1px solid var(--c-border)",
        }}>
          <span>Mood</span>
          <span style={{ textAlign: "right" }}>n</span>
          <span>Win rate</span>
          <span style={{ textAlign: "right" }}>Avg R</span>
          <span style={{ textAlign: "right" }}>Avg P&L</span>
        </div>
        {stats.rows.map((r) => (
          <div
            key={r.mood}
            style={{
              display: "grid", gridTemplateColumns: "100px 50px 1fr 70px 80px",
              gap: 8, padding: "8px 0",
              borderBottom: "1px solid var(--c-border)",
              alignItems: "center", fontSize: 12.5,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: MOOD_COLORS[r.mood] ?? "var(--c-fg-muted)" }} />
              <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{r.mood}</span>
            </span>
            <span className="tnum" style={{ textAlign: "right", color: "var(--c-fg-muted)" }}>{r.count}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative", flex: 1, height: 8, background: "var(--c-bg-elev-3)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  position: "absolute", inset: 0, width: `${r.winRate}%`,
                  background: r.winRate >= 50 ? "rgba(17, 196, 88, 0.6)" : "rgba(190, 51, 61, 0.6)",
                }} />
              </div>
              <span className="tnum" style={{ fontSize: 11.5, fontWeight: 600, minWidth: 36, textAlign: "right" }}>{Math.round(r.winRate)}%</span>
            </div>
            <span className="tnum" style={{
              textAlign: "right",
              color: r.avgR > 0 ? "var(--c-green-bright)" : r.avgR < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
            }}>
              {r.avgR > 0 ? "+" : ""}{r.avgR.toFixed(2)}R
            </span>
            <span className="tnum" style={{
              textAlign: "right", fontWeight: 600,
              color: r.avgPnL > 0 ? "var(--c-green-bright)" : r.avgPnL < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
            }}>
              {formatUSD(r.avgPnL, { signed: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function compute(trades: Trade[]) {
  const tagged = trades.filter((t) => t.mood)
  const byMood = new Map<string, Trade[]>()
  for (const t of tagged) {
    const key = (t.mood ?? "neutral").toLowerCase()
    const arr = byMood.get(key) ?? []
    arr.push(t)
    byMood.set(key, arr)
  }
  const rows = Array.from(byMood.entries()).map(([mood, ts]) => {
    const wins = ts.filter((t) => isWin(Number(t.pnl))).length
    const losses = ts.filter((t) => isLoss(Number(t.pnl))).length
    const totalPnl = ts.reduce((s, t) => s + (Number(t.pnl) || 0), 0)
    const totalR = ts.reduce((s, t) => s + (Number(t.r) || 0), 0)
    return {
      mood,
      count: ts.length,
      winRate: (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0,
      avgR: ts.length > 0 ? totalR / ts.length : 0,
      avgPnL: ts.length > 0 ? totalPnl / ts.length : 0,
    }
  }).sort((a, b) => MOOD_ORDER.indexOf(a.mood) - MOOD_ORDER.indexOf(b.mood))

  const eligible = rows.filter((r) => r.count >= 3)
  const bestMood = eligible.length > 0 ? [...eligible].sort((a, b) => b.avgR - a.avgR)[0]?.mood : null
  const worstMood = eligible.length > 0 ? [...eligible].sort((a, b) => a.avgR - b.avgR)[0]?.mood : null

  return { tagged: tagged.length, rows, bestMood, worstMood }
}
