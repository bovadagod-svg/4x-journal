"use client"

import { useState } from "react"
import { Icon, PairFlag, type IconName } from "@/components/icons"
import { formatUSD } from "@/lib/finance"
import type { Playbook, PlaybookStats } from "@/lib/queries/playbooks"
import { PlaybookDrawer } from "./playbook-drawer"
import type { Trade } from "@/lib/queries/trades"

export function PlaybookCard({ playbook, recentTrades }: { playbook: Playbook & { stats: PlaybookStats }; recentTrades: Trade[] }) {
  const [open, setOpen] = useState(false)
  const isPositive = playbook.stats.expectancy != null && playbook.stats.expectancy > 0.5
  const statusChip = playbook.status === "active" ? "chip-green" : playbook.status === "review" ? "chip-amber" : ""

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          textAlign: "left",
          background: "var(--c-bg-elev-1)",
          border: "1px solid var(--c-border)",
          borderRadius: "var(--radius-lg)",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          cursor: "pointer",
          transition: "all 0.15s",
          position: "relative",
          overflow: "hidden",
          color: "inherit",
        }}
      >
        <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: playbook.color }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${playbook.color}22`, border: `1px solid ${playbook.color}44`,
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <Icon name={(playbook.icon as IconName) ?? "lightning"} size={17} color={playbook.color === "#9A97A1" ? "var(--c-fg-muted)" : playbook.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600 }}>{playbook.name}</h3>
              <span className={`chip ${statusChip}`} style={{ fontSize: 9.5, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {playbook.status}
              </span>
            </div>
            {playbook.description && (
              <p style={{
                margin: "3px 0 0", fontSize: 11.5, color: "var(--c-fg-muted)", lineHeight: 1.4,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              }}>
                {playbook.description}
              </p>
            )}
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))", gap: 8,
          padding: "10px 0", borderTop: "1px solid var(--c-border)", borderBottom: "1px solid var(--c-border)",
        }}>
          <KV label="Trades" value={String(playbook.stats.trades)} />
          <KV label="Win %" value={playbook.stats.winRate != null ? `${playbook.stats.winRate}%` : "—"} />
          <KV label="Exp." value={playbook.stats.expectancy != null ? `${playbook.stats.expectancy > 0 ? "+" : ""}${playbook.stats.expectancy}R` : "—"} color={isPositive ? "var(--c-green-bright)" : "var(--c-fg-muted)"} />
          <KV label="PF" value={pf(playbook.stats)} color="var(--c-purple-bright)" />
          <KV
            label="Max DD"
            value={playbook.stats.closedTrades >= 3 && playbook.stats.maxDrawdown > 0
              ? formatUSD(-playbook.stats.maxDrawdown)
              : "—"}
            color={playbook.stats.maxDrawdown > 0 ? "var(--c-amber)" : "var(--c-fg-muted)"}
            sub={playbook.stats.maxDrawdownR > 0 ? `−${playbook.stats.maxDrawdownR.toFixed(2)}R` : undefined}
          />
        </div>

        <div>
          <div style={{ fontSize: 10.5, color: "var(--c-fg-muted)", marginBottom: 4 }}>Net P&L</div>
          <div className="tnum" style={{
            fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600,
            color: playbook.stats.totalPnL > 0 ? "var(--c-green-bright)" : playbook.stats.totalPnL < 0 ? "var(--c-red-bright)" : "var(--c-fg-muted)",
          }}>
            {playbook.stats.closedTrades > 0 ? formatUSD(playbook.stats.totalPnL, { signed: true }) : "—"}
          </div>
        </div>

        {playbook.pairs && playbook.pairs.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {playbook.pairs.slice(0, 3).map((p) => (
              <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "var(--c-bg-elev-3)", color: "var(--c-fg-muted)" }}>
                <PairFlag pair={p} size={11} /> {p}
              </span>
            ))}
            {playbook.pairs.length > 3 && (
              <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)", padding: "2px 7px" }}>+{playbook.pairs.length - 3}</span>
            )}
          </div>
        )}
      </button>

      <PlaybookDrawer playbook={open ? playbook : null} onClose={() => setOpen(false)} recentTrades={recentTrades} />
    </>
  )
}

function KV({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: "var(--c-fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div className="tnum" style={{ fontSize: 14, fontWeight: 600, color: color ?? "var(--c-fg)" }}>{value}</div>
      {sub && <div className="tnum" style={{ fontSize: 9.5, color: "var(--c-fg-dim)" }}>{sub}</div>}
    </div>
  )
}

function pf(s: PlaybookStats): string {
  if (s.closedTrades === 0) return "—"
  // Profit factor isn't on PlaybookStats — derive from totalPnL won vs lost.
  // Approximation: if we don't have grossWin/grossLoss split, return avgR-based proxy.
  if (s.avgR == null) return "—"
  return s.avgR > 0 ? (1 + s.avgR).toFixed(2) : "—"
}
