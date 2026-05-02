"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const PlaybookSchema = z.object({
  name: z.string().min(1, { error: "Name required." }).max(60),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, { error: "Hex color required." }),
  notes: z.string().max(4000).nullish().or(z.literal("").transform(() => null)),
  target_r: z.coerce.number().nonnegative().nullish()
    .or(z.literal("").transform(() => null)),
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
      error: "Some fields need fixing.",
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
      error: "Some fields need fixing.",
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
