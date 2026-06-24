"use client"

import { useActionState } from "react"
import { signIn, type LoginState } from "./actions"

const inputStyle = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--c-border)",
  background: "var(--c-bg-elev-2)",
  color: "var(--c-fg)",
  fontSize: 14,
  outline: "none",
}

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    signIn,
    undefined,
  )

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--c-bg)",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: "linear-gradient(135deg, var(--c-accent), var(--c-accent-bright))",
              display: "grid",
              placeItems: "center",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7l8-4 8 4-8 4-8-4Z" />
              <path d="M4 12l8 4 8-4" />
              <path d="M4 17l8 4 8-4" />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              4x Journal
            </div>
            <div style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>
              Sign in to your trading journal
            </div>
          </div>
        </div>

        <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--c-fg-muted)", fontWeight: 500 }}>Email</span>
            <input
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="username"
              placeholder="you@example.com"
              style={inputStyle}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--c-fg-muted)", fontWeight: 500 }}>Password</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={inputStyle}
            />
          </label>
          {state?.error && (
            <div style={{ fontSize: 12, color: "var(--c-red-bright)" }}>{state.error}</div>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending}
            style={{ justifyContent: "center", padding: "10px 14px", fontSize: 13 }}
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--c-fg-dim)", lineHeight: 1.5 }}>
            Need access? Ask your team admin to set up your account.
          </p>
        </form>
      </div>
    </div>
  )
}
