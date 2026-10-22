"use strict";
/* ---------------- shared form widgets ---------------- */
function escJs(s){ return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

function selectOptionsHTML(list, selected){
  return list.map(o=>`<option value="${esc(o)}" ${o===selected?'selected':''}>${esc(o)}</option>`).join('');
}

function renderMultiSelect(field, options, placeholder){
  const selected = formDraft[field] || [];
  const isOpen = STATE.ui.openMsel === field;
  const chips = selected.length
    ? selected.map(s=>`<span class="chip">${esc(s)}</span>`).join('')
    : `<span style="color:var(--text-faint);font-size:12.5px;">${placeholder}</span>`;
  const opts = options.length ? options.map(o=>{
    const on = selected.includes(o);
    return `<div class="msel-opt ${on?'on':''}" onclick="A.toggleMultiSelect('${field}','${escJs(o)}')"><span class="box">${on?'✓':''}</span>${esc(o)}</div>`;
  }).join('') : `<div class="msel-opt" style="color:var(--text-faint);">No options — add via ⚙</div>`;

  return `<div class="msel">
    <button type="button" class="msel-btn" onclick="A.toggleMselOpen('${field}')">
      <span class="chips">${chips}</span><span style="color:var(--text-faint)">▾</span>
    </button>
    ${isOpen ? `<div class="msel-panel">${opts}</div>` : ''}
  </div>`;
}

function renderSeg(field, value){
  return `<div class="seg">
    <button type="button" class="${!value?'on':''}" onclick="A.setDraftBool('${field}',false)">No</button>
    <button type="button" class="${value?'on':''}" onclick="A.setDraftBool('${field}',true)">Yes</button>
  </div>`;
}

function renderSlider(field, min, max){
  const val = formDraft[field];
  return `<div class="slider-field">
    <input type="range" min="${min}" max="${max}" step="1" value="${val}"
      oninput="A.updateDraftNumber('${field}', this.value); document.getElementById('${field}-val').textContent = this.value;">
    <span class="slider-val" id="${field}-val">${val}</span>
  </div>`;
}

/* ---------------- log trade form ---------------- */
function renderLogForm(){
  const isEditing = !!STATE.tradeToEdit;
  const bal = calculatedLastBalance();

  if(!STATE.ui.formExpanded && !isEditing){
    return '<button class="log-trigger" onclick="A.expandForm()"><span class="plus">+</span><span class="caption">Log a New Trade</span></button>';
  }

  const pnlColor = formDraft.pnl>0 ? 'style="color:var(--green)"' : formDraft.pnl<0 ? 'style="color:var(--red)"' : '';
  const riskPct = bal>0 ? ((formDraft.riskDollar||0)/bal*100).toFixed(1) : '0.0';

  function sect(title, body){ return '<div class="section-card"><div class="section-title">'+title+'</div>'+body+'</div>'; }
  function dtPair(dateId, timeId, field, label){
    return '<div class="field"><label>'+label+'</label><div class="date-time-pair"><input type="date" class="control" id="'+dateId+'" value="'+isoToDatePart(formDraft[field])+'" oninput="A.updateDateTimeField(\''+field+'\', this.value, document.getElementById(\''+timeId+'\').value)"><input type="text" id="'+timeId+'" class="time-input" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" placeholder="HH:MM" maxlength="5" value="'+isoToTimePart(formDraft[field])+'" oninput="A.autoFormatTime(this);A.updateDateTimeField(\''+field+'\', document.getElementById(\''+dateId+'\').value, this.value)"></div></div>';
  }

  var linksHTML = '<div class="link-list">';
  if(formDraft.chartLinks && formDraft.chartLinks.length){
    formDraft.chartLinks.forEach(function(url,i){
      var display = url.length>50 ? url.substring(0,50)+'...' : url;
      var safe = safeUrl(url);
      linksHTML += '<div class="link-row"><a class="link-url" '+(safe?'href="'+esc(safe)+'"':'')+' target="_blank" rel="noopener noreferrer" title="'+esc(url)+'">'+esc(display)+'</a><button type="button" class="icon-btn danger" onclick="A.removeChartLink('+i+')">&#10005;</button></div>';
    });
  }
  linksHTML += '</div><div class="link-add"><input type="text" class="control" id="chart-link-input" placeholder="Paste chart URL..." onkeydown="if(event.key===\'Enter\'){event.preventDefault();A.addChartLink();}"><button type="button" class="btn btn-sm" onclick="A.addChartLink()">+ Add</button></div>';

  return '<div class="card" id="logform-root">'+
    '<h2>'+(isEditing?'Editing Trade':'Log a New Trade')+'</h2>'+
    '<form onsubmit="event.preventDefault(); A.submitTrade();">'+

    sect('Trade Information',
      '<div class="grid grid-4">'+
        '<div class="field"><label><span>Symbol</span><span class="gear-icon" onclick="event.stopPropagation();A.openManageModal(\'symbols\',\'Symbol Settings\')">&#9881;</span></label><select class="control" onchange="A.updateDraftField(\'symbol\', this.value)"><option value="">Select Symbol</option>'+selectOptionsHTML(STATE.options.symbols, formDraft.symbol)+'</select></div>'+
        '<div class="field"><label>Position</label><select class="control" onchange="A.updateDraftField(\'position\', this.value)">'+selectOptionsHTML(POSITIONS, formDraft.position)+'</select></div>'+
        dtPair('entry-date-input','entry-time-input','entryTime','Entry Date / Time')+
        dtPair('close-date-input','close-time-input','closeTime','Exit Date / Time')+
      '</div>'+
      '<div class="grid grid-4" style="margin-top:6px;">'+
        '<div class="field"><label>Day</label><select class="control" id="day-select" onchange="A.updateDraftField(\'day\', this.value)">'+selectOptionsHTML(DAYS, formDraft.day)+'</select></div>'+
        '<div class="field"><label>Session</label><select class="control" id="session-select" onchange="A.updateDraftField(\'killZone\', this.value)">'+selectOptionsHTML(KILLZONES, formDraft.killZone)+'</select></div>'+
        '<div class="field"><label><span>Time PDA</span><span class="gear-icon" onclick="event.stopPropagation();A.openManageModal(\'timePDA\',\'Time PDA Settings\')">&#9881;</span></label>'+renderMultiSelect('timePDA', STATE.options.timePDA, 'Select...')+'</div>'+
      '</div>'
    )+

    sect('Price &amp; Risk',
      '<div class="grid grid-3">'+
        '<div class="field"><label>Entry Price</label><input type="number" step="0.00001" class="control" value="'+formDraft.entryPrice+'" oninput="A.updateDraftNumber(\'entryPrice\', this.value)"></div>'+
        '<div class="field"><label>Stop Loss</label><input type="number" step="0.00001" min="0" class="control" value="'+formDraft.stopLoss+'" oninput="A.updateDraftNumber(\'stopLoss\', this.value)"></div>'+
        '<div class="field"><label>Take Profit</label><input type="number" step="0.00001" min="0" class="control" value="'+formDraft.takeProfit+'" oninput="A.updateDraftNumber(\'takeProfit\', this.value)"></div>'+
      '</div>'+
      '<div class="grid grid-3" style="margin-top:6px;">'+
        '<div class="field"><label>Risk ($)</label><input type="number" step="0.01" min="0" class="control" value="'+formDraft.riskDollar+'" oninput="A.updateDraftNumber(\'riskDollar\', this.value)"><span style="font-family:var(--font-mono);font-size:9.5px;color:var(--text-faint);margin-top:2px;display:block;">&asymp; '+riskPct+'% of Account</span></div>'+
        '<div class="field"><label>Reward (R) <span style="opacity:.6;font-size:10px;">auto = P&amp;L ÷ Risk</span></label><input type="number" step="0.01" class="control" id="reward-input" value="'+formDraft.reward+'" oninput="A.updateDraftNumber(\'reward\', this.value)"></div>'+
        '<div class="field"><label>P&amp;L ($)</label><input type="number" step="0.01" class="control" '+pnlColor+' value="'+formDraft.pnl+'" oninput="A.updateDraftNumber(\'pnl\', this.value)"></div>'+
      '</div>'+
      '<div class="grid grid-3" style="margin-top:6px;">'+
        '<div class="field"><label>Result</label><select class="control" onchange="A.setResultMode(this.value)">'+
          [['auto','Auto (from P&amp;L)'],['win','Win'],['loss','Loss'],['be','Break-even']].map(function(o){ return '<option value="'+o[0]+'"'+(formDraft.resultMode===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')+
        '</select><span id="result-auto-hint" style="font-family:var(--font-mono);font-size:9.5px;opacity:.7;">'+(formDraft.resultMode==='auto' ? 'Auto: '+({win:'Win',loss:'Loss',be:'BE'})[autoResult(formDraft.pnl, formDraft.riskDollar)] : '')+'</span></div>'+
      '</div>'
    )+

    sect('Setup',
      '<div class="grid grid-5">'+
        '<div class="field"><label><span>Strategy</span><span class="gear-icon" onclick="event.stopPropagation();A.openManageModal(\'sdpTime\',\'Strategy Settings\')">&#9881;</span></label>'+renderMultiSelect('sdpTime', STATE.options.sdpTime, 'Select...')+'</div>'+
        '<div class="field"><label><span>Dealing Range</span><span class="gear-icon" onclick="event.stopPropagation();A.openManageModal(\'dealingRange\',\'Dealing Range Settings\')">&#9881;</span></label>'+renderMultiSelect('dealingRange', STATE.options.dealingRange, 'Select...')+'</div>'+
        '<div class="field"><label><span>Confirmation</span><span class="gear-icon" onclick="event.stopPropagation();A.openManageModal(\'entryType\',\'Confirmation Settings\')">&#9881;</span></label><select class="control" onchange="A.updateDraftField(\'entryType\', this.value)">'+selectOptionsHTML(STATE.options.entryType, formDraft.entryType)+'</select></div>'+
        '<div class="field"><label><span>Confirmation Timeframe</span><span class="gear-icon" onclick="event.stopPropagation();A.openManageModal(\'confirmationTime\',\'Confirmation Timeframe Settings\')">&#9881;</span></label><select class="control" onchange="A.updateDraftField(\'confirmationTime\', this.value)">'+selectOptionsHTML(STATE.options.confirmationTime, formDraft.confirmationTime)+'</select></div>'+
        '<div class="field"><label><span>Entry</span><span class="gear-icon" onclick="event.stopPropagation();A.openManageModal(\'entrySetup\',\'Entry Settings\')">&#9881;</span></label>'+renderMultiSelect('entrySetup', STATE.options.entrySetup, 'Select...')+'</div>'+
      '</div>'
    )+

    sect('Strategy Filters',
      '<div class="grid grid-3">'+
        '<div class="field"><label>SMT</label>'+renderSeg('smt', formDraft.smt)+'</div>'+
        '<div class="field"><label>3PDA Fail</label>'+renderSeg('threePdaFail', formDraft.threePdaFail)+'</div>'+
        '<div class="field"><label>OTE</label>'+renderSeg('ote', formDraft.ote)+'</div>'+
      '</div>'
    )+

    sect('Psychology',
      '<div class="grid grid-4">'+
        '<div class="field"><label><span>Emotional State</span><span class="gear-icon" onclick="event.stopPropagation();A.openManageModal(\'emotionalState\',\'Emotional State Settings\')">&#9881;</span></label><select class="control" onchange="A.updateDraftField(\'emotionalState\', this.value)">'+selectOptionsHTML(STATE.options.emotionalState, formDraft.emotionalState)+'</select></div>'+
        '<div class="field"><label>Confidence</label>'+renderSlider('confidenceScore', 1, 10)+'</div>'+
        '<div class="field"><label>Discipline</label>'+renderSlider('disciplineScore', 0, 100)+'</div>'+
        '<div class="field"><label>Checklist</label>'+renderSeg('checklistCompleted', formDraft.checklistCompleted)+'</div>'+
      '</div>'+
      '<div style="margin:10px 0;">'+
        '<div class="grid grid-2" style="margin-bottom:4px;">'+
          '<div class="field"><label><span>Rule Violations</span><span class="gear-icon" onclick="event.stopPropagation();A.openManageModal(\'ruleViolations\',\'Rule Violations Settings\')">&#9881;</span></label>'+renderMultiSelect('ruleViolations', STATE.options.ruleViolations, 'Select...')+'</div>'+           '<div class="field"><label><span>Psychology Issues</span><span class="gear-icon" onclick="event.stopPropagation();A.openManageModal(\'psychology\',\'Psychology Issues Settings\')">&#9881;</span></label>'+renderMultiSelect('psychology', STATE.options.psychology, 'Select...')+'</div>'+        '</div>'+      '</div>'
    )+

    sect('Trade Notes',
      '<div class="field"><textarea class="control" rows="2" placeholder="What did you see? How did you feel?" oninput="A.updateDraftField(\'note\', this.value)">'+esc(formDraft.note)+'</textarea></div>'
    )+

    sect('Chart Links',
      linksHTML
    )+

    '<div style="display:flex;gap:12px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line-soft);">'+
      '<button type="submit" class="btn btn-primary btn-block">'+(isEditing?'Update Trade':'Log Trade')+'</button>'+
      '<button type="button" class="btn btn-block" onclick="A.cancelForm()">Cancel</button>'+
    '</div>'+
    '</form>'+
    '</div>';
}

/* ---------------- generic grouped analytics table ----------------
   Powers Session Analytics and Time Analytics (Weekday / Hour) using the
   shared analytics table components and opt-in responsive modifiers. */
function sortGroupStats(statsArr, sortState){
  const { key, dir } = sortState;
  const mult = dir==='asc' ? 1 : -1;
  return [...statsArr].sort((a,b)=>{
    /* 'Unspecified' means "no tag chosen", not a real group, so it is
       pinned to the bottom whatever the active sort — otherwise it can
       outrank genuine setups purely because it aggregates many trades. */
    const aU = a.key === 'Unspecified', bU = b.key === 'Unspecified';
    if(aU !== bU) return aU ? 1 : -1;
    const av = a[key], bv = b[key];
    if(typeof av==='string' || typeof bv==='string') return String(av).localeCompare(String(bv)) * mult;
    const avn = isFinite(av) ? av : (av>0 ? Infinity : -Infinity);
    const bvn = isFinite(bv) ? bv : (bv>0 ? Infinity : -Infinity);
    return (avn - bvn) * mult;
  });
}

function formatGroupCell(key, s){
  switch(key){
    case 'trades': return `${s.trades}`;
    case 'winRate': return `<span class="${s.winRate>=50?'pnl-pos':''}">${s.winRate.toFixed(1)}%</span>`;
    case 'profitFactor': return isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞';
    case 'pnl': return `<span class="${s.pnl>=0?'pnl-pos':'pnl-neg'}">${fmtMoneySigned(s.pnl)}</span>`;
    case 'avgR': return `<span class="${s.avgR>=0?'pnl-pos':'pnl-neg'}">${s.avgR.toFixed(2)}R</span>`;
    case 'expectancy': return `<span class="${s.expectancy>=0?'pnl-pos':'pnl-neg'}">${fmtMoney(s.expectancy)}</span>`;
    default: return esc(String(s[key] ?? '-'));
  }
}

function renderGroupTable(stats, columns, sortState, sortTableName, bestKey, worstKey, emptyMessage){
  if(!stats || stats.length===0){
    return `<div class="empty">${emptyMessage || 'No data to analyze.'}</div>`;
  }
  const sorted = sortGroupStats(stats, sortState);

  const headCells = columns.map(col=>{
    const active = sortState.key===col.key;
    const arrow = active ? (sortState.dir==='asc' ? '▲' : '▼') : '';
    return `<th style="text-align:${col.align};" onclick="A.setGroupSort('${sortTableName}','${col.key}')">${esc(col.label)}${helpIconFor(col.label)}${arrow?`<span class="arrow">${arrow}</span>`:''}</th>`;
  }).join('');

  const rows = sorted.map(s=>{
    const rowCls = s.key===bestKey ? 'best-row' : s.key===worstKey ? 'worst-row' : '';
    const badge = s.key===bestKey ? '<span class="badge best">BEST</span>' : s.key===worstKey ? '<span class="badge worst">WORST</span>' : '';
    const cells = columns.map((col,idx)=>{
      if(idx===0) return `<td data-label="${esc(col.label)}" style="text-align:${col.align};"><div class="setup-name">${esc(s.label)}${badge}</div></td>`;
      return `<td data-label="${esc(col.label)}" style="text-align:${col.align};">${formatGroupCell(col.key, s)}</td>`;
    }).join('');
    return `<tr class="${rowCls}">${cells}</tr>`;
  }).join('');

  return `<div class="strategy-wrap">
    <table class="strategy-table zebra stacked-mobile">
      <thead><tr>${headCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

const SESSION_COLUMNS = [
  { key:'key', label:'Session', align:'left' },
  { key:'trades', label:'Trades', align:'right' },
  { key:'winRate', label:'Win Rate', align:'right' },
  { key:'profitFactor', label:'Profit Factor', align:'right' },
  { key:'pnl', label:'Total Profit', align:'right' },
  { key:'avgR', label:'Avg R', align:'right' },
  { key:'expectancy', label:'Expectancy', align:'right' }
];
const DAY_COLUMNS = [
  { key:'key', label:'Day', align:'left' },
  { key:'trades', label:'Trades', align:'right' },
  { key:'winRate', label:'Win Rate', align:'right' },
  { key:'profitFactor', label:'Profit Factor', align:'right' },
  { key:'pnl', label:'Total Profit', align:'right' },
  { key:'avgR', label:'Average R', align:'right' },
  { key:'expectancy', label:'Expectancy', align:'right' }
];
const HOUR_COLUMNS = [
  { key:'order', label:'Hour', align:'left' },
  { key:'trades', label:'Trades', align:'right' },
  { key:'winRate', label:'Win Rate', align:'right' },
  { key:'profitFactor', label:'Profit Factor', align:'right' },
  { key:'pnl', label:'Total Profit', align:'right' },
  { key:'avgR', label:'Average R', align:'right' },
  { key:'expectancy', label:'Expectancy', align:'right' }
];
const TIME_PDA_COLUMNS = [
  { key:'key', label:'Time PDA', align:'left' },
  { key:'trades', label:'Trades', align:'right' },
  { key:'winRate', label:'Win Rate', align:'right' },
  { key:'profitFactor', label:'Profit Factor', align:'right' },
  { key:'pnl', label:'Total Profit', align:'right' },
  { key:'avgR', label:'Average R', align:'right' },
  { key:'expectancy', label:'Expectancy', align:'right' }
];
const TIME_PDA_FIXED_SORT = { key:'order', dir:'asc' };
