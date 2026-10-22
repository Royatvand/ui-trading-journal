"use strict";
/* ---------------- trade history tab ---------------- */
function dynamicFilterOptions(){
  /* Options are derived from the trades actually logged, so the dropdowns
     only ever offer values that can return a result. Blank/undefined
     entries are stripped: older trades predate some of these fields and
     would otherwise add an empty row to the list. */
  const uniq  = fn => ['all', ...new Set(STATE.trades.map(fn).filter(v=>v!=null && v!==''))];
  const uniqM = fn => ['all', ...new Set(STATE.trades.flatMap(t=>fn(t)||[]).filter(v=>v!=null && v!==''))];

  const symbols = uniq(t=>t.symbol);
  const entryTypes = uniq(t=>t.entryType);
  const killZones = uniq(t=>t.killZone);
  const days = ['all', ...DAYS];
  const psychologyOptions = uniqM(t=>t.psychology);
  const timePDAOptions = uniqM(t=>t.timePDA);
  const sdpTimeOptions = uniqM(t=>t.sdpTime);
  const confirmationTimeOptions = uniq(t=>t.confirmationTime);
  const dealingRangeOptions = uniqM(t=>t.dealingRange);
  const entrySetupOptions = uniqM(t=>t.entrySetup);
  const emotionalStateOptions = uniq(t=>t.emotionalState);
  const ruleViolationOptions = uniqM(t=>t.ruleViolations);

  return { symbols, entryTypes, killZones, days, psychologyOptions, timePDAOptions,
           sdpTimeOptions, confirmationTimeOptions, dealingRangeOptions,
           entrySetupOptions, emotionalStateOptions, ruleViolationOptions };
}

/* ── Trade History incremental rendering ────────────────────
   The visible window is 10 rows (HISTORY_VISIBLE_ROWS). We render a
   larger first chunk so a short scroll is instant, then append further
   chunks on demand. This keeps a 1000-trade journal as cheap to render
   as a 40-trade one, while still letting the user reach every row.   */
const HISTORY_CHUNK = 40;
let __historyOrdered = [];
let __historyRendered = 0;

function historyRowsHTML(list, from, to){
  let out = '';
  const total = list.length;
  for(let i = from; i < to; i++){
    const t = list[i];
    const pct = t.startBalance > 0 ? (t.pnl / t.startBalance) * 100 : 0;
    const sign = t.pnl > 0 ? '+' : '';
    out += '<tr>'+
      '<td style="font-weight:700;">'+esc(t.symbol)+'</td>'+
      '<td class="num">'+fmtDate(t.entryTime)+'</td>'+
      '<td><span class="pill '+(resultOf(t)==='be'?'':resultOf(t))+'"'+(resultOf(t)==='be'?' style="background:var(--surface-2,rgba(255,255,255,.08));color:var(--text-dim,#9aa);"':'')+'>'+({win:'Win',loss:'Loss',be:'BE'})[resultOf(t)]+'</span></td>'+
      '<td class="num '+(t.pnl>=0?'pnl-pos':'pnl-neg')+'">'+sign+t.pnl.toFixed(2)+' ('+sign+pct.toFixed(2)+'%)</td>'+
      '<td><div class="row-actions">'+
        '<button class="icon-btn" title="View" onclick="A.viewTrade(\''+t.id+'\')">👁</button>'+
        '<button class="icon-btn" title="Edit" onclick="A.handleEditTrade(\''+t.id+'\')">✎</button>'+
        '<button class="icon-btn danger" title="Delete" onclick="A.deleteTradeAction(\''+t.id+'\')">🗑️</button>'+
      '</div></td>'+
    '</tr>';
  }
  return out;
}

function appendHistoryRows(){
  if(__historyRendered >= __historyOrdered.length) return false;
  const wrap = document.getElementById('history-table-wrap');
  if(!wrap) return false;
  const tbody = wrap.querySelector('tbody');
  if(!tbody) return false;
  const next = Math.min(__historyRendered + HISTORY_CHUNK, __historyOrdered.length);
  tbody.insertAdjacentHTML('beforeend',
    historyRowsHTML(__historyOrdered, __historyRendered, next));
  __historyRendered = next;
  return true;
}

function getFilteredTrades(){
  const f = STATE.ui.filters;

  /* Hoist everything that does not depend on the individual trade out of
     the loop. Previously the two filter-boundary Dates were re-parsed for
     every single trade, and every trade's entryTime was turned into a Date
     even when no date filter was active. */
  const fromMs = f.dateFrom ? new Date(f.dateFrom).getTime() : null;
  let toMs = null;
  if(f.dateTo){
    const to = new Date(f.dateTo);
    to.setHours(23,59,59,999);
    toMs = to.getTime();
  }
  const needsDate = fromMs !== null || toMs !== null;

  /* cheap scalar comparisons first, array scans last: the vast majority of
     rejections happen on the early tests, so the expensive ones rarely run */
  return STATE.trades.filter(t=>{
    if(f.symbol!=='all' && t.symbol!==f.symbol) return false;
    if(f.result!=='all' && resultOf(t)!==f.result) return false;
    if(f.killZone!=='all' && t.killZone!==f.killZone) return false;
    if(f.entryType!=='all' && t.entryType!==f.entryType) return false;
    if(f.day!=='all' && t.day!==f.day) return false;
    if(f.confirmationTime!=='all' && t.confirmationTime!==f.confirmationTime) return false;
    if(f.smt!=='all' && (f.smt==='yes' ? !t.smt : t.smt)) return false;
    if(f.threePdaFail!=='all' && (f.threePdaFail==='yes' ? !t.threePdaFail : t.threePdaFail)) return false;
    if(f.ote!=='all' && (f.ote==='yes' ? !t.ote : t.ote)) return false;

    if(needsDate){
      const ms = new Date(t.entryTime).getTime();
      if(fromMs !== null && ms < fromMs) return false;
      if(toMs   !== null && ms > toMs)   return false;
    }

    if(f.emotionalState!=='all' && t.emotionalState!==f.emotionalState) return false;

    /* checklistCompleted is stored as a boolean; the filter is a yes/no/all
       tri-state, so compare against the coerced boolean rather than the raw
       value (older trades may have it undefined). */
    if(f.checklist!=='all' && (f.checklist==='yes' ? !t.checklistCompleted : !!t.checklistCompleted)) return false;

    if(f.psychology!=='all' && !t.psychology.includes(f.psychology)) return false;
    if(f.timePDA!=='all' && !t.timePDA.includes(f.timePDA)) return false;
    if(f.sdpTime!=='all' && !t.sdpTime.includes(f.sdpTime)) return false;

    /* multi-value fields added later: guard against trades saved before the
       field existed, where the property is undefined rather than [] */
    if(f.dealingRange!=='all' && !(t.dealingRange||[]).includes(f.dealingRange)) return false;
    if(f.entrySetup!=='all' && !(t.entrySetup||[]).includes(f.entrySetup)) return false;
    if(f.ruleViolations!=='all' && !(t.ruleViolations||[]).includes(f.ruleViolations)) return false;
    return true;
  });
}

function renderHistoryTab(){
  const filtered = getFilteredTrades();
  const opts = dynamicFilterOptions();
  const f = STATE.ui.filters;

  const selFilter = (field, list, labelAll, labelFn)=>{
    const cur = f[field];
    return `<select class="control" onchange="A.setFilter('${field}', this.value)">
      ${list.map(o=>`<option value="${esc(o)}" ${o===cur?'selected':''}>${o==='all'? labelAll : (labelFn?labelFn(o):o)}</option>`).join('')}
    </select>`;
  };
  const yn = (field,label)=>`<div class="field"><label>${label}</label>
    <select class="control" onchange="A.setFilter('${field}', this.value)">
      <option value="all" ${f[field]==='all'?'selected':''}>All</option>
      <option value="yes" ${f[field]==='yes'?'selected':''}>Yes</option>
      <option value="no" ${f[field]==='no'?'selected':''}>No</option>
    </select></div>`;

  /* Only the first chunk is put in the DOM up front; the rest stream in as
     the user scrolls (see appendHistoryRows). Building 1000+ <tr> strings
     and parsing them cost hundreds of ms per render even though only ~10
     rows are ever on screen. */
  __historyOrdered = filtered.slice().reverse();
  __historyRendered = Math.min(HISTORY_CHUNK, __historyOrdered.length);
  const rows = historyRowsHTML(__historyOrdered, 0, __historyRendered);

  return `
  <div class="stack">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:18px;">
        <div>
          <h2 style="margin-bottom:2px;">Trade History</h2>
          <span class="sub" style="margin:0;">${filtered.length} / ${STATE.trades.length} trades showing${filtered.length>10 ? ` &middot; scroll for all ${filtered.length}` : ''}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-sm" onclick="A.toggleFilters()">${STATE.ui.showFilters?'Hide':'Show'} Filters</button>
          <button class="btn btn-sm" onclick="A.handleExportBackup()">⇧ Export</button>
          <button class="btn btn-sm" onclick="document.getElementById('history-import-input').click()">⇩ Import</button>
          <input type="file" id="history-import-input" class="hidden-input" accept=".json" onchange="A.handleHistoryImport(this)">
        </div>
      </div>

      ${STATE.ui.showFilters ? `
      <div class="filter-bar">
        <div class="filter-grid">
          <div class="field"><label>Symbol</label>${selFilter('symbol', opts.symbols, 'All')}</div>
          <div class="field"><label>Date From</label><input type="date" class="control" value="${f.dateFrom||''}" onchange="A.setFilter('dateFrom', this.value)"></div>
          <div class="field"><label>Date To</label><input type="date" class="control" value="${f.dateTo||''}" onchange="A.setFilter('dateTo', this.value)"></div>
          <div class="field"><label>Result</label>
            <select class="control" onchange="A.setFilter('result', this.value)">
              <option value="all" ${f.result==='all'?'selected':''}>All</option>
              <option value="win" ${f.result==='win'?'selected':''}>Win</option>
              <option value="loss" ${f.result==='loss'?'selected':''}>Loss</option>
              <option value="be" ${f.result==='be'?'selected':''}>Break-even</option>
            </select>
          </div>
          <div class="field"><label>Day</label>${selFilter('day', opts.days, 'All Days')}</div>
          <div class="field"><label>Session</label>${selFilter('killZone', opts.killZones, 'All')}</div>
          <div class="field"><label>Confirmation</label>${selFilter('entryType', opts.entryTypes, 'All')}</div>
          <div class="field"><label>Time PDA</label>${selFilter('timePDA', opts.timePDAOptions, 'All')}</div>
          <div class="field"><label>Strategy</label>${selFilter('sdpTime', opts.sdpTimeOptions, 'All')}</div>
          <div class="field"><label>Dealing Range</label>${selFilter('dealingRange', opts.dealingRangeOptions, 'All')}</div>
          <div class="field"><label>Entry</label>${selFilter('entrySetup', opts.entrySetupOptions, 'All')}</div>
          <div class="field"><label>Confirmation Timeframe</label>${selFilter('confirmationTime', opts.confirmationTimeOptions, 'All')}</div>
          ${yn('smt','SMT')}
          ${yn('threePdaFail','3PDA Fail')}
          ${yn('ote','OTE')}
          <div class="field"><label>Psychology</label>${selFilter('psychology', opts.psychologyOptions, 'All')}</div>
          <div class="field"><label>Emotional State</label>${selFilter('emotionalState', opts.emotionalStateOptions, 'All')}</div>
          <div class="field"><label>Rule Violations</label>${selFilter('ruleViolations', opts.ruleViolationOptions, 'All')}</div>
          ${yn('checklist','Checklist')}
        </div>
        <div style="text-align:right;margin-top:12px;">
          <button class="btn btn-ghost btn-sm" onclick="A.resetFilters()">Clear Filters</button>
        </div>
      </div>` : ''}

      ${STATE.trades.length===0 ? `<div class="empty">No trades logged yet.</div>` : `
      <div class="table-scroll-host" style="margin-top:18px;">
        <div class="table-wrap rows-10" id="history-table-wrap">
          <table class="ledger">
            <thead><tr><th>Symbol</th><th>Date</th><th>Result</th><th>P&amp;L</th><th style="text-align:center;">Actions</th></tr></thead>
            <tbody>${rows || ''}</tbody>
          </table>
          ${filtered.length===0 ? `<div class="empty">No trades match your filters.</div>` : ''}
        </div>
      </div>`}
    </div>
    ${renderAnalyticsPanel(filtered, STATE.trades.length, 'chart-filtered')}
    ${renderEquityCurveCard('chart-filtered', true)}
  </div>`;
}

/* ---------------- view trade modal ---------------- */
function renderViewTradeModal(){
  const t = STATE.trades.find(x=>x.id===STATE.ui.viewTradeId);
  if(!t) return '';
  const detail = (label,val)=>`<div class="detail-item"><div class="l">${label}</div><div class="v">${val==null||val===''?'-':val}</div></div>`;
  return `
  <div class="overlay" onclick="A.closeViewTrade()">
    <div class="modal wide" onclick="event.stopPropagation()">
      <div class="modal-head">
        <h2>Trade Detail <span style="color:var(--amber)">${esc(t.symbol)}</span></h2>
        <button class="icon-btn" onclick="A.closeViewTrade()">✕</button>
      </div>
      <div class="section-title">Performance</div>
      <div class="detail-grid">
        ${detail('Outcome', `<span style="color:${({win:'var(--green)',loss:'var(--red)',be:'var(--text-dim,#9aa)'})[resultOf(t)]}">${({win:'Win',loss:'Loss',be:'Break-even'})[resultOf(t)]}</span>`)}
        ${detail('P&amp;L', `<span style="color:${t.pnl>=0?'var(--green)':'var(--red)'}">${fmtMoney(t.pnl)}</span>`)}
        ${detail('R/R', t.rr)}
        ${detail('Max R', t.maxR)}
      </div>
      <div class="section-title">Context</div>
      <div class="detail-grid">
        ${detail('Position', `<span style="color:${t.position==='Buy'?'var(--green)':'var(--red)'}">${t.position}</span>`)}
        ${detail('Session', t.killZone)}
        ${detail('Day', t.day)}
        ${detail('Start Balance', fmtMoney(t.startBalance))}
      </div>
      <div class="section-title">Execution</div>
      <div class="detail-grid">
        ${detail('Entry Time', fmtDateTime(t.entryTime))}
        ${detail('Close Time', fmtDateTime(t.closeTime))}
        ${detail('Confirmation', esc(t.entryType))}
        ${detail('Confirmation', esc(t.confirmationTime))}
      </div>
      <div class="section-title">Risk Management</div>
      <div class="detail-grid">
        ${detail('Risk %', t.riskPercent!=null ? `${t.riskPercent}%` : '-')}
        ${detail('Stop Loss', t.stopLoss!=null ? t.stopLoss : '-')}
        ${detail('Take Profit', t.takeProfit!=null ? t.takeProfit : '-')}
        ${detail('Planned RR', t.plannedRR!=null ? t.plannedRR : '-')}
      </div>
      <div class="section-title">Checklist</div>
      <div class="detail-grid">
        ${detail('SMT', t.smt?'Yes':'No')}
        ${detail('3PDA Fail', t.threePdaFail?'Yes':'No')}
        ${detail('OTE', t.ote?'Yes':'No')}
        ${detail('Checklist Completed', t.checklistCompleted?'Yes':'No')}
      </div>
      <div class="section-title">Trade Management</div>
      <div class="detail-grid">
        ${detail('Holding Time', formatHoldingTime(t.holdingTime || computeHoldingMinutes(t.entryTime, t.closeTime)))}
        ${detail('Emotional State', esc(t.emotionalState || '-'))}
        ${detail('Confidence Score', t.confidenceScore!=null ? `${t.confidenceScore}/10` : '-')}
        ${detail('Discipline Score', t.disciplineScore!=null ? `${t.disciplineScore}/100` : '-')}
      </div>
      ${t.ruleViolations?.length ? `
      <div class="detail-grid" style="margin-top:12px;">
        ${detail('Rule Violations', esc(t.ruleViolations.join(', ')))}
      </div>` : ''}
      ${(t.timePDA?.length || t.sdpTime?.length) ? `
      <div class="section-title">Time Analysis</div>
      <div class="grid grid-2">
        ${detail('Time PDA', esc(t.timePDA.join(', ')) || '-')}
        ${detail('Strategy', esc(t.sdpTime.join(', ')) || '-')}
      </div>` : ''}
      ${(t.note || t.psychology?.length) ? `
      <div class="section-title">Review</div>
      ${t.note ? `<div class="detail-item" style="margin-bottom:10px;"><div class="l">Note</div><div class="v" style="font-weight:400;white-space:pre-wrap;">${esc(t.note)}</div></div>` : ''}
      ${t.psychology?.length ? detail('Psychology Issues', esc(t.psychology.join(', '))) : ''}
      ` : ''}
      ${t.chartLinks?.length ? `
      <div class="section-title">Chart Links</div>
      <div style="display:flex;flex-direction:column;gap:4px;">${t.chartLinks.filter(u=>safeUrl(u)).map(u=>`<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer" style="font-family:var(--font-mono);font-size:12px;color:var(--amber);">${esc(u.length>55?u.substring(0,55)+'...':u)}</a>`).join('')}</div>
      ` : ''}
    </div>
  </div>`;
}

/* ---------------- checklist tab ---------------- */
function renderChecklistTab(){
  // Trading checklist with score & progress - using journal UI
  // Ensure checklist follows default order
  const orderMap = new Map(TRADING_CHECKLIST_TEXTS.map((t,i)=>[t,i]));
  const sortedChecklist = [...STATE.checklist].sort((a,b)=>(orderMap.get(a.text)||0)-(orderMap.get(b.text)||0));

  const total = sortedChecklist.length || TRADING_CHECKLIST_TEXTS.length;
  const checked = sortedChecklist.filter(i=>i.completed).length;
  const pct = total>0 ? Math.round((checked/total)*100) : 0;
  let progClass = 'low';
  if(pct>=80) progClass='high';
  else if(pct>=50) progClass='med';

  const editingId = STATE.ui.checklistEditingId;

  const itemsHTML = sortedChecklist.map(item=>{
    const isEditing = editingId === item.id;
    if(isEditing){
      return `
        <div class="trading-check-item editing">
          <div class="circle" style="opacity:0.3;">✎</div>
          <input type="text" id="checklist-edit-${item.id}" class="control" style="flex:1;font-family:var(--font-rtl);font-size:13px;padding:6px 10px;" value="${esc(STATE.ui.checklistEditingText)}" oninput="A.updateChecklistEditingText(this.value)" onkeydown="if(event.key==='Enter'){A.saveEditChecklistItem('${item.id}')}else if(event.key==='Escape'){A.cancelEditChecklistItem()}">
          <div style="display:flex;gap:4px;">
            <button class="icon-btn" style="font-size:12px;width:22px;height:22px;" title="Save" onclick="event.stopPropagation();A.saveEditChecklistItem('${item.id}')">✓</button>
            <button class="icon-btn" style="font-size:11px;width:22px;height:22px;" title="Cancel" onclick="event.stopPropagation();A.cancelEditChecklistItem()">✕</button>
          </div>
        </div>`;
    }
    return `
    <div class="trading-check-item ${item.completed?'checked':''}" onclick="A.toggleChecklistItemAction('${item.id}')">
      <div class="circle">${item.completed?'✓':''}</div>
      <span class="txt">${esc(item.text)}</span>
      <div class="mini-actions" onclick="event.stopPropagation()">
        <button class="mini-icon" title="Edit" onclick="A.startEditChecklistItem('${item.id}', '${esc(item.text).replace(/'/g,"\\'")}')">✎</button>
        <button class="mini-icon danger" title="Delete" onclick="A.deleteChecklistItemAction('${item.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="check-wrap trading">
    <div class="check-card trading">
      <div class="trading-title">چک لیست معاملاتی</div>

      <div class="check-score-row">
        <span class="check-score-label">امتیاز:</span>
        <span class="check-score-value">${checked}/${total}<span class="pct">- ${pct}%</span></span>
      </div>
      <div class="check-progress">
        <div class="check-progress-fill ${progClass}" style="width:${pct}%"></div>
      </div>

      <div class="trading-check-list">
        ${itemsHTML}
      </div>

      <div class="trading-check-reset">
        <button class="btn btn-ghost btn-sm" onclick="A.resetTradingChecklist()">Reset Checklist</button>
      </div>
    </div>
  </div>`;
}
