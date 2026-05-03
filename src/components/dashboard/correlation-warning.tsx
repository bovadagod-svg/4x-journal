import { getOpenTrades } from "@/lib/queries/trades"
import { findCorrelationWarnings, formatExposurePct, type CorrelationWarning } from "@/lib/correlation"

export async function CorrelationWarning() {
  const open = await getOpenTrades()
  if (open.length < 3) return null

  const positions = open.map((t) => ({
    id: t.id,
    pair: t.pair,
    side: t.side === "long" ? ("long" as const) : ("short" as const),
    risk: Number(t.risk_amount) || 0,
  }))

  const warnings = findCorrelationWarnings(positions)
  if (warnings.length === 0) return null

  // Surface only the most-concentrated currency. Multiple warnings get noisy
  // and the user can drill into the Risk page for the full picture.
  const top = warnings[0]
  return <CorrelationBanner warning={top} />
}

function CorrelationBanner({ warning }: { warning: CorrelationWarning }) {
  const dirWord = warning.direction === "long" ? "long" : "short"
  const accent = warning.direction === "long" ? "var(--c-green-bright)" : "var(--c-red-bright)"
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 10,
        border: `1px solid ${accent}55`,
        background: warning.direction === "long" ? "rgba(45, 219, 115, 0.08)" : "rgba(224, 74, 85, 0.08)",
      }}
    >
      <div
        style={{
          width: 32, height: 32, flexShrink: 0,
          borderRadius: 8,
          background: warning.direction === "long" ? "rgba(45, 219, 115, 0.15)" : "rgba(224, 74, 85, 0.15)",
          color: accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14,
        }}
      >
        {warning.currency}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
          Net {dirWord} {warning.currency} exposure {formatExposurePct(warning.exposureMultiple)}
        </div>
        <div style={{ fontSize: 12, color: "var(--c-fg-muted)", lineHeight: 1.45 }}>
          {warning.tradeCount} open positions are stacking the same {warning.currency} bet — this is
          one trade dressed up as {warning.tradeCount}. If {warning.currency} moves against you, every
          one of them moves with it.
        </div>
      </div>
    </div>
  )
}
