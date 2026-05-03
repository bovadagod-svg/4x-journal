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

// ─── Avatar ────────────────────────────────────────────────────────────────
const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

export type AvatarResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export async function uploadAvatar(formData: FormData): Promise<AvatarResult> {
  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, error: "No file provided." }
  if (file.size === 0) return { ok: false, error: "Empty file." }
  if (file.size > MAX_AVATAR_BYTES) return { ok: false, error: "Image must be ≤ 2 MB." }
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return { ok: false, error: "Use JPEG, PNG, WebP, or GIF." }
  }

  const { user, supabase } = await getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  // Path: <user_id>/avatar.<ext> — bucket policy keys off the first folder.
  // Same path each time so re-uploads overwrite, no orphans to clean up.
  const ext = file.type.split("/")[1].replace("jpeg", "jpg")
  const path = `${user.id}/avatar.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "60" })
  if (uploadErr) return { ok: false, error: uploadErr.message }

  // Public URL + cache-buster so the new image shows immediately on next render.
  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path)
  const url = `${pub.publicUrl}?v=${Date.now()}`

  const { error: settingsErr } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, avatar_url: url }, { onConflict: "user_id" })
  if (settingsErr) return { ok: false, error: settingsErr.message }

  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: true, url }
}

export async function removeAvatar(): Promise<AvatarResult> {
  const { user, supabase } = await getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  // Best-effort delete — we don't know the extension we used, so try all common ones.
  await supabase.storage
    .from("avatars")
    .remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.webp`, `${user.id}/avatar.gif`])

  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, avatar_url: null }, { onConflict: "user_id" })
  if (error) return { ok: false, error: error.message }

  revalidatePath("/settings")
  revalidatePath("/")
  return { ok: true, url: "" }
}

// ─── Email change ──────────────────────────────────────────────────────────
const EmailChangeSchema = z.object({
  email: z.email("Enter a valid email address."),
})

export type EmailChangeResult =
  | { ok: true; pending: true }   // confirmation email sent to new + old
  | { ok: false; error: string }

/**
 * Initiate an email change. Supabase sends a confirmation link to the *new*
 * address (and a notice to the old one). Until the user clicks through, the
 * sign-in email stays unchanged.
 */
export async function changeEmail(_prev: EmailChangeResult | undefined, formData: FormData): Promise<EmailChangeResult> {
  const parsed = EmailChangeSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email" }

  const { user, supabase } = await getUser()
  if (!user) return { ok: false, error: "Not signed in." }
  if (parsed.data.email.toLowerCase() === user.email?.toLowerCase()) {
    return { ok: false, error: "That's already your email." }
  }

  const { error } = await supabase.auth.updateUser({ email: parsed.data.email })
  if (error) return { ok: false, error: error.message }

  return { ok: true, pending: true }
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

// ─── FX rates ──────────────────────────────────────────────────────────────
const FxRatesSchema = z.object({
  rates: z.string(), // JSON-stringified map
})

export async function updateFxRates(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const parsed = FxRatesSchema.safeParse({ rates: formData.get("rates") })
  if (!parsed.success) return { ok: false, error: "Bad rates payload." }
  let rates: Record<string, number>
  try {
    const raw = JSON.parse(parsed.data.rates)
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, error: "Rates must be a JSON object." }
    }
    rates = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        return { ok: false, error: `Rate "${k}" must be a positive number.` }
      }
      if (!/^[A-Z]{3,4}->[A-Z]{3,4}$/.test(k)) {
        return { ok: false, error: `Bad key "${k}" — use FROM->TO format like USD->GBP.` }
      }
      rates[k] = v
    }
  } catch {
    return { ok: false, error: "Rates payload is not valid JSON." }
  }
  return applyPatch({ fx_rates: rates as Update["fx_rates"] })
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

// ─── Behavior rules (news avoidance + tilt protection + coach auto-tag) ──
const BehaviorSchema = z.object({
  news_avoidance_enabled: z.boolean(),
  news_avoidance_minutes_before: z.coerce.number().int().min(0).max(120),
  news_avoidance_minutes_after: z.coerce.number().int().min(0).max(120),
  tilt_enabled: z.boolean(),
  tilt_cutoff: z.coerce.number().int().min(2).max(10),
  tilt_cooldown_hours: z.coerce.number().int().min(1).max(48),
  coach_auto_tag: z.boolean(),
  coach_use_ai: z.boolean(),
})

export async function updateBehavior(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const parsed = BehaviorSchema.safeParse({
    news_avoidance_enabled: formData.get("news_avoidance_enabled") === "true",
    news_avoidance_minutes_before: formData.get("news_avoidance_minutes_before"),
    news_avoidance_minutes_after: formData.get("news_avoidance_minutes_after"),
    tilt_enabled: formData.get("tilt_enabled") === "true",
    tilt_cutoff: formData.get("tilt_cutoff"),
    tilt_cooldown_hours: formData.get("tilt_cooldown_hours"),
    coach_auto_tag: formData.get("coach_auto_tag") === "true",
    coach_use_ai: formData.get("coach_use_ai") === "true",
  })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  return applyPatch(parsed.data as Update)
}

// ─── Onboarding ────────────────────────────────────────────────────────────
/**
 * Mark the wizard as complete (or explicitly skipped). Layout reads
 * onboarded_at to decide whether to show the modal on next page load.
 */
export async function completeOnboarding(): Promise<{ ok: boolean; error?: string }> {
  const { user, supabase } = await getUser()
  if (!user) return { ok: false, error: "Not signed in." }
  const { error } = await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, onboarded_at: new Date().toISOString() }, { onConflict: "user_id" })
  if (error) return { ok: false, error: error.message }
  revalidatePath("/", "layout")
  return { ok: true }
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
