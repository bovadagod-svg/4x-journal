"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Icon } from "@/components/icons"
import { NAV_ITEMS } from "@/lib/sections"

export function Sidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebar = (
    <aside
      style={{
        background: "var(--c-bg-elev-1)",
        borderRight: "1px solid var(--c-border)",
        display: "flex",
        flexDirection: "column",
        padding: "18px 14px",
        gap: 16,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: "linear-gradient(135deg, var(--c-accent), var(--c-accent-bright))",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7l8-4 8 4-8 4-8-4Z" />
            <path d="M4 12l8 4 8-4" />
            <path d="M4 17l8 4 8-4" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
          <span style={{
            fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600,
            color: "var(--c-fg)", letterSpacing: "-0.01em",
          }}>4x Journal</span>
          <span style={{ fontSize: 10.5, color: "var(--c-fg-dim)", marginTop: 1 }}>v1.0 · beta</span>
        </div>
      </div>

      {userEmail && (
        <div style={{
          background: "var(--c-bg-elev-2)",
          border: "1px solid var(--c-border)",
          borderRadius: 10,
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg, var(--c-accent), var(--c-red))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              {userEmail.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 12.5, fontWeight: 600, color: "var(--c-fg)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{userEmail}</div>
              <div style={{ fontSize: 11, color: "var(--c-fg-muted)" }}>Free plan</div>
            </div>
          </div>
        </div>
      )}

      <nav style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
        {NAV_ITEMS.map((item, i) => {
          if (item.kind === "section") {
            return (
              <div key={`sec-${i}`} style={{
                fontSize: 10, fontWeight: 600, color: "var(--c-fg-dim)",
                textTransform: "uppercase", letterSpacing: "0.08em",
                padding: "10px 11px 4px",
              }}>{item.label}</div>
            )
          }
          const href = `/${item.id}`
          const isActive = pathname === href
          return (
            <Link
              key={item.id}
              href={href}
              onClick={() => setMobileOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: item.indent ? "9px 11px 9px 18px" : "9px 11px",
                borderRadius: 8,
                background: isActive ? "var(--c-bg-elev-2)" : "transparent",
                color: isActive ? "var(--c-fg)" : "var(--c-fg-muted)",
                fontSize: 13,
                fontWeight: 500,
                position: "relative",
                textDecoration: "none",
                transition: "all 0.15s",
              }}
            >
              <Icon name={item.icon} size={17} />
              <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
              {item.badge != null && (
                <span style={{
                  fontSize: 10, fontWeight: 600, color: "#fff",
                  background: "var(--c-accent)",
                  borderRadius: 999, padding: "1px 7px", minWidth: 18, textAlign: "center",
                }}>{item.badge}</span>
              )}
              {isActive && (
                <span style={{
                  position: "absolute", left: -14, top: 8, bottom: 8, width: 3,
                  borderRadius: "0 3px 3px 0", background: "var(--c-accent-bright)",
                }} />
              )}
            </Link>
          )
        })}
      </nav>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{
          background: "linear-gradient(135deg, var(--c-accent-soft), rgba(0,0,0,0))",
          border: "1px solid var(--c-accent-soft)",
          borderRadius: 10,
          padding: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Icon name="sparkle" size={14} color="#B79CFF" />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Coach AI</span>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: "var(--c-fg-muted)", lineHeight: 1.4 }}>
            Log your first trade and we&apos;ll start surfacing patterns.
          </p>
        </div>
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 10px",
              background: "transparent",
              border: "none",
              color: "var(--c-fg-muted)",
              fontSize: 12,
              borderRadius: 8,
              width: "100%",
              textAlign: "left",
            }}
          >
            <Icon name="external" size={14} />
            <span>Logout</span>
          </button>
        </form>
      </div>
    </aside>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        style={{
          display: "none",
          position: "fixed",
          top: 12, left: 12, zIndex: 60,
          width: 40, height: 40, borderRadius: 10,
          background: "var(--c-bg-elev-2)",
          border: "1px solid var(--c-border)",
          alignItems: "center", justifyContent: "center",
          color: "var(--c-fg)",
        }}
        className="mobile-only-flex"
      >
        <Icon name="grip" size={18} />
      </button>

      <div className="sidebar-desktop">{sidebar}</div>

      {mobileOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 70,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: 280, height: "100%" }}>
            {sidebar}
          </div>
        </div>
      )}

      <style>{`
        .sidebar-desktop { display: contents; }
        .mobile-only-flex { display: none; }
        @media (max-width: 768px) {
          .sidebar-desktop { display: none; }
          .mobile-only-flex { display: flex !important; }
        }
      `}</style>
    </>
  )
}
