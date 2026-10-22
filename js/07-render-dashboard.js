"use strict";
/* ---------------- top-level render ---------------- */
function render(){
  const hp=document.querySelector('.help-popover'); if(hp)hp.remove(); STATE.ui._helpLabel=null;
  const root = document.getElementById('app');
  if(STATE.loading){
    root.innerHTML = `<div class="loading-screen"><div class="spinner"></div></div>`;
    return;
  }
  if(!STATE.activeJournalId){
    root.innerHTML = renderDashboard();
    drawDashboardCharts();
    return;
  }
  root.innerHTML = renderJournalApp();
  postRenderHooks();
}

function postRenderHooks(){
  const analytics = computeAnalytics(currentTabTradesForAnalytics());
  if(document.getElementById('chart-main')) renderAreaChart('chart-main', analytics.accountGrowth);
  if(document.getElementById('chart-filtered')){
    const filtered = computeAnalytics(getFilteredTrades());
    renderAreaChart('chart-filtered', filtered.accountGrowth);
  }
  lockHistoryScroll();
}

/* ── Trade History: cap the viewport at exactly HISTORY_VISIBLE_ROWS ──
   Measured from the live DOM rather than hard-coded, so it stays correct
   across themes (each theme has its own padding / radius / font).       */
const HISTORY_VISIBLE_ROWS = 10;

function lockHistoryScroll(){
  const wrap = document.getElementById('history-table-wrap');
  if(!wrap) return;
  const host  = wrap.closest('.table-scroll-host');
  const thead = wrap.querySelector('thead');
  const rows  = wrap.querySelectorAll('tbody tr');

  /* fewer rows than the cap → let it size naturally, no scrollbar */
  if(rows.length <= HISTORY_VISIBLE_ROWS){
    wrap.style.maxHeight = 'none';
    wrap.style.overflowY = 'visible';
    if(host) host.classList.remove('can-scroll','at-end');
    return;
  }

  wrap.style.overflowY = 'auto';

  /* Measure with offsetHeight rather than getBoundingClientRect(): we only
     need integer pixel heights, and reading offsetHeight in one tight loop
     lets the browser answer from a single layout pass instead of
     re-flushing on every call. */
  let h = thead ? thead.offsetHeight : 0;
  for(let i = 0; i < HISTORY_VISIBLE_ROWS; i++){
    h += rows[i].offsetHeight;
  }
  /* half a row peeking through makes it obvious the list continues */
  h += Math.round(rows[0].offsetHeight * 0.5);

  wrap.style.maxHeight = Math.round(h) + 'px';

  if(host){
    host.classList.add('can-scroll');
    /* render() replaces this element every time, but guard anyway so a
       re-entrant call can never stack duplicate scroll listeners */
    if(!wrap.__scrollSyncBound){
      wrap.__scrollSyncBound = true;
      wrap.addEventListener('scroll', ()=>{
        /* stream in the next chunk before the user actually hits the
           bottom, so scrolling never visibly stalls */
        if(wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 400){
          appendHistoryRows();
        }
        const atEnd = wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 2
                      && __historyRendered >= __historyOrdered.length;
        host.classList.toggle('at-end', atEnd);
      }, { passive:true });
    }
    host.classList.toggle('at-end',
      wrap.scrollTop + wrap.clientHeight >= wrap.scrollHeight - 2
      && __historyRendered >= __historyOrdered.length);
  }
}

/* keep the cap correct when the window is resized */
window.addEventListener('resize', ()=>{
  clearTimeout(window.__histResizeT);
  window.__histResizeT = setTimeout(lockHistoryScroll, 120);
});

function currentTabTradesForAnalytics(){
  return STATE.trades;
}

/* ---------------- top-level render (continued) ---------------- */

/* ---------------- footer ---------------- */
function renderFooter(){
  return `
  <footer class="site-footer">
    Created by <a href="https://t.me/ICT_Student" target="_blank" rel="noopener noreferrer">Neo</a><span class="sep">|</span><a href="https://t.me/MZ_ICT" target="_blank" rel="noopener noreferrer">MZICT</a>
  </footer>`;
}

/* ---------------- dashboard view ---------------- */
function renderDashboard(){
  const cards = STATE.journals.map(j=>{
    const stats = STATE.journalStats[j.id] || {pnl:0, tradeCount:0, startBalance:0, series:[]};
    const pct = stats.startBalance>0 ? (stats.pnl/stats.startBalance)*100 : 0;
    const changeClass = stats.pnl>0?'up':stats.pnl<0?'down':'flat';
    const arrow = stats.pnl>0?'▲':stats.pnl<0?'▼':'—';
    const balance = stats.startBalance + stats.pnl;
    const balParts = balance.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}).split('.');
    const isEditing = STATE.ui.dashEditingId === j.id;
    const menuOpen = STATE.ui.dashMenuId === j.id;
    const initial = (j.name||'?').trim().charAt(0).toUpperCase() || '?';

    return `
    <div class="journal-card" ${isEditing? '' : `onclick="A.selectJournal('${j.id}')"`}>
      <div class="jc-menu-wrap" onclick="event.stopPropagation()">
        <button class="icon-btn" onclick="A.toggleDashMenu('${j.id}')">⋮</button>
        ${menuOpen ? `
        <div class="journal-menu">
          <button onclick="A.startRename('${j.id}','${esc(j.name).replace(/'/g,"\\'")}')">✎ Rename Journal</button>
          <button onclick="A.exportJournalAction('${j.id}')">⇧ Export Backup</button>
          <hr>
          <button class="danger" onclick="A.deleteJournalAction('${j.id}')">🗑️ Delete Workspace</button>
        </div>` : ''}
      </div>

      <div class="jc-head">
        <div class="jc-avatar">${esc(initial)}</div>
        <div class="jc-name" ${isEditing? 'onclick="event.stopPropagation();"' : ''}>
          ${isEditing ? `
            <div class="jc-rename" style="display:flex;gap:6px;align-items:center;position:relative;z-index:6;background:var(--bg-2);border:1px solid var(--line-strong);border-radius:8px;padding:4px 6px;" onclick="event.stopPropagation()">
              <input class="control" style="font-weight:700;" value="${esc(STATE.ui.dashEditingName)}" oninput="A.setDashEditingName(this.value)" onkeydown="if(event.key==='Enter')A.saveRename('${j.id}')" autofocus>
              <button class="icon-btn" onclick="A.saveRename('${j.id}')">✓</button>
              <button class="icon-btn" onclick="A.cancelRename()">✕</button>
            </div>
          ` : `
            <h3>${esc(j.name)}</h3>
            <p>${stats.tradeCount} ${stats.tradeCount===1?'trade':'trades'}</p>
          `}
        </div>
      </div>

      <div class="jc-balance">$${balParts[0]}<span class="cents">.${balParts[1]}</span></div>
      <div class="jc-change ${changeClass}">${arrow} ${Math.abs(pct).toFixed(2)}%</div>

      ${stats.series && stats.series.length>1
        ? `<div class="jc-chart" id="jc-chart-${j.id}"></div>`
        : `<div class="jc-empty">No trades yet</div>`}
    </div>`;
  }).join('');

  return `
  <div class="dash-wrap">
    <div class="dash-head">
      <h1>Trading Journal</h1>
    </div>
    <button class="create-trigger" onclick="A.openCreateJournal()">
      <span>＋</span>
    </button>
    ${cards ? `<div class="journal-grid">${cards}</div>` : `<p class="hint">No journals yet — create your first workspace above.</p>`}
    <div style="text-align:center;margin-top:22px;display:flex;gap:8px;justify-content:center;align-items:center;">
      ${STATE.journals.length>1 ? `<button class="icon-btn" title="Export All Journals" style="font-size:18px;width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line-soft);border-radius:var(--radius);" onclick="A.exportAllJournalsAction()">⇧</button>` : ''}
      <button class="icon-btn" title="Import All Journals" style="font-size:18px;width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line-soft);border-radius:var(--radius);" onclick="document.getElementById('dash-import-all-input').click()">⇩</button>
      <input type="file" id="dash-import-all-input" class="hidden-input" accept=".json" onchange="A.handleDashImportAll(this)">
    </div>
  </div>
  ${renderFooter()}
  ${STATE.ui.dashCreating ? renderCreateJournalModal() : ''}
  ${renderThemeSwitcher()}
  `;
}

function renderCreateJournalModal(){
  return '<div class="overlay" onclick="A.closeCreateJournal()">'+
    '<div class="modal" style="max-width:400px;" onclick="event.stopPropagation()">'+
      '<div class="modal-head">'+
        '<h2>New Journal</h2>'+
        '<div style="display:flex;gap:4px;">'+
          '<button class="icon-btn" title="Import Backup" onclick="document.getElementById(\'dash-import-input\').click()">&#8681;</button>'+
          '<button class="icon-btn" onclick="A.closeCreateJournal()">&#10005;</button>'+
        '</div>'+
        '<input type="file" id="dash-import-input" class="hidden-input" accept=".json" onchange="A.handleDashImport(this)">'+
      '</div>'+
      '<div class="field"><label>Journal Name</label>'+
        '<input class="control" id="new-journal-name" placeholder="My Journal" style="font-size:15px;font-weight:700;" autofocus onkeydown="if(event.key===\'Enter\')A.submitCreateJournal()">'+
      '</div>'+
      '<div class="field" style="margin-top:12px;"><label>Initial Account Balance ($)</label>'+
        '<input type="number" step="0.01" min="1" class="control" id="new-initial-balance" value="10000" onkeydown="if(event.key===\'Enter\')A.submitCreateJournal()">'+
      '</div>'+
      '<button class="btn btn-primary btn-block" style="margin-top:18px;" onclick="A.submitCreateJournal()">Create Journal</button>'+
    '</div>'+
  '</div>';
}
function renderThemeSwitcher(){
  const current = getTheme();
  const open = STATE.ui.showThemePopover;
  const opts = THEMES.map(t=>
    '<button class="theme-opt'+(t.id===current?' active':'')+'" onclick="A.selectTheme(\''+t.id+'\')">'+
      '<span class="check">'+(t.id===current?'✓':'')+'</span>'+
      t.icon+' '+esc(t.label)+
    '</button>'
  ).join('');
  return '<button class="theme-fab" onclick="A.toggleThemePopover()" title="Change theme">'+(current==='dark'?'🌙':'☀️')+'</button>'+
    (open ? '<div class="theme-popover" onclick="event.stopPropagation()">'+opts+'</div>' : '');
}

function renderJournalApp(){
  const tabs = ['Journal','Trade History','Checklist'];
  return `
  <header class="top">
    <div class="masthead">
      <p class="eyebrow">${esc(activeJournalName())}</p>
      <h1>TRADING JOURNAL</h1>
    </div>
    <div class="wrap nav-row">
      <div class="tabs">
        ${tabs.map(t=>`<button class="tab-btn ${STATE.activeTab===t?'active':''}" onclick="A.setTab('${t}')">${t}</button>`).join('')}
      </div>
      <button class="switch-journal" title="Home - Switch Journal" onclick="A.exitJournal()">⌂</button>
    </div>
  </header>
  <main class="wrap">
    ${STATE.activeTab==='Journal' ? renderJournalTab() : ''}
    ${STATE.activeTab==='Trade History' ? renderHistoryTab() : ''}
    ${STATE.activeTab==='Checklist' ? renderChecklistTab() : ''}
  </main>
  ${renderFooter()}
  ${STATE.ui.manageModal ? renderManageOptionsModal() : ''}
  ${STATE.ui.viewTradeId ? renderViewTradeModal() : ''}
  ${renderThemeSwitcher()}
  `;
}
