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

### 16. `[~]` MT4 / MT5 webhook bridge

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

### 18. `[~]` Coach AI nudges

**Why:** Phase 10 placeholder. Server action takes last 30 days of trades + journal entries → asks Claude *"What patterns do you see? Where am I leaking edge?"* → renders in the existing `CoachNudge` widget slot on Dashboard.

**Files (new):**
- `src/lib/actions/coach.ts` — server action calling Anthropic API
- `src/components/dashboard/coach-nudge.tsx` — render result with regenerate button
- env: `ANTHROPIC_API_KEY`

**Acceptance:** Open Dashboard → CoachNudge widget shows 2-3 specific observations citing actual trades/dates from your data.

**Effort:** ~half day

**Notes:** Cache by day to avoid re-querying on every page load. Rate-limit per user.

---

### 19. `[~]` Email delivery (Resend) + weekly digest

**Why:** All `notify_*` toggles wait for delivery. Email is the lowest-friction first channel.

**Files (new):**
- `src/lib/email/resend.ts` — client + templated send
- `src/app/api/cron/weekly-digest/route.ts` — Vercel cron, Sundays 18:00 UTC
- env: `RESEND_API_KEY`

**Acceptance:** With `notify_weekly_report=true`, get an email Sunday evening summarizing the week's P&L, trade count, top playbook.

**Effort:** ~3 hours

**Notes:** Resend free tier covers personal use easily.

---

### 20. `[~]` Web push notifications

**Why:** Real-time daily DD alerts, news warnings. Works on installed PWA.

**Files (new):**
- `public/sw.js` — service worker
- `src/lib/push/subscribe.ts` — VAPID-based subscription flow
- `src/components/settings/push-section.tsx` — UI to enable/disable per device

**Effort:** ~half day

**Notes:** Needs VAPID keys. Defer until #19 ships and email is proven.

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

- `[ ]` **Empty state copy audit** — some are placeholder, not punchy
- `[x]` **Keyboard shortcuts** — `c` to log trade, `?` for help, `g`+letter for navigation
- `[ ]` **Global command palette (cmd-K)** — power-user fast nav
- `[x]` **Error boundaries** — server actions throw, page just dies; wrap each route segment
- `[ ]` **In-app help docs** — Settings has "Help docs" button in prototype that goes nowhere
- `[ ]` **Sentry / error tracking in prod**
- `[ ]` **Avatar upload** — currently gradient-initials only
- `[ ]` **Account email change flow** — currently impossible without admin
- `[ ]` **Rate limit auth-less endpoints** (webhook, etc.) via Upstash
- `[ ]` **RLS policy audit** — every table, every operation
- `[-]` **Backtest** — deferred indefinitely (see conversation 2026-05-02 for the explanation)

---

## 🔵 Sprint A — Capture broker data we already pay for

These all stem from the same audit on 2026-05-03: TradeLocker returns a lot more per-trade and per-account than we currently store. ~Half a day total to land all four; afterwards every analytics module gets richer data for free.

### 22. `[ ]` Capture per-trade broker fields on `trade_fills`

**Why:** TL returns `commission`, `swap`, `tax`, `requestPrice` (vs `avgPrice` for slippage), `orderType`, `executionType`, `magicNumber`, `comment` on every order — we drop them all. Adding them unlocks slippage analytics, true net P&L, market-vs-limit edge, and algo-vs-manual splits.

**Files:**
- Migration `trade_fills_broker_fields` adds columns: `commission` numeric, `swap` numeric, `tax` numeric, `request_price` numeric, `order_type` text, `execution_type` text, `magic_number` text, `broker_comment` text
- `src/lib/integrations/tradelocker/client.ts` → extract these fields in `decodeRows` + `reconstructClosedTrades` and surface them on the `TLPosition` / order shape
- `src/lib/actions/tradelocker.ts` → write them into `trade_fills` rows during the import loop
- Regenerate `database.types.ts`

**Acceptance:** Re-sync TradeLocker → fills inserted with non-null commission/swap/orderType where TL exposes them. Verify via SQL.

**Effort:** ~2 hours

**Notes:**

---

### 23. `[ ]` Capture margin / free-margin / margin-level on `accounts`

**Why:** TL's `/state` endpoint returns `equity`, `marginUsed`, `freeMargin`, `marginLevel`, floating P&L, cumulative swap. We extract balance + projectedBalance + availableFunds and ignore the rest. Margin level dropping below 100% is the literal definition of margin call — surfacing it is the difference between "I got margin-called" and "I avoided it."

**Files:**
- Migration `accounts_margin_fields` — add to `accounts`: `margin_used` numeric, `free_margin` numeric, `margin_level` numeric (percent), `floating_pnl` numeric, `swap_total` numeric. (Existing `equity` column is already there — re-purpose it as the live equity reading.)
- Update `decodeAccountState` in `client.ts` to extract them
- Update TL importer to write them on every sync
- Regenerate types

**Acceptance:** Open an account with floating positions, hit Sync. Account row's `margin_used` + `margin_level` reflect TL's live numbers.

**Effort:** ~1 hour

**Notes:** Equity vs balance: balance is closed P&L only; equity = balance + floating. Most prop firms track both.

---

### 24. `[ ]` Surface broker fields on Trade Detail Drawer

**Why:** Once #22 is in, render the new fields in the Order tab — commission line, swap line, slippage in pips (computed: `requestPrice − avgPrice` in pip units), order type chip (Market / Limit / Stop) on the header. Net P&L = gross P&L − commission − swap.

**Files:**
- `src/components/trades/trade-detail-drawer.tsx` — add a "Costs" sub-section under Order tab; add a slippage badge next to the entry price; flip the order type chip in the header

**Acceptance:** Open a TL-synced trade with non-zero commission. Drawer shows it line-by-line. Slippage badge reads `+0.3p` or `−1.2p` based on direction.

**Effort:** ~1 hour

**Notes:** Use `slPips`/`pipsBetween` from `lib/pip.ts` for the slippage calculation.

---

### 25. `[ ]` Surface margin metrics on Account Card / Drawer / Risk page

**Why:** Once #23 lands, these numbers are live in the DB. Add to the Account Card a small bar showing `margin_used` consumption; in the drawer Overview tab add 4 cells (Equity, Free Margin, Margin Used, Margin Level). On the Risk page, replace or augment the existing usage gauges with margin-level data.

**Files:**
- `src/components/accounts/account-card.tsx` — small margin progress bar in the footer chips area
- `src/components/accounts/account-drawer.tsx` — Overview tab gets margin cells
- `src/components/risk/risk-account-card.tsx` — add a margin-level gauge (4th gauge in the strip)

**Acceptance:** With a TL account synced, Account Card shows a visible margin bar. Risk page gauge reads the actual margin level.

**Effort:** ~1.5 hours

**Notes:**

---

## 🔵 Sprint B — Risk math no other journal has

Pure-math features (no schema, no API). Risk-of-ruin is the real differentiator vs Edgewonk / TraderSync / TradeZella.

### 26. `[ ]` Risk-of-Ruin Calculator

**Why:** Most retail traders don't realize that 58% WR with +0.3R avg still has a 14% probability of 50% drawdown over 100 trades. This is the killer Coach feature.

**Files (new):**
- `src/lib/ruin.ts` — pure math: `probabilityOfRuin({ winRate, avgWinR, avgLossR, riskPerTradePct, n }): number`. Uses Monte Carlo internally (10k paths, fast enough client-side). + tests in `ruin.test.ts`
- `src/components/analytics/risk-of-ruin-card.tsx` — Analytics page section with sliders for "what if I changed risk %"
- Reuses `OverallStats` already passed to AnalyticsView

**Acceptance:** With ≥ 30 closed trades, Analytics shows: "P(50% DD over next 100 trades) = 14%" plus stats for 25% / 75% drawdown thresholds. Slider lets user override inputs to model "what if I increased risk to 1.5%".

**Effort:** ~3 hours

**Notes:**

---

### 27. `[ ]` Monte Carlo Equity Simulator

**Why:** Forward simulation. Take user's current stats, run 1000 random paths, plot median + 5th/95th bands + horizon distribution.

**Files (new):**
- `src/lib/monte-carlo.ts` — pure simulator: `simulate({ wr, avgWinR, avgLossR, riskPct, startBalance, n, paths }): number[][]`
- `src/components/analytics/monte-carlo-card.tsx` — fan chart (median path + percentile bands as light fills) + horizon distribution bars at the right edge

**Acceptance:** Card shows 1000 forward paths shaded. Sliders for `n` trades + risk %. Caption: "Median outcome at trade 100: $11,420 · 5th: $7,200 · 95th: $18,100."

**Effort:** ~3 hours

**Notes:** Pair with #26 on the same Analytics row.

---

## 🔵 Sprint C — Live data + classification (depends on Sprint A)

### 28. `[ ]` Margin Call Risk Card

**Why:** Once #23 captures `margin_level`, surface as a color-coded gauge with forward projection: "If your open trades all hit stop, your margin level would drop to X%."

**Files (new):**
- `src/components/dashboard/margin-call-card.tsx` — Dashboard widget
- `src/components/risk/margin-projection.tsx` — Risk page section showing projected margin under "all stops hit" + "all targets hit" scenarios

**Acceptance:** Card reads "Margin level: 487% · safe". Scenario row: "If all stops hit: 312% (still safe)." Color thresholds: green >300%, amber 150–300%, red <150%, black <100%.

**Effort:** ~2 hours

**Notes:**

---

### 29. `[ ]` Order-Type Edge Analysis

**Why:** Once #22 captures `order_type`, add Analytics breakdown comparing market vs limit vs stop entries. Often the user's best trades are limit fills (patience) and worst are market fills (FOMO).

**Files (new):**
- `src/components/analytics/order-type-analysis.tsx` — compact table similar to existing `BreakdownBars`

**Acceptance:** With a mix of order types in the data, the card surfaces the WR delta. Auto-narrative when the gap is ≥10pp: "Your limit fills win 67% — your market fills win 48%. Be patient."

**Effort:** ~1 hour

**Notes:**

---

## 🔵 Sprint D — Live quotes

### 30. `[ ]` Live quote ticker for Watchlist + Open Positions

**Why:** TL's `/trade/quotes/{instrumentId}` returns live bid/ask. Watchlist rows get real prices. Open positions show real floating P&L instead of stale entry-time snapshots.

**Files (new):**
- `src/lib/integrations/tradelocker/quotes.ts` — server action that takes a list of instrumentIds, returns `Map<symbol, { bid, ask, ts }>`
- `src/components/dashboard/live-positions.tsx` — wraps Open Positions widget, polls every 10s for the user's open trades + computes floating P&L
- Watchlist row enrichment

**Acceptance:** Open Positions widget shows green/red number that updates every 10s. Watchlist rows show live bid + 24h change.

**Effort:** ~half day

**Notes:** Needs valid TL access token in cookie/server context. Refresh-token plumbing (currently we re-login each sync) becomes important.

---

## 🔵 Sprint E — Tax

### 31. `[ ]` FIFO tax matcher (Schedule D / Form 8949)

**Why:** End-of-year value. We have the data; just need the algorithm. FIFO lot matching across closed trades, short-term/long-term split (forex is mostly short-term), wash-sale flagging within 30 days. Export as IRS Form 8949 CSV.

**Files (new):**
- `src/lib/tax/fifo-matcher.ts` — pure function `matchLots(trades): Lot[]` + tests
- `src/app/api/reports/form-8949/route.ts` — CSV export
- Reports page: add "Form 8949 (FIFO)" tile

**Acceptance:** With a year of trades, downloaded CSV has 13 columns (per IRS spec) and reconciles to the user's net P&L for the year ±$0.

**Effort:** ~half day

**Notes:** Forex Section 988 = ordinary income, not capital gains — so the user's `tax_fx_election` setting determines whether to generate this. For §1256 traders, generate Form 6781 instead (60/40 split).

---

## 🔵 Sprint F — Trade replay (needs market-data feed)

### 32. `[ ]` Trade Instant Replay

**Why:** Click any past trade → see the H1/M15 chart for that pair on that day with your entry, stop, target, and exit marked.

**Files (new):**
- `src/lib/integrations/polygon.ts` — Polygon.io free tier client (covers FX majors)
- `src/components/trades/trade-replay-tab.tsx` — new tab inside Trade Detail Drawer
- Uses TradingView Lightweight Charts (`lightweight-charts` npm) for the viz

**Acceptance:** Open a closed trade from a week ago → "Replay" tab → candles for that day with entry/stop/target/exit markers. Time-step buttons: M5 / M15 / H1 / H4 / D1.

**Effort:** ~1 day

**Notes:** Blocked on `POLYGON_API_KEY`. Free tier covers FX majors; metals + indices need paid.

---

## 🔵 Sprint G — Correlation alerts

### 33. `[ ]` Correlation Risk Alerts

**Why:** Open positions on EUR/USD long, GBP/USD long, AUD/USD long, XAU/USD long? You don't have 4 positions — you have 1 leveraged short-USD bet.

**Files (new):**
- `src/lib/correlation.ts` — hardcoded correlation matrix for major pairs (USDJPY ↔ DXY, EURUSD ↔ DXY inverse, etc.) + tests. Eventually replaced with a rolling-correlation calc from price data.
- `src/components/dashboard/correlation-warning.tsx` — banner when net effective exposure on any single currency exceeds 200%

**Acceptance:** With 3 USD-quoted long positions, banner: "Net USD exposure 240% — this is one trade, not three."

**Effort:** ~2 hours (with hardcoded matrix; full price-based correlation is half day more)

**Notes:**

---

## 🔵 Long-tail / power features

### 34. `[ ]` Public per-entry sharing with token

**Why:** We already added the `is_public` flag and `/u/[handle]` route. Per-entry token URLs let the user share a single trade with a coach without exposing their handle.

**Files (new):**
- Migration: add `journal_entries.share_token` (nullable text, indexed)
- Server action `generateShareToken(entryId)` / `revokeShareToken(entryId)`
- New route `src/app/share/[token]/page.tsx` — read-only entry view
- Toggle in entry-editor-drawer next to existing "Share publicly"

**Effort:** ~3 hours

**Notes:**

---

### 35. `[ ]` Coach AI v2 — prescriptive

**Why:** Current Coach AI describes patterns. Next step is prescriptive: "Stop shorts on EUR/USD — your edge is statistically negative." Same `generateCoachInsights` action; new system prompt + structured output schema.

**Files:**
- `src/lib/actions/coach.ts` — extend prompt; output now `{ observations: string[]; suggestions: { action: string; basis: string; severity: "info" | "warn" }[] }`
- `src/components/dashboard/coach-nudge.tsx` — render suggestions section below observations

**Effort:** ~2 hours

**Notes:** Needs ANTHROPIC_API_KEY same as #18.

---

### 36. `[ ]` Position close + SL/TP modify from the journal

**Why:** Two-way TL integration. Click a position → "Move SL to break-even" → API call → confirmation toast.

**Files:**
- `src/lib/integrations/tradelocker/client.ts` — `tlModifyPosition({ posId, stopLoss, takeProfit })`, `tlClosePosition(posId)`
- New buttons on Trade Detail Drawer for open positions
- Realtime sync should reflect new SL/TP automatically

**Acceptance:** Click "Move SL to BE" on an open trade → SL updated server-side → page refreshes via realtime → drawer shows new SL.

**Effort:** ~half day

**Notes:** Destructive — wrap in confirm dialog. Track every modification as a journal note for audit.

---

### 37. `[ ]` Trade ideas mode

**Why:** "I would have taken this" log without real money. After a few weeks, compare hypothetical ideas to actual trades — are you executing your best plans?

**Files:**
- Reuse existing `journal_entries.kind = "idea"` (already supported)
- New "Log idea" button next to Log Trade
- New /ideas page or filter on /journal showing ideas vs trades
- Comparison card: "You logged 12 ideas this month, executed 7 of them. The 5 you skipped would have averaged +0.8R."

**Effort:** ~half day

**Notes:**

---

### 38. `[ ]` WebSocket streaming via TradeLocker

**Why:** TL has WebSocket fills/quotes. We poll. Live push removes ~30s sync lag and per-poll API spend.

**Files:**
- `src/lib/integrations/tradelocker/socket.ts` — WS client wrapper
- Long-running listener — Vercel Functions don't keep WS alive past timeout, so likely a small Node service on Fly.io / Railway

**Acceptance:** Fill a trade in TL UI → it appears in journal Ledger within 1s without manual sync.

**Effort:** ~1 day (architecture decisions on the listener side dominate)

**Notes:** Defer until daily polling proves insufficient.

---

### 39. `[ ]` Coach AI auto-tagging

**Why:** When a journal entry is saved, run a secondary AI pass that suggests tags / mistakes / mood from the prose. User accepts/rejects with one click.

**Files:**
- `src/lib/actions/coach-tag.ts` — extracts `{ tags, mistakes, mood }` from `pre_trade + post_trade + cold_review` text
- Entry editor drawer shows "Coach suggests: tilt, fomo · accept all / reject" chip row

**Effort:** ~2 hours

**Notes:** Cheap call (claude-haiku, <500 tokens out). Gate on user setting toggle to avoid surprise API spend.

---

### 40. `[ ]` Trade instant context (DXY, VIX, S&P at trade time)

**Why:** When you click a past trade, see what the macro environment was doing at the moment of entry. "EUR/USD long taken on 2026-04-12 14:30 UTC · DXY was 104.23 (down 0.4%) · S&P up 0.7% · VIX 13.2 (calm)."

**Files:**
- `src/lib/integrations/polygon.ts` (shared with #32) — fetch DXY/VIX/SPX snapshot at a given timestamp
- `src/components/trades/trade-detail-drawer.tsx` — new "Context" panel inside Order tab

**Effort:** ~3 hours (after #32's Polygon plumbing exists)

**Notes:**

---

## Recommended top-3 tomorrow

If you can only do a day:

1. **Sprint A** (#22 + #23 + #24 + #25) — capture broker data we already pay for. ~Half a day. Unlocks every later analytics improvement.
2. **#26 Risk-of-Ruin Calculator** — the killer feature no competitor has. Pure math, ~3 hours.
3. **#27 Monte Carlo Equity Simulator** — pairs with #26 on the same Analytics row.

That's a single full day and the app jumps to "best-in-class trader-grade journal." Sprint C (margin call card + order-type analysis) layers on top once Sprint A is in the DB.

---

## Decision log

Record decisions to defer or skip items here so the reasoning isn't lost.

- **2026-05-02** — Backtest deferred indefinitely. Cost is the historical-data feed, not the UI. Revisit when ≥ 100 trades on a single playbook exist (so backtest-vs-live comparison is meaningful) and a data provider is committed.
- **2026-05-02** — Items #5, #6, #7 deferred — they need infrastructure (FX rates, R/percent display refactor, sizing cap propagation) that's disproportionate to the visible value. (Subsequently un-deferred and shipped same day per user request.)
- **2026-05-03** — Items #22–#40 added based on TradeLocker data audit + brainstorm. Sprint A (#22–#25) prioritized first because every downstream analytic gets richer data automatically once those columns exist.
