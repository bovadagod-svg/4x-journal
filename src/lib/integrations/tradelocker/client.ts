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

export type TLOrderMeta = {
  commission: number | null
  swap: number | null
  tax: number | null
  requestPrice: number | null
  orderType: string | null
  executionType: string | null
  magicNumber: string | null
  comment: string | null
}

/**
 * One event in a position's order history. TL returns one row per
 * (order, status) pair, so the same order ID will appear multiple times
 * as it moves through Placed → Replaced → Triggered → Filled (or
 * Cancelled). The Trade Detail Drawer's Lifecycle tab renders these in
 * chronological order to show the trade's full story including stop-loss
 * adjustments, partial closes, etc.
 */
export type TLLifecycleEvent = {
  occurredAt: string
  orderId: string
  status: string                // 'Placed' | 'Replaced' | 'Triggered' | 'Filled' | 'Cancelled' | other
  type: string                  // 'Market' | 'Limit' | 'Stop' | 'StopLoss' | 'TakeProfit' | other
  side: string                  // 'buy' | 'sell'
  isOpen: boolean | null        // open-side event vs close-side event (null when ambiguous)
  size: number | null           // in lots (broker-native — display-friendly)
  price: number | null          // limit / trigger / stop price for the order
  filledPrice: number | null    // avg fill price (Filled rows only)
  stopLoss: number | null       // SL value carried by this event (null when not applicable)
  takeProfit: number | null     // TP value carried by this event
  raw: Record<string, unknown>
}

/**
 * One filled order on a TradeLocker position. A position can have many of
 * these — typically 1 entry plus N exits when the user scales out, or
 * multiple entries when they scale in.
 */
export type TLOrderFill = {
  /** TL order id — unique per fill, used as our dedup key for trade_fills.external_id. */
  orderId: string
  /** Whether this fill opened or closed the position. */
  kind: "entry" | "exit"
  /** Filled price (avgPrice from TL). */
  price: number
  /** Filled size in units (lots × contractSize). */
  size: number
  /** Filled timestamp. */
  filledAt: string
  /** Per-fill broker fields (commission, swap, etc). */
  meta: TLOrderMeta
}

export type TLPosition = {
  externalId: string
  pair: string
  side: "long" | "short"
  /** Total entry size in units (lots × contractSize). */
  size: number
  /** Volume-weighted average entry price across all entry fills. */
  entryPrice: number
  stopPrice: number | null
  targetPrice: number | null
  /** Volume-weighted average exit price across all exit fills (null when still open). */
  exitPrice: number | null
  pnl: number | null
  status: "open" | "closed"
  /** Earliest entry-fill timestamp. */
  openedAt: string
  /** Latest exit-fill timestamp (null when still open). */
  closedAt: string | null
  /** Units per lot for this instrument. 1 for FX-as-units, 100 for XAU, etc. */
  contractSize: number
  /** Every filled order on this position, in chronological order. */
  fills: TLOrderFill[]
  /** Full chronological order-event timeline (Placed/Replaced/Triggered/Filled/Cancelled). */
  lifecycle: TLLifecycleEvent[]
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
  marginUsed: number | null
  freeMargin: number | null
  marginLevel: number | null
  floatingPnl: number | null
  swapTotal: number | null
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

  // 2) Instruments list — map tradableInstrumentId → { name, primaryRouteId }.
  //    Contract size lives behind a separate per-instrument detail call.
  type InstInfo = { name: string; routeId: string | null; contractSize: number }
  const instrumentMap = new Map<string, InstInfo>()
  try {
    const r = await tlFetch(base, `/trade/accounts/${args.accountId}/instruments`, { headers: baseHeaders })
    attempts.push({ kind: "instruments", path: `/trade/accounts/${args.accountId}/instruments`, ok: true, status: r.status, sample: trim(r.body) })
    for (const inst of pickArray(r.body)) {
      if (inst && typeof inst === "object" && !Array.isArray(inst)) {
        const o = inst as Record<string, unknown>
        const id = String(o.tradableInstrumentId ?? o.id ?? "")
        const sym = String(o.tradableInstrumentName ?? o.name ?? o.symbol ?? "")
        let routeId: string | null = null
        if (Array.isArray(o.routes)) {
          const trade = (o.routes as unknown[]).find((rt) => typeof rt === "object" && rt != null && (rt as Record<string, unknown>).type === "TRADE")
          if (trade && typeof trade === "object") routeId = String((trade as Record<string, unknown>).id ?? "")
        }
        if (id && sym) instrumentMap.set(id, { name: sym, routeId, contractSize: 1 })
      }
    }
  } catch (e) {
    const err = e instanceof TLError ? e : null
    attempts.push({ kind: "instruments", path: `/trade/accounts/${args.accountId}/instruments`, ok: false, status: err?.status, sample: trim(err?.body), error: err?.message ?? String(e) })
  }

  // 2b) Per-instrument detail — fetch contract size for each instrument we
  //     actually traded. This is the fix for "P&L is 100x off on metals":
  //     for XAUUSD on TradeLocker, 1 lot = 100 oz, so we have to multiply
  //     reported qty by contractSize before computing P&L.
  //
  //     We delay this until after we've looked at orders/positions to know
  //     which instruments need details. Done below in tlFetchContractSizes.

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

  // 6) Hydrate contract sizes for every (instrumentId, routeId) we actually
  //    saw in positions or orders. TradeLocker reports qty in *lots*, not
  //    units, so PnL = (entry - exit) × qty × contractSize.
  const seenInstruments = new Set<string>()
  for (const o of [...openObjects, ...closedObjects]) {
    const id = o.tradableInstrumentId != null ? String(o.tradableInstrumentId) : ""
    if (id) seenInstruments.add(id)
  }
  for (const instrumentId of seenInstruments) {
    const info = instrumentMap.get(instrumentId)
    const routeId = info?.routeId ?? "1742612" // TradeLocker's most common trade route
    const path = `/trade/instruments/${instrumentId}?routeId=${routeId}`
    try {
      const r = await tlFetch(base, path, { headers: baseHeaders })
      attempts.push({ kind: "instruments", path, ok: true, status: r.status, sample: trim(r.body) })
      const cs = extractContractSize(r.body)
      if (cs != null && cs > 0 && info) info.contractSize = cs
    } catch (e) {
      const err = e instanceof TLError ? e : null
      attempts.push({ kind: "instruments", path, ok: false, status: err?.status, sample: trim(err?.body), error: err?.message ?? String(e) })
    }
  }

  // Fallback contract sizes for known TL/FunderPro symbols when the detail
  // endpoint doesn't expose one or the field name varies.
  for (const info of instrumentMap.values()) {
    if (info.contractSize === 1) info.contractSize = fallbackContractSize(info.name)
  }

  const closed = reconstructClosedTrades(closedObjects, instrumentMap)

  return {
    open: openObjects.map((o) => objectToPosition(o, "open", instrumentMap)).filter(isValid),
    closed,
    attempts,
    state,
  }
}

/**
 * Pull contract size out of a /trade/instruments/{id} response. TL exposes
 * this under a few different field names depending on instrument type, so
 * we check the common ones in priority order.
 */
function extractContractSize(body: unknown): number | null {
  if (!body || typeof body !== "object") return null
  const root = "d" in body ? (body as { d: unknown }).d : body
  if (!root || typeof root !== "object") return null
  const r = root as Record<string, unknown>
  // Some shapes nest the data under `instrument` or use the value directly.
  const inst = (typeof r.instrument === "object" && r.instrument) ? (r.instrument as Record<string, unknown>) : r
  const candidates = [
    inst.contractSize,
    inst.lotSize,
    inst.contractValue,
    inst.contractMultiplier,
    inst.multiplier,
    inst.quantityMultiplier,
  ]
  for (const v of candidates) {
    const n = num(v)
    if (n != null && n > 0) return n
  }
  return null
}

/**
 * Last-resort contract sizes for common TradeLocker / FunderPro instruments.
 * Only applies when the instruments detail endpoint didn't expose a value.
 */
function fallbackContractSize(symbol: string): number {
  const s = symbol.toUpperCase()
  if (s === "XAUUSD" || s === "GOLD") return 100      // ounces per lot
  if (s === "XAGUSD" || s === "SILVER") return 5000   // ounces per lot
  if (s === "XTIUSD" || s === "USOIL" || s === "WTI") return 1000 // barrels per lot
  if (s === "XBRUSD" || s === "UKOIL" || s === "BRENT") return 1000
  // Indices CFDs are usually $1/$10 per index point per lot. Use 1 as a
  // safer default — the user can correct with manual entry if needed.
  if (/^(US30|NAS100|SPX500|UK100|GER40|DAX|JPN225|FRA40|ESP35|EUSTX50|FTSE100|NDX100)$/.test(s)) return 1
  // Forex pairs: 100,000 base currency per standard lot.
  if (/^[A-Z]{3}\/?[A-Z]{3}$/.test(s)) return 100000
  return 1
}

/**
 * TradeLocker stores orders, not trades. A single position can have many
 * filled orders sharing a positionId:
 *   - 1+ entry orders (isOpen=true) — usually one but the user can scale in
 *   - 0+ exit orders (isOpen=false) — scale-outs + a final close (SL/TP/manual)
 *
 * Cancelled orders are OCO siblings; we ignore them. We emit one trade per
 * position with its full fill list, weighted-average prices, and total size,
 * so the importer can write each fill as a separate trade_fills row and
 * preserve the trade's actual lifecycle.
 */
function reconstructClosedTrades(
  orderRows: Array<Record<string, unknown>>,
  instrumentMap: Map<string, { name: string; contractSize: number }>,
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

    const entries = filled.filter((o) => isTrue(o.isOpen))
    const exits = filled.filter((o) => isFalse(o.isOpen))

    // No closes yet → handled by the /positions endpoint, not /ordersHistory.
    if (exits.length === 0) continue
    // No opens recorded → can't classify side; skip.
    if (entries.length === 0) continue

    // Side comes from the (first) opening order. Buy → long, sell → short.
    const opener = entries[0]
    const side = inferSide(opener)

    // Resolve instrument metadata from the first entry order. All fills on a
    // single position trade the same instrument so this is unambiguous.
    const instId = opener.tradableInstrumentId != null ? String(opener.tradableInstrumentId) : ""
    const info = instId ? instrumentMap.get(instId) : undefined
    const symbol = info?.name ?? ""
    const contractSize = info?.contractSize ?? 1

    // Build per-fill records for every filled order, in chronological order.
    const allFilled = [...filled].sort((a, b) =>
      timestampOf(a) - timestampOf(b),
    )
    const fills: TLOrderFill[] = []
    for (const o of allFilled) {
      const lots = num(o.filledQty ?? o.qty) ?? 0
      const px = num(o.avgPrice ?? o.price)
      const ts = tlTimestamp(o.lastModified ?? o.createdDate)
      const orderId = o.id != null ? String(o.id) : (o.orderId != null ? String(o.orderId) : "")
      if (!orderId || px == null || lots <= 0 || !ts) continue
      fills.push({
        orderId,
        kind: isTrue(o.isOpen) ? "entry" : "exit",
        price: px,
        size: lots * contractSize,
        filledAt: ts,
        meta: extractOrderMeta(o),
      })
    }
    if (fills.length === 0) continue

    // Volume-weighted average prices.
    const entryFills = fills.filter((f) => f.kind === "entry")
    const exitFills = fills.filter((f) => f.kind === "exit")
    const entrySize = entryFills.reduce((s, f) => s + f.size, 0)
    const exitSize = exitFills.reduce((s, f) => s + f.size, 0)
    const entryAvg = entrySize > 0
      ? entryFills.reduce((s, f) => s + f.price * f.size, 0) / entrySize
      : 0
    const exitAvg = exitSize > 0
      ? exitFills.reduce((s, f) => s + f.price * f.size, 0) / exitSize
      : null

    // Stop / target — these change throughout the trade as the user adjusts.
    // Use the most recent values from any closing order's snapshot, falling
    // back to the opener if none of the closers carry them.
    const lastExitOrder = allFilled.filter((o) => isFalse(o.isOpen)).pop() ?? opener
    const stopPrice = num(lastExitOrder.stopLoss) ?? num(opener.stopLoss)
    const targetPrice = num(lastExitOrder.takeProfit) ?? num(opener.takeProfit)

    // Full chronological lifecycle — every status row, sorted by time asc.
    const lifecycle = orders
      .map(toLifecycleEvent)
      .filter((e): e is TLLifecycleEvent => e != null)
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())

    out.push({
      externalId: positionId,
      pair: prettyPair(symbol),
      side,
      size: entrySize,
      entryPrice: entryAvg,
      stopPrice,
      targetPrice,
      exitPrice: exitAvg,
      pnl: null, // computed in the action via finance.ts (units × price diff)
      status: "closed",
      openedAt: entryFills[0]?.filledAt ?? new Date().toISOString(),
      closedAt: exitFills.length > 0 ? exitFills[exitFills.length - 1].filledAt : null,
      contractSize,
      fills,
      lifecycle,
      raw: { entries, exits, allOrders: orders },
    })
  }

  return out.filter(isValid)
}

function timestampOf(o: Record<string, unknown>): number {
  const t = tlTimestamp(o.lastModified ?? o.createdDate)
  return t ? new Date(t).getTime() : 0
}

/**
 * Convert a raw TL order row into a normalized lifecycle event. Used by
 * the importer to populate `trades.lifecycle_events`. Lossy by design —
 * we keep the original row in `raw` so future improvements can pull more
 * fields without re-parsing the broker payload.
 */
function toLifecycleEvent(o: Record<string, unknown>): TLLifecycleEvent | null {
  const occurredAt = tlTimestamp(o.lastModified ?? o.createdDate)
  if (!occurredAt) return null
  const orderId = o.id != null ? String(o.id) : (o.orderId != null ? String(o.orderId) : "")
  const status = String(o.status ?? "").trim() || "unknown"
  const type = inferOrderType(o)
  const sideRaw = o.side != null ? String(o.side).toLowerCase() : ""
  const side = sideRaw.includes("buy") ? "buy" : sideRaw.includes("sell") ? "sell" : sideRaw
  const isOpenRaw = o.isOpen
  const isOpen = typeof isOpenRaw === "boolean" ? isOpenRaw
    : isTrue(isOpenRaw) ? true
    : isFalse(isOpenRaw) ? false
    : null
  // Size — keep raw lots (no contract-size multiplication) since the lifecycle
  // tab is display-only. The trade summary uses units; the lifecycle uses lots.
  const lots = num(o.filledQty ?? o.qty ?? o.quantity)
  const price = num(o.price ?? o.stopPrice ?? o.limitPrice)
  const filledPrice = /fill/i.test(status) ? num(o.avgPrice ?? o.price) : null
  return {
    occurredAt,
    orderId,
    status,
    type,
    side,
    isOpen,
    size: lots,
    price,
    filledPrice,
    stopLoss: num(o.stopLoss ?? o.sl),
    takeProfit: num(o.takeProfit ?? o.tp),
    raw: o,
  }
}

function inferOrderType(o: Record<string, unknown>): string {
  const t = String(o.type ?? o.orderType ?? "").toLowerCase()
  if (t.includes("stoploss") || t === "sl") return "StopLoss"
  if (t.includes("takeprofit") || t === "tp") return "TakeProfit"
  if (t.includes("market")) return "Market"
  if (t.includes("limit")) return "Limit"
  if (t.includes("stop")) return "Stop"
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Other"
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
    marginUsed: num(obj.marginUsed ?? obj.usedMargin ?? obj.margin),
    freeMargin: num(obj.freeMargin ?? obj.marginAvailable ?? obj.availableMargin),
    marginLevel: num(obj.marginLevel ?? obj.marginLevelPct),
    floatingPnl: num(obj.unrealizedPl ?? obj.floatingPl ?? obj.floatingProfitLoss ?? obj.openPl),
    swapTotal: num(obj.swap ?? obj.swapTotal ?? obj.cumulativeSwap),
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

function objectToPosition(
  r: Record<string, unknown>,
  status: "open" | "closed",
  instrumentMap: Map<string, { name: string; contractSize: number }>,
): TLPosition {
  const side = inferSide(r)
  // TL position rows: avgPrice = open price for positions.
  // TL ordersHistory rows: avgPrice = filled execution price.
  const entry = num(r.avgPrice ?? r.openPrice ?? r.entryPrice ?? r.price ?? r.openAvgPrice)
  const exit = num(r.closePrice ?? r.exitPrice ?? r.closeAvgPrice ?? null)
  const idCandidate = r.id ?? r.positionId ?? r.orderId ?? r.ticket ?? r.tradeId

  // Resolve pair from instrument map first, fall back to direct symbol fields.
  const instId = r.tradableInstrumentId != null ? String(r.tradableInstrumentId) : ""
  const info = instId ? instrumentMap.get(instId) : undefined
  const symbol =
    info?.name
    ?? (typeof r.symbol === "string" ? r.symbol : "")
    ?? (typeof r.tradableInstrumentName === "string" ? r.tradableInstrumentName : "")
    ?? (typeof r.instrumentName === "string" ? r.instrumentName : "")
    ?? (typeof r.pair === "string" ? r.pair : "")
    ?? ""
  const contractSize = info?.contractSize ?? 1

  // qty from TL is in *lots* — multiply by contract size to get unit count
  // so finance.computePnL produces the right $ value.
  const lots = num(r.qty ?? r.filledQty ?? r.quantity ?? r.size ?? r.volume ?? r.lots) ?? 0
  const units = lots * contractSize

  const externalId = idCandidate != null ? String(idCandidate) : ""
  const openedAt = tlTimestamp(r.openDate ?? r.createdDate ?? r.openTime ?? r.openedAt ?? r.openTimestamp ?? r.timestamp) ?? new Date().toISOString()

  // Open positions only have the entry fill in /positions. The synthetic
  // "entry" fill uses the position id as orderId since /positions doesn't
  // surface individual order ids.
  const fills: TLOrderFill[] = (entry != null && lots > 0)
    ? [{
        orderId: `${externalId}:open`,
        kind: "entry" as const,
        price: entry,
        size: units,
        filledAt: openedAt,
        meta: extractOrderMeta(r),
      }]
    : []

  return {
    externalId,
    pair: prettyPair(symbol),
    side,
    size: units,
    entryPrice: entry ?? 0,
    stopPrice: num(r.stopLoss ?? r.sl ?? r.stopPrice),
    targetPrice: num(r.takeProfit ?? r.tp ?? r.targetPrice),
    exitPrice: exit,
    pnl: num(r.unrealizedPl ?? r.realizedPnL ?? r.pnl ?? r.profit ?? r.netPnL ?? r.profitLoss),
    status,
    openedAt,
    closedAt: status === "closed" ? tlTimestamp(r.lastModified ?? r.closeTime ?? r.closedAt ?? r.closeTimestamp ?? r.lastUpdateTimestamp) : null,
    contractSize,
    fills,
    lifecycle: [], // /positions endpoint doesn't carry order history; populated for closed trades only
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

function extractOrderMeta(r: Record<string, unknown>): TLOrderMeta {
  const orderTypeRaw = r.orderType ?? r.type ?? r.orderKind
  const executionTypeRaw = r.executionType ?? r.execType ?? r.executionKind
  const magicRaw = r.magicNumber ?? r.magic ?? r.expertId
  const commentRaw = r.comment ?? r.brokerComment ?? r.userComment ?? r.note
  const orderType = typeof orderTypeRaw === "string"
    ? orderTypeRaw.toLowerCase()
    : orderTypeRaw != null ? String(orderTypeRaw).toLowerCase() : null
  return {
    commission: num(r.commission ?? r.commissions ?? r.fee ?? r.fees),
    swap: num(r.swap ?? r.swapTotal ?? r.swapValue ?? r.rollover),
    tax: num(r.tax ?? r.taxes),
    requestPrice: num(r.requestPrice ?? r.requestedPrice ?? r.requested ?? r.priceRequested),
    orderType: orderType && orderType.length > 0 ? orderType : null,
    executionType: typeof executionTypeRaw === "string" && executionTypeRaw
      ? executionTypeRaw.toLowerCase()
      : executionTypeRaw != null ? String(executionTypeRaw).toLowerCase() : null,
    magicNumber: magicRaw != null && magicRaw !== "" ? String(magicRaw) : null,
    comment: typeof commentRaw === "string" && commentRaw ? commentRaw : null,
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

/**
 * Live bid/ask quote for a single TL instrument. TL's quotes endpoint is
 * /trade/quotes/{instrumentId}?routeId=... and returns the latest tick.
 *
 * Returns null on miss / error so callers can skip a single bad symbol
 * without losing the rest of the batch.
 */
export async function tlGetQuote(args: {
  env: TradeLockerEnv
  accessToken: string
  accNum: string
  instrumentId: string
  routeId?: string
}): Promise<{ bid: number | null; ask: number | null; ts: string } | null> {
  const base = TL_BASE_URL[args.env]
  const path = `/trade/quotes/${args.instrumentId}${args.routeId ? `?routeId=${args.routeId}` : ""}`
  try {
    const r = await tlFetch(base, path, {
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        accNum: args.accNum,
        "acc-num": args.accNum,
      },
    })
    const obj = (r.body && typeof r.body === "object" && "d" in r.body
      ? (r.body as { d: unknown }).d
      : r.body) as Record<string, unknown> | null
    if (!obj || typeof obj !== "object") return null
    const o = obj as Record<string, unknown>
    return {
      bid: num(o.bp ?? o.bid ?? o.bidPrice),
      ask: num(o.ap ?? o.ask ?? o.askPrice),
      ts: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/**
 * Modify an open position's SL / TP. Pass null/undefined to leave a side alone.
 * TL accepts PATCH on /trade/positions/{positionId} with body keys
 * stopLoss / takeProfit.
 */
export async function tlModifyPosition(args: {
  env: TradeLockerEnv
  accessToken: string
  accNum: string
  positionId: string
  stopLoss?: number | null
  takeProfit?: number | null
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const base = TL_BASE_URL[args.env]
  const body: Record<string, number> = {}
  if (args.stopLoss != null) body.stopLoss = args.stopLoss
  if (args.takeProfit != null) body.takeProfit = args.takeProfit
  if (Object.keys(body).length === 0) return { ok: false, status: 400, error: "Nothing to modify." }
  try {
    await tlFetch(base, `/trade/positions/${args.positionId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        accNum: args.accNum,
        "acc-num": args.accNum,
      },
      body: JSON.stringify(body),
    })
    return { ok: true }
  } catch (e) {
    if (e instanceof TLError) return { ok: false, status: e.status, error: e.message }
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "TL modify failed" }
  }
}

/**
 * Close an open position at market. TL accepts DELETE on
 * /trade/positions/{positionId}.
 */
export async function tlClosePosition(args: {
  env: TradeLockerEnv
  accessToken: string
  accNum: string
  positionId: string
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const base = TL_BASE_URL[args.env]
  try {
    await tlFetch(base, `/trade/positions/${args.positionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        accNum: args.accNum,
        "acc-num": args.accNum,
      },
    })
    return { ok: true }
  } catch (e) {
    if (e instanceof TLError) return { ok: false, status: e.status, error: e.message }
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "TL close failed" }
  }
}

export { TLError }
