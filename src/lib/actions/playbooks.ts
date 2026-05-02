"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const splitLines = (s: unknown): string[] =>
  typeof s === "string" ? s.split("\n").map((x) => x.trim()).filter(Boolean) : []
const splitCsv = (s: unknown): string[] =>
  typeof s === "string" ? s.split(",").map((x) => x.trim()).filter(Boolean) : []

const PlaybookSchema = z.object({
  name: z.string().min(1, { error: "Name required." }).max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, { error: "Hex color required." }),
  icon: z.string().min(1).default("lightning"),
  status: z.enum(["active", "review", "draft"]).default("active"),
  description: z.string().max(400).nullish().or(z.literal("").transform(() => null)),
  pairs: z.preprocess(splitCsv, z.array(z.string()).default([])),
  sessions: z.preprocess(splitCsv, z.array(z.string()).default([])),
  timeframe: z.string().max(60).nullish().or(z.literal("").transform(() => null)),
  rules: z.preprocess(splitLines, z.array(z.string()).default([])),
  invalidations: z.preprocess(splitLines, z.array(z.string()).default([])),
  risk_per_trade_pct: z.coerce.number().min(0).max(100).nullish().or(z.literal("").transform(() => null)),
  target_r: z.coerce.number().nonnegative().nullish().or(z.literal("").transform(() => null)),
  notes: z.string().max(4000).nullish().or(z.literal("").transform(() => null)),
})

export type PlaybookFormState =
  | { ok: true; playbookId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }
  | undefined

export async function createPlaybook(
  _prev: PlaybookFormState,
  formData: FormData,
): Promise<PlaybookFormState> {
  const parsed = PlaybookSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields need fixing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  const { data, error } = await supabase
    .from("playbooks")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Failed to create playbook." }

  revalidatePath("/playbooks")
  revalidatePath("/dashboard")
  return { ok: true, playbookId: data.id }
}

const UpdateSchema = PlaybookSchema.partial().extend({ id: z.string().uuid() })

export async function updatePlaybook(
  _prev: PlaybookFormState,
  formData: FormData,
): Promise<PlaybookFormState> {
  const parsed = UpdateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Some fields need fixing.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }
  const { id, ...rest } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.from("playbooks").update(rest).eq("id", id)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/playbooks")
  return { ok: true, playbookId: id }
}

export async function deletePlaybook(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("playbooks").delete().eq("id", id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath("/playbooks")
  return { ok: true as const }
}
