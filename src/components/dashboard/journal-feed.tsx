import Link from "next/link"
import { Icon, PairFlag } from "@/components/icons"
import type { JournalEntry, Trade } from "@/lib/queries/trades"
import { formatUSD } from "@/lib/finance"
import { OpenEntryRowWrapper } from "@/components/journal/open-entry-buttons"
import { LocalTime } from "@/lib/timezone-context"

/**
 * Recent journal entries with the prototype's icon-square row layout.
 * Each row leads with a colored 38×38 square (win/loss/breakeven coding),
 * pair flag + pair + setup chip mid-row, and right-aligned P&L + R.
 *
 * If a journal entry is linked to a trade we use that trade's data;
 * otherwise we render the entry's own fields (kind / mood / note).
 */
export function JournalFeed({ entries, trades }: { entries: JournalEntry[]; trades: Trade[] }) {
  const tradeMap = new Map(trades.map((t) => [t.id, t]))

  return (
    <div className="card" style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h3 className="card-title">Recent Journal Entries</h3>
          <p className="card-subtitle">{entries.length === 0 ? "Nothing yet" : `Last ${entries.length}`}</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Link href="/journal" className="btn" style={{ fontSize: 12, padding: "6px 10px" }}>
            View all <Icon name="chevronRight" size={12} />
          </Link>
        </div>
      </div>
      {entries.length === 0 ? (
        <div style={{ padding: "24px 4px", color: "var(--c-fg-muted)", fontSize: 12.5, lineHeight: 1.5 }}>
          Notes you write while logging a trade automatically land here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.slice(0, 5).map((e) => {
            const t = e.trade_id ? tradeMap.get(e.trade_id) : undefined
            const result = !t ? "neutral"
              : t.pnl == null ? "neutral"
              : Number(t.pnl) > 0 ? "win"
              : Number(t.pnl) < 0 ? "loss"
              : "breakeven"
            const iconBg =
              result === "win" ? "var(--c-green-soft)"
              : result === "loss" ? "var(--c-red-soft)"
              : "var(--c-bg-elev-3)"
            const iconColor =
              result === "win" ? "var(--c-green-bright)"
              : result === "loss" ? "var(--c-red-bright)"
              : "var(--c-fg-muted)"
            const pair = t?.pair ?? ""
            const note = e.pre_trade || e.post_trade || e.lessons || ""

            return (
              <OpenEntryRowWrapper key={e.id} entryId={e.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid var(--c-border)",
                  background: "var(--c-bg-elev-2)",
                  textAlign: "left",
                  transition: "border-color 0.15s",
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 8,
                  background: iconBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon name={t?.side === "short" ? "arrowDown" : "arrowUp"} size={18} color={iconColor} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    {pair && <PairFlag pair={pair} size={14} />}
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{pair || (e.title ?? "Entry")}</span>
                    {e.mood && <span className="chip chip-purple" style={{ fontSize: 10, padding: "1px 7px" }}>{e.mood}</span>}
                    <span style={{ fontSize: 11, color: "var(--c-fg-dim)", marginLeft: "auto" }} className="mono"><LocalTime value={e.created_at} opts={{ hour: "numeric", minute: "2-digit" }} /></span>
                  </div>
                  <div style={{
                    fontSize: 11.5, color: "var(--c-fg-muted)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {note || e.title || "(no notes)"}
                  </div>
                </div>
                {t && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="tnum" style={{
                      fontSize: 14, fontWeight: 600,
                      color: Number(t.pnl) > 0 ? "var(--c-green-bright)" : Number(t.pnl) < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
                    }}>
                      {t.pnl != null ? formatUSD(Number(t.pnl), { signed: true }) : "—"}
                    </div>
                    <div className="tnum" style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>
                      {t.r != null ? `${Number(t.r) > 0 ? "+" : ""}${Number(t.r).toFixed(2)}R` : ""}
                    </div>
                  </div>
                )}
              </div>
              </OpenEntryRowWrapper>
            )
          })}
        </div>
      )}
    </div>
  )
}
