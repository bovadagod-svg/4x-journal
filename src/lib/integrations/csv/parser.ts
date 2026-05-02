import Papa from "papaparse"

/**
 * CSV parser + column-mapping helper for trade history imports.
 *
 * Strategy:
 *   1. Parse the file with papaparse, header-on, with type guessing off (we
 *      coerce numbers ourselves to keep validation explicit).
 *   2. Auto-detect each column by header name against a list of candidates.
 *   3. The user can override any auto-detected mapping in the UI before
 *      confirming the import.
 *
 * We support a wide set of header aliases to cover MT4/MT5/cTrader/FunderPro
 * exports without forcing users to clean up their CSV beforehand.
 */

export type ParsedField =
  | "pair"
  | "side"
  | "entry_price"
  | "stop_price"
  | "target_price"
  | "exit_price"
  | "size"
  | "pnl"
  | "opened_at"
  | "closed_at"
  | "external_id"
  | "notes"

const HEADER_ALIASES: Record<ParsedField, string[]> = {
  pair: ["pair", "symbol", "instrument", "ticker", "market", "asset"],
  side: ["side", "direction", "type", "buy/sell", "buysell", "action"],
  entry_price: ["entry", "entry_price", "entryprice", "open_price", "openprice", "open price", "open"],
  stop_price: ["stop", "stop_price", "stoploss", "stop loss", "sl"],
  target_price: ["target", "target_price", "takeprofit", "take profit", "tp"],
  exit_price: ["exit", "exit_price", "exitprice", "close_price", "closeprice", "close price", "close"],
  size: ["size", "volume", "lots", "quantity", "qty", "amount", "units"],
  pnl: ["pnl", "p&l", "profit", "profit/loss", "net_profit", "net profit", "result"],
  opened_at: ["opened_at", "open_time", "open time", "open date", "entry_time", "entry time", "opentime", "datetime", "date"],
  closed_at: ["closed_at", "close_time", "close time", "close date", "exit_time", "exit time", "closetime"],
  external_id: ["id", "ticket", "deal", "order_id", "orderid", "trade id", "trade_id"],
  notes: ["notes", "comment", "comments", "description"],
}

export type ColumnMap = Partial<Record<ParsedField, string>> // field -> CSV header

export type ParseResult = {
  headers: string[]
  rows: Record<string, string>[]
  /** Auto-detected field-to-header mapping. User can override any of these. */
  autoMap: ColumnMap
  /** First row of data, for preview. */
  sample: Record<string, string> | null
}

/**
 * Parse a CSV file into headers + rows. Returns auto-mapping for known fields.
 */
export async function parseCsvFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const headers = results.meta.fields ?? []
        const rows = results.data
        const autoMap = autoMapColumns(headers)
        resolve({
          headers,
          rows,
          autoMap,
          sample: rows[0] ?? null,
        })
      },
      error: (err) => reject(err),
    })
  })
}

function autoMapColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {}
  const lcHeaders = headers.map((h) => h.toLowerCase().trim())
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [ParsedField, string[]][]) {
    for (const alias of aliases) {
      const idx = lcHeaders.indexOf(alias)
      if (idx >= 0) {
        map[field] = headers[idx]
        break
      }
    }
  }
  return map
}

export type NormalizedTrade = {
  pair: string
  side: "long" | "short"
  entry_price: number
  stop_price: number | null
  target_price: number | null
  exit_price: number | null
  size: number
  pnl: number | null
  opened_at: string | null
  closed_at: string | null
  external_id: string | null
  notes: string | null
  // Per-row issue we couldn't fix (skipped in import). Empty = clean.
  issue?: string
}

/**
 * Normalize raw CSV rows into trade-shaped records using the column map.
 * Rows with critical missing data (no pair, side, entry price, or size) are
 * marked with `issue` and excluded from the import; UI shows them so user
 * knows what was skipped.
 */
export function normalizeRows(rows: Record<string, string>[], map: ColumnMap): NormalizedTrade[] {
  return rows.map((row) => {
    const get = (field: ParsedField): string => {
      const header = map[field]
      if (!header) return ""
      return (row[header] ?? "").trim()
    }

    const pair = normalizePair(get("pair"))
    const side = normalizeSide(get("side"))
    const entry = parseNumber(get("entry_price"))
    const size = parseNumber(get("size"))

    if (!pair) return { ...emptyTrade(), issue: "missing pair" }
    if (!side) return { ...emptyTrade(), pair, issue: "unknown side" }
    if (entry == null) return { ...emptyTrade(), pair, side, issue: "invalid entry price" }
    if (size == null || size <= 0) return { ...emptyTrade(), pair, side, entry_price: entry, issue: "invalid size" }

    return {
      pair,
      side,
      entry_price: entry,
      stop_price: parseNumber(get("stop_price")),
      target_price: parseNumber(get("target_price")),
      exit_price: parseNumber(get("exit_price")),
      size,
      pnl: parseNumber(get("pnl")),
      opened_at: parseTimestamp(get("opened_at")),
      closed_at: parseTimestamp(get("closed_at")),
      external_id: get("external_id") || null,
      notes: get("notes") || null,
    }
  })
}

function emptyTrade(): NormalizedTrade {
  return {
    pair: "",
    side: "long",
    entry_price: 0,
    stop_price: null,
    target_price: null,
    exit_price: null,
    size: 0,
    pnl: null,
    opened_at: null,
    closed_at: null,
    external_id: null,
    notes: null,
  }
}

function normalizePair(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/\s+/g, "")
  if (!cleaned) return ""
  // Insert a slash if the pair is 6+ chars without one (EURUSD → EUR/USD)
  if (!cleaned.includes("/") && /^[A-Z]{6,}$/.test(cleaned)) {
    if (cleaned.length === 6) return `${cleaned.slice(0, 3)}/${cleaned.slice(3)}`
    if (cleaned.length === 7 && cleaned.startsWith("XAU")) return "XAU/USD"
  }
  return cleaned
}

function normalizeSide(raw: string): "long" | "short" | null {
  const r = raw.toLowerCase().trim()
  if (["long", "buy", "b", "1", "bid"].includes(r)) return "long"
  if (["short", "sell", "s", "0", "-1", "ask"].includes(r)) return "short"
  return null
}

function parseNumber(raw: string): number | null {
  if (!raw) return null
  // Strip thousands separators / currency symbols
  const cleaned = raw.replace(/[$,£€¥]/g, "").replace(/\s/g, "")
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseTimestamp(raw: string): string | null {
  if (!raw) return null
  // Try ISO first
  const iso = new Date(raw)
  if (!isNaN(iso.getTime())) return iso.toISOString()
  // MT4/5 typical: "2026.04.12 14:30:00"
  const mt = raw.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/)
  if (mt) {
    const [, y, mo, d, h, mi, s] = mt
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0))
    if (!isNaN(dt.getTime())) return dt.toISOString()
  }
  return null
}
