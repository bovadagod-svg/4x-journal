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
import { getAllRiskRules } from "@/lib/risk"
import type { AccountRiskCap } from "@/components/trades/log-trade-context"
import { PnLDisplayProvider } from "@/lib/pnl-display-context"
import type { PnLDisplayMode } from "@/lib/pnl-display"
import { MoneyProvider } from "@/lib/money-context"
import { parseFxRates } from "@/lib/money"
import { TimeZoneProvider } from "@/lib/timezone-context"
import { OnboardingModal } from "@/components/onboarding/onboarding-modal"
import { RealtimeTrades } from "@/components/shell/realtime-trades"
import { KeyboardShortcuts } from "@/components/shell/keyboard-shortcuts"
import { CommandPalette } from "@/components/shell/command-palette"

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

  const [{ data: row }, accounts, playbooks, newsContext, riskRules] = await Promise.all([
    supabase
      .from("user_settings")
      .select("theme, accent, density, empty_state, account_scope, sizing_method, default_risk_pct, default_fixed_lots, default_playbook_id, require_journal_note, require_journal_screenshot, require_journal_mood, confirm_above_pct, cap_by_prop_rule, pnl_display, display_currency, fx_rates, timezone, onboarded_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    getUserAccounts(),
    getUserPlaybooks(),
    getNewsAvoidanceContext(),
    getAllRiskRules(),
  ])

  // Build the per-account risk caps map for the modal. Only enabled rules
  // contribute caps; disabled rules are treated as "no cap" so flipping
  // Active → Disabled on the Risk page disables both enforcement and sizing
  // suggestion in one place.
  const accountRiskCaps: Record<string, AccountRiskCap> = {}
  for (const r of riskRules) {
    if (!r.enabled) continue
    accountRiskCaps[r.account_id] = {
      max_risk_per_trade_usd: r.max_risk_per_trade_usd != null ? Number(r.max_risk_per_trade_usd) : null,
      max_risk_per_trade_pct: r.max_risk_per_trade_pct != null ? Number(r.max_risk_per_trade_pct) : null,
    }
  }

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

  // #72 Active block_pair_side rules — checked client-side at submit by Log
  // Trade modal. Direct query against user_trade_rules (no helper yet).
  const { data: ruleRows } = await supabase
    .from("user_trade_rules")
    .select("kind, payload, reason, enabled")
    .eq("user_id", user.id)
    .eq("enabled", true)
  const tradeRules: TradeDefaults["trade_rules"] = []
  for (const r of ruleRows ?? []) {
    if (r.kind !== "block_pair_side") continue
    const p = (r.payload as { pair?: string; side?: string }) ?? {}
    if (typeof p.pair !== "string" || (p.side !== "long" && p.side !== "short")) continue
    tradeRules.push({ pair: p.pair.toUpperCase(), side: p.side, reason: r.reason })
  }

  const tradeDefaults: TradeDefaults = {
    sizing_method: (row?.sizing_method as TradeDefaults["sizing_method"]) ?? "fixed-risk",
    default_risk_pct: Number(row?.default_risk_pct ?? 0.5),
    default_fixed_lots: Number(row?.default_fixed_lots ?? 0.10),
    default_playbook_id: row?.default_playbook_id ?? null,
    require_journal_note: requireJournalNote,
    require_journal_mood: requireJournalMood,
    confirm_above_pct: Number(row?.confirm_above_pct ?? 1.0),
    cap_by_prop_rule: row?.cap_by_prop_rule ?? true,
    account_risk_caps: accountRiskCaps,
    news_avoidance: {
      enabled: newsContext.enabled,
      events: newsContext.events,
    },
    trade_rules: tradeRules,
  }

  const pnlDisplay = (row?.pnl_display as PnLDisplayMode | undefined) ?? "money"
  const displayCurrency = row?.display_currency ?? "USD"
  const fxRates = parseFxRates(row?.fx_rates)
  // Trades store UTC; we display in the user's chosen zone (default ET to match
  // the settings default) so wall-clock times read the same on every device.
  const displayTimeZone = row?.timezone ?? "America/New_York"

  // Show onboarding when the user hasn't completed it yet AND has no accounts.
  // We show even on subsequent page loads for new users until they finish or
  // explicitly skip — fixed bouncing-modal-on-every-page-load by gating on
  // onboarded_at, not session.
  const showOnboarding = !row?.onboarded_at && accounts.length === 0

  return (
    <TweaksProvider initial={initial} userId={user.id}>
     <TimeZoneProvider timeZone={displayTimeZone}>
     <MoneyProvider displayCurrency={displayCurrency} rates={fxRates}>
     <PnLDisplayProvider mode={pnlDisplay}>
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
              <RealtimeTrades userId={user.id} />
              <KeyboardShortcuts />
              <CommandPalette />
              {showOnboarding && <OnboardingModal />}
            </TradeDetailDrawerProvider>
          </JournalDrawerProvider>
        </LogTradeProvider>
      </AccountsProvider>
     </PnLDisplayProvider>
     </MoneyProvider>
     </TimeZoneProvider>
    </TweaksProvider>
  )
}
