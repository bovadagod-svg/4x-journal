import { Icon, type IconName } from "@/components/icons"

export function SectionStub({
  icon,
  title,
  description,
}: {
  icon: IconName
  title: string
  description: string
}) {
  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "48px 24px",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "var(--c-bg-elev-3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--c-fg-muted)",
        }}
      >
        <Icon name={icon} size={26} />
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 600,
        }}
      >
        {title} — coming up next
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--c-fg-muted)",
          maxWidth: 480,
          lineHeight: 1.55,
        }}
      >
        {description}
      </p>
    </div>
  )
}
