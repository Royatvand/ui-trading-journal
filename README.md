[English](README.md) · [فارسی](README.fa.md)

<p align="center">
  <strong>THE LEDGER</strong><br>
  <em>A local-first trading journal for recording trades and reviewing performance—right in your browser.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2ea44f.svg" alt="MIT License"></a>
  <a href=".github/workflows/pages.yml"><img src="https://img.shields.io/badge/deploy-GitHub%20Pages-blue" alt="GitHub Pages deployment"></a>
  <a href=".github/workflows/test.yml"><img src="https://img.shields.io/badge/tests-Playwright-smoke%20test-informational" alt="Playwright smoke test"></a>
</p>

THE LEDGER is a browser-based trading journal built with plain HTML, CSS, and JavaScript. It needs no application backend, account, or build step. Journal records are stored in IndexedDB in your browser, so they are not sent to a THE LEDGER server.

## Why THE LEDGER?

Your trading history is personal. THE LEDGER lets you record trades and inspect performance without creating an account or uploading journal data to an application server. It is local-first and designed to work without a backend; keep backups because browser storage is not permanent.

## Features

- **Multiple journals** with separate balances, settings, and customizable option lists.
- **Trade logging** with Win, Loss, and Break-even outcomes.
- **Automatic trade fields:** R-multiple, day, and session.
- **Performance analytics:** Win Rate, Profit Factor, Expectancy, Drawdown, streaks, Risk of Ruin, and long/short split.
- **Performance breakdowns** by session, weekday, hour, instrument, and psychology.
- **Review views:** equity curve, trading calendar, and monthly summary.
- **Persian pre-trade checklist.**
- **Themes** and customizable option lists.
- **JSON backup and restore**, for one journal or all journals.

## Quick start

### Open directly

1. Clone or download this repository.
2. Open `index.html` in a modern browser.
3. Create a journal and start logging trades.

No build step or package installation is needed to open the app.

### Run a local server

Requires Node.js/npm:

```bash
npm install
npm start
```

Alternatively, use Python if it is installed:

```bash
python3 -m http.server
```

Then open the local address printed by the server.

## Screenshots

Screenshots of the actual application can be added here when available.

<!-- Replace these placeholders with real screenshots before enabling them. -->
<!--
| Dashboard | Trade history |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Trade history](docs/screenshots/trades.png) |

| Analytics | Calendar |
|---|---|
| ![Analytics](docs/screenshots/analytics.png) | ![Calendar](docs/screenshots/calendar.png) |
-->

## Project structure

```text
.
├── index.html
├── css/
│   ├── fonts.css
│   └── style.css
├── fonts/                  # bundled Vazirmatn font files
├── js/                     # classic scripts; load order matters
│   ├── 01-config.js
│   ├── 02-theme-utils.js
│   ├── 03-db.js
│   ├── 04-analytics.js
│   ├── 05-state-bootstrap.js
│   ├── 06-actions.js
│   ├── 07-render-dashboard.js
│   ├── 08-log-form.js
│   ├── 09-analytics-views.js
│   ├── 10-history-modals.js
│   ├── 11-options-ui.js
│   └── 12-boot.js
├── tests/
│   └── smoke.test.js
├── .github/workflows/
├── package.json
├── CHANGELOG.md
└── LICENSE
```

The JavaScript files are classic scripts that share a global scope. Their numeric load order is intentional—do not reorder them without checking their dependencies.

## Data, privacy, and backups

- Journal data is stored in browser IndexedDB (`LedgerTradingJournalDB`); the app does not send it to a THE LEDGER backend.
- **Browser storage is not a backup.** Clearing site data or losing the browser profile can delete journals.
- Data is not automatically synchronized between browsers or devices.
- Export JSON backups regularly and keep them somewhere safe.
- Test restoring a backup before relying on it.
- Treat exported JSON files as private financial records.

The app includes automatic migration for older settings records when loading or importing them. Keep a separate backup before testing imports or making significant changes.

## Configuration

- **Break-even threshold — `BE_RISK_FRACTION`** in `js/02-theme-utils.js`: in Auto mode, a P&L whose absolute value is at or below this fraction of the risk is classified as Break-even. The default is `0.05` (5% of risk).
- **Session ranges — `SESSION_RANGES`** in `js/02-theme-utils.js`: used to assign a session from the entry time. Adjust the ranges to match the timezone of the times you enter.

In Auto mode, Break-even trades are excluded from Win Rate but are included in P&L and Expectancy.

## Tests

The project includes a Playwright smoke test that opens the app in Chromium and exercises core journal, settings, and trade-data paths.

```bash
npm install
npm test
```

Playwright needs a compatible Chromium browser. If you use a local browser binary, set `CHROMIUM_PATH` to its executable path as described in `tests/smoke.test.js`.

## Deploy to GitHub Pages

A GitHub Actions workflow is included at `.github/workflows/pages.yml`.

1. Push your changes to the `main` branch.
2. In repository settings, open **Settings → Pages**.
3. Set the source to **GitHub Actions**.
4. Check the Actions tab for the deployment result.

## Contributing

Bug reports, documentation fixes, and focused improvements are welcome.

1. Open an issue describing the bug or proposed change.
2. Fork the repository and create a branch.
3. Keep changes focused and explain their purpose.
4. Run `npm test` when changing application behavior.
5. Open a pull request with a concise summary and relevant testing notes.

Please preserve the project's core principles: local-first data, no required application backend, and straightforward browser use.

## Roadmap

Potential areas for future improvement:

- Expand automated test coverage beyond the smoke test.
- Improve accessibility and keyboard navigation.
- Document analytics formulas and edge cases in more detail.

These are possible future improvements, not claims about existing functionality.

## License

THE LEDGER is released under the [MIT License](LICENSE).
