# Broker bridges

Companion code that turns brokers without a public API into journal sources by
forwarding trades to your TradingView-style webhook.

## MT4 / MT5 — `mt4/4xJournalBridge.mq4`

A small Expert Advisor (EA) that runs on your MT4/MT5 terminal and POSTs every
new trade fill to your 4x Journal webhook. No backend changes required — it
piggybacks on the existing TradingView webhook ingest endpoint.

### One-time setup

1. **Get your webhook URL.** In 4x Journal go to **Settings → Integrations →
   TradingView webhooks**, click **Generate webhook URL** if you haven't, then
   copy the URL. It looks like
   `https://4x-journal.vercel.app/api/webhooks/tradingview/<userId>?secret=<secret>`.

2. **Allow the URL in MT4/5.**
   - Tools → Options → **Expert Advisors** tab
   - Tick **"Allow WebRequest for listed URL"**
   - Add `https://4x-journal.vercel.app` to the list. Click OK.

3. **Install the EA.**
   - File → Open Data Folder
   - Navigate into `MQL4/Experts/` (MT4) or `MQL5/Experts/` (MT5)
   - Drop `4xJournalBridge.mq4` into that folder
   - Open MetaEditor (F4 in the terminal), find the file under "Experts" in the
     Navigator, and press F7 to compile. You should see "0 errors, 0 warnings".

4. **Attach to a chart.**
   - Back in MT4, open any chart (any symbol — the EA scans your whole account)
   - Drag **4xJournalBridge** from Navigator → Expert Advisors onto the chart
   - In the dialog:
     - **Common** tab: tick **"Allow live trading"** (the EA only reads — this
       is just MT's default permission for any EA that does I/O)
     - **Inputs** tab: paste your webhook URL into `WebhookUrl`
     - Adjust `PollSeconds` if you want it to scan more/less often (default 30)
   - Click OK. You should see a smiley face in the upper-right of the chart.

5. **Verify.** Place a tiny test trade on the demo. Within `PollSeconds`, check
   `/ledger` in the journal — the trade should appear.

### What the EA does (and doesn't do)

It reads MT's history + open-positions, formats each trade as the JSON the
webhook ingest expects, and POSTs it. Tickets it has already posted are
remembered in memory so re-running doesn't duplicate (the journal also dedups
by `external_id` so duplicates wouldn't make it into the DB anyway).

It does **not** place orders, modify SL/TP, close trades, or read passwords. It
needs **WebRequest** permission only.

If you restart MT4, the in-memory "already posted" set resets — but the journal
will dedup so existing tickets won't double-up.

### Troubleshooting

- **"WebRequest failed, error 4060"** — you didn't add the URL to the allowlist
  in step 2. Tools → Options → Expert Advisors. Domain only (`https://4x-journal.vercel.app`),
  not the full path.
- **"webhook responded 401"** — your webhook URL is missing the `?secret=...`
  query string. Re-copy from Settings.
- **"webhook responded 500"** — the server-side webhook endpoint is missing
  `SUPABASE_SERVICE_ROLE_KEY` in env. See PUNCHLIST item #8.
- **No trades appearing** — set `DebugLogging = true` in the EA inputs to see
  every request in the Experts log (Toolbox → Experts tab).

### Limitations

- The EA polls; it doesn't push instantly. There's up to `PollSeconds` of lag
  between a fill and it appearing in the journal. That's fine for journaling
  but obviously not real-time.
- Symbol normalization handles broker suffixes (`EURUSD.r`, `EURUSD-pro`,
  `EURUSDm`) by stripping non-alpha chars and taking the first six. Works for
  spot FX. For metals it special-cases `XAU` → `XAU/USD`. CFDs and exotics may
  need manual mapping — open a PR if your broker uses something unusual.
- `OrderProfit() + OrderSwap() + OrderCommission()` is the EA's P&L view; the
  journal then re-computes from entry/exit/size and trusts the broker's number
  on display.

## cTrader

Not yet shipped. cTrader has an official Open API (OAuth + WebSocket) that
makes a proper integration straightforward. See PUNCHLIST item #17.
