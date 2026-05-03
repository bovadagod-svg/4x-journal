/**
 * Lightweight error reporting for production. Two modes:
 *
 *   1. SENTRY_DSN set → fire-and-forget POST to Sentry's HTTP envelope
 *      endpoint. No SDK dependency, no bundle bloat. Good enough for
 *      route-level error tracking; doesn't capture transactions or breadcrumbs.
 *
 *   2. SENTRY_DSN unset → console.error in a structured format Vercel's
 *      logs panel highlights.
 *
 * Both are safe to call from client + server. Failure to report is silent —
 * we never let observability tooling break the actual user flow.
 */

export type CaptureContext = {
  /** Section / route hint, e.g. "dashboard". */
  section?: string
  /** Server-emitted Next digest, when available. */
  digest?: string
  /** Free-form key-value tags. */
  tags?: Record<string, string | number | boolean | null | undefined>
  /** User identifier, hashed at the call site if PII is a concern. */
  userId?: string
}

const DSN = typeof process !== "undefined" ? process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN : undefined

type ParsedDsn = { host: string; projectId: string; publicKey: string }

let parsed: ParsedDsn | null | undefined  // undefined = not yet attempted

function parseDsn(): ParsedDsn | null {
  if (parsed !== undefined) return parsed
  if (!DSN) { parsed = null; return null }
  try {
    const u = new URL(DSN)
    const projectId = u.pathname.replace(/^\/+/, "")
    const publicKey = u.username
    parsed = { host: u.host, projectId, publicKey }
  } catch {
    parsed = null
  }
  return parsed
}

export function captureException(err: unknown, ctx: CaptureContext = {}) {
  // Always log so dev + Vercel's log panel see it.
  // eslint-disable-next-line no-console
  console.error("[observability]", JSON.stringify({
    section: ctx.section,
    digest: ctx.digest,
    userId: ctx.userId,
    tags: ctx.tags,
    error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { message: String(err) },
  }))

  const dsn = parseDsn()
  if (!dsn) return

  // Fire-and-forget — never await; we don't want to slow user response.
  void postToSentry(dsn, err, ctx).catch(() => {/* swallow */})
}

export function captureMessage(message: string, ctx: CaptureContext = {}) {
  captureException(new Error(message), ctx)
}

async function postToSentry(dsn: ParsedDsn, err: unknown, ctx: CaptureContext) {
  const eventId = randomEventId()
  const ts = Math.floor(Date.now() / 1000)
  const error = err instanceof Error ? err : new Error(String(err))

  const event = {
    event_id: eventId,
    timestamp: ts,
    platform: "javascript",
    level: "error",
    server_name: ctx.section ?? "unknown",
    tags: { ...(ctx.tags ?? {}), section: ctx.section, digest: ctx.digest },
    user: ctx.userId ? { id: ctx.userId } : undefined,
    exception: {
      values: [{
        type: error.name || "Error",
        value: error.message,
        stacktrace: error.stack ? { frames: parseStack(error.stack) } : undefined,
      }],
    },
  }

  // Sentry envelope format
  const headers = JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() })
  const itemHeaders = JSON.stringify({ type: "event" })
  const body = `${headers}\n${itemHeaders}\n${JSON.stringify(event)}\n`

  const url = `https://${dsn.host}/api/${dsn.projectId}/envelope/?sentry_key=${dsn.publicKey}&sentry_version=7`
  await fetch(url, { method: "POST", body, headers: { "Content-Type": "application/x-sentry-envelope" } })
}

function parseStack(stack: string): Array<{ filename?: string; function?: string; lineno?: number; colno?: number }> {
  // Best-effort. Sentry tolerates partial frames.
  const lines = stack.split("\n").slice(1, 21)
  return lines.map((line) => {
    const m = /at (?:(.+?) )?\(?(.+?):(\d+):(\d+)\)?$/.exec(line.trim())
    if (m) return { function: m[1], filename: m[2], lineno: Number(m[3]), colno: Number(m[4]) }
    return { function: line.trim() }
  })
}

function randomEventId(): string {
  // 32-char hex, no dashes — Sentry's expected format.
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "")
  }
  let s = ""
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16)
  return s
}
