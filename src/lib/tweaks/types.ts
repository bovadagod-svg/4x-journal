export type Theme = "dark" | "light"
export type Accent = "purple" | "green" | "red"
export type Density = "compact" | "regular" | "spacious"

export type Tweaks = {
  theme: Theme
  accent: Accent
  density: Density
  emptyState: boolean
  accountScope: string
}

export const TWEAK_DEFAULTS: Tweaks = {
  theme: "dark",
  accent: "purple",
  density: "regular",
  emptyState: false,
  accountScope: "all",
}
