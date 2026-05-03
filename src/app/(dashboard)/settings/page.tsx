import { headers } from "next/headers"
import { SectionHeader } from "@/components/shell/section-header"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { createClient } from "@/lib/supabase/server"
import { getUserPlaybooks } from "@/lib/queries/accounts"
import { SettingsShell, type SettingsTabId } from "@/components/settings/settings-shell"
import { ProfilePanel } from "@/components/settings/profile-panel"
import { AppearanceSection } from "@/components/settings/appearance-section"
import { NotificationsPanel } from "@/components/settings/notifications-panel"
import { TradingPanel } from "@/components/settings/trading-panel"
import { JournalPanel } from "@/components/settings/journal-panel"
import { TaxPanel } from "@/components/settings/tax-panel"
import { BehaviorPanel } from "@/components/settings/behavior-panel"
import { IntegrationsPanel } from "@/components/settings/integrations-panel"
import { DataPanel } from "@/components/settings/data-panel"
import { FxRatesPanel } from "@/components/settings/fx-rates-panel"
import { parseFxRates } from "@/lib/money"

const VALID_TABS: SettingsTabId[] = [
  "profile", "appearance", "notifications", "trading", "behavior",
  "journal", "tax", "fx_rates", "integrations", "data",
]

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const m = SECTION_META.settings
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const params = await searchParams
  const initialTab: SettingsTabId = VALID_TABS.includes(params.tab as SettingsTabId)
    ? (params.tab as SettingsTabId)
    : "profile"

  const [{ data: settings }, playbooks] = await Promise.all([
    supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    getUserPlaybooks(),
  ])

  // Defaults if no row yet (lazy-initialized on first save).
  const s = settings ?? null

  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("host") ?? "4x-journal.vercel.app"
  const baseUrl = `${proto}://${host}`

  const panels = {
    profile: (
      <ProfilePanel
        email={user.email ?? ""}
        userId={user.id}
        avatarUrl={s?.avatar_url ?? null}
        initial={{
          display_name: s?.display_name ?? null,
          handle: s?.handle ?? null,
          timezone: s?.timezone ?? "America/New_York",
          display_currency: s?.display_currency ?? "USD",
        }}
      />
    ),
    appearance: <AppearanceSection />,
    notifications: (
      <NotificationsPanel
        initial={{
          notify_daily_dd: s?.notify_daily_dd ?? true,
          notify_rules_violation: s?.notify_rules_violation ?? true,
          notify_payout: s?.notify_payout ?? true,
          notify_weekly_report: s?.notify_weekly_report ?? true,
          notify_news: s?.notify_news ?? false,
          notify_coach: s?.notify_coach ?? true,
          email_digest: s?.email_digest ?? "weekly",
        }}
      />
    ),
    trading: (
      <TradingPanel
        initial={{
          sizing_method: (s?.sizing_method as "fixed-risk" | "fixed-lots" | "kelly" | "volatility-scaled") ?? "fixed-risk",
          default_risk_pct: Number(s?.default_risk_pct ?? 0.5),
          default_fixed_lots: Number(s?.default_fixed_lots ?? 0.10),
          kelly_fraction: Number(s?.kelly_fraction ?? 0.25),
          atr_multiplier: Number(s?.atr_multiplier ?? 1.5),
          atr_period: Number(s?.atr_period ?? 14),
          round_lots_to: Number(s?.round_lots_to ?? 0.01),
          cap_by_prop_rule: s?.cap_by_prop_rule ?? true,
          confirm_above_pct: Number(s?.confirm_above_pct ?? 1.0),
        }}
      />
    ),
    behavior: (
      <BehaviorPanel
        initial={{
          news_avoidance_enabled: s?.news_avoidance_enabled ?? false,
          news_avoidance_minutes_before: Number(s?.news_avoidance_minutes_before ?? 5),
          news_avoidance_minutes_after: Number(s?.news_avoidance_minutes_after ?? 15),
          tilt_enabled: s?.tilt_enabled ?? false,
          tilt_cutoff: Number(s?.tilt_cutoff ?? 3),
          tilt_cooldown_hours: Number(s?.tilt_cooldown_hours ?? 4),
          coach_auto_tag: s?.coach_auto_tag ?? false,
          coach_use_ai: s?.coach_use_ai ?? true,
        }}
      />
    ),
    journal: (
      <JournalPanel
        initial={{
          require_journal_note: s?.require_journal_note ?? false,
          require_journal_screenshot: s?.require_journal_screenshot ?? false,
          require_journal_mood: s?.require_journal_mood ?? false,
          journal_timezone_mode: (s?.journal_timezone_mode as "broker" | "local" | "utc") ?? "local",
          default_playbook_id: s?.default_playbook_id ?? null,
        }}
        playbooks={playbooks}
      />
    ),
    tax: (
      <TaxPanel
        initial={{
          tax_jurisdiction: (s?.tax_jurisdiction as "US" | "UK" | "CA" | "AU" | "SG" | "AE" | "OTHER") ?? "US",
          tax_fx_election: (s?.tax_fx_election as "988" | "1256") ?? "988",
          tax_fiscal_year_start: (s?.tax_fiscal_year_start as "January" | "April" | "July" | "October") ?? "January",
          tax_estimated_rate: Number(s?.tax_estimated_rate ?? 0.32),
          tax_carry_losses: s?.tax_carry_losses ?? true,
        }}
      />
    ),
    integrations: (
      <IntegrationsPanel userId={user.id} secret={s?.webhook_secret ?? null} baseUrl={baseUrl} />
    ),
    fx_rates: (
      <FxRatesPanel
        initial={parseFxRates(s?.fx_rates)}
        displayCurrency={s?.display_currency ?? "USD"}
      />
    ),
    data: <DataPanel email={user.email ?? ""} />,
  }

  return (
    <>
      <SectionHeader
        title={m.title}
        subtitle="Workspace preferences, integrations, and account"
        actions={
          <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-green-bright)" }} />
            <Icon name="check" size={11} color="var(--c-green-bright)" />
            Auto-save on each section
          </span>
        }
      />

      <SettingsShell panels={panels} defaultTab={initialTab} />
    </>
  )
}
