"use strict";
/* ---- accordion helper ---- */
function accSection(chartId, num, icon, title, bodyHTML){
  const openSections = STATE.ui.accState[chartId] || [0];
  const isOpen = openSections.includes(num);
  const escId = esc(chartId);
  return '<div class="acc-section'+(isOpen?' open':'')+'" data-acc="'+num+'" data-panel="'+escId+'" role="region" aria-labelledby="acc-hdr-'+escId+'-'+num+'">'+
    '<button class="acc-header" id="acc-hdr-'+escId+'-'+num+'" onclick="A.toggleAccordion(\''+escId+'\','+num+')" aria-expanded="'+(isOpen?'true':'false')+'">'+
      (icon ? '<span class="acc-icon">'+icon+'</span>' : '')+
      '<span class="acc-label">'+title+'</span>'+
      '<span class="acc-arrow" aria-hidden="true">&#9660;</span>'+
    '</button>'+
    '<div class="acc-body"><div class="acc-body-inner">'+bodyHTML+'</div></div>'+
    '</div>';
}

/* ---------------- ⑦ Instrument Analytics table ---------------- */
/* ---------------- ④ Strategy Analytics ----------------
   One table per field in the log form's SETUP section. They all share the
   same metric columns so the numbers are directly comparable when you read
   down the section; only the first column's heading changes.            */
const setupColumns = (firstLabel)=>([
  { key:'label', label:firstLabel, align:'left' },
  { key:'trades', label:'Trades', align:'right' },
  { key:'winRate', label:'Win Rate', align:'right' },
  { key:'profitFactor', label:'Profit Factor', align:'right' },
  { key:'avgR', label:'Average R', align:'right' },
  { key:'expectancy', label:'Expectancy', align:'right' },
  { key:'pnl', label:'Total Profit', align:'right' }
]);

const STRATEGY_TABLES = [
  { title:'Strategy',               statsKey:'sdpTimeStats',          sortName:'sdpTime',
    bestKey:'bestSdpTime',          worstKey:'worstSdpTime',          multi:true,
    empty:'No strategy data yet — tag trades with a Strategy in the log form.' },
  { title:'Dealing Range',          statsKey:'dealingRangeStats',     sortName:'dealingRange',
    bestKey:'bestDealingRange',     worstKey:'worstDealingRange',     multi:true,
    empty:'No dealing range data yet.' },
  { title:'Confirmation',           statsKey:'entryTypeStats',        sortName:'entryType',
    bestKey:'bestEntryType',        worstKey:'worstEntryType',        multi:false,
    empty:'No confirmation data yet.' },
  { title:'Confirmation Timeframe', statsKey:'confirmationTimeStats', sortName:'confirmationTime',
    bestKey:'bestConfirmationTime', worstKey:'worstConfirmationTime', multi:false,
    empty:'No confirmation timeframe data yet.' },
  { title:'Entry',                  statsKey:'entrySetupStats',       sortName:'entrySetup',
    bestKey:'bestEntrySetup',       worstKey:'worstEntrySetup',       multi:true,
    empty:'No entry data yet.' }
];

/* Shared wrapper for "several tables stacked inside one accordion".
   Keeps the caption styling and the spacing rhythm in a single place. */
function subTable(title, tableHTML, note){
  return '<div class="setup-block">'+
    '<div class="setup-head"><h3>'+esc(title)+'</h3>'+
      (note ? '<span class="setup-note">'+note+'</span>' : '')+
    '</div>'+
    tableHTML+
  '</div>';
}

function renderStrategyAnalytics(a){
  const anyData = STRATEGY_TABLES.some(t=>(a[t.statsKey]||[]).length > 0);
  if(!anyData){
    return '<div class="empty">No setup data to analyze yet. Log a trade and fill in the SETUP fields.</div>';
  }
  return STRATEGY_TABLES.map(t=>{
    const stats = a[t.statsKey] || [];
    /* a multi-select field can tag one trade several times, so the rows may
       add up to more than the total trade count — say so rather than let it
       look like a bug */
    const note = t.multi && stats.length > 1
      ? 'multi-select &middot; a trade can appear in more than one row'
      : '';
    return subTable(t.title,
      renderGroupTable(stats, setupColumns(t.title), STATE.ui[t.sortName+'Sort'],
                       t.sortName, a[t.bestKey], a[t.worstKey], t.empty),
      note);
  }).join('');
}

const INSTRUMENT_COLUMNS = [
  { key:'label', label:'Symbol', align:'left' },
  { key:'trades', label:'Trades', align:'right' },
  { key:'winRate', label:'Win Rate', align:'right' },
  { key:'profitFactor', label:'Profit Factor', align:'right' },
  { key:'avgR', label:'Average R', align:'right' },
  { key:'pnl', label:'Total Profit', align:'right' }
];

function renderInstrumentTable(symbolStats, bestSymbol, worstSymbol){
  if(!symbolStats || symbolStats.length===0) return '<div class="empty">No symbol data to analyze.</div>';
  const sorted = sortGroupStats(symbolStats, STATE.ui.instrumentSort);
  const sk = STATE.ui.instrumentSort;
  const headCells = INSTRUMENT_COLUMNS.map(col=>{
    const a = sk.key===col.key, arrow = a ? (sk.dir==='asc'?' &#9650;':' &#9660;') : '';
    return '<th style="text-align:'+col.align+'" onclick="A.setGroupSort(\'instrument\',\''+col.key+'\')">'+esc(col.label)+helpIconFor(col.label)+arrow+'</th>';
  }).join('');
  const rows = sorted.map(s=>{
    const rc = s.key===bestSymbol?'best-row':'';
    const bdg = s.key===bestSymbol?'<span class="badge best">BEST</span>':'';
    return '<tr class="'+rc+'">'+INSTRUMENT_COLUMNS.map((col,idx)=>'<td data-label="'+esc(col.label)+'" style="text-align:'+col.align+';">'+(idx===0?'<div class="setup-name">'+esc(s.label)+bdg+'</div>':formatGroupCell(col.key,s))+'</td>').join('')+'</tr>';
  }).join('');
  return '<div class="strategy-wrap"><table class="strategy-table zebra stacked-mobile"><thead><tr>'+headCells+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}

/* ---------------- ⑧ Psychology Analytics rendering ---------------- */
const EMOTION_COLUMNS = [
  { key:'label', label:'Emotion', align:'left' },
  { key:'trades', label:'Trades', align:'right' },
  { key:'winRate', label:'Win Rate', align:'right' },
  { key:'avgR', label:'Average R', align:'right' },
  { key:'pnl', label:'Profit', align:'right' }
];

function renderEmotionTable(emotionStats){
  if(!emotionStats || emotionStats.length===0) return '<div class="empty">No emotional state data.</div>';
  const sorted = sortGroupStats(emotionStats, STATE.ui.emotionSort);
  const sk = STATE.ui.emotionSort;
  const headCells = EMOTION_COLUMNS.map(col=>{
    const a = sk.key===col.key, arrow = a ? (sk.dir==='asc'?' &#9650;':' &#9660;') : '';
    return '<th style="text-align:'+col.align+'" onclick="A.setGroupSort(\'emotion\',\''+col.key+'\')">'+esc(col.label)+helpIconFor(col.label)+arrow+'</th>';
  }).join('');
  const rows = sorted.map(s=>'<tr>'+EMOTION_COLUMNS.map((col,idx)=>'<td data-label="'+esc(col.label)+'" style="text-align:'+col.align+';">'+(idx===0?'<div class="setup-name">'+esc(s.label)+'</div>':formatGroupCell(col.key,s))+'</td>').join('')+'</tr>').join('');
  return '<div class="strategy-wrap"><table class="strategy-table zebra stacked-mobile"><thead><tr>'+headCells+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}

const MISTAKE_COLUMNS = [
  { key:'mistake', label:'Mistake', align:'left' },
  { key:'count', label:'Count', align:'right' },
  { key:'winRate', label:'Win Rate', align:'right' },
  { key:'totalLoss', label:'Total Loss', align:'right' },
  { key:'avgLoss', label:'Avg Loss', align:'right' }
];

function fmtMistakeCell(key, s){
  if(key==='count') return ''+s.count;
  if(key==='winRate') return '<span class="'+(s.winRate>=50?'pnl-pos':'')+'">'+s.winRate.toFixed(1)+'%</span>';
  if(key==='totalLoss') return '<span class="pnl-neg">'+fmtMoney(-Math.abs(s.totalLoss))+'</span>';
  if(key==='avgLoss') return '<span class="pnl-neg">'+fmtMoney(-Math.abs(s.avgLoss))+'</span>';
  return esc(String(s[key]??'-'));
}

function renderMistakeTable(mistakeStats){
  if(!mistakeStats || mistakeStats.length===0) return '<div class="empty">No mistake data.</div>';
  const sorted = sortGroupStats(mistakeStats, STATE.ui.mistakeSort);
  const sk = STATE.ui.mistakeSort;
  const headCells = MISTAKE_COLUMNS.map(col=>{
    const a = sk.key===col.key, arrow = a ? (sk.dir==='asc'?' &#9650;':' &#9660;') : '';
    return '<th style="text-align:'+col.align+'" onclick="A.setGroupSort(\'mistake\',\''+col.key+'\')">'+esc(col.label)+helpIconFor(col.label)+arrow+'</th>';
  }).join('');
  const rows = sorted.map(s=>'<tr>'+MISTAKE_COLUMNS.map((col,idx)=>'<td data-label="'+esc(col.label)+'" style="text-align:'+col.align+';">'+(idx===0?'<div class="setup-name">'+esc(s.mistake)+'</div>':fmtMistakeCell(col.key,s))+'</td>').join('')+'</tr>').join('');
  return '<div class="strategy-wrap"><table class="strategy-table zebra stacked-mobile"><thead><tr>'+headCells+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}

const VIOLATION_COLUMNS = [
  { key:'violation', label:'Violation', align:'left' },
  { key:'occurrences', label:'Occurrences', align:'right' },
  { key:'avgLoss', label:'Avg Loss', align:'right' },
  { key:'avgR', label:'Avg R', align:'right' },
  { key:'winRate', label:'Win Rate', align:'right' }
];

function fmtViolationCell(key, s){
  if(key==='occurrences') return ''+s.occurrences;
  if(key==='winRate') return '<span class="'+(s.winRate>=50?'pnl-pos':'')+'">'+s.winRate.toFixed(1)+'%</span>';
  if(key==='avgR') return '<span class="'+(s.avgR>=0?'pnl-pos':'pnl-neg')+'">'+s.avgR.toFixed(2)+'R</span>';
  if(key==='avgLoss') return '<span class="pnl-neg">'+fmtMoney(-Math.abs(s.avgLoss))+'</span>';
  return esc(String(s[key]??'-'));
}

function renderViolationTable(violationStats){
  if(!violationStats || violationStats.length===0) return '<div class="empty">No rule violation data.</div>';
  const sorted = sortGroupStats(violationStats, STATE.ui.violationSort);
  const sk = STATE.ui.violationSort;
  const headCells = VIOLATION_COLUMNS.map(col=>{
    const a = sk.key===col.key, arrow = a ? (sk.dir==='asc'?' &#9650;':' &#9660;') : '';
    return '<th style="text-align:'+col.align+'" onclick="A.setGroupSort(\'violation\',\''+col.key+'\')">'+esc(col.label)+helpIconFor(col.label)+arrow+'</th>';
  }).join('');
  const rows = sorted.map(s=>'<tr>'+VIOLATION_COLUMNS.map((col,idx)=>'<td data-label="'+esc(col.label)+'" style="text-align:'+col.align+';">'+(idx===0?'<div class="setup-name">'+esc(s.violation)+'</div>':fmtViolationCell(col.key,s))+'</td>').join('')+'</tr>').join('');
  return '<div class="strategy-wrap"><table class="strategy-table zebra stacked-mobile"><thead><tr>'+headCells+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}

/* ---------------- ⑨ Distribution — Drawdown Curve ---------------- */

/* ---------------- analytics panel ---------------- */
const HELP_ICON='<span class="help-icon" aria-hidden="true"></span>';

const HELP_TEXT={
  'Total Profit':'سود یا زیان خالصی که از تمام معاملات ثبت‌شده به دست آورده‌اید.',
  'Win Rate':'درصد معاملاتی که با سود بسته شده‌اند.\nهرچه این عدد بیشتر باشد، تعداد معاملات موفق شما بیشتر بوده است.',
  'Profit Factor':'نسبت مجموع سود معاملات برنده به مجموع ضرر معاملات بازنده.\nعدد بالاتر از ۱ یعنی سیستم شما سودده است و هرچه بزرگ‌تر باشد، عملکرد بهتر است.',
  'Expectancy':'میانگین سود یا زیان مورد انتظار از هر معامله.\nاین معیار نشان می‌دهد اگر همین سبک را ادامه دهید، به طور متوسط از هر معامله چه نتیجه‌ای خواهید گرفت.',
  'Avg R-Multiple':'میانگین مقدار R کسب‌شده در هر معامله.\nاین معیار نشان می‌دهد معاملات شما به طور متوسط چند برابر ریسک اولیه نتیجه داده‌اند.',
  'Total Trades':'تعداد کل معاملاتی که در این ژورنال ثبت شده‌اند.',
  'Average Winner':'میانگین سود معاملات برنده.',
  'Average Loser':'میانگین ضرر معاملات بازنده.',

  /* ── Risk Metrics ── */
  'Max Drawdown':'بیشترین افتی که حساب شما از بالاترین نقطه‌اش تجربه کرده، به دلار.\nیعنی در بدترین دوره، چقدر از سرمایه‌تان را از دست دادید تا دوباره رشد کند.\nهرچه این عدد کمتر باشد، افت حساب شما کنترل‌شده‌تر بوده است.',
  'Relative Drawdown':'همان بیشترین افت حساب، اما به صورت درصد.\nمثلاً ۲۰٪ یعنی حساب از سقف خودش تا ۲۰٪ پایین آمده است.\nچون درصدی است، مقایسه آن بین حساب‌های کوچک و بزرگ منصفانه‌تر است.',
  'Drawdown Duration':'طولانی‌ترین مدتی که حساب شما زیر سقف قبلی‌اش مانده، بر حسب روز.\nنشان می‌دهد چند روز طول کشیده تا ضررها جبران شود و به اوج قبلی برگردید.\nعدد بزرگ یعنی دوره‌های رکود شما طولانی است و به صبر بیشتری نیاز دارید.',
  'Recovery Factor':'سود خالص تقسیم بر بیشترین افت حساب.\nنشان می‌دهد در برابر ضرری که تحمل کرده‌اید، چقدر سود ساخته‌اید.\nبالاتر از ۱ یعنی سودتان از بزرگ‌ترین افت حساب بیشتر بوده؛ هرچه بزرگ‌تر، بهتر.',
  'Risk of Ruin':'تخمین احتمال اینکه با ادامه همین سبک معامله، بخش بزرگی از سرمایه خود را از دست بدهید.\nاین عدد از وین‌ریت و اندازه ریسک شما محاسبه می‌شود.\nهرچه به صفر نزدیک‌تر باشد بهتر است؛ عدد بالا یعنی ریسک شما برای حسابتان سنگین است.',
  'Average Risk':'به طور متوسط در هر معامله چند درصد از حسابتان را ریسک کرده‌اید.\nبیشتر معامله‌گران حرفه‌ای این عدد را بین ۱ تا ۲ درصد نگه می‌دارند.',
  'Max Risk Taken':'بیشترین درصدی از حساب که در یک معامله ریسک کرده‌اید.\nاگر این عدد خیلی بزرگ‌تر از میانگین ریسک شماست، یعنی در بعضی معاملات از قانون خودتان خارج شده‌اید.',

  /* ── Trade Statistics ── */
  'Long Win Rate':'درصد موفقیت شما فقط در معاملات خرید (Buy).\nبا مقایسه آن با وین‌ریت فروش می‌فهمید در کدام جهت بازار عملکرد بهتری دارید.',
  'Short Win Rate':'درصد موفقیت شما فقط در معاملات فروش (Sell).\nبا مقایسه آن با وین‌ریت خرید می‌فهمید در کدام جهت بازار عملکرد بهتری دارید.',
  'Long Profit':'سود یا زیان خالص حاصل از تمام معاملات خرید (Buy).',
  'Short Profit':'سود یا زیان خالص حاصل از تمام معاملات فروش (Sell).',
  'Avg Holding Time':'به طور متوسط هر معامله چقدر باز مانده است.\nاین عدد به شما می‌گوید سبک معاملاتی‌تان کوتاه‌مدت است یا بلندمدت، و آیا با برنامه‌ای که داشتید هماهنگ است یا نه.',
  'Consecutive Wins':'بیشترین تعداد معامله برنده پشت سر هم.\nنشان‌دهنده بهترین دوره اوج عملکرد شماست.',
  'Consecutive Losses':'بیشترین تعداد معامله بازنده پشت سر هم.\nمهم است بدانید چون باید از نظر روانی و مالی آماده تحمل چنین زنجیره‌ای باشید.',

  /* ── Psychology Analytics ── */
  'Avg Confidence':'میانگین امتیاز اعتماد به نفسی که هنگام ثبت معاملات به خودتان داده‌اید (از ۱۰).\nبا مقایسه آن با نتیجه معاملات می‌فهمید آیا حس درونی شما پیش‌بینی خوبی از نتیجه بوده است یا نه.',
  'Avg Discipline':'میانگین امتیاز پایبندی شما به برنامه معاملاتی‌تان (از ۱۰۰).\nهرچه بالاتر باشد یعنی بیشتر طبق قوانین خودتان عمل کرده‌اید و کمتر احساسی معامله کرده‌اید.',
  'Rule Violation Rate':'درصد معاملاتی که در آن‌ها حداقل یکی از قوانین خودتان را زیر پا گذاشته‌اید.\nهرچه به صفر نزدیک‌تر باشد یعنی نظم معاملاتی شما بهتر است.',
  'FOMO Trades':'تعداد معاملاتی که از روی ترس از دست دادن فرصت وارد شده‌اید.\nاین نوع ورود معمولاً بدون تأیید کامل ستاپ انجام می‌شود و ریسک بالاتری دارد.',
  'Revenge Trades':'تعداد معاملاتی که بعد از یک ضرر و برای جبران سریع آن وارد شده‌اید.\nاین رفتار معمولاً باعث ضررهای بزرگ‌تر می‌شود و نشانه معامله احساسی است.',
  'Checklist':'درصد معاملاتی که قبل از ورود، چک‌لیست خود را کامل کرده‌اید.\nعدد بالا یعنی با آمادگی و طبق فرآیند وارد معامله می‌شوید.',

  /* ── ستون‌های مشترک جدول‌های تحلیلی ── */
  'Trades':'تعداد معاملاتی که در این ردیف قرار گرفته‌اند.\nهرچه این عدد بیشتر باشد، آمار این ردیف قابل اعتمادتر است.\nبه نتیجه ردیفی که فقط ۱ یا ۲ معامله دارد زیاد تکیه نکنید.',
  'Average R':'میانگین مقدار R این ردیف؛ یعنی هر معامله به طور متوسط چند برابر ریسک اولیه نتیجه داده است.\nمثلاً ۱.۵R یعنی به طور متوسط ۱.۵ برابر چیزی که ریسک کردید به دست آورده‌اید.\nعدد منفی یعنی این دسته در مجموع ضررده بوده است.',
  'Avg R':'میانگین مقدار R این ردیف؛ یعنی هر معامله به طور متوسط چند برابر ریسک اولیه نتیجه داده است.\nمثلاً ۱.۵R یعنی به طور متوسط ۱.۵ برابر چیزی که ریسک کردید به دست آورده‌اید.\nعدد منفی یعنی این دسته در مجموع ضررده بوده است.',
  'Profit':'سود یا زیان خالص تمام معاملات این ردیف.',

  /* ── ستون اول جدول‌های Strategy Analytics ── */
  'Strategy':'استراتژی‌ای که در فرم ثبت معامله انتخاب کرده‌اید.\nاین جدول نشان می‌دهد هر استراتژی چه عملکردی داشته تا بفهمید کدام‌یک واقعاً برای شما جواب می‌دهد.\nچون این فیلد چندانتخابی است، یک معامله می‌تواند در چند ردیف شمرده شود.',
  'Dealing Range':'موقعیت قیمت در محدوده معاملاتی هنگام ورود (مثل پریمیوم یا دیسکانت).\nاین جدول نشان می‌دهد ورود در کدام ناحیه از رنج، نتیجه بهتری برایتان داشته است.',
  'Confirmation':'نوع تأییدی که برای ورود به معامله استفاده کرده‌اید.\nبا این جدول می‌فهمید کدام سیگنال تأیید، ورودهای دقیق‌تری به شما داده است.',
  'Confirmation Timeframe':'تایم‌فریمی که تأیید ورود را در آن گرفته‌اید.\nنشان می‌دهد در کدام تایم‌فریم، تأییدهای شما قابل اعتمادتر بوده‌اند.',
  'Entry':'مدل ورودی که برای وارد شدن به معامله استفاده کرده‌اید.\nاین جدول نشان می‌دهد کدام نوع ورود بهترین نتیجه را برایتان داشته است.',

  /* ── Session / Time Analytics ── */
  'Session':'سشن معاملاتی که در فرم ثبت معامله انتخاب کرده‌اید (آسیا، لندن، نیویورک).\nاین جدول نشان می‌دهد در کدام سشن بهتر معامله می‌کنید تا تمرکزتان را روی همان بگذارید.',
  'Day':'روز هفته‌ای که معامله در آن انجام شده است.\nاگر یک روز خاص مدام ضررده باشد، شاید بهتر باشد آن روز معامله نکنید.',
  'Hour':'ساعتی از شبانه‌روز که معامله را باز کرده‌اید.\nبا این جدول می‌فهمید در چه ساعاتی تمرکز و نتیجه بهتری دارید.',
  'Time PDA':'دسته‌بندی زمانی معامله بر اساس مکرو و سیلور بولت.\nنشان می‌دهد ورود در کدام پنجره زمانی برای شما سودده‌تر بوده است.',

  /* ── Instrument Analytics ── */
  'Symbol':'نمادی که روی آن معامله کرده‌اید (مثل EURUSD یا XAUUSD).\nاین جدول نشان می‌دهد روی کدام نماد بهتر عمل می‌کنید تا روی همان‌ها تمرکز کنید.',

  /* ── Psychology Analytics ── */
  'Emotion':'حالت روحی‌ای که هنگام ثبت معامله انتخاب کرده‌اید.\nاین جدول نشان می‌دهد در چه حال و هوایی بهترین و بدترین معاملاتتان را انجام داده‌اید.',
  'Mistake':'اشتباه یا مشکل روانی‌ای که برای آن معامله ثبت کرده‌اید.\nاین جدول پرهزینه‌ترین اشتباهات شما را مرتب می‌کند تا بدانید اول کدام را باید اصلاح کنید.',
  'Count':'تعداد دفعاتی که این اشتباه در معاملات شما تکرار شده است.',
  'Total Loss':'مجموع ضرری که این اشتباه روی هم برای شما ایجاد کرده است.\nاین ستون مهم‌ترین معیار برای اولویت‌بندی اصلاح اشتباهات است.',
  'Avg Loss':'میانگین ضرر هر معامله‌ای که این مورد در آن رخ داده است.\nنشان می‌دهد هر بار که این اتفاق می‌افتد، به طور متوسط چقدر برایتان هزینه دارد.',
  'Violation':'قانونی از برنامه معاملاتی خودتان که آن را زیر پا گذاشته‌اید.\nاین جدول نشان می‌دهد شکستن کدام قانون بیشترین آسیب را به حساب شما زده است.',
  'Occurrences':'تعداد دفعاتی که این قانون‌شکنی تکرار شده است.'
};

function helpIconFor(label){
  if(!HELP_TEXT[label]) return HELP_ICON;
  /* label is interpolated into an inline handler, so escape both the JS
     string delimiter and the surrounding HTML attribute quotes */
  const safe = esc(escJs(label));
  return '<span class="help-icon clickable" role="button" tabindex="0" aria-label="'+esc(label)+'" onclick="event.stopPropagation();A.toggleHelpPopover(\''+safe+'\',this)"></span>';
}

function renderAnalyticsPanel(trades, totalTrades, chartId, titlePrefix){
  const a = computeAnalytics(trades);
  const isFiltered = totalTrades !== undefined && trades.length < totalTrades;
  if(trades.length === 0){
    return '<div class="card">'+
      '<h2>'+(isFiltered ? 'Filtered Analytics' : (titlePrefix||'Performance Analytics'))+'</h2>'+
      '<div class="empty">No trades to analyze.</div>'+
    '</div>';
  }

  const kpi = (label, value, cls)=>'<div class="kpi-card"><span class="label"><span>'+label+'</span>'+helpIconFor(label)+'</span><span class="value'+(cls?' '+cls:'')+'">'+value+'</span></div>';

  const overallCards = [
    kpi('Total Profit', fmtMoney(a.profit), a.profit>=0?'up':'down'),
    kpi('Win Rate', a.winRate.toFixed(1)+'%', a.winRate>=50?'up':''),
    kpi('Profit Factor', isFinite(a.profitFactor)?a.profitFactor.toFixed(2):'∞'),
    kpi('Expectancy', fmtMoney(a.expectancy), a.expectancy>=0?'up':'down'),
    kpi('Avg R-Multiple', a.averageR.toFixed(2)+'R', a.averageR>=0?'up':'down'),
    kpi('Total Trades', ''+trades.length),
    kpi('Average Winner', fmtMoneySigned(a.avgWinner), 'up'),
    kpi('Average Loser', fmtMoneySigned(a.avgLoser), 'down')
  ].join('');

  const riskCards = [
    kpi('Max Drawdown', fmtMoney(-a.maxDrawdown), a.maxDrawdown>0?'down':''),
    kpi('Relative Drawdown', a.relativeDrawdown.toFixed(1)+'%', a.relativeDrawdown>0?'down':''),
    kpi('Drawdown Duration', a.maxDrawdownDuration+'d'),
    kpi('Recovery Factor', isFinite(a.recoveryFactor)?a.recoveryFactor.toFixed(2):'∞', a.recoveryFactor>=1?'up':'down'),
    kpi('Risk of Ruin', a.riskOfRuin.toFixed(0)+'%', a.riskOfRuin>30?'down':''),
    ...(a.hideAvgRisk ? [] : [kpi('Average Risk', a.avgRiskPercent.toFixed(2)+'%')]),
    kpi('Max Risk Taken', a.maxRiskPercent.toFixed(2)+'%')
  ].join('');

  const statsCards = [
    kpi('Long Win Rate', a.longWinRate.toFixed(1)+'%', a.longWinRate>=50?'up':''),
    kpi('Short Win Rate', a.shortWinRate.toFixed(1)+'%', a.shortWinRate>=50?'up':''),
    kpi('Long Profit', fmtMoney(a.longProfit), a.longProfit>=0?'up':'down'),
    kpi('Short Profit', fmtMoney(a.shortProfit), a.shortProfit>=0?'up':'down'),
    kpi('Avg Holding Time', formatHoldingTime(Math.round(a.avgHoldingMinutes))),
    kpi('Consecutive Wins', ''+a.consecutiveWins, 'up'),
    kpi('Consecutive Losses', ''+a.consecutiveLosses, a.consecutiveLosses>0?'down':'')
  ].join('');

  return '<div class="card">'+
    '<h2>'+(isFiltered ? 'Filtered Analytics' : (titlePrefix||'Performance Analytics'))+'</h2>'+
    accSection(chartId, 0, '', 'Overall Performance', '<div class="kpi-grid" style="margin-bottom:6px;">'+overallCards+'</div>')+
    accSection(chartId, 1, '', 'Risk Metrics', '<div class="kpi-grid" style="margin-bottom:6px;">'+riskCards+'</div>')+
    accSection(chartId, 2, '', 'Trade Statistics', '<div class="kpi-grid" style="margin-bottom:6px;">'+statsCards+'</div>')+
    accSection(chartId, 3, '', 'Strategy Analytics', renderStrategyAnalytics(a))+
    accSection(chartId, 4, '', 'Session Analytics', renderGroupTable(a.sessionStats, SESSION_COLUMNS, STATE.ui.sessionSort, 'session', a.bestSession, a.worstSession, 'No session data to analyze.'))+
    accSection(chartId, 5, '', 'Time Analytics',
      /* reuses the same setup-block wrapper as Strategy Analytics so every
         multi-table section in the panel shares one vertical rhythm */
      subTable('Weekday Performance', renderGroupTable(a.dayStats, DAY_COLUMNS, STATE.ui.daySort, 'day', a.bestDay, a.worstDay, 'No weekday data to analyze.'))+
      subTable('Trading Hour Performance', renderGroupTable(a.hourStats, HOUR_COLUMNS, STATE.ui.hourSort, 'hour', a.bestHour, null, 'No hourly data to analyze.'))+
      subTable('Time PDA Performance', renderGroupTable(a.timePdaStats, TIME_PDA_COLUMNS, TIME_PDA_FIXED_SORT, 'timePdaFixed', null, null, 'No data to analyze.'))
    )+
    accSection(chartId, 6, '', 'Instrument Analytics', renderInstrumentTable(a.symbolStats, a.bestSymbol, a.worstSymbol))+
    accSection(chartId, 7, '', 'Psychology Analytics',
      '<div class="kpi-grid" style="margin-bottom:18px;">'+
        kpi('Avg Confidence', a.avgConfidence.toFixed(1)+'/10', a.avgConfidence>=6?'up':'down')+
        kpi('Avg Discipline', a.avgDiscipline.toFixed(0)+'/100', a.avgDiscipline>=50?'up':'down')+
        kpi('Rule Violation Rate', a.ruleViolationRate.toFixed(1)+'%', a.ruleViolationRate>30?'down':'')+
        kpi('FOMO Trades', ''+a.fomoTrades, a.fomoTrades>0?'down':'')+
        kpi('Revenge Trades', ''+a.revengeTrades, a.revengeTrades>0?'down':'')+
        kpi('Checklist', a.checklistCompletionPct.toFixed(1)+'%', a.checklistCompletionPct>=70?'up':'down')+
      '</div>'+
      /* same setup-block rhythm as the other multi-table sections */
      subTable('Emotional State', renderEmotionTable(a.emotionStats))+
      subTable('Top Mistakes', renderMistakeTable(a.mistakeStats))+
      subTable('Rule Violations', renderViolationTable(a.violationStats))
    )+

  '</div>';
}


/* ---------------- equity curve card ---------------- */
function renderEquityCurveCard(chartId, isFiltered){
  return '<div class="card equity-card"><div class="equity-head"><h2>&#9776; Equity Curve</h2><span class="equity-badge">Account Growth</span></div><div class="chart-wrap" id="'+chartId+'"></div></div>';
}

/* ---------------- calendar view ---------------- */
function renderCalendar(){
  const cur = STATE.ui.calMonth;
  const statsByDay = {};
  STATE.trades.forEach(t=>{
    /* entryTime is already an ISO string in practice, so slice the date part
       directly instead of round-tripping through a Date object plus a
       toISOString() allocation for every trade on every render */
    const raw = t.entryTime;
    const date = (typeof raw === 'string' && raw.length >= 10 && raw[4] === '-' && raw[7] === '-')
      ? raw.slice(0, 10)
      : new Date(raw).toISOString().slice(0, 10);
    if(!statsByDay[date]) statsByDay[date] = { pnl:0, startBalance:t.startBalance };
    statsByDay[date].pnl += t.pnl;
  });

  const y = cur.getFullYear(), m = cur.getMonth();
  const startOfMonth = new Date(y,m,1);
  const daysInMonth = new Date(y,m+1,0).getDate();
  const startDay = startOfMonth.getDay();
  const blanks = (startDay===0?6:startDay-1);
  const weekDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  let cells = '';
  for(let i=0;i<blanks;i++) cells += `<div class="cal-cell blank"></div>`;
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const stats = statsByDay[dateStr];
    let cls='', inner='';
    if(stats){
      cls = stats.pnl>0?'win':stats.pnl<0?'loss':'';
      const pct = stats.startBalance>0 ? (stats.pnl/stats.startBalance)*100 : 0;
      inner = `<span class="pct">${stats.pnl>0?'+':''}${pct.toFixed(1)}%</span><span class="amt">${stats.pnl>0?'+':''}$${Math.abs(stats.pnl).toLocaleString(undefined,{maximumFractionDigits:0})}</span>`;
    }
    cells += `<div class="cal-cell ${cls}"><span class="d">${d}</span>${inner}</div>`;
  }

  return `
  <div class="card">
    <div class="cal-head">
      <div class="title">▦ Trade Calendar</div>
      <div class="cal-nav">
        <button class="icon-btn" onclick="A.shiftCalMonth(-1)">‹</button>
        <span>${(()=>{ const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return mn[cur.getMonth()]+' '+cur.getFullYear(); })()}</span>
        <button class="icon-btn" onclick="A.shiftCalMonth(1)">›</button>
      </div>
    </div>
    <div class="cal-grid">
      ${weekDays.map(d=>`<div class="cal-dow">${d}</div>`).join('')}
      ${cells}
    </div>
  </div>`;
}

/* ---------------- monthly summary ---------------- */
function renderMonthlySummary(){
  const year = STATE.ui.sumYear;
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const stats = {};
  for(let i=0;i<12;i++) stats[i] = { pnl:0, tradeCount:0, startBalance:null };
  const byMonth = {};
  STATE.trades.filter(t=> new Date(t.entryTime).getFullYear()===year).forEach(t=>{
    const mo = new Date(t.entryTime).getMonth();
    (byMonth[mo] = byMonth[mo]||[]).push(t);
  });
  for(let i=0;i<12;i++){
    if(byMonth[i]){
      const mt = sortTrades(byMonth[i].slice());
      stats[i].pnl = mt.reduce((acc,t)=>acc+t.pnl,0);
      stats[i].tradeCount = mt.length;
      stats[i].startBalance = mt[0].startBalance;
    }
  }
  const cells = monthNames.map((name,i)=>{
    const s = stats[i];
    const pct = s.startBalance!==null && s.startBalance>0 ? (s.pnl/s.startBalance)*100 : 0;
    const cls = s.pnl>0?'win':s.pnl<0?'loss':'';
    return `<div class="month-cell ${cls}">
      <div class="m">${name}</div>
      ${s.tradeCount>0 ? `
        <div class="p">${pct>=0?'+':''}${pct.toFixed(1)}%</div>
        <div class="a">${s.pnl>0?'+':''}$${Math.abs(s.pnl).toLocaleString(undefined,{maximumFractionDigits:0})}</div>
        <div class="n">${s.tradeCount} ${s.tradeCount===1?'trade':'trades'}</div>
      ` : `<div class="n" style="margin-top:6px;">—</div>`}
    </div>`;
  }).join('');

  return `
  <div class="card">
    <div class="cal-head">
      <h2 style="font-size:17px;">Monthly Summary</h2>
      <div class="cal-nav">
        <button class="icon-btn" onclick="A.shiftSumYear(-1)">‹</button>
        <span>${year}</span>
        <button class="icon-btn" onclick="A.shiftSumYear(1)">›</button>
      </div>
    </div>
    <div class="month-grid">${cells}</div>
  </div>`;
}

function renderJournalTab(){
  return '<div class="stack">'+
    renderLogForm()+
    renderAnalyticsPanel(STATE.trades, undefined, 'chart-main')+
    renderEquityCurveCard('chart-main')+
    renderCalendar()+
    renderMonthlySummary()+
  '</div>';
}
