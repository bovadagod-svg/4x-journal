import Link from "next/link"
import { formatUSD } from "@/lib/finance"
import { getAllRiskRules, getRiskUsage } from "@/lib/risk"
import { getUserAccounts } from "@/lib/queries/accounts"
import { getCurrentScope } from "@/lib/queries/scope"

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
  const barColor = tone === "red" ? "var(--c-red-bright)" : tone === "amber" ? "var(--c-amber)" : "var(--c-green-bright)"

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 className="card-title">Risk usage</h3>
          <p className="card-subtitle">
            {targetAccount.broker} · {targetAccount.label}
            {rule?.enabled === false && <span style={{ color: "var(--c-amber)" }}> · rules disabled</span>}
          </p>
        </div>
        <Link href="/risk" className="btn" style={{ fontSize: 12 }}>Configure</Link>
      </div>

      {!hasLimit ? (
        <div style={{ fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
          No daily loss limit set. <Link href="/risk" style={{ color: "var(--c-accent-bright)" }}>Add rules →</Link>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color: barColor }}>
              {formatUSD(usage.dailyLossUsedUsd)}
            </span>
            <span style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>
              of {formatUSD(usage.dailyLossLimitUsd!)} limit · {Math.round(pct)}% used
            </span>
          </div>

          <div style={{ width: "100%", height: 6, background: "var(--c-bg-elev-3)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 3, transition: "width 0.2s" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--c-fg-muted)" }}>
            <span>{usage.openPositions} open{usage.maxOpenPositions != null ? ` / ${usage.maxOpenPositions} max` : ""}</span>
            <span>{tone === "red" ? "Hard limit reached" : tone === "amber" ? "Use caution" : "Safe zone"}</span>
          </div>
        </>
      )}
    </div>
  )
}
