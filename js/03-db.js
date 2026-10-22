"use strict";
/* ---------------- IndexedDB layer ---------------- */
const DB_NAME = 'LedgerTradingJournalDB';
const DB_VERSION = 1;

const db = {
  _p: null,
  open(){
    if(this._p) return this._p;
    this._p = new Promise((resolve,reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = ()=>reject(req.error);
      req.onsuccess = ()=>resolve(req.result);
      req.onupgradeneeded = (e)=>{
        const d = e.target.result;
        if(!d.objectStoreNames.contains('journals')) d.createObjectStore('journals',{keyPath:'id'});
        if(!d.objectStoreNames.contains('trades')){
          const s = d.createObjectStore('trades',{keyPath:'id'});
          s.createIndex('journalId','journalId',{unique:false});
        }
        if(!d.objectStoreNames.contains('checklists')){
          const s = d.createObjectStore('checklists',{keyPath:'id'});
          s.createIndex('journalId','journalId',{unique:false});
        }
        if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings',{keyPath:'id'});
      };
    });
    return this._p;
  },
  async getAllJournals(){
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['journals'],'readonly');
      const r = tx.objectStore('journals').getAll();
      r.onsuccess = ()=>res(r.result);
      r.onerror = ()=>rej(r.error);
    });
  },
  async getTradesByJournal(journalId){
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['trades'],'readonly');
      const idx = tx.objectStore('trades').index('journalId');
      const r = idx.getAll(journalId);
      r.onsuccess = ()=>res(r.result);
      r.onerror = ()=>rej(r.error);
    });
  },
  async getChecklistByJournal(journalId){
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['checklists'],'readonly');
      const idx = tx.objectStore('checklists').index('journalId');
      const r = idx.getAll(journalId);
      r.onsuccess = ()=>res(r.result);
      r.onerror = ()=>rej(r.error);
    });
  },
  async getSettings(journalId){
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['settings'],'readonly');
      const r = tx.objectStore('settings').get(journalId);
      r.onsuccess = ()=>res(r.result || null);
      r.onerror = ()=>rej(r.error);
    });
  },
  async putSettingsRecord(rec){
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['settings'],'readwrite');
      tx.objectStore('settings').put(rec);
      tx.oncomplete = ()=>res();
      tx.onerror = ()=>rej(tx.error);
    });
  },
  /* one transaction for many rows: far faster than one tx per row */
  async putManyTrades(trades, journalId){
    if(!trades.length) return;
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['trades'],'readwrite');
      const st = tx.objectStore('trades');
      trades.forEach(t=>st.put({...t, journalId}));
      tx.oncomplete = ()=>res();
      tx.onerror = ()=>rej(tx.error);
      tx.onabort = ()=>rej(tx.error);
    });
  },
  async putManyChecklist(items, journalId){
    if(!items.length) return;
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['checklists'],'readwrite');
      const st = tx.objectStore('checklists');
      items.forEach(c=>st.put({...c, journalId}));
      tx.oncomplete = ()=>res();
      tx.onerror = ()=>rej(tx.error);
      tx.onabort = ()=>rej(tx.error);
    });
  },
  async addJournal(journal){
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['journals'],'readwrite');
      tx.objectStore('journals').put(journal);
      tx.oncomplete = ()=>res();
      tx.onerror = ()=>rej(tx.error);
    });
  },
  async deleteJournal(journalId){
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['journals','trades','checklists','settings'],'readwrite');
      tx.objectStore('journals').delete(journalId);
      tx.objectStore('settings').delete(journalId);
      const tStore = tx.objectStore('trades');
      const tReq = tStore.index('journalId').openKeyCursor(IDBKeyRange.only(journalId));
      tReq.onsuccess = ()=>{ const c = tReq.result; if(c){ tStore.delete(c.primaryKey); c.continue(); } };
      const cStore = tx.objectStore('checklists');
      const cReq = cStore.index('journalId').openKeyCursor(IDBKeyRange.only(journalId));
      cReq.onsuccess = ()=>{ const c = cReq.result; if(c){ cStore.delete(c.primaryKey); c.continue(); } };
      tx.oncomplete = ()=>res();
      tx.onerror = ()=>rej(tx.error);
    });
  },
  async putTrade(trade, journalId){
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['trades'],'readwrite');
      tx.objectStore('trades').put({...trade, journalId});
      tx.oncomplete = ()=>res();
      tx.onerror = ()=>rej(tx.error);
    });
  },
  async deleteTrade(tradeId){
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['trades'],'readwrite');
      tx.objectStore('trades').delete(tradeId);
      tx.oncomplete = ()=>res();
      tx.onerror = ()=>rej(tx.error);
    });
  },
  async putChecklistItem(item, journalId){
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['checklists'],'readwrite');
      tx.objectStore('checklists').put({...item, journalId});
      tx.oncomplete = ()=>res();
      tx.onerror = ()=>rej(tx.error);
    });
  },
  async deleteChecklistItem(itemId){
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['checklists'],'readwrite');
      tx.objectStore('checklists').delete(itemId);
      tx.oncomplete = ()=>res();
      tx.onerror = ()=>rej(tx.error);
    });
  },
  async clearJournalData(journalId){
    const d = await this.open();
    return new Promise((res,rej)=>{
      const tx = d.transaction(['trades','checklists'],'readwrite');
      const tStore = tx.objectStore('trades');
      const tReq = tStore.index('journalId').openKeyCursor(IDBKeyRange.only(journalId));
      tReq.onsuccess = ()=>{ const c = tReq.result; if(c){ tStore.delete(c.primaryKey); c.continue(); } };
      const cStore = tx.objectStore('checklists');
      const cReq = cStore.index('journalId').openKeyCursor(IDBKeyRange.only(journalId));
      cReq.onsuccess = ()=>{ const c = cReq.result; if(c){ cStore.delete(c.primaryKey); c.continue(); } };
      tx.oncomplete = ()=>res();
      tx.onerror = ()=>rej(tx.error);
    });
  }
};

/* ---------------- image compression ---------------- */
function compressImage(file, quality=0.7, maxWidth=1280){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = (ev)=>{
      const img = new Image();
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(w > maxWidth){ h = Math.round(h*maxWidth/w); w = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if(!ctx){ reject('no ctx'); return; }
        ctx.drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
