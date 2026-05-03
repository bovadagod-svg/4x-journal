import { Icon } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import type { Trade } from "@/lib/queries/trades"

/**
 * Streak card. Computes:
 *   - Current streak (W/L count + dollar value)
 *   - All-time longest win and loss streaks
 *   - "Best trade" + "Worst trade" mini-cards from this period
 *
 * The current streak counts consecutive same-direction trades reading
 * backward from the most recent close. Breakeven trades break the streak.
 */
export function StreakCard({ trades, periodLabel = "30 days" }: { trades: Trade[]; periodLabel?: string }) {
  const closed = trades
    .filter((t) => t.status === "closed" && t.closed_at)
    .sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime())
  if (closed.length === 0) return null

  // Current streak — walk back from the most recent close
  let currentStreak = 0
  let currentDirection: "win" | "loss" | null = null
  let currentValue = 0
  for (const t of closed) {
    const pnl = Number(t.pnl) || 0
    const dir = pnl > 0 ? "win" : pnl < 0 ? "loss" : null
    if (dir === null) break
    if (currentDirection === null) currentDirection = dir
    else if (currentDirection !== dir) break
    currentStreak++
    currentValue += pnl
  }

  // Best/worst all-time streaks (chronological scan)
  const chrono = [...closed].reverse()
  let longestWin = 0, longestLoss = 0
  let runWin = 0, runLoss = 0
  for (const t of chrono) {
    const pnl = Number(t.pnl) || 0
    if (pnl > 0) { runWin++; runLoss = 0; if (runWin > longestWin) longestWin = runWin }
    else if (pnl < 0) { runLoss++; runWin = 0; if (runLoss > longestLoss) longestLoss = runLoss }
    else { runWin = 0; runLoss = 0 }
  }

  // Best/worst trade in this period (filtered list passed in)
  const sortedByPnL = [...closed].sort((a, b) => (Number(b.pnl) || 0) - (Number(a.pnl) || 0))
  const bestTrade = sortedByPnL[0]
  const worstTrade = sortedByPnL[sortedByPnL.length - 1]

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 className="card-title" style={{ fontSize: 13 }}>Streaks · {periodLabel}</h3>
      </div>

      {/* Current streak headline */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: 12,
        background: currentDirection === "win" ? "rgba(17, 196, 88, 0.06)" : currentDirection === "loss" ? "rgba(190, 51, 61, 0.06)" : "var(--c-bg-elev-2)",
        border: `1px solid ${currentDirection === "win" ? "rgba(17, 196, 88, 0.25)" : currentDirection === "loss" ? "rgba(190, 51, 61, 0.25)" : "var(--c-border)"}`,
        borderRadius: 10, marginBottom: 10,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: currentDirection === "win" ? "rgba(17, 196, 88, 0.18)" : currentDirection === "loss" ? "rgba(190, 51, 61, 0.18)" : "var(--c-bg-elev-3)",
          display: "grid", placeItems: "center",
          color: currentDirection === "win" ? "var(--c-green-bright)" : currentDirection === "loss" ? "var(--c-red-bright)" : "var(--c-fg-muted)",
        }}>
          <Icon name={currentDirection === "loss" ? "flame" : currentDirection === "win" ? "sparkle" : "info"} size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Current streak</div>
          <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>
            {currentStreak === 0 ? "—" : `${currentStreak} ${currentDirection === "win" ? "wins" : "losses"} in a row`}
          </div>
        </div>
        {currentStreak > 0 && (
          <div className="tnum" style={{
            fontSize: 14, fontWeight: 600,
            color: currentValue >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)",
          }}>
            {formatUSD(currentValue, { signed: true })}
          </div>
        )}
      </div>

      {/* Longest streaks + best/worst trade row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6 }}>
        <Mini label="Longest win streak" value={`${longestWin}`} sub="all-time" color="var(--c-green-bright)" />
        <Mini label="Longest losing streak" value={`${longestLoss}`} sub="all-time" color="var(--c-red-bright)" />
        {bestTrade && (
          <Mini
            label="Best trade"
            value={formatUSD(Number(bestTrade.pnl), { signed: true })}
            sub={bestTrade.pair}
            color="var(--c-green-bright)"
          />
        )}
        {worstTrade && Number(worstTrade.pnl) < 0 && (
          <Mini
            label="Worst trade"
            value={formatUSD(Number(worstTrade.pnl), { signed: true })}
            sub={worstTrade.pair}
            color="var(--c-red-bright)"
          />
        )}
      </div>
    </div>
  )
}

function Mini({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 6, padding: "6px 8px" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 14, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--c-fg-dim)" }}>{sub}</div>
    </div>
  )
}
