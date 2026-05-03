"use client"

import { useActionState, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"
import {
  changeEmail,
  removeAvatar,
  updateProfile,
  uploadAvatar,
  type EmailChangeResult,
  type SettingsFormState,
} from "@/lib/actions/settings"
import { SettingsSection, SettingsRow, SaveBar, useDirty, inputStyle } from "./settings-primitives"

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Europe/Paris",
  "Asia/Tokyo", "Asia/Singapore", "Asia/Hong_Kong", "Asia/Dubai",
  "Australia/Sydney",
  "UTC",
]

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD"]

export function ProfilePanel({
  email, userId, initial, avatarUrl,
}: {
  email: string
  userId: string
  initial: { display_name: string | null; handle: string | null; timezone: string; display_currency: string }
  avatarUrl: string | null
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(updateProfile, undefined)
  const [emailState, emailAction, emailPending] = useActionState<EmailChangeResult | undefined, FormData>(changeEmail, undefined)
  const tracker = useDirty(initial)
  const [savedFlash, setSavedFlash] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(avatarUrl)
  const [avatarBusy, startAvatar] = useTransition()
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (state?.ok) {
      setSavedFlash(true)
      const t = setTimeout(() => setSavedFlash(false), 1800)
      router.refresh()
      return () => clearTimeout(t)
    }
  }, [state, router])

  const set = <K extends keyof typeof tracker.current>(key: K, value: (typeof tracker.current)[K]) =>
    tracker.set({ ...tracker.current, [key]: value })

  const initials = (tracker.current.display_name?.trim() || email.split("@")[0])
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SaveBar
        dirty={tracker.dirty}
        pending={pending}
        savedFlash={savedFlash}
        error={state && !state.ok ? state.error : undefined}
        onReset={tracker.reset}
      />

      <SettingsSection icon="user" title="Profile" subtitle="How you show up in 4x Journal">
        {/* Avatar header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 0 16px", borderBottom: "1px solid var(--c-border)", marginBottom: 8 }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt="Avatar"
              style={{
                width: 60, height: 60, borderRadius: "50%",
                objectFit: "cover",
                border: "1px solid var(--c-border)",
              }}
            />
          ) : (
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: "linear-gradient(135deg, #6932D4, #B79CFF)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 600, color: "#fff", fontFamily: "var(--font-display)",
            }}>{initials || "?"}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>
              {tracker.current.display_name || email.split("@")[0]}
            </div>
            <div style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>
              {tracker.current.handle ? `@${tracker.current.handle.replace(/^@/, "")}` : email} · Free plan
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 2 }}>
              {userId}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0]
                  if (!file) return
                  setAvatarError(null)
                  const fd = new FormData()
                  fd.set("file", file)
                  startAvatar(async () => {
                    const r = await uploadAvatar(fd)
                    if (r.ok) {
                      setAvatar(r.url)
                      router.refresh()
                    } else {
                      setAvatarError(r.error)
                    }
                  })
                  // Reset so re-uploading the same file fires onChange.
                  e.currentTarget.value = ""
                }}
              />
              <button
                type="button"
                className="btn"
                disabled={avatarBusy}
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: 11, padding: "4px 10px" }}
              >
                <Icon name="external" size={11} />
                <span>{avatarBusy ? "Uploading…" : avatar ? "Replace" : "Upload"}</span>
              </button>
              {avatar && (
                <button
                  type="button"
                  className="btn"
                  disabled={avatarBusy}
                  onClick={() => {
                    setAvatarError(null)
                    startAvatar(async () => {
                      const r = await removeAvatar()
                      if (r.ok) { setAvatar(null); router.refresh() }
                      else setAvatarError(r.error)
                    })
                  }}
                  style={{ fontSize: 11, padding: "4px 10px" }}
                >
                  <Icon name="x" size={11} />
                  <span>Remove</span>
                </button>
              )}
            </div>
            {avatarError && (
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--c-red-bright)" }}>{avatarError}</div>
            )}
          </div>
        </div>

        <SettingsRow label="Display name" hint="Shown next to journal entries you share">
          <input
            name="display_name"
            value={tracker.current.display_name ?? ""}
            onChange={(e) => set("display_name", e.target.value)}
            placeholder={email.split("@")[0]}
            style={{ ...inputStyle, width: 260 }}
          />
        </SettingsRow>
        <SettingsRow label="Username" hint="For shareable journal links (alphanumeric + dashes)">
          <input
            name="handle"
            value={tracker.current.handle ?? ""}
            onChange={(e) => set("handle", e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
            placeholder="your-handle"
            style={{ ...inputStyle, width: 220, fontFamily: "var(--font-mono)" }}
          />
        </SettingsRow>
        <SettingsRow
          label="Email"
          hint={
            emailState?.ok && emailState.pending
              ? "Confirmation link sent — click it from the new inbox to switch."
              : "Sign-in email. Confirmation goes to the new address before the change applies."
          }
        >
          <EmailChangeForm
            current={email}
            action={emailAction}
            pending={emailPending}
            error={emailState && !emailState.ok ? emailState.error : undefined}
            sent={!!(emailState?.ok && emailState.pending)}
          />
        </SettingsRow>
        <SettingsRow label="Timezone" hint="All session times and economic calendar use this">
          <select name="timezone" value={tracker.current.timezone} onChange={(e) => set("timezone", e.target.value)} style={{ ...inputStyle, width: 220, cursor: "pointer" }}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </SettingsRow>
        <SettingsRow label="Display currency" hint="P&L conversion across mixed-currency accounts" last>
          <select name="display_currency" value={tracker.current.display_currency} onChange={(e) => set("display_currency", e.target.value)} style={{ ...inputStyle, width: 110, cursor: "pointer" }}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </SettingsRow>
      </SettingsSection>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="btn">
            <Icon name="external" size={12} />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </form>
  )
}

function EmailChangeForm({
  current, action, pending, error, sent,
}: {
  current: string
  action: (formData: FormData) => void
  pending: boolean
  error?: string
  sent: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  if (sent) {
    return (
      <span style={{ fontSize: 12, color: "var(--c-green-bright)" }}>
        Confirmation email sent. Click the link from the new inbox.
      </span>
    )
  }

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="mono" style={{ fontSize: 12.5, color: "var(--c-fg-muted)" }}>{current}</span>
        <button
          type="button"
          className="btn"
          onClick={() => { setDraft(""); setEditing(true) }}
          style={{ fontSize: 11, padding: "3px 8px" }}
        >
          <Icon name="edit" size={10} />
          <span>Change</span>
        </button>
      </div>
    )
  }

  return (
    <form
      action={action}
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input
          name="email"
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="new-email@example.com"
          required
          style={{ ...inputStyle, width: 240 }}
        />
        <button type="submit" className="btn btn-primary" disabled={pending} style={{ fontSize: 11 }}>
          {pending ? "Sending…" : "Send confirmation"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setEditing(false)}
          style={{ fontSize: 11 }}
        >
          Cancel
        </button>
      </div>
      {error && (
        <div style={{ fontSize: 11, color: "var(--c-red-bright)" }}>{error}</div>
      )}
    </form>
  )
}
