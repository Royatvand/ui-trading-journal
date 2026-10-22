# THE LEDGER — Trading Journal

A local-first trading journal that runs entirely in your browser. No backend, no build step, no account:
your data lives in the browser's IndexedDB and never leaves your machine.

[فارسی](#فارسی) · [English](#features)

## Features
- Multiple journals, each with its own balance, settings and customizable option lists
- Trade logging with Win / Loss / **Break-even**, auto R-multiple, auto Day and Session
- Analytics: win rate, profit factor, expectancy, drawdown, streaks, risk of ruin, long/short split
- Session, weekday/hour, instrument and psychology breakdowns
- Equity curve, calendar and monthly summary views
- Pre-trade checklist (Persian), themes, JSON backup / restore (per journal or all journals)

## Run it
No install needed — open `index.html` in a modern browser.
For a local server instead: `npm start` (or `python3 -m http.server`).

## Project structure
```
index.html          page shell, loads CSS then scripts in order
css/fonts.css       @font-face (Vazirmatn, shipped in /fonts)
css/style.css       all styles and theme variables
fonts/              Vazirmatn woff2 (400 / 600 / 700)
js/                 classic scripts sharing one global scope — ORDER MATTERS
  01-config.js          constants, default option lists, checklist texts
  02-theme-utils.js     theme engine, esc(), safeUrl(), result helpers
  03-db.js              IndexedDB layer + image compression
  04-analytics.js       analytics engine (memoized)
  05-state-bootstrap.js global STATE, init, checklist helpers
  06-actions.js         toast, settings schema, journal / trade / backup / option actions
  07-render-dashboard.js top-level render, dashboard
  08-log-form.js        trade form
  09-analytics-views.js analytics panels, equity, calendar, monthly
  10-history-modals.js  trade history, trade detail modal, checklist tab
  11-options-ui.js      option manager modal, the `A` action object
  12-boot.js            global click handling, startup
tests/smoke.test.js Playwright smoke test (`npm install && npm test`)
```
Scripts are plain (non-module) so the app also works from `file://`.

## Data & backups
Everything is stored in IndexedDB (`LedgerTradingJournalDB`). Clearing site data deletes it, so export
backups regularly (Export from the dashboard or inside a journal).

Settings records use schema v2: `{ id, schema: 2, journalSettings, optionLists, archived }`.
Older records are migrated automatically on load/import.

## Configuration
- `BE_RISK_FRACTION` (`js/02-theme-utils.js`): in Auto mode, |P&L| ≤ this fraction of risk counts as break-even (default 0.05).
- `SESSION_RANGES` (`js/02-theme-utils.js`): hour ranges used to auto-pick the Session from the entry time.
  Adjust them to the clock/timezone you type your times in.

## Deploy
Push to `main`; the included workflow publishes the site to GitHub Pages
(enable **Settings → Pages → Source: GitHub Actions**).

## License
MIT — see [LICENSE](LICENSE).

---

## فارسی

**THE LEDGER** یک ژورنال معاملاتی است که کاملاً داخل مرورگر اجرا می‌شود؛ بدون سرور و بدون ثبت‌نام. داده‌ها فقط در IndexedDB مرورگر خودت ذخیره می‌شوند.

### اجرا
فایل `index.html` را در مرورگر باز کن. برای سرور محلی: `npm start`.

### نکات مهم
- **بکاپ بگیر:** پاک کردن داده‌ی سایت از مرورگر یعنی پاک شدن ژورنال. از دکمه‌ی Export بکاپ JSON بگیر.
- **ساختار:** `index.html` + پوشه‌های `css`، `js` و `fonts`. فایل‌های `js` به ترتیب شماره بارگذاری می‌شوند و ترتیب‌شان مهم است.
- **Break-even:** در حالت Auto، معامله‌ای با سود/زیان کمتر از ۵٪ ریسک BE حساب می‌شود (`BE_RISK_FRACTION`). BE در وین‌ریت نمی‌آید ولی در PnL و Expectancy حساب می‌شود.
- **Session خودکار:** بازه‌ی ساعت‌ها را در `SESSION_RANGES` مطابق ساعت خودت تنظیم کن.
