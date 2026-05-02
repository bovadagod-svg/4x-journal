import { headers } from "next/headers"
import Link from "next/link"
import { SectionHeader } from "@/components/shell/section-header"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { createClient } from "@/lib/supabase/server"
import { AppearanceSection } from "@/components/settings/appearance-section"
import { WebhookSection } from "@/components/settings/webhook-section"
import { DangerZone } from "@/components/settings/danger-zone"

export default async function SettingsPage() {
  const m = SECTION_META.settings
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: settings } = await supabase
    .from("user_settings")
    .select("webhook_secret")
    .eq("user_id", user.id)
    .maybeSingle()

  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("host") ?? "4x-journal.vercel.app"
  const baseUrl = `${proto}://${host}`

  return (
    <>
      <SectionHeader title={m.title} subtitle="Preferences live here. Account / risk / playbook setup live on their dedicated pages." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 14 }}>
        {/* Profile */}
        <Card title="Profile" icon="user">
          <Row label="Email"><span className="mono" style={{ fontSize: 13 }}>{user.email}</span></Row>
          <Row label="User ID"><span className="mono" style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>{user.id}</span></Row>
          <form action="/auth/sign-out" method="post" style={{ marginTop: 8 }}>
            <button type="submit" className="btn">
              <Icon name="external" size={12} />
              <span>Sign out</span>
            </button>
          </form>
        </Card>

        {/* Appearance */}
        <Card title="Appearance" icon="settings">
          <AppearanceSection />
        </Card>

        {/* Workspace links */}
        <Card title="Workspace" icon="dashboard">
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
            Manage your trading setup on dedicated pages:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <ManageLink href="/accounts" icon="accounts" label="Accounts" subtitle="Brokers + prop firms" />
            <ManageLink href="/playbooks" icon="playbook" label="Playbooks" subtitle="Documented setups + stats" />
            <ManageLink href="/risk" icon="risk" label="Risk Manager" subtitle="Per-account rules + pre-flight" />
            <ManageLink href="/watchlist" icon="watchlist" label="Watchlist" subtitle="Pre-session pairs + bias" />
          </div>
        </Card>

        {/* Webhook */}
        <Card title="TradingView webhook" icon="external" wide>
          <WebhookSection userId={user.id} secret={settings?.webhook_secret ?? null} baseUrl={baseUrl} />
        </Card>

        {/* Danger zone */}
        <Card title="Danger zone" icon="risk">
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.55 }}>
            Permanent destructive actions. There&apos;s no undo.
          </p>
          <DangerZone email={user.email ?? ""} />
        </Card>
      </div>
    </>
  )
}

function Card({ title, icon, children, wide }: { title: string; icon: "user" | "settings" | "dashboard" | "external" | "risk"; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14, gridColumn: wide ? "1 / -1" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--c-bg-elev-3)", display: "grid", placeItems: "center", color: "var(--c-fg-muted)" }}>
          <Icon name={icon} size={14} />
        </div>
        <h3 className="card-title" style={{ fontSize: 14 }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>{label}</span>
      <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{children}</div>
    </div>
  )
}

function ManageLink({ href, icon, label, subtitle }: { href: string; icon: "accounts" | "playbook" | "risk" | "watchlist"; label: string; subtitle: string }) {
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px",
      borderRadius: 8,
      background: "var(--c-bg-elev-2)",
      border: "1px solid var(--c-border)",
      color: "inherit",
      textDecoration: "none",
    }}>
      <Icon name={icon} size={16} color="var(--c-fg-muted)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>{subtitle}</div>
      </div>
      <Icon name="chevronRight" size={12} color="var(--c-fg-dim)" />
    </Link>
  )
}
