"use strict";
/* ── Theme Engine ────────────────────────────────────────── */
const THEMES = [
  { id:'dark',  label:'Dark',  icon:'🌙' },
  { id:'light', label:'Light', icon:'☀️' },
  { id:'retro', label:'Retro', icon:'💾' }
];

function getTheme(){
  const saved = localStorage.getItem('ledger-theme');
  /* fall back to dark if the stored theme no longer exists
     (e.g. someone was on a theme that has since been removed) */
  return THEMES.some(t=>t.id===saved) ? saved : 'dark';
}
function setTheme(id){
  localStorage.setItem('ledger-theme', id);
  document.documentElement.setAttribute('data-theme', id);
  /* smooth transition */
  document.body.classList.add('theme-transitioning');
  setTimeout(()=>{ document.body.classList.remove('theme-transitioning'); render(); }, 380);
}
function initTheme(){
  const t = getTheme();
  document.documentElement.setAttribute('data-theme', t);
}

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,9); }
/* Number.prototype.toLocaleString builds a fresh Intl formatter on every
   call, which measured ~16µs each — by far the most expensive helper in
   the app and it runs on every money cell of every table. Reusing one
   cached Intl.NumberFormat gives byte-identical output ~50x faster. */
const __MONEY_FMT = (typeof Intl !== 'undefined' && Intl.NumberFormat)
  ? new Intl.NumberFormat(undefined, { minimumFractionDigits:2, maximumFractionDigits:2 })
  : null;
function fmtMoney(n){
  const v = Number(n)||0;
  const abs = Math.abs(v);
  const body = __MONEY_FMT
    ? __MONEY_FMT.format(abs)
    : abs.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  return (v<0?'-':'') + '$' + body;
}
function fmtMoneySigned(n){ const v = Number(n)||0; return v>0 ? '+'+fmtMoney(v) : fmtMoney(v); }
function fmtMoneyShort(n){ const v=Number(n)||0; const a=Math.abs(v); const s=a>=1000? (a/1000).toFixed(1)+'k' : a.toFixed(0); return (v<0?'-$':'$')+s; }
function fmtPct(n,digits=1){ const v=Number(n)||0; return (v>=0?'+':'') + v.toFixed(digits) + '%'; }
/* month-name table hoisted: fmtDate is called once per table row, and the
   old version rebuilt this 12-element array on every single call */
const __MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
/* Trade rows re-format the same timestamps on every render, and parsing a
   Date is the expensive part. A small memo keyed on the raw string turns
   repeat formatting into a map lookup; it is bounded so a huge journal
   cannot grow it without limit. */
const __DATE_CACHE = new Map();
function fmtDate(iso){
  if(!iso) return '-';
  const hit = __DATE_CACHE.get(iso);
  if(hit !== undefined) return hit;
  const d = new Date(iso);
  const out = __MONTH_ABBR[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();
  if(__DATE_CACHE.size > 4000) __DATE_CACHE.clear();
  __DATE_CACHE.set(iso, out);
  return out;
}
function fmtDateTime(iso){ if(!iso) return '-'; const d=new Date(iso); const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'), h=String(d.getHours()).padStart(2,'0'), min=String(d.getMinutes()).padStart(2,'0'), s=String(d.getSeconds()).padStart(2,'0'); return y+'-'+m+'-'+day+' '+h+':'+min+':'+s; }
function fmtTime(iso){ if(!iso) return '-'; const d=new Date(iso); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function isoToDatePart(iso){ if(!iso) return ''; return iso.substring(0,10); }
function isoToTimePart(iso){ if(!iso) return ''; const d=new Date(iso); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
/* esc() runs hundreds of times per render. The lookup table and regex are
   hoisted to module scope so we stop allocating a fresh object literal on
   every single escaped character, and the common "nothing to escape" case
   returns the string untouched. */
const __ESC_MAP = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
const __ESC_RE = /[&<>"']/g;
function esc(s){
  const str = s == null ? '' : String(s);
  __ESC_RE.lastIndex = 0;
  return __ESC_RE.test(str) ? str.replace(__ESC_RE, c => __ESC_MAP[c]) : str;
}

/* Only http/https links are ever rendered as hrefs (blocks javascript:/data: XSS). */
function safeUrl(u){
  try{
    const x = new URL(String(u==null?'':u).trim());
    return (x.protocol==='http:' || x.protocol==='https:') ? x.href : '';
  }catch(_){ return ''; }
}

/* Trade outcome: 'win' | 'loss' | 'be'. Older trades (no .result) are derived from P&L. */
function resultOf(t){
  if(t && (t.result==='win' || t.result==='loss' || t.result==='be')) return t.result;
  const p = Number(t && t.pnl) || 0;
  return p>0 ? 'win' : (p<0 ? 'loss' : 'be');
}
/* Break-even band: |P&L| <= BE_RISK_FRACTION * risk$ counts as BE in Auto mode. */
const BE_RISK_FRACTION = 0.05;
function autoResult(pnl, riskDollar){
  pnl = Number(pnl)||0; riskDollar = Number(riskDollar)||0;
  const band = riskDollar>0 ? riskDollar*BE_RISK_FRACTION : 0;
  if(Math.abs(pnl) <= band) return 'be';
  return pnl>0 ? 'win' : 'loss';
}
/* Session by hour of the typed Entry time. EDIT THESE to match your clock/timezone. */
const SESSION_RANGES = [
  { name:'Asia',     from:0,  to:7  },
  { name:'London',   from:7,  to:12 },
  { name:'New York', from:12, to:20 }
];
function sessionForHour(h){
  for(const r of SESSION_RANGES){ if(h>=r.from && h<r.to) return r.name; }
  return 'Out of Session';
}
function dayNameFromISO(iso){
  if(!iso) return null;
  const d = new Date(iso); if(isNaN(d)) return null;
  const n = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
  return DAYS.includes(n) ? n : null;
}
