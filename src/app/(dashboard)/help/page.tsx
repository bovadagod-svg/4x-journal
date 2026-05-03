import { SectionHeader } from "@/components/shell/section-header"
import { Icon, type IconName } from "@/components/icons"
import Link from "next/link"

export const metadata = { title: "Help · 4x Journal" }

export default function HelpPage() {
  return (
    <>
      <SectionHeader
        title="Help"
        subtitle="Setup guides, keyboard shortcuts, FAQ — everything that didn't fit in a tooltip"
      />

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24, alignItems: "flex-start" }} className="help-grid">
        <nav style={{ position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 4 }}>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} style={navLinkStyle}>
              <Icon name={s.icon} size={12} color="var(--c-fg-muted)" />
              <span>{s.title}</span>
            </a>
          ))}
        </nav>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <Section id="quickstart" icon="lightning" title="Quick start">
            <ol style={olStyle}>
              <li>Add an account from the <Link href="/accounts" style={linkStyle}>Accounts</Link> page (manual, CSV import, or TradeLocker connection).</li>
              <li>Optional: write a playbook in <Link href="/playbooks" style={linkStyle}>Playbooks</Link> so trades can be tagged to a setup with rules + expectancy.</li>
              <li>Press <Kbd>c</Kbd> anywhere to log a trade. Risk is computed from your default % and the stop distance.</li>
              <li>After close, click the row in <Link href="/ledger" style={linkStyle}>Ledger</Link> to open the trade detail drawer; click the journal icon to write your post-trade review.</li>
            </ol>
          </Section>

          <Section id="shortcuts" icon="grip" title="Keyboard shortcuts">
            <p style={p}>Press <Kbd>?</Kbd> at any time for the full list. The most used:</p>
            <ul style={ulStyle}>
              <li><Kbd>⌘</Kbd><Kbd>K</Kbd> — global command palette (works inside text inputs too)</li>
              <li><Kbd>c</Kbd> — log a new trade</li>
              <li><Kbd>g</Kbd> then <Kbd>d</Kbd> — Dashboard. <Kbd>g</Kbd>+<Kbd>l</Kbd>=Ledger, <Kbd>g</Kbd>+<Kbd>j</Kbd>=Journal, <Kbd>g</Kbd>+<Kbd>a</Kbd>=Analytics, etc.</li>
              <li><Kbd>esc</Kbd> — close any modal or drawer</li>
            </ul>
            <p style={pDim}>Shortcuts ignore keystrokes when a text input is focused (except <Kbd>⌘</Kbd><Kbd>K</Kbd>).</p>
          </Section>

          <Section id="tradelocker" icon="external" title="Connecting TradeLocker">
            <p style={p}>
              Your live broker fills sync into the journal automatically — no copy-paste, no missed trades.
              Open <Link href="/settings?tab=integrations" style={linkStyle}>Settings → Integrations</Link>, click
              <em> Connect TradeLocker</em>, and provide:
            </p>
            <ul style={ulStyle}>
              <li><strong>Email + password</strong> — your TradeLocker login</li>
              <li><strong>Server</strong> — usually <code style={code}>OSP-DEMO</code> or your prop firm&apos;s server name (e.g. <code style={code}>FUNDERPRO-LIVE</code>)</li>
              <li><strong>Environment</strong> — demo or live</li>
            </ul>
            <p style={p}>
              We auth once, save the access token (encrypted, server-side), and pull <code style={code}>/positions</code>
              + <code style={code}>/ordersHistory</code> + <code style={code}>/state</code> on every sync.
              You can sync on-demand from the account drawer; a daily cron runs at 06:00 UTC if your env has
              <code style={code}>SUPABASE_SERVICE_ROLE_KEY</code> + <code style={code}>CRON_SECRET</code> set.
            </p>
          </Section>

          <Section id="webhook" icon="external" title="TradingView webhook">
            <p style={p}>
              Send trade alerts from a TradingView strategy or indicator straight into the journal.
              Generate your unique URL in <Link href="/settings?tab=integrations" style={linkStyle}>Settings → Integrations</Link>,
              paste it as the alert webhook URL, and POST a JSON body like:
            </p>
            <pre style={pre}>{`{
  "pair": "EUR/USD",
  "side": "long",
  "entry": 1.0825,
  "size": 10000,
  "stop": 1.0795,
  "target": 1.0875
}`}</pre>
            <p style={pDim}>
              <code style={code}>stop</code>, <code style={code}>target</code>, and a <code style={code}>secret</code>
              field are optional. If you set a webhook secret in Settings, we verify it before inserting.
            </p>
          </Section>

          <Section id="csv" icon="reports" title="CSV import">
            <p style={p}>
              For brokers we don&apos;t integrate directly (MT4/5, cTrader, FunderPro, anything that exports trade history),
              upload your CSV via <Link href="/accounts" style={linkStyle}>Accounts → Import CSV</Link>.
              Columns auto-map against a wide alias list (date, time, symbol, type, volume, price, S/L, T/P, etc.).
              The preview step shows what will be imported and what was skipped before you commit.
            </p>
            <p style={pDim}>
              Re-importing the same CSV is idempotent — we dedupe via a synthetic external ID, so you can refresh whenever.
            </p>
          </Section>

          <Section id="risk" icon="risk" title="Risk rules">
            <p style={p}>
              Per-account rules live on the <Link href="/risk" style={linkStyle}>Risk</Link> page:
              max risk per trade ($ or % of equity), daily loss limit, max open positions, prop-firm template.
              When you log a trade, the modal pre-flights against these rules — exceeding the per-trade cap blocks submit;
              hitting daily loss blocks new trades until tomorrow.
            </p>
            <p style={pDim}>
              Toggle <em>Active</em> → <em>Disabled</em> on a rule to keep its values saved while pausing enforcement
              (useful when a prop firm&apos;s drawdown resets and you want a clean baseline).
            </p>
          </Section>

          <Section id="coach" icon="sparkle" title="Coach AI">
            <p style={p}>
              The Coach widget on your Dashboard reads your last 30 days of closed trades + journal entries
              and asks Claude for 2-3 specific observations about what&apos;s working and what isn&apos;t.
              Activates automatically once <code style={code}>ANTHROPIC_API_KEY</code> is set in your environment.
            </p>
            <p style={pDim}>
              Without the key, the widget shows a deterministic narrative based on your stats. Result is cached per day
              so opening the dashboard 20 times doesn&apos;t cost 20 API calls.
            </p>
          </Section>

          <Section id="tax" icon="reports" title="Tax exports (Form 8949)">
            <p style={p}>
              From <Link href="/reports" style={linkStyle}>Reports</Link>, the <em>Form 8949 (FIFO)</em> tile
              produces an IRS-ready CSV with short/long-term split, wash-sale flagging, and per-trade
              broker costs (commission + swap) deducted from gross P&amp;L. The tax election in
              <Link href="/settings?tab=tax" style={linkStyle}> Settings → Tax</Link> drives the wash-sale rules:
              §988 (ordinary-income forex election) → wash-sale off; §1256 or default → on.
            </p>
            <p style={pDim}>
              The CSV includes a totals block at the bottom that reconciles to your year&apos;s realized P&amp;L,
              so your accountant or tax software can import without manual fix-ups.
            </p>
          </Section>

          <Section id="sharing" icon="external" title="Sharing journal entries">
            <p style={p}>
              Two ways to share, with very different privacy models:
            </p>
            <ul style={ulStyle}>
              <li>
                <strong>Public profile</strong> — set a handle in
                <Link href="/settings?tab=profile" style={linkStyle}> Settings → Profile</Link>, then any entry you mark
                <em> Share publicly</em> appears at <code style={code}>/u/your-handle</code> alongside the rest of your shared entries.
                Good for building a public track record.
              </li>
              <li>
                <strong>Private share link</strong> — generate a one-shot URL on a single entry and send it directly to a coach.
                The token in the URL is the access control. Revoke whenever and the link 404s instantly.
              </li>
            </ul>
          </Section>

          <Section id="display-currency" icon="settings" title="Display currency + FX rates">
            <p style={p}>
              When your accounts trade in different currencies, set a display currency in
              <Link href="/settings?tab=appearance" style={linkStyle}> Settings → Appearance</Link>.
              Add manual exchange rates in <em>Settings → FX rates</em> (e.g. <code style={code}>EUR-&gt;USD = 1.085</code>).
              The Accounts page&apos;s Total Equity / Open P&amp;L / Funded Capital aggregate cards will use those rates
              to convert each account&apos;s native currency before summing.
            </p>
            <p style={pDim}>
              We don&apos;t auto-fetch rates — that&apos;s a deliberate choice so your tax-period reports are reproducible.
            </p>
          </Section>

          <Section id="faq" icon="info" title="FAQ">
            <details style={detailsStyle}>
              <summary style={summaryStyle}>Why does my P&amp;L on a metals trade look way off?</summary>
              <p style={p}>
                TradeLocker reports quantity in <em>lots</em>; one lot of XAUUSD is 100 oz, not 1 oz. The importer
                hydrates the contract size for every traded instrument before computing P&amp;L. If you imported via CSV
                and your CSV reports raw quantity in oz, the size is already in units; check the trade detail drawer to see what got imported.
              </p>
            </details>
            <details style={detailsStyle}>
              <summary style={summaryStyle}>How do I switch between accounts?</summary>
              <p style={p}>
                The account scope dropdown in the top bar filters every page. Set it to <em>All accounts</em> for
                aggregate views, or to a single account for per-account stats. The Risk page always shows per-account
                regardless of scope.
              </p>
            </details>
            <details style={detailsStyle}>
              <summary style={summaryStyle}>The Risk-of-Ruin number scares me. What now?</summary>
              <p style={p}>
                That&apos;s the point. The card shows the probability your edge produces a 25/50/75% drawdown over the
                next 100 trades at your current sizing. If the 50% number is higher than you&apos;re comfortable with,
                drag the risk slider down to model what would change. The math is unforgiving above ~2% per trade.
              </p>
            </details>
            <details style={detailsStyle}>
              <summary style={summaryStyle}>Can I delete a trade I logged by mistake?</summary>
              <p style={p}>
                Open the trade in the detail drawer → Actions tab → Delete. Broker-synced trades will reappear on the
                next sync — disable the broker connection on the account if you want them gone permanently.
              </p>
            </details>
            <details style={detailsStyle}>
              <summary style={summaryStyle}>How do I report a bug or request a feature?</summary>
              <p style={p}>
                Email the address listed in <Link href="/settings?tab=profile" style={linkStyle}>Settings → Profile</Link>
                with a screenshot and what you expected. Punchlist items get worked off in priority order.
              </p>
            </details>
          </Section>

          <Section id="env" icon="info" title="Environment variables (admin)">
            <p style={p}>If you&apos;re self-hosting, here&apos;s what controls what:</p>
            <ul style={ulStyle}>
              <li><code style={code}>NEXT_PUBLIC_SUPABASE_URL</code> + <code style={code}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> — required for any deployment</li>
              <li><code style={code}>SUPABASE_SERVICE_ROLE_KEY</code> — required for the TradingView webhook + cron jobs</li>
              <li><code style={code}>CRON_SECRET</code> — bearer token for /api/cron/* routes</li>
              <li><code style={code}>ANTHROPIC_API_KEY</code> — Coach AI activation</li>
              <li><code style={code}>RESEND_API_KEY</code> + <code style={code}>EMAIL_FROM</code> — weekly digest emails</li>
              <li><code style={code}>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> + <code style={code}>VAPID_PRIVATE_KEY</code> + <code style={code}>VAPID_SUBJECT</code> — browser push notifications</li>
              <li><code style={code}>POLYGON_API_KEY</code> — trade replay charts + macro context (DXY/VIX/SPX)</li>
            </ul>
          </Section>
        </div>
      </div>
    </>
  )
}

const SECTIONS: { id: string; title: string; icon: IconName }[] = [
  { id: "quickstart",       title: "Quick start",         icon: "lightning" },
  { id: "shortcuts",        title: "Keyboard shortcuts",  icon: "grip" },
  { id: "tradelocker",      title: "Connect TradeLocker", icon: "external" },
  { id: "webhook",          title: "TradingView webhook", icon: "external" },
  { id: "csv",              title: "CSV import",          icon: "reports" },
  { id: "risk",             title: "Risk rules",          icon: "risk" },
  { id: "coach",            title: "Coach AI",            icon: "sparkle" },
  { id: "tax",              title: "Tax exports",         icon: "reports" },
  { id: "sharing",          title: "Sharing entries",     icon: "external" },
  { id: "display-currency", title: "Display currency",    icon: "settings" },
  { id: "faq",              title: "FAQ",                 icon: "info" },
  { id: "env",              title: "Env vars (admin)",    icon: "info" },
]

function Section({
  id, icon, title, children,
}: {
  id: string
  icon: IconName
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="card" style={{ padding: 22, scrollMarginTop: 16 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 14px", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 7,
          background: "var(--c-bg-elev-3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon name={icon} size={14} color="var(--c-purple-bright)" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: "inline-block", minWidth: 18, padding: "1px 6px",
      background: "var(--c-bg-elev-3)", border: "1px solid var(--c-border)",
      borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 11,
      color: "var(--c-fg)",
      margin: "0 2px",
    }}>{children}</kbd>
  )
}

const navLinkStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "6px 10px", borderRadius: 6,
  fontSize: 12.5, color: "var(--c-fg-muted)",
  textDecoration: "none",
}

const linkStyle: React.CSSProperties = {
  color: "var(--c-purple-bright)",
  textDecoration: "none",
  fontWeight: 500,
}

const p: React.CSSProperties = { margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.6, color: "var(--c-fg)" }
const pDim: React.CSSProperties = { margin: "0 0 8px", fontSize: 12.5, lineHeight: 1.55, color: "var(--c-fg-muted)" }
const ulStyle: React.CSSProperties = { margin: "0 0 12px 18px", padding: 0, fontSize: 13, lineHeight: 1.7, color: "var(--c-fg)" }
const olStyle: React.CSSProperties = { margin: "0 0 8px 18px", padding: 0, fontSize: 13, lineHeight: 1.7, color: "var(--c-fg)" }
const code: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: "0.92em",
  padding: "1px 5px", borderRadius: 4,
  background: "var(--c-bg-elev-3)", color: "var(--c-fg)",
}
const pre: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 12,
  padding: 12, borderRadius: 8,
  background: "var(--c-bg-elev-2)", border: "1px solid var(--c-border)",
  margin: "0 0 12px", overflowX: "auto",
}
const detailsStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--c-border)",
  padding: "10px 0",
}
const summaryStyle: React.CSSProperties = {
  cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--c-fg)",
  marginBottom: 6,
}
