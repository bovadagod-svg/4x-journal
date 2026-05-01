import { SectionHeader } from "@/components/shell/section-header"
import { SectionStub } from "@/components/shell/section-stub"
import { SECTION_META } from "@/lib/sections"
import { Icon } from "@/components/icons"
import { getJournalEntries, getUserTrades } from "@/lib/queries/trades"
import { LogTradeButton } from "@/components/trades/log-trade-button"

export default async function JournalPage() {
  const m = SECTION_META.journal
  const [entries, trades] = await Promise.all([getJournalEntries(), getUserTrades({ limit: 200 })])
  const tradeMap = new Map(trades.map((t) => [t.id, t]))

  if (entries.length === 0) {
    return (
      <>
        <SectionHeader title={m.title} subtitle={m.subtitle} actions={<LogTradeButton label="Log trade with notes" />} />
        <SectionStub
          icon={m.icon}
          title="No journal entries yet"
          description="Notes you write in the Log Trade modal land here automatically. The dedicated 6-tab journal editor (pre/during/post/cold review/screenshots/tags) lands in Phase 1.5."
        />
      </>
    )
  }

  return (
    <>
      <SectionHeader title={m.title} subtitle={`${entries.length} entr${entries.length === 1 ? "y" : "ies"}`} actions={<LogTradeButton />} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {entries.map((e) => {
          const t = e.trade_id ? tradeMap.get(e.trade_id) : undefined
          return (
            <div key={e.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)" }}>{e.title ?? "Untitled"}</span>
                    {t && (
                      <span className={`chip ${t.side === "long" ? "chip-green" : "chip-red"}`} style={{ fontSize: 10.5 }}>
                        <Icon name={t.side === "long" ? "arrowUp" : "arrowDown"} size={11} />
                        <span className="mono">{t.pair}</span>
                      </span>
                    )}
                    {e.mood && <span className="chip" style={{ fontSize: 10.5 }}>{e.mood}</span>}
                    <span className="chip" style={{ fontSize: 10.5 }}>{e.kind.replace("_", " ")}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--c-fg-muted)" }}>
                    {new Date(e.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
              </div>

              {e.pre_trade && (
                <Section label="Pre-trade">{e.pre_trade}</Section>
              )}
              {e.post_trade && (
                <Section label="Post-trade">{e.post_trade}</Section>
              )}
              {e.cold_review && (
                <Section label="Cold review">{e.cold_review}</Section>
              )}

              {e.tags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {e.tags.map((tag) => (
                    <span key={tag} className="chip chip-purple" style={{ fontSize: 10.5 }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "var(--c-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--c-fg)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{children}</p>
    </div>
  )
}
