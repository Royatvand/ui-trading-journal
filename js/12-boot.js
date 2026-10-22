"use strict";
/* ---------------- global outside-click handling ---------------- */
document.addEventListener('mousedown', (e)=>{
  let dirty = false;
  if(STATE.ui.openMsel && !e.target.closest('.msel')){ STATE.ui.openMsel = null; dirty = true; }
  if(STATE.ui.dashMenuId && !e.target.closest('.journal-menu-wrap') && !e.target.closest('.jc-menu-wrap')){ STATE.ui.dashMenuId = null; dirty = true; }
  if(STATE.ui.showThemePopover && !e.target.closest('.theme-fab') && !e.target.closest('.theme-popover')){ STATE.ui.showThemePopover = false; dirty = true; }
  if(STATE.ui._helpLabel && !e.target.closest('.help-popover') && !e.target.closest('.help-icon.clickable')){ const hp=document.querySelector('.help-popover'); if(hp)hp.remove(); STATE.ui._helpLabel=null; }
  if(dirty) render();
});

/* ---------------- boot ---------------- */
initTheme();
init();
