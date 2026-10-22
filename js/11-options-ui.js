"use strict";
/* ---------------- manage options modal ---------------- */
function renderManageOptionsModal(){
  var md = STATE.ui.manageModal;
  var key = md.key, title = md.title;
  var list = STATE.options[key] || [];
  var archived = (_archived[key] || []).slice();
  var renameIdx = md.renameIdx;
  var renameVal = md.renameVal || '';
  var delIdx = md.delIdx;

  var activeItems = '';
  list.forEach(function(o,i){
    activeItems += '<div class="opt-row">';
    if(renameIdx === i){
      activeItems += '<input type="text" class="control" id="rename-input-'+i+'" value="'+esc(renameVal)+'" style="flex:1;" onkeydown="if(event.key===\'Enter\'){A.commitRenameOption(\''+key+'\','+i+',this.value)}" autofocus><button class="icon-btn" onclick="A.commitRenameOption(\''+key+'\','+i+',document.getElementById(\'rename-input-'+i+'\').value)">\u2713</button><button class="icon-btn" onclick="A.cancelOptionEdit()">\u2715</button>';
    } else {
      activeItems += '<span style="flex:1;font-size:13px;">'+esc(o)+'</span>';
      if(list.length>1){
        activeItems += '<button class="icon-btn" style="font-size:10px;" onclick="A.moveOption(\''+key+'\','+i+',-1)" title="Move up">\u25B2</button><button class="icon-btn" style="font-size:10px;" onclick="A.moveOption(\''+key+'\','+i+',1)" title="Move down">\u25BC</button>';
      }
      activeItems += '<button class="icon-btn" onclick="A.startRenameOption(\''+key+'\','+i+',\''+escJs(o)+'\')" title="Rename">\u270E</button>';
      activeItems += '<button class="icon-btn danger" onclick="A.confirmDeleteOption(\''+key+'\','+i+',\''+escJs(o)+'\')" title="Delete">🗑️</button>';
    }
    activeItems += '</div>';
  });
  if(!activeItems) activeItems = '<p class="hint">No items yet. Add one below.</p>';

  var archivedItems = '';
  if(archived.length){
    archivedItems = '<div class="section-title" style="margin-top:10px;">Archived</div>';
    archived.forEach(function(o,i){
      archivedItems += '<div class="opt-row"><span style="flex:1;font-size:13px;color:var(--text-faint);">'+esc(o)+'</span><button class="icon-btn" style="color:var(--green);" onclick="A.unarchiveOption(\''+key+'\','+i+')" title="Restore">\u21A9</button></div>';
    });
  }

  var html = '<div class="overlay" onclick="A.closeManageModal()">'+
    '<div class="modal" style="max-width:480px;" onclick="event.stopPropagation()">'+
      '<div class="modal-head"><h2>'+esc(title)+'</h2><button class="icon-btn" onclick="A.closeManageModal()">\u2715</button></div>'+
      '<div style="display:flex;gap:6px;margin-bottom:14px;">'+
        '<input type="text" class="control" id="manage-opt-input" placeholder="Add new option..." onkeydown="if(event.key===\'Enter\'){A.addOptionItem(\''+key+'\', this.value); this.value=\'\';}">'+
        '<button class="btn btn-primary btn-sm" onclick="var el=document.getElementById(\'manage-opt-input\'); A.addOptionItem(\''+key+'\', el.value); el.value=\'\';">+ Add</button>'+
      '</div>'+
      activeItems+
      archivedItems+
    '</div>'+
  '</div>';

  if(delIdx != null){
    var oName = list[delIdx] || '';
    if(md.delInUse){
      html += '<div class="overlay" style="z-index:210;" onclick="A.cancelOptionEdit()">'+
        '<div class="modal" style="max-width:380px;" onclick="event.stopPropagation()">'+
          '<div class="modal-head"><h2>Cannot Delete</h2></div>'+
          '<p style="font-size:13px;color:var(--text-dim);margin-bottom:14px;">This option is already used by existing trades and cannot be deleted.</p>'+
          '<div style="display:flex;gap:8px;">'+
            '<button class="btn btn-block" onclick="A.renameFromInUse(\''+key+'\','+delIdx+',\''+escJs(oName)+'\')">Rename</button>'+
            '<button class="btn btn-ghost btn-block" onclick="A.cancelOptionEdit()">Cancel</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    } else {
      var otherOpts = list.filter(function(o2){return o2!==oName;}).map(function(o2){return '<option value="'+escJs(o2)+'">'+esc(o2)+'</option>';}).join('');
      html += '<div class="overlay" style="z-index:210;" onclick="A.cancelOptionEdit()">'+
        '<div class="modal" style="max-width:380px;" onclick="event.stopPropagation()">'+
          '<div class="modal-head"><h2>Delete &quot;'+esc(oName)+'&quot;?</h2></div>'+
          '<p style="font-size:13px;color:var(--text-dim);margin-bottom:14px;">This option may be used by historical trades.</p>'+
          '<div class="field" style="margin-bottom:10px;"><label>Replace references with</label><select class="control" id="del-replace-val"><option value="">Archive only (keep in history)</option>'+otherOpts+'</select></div>'+
          '<div style="display:flex;gap:8px;">'+
            '<button class="btn btn-block" onclick="A.executeDeleteOption(\''+key+'\','+delIdx+',document.getElementById(\'del-replace-val\').value)">Confirm</button>'+
            '<button class="btn btn-ghost btn-block" onclick="A.cancelOptionEdit()">Cancel</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    }
  }

  return html;
}

const A = {
  // dashboard
  selectJournal(id){ selectJournal(id); },
  toggleDashMenu(id){ STATE.ui.dashMenuId = STATE.ui.dashMenuId===id? null : id; render(); },
  toggleThemePopover(){ STATE.ui.showThemePopover = !STATE.ui.showThemePopover; render(); },
  selectTheme(id){ STATE.ui.showThemePopover = false; setTheme(id); },
  toggleHelpPopover(label, el){
    const existing = document.querySelector('.help-popover');
    if(existing){ existing.remove(); }
    if(STATE.ui._helpLabel === label){ STATE.ui._helpLabel = null; return; }
    STATE.ui._helpLabel = label;
    const text = HELP_TEXT[label];
    if(!text) return;
    const pop = document.createElement('div');
    pop.className = 'help-popover';
    pop.innerHTML = '<div class="hp-title">'+label+'</div><div class="hp-body">'+text.replace(/\n/g,'<br>')+'</div>';
    document.body.appendChild(pop);
    const r = el.getBoundingClientRect();
    let top = r.bottom + 8;
    let left = r.left + r.width/2 - 275/2;
    if(top + 160 > window.innerHeight) top = r.top - 8 - pop.offsetHeight;
    if(left < 8) left = 8;
    if(left + 275 > window.innerWidth - 8) left = window.innerWidth - 275 - 8;
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
    requestAnimationFrame(()=>{ pop.classList.add('open'); });
  },
  startRename(id, name){ STATE.ui.dashEditingId = id; STATE.ui.dashEditingName = name; STATE.ui.dashMenuId = null; render(); },
  setDashEditingName(v){ STATE.ui.dashEditingName = v; },
  saveRename(id){ const name = STATE.ui.dashEditingName.trim(); if(name) renameJournalAction(id, name); else { STATE.ui.dashEditingId=null; render(); } },
  cancelRename(){ STATE.ui.dashEditingId = null; render(); },
  deleteJournalAction(id){ deleteJournalAction(id); },
  exportJournalAction(id){ exportJournalAction(id); },
  exportAllJournalsAction(){ exportAllJournalsAction(); },
  openCreateJournal(){ STATE.ui.dashCreating = true; render(); setTimeout(()=>document.getElementById('new-journal-name')?.focus(),0); },
  closeCreateJournal(){ STATE.ui.dashCreating = false; render(); },
  submitCreateJournal(){
    const nameEl = document.getElementById('new-journal-name');
    const name = nameEl ? nameEl.value.trim() : '';
    if(!name) return;
    const settings = {
      initialBalance: parseFloat(document.getElementById('new-initial-balance')?.value) || 10000,
      currency: 'USD', riskMode: 'percent', defaultRisk: 2, broker: ''
    };
    createJournal(name, settings);
  },
  handleDashImport(input){
    const file = input.files && input.files[0];
    if(file) importJournalFromFile(file);
    input.value = '';
  },
  handleDashImportAll(input){
    const file = input.files && input.files[0];
    if(file) importAllJournalsFromFile(file);
    input.value = '';
  },

  // shell
  setTab(tab){ STATE.activeTab = tab; render(); },
  exitJournal(){ exitJournal(); },

  // log form
  expandForm(){ STATE.ui.formExpanded = true; render(); },
  cancelForm(){
    if(STATE.tradeToEdit){ cancelEditTrade(); }
    else{ const sym = formDraft.symbol; formDraft = freshFormDraft(sym); STATE.ui.formExpanded = false; render(); }
  },
  submitTrade(){ submitTrade(); },
  updateDraftField(field, value){
    formDraft[field] = value;
    if(field==='day') formDraft.dayManual = true;
    if(field==='killZone') formDraft.sessionManual = true;
  },
  updateDraftNumber(field, value){
    formDraft[field] = parseFloat(value) || 0;
    if(field==='reward') formDraft.rManual = true;
    if((field==='pnl' || field==='riskDollar') && !formDraft.rManual && formDraft.riskDollar>0){
      formDraft.reward = Math.round((formDraft.pnl / formDraft.riskDollar)*100)/100;
      var el = document.getElementById('reward-input'); if(el) el.value = formDraft.reward;
    }
    if(field==='pnl' || field==='riskDollar'){
      var rl = document.getElementById('result-auto-hint');
      if(rl) rl.textContent = formDraft.resultMode==='auto' ? ('Auto: '+({win:'Win',loss:'Loss',be:'BE'})[autoResult(formDraft.pnl, formDraft.riskDollar)]) : '';
    }
  },
  setResultMode(v){ formDraft.resultMode = v; render(); },
  /* Day / Session follow the Entry time unless the user picked them by hand. DOM-updated to keep input focus. */
  syncDaySession(){
    var iso = formDraft.entryTime; if(!iso) return;
    if(!formDraft.dayManual){
      var dn = dayNameFromISO(iso);
      if(dn){ formDraft.day = dn; var de = document.getElementById('day-select'); if(de) de.value = dn; }
    }
    if(!formDraft.sessionManual){
      var h = new Date(iso).getHours();
      if(!isNaN(h)){
        var sn = sessionForHour(h);
        if(KILLZONES.includes(sn)){ formDraft.killZone = sn; var se = document.getElementById('session-select'); if(se) se.value = sn; }
      }
    }
  },
  setDraftBool(field, value){ formDraft[field] = value; render(); },

  toggleMultiSelect(field, value){
    const arr = formDraft[field] || [];
    formDraft[field] = arr.includes(value) ? arr.filter(v=>v!==value) : [...arr, value];
    render();
  },
  toggleMselOpen(field){ STATE.ui.openMsel = STATE.ui.openMsel===field ? null : field; render(); },
  openManageModal(key, title){ STATE.ui.manageModal = { key, title }; render(); },
  closeManageModal(){ STATE.ui.manageModal = null; render(); },
  addOptionItem(key, value){ addOptionItem(key, value); },
  deleteOptionItem(key, value){ deleteOptionItem(key, value); },

  /* config modal */
  startRenameOption(key, idx, oldVal){ STATE.ui.manageModal.renameIdx = idx; STATE.ui.manageModal.renameVal = oldVal; render(); },
  async commitRenameOption(key, idx, newVal){
    newVal = (newVal||'').trim(); if(!newVal) return;
    var oldVal = STATE.options[key][idx];
    if(oldVal === newVal){ this.cancelOptionEdit(); return; }
    if(STATE.options[key].some(function(o,i){ return i!==idx && o.toLowerCase()===newVal.toLowerCase(); })){ toast('That name already exists.'); return; }
    STATE.options[key][idx] = newVal;
    try{ await remapTradeOption(key, oldVal, newVal); await persistOptions(); }
    catch(e){ console.error(e); toast('Could not save the rename.'); }
    this.cancelOptionEdit();
  },
  cancelOptionEdit(){ STATE.ui.manageModal.renameIdx = null; STATE.ui.manageModal.delIdx = null; STATE.ui.manageModal.delInUse = false; STATE.ui.manageModal.renameVal = ''; STATE.ui.manageModal.replaceVal = ''; render(); },
  renameFromInUse(key, idx, name){
    STATE.ui.manageModal.delIdx = null;
    STATE.ui.manageModal.delInUse = false;
    STATE.ui.manageModal.renameIdx = idx;
    STATE.ui.manageModal.renameVal = name;
    render();
  },
  moveOption(key, idx, dir){
    var list = STATE.options[key]; var newIdx = idx + dir;
    if(newIdx < 0 || newIdx >= list.length) return;
    var tmp = list[idx]; list[idx] = list[newIdx]; list[newIdx] = tmp;
    persistOptions(); render();
  },
  confirmDeleteOption(key, idx, name){
    if(isOptionUsedByTrades(key, name)){
      STATE.ui.manageModal.delIdx = idx;
      STATE.ui.manageModal.delInUse = true;
      render();
    } else {
      STATE.options[key].splice(idx, 1);
      persistOptions();
      render();
    }
  },
  async executeDeleteOption(key, idx, replaceWith){
    var oldVal = STATE.options[key][idx];
    replaceWith = (replaceWith||'').trim();
    try{
      if(replaceWith) await remapTradeOption(key, oldVal, replaceWith);
      if(!_archived[key]) _archived[key] = [];
      _archived[key].push(oldVal);
      STATE.options[key].splice(idx, 1);
      await persistOptions();
    }catch(e){ console.error(e); toast('Could not save the change.'); }
    this.cancelOptionEdit();
  },
  unarchiveOption(key, archIdx){
    STATE.options[key].push(_archived[key][archIdx]);
    _archived[key].splice(archIdx, 1);
    persistOptions(); render();
  },
  addChartLink(){
    const input = document.getElementById('chart-link-input');
    let url = input ? input.value.trim() : '';
    if(!url) return;
    if(!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://'+url;
    url = safeUrl(url);
    if(!url){ toast('Only http/https links are allowed.'); return; }
    formDraft.chartLinks = [...(formDraft.chartLinks||[]), url];
    input.value = ''; input.focus();
    render();
  },
  removeChartLink(idx){ formDraft.chartLinks = formDraft.chartLinks.filter((_,i)=>i!==idx); render(); },
  submitLinkOnEnter(event){ if(event.key==='Enter'){ event.preventDefault(); this.addChartLink(); } },

  updateDateTimeField(field, dateVal, timeVal){
    if(dateVal && timeVal && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(timeVal)){
      formDraft[field] = dateVal+'T'+timeVal+':00';
    } else if(dateVal && !timeVal){
      formDraft[field] = dateVal+'T00:00:00';
    }
    if(field==='entryTime') this.syncDaySession();
  },
  autoFormatTime(el){
    let v = el.value.replace(/[^0-9]/g,'').slice(0,4);
    if(v.length >= 3){ v = v.slice(0,2)+':'+v.slice(2); }
    if(v.length === 4){
      const h = parseInt(v.slice(0,2)), m = parseInt(v.slice(2));
      if(h>23||m>59) return;
    }
    el.value = v;
  },

  // trades
  handleEditTrade(id){ handleEditTrade(id); },
  deleteTradeAction(id){ deleteTradeAction(id); },
  viewTrade(id){ STATE.ui.viewTradeId = id; render(); },
  closeViewTrade(){ STATE.ui.viewTradeId = null; render(); },

  // history / filters
  toggleFilters(){ STATE.ui.showFilters = !STATE.ui.showFilters; render(); },
  setFilter(field, value){ STATE.ui.filters[field] = value; render(); },
  resetFilters(){ STATE.ui.filters = {...initialFilters}; render(); },
  handleExportBackup(){ handleExportBackup(); },
  handleHistoryImport(input){
    const file = input.files && input.files[0];
    if(file) handleImportBackup(file);
    input.value = '';
  },

  // calendar / summary nav
  shiftCalMonth(delta){ const d = STATE.ui.calMonth; STATE.ui.calMonth = new Date(d.getFullYear(), d.getMonth()+delta, 1); render(); },
  shiftSumYear(delta){ STATE.ui.sumYear += delta; render(); },
  setGroupSort(tableName, key){
    const stateKey = tableName + 'Sort';
    const cur = STATE.ui[stateKey];
    if(!cur) return;
    if(cur.key===key){ cur.dir = cur.dir==='asc' ? 'desc' : 'asc'; }
    else{ STATE.ui[stateKey] = { key, dir:'desc' }; }
    render();
  },

  // checklist
  submitChecklistItem(text){ addChecklistItemAction(text); },
  toggleChecklistItemAction(id){ toggleChecklistItemAction(id); },
  deleteChecklistItemAction(id){ deleteChecklistItemAction(id); },
  resetTradingChecklist(){ resetTradingChecklist(); },
  startEditChecklistItem(id, text){ startEditChecklistItem(id, text); },
  cancelEditChecklistItem(){ cancelEditChecklistItem(); },
  saveEditChecklistItem(id){ saveEditChecklistItem(id); },
  updateChecklistEditingText(v){ updateChecklistEditingText(v); },

  toggleAccordion(chartId, num){
    if(!STATE.ui.accState[chartId]) STATE.ui.accState[chartId] = [0];
    const arr = STATE.ui.accState[chartId];
    const idx = arr.indexOf(num);
    if(idx >= 0) arr.splice(idx, 1);
    else arr.push(num);
    const section = document.querySelector('.acc-section[data-acc="'+num+'"][data-panel="'+chartId+'"]');
    if(section){
      section.classList.toggle('open');
      const hdr = section.querySelector('.acc-header');
      if(hdr) hdr.setAttribute('aria-expanded', section.classList.contains('open')?'true':'false');
    }

  }
};
