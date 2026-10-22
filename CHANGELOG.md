# Changelog

## 2.0.0
### Changed
- Split the single HTML file into `index.html`, `css/`, `js/` (12 ordered scripts) and `fonts/`.
- Vazirmatn fonts are now shipped as `.woff2` files instead of base64 in the CSS.
- Removed injected third-party scripts (Cloudflare beacon etc.) from the original file.

### Fixed
- Per-journal option lists and archived options are now loaded from and saved to IndexedDB
  (previously `selectJournal` always reset them, and saving them overwrote `initialBalance`).
- Renaming / replacing an option now updates the affected trades in the database
  (also fixed a wrong option→trade field mapping, e.g. `symbols` vs `symbol`).
- Chart links are validated (http/https only) and escaped, on input, render and import (XSS).

### Added
- Break-even result (Auto / Win / Loss / BE). BE is excluded from win rate, included in P&L and expectancy.
- Auto-calculated R (P&L ÷ risk), Day and Session from the entry time (manual override supported).
- Form validation with toast messages instead of `alert`.
- Fast batch import using a single IndexedDB transaction; settings are included in backups.
- Settings record schema v2 with automatic migration of legacy records.
- Smoke test (`npm test`).
