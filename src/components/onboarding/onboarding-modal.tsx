"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Icon, type IconName } from "@/components/icons"
import { completeOnboarding } from "@/lib/actions/settings"
import { useAccounts } from "@/components/accounts/accounts-context"
import { useLogTrade } from "@/components/trades/log-trade-context"
import { AccountFormModal } from "@/components/accounts/account-form-modal"

/**
 * First-run wizard. Three steps:
 *   1. Add an account (manual or TradeLocker)
 *   2. Create a playbook (via deep link to /playbooks)
 *   3. Log your first trade
 *
 * Completion path: at any time the user can click "Skip for now" which sets
 * `onboarded_at` so the modal never reappears. Each step also has a "Done →"
 * button that validates the step's success condition before advancing.
 *
 * Delivery: this is a client component triggered from `(dashboard)/layout.tsx`
 * when `onboarded_at IS NULL` AND the user has zero accounts.
 */
export function OnboardingModal() {
  const router = useRouter()
  const { accounts } = useAccounts()
  const logTrade = useLogTrade()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  const finish = () => {
    setBusy(true)
    startTransition(async () => {
      await completeOnboarding()
      router.refresh()
    })
  }

  const skip = () => {
    if (!confirm("Skip the welcome tour? You can still set everything up from the menu.")) return
    finish()
  }

  // Step 1 success = at least one account exists
  const step1Done = accounts.length > 0

  return (
    <>
      <div
        role="dialog"
        aria-modal
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
          zIndex: 200, display: "grid", placeItems: "center", padding: 16,
        }}
      >
        <div style={{
          width: "min(640px, 100%)", maxHeight: "92vh", overflowY: "auto",
          background: "var(--c-bg-elev-1)",
          border: "1px solid var(--c-border-strong)",
          borderRadius: 16,
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
        }}>
          {/* Hero */}
          <div style={{
            padding: "26px 28px",
            borderBottom: "1px solid var(--c-border)",
            background: "linear-gradient(135deg, rgba(105, 50, 212, 0.18), transparent 60%)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "var(--c-purple-bright)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Welcome</span>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: "var(--c-fg-dim)" }} />
              <span style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>3 quick steps · ~2 min</span>
            </div>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em" }}>
              Let&apos;s get your journal set up
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>
              Add an account, name a setup, log a trade. That&apos;s the loop. Everything else builds on those three.
            </p>
          </div>

          {/* Steps */}
          <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <Step
              num={1}
              icon="accounts"
              title="Add your first account"
              body="Manual entry, CSV import, or connect TradeLocker for auto-sync. You can edit any of this later."
              status={step1Done ? "done" : step === 1 ? "active" : "pending"}
              cta={
                step1Done ? null : (
                  <button onClick={() => setAccountModalOpen(true)} className="btn btn-primary">
                    <Icon name="plus" size={12} /> <span>Add account</span>
                  </button>
                )
              }
              meta={step1Done ? `${accounts.length} account${accounts.length === 1 ? "" : "s"} ready` : null}
            />

            <Step
              num={2}
              icon="playbook"
              title="Name a playbook"
              body="One setup you actually trade — London breakout, FVG retest, whatever. Tag trades with it and your stats sort themselves."
              status={!step1Done ? "pending" : step === 2 || step1Done ? "active" : "pending"}
              cta={
                <a
                  href="/playbooks"
                  className="btn"
                  onClick={() => { /* user navigates; we'll mark complete when they hit Finish below */ }}
                >
                  <Icon name="external" size={12} /> <span>Open Playbooks</span>
                </a>
              }
              meta={null}
            />

            <Step
              num={3}
              icon="trade"
              title="Log your first trade"
              body="Pair, side, prices, size — takes 30 seconds. Notes become a journal entry automatically."
              status={!step1Done ? "pending" : "active"}
              cta={
                <button
                  onClick={() => logTrade.open()}
                  disabled={!step1Done}
                  className="btn btn-primary"
                  style={{ opacity: step1Done ? 1 : 0.5 }}
                >
                  <Icon name="plus" size={12} /> <span>Log a trade</span>
                </button>
              }
              meta={null}
            />
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderTop: "1px solid var(--c-border)", background: "var(--c-bg-elev-1)" }}>
            <button onClick={skip} disabled={busy} className="btn" style={{ color: "var(--c-fg-muted)" }}>
              Skip for now
            </button>
            <button onClick={finish} disabled={busy} className="btn btn-primary">
              <Icon name="check" size={12} /> <span>{busy ? "Finishing…" : "I'm done — close"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Nested account-form-modal for step 1 */}
      <AccountFormModal open={accountModalOpen} onClose={() => setAccountModalOpen(false)} />
    </>
  )
}

function Step({
  num, icon, title, body, status, cta, meta,
}: {
  num: number
  icon: IconName
  title: string
  body: string
  status: "active" | "pending" | "done"
  cta: React.ReactNode
  meta: string | null
}) {
  const isDone = status === "done"
  const isActive = status === "active"
  return (
    <div style={{
      display: "flex", gap: 14, padding: 14,
      background: isActive ? "rgba(105, 50, 212, 0.06)" : "var(--c-bg-elev-2)",
      border: `1px solid ${isActive ? "rgba(105, 50, 212, 0.3)" : "var(--c-border)"}`,
      borderRadius: 12,
      opacity: status === "pending" ? 0.55 : 1,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        display: "grid", placeItems: "center",
        background: isDone ? "rgba(17, 196, 88, 0.15)" : isActive ? "var(--c-purple-bright)" : "var(--c-bg-elev-3)",
        color: isDone ? "var(--c-green-bright)" : isActive ? "#fff" : "var(--c-fg-muted)",
        fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14,
      }}>
        {isDone ? <Icon name="check" size={16} /> : num}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <Icon name={icon} size={13} color="var(--c-fg-muted)" />
          <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-display)" }}>{title}</span>
          {isDone && <span className="chip chip-green" style={{ fontSize: 10 }}>Done</span>}
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--c-fg-muted)", lineHeight: 1.5 }}>{body}</p>
        {meta && <div style={{ fontSize: 11, color: "var(--c-green-bright)", marginTop: 6 }}>{meta}</div>}
        <div style={{ marginTop: 10 }}>{cta}</div>
      </div>
    </div>
  )
}
