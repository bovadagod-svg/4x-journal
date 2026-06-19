import "server-only"
import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

export type TeamRole = "owner" | "admin" | "member"
export type TeamSummary = { id: string; name: string; role: TeamRole }
export type TeamMember = {
  userId: string
  email: string
  displayName: string
  role: TeamRole
  joinedAt: string
}

/** Teams the signed-in user belongs to. */
export const getMyTeams = cache(async (): Promise<TeamSummary[]> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from("team_members")
    .select("role, teams(id, name)")
    .eq("user_id", user.id)
  const rows = (data ?? []) as unknown as Array<{
    role: string
    teams: { id: string; name: string } | null
  }>
  return rows
    .filter((r) => r.teams)
    .map((r) => ({ id: r.teams!.id, name: r.teams!.name, role: r.role as TeamRole }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

/** The user's active team (settings choice → else first membership). */
export const getActiveTeam = cache(async (): Promise<TeamSummary | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const teams = await getMyTeams()
  if (teams.length === 0) return null
  const { data: settings } = await supabase
    .from("user_settings").select("active_team_id").eq("user_id", user.id).maybeSingle()
  return teams.find((t) => t.id === settings?.active_team_id) ?? teams[0]
})

/** Members of a team (email + display name), via the membership-guarded RPC. */
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_team_members", { p_team_id: teamId })
  if (error || !data) return []
  return (data as Array<{
    user_id: string; email: string; display_name: string; role: string; joined_at: string
  }>).map((m) => ({
    userId: m.user_id,
    email: m.email,
    displayName: m.display_name,
    role: m.role as TeamRole,
    joinedAt: m.joined_at,
  }))
}

/** user_id → display name for the active team, for "logged by" attribution. */
export const getTeamMemberMap = cache(async (): Promise<Record<string, string>> => {
  const active = await getActiveTeam()
  if (!active) return {}
  const members = await getTeamMembers(active.id)
  const map: Record<string, string> = {}
  for (const m of members) map[m.userId] = m.displayName
  return map
})
