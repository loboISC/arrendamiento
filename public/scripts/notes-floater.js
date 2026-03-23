(function(){
  const LS_NOTES = 'cr_notes';
  const LS_FAB_POS = 'cr_fab_pos';
  const LS_FLOAT_POS = 'cr_float_pos';

  function injectStyles(){
    if (document.getElementById('cr-notes-styles')) return;
    const css = `
    .cr-fab{position:fixed;top:96px;right:12px;z-index:9999;width:52px;height:52px;border-radius:50%;border:0;background:#111827;color:#fff;display:grid;place-items:center;box-shadow:0 12px 30px rgba(0,0,0,.22);cursor:pointer}
    .cr-fab:hover{background:#0f172a}
    .cr-fab__badge{position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;font-weight:800;font-size:11px;border-radius:999px;padding:3px 6px;box-shadow:0 2px 10px rgba(0,0,0,.15)}
    .cr-floater{position:fixed;top:140px;right:76px;z-index:9998;width:min(520px,92vw);background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 18px 48px rgba(2,6,23,.28);overflow:hidden;display:flex;flex-direction:column}
    .cr-floater[hidden]{display:none!important}
    .cr-floater__header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;cursor:move}
    .cr-floater__body{padding:12px;max-height:60vh;overflow:auto}
    .cr-floater__close{border:0;background:transparent;width:32px;height:32px;border-radius:8px;display:grid;place-items:center;cursor:pointer;color:#334155}
    .cr-floater__close:hover{background:#e5e7eb}
    .cr-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;background:#eef2ff;color:#1e3a8a;border:1px solid #c7d2fe;font-size:12px}
    .cr-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:10px}
    .cr-row{display:grid;gap:8px}
    textarea#cr-note-text{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;font-size:14px}
    .cr-btn{appearance:none;border:0;background:#4f46e5;color:#fff;font-weight:700;border-radius:10px;padding:10px 14px;cursor:pointer;box-shadow:0 2px 10px rgba(79,70,229,.25)}
    .cr-location-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0;font-size:12px}
    .cr-summary-list{display:grid;gap:10px}
    `;
    const style = document.createElement('style');
    style.id = 'cr-notes-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function ensureUI(){
    if (!document.getElementById('cr-notes-fab')){
      const fab = document.createElement('button');
      fab.id = 'cr-notes-fab';
      fab.className = 'cr-fab';
      fab.type = 'button';
      fab.title = 'Notas de Cotización';
      fab.setAttribute('aria-label','Notas');
      fab.innerHTML = '<i class="fa-solid fa-note-sticky"></i><span id="cr-notes-count" class="cr-fab__badge" hidden>0</span>';
      document.body.appendChild(fab);
    }
    if (!document.getElementById('cr-notes-floater')){
      const floater = document.createElement('div');
      floater.id = 'cr-notes-floater';
      floater.className = 'cr-floater';
      floater.hidden = true;
      floater.innerHTML = `
        <div id="cr-notes-floater-head" class="cr-floater__header">
          <h3 id="cr-notes-title" style="margin:0; font-size:15px;"><i class="fa-solid fa-clipboard"></i> Notas de Cotización <span id="cr-notes-chip" class="cr-chip">0 notas</span></h3>
          <div class="cr-floater__actions">
            <button class="cr-floater__close" type="button" title="Cerrar" aria-label="Cerrar" data-close-notes><i class="fa-solid fa-xmark"></i></button>
          </div>
        </div>
        <div class="cr-floater__body">
          <div class="cr-card" style="margin-bottom:10px;">
            <h4 style="margin-top:0;display:flex;align-items:center;gap:8px;font-size:14px;"><i class="fa-solid fa-plus"></i> Agregar Nueva Nota <small id="cr-notes-step" class="cr-location-badge" style="margin-left:6px;">Paso actual</small></h4>
            <div class="cr-row">
              <textarea id="cr-note-text" rows="3" placeholder="Escribe una nota sobre este paso del proceso..."></textarea>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
                <small style="color:#64748b;">Tip: Ctrl + Enter para guardar rápidamente</small>
                <button id="cr-note-save" class="cr-btn" type="button" style="width:auto;"><i class="fa-solid fa-floppy-disk"></i> Guardar Nota</button>
              </div>
            </div>
          </div>
          <div id="cr-notes-list" class="cr-summary-list" style="max-height:40vh;"></div>
        </div>`;
      document.body.appendChild(floater);
    }
  }

  function currentStepLabel(){
    // Try to infer from visible sections if exist, else generic
    const s1 = document.getElementById('cr-step-products');
    const s2 = document.getElementById('cr-step-config');
    const s3 = document.getElementById('cr-step-shipping');
    if (s1 && !s1.hidden) return 'Paso 1 - Selección de Productos';
    if (s2 && !s2.hidden) return 'Paso 2 - Configuración';
    if (s3 && !s3.hidden) return 'Paso 3 - Accesorios';
    return 'Notas';
  }

  // State
  const state = { notes: [] };

  function loadNotes(){
    try{ const raw = localStorage.getItem(LS_NOTES); if(raw) state.notes = JSON.parse(raw)||[]; }catch{}
  }
  function saveNotes(){ try{ localStorage.setItem(LS_NOTES, JSON.stringify(state.notes)); }catch{} }
  function updateCounters(){
    const n = state.notes.length;
    const badge = document.getElementById('cr-notes-count');
    const chip = document.getElementById('cr-notes-chip');
    if (badge){ badge.textContent = String(n); badge.hidden = n===0; }
    if (chip){ chip.textContent = `${n} nota${n===1?'':'s'}`; }
  }
  function renderNotes(){
    const list = document.getElementById('cr-notes-list');
    if(!list) return; list.innerHTML='';
    const fmt = new Intl.DateTimeFormat('es-MX',{dateStyle:'short',timeStyle:'short'});
    state.notes.slice().reverse().forEach(note=>{
      const row = document.createElement('div');
      row.className='cr-card';
      row.style.padding='10px 12px';
      row.style.display='grid';
      row.style.gap='6px';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <small style="color:#64748b;">${fmt.format(new Date(note.ts))}</small>
          <span class="cr-location-badge">${note.step}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="white-space:pre-wrap;">${note.text}</div>
          <div style="display:flex;gap:8px;">
            <button class="cr-floater__close" title="Eliminar" aria-label="Eliminar"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`;
      row.querySelector('button')?.addEventListener('click',()=>{
        state.notes = state.notes.filter(n=>n.id!==note.id);
        saveNotes(); renderNotes(); updateCounters();
      });
      list.appendChild(row);
    });
  }

  function openFloater(){
    const floater = document.getElementById('cr-notes-floater');
    const step = document.getElementById('cr-notes-step');
    if (!floater) return;
    if (step) step.textContent = currentStepLabel();
    floater.hidden = false;
    floater.setAttribute('aria-hidden','false');
    floater.style.pointerEvents = 'auto';
    setTimeout(()=>document.getElementById('cr-note-text')?.focus(),10);
    renderNotes();
  }
  function closeFloater(e){
    const floater = document.getElementById('cr-notes-floater');
    if (e) e.stopPropagation();
    if (floater){
      floater.hidden = true;
      floater.setAttribute('aria-hidden','true');
      floater.style.pointerEvents = 'none';
    }
  }

  function enableFloaterDrag(){
    const head = document.getElementById('cr-notes-floater-head');
    const floater = document.getElementById('cr-notes-floater');
    if (!head || !floater) return;
    let dragging=false,moved=false,startX=0,startY=0,startLeft=0,startTop=0;
    const onMove=(e)=>{
      if(!dragging) return; const cx=e.clientX??e.touches?.[0]?.clientX; const cy=e.clientY??e.touches?.[0]?.clientY; if(cx==null||cy==null) return;
      const dx=cx-startX, dy=cy-startY; if(Math.abs(dx)+Math.abs(dy)>3) moved=true;
      let nl=startLeft+dx, nt=startTop+dy; const maxL=window.innerWidth - floater.offsetWidth - 12; const maxT=window.innerHeight - floater.offsetHeight - 12;
      nl=Math.max(12,Math.min(maxL,nl)); nt=Math.max(72,Math.min(maxT,nt));
      floater.style.left=nl+'px'; floater.style.top=nt+'px'; floater.style.right='auto'; e.preventDefault();
      try{ localStorage.setItem(LS_FLOAT_POS, JSON.stringify({left:nl, top:nt})); }catch{}
    };
    const onUp=()=>{dragging=false;window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',onUp)};
    const onDown=(e)=>{
      const t=e.target; const tag=(t.tagName||'').toLowerCase();
      if (t.closest('[data-close-notes]') || tag==='button' || tag==='input' || tag==='textarea' || tag==='select' || t.closest('button') || t.closest('a')) return;
      dragging=true; moved=false; const rect=floater.getBoundingClientRect(); const cx=e.clientX??e.touches?.[0]?.clientX; const cy=e.clientY??e.touches?.[0]?.clientY; startX=cx; startY=cy; startLeft=rect.left; startTop=rect.top;
      window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp); window.addEventListener('touchmove',onMove,{passive:false}); window.addEventListener('touchend',onUp); e.preventDefault();
    };
    head.addEventListener('mousedown',onDown); head.addEventListener('touchstart',onDown,{passive:false});
    try{ const raw=localStorage.getItem(LS_FLOAT_POS); if(raw){ const p=JSON.parse(raw); if(typeof p.left==='number'&&typeof p.top==='number'){ floater.style.left=p.left+'px'; floater.style.top=p.top+'px'; floater.style.right='auto'; } } }catch{}
  }

  function enableFabDrag(){
    const fab=document.getElementById('cr-notes-fab'); if(!fab) return;
    let dragging=false,moved=false,startX=0,startY=0,startLeft=0,startTop=0;
    const onMove=(e)=>{ if(!dragging) return; const cx=e.clientX??e.touches?.[0]?.clientX; const cy=e.clientY??e.touches?.[0]?.clientY; if(cx==null||cy==null) return; const dx=cx-startX,dy=cy-startY; if(Math.abs(dx)+Math.abs(dy)>3) moved=true; let nl=startLeft+dx, nt=startTop+dy; const maxL=window.innerWidth - fab.offsetWidth - 6; const maxT=window.innerHeight - fab.offsetHeight - 6; nl=Math.max(6,Math.min(maxL,nl)); nt=Math.max(60,Math.min(maxT,nt)); fab.style.left=nl+'px'; fab.style.top=nt+'px'; fab.style.right='auto'; e.preventDefault(); };
    const onUp=()=>{ if(!dragging) return; dragging=false; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); window.removeEventListener('touchmove',onMove); window.removeEventListener('touchend',onUp); try{ const r=fab.getBoundingClientRect(); localStorage.setItem(LS_FAB_POS, JSON.stringify({top:r.top,left:r.left})); }catch{} if(moved){ fab.__suppressClick=true; setTimeout(()=>{fab.__suppressClick=false;},0);} };
    const onDown=(e)=>{ dragging=true; moved=false; const r=fab.getBoundingClientRect(); const cx=e.clientX??e.touches?.[0]?.clientX; const cy=e.clientY??e.touches?.[0]?.clientY; startX=cx; startY=cy; startLeft=r.left; startTop=r.top; window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp); window.addEventListener('touchmove',onMove,{passive:false}); window.addEventListener('touchend',onUp); e.preventDefault(); };
    fab.addEventListener('mousedown',onDown); fab.addEventListener('touchstart',onDown,{passive:false});
    fab.addEventListener('click', (e)=>{ if(fab.__suppressClick) return; const floater=document.getElementById('cr-notes-floater'); if(!floater.hidden){ floater.hidden=true; } else { openFloater(); } });
    try{ const raw=localStorage.getItem(LS_FAB_POS); if(raw){ const p=JSON.parse(raw); if(typeof p.left==='number'&&typeof p.top==='number'){ fab.style.left=p.left+'px'; fab.style.top=p.top+'px'; fab.style.right='auto'; } } }catch{}
  }

  function wireLogic(){
    injectStyles();
    ensureUI();
    loadNotes();
    updateCounters();
    enableFabDrag();
    enableFloaterDrag();
    // Delegated close handler to be robust across re-renders
    document.addEventListener('click', (e)=>{
      const closeBtn = e.target.closest && e.target.closest('[data-close-notes]');
      if (closeBtn){ closeFloater(e); }
    });
    const saveBtn = document.getElementById('cr-note-save');
    const noteInput = document.getElementById('cr-note-text');
    saveBtn?.addEventListener('click', ()=>{ const t = (noteInput?.value||'').trim(); if(!t) return; state.notes.push({id:'n_'+Date.now(),ts:Date.now(),step:currentStepLabel(),text:t}); saveNotes(); noteInput.value=''; updateCounters(); renderNotes(); });
    noteInput?.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && (e.ctrlKey||e.metaKey)){ e.preventDefault(); saveBtn?.click(); }});
    window.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ closeFloater(e); }});
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', wireLogic); else wireLogic();
})();
