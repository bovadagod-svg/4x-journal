import Link from "next/link"
import { formatUSD } from "@/lib/finance"
import { getAllRiskRules, getRiskUsage } from "@/lib/risk"
import { getUserAccounts } from "@/lib/queries/accounts"
import { getCurrentScope } from "@/lib/queries/scope"
import { Donut } from "@/components/charts/donut"

export async function RiskGauge() {
  const [scope, accounts, rules] = await Promise.all([
    getCurrentScope(),
    getUserAccounts(),
    getAllRiskRules(),
  ])

  // If scope is "all" or doesn't match an account, pick the default-ish account
  // that has rules — otherwise show the first account.
  const targetAccount = scope !== "all"
    ? accounts.find((a) => a.id === scope)
    : accounts.find((a) => rules.some((r) => r.account_id === a.id))
      ?? accounts.find((a) => a.is_default)
      ?? accounts[0]

  if (!targetAccount) return null

  const rule = rules.find((r) => r.account_id === targetAccount.id) ?? null
  const usage = await getRiskUsage(targetAccount.id, rule)

  const hasLimit = usage.dailyLossLimitUsd != null
  const pct = hasLimit && usage.dailyLossLimitUsd! > 0
    ? Math.min(100, (usage.dailyLossUsedUsd / usage.dailyLossLimitUsd!) * 100)
    : 0
  const tone = pct >= 80 ? "red" : pct >= 50 ? "amber" : "green"
  const ringColor = tone === "red" ? "var(--c-red-bright)" : tone === "amber" ? "var(--c-amber)" : "var(--c-green-bright)"
  const chipClass = tone === "red" ? "chip chip-red" : tone === "amber" ? "chip chip-amber" : "chip chip-green"
  const chipLabel = tone === "red" ? "Hard stop" : tone === "amber" ? "Caution" : "Safe"

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
        <div>
          <h3 className="card-title">Risk Manager</h3>
          <p className="card-subtitle">
            {rule?.daily_loss_limit_pct != null
              ? `Daily loss limit · ${rule.daily_loss_limit_pct}%`
              : "No limit set"}
            {rule?.enabled === false && <span style={{ color: "var(--c-amber)" }}> · disabled</span>}
          </p>
        </div>
        {hasLimit && <span className={chipClass}>{chipLabel}</span>}
      </div>

      {!hasLimit ? (
        <div style={{ paddingTop: 6, fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
          {targetAccount.broker} · {targetAccount.label} has no rules configured.{" "}
          <Link href="/risk" style={{ color: "var(--c-accent-bright)" }}>Add rules →</Link>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10 }}>
          <Donut
            value={pct}
            size={130}
            thickness={10}
            color={ringColor}
            label={`${Math.round(pct)}%`}
            sublabel="used today"
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <div>
              <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Loss today</div>
              <div className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 600, color: "var(--c-red-bright)" }}>
                −{formatUSD(usage.dailyLossUsedUsd)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Buffer remaining</div>
              <div className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 600 }}>
                {formatUSD(Math.max(0, (usage.dailyLossLimitUsd ?? 0) - usage.dailyLossUsedUsd))}
              </div>
            </div>
            <div style={{
              fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 4, paddingTop: 6,
              borderTop: "1px solid var(--c-border)",
            }}>
              {usage.maxOpenPositions != null
                ? `${usage.openPositions} of ${usage.maxOpenPositions} open positions used.`
                : `${usage.openPositions} open position${usage.openPositions === 1 ? "" : "s"}.`}
              {" "}<Link href="/risk" style={{ color: "var(--c-fg-muted)" }}>Configure →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
