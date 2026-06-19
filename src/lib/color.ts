/**
 * Apply alpha to any CSS color — including a `var(--…)` reference, where the
 * common `${color}33` hex-suffix trick is INVALID CSS (it silently drops the
 * whole declaration, so borders/backgrounds just don't render).
 *
 * Uses `color-mix`, supported in all current evergreen browsers.
 *
 *   withAlpha("var(--c-green-bright)", 20) → "color-mix(in srgb, var(--c-green-bright) 20%, transparent)"
 *
 * Rough hex-suffix → percentage equivalents: 22≈13, 33≈20, 44≈27, 55≈33.
 */
export function withAlpha(color: string, pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct))
  return `color-mix(in srgb, ${color} ${clamped}%, transparent)`
}
