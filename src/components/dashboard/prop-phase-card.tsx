import Link from "next/link"
import { Icon } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import { getUserAccounts } from "@/lib/queries/accounts"

/**
 * #59 Prop firm phase card. Renders one row per account with prop_phase set.
 * Hidden entirely when no accounts are flagged as prop. Math:
 *   - Profit target progress: (equity − start) / (start × target%)
 *   - DD usage: (start − equity) / (start × maxDd%) — clamped to 0
 *   - Days to payout: difference between today (UTC) and prop_next_payout_at
 */
export async function PropPhaseCard() {
  const accounts = await getUserAccounts()
  const propAccounts = accounts.filter((a) => a.prop_phase != null)
  if (propAccounts.length === 0) return null

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
        <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="target" size={14} color="var(--c-amber)" />
          Prop Firm Tracker
        </h3>
        <p className="card-subtitle">
          {propAccounts.length} prop account{propAccounts.length === 1 ? "" : "s"} · profit target progress, drawdown usage, days to payout
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {propAccounts.map((a) => (
          <PropRow key={a.id} account={a} />
        ))}
      </div>
    </div>
  )
}

function PropRow({ account: a }: { account: Awaited<ReturnType<typeof getUserAccounts>>[number] }) {
  const start = Number(a.prop_starting_balance ?? a.balance ?? 0)
  const equity = Number(a.equity ?? a.balance ?? 0)
  const phaseLabel = a.prop_phase === "eval" ? "Evaluation" : a.prop_phase === "verification" ? "Verification" : "Funded"
  const phaseColor = a.prop_phase === "funded" ? "var(--c-green-bright)" : a.prop_phase === "verification" ? "var(--c-cyan-bright)" : "var(--c-amber)"

  // Profit target progress — capped 0..100 in display.
  let targetProgress: number | null = null
  let targetGoalAmount: number | null = null
  if (a.prop_profit_target_pct != null && start > 0) {
    targetGoalAmount = start * (Number(a.prop_profit_target_pct) / 100)
    const earned = equity - start
    targetProgress = targetGoalAmount > 0 ? Math.max(0, Math.min(100, (earned / targetGoalAmount) * 100)) : null
  }

  // Max DD usage.
  let ddUsagePct: number | null = null
  if (a.prop_max_drawdown_pct != null && start > 0) {
    const ddDollar = start - equity
    const ddCap = start * (Number(a.prop_max_drawdown_pct) / 100)
    ddUsagePct = ddCap > 0 ? Math.max(0, Math.min(100, (ddDollar / ddCap) * 100)) : null
  }

  // Days to payout.
  let daysToPayout: number | null = null
  if (a.prop_next_payout_at) {
    const target = new Date(a.prop_next_payout_at + "T00:00:00Z").getTime()
    const today = new Date(); today.setUTCHours(0, 0, 0, 0)
    daysToPayout = Math.round((target - today.getTime()) / (24 * 3600_000))
  }

  return (
    <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--c-border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: a.color }} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>{a.broker} · {a.label}</span>
        <span className="chip" style={{ fontSize: 10, padding: "1px 7px", color: phaseColor, borderColor: phaseColor, background: "transparent" }}>
          {phaseLabel}
        </span>
        {start > 0 && (
          <span style={{ fontSize: 11, color: "var(--c-fg-muted)", marginLeft: "auto" }}>
            {formatUSD(equity)} <span style={{ color: "var(--c-fg-dim)" }}>/ {formatUSD(start)} start</span>
          </span>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {targetProgress != null && targetGoalAmount != null && (
          <Cell
            label="Profit target"
            value={`${Math.round(targetProgress)}%`}
            sub={`to +${formatUSD(targetGoalAmount)} goal`}
            barPct={targetProgress}
            barColor={targetProgress >= 100 ? "var(--c-green-bright)" : "var(--c-cyan-bright)"}
          />
        )}
        {ddUsagePct != null && (
          <Cell
            label="DD used"
            value={`${Math.round(ddUsagePct)}%`}
            sub={`of ${a.prop_max_drawdown_pct}% cap`}
            barPct={ddUsagePct}
            barColor={ddUsagePct >= 80 ? "var(--c-red-bright)" : ddUsagePct >= 50 ? "var(--c-amber)" : "var(--c-fg-muted)"}
          />
        )}
        {daysToPayout != null && (
          <Cell
            label="Next payout"
            value={daysToPayout < 0 ? "Overdue" : daysToPayout === 0 ? "Today" : `${daysToPayout}d`}
            sub={a.prop_next_payout_at ?? ""}
            barColor={daysToPayout < 0 ? "var(--c-red-bright)" : daysToPayout <= 3 ? "var(--c-amber)" : "var(--c-fg-muted)"}
          />
        )}
      </div>
    </div>
  )
}

function Cell({ label, value, sub, barPct, barColor }: { label: string; value: string; sub: string; barPct?: number; barColor?: string }) {
  return (
    <div style={{ background: "var(--c-bg-elev-2)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 600, color: barColor ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>{sub}</div>}
      {barPct != null && (
        <div style={{ marginTop: 6, height: 4, background: "var(--c-bg-elev-3)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, barPct)}%`, height: "100%", background: barColor }} />
        </div>
      )}
    </div>
  )
}
