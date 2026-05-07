"use server"

import Anthropic from "@anthropic-ai/sdk"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

/**
 * #69 Coach AI chat mode. Multi-turn conversations against the user's actual
 * trade data. Each message round:
 *   1. Append user message to coach_conversations.messages
 *   2. Build a context payload: last 30 days of trades + journal + playbook
 *      summary (same shape as generateCoachInsights)
 *   3. Send full history + system prompt + context to Anthropic
 *   4. Append assistant reply, return updated conversation
 *
 * Capped at 20 messages per conversation (10 turns) to bound API cost. After
 * cap, user must start a new conversation.
 */

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
  ts: string
}

export type CoachConversation = {
  id: string
  title: string | null
  messages: ChatMessage[]
  created_at: string
  updated_at: string
}

export type CoachChatResult =
  | { ok: true; conversation: CoachConversation }
  | { ok: false; error: string; configured?: boolean }

const SYSTEM_PROMPT = `You are a Coach AI for a Forex trader. You're in a back-and-forth conversation with the trader about their own data.

Context (provided each turn): the user's last 30 days of closed trades + journal entries.

Tone:
  - Direct and specific. Cite actual numbers and trade examples.
  - Honest about losing patterns — don't sugarcoat.
  - Concise. Most replies should be 2-5 sentences. Use bullets only when listing 3+ items.
  - Don't predict markets or give trade ideas. Don't suggest specific entry/exit levels.

When the trader asks a vague question:
  - Pull the most relevant slice of their data and answer with it.
  - If you genuinely don't have data to answer, say so plainly.

When the trader pushes back:
  - Re-examine the data. Don't be sycophantic, but update if the trader has context you missed.

Format: plain prose. No markdown headers. Inline ** for emphasis OK.`

const MAX_MESSAGES_PER_CONVERSATION = 20
const CONTEXT_TRADE_LIMIT = 60

export async function startCoachConversation(firstMessage: string): Promise<CoachChatResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "Coach Chat needs ANTHROPIC_API_KEY configured.", configured: false }
  }

  const trimmed = firstMessage.trim()
  if (!trimmed) return { ok: false, error: "Empty message." }

  const userMsg: ChatMessage = { role: "user", content: trimmed, ts: new Date().toISOString() }

  // Generate a short title from the first message (first 60 chars).
  const title = trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed

  const { data: created, error } = await supabase
    .from("coach_conversations")
    .insert({ user_id: user.id, title, messages: [userMsg] })
    .select("*")
    .single()
  if (error || !created) return { ok: false, error: error?.message ?? "Failed to start conversation." }

  // Now generate the first assistant reply.
  const reply = await generateAssistantReply(supabase, user.id, [userMsg])
  if (!reply.ok) return reply

  const next = [userMsg, reply.message]
  const { data: updated, error: updErr } = await supabase
    .from("coach_conversations")
    .update({ messages: next, updated_at: new Date().toISOString() })
    .eq("id", created.id)
    .select("*")
    .single()
  if (updErr || !updated) return { ok: false, error: updErr?.message ?? "Failed to save reply." }

  revalidatePath("/dashboard")
  return { ok: true, conversation: deserialize(updated) }
}

export async function sendCoachMessage(conversationId: string, userMessage: string): Promise<CoachChatResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not signed in." }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, error: "Coach Chat needs ANTHROPIC_API_KEY configured.", configured: false }
  }

  const trimmed = userMessage.trim()
  if (!trimmed) return { ok: false, error: "Empty message." }

  const { data: convo } = await supabase
    .from("coach_conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle()
  if (!convo || convo.user_id !== user.id) return { ok: false, error: "Conversation not found." }

  const messages = Array.isArray(convo.messages) ? (convo.messages as unknown as ChatMessage[]) : []
  if (messages.length >= MAX_MESSAGES_PER_CONVERSATION) {
    return { ok: false, error: `Conversation cap reached (${MAX_MESSAGES_PER_CONVERSATION} messages). Start a new chat to continue.` }
  }

  const userMsg: ChatMessage = { role: "user", content: trimmed, ts: new Date().toISOString() }
  const next = [...messages, userMsg]

  const reply = await generateAssistantReply(supabase, user.id, next)
  if (!reply.ok) return reply

  const final = [...next, reply.message]
  const { data: updated, error } = await supabase
    .from("coach_conversations")
    .update({ messages: final, updated_at: new Date().toISOString() })
    .eq("id", conversationId)
    .select("*")
    .single()
  if (error || !updated) return { ok: false, error: error?.message ?? "Failed to save." }

  return { ok: true, conversation: deserialize(updated) }
}

export async function listCoachConversations(limit = 10): Promise<CoachConversation[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from("coach_conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(limit)
  return (data ?? []).map(deserialize)
}

export async function deleteCoachConversation(id: string): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  await supabase.from("coach_conversations").delete().eq("id", id).eq("user_id", user.id)
  return { ok: true }
}

// ── Internals ─────────────────────────────────────────────────────────────

async function generateAssistantReply(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  messages: ChatMessage[],
): Promise<{ ok: true; message: ChatMessage } | { ok: false; error: string; configured?: boolean }> {
  // Pull last-30-days context.
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); thirtyDaysAgo.setHours(0, 0, 0, 0)
  const [{ data: trades }, { data: entries }, { data: playbooks }] = await Promise.all([
    supabase.from("trades")
      .select("id, pair, side, entry_price, exit_price, r, pnl, mood, playbook_id, opened_at, closed_at")
      .eq("user_id", userId)
      .eq("status", "closed")
      .gte("closed_at", thirtyDaysAgo.toISOString())
      .order("closed_at", { ascending: false })
      .limit(CONTEXT_TRADE_LIMIT),
    supabase.from("journal_entries")
      .select("trade_id, pre_trade, post_trade, rule_break, rule_break_tags, mistakes")
      .eq("user_id", userId)
      .gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("playbooks").select("id, name").eq("user_id", userId),
  ])

  const playbookByID = new Map((playbooks ?? []).map((p) => [p.id, p.name]))
  const entriesByTradeID = new Map((entries ?? []).map((e) => [e.trade_id, e]))

  const compactDataset = (trades ?? []).map((t) => {
    const e = entriesByTradeID.get(t.id)
    return {
      pair: t.pair, side: t.side, entry: t.entry_price, exit: t.exit_price,
      r: t.r, pnl: t.pnl, mood: t.mood,
      playbook: t.playbook_id ? playbookByID.get(t.playbook_id) : null,
      opened: t.opened_at,
      thesis: e?.pre_trade?.slice(0, 200) ?? null,
      review: e?.post_trade?.slice(0, 200) ?? null,
      ruleBreak: !!e?.rule_break,
      mistakes: e?.mistakes ?? [],
    }
  })

  const contextSystem = `${SYSTEM_PROMPT}\n\nUser's last 30 days of closed trades (most recent first, capped at ${CONTEXT_TRADE_LIMIT}):\n${JSON.stringify(compactDataset)}`

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: "claude-3-5-haiku-latest",
      max_tokens: 600,
      system: contextSystem,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })
    const block = response.content.find((b) => b.type === "text")
    if (!block || block.type !== "text") {
      return { ok: false, error: "Coach AI returned no text.", configured: true }
    }
    return {
      ok: true,
      message: { role: "assistant", content: block.text.trim(), ts: new Date().toISOString() },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Coach AI request failed.", configured: true }
  }
}

function deserialize(row: { id: string; title: string | null; messages: unknown; created_at: string; updated_at: string }): CoachConversation {
  return {
    id: row.id,
    title: row.title,
    messages: Array.isArray(row.messages) ? (row.messages as unknown as ChatMessage[]) : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
