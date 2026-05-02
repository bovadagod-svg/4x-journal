import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/shell/sidebar"
import { TopBar } from "@/components/shell/topbar"
import { TweaksPanel } from "@/components/shell/tweaks-panel"
import { TweaksProvider } from "@/lib/tweaks/tweaks-context"
import { TWEAK_DEFAULTS, type Tweaks } from "@/lib/tweaks/types"
import { LogTradeProvider, type TradeDefaults } from "@/components/trades/log-trade-context"
import { AccountsProvider } from "@/components/accounts/accounts-context"
import { JournalDrawerProvider } from "@/components/journal/journal-drawer-context"
import { TradeDetailDrawerProvider } from "@/components/trades/trade-detail-drawer-context"
import { getUserAccounts, getUserPlaybooks } from "@/lib/queries/accounts"
import { getNewsAvoidanceContext } from "@/lib/queries/news-avoidance"

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

  const [{ data: row }, accounts, playbooks, newsContext] = await Promise.all([
    supabase
      .from("user_settings")
      .select("theme, accent, density, empty_state, account_scope, sizing_method, default_risk_pct, default_fixed_lots, default_playbook_id, require_journal_note, require_journal_screenshot, require_journal_mood, confirm_above_pct")
      .eq("user_id", user.id)
      .maybeSingle(),
    getUserAccounts(),
    getUserPlaybooks(),
    getNewsAvoidanceContext(),
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

  const requireJournalNote = row?.require_journal_note ?? false
  const requireJournalScreenshot = row?.require_journal_screenshot ?? false
  const requireJournalMood = row?.require_journal_mood ?? false

  const tradeDefaults: TradeDefaults = {
    sizing_method: (row?.sizing_method as TradeDefaults["sizing_method"]) ?? "fixed-risk",
    default_risk_pct: Number(row?.default_risk_pct ?? 0.5),
    default_fixed_lots: Number(row?.default_fixed_lots ?? 0.10),
    default_playbook_id: row?.default_playbook_id ?? null,
    require_journal_note: requireJournalNote,
    require_journal_mood: requireJournalMood,
    confirm_above_pct: Number(row?.confirm_above_pct ?? 1.0),
    news_avoidance: {
      enabled: newsContext.enabled,
      events: newsContext.events,
    },
  }

  return (
    <TweaksProvider initial={initial} userId={user.id}>
      <AccountsProvider accounts={accounts}>
        <LogTradeProvider playbooks={playbooks} defaults={tradeDefaults}>
          <JournalDrawerProvider
            requireJournalNote={requireJournalNote}
            requireJournalScreenshot={requireJournalScreenshot}
            requireJournalMood={requireJournalMood}
          >
            <TradeDetailDrawerProvider>
              <div className="app">
                <Sidebar userEmail={user.email ?? null} />
                <div className="main">
                  <TopBar />
                  <div className="content">{children}</div>
                </div>
              </div>
              <TweaksPanel />
            </TradeDetailDrawerProvider>
          </JournalDrawerProvider>
        </LogTradeProvider>
      </AccountsProvider>
    </TweaksProvider>
  )
}
