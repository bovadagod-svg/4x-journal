/**
 * Currency-aware money formatting + FX conversion.
 *
 * Rates are stored in user_settings.fx_rates as a flat map keyed by `${FROM}->${TO}`.
 * We always treat same-currency conversions as 1.0, and fall back to 1.0 for unset
 * rates with a `wasConverted: false` flag so callers can decide whether to show
 * a conversion warning.
 *
 * No external API call from this module — rates are user-managed via Settings.
 * If a rate is missing, the value renders in source currency (no silent 1:1).
 */

export type FxRates = Record<string, number>

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CHF: "CHF",
  AUD: "A$", CAD: "C$", NZD: "NZ$", SGD: "S$", AED: "د.إ",
}

/**
 * Convert an amount between currencies using the user's rates map.
 * If from === to, returns amount unchanged.
 * If a direct rate exists, uses it.
 * If only the reverse rate exists, takes the reciprocal.
 * Otherwise returns null (caller decides — usually fall back to source currency).
 */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: FxRates,
): { value: number; wasConverted: boolean } | null {
  const f = from.toUpperCase()
  const t = to.toUpperCase()
  if (f === t) return { value: amount, wasConverted: false }
  const direct = rates[`${f}->${t}`]
  if (typeof direct === "number" && direct > 0) {
    return { value: amount * direct, wasConverted: true }
  }
  const reverse = rates[`${t}->${f}`]
  if (typeof reverse === "number" && reverse > 0) {
    return { value: amount / reverse, wasConverted: true }
  }
  return null
}

/**
 * Format an amount in a specific currency. Uses Intl.NumberFormat for
 * built-in currencies (USD/EUR/GBP/JPY/etc); falls back to symbol + digits.
 */
export function formatMoney(
  amount: number,
  currency: string = "USD",
  opts: { signed?: boolean; min?: number; max?: number } = {},
): string {
  const { signed = false, max = 2, min = 2 } = opts
  const sign = signed && amount > 0 ? "+" : ""
  try {
    return `${sign}${amount.toLocaleString("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    })}`
  } catch {
    // Unknown ISO code — fall back to symbol or code prefix.
    const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `
    return `${sign}${symbol}${Math.abs(amount).toLocaleString("en-US", {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    })}${amount < 0 ? "" : ""}`
  }
}

/**
 * Convert + format in one step. If the rate is missing, renders in source
 * currency (no conversion) — this is honest behavior: we never silently
 * pretend GBP = USD.
 */
export function formatMoneyConverted(
  amount: number,
  fromCurrency: string,
  displayCurrency: string,
  rates: FxRates,
  opts: { signed?: boolean } = {},
): { display: string; converted: boolean } {
  const result = convert(amount, fromCurrency, displayCurrency, rates)
  if (!result) {
    return { display: formatMoney(amount, fromCurrency, opts), converted: false }
  }
  return {
    display: formatMoney(result.value, displayCurrency, opts),
    converted: result.wasConverted,
  }
}

/**
 * Sum an array of amounts in mixed currencies, converting each to displayCurrency.
 * Returns the total + a list of any source currencies that couldn't be converted
 * (so the caller can warn the user that rates are missing).
 */
export function sumInDisplayCurrency(
  rows: Array<{ amount: number; currency: string }>,
  displayCurrency: string,
  rates: FxRates,
): { total: number; missingRates: string[] } {
  const missing = new Set<string>()
  let total = 0
  for (const r of rows) {
    if (!r.amount) continue
    const out = convert(r.amount, r.currency, displayCurrency, rates)
    if (out) {
      total += out.value
    } else {
      // Rate is missing — skip this row's contribution and warn.
      missing.add(r.currency.toUpperCase())
    }
  }
  return { total, missingRates: Array.from(missing).sort() }
}

/**
 * Validate a rate map shape coming from JSON. Returns a sanitized FxRates.
 */
export function parseFxRates(raw: unknown): FxRates {
  if (!raw || typeof raw !== "object") return {}
  const out: FxRates = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue
    if (!/^[A-Z]{3,4}->[A-Z]{3,4}$/.test(key)) continue
    out[key] = value
  }
  return out
}
