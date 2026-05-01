import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/shell/sidebar"
import { TopBar } from "@/components/shell/topbar"
import { TweaksPanel } from "@/components/shell/tweaks-panel"
import { TweaksProvider } from "@/lib/tweaks/tweaks-context"
import { TWEAK_DEFAULTS, type Tweaks } from "@/lib/tweaks/types"
import { LogTradeProvider } from "@/components/trades/log-trade-context"
import { getUserAccounts, getUserPlaybooks } from "@/lib/queries/accounts"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [{ data: row }, accounts, playbooks] = await Promise.all([
    supabase
      .from("user_settings")
      .select("theme, accent, density, empty_state, account_scope")
      .eq("user_id", user.id)
      .maybeSingle(),
    getUserAccounts(),
    getUserPlaybooks(),
  ])

  const initial: Tweaks = row
    ? {
        theme: row.theme as Tweaks["theme"],
        accent: row.accent as Tweaks["accent"],
        density: row.density as Tweaks["density"],
        emptyState: row.empty_state,
        accountScope: row.account_scope,
      }
    : TWEAK_DEFAULTS

  const defaultAccountId = accounts.find((a) => a.is_default)?.id ?? accounts[0]?.id ?? null

  return (
    <TweaksProvider initial={initial} userId={user.id}>
      <LogTradeProvider accounts={accounts} playbooks={playbooks} defaultAccountId={defaultAccountId}>
        <div className="app">
          <Sidebar userEmail={user.email ?? null} />
          <div className="main">
            <TopBar />
            <div className="content">{children}</div>
          </div>
        </div>
        <TweaksPanel />
      </LogTradeProvider>
    </TweaksProvider>
  )
}
