"use strict";
/* ---------------- analytics engine ---------------- */
/* ---------------- generic grouped-stats helpers ----------------
   Used by Session Analytics and Time Analytics (Weekday / Hour) below. */
function accumulateGroup(map, key, t){
  if(!map.has(key)) map.set(key, { trades:0, wins:0, losses:0, grossProfit:0, grossLoss:0, pnlSum:0, rSum:0 });
  const g = map.get(key);
  g.trades++; g.pnlSum += t.pnl; g.rSum += Number(t.rr) || 0;
  const r = resultOf(t);
  if(r==='win'){ g.wins++; g.grossProfit += t.pnl; }
  else if(r==='loss'){ g.losses++; g.grossLoss += Math.abs(t.pnl); }
  else { if(t.pnl>0) g.grossProfit += t.pnl; else g.grossLoss += Math.abs(t.pnl); }
}

function finalizeGroupStats(map, profitTotal, labelFn, orderFn, includeContribution=true){
  return [...map.entries()].map(([key, g])=>{
    const decisive = g.wins + g.losses;   /* break-even trades are excluded from win rate */
    const winFrac = g.trades>0 ? g.wins/g.trades : 0;
    const winRate = decisive>0 ? (g.wins/decisive)*100 : 0;
    const profitFactor = g.grossLoss>0 ? g.grossProfit/g.grossLoss : (g.grossProfit>0 ? Infinity : 0);
    const expectancy = g.trades>0 ? g.pnlSum/g.trades : 0;
    const avgR = g.trades>0 ? g.rSum/g.trades : 0;
    const stats = {
      key, label: labelFn ? labelFn(key) : String(key), order: orderFn ? orderFn(key) : (typeof key==='number'?key:0),
      trades:g.trades, winRate, profitFactor, expectancy, avgR, pnl:g.pnlSum
    };
    if(includeContribution) stats.contributionPct = profitTotal!==0 ? (g.pnlSum/profitTotal)*100 : 0;
    return stats;
  });
}

/* Best/worst by Profit Factor, ignoring groups below the minimum sample size. */
const MIN_GROUP_SAMPLE = 5;
function pickBestWorst(statsArr, minSample){
  const eligible = statsArr.filter(s=>s.trades>=minSample);
  if(!eligible.length) return { best:null, worst:null };
  const best = eligible.reduce((a,b)=> b.profitFactor>a.profitFactor ? b : a).key;
  const worst = eligible.reduce((a,b)=> b.profitFactor<a.profitFactor ? b : a).key;
  return { best, worst };
}

/* ── analytics memo cache ───────────────────────────────────
   computeAnalytics is pure: same trades in → same stats out. A single
   render() asks for the very same result up to 3 times (panel body,
   equity chart, post-render hooks), and each call re-sorts and re-walks
   every trade. We cache the last few results keyed by the identity and
   revision of the input, so repeat calls inside one render are free.
   invalidateAnalytics() is called from mutateTrades() whenever data
   actually changes, so a stale result can never be served.          */
let __analyticsRevision = 0;
const __analyticsCache = new Map();          /* key -> stats object */
const __ANALYTICS_CACHE_MAX = 8;

function invalidateAnalytics(){
  __analyticsRevision++;
  __analyticsCache.clear();
}

function __analyticsKey(trades){
  /* cheap, collision-safe enough: revision + length + first/last ids */
  const n = trades.length;
  if(n === 0) return 'r' + __analyticsRevision + ':0';
  return 'r' + __analyticsRevision + ':' + n + ':' +
         trades[0].id + ':' + trades[n-1].id;
}

function computeAnalytics(trades){
  const list = trades || [];
  const key = __analyticsKey(list);
  const hit = __analyticsCache.get(key);
  if(hit) return hit;
  const out = __computeAnalyticsUncached(list);
  if(__analyticsCache.size >= __ANALYTICS_CACHE_MAX){
    __analyticsCache.delete(__analyticsCache.keys().next().value);
  }
  __analyticsCache.set(key, out);
  return out;
}

function __computeAnalyticsUncached(trades){
  const empty = {
    profit:0, winRate:0, profitFactor:0, totalWins:0, totalLosses:0, totalBE:0, maxDrawdown:0,
    bestKillZone:'N/A', worstKillZone:'N/A', consecutiveWins:0, consecutiveLosses:0,
    expectancy:0, averageR:0, riskOfRuin:0, maxDrawdownDuration:0, accountGrowth:[],
    avgWinner:0, avgLoser:0, relativeDrawdown:0, recoveryFactor:0,
    avgRiskPercent:0, maxRiskPercent:0, hideAvgRisk:true,
    longWinRate:0, shortWinRate:0, longProfit:0, shortProfit:0, avgHoldingMinutes:0,
    sessionStats:[], bestSession:null, worstSession:null,
    dayStats:[], bestDay:null, worstDay:null,
    hourStats:[], bestHour:null, worstHour:null,
    timePdaStats:[],
    symbolStats:[], bestSymbol:null, worstSymbol:null,
    emotionStats:[], violationStats:[], mistakeStats:[],
    sdpTimeStats:[], bestSdpTime:null, worstSdpTime:null,
    dealingRangeStats:[], bestDealingRange:null, worstDealingRange:null,
    entrySetupStats:[], bestEntrySetup:null, worstEntrySetup:null,
    entryTypeStats:[], bestEntryType:null, worstEntryType:null,
    confirmationTimeStats:[], bestConfirmationTime:null, worstConfirmationTime:null,
    avgConfidence:0, avgDiscipline:0,
    fomoTrades:0, revengeTrades:0, checklistCompletionPct:0, ruleViolationRate:0,
    drawdownSeries:[], rDistribution:[]
  };
  if(!trades || trades.length===0) return empty;

  const sorted = sortTrades([...trades]);
  let totalProfitFromWins=0, totalLossFromLosses=0, totalWins=0, totalLosses=0, totalBE=0;
  let curWins=0, maxWins=0, curLosses=0, maxLosses=0;
  const killZonePnl = { 'London':0, 'New York':0 };
  const accountGrowth = [];
  let balance = sorted[0].startBalance;
  let peak = balance, peakDate = new Date(sorted[0].entryTime).getTime();
  let maxDD = 0, maxDDDuration = 0, maxDDPercent = 0;
  let realizedRSum = 0;
  let riskSum = 0, riskCount = 0, maxRiskPercent = 0;
  const riskValues = [];
  let longTotal=0, longWins=0, longProfit=0, shortTotal=0, shortWins=0, shortProfit=0;
  let holdingSum=0, holdingCount=0;
  const sessionMap = new Map(); SESSIONS.forEach(s=>sessionMap.set(s, { trades:0, wins:0, grossProfit:0, grossLoss:0, pnlSum:0, rSum:0 }));
  const dayMap = new Map(); DAYS.forEach(d=>dayMap.set(d, { trades:0, wins:0, grossProfit:0, grossLoss:0, pnlSum:0, rSum:0 }));
  const hourMap = new Map();
  const timePdaMap = new Map(); TIME_PDA_GROUPS.forEach(group=>timePdaMap.set(group, { trades:0, wins:0, grossProfit:0, grossLoss:0, pnlSum:0, rSum:0 }));
  const symbolMap = new Map();
  const emotionMap = new Map();
  /* Strategy Analytics (④) — one map per field in the log form's SETUP
     section. sdpTime / dealingRange / entrySetup are multi-select, so a
     single trade can land in several buckets of the same table; entryType
     and confirmationTime are single-select. */
  const sdpTimeMap = new Map();
  const dealingRangeMap = new Map();
  const entrySetupMap = new Map();
  const entryTypeMap = new Map();
  const confirmationTimeMap = new Map();
  const violationMap = new Map();
  const mistakeMap = new Map();
  let confidenceSum = 0, confidenceCount = 0;
  let disciplineSum = 0, disciplineCount = 0;
  let fomoTrades = 0, revengeTrades = 0;
  let checklistCompletedCount = 0, ruleViolationCount = 0;
  accountGrowth.push({ name:'Start', balance });

  sorted.forEach((t,i)=>{
    const pnl = t.pnl;
    const tDate = new Date(t.closeTime).getTime();
    balance += pnl;
    if(balance > peak){ peak = balance; peakDate = tDate; }
    else{
      const dd = peak - balance;
      if(dd > maxDD) maxDD = dd;
      const ddPct = peak>0 ? (dd/peak)*100 : 0;
      if(ddPct > maxDDPercent) maxDDPercent = ddPct;
      const days = Math.floor((tDate - peakDate)/(1000*60*60*24));
      if(days > maxDDDuration) maxDDDuration = days;
    }
    accountGrowth.push({ name:`Trade ${i+1}`, balance });
    killZonePnl[t.killZone] = (killZonePnl[t.killZone]||0) + pnl;
    const res = resultOf(t);
    if(res==='win'){
      totalWins++; totalProfitFromWins += pnl; curWins++; curLosses=0;
      if(curWins > maxWins) maxWins = curWins;
    } else if(res==='loss'){
      totalLosses++; totalLossFromLosses += Math.abs(pnl); curLosses++; curWins=0;
      if(curLosses > maxLosses) maxLosses = curLosses;
    } else { totalBE++; }
    realizedRSum += Number(t.rr) || 0;
    const riskPct = Number(t.riskPercent) || 0;
    riskSum += riskPct; riskCount++;
    riskValues.push(riskPct);
    if(riskPct > maxRiskPercent) maxRiskPercent = riskPct;

    // long / short breakdown
    if(t.position==='Buy'){ longTotal++; longProfit+=pnl; if(res==='win') longWins++; }
    else if(t.position==='Sell'){ shortTotal++; shortProfit+=pnl; if(res==='win') shortWins++; }

    // holding time
    const holdMin = t.holdingTime || computeHoldingMinutes(t.entryTime, t.closeTime);
    holdingSum += holdMin; holdingCount++;

    // Session Analytics uses only the manually selected Session stored on the trade.
    if(SESSIONS.includes(t.killZone)) accumulateGroup(sessionMap, t.killZone, t);
    accumulateGroup(dayMap, t.day || 'Unspecified', t);
    const entryHour = storedEntryHour(t.entryTime);
    if(entryHour !== null) accumulateGroup(hourMap, entryHour, t);

    const timePdaValues = Array.isArray(t.timePDA) ? t.timePDA : [];
    const hasMacro = timePdaValues.includes('Macro');
    const hasSilverBullet = timePdaValues.includes('Silver Bullet');
    const timePdaGroup = hasMacro && hasSilverBullet ? 'Macro + Silver Bullet' :
      hasMacro ? 'Macro' : hasSilverBullet ? 'Silver Bullet' : 'None';
    accumulateGroup(timePdaMap, timePdaGroup, t);

    accumulateGroup(symbolMap, t.symbol || 'Unspecified', t);
    accumulateGroup(emotionMap, t.emotionalState || 'Unspecified', t);

    /* ---- Strategy Analytics buckets ----
       Multi-select fields: a trade tagged ['FVG','Breaker'] counts once in
       each row, which is what you want when asking "how does FVG perform".
       Trades with nothing selected fall into 'Unspecified' so the totals
       always reconcile against the trade count. */
    const sdpVals = Array.isArray(t.sdpTime) ? t.sdpTime.filter(Boolean) : [];
    if(sdpVals.length) sdpVals.forEach(v=>accumulateGroup(sdpTimeMap, v, t));
    else accumulateGroup(sdpTimeMap, 'Unspecified', t);

    const drVals = Array.isArray(t.dealingRange) ? t.dealingRange.filter(Boolean) : [];
    if(drVals.length) drVals.forEach(v=>accumulateGroup(dealingRangeMap, v, t));
    else accumulateGroup(dealingRangeMap, 'Unspecified', t);

    const esVals = Array.isArray(t.entrySetup) ? t.entrySetup.filter(Boolean) : [];
    if(esVals.length) esVals.forEach(v=>accumulateGroup(entrySetupMap, v, t));
    else accumulateGroup(entrySetupMap, 'Unspecified', t);

    accumulateGroup(entryTypeMap, t.entryType || 'Unspecified', t);
    accumulateGroup(confirmationTimeMap, t.confirmationTime || 'Unspecified', t);
    if(t.ruleViolations && t.ruleViolations.length){ ruleViolationCount++; t.ruleViolations.forEach(v=>{ accumulateGroup(violationMap, v, t); }); }
    if(t.psychology && t.psychology.length){ t.psychology.forEach(m=>{ accumulateGroup(mistakeMap, m, t); }); }
    if(t.confidenceScore != null){ confidenceSum += Number(t.confidenceScore); confidenceCount++; }
    if(t.disciplineScore != null){ disciplineSum += Number(t.disciplineScore); disciplineCount++; }
    if(t.checklistCompleted) checklistCompletedCount++;
    if((t.psychology && t.psychology.includes('FOMO')) || (t.ruleViolations && t.ruleViolations.includes('FOMO'))) fomoTrades++;
    if((t.psychology && (t.psychology.includes('Revenge Trading')||t.psychology.includes('Revenge Trade'))) || (t.ruleViolations && (t.ruleViolations.includes('Revenge Trade')||t.ruleViolations.includes('Revenge Trading')))) revengeTrades++;
  });

  const total = sorted.length;
  const profit = balance - sorted[0].startBalance;
  const decisiveTrades = totalWins + totalLosses;      /* BE excluded from win rate */
  const winRate = decisiveTrades>0 ? totalWins/decisiveTrades : 0;
  const profitFactor = totalLossFromLosses !== 0 ? Math.abs(totalProfitFromWins/totalLossFromLosses) : Infinity;
  const avgWin = totalWins>0 ? totalProfitFromWins/totalWins : 0;
  const avgLoss = totalLosses>0 ? totalLossFromLosses/totalLosses : 0;
  const expectancy = total>0 ? ((totalWins/total)*avgWin) - ((totalLosses/total)*avgLoss) : 0;
  const averageR = total>0 ? realizedRSum/total : 0;

  let riskOfRuin = 0;
  const payoffRatio = avgLoss>0 ? avgWin/avgLoss : 0;
  if(expectancy <= 0) riskOfRuin = 100;
  else{
    const num = 1-winRate, den = winRate*payoffRatio;
    if(den>0){ riskOfRuin = Math.min(100, Math.max(0, (num/den)*100)); if(riskOfRuin<1) riskOfRuin=0; }
    else riskOfRuin = 100;
  }

  const kzEntries = Object.entries(killZonePnl);
  const hasNonZero = kzEntries.some(kz=>kz[1]!==0);
  const bestKillZone = hasNonZero ? kzEntries.reduce((a,b)=> a[1]>b[1]?a:b)[0] : 'N/A';
  const worstKillZone = hasNonZero ? kzEntries.reduce((a,b)=> a[1]<b[1]?a:b)[0] : 'N/A';

  const recoveryFactor = maxDD>0 ? profit/maxDD : (profit>0 ? Infinity : 0);
  const avgRiskPercent = riskCount>0 ? riskSum/riskCount : 0;
  const hideAvgRisk = riskValues.length<=1 || riskValues.every(v=>v===riskValues[0]);

  const longWinRate = longTotal>0 ? (longWins/longTotal)*100 : 0;
  const shortWinRate = shortTotal>0 ? (shortWins/shortTotal)*100 : 0;
  const avgHoldingMinutes = holdingCount>0 ? holdingSum/holdingCount : 0;

  // ---- Session Analytics (⑤) and Time Analytics (⑥) — finalized from the maps
  // built during the single trade pass above; small loops over distinct groups only. ----
  const sessionStats = finalizeGroupStats(sessionMap, profit, k=>k, k=>SESSIONS.indexOf(k));
  const { best: bestSession, worst: worstSession } = pickBestWorst(sessionStats, MIN_GROUP_SAMPLE);

  const dayStats = finalizeGroupStats(dayMap, profit, k=>k, k=>DAYS.indexOf(k), false);
  const { best: bestDay, worst: worstDay } = pickBestWorst(dayStats, MIN_GROUP_SAMPLE);

  const hourStats = finalizeGroupStats(hourMap, profit, k=>formatHourLabel(k), k=>k, false)
    .sort((a,b)=>a.order-b.order);
  const { best: bestHour, worst: worstHour } = pickBestWorst(hourStats, MIN_GROUP_SAMPLE);

  const timePdaStats = finalizeGroupStats(timePdaMap, profit, k=>k, k=>TIME_PDA_GROUPS.indexOf(k), false)
    .sort((a,b)=>a.order-b.order);

  const MIN_SYMBOL_SAMPLE = 3;
  const symbolStats = finalizeGroupStats(symbolMap, profit, k=>k, k=>k).sort((a,b)=>b.pnl - a.pnl);
  const { best: bestSymbol, worst: worstSymbol } = pickBestWorst(symbolStats, MIN_SYMBOL_SAMPLE);
  const emotionStats = finalizeGroupStats(emotionMap, profit, k=>k, k=>EMOTIONAL_STATES.indexOf(k));

  /* ---- Strategy Analytics (④) ----
     Each table is sorted by net P&L so the strongest setup is on top, and
     best/worst badges use the shared profit-factor rule with a minimum
     sample so a single lucky trade can never be crowned "BEST".
     Note: for the multi-select tables the rows can sum to more than the
     total trade count, because one trade may carry several tags. */
  const MIN_SETUP_SAMPLE = 3;
  const buildSetupStats = (map)=>{
    const stats = finalizeGroupStats(map, profit, k=>k, k=>k).sort((a,b)=>b.pnl - a.pnl);
    /* 'Unspecified' is the absence of a tag, not a setup you can compare
       against — it must never win a BEST/WORST badge. It is also pushed to
       the bottom so the real setups read first. */
    const named = stats.filter(s=>s.key !== 'Unspecified');
    let { best, worst } = pickBestWorst(named, MIN_SETUP_SAMPLE);
    /* with only one qualifying row, best and worst collapse onto the same
       setup — badging it both ways says nothing, so show neither */
    if(best === worst){ best = null; worst = null; }
    const ordered = named.concat(stats.filter(s=>s.key === 'Unspecified'));
    return { stats: ordered, best, worst };
  };
  const sdpTimeGroup = buildSetupStats(sdpTimeMap);
  const dealingRangeGroup = buildSetupStats(dealingRangeMap);
  const entrySetupGroup = buildSetupStats(entrySetupMap);
  const entryTypeGroup = buildSetupStats(entryTypeMap);
  const confirmationTimeGroup = buildSetupStats(confirmationTimeMap);
  const violationStats = [...violationMap.entries()].map(([violation, g])=>{
    const vT = g.trades, vW = g.wins;
    return { violation, occurrences: vT, winRate: vT>0?(vW/vT)*100:0, avgR: vT>0?g.rSum/vT:0, avgLoss: (vT-vW)>0?g.grossLoss/(vT-vW):0, pnl: g.pnlSum };
  }).sort((a,b)=>b.occurrences - a.occurrences);
  const mistakeStats = [...mistakeMap.entries()].map(([mistake, g])=>{
    const mT = g.trades, mW = g.wins;
    return { mistake, count: mT, winRate: mT>0?(mW/mT)*100:0, totalLoss: g.grossLoss, avgLoss: (mT-mW)>0?g.grossLoss/(mT-mW):0, pnl: g.pnlSum };
  }).sort((a,b)=>b.totalLoss - a.totalLoss);
  const avgConfidence = confidenceCount>0 ? confidenceSum/confidenceCount : 0;
  const avgDiscipline = disciplineCount>0 ? disciplineSum/disciplineCount : 0;
  const checklistCompletionPct = total>0 ? (checklistCompletedCount/total)*100 : 0;
  const ruleViolationRate = total>0 ? (ruleViolationCount/total)*100 : 0;
  const drawdownSeries = (()=>{
    let pk = sorted.length>0 ? sorted[0].startBalance : 0;
    return accountGrowth.map(p=>{ if(p.balance>pk) pk=p.balance; return { name:p.name, drawdown: pk>0?((pk-p.balance)/pk)*100:0 }; });
  })();
  const rDistCounts = [0,0,0,0,0,0,0,0];
  sorted.forEach(t=>{
    const rr = Number(t.rr)||0;
    if(rr<-3) rDistCounts[0]++; else if(rr<-2) rDistCounts[1]++; else if(rr<-1) rDistCounts[2]++;
    else if(rr<0) rDistCounts[3]++; else if(rr<1) rDistCounts[4]++; else if(rr<2) rDistCounts[5]++;
    else if(rr<3) rDistCounts[6]++; else rDistCounts[7]++;
  });
  const rLabels = ['< -3R','-3R','-2R','-1R','0R','+1R','+2R','> +3R'];
  const rDistribution = rLabels.map((b,i)=>({ bucket:b, count:rDistCounts[i], pct:total>0?(rDistCounts[i]/total)*100:0 }));

  return {
    profit, winRate: winRate*100, profitFactor, totalWins, totalLosses, totalBE, maxDrawdown: maxDD,
    bestKillZone, worstKillZone, consecutiveWins: maxWins, consecutiveLosses: maxLosses,
    expectancy, averageR, riskOfRuin, maxDrawdownDuration: maxDDDuration, accountGrowth,
    avgWinner: avgWin, avgLoser: -avgLoss, relativeDrawdown: maxDDPercent, recoveryFactor,
    avgRiskPercent, maxRiskPercent, hideAvgRisk,
    longWinRate, shortWinRate, longProfit, shortProfit, avgHoldingMinutes,
    sessionStats, bestSession, worstSession,
    dayStats, bestDay, worstDay,
    hourStats, bestHour, worstHour,
    timePdaStats,
    symbolStats, bestSymbol, worstSymbol,
    emotionStats, violationStats, mistakeStats,
    sdpTimeStats: sdpTimeGroup.stats, bestSdpTime: sdpTimeGroup.best, worstSdpTime: sdpTimeGroup.worst,
    dealingRangeStats: dealingRangeGroup.stats, bestDealingRange: dealingRangeGroup.best, worstDealingRange: dealingRangeGroup.worst,
    entrySetupStats: entrySetupGroup.stats, bestEntrySetup: entrySetupGroup.best, worstEntrySetup: entrySetupGroup.worst,
    entryTypeStats: entryTypeGroup.stats, bestEntryType: entryTypeGroup.best, worstEntryType: entryTypeGroup.worst,
    confirmationTimeStats: confirmationTimeGroup.stats, bestConfirmationTime: confirmationTimeGroup.best, worstConfirmationTime: confirmationTimeGroup.worst,
    avgConfidence, avgDiscipline,
    fomoTrades, revengeTrades, checklistCompletionPct, ruleViolationRate,
    drawdownSeries, rDistribution
  };
}

/* ---------------- account growth chart (SVG, no deps) ---------------- */
/* ---------------- mini sparkline (dashboard cards) ---------------- */
function renderMiniChart(containerId, values, colorHex){
  const el = document.getElementById(containerId);
  if(!el) return;
  if(!values || values.length < 2){ el.innerHTML = ''; return; }

  const W = el.clientWidth || 240, H = el.clientHeight || 56;
  /* spread-based Math.min/max blows the call stack on large arrays
     (a long-running journal can hold thousands of points) */
  let min = Infinity, max = -Infinity;
  for(let i = 0; i < values.length; i++){
    const v = values[i];
    if(v < min) min = v;
    if(v > max) max = v;
  }
  if(!isFinite(min)){ min = 0; max = 0; }
  if(min === max){ min -= 1; max += 1; }
  const range = max - min;
  const stepX = W/(values.length-1);
  const xAt = (i)=> i*stepX;
  const yAt = (v)=> H - ((v-min)/range)*H;

  let linePath = '';
  values.forEach((v,i)=>{
    const x = xAt(i), y = yAt(v);
    linePath += (i===0?'M':'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' ';
  });
  const areaPath = linePath + `L${W.toFixed(2)},${H} L0,${H} Z`;
  const gid = containerId+'-grad';

  el.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${colorHex}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${colorHex}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#${gid})" stroke="none"/>
      <path d="${linePath}" fill="none" stroke="${colorHex}" stroke-width="1.75" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

/* Theme variables only change when the theme changes, but the chart code
   asks for them ~14x per render. Each getComputedStyle() read forces the
   browser to flush pending style work, so we memoise per theme and clear
   the cache in setTheme(). */
let __themeVarCache = new Map();
let __themeVarCacheKey = null;

function readThemeVar(name){
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  if(__themeVarCacheKey !== theme){
    __themeVarCache.clear();
    __themeVarCacheKey = theme;
  }
  let v = __themeVarCache.get(name);
  if(v === undefined){
    v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    __themeVarCache.set(name, v);
  }
  return v;
}

function drawDashboardCharts(){
  /* read the two theme colours once instead of calling getComputedStyle
     twice per journal card (each call forces a style recalculation) */
  const cs = getComputedStyle(document.documentElement);
  const greenColor = cs.getPropertyValue('--green').trim();
  const redColor   = cs.getPropertyValue('--red').trim();
  STATE.journals.forEach(j=>{
    const s = STATE.journalStats[j.id];
    if(!s || !s.series || s.series.length < 2) return;
    renderMiniChart('jc-chart-'+j.id, s.series, s.pnl >= 0 ? greenColor : redColor);
  });
}

function renderAreaChart(containerId, data){
  const el = document.getElementById(containerId);
  if(!el) return;
  if(!data || data.length===0){ el.innerHTML = ''; return; }

  const W = el.clientWidth || 600, H = 260;
  const padL = 54, padR = 12, padT = 14, padB = 26;
  const innerW = W - padL - padR, innerH = H - padT - padB;

  const values = data.map(d=>d.balance);
  /* spread-based Math.min/max blows the call stack on large arrays
     (a long-running journal can hold thousands of points) */
  let min = Infinity, max = -Infinity;
  for(let i = 0; i < values.length; i++){
    const v = values[i];
    if(v < min) min = v;
    if(v > max) max = v;
  }
  if(!isFinite(min)){ min = 0; max = 0; }
  if(min === max){ min -= 1; max += 1; }
  const range = max - min;
  const stepX = data.length>1 ? innerW/(data.length-1) : 0;
  const chartGridC = readThemeVar('--chart-grid');
  const chartLabelC = readThemeVar('--chart-label');
  const chartLabelDimC = readThemeVar('--chart-label-dim');

  const xAt = (i)=> padL + i*stepX;
  const yAt = (v)=> padT + innerH - ((v-min)/range)*innerH;

  let linePath = '', areaPath = '';
  data.forEach((d,i)=>{
    const x = xAt(i), y = yAt(d.balance);
    linePath += (i===0? 'M':'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' ';
  });
  areaPath = linePath + `L${xAt(data.length-1).toFixed(2)},${(padT+innerH).toFixed(2)} L${xAt(0).toFixed(2)},${(padT+innerH).toFixed(2)} Z`;

  // gridlines (4 horizontal)
  let grid = '';
  const gridCount = 4;
  for(let i=0;i<=gridCount;i++){
    const y = padT + (innerH/gridCount)*i;
    const val = max - (range/gridCount)*i;
    grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="${chartGridC}" stroke-dasharray="3,3"/>`;
    grid += `<text x="${padL-8}" y="${(y+4).toFixed(1)}" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" fill="${chartLabelC}">${fmtMoneyShort(val)}</text>`;
  }

  // sparse x labels
  let xlabels = '';
  const labelEvery = Math.max(1, Math.ceil(data.length/6));
  data.forEach((d,i)=>{
    if(i % labelEvery === 0 || i===data.length-1){
      xlabels += `<text x="${xAt(i).toFixed(1)}" y="${H-6}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9.5" fill="${chartLabelDimC}">${esc(d.name.replace('Trade ',''))}</text>`;
    }
  });

  /* Hover targets used to be one <circle> per data point plus two listeners
     each — 300 trades meant 300 extra SVG nodes and 600 listeners rebuilt on
     every render. A single transparent overlay + one delegated listener does
     the same job: we map the cursor's x back to the nearest index. */
  const dots = `<rect class="chart-hit" x="${padL}" y="${padT}" width="${Math.max(0,innerW)}" height="${innerH}" fill="transparent" style="cursor:crosshair"/>`;

  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--amber').trim() || '#FFB300';

  el.innerHTML = `
    <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible">
      <defs>
        <linearGradient id="gradFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <path d="${areaPath}" fill="url(#gradFill)" stroke="none"/>
      <path d="${linePath}" fill="none" stroke="${accentColor}" stroke-width="2"/>
      ${xlabels}
      ${dots}
    </svg>
    <div class="chart-tooltip" id="${containerId}-tip" style="display:none;"></div>
  `;

  const tip = document.getElementById(containerId+'-tip');
  const hit = el.querySelector('.chart-hit');
  if(hit){
    const svgEl = el.querySelector('svg');
    hit.addEventListener('mousemove', (e)=>{
      const box = svgEl.getBoundingClientRect();
      /* the svg is drawn in a fixed viewBox but may be scaled by CSS */
      const scale = box.width ? W / box.width : 1;
      const localX = (e.clientX - box.left) * scale;
      let i = stepX > 0 ? Math.round((localX - padL) / stepX) : 0;
      if(i < 0) i = 0;
      if(i > data.length - 1) i = data.length - 1;
      const d = data[i];
      if(!d) return;
      tip.style.display='block';
      tip.style.left = xAt(i).toFixed(2)+'px';
      tip.style.top = yAt(d.balance).toFixed(2)+'px';
      tip.innerHTML = `<div class="t-label">${esc(d.name)}</div><div class="t-val">${fmtMoney(d.balance)}</div>`;
    });
    hit.addEventListener('mouseleave', ()=>{ tip.style.display='none'; });
  }
}
