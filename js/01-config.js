"use strict";
/* ============================================================
   THE LEDGER — Trading Journal
   Single-file vanilla JS implementation. Persistence via
   IndexedDB (per-journal trades / checklist items / option lists).
   ============================================================ */

/* ---------------- constants & defaults ---------------- */
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];
let KILLZONES = ['Asia','London','New York','Out of Session'];
const POSITIONS = ['Buy','Sell'];
let EMOTIONAL_STATES = ['Calm','Confident','Focused','Neutral','Nervous','Fearful','Frustrated','Angry','Overconfident','Tired'];
let RULE_VIOLATIONS = ['Early Entry','Late Entry','Moved Stop Loss','Moved Take Profit','Over Risk','Revenge Trade','FOMO','Ignored Confirmation','Outside Trading Plan','Emotional Trade'];
const SESSIONS = ['Asia','London','New York','Out of Session'];
const TIME_PDA_GROUPS = ['Macro','Silver Bullet','Macro + Silver Bullet','None'];
function storedEntryHour(entryTime){
  const match = String(entryTime || '').match(/(?:T|\s)([01][0-9]|2[0-3]):[0-5][0-9]/);
  return match ? Number(match[1]) : null;
}
function formatHourLabel(hour){
  const start = Number(hour);
  const end = (start + 1) % 24;
  return String(start).padStart(2,'0')+':00 – '+String(end).padStart(2,'0')+':00';
}

const DEFAULTS = {
  symbols: ['EURUSD','GBPUSD','XAUUSD','NAS100','US30'],
  timePDA: ['Macro','Silver Bullet'],
  sdpTime: [
    '2 - 2.5 / 5m / Failure Swing','2 - 2.5 / 1m / Failure Swing',
    '3.5 - 4 / 5m / Failure Swing','3.5 - 4 / 1m / Failure Swing',
    '2 - 2.5 / 15m','3.5 - 4 / 15m','2 - 2.5 / 5m','3.5 - 4 / 5m',
    '2 - 2.5 / 1m','3.5 - 4 / 1m'
  ],
  confirmationTime: ['15m','5m','1m','15s'],
  entryType: ['2022 Setup ( MSS + Displacement )','IFVG','CISD'],
  psychology: ['FOMO','Revenge Trading','Greed','Fear','Hesitation','Impatience'],
  dealingRange: ['Premium','Discount','Equilibrium','External Range','Internal Range'],
  entrySetup: ['IFVG','FVG','Breaker','Order Block','Mitigation Block','Market','Limit'],
  emotionalState: ['Calm','Confident','Focused','Neutral','Nervous','Fearful','Frustrated','Angry','Overconfident','Tired'],
  ruleViolations: ['Early Entry','Late Entry','Moved Stop Loss','Moved Take Profit','Over Risk','Revenge Trade','FOMO','Ignored Confirmation','Outside Trading Plan','Emotional Trade']
};

/* ── Trading Checklist (from uploaded CheckList.html - Persian) ── */
const TRADING_CHECKLIST_TEXTS = [
  'واضح بودن لگ استاپ‌هانت یا فیلرسویینگ',
  'همپوشانی مناطق با لیکوییدیتی',
  'حضور مناطق در محل مناسب در دیلینگ‌رنج (سل » پریمیوم / بای » دیسکانت)',
  'مارکت استراکچر شیفت (ITH/ITL) + دابل کانفرمیشن',
  'دیسپلیسمنت مناسب 🐘🌊',
  'فِیل شدن سه‌تا PDA',
  'ریسک صحیح ورود به معامله',
  'ورود مناسب در P/D یا در OTE در صورت واید بودن لگ',
  'قرار دادن استاپ‌لاس زیر سووینگی که MSS داده + ۶ پوینت',
  'ریوارد به ریسک ۲.۱'
];
