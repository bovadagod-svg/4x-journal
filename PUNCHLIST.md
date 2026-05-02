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

### 8. `[ ]` Verify Vercel env has `SUPABASE_SERVICE_ROLE_KEY`

**Why:** TradingView webhook returns 500 without it. If this isn't set, no webhook trade has ever inserted in prod.

**Files:** Vercel project → Settings → Environment Variables

**Acceptance:** `npx vercel env ls production | grep SUPABASE_SERVICE_ROLE_KEY` returns a row. Test by hitting your webhook URL with a sample payload.

**Effort:** 5 min

**Notes:**

---

### 9. `[ ]` CSV import for accounts

**Why:** Account card empty state advertises "Manual entry · CSV import · TradeLocker connection" but CSV doesn't exist. CSV is the universal broker bridge — works for MT4/5, cTrader, FunderPro, and any platform that exports trade history.

**Files (new):**
- `src/lib/integrations/csv/parser.ts` — `papaparse` + column mapping
- `src/components/accounts/csv-import-modal.tsx` — file upload + column map UI + preview
- `src/lib/actions/csv-import.ts` — bulk insert with dedup by (account_id, opened_at, pair)

**Schema:** Reuse `trades` table. Add `external_id` style key for dedup if not already there (it is).

**Acceptance:** Upload a CSV with 50 historical trades → preview shows mapped columns → confirm imports them → Ledger shows them.

**Effort:** ~half day

**Notes:** Use `papaparse` (already on Vercel-friendly bundle size).

---

### 10. `[ ]` Onboarding wizard for new users

**Why:** New users land on Dashboard cold with zero accounts/playbooks/trades. A 3-step wizard ("Add your first account → name a playbook → log a trade") drastically improves first-session feel.

**Files (new):**
- `src/app/(dashboard)/onboarding/page.tsx` — gated when `accounts.length === 0`
- Or: `src/components/onboarding/onboarding-modal.tsx` — full-screen modal triggered from `(dashboard)/layout.tsx`

**Acceptance:** New user signs in → onboarding fires → completes 3 steps → lands on Dashboard with seeded data. Existing user with ≥ 1 account never sees it.

**Effort:** ~half day

**Notes:** Skip-able with a "Skip for now" button that sets `user_settings.onboarded_at` (would need a column add).

---

### 11. `[ ]` Daily TradeLocker sync via Vercel Cron

**Why:** Manual sync only today. Daily cron → "wake up and yesterday's trades are already there" is a real magic moment.

**Files (new):**
- `src/app/api/cron/sync-tradelocker/route.ts` — iterates `broker_connections WHERE provider='tradelocker' AND enabled=true`
- `vercel.json` — schedule entry: `{ "crons": [{ "path": "/api/cron/sync-tradelocker", "schedule": "0 6 * * *" }] }`

**Acceptance:** Cron runs daily at 06:00 UTC, hits all enabled TradeLocker connections, logs result to `last_sync_status`. Verify via Vercel cron logs.

**Effort:** ~1 hour

**Notes:** Vercel Hobby tier allows daily-only cron. Use `CRON_SECRET` env var to gate the route from public hits.

---

## 🟢 High-leverage, small lift

### 12. `[ ]` Mobile QA pass at 375px

**Why:** Sidebar collapses to hamburger ≤ 768px ✅. But Risk page uses `repeat(4, 1fr)` for gauges — breaks below 600px. Reports KPI strip same. Several other pages too.

**Files to scan:** Every `*/page.tsx` and view component. Search for `gridTemplateColumns: "repeat(4` and `repeat(3`.

**Fix pattern:** Swap `repeat(N, 1fr)` → `repeat(auto-fit, minmax(180px, 1fr))` (or `200px` for wider cards).

**Acceptance:** Click through every page in iPhone mini width (375px) in Chrome devtools. No horizontal scroll. No clipped text.

**Effort:** 1–2 hours

**Notes:** Use this as a chance to add a `375px` chip in your devtools for future regression checks.

---

### 13. `[ ]` Loading skeletons via `loading.tsx`

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

### 14. `[ ]` Realtime trade updates via Supabase Realtime

**Why:** If a TradingView webhook fires while you're on the Ledger, you have to refresh. Supabase Realtime can push it.

**Files:**
- `src/components/ledger/trade-table.tsx` (or a wrapper) — `useEffect` subscribing to `trades` channel, calling `router.refresh()` on insert
- Same pattern in Dashboard widgets that show open positions

**Acceptance:** Insert a trade via webhook (or directly in Supabase SQL editor) → Ledger row appears within 1s without refresh.

**Effort:** ~1 hour, big "wow"

**Notes:** Use `INSERT` filter with `user_id=eq.{userId}` to avoid leaking events.

---

### 15. `[ ]` Public profile route `/u/[handle]`

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

### 16. `[ ]` MT4 / MT5 webhook bridge

**Why:** Forex retail's largest user base. Bridge = a Python or MQL Expert Advisor running on the user's MT terminal that POSTs fills to your existing TradingView webhook endpoint.

**Files (new):**
- `docs/mt4-bridge.md` — install instructions
- `bridges/mt4/4xJournalBridge.mq4` — sample EA
- Maybe: a separate `/api/webhooks/mt4/[userId]` endpoint with MT-specific payload mapping

**Effort:** ~1 day for the EA + docs

**Notes:** EA reads OnTrade events, normalizes to your payload, POSTs. Document exactly how to install.

---

### 17. `[ ]` cTrader Open API integration

**Why:** Official OAuth API, well-documented, second-most-popular Forex platform.

**Files:** mirror the structure of `src/lib/integrations/tradelocker/*`.

**Effort:** ~1 day

**Notes:** Spec at https://help.ctrader.com/open-api/

---

### 18. `[ ]` Coach AI nudges

**Why:** Phase 10 placeholder. Server action takes last 30 days of trades + journal entries → asks Claude *"What patterns do you see? Where am I leaking edge?"* → renders in the existing `CoachNudge` widget slot on Dashboard.

**Files (new):**
- `src/lib/actions/coach.ts` — server action calling Anthropic API
- `src/components/dashboard/coach-nudge.tsx` — render result with regenerate button
- env: `ANTHROPIC_API_KEY`

**Acceptance:** Open Dashboard → CoachNudge widget shows 2-3 specific observations citing actual trades/dates from your data.

**Effort:** ~half day

**Notes:** Cache by day to avoid re-querying on every page load. Rate-limit per user.

---

### 19. `[ ]` Email delivery (Resend) + weekly digest

**Why:** All `notify_*` toggles wait for delivery. Email is the lowest-friction first channel.

**Files (new):**
- `src/lib/email/resend.ts` — client + templated send
- `src/app/api/cron/weekly-digest/route.ts` — Vercel cron, Sundays 18:00 UTC
- env: `RESEND_API_KEY`

**Acceptance:** With `notify_weekly_report=true`, get an email Sunday evening summarizing the week's P&L, trade count, top playbook.

**Effort:** ~3 hours

**Notes:** Resend free tier covers personal use easily.

---

### 20. `[ ]` Web push notifications

**Why:** Real-time daily DD alerts, news warnings. Works on installed PWA.

**Files (new):**
- `public/sw.js` — service worker
- `src/lib/push/subscribe.ts` — VAPID-based subscription flow
- `src/components/settings/push-section.tsx` — UI to enable/disable per device

**Effort:** ~half day

**Notes:** Needs VAPID keys. Defer until #19 ships and email is proven.

---

### 21. `[ ]` Test coverage (zero today)

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

- `[ ]` **Empty state copy audit** — some are placeholder, not punchy
- `[ ]` **Keyboard shortcuts** — `/` for search, `c` to log trade, `g`+letter for navigation
- `[ ]` **Global command palette (cmd-K)** — power-user fast nav
- `[ ]` **Error boundaries** — server actions throw, page just dies; wrap each route segment
- `[ ]` **In-app help docs** — Settings has "Help docs" button in prototype that goes nowhere
- `[ ]` **Sentry / error tracking in prod**
- `[ ]` **Avatar upload** — currently gradient-initials only
- `[ ]` **Account email change flow** — currently impossible without admin
- `[ ]` **Rate limit auth-less endpoints** (webhook, etc.) via Upstash
- `[ ]` **RLS policy audit** — every table, every operation
- `[-]` **Backtest** — deferred indefinitely (see conversation 2026-05-02 for the explanation)

---

## Recommended top-3 if you can only do a day's worth

1. **#1 + #2 + #3** (Settings enforcement) — closes the "this feels like a demo" gap on work we already started. ~2 hours total.
2. **#9** (CSV import) — universal broker bridge. ~half day.
3. **#12** (Mobile QA) — you'll check the app on your phone after every trade. If it's broken at 375px you'll stop using it. ~1–2 hours.

---

## Decision log

Record decisions to defer or skip items here so the reasoning isn't lost.

- **2026-05-02** — Backtest deferred indefinitely. Cost is the historical-data feed, not the UI. Revisit when ≥ 100 trades on a single playbook exist (so backtest-vs-live comparison is meaningful) and a data provider is committed.
- **2026-05-02** — Items #5, #6, #7 deferred — they need infrastructure (FX rates, R/percent display refactor, sizing cap propagation) that's disproportionate to the visible value.
