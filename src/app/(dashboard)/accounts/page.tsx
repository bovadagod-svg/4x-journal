import { SectionHeader } from "@/components/shell/section-header"
import { SECTION_META } from "@/lib/sections"
import { createClient } from "@/lib/supabase/server"
import { getUserAccounts } from "@/lib/queries/accounts"
import { AccountCard, AddAccountButton, type AccountConnection } from "@/components/accounts/account-card"
import { ConnectTradeLockerButton } from "@/components/accounts/connect-tradelocker"

export default async function AccountsPage() {
  const m = SECTION_META.accounts
  const supabase = await createClient()
  const accounts = await getUserAccounts()

  // Trade counts grouped by account.
  const { data: tradeRows } = await supabase.from("trades").select("account_id")
  const tradeCounts = new Map<string, number>()
  ;(tradeRows ?? []).forEach((r) => {
    tradeCounts.set(r.account_id, (tradeCounts.get(r.account_id) ?? 0) + 1)
  })

  // Broker connections by account_id.
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

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 14,
      }}>
        {accounts.map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            tradeCount={tradeCounts.get(a.id) ?? 0}
            connection={connByAccount.get(a.id) ?? null}
          />
        ))}
      </div>
    </>
  )
}
