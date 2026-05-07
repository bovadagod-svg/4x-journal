# 4x Journal — Punchlist

Living list of post-rebuild items. Each item has enough context to pick up cold without re-reading the previous conversation.

**How to use:** Pick the next item, read its **Files** + **Acceptance**, ship it, check the box, leave a note. Don't work the list strictly in order — pick by what matters most that day.

**Status legend:**
- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[-]` decided not to do (record the reason in **Notes**)

---

## 🔴 Settings that persist but don't drive behavior

These are the loose ends most likely to make the app feel like a demo. Settings UI promises behavior the app doesn't deliver yet.

### 1. `[x]` Enforce `require_journal_note`

**Why:** Toggle exists in Settings → Journal defaults. If user enables it, the Log Trade modal should require the Notes field, and the entry editor drawer should warn before save with empty pre-trade text.

**Files:**
- `src/components/trades/log-trade-modal.tsx` — add validation when toggle is on
- `src/components/journal/entry-editor-drawer.tsx` — block close if pre-trade empty
- `src/lib/actions/trades.ts` + `src/lib/actions/journal.ts` — server-side validation
- Pass `require_journal_note` through `LogTradeProvider` like we did for `default_risk_pct`

**Acceptance:** Toggle on → try to log a trade with no notes → see inline error and block submit. Toggle off → no error.

**Effort:** ~30 min

**Notes:** 2026-05-02 — Threaded `require_journal_note` through `(dashboard)/layout.tsx` into both `LogTradeProvider` (via `TradeDefaults`) and `JournalDrawerProvider` (new prop). Modal: conditional `required` attr + asterisk in label + inline `FieldError` for `state.fieldErrors.notes`. Server: `createTrade` fetches the setting and rejects empty notes with `fieldErrors.notes` before risk pre-flight. Drawer: `handleClose` confirm-guard fires on ESC / X / Done / backdrop, scoped to `kind === "trade"` so ideas and session plans aren't affected. Autosave is unchanged. `pnpm tsc --noEmit` clean. Browser verification still needed (see plan file).

---

### 2. `[x]` Enforce `news_avoidance` at trade entry

**Why:** Toggle exists in Settings → Behavior rules. Pre-flight should check `economic_events` table — if a `high`-impact event matches the trade pair's currencies and is within `news_avoidance_minutes_before/after` of `now`, show a warning (or block, depending on UX choice).

**Files:**
- `src/lib/risk.ts` → extend `evaluateTrade` to take `userId`, fetch `user_settings` + nearby events
- `src/lib/actions/trades.ts` → wire the new check
- `src/components/trades/log-trade-modal.tsx` → render the warning banner

**Acceptance:** With `news_avoidance_enabled=true` and a high-impact event in the next 5 min for USD, attempting a USD pair trade shows a warning. Disabling the toggle removes it.

**Effort:** ~1 hour

**Notes:** 2026-05-02 — Implemented as a client-side `window.confirm()` matching the `confirm_above_pct` pattern (#4) instead of a hard server-side block, because news-avoidance is a personal-discipline tool not a security boundary. New `lib/queries/news-avoidance.ts` exposes `getNewsAvoidanceContext()` — reads the user's settings + window, fetches high-impact events whose blocked window `[event - before, event + after]` overlaps `now`. `(dashboard)/layout.tsx` calls it once and passes through `TradeDefaults.news_avoidance`. `LogTradeModal.onSubmit` splits the pair into currency codes, finds matching events, fires confirm() listing each event with relative time ("USD CPI in 4m"). Cancel → `e.preventDefault()`. Pending orders skip the check. Server-side backstop intentionally skipped — soft warning by user's own request.

---

### 3. `[x]` Enforce `require_journal_screenshot` and `require_journal_mood`

**Why:** Same pattern as #1, two more toggles in Settings → Journal defaults.

**Files:** same as #1.

**Acceptance:** Each toggle, when on, blocks submit with a clear error.

**Effort:** ~20 min (after #1 lands the pattern)

**Notes:** 2026-05-02 — `JournalDrawerProvider` now accepts `requireJournalScreenshot` and `requireJournalMood`. `EntryEditorDrawer.handleClose` aggregates all 3 missing-field cases into a single confirm message ("Your settings require pre-trade notes, a chart screenshot, and a mood tag. Close anyway?"). Trade-only — ideas/session-plans skip the guard. `(dashboard)/layout.tsx` reads both flags from `user_settings` and threads them through. Modal: mood field now shows asterisk + `required` when toggle on, with `FieldError` for `state.fieldErrors.mood`. Server: `createTrade` aggregates `notes` + `mood` field errors into a single `fieldErrors` payload before risk pre-flight. Screenshot enforcement is **drawer-side only** (Log Trade modal has no screenshot field; uploads happen in the entry editor).

---

### 4. `[x]` Wire `confirm_above_pct` confirm dialog

**Why:** Setting exists in Settings → Trading defaults. If a trade's risk_amount exceeds `confirm_above_pct × equity`, show a confirm dialog before submit ("Risk $X is N% of equity. Confirm?").

**Files:**
- `src/components/trades/log-trade-modal.tsx`

**Acceptance:** Setting at 1%, account equity $10k, entering risk_amount = $200 → confirm dialog appears. At $50 → no dialog.

**Effort:** ~30 min

**Notes:** 2026-05-02 — `confirm_above_pct` added to `TradeDefaults` and threaded from `(dashboard)/layout.tsx`. Modal `<form>` now has an `onSubmit` handler that reads `risk_amount` + selected account's `equity` from the form, computes the % of equity, and fires `window.confirm()` with `e.preventDefault()` on cancel. Pending orders skip the guard (no immediate risk). Setting at 0 disables the check entirely.

---

### 5. `[x]` `display_currency` actually drives currency conversion

**Why:** Persisted but every `formatUSD` hardcodes USD. Real fix needs an FX rate source.

**Notes:** 2026-05-02 — Built without an external rate API. New `user_settings.fx_rates` jsonb column stores user-managed rates as a flat map keyed by `FROM->TO`. New `lib/money.ts` provides pure helpers (`convert`, `formatMoney`, `formatMoneyConverted`, `sumInDisplayCurrency`, `parseFxRates`). New `lib/money-context.tsx` provides client hook `useMoney()` for components. `MoneyProvider` wired through `(dashboard)/layout.tsx` reading `display_currency` + `fx_rates`. New Settings → FX rates panel (`fx-rates-panel.tsx`) with Add/Remove rows, validating `FROM->TO` shape and positive numbers. New `updateFxRates` server action with Zod-validated JSON parsing. Aggregation **applied at Accounts page** Total Equity / Open P&L / Funded Capital / 7d delta — `sumInDisplayCurrency` handles per-account currency conversion and surfaces a missing-rates warning chip with "Set rates" deep-link to Settings. Per-account cards still show native currency. **Not yet applied** to Reports tax summary, Risk total-at-risk, Dashboard PnL strip — easy follow-ups since the helpers are in place.

---

### 6. `[x]` `pnl_display` (money / R-multiple / percent)

**Notes:** 2026-05-02 — New `lib/pnl-display.ts` with `formatPnL(mode, opts)` pure helper supporting "money" | "rmultiple" | "percent". Client provider `lib/pnl-display-context.tsx` exposes `mode`, `format()`, and `label()` (so column headers can render "P&L (R)" / "P&L (%)" / "P&L"). Wired through `(dashboard)/layout.tsx`. **Applied to Ledger row P&L column** (header label flips, cell value formats per mode) and **Trade Detail Drawer "Realized P&L" headline**. Money + R-multiple work everywhere; percent mode falls back to "—" where account equity isn't plumbed (acknowledged shortcut — proper percent needs balance-at-trade context). Settings → Appearance toggle was already in place from Phase 0.

---

### 7. `[x]` `cap_by_prop_rule` capping the suggested risk size

**Notes:** 2026-05-02 — `(dashboard)/layout.tsx` now also fetches `getAllRiskRules()` and threads enabled per-account caps (`max_risk_per_trade_usd` + `max_risk_per_trade_pct`) into `TradeDefaults.account_risk_caps`. `cap_by_prop_rule` flag also threaded. `LogTradeModal.suggestedRiskUsd` memo reworked to also compute `capped` flag + `capLabel`. When the cap kicks in, an inline amber hint appears below the Risk ($) field: `ℹ Capped at FunderPro 1% rule` or `ℹ Capped at $500 per-trade cap`. Disabled risk_rules rows skip the cap (matches the "Active/Disabled" toggle on the Risk page).

---

## 🟡 Foundation gaps

### 8. `[~]` Verify Vercel env has `SUPABASE_SERVICE_ROLE_KEY`

**Why:** TradingView webhook returns 500 without it. If this isn't set, no webhook trade has ever inserted in prod.

**Files:** Vercel project → Settings → Environment Variables

**Acceptance:** `npx vercel env ls production | grep SUPABASE_SERVICE_ROLE_KEY` returns a row. Test by hitting your webhook URL with a sample payload.

**Effort:** 5 min

**Notes:** 2026-05-02 — **Confirmed missing in both prod (Vercel) and local (.env.local)**. Service role keys can't be safely retrieved by automation, so this needs manual action by user:

  1. **Get the key** — open Supabase project dashboard → Project Settings → API → "service_role" secret → click reveal + copy. Treat it like a database password — never commit to git.
  2. **Add to Vercel** —
     ```bash
     cd app && npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
     # paste the key when prompted
     ```
     Then redeploy: `npx vercel --prod --yes` (or just push any commit).
  3. **Add to local .env.local** (so dev mode also works):
     ```
     SUPABASE_SERVICE_ROLE_KEY=eyJh...your-secret-here
     ```
  4. **Verify** — go to `/settings?tab=integrations`, generate a webhook URL if you haven't, then `curl -X POST <url>` with a tiny JSON payload like `{"pair":"EUR/USD","side":"long","entry":1.08,"size":1000}`. Should return `200` with the trade ID; check `/ledger` for the new row.

  Currently only `route.ts` consumes this env var (the TradingView webhook endpoint at `src/app/api/webhooks/tradingview/[userId]/route.ts`). All other server-side code uses the regular Supabase client which respects RLS via the user's JWT.

---

### 9. `[x]` CSV import for accounts

**Why:** Account card empty state advertises "Manual entry · CSV import · TradeLocker connection" but CSV doesn't exist. CSV is the universal broker bridge — works for MT4/5, cTrader, FunderPro, and any platform that exports trade history.

**Files (new):**
- `src/lib/integrations/csv/parser.ts` — `papaparse` + column mapping
- `src/components/accounts/csv-import-modal.tsx` — file upload + column map UI + preview
- `src/lib/actions/csv-import.ts` — bulk insert with dedup by (account_id, opened_at, pair)

**Schema:** Reuse `trades` table. Add `external_id` style key for dedup if not already there (it is).

**Acceptance:** Upload a CSV with 50 historical trades → preview shows mapped columns → confirm imports them → Ledger shows them.

**Effort:** ~half day

**Notes:** 2026-05-02 — Installed papaparse + types. Architecture: 4-step modal (Pick → Map → Preview → Done), column auto-detection against a wide alias list (MT4/5/cTrader/FunderPro headers all auto-map). Required fields (pair, side, entry_price, size) must be mapped before Preview. Pure helpers in `lib/integrations/csv/parser.ts` — `parseCsvFile`, `normalizeRows`, `parseTimestamp` (handles ISO + MT-style "YYYY.MM.DD HH:mm:ss"). Server action `importCsvTrades` (in `lib/actions/csv-import.ts`) dedups via synthetic `csv:${external_id}` or `csv:${opened_at}|${pair}|${side}|${size}` so re-uploads of the same CSV are idempotent. Each imported trade also gets entry/exit fills via `trade_fills` so the Ledger renders identically to broker syncs and the recompute trigger maintains aggregates. New `CsvImportButton` rendered next to "Add account" in the Accounts page header. Preview step shows "will import / skipped invalid / total parsed" KPI plus first 8 valid rows + per-issue summary of invalid rows.

---

### 10. `[x]` Onboarding wizard for new users

**Why:** New users land on Dashboard cold with zero accounts/playbooks/trades. A 3-step wizard ("Add your first account → name a playbook → log a trade") drastically improves first-session feel.

**Files (new):**
- `src/app/(dashboard)/onboarding/page.tsx` — gated when `accounts.length === 0`
- Or: `src/components/onboarding/onboarding-modal.tsx` — full-screen modal triggered from `(dashboard)/layout.tsx`

**Acceptance:** New user signs in → onboarding fires → completes 3 steps → lands on Dashboard with seeded data. Existing user with ≥ 1 account never sees it.

**Effort:** ~half day

**Notes:** 2026-05-02 — Modal approach (not separate route). Schema migration `user_settings_onboarded_at` adds nullable `onboarded_at` timestamptz; `(dashboard)/layout.tsx` selects it and gates the modal on `!onboarded_at && accounts.length === 0`. New `completeOnboarding` server action sets the timestamp on either "Skip for now" or "I'm done — close". Modal renders three step cards with checkmark progress (Step 1 lights green when `accounts.length > 0`). Step 1 opens the existing `AccountFormModal` (reused — manual or TradeLocker), Step 2 deep-links to `/playbooks`, Step 3 opens the existing Log Trade modal via `useLogTrade()`. Hero copy + 2-min tagline + skip-confirm dialog.

---

### 11. `[~]` Daily TradeLocker sync via Vercel Cron

**Why:** Manual sync only today. Daily cron → "wake up and yesterday's trades are already there" is a real magic moment.

**Files (new):**
- `src/app/api/cron/sync-tradelocker/route.ts` — iterates `broker_connections WHERE provider='tradelocker' AND enabled=true`
- `vercel.json` — schedule entry: `{ "crons": [{ "path": "/api/cron/sync-tradelocker", "schedule": "0 6 * * *" }] }`

**Acceptance:** Cron runs daily at 06:00 UTC, hits all enabled TradeLocker connections, logs result to `last_sync_status`. Verify via Vercel cron logs.

**Effort:** ~1 hour

**Notes:** 2026-05-02 — Code shipped, **needs `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` env vars set in Vercel before it works**. Architecture:
  - Refactored `syncTradeLockerConnection` into a `_syncTradeLockerCore(connectionId, supabase)` helper that takes any client. `user.id` derived from `conn.user_id` (not from the cookie) so admin contexts work.
  - Two public wrappers: `syncTradeLockerConnection` (cookie-authed, RLS-gated) and `syncTradeLockerConnectionAdmin` (service-role, used by cron).
  - `listTradeLockerConnections()` returns enabled connection IDs via service-role.
  - Route at `src/app/api/cron/sync-tradelocker/route.ts` checks `Authorization: Bearer ${CRON_SECRET}` header (Vercel auto-injects when env var is set), then sweeps each connection sequentially. Per-connection try/catch so a single broken account doesn't fail the whole sweep.
  - `vercel.json` schedules daily at 06:00 UTC (= 1 AM ET, after NY session close so morning view has yesterday's trades).

  **User action required to activate:**
  ```bash
  cd app
  npx vercel env add CRON_SECRET production
  # paste a long random string (e.g. `openssl rand -hex 32`)
  npx vercel env add SUPABASE_SERVICE_ROLE_KEY production  # if not done in #8
  npx vercel --prod --yes
  ```
  Manual test: `curl -H "Authorization: Bearer $CRON_SECRET" https://4x-journal.vercel.app/api/cron/sync-tradelocker` — should return JSON summary with per-connection results.

---

## 🟢 High-leverage, small lift

### 12. `[x]` Mobile QA pass at 375px

**Why:** Sidebar collapses to hamburger ≤ 768px ✅. But Risk page uses `repeat(4, 1fr)` for gauges — breaks below 600px. Reports KPI strip same. Several other pages too.

**Files to scan:** Every `*/page.tsx` and view component. Search for `gridTemplateColumns: "repeat(4` and `repeat(3`.

**Fix pattern:** Swap `repeat(N, 1fr)` → `repeat(auto-fit, minmax(180px, 1fr))` (or `200px` for wider cards).

**Acceptance:** Click through every page in iPhone mini width (375px) in Chrome devtools. No horizontal scroll. No clipped text.

**Effort:** 1–2 hours

**Notes:** Use this as a chance to add a `375px` chip in your devtools for future regression checks.

---

### 13. `[x]` Loading skeletons via `loading.tsx`

**Why:** Zero pages have loading UI. On slow network, blank screen for 1–2s while server-side data loads.

**Files (new, one per route segment):**
- `src/app/(dashboard)/dashboard/loading.tsx`
- `src/app/(dashboard)/ledger/loading.tsx`
- ...etc for all 10 pages

**Pattern:** Each loading.tsx returns a `<SkeletonPage />` that matches the page's KPI strip + main content shape.

**Acceptance:** Throttle to "Slow 3G" in devtools, navigate between pages — see skeleton instead of blank.

**Effort:** 1 hour

**Notes:** Build one shared `<SkeletonCard>` and `<SkeletonTable>` and reuse.

---

### 14. `[x]` Realtime trade updates via Supabase Realtime

**Why:** If a TradingView webhook fires while you're on the Ledger, you have to refresh. Supabase Realtime can push it.

**Files:**
- `src/components/ledger/trade-table.tsx` (or a wrapper) — `useEffect` subscribing to `trades` channel, calling `router.refresh()` on insert
- Same pattern in Dashboard widgets that show open positions

**Acceptance:** Insert a trade via webhook (or directly in Supabase SQL editor) → Ledger row appears within 1s without refresh.

**Effort:** ~1 hour, big "wow"

**Notes:** Use `INSERT` filter with `user_id=eq.{userId}` to avoid leaking events.

---

### 15. `[x]` Public profile route `/u/[handle]`

**Why:** `handle` field is in `user_settings` but no route consumes it. Read-only profile with display name + (opt-in) recent journal entries.

**Files (new):**
- `src/app/u/[handle]/page.tsx`
- `src/lib/queries/public-profile.ts` — RLS-aware lookup by handle
- Migration: index on `user_settings.handle`, public RLS policy for opt-in entries

**Acceptance:** Visit `/u/your-handle` while signed out → see name + (eventually) entries you've marked public.

**Effort:** ~half day for read-only

**Notes:** Sharing individual journal entries needs an `is_public` column on `journal_entries` — separate item.

---

## 🟣 Bigger lifts

### 16. `[-]` MT4 / MT5 webhook bridge

**Why:** Forex retail's largest user base. Bridge = a Python or MQL Expert Advisor running on the user's MT terminal that POSTs fills to your existing TradingView webhook endpoint.

**Files (new):**
- `docs/mt4-bridge.md` — install instructions
- `bridges/mt4/4xJournalBridge.mq4` — sample EA
- Maybe: a separate `/api/webhooks/mt4/[userId]` endpoint with MT-specific payload mapping

**Effort:** ~1 day for the EA + docs

**Notes:** 2026-05-03 — Deferred. User decision: not integrating other broker platforms yet (same call as #17 cTrader). The TradingView webhook + CSV import already cover MT users who can pipe fills out via either path. Revisit when there's clear demand for a one-click MT install.

---

### 17. `[-]` cTrader Open API integration

**Why:** Official OAuth API, well-documented, second-most-popular Forex platform.

**Files:** mirror the structure of `src/lib/integrations/tradelocker/*`.

**Effort:** ~1 day

**Notes:** 2026-05-03 — Deferred. User decision: not integrating other broker platforms yet. TradeLocker (live) + CSV import (universal fallback) cover the current need. Revisit when user demand for cTrader specifically appears, or when MT4/5 bridge (#16) is also being scoped — at that point doing both broker integrations as a batch makes more sense than picking off cTrader alone.

---

### 18. `[x]` Coach AI nudges

**Why:** Phase 10 placeholder. Server action takes last 30 days of trades + journal entries → asks Claude *"What patterns do you see? Where am I leaking edge?"* → renders in the existing `CoachNudge` widget slot on Dashboard.

**Files (new):**
- `src/lib/actions/coach.ts` — server action calling Anthropic API
- `src/components/dashboard/coach-nudge.tsx` — render result with regenerate button
- env: `ANTHROPIC_API_KEY`

**Acceptance:** Open Dashboard → CoachNudge widget shows 2-3 specific observations citing actual trades/dates from your data.

**Effort:** ~half day

**Notes:** 2026-05-03 — Code complete and live. `lib/actions/coach.ts` exports `generateCoachInsights(force=false)` which (1) returns `{configured: false}` when ANTHROPIC_API_KEY is missing so the widget can fall back gracefully, (2) reads a per-day `user_settings.coach_cache` JSON blob to avoid blasting the API on every page load, (3) fetches last-30-days trades + entries + playbooks, builds a compact dataset (≤200 chars per pre/post-trade text), calls `claude-3-5-haiku-latest` with a strict system prompt requiring 2-3 cited observations as a JSON array, parses the response, caches it. `CoachNudge` widget on the Dashboard handles all four states: loading (just spawned), AI-available (ul with bullets + Refresh button), AI-not-configured (deterministic narrative + setup hint), AI-errored (deterministic narrative + amber error line). Will activate as soon as the user adds ANTHROPIC_API_KEY to Vercel — no other code changes needed. Rate-limiting beyond the daily cache is intentionally not implemented; the cache *is* the rate limit.

---

### 19. `[x]` Email delivery (Resend) + weekly digest

**Why:** All `notify_*` toggles wait for delivery. Email is the lowest-friction first channel.

**Files (new):**
- `src/lib/email/resend.ts` — client + templated send
- `src/app/api/cron/weekly-digest/route.ts` — Vercel cron, Sundays 18:00 UTC
- env: `RESEND_API_KEY`

**Acceptance:** With `notify_weekly_report=true`, get an email Sunday evening summarizing the week's P&L, trade count, top playbook.

**Effort:** ~3 hours

**Notes:** 2026-05-03 — Code complete and live. `lib/email/weekly-digest.ts` exports `sendWeeklyDigests()` — uses service-role Supabase client to find users with `notify_weekly_report=true` AND `email_digest='weekly'`, joins their auth email via `auth.admin.getUserById`, computes 7-day stats (closed count, wins/losses, WR, total P&L, avg R, top pair), renders dark-mode-styled HTML email, sends via Resend. Cron route `/api/cron/weekly-digest` is bearer-CRON_SECRET-gated, scheduled in vercel.json for Sundays 18:00 UTC. Returns explicit "not configured" errors when `RESEND_API_KEY`, `EMAIL_FROM`, or `SUPABASE_SERVICE_ROLE_KEY` are missing — graceful no-op. Will activate as soon as Vercel has all three env vars + a verified Resend sender. Resend free tier covers personal use easily.

---

### 20. `[x]` Web push notifications

**Why:** Real-time daily DD alerts, news warnings. Works on installed PWA.

**Files (new):**
- `public/sw.js` — service worker
- `src/lib/push/subscribe.ts` — VAPID-based subscription flow
- `src/components/settings/push-section.tsx` — UI to enable/disable per device

**Effort:** ~half day

**Notes:** 2026-05-03 — Code complete and live. Service worker at `public/sw.js` handles push events + click-to-focus. Settings → Notifications has `<PushSection />` with full lifecycle: detects unsupported browsers, detects missing VAPID config, registers SW + requests permission + subscribes via PushManager + persists subscription to `push_subscriptions` table on enable, unsubscribes + deletes on disable. Server actions in `lib/actions/push.ts` — `subscribePush`, `unsubscribePush`, and `pushToUser(userId, payload)` for future alert flows (daily DD warnings, news windows, payouts) to call. `pushToUser` cleans up dead subscriptions (410/404 responses → row delete). Activates when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` are set; otherwise the section renders a "not configured" message with the `npx web-push generate-vapid-keys` setup instruction.

---

### 21. `[x]` Test coverage (zero today)

**Why:** Plan called for `pnpm test` between phases. We never wrote one. Highest-value smoke tests:

1. `lib/finance.ts` — `computeR`, `computePnL` (pure functions, easy)
2. `lib/risk.ts` — `evaluateTrade` (the pre-flight that protects your capital)
3. One Playwright e2e: sign in → log a trade → see it in Ledger

**Files (new):**
- `vitest.config.ts`
- `src/lib/finance.test.ts`
- `src/lib/risk.test.ts`
- `e2e/log-trade.spec.ts` (Playwright)

**Effort:** ~half day

**Notes:** Pure-function tests first, e2e last.

---

## ⚪ Polish (later)

- `[x]` **Empty state copy audit** — some are placeholder, not punchy
- `[x]` **Keyboard shortcuts** — `c` to log trade, `?` for help, `g`+letter for navigation
- `[x]` **Global command palette (cmd-K)** — power-user fast nav
- `[x]` **Error boundaries** — server actions throw, page just dies; wrap each route segment
- `[x]` **In-app help docs** — Settings has "Help docs" button in prototype that goes nowhere
- `[x]` **Sentry / error tracking in prod**
- `[x]` **Avatar upload** — currently gradient-initials only
- `[x]` **Account email change flow** — currently impossible without admin
- `[x]` **Rate limit auth-less endpoints** (webhook, etc.) via Upstash
- `[x]` **RLS policy audit** — every table, every operation
- `[-]` **Backtest** — deferred indefinitely (see conversation 2026-05-02 for the explanation)

### Polish notes — 2026-05-03

**Empty state copy audit:** Stripped "Phase X" dev-jargon from the Calendar empty state and the Backtest stub. Calendar now reads honestly ("widen your watchlist to see more"); Backtest now points users to the Risk-of-Ruin + Monte Carlo cards on Analytics as the closest forward-projection alternative. Ledger empty state rewritten to surface the three actual ways to populate it (log modal / TradeLocker sync / CSV) rather than just "tap Log Trade." Other empty states (Accounts, Watchlist, Playbooks, Journal, Reports roadmap tiles) audited and left as-is — they were already clear.

**Global command palette:** New `src/components/shell/command-palette.tsx`. Listens for ⌘K / Ctrl+K globally — intentionally overrides typing-target detection so it works inside text inputs too. Substring + soft-fuzzy match across label + keywords. Arrow keys + Enter to run, Esc to dismiss. Commands include all 11 nav targets (Dashboard, Ledger, Journal, Analytics, Playbooks, Risk, Calendar, Watchlist, Accounts, Reports, Settings) plus 5 actions (Log trade, Log idea, Open Tax settings, Open Integrations settings, Open Help docs). Mounted in `(dashboard)/layout.tsx` next to `<KeyboardShortcuts />`. Help overlay updated to advertise ⌘K as the first row.

**In-app help docs:** New `/help` route with sticky-side navigation. 12 sections: Quick start, Keyboard shortcuts, TradeLocker connection (with server-name examples), TradingView webhook (with copy-pasteable JSON payload), CSV import, Risk rules, Coach AI, Tax exports (Form 8949), Sharing entries (public profile vs private token), Display currency + FX rates, FAQ (5 entries covering metals P&L, account scope, risk-of-ruin, deletion, bug reporting), and Environment variables (admin reference for self-hosters). Discoverable via the command palette ("Open Help docs"). The "Help docs" button mentioned in the original punchlist note didn't exist in the current codebase yet — it was a prototype reference.

**Sentry / error tracking:** New `lib/observability.ts` with `captureException(err, ctx)` + `captureMessage(msg, ctx)`. **No SDK dependency added** — the function POSTs directly to Sentry's HTTP envelope endpoint when `SENTRY_DSN` is set, parsing the DSN once and caching the result. When unset, console.error in a structured JSON format Vercel's logs panel highlights. Wired into `error-fallback.tsx` so every route's `error.tsx` boundary now reports to Sentry automatically when configured. Trade-off: no transactions / breadcrumbs / source maps without the SDK; that's the cost of skipping the ~200KB dep. Easy to upgrade later if needed.

**Avatar upload:** Migration `user_settings_avatar_url` adds a nullable `avatar_url text` column. Migration `avatars_storage_bucket` creates a public Supabase Storage bucket (`avatars`) with per-user write policies (path `<user_id>/avatar.<ext>` so the foldername check enforces ownership). New `uploadAvatar(formData)` and `removeAvatar()` server actions in `lib/actions/settings.ts` — 2 MB max, JPEG/PNG/WebP/GIF only, upserts the file (same path each upload, no orphans). ProfilePanel renders an `<img>` when `avatar_url` is set, else falls back to the existing gradient-initials. Upload + Replace + Remove buttons. /u/[handle] page now shows the uploaded avatar; `get_public_profile` RPC was dropped + recreated to include `avatar_url` in its return shape (Postgres can't change return types in place). Public-bucket-listing advisor warning resolved by dropping the broad SELECT policy on `storage.objects` — public buckets serve files via direct URL without needing one.

**Account email change flow:** Schema-less. New `changeEmail` server action calls `supabase.auth.updateUser({ email })` which triggers Supabase's confirmation-link flow (link goes to the *new* address; sign-in email doesn't change until clicked). New `EmailChangeForm` subcomponent in ProfilePanel — collapsed-by-default to a "Change" link, expands to inline form when clicked, shows a green "Confirmation email sent" success state.

**Rate limit auth-less endpoints:** Skipped Upstash since we already have Supabase. New `rate_limits` table + `consume_rate_limit(p_key, p_window_seconds)` SECURITY DEFINER RPC that atomically increments a counter, resetting the window when older than the configured TTL. New `lib/rate-limit.ts` with `checkRateLimit(key, {limit, windowSeconds})` — returns `{ok, remaining, count, skipped?}`. Fail-open on misconfiguration (no SUPABASE_SERVICE_ROLE_KEY) and on RPC error so transient DB issues don't block legitimate traffic. Wired into the TradingView webhook at 60 requests/minute per userId — generous for any real alert flow, squashes runaway TradingView loops + brute-force attempts on the secret. Returns 429 with `Retry-After: 60` when exceeded. Direct table access on `rate_limits` revoked from anon/authenticated; only the SECURITY DEFINER RPC can read/write.

**RLS policy audit:** Used Supabase MCP advisors to enumerate all RLS issues. **Findings + fixes:**
  - `rate_limits` had RLS disabled — enabled, plus revoked direct grants from anon/authenticated. The SECURITY DEFINER RPC bypasses RLS as intended; no other path reads/writes the table.
  - All 11 user-owned tables (`accounts`, `trades`, `journal_entries`, etc.) verified to have RLS enabled with the right CRUD shape and `auth.uid() = user_id` enforced on both `USING` clauses (SELECT/UPDATE/DELETE) and `WITH CHECK` clauses (INSERT). No table allows a user to insert rows attributed to a different user.
  - `economic_events` confirmed read-only-public — that's intentional (calendar is shared data).
  - **Locked down internal SECURITY DEFINER functions** that were callable by anon/authenticated via PostgREST's `/rest/v1/rpc/`: `consume_rate_limit`, `recompute_trade_aggregates`, `handle_new_user_account`, `handle_new_user_settings`. EXECUTE revoked from anon + authenticated; they continue to work from triggers and service-role calls.
  - **Pinned `search_path = public`** on the legacy trigger functions (`touch_user_settings`, `touch_updated_at`, `touch_journal_last_edited`, `trade_fills_recompute_trigger`) so a malicious schema in front of public can't redefine called identifiers.
  - **Avatars bucket public-listing warning** resolved by dropping the broad SELECT policy on `storage.objects`. Public buckets serve files via direct URL without needing it.
  - **3 SECURITY DEFINER functions intentionally remain anon-callable**: `get_entry_by_share_token`, `get_public_entries`, `get_public_profile`. These are how unauthenticated users view shared profiles + entries; the token / handle is the access control. Tokens are 32-byte URL-safe random; brute-force is infeasible. These warnings stay in the advisor as "known + intentional."
  - **One Supabase Auth setting** the linter flagged needs the dashboard, not SQL: enable "Leaked password protection" (HaveIBeenPwned check) under Auth → Password Security. Recommend doing this when the user logs in to the Supabase dashboard next.

---

## 🔵 Sprint A — Capture broker data we already pay for

These all stem from the same audit on 2026-05-03: TradeLocker returns a lot more per-trade and per-account than we currently store. ~Half a day total to land all four; afterwards every analytics module gets richer data for free.

### 22. `[x]` Capture per-trade broker fields on `trade_fills`

**Why:** TL returns `commission`, `swap`, `tax`, `requestPrice` (vs `avgPrice` for slippage), `orderType`, `executionType`, `magicNumber`, `comment` on every order — we drop them all. Adding them unlocks slippage analytics, true net P&L, market-vs-limit edge, and algo-vs-manual splits.

**Files:**
- Migration `trade_fills_broker_fields` adds columns: `commission` numeric, `swap` numeric, `tax` numeric, `request_price` numeric, `order_type` text, `execution_type` text, `magic_number` text, `broker_comment` text
- `src/lib/integrations/tradelocker/client.ts` → extract these fields in `decodeRows` + `reconstructClosedTrades` and surface them on the `TLPosition` / order shape
- `src/lib/actions/tradelocker.ts` → write them into `trade_fills` rows during the import loop
- Regenerate `database.types.ts`

**Acceptance:** Re-sync TradeLocker → fills inserted with non-null commission/swap/orderType where TL exposes them. Verify via SQL.

**Effort:** ~2 hours

**Notes:** 2026-05-03 — Migration `trade_fills_broker_fields` adds 8 nullable columns: `commission`, `swap`, `tax`, `request_price`, `order_type`, `execution_type`, `magic_number`, `broker_comment`. New `TLOrderMeta` type + `extractOrderMeta()` helper in `client.ts` normalize TL field-name variants (`commission`/`commissions`, `orderType`/`type`, `swap`/`rollover`, etc). `TLPosition` now carries `entryMeta` + `exitMeta` since per-fill metadata differs from per-trade. Both `objectToPosition` (open positions) and `reconstructClosedTrades` populate the metadata. Importer at `lib/actions/tradelocker.ts` extends `FillInsert` with all 8 columns, writing entry-fill data from `entryMeta` and exit-fill data from `exitMeta`. Existing `external_provider,external_id` upsert key unchanged → re-syncs idempotent. `database.types.ts` regenerated via Supabase MCP.

---

### 23. `[x]` Capture margin / free-margin / margin-level on `accounts`

**Why:** TL's `/state` endpoint returns `equity`, `marginUsed`, `freeMargin`, `marginLevel`, floating P&L, cumulative swap. We extract balance + projectedBalance + availableFunds and ignore the rest. Margin level dropping below 100% is the literal definition of margin call — surfacing it is the difference between "I got margin-called" and "I avoided it."

**Files:**
- Migration `accounts_margin_fields` — add to `accounts`: `margin_used` numeric, `free_margin` numeric, `margin_level` numeric (percent), `floating_pnl` numeric, `swap_total` numeric. (Existing `equity` column is already there — re-purpose it as the live equity reading.)
- Update `decodeAccountState` in `client.ts` to extract them
- Update TL importer to write them on every sync
- Regenerate types

**Acceptance:** Open an account with floating positions, hit Sync. Account row's `margin_used` + `margin_level` reflect TL's live numbers.

**Effort:** ~1 hour

**Notes:** 2026-05-03 — Migration `accounts_margin_fields` adds 5 nullable numerics: `margin_used`, `free_margin`, `margin_level` (percent), `floating_pnl`, `swap_total`. `TLAccountState` type extended; `decodeAccountState` reads all 5 with fallback variants (`marginUsed`/`usedMargin`/`margin`, `unrealizedPl`/`floatingPl`/`floatingProfitLoss`, etc) — the existing `accountColumns` zip from `/trade/config` keeps it forward-compatible. Importer's account-state patch extended with all 5 columns. Existing `equity` column kept (= TL `projectedBalance` = balance + floating). Also added `lib/status.ts` shared helper: `marginStatusColor()` returning `"green"|"amber"|"red"|"black"|"muted"` with thresholds `>=300 green`, `150–300 amber`, `100–150 red`, `<100 black`, plus `MARGIN_COLOR_VAR` and `MARGIN_BG_VAR` maps to CSS vars — single source of truth used by AccountCard, AccountDrawer, RiskAccountCard, MarginCallCard, MarginProjection.

---

### 24. `[x]` Surface broker fields on Trade Detail Drawer

**Why:** Once #22 is in, render the new fields in the Order tab — commission line, swap line, slippage in pips (computed: `requestPrice − avgPrice` in pip units), order type chip (Market / Limit / Stop) on the header. Net P&L = gross P&L − commission − swap.

**Files:**
- `src/components/trades/trade-detail-drawer.tsx` — add a "Costs" sub-section under Order tab; add a slippage badge next to the entry price; flip the order type chip in the header

**Acceptance:** Open a TL-synced trade with non-zero commission. Drawer shows it line-by-line. Slippage badge reads `+0.3p` or `−1.2p` based on direction.

**Effort:** ~1 hour

**Notes:** 2026-05-03 — `OrderTypeChip` (Market/Limit/Stop) added to drawer header next to `StatusChip`, sourced from the primary entry fill's `order_type`. Slippage badge inline next to "Avg entry" cell — uses `pipsBetween(request_price, price, pair)` with sign flipped per side (long: filled above request = negative/red, short: filled below request = negative/red). Cell component extended with optional `badge` prop (text + color + tooltip). New "Costs" sub-section between Fill summary and Tags renders Commission, Swap, Tax cells (sums entry+exit fill values) and a Net P&L line (gross − commission − swap − tax). All badges/sections hide cleanly when broker doesn't expose the field, so manual entries are unaffected.

---

### 25. `[x]` Surface margin metrics on Account Card / Drawer / Risk page

**Why:** Once #23 lands, these numbers are live in the DB. Add to the Account Card a small bar showing `margin_used` consumption; in the drawer Overview tab add 4 cells (Equity, Free Margin, Margin Used, Margin Level). On the Risk page, replace or augment the existing usage gauges with margin-level data.

**Files:**
- `src/components/accounts/account-card.tsx` — small margin progress bar in the footer chips area
- `src/components/accounts/account-drawer.tsx` — Overview tab gets margin cells
- `src/components/risk/risk-account-card.tsx` — add a margin-level gauge (4th gauge in the strip)

**Acceptance:** With a TL account synced, Account Card shows a visible margin bar. Risk page gauge reads the actual margin level.

**Effort:** ~1.5 hours

**Notes:** 2026-05-03 — **AccountCard**: new `MarginBar` component renders below the stats grid when `margin_level != null` — 6px-tall bar with width = min(100%, margin_used/equity), color via `marginStatusColor`, headline shows level% + "X used". Hidden entirely for non-TL accounts. **AccountDrawer Overview tab**: when `margin_level != null`, prepends a 4-cell row (Equity · Free margin · Margin used · Margin level) above the existing 2×3 grid; the level cell is colored. `Cell` component extended with optional `color` prop. **RiskAccountCard**: 5th `<GaugeCell>` for "Margin level" appended after "Per-trade cap". Local `marginLevelToFillPct(level)` maps the broker percent to a 0–100 fill where 100% = full red bar (margin call) and 600%+ = empty bar. `color` prop on GaugeCell pulled from `MARGIN_COLOR_VAR`. Gauge auto-fits into the existing `repeat(auto-fit, minmax(140px, 1fr))` grid, so it wraps gracefully on mobile.

---

## 🔵 Sprint B — Risk math no other journal has

Pure-math features (no schema, no API). Risk-of-ruin is the real differentiator vs Edgewonk / TraderSync / TradeZella.

### 26. `[x]` Risk-of-Ruin Calculator

**Why:** Most retail traders don't realize that 58% WR with +0.3R avg still has a 14% probability of 50% drawdown over 100 trades. This is the killer Coach feature.

**Files (new):**
- `src/lib/ruin.ts` — pure math: `probabilityOfRuin({ winRate, avgWinR, avgLossR, riskPerTradePct, n }): number`. Uses Monte Carlo internally (10k paths, fast enough client-side). + tests in `ruin.test.ts`
- `src/components/analytics/risk-of-ruin-card.tsx` — Analytics page section with sliders for "what if I changed risk %"
- Reuses `OverallStats` already passed to AnalyticsView

**Acceptance:** With ≥ 30 closed trades, Analytics shows: "P(50% DD over next 100 trades) = 14%" plus stats for 25% / 75% drawdown thresholds. Slider lets user override inputs to model "what if I increased risk to 1.5%".

**Effort:** ~3 hours

**Notes:** 2026-05-03 — `lib/ruin.ts` exports `probabilityOfRuin({winRate, avgWinR, avgLossR, riskPerTradePct, n, thresholds, paths, seed})` returning `{thresholds: [{threshold, probability}], medianEnding, paths}` and `ruinInputsFromStats(stats, riskPct, n)` to derive inputs from `agg()` output. Compounding model: each trade multiplies balance by `(1 + avgWinR×riskPct)` on win or `(1 − avgLossR×riskPct)` on loss; tracks peak-to-trough drawdown. Mulberry32 PRNG so seeded runs are deterministic. Default 5000 paths, snappy enough that slider changes feel instant. Tests in `ruin.test.ts` (9 cases) cover degenerate inputs (riskPct=0, WR=0/1), monotonicity (risk↑ → DD prob↑), determinism, and `ruinInputsFromStats` derivation. `RiskOfRuinCard` renders an empty state at <30 closed trades or all-wins/all-losses; otherwise shows readonly stats (WR / avgWin / avgLoss / expectancy) + sliders for risk % (0.1–5%) and horizon (50–500 trades) + 4 cells: P(25% DD), P(50% DD), P(75% DD), and median ending equity %. Color thresholds on each cell — `red ≥ 25%`, `amber ≥ 10%`, `green < 10%`. Reuses the same `agg()` stats object already computed in AnalyticsView. Slotted directly under the Risk-Sizing + Drawdown row.

---

### 27. `[x]` Monte Carlo Equity Simulator

**Why:** Forward simulation. Take user's current stats, run 1000 random paths, plot median + 5th/95th bands + horizon distribution.

**Files (new):**
- `src/lib/monte-carlo.ts` — pure simulator: `simulate({ wr, avgWinR, avgLossR, riskPct, startBalance, n, paths }): number[][]`
- `src/components/analytics/monte-carlo-card.tsx` — fan chart (median path + percentile bands as light fills) + horizon distribution bars at the right edge

**Acceptance:** Card shows 1000 forward paths shaded. Sliders for `n` trades + risk %. Caption: "Median outcome at trade 100: $11,420 · 5th: $7,200 · 95th: $18,100."

**Effort:** ~3 hours

**Notes:** 2026-05-03 — Companion to #26. `lib/monte-carlo.ts` exports `simulate({winRate, avgWinR, avgLossR, riskPerTradePct, startBalance, n, paths, seed})` returning `{paths, percentiles: {p05/p25/p50/p75/p95}, endingStats}`. Same physics as #26 but emits the full path matrix; the consumer gets per-timestep percentile envelopes (computed by sorting each column) plus final-balance percentiles. Default 1000 paths. Mulberry32 PRNG, deterministic when seeded. Tests in `monte-carlo.test.ts` (6 cases) cover dimension correctness, percentile ordering, riskPct=0 edge case, 100% WR strictly-increasing paths, positive expectancy → median > start, and seeded determinism. `MonteCarloCard` renders a full-width SVG fan chart: 5–95 percentile band as outer fill, 25–75 as inner fill, median as a 1.8px stroke. Tone (green/red) auto-driven by whether median ends above/below start. Sliders identical to RiskOfRuinCard for consistency. Below the chart: 5 endpoint cells (5th / 25th / Median / 75th / 95th) with USD values + % delta. Starting balance plumbed from `analytics/page.tsx` as the sum of all account `equity` (fallback $10k for empty-account demo). Slotted directly below RiskOfRuinCard so the two pair visually on the Analytics page.

---

## 🔵 Sprint C — Live data + classification (depends on Sprint A)

### 28. `[x]` Margin Call Risk Card

**Why:** Once #23 captures `margin_level`, surface as a color-coded gauge with forward projection: "If your open trades all hit stop, your margin level would drop to X%."

**Files (new):**
- `src/components/dashboard/margin-call-card.tsx` — Dashboard widget
- `src/components/risk/margin-projection.tsx` — Risk page section showing projected margin under "all stops hit" + "all targets hit" scenarios

**Acceptance:** Card reads "Margin level: 487% · safe". Scenario row: "If all stops hit: 312% (still safe)." Color thresholds: green >300%, amber 150–300%, red <150%, black <100%.

**Effort:** ~2 hours

**Notes:** 2026-05-03 — **MarginCallCard** (Dashboard): server component fetching `getUserAccounts()`, filters to accounts with non-null `margin_level`, sorts by status severity (black > red > amber > green). Each row shows colored dot + label/broker + percent + status word ("safe"/"watch"/"danger"/"margin call"). Subtitle dynamically reads "1 account near margin call" / "1 account on watch" / "All accounts safe". Empty state ("Sync a TradeLocker account…") when no synced TL accounts. Slotted in `dashboard/page.tsx` between `<RiskGauge />` and `<SessionClock />` in the right column of `grid-2-1`. **MarginProjection** (Risk page): independent server component that queries open trades for an account and computes two scenarios — "If all stops hit" (sum of pnl-at-stop for each open trade) and "If all targets hit" (sum of pnl-at-target). Each renders a colored pill with the projected margin level + dollar P&L delta. Hidden when account has no `margin_level` or no open trades. Rendered in `risk/page.tsx` directly after each `<RiskAccountCard />`. Color thresholds match `marginStatusColor()`.

---

### 29. `[x]` Order-Type Edge Analysis

**Why:** Once #22 captures `order_type`, add Analytics breakdown comparing market vs limit vs stop entries. Often the user's best trades are limit fills (patience) and worst are market fills (FOMO).

**Files (new):**
- `src/components/analytics/order-type-analysis.tsx` — compact table similar to existing `BreakdownBars`

**Acceptance:** With a mix of order types in the data, the card surfaces the WR delta. Auto-narrative when the gap is ≥10pp: "Your limit fills win 67% — your market fills win 48%. Be patient."

**Effort:** ~1 hour

**Notes:** 2026-05-03 — Added `byOrderType(trades, fillsByTrade)` aggregator inside `analytics-view.tsx` that reads each trade's primary entry fill `order_type` and buckets into Market/Limit/Stop/Other (in display order, not P&L order — narrative depends on consistent reading). Reuses existing `aggGroup()` helper and `BreakdownBars` component verbatim — same gradient bar visual as the 4 existing breakdowns, no new card style invented. New `OrderTypeBreakdown` wrapper renders: a Connect-TradeLocker empty state when fewer than 5 trades have `order_type` populated, otherwise `BreakdownBars` with the auto-narrative as subtitle. Narrative ("Your limit fills win 67% — your market fills win 48%. Be patient.") fires when delta between best-WR and worst-WR bucket ≥ 10pp; the "Be patient." nudge only appends when the spread is specifically Limit > Market. Slotted between the existing Side+Account row and the Day-Hour heatmap in `AnalyticsView`.

---

## 🔵 Sprint D — Live quotes

### 30. `[x]` Live quote ticker for Watchlist + Open Positions

**Why:** TL's `/trade/quotes/{instrumentId}` returns live bid/ask. Watchlist rows get real prices. Open positions show real floating P&L instead of stale entry-time snapshots.

**Files (new):**
- `src/lib/integrations/tradelocker/quotes.ts` — server action that takes a list of instrumentIds, returns `Map<symbol, { bid, ask, ts }>`
- `src/components/dashboard/live-positions.tsx` — wraps Open Positions widget, polls every 10s for the user's open trades + computes floating P&L
- Watchlist row enrichment

**Acceptance:** Open Positions widget shows green/red number that updates every 10s. Watchlist rows show live bid + 24h change.

**Effort:** ~half day

**Notes:** 2026-05-03 — Shipped a 30s-poll variant rather than 10s. Fresh-login-per-poll at 10s is 6 logins/min/user — too expensive for a feature that's mostly visual confirmation; 30s = 2 logins/min and the difference is imperceptible to users. Refresh-token plumbing wasn't strictly required at 30s either, so deferred. Implementation: new `tlGetQuote(env, accessToken, accNum, instrumentId, routeId?)` in `client.ts` calls TL's `/trade/quotes/{instrumentId}` endpoint and returns `{bid, ask, ts}` (null on miss). New `getLiveQuotesForOpen()` server action fetches the user's open TL positions, groups by account (one TL session per account, not per position), then queries quotes for each. Computes mid-price floating P&L per position (`(mid - entry) × size × side`). Skipped watchlist enrichment — it would need a separate symbol→instrumentId mapping that doesn't exist yet. Client widget `LivePnlStrip` polls every 30s, pauses when the tab is hidden (saves API quota), pulses a green dot on each refresh, shows total floating P&L in the header + per-position cells. Hides entirely when no TL positions or no instrument map cached. Slotted directly above the existing `OpenPositions` table on the Dashboard.

---

## 🔵 Sprint E — Tax

### 31. `[x]` FIFO tax matcher (Schedule D / Form 8949)

**Why:** End-of-year value. We have the data; just need the algorithm. FIFO lot matching across closed trades, short-term/long-term split (forex is mostly short-term), wash-sale flagging within 30 days. Export as IRS Form 8949 CSV.

**Files (new):**
- `src/lib/tax/fifo-matcher.ts` — pure function `matchLots(trades): Lot[]` + tests
- `src/app/api/reports/form-8949/route.ts` — CSV export
- Reports page: add "Form 8949 (FIFO)" tile

**Acceptance:** With a year of trades, downloaded CSV has 13 columns (per IRS spec) and reconciles to the user's net P&L for the year ±$0.

**Effort:** ~half day

**Notes:** 2026-05-03 — Forex Section 988 = ordinary income, not capital gains — so the user's `tax_fx_election` setting determines whether to generate this. For §1256 traders, generate Form 6781 instead (60/40 split).

**Implementation:** `lib/tax/fifo-matcher.ts` exports `matchLots(trades, {applyWashSale})` returning `{rows, totals}`. Since the system stores round-trip trades (one row per opened+closed), each closed trade becomes one Form 8949 line — the "matching" work is holding-period split (<1 year = short-term Box C, ≥1 year = long-term Box F), wash-sale flagging (losing trades where any same-pair, same-side trade opens within ±30 days of close → code "W", adjustment column carries the disallowed loss, gain/loss zeroed), and net-of-costs accounting (subtracts |commission| + |swap| from gross P&L). Description column formats as `"EUR/USD long 100000 units @ 1.08000"`. Dates formatted MM/DD/YYYY per IRS spec. Rows sorted chronologically by date sold. `form8949CsvHeaders()` + `form8949CsvRow()` helpers emit exactly the columns the IRS line spec expects (we render 11 — Box, description, dates, proceeds, basis, code, adjustment, gain/loss, plus internal holding period + trade ID for reconciliation; the IRS form itself uses 8 of those plus signature/totals you can fill in by hand or in tax software). Tests in `fifo-matcher.test.ts` (11 cases) cover skipping unclosed trades, holding-period classification, fee subtraction, wash-sale matching (positive case + 4 negatives: same trade itself, different side, outside 30d window, election disabled), chronological sort, totals reconciliation, and IRS date formatting. **API route** `/api/reports/form-8949` accepts `?year=YYYY&account=<id|all>`, fetches all closed trades in `[year-31d, year+31d]` (the 30-day buffer is so wash-sale matching can see neighbors that fall outside the export window), joins broker-cost fills (`commission` + `swap` per trade), runs the matcher with `applyWashSale: election !== "988"`, narrows rows to the actual export year, then emits CSV with a totals block (short-term proceeds/basis/gain, long-term proceeds/basis/gain, wash-sale adjustment) + an "Election: §xxx" footer line. Replaced the existing "Tax Statement (PDF)" RoadmapTile on the Reports page with a real `ReportTile` (Year + Account selectors + "Year-end" badge); subtitle changes copy based on the user's §988 vs §1256 election so it's honest about whether wash-sale flagging is on.

---

## 🔵 Sprint F — Trade replay (needs market-data feed)

### 32. `[x]` Trade Instant Replay

**Why:** Click any past trade → see the H1/M15 chart for that pair on that day with your entry, stop, target, and exit marked.

**Files (new):**
- `src/lib/integrations/polygon.ts` — Polygon.io free tier client (covers FX majors)
- `src/components/trades/trade-replay-tab.tsx` — new tab inside Trade Detail Drawer
- Uses TradingView Lightweight Charts (`lightweight-charts` npm) for the viz

**Acceptance:** Open a closed trade from a week ago → "Replay" tab → candles for that day with entry/stop/target/exit markers. Time-step buttons: M5 / M15 / H1 / H4 / D1.

**Effort:** ~1 day

**Notes:** 2026-05-03 — Shipped without `lightweight-charts` dep — pure SVG candles instead. Saves ~80kb gzipped and avoids a new dependency. Implementation: new `lib/integrations/polygon.ts` Polygon REST client (no SDK), exports `getAggregates({ticker, multiplier, timespan, from, to})` for the `/v2/aggs` endpoint and `pairToPolygonTicker(pair)` for symbol mapping (`EUR/USD` → `C:EURUSD`, `XAU/USD` → `C:XAUUSD`, `BTC/USD` → `X:BTCUSD`, `SPX` → `I:SPX`). Returns `{ok: false, configured: false}` when `POLYGON_API_KEY` is unset. New `lib/actions/trade-replay.ts` exports `getReplayCandles({tradeId, timeframe})` which loads the trade, maps the pair, picks a time-window padded by 25% of the trade's lifetime (clamped 4h–30d depending on timeframe), and fetches candles. Trade Detail Drawer gains a fourth "Replay" tab between Fills + Actions. Inline `CandleChart` component renders the SVG: green/red candles with wick, dashed horizontal reference lines for stop (red) / target (green) / entry (purple), vertical entry/exit markers with colored dots at the actual price. Timeframe pills (M5/M15/H1/H4/D1) re-fetch on click. Empty/error states handled — Polygon plan limitations on indices/metals surface a clear "this symbol isn't on your plan" message.

---

## 🔵 Sprint G — Correlation alerts

### 33. `[x]` Correlation Risk Alerts

**Why:** Open positions on EUR/USD long, GBP/USD long, AUD/USD long, XAU/USD long? You don't have 4 positions — you have 1 leveraged short-USD bet.

**Files (new):**
- `src/lib/correlation.ts` — hardcoded correlation matrix for major pairs (USDJPY ↔ DXY, EURUSD ↔ DXY inverse, etc.) + tests. Eventually replaced with a rolling-correlation calc from price data.
- `src/components/dashboard/correlation-warning.tsx` — banner when net effective exposure on any single currency exceeds 200%

**Acceptance:** With 3 USD-quoted long positions, banner: "Net USD exposure 240% — this is one trade, not three."

**Effort:** ~2 hours (with hardcoded matrix; full price-based correlation is half day more)

**Notes:** 2026-05-03 — Shipped a simpler model than the original "hardcoded correlation matrix" — direct currency-exposure decomposition, which produces the same user-facing warning ("net USD exposure 240%") without requiring a correlation table. `lib/correlation.ts` exports `splitPair()` (parses "EUR/USD" → ["EUR","USD"], returns null for indices like US100), `decomposePositions()` (for each open trade splits into base + quote contributions of ±risk_amount, then sums per currency, sorted by |net|), `findCorrelationWarnings()` (returns currencies whose |net| ≥ 2× avg per-trade risk and ≥ 3 contributing trades — both thresholds configurable), and `formatExposurePct()`. The Position type is just `{id, pair, side, risk}` — the helper is decoupled from the trades schema. Tests in `correlation.test.ts` (13 cases) cover pair splitting (FX/metals/crypto/indices), decomposition basics, the canonical 4× short-USD example, balanced books, threshold tuning, and offsetting positions cancelling. Dashboard `CorrelationWarning` server component fetches `getOpenTrades()`, runs the helper, and renders **only the most-concentrated currency** as a colored banner (green for net long, red for net short) showing currency badge + "Net short USD exposure 400%" headline + plain-English narrative explaining the concentration. Returns null silently when no warnings — invisible on a balanced book. Slotted directly under PnLStrip on the Dashboard. Could be enhanced later with a real cross-asset correlation matrix (USD/JPY ↔ DXY, XAU/USD ↔ DXY-inverse) for currencies-of-currencies effects, but the simple decomposition handles 90% of the "I have 4 trades but really 1 bet" case.

---

## 🔵 Long-tail / power features

### 34. `[x]` Public per-entry sharing with token

**Why:** We already added the `is_public` flag and `/u/[handle]` route. Per-entry token URLs let the user share a single trade with a coach without exposing their handle.

**Files (new):**
- Migration: add `journal_entries.share_token` (nullable text, indexed)
- Server action `generateShareToken(entryId)` / `revokeShareToken(entryId)`
- New route `src/app/share/[token]/page.tsx` — read-only entry view
- Toggle in entry-editor-drawer next to existing "Share publicly"

**Effort:** ~3 hours

**Notes:** 2026-05-03 — **Important security fix mid-build**: my first migration attempt added a `using (share_token is not null)` RLS policy on `journal_entries`. That's wrong — it would have let any anon caller `select * from journal_entries where share_token is not null` and read every shared entry without knowing the tokens. Caught it before shipping; replaced with a `SECURITY DEFINER` RPC `get_entry_by_share_token(p_token text)` that returns exactly one matching entry, mirroring the existing `get_public_profile` / `get_public_entries` pattern. The token is now the secret — no broader visibility leak. Migration `journal_entries_share_token` adds nullable `share_token text` + a partial unique index `where share_token is not null`. Server actions `generateShareToken(entryId)` (idempotent — returns existing token if one exists, generates 32 bytes via `crypto.getRandomValues` → URL-safe base64 otherwise) and `revokeShareToken(entryId)` in `lib/actions/journal-entries.ts`. Public route `app/share/[token]/page.tsx` mirrors the `/u/[handle]` page styling — calls the RPC, 404s when no match, renders the entry with pre/post/cold/lessons sections, optional "see more from @handle" link if the owner has set a handle. New `ShareLinkField` component in the entry editor's Tags tab next to "Share publicly" — three states: (1) "Save the entry once before generating" when entry has no id, (2) generate button when no token, (3) readonly URL input + Copy + Revoke buttons when token exists. Copy uses `navigator.clipboard` with a 2s "Copied" indicator. Revoke confirms first since holders lose access immediately. Types regenerated; entry editor's load loop now also reads `e.share_token`.

---

### 35. `[x]` Coach AI v2 — prescriptive

**Why:** Current Coach AI describes patterns. Next step is prescriptive: "Stop shorts on EUR/USD — your edge is statistically negative." Same `generateCoachInsights` action; new system prompt + structured output schema.

**Files:**
- `src/lib/actions/coach.ts` — extend prompt; output now `{ observations: string[]; suggestions: { action: string; basis: string; severity: "info" | "warn" }[] }`
- `src/components/dashboard/coach-nudge.tsx` — render suggestions section below observations

**Effort:** ~2 hours

**Notes:** 2026-05-03 — System prompt rewritten to require a JSON object with `observations[]` (descriptive) + `suggestions[]` (prescriptive: imperative action + cited basis + severity). Tolerant parser: if Claude regresses to the old array-of-strings shape, upgrade transparently to the new shape with empty suggestions. New `CoachInsightsPayload` type replaces the bare `insights: string[]`; the cache blob now stores both the new payload and the old `insights` array side-by-side so a returning user with an old daily-cached blob still renders without forcing a regen. Widget extended to render a "Suggested actions" section below observations — each suggestion as a colored pill (warn = amber border + amber severity tag, info = purple) with the action sentence and the basis underneath. Activates with the same `ANTHROPIC_API_KEY` env var as #18.

---

### 36. `[x]` Position close + SL/TP modify from the journal

**Why:** Two-way TL integration. Click a position → "Move SL to break-even" → API call → confirmation toast.

**Files:**
- `src/lib/integrations/tradelocker/client.ts` — `tlModifyPosition({ posId, stopLoss, takeProfit })`, `tlClosePosition(posId)`
- New buttons on Trade Detail Drawer for open positions
- Realtime sync should reflect new SL/TP automatically

**Acceptance:** Click "Move SL to BE" on an open trade → SL updated server-side → page refreshes via realtime → drawer shows new SL.

**Effort:** ~half day

**Notes:** 2026-05-03 — Implementation: new `tlModifyPosition({env, accessToken, accNum, positionId, stopLoss, takeProfit})` and `tlClosePosition({...})` in `client.ts` — PATCH and DELETE on `/trade/positions/{positionId}` respectively. Server actions `brokerModifyPosition({tradeId, stop_price?, target_price?})` and `brokerClosePosition(tradeId)` in `actions/tradelocker.ts` look up the trade, verify ownership + that it's TL-synced + open, fresh-login to TL, send the modify/close, mirror the change locally so the UI updates immediately, and append a timestamped audit line to the trade's `notes` (e.g. `[2026-05-03T14:22:01Z] Broker modify: SL → 1.0815`). Trade Detail Drawer's Actions tab now has a "Broker actions" section (only shown for `status=open && external_provider=tradelocker`) with three controls: a one-click "Move SL to break-even (entry X.XXXXX)" shortcut, an inline edit-SL/TP form with two number inputs + Send modify, and a "Close position at market" button. Every action is wrapped in a `confirm()` dialog. After close, the action best-effort-runs an immediate `syncTradeLockerConnection` so the actual fill price + closed_at land in the journal without waiting for the daily cron.

---

### 37. `[x]` Trade ideas mode

**Why:** "I would have taken this" log without real money. After a few weeks, compare hypothetical ideas to actual trades — are you executing your best plans?

**Files:**
- Reuse existing `journal_entries.kind = "idea"` (already supported)
- New "Log idea" button next to Log Trade
- New /ideas page or filter on /journal showing ideas vs trades
- Comparison card: "You logged 12 ideas this month, executed 7 of them. The 5 you skipped would have averaged +0.8R."

**Effort:** ~half day

**Notes:** 2026-05-03 — Shipped a v1 of the comparison **without** the "would have averaged +0.8R" math, because the schema doesn't store hypothetical entry/stop/target on idea entries — adding those columns + the editor inputs to populate them is a separate feature. v1 surfaces counts + execution rate; the "would have" math waits for the schema extension.

**Implementation:** Schema reuses existing `journal_entries.kind = "idea"` with no migrations. New `createEmptyIdeaEntry()` server action in `journal-entries.ts` inserts a blank kind="idea" row and returns its id; the entry-editor-drawer's existing "Watching setup — no trade yet / Promote to a live trade when you take it" empty state handles the rest of the UX. New `LogIdeaButton` (amber-themed lightning icon, distinct from the purple Log Trade button) wired to the journal drawer context. Slotted on the Journal page header alongside `LogTradeButton` (also added to the empty-state header). New `IdeasComparisonCard` (client component, useMemo over the entry list) computes 30-day stats: total ideas, executed (have `trade_id`), watching (no trade_id, ≤14 days old), skipped (no trade_id, >14 days old). Execution rate = `executed / (executed + skipped)` — still-watching ideas don't drag the rate down because they haven't been judged yet. Headline cell shows the rate with color thresholds (≥50% green, ≥25% amber, otherwise muted). Auto-narrative below the cells fires once ≥5 ideas have been judged: ≥70% rate → "keep it up", 40–70% → "worth reviewing whether those skips were good decisions or lost edge", <40% → "either your idea bar is too low, or hesitation is leaving setups on the table". Card hides entirely when zero ideas exist. Slotted at the top of `JournalView` so it's the first thing the user sees on the journal page once they have ideas. Also flagged ideas as a Coach AI signal in the empty-state copy on first journal page visit.

**Future enhancement:** Add `idea_pair`, `idea_side`, `idea_entry`, `idea_stop`, `idea_target` columns to journal_entries (or a sibling `journal_idea_setups` table). With those, compute hypothetical R for skipped ideas using a market-data lookup at the would-have-been entry, and surface "the 5 you skipped would have averaged +0.8R". Blocked until a Polygon-style price feed lands (#32).

---

### 38. `[-]` WebSocket streaming via TradeLocker

**Why:** TL has WebSocket fills/quotes. We poll. Live push removes ~30s sync lag and per-poll API spend.

**Files:**
- `src/lib/integrations/tradelocker/socket.ts` — WS client wrapper
- Long-running listener — Vercel Functions don't keep WS alive past timeout, so likely a small Node service on Fly.io / Railway

**Acceptance:** Fill a trade in TL UI → it appears in journal Ledger within 1s without manual sync.

**Effort:** ~1 day (architecture decisions on the listener side dominate)

**Notes:** 2026-05-03 — Deferred. Vercel Functions can't keep WS connections alive past their timeout, so this requires a separate Node listener service hosted on Fly.io / Railway / similar — an architectural step-up rather than a feature. The 30s live-quote poll (#30) + the daily cron sync (#11) + manual sync button cover 99% of the latency need; users notice missing fills, not 30s lag. Revisit if/when a hosted listener becomes the right move (e.g. when daily-DD push notifications need millisecond reaction time).

---

### 39. `[x]` Coach AI auto-tagging

**Why:** When a journal entry is saved, run a secondary AI pass that suggests tags / mistakes / mood from the prose. User accepts/rejects with one click.

**Files:**
- `src/lib/actions/coach-tag.ts` — extracts `{ tags, mistakes, mood }` from `pre_trade + post_trade + cold_review` text
- Entry editor drawer shows "Coach suggests: tilt, fomo · accept all / reject" chip row

**Effort:** ~2 hours

**Notes:** 2026-05-03 — Migration `user_settings_coach_auto_tag` adds nullable boolean column (default false — opt-in) so users don't get surprise API charges. New `lib/actions/coach-tag.ts` exports `suggestEntryTags(entryId)`: gates on `coach_auto_tag = true` AND `ANTHROPIC_API_KEY` set, loads the entry's pre/post/cold/lessons text (max 4000 chars), calls `claude-3-5-haiku-latest` with a strict system prompt that returns `{tags: string[5], mistakes: string[3], mood: enum|null}`, parses tolerantly. Returns the suggestion — does NOT auto-apply. Entry editor's Tags tab now shows a "Coach: suggest tags from prose" button at the top; on click, the result expands into a panel with mood/tag/mistake chips that the user clicks individually to merge into their fields, or hits "Accept all" to merge everything at once. New "Coach AI auto-tagging" section added to Settings → Behavior with a single toggle that wires through `updateBehavior`. Cost: ~1¢ per click at haiku pricing.

---

### 40. `[x]` Trade instant context (DXY, VIX, S&P at trade time)

**Why:** When you click a past trade, see what the macro environment was doing at the moment of entry. "EUR/USD long taken on 2026-04-12 14:30 UTC · DXY was 104.23 (down 0.4%) · S&P up 0.7% · VIX 13.2 (calm)."

**Files:**
- `src/lib/integrations/polygon.ts` (shared with #32) — fetch DXY/VIX/SPX snapshot at a given timestamp
- `src/components/trades/trade-detail-drawer.tsx` — new "Context" panel inside Order tab

**Effort:** ~3 hours (after #32's Polygon plumbing exists)

**Notes:** 2026-05-03 — Built alongside #32. New `getMacroSnapshot(timestampMs)` in `polygon.ts` queries Polygon for 2-day daily bars on `I:DXY`, `I:SPX`, `I:VIX` around the requested timestamp, returns `{dxy, spx, vix, dxyPctChange1d, spxPctChange1d}`. Tolerant: any series the user's Polygon plan doesn't carry returns null and the UI just hides that cell. New `getTradeContext(tradeId)` server action in `lib/actions/trade-replay.ts` resolves the trade's `opened_at` and calls the snapshot. Trade Detail Drawer's Order tab gets a new "Context at entry" Section between Fill summary and Tags — three Cells (DXY / S&P / VIX) with the value, % change badge for DXY/SPX (green/red), and a "calm/normal/elevated" qualitative badge for VIX. Hides entirely when `POLYGON_API_KEY` isn't set or none of the three series resolved.

---

## Recommended top-3 tomorrow

If you can only do a day:

1. **Sprint A** (#22 + #23 + #24 + #25) — capture broker data we already pay for. ~Half a day. Unlocks every later analytics improvement.
2. **#26 Risk-of-Ruin Calculator** — the killer feature no competitor has. Pure math, ~3 hours.
3. **#27 Monte Carlo Equity Simulator** — pairs with #26 on the same Analytics row.

That's a single full day and the app jumps to "best-in-class trader-grade journal." Sprint C (margin call card + order-type analysis) layers on top once Sprint A is in the DB.

---

## 🟠 Sprint H — Surface broker depth we already capture

Items 41–47 lift behavioral + cost analytics out of data we already write to the DB but never aggregate. Zero new schema; just new analytics cards.

### 41. `[x]` Stop-modify behavioral analytics from `lifecycle_events`

**Why:** Every TradeLocker `Replaced` event carries the prior + new SL/TP. Aggregating across closed trades reveals "you move stops on losing trades 2.4× more often than on winning trades" — a behavioral signal nobody else's journal exposes because nobody else captures the lifecycle. This is the most original analytic we can ship.

**Files (new):**
- `src/components/analytics/stop-modify-behavior.tsx` — new card; reads `trades.lifecycle_events`, classifies SL moves (BE / trail / loosened) and TP moves (wider / tighter), buckets by trade outcome (winner / loser), surfaces frequency + size per bucket
- Slot in `src/components/analytics/analytics-view.tsx` between StopTargetAnalysis and ScaleOutAnalysis

**Acceptance:** With ≥10 closed TL-synced trades that have at least one SL or TP modify, the card shows: (a) modify counts split winner vs. loser, (b) the top 1 narrative when the gap is ≥2× ("You move stops 2.4× more often on losers — classic hope-trading"), (c) hides cleanly for users with no modify events.

**Effort:** ~2.5 hours

---

### 42. `[x]` Slippage aggregate analytics card

**Why:** Per-trade slippage badge ships in the drawer (#24). The aggregate ("market orders slip 1.4 pips on avg, costing ~$840/yr at your size; limit fills slip 0.0") is the actionable form. Pairs naturally with Order-Type Edge (#29).

**Files (new):**
- `src/components/analytics/slippage-analysis.tsx` — reads `trade_fills` with non-null `request_price`, computes pip-slippage per fill (sign-aware vs. side), splits by order_type, dollarizes via fill size

**Acceptance:** With ≥5 fills carrying `request_price`, card shows median + mean slippage per order_type bucket plus a dollar estimate. Hides when no broker-synced trades have request_price.

**Effort:** ~2 hours

---

### 43. `[x]` Fee bleed card (commission + swap + tax)

**Why:** `commission`, `swap`, `tax` are written per-fill (#22) but never aggregated. Surface YTD spend with a swap-by-day-of-week chart (Wednesday triple-rollover effect). Invisible-cost reveal — high satisfaction.

**Files (new):**
- `src/components/analytics/fee-bleed.tsx` — sums commission/swap/tax across fills in range, optional weekday-rollover breakdown for swap

**Acceptance:** With ≥30 days of TL-synced data, card shows total commission, total swap, total tax, plus a "swap by day-of-week" mini-bar visualizing the Wed rollover spike. Hides when all three sums are zero.

**Effort:** ~2 hours

---

### 44. `[x]` Magic-number / `broker_comment` → algo vs manual split

**Why:** Many prop traders run partial automation (EA, copy trade, semi-discretionary signals). `magic_number` lets us auto-bucket and run the standard win-rate / expectancy / drawdown breakdowns on each. Most journals can't do this because they don't capture magic numbers.

**Files (new):**
- `src/components/analytics/algo-vs-manual.tsx` — looks at primary entry fill's `magic_number`; bucket = "Manual" when null/0, otherwise grouped by magic-number value (with optional rename map in user_settings — out of scope for v1)

**Acceptance:** With trades that mix magic_number values, card shows side-by-side WR/expectancy/avg-R per bucket. With all-manual trades, hides cleanly.

**Effort:** ~1.5 hours

---

### 45. `[x]` Per-partial scale-out ladder

**Why:** Existing ScaleOutAnalysis card compares scaled vs. single-exit at the trade level. The next layer down: "Your 1st partial averages +0.8R, your 2nd +0.3R, your 3rd −0.1R" — telling them they scale out too late. Per-fill data is already there.

**Files:**
- Extend `src/components/analytics/scale-out-analysis.tsx` — add a "Partial ladder" sub-section under the existing KPI strip; for trades with ≥3 exits, compute median R at exit-position 1, 2, 3, …, render as a small bar chart

**Acceptance:** With ≥5 trades that have 3+ exits, ladder section appears below existing KPIs showing the per-position median R. Hides when not enough multi-partial trades.

**Effort:** ~2 hours

---

### 46. `[x]` Mistakes & rule_break_tags frequency leaderboard

**Why:** RuleBreakImpact already shows top tags + top mistakes. Add a *trend*: "'fomo' tagged 8× this month, up from 3× last month." Behavioral compounding is the journal's job.

**Files:**
- Extend `src/components/analytics/rule-break-impact.tsx` — add a "Trend vs. previous period" cell on each top-N tag/mistake; needs prev-period entry counts (compute against `trades` filtered by the prior equivalent window)

**Acceptance:** With ≥30 days of journal entries, each top tag pill shows its previous-period count + delta arrow. Hides arrow when previous period was empty.

**Effort:** ~2 hours

---

### 47. `[x]` Feed `during_trade` live notes into Coach AI

**Why:** `journal_entries.during_trade` is a JSONB array of timestamped emotional captures, surfaced beautifully in the journal-view + ledger but ignored by `coach.ts` (only reads pre/post/cold/lessons) and `coach-tag.ts`. These mid-trade notes are the highest-signal text for tilt detection — "moved stop at 14:32 because price was 'choppy'" is exactly the pattern Coach AI should call out.

**Files:**
- `src/lib/actions/coach.ts` — `.select(...)` add `during_trade`; build a compact join of `[ts] text` entries (≤300 chars) into the per-trade payload alongside thesis/review
- `src/lib/actions/coach-tag.ts` — same; concat during-trade text into the prose blob fed to the tagger

**Acceptance:** With a journal entry that has 2+ during-trade notes, the next Coach refresh cites at least one of them in an observation or suggestion (verifiable by inspecting the cached `coach_cache` payload). Tagger output reflects mid-trade sentiment.

**Effort:** ~1 hour

---

## 🟢 Sprint I — Trader analytics worth adding

Items 48–56 are new analytics that compose off existing data. Most are ~3 hours each.

### 48. `[x]` Rolling-window edge erosion

**Why:** Lifetime stats hide decay. A 20- or 50-trade rolling window for WR / expectancy / profit factor reveals when an edge is fading or the market has changed. Pairs with per-playbook view to answer "is my London Breakout still working?"

**Files (new):**
- `src/components/analytics/edge-erosion.tsx` — line chart of rolling WR + rolling expectancy over the last N trades (slider for window size 10/20/50)

**Acceptance:** With ≥30 closed trades, chart shows two overlaid lines (WR % left axis, expectancy right axis). Sliding the window updates both lines.

**Effort:** ~3 hours

---

### 49. `[x]` MAE / MFE per trade

**Why:** Maximum Adverse Excursion + Maximum Favorable Excursion is the gold standard "are you cutting winners early or holding losers too long" metric. Polygon plumbing exists from Replay (#32). Backfill MAE/MFE from intraday candles per closed trade; surface "your winners reach +1.8R MFE on average before you close at +0.9R" — the most actionable single number in trader analytics.

**Files (new):**
- Migration `trades_mae_mfe`: add `mae_price`, `mfe_price`, `mae_r`, `mfe_r` numerics
- `src/lib/actions/mae-mfe-backfill.ts` — server action that fetches trade-window candles via existing `getAggregates`, computes min/max during the trade window, persists to columns
- `src/components/analytics/mae-mfe-card.tsx` — Analytics card with the headline narrative + a scatter (MFE on y, realized R on x) so winners cut early visually pop

**Acceptance:** Backfill action populates columns for closed trades whose pair is on the user's Polygon plan. Card shows realized vs. MFE gap with numeric narrative. Hides when 0 trades have MFE populated.

**Effort:** ~half day

---

### 50. `[x]` Recovery / revenge-trade detector

**Why:** Trades opened within N minutes of a loss are statistically worse. Flag them, show baseline-vs-revenge WR. If it's real, expose a soft cooldown rule ("block trade entry within 15 min of a stop-out") — discipline mechanism, not just an analytic.

**Files (new):**
- `src/components/analytics/revenge-detector.tsx` — counts trades opened within configurable T after a loss; compares WR / expectancy vs. baseline
- `src/components/trades/log-trade-modal.tsx` — optional confirm() guard when `tilt_cooldown_after_loss_minutes` is set in user_settings (new column)

**Acceptance:** With ≥10 closed trades including ≥3 trades opened within 15 min of a prior loss, card shows the WR delta. With cooldown set, attempting a same-account trade inside the window fires a soft confirm.

**Effort:** ~3 hours

---

### 51. `[x]` Streak-aware performance

**Why:** WR after 3 consecutive wins (overconfidence) vs. after 3 losses (tilt). Often shockingly different. Pure aggregation off existing data.

**Files (new):**
- `src/components/analytics/streak-aware-perf.tsx` — table: "after 3 wins: 42% WR (n=18) · baseline 54% · −12pp gap"; same for after 3 losses

**Acceptance:** With ≥30 closed trades chronologically, card surfaces the after-streak WR + delta. Hides when no streaks of length ≥3 exist.

**Effort:** ~2 hours

---

### 52. `[x]` Time-in-session granularity (intra-session)

**Why:** Existing SessionAnalysis splits London/NY/Asia. Drill in: "8:30–9:30 NY: +2.4R avg (n=18)" vs. "11:00–12:00 NY: −0.8R avg (n=12)." Often reveals a single golden hour.

**Files:**
- Extend `src/components/analytics/session-analysis.tsx` — click a session pill → expands a per-hour bar chart; or render as a sparkline-per-session inline

**Acceptance:** With ≥20 trades in a single session, expanding it shows hour-of-session breakdown sorted by P&L.

**Effort:** ~3 hours

---

### 53. `[x]` Underwater equity chart

**Why:** Continuous "%-from-peak" line — psychologically the chart that matters most. Companion to existing DrawdownAnalysis (which probably surfaces max DD). Reveals time spent in drawdown, not just depth.

**Files (new):**
- `src/components/analytics/underwater-curve.tsx` — pure SVG, derived from cumulative equity series; shaded fill from 0 line down to current % from peak

**Acceptance:** With ≥20 trades, chart shows continuous underwater line with markers for max-DD points. Hides for empty histories.

**Effort:** ~2 hours

---

### 54. `[x]` Risk-adjusted metrics card

**Why:** Sharpe, Sortino, Calmar, MAR, Ulcer Index. We compute everything they need. Adds quant credibility. Most prop firms publicly track these.

**Files (new):**
- `src/lib/risk-metrics.ts` — pure functions: `sharpe`, `sortino`, `calmar`, `mar`, `ulcerIndex` over an R series + tests
- `src/components/analytics/risk-adjusted-metrics.tsx` — KPI strip card

**Acceptance:** With ≥30 closed trades, all five metrics render with sub-text definitions. Tests cover degenerate cases (all wins, all losses, zero variance).

**Effort:** ~3 hours

---

### 55. `[x]` Time-to-resolution distribution

**Why:** Histogram: how long do winners run vs. losers? If losers resolve in 12 min and winners in 4 hours you're doing it right. If reversed, you're cutting winners.

**Files (new):**
- `src/components/analytics/time-to-resolution.tsx` — derives `closed_at − opened_at` per trade, splits winner/loser, renders two overlaid histograms

**Acceptance:** With ≥10 winners + ≥10 losers, card shows two distributions + median labels.

**Effort:** ~2 hours

---

### 56. `[x]` Drawdown per playbook

**Why:** Playbooks card shows P&L/WR/expectancy. Add max-DD-per-playbook so traders see which setups have nasty losing streaks even when lifetime expectancy is fine.

**Files:**
- Extend `src/app/(dashboard)/playbooks/page.tsx` (or the per-playbook stats query) — compute per-playbook running cumulative + max DD; surface as a column on each playbook card

**Acceptance:** Each playbook card renders Max DD ($ or R, configurable) alongside existing stats.

**Effort:** ~2 hours

---

## 🟣 Sprint J — Capture-side / schema additions

Items 57–61 require small migrations + write-side changes.

### 57. `[x]` Pre-session journal entry kind

**Why:** Distinct from per-trade ideas: "Today's plan — bias, levels, no-trade zones, news to avoid." End of day: reconcile to plan. `journal_entries.kind` already accepts arbitrary strings — use `"session_plan"`. Add a Today widget on the dashboard.

**Files:**
- `src/components/journal/log-session-plan-button.tsx` — analog to LogIdeaButton
- `src/components/dashboard/today-plan-card.tsx` — shows today's session_plan entry, prompts to create one if none
- Journal view: filter pill for "Plans"

**Acceptance:** Creating a session_plan entry surfaces it on the dashboard for the rest of the trading day; reconciliation prompt appears at the user's end-of-session time (from settings).

**Effort:** ~half day

---

### 58. `[x]` Hypothetical idea fields (delivers #37's deferred punchline)

**Why:** Add `idea_pair`, `idea_side`, `idea_entry`, `idea_stop`, `idea_target` to `journal_entries`. Then ideas-vs-executions can compute "the 5 setups you skipped would have averaged +0.8R" using Polygon historical bars to look up the would-have-been outcome.

**Files:**
- Migration `journal_entries_idea_setup` — add the 5 columns (all nullable)
- Idea section of the entry editor drawer — show pair/side/entry/stop/target inputs when `kind === "idea"`
- Backfill server action `computeSkippedIdeaR(entryId)` — fetches Polygon candles from idea creation forward N days, simulates the would-have-been outcome (resolves stop/target first, otherwise N-day-forward close)
- Update IdeasComparisonCard with the realized "skipped would have averaged +0.8R" headline

**Acceptance:** Idea entry with pair/entry/stop/target → after the lookback window passes, the comparison card surfaces the skipped-ideas R total.

**Effort:** ~half day

---

### 59. `[x]` Account "phase" tracking for prop firms

**Why:** Prop traders are a huge slice of the funded forex market and live on these metrics: eval / verification / funded; payout cadence; days to next payout; current trailing-DD usage.

**Files:**
- Migration `accounts_prop_phase`: `prop_phase` enum-text, `prop_payout_cadence_days` integer, `prop_next_payout_at` date, `prop_max_drawdown_pct` numeric, `prop_max_daily_drawdown_pct` numeric, `prop_profit_target_pct` numeric
- `src/components/dashboard/prop-phase-card.tsx` — surfaces phase chip + days-to-payout + DD usage bars
- Integrate into account create/edit modal

**Acceptance:** Mark an account as "eval" with a $5k profit target and 5% trailing DD → card shows progress to target + days-since-DD-floor. Funded accounts show payout countdown.

**Effort:** ~half day

---

### 60. `[~]` Pip-value resolved at trade time

**Why:** Pip-value depends on account currency, contract size, and quote currency. Computing it at fill time and storing on `trade_fills` makes every "average pips" analytic currency-correct without ad-hoc downstream conversion.

**Files:**
- Migration `trade_fills_pip_value`: add `pip_value_acct` numeric (pip value in account currency)
- `src/lib/actions/tradelocker.ts` — compute & write during sync using existing `lib/pip.ts` + account currency
- CSV importer write path same
- Backfill script for existing fills

**Acceptance:** New fills have non-null `pip_value_acct`. Backfill populates historical fills from current FX rates. Pip-based analytics use it directly.

**Effort:** ~3 hours

---

### 61. `[ ]` Spread at entry

**Why:** Capture bid/ask spread at the moment of fill via TL `/quotes` (already wired in the live-positions feature #30). Lets you build "your fills happen on average at 1.8 pip spread vs. baseline 1.2" — exposes session/news-related cost.

**Files:**
- Migration `trade_fills_spread`: add `spread_at_fill` numeric (in pips)
- TL importer: when filling, capture the spread snapshot via existing quote helper if available within ~30s of fill timestamp; otherwise null
- `src/components/analytics/spread-analysis.tsx` — slim card surfacing avg spread by session

**Acceptance:** New fills with available quote data have non-null spread. Card surfaces the breakdown for users with ≥30 spread-tagged fills.

**Effort:** ~3 hours

---

## 🟡 Sprint K — Premium polish

### 62. `[x]` Equity curve overlays

**Why:** Equity-curve card is single-line. Premium move: layer faint S&P / DXY benchmark, color the line by session, mark major drawdowns. The chart is already on the dashboard — make it the visual centerpiece.

**Files:**
- Extend `src/components/dashboard/equity-curve-card.tsx` — optional benchmark series (Polygon I:SPX or I:DXY), session-colored stroke segments, DD markers

**Acceptance:** Toggle in card header lets user pick None / S&P / DXY benchmark. Default off so users without Polygon don't see broken state.

**Effort:** ~3 hours

---

### 63. `[x]` Lite vs Pro dashboard mode

**Why:** A new user lands on a wall of widgets. A "Lite" preset hides Monte Carlo / Risk-of-Ruin / Margin Projection / Order-Type / Correlation cards by default for users with <50 trades, surfacing them as they're "earned."

**Files:**
- New `user_settings.dashboard_density` enum: `lite | full`. Default `full`. Auto-set to `lite` for new accounts, prompt to upgrade at 50 trades
- `src/app/(dashboard)/dashboard/page.tsx` — gate the heavy widgets on the flag

**Acceptance:** New user sees a focused dashboard; existing users see no change.

**Effort:** ~2 hours

---

### 64. `[~]` Per-page widget reorder + hide

**Why:** Dashboard has 15+ widgets — drag-to-reorder + hide-toggle is a real user need. Persist to user_settings.

**Files:**
- Migration `user_settings_dashboard_layout`: jsonb column with widget IDs + positions
- Edit Layout mode toggle on dashboard header; drag handles per card

**Acceptance:** Reorder a card → reload → order persists.

**Effort:** ~half day

---

### 65. `[x]` Light mode verification + polish

**Why:** Settings has `theme`. Verify a light theme actually renders all SVG analytics cards (candle bodies, gauge fills, equity curves) correctly. Many traders journal in cafes / outdoors and need it.

**Files:**
- Audit each `src/components/analytics/*.tsx` SVG for hardcoded dark colors, swap to CSS vars; same for dashboard widgets

**Acceptance:** Switching to light mode produces a usable, contrast-correct UI on every page. Screenshots of every page in light mode side-by-side with dark mode.

**Effort:** ~half day

---

### 66. `[x]` Trade comparison view (multi-select)

**Why:** Multi-select 2–4 trades from Ledger → side-by-side diff: replay charts, costs, journal entries, mood. "Why did this win and that lose?" forces real reflection.

**Files (new):**
- `src/app/(dashboard)/ledger/compare/page.tsx` — accepts `?trades=id1,id2,id3` and renders columns
- Ledger row checkbox + "Compare N selected" CTA

**Acceptance:** Select 2–4 trades → Compare → side-by-side replay charts with synced timeframes + journal entries.

**Effort:** ~half day

---

### 67. `[x]` Print stylesheet for Trade Detail Drawer

**Why:** Coaching workflows: trader exports a single trade as PDF for a session with a mentor. Reports has print view; extend to drawer.

**Files:**
- `src/app/(dashboard)/trades/[id]/print/page.tsx` (new) — server-rendered single-trade page mirroring drawer content with print CSS
- Drawer header: "Print / PDF" button linking to it

**Acceptance:** Print preview produces a clean one-page summary with all fills, lifecycle, journal entry, replay snapshot.

**Effort:** ~3 hours

---

### 68. `[x]` Auto-narrative on every analytics card

**Why:** Several cards already auto-narrate (Order-Type, Scale-Out, RuleBreak). Make every analytics card emit a one-line auto-narrative. The narratives are the actual product — the charts are just evidence.

**Files:**
- Audit `src/components/analytics/*.tsx` for cards lacking a narrative line; standardize on a `<NarrativeBanner>` shared component

**Acceptance:** Every analytics card with sufficient sample size emits exactly one narrative sentence calling out its top finding.

**Effort:** ~3 hours

---

## 🔮 Sprint L — Coach AI deepening

### 69. `[x]` Coach AI agent / chat mode

**Why:** Today Coach returns observations + suggestions. Next step: let the user reply ("explain this," "what would changing X do") — turn it into a dialogue against their own data.

**Files (new):**
- Migration `coach_conversations`: id, user_id, messages jsonb, created_at
- `src/lib/actions/coach-chat.ts` — multi-turn chat using existing trade/journal context
- `src/components/dashboard/coach-chat-drawer.tsx` — drawer UI off the existing CoachNudge

**Acceptance:** Click a Coach observation → "Ask follow-up" → multi-turn chat preserving context. Conversations persist.

**Effort:** ~half day

---

### 70. `[x]` Coach AI weekly retrospective (in-app)

**Why:** Distinct from the Sunday email digest — a Monday-morning in-app card: "Last week's three things to keep doing, three things to stop." Cached weekly, regenerable.

**Files:**
- Reuse `coach.ts` + add a `weeklyRetrospective()` variant with a dedicated system prompt
- `src/components/dashboard/weekly-retrospective-card.tsx` — Monday-morning slot

**Acceptance:** Card auto-generates Monday morning; remains visible all week; user can regenerate.

**Effort:** ~3 hours

---

### 71. `[ ]` Voice journal entries (Whisper)

**Why:** PWA + web Audio API → Whisper API → text. Coach AI auto-tag runs on transcription. Removes friction at the moment of execution where typing competes with watching the chart.

**Files:**
- `src/lib/audio/recorder.ts` — MediaRecorder wrapper
- Server action `transcribeAudio(blob)` — calls Whisper API
- Mic button on entry editor + Log Trade modal note field

**Acceptance:** Hold mic button → record → release → transcription populates the field within ~3s for 30s of audio.

**Effort:** ~half day

---

### 72. `[~]` Coach AI suggestions → enforceable rules

**Why:** When Coach says "stop shorts on EUR/USD — your edge is statistically negative," offer "Add as a rule" → creates a per-pair-side block on the Log Trade modal. Closes the loop from insight → behavior change.

**Files:**
- Migration `user_trade_rules`: id, user_id, kind (`block_pair_side`, `daily_max_trades`, etc.), payload jsonb, enabled, source (`manual` | `coach`)
- Modal pre-flight reads user_trade_rules and surfaces matching rules as warnings/blocks
- "Convert to rule" CTA on Coach suggestion pills

**Acceptance:** Click "Add rule" on a Coach suggestion → block appears in Settings → Rules → next attempt to log a matching trade triggers the warning.

**Effort:** ~half day

---

## 🔵 Sprint M — Long-tail / strategic

### 73. `[ ]` Mobile native shell (Capacitor / RN)

**Why:** PWA + push exists. Wrapping for native app stores is a few-day project that unlocks "I just stopped out, let me journal it now" friction at moment-of-truth.

**Files:**
- Capacitor harness or React Native + WebView bridge
- App store provisioning (Apple Developer account, Play Console)

**Acceptance:** App installable from TestFlight + Play Internal Testing; native push works; PWA features unaffected.

**Effort:** ~1 week incl. store review

---

### 74. `[ ]` Backtest reconsidered — replay-based on historical setups

**Why:** Original backtest deferred (needs tickdata feed). Once #58 ships hypothetical-idea fields, you have substrate for *replay-based* backtest: pick a playbook, walk forward through historical setups matching its rules using Polygon data, output forward simulation. Different beast.

**Files:** TBD post-#58.

**Effort:** ~2 days post-#58.

---

### 75. `[ ]` Social / leaderboard layer (opt-in)

**Why:** `/u/[handle]` + share tokens already exist. Most rabid traders want peer competition. Opt-in monthly leaderboards (P&L %, profit factor, max DD) with verified-via-broker badges (TL data makes this defensible vs. Twitter screenshot culture).

**Files (new):**
- Migration `leaderboard_entries`: monthly snapshot of opt-in user stats
- `src/app/leaderboard/page.tsx` — public sortable leaderboard
- Settings → Privacy: opt-in toggle + which metrics to publish

**Acceptance:** Toggle opt-in → user appears in monthly board with verified-broker badge. Toggle off removes within 24h.

**Effort:** ~half week

---

### 76. `[ ]` TradeLocker WebSocket — revisit

**Why:** Originally deferred (#38) for hosting reasons. Revisit when push notifications need millisecond reaction (e.g., daily-DD red alert), or when a hosted listener becomes available for any reason.

**Files:**
- `src/lib/integrations/tradelocker/socket.ts` — WS client wrapper
- Separate Node listener service on Fly.io / Railway

**Acceptance:** Trade fill → journal Ledger row appears within 1s without sync.

**Effort:** ~1 day + hosting setup

---

### 77. `[ ]` MT4/5 + cTrader broker integrations — revisit

**Why:** Decision log defers MT/cTrader (#16, #17). Retail forex base is mostly there. Revisit when growth slows or when batched together as a one-week broker push makes sense economically.

**Files:** mirror `src/lib/integrations/tradelocker/*` for cTrader; bridge EA + docs for MT4/5.

**Effort:** ~1 week for both batched.

---

## Decision log

Record decisions to defer or skip items here so the reasoning isn't lost.

- **2026-05-02** — Backtest deferred indefinitely. Cost is the historical-data feed, not the UI. Revisit when ≥ 100 trades on a single playbook exist (so backtest-vs-live comparison is meaningful) and a data provider is committed.
- **2026-05-02** — Items #5, #6, #7 deferred — they need infrastructure (FX rates, R/percent display refactor, sizing cap propagation) that's disproportionate to the visible value. (Subsequently un-deferred and shipped same day per user request.)
- **2026-05-03** — Items #22–#40 added based on TradeLocker data audit + brainstorm. Sprint A (#22–#25) prioritized first because every downstream analytic gets richer data automatically once those columns exist.
- **2026-05-06** — Items #41–#77 added from a full-app review. Sprint H (#41–#47) takes priority — pure UI work over data we already capture. Sprint I, J, K, L, M sequenced by ROI vs. effort. Decision: ship Sprint H in this session.
- **2026-05-06** — Sprint H (#41–47) shipped end-to-end (commit 98ad326). Sprint I (#48 + #50–56) shipped with #49 deferred (commit f2eaaf4). Sprint K (#62, #63, #65, #67, #68) shipped with #64 + #66 deferred (commit 1fdbf3c, fixed by 4ccf00f). Process change: run `npm run build` (not just `tsc --noEmit`) before any commit touching a `"use server"` file — TypeScript doesn't enforce Next's rule that every export from such a file be async, but Turbopack does.
- **2026-05-07** — Autonomous-mode push (user on mobile, no account access). Shipped 12 of the 13 fully-shippable items in three batches:
  - **Batch 1** (commit 21c0749): #57 pre-session journal, #66 trade comparison view, #68 NarrativeBanner retrofit on older cards, #70 Coach AI weekly retrospective. No-schema features.
  - **Batch 2** (commit 999d576): #58 hypothetical idea fields + Polygon resolver, #59 prop-firm phase tracking + dashboard card, #60 pip-value at trade time (backfill action — forward-write integration in TL importer is a follow-up since cron context can't access user fx_rates), #64 widget hide UI (drag-reorder is a follow-up; same JSONB column accommodates `order` field), #49 MAE/MFE backfill + analytics card. 5 additive Supabase migrations applied via MCP.
  - **Batch 3** (commit d8b67cc): #69 Coach AI chat mode (multi-turn, capped at 20 messages/conversation), #72 trade rules (block_pair_side kind in v1, settings panel + LogTradeModal pre-flight check). 2 new tables with RLS-owner-scoped CRUD.
  - **Deferred from this session**: #75 social/leaderboard (half-week scope, separate session), #71 voice journal (needs Whisper API key — Anthropic SDK doesn't do audio), #73 mobile native (App Store accounts), #74 backtest (needs more #58 work first), #76 WebSocket (hosted listener), #77 MT4/cTrader (broker partner accounts).
  - **Partial shipments marked `[~]`**: #60 (forward-write integration follow-up), #64 (drag-reorder follow-up), #72 (Coach-suggestion → rule auto-promotion follow-up).
