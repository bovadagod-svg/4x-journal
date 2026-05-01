import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/shell/sidebar"
import { TopBar } from "@/components/shell/topbar"
import { TweaksPanel } from "@/components/shell/tweaks-panel"
import { TweaksProvider } from "@/lib/tweaks/tweaks-context"
import { TWEAK_DEFAULTS, type Tweaks } from "@/lib/tweaks/types"

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

  const { data: row } = await supabase
    .from("user_settings")
    .select("theme, accent, density, empty_state, account_scope")
    .eq("user_id", user.id)
    .maybeSingle()

  const initial: Tweaks = row
    ? {
        theme: row.theme as Tweaks["theme"],
        accent: row.accent as Tweaks["accent"],
        density: row.density as Tweaks["density"],
        emptyState: row.empty_state,
        accountScope: row.account_scope,
      }
    : TWEAK_DEFAULTS

  return (
    <TweaksProvider initial={initial} userId={user.id}>
      <div className="app">
        <Sidebar userEmail={user.email ?? null} />
        <div className="main">
          <TopBar />
          <div className="content">{children}</div>
        </div>
      </div>
      <TweaksPanel />
    </TweaksProvider>
  )
}
