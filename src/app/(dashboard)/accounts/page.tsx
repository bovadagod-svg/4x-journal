import { SectionHeader } from "@/components/shell/section-header"
import { SECTION_META } from "@/lib/sections"
import { createClient } from "@/lib/supabase/server"
import { getUserAccounts } from "@/lib/queries/accounts"
import { AccountCard, AddAccountButton } from "@/components/accounts/account-card"

export default async function AccountsPage() {
  const m = SECTION_META.accounts
  const supabase = await createClient()
  const accounts = await getUserAccounts()

  // One round-trip for trade counts grouped by account.
  const { data: tradeRows } = await supabase
    .from("trades")
    .select("account_id")
  const tradeCounts = new Map<string, number>()
  ;(tradeRows ?? []).forEach((r) => {
    tradeCounts.set(r.account_id, (tradeCounts.get(r.account_id) ?? 0) + 1)
  })

  return (
    <>
      <SectionHeader title={m.title} subtitle={m.subtitle} actions={<AddAccountButton />} />

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 14,
      }}>
        {accounts.map((a) => (
          <AccountCard key={a.id} account={a} tradeCount={tradeCounts.get(a.id) ?? 0} />
        ))}
      </div>
    </>
  )
}
