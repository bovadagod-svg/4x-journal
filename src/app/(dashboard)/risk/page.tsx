import { SectionHeader } from "@/components/shell/section-header"
import { SECTION_META } from "@/lib/sections"
import { getUserAccounts } from "@/lib/queries/accounts"
import { getAllRiskRules } from "@/lib/risk"
import { RiskRulesForm } from "@/components/risk/risk-rules-form"

export default async function RiskPage() {
  const m = SECTION_META.risk
  const [accounts, rules] = await Promise.all([getUserAccounts(), getAllRiskRules()])
  const rulesByAccount = new Map(rules.map((r) => [r.account_id, r]))

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle="One rule set per account. Pre-flight check runs every time you log a trade."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 14 }}>
        {accounts.map((a) => (
          <RiskRulesForm key={a.id} account={a} rules={rulesByAccount.get(a.id) ?? null} />
        ))}
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
        <h3 className="card-title">How rules work</h3>
        <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.6 }}>
          <li><strong style={{ color: "var(--c-fg)" }}>Per trade max risk</strong> — the Log Trade modal blocks if the dollar risk you enter exceeds this cap (% of equity OR fixed $).</li>
          <li><strong style={{ color: "var(--c-fg)" }}>Daily loss limit</strong> — once today&apos;s realized loss equals or exceeds this, new trades are blocked until tomorrow.</li>
          <li><strong style={{ color: "var(--c-fg)" }}>Max open positions</strong> — caps how many open trades you can hold simultaneously on one account.</li>
          <li>If you flip <em>Active</em> to <em>Disabled</em>, rules stay saved but stop enforcing — handy when reviewing settings.</li>
        </ul>
      </div>
    </>
  )
}
