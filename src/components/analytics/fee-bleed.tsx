"use client"

import { useMemo } from "react"
import { NarrativeBanner } from "./narrative-banner"
import { formatUSD } from "@/lib/finance"
import type { TradeFill } from "@/lib/queries/trade-fills"

/**
 * Fee bleed card — surfaces invisible costs (commission, swap, tax) that
 * compound silently across hundreds of trades. Sprint A (#22) writes these
 * fields per-fill but no view aggregates them.
 *
 * Swap is the big behavioral teach: holding past Wednesday's 5pm NY rollover
 * triples the swap charge on most brokers. The day-of-week mini-bar makes
 * that visible at a glance.
 *
 * Currency note: numbers are summed in account currency (whatever the broker
 * reports). For a multi-account, multi-currency user we'd want display-currency
 * conversion via lib/money — deferred since most users have one main account.
 */
export function FeeBleed({ fillsByTrade }: { fillsByTrade: Map<string, TradeFill[]> }) {
  const stats = useMemo(() => compute(fillsByTrade), [fillsByTrade])

  if (stats.fillsWithFees < 5) return null

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <h3 className="card-title">Fee Bleed</h3>
        <p className="card-subtitle">
          {stats.fillsWithFees} fills with broker-reported costs in this range
        </p>
      </div>

      {/* Headline strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 8,
        marginBottom: stats.swapByDay.totalNonZero > 0 ? 16 : 0,
      }}>
        <Stat
          label="Commission"
          value={formatUSD(stats.totalCommission)}
          sub="paid"
          color="var(--c-fg)"
        />
        <Stat
          label="Swap"
          value={formatUSD(stats.totalSwap, { signed: true })}
          sub={stats.totalSwap < 0 ? "paid (rollover)" : "earned"}
          color={stats.totalSwap <= 0 ? "var(--c-amber)" : "var(--c-green-bright)"}
        />
        <Stat
          label="Tax"
          value={formatUSD(stats.totalTax)}
          sub="withheld"
          color="var(--c-fg)"
        />
        <Stat
          label="Total cost"
          value={formatUSD(stats.totalCost)}
          sub="commission + |swap| + tax"
          color="var(--c-amber)"
        />
      </div>

      {/* Swap by day-of-week */}
      {stats.swapByDay.totalNonZero > 0 && (
        <div>
          <div style={{
            fontSize: 10.5, color: "var(--c-fg-muted)",
            textTransform: "uppercase", letterSpacing: "0.05em",
            marginBottom: 8,
          }}>
            Swap by day of week
          </div>
          <SwapByDayBars day={stats.swapByDay} />
          {stats.swapByDay.wedSpike && (
            <div style={{ marginTop: 10 }}>
              <NarrativeBanner tone="warn">
                Wednesday accounts for{" "}
                <strong style={{ color: "var(--c-amber)" }}>
                  {Math.round((Math.abs(stats.swapByDay.byDay[3]) / stats.swapByDay.totalNonZero) * 100)}%
                </strong>{" "}
                of your swap charges — the triple-rollover effect for positions held past 5pm NY.
                Plan exits before Wednesday close when you can.
              </NarrativeBanner>
            </div>
          )}
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

function SwapByDayBars({ day }: { day: SwapByDay }) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const max = Math.max(...day.byDay.map((v) => Math.abs(v)), 0.01)
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
      {labels.map((lbl, i) => {
        const v = day.byDay[i]
        const pct = Math.round((Math.abs(v) / max) * 100)
        const isWed = i === 3
        return (
          <div key={lbl} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              height: 60, width: "100%",
              background: "var(--c-bg-elev-2)",
              borderRadius: 4,
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", left: 0, right: 0, bottom: 0,
                height: `${pct}%`,
                background: v < 0
                  ? (isWed ? "var(--c-amber)" : "rgba(190, 51, 61, 0.55)")
                  : "rgba(17, 196, 88, 0.55)",
                transition: "height 0.2s ease",
              }} />
            </div>
            <div style={{ fontSize: 9.5, color: isWed ? "var(--c-amber)" : "var(--c-fg-muted)", fontWeight: isWed ? 600 : 400 }}>
              {lbl}
            </div>
            <div className="tnum" style={{ fontSize: 9.5, color: "var(--c-fg-dim)" }}>
              {v === 0 ? "—" : formatCompact(v)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

type SwapByDay = {
  /** Index 0 = Sunday … 6 = Saturday. Value is sum of swap (negative when paid). */
  byDay: number[]
  /** Total of |byDay| values. */
  totalNonZero: number
  /** True when Wednesday's |swap| is ≥40% of the total — the triple-rollover signature. */
  wedSpike: boolean
}

function compute(fillsByTrade: Map<string, TradeFill[]>) {
  let totalCommission = 0
  let totalSwap = 0
  let totalTax = 0
  let fillsWithFees = 0
  const swapByDayBuckets = [0, 0, 0, 0, 0, 0, 0]

  for (const fills of fillsByTrade.values()) {
    for (const f of fills) {
      const c = f.commission == null ? 0 : Number(f.commission)
      const s = f.swap == null ? 0 : Number(f.swap)
      const tx = f.tax == null ? 0 : Number(f.tax)
      if (c === 0 && s === 0 && tx === 0) continue
      fillsWithFees++
      totalCommission += Math.abs(c)
      totalSwap += s
      totalTax += Math.abs(tx)
      if (s !== 0) {
        const day = new Date(f.filled_at).getUTCDay()
        swapByDayBuckets[day] += s
      }
    }
  }

  const totalNonZero = swapByDayBuckets.reduce((a, b) => a + Math.abs(b), 0)
  const wedShare = totalNonZero > 0 ? Math.abs(swapByDayBuckets[3]) / totalNonZero : 0
  const wedSpike = wedShare >= 0.4 && Math.abs(swapByDayBuckets[3]) > 0.5

  return {
    totalCommission: round2(totalCommission),
    totalSwap: round2(totalSwap),
    totalTax: round2(totalTax),
    totalCost: round2(totalCommission + Math.abs(totalSwap) + totalTax),
    fillsWithFees,
    swapByDay: { byDay: swapByDayBuckets.map(round2), totalNonZero: round2(totalNonZero), wedSpike },
  }
}

function round2(n: number): number {
  return Number(n.toFixed(2))
}

function formatCompact(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  if (abs >= 100) return `${sign}$${Math.round(abs)}`
  return `${sign}$${abs.toFixed(1)}`
}
