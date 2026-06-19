"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import { SettingsSection } from "@/components/settings/settings-primitives"
import { inputStyle } from "@/components/settings/settings-primitives"
import {
  createTeam, renameTeam, setActiveTeam, inviteMember, removeMember, changeMemberRole,
} from "@/lib/actions/teams"
import type { TeamSummary, TeamMember, TeamRole } from "@/lib/queries/teams"

const ROLE_COLOR: Record<TeamRole, string> = {
  owner: "var(--c-purple-bright)",
  admin: "var(--c-green-bright)",
  member: "var(--c-fg-muted)",
}

export function TeamPanel({
  myTeams, activeTeam, members, currentUserId, currentRole,
}: {
  myTeams: TeamSummary[]
  activeTeam: TeamSummary | null
  members: TeamMember[]
  currentUserId: string
  currentRole: TeamRole
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isAdmin = currentRole === "owner" || currentRole === "admin"

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    opts?: { okMsg?: string; onOk?: () => void },
  ) => {
    setErr(null); setNotice(null)
    startTransition(async () => {
      const r = await fn()
      if (!r.ok) setErr(r.error ?? "Something went wrong.")
      else { if (opts?.okMsg) setNotice(opts.okMsg); opts?.onOk?.(); router.refresh() }
    })
  }

  // ── local form state ──
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(activeTeam?.name ?? "")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member")
  const [newTeamName, setNewTeamName] = useState("")
  const [creating, setCreating] = useState(false)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {(err || notice) && (
        <div style={{
          padding: "10px 14px", borderRadius: 10, fontSize: 12,
          background: err ? "var(--c-red-soft)" : "rgba(17, 196, 88, 0.08)",
          border: `1px solid ${err ? "rgba(190, 51, 61, 0.3)" : "rgba(17, 196, 88, 0.25)"}`,
          color: err ? "var(--c-red-bright)" : "var(--c-green-bright)",
        }}>
          {err ?? notice}
        </div>
      )}

      {/* Active team + switcher */}
      <SettingsSection icon="accounts" title="Your team" subtitle="The workspace whose data you're viewing. Everyone on a team shares its accounts, trades, journals, and playbooks.">
        {activeTeam ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {!renaming ? (
                <>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>{activeTeam.name}</span>
                  <span style={{ fontSize: 11, color: ROLE_COLOR[currentRole], textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    {currentRole}
                  </span>
                  {isAdmin && (
                    <button type="button" className="btn" style={{ padding: "4px 10px", fontSize: 11 }}
                      onClick={() => { setNameDraft(activeTeam.name); setRenaming(true) }}>
                      <Icon name="edit" size={11} /> Rename
                    </button>
                  )}
                </>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} style={{ ...inputStyle, minWidth: 200 }} autoFocus />
                  <button type="button" className="btn btn-primary" style={{ padding: "5px 12px", fontSize: 11 }} disabled={pending}
                    onClick={() => run(() => renameTeam(activeTeam.id, nameDraft), { okMsg: "Team renamed.", onOk: () => setRenaming(false) })}>
                    Save
                  </button>
                  <button type="button" className="btn" style={{ padding: "5px 12px", fontSize: 11 }} onClick={() => setRenaming(false)}>Cancel</button>
                </div>
              )}
            </div>

            {myTeams.length > 1 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "var(--c-fg-muted)", marginBottom: 6 }}>Switch active team</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {myTeams.map((t) => (
                    <button key={t.id} type="button" disabled={pending || t.id === activeTeam.id}
                      onClick={() => run(() => setActiveTeam(t.id))}
                      className="btn"
                      style={{
                        padding: "6px 12px", fontSize: 12,
                        borderColor: t.id === activeTeam.id ? "var(--c-purple-bright)" : undefined,
                        color: t.id === activeTeam.id ? "var(--c-fg)" : "var(--c-fg-muted)",
                      }}>
                      {t.id === activeTeam.id && <Icon name="check" size={11} color="var(--c-purple-bright)" />} {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--c-fg-muted)" }}>You're not on a team yet. Create one below.</div>
        )}
      </SettingsSection>

      {/* Members */}
      {activeTeam && (
        <SettingsSection icon="user" title="Members" subtitle={`${members.length} ${members.length === 1 ? "person" : "people"} on ${activeTeam.name}`}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {members.map((mbr, i) => {
              const isSelf = mbr.userId === currentUserId
              return (
                <div key={mbr.userId} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                  borderBottom: i === members.length - 1 ? "none" : "1px solid var(--c-border)",
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: "var(--c-bg-elev-3)", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 600, color: "var(--c-fg-muted)",
                  }}>
                    {mbr.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                      {mbr.displayName}{isSelf && <span style={{ color: "var(--c-fg-dim)", fontWeight: 400 }}> (you)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>{mbr.email}</div>
                  </div>

                  {isAdmin && !isSelf ? (
                    <select
                      value={mbr.role}
                      disabled={pending}
                      onChange={(e) => run(() => changeMemberRole(activeTeam.id, mbr.userId, e.target.value as TeamRole), { okMsg: "Role updated." })}
                      style={{ ...inputStyle, padding: "4px 8px", fontSize: 11 }}
                    >
                      <option value="owner">owner</option>
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: 11, color: ROLE_COLOR[mbr.role], textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                      {mbr.role}
                    </span>
                  )}

                  {isAdmin && !isSelf && (
                    <button type="button" className="btn" disabled={pending}
                      onClick={() => { if (confirm(`Remove ${mbr.displayName} from ${activeTeam.name}?`)) run(() => removeMember(activeTeam.id, mbr.userId), { okMsg: "Member removed." }) }}
                      style={{ padding: "4px 8px", fontSize: 11, color: "var(--c-red-bright)", borderColor: "rgba(190, 51, 61, 0.3)" }}>
                      <Icon name="x" size={11} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Invite */}
          {isAdmin && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--c-border)" }}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Add a teammate</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="email" placeholder="teammate@email.com" value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "member")} style={{ ...inputStyle, padding: "7px 8px" }}>
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
                <button type="button" className="btn btn-primary" disabled={pending || !inviteEmail.trim()} style={{ padding: "7px 14px", fontSize: 12 }}
                  onClick={() => run(() => inviteMember(activeTeam.id, inviteEmail, inviteRole), { okMsg: "Member added.", onOk: () => setInviteEmail("") })}>
                  Add
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--c-fg-muted)", marginTop: 6 }}>
                They must already have a 4x Journal account (same email they signed up with). Sharing is instant once added.
              </div>
            </div>
          )}
        </SettingsSection>
      )}

      {/* Create new team */}
      <SettingsSection icon="sparkle" title="Create a team" subtitle="Start a separate shared workspace. You'll be its owner.">
        {!creating ? (
          <button type="button" className="btn" style={{ padding: "7px 14px", fontSize: 12 }} onClick={() => setCreating(true)}>
            <Icon name="plus" size={12} /> New team
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="Team name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} style={{ ...inputStyle, minWidth: 220 }} autoFocus />
            <button type="button" className="btn btn-primary" disabled={pending || !newTeamName.trim()} style={{ padding: "7px 14px", fontSize: 12 }}
              onClick={() => run(() => createTeam(newTeamName), { okMsg: "Team created.", onOk: () => { setNewTeamName(""); setCreating(false) } })}>
              Create
            </button>
            <button type="button" className="btn" style={{ padding: "7px 14px", fontSize: 12 }} onClick={() => setCreating(false)}>Cancel</button>
          </div>
        )}
      </SettingsSection>
    </div>
  )
}
