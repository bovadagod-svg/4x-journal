"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const SaveSchema = z.object({
  id: z.string().uuid().optional(),
  trade_id: z.string().uuid().nullish().or(z.literal("").transform(() => null)),
  account_id: z.string().uuid().nullish().or(z.literal("").transform(() => null)),
  playbook_id: z.string().uuid().nullish().or(z.literal("").transform(() => null)),
  kind: z.enum(["trade", "idea", "session_plan", "cold_review", "session_recap"]).default("trade"),
  title: z.string().max(120).nullish().or(z.literal("").transform(() => null)),
  pre_trade: z.string().nullish(),
  post_trade: z.string().nullish(),
  cold_review: z.string().nullish(),
  lessons: z.string().nullish(),
  mood: z.string().max(40).nullish().or(z.literal("").transform(() => null)),
  rule_break: z.boolean().default(false),
  rule_break_tags: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  mistakes: z.array(z.string()).default([]),
})

type SaveInput = z.infer<typeof SaveSchema>

export type EntrySaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

/**
 * Idempotent entry save. Used by the autosave loop in EntryEditorDrawer.
 * Caller passes the full mutable state every time (cheap on the wire,
 * eliminates merge headaches).
 */
export async function saveJournalEntry(input: SaveInput): Promise<EntrySaveResult> {
  const parsed = SaveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid entry." }
  }
  const { id, ...rest } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  if (id) {
    const { error } = await supabase
      .from("journal_entries")
      .update(rest)
      .eq("id", id)
    if (error) return { ok: false, error: error.message }
    revalidatePath("/journal")
    revalidatePath("/dashboard")
    return { ok: true, id }
  }

  const { data, error } = await supabase
    .from("journal_entries")
    .insert({ ...rest, user_id: user.id })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" }
  revalidatePath("/journal")
  revalidatePath("/dashboard")
  return { ok: true, id: data.id }
}

/**
 * Click-from-ledger entry point: ensure an entry exists for this trade,
 * return its id. Drawer can then open against the id.
 */
export async function findOrCreateEntryForTrade(tradeId: string): Promise<EntrySaveResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: existing } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("trade_id", tradeId)
    .maybeSingle()
  if (existing) return { ok: true, id: existing.id }

  const { data: trade } = await supabase
    .from("trades")
    .select("account_id, playbook_id, mood, pair, side, opened_at")
    .eq("id", tradeId)
    .maybeSingle()
  if (!trade) return { ok: false, error: "Trade not found." }

  const { data, error } = await supabase
    .from("journal_entries")
    .insert({
      user_id: user.id,
      trade_id: tradeId,
      account_id: trade.account_id,
      playbook_id: trade.playbook_id,
      mood: trade.mood,
      kind: "trade",
      title: `${trade.pair} ${trade.side}`,
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create entry." }
  return { ok: true, id: data.id }
}

const NoteSchema = z.object({
  entryId: z.string().uuid(),
  text: z.string().min(1).max(2000),
})

export async function appendDuringTradeNote(input: z.infer<typeof NoteSchema>): Promise<EntrySaveResult> {
  const parsed = NoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Note text required." }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data: existing } = await supabase
    .from("journal_entries")
    .select("during_trade")
    .eq("id", parsed.data.entryId)
    .maybeSingle()
  if (!existing) return { ok: false, error: "Entry not found." }

  const current = Array.isArray(existing.during_trade) ? existing.during_trade : []
  const next = [
    ...current,
    {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      text: parsed.data.text,
    },
  ]

  const { error } = await supabase
    .from("journal_entries")
    .update({ during_trade: next })
    .eq("id", parsed.data.entryId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/journal")
  return { ok: true, id: parsed.data.entryId }
}

export async function removeDuringTradeNote(entryId: string, noteId: string): Promise<EntrySaveResult> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("journal_entries")
    .select("during_trade")
    .eq("id", entryId)
    .maybeSingle()
  if (!existing) return { ok: false, error: "Entry not found." }

  const current = Array.isArray(existing.during_trade) ? existing.during_trade : []
  const next = current.filter((n) => {
    if (typeof n !== "object" || n == null) return true
    return (n as { id?: string }).id !== noteId
  })

  const { error } = await supabase
    .from("journal_entries")
    .update({ during_trade: next })
    .eq("id", entryId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: entryId }
}

const ScreenshotSchema = z.object({
  entryId: z.string().uuid(),
  path: z.string().min(1),
  caption: z.string().max(160).nullish(),
})

export async function addScreenshot(input: z.infer<typeof ScreenshotSchema>): Promise<EntrySaveResult> {
  const parsed = ScreenshotSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid screenshot." }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("journal_entries")
    .select("screenshots")
    .eq("id", parsed.data.entryId)
    .maybeSingle()
  if (!existing) return { ok: false, error: "Entry not found." }

  const current = Array.isArray(existing.screenshots) ? existing.screenshots : []
  const next = [
    ...current,
    {
      id: crypto.randomUUID(),
      path: parsed.data.path,
      caption: parsed.data.caption ?? null,
      ts: new Date().toISOString(),
    },
  ]
  const { error } = await supabase
    .from("journal_entries")
    .update({ screenshots: next })
    .eq("id", parsed.data.entryId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: parsed.data.entryId }
}

export async function removeScreenshot(entryId: string, screenshotId: string): Promise<EntrySaveResult> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from("journal_entries")
    .select("screenshots")
    .eq("id", entryId)
    .maybeSingle()
  if (!existing) return { ok: false, error: "Entry not found." }

  const current = Array.isArray(existing.screenshots) ? existing.screenshots : []
  const target = current.find((s) => typeof s === "object" && s != null && (s as { id?: string }).id === screenshotId) as { path?: string } | undefined
  const next = current.filter((s) => {
    if (typeof s !== "object" || s == null) return true
    return (s as { id?: string }).id !== screenshotId
  })

  // Remove from storage too — best-effort.
  if (target?.path) {
    await supabase.storage.from("journal-screenshots").remove([target.path]).catch(() => {})
  }

  const { error } = await supabase
    .from("journal_entries")
    .update({ screenshots: next })
    .eq("id", entryId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: entryId }
}

export async function deleteJournalEntry(id: string): Promise<EntrySaveResult> {
  const supabase = await createClient()
  const { error } = await supabase.from("journal_entries").delete().eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/journal")
  revalidatePath("/dashboard")
  return { ok: true, id }
}

/**
 * Return a fresh copy of the entry for the drawer to load.
 */
export async function getJournalEntry(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null
  return data
}
