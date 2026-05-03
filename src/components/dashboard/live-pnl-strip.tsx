"use client"

import { useEffect, useState } from "react"
import { Icon } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import { getLiveQuotesForOpen, type LiveQuotesResult } from "@/lib/actions/tradelocker"

/**
 * Live floating-P&L strip for TradeLocker-synced open positions. Polls the
 * /trade/quotes endpoint every 30 seconds — fast enough that the user sees
 * meaningful movement on volatile pairs, slow enough that we're not
 * re-logging into TL every 10s (one TL session per poll).
 *
 * Hides itself entirely when there are no live quotes (no open TL positions
 * or instrument mapping not yet cached).
 */
const POLL_MS = 30_000

export function LivePnlStrip() {
  const [data, setData] = useState<LiveQuotesResult | null>(null)
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      const r = await getLiveQuotesForOpen()
      if (cancelled) return
      setData(r)
      setPulse((p) => p + 1)
      timer = setTimeout(tick, POLL_MS)
    }
    void tick()

    // Pause polling when the tab isn't visible — saves API quota.
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

  if (!data || data.empty) return null

  const rows = Object.entries(data.byTradeId)
  if (rows.length === 0) return null

  const totalFloating = rows.reduce((s, [, q]) => s + (q.floatingPnl ?? 0), 0)

  return (
    <div className="card" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PulseDot pulse={pulse} />
          <h3 className="card-title" style={{ margin: 0 }}>Live floating P&amp;L</h3>
          <span className="card-subtitle" style={{ margin: 0 }}>
            {rows.length} broker position{rows.length === 1 ? "" : "s"} · refreshed {formatRel(data.fetchedAt)}
          </span>
        </div>
        <div className="tnum" style={{
          fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600,
          color: totalFloating >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)",
        }}>
          {formatUSD(totalFloating, { signed: true })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
        {rows.map(([id, q]) => (
          <div key={id} style={{
            background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)",
            borderRadius: 8, padding: "10px 12px",
          }}>
            <div className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{q.symbol}</div>
            <div className="tnum" style={{
              fontSize: 16, fontWeight: 600, marginTop: 2,
              color: q.floatingPnl == null
                ? "var(--c-fg-muted)"
                : q.floatingPnl >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)",
            }}>
              {q.floatingPnl == null ? "—" : formatUSD(q.floatingPnl, { signed: true })}
            </div>
            <div className="tnum" style={{ fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 2 }}>
              bid {q.bid ?? "—"} · ask {q.ask ?? "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PulseDot({ pulse }: { pulse: number }) {
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (pulse === 0) return
    setActive(true)
    const t = setTimeout(() => setActive(false), 800)
    return () => clearTimeout(t)
  }, [pulse])
  return (
    <span
      style={{
        width: 8, height: 8, borderRadius: "50%",
        background: "var(--c-green-bright)",
        boxShadow: active ? "0 0 8px var(--c-green-bright)" : "none",
        transition: "box-shadow 0.6s",
      }}
    />
  )
}

function formatRel(iso: string): string {
  const d = new Date(iso).getTime()
  const sec = Math.floor((Date.now() - d) / 1000)
  if (sec < 5) return "just now"
  if (sec < 60) return `${sec}s ago`
  return new Date(iso).toLocaleTimeString()
}
