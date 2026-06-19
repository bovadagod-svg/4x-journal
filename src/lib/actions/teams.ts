"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

type Result = { ok: boolean; error?: string }

// Switching the active team or creating one changes what every page shows, so
// revalidate the whole authenticated tree.
function revalidateEverything() {
  revalidatePath("/", "layout")
}

export async function createTeam(name: string): Promise<{ ok: boolean; error?: string; teamId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }
  const clean = name.trim()
  if (!clean) return { ok: false, error: "Team name required." }
  if (clean.length > 80) return { ok: false, error: "Team name too long." }

  const { data, error } = await supabase.rpc("create_team", { p_name: clean })
  if (error) return { ok: false, error: error.message }
  const teamId = data as string
  await supabase.from("user_settings").upsert(
    { user_id: user.id, active_team_id: teamId }, { onConflict: "user_id" },
  )
  revalidateEverything()
  return { ok: true, teamId }
}

export async function setActiveTeam(teamId: string): Promise<Result> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }
  // Confirm membership before switching.
  const { count } = await supabase
    .from("team_members").select("*", { count: "exact", head: true })
    .eq("team_id", teamId).eq("user_id", user.id)
  if (!count) return { ok: false, error: "You are not a member of that team." }
  const { error } = await supabase.from("user_settings").upsert(
    { user_id: user.id, active_team_id: teamId }, { onConflict: "user_id" },
  )
  if (error) return { ok: false, error: error.message }
  revalidateEverything()
  return { ok: true }
}

export async function renameTeam(teamId: string, name: string): Promise<Result> {
  const supabase = await createClient()
  const clean = name.trim()
  if (!clean) return { ok: false, error: "Team name required." }
  // RLS restricts UPDATE on teams to admins.
  const { error } = await supabase.from("teams").update({ name: clean }).eq("id", teamId)
  if (error) return { ok: false, error: error.message }
  revalidateEverything()
  return { ok: true }
}

export async function inviteMember(
  teamId: string, email: string, role: "admin" | "member" = "member",
): Promise<Result> {
  const supabase = await createClient()
  const clean = email.trim()
  if (!clean) return { ok: false, error: "Email required." }
  const { error } = await supabase.rpc("add_team_member_by_email", {
    p_team_id: teamId, p_email: clean, p_role: role,
  })
  if (error) return { ok: false, error: error.message }
  // A new member changes attribution maps + owner pickers app-wide, not just
  // the Team settings page.
  revalidateEverything()
  return { ok: true }
}

export async function removeMember(teamId: string, userId: string): Promise<Result> {
  const supabase = await createClient()
  // Don't let the team lose its last owner.
  const { data: owners } = await supabase
    .from("team_members").select("user_id").eq("team_id", teamId).eq("role", "owner")
  if ((owners ?? []).length <= 1 && (owners ?? []).some((o) => o.user_id === userId)) {
    return { ok: false, error: "Can't remove the last owner. Assign another owner first." }
  }
  const { error } = await supabase
    .from("team_members").delete().eq("team_id", teamId).eq("user_id", userId)
  if (error) return { ok: false, error: error.message }
  revalidateEverything()
  return { ok: true }
}

export async function changeMemberRole(
  teamId: string, userId: string, role: "owner" | "admin" | "member",
): Promise<Result> {
  const supabase = await createClient()
  if (role !== "owner") {
    // Don't demote the last owner.
    const { data: owners } = await supabase
      .from("team_members").select("user_id").eq("team_id", teamId).eq("role", "owner")
    if ((owners ?? []).length <= 1 && (owners ?? []).some((o) => o.user_id === userId)) {
      return { ok: false, error: "Promote another owner before changing this one's role." }
    }
  }
  const { error } = await supabase
    .from("team_members").update({ role }).eq("team_id", teamId).eq("user_id", userId)
  if (error) return { ok: false, error: error.message }
  revalidateEverything()
  return { ok: true }
}
