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

function pickArray(body: unknown, keys: string[] = ["accounts", "data", "positions", "ordersHistory", "orders", "filledOrders", "instruments"]): unknown[] {
  if (Array.isArray(body)) return body
  if (!body || typeof body !== "object") return []
  const o = body as Record<string, unknown>
  for (const k of keys) {
    if (Array.isArray(o[k])) return o[k] as unknown[]
  }
  if (o.d && typeof o.d === "object") {
    const d = o.d as Record<string, unknown>
    for (const k of keys) {
      if (Array.isArray(d[k])) return d[k] as unknown[]
    }
  }
  return []
}

/**
 * Pull positions + recent order history for a single TradeLocker account.
 *
 * TradeLocker uses column-oriented responses: each row is a positional
 * array, and `/trade/config` defines the column order per resource
 * (positionsConfig.columns, ordersHistoryConfig.columns). We fetch config
 * first, then zip rows → objects, then normalize.
 *
 * Reference:
 * https://public-api.tradelocker.com/reference/getpositions
 * https://public-api.tradelocker.com/reference/getordershistory
 * https://public-api.tradelocker.com/reference/getconfigusingget
 */
export type TLAccountState = {
  balance: number | null
  projectedBalance: number | null
  availableFunds: number | null
  raw: Record<string, unknown> | null
}

export async function tlSyncTrades(args: {
  env: TradeLockerEnv
  accessToken: string
  accountId: string
  accNum: string
}): Promise<{
  open: TLPosition[]
  closed: TLPosition[]
  attempts: Array<{ kind: "config" | "positions" | "history" | "state" | "instruments"; path: string; ok: boolean; status?: number; sample?: unknown; error?: string }>
  state?: TLAccountState
}> {
  const base = TL_BASE_URL[args.env]
  const baseHeaders = {
    Authorization: `Bearer ${args.accessToken}`,
    accNum: args.accNum,
    "acc-num": args.accNum,
  }

  const attempts: Array<{ kind: "config" | "positions" | "history" | "state" | "instruments"; path: string; ok: boolean; status?: number; sample?: unknown; error?: string }> = []

  // 1) /trade/config — column order per resource. Without this, rows are
  //    just opaque arrays.
  let positionColumns: string[] = []
  let historyColumns: string[] = []
  let accountColumns: string[] = []
  try {
    const r = await tlFetch(base, "/trade/config", { headers: baseHeaders })
    attempts.push({ kind: "config", path: "/trade/config", ok: true, status: r.status, sample: trim(r.body) })
    positionColumns = extractColumns(r.body, ["positionsConfig", "positions"])
    historyColumns = extractColumns(r.body, ["ordersHistoryConfig", "ordersHistory", "orderHistory"])
    accountColumns = extractColumns(r.body, ["accountDetailsConfig", "accountDetails"])
  } catch (e) {
    const err = e instanceof TLError ? e : null
    attempts.push({ kind: "config", path: "/trade/config", ok: false, status: err?.status, sample: trim(err?.body), error: err?.message ?? String(e) })
  }

  // 2) Instruments — map tradableInstrumentId → symbol so we can show
  //    "EUR/USD" instead of an opaque numeric id.
  const instrumentMap = new Map<string, string>()
  try {
    const r = await tlFetch(base, `/trade/accounts/${args.accountId}/instruments`, { headers: baseHeaders })
    attempts.push({ kind: "instruments", path: `/trade/accounts/${args.accountId}/instruments`, ok: true, status: r.status, sample: trim(r.body) })
    for (const inst of pickArray(r.body)) {
      if (inst && typeof inst === "object" && !Array.isArray(inst)) {
        const o = inst as Record<string, unknown>
        const id = String(o.tradableInstrumentId ?? o.id ?? "")
        const sym = String(o.tradableInstrumentName ?? o.name ?? o.symbol ?? "")
        if (id && sym) instrumentMap.set(id, sym)
      }
    }
  } catch (e) {
    const err = e instanceof TLError ? e : null
    attempts.push({ kind: "instruments", path: `/trade/accounts/${args.accountId}/instruments`, ok: false, status: err?.status, sample: trim(err?.body), error: err?.message ?? String(e) })
  }

  // 3) Open positions.
  let openObjects: Array<Record<string, unknown>> = []
  try {
    const r = await tlFetch(base, `/trade/accounts/${args.accountId}/positions`, { headers: baseHeaders })
    attempts.push({ kind: "positions", path: `/trade/accounts/${args.accountId}/positions`, ok: true, status: r.status, sample: trim(r.body) })
    openObjects = decodeRows(r.body, positionColumns, ["positions"])
  } catch (e) {
    const err = e instanceof TLError ? e : null
    attempts.push({ kind: "positions", path: `/trade/accounts/${args.accountId}/positions`, ok: false, status: err?.status, sample: trim(err?.body), error: err?.message ?? String(e) })
  }

  // 4) Closed orders.
  let closedObjects: Array<Record<string, unknown>> = []
  try {
    const r = await tlFetch(base, `/trade/accounts/${args.accountId}/ordersHistory`, { headers: baseHeaders })
    attempts.push({ kind: "history", path: `/trade/accounts/${args.accountId}/ordersHistory`, ok: true, status: r.status, sample: trim(r.body) })
    closedObjects = decodeRows(r.body, historyColumns, ["ordersHistory"])
  } catch (e) {
    const err = e instanceof TLError ? e : null
    attempts.push({ kind: "history", path: `/trade/accounts/${args.accountId}/ordersHistory`, ok: false, status: err?.status, sample: trim(err?.body), error: err?.message ?? String(e) })
  }

  // 5) Account state — TL returns { d: { accountDetailsData: [v1, v2, ...] } }
  //    where the array indices match accountDetailsConfig.columns.
  let state: TLAccountState | undefined
  try {
    const r = await tlFetch(base, `/trade/accounts/${args.accountId}/state`, { headers: baseHeaders })
    attempts.push({ kind: "state", path: `/trade/accounts/${args.accountId}/state`, ok: true, status: r.status, sample: trim(r.body) })
    state = decodeAccountState(r.body, accountColumns)
  } catch (e) {
    const err = e instanceof TLError ? e : null
    attempts.push({ kind: "state", path: `/trade/accounts/${args.accountId}/state`, ok: false, status: err?.status, error: err?.message ?? String(e) })
  }

  // ordersHistory rows are individual orders (entry, SL, TP, cancellations).
  // Group by positionId and pair the opener (isOpen=true) with the closer
  // (isOpen=false) to reconstruct one trade per closed position.
  const closed = reconstructClosedTrades(closedObjects, instrumentMap)

  return {
    open: openObjects.map((o) => objectToPosition(o, "open", instrumentMap)).filter(isValid),
    closed,
    attempts,
    state,
  }
}

/**
 * TradeLocker stores orders, not trades. A single round-trip trade is a
 * pair of Filled orders sharing a positionId — one with isOpen=true (the
 * entry) and one with isOpen=false (the exit, typically the SL or TP that
 * hit). Cancelled orders are the OCO siblings; ignore them.
 */
function reconstructClosedTrades(
  orderRows: Array<Record<string, unknown>>,
  instrumentMap: Map<string, string>,
): TLPosition[] {
  const byPosition = new Map<string, Array<Record<string, unknown>>>()
  for (const o of orderRows) {
    const pid = o.positionId != null ? String(o.positionId) : ""
    if (!pid) continue
    let arr = byPosition.get(pid)
    if (!arr) { arr = []; byPosition.set(pid, arr) }
    arr.push(o)
  }

  const out: TLPosition[] = []
  for (const [positionId, orders] of byPosition) {
    const filled = orders.filter((o) => /fill/i.test(String(o.status ?? "")))
    if (filled.length === 0) continue

    const opener = filled.find((o) => isTrue(o.isOpen)) ?? filled[0]
    const closer = filled.find((o) => isFalse(o.isOpen))
    if (!closer) continue // still open — handled by /positions endpoint

    // Side comes from the opening order ("buy" → long, "sell" → short).
    const side = inferSide(opener)
    const instId = opener.tradableInstrumentId != null ? String(opener.tradableInstrumentId) : ""
    const symbol = (instId && instrumentMap.get(instId)) ?? ""
    const entry = num(opener.avgPrice ?? opener.price) ?? 0
    const exit = num(closer.avgPrice ?? closer.price)
    const size = num(opener.filledQty ?? opener.qty) ?? 0

    out.push({
      externalId: positionId,
      pair: prettyPair(symbol),
      side,
      size,
      entryPrice: entry,
      stopPrice: num(opener.stopLoss),
      targetPrice: num(opener.takeProfit),
      exitPrice: exit,
      pnl: null,                // computed in the action via finance.ts
      status: "closed",
      openedAt: tlTimestamp(opener.lastModified ?? opener.createdDate) ?? new Date().toISOString(),
      closedAt: tlTimestamp(closer.lastModified ?? closer.createdDate),
      raw: { opener, closer, allOrders: orders },
    })
  }

  return out.filter(isValid)
}

function isTrue(v: unknown): boolean {
  if (v === true) return true
  if (typeof v === "string") return /^(true|1|yes)$/i.test(v.trim())
  return false
}
function isFalse(v: unknown): boolean {
  if (v === false) return true
  if (typeof v === "string") return /^(false|0|no)$/i.test(v.trim())
  return false
}

function decodeAccountState(body: unknown, columns: string[]): TLAccountState | undefined {
  if (!body || typeof body !== "object") return undefined
  const root = "d" in body ? (body as { d: unknown }).d : body
  if (!root || typeof root !== "object") return undefined
  const r = root as Record<string, unknown>
  const arr = (Array.isArray(r.accountDetailsData) ? r.accountDetailsData : null) as unknown[] | null
  if (!arr) return undefined
  const obj: Record<string, unknown> = {}
  if (columns.length > 0) {
    columns.forEach((col, i) => { obj[col] = arr[i] })
  }
  return {
    balance: num(obj.balance),
    projectedBalance: num(obj.projectedBalance),
    availableFunds: num(obj.availableFunds),
    raw: obj,
  }
}

/**
 * Pull a string[] of column names out of /trade/config for a given resource.
 * The config response can be shaped a few ways depending on TL's version:
 *   { d: { positionsConfig: { columns: [{ id: "id", title: "Position ID" }, ...] } } }
 *   { positionsConfig: [{ id: "id" }, ...] }
 *   { positionsConfig: { fields: [{ name: "id" }] } }
 */
function extractColumns(body: unknown, keys: string[]): string[] {
  const root = body && typeof body === "object" && "d" in body ? (body as { d: unknown }).d : body
  if (!root || typeof root !== "object") return []
  const r = root as Record<string, unknown>
  for (const key of keys) {
    const cfg = r[key]
    if (!cfg) continue
    const cols = pickArray(cfg).length > 0 ? pickArray(cfg) : (() => {
      if (typeof cfg !== "object" || cfg == null) return [] as unknown[]
      const o = cfg as Record<string, unknown>
      if (Array.isArray(o.columns)) return o.columns as unknown[]
      if (Array.isArray(o.fields)) return o.fields as unknown[]
      return [] as unknown[]
    })()
    if (cols.length === 0) continue
    return cols.map((c) => {
      if (typeof c === "string") return c
      if (c && typeof c === "object") {
        const x = c as Record<string, unknown>
        return String(x.id ?? x.name ?? x.field ?? x.key ?? "")
      }
      return ""
    }).filter(Boolean)
  }
  return []
}

/**
 * Take a TL response (which can be a flat array of objects, an array of
 * positional arrays, or wrapped in { d: { positions: [...] } }) and return
 * an array of plain objects keyed by `columns` for positional rows.
 */
function decodeRows(body: unknown, columns: string[], envelopeKeys: string[]): Array<Record<string, unknown>> {
  const list = pickArray(body, envelopeKeys)
  if (list.length === 0) return []

  // Already objects? Use as-is.
  if (list.every((row) => row != null && typeof row === "object" && !Array.isArray(row))) {
    return list as Array<Record<string, unknown>>
  }

  // Positional arrays — zip with columns.
  if (columns.length > 0 && list.every((row) => Array.isArray(row))) {
    return (list as unknown[][]).map((row) => {
      const obj: Record<string, unknown> = {}
      columns.forEach((col, i) => { obj[col] = row[i] })
      return obj
    })
  }

  return []
}

function objectToPosition(r: Record<string, unknown>, status: "open" | "closed", instrumentMap: Map<string, string>): TLPosition {
  const side = inferSide(r)
  // TL position rows: avgPrice = open price for positions.
  // TL ordersHistory rows: avgPrice = filled execution price.
  const entry = num(r.avgPrice ?? r.openPrice ?? r.entryPrice ?? r.price ?? r.openAvgPrice)
  const exit = num(r.closePrice ?? r.exitPrice ?? r.closeAvgPrice ?? null)
  const idCandidate = r.id ?? r.positionId ?? r.orderId ?? r.ticket ?? r.tradeId

  // Resolve pair from instrument map first, fall back to direct symbol fields.
  const instId = r.tradableInstrumentId != null ? String(r.tradableInstrumentId) : ""
  const symbol =
    (instId && instrumentMap.get(instId))
    ?? (typeof r.symbol === "string" ? r.symbol : "")
    ?? (typeof r.tradableInstrumentName === "string" ? r.tradableInstrumentName : "")
    ?? (typeof r.instrumentName === "string" ? r.instrumentName : "")
    ?? (typeof r.pair === "string" ? r.pair : "")
    ?? ""

  return {
    externalId: idCandidate != null ? String(idCandidate) : "",
    pair: prettyPair(symbol),
    side,
    size: num(r.qty ?? r.filledQty ?? r.quantity ?? r.size ?? r.volume ?? r.lots) ?? 0,
    entryPrice: entry ?? 0,
    stopPrice: num(r.stopLoss ?? r.sl ?? r.stopPrice),
    targetPrice: num(r.takeProfit ?? r.tp ?? r.targetPrice),
    exitPrice: exit,
    pnl: num(r.unrealizedPl ?? r.realizedPnL ?? r.pnl ?? r.profit ?? r.netPnL ?? r.profitLoss),
    status,
    openedAt: tlTimestamp(r.openDate ?? r.createdDate ?? r.openTime ?? r.openedAt ?? r.openTimestamp ?? r.timestamp) ?? new Date().toISOString(),
    closedAt: status === "closed" ? tlTimestamp(r.lastModified ?? r.closeTime ?? r.closedAt ?? r.closeTimestamp ?? r.lastUpdateTimestamp) : null,
    raw: r,
  }
}

function isValid(p: TLPosition): boolean {
  return Boolean(p.externalId) && Boolean(p.pair) && p.entryPrice > 0
}

/** TL timestamps come as either ISO strings or Unix milliseconds. */
function tlTimestamp(v: unknown): string | null {
  if (v == null || v === "") return null
  if (typeof v === "string") {
    if (/^\d+$/.test(v)) return new Date(Number(v)).toISOString()
    return v
  }
  if (typeof v === "number") return new Date(v).toISOString()
  return null
}

// Truncate large bodies so we don't blow up DB rows when storing samples.
function trim(body: unknown): unknown {
  try {
    const json = JSON.stringify(body)
    if (json.length <= 4000) return body
    return { _truncated: true, preview: json.slice(0, 4000) }
  } catch {
    return body
  }
}

function inferSide(r: Record<string, unknown>): "long" | "short" {
  const s = String(r.side ?? r.direction ?? "").toLowerCase()
  if (s.includes("buy") || s.includes("long")) return "long"
  if (s.includes("sell") || s.includes("short")) return "short"
  // Numeric encoding: +1/positive = long, -1/negative = short.
  const sideNum = Number(r.side ?? NaN)
  if (isFinite(sideNum)) return sideNum < 0 ? "short" : "long"
  // Last resort — fall back to qty sign.
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
