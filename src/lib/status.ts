export type MarginStatus = "green" | "amber" | "red" | "black" | "muted"

export function marginStatusColor(level: number | null | undefined): MarginStatus {
  if (level == null) return "muted"
  if (level < 100) return "black"
  if (level < 150) return "red"
  if (level < 300) return "amber"
  return "green"
}

export const MARGIN_COLOR_VAR: Record<MarginStatus, string> = {
  green: "var(--c-green-bright)",
  amber: "var(--c-amber)",
  red: "var(--c-red-bright)",
  black: "var(--c-fg-strong)",
  muted: "var(--c-fg-muted)",
}

export const MARGIN_BG_VAR: Record<MarginStatus, string> = {
  green: "rgba(17,196,88,0.12)",
  amber: "rgba(255,176,32,0.14)",
  red: "rgba(190,51,61,0.14)",
  black: "rgba(0,0,0,0.18)",
  muted: "rgba(255,255,255,0.06)",
}
