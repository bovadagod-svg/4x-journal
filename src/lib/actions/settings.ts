"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"

type Update = Database["public"]["Tables"]["user_settings"]["Update"]

export type SettingsFormState = { ok: true } | { ok: false; error: string } | undefined

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { user, supabase }
}

async function applyPatch(patch: Update): Promise<SettingsFormState> {
  const { user, supabase } = await getUser()
  if (!user) return { ok: false, error: "Not signed in." }
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" })
  if (error) return { ok: false, error: error.message }
  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: true }
}

// ─── Profile ───────────────────────────────────────────────────────────────
const ProfileSchema = z.object({
  display_name: z.string().max(80).optional().nullable(),
  handle: z.string().max(40).optional().nullable(),
  timezone: z.string().min(1).max(60),
  display_currency: z.string().min(3).max(4),
})

export async function updateProfile(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const parsed = ProfileSchema.safeParse({
    display_name: formData.get("display_name") || null,
    handle: formData.get("handle") || null,
    timezone: formData.get("timezone"),
    display_currency: formData.get("display_currency"),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  return applyPatch(parsed.data as Update)
}

// ─── Notifications ─────────────────────────────────────────────────────────
const NotificationsSchema = z.object({
  notify_daily_dd: z.boolean(),
  notify_rules_violation: z.boolean(),
  notify_payout: z.boolean(),
  notify_weekly_report: z.boolean(),
  notify_news: z.boolean(),
  notify_coach: z.boolean(),
  email_digest: z.enum(["off", "daily", "weekly", "monthly"]),
})

export async function updateNotifications(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const parsed = NotificationsSchema.safeParse({
    notify_daily_dd: formData.get("notify_daily_dd") === "true",
    notify_rules_violation: formData.get("notify_rules_violation") === "true",
    notify_payout: formData.get("notify_payout") === "true",
    notify_weekly_report: formData.get("notify_weekly_report") === "true",
    notify_news: formData.get("notify_news") === "true",
    notify_coach: formData.get("notify_coach") === "true",
    email_digest: formData.get("email_digest"),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  return applyPatch(parsed.data as Update)
}

// ─── Trading defaults / position sizing ────────────────────────────────────
const TradingSchema = z.object({
  sizing_method: z.enum(["fixed-risk", "fixed-lots", "kelly", "volatility-scaled"]),
  default_risk_pct: z.coerce.number().min(0.01).max(10),
  default_fixed_lots: z.coerce.number().min(0.01).max(100),
  kelly_fraction: z.coerce.number().min(0.05).max(1),
  atr_multiplier: z.coerce.number().min(0.1).max(10),
  atr_period: z.coerce.number().int().min(1).max(200),
  round_lots_to: z.coerce.number().min(0.01).max(100),
  cap_by_prop_rule: z.boolean(),
  confirm_above_pct: z.coerce.number().min(0).max(100),
})

export async function updateTrading(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const parsed = TradingSchema.safeParse({
    sizing_method: formData.get("sizing_method"),
    default_risk_pct: formData.get("default_risk_pct"),
    default_fixed_lots: formData.get("default_fixed_lots"),
    kelly_fraction: formData.get("kelly_fraction"),
    atr_multiplier: formData.get("atr_multiplier"),
    atr_period: formData.get("atr_period"),
    round_lots_to: formData.get("round_lots_to"),
    cap_by_prop_rule: formData.get("cap_by_prop_rule") === "true",
    confirm_above_pct: formData.get("confirm_above_pct"),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  return applyPatch(parsed.data as Update)
}

// ─── Journal defaults ──────────────────────────────────────────────────────
const JournalSchema = z.object({
  require_journal_note: z.boolean(),
  require_journal_screenshot: z.boolean(),
  require_journal_mood: z.boolean(),
  journal_timezone_mode: z.enum(["broker", "local", "utc"]),
  default_playbook_id: z.string().uuid().nullable(),
})

export async function updateJournal(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const playbookRaw = formData.get("default_playbook_id")
  const parsed = JournalSchema.safeParse({
    require_journal_note: formData.get("require_journal_note") === "true",
    require_journal_screenshot: formData.get("require_journal_screenshot") === "true",
    require_journal_mood: formData.get("require_journal_mood") === "true",
    journal_timezone_mode: formData.get("journal_timezone_mode"),
    default_playbook_id: playbookRaw && typeof playbookRaw === "string" && playbookRaw.length > 0 ? playbookRaw : null,
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  return applyPatch(parsed.data as Update)
}

// ─── Tax ────────────────────────────────────────────────────────────────────
const TaxSchema = z.object({
  tax_jurisdiction: z.enum(["US", "UK", "CA", "AU", "SG", "AE", "OTHER"]),
  tax_fx_election: z.enum(["988", "1256"]),
  tax_fiscal_year_start: z.enum(["January", "April", "July", "October"]),
  tax_estimated_rate: z.coerce.number().min(0).max(1),
  tax_carry_losses: z.boolean(),
})

export async function updateTax(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const parsed = TaxSchema.safeParse({
    tax_jurisdiction: formData.get("tax_jurisdiction"),
    tax_fx_election: formData.get("tax_fx_election"),
    tax_fiscal_year_start: formData.get("tax_fiscal_year_start"),
    tax_estimated_rate: formData.get("tax_estimated_rate"),
    tax_carry_losses: formData.get("tax_carry_losses") === "true",
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  return applyPatch(parsed.data as Update)
}

// ─── Behavior rules (news avoidance + tilt protection) ────────────────────
const BehaviorSchema = z.object({
  news_avoidance_enabled: z.boolean(),
  news_avoidance_minutes_before: z.coerce.number().int().min(0).max(120),
  news_avoidance_minutes_after: z.coerce.number().int().min(0).max(120),
  tilt_enabled: z.boolean(),
  tilt_cutoff: z.coerce.number().int().min(2).max(10),
  tilt_cooldown_hours: z.coerce.number().int().min(1).max(48),
})

export async function updateBehavior(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const parsed = BehaviorSchema.safeParse({
    news_avoidance_enabled: formData.get("news_avoidance_enabled") === "true",
    news_avoidance_minutes_before: formData.get("news_avoidance_minutes_before"),
    news_avoidance_minutes_after: formData.get("news_avoidance_minutes_after"),
    tilt_enabled: formData.get("tilt_enabled") === "true",
    tilt_cutoff: formData.get("tilt_cutoff"),
    tilt_cooldown_hours: formData.get("tilt_cooldown_hours"),
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  return applyPatch(parsed.data as Update)
}

// ─── Webhook secret rotation ───────────────────────────────────────────────
export async function regenerateWebhookSecret() {
  const { user, supabase } = await getUser()
  if (!user) return { ok: false as const, error: "Not signed in." }
  const secret = `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`.slice(0, 48)
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, webhook_secret: secret }, { onConflict: "user_id" })
  if (error) return { ok: false as const, error: error.message }
  revalidatePath("/settings")
  return { ok: true as const, secret }
}

// ─── Danger zone ───────────────────────────────────────────────────────────
export async function resetAnalytics(): Promise<{ ok: boolean; error?: string }> {
  // No analytics cache to clear yet — derived live. Leave as no-op for parity.
  revalidatePath("/analytics")
  revalidatePath("/dashboard")
  return { ok: true }
}

export async function deleteAllJournalEntries(): Promise<{ ok: boolean; error?: string }> {
  const { user, supabase } = await getUser()
  if (!user) return { ok: false, error: "Not signed in." }
  const { error } = await supabase.from("journal_entries").delete().eq("user_id", user.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/journal")
  revalidatePath("/dashboard")
  return { ok: true }
}

/**
 * Wipe all workspace data — trades, fills, journal, playbooks, watchlist, accounts —
 * but keep the auth user and their preferences (theme/accent/timezone/etc).
 *
 * Order matters: child rows that reference parents must go first to avoid FK errors.
 * trade_fills, broker_connections, risk_rules cascade from trades/accounts so we
 * delete them explicitly to be safe (cascade rules can drift).
 */
export async function resetWorkspace(): Promise<{ ok: boolean; error?: string; tables?: Record<string, number | undefined> }> {
  const { user, supabase } = await getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const tables: Record<string, number | undefined> = {}
  const targets = [
    "trade_fills",       // refs trades
    "journal_entries",   // refs trades + accounts + playbooks
    "trades",            // refs accounts + playbooks
    "broker_connections",// refs accounts
    "risk_rules",        // refs accounts
    "watchlist_pairs",
    "playbooks",
    "accounts",
  ] as const

  for (const t of targets) {
    const { error, count } = await supabase
      .from(t)
      .delete({ count: "exact" })
      .eq("user_id", user.id)
    if (error) return { ok: false, error: `${t}: ${error.message}`, tables }
    tables[t] = count ?? 0
  }

  // Reset workspace-level user_settings fields that reference deleted data,
  // but keep theme/accent/density/timezone/etc.
  await supabase
    .from("user_settings")
    .update({
      account_scope: "all",
      default_playbook_id: null,
      empty_state: false,
    })
    .eq("user_id", user.id)

  revalidatePath("/", "layout")
  return { ok: true, tables }
}

export async function deleteAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from("user_settings").delete().eq("user_id", user.id)
  await supabase.from("watchlist_pairs").delete().eq("user_id", user.id)
  await supabase.from("playbooks").delete().eq("user_id", user.id)
  await supabase.from("trades").delete().eq("user_id", user.id)
  await supabase.from("journal_entries").delete().eq("user_id", user.id)
  await supabase.from("risk_rules").delete().eq("user_id", user.id)
  await supabase.from("accounts").delete().eq("user_id", user.id)
  await supabase.auth.signOut()
  redirect("/login")
}
