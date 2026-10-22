/* Smoke test: loads index.html in headless Chromium and exercises the core data paths.
   Run:  npm install && npm test   (set CHROMIUM_PATH to use a local browser binary) */
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForFunction(() => typeof createJournal === 'function');

  const r = await page.evaluate(async () => {
    await createJournal('Test', { initialBalance: 5000 });
    STATE.options.symbols.push('ABC'); await persistOptions();
    formDraft.symbol = 'EURUSD'; formDraft.entryTime = '2026-10-19T09:00:00'; formDraft.closeTime = '2026-10-19T10:00:00';
    formDraft.riskDollar = 100; formDraft.pnl = 2;
    A.updateDateTimeField('entryTime', '2026-10-19', '09:00');
    const day = formDraft.day, session = formDraft.killZone;
    await submitTrade();
    STATE.ui.manageModal = {};
    await A.commitRenameOption('symbols', STATE.options.symbols.indexOf('EURUSD'), 'EURUSD2');
    const id = STATE.activeJournalId;
    await selectJournal(id);                       // reload from IndexedDB
    const trades = await db.getTradesByJournal(id);
    return { day, session, balance: STATE.journalSettings.initialBalance,
             keptOption: STATE.options.symbols.includes('ABC'),
             symbol: trades[0].symbol, result: trades[0].result, unsafe: safeUrl('javascript:alert(1)') };
  });

  assert.deepStrictEqual(r, { day: 'Monday', session: 'London', balance: 5000, keptOption: true,
    symbol: 'EURUSD2', result: 'be', unsafe: '' });
  assert.deepStrictEqual(errors, []);
  await browser.close();
  console.log('smoke test passed');
})().catch(e => { console.error(e); process.exit(1); });
