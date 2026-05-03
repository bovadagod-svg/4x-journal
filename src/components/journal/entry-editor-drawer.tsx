"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Icon, PairFlag } from "@/components/icons"
import {
  appendDuringTradeNote,
  deleteJournalEntry,
  generateShareToken,
  getJournalEntry,
  removeDuringTradeNote,
  revokeShareToken,
  saveJournalEntry,
} from "@/lib/actions/journal-entries"
import { suggestEntryTags, type CoachTagSuggestion } from "@/lib/actions/coach-tag"
import { ScreenshotsTab } from "./screenshots-tab"

type EntryRow = Awaited<ReturnType<typeof getJournalEntry>>

type DuringNote = { id: string; ts: string; text: string }
type Screenshot = { id: string; path: string; caption: string | null; ts: string }

const TABS = [
  { id: "pre",  label: "Pre-trade",   icon: "edit"      as const },
  { id: "live", label: "Live notes",  icon: "lightning" as const },
  { id: "post", label: "Post-trade",  icon: "check"     as const },
  { id: "cold", label: "Cold review", icon: "watchlist" as const },
  { id: "shots",label: "Screenshots", icon: "external"  as const },
  { id: "tags", label: "Tags",        icon: "filter"    as const },
] as const

type TabId = typeof TABS[number]["id"]

const SAVE_DEBOUNCE_MS = 800

export function EntryEditorDrawer({
  entryId,
  onClose,
  requireJournalNote = false,
  requireJournalScreenshot = false,
  requireJournalMood = false,
}: {
  entryId: string | null
  onClose: () => void
  requireJournalNote?: boolean
  requireJournalScreenshot?: boolean
  requireJournalMood?: boolean
}) {
  const [entry, setEntry] = useState<EntryRow | null>(null)
  const [tab, setTab] = useState<TabId>("pre")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  // Local mutable state (autosaved)
  const [title, setTitle] = useState("")
  const [mood, setMood] = useState<string | null>(null)
  const [preTrade, setPreTrade] = useState("")
  const [postTrade, setPostTrade] = useState("")
  const [coldReview, setColdReview] = useState("")
  const [lessons, setLessons] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [mistakes, setMistakes] = useState<string[]>([])
  const [ruleBreak, setRuleBreak] = useState(false)
  const [ruleBreakTags, setRuleBreakTags] = useState<string[]>([])
  const [isPublic, setIsPublic] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [copyHint, setCopyHint] = useState<"idle" | "copied">("idle")
  const [coachSuggesting, setCoachSuggesting] = useState(false)
  const [coachSuggestion, setCoachSuggestion] = useState<CoachTagSuggestion | null>(null)
  const [coachError, setCoachError] = useState<string | null>(null)

  // Live (during-trade) notes — server-managed, not autosaved
  const [during, setDuring] = useState<DuringNote[]>([])
  const [newNote, setNewNote] = useState("")

  // Screenshots — server-managed
  const [shots, setShots] = useState<Screenshot[]>([])

  const loadedFor = useRef<string | null>(null)
  const dirtyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load entry when drawer opens
  useEffect(() => {
    if (!entryId) {
      setEntry(null); loadedFor.current = null
      return
    }
    if (loadedFor.current === entryId) return
    loadedFor.current = entryId

    void (async () => {
      const e = await getJournalEntry(entryId)
      if (!e) return
      setEntry(e)
      setTitle(e.title ?? "")
      setMood(e.mood ?? null)
      setPreTrade(e.pre_trade ?? "")
      setPostTrade(e.post_trade ?? "")
      setColdReview(e.cold_review ?? "")
      setLessons(e.lessons ?? "")
      setTags(e.tags ?? [])
      setMistakes(e.mistakes ?? [])
      setRuleBreak(!!e.rule_break)
      setRuleBreakTags(e.rule_break_tags ?? [])
      setIsPublic(!!e.is_public)
      setShareToken(e.share_token ?? null)
      setDuring(Array.isArray(e.during_trade) ? (e.during_trade as DuringNote[]) : [])
      setShots(Array.isArray(e.screenshots) ? (e.screenshots as Screenshot[]) : [])
      setTab("pre")
    })()
  }, [entryId])


  // Autosave debounced — fires when any of the autosaved fields change.
  const dirtyKey = useMemo(() => JSON.stringify({
    title, mood, preTrade, postTrade, coldReview, lessons, tags, mistakes, ruleBreak, ruleBreakTags, isPublic,
  }), [title, mood, preTrade, postTrade, coldReview, lessons, tags, mistakes, ruleBreak, ruleBreakTags, isPublic])

  useEffect(() => {
    if (!entry) return
    if (dirtyTimer.current) clearTimeout(dirtyTimer.current)
    setSaveStatus("saving")
    dirtyTimer.current = setTimeout(async () => {
      const r = await saveJournalEntry({
        id: entry.id,
        trade_id: entry.trade_id,
        account_id: entry.account_id,
        playbook_id: entry.playbook_id,
        kind: (entry.kind as "trade" | "idea" | "session_plan" | "cold_review" | "session_recap"),
        title,
        pre_trade: preTrade,
        post_trade: postTrade,
        cold_review: coldReview,
        lessons,
        mood,
        rule_break: ruleBreak,
        rule_break_tags: ruleBreakTags,
        is_public: isPublic,
        tags,
        mistakes,
      })
      setSaveStatus(r.ok ? "saved" : "error")
    }, SAVE_DEBOUNCE_MS)
    return () => { if (dirtyTimer.current) clearTimeout(dirtyTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyKey])

  const onAddNote = useCallback(async () => {
    if (!entry || !newNote.trim()) return
    const text = newNote.trim()
    setNewNote("")
    const tempId = `tmp-${Date.now()}`
    setDuring((arr) => [...arr, { id: tempId, ts: new Date().toISOString(), text }])
    const r = await appendDuringTradeNote({ entryId: entry.id, text })
    if (!r.ok) {
      alert(r.error)
      setDuring((arr) => arr.filter((n) => n.id !== tempId))
    } else {
      const fresh = await getJournalEntry(entry.id)
      if (fresh) setDuring(Array.isArray(fresh.during_trade) ? (fresh.during_trade as DuringNote[]) : [])
    }
  }, [entry, newNote])

  const onRemoveNote = useCallback(async (noteId: string) => {
    if (!entry) return
    setDuring((arr) => arr.filter((n) => n.id !== noteId))
    await removeDuringTradeNote(entry.id, noteId)
  }, [entry])

  const onDelete = useCallback(async () => {
    if (!entry) return
    if (!confirm("Delete this journal entry? Trade stays in the ledger.")) return
    const r = await deleteJournalEntry(entry.id)
    if (r.ok) onClose()
    else alert(r.error)
  }, [entry, onClose])

  const handleClose = useCallback(() => {
    if (entry?.kind === "trade") {
      const missing: string[] = []
      if (requireJournalNote && preTrade.trim().length === 0) missing.push("pre-trade notes")
      if (requireJournalScreenshot && shots.length === 0) missing.push("a chart screenshot")
      if (requireJournalMood && !mood) missing.push("a mood tag")
      if (missing.length > 0) {
        const list = missing.length === 1
          ? missing[0]
          : missing.length === 2
            ? `${missing[0]} and ${missing[1]}`
            : `${missing.slice(0, -1).join(", ")}, and ${missing[missing.length - 1]}`
        if (!confirm(`Your settings require ${list}. Close anyway?`)) return
      }
    }
    onClose()
  }, [requireJournalNote, requireJournalScreenshot, requireJournalMood, entry, preTrade, shots.length, mood, onClose])

  useEffect(() => {
    if (!entryId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [entryId, handleClose])

  if (!entryId) return null
  if (!entry) {
    return (
      <DrawerShell onClose={handleClose}>
        <div style={{ padding: 24, color: "var(--c-fg-muted)" }}>Loading…</div>
      </DrawerShell>
    )
  }

  return (
    <DrawerShell onClose={handleClose}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid var(--c-border)" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--c-bg-elev-3)",
          display: "grid", placeItems: "center",
          color: "var(--c-fg-muted)",
          flexShrink: 0,
        }}>
          <Icon name="journal" size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled entry"
            style={{
              width: "100%",
              fontFamily: "var(--font-display)",
              fontSize: 16, fontWeight: 600,
              background: "transparent",
              border: "none", outline: "none",
              color: "var(--c-fg)",
            }}
          />
          <div style={{ fontSize: 11, color: "var(--c-fg-dim)" }}>
            {entry.trade_id ? "Linked to trade · " : ""}{new Date(entry.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            {" · "}<SaveStatusPill status={saveStatus} />
          </div>
        </div>
        <button onClick={handleClose} aria-label="Close" style={iconBtn}>
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* Tab nav */}
      <div style={{
        display: "flex", gap: 2,
        padding: "10px 12px",
        borderBottom: "1px solid var(--c-border)",
        overflowX: "auto",
      }}>
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                border: "none",
                background: active ? "var(--c-bg-elev-3)" : "transparent",
                color: active ? "var(--c-fg)" : "var(--c-fg-muted)",
                fontSize: 12, fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <Icon name={t.icon} size={12} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab body */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {tab === "pre" && (
          <Field label="Pre-trade thinking" hint="Why are you in? What's the thesis? What invalidates it?">
            <textarea
              value={preTrade}
              onChange={(e) => setPreTrade(e.target.value)}
              rows={14}
              placeholder="Write freely…"
              style={textareaStyle}
            />
          </Field>
        )}

        {tab === "live" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Live notes" hint="Timestamped while the position is open. Each note is a snapshot of mind state.">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {during.length === 0 && (
                  <div style={{ color: "var(--c-fg-muted)", fontSize: 12.5, padding: "8px 0" }}>
                    No notes yet. Add one below.
                  </div>
                )}
                {during.map((n) => (
                  <div key={n.id} style={{
                    background: "var(--c-bg-elev-2)",
                    border: "1px solid var(--c-border)",
                    borderRadius: 10,
                    padding: 10,
                    display: "flex", gap: 10,
                  }}>
                    <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {new Date(n.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.text}</span>
                    <button onClick={() => onRemoveNote(n.id)} style={{ ...iconBtn, width: 24, height: 24 }} title="Remove">
                      <Icon name="x" size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </Field>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void onAddNote() }
                }}
                rows={3}
                placeholder="What's happening right now? (⌘↩ to add)"
                style={{ ...textareaStyle, minHeight: 60, flex: 1 }}
              />
              <button onClick={onAddNote} className="btn btn-primary" disabled={!newNote.trim()}>
                <Icon name="plus" size={12} /> <span>Add</span>
              </button>
            </div>
          </div>
        )}

        {tab === "post" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Post-trade review" hint="What actually happened? What surprised you?">
              <textarea
                value={postTrade}
                onChange={(e) => setPostTrade(e.target.value)}
                rows={8}
                placeholder="Hindsight is 20/20 — write while it's fresh."
                style={textareaStyle}
              />
            </Field>
            <Field label="Lessons">
              <textarea
                value={lessons}
                onChange={(e) => setLessons(e.target.value)}
                rows={4}
                placeholder="One thing to do differently next time."
                style={textareaStyle}
              />
            </Field>
            <Field label="Mistakes" hint="Comma-separated tags.">
              <ChipInput
                value={mistakes}
                onChange={setMistakes}
                placeholder="entered too late, moved stop, oversized…"
              />
            </Field>
            <Field label="Rule break?">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => setRuleBreak((v) => !v)}
                  className="btn"
                  style={{
                    background: ruleBreak ? "var(--c-red-soft)" : "var(--c-bg-elev-3)",
                    color: ruleBreak ? "var(--c-red-bright)" : "var(--c-fg-muted)",
                    borderColor: ruleBreak ? "rgba(224,74,85,0.35)" : "var(--c-border)",
                  }}
                >
                  <Icon name={ruleBreak ? "x" : "check"} size={11} />
                  <span>{ruleBreak ? "Yes — broke rules" : "No — followed rules"}</span>
                </button>
              </div>
              {ruleBreak && (
                <div style={{ marginTop: 10 }}>
                  <ChipInput
                    value={ruleBreakTags}
                    onChange={setRuleBreakTags}
                    placeholder="tilt, fomo, revenge, no plan…"
                  />
                </div>
              )}
            </Field>
            <Field
              label="Share publicly"
              hint="Makes this entry visible at /u/your-handle. Set your handle in Settings → Profile."
            >
              <button
                onClick={() => setIsPublic((v) => !v)}
                className="btn"
                style={{
                  background: isPublic ? "var(--c-green-soft, rgba(17, 196, 88, 0.08))" : "var(--c-bg-elev-3)",
                  color: isPublic ? "var(--c-green-bright)" : "var(--c-fg-muted)",
                  borderColor: isPublic ? "rgba(17, 196, 88, 0.35)" : "var(--c-border)",
                }}
              >
                <Icon name={isPublic ? "check" : "x"} size={11} />
                <span>{isPublic ? "Public — visible at /u/<your-handle>" : "Private (default)"}</span>
              </button>
            </Field>
            <Field
              label="Private share link"
              hint="One-shot URL for sending this entry to a coach without making it public. The link itself is the access control — anyone with it can read."
            >
              <ShareLinkField
                entryId={entry?.id ?? null}
                token={shareToken}
                busy={shareBusy}
                copyHint={copyHint}
                onGenerate={async () => {
                  if (!entry) return
                  setShareBusy(true)
                  const r = await generateShareToken(entry.id)
                  setShareBusy(false)
                  if (r.ok) setShareToken(r.token)
                  else alert(r.error)
                }}
                onRevoke={async () => {
                  if (!entry) return
                  if (!confirm("Revoke the share link? Anyone holding it loses access immediately.")) return
                  setShareBusy(true)
                  const r = await revokeShareToken(entry.id)
                  setShareBusy(false)
                  if (r.ok) setShareToken(null)
                  else alert(r.error)
                }}
                onCopy={async () => {
                  if (!shareToken) return
                  const url = `${window.location.origin}/share/${shareToken}`
                  await navigator.clipboard.writeText(url)
                  setCopyHint("copied")
                  setTimeout(() => setCopyHint("idle"), 2000)
                }}
              />
            </Field>
          </div>
        )}

        {tab === "cold" && (
          <Field label="Cold review" hint="Come back to this entry a few days or weeks later. Different headspace; different lessons.">
            <textarea
              value={coldReview}
              onChange={(e) => setColdReview(e.target.value)}
              rows={14}
              placeholder="With distance, what do you see?"
              style={textareaStyle}
            />
          </Field>
        )}

        {tab === "shots" && (
          <ScreenshotsTab
            entryId={entry.id}
            shots={shots}
            onShotsChange={setShots}
          />
        )}

        {tab === "tags" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {entry && (
              <CoachSuggestionsRow
                pending={coachSuggesting}
                suggestion={coachSuggestion}
                error={coachError}
                onSuggest={async () => {
                  setCoachError(null); setCoachSuggesting(true)
                  const r = await suggestEntryTags(entry.id)
                  setCoachSuggesting(false)
                  if (r.ok) setCoachSuggestion(r.suggestion)
                  else setCoachError(r.error)
                }}
                onAcceptAll={() => {
                  if (!coachSuggestion) return
                  if (coachSuggestion.mood && !mood) setMood(coachSuggestion.mood)
                  setTags((prev) => Array.from(new Set([...prev, ...coachSuggestion.tags])))
                  setMistakes((prev) => Array.from(new Set([...prev, ...coachSuggestion.mistakes])))
                  setCoachSuggestion(null)
                }}
                onAcceptTag={(t) => setTags((prev) => Array.from(new Set([...prev, t])))}
                onAcceptMistake={(t) => setMistakes((prev) => Array.from(new Set([...prev, t])))}
                onAcceptMood={(m) => setMood(m)}
                onDismiss={() => setCoachSuggestion(null)}
              />
            )}
            <Field label="Mood">
              <select
                value={mood ?? ""}
                onChange={(e) => setMood(e.target.value || null)}
                style={selectStyle}
              >
                <option value="">—</option>
                {["focused", "calm", "confident", "neutral", "rushed", "anxious", "tilted"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Tags" hint="Free-form. A+ setup, high conviction, scaled-out…">
              <ChipInput value={tags} onChange={setTags} placeholder="Add a tag and press Enter" />
            </Field>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--c-border)", background: "var(--c-bg-elev-1)" }}>
        <button onClick={onDelete} className="btn" style={{ color: "var(--c-red-bright)", borderColor: "rgba(224,74,85,0.35)" }}>
          <Icon name="x" size={12} /> <span>Delete entry</span>
        </button>
        <button onClick={handleClose} className="btn">Done</button>
      </div>
    </DrawerShell>
  )
}

function DrawerShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        zIndex: 110,
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          height: "100%",
          background: "var(--c-bg-elev-1)",
          borderLeft: "1px solid var(--c-border-strong)",
          boxShadow: "-12px 0 32px rgba(0,0,0,0.55)",
          display: "flex", flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  )
}

function SaveStatusPill({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "saving") return <span style={{ color: "var(--c-amber)" }}>Saving…</span>
  if (status === "saved") return <span style={{ color: "var(--c-green-bright)" }}>Saved</span>
  if (status === "error") return <span style={{ color: "var(--c-red-bright)" }}>Save failed</span>
  return <span style={{ color: "var(--c-fg-dim)" }}>Idle</span>
}

function CoachSuggestionsRow({
  pending, suggestion, error,
  onSuggest, onAcceptAll, onAcceptTag, onAcceptMistake, onAcceptMood, onDismiss,
}: {
  pending: boolean
  suggestion: CoachTagSuggestion | null
  error: string | null
  onSuggest: () => void
  onAcceptAll: () => void
  onAcceptTag: (t: string) => void
  onAcceptMistake: (t: string) => void
  onAcceptMood: (m: string) => void
  onDismiss: () => void
}) {
  if (!suggestion && !error) {
    return (
      <button
        type="button"
        onClick={onSuggest}
        disabled={pending}
        className="btn"
        style={{
          alignSelf: "flex-start", fontSize: 11.5, padding: "5px 10px",
          background: "rgba(105, 50, 212, 0.08)",
          color: "var(--c-purple-bright)",
          borderColor: "rgba(105, 50, 212, 0.3)",
        }}
      >
        <Icon name="sparkle" size={11} />
        <span>{pending ? "Reading…" : "Coach: suggest tags from prose"}</span>
      </button>
    )
  }

  if (error) {
    return (
      <div style={{
        padding: 10,
        background: "rgba(229, 162, 59, 0.08)", border: "1px solid rgba(229, 162, 59, 0.3)",
        borderRadius: 8,
        fontSize: 12, color: "var(--c-fg-muted)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <span>Coach: {error}</span>
        <button onClick={onDismiss} className="btn" style={{ fontSize: 10, padding: "3px 8px" }}>Dismiss</button>
      </div>
    )
  }

  if (!suggestion) return null

  const empty =
    suggestion.tags.length === 0 &&
    suggestion.mistakes.length === 0 &&
    !suggestion.mood

  if (empty) {
    return (
      <div style={{
        padding: 10,
        background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)",
        borderRadius: 8, fontSize: 12, color: "var(--c-fg-muted)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <span>Coach: not enough prose yet to suggest meaningful tags.</span>
        <button onClick={onDismiss} className="btn" style={{ fontSize: 10, padding: "3px 8px" }}>OK</button>
      </div>
    )
  }

  return (
    <div style={{
      padding: 12,
      background: "rgba(105, 50, 212, 0.06)",
      border: "1px solid rgba(105, 50, 212, 0.25)",
      borderRadius: 8,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="sparkle" size={12} color="var(--c-purple-bright)" />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--c-purple-bright)" }}>Coach suggests</span>
          <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)" }}>click chips to accept individually</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onAcceptAll} className="btn btn-primary" style={{ fontSize: 10.5, padding: "3px 9px" }}>Accept all</button>
          <button onClick={onDismiss} className="btn" style={{ fontSize: 10.5, padding: "3px 9px" }}>Dismiss</button>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {suggestion.mood && (
          <ChipPill label={`mood: ${suggestion.mood}`} onClick={() => onAcceptMood(suggestion.mood!)} kind="mood" />
        )}
        {suggestion.tags.map((t) => (
          <ChipPill key={`t-${t}`} label={t} onClick={() => onAcceptTag(t)} kind="tag" />
        ))}
        {suggestion.mistakes.map((t) => (
          <ChipPill key={`m-${t}`} label={`mistake: ${t}`} onClick={() => onAcceptMistake(t)} kind="mistake" />
        ))}
      </div>
    </div>
  )
}

function ChipPill({ label, onClick, kind }: { label: string; onClick: () => void; kind: "tag" | "mistake" | "mood" }) {
  const palette = kind === "mistake"
    ? { bg: "rgba(190, 51, 61, 0.1)", border: "rgba(190, 51, 61, 0.35)", color: "var(--c-red-bright)" }
    : kind === "mood"
      ? { bg: "rgba(229, 162, 59, 0.1)", border: "rgba(229, 162, 59, 0.35)", color: "var(--c-amber)" }
      : { bg: "rgba(105, 50, 212, 0.12)", border: "rgba(105, 50, 212, 0.35)", color: "var(--c-purple-bright)" }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 11, fontWeight: 500,
        padding: "3px 8px",
        background: palette.bg,
        color: palette.color,
        border: `1px solid ${palette.border}`,
        borderRadius: 999,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  )
}

function ShareLinkField({
  entryId, token, busy, copyHint, onGenerate, onRevoke, onCopy,
}: {
  entryId: string | null
  token: string | null
  busy: boolean
  copyHint: "idle" | "copied"
  onGenerate: () => void
  onRevoke: () => void
  onCopy: () => void
}) {
  if (!entryId) {
    return (
      <div style={{ fontSize: 12, color: "var(--c-fg-muted)" }}>
        Save the entry once before generating a share link.
      </div>
    )
  }

  if (!token) {
    return (
      <button onClick={onGenerate} className="btn" disabled={busy}>
        <Icon name="external" size={11} />
        <span>{busy ? "Generating…" : "Generate share link"}</span>
      </button>
    )
  }

  const url = typeof window !== "undefined" ? `${window.location.origin}/share/${token}` : `/share/${token}`
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="mono"
        style={{
          fontSize: 11.5,
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--c-border)",
          background: "var(--c-bg-elev-2)",
          color: "var(--c-fg)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={onCopy} className="btn" disabled={busy}>
          <Icon name={copyHint === "copied" ? "check" : "external"} size={11} />
          <span>{copyHint === "copied" ? "Copied" : "Copy link"}</span>
        </button>
        <button
          onClick={onRevoke}
          className="btn"
          disabled={busy}
          style={{
            background: "rgba(190, 51, 61, 0.08)",
            color: "var(--c-red-bright)",
            borderColor: "rgba(190, 51, 61, 0.35)",
          }}
        >
          <Icon name="x" size={11} />
          <span>{busy ? "Revoking…" : "Revoke"}</span>
        </button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, color: "var(--c-fg-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {hint && <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>{hint}</span>}
      {children}
    </div>
  )
}

function ChipInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("")
  const submit = () => {
    const tag = draft.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setDraft("")
  }
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6,
      background: "var(--c-bg-elev-2)",
      border: "1px solid var(--c-border)",
      borderRadius: 8,
      padding: 6,
    }}>
      {value.map((t) => (
        <span key={t} className="chip chip-purple" style={{ fontSize: 11, padding: "3px 9px" }}>
          {t}
          <button onClick={() => onChange(value.filter((x) => x !== t))} style={{ marginLeft: 4, background: "transparent", border: "none", color: "inherit", cursor: "pointer", lineHeight: 1 }}>
            ✕
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); submit() }
          if (e.key === "Backspace" && !draft && value.length > 0) onChange(value.slice(0, -1))
        }}
        onBlur={submit}
        placeholder={value.length === 0 ? placeholder : ""}
        style={{ flex: 1, minWidth: 120, background: "transparent", border: "none", outline: "none", color: "var(--c-fg)", fontSize: 12.5 }}
      />
    </div>
  )
}

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-elev-2)",
  color: "var(--c-fg)",
  fontSize: 13.5,
  fontFamily: "var(--font-body)",
  lineHeight: 1.55,
  resize: "vertical",
  outline: "none",
}
const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-elev-2)",
  color: "var(--c-fg)",
  fontSize: 13,
  outline: "none",
  width: "100%",
}
const iconBtn: React.CSSProperties = {
  width: 30, height: 30, display: "grid", placeItems: "center",
  background: "transparent", border: "1px solid var(--c-border)",
  borderRadius: 8, color: "var(--c-fg-muted)",
  cursor: "pointer",
}

// Re-export PairFlag to keep tree-shake happy in case future tabs use it.
export { PairFlag as _PairFlag }
