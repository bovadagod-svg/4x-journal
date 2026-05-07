import { Icon, type IconName } from "@/components/icons"

/**
 * Shared narrative banner used by analytics cards. Replaces the copy-pasted
 * `<div style={padding:10, background:"rgba(...)", border:"1px solid rgba(...)"} />`
 * pattern in ~10 cards. Centralizes the visual language so a tone tweak in
 * one place updates the whole product.
 *
 * Tone palette:
 *   - "bad" / "warn" — amber border + faint amber bg, flame/info icon
 *   - "good" — green border + faint green bg, sparkle icon
 *   - "info" — purple border + faint purple bg, info icon
 */
export type NarrativeTone = "bad" | "warn" | "good" | "info"

const STYLES: Record<NarrativeTone, { bg: string; border: string; iconColor: string; defaultIcon: IconName }> = {
  bad:  { bg: "rgba(190, 51, 61, 0.06)",  border: "rgba(190, 51, 61, 0.25)",  iconColor: "var(--c-red-bright)",   defaultIcon: "flame"   },
  warn: { bg: "rgba(229, 162, 59, 0.06)", border: "rgba(229, 162, 59, 0.25)", iconColor: "var(--c-amber)",        defaultIcon: "info"    },
  good: { bg: "rgba(17, 196, 88, 0.06)",  border: "rgba(17, 196, 88, 0.25)",  iconColor: "var(--c-green-bright)", defaultIcon: "sparkle" },
  info: { bg: "rgba(67, 18, 160, 0.06)",  border: "rgba(105, 50, 212, 0.25)", iconColor: "var(--c-purple-bright)", defaultIcon: "info"   },
}

export function NarrativeBanner({
  tone,
  icon,
  children,
  style,
}: {
  tone: NarrativeTone
  icon?: IconName
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const s = STYLES[tone]
  return (
    <div style={{
      padding: 10,
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: 8,
      fontSize: 12,
      color: "var(--c-fg-muted)",
      display: "flex",
      alignItems: "center",
      gap: 8,
      ...style,
    }}>
      <Icon name={icon ?? s.defaultIcon} size={13} color={s.iconColor} />
      <span>{children}</span>
    </div>
  )
}
