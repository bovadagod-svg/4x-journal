import { PairFlag } from "@/components/icons"

// Stub data until Phase 9 wires a real market-data feed (Polygon, Twelve Data, etc).
// Same set the prototype shipped with — keeps the dashboard's hero strip alive.
const TICKERS: Array<{ pair: string; price: number; change: number; dir: "up" | "down" }> = [
  { pair: "EUR/USD", price: 1.08412, change: 0.21, dir: "up" },
  { pair: "GBP/USD", price: 1.26508, change: -0.14, dir: "down" },
  { pair: "USD/JPY", price: 154.823, change: 0.42, dir: "up" },
  { pair: "AUD/USD", price: 0.65412, change: -0.08, dir: "down" },
  { pair: "USD/CAD", price: 1.36908, change: 0.11, dir: "up" },
  { pair: "USD/CHF", price: 0.90112, change: -0.22, dir: "down" },
  { pair: "NZD/USD", price: 0.59820, change: 0.05, dir: "up" },
  { pair: "EUR/GBP", price: 0.85702, change: 0.18, dir: "up" },
]

export function TickerTape() {
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
        {TICKERS.map((t) => (
          <div key={t.pair} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <PairFlag pair={t.pair} size={16} />
            <span style={{ fontSize: 12, color: "var(--c-fg-muted)", fontWeight: 500 }}>{t.pair}</span>
            <span className="tnum" style={{ fontSize: 13, fontWeight: 600 }}>
              {t.price.toFixed(t.pair.includes("JPY") ? 3 : 5)}
            </span>
            <span
              className="tnum"
              style={{
                fontSize: 11.5,
                color: t.dir === "up" ? "var(--c-green-bright)" : "var(--c-red-bright)",
                fontWeight: 500,
              }}
            >
              {t.dir === "up" ? "▲" : "▼"} {Math.abs(t.change).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
