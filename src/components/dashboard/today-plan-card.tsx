import { Icon } from "@/components/icons"
import { LogSessionPlanButton } from "@/components/journal/log-session-plan-button"
import { getTodaySessionPlan } from "@/lib/actions/journal-entries"

/**
 * Today's session plan widget. Server component — fetches the existing plan
 * (if any) at render time. Shows a quick preview when set, an empty-state
 * prompt when not.
 *
 * Hidden in Lite mode (the dashboard page can pass it through showAdvanced;
 * it's small enough that we leave it visible for everyone by default).
 */
export async function TodayPlanCard() {
  const plan = await getTodaySessionPlan()
  const hasPlan = plan !== null
  const previewText = plan?.pre_trade?.trim()
    ? plan.pre_trade.trim().slice(0, 220)
    : null

  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <div>
          <h3 className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="book" size={14} color="var(--c-cyan-bright)" />
            Today&apos;s plan
          </h3>
          <p className="card-subtitle">
            {hasPlan ? "Reconcile to it at end of session" : "Bias, levels, no-trade zones, news to avoid"}
          </p>
        </div>
        <LogSessionPlanButton
          label={hasPlan ? "Open" : "Plan today"}
          existingId={hasPlan ? plan!.id : null}
        />
      </div>

      {hasPlan && previewText && (
        <p style={{
          margin: "10px 0 0",
          fontSize: 12.5,
          color: "var(--c-fg-muted)",
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
        }}>
          {previewText}
          {plan!.pre_trade!.length > 220 && "…"}
        </p>
      )}

      {hasPlan && plan!.tags && plan!.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {plan!.tags.slice(0, 6).map((t) => (
            <span
              key={t}
              style={{
                fontSize: 10.5,
                padding: "2px 8px",
                borderRadius: 999,
                background: "var(--c-bg-elev-2)",
                color: "var(--c-fg-muted)",
                border: "1px solid var(--c-border)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {!hasPlan && (
        <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--c-fg-dim)", lineHeight: 1.5 }}>
          5-minute habit: write your bias and the levels you care about before the open. End of day, come back and reconcile.
        </p>
      )}
    </div>
  )
}
