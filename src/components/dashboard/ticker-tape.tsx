"use client"

import { useEffect, useState } from "react"
import { PairFlag } from "@/components/icons"
import { getTickerTapeSnapshots, type TickerTapeResult } from "@/lib/actions/ticker"

/**
 * Live ticker tape — last close + 1-day % change for the user's watchlist
 * pairs (or default FX majors if the watchlist is empty), via Polygon.
 *
 * Polls every 2 minutes — FX majors don't move fast enough at this
 * granularity to need faster, and 2-minute cadence keeps us under
 * Polygon's free-tier rate limit even with 6 pairs in flight.
 *
 * Pauses while the tab is hidden — saves API quota.
 */
const POLL_MS = 120_000

export function TickerTape() {
  const [data, setData] = useState<TickerTapeResult | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      const r = await getTickerTapeSnapshots()
      if (cancelled) return
      setData(r)
      timer = setTimeout(tick, POLL_MS)
    }
    void tick()

    const onVis = () => {
      if (document.hidden) {
        if (timer) { clearTimeout(timer); timer = null }
      } else if (!timer) {
        void tick()
      }
    }
    document.addEventListener("visibilitychange", onVis)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [])

  if (!data) {
    return <Frame><div style={{ fontSize: 11, color: "var(--c-fg-dim)", padding: "0 14px" }}>Loading ticker…</div></Frame>
  }

  if (!data.configured) {
    return (
      <Frame>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", fontSize: 11.5, color: "var(--c-fg-muted)" }}>
          <span>Ticker tape needs a Polygon API key.</span>
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "1px 5px", borderRadius: 4, background: "var(--c-bg-elev-3)" }}>POLYGON_API_KEY</code>
          <span>in your environment.</span>
        </div>
      </Frame>
    )
  }

  if (data.snapshots.length === 0) {
    return <Frame><div style={{ fontSize: 11, color: "var(--c-fg-dim)", padding: "0 14px" }}>No tickers — add pairs to your watchlist.</div></Frame>
  }

  return (
    <Frame>
      {data.snapshots.map((t) => {
        const dir = t.changePct == null ? "flat" : t.changePct > 0 ? "up" : t.changePct < 0 ? "down" : "flat"
        const dp = t.pair.toUpperCase().includes("JPY") ? 3 : (t.pair.toUpperCase().includes("XAU") || t.pair.toUpperCase().includes("XAG")) ? 2 : 5
        return (
          <div key={t.pair} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <PairFlag pair={t.pair} size={16} />
            <span style={{ fontSize: 12, color: "var(--c-fg-muted)", fontWeight: 500 }}>{t.pair}</span>
            <span className="tnum" style={{ fontSize: 13, fontWeight: 600 }}>
              {t.price != null ? t.price.toFixed(dp) : "—"}
            </span>
            <span
              className="tnum"
              style={{
                fontSize: 11.5,
                color: dir === "up" ? "var(--c-green-bright)" : dir === "down" ? "var(--c-red-bright)" : "var(--c-fg-muted)",
                fontWeight: 500,
              }}
            >
              {t.changePct == null
                ? "—"
                : `${t.changePct > 0 ? "▲" : t.changePct < 0 ? "▼" : "·"} ${Math.abs(t.changePct).toFixed(2)}%`}
            </span>
          </div>
        )
      })}
    </Frame>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        overflow: "hidden",
        background: "var(--c-bg-elev-1)",
        border: "1px solid var(--c-border)",
        borderRadius: "var(--radius-lg)",
        padding: "10px 4px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 24,
          overflowX: "auto",
          paddingInline: 14,
          scrollbarWidth: "none",
        }}
      >
        {children}
      </div>
    </div>
  )
}
