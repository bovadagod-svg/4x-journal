import "server-only"

/**
 * TradeLocker API client.
 *
 * The public docs only cover the basics — exact field shapes for positions
 * and order history are gated behind a developer login. So this client is
 * defensive: it accepts wide, optional types and lets the sync layer pick
 * what it needs. When the API differs from our guesses, sync errors carry
 * the raw response back so we can iterate.
 *
 * Base URLs:
 *   demo  → https://demo.tradelocker.com/backend-api
 *   live  → https://live.tradelocker.com/backend-api
 *
 * Auth: POST /auth/jwt/token  body { email, password, server }
 *       → { accessToken, refreshToken? }
 */

export type TradeLockerEnv = "demo" | "live"

export const TL_BASE_URL: Record<TradeLockerEnv, string> = {
  demo: "https://demo.tradelocker.com/backend-api",
  live: "https://live.tradelocker.com/backend-api",
}

export type TLLoginResponse = {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  // anything else they return — keep raw for debugging
  raw?: unknown
}

export type TLAccount = {
  id: string             // accountId, stringified
  accNum: string         // index used in routing
  name?: string
  currency?: string
  type?: string
  raw: unknown
}

export type TLPosition = {
  externalId: string
  pair: string
  side: "long" | "short"
  size: number
  entryPrice: number
  stopPrice: number | null
  targetPrice: number | null
  exitPrice: number | null
  pnl: number | null
  status: "open" | "closed"
  openedAt: string
  closedAt: string | null
  raw: unknown
}

class TLError extends Error {
  status: number
  body: unknown
  url: string
  constructor(msg: string, status: number, body: unknown, url: string) {
    super(msg)
    this.status = status
    this.body = body
    this.url = url
  }
}

async function tlFetch(
  base: string,
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const url = `${base}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = await res.text().catch(() => null)
  }
  if (!res.ok) {
    throw new TLError(
      typeof body === "object" && body && "message" in body
        ? String((body as { message: unknown }).message)
        : `TradeLocker ${res.status} on ${path}`,
      res.status,
      body,
      url,
    )
  }
  return { status: res.status, body }
}

export async function tlLogin(args: {
  env: TradeLockerEnv
  email: string
  password: string
  server: string
}): Promise<TLLoginResponse> {
  const base = TL_BASE_URL[args.env]
  const { body } = await tlFetch(base, "/auth/jwt/token", {
    method: "POST",
    body: JSON.stringify({ email: args.email, password: args.password, server: args.server }),
  })
  const obj = (body ?? {}) as Record<string, unknown>
  const accessToken =
    typeof obj.accessToken === "string" ? obj.accessToken
    : typeof obj.access_token === "string" ? obj.access_token
    : null
  if (!accessToken) {
    throw new TLError("No accessToken in TradeLocker response", 200, body, `${base}/auth/jwt/token`)
  }
  const refreshToken =
    typeof obj.refreshToken === "string" ? obj.refreshToken
    : typeof obj.refresh_token === "string" ? obj.refresh_token
    : undefined
  return { accessToken, refreshToken, raw: body }
}

/**
 * Try a few likely paths to discover this user's TradeLocker accounts.
 * The docs hint at `/auth/jwt/all-accounts` but the exact path is gated.
 */
export async function tlGetAccounts(env: TradeLockerEnv, accessToken: string): Promise<TLAccount[]> {
  const base = TL_BASE_URL[env]
  const candidates = [
    "/auth/jwt/all-accounts",
    "/auth/all-accounts",
    "/api/auth/jwt/all-accounts",
  ]
  let lastErr: TLError | null = null
  for (const path of candidates) {
    try {
      const { body } = await tlFetch(base, path, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      return normalizeAccounts(body)
    } catch (e) {
      if (e instanceof TLError && e.status === 404) {
        lastErr = e
        continue
      }
      throw e
    }
  }
  throw lastErr ?? new Error("No TradeLocker accounts endpoint matched")
}

function normalizeAccounts(body: unknown): TLAccount[] {
  // Accept several plausible shapes:
  //   { accounts: [...] } | [...] | { d: { accounts: [...] } } | { data: [...] }
  const list = pickArray(body)
  return list.map((raw) => {
    const r = raw as Record<string, unknown>
    return {
      id: String(r.accountId ?? r.id ?? r.accNum ?? ""),
      accNum: String(r.accNum ?? r.accountNum ?? r.accountNumber ?? ""),
      name: typeof r.name === "string" ? r.name : typeof r.label === "string" ? r.label : undefined,
      currency: typeof r.currency === "string" ? r.currency : undefined,
      type: typeof r.type === "string" ? r.type : undefined,
      raw,
    }
  })
}

function pickArray(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>
    if (Array.isArray(o.accounts)) return o.accounts
    if (Array.isArray(o.data)) return o.data
    if (o.d && typeof o.d === "object") {
      const d = o.d as Record<string, unknown>
      if (Array.isArray(d.accounts)) return d.accounts
      if (Array.isArray(d.data)) return d.data
    }
  }
  return []
}

/**
 * Pull positions + recent order history for a single TradeLocker account.
 * The route headers TL expects (`accNum`, etc.) are sent best-effort.
 */
export async function tlSyncTrades(args: {
  env: TradeLockerEnv
  accessToken: string
  accountId: string
  accNum: string
}): Promise<{ open: TLPosition[]; closed: TLPosition[]; rawSamples: { positions?: unknown; history?: unknown } }> {
  const base = TL_BASE_URL[args.env]
  const headers = {
    Authorization: `Bearer ${args.accessToken}`,
    accNum: args.accNum,
    "acc-num": args.accNum,
  }

  const [positionsRes, historyRes] = await Promise.allSettled([
    tlFetch(base, `/trade/accounts/${args.accountId}/positions`, { headers }),
    tlFetch(base, `/trade/accounts/${args.accountId}/ordersHistory`, { headers }),
  ])

  const positionsBody = positionsRes.status === "fulfilled" ? positionsRes.value.body : null
  const historyBody = historyRes.status === "fulfilled" ? historyRes.value.body : null

  const open = normalizePositions(positionsBody, "open")
  const closed = normalizePositions(historyBody, "closed")

  // Surface the first error if both paths failed completely.
  if (positionsRes.status === "rejected" && historyRes.status === "rejected") {
    throw positionsRes.reason
  }

  return {
    open,
    closed,
    rawSamples: { positions: positionsBody, history: historyBody },
  }
}

function normalizePositions(body: unknown, status: "open" | "closed"): TLPosition[] {
  const list = pickArray(body)
  return list.map((raw) => {
    const r = raw as Record<string, unknown>
    const side = inferSide(r)
    const entry = num(r.openPrice ?? r.entryPrice ?? r.price ?? r.avgPrice)
    const exit = num(r.closePrice ?? r.exitPrice ?? null)
    return {
      externalId: String(r.id ?? r.positionId ?? r.orderId ?? r.ticket ?? ""),
      pair: prettyPair(String(r.symbol ?? r.instrument ?? r.tradableInstrumentName ?? r.pair ?? "")),
      side,
      size: num(r.qty ?? r.quantity ?? r.size ?? r.volume) ?? 0,
      entryPrice: entry ?? 0,
      stopPrice: num(r.stopLoss ?? r.sl ?? null),
      targetPrice: num(r.takeProfit ?? r.tp ?? null),
      exitPrice: exit,
      pnl: num(r.pnl ?? r.profit ?? r.realizedPnL ?? null),
      status,
      openedAt: String(r.openTime ?? r.openedAt ?? r.createdAt ?? new Date().toISOString()),
      closedAt: status === "closed" ? String(r.closeTime ?? r.closedAt ?? null) : null,
      raw,
    }
  }).filter((p) => p.externalId && p.pair && p.entryPrice > 0)
}

function inferSide(r: Record<string, unknown>): "long" | "short" {
  const s = String(r.side ?? r.direction ?? r.type ?? "").toLowerCase()
  if (s.includes("buy") || s.includes("long")) return "long"
  if (s.includes("sell") || s.includes("short")) return "short"
  // Fallback: positive qty = long, negative = short.
  const qty = Number(r.qty ?? r.size ?? 0)
  return qty < 0 ? "short" : "long"
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  return isFinite(n) ? n : null
}

function prettyPair(symbol: string): string {
  if (!symbol) return ""
  if (symbol.includes("/")) return symbol.toUpperCase()
  // EURUSD → EUR/USD; XAUUSD → XAU/USD
  if (symbol.length === 6) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`.toUpperCase()
  if (symbol.length === 7 && symbol.startsWith("XAU")) return `XAU/${symbol.slice(3)}`.toUpperCase()
  return symbol.toUpperCase()
}

export { TLError }
