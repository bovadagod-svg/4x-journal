"use client"

import { useMemo, useState, useTransition } from "react"
import { Icon } from "@/components/icons"
import { NarrativeBanner } from "./narrative-banner"
import { backfillMaeMfe } from "@/lib/actions/mae-mfe-backfill"
import type { Trade } from "@/lib/queries/trades"

/**
 * #49 MAE / MFE analytics card. Surfaces the gap between what the trade
 * actually earned (realized R) vs. how far it could have gone (MFE) and how
 * deep underwater it went (MAE).
 *
 * The "you cut winners early" pathology shows up as a large positive gap
 * between MFE and realized R on winners. The "you held losers too long"
 * pathology shows up as MAE matching realized R closely on losers (i.e. the
 * trade went straight against you and you held to stop).
 */
export function MaeMfeCard({ trades }: { trades: Trade[] }) {
  const [resolving, startResolve] = useTransition()
  const [resolveMsg, setResolveMsg] = useState<string | null>(null)

  const { stats, missing } = useMemo(() => compute(trades), [trades])

  const onResolve = () => {
    setResolveMsg("Resolving…")
    startResolve(async () => {
      const r = await backfillMaeMfe()
      setResolveMsg(`Resolved ${r.resolved} · ${r.skipped} skipped · ${r.failed} failed`)
    })
  }

  if (stats.resolvedCount === 0 && missing === 0) return null

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 className="card-title">MAE &amp; MFE</h3>
          <p className="card-subtitle">
            How deep your trades went underwater (MAE) vs. how far they ran in your favor (MFE) ·{" "}
            {stats.resolvedCount} of {stats.resolvedCount + missing} trades resolved
          </p>
        </div>
        {missing > 0 && (
          <button
            type="button"
            className="btn"
            onClick={onResolve}
            disabled={resolving}
            style={{ fontSize: 11.5, padding: "5px 10px" }}
            title="Fetch Polygon hourly bars for unresolved trades"
          >
            <Icon name="refresh" size={11} /> {resolving ? "Resolving…" : `Backfill ${Math.min(missing, 50)}`}
          </button>
        )}
      </div>

      {resolveMsg && (
        <div style={{ marginBottom: 10, fontSize: 11.5, color: "var(--c-fg-muted)" }}>{resolveMsg}</div>
      )}

      {stats.resolvedCount === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--c-fg-muted)" }}>
          No trades have MAE/MFE resolved yet. Click &quot;Backfill&quot; — the action fetches Polygon
          hourly bars for each closed trade window and computes max excursion in both directions.
        </p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 12 }}>
            <Stat
              label="Avg MFE (winners)"
              value={stats.winners.avgMfe != null ? `+${stats.winners.avgMfe.toFixed(2)}R` : "—"}
              sub={`${stats.winners.count} winning trade${stats.winners.count === 1 ? "" : "s"}`}
              color="var(--c-green-bright)"
            />
            <Stat
              label="Avg realized (winners)"
              value={stats.winners.avgRealized != null ? `+${stats.winners.avgRealized.toFixed(2)}R` : "—"}
              sub="actually closed at"
              color="var(--c-fg)"
            />
            <Stat
              label="Avg MAE (losers)"
              value={stats.losers.avgMae != null ? `${stats.losers.avgMae.toFixed(2)}R` : "—"}
              sub={`${stats.losers.count} losing trade${stats.losers.count === 1 ? "" : "s"}`}
              color="var(--c-red-bright)"
            />
            <Stat
              label="Cut-short gap"
              value={stats.cutShortGap != null ? `${stats.cutShortGap > 0 ? "+" : ""}${stats.cutShortGap.toFixed(2)}R` : "—"}
              sub="MFE − realized on winners"
              color={stats.cutShortGap != null && stats.cutShortGap > 0.4 ? "var(--c-amber)" : "var(--c-fg)"}
            />
          </div>

          {stats.cutShortNarrative && (
            <NarrativeBanner tone={stats.cutShortNarrative.tone}>{stats.cutShortNarrative.text}</NarrativeBanner>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 18, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{sub}</div>
    </div>
  )
}

function compute(trades: Trade[]) {
  let resolvedCount = 0
  let missing = 0
  const winnersMfe: number[] = []
  const winnersRealized: number[] = []
  const losersMae: number[] = []

  for (const t of trades) {
    if (t.status !== "closed") continue
    const r = Number(t.r)
    if (t.mae_mfe_resolved_at == null) { missing += 1; continue }
    if (t.mfe_r == null && t.mae_r == null) continue
    resolvedCount += 1
    const pnl = Number(t.pnl) || 0
    if (pnl > 0 && t.mfe_r != null) {
      winnersMfe.push(Number(t.mfe_r))
      if (Number.isFinite(r)) winnersRealized.push(r)
    }
    if (pnl < 0 && t.mae_r != null) {
      losersMae.push(Number(t.mae_r))
    }
  }

  const avg = (arr: number[]) => arr.length === 0 ? null : arr.reduce((s, x) => s + x, 0) / arr.length
  const winnersAvgMfe = avg(winnersMfe)
  const winnersAvgRealized = avg(winnersRealized)
  const losersAvgMae = avg(losersMae)
  const cutShortGap = winnersAvgMfe != null && winnersAvgRealized != null ? winnersAvgMfe - winnersAvgRealized : null

  let cutShortNarrative: { text: string; tone: "bad" | "warn" | "good" } | null = null
  if (cutShortGap != null && winnersMfe.length >= 5) {
    if (cutShortGap >= 0.7) {
      cutShortNarrative = {
        tone: "warn",
        text: `Your winners reach +${winnersAvgMfe!.toFixed(2)}R MFE on average but you close at +${winnersAvgRealized!.toFixed(2)}R — leaving ${cutShortGap.toFixed(2)}R per winning trade on the table. Consider a runner / scale-out plan.`,
      }
    } else if (cutShortGap >= 0.3) {
      cutShortNarrative = {
        tone: "warn",
        text: `Modest cut-winners pattern: average +${cutShortGap.toFixed(2)}R left on the table per winner. Trail wider when you can.`,
      }
    } else if (cutShortGap < 0.15) {
      cutShortNarrative = {
        tone: "good",
        text: `You're capturing nearly all the move on winners (only ${Math.max(0, cutShortGap).toFixed(2)}R left on the table on average). Tight execution.`,
      }
    }
  }

  return {
    stats: {
      resolvedCount,
      winners: { count: winnersMfe.length, avgMfe: winnersAvgMfe, avgRealized: winnersAvgRealized },
      losers: { count: losersMae.length, avgMae: losersAvgMae },
      cutShortGap,
      cutShortNarrative,
    },
    missing,
  }
}
