"use client"

import { useEffect, useState } from "react"
import { PairFlag } from "@/components/icons"
import { getTickerTapeSnapshots, type TickerTapeResult } from "@/lib/actions/ticker"

/**
 * Live ticker tape — last close + 1-day % change for the user's watchlist
 * pairs (or default FX majors if the watchlist is empty), via Polygon.
 *
 * Auto-scrolls left like a marquee. The track holds two copies of the
 * cells so the loop is seamless: when the first set has fully translated
 * off-screen left, the second set is positioned exactly where the first
 * was, and the animation snaps back to translateX(0) for the next cycle.
 *
 * Hover pauses the scroll so the user can read a price.
 *
 * Polls every 2 minutes for fresh quotes. Pauses while the tab is hidden.
 */
const POLL_MS = 120_000
const SCROLL_DURATION_S = 50  // ~50s for one full loop — readable, not frantic

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

  // Keyframes + hover-pause CSS — injected once per page since browsers
  // dedupe identical @keyframes rules.
  const styleTag = (
    <style>{`
      @keyframes tickerScroll {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }
      .tt-track {
        display: flex;
        gap: 24px;
        padding-inline: 14px;
        animation: tickerScroll ${SCROLL_DURATION_S}s linear infinite;
        will-change: transform;
      }
      .tt-track:hover { animation-play-state: paused; }
      @media (prefers-reduced-motion: reduce) {
        .tt-track { animation: none; }
      }
    `}</style>
  )

  if (!data) {
    return <Frame>{styleTag}<StaticContent>Loading ticker…</StaticContent></Frame>
  }

  if (!data.configured) {
    return (
      <Frame>
        {styleTag}
        <StaticContent>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span>Ticker tape needs a Polygon API key.</span>
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "1px 5px", borderRadius: 4, background: "var(--c-bg-elev-3)" }}>POLYGON_API_KEY</code>
            <span>in your environment.</span>
          </span>
        </StaticContent>
      </Frame>
    )
  }

  if (data.snapshots.length === 0) {
    return <Frame>{styleTag}<StaticContent>No tickers — add pairs to your watchlist.</StaticContent></Frame>
  }

  // Render the cells twice so the marquee loop is seamless. translateX(-50%)
  // lands the second copy exactly where the first one started.
  const cells = data.snapshots.map((t) => <TickerCell key={t.pair} t={t} />)
  const cellsClone = data.snapshots.map((t) => <TickerCell key={`${t.pair}-clone`} t={t} aria-hidden />)

  return (
    <Frame>
      {styleTag}
      <div className="tt-track">
        {cells}
        {cellsClone}
      </div>
    </Frame>
  )
}

function TickerCell({ t }: { t: { pair: string; price: number | null; changePct: number | null } }) {
  const dir = t.changePct == null ? "flat" : t.changePct > 0 ? "up" : t.changePct < 0 ? "down" : "flat"
  const upper = t.pair.toUpperCase()
  const dp = upper.includes("JPY") ? 3 : (upper.includes("XAU") || upper.includes("XAG")) ? 2 : 5
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        overflow: "hidden",   // clip the marquee at the edges of the card
        background: "var(--c-bg-elev-1)",
        border: "1px solid var(--c-border)",
        borderRadius: "var(--radius-lg)",
        padding: "10px 0",
      }}
    >
      {children}
    </div>
  )
}

function StaticContent({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)", padding: "0 14px" }}>{children}</div>
  )
}
