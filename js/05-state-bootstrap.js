"use strict";
/* ---------------- global state ---------------- */
const initialFilters = {
  dateFrom:'', dateTo:'', symbol:'all', result:'all', killZone:'all', entryType:'all', day:'all',
  smt:'all', threePdaFail:'all', ote:'all', psychology:'all', timePDA:'all',
  sdpTime:'all', confirmationTime:'all',
  checklist:'all', emotionalState:'all', ruleViolations:'all',
  dealingRange:'all', entrySetup:'all'
};

const STATE = {
  loading: true,
  journals: [],
  journalStats: {},
  activeJournalId: null,
  activeTab: 'Journal',
  trades: [],
  checklist: [],
  options: JSON.parse(JSON.stringify(DEFAULTS)),
  journalSettings: null,
  tradeToEdit: null,
  ui: {
    dashCreating:false,
    dashEditingId:null,
    dashEditingName:'',
    dashMenuId:null,
    formExpanded:false,
    formCompressing:false,
    manageModal:null,
    viewTradeId:null,
    showThemePopover:false,
    showFilters:false,
    filters: {...initialFilters},
    calMonth: new Date(),
    sumYear: new Date().getFullYear(),
    openMsel:null,
    sessionSort: { key:'order', dir:'asc' },
    daySort: { key:'order', dir:'asc' },
    hourSort: { key:'order', dir:'asc' },
    instrumentSort: { key:'pnl', dir:'desc' },
    emotionSort: { key:'trades', dir:'desc' },
    /* Strategy Analytics — one sort state per SETUP table, default to the
       most profitable first (matches how the arrays are pre-sorted) */
    sdpTimeSort: { key:'pnl', dir:'desc' },
    dealingRangeSort: { key:'pnl', dir:'desc' },
    entrySetupSort: { key:'pnl', dir:'desc' },
    entryTypeSort: { key:'pnl', dir:'desc' },
    confirmationTimeSort: { key:'pnl', dir:'desc' },
    violationSort: { key:'occurrences', dir:'desc' },
    mistakeSort: { key:'totalLoss', dir:'desc' },
    accState: { 'chart-main':[0], 'chart-filtered':[0] },
    checklistEditingId:null,
    checklistEditingText:''
  }
};

function activeJournalName(){
  const j = STATE.journals.find(j=>j.id===STATE.activeJournalId);
  return j ? j.name : null;
}

function calculatedLastBalance(){
  if(STATE.trades.length>0){
    const last = STATE.trades[STATE.trades.length-1];
    return last.startBalance + last.pnl;
  }
  return (STATE.journalSettings && STATE.journalSettings.initialBalance) ? STATE.journalSettings.initialBalance : 10000;
}

function freshFormDraft(keepSymbol){
  return {
    symbol: keepSymbol || '',
    position: POSITIONS[0],
    entryTime:'', closeTime:'',
    entryPrice:0, stopLoss:0, takeProfit:0,
    riskDollar:0,
    pnl:0, reward:0, resultMode:'auto', rManual:false, dayManual:false, sessionManual:false,
    day: DAYS[0], killZone: KILLZONES[0],
    timePDA: [], sdpTime: [],
    confirmationTime: STATE.options.confirmationTime[1] || STATE.options.confirmationTime[0] || '',
    entryType: STATE.options.entryType[0] || '',
    smt:false, threePdaFail:false, ote:false,
    emotionalState: STATE.options.emotionalState[0],
    confidenceScore:5, disciplineScore:50,
    checklistCompleted:false, ruleViolations:[],
    psychology:[], note:'', chartLinks:[],
    dealingRange: [], entrySetup: [],
    holdingTime:0, startBalance:0
  };
}

/* Merge a saved trade over fresh defaults so older trades that predate
   newer fields always have safe fallback values (no undefined access). */
function withDefaults(trade){
  const d = { ...freshFormDraft(trade.symbol), ...trade };
  /* editing an existing trade: keep its saved values; don't overwrite them automatically */
  if(trade.resultMode==null) d.resultMode = (trade.result==='win'||trade.result==='loss'||trade.result==='be') ? trade.result : 'auto';
  d.rManual = true; d.dayManual = true; d.sessionManual = true;
  return d;
}

/* Holding time in whole minutes, derived from Entry Time / Close Time. */
function computeHoldingMinutes(entryTime, closeTime){
  if(!entryTime || !closeTime) return 0;
  const ms = new Date(closeTime) - new Date(entryTime);
  if(!isFinite(ms) || ms<=0) return 0;
  return Math.round(ms/60000);
}

function formatHoldingTime(mins){
  if(!mins || mins<=0) return '—';
  const h = Math.floor(mins/60), m = mins%60;
  return h>0 ? `${h}h ${m}m` : `${m}m`;
}

let formDraft = freshFormDraft();

/* ---------------- bootstrap ---------------- */
async function init(){
  STATE.loading = true; render();
  try{
    const journals = await db.getAllJournals();
    STATE.journals = journals.sort((a,b)=>(a.order||0)-(b.order||0));
    await refreshDashboardStats();
  }catch(e){ console.error('DB init error', e); }
  STATE.loading = false;
  render();
}

async function refreshDashboardStats(){
  const stats = {};
  for(const j of STATE.journals){
    try{
      const trades = await db.getTradesByJournal(j.id);
      sortTrades(trades);
      const pnl = trades.reduce((acc,t)=>acc+t.pnl,0);
      const startBalance = trades.length>0 ? trades[0].startBalance : 0;
      let series = [];
      if(trades.length>0){
        let bal = startBalance;
        series.push(bal);
        trades.forEach(t=>{ bal += t.pnl; series.push(bal); });
      }
      stats[j.id] = { pnl, tradeCount: trades.length, startBalance, series };
    }catch(e){ stats[j.id] = { pnl:0, tradeCount:0, startBalance:0, series:[] }; }
  }
  STATE.journalStats = stats;
}

/* ---------------- trading checklist helpers ---------------- */
async function ensureDefaultTradingChecklist(journalId){
  if(!journalId) return;
  // If empty, create full default
  if(STATE.checklist.length===0){
    const newItems=[];
    for(const txt of TRADING_CHECKLIST_TEXTS){
      const item={id:uid(), text:txt, completed:false};
      await db.putChecklistItem(item, journalId);
      newItems.push(item);
    }
    STATE.checklist=newItems;
    return;
  }
  // Check migration: if checklist doesn't match trading checklist structure, migrate
  const existingTexts = new Set(STATE.checklist.map(i=>i.text));
  const matching = TRADING_CHECKLIST_TEXTS.filter(t=>existingTexts.has(t)).length;
  if(matching < 5){
    // Preserve completed for matching items, rebuild to default structure
    const oldMap = new Map(STATE.checklist.map(i=>[i.text, !!i.completed]));
    // delete old non-matching items from DB
    for(const old of STATE.checklist){
      if(!TRADING_CHECKLIST_TEXTS.includes(old.text)){
        try{ await db.deleteChecklistItem(old.id); }catch(_){}
      }
    }
    const newItems=[];
    for(const txt of TRADING_CHECKLIST_TEXTS){
      if(!existingTexts.has(txt)){
        const item={id:uid(), text:txt, completed:!!oldMap.get(txt)};
        await db.putChecklistItem(item, journalId);
        newItems.push(item);
      }
    }
    // reload checklist = existing matching + new
    const kept = STATE.checklist.filter(i=>TRADING_CHECKLIST_TEXTS.includes(i.text));
    STATE.checklist=[...kept, ...newItems];
  }
  // Ensure order matches TRADING_CHECKLIST_TEXTS
  const orderMap = new Map(TRADING_CHECKLIST_TEXTS.map((t,idx)=>[t, idx]));
  STATE.checklist.sort((a,b)=>(orderMap.get(a.text)||0)-(orderMap.get(b.text)||0));
  // Remove extras beyond default
  if(STATE.checklist.length>TRADING_CHECKLIST_TEXTS.length){
    const extras = STATE.checklist.filter(i=>!TRADING_CHECKLIST_TEXTS.includes(i.text));
    for(const ex of extras){
      try{ await db.deleteChecklistItem(ex.id); }catch(_){}
    }
    STATE.checklist=STATE.checklist.filter(i=>TRADING_CHECKLIST_TEXTS.includes(i.text));
  }
}

async function resetTradingChecklist(){
  if(!STATE.activeJournalId) return;
  for(const item of STATE.checklist){
    if(item.completed){
      const upd={...item, completed:false};
      await db.putChecklistItem(upd, STATE.activeJournalId);
    }
  }
  STATE.checklist=STATE.checklist.map(i=>({...i, completed:false}));
  render();
}

function startEditChecklistItem(id, text){
  STATE.ui.checklistEditingId = id;
  STATE.ui.checklistEditingText = text;
  render();
  setTimeout(()=>{
    const el=document.getElementById('checklist-edit-'+id);
    if(el){ el.focus(); el.select(); }
  },0);
}
function cancelEditChecklistItem(){
  STATE.ui.checklistEditingId = null;
  STATE.ui.checklistEditingText = '';
  render();
}
async function saveEditChecklistItem(id){
  const newText = (STATE.ui.checklistEditingText||'').trim();
  if(!newText){ cancelEditChecklistItem(); return; }
  const idx = STATE.checklist.findIndex(i=>i.id===id);
  if(idx>=0){
    const updated={...STATE.checklist[idx], text:newText};
    STATE.checklist[idx]=updated;
    if(STATE.activeJournalId) await db.putChecklistItem(updated, STATE.activeJournalId);
  }
  STATE.ui.checklistEditingId=null;
  STATE.ui.checklistEditingText='';
  render();
}
async function updateChecklistEditingText(v){
  STATE.ui.checklistEditingText=v;
}
