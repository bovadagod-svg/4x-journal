//+------------------------------------------------------------------+
//|                                          4xJournalBridge.mq4     |
//|                                              4x Journal          |
//|                                       https://4x-journal.app     |
//+------------------------------------------------------------------+
//| Posts MT4 trade fills to your 4x Journal TradingView webhook so   |
//| MT4 acts like a broker integration without an official API.       |
//|                                                                   |
//| INSTALL:                                                          |
//|   1. Open MetaEditor (F4 inside MT4).                             |
//|   2. File → Open Data Folder → MQL4/Experts/                      |
//|   3. Drop this file into that folder.                             |
//|   4. Compile (F7).                                                |
//|   5. Drag "4xJournalBridge" onto any chart from Navigator → EAs.  |
//|   6. In the EA dialog: Common tab → "Allow WebRequest for         |
//|      listed URL" → tick → add `https://4x-journal.vercel.app`.    |
//|   7. Inputs tab: paste your WebhookUrl from /settings?tab=        |
//|      integrations.                                                |
//|   8. OK. The smiley face means it's running.                      |
//|                                                                   |
//| The EA polls your account every PollSeconds for newly-closed      |
//| trades and POSTs each one to the webhook in the format the        |
//| TradingView ingest endpoint expects.                              |
//+------------------------------------------------------------------+
#property copyright "4x Journal"
#property link      "https://4x-journal.app"
#property version   "1.00"
#property strict

input string WebhookUrl    = "https://4x-journal.vercel.app/api/webhooks/tradingview/<userId>?secret=<secret>";
input int    PollSeconds   = 30;
input string DefaultMood   = "";   // optional — focused/calm/rushed/anxious/neutral
input bool   IncludeOpen   = true; // post entries when a position opens
input bool   DebugLogging  = false;

// State: we remember which tickets we've already posted so re-runs are idempotent.
int    posted[];
int    postedCount = 0;
datetime lastPoll = 0;

//+------------------------------------------------------------------+
int OnInit() {
   ArrayResize(posted, 1024);
   Print("4x Journal Bridge started. Polling every ", PollSeconds, "s. URL=", WebhookUrl);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason) {
   Print("4x Journal Bridge stopped.");
}

//+------------------------------------------------------------------+
//| Tick handler — throttled to PollSeconds                          |
//+------------------------------------------------------------------+
void OnTick() {
   if (TimeCurrent() - lastPoll < PollSeconds) return;
   lastPoll = TimeCurrent();
   ScanAndPost();
}

//+------------------------------------------------------------------+
//| Scan history + open trades, post any we haven't seen yet         |
//+------------------------------------------------------------------+
void ScanAndPost() {
   // Closed trades
   int total = OrdersHistoryTotal();
   for (int i = 0; i < total; i++) {
      if (!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
      int op = OrderType();
      if (op != OP_BUY && op != OP_SELL) continue;
      int ticket = OrderTicket();
      if (HasPosted(ticket)) continue;
      PostTrade(ticket, true);
      MarkPosted(ticket);
   }

   if (!IncludeOpen) return;

   // Open positions
   int openTotal = OrdersTotal();
   for (int j = 0; j < openTotal; j++) {
      if (!OrderSelect(j, SELECT_BY_POS, MODE_TRADES)) continue;
      int op = OrderType();
      if (op != OP_BUY && op != OP_SELL) continue;
      int ticket = OrderTicket();
      if (HasPosted(ticket)) continue;
      PostTrade(ticket, false);
      MarkPosted(ticket);
   }
}

//+------------------------------------------------------------------+
//| Build JSON payload + POST                                        |
//+------------------------------------------------------------------+
void PostTrade(int ticket, bool closed) {
   if (!OrderSelect(ticket, SELECT_BY_TICKET)) return;

   string pair  = OrderSymbol();
   string side  = (OrderType() == OP_BUY) ? "long" : "short";
   double entry = OrderOpenPrice();
   double sl    = OrderStopLoss();
   double tp    = OrderTakeProfit();
   double exit  = closed ? OrderClosePrice() : 0;
   double size  = OrderLots() * 100000.0; // 1 lot = 100,000 base units (FX)
   double pnl   = OrderProfit() + OrderSwap() + OrderCommission();

   string body = "{";
   body += "\"pair\":\"" + InsertSlash(pair) + "\",";
   body += "\"side\":\"" + side + "\",";
   body += "\"entry\":" + DoubleToStr(entry, _Digits) + ",";
   if (sl > 0) body += "\"stop\":" + DoubleToStr(sl, _Digits) + ",";
   if (tp > 0) body += "\"target\":" + DoubleToStr(tp, _Digits) + ",";
   if (closed) body += "\"exit\":" + DoubleToStr(exit, _Digits) + ",";
   body += "\"size\":" + DoubleToStr(size, 0) + ",";
   if (DefaultMood != "") body += "\"mood\":\"" + DefaultMood + "\",";
   body += "\"tags\":[\"mt4-bridge\"],";
   body += "\"notes\":\"MT4 ticket #" + IntegerToString(ticket) + "\"";
   body += "}";

   if (DebugLogging) Print("POST ", WebhookUrl, " body=", body);

   string headers = "Content-Type: application/json\r\n";
   uchar payload[];
   StringToCharArray(body, payload, 0, StringLen(body));
   uchar resp[];
   string respHdrs;
   int code = WebRequest("POST", WebhookUrl, headers, 5000, payload, resp, respHdrs);
   if (code == -1) {
      Print("WebRequest failed for ticket ", ticket, ", error=", GetLastError(),
            ". Check Tools→Options→Expert Advisors→WebRequest URL allowlist.");
   } else if (code >= 200 && code < 300) {
      if (DebugLogging) Print("Ticket ", ticket, " posted OK (", code, ")");
   } else {
      Print("Ticket ", ticket, " webhook responded ", code, ": ", CharArrayToString(resp));
   }
}

//+------------------------------------------------------------------+
//| Insert slash so EURUSD → EUR/USD                                 |
//+------------------------------------------------------------------+
string InsertSlash(string symbol) {
   // Strip broker suffix (e.g. EURUSD.r, EURUSD-i) — keep first 6 alpha chars
   string base = "";
   for (int i = 0; i < StringLen(symbol); i++) {
      ushort c = StringGetChar(symbol, i);
      if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) base += StringSubstr(symbol, i, 1);
      if (StringLen(base) >= 7) break;
   }
   base = StringToUpper(base);
   if (StringLen(base) >= 6 && StringSubstr(base, 0, 3) == "XAU") return "XAU/USD";
   if (StringLen(base) >= 6) return StringSubstr(base, 0, 3) + "/" + StringSubstr(base, 3, 3);
   return symbol;
}

string StringToUpper(string s) {
   string out = "";
   for (int i = 0; i < StringLen(s); i++) {
      ushort c = StringGetChar(s, i);
      if (c >= 'a' && c <= 'z') c -= 32;
      out += ShortToString(c);
   }
   return out;
}

//+------------------------------------------------------------------+
//| Posted-tickets set (linear; fast enough for ~thousands)          |
//+------------------------------------------------------------------+
bool HasPosted(int ticket) {
   for (int i = 0; i < postedCount; i++) if (posted[i] == ticket) return true;
   return false;
}

void MarkPosted(int ticket) {
   if (postedCount >= ArraySize(posted)) ArrayResize(posted, postedCount * 2);
   posted[postedCount++] = ticket;
}
//+------------------------------------------------------------------+
