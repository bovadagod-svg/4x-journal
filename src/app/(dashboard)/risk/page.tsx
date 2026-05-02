import { SectionHeader } from "@/components/shell/section-header"
import { SECTION_META } from "@/lib/sections"
import { getUserAccounts } from "@/lib/queries/accounts"
import {
  getAllRiskRules,
  getRiskUsage,
  getOpenExposure,
  getBehavioralSignals,
} from "@/lib/risk"
import { getTodayPnL } from "@/lib/queries/trades"
import { RiskAccountCard, BehavioralSignalsPanel } from "@/components/risk/risk-account-card"

export default async function RiskPage() {
  const m = SECTION_META.risk
  const [accounts, rules, signals] = await Promise.all([
    getUserAccounts(),
    getAllRiskRules(),
    getBehavioralSignals(),
  ])
  const rulesByAccount = new Map(rules.map((r) => [r.account_id, r]))

  // Per-account live data (usage + exposure + today's PnL)
  const cards = await Promise.all(
    accounts.map(async (a) => {
      const r = rulesByAccount.get(a.id) ?? null
      const [usage, expo, todayPnl] = await Promise.all([
        getRiskUsage(a.id, r),
        getOpenExposure(a.id),
        getTodayPnL({ accountId: a.id }),
      ])
      return { account: a, rules: r, usage, exposure: expo.rows, todayClosedPnl: todayPnl.value }
    })
  )

  // Aggregate KPIs across all accounts
  const totalEquity = accounts.reduce((s, a) => s + Number(a.equity ?? 0), 0)
  const totalOpenRisk = cards.reduce((s, c) => s + c.exposure.reduce((x, e) => x + e.risk, 0), 0)
  const totalDailyLossUsed = cards.reduce((s, c) => s + c.usage.dailyLossUsedUsd, 0)
  const totalOpenPositions = cards.reduce((s, c) => s + c.usage.openPositions, 0)
  const accountsWithRules = cards.filter((c) => c.rules?.enabled).length

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={`${accountsWithRules} of ${accounts.length} account${accounts.length === 1 ? "" : "s"} have active rules · pre-flight runs at trade entry`}
      />

      {/* Top-level KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <Kpi
          label="Total equity"
          value={fmt(totalEquity)}
          sub={`${accounts.length} account${accounts.length === 1 ? "" : "s"} tracked`}
        />
        <Kpi
          label="Open risk"
          value={fmt(-totalOpenRisk, true)}
          sub={`${totalOpenPositions} open position${totalOpenPositions === 1 ? "" : "s"}`}
          color={totalOpenRisk > 0 ? "var(--c-amber)" : "var(--c-fg-muted)"}
        />
        <Kpi
          label="Daily loss used"
          value={totalDailyLossUsed > 0 ? fmt(-totalDailyLossUsed, true) : "—"}
          sub={totalDailyLossUsed > 0 ? "across all accounts today" : "no losses today"}
          color={totalDailyLossUsed > 0 ? "var(--c-red-bright)" : "var(--c-green-bright)"}
        />
        <Kpi
          label="Coverage"
          value={`${accountsWithRules}/${accounts.length}`}
          sub="accounts with rules enabled"
          color={accountsWithRules === accounts.length ? "var(--c-green-bright)" : "var(--c-amber)"}
        />
      </div>

      {/* Per-account cards with gauges + exposure + form */}
      {accounts.length === 0 ? (
        <div className="card" style={{ padding: 20, textAlign: "center", color: "var(--c-fg-muted)", fontSize: 13 }}>
          Add an account to set risk rules.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(520px, 1fr))", gap: 14 }}>
          {cards.map((c) => (
            <RiskAccountCard
              key={c.account.id}
              account={c.account}
              rules={c.rules}
              usage={c.usage}
              exposure={c.exposure}
              todayClosedPnl={c.todayClosedPnl}
            />
          ))}
        </div>
      )}

      <BehavioralSignalsPanel signals={signals} />

      {/* How rules work */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 16 }}>
        <h3 className="card-title">How rules work</h3>
        <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.6 }}>
          <li><strong style={{ color: "var(--c-fg)" }}>Per trade max risk</strong> — the Log Trade modal blocks if your dollar risk exceeds this cap (% of equity OR fixed $).</li>
          <li><strong style={{ color: "var(--c-fg)" }}>Daily loss limit</strong> — once today&apos;s realized loss equals or exceeds this, new trades are blocked until tomorrow.</li>
          <li><strong style={{ color: "var(--c-fg)" }}>Max open positions</strong> — caps how many open trades you can hold simultaneously on one account.</li>
          <li>Flip <em>Active</em> → <em>Disabled</em> to keep settings saved while pausing enforcement.</li>
        </ul>
      </div>
    </>
  )
}

function fmt(n: number, signed = false): string {
  const sign = signed && n > 0 ? "+" : ""
  return `${sign}${n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--c-fg-dim)", marginTop: 2 }}>{sub}</div>
    </div>
  )
}
