/**
 * FIFO tax-lot matcher → IRS Form 8949 line items.
 *
 * The system stores round-trip trades (one row per opened+closed cycle), so
 * "FIFO matching" here is straightforward: each closed trade becomes one
 * Form 8949 row. The interesting work is:
 *
 *   1. Holding-period split (short-term < 1 year, long-term ≥ 1 year)
 *   2. Wash-sale flagging — losing trades where a same-pair, same-side
 *      replacement opens within 30 days before or after the close date
 *   3. Per-trade fee + swap inclusion to land at "true" cost basis / proceeds
 *
 * Pure functions, framework-free, no I/O.
 */

export type TaxTradeInput = {
  id: string
  pair: string
  side: "long" | "short"
  size: number
  entry_price: number
  exit_price: number | null
  opened_at: string
  closed_at: string | null
  /** Realized P&L the system already computed (gross, before broker costs). */
  pnl: number | null
  /** Sum of commissions across this trade's fills, when broker reported them. */
  commission_total?: number | null
  /** Sum of swap across this trade's fills. */
  swap_total?: number | null
}

export type Form8949Row = {
  /**
   * Box A/B/C (short-term) or Box D/E/F (long-term).
   * Mode A/D = reported with basis, B/E = without basis, C/F = not on a 1099-B.
   * For self-reported FX trades we use C / F.
   */
  box: "C" | "F"
  /** "Description of property" — column (a). Example: "EUR/USD long 100,000 units". */
  description: string
  /** "Date acquired" — column (b). MM/DD/YYYY for IRS. */
  dateAcquired: string
  /** "Date sold or disposed of" — column (c). */
  dateSold: string
  /** "Proceeds" — column (d). Gross proceeds in USD. */
  proceeds: number
  /** "Cost or other basis" — column (e). */
  costBasis: number
  /** "Code" — column (f). "W" for wash sale. Empty otherwise. */
  code: string
  /** "Amount of adjustment" — column (g). Positive when wash-sale loss is disallowed. */
  adjustment: number
  /** "Gain or (loss)" — column (h). proceeds − costBasis + adjustment. */
  gainLoss: number
  /** Internal: original trade id, preserved for reconciliation. */
  tradeId: string
  /** Internal: "short_term" or "long_term". Mirrors box selection. */
  holdingPeriod: "short_term" | "long_term"
}

export type Form8949Result = {
  rows: Form8949Row[]
  totals: {
    shortTermProceeds: number
    shortTermBasis: number
    shortTermGain: number
    longTermProceeds: number
    longTermBasis: number
    longTermGain: number
    washSaleAdjustment: number
  }
}

const ONE_YEAR_MS = 365 * 86_400_000
const WASH_WINDOW_MS = 30 * 86_400_000

/**
 * Convert a list of closed trades into Form 8949 rows.
 *
 * Wash-sale matching:
 *   - Only applies to losing trades.
 *   - Looks for any other trade on the same `pair` and `side` whose
 *     `opened_at` falls within ±30 days of the losing trade's `closed_at`.
 *   - When matched, the loss is disallowed: column (g) carries +abs(loss),
 *     and column (h) becomes 0.
 *
 * Wash-sale rules don't strictly apply to forex Section 988 ordinary-income
 * elections — the caller (`form-8949` route) only emits this for users who
 * elect §1256 or non-988 treatment.
 */
export function matchLots(
  trades: TaxTradeInput[],
  opts: { applyWashSale?: boolean } = {},
): Form8949Result {
  const applyWashSale = opts.applyWashSale ?? true

  // Drop unclosed/incomplete trades — Form 8949 is realized only.
  const closed = trades.filter(
    (t) => t.exit_price != null && t.closed_at && t.opened_at && t.pnl != null,
  )

  // Index by (pair|side) for wash-sale neighborhood lookups.
  const byPairSide = new Map<string, TaxTradeInput[]>()
  for (const t of closed) {
    const key = `${t.pair.toUpperCase()}|${t.side}`
    let arr = byPairSide.get(key)
    if (!arr) { arr = []; byPairSide.set(key, arr) }
    arr.push(t)
  }

  const rows: Form8949Row[] = []

  for (const t of closed) {
    const opened = new Date(t.opened_at).getTime()
    const closedAt = new Date(t.closed_at!).getTime()
    const longTerm = closedAt - opened >= ONE_YEAR_MS
    const box: "C" | "F" = longTerm ? "F" : "C"

    const commission = t.commission_total ?? 0
    const swap = t.swap_total ?? 0

    // Costs reduce proceeds (commission paid on the closing fill counts as
    // selling expense; swap is a financing cost. We bundle both into proceeds
    // so the resulting gain/loss matches the user's broker statement net.)
    const grossPnl = Number(t.pnl)
    const netPnl = grossPnl - Math.abs(commission) - Math.abs(swap)

    // For FX, "proceeds" and "cost basis" don't map cleanly to share-based
    // accounting; we synthesize them so proceeds − basis = net P&L.
    // Use entry-price × size as basis (notional at entry), and basis + netPnl
    // as proceeds. This keeps the P&L correct on the form.
    const basis = Number((t.entry_price * t.size).toFixed(2))
    const proceeds = Number((basis + netPnl).toFixed(2))

    let code = ""
    let adjustment = 0
    let gainLoss = Number(netPnl.toFixed(2))

    if (applyWashSale && netPnl < 0) {
      const key = `${t.pair.toUpperCase()}|${t.side}`
      const peers = byPairSide.get(key) ?? []
      const replacementOpen = peers.some((p) => {
        if (p.id === t.id) return false
        const pOpened = new Date(p.opened_at).getTime()
        return Math.abs(pOpened - closedAt) <= WASH_WINDOW_MS
      })
      if (replacementOpen) {
        code = "W"
        // Disallow the loss: adjustment positive of equal magnitude.
        adjustment = Math.abs(gainLoss)
        gainLoss = 0
      }
    }

    const description = formatDescription(t)
    rows.push({
      box,
      description,
      dateAcquired: formatIrsDate(t.opened_at),
      dateSold: formatIrsDate(t.closed_at!),
      proceeds,
      costBasis: basis,
      code,
      adjustment,
      gainLoss,
      tradeId: t.id,
      holdingPeriod: longTerm ? "long_term" : "short_term",
    })
  }

  // Sort by date sold ascending — IRS expects chronological order on the form.
  rows.sort((a, b) => parseIrsDate(a.dateSold) - parseIrsDate(b.dateSold))

  let stProceeds = 0, stBasis = 0, stGain = 0, ltProceeds = 0, ltBasis = 0, ltGain = 0, wash = 0
  for (const r of rows) {
    if (r.holdingPeriod === "short_term") {
      stProceeds += r.proceeds
      stBasis += r.costBasis
      stGain += r.gainLoss
    } else {
      ltProceeds += r.proceeds
      ltBasis += r.costBasis
      ltGain += r.gainLoss
    }
    wash += r.adjustment
  }

  return {
    rows,
    totals: {
      shortTermProceeds: round2(stProceeds),
      shortTermBasis: round2(stBasis),
      shortTermGain: round2(stGain),
      longTermProceeds: round2(ltProceeds),
      longTermBasis: round2(ltBasis),
      longTermGain: round2(ltGain),
      washSaleAdjustment: round2(wash),
    },
  }
}

export function form8949CsvHeaders(): string[] {
  return [
    "Box",
    "(a) Description of property",
    "(b) Date acquired",
    "(c) Date sold",
    "(d) Proceeds",
    "(e) Cost basis",
    "(f) Code",
    "(g) Amount of adjustment",
    "(h) Gain or (loss)",
    "Holding period",
    "Trade ID",
  ]
}

export function form8949CsvRow(r: Form8949Row): (string | number)[] {
  return [
    r.box,
    r.description,
    r.dateAcquired,
    r.dateSold,
    r.proceeds.toFixed(2),
    r.costBasis.toFixed(2),
    r.code,
    r.adjustment.toFixed(2),
    r.gainLoss.toFixed(2),
    r.holdingPeriod,
    r.tradeId,
  ]
}

function formatDescription(t: TaxTradeInput): string {
  const sideWord = t.side === "long" ? "long" : "short"
  const size = Number.isInteger(t.size) ? t.size.toString() : t.size.toFixed(2)
  return `${t.pair} ${sideWord} ${size} units @ ${Number(t.entry_price).toFixed(5)}`
}

function formatIrsDate(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${mm}/${dd}/${d.getUTCFullYear()}`
}

function parseIrsDate(s: string): number {
  const [mm, dd, yyyy] = s.split("/")
  return Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd))
}

function round2(n: number): number {
  return Number(n.toFixed(2))
}
