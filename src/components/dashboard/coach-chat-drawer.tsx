"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Icon } from "@/components/icons"
import {
  startCoachConversation,
  sendCoachMessage,
  listCoachConversations,
  deleteCoachConversation,
  type CoachConversation,
} from "@/lib/actions/coach-chat"

/**
 * Right-side drawer for Coach AI chat. Maintains its own state — list of
 * recent conversations, currently selected one, message composer. Slides in
 * over the dashboard when triggered from CoachChatTrigger.
 */
export function CoachChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [convos, setConvos] = useState<CoachConversation[] | null>(null)
  const [active, setActive] = useState<CoachConversation | null>(null)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  // Load conversation list when the drawer opens for the first time.
  useEffect(() => {
    if (!open) return
    if (convos !== null) return
    void (async () => {
      const list = await listCoachConversations(10)
      setConvos(list)
      if (list.length > 0) setActive(list[0])
    })()
  }, [open, convos])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!scrollerRef.current) return
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight
  }, [active?.messages.length])

  if (!open) return null

  const onSend = () => {
    const text = draft.trim()
    if (!text) return
    setError(null)
    setDraft("")
    startTransition(async () => {
      const r = active
        ? await sendCoachMessage(active.id, text)
        : await startCoachConversation(text)
      if (r.ok) {
        setActive(r.conversation)
        // Refresh list — newest convo bumps to top
        const list = await listCoachConversations(10)
        setConvos(list)
      } else {
        setError(r.error)
        setDraft(text) // restore
      }
    })
  }

  const onNewChat = () => {
    setActive(null)
    setError(null)
  }

  const onPickConvo = (id: string) => {
    const c = convos?.find((x) => x.id === id) ?? null
    setActive(c)
    setError(null)
  }

  const onDelete = (id: string) => {
    if (!confirm("Delete this conversation?")) return
    startTransition(async () => {
      await deleteCoachConversation(id)
      const list = await listCoachConversations(10)
      setConvos(list)
      if (active?.id === id) setActive(list[0] ?? null)
    })
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} />
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(95vw, 540px)",
        background: "var(--c-bg-elev-1)",
        borderLeft: "1px solid var(--c-border)",
        zIndex: 101,
        display: "flex", flexDirection: "column",
        animation: "slideIn 0.2s cubic-bezier(0.2, 0.7, 0.2, 1)",
      }}>
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg, #4312A0, #6932D4)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon name="sparkle" size={15} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Coach AI · Chat</div>
            <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {active?.title ?? "Ask anything about your trading data"}
            </div>
          </div>
          <button
            type="button"
            onClick={onNewChat}
            title="New chat"
            style={{ ...iconBtn, color: "var(--c-purple-bright)" }}
          >
            <Icon name="plus" size={13} />
          </button>
          <button onClick={onClose} title="Close" style={iconBtn}><Icon name="x" size={13} /></button>
        </div>

        {/* Conversation history (collapsible) */}
        {convos && convos.length > 0 && (
          <details style={{ borderBottom: "1px solid var(--c-border)" }}>
            <summary style={{ padding: "8px 18px", fontSize: 11.5, color: "var(--c-fg-muted)", cursor: "pointer" }}>
              Past chats ({convos.length})
            </summary>
            <div style={{ padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
              {convos.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: c.id === active?.id ? "var(--c-bg-elev-3)" : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => onPickConvo(c.id)}
                >
                  <span style={{ fontSize: 11.5, color: "var(--c-fg)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.title ?? "Untitled"}
                  </span>
                  <span style={{ fontSize: 9.5, color: "var(--c-fg-dim)" }}>
                    {new Date(c.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(c.id) }}
                    style={{ ...iconBtn, width: 22, height: 22 }}
                    title="Delete"
                  >
                    <Icon name="x" size={10} />
                  </button>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Messages */}
        <div ref={scrollerRef} style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {!active && (
            <div style={{ color: "var(--c-fg-muted)", fontSize: 13, textAlign: "center", padding: "30px 20px", lineHeight: 1.5 }}>
              <Icon name="sparkle" size={22} color="var(--c-purple-bright)" />
              <p style={{ marginTop: 12 }}>
                Ask Coach about your data. Try: <em>&quot;What&apos;s my edge this month?&quot;</em> or{" "}
                <em>&quot;Why am I losing on EUR/USD shorts?&quot;</em>
              </p>
            </div>
          )}
          {active?.messages.map((m, i) => (
            <Message key={`${active.id}-${i}`} message={m} />
          ))}
          {pending && active && (
            <div style={{ color: "var(--c-fg-muted)", fontSize: 12, fontStyle: "italic", padding: "4px 8px" }}>
              Coach is thinking…
            </div>
          )}
        </div>

        {/* Composer */}
        <div style={{ padding: 14, borderTop: "1px solid var(--c-border)", background: "var(--c-bg-elev-1)" }}>
          {error && (
            <div style={{ marginBottom: 8, padding: 8, background: "var(--c-red-soft)", color: "var(--c-red-bright)", borderRadius: 6, fontSize: 11.5 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  onSend()
                }
              }}
              rows={2}
              placeholder={active ? "Reply… (Enter to send, Shift+Enter for newline)" : "Ask Coach… (Enter to send)"}
              disabled={pending}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--c-border)",
                background: "var(--c-bg-elev-2)",
                color: "var(--c-fg)",
                fontSize: 13,
                fontFamily: "var(--font-body)",
                lineHeight: 1.5,
                resize: "none",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={onSend}
              disabled={pending || draft.trim().length === 0}
              className="btn"
              style={{
                background: "var(--c-purple-bright)",
                color: "white",
                border: "1px solid var(--c-purple-bright)",
                padding: "10px 14px",
                opacity: (pending || draft.trim().length === 0) ? 0.5 : 1,
              }}
            >
              <Icon name="arrowUp" size={13} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

function Message({ message }: { message: { role: "user" | "assistant"; content: string; ts: string } }) {
  const isUser = message.role === "user"
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "85%",
        padding: "8px 12px",
        borderRadius: 12,
        background: isUser ? "var(--c-purple-bright)" : "var(--c-bg-elev-2)",
        color: isUser ? "white" : "var(--c-fg)",
        fontSize: 13, lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        border: isUser ? "none" : "1px solid var(--c-border)",
      }}>
        {message.content}
      </div>
      <span style={{ fontSize: 9.5, color: "var(--c-fg-dim)", marginTop: 3 }}>
        {new Date(message.ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
      </span>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  width: 28, height: 28,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "var(--c-bg-elev-3)",
  border: "1px solid var(--c-border)",
  borderRadius: 6,
  color: "var(--c-fg-muted)",
  cursor: "pointer",
}
