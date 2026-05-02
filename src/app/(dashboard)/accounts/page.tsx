import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { createClient } from "@/lib/supabase/server"
import { getUserAccounts, getAccountSparks } from "@/lib/queries/accounts"
import { AccountCard, AddAccountButton, type AccountConnection } from "@/components/accounts/account-card"
import { ConnectTradeLockerButton } from "@/components/accounts/connect-tradelocker"
import { AllocationBar } from "@/components/accounts/allocation-bar"
import { formatUSD } from "@/lib/finance"

export default async function AccountsPage() {
  const m = SECTION_META.accounts
  const supabase = await createClient()
  const accounts = await getUserAccounts()

  if (accounts.length === 0) {
    return (
      <>
        <SectionHeader
          title={m.title}
          subtitle={m.subtitle}
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              <ConnectTradeLockerButton />
              <AddAccountButton />
            </div>
          }
        />
        <SectionStub
          icon={m.icon}
          title="No accounts yet"
          description="Add your first account to start logging trades. You can connect a TradeLocker demo or live account, or just add a manual account and import trades by CSV."
        />
      </>
    )
  }

  // Trade counts grouped by account
  const { data: tradeRows } = await supabase.from("trades").select("account_id")
  const tradeCounts = new Map<string, number>()
  ;(tradeRows ?? []).forEach((r) => {
    tradeCounts.set(r.account_id, (tradeCounts.get(r.account_id) ?? 0) + 1)
  })

  // Broker connections
  const { data: connRows } = await supabase
    .from("broker_connections")
    .select("id, provider, account_id, last_synced_at, last_sync_status, last_sync_error, trades_synced")
  const connByAccount = new Map<string, AccountConnection>()
  ;(connRows ?? []).forEach((r) => {
    connByAccount.set(r.account_id, {
      id: r.id,
      provider: r.provider,
      last_synced_at: r.last_synced_at,
      last_sync_status: r.last_sync_status,
      last_sync_error: r.last_sync_error,
      trades_synced: r.trades_synced,
    })
  })

  // 7-day sparkline data
  const sparks = await getAccountSparks(accounts.map((a) => a.id))

  // Top KPIs
  const totalEquity = accounts.reduce((s, a) => s + Number(a.equity ?? 0), 0)
  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance ?? 0), 0)
  const totalOpenPnL = totalEquity - totalBalance
  const liveCount = accounts.filter((a) => a.status === "live" || a.status === "funded").length
  const fundedCount = accounts.filter((a) => a.status === "funded").length

  // 7-day net: sum across all sparks (current - 7d ago)
  const netSevenDay = accounts.reduce((s, a) => {
    const series = sparks.get(a.id) ?? []
    if (series.length < 2) return s
    return s + (series[series.length - 1] - series[0])
  }, 0)
  const netSevenDayPct = totalBalance > 0 ? (netSevenDay / (totalBalance - netSevenDay)) * 100 : 0

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle={`${accounts.length} account${accounts.length === 1 ? "" : "s"} · ${liveCount} live`}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <ConnectTradeLockerButton />
            <AddAccountButton />
          </div>
        }
      />

      {/* Top KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 10 }}>
        <div className="card" style={{ padding: "16px 18px", background: "linear-gradient(135deg, rgba(67, 18, 160, 0.18), rgba(67, 18, 160, 0))" }}>
          <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Equity</div>
          <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 2 }}>
            {formatUSD(totalEquity)}
          </div>
          <div className="tnum" style={{ fontSize: 12, color: netSevenDay >= 0 ? "var(--c-green-bright)" : "var(--c-red-bright)", marginTop: 2 }}>
            {netSevenDay >= 0 ? "▲" : "▼"} {formatUSD(netSevenDay, { signed: true })} ({netSevenDayPct >= 0 ? "+" : ""}{netSevenDayPct.toFixed(2)}%) <span style={{ color: "var(--c-fg-dim)" }}>· 7d</span>
          </div>
        </div>
        <Kpi
          label="Open P&L"
          value={Math.abs(totalOpenPnL) > 0.01 ? formatUSD(totalOpenPnL, { signed: true }) : "—"}
          sub="across all live positions"
          color={totalOpenPnL > 0 ? "var(--c-green-bright)" : totalOpenPnL < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)"}
        />
        <Kpi
          label="Funded Capital"
          value={formatUSD(accounts.filter((a) => a.status === "funded").reduce((s, a) => s + Number(a.balance ?? 0), 0))}
          sub={`${fundedCount} funded · ${accounts.filter((a) => a.status === "challenge").length} in challenge`}
        />
        <Kpi
          label="Connections"
          value={String(connByAccount.size)}
          sub={`${connByAccount.size} broker linked · ${accounts.length - connByAccount.size} manual`}
          color={connByAccount.size > 0 ? "var(--c-amber)" : "var(--c-fg-muted)"}
        />
      </div>

      {/* Capital allocation */}
      {accounts.length > 1 && <AllocationBar accounts={accounts} />}

      {/* Cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: 14,
      }}>
        {accounts.map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            tradeCount={tradeCounts.get(a.id) ?? 0}
            connection={connByAccount.get(a.id) ?? null}
            spark={sparks.get(a.id) ?? []}
          />
        ))}
      </div>
    </>
  )
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: color ?? "var(--c-fg)", marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--c-fg-dim)", marginTop: 2 }}>{sub}</div>
    </div>
  )
}
