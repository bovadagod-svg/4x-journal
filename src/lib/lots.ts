/**
 * Lot/unit display helpers.
 *
 * Internally `trades.size` is in *units* (lots × contractSize) so P&L math
 * works the same for FX, metals, indices, and crypto. But traders speak in
 * lots — a 0.17 XAU/USD position is "0.17 lots" not "17 ounces".
 *
 * This helper picks the right display mode based on `contract_size`:
 *   - contract_size = 1 → show units directly ("100,000")
 *   - contract_size > 1 → show lots ("0.17 lots") computed as size / contract_size
 *
 * For trades imported before contract_size existed (column default = 1),
 * the unit display is correct as-is.
 */

export function formatLotsOrSize(
  size: number | string | null | undefined,
  contractSize: number | string | null | undefined,
  opts: { withUnit?: boolean } = {},
): string {
  const s = size == null ? 0 : Number(size)
  const cs = contractSize == null ? 1 : Number(contractSize)
  if (!isFinite(s) || s === 0) return "—"
  const withUnit = opts.withUnit ?? true

  if (!isFinite(cs) || cs <= 1) {
    // Unit-native display. Use thousands separators for legibility.
    return s.toLocaleString("en-US", { maximumFractionDigits: 2 })
  }

  const lots = s / cs
  // Lots typically have 2 decimals on retail platforms; show 3 only when needed.
  const decimals = lots < 0.1 ? 3 : 2
  const formatted = lots.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return withUnit ? `${formatted} lots` : formatted
}

/**
 * Pure conversion — units to lots — for math contexts (sizing forms,
 * imports, etc) that want the raw lots number.
 */
export function unitsToLots(size: number, contractSize: number): number {
  if (!isFinite(contractSize) || contractSize <= 0) return size
  return size / contractSize
}

export function lotsToUnits(lots: number, contractSize: number): number {
  if (!isFinite(contractSize) || contractSize <= 0) return lots
  return lots * contractSize
}
