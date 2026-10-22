"use strict";
/* ---------------- toast ---------------- */
function toast(msg){
  try{
    let el = document.getElementById('app-toast');
    if(!el){
      el = document.createElement('div'); el.id='app-toast';
      el.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1c2230;color:#fff;border:1px solid rgba(255,255,255,.18);padding:10px 16px;border-radius:8px;font-size:13px;z-index:99999;box-shadow:0 6px 24px rgba(0,0,0,.4);max-width:90vw;';
      document.body.appendChild(el);
    }
    el.textContent = msg; el.style.display='block';
    clearTimeout(toast._t); toast._t = setTimeout(()=>{ el.style.display='none'; }, 3500);
  }catch(_){}
}

/* ---------------- settings record (schema v2) ----------------
   { id, schema:2, journalSettings:{initialBalance,...}, optionLists:{key:[...]}, archived:{key:[...]} }
   Legacy records stored either journalSettings OR option lists under `options`; both are normalized. */
const DEFAULT_JOURNAL_SETTINGS = { initialBalance:10000, currency:'USD', riskMode:'percent', defaultRisk:2, broker:'' };
function normalizeSettingsRecord(saved){
  const out = { schema:2, journalSettings:{...DEFAULT_JOURNAL_SETTINGS}, optionLists:{}, archived:{} };
  if(!saved) return out;
  const isLists = o => o && typeof o==='object';
  if(saved.schema===2){
    if(isLists(saved.journalSettings)) out.journalSettings = {...DEFAULT_JOURNAL_SETTINGS, ...saved.journalSettings};
    if(isLists(saved.optionLists)) out.optionLists = saved.optionLists;
    if(isLists(saved.archived)) out.archived = saved.archived;
    return out;
  }
  const o = saved.options;
  if(isLists(o)){
    if(o.initialBalance != null) out.journalSettings = {...DEFAULT_JOURNAL_SETTINGS, ...o};
    Object.keys(o).forEach(k=>{ if(Array.isArray(o[k])) out.optionLists[k] = o[k]; });
  }
  return out;
}
function applyOptionLists(lists){
  STATE.options = JSON.parse(JSON.stringify(DEFAULTS));
  if(!STATE.options.killZone) STATE.options.killZone = SESSIONS.slice();
  Object.keys(lists||{}).forEach(k=>{
    if(Array.isArray(lists[k])) STATE.options[k] = lists[k].filter(x=>typeof x==='string');
  });
  KILLZONES = STATE.options.killZone;
  EMOTIONAL_STATES = STATE.options.emotionalState;
  RULE_VIOLATIONS = STATE.options.ruleViolations;
}
async function saveSettingsRecord(journalId){
  journalId = journalId || STATE.activeJournalId;
  if(!journalId) return;
  await db.putSettingsRecord({
    id: journalId, schema:2,
    journalSettings: STATE.journalSettings || {...DEFAULT_JOURNAL_SETTINGS},
    optionLists: STATE.options,
    archived: _archived
  });
}

/* Sanitize a trade coming from a backup file (types + safe links). */
function sanitizeImportedTrade(t){
  const o = {...t, id: t.id || uid()};
  o.pnl = Number(o.pnl)||0;
  if(Array.isArray(o.chartLinks)) o.chartLinks = o.chartLinks.map(safeUrl).filter(Boolean); else o.chartLinks = [];
  if(o.result!=='win' && o.result!=='loss' && o.result!=='be') o.result = resultOf(o);
  o.win = o.result==='win';
  return o;
}

/* ---------------- journal actions ---------------- */
async function createJournal(name, settings){
  const defaultSettings = { initialBalance:10000, currency:'USD', riskMode:'percent', defaultRisk:2, broker:'' };
  const js = settings ? { ...defaultSettings, ...settings } : defaultSettings;
  const newJournal = { id: uid(), name, createdAt: new Date().toISOString(), order: STATE.journals.length };
  await db.addJournal(newJournal);
  await db.putSettingsRecord({ id:newJournal.id, schema:2, journalSettings:js, optionLists:{}, archived:{} });
  // create default trading checklist for new journal
  for(const txt of TRADING_CHECKLIST_TEXTS){
    const item={id:uid(), text:txt, completed:false};
    await db.putChecklistItem(item, newJournal.id);
  }
  STATE.journals.push(newJournal);
  STATE.ui.dashCreating = false;
  await selectJournal(newJournal.id);
}

async function selectJournal(id){
  STATE.loading = true; render();
  STATE.activeJournalId = id;
  STATE.activeTab = 'Journal';
  try{
    const trades = await db.getTradesByJournal(id);
    sortTrades(trades);
    STATE.trades = trades;
    invalidateAnalytics();
    STATE.checklist = await db.getChecklistByJournal(id);
    await ensureDefaultTradingChecklist(id);
    const rec = normalizeSettingsRecord(await db.getSettings(id));
    STATE.journalSettings = rec.journalSettings;
    _archived = rec.archived || {};
    applyOptionLists(rec.optionLists);
  }catch(e){ console.error('load journal error', e); }
  STATE.ui.formExpanded = false;
  STATE.tradeToEdit = null;
  formDraft = freshFormDraft();
  STATE.loading = false;
  render();
}

function exitJournal(){
  STATE.activeJournalId = null;
  STATE.trades = []; STATE.checklist = []; invalidateAnalytics();
  refreshDashboardStats().then(render);
  render();
}

async function renameJournalAction(id, newName){
  const j = STATE.journals.find(j=>j.id===id);
  if(j){ j.name = newName; await db.addJournal(j); }
  STATE.ui.dashEditingId = null;
  render();
}

async function deleteJournalAction(id){
  if(!confirm('Are you sure you want to delete this journal and all its data? This action is irreversible.')) return;
  await db.deleteJournal(id);
  STATE.journals = STATE.journals.filter(j=>j.id!==id);
  delete STATE.journalStats[id];
  STATE.ui.dashMenuId = null;
  if(STATE.activeJournalId === id) STATE.activeJournalId = null;
  render();
}

function downloadJSON(obj, filename){
  const blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportJournalAction(id){
  const meta = STATE.journals.find(j=>j.id===id);
  if(!meta) return;
  const trades = await db.getTradesByJournal(id);
  const checklistItems = await db.getChecklistByJournal(id);
  const settings = await db.getSettings(id);
  downloadJSON({ meta, trades, checklistItems, settings }, `${meta.name.replace(/\s+/g,'_')}_Backup_${new Date().toISOString().split('T')[0]}.json`);
  STATE.ui.dashMenuId = null;
  render();
}

async function exportAllJournalsAction(){
  const all = { journals: [] };
  for(const j of STATE.journals){
    const trades = await db.getTradesByJournal(j.id);
    const checklistItems = await db.getChecklistByJournal(j.id);
    const settings = await db.getSettings(j.id);
    all.journals.push({ meta:j, trades, checklistItems, settings });
  }
  downloadJSON(all, `Full_Trading_Journal_Backup_${new Date().toISOString().split('T')[0]}.json`);
}

function importJournalFromFile(file){
  const reader = new FileReader();
  reader.onload = async (e)=>{
    try{
      const data = JSON.parse(e.target.result);
      if(data.trades || data.meta){
        const newName = data.meta && data.meta.name ? `${data.meta.name} (Imported)` : 'Imported Journal';
        const newId = uid();
        const newJournal = { id:newId, name:newName, createdAt:new Date().toISOString(), order:STATE.journals.length };
        await db.addJournal(newJournal);
        if(Array.isArray(data.trades)) await db.putManyTrades(data.trades.map(sanitizeImportedTrade), newId);
        if(Array.isArray(data.checklistItems)){
          await db.putManyChecklist(data.checklistItems.map(c=>({...c, id: c.id || uid(), completed: !!c.completed})), newId);
        }
        if(data.settings){ const r = normalizeSettingsRecord(data.settings); await db.putSettingsRecord({ id:newId, ...r }); }
        STATE.journals.push(newJournal);
        STATE.ui.dashCreating = false;
        await refreshDashboardStats();
        await selectJournal(newId);
      } else {
        alert('Invalid file format.');
      }
    }catch(err){ console.error(err); alert('Error parsing file.'); }
  };
  reader.readAsText(file);
}

function importAllJournalsFromFile(file){
  const reader = new FileReader();
  reader.onload = async (e)=>{
    try{
      const data = JSON.parse(e.target.result);
      if(data.journals && Array.isArray(data.journals)){
        if(data.journals.length===0){ alert('File contains no journals.'); return; }
        let importedCount = 0;
        for(let idx=0; idx<data.journals.length; idx++){
          const entry = data.journals[idx];
          const metaName = entry.meta && entry.meta.name ? entry.meta.name : `Journal ${idx+1}`;
          let newName = metaName;
          // avoid duplicate names - add (Imported) suffix if needed, with counter
          let suffixCounter = 1;
          const baseName = newName;
          while(STATE.journals.some(j=> j.name===newName)){
            suffixCounter++;
            newName = `${baseName} (Imported${suffixCounter>2?' '+suffixCounter:''})`;
            if(suffixCounter>100) break;
          }
          const newId = uid();
          const newJournal = { id:newId, name:newName, createdAt:new Date().toISOString(), order:STATE.journals.length };
          await db.addJournal(newJournal);
          if(Array.isArray(entry.trades)) await db.putManyTrades(entry.trades.map(sanitizeImportedTrade), newId);
          if(Array.isArray(entry.checklistItems)){
            await db.putManyChecklist(entry.checklistItems.map(c=>({...c, id: c.id || uid(), completed: !!c.completed})), newId);
          }
          // import settings / options if present in backup (legacy or v2 shape)
          const rawSettings = entry.settings || (entry.meta && entry.meta.settings);
          if(rawSettings){
            try{ await db.putSettingsRecord({ id:newId, ...normalizeSettingsRecord(rawSettings) }); }catch(_){}
          }
          STATE.journals.push(newJournal);
          importedCount++;
        }
        STATE.ui.dashCreating = false;
        await refreshDashboardStats();
        render();
        alert(`${importedCount} journal(s) imported successfully.`);
      } else if(data.trades || data.meta){
        // fallback: single journal backup imported via all-import
        importJournalFromFile(file);
      } else {
        alert('Invalid file format. Expected Export All Journals backup.');
      }
    }catch(err){ console.error(err); alert('Error parsing file.'); }
  };
  reader.readAsText(file);
}

/* ---------------- trade actions ---------------- */
/* ISO-8601 timestamps sort correctly as plain strings, so we avoid
   allocating two Date objects per comparison (O(n log n) garbage).
   Falls back to Date parsing only for non-ISO/legacy values.        */
function __tradeTimeKey(t){
  const v = t && t.entryTime;
  if(typeof v === 'string' && v.length >= 10 && v[4] === '-' && v[7] === '-') return v;
  const ms = v ? new Date(v).getTime() : 0;
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString();
}
function sortTrades(arr){
  return arr.sort((a,b)=>{
    const ka = __tradeTimeKey(a), kb = __tradeTimeKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

async function addTradeAction(trade){
  if(!STATE.activeJournalId) return;
  await db.putTrade(trade, STATE.activeJournalId);
  STATE.trades.push(trade);
  invalidateAnalytics();
  sortTrades(STATE.trades);
}

async function updateTradeAction(trade){
  if(!STATE.activeJournalId) return;
  await db.putTrade(trade, STATE.activeJournalId);
  STATE.trades = STATE.trades.map(t=> t.id===trade.id ? trade : t);
  invalidateAnalytics();
  sortTrades(STATE.trades);
}

async function deleteTradeAction(tradeId){
  if(!STATE.activeJournalId) return;
  if(!confirm('Delete this trade? This cannot be undone.')) return;
  await db.deleteTrade(tradeId);
  STATE.trades = STATE.trades.filter(t=>t.id!==tradeId);
  invalidateAnalytics();
  render();
}

function handleEditTrade(tradeId){
  const trade = STATE.trades.find(t=>t.id===tradeId);
  if(trade){
    STATE.tradeToEdit = trade;
    formDraft = withDefaults(trade);
    STATE.ui.formExpanded = true;
    STATE.activeTab = 'Journal';
    render();
    window.scrollTo({top:0, behavior:'smooth'});
  }
}

function cancelEditTrade(){
  STATE.tradeToEdit = null;
  formDraft = freshFormDraft();
  STATE.ui.formExpanded = false;
  render();
}

async function submitTrade(){
  var missing = [];
  if(!formDraft.symbol) missing.push('Symbol');
  if(!formDraft.entryTime) missing.push('Entry Time');
  if(!formDraft.closeTime) missing.push('Close Time');
  if(missing.length){ toast('Please fill in: '+missing.join(', ')); return; }
  if(new Date(formDraft.closeTime) < new Date(formDraft.entryTime)){ toast('Exit time is before entry time.'); return; }
  if(!(Number(formDraft.riskDollar) > 0) && !confirm('Risk ($) is 0. Save anyway? (R and risk% will be 0)')) return;
  formDraft.confidenceScore = Math.min(10, Math.max(1, formDraft.confidenceScore || 1));
  formDraft.disciplineScore = Math.min(100, Math.max(0, formDraft.disciplineScore || 0));
  formDraft.holdingTime = computeHoldingMinutes(formDraft.entryTime, formDraft.closeTime);
  const currentBal = calculatedLastBalance();
  formDraft.riskPercent = currentBal>0 ? ((formDraft.riskDollar||0)/currentBal)*100 : 0;
  /* map reward -> rr for analytics backward compat */
  if(!formDraft.rManual && formDraft.riskDollar>0) formDraft.reward = Math.round((formDraft.pnl/formDraft.riskDollar)*100)/100;
  formDraft.rr = Number(formDraft.reward) || 0;
  formDraft.maxR = Number(formDraft.reward) || 0;
  formDraft.result = formDraft.resultMode==='auto' ? autoResult(formDraft.pnl, formDraft.riskDollar) : formDraft.resultMode;
  formDraft.chartLinks = (formDraft.chartLinks||[]).map(safeUrl).filter(Boolean);
  if(STATE.tradeToEdit){
    formDraft.startBalance = STATE.tradeToEdit.startBalance || currentBal;
    const updated = { ...formDraft, id: STATE.tradeToEdit.id, win: formDraft.result==='win' };
    await updateTradeAction(updated);
    STATE.tradeToEdit = null;
    STATE.activeTab = 'Trade History';
    formDraft = freshFormDraft();
    STATE.ui.formExpanded = false;
  } else {
    formDraft.startBalance = currentBal;
    const newTrade = { ...formDraft, id: uid(), win: formDraft.result==='win' };
    await addTradeAction(newTrade);
    const keptSymbol = formDraft.symbol;
    formDraft = freshFormDraft(keptSymbol);
    STATE.ui.formExpanded = false;
  }
  render();
}

/* ---------------- checklist actions ---------------- */
async function addChecklistItemAction(text){
  if(!STATE.activeJournalId || !text.trim()) return;
  const item = { id: uid(), text: text.trim(), completed:false };
  await db.putChecklistItem(item, STATE.activeJournalId);
  STATE.checklist.push(item);
  render();
}

async function deleteChecklistItemAction(id){
  if(!STATE.activeJournalId) return;
  await db.deleteChecklistItem(id);
  STATE.checklist = STATE.checklist.filter(i=>i.id!==id);
  render();
}

async function toggleChecklistItemAction(id){
  if(!STATE.activeJournalId) return;
  let updated;
  STATE.checklist = STATE.checklist.map(i=>{
    if(i.id===id){ updated = {...i, completed:!i.completed}; return updated; }
    return i;
  });
  render();
  if(updated) await db.putChecklistItem(updated, STATE.activeJournalId);
}

/* ---------------- in-journal backup ---------------- */
function handleExportBackup(){
  downloadJSON({ trades: STATE.trades, checklistItems: STATE.checklist },
    `trading-journal-backup-${new Date().toISOString().split('T')[0]}.json`);
}

function handleImportBackup(file){
  const reader = new FileReader();
  reader.onload = async (e)=>{
    try{
      const data = JSON.parse(e.target.result);
      if(!(data.trades || data.checklistItems)){ alert('Invalid file format.'); return; }
      if(!STATE.activeJournalId) return;
      STATE.loading = true; render();
      await db.clearJournalData(STATE.activeJournalId);
      if(Array.isArray(data.trades)){
        const clean = data.trades.map(sanitizeImportedTrade);
        await db.putManyTrades(clean, STATE.activeJournalId);
        STATE.trades = sortTrades(clean.slice());
        invalidateAnalytics();
      }
      if(Array.isArray(data.checklistItems)){
        const sanitized = data.checklistItems.map(c=>({...c, id: c.id || uid(), completed: !!c.completed}));
        await db.putManyChecklist(sanitized, STATE.activeJournalId);
        STATE.checklist = sanitized;
      }
      STATE.loading = false;
      render();
    }catch(err){ console.error(err); alert('Error parsing file.'); STATE.loading=false; render(); }
  };
  reader.readAsText(file);
}

/* ---------------- manageable options ---------------- */
var _archived = {};

/* Maps options key → trade field name for usage checking */
var OPTION_TRADE_FIELD = {
  symbols:'symbol', timePDA:'timePDA', sdpTime:'sdpTime',
  confirmationTime:'confirmationTime', entryType:'entryType',
  emotionalState:'emotionalState', psychology:'psychology',
  ruleViolations:'ruleViolations', dealingRange:'dealingRange',
  entrySetup:'entrySetup', killZone:'killZone'
};

/* Rename (newVal string) or remove (newVal null) an option value in every trade and persist to DB. */
async function remapTradeOption(key, oldVal, newVal){
  const f = OPTION_TRADE_FIELD[key];
  if(!f || !STATE.activeJournalId) return 0;
  const changed = [];
  STATE.trades.forEach(function(t){
    if(Array.isArray(t[f])){
      if(!t[f].includes(oldVal)) return;
      let arr = t[f].map(v=> v===oldVal ? newVal : v).filter(v=> v!==null);
      t[f] = arr.filter((v,i)=> arr.indexOf(v)===i);
      changed.push(t);
    } else if(t[f] === oldVal){
      if(newVal===null) return;
      t[f] = newVal; changed.push(t);
    }
  });
  if(changed.length){ await db.putManyTrades(changed, STATE.activeJournalId); invalidateAnalytics(); }
  return changed.length;
}

function isOptionUsedByTrades(key, value){
  var f = OPTION_TRADE_FIELD[key];
  if(!f) return false;
  return STATE.trades.some(function(t){
    if(Array.isArray(t[f])) return t[f].includes(value);
    return t[f] === value;
  });
}

async function persistOptions(){
  if(!STATE.activeJournalId) return;
  KILLZONES = STATE.options.killZone || KILLZONES;
  EMOTIONAL_STATES = STATE.options.emotionalState || EMOTIONAL_STATES;
  RULE_VIOLATIONS = STATE.options.ruleViolations || RULE_VIOLATIONS;
  if(!STATE.options.killZone) STATE.options.killZone = KILLZONES.slice();
  if(!STATE.options.emotionalState) STATE.options.emotionalState = EMOTIONAL_STATES.slice();
  if(!STATE.options.ruleViolations) STATE.options.ruleViolations = RULE_VIOLATIONS.slice();
  await saveSettingsRecord();
}
function addOptionItem(key, value){
  value = (value||'').trim();
  if(!value) return;
  const list = STATE.options[key];
  if(list.find(o=>o.toLowerCase()===value.toLowerCase())) return;
  list.push(value);
  persistOptions();
  render();
}
function deleteOptionItem(key, value){
  STATE.options[key] = STATE.options[key].filter(o=>o!==value);
  persistOptions();
  render();
}
