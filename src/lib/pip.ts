/**
 * Pip math for FX, metals, indices, crypto.
 *
 * Conventions used here (industry standard for spot retail):
 *   - Most majors / minors / crosses: 1 pip = 0.0001
 *   - JPY pairs:                       1 pip = 0.01     (2-decimal prices)
 *   - XAU / XAG (metals):              1 pip = 0.10     (so $50 move = 500 pips)
 *   - BTC and other crypto:            1 pip = 1.00     (treat as $-per-unit)
 *   - Indices like US100, US500:       1 pip = 1.00
 *
 * Some brokers number gold pips differently (1 pip = $0.01 instead of $0.10).
 * If the user reports surprising numbers, this is the knob to turn — for now
 * we go with the more common 0.10 convention used by FunderPro/FTMO/MT4.
 *
 * All functions are pure + framework-free → safe to import anywhere.
 */

export type Pair = string

const JPY_RE = /JPY/i
const METAL_RE = /^(XAU|XAG|XPT|XPD)/i
const CRYPTO_RE = /^(BTC|ETH|LTC|XRP|BCH|ADA|SOL|DOGE)/i
const INDEX_RE = /^(US|UK|GER|FRA|JPN|HK)\d{2,}|^(SPX|NDX|DJI|DAX|FTSE|N225)/i

/**
 * Smallest price increment that counts as 1 pip for the given pair.
 *
 *   pipSize("EUR/USD") === 0.0001
 *   pipSize("USD/JPY") === 0.01
 *   pipSize("XAU/USD") === 0.10
 *   pipSize("BTC/USD") === 1
 */
export function pipSize(pair: Pair): number {
  const p = pair.toUpperCase().replace("/", "")
  if (CRYPTO_RE.test(p) || INDEX_RE.test(p)) return 1
  if (METAL_RE.test(p)) return 0.10
  if (JPY_RE.test(p)) return 0.01
  return 0.0001
}

/**
 * Absolute pip distance between two prices for a pair.
 * Sign-agnostic — if you want signed (long vs short), wrap with your side
 * logic at the caller.
 */
export function pipsBetween(priceA: number, priceB: number, pair: Pair): number {
  const size = pipSize(pair)
  return Math.abs(priceA - priceB) / size
}

/**
 * Stop-loss distance in pips for a trade. Returns null if either price is
 * missing or the stop is on the wrong side (entry below stop on a long).
 */
export function slPips(args: { side: "long" | "short"; entry: number; stop: number | null | undefined; pair: Pair }): number | null {
  if (args.stop == null) return null
  const wrongSide = args.side === "long" ? args.stop >= args.entry : args.stop <= args.entry
  if (wrongSide) return null
  return Number(pipsBetween(args.entry, args.stop, args.pair).toFixed(1))
}

/**
 * Take-profit distance in pips. Same sanity guards as slPips.
 */
export function tpPips(args: { side: "long" | "short"; entry: number; target: number | null | undefined; pair: Pair }): number | null {
  if (args.target == null) return null
  const wrongSide = args.side === "long" ? args.target <= args.entry : args.target >= args.entry
  if (wrongSide) return null
  return Number(pipsBetween(args.entry, args.target, args.pair).toFixed(1))
}

/**
 * Realized pips on a closed trade (entry → exit). Signed: positive when the
 * trade went in your favor regardless of side.
 */
export function realizedPips(args: { side: "long" | "short"; entry: number; exit: number | null | undefined; pair: Pair }): number | null {
  if (args.exit == null) return null
  const move = args.side === "long" ? args.exit - args.entry : args.entry - args.exit
  return Number((move / pipSize(args.pair)).toFixed(1))
}

/**
 * Format a pip count for UI: "+45.0p" / "-12.5p" / "—".
 */
export function formatPips(p: number | null, opts: { signed?: boolean } = {}): string {
  if (p == null) return "—"
  const sign = opts.signed && p > 0 ? "+" : ""
  return `${sign}${p.toFixed(1)}p`
}

/**
 * Bucket a pip value into a human-readable range. Used for distribution
 * histograms and win-rate-by-bucket tables.
 *
 * Buckets are heuristic — tuned to match how Forex traders typically think
 * about stop sizes. Adjust these if your data clusters in a different range.
 */
export function pipBucket(pips: number, pair: Pair): string {
  const isJpyOrMetal = JPY_RE.test(pair) || METAL_RE.test(pair) || CRYPTO_RE.test(pair) || INDEX_RE.test(pair)
  // Use wider buckets for high-pip-count instruments
  if (isJpyOrMetal) {
    if (pips < 20) return "<20"
    if (pips < 50) return "20–49"
    if (pips < 100) return "50–99"
    if (pips < 200) return "100–199"
    return "200+"
  }
  if (pips < 10) return "<10"
  if (pips < 20) return "10–19"
  if (pips < 30) return "20–29"
  if (pips < 50) return "30–49"
  if (pips < 100) return "50–99"
  return "100+"
}

/**
 * For sorting bucket labels into the natural numeric order. Returns the
 * lower bound of each bucket for comparison.
 */
export function bucketSortKey(label: string): number {
  if (label.startsWith("<")) return -1
  if (label.endsWith("+")) return 9999
  const m = label.match(/^(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

/**
 * Pip value in account currency for a given fill. Used for #60 — captured at
 * fill time so every "average pips" analytic stays currency-correct without
 * downstream conversion.
 *
 * Math:
 *   pip value (quote currency) = pipSize(pair) × sizeUnits
 *   pip value (account currency) = pip value (quote) × FX rate (quote → account)
 *
 * For USD-quoted FX (XYZ/USD), quote == USD so the FX rate is 1 when the
 * account is USD. For non-USD-quoted (USD/JPY, EUR/JPY, indices, metals
 * priced in non-account currency), the caller supplies the rate map.
 *
 * Returns null when no plausible rate can be derived (e.g. metals/indices
 * with no rate set, or unrecognized currency in the pair string).
 */
export function pipValueInAccountCurrency(args: {
  pair: Pair
  /** Position size in instrument units (lots × contract_size). */
  sizeUnits: number
  accountCurrency: string
  /** User-supplied FX rate map keyed `FROM->TO`, e.g. {"JPY->USD": 0.0067}. */
  fxRates: Record<string, number>
}): number | null {
  const pair = args.pair.toUpperCase()
  const acct = args.accountCurrency.toUpperCase()
  const pipQuote = pipSize(pair) * args.sizeUnits

  const split = pair.replace("/", " ").trim().split(/\s+/)
  // Standard FX format is "XYZ/USD" (or "XYZ-USD"); the trailing 3-letter
  // chunk is the quote currency. Indices/crypto often use single-token
  // tickers — return null for those, the caller will store NULL.
  let quote: string | null = null
  if (split.length >= 2 && split[split.length - 1].length >= 3) {
    quote = split[split.length - 1]
  } else {
    const m = pair.match(/[A-Z]{3}$/)
    quote = m ? m[0] : null
  }
  if (!quote) return null

  // Account currency match — no conversion needed.
  if (quote === acct) return Number(pipQuote.toFixed(4))

  // Look up direct rate (quote → account) or fall back to inverse.
  const direct = args.fxRates[`${quote}->${acct}`]
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) {
    return Number((pipQuote * direct).toFixed(4))
  }
  const inverse = args.fxRates[`${acct}->${quote}`]
  if (typeof inverse === "number" && Number.isFinite(inverse) && inverse > 0) {
    return Number((pipQuote / inverse).toFixed(4))
  }
  return null
}
