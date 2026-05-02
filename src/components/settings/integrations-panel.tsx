"use client"

import { Icon } from "@/components/icons"
import { SettingsSection, SettingsRow } from "./settings-primitives"
import { WebhookSection } from "./webhook-section"

export function IntegrationsPanel({
  userId, secret, baseUrl,
}: {
  userId: string
  secret: string | null
  baseUrl: string
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SettingsSection icon="lightning" title="TradingView webhooks" subtitle="Pipe alerts directly into your journal as candidate trades">
        <WebhookSection userId={userId} secret={secret} baseUrl={baseUrl} />
      </SettingsSection>

      <SettingsSection icon="bell" title="Chat & notifications" subtitle="Where to send trade events">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
          <RoadmapTile name="Discord" desc="Drop trade events to a private channel" />
          <RoadmapTile name="Slack" desc="Pipe daily P&L into a workspace" />
          <RoadmapTile name="Telegram" desc="Mobile-first push to a personal bot" />
        </div>
      </SettingsSection>

      <SettingsSection icon="calendar" title="Calendars" subtitle="Block out trading windows and economic events">
        <SettingsRow label="Google Calendar" hint="Sync sessions and high-impact news to your calendar">
          <button disabled className="btn" style={{ opacity: 0.5, cursor: "not-allowed" }}>
            <Icon name="external" size={12} />
            <span>Coming soon</span>
          </button>
        </SettingsRow>
        <SettingsRow label="iCal feed" hint="Subscribable calendar URL with your tracked events" last>
          <button disabled className="btn" style={{ opacity: 0.5, cursor: "not-allowed" }}>
            <Icon name="external" size={12} />
            <span>Coming soon</span>
          </button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection icon="external" title="Data feeds & exports">
        <SettingsRow label="Auto-export weekly snapshot" hint="Drops a CSV into your connected drive every Sunday">
          <button disabled className="btn" style={{ opacity: 0.5, cursor: "not-allowed" }}>Coming soon</button>
        </SettingsRow>
        <SettingsRow label="Push trade events to Zapier">
          <button disabled className="btn" style={{ opacity: 0.5, cursor: "not-allowed" }}>Coming soon</button>
        </SettingsRow>
        <SettingsRow label="API access" hint="Read-only personal access token for your own scripts" last>
          <button disabled className="btn" style={{ opacity: 0.5, cursor: "not-allowed" }}>Coming soon</button>
        </SettingsRow>
      </SettingsSection>
    </div>
  )
}

function RoadmapTile({ name, desc }: { name: string; desc: string }) {
  return (
    <div style={{
      padding: 12,
      background: "var(--c-bg-elev-2)",
      border: "1px solid var(--c-border)",
      borderRadius: 10,
      opacity: 0.65,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: 11, color: "var(--c-fg-muted)", marginTop: 2 }}>{desc}</div>
      <button disabled className="btn" style={{ width: "100%", fontSize: 11, marginTop: 10, opacity: 0.6, cursor: "not-allowed" }}>
        Coming soon
      </button>
    </div>
  )
}
