(function(){
  let currentMode = 'MIXTO'; // RENTA | VENTA | MIXTO
  let currentItems = [];
  let currentMeta = null; // folio, moneda, cliente, dias

  function setText(id, value){ const el=document.getElementById(id); if(el) el.textContent = value ?? '—'; }

  function populateHeaderFromSnapshot(data){
    try{
      if(!data) return;
      setText('quote-number', data.folio || '—');
      setText('currency-code', data.moneda || 'MXN');
      const c = data.cliente || {};
      setText('client-nombre', c.nombre || c.name || 'Público en General');
      setText('client-email', c.email || c.correo || 'ventas@andamiostorres.com');
      setText('client-rfc', c.rfc || '—');
      setText('client-tel', c.telefono || c.celular || '—');
      setText('client-cp', c.cp || c.codigo_postal || '—');
      setText('client-ciudad', c.ciudad || c.municipio || c.estado || '—');
      setText('client-domicilio', c.domicilio || c.direccion || '—');
    }catch(e){ /* noop */ }
  }

  function parseWeightKg(val){
    if(val == null) return 0;
    if(typeof val === 'number' && isFinite(val)) return val;
    if(typeof val !== 'string') return Number(val)||0;
    const s = val.trim().toLowerCase();
    // Replace comma decimals and strip thousands separators
    const normalized = s.replace(/\s/g,'').replace(/,/g,'.');
    // Detect unit
    const isGram = /g(?![a-z])/i.test(normalized) && !/kg/i.test(normalized);
    const m = normalized.match(/-?\d*\.?\d+/);
    if(!m) return 0;
    let n = parseFloat(m[0]);
    if(!isFinite(n)) return 0;
    if(isGram) n = n / 1000;
    return n;
  }

  function setConditionsFromSnapshot(data){
    try{
      const ta=document.getElementById('cr-summary-conditions');
      if(!ta) return;
      const cond=(data && (data.condiciones || data.conditions || data.nota || data.notas)) || '';
      if(cond && !ta.value) ta.value = String(cond);
    }catch(_){ }
  }

  // ===== Resumen de Cotización (card) =====
  function getDiscountState(){
    const applySel = document.getElementById('cr-summary-apply-discount');
    const pctInp = document.getElementById('cr-summary-discount-percent-input');
    const apply = (applySel?.value||'no') === 'si';
    const pct = Math.max(0, Math.min(100, Number(pctInp?.value||0)));
    if(pctInp) pctInp.disabled = !apply;
    return { apply, pct };
  }

  function calcItemTotals(items){
    // Nota: para el PDF se solicita sin descuentos; garantía con precio de venta
    let subtotal=0, weight=0;
    const rows = items.map((it, idx)=>{
      const qty = Number(it.cantidad||1);
      const days = Number(it.dias || (currentMeta?.dias ?? 1) || 1);
      const unit = Number(it.unitPrice||0);
      const saleUnit = Number(it.salePrice || it.unitVenta || 0) || unit;
      const importe = qty * unit * (currentMode==='VENTA' ? 1 : days);
      const garantia = qty * saleUnit;
      const unitW = parseWeightKg(it.peso ?? it.weight ?? 0);
      const totalW = unitW * qty;
      subtotal += importe;
      weight += totalW;
      return { idx: idx+1, img: it.imagen, clave: it.clave, desc: it.nombre || it.descripcion || '', qty, days, unit, garantia, importe, pesoUnit: unitW, pesoTotal: totalW };
    });
    return { rows, subtotal, weight };
  }

  function renderSummaryCard(items){
    const tbody = document.getElementById('cr-summary-rows'); if(!tbody) return; tbody.innerHTML='';
    const { rows, subtotal, weight } = calcItemTotals(items||[]);
    // Mostrar/ocultar encabezado de Garantía según modo
    try {
      const garTh = document.querySelector('thead .col-garantia');
      if (garTh) { garTh.style.display = (currentMode === 'RENTA') ? '' : 'none'; }
    } catch(_){}
    for(const r of rows){
      const tr=document.createElement('tr');
      // IMG/CLAVE combinado
      const tdImg=document.createElement('td'); tdImg.style.textAlign='center'; tdImg.title = r.clave || '';
      const img=document.createElement('img'); img.src=r.img||'img/logo-demo.jpg'; img.alt=(r.clave||'IMG'); img.style.width='40px'; img.style.height='40px'; img.style.objectFit='cover'; img.style.borderRadius='6px'; img.onerror=function(){ this.src='img/default.jpg'; };
      const claveSmall=document.createElement('div'); claveSmall.style.fontSize='10px'; claveSmall.style.color='#64748b'; claveSmall.style.marginTop='2px'; claveSmall.textContent=r.clave||'-';
      tdImg.appendChild(img); tdImg.appendChild(claveSmall); tr.appendChild(tdImg);
      // Part.
      const tdPart=document.createElement('td'); tdPart.textContent=String(r.idx); tr.appendChild(tdPart);
      // Peso (por producto, p/u)
      const tdPeso=document.createElement('td'); tdPeso.textContent=formatWeightKg(r.pesoUnit ?? 0); tr.appendChild(tdPeso);
      // Descripción
      const tdDesc=document.createElement('td'); tdDesc.style.textAlign='left'; tdDesc.textContent=r.desc||'-'; tr.appendChild(tdDesc);
      // Cant.
      const tdQty=document.createElement('td'); tdQty.textContent=String(r.qty||1); tr.appendChild(tdQty);
      // P. Unit.
      const tdUnit=document.createElement('td'); tdUnit.className='nowrap-cell'; tdUnit.textContent=formatCurrency(r.unit||0); tr.appendChild(tdUnit);
      // Garantía (solo en RENTA)
      if (currentMode === 'RENTA') {
        const tdGar=document.createElement('td'); tdGar.className='nowrap-cell'; tdGar.textContent=formatCurrency(r.garantia||0); tr.appendChild(tdGar);
      }
      // Importe (qty * unit * days renta | 1 si venta)
      const tdImp=document.createElement('td'); tdImp.className='nowrap-cell'; tdImp.textContent=formatCurrency(r.importe||0); tr.appendChild(tdImp);
      tbody.appendChild(tr);
    }
    // Totales
    const subtotalEl=document.getElementById('cr-total-subtotal'); if(subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    const ivaEl=document.getElementById('cr-total-iva'); if(ivaEl) ivaEl.textContent = formatCurrency(subtotal*0.16);
    const totalEl=document.getElementById('cr-total-total'); if(totalEl) totalEl.textContent = formatCurrency(subtotal*1.16);
    const wEl=document.getElementById('cr-total-weight'); if(wEl) wEl.textContent = formatWeightKg(weight);
  }

  function wireSummaryControls(){
    const sel=document.getElementById('cr-summary-apply-discount');
    const inp=document.getElementById('cr-summary-discount-percent-input');
    if(sel){ sel.addEventListener('change', ()=>renderSummaryCard(currentItems)); }
    if(inp){ inp.addEventListener('input', ()=>renderSummaryCard(currentItems)); }
    // Sync initial disabled state
    getDiscountState();
  }

  function readActiveQuote(){
    try{
      let raw = null;
      try { raw = sessionStorage.getItem('active_quote'); } catch(_) {}
      if(!raw){ try { raw = localStorage.getItem('active_quote'); } catch(_) {} }
      // Fallback: intentar leer desde la ventana que abrió el reporte
      if(!raw && typeof window !== 'undefined' && window.opener){
        try { raw = window.opener.sessionStorage?.getItem('active_quote') || null; } catch(_) {}
        if(!raw){ try { raw = window.opener.localStorage?.getItem('active_quote') || null; } catch(_) {} }
        // Persistir localmente para siguientes operaciones
        if(raw){ try { localStorage.setItem('active_quote', raw); } catch(_) {} }
      }
      if(!raw) return null;
      const data = JSON.parse(raw);
      currentMode = data?.tipo || 'MIXTO';
      currentMeta = { folio: data?.folio || null, moneda: data?.moneda || 'MXN', dias: data?.dias || 1, cliente: data?.cliente || null };
      const items = Array.isArray(data?.items) ? data.items : [];
      // Normalizar a estructura de filas para la tabla
      currentItems = items.map(it => {
        const cantidad = Number(it.cantidad || it.qty || 1);
        // Modo de cálculo según tipo
        const unitVenta = Number(it.precio_unitario_venta ?? it.precio_venta ?? it.sale ?? it.pventa ?? 0);
        const unitRenta = Number(it.precio_unitario_renta ?? it.precio_unitario ?? it.price ?? 0);
        const unitPrice = (currentMode === 'VENTA' && unitVenta > 0) ? unitVenta : unitRenta;
        const importe = Number(it.importe ?? (unitPrice * cantidad));
        return {
          clave: it.sku || it.clave || it.codigo || it.id || '',
          imagen: it.imagen || it.image || it.img || '',
          nombre: it.nombre || it.name || '',
          descripcion: it.descripcion || it.desc || '',
          almacen: data?.almacen?.nombre || data?.almacen || '',
          unidad: it.unidad || 'PZA',
          cantidad,
          dias: Number(it.dias || data?.dias || 1),
          unitPrice,
          salePrice: unitVenta,
          peso: Number(
            it.peso ?? it.weight ?? it.peso_kg ?? it.pesoUnitario ?? it.pesoUnit ?? it.peso_unit ?? it.kg ?? it.kilos ?? it.weightKg ?? it.weight_kg ??
            (it.producto && (it.producto.peso ?? it.producto.peso_kg)) ??
            (it.product && (it.product.weight ?? it.product.peso ?? it.product.peso_kg)) ??
            (it.data && (it.data.weight ?? it.data.peso ?? it.data.peso_kg)) ??
            (it.item && (it.item.weight ?? it.item.peso ?? it.item.peso_kg)) ??
            (it.articulo && (it.articulo.peso ?? it.articulo.peso_kg)) ??
            (it.module && (it.module.weight ?? it.module.peso)) ??
            (it.accesorio && (it.accesorio.peso ?? it.accesorio.weight)) ?? 0
          ),
          importe,
          totalRenta: (currentMode === 'VENTA') ? 0 : importe,
          totalVenta: (currentMode === 'VENTA') ? importe : 0
        };
      });
      populateHeaderFromSnapshot(data);
      setConditionsFromSnapshot(data);
      return data;
    }catch(e){
      console.warn('No se pudo leer active_quote:', e);
      return null;
    }
  }
  function fmtDate(d){ const pad=n=>String(n).padStart(2,'0'); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
  function fmtDateTime(d){ const pad=n=>String(n).padStart(2,'0'); return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function setHeaderTimestamps(){ const now=new Date(); const elDate=document.getElementById('current-date'); const elTs=document.getElementById('creation-timestamp'); if(elDate) elDate.textContent=fmtDate(now); if(elTs) elTs.textContent=fmtDateTime(now); }
  function getSelectedColumns(){ return { clave:document.getElementById('filter-clave')?.checked ?? true, imagen:document.getElementById('filter-imagen')?.checked ?? true, nombre:document.getElementById('filter-nombre')?.checked ?? true, descripcion:document.getElementById('filter-descripcion')?.checked ?? true, almacenes:document.getElementById('filter-almacenes')?.checked ?? true, pventa:document.getElementById('filter-pventa')?.checked ?? true, prenta:document.getElementById('filter-prenta')?.checked ?? true }; }
  function buildTableHeader(){
    const head=document.getElementById('quotes-table-head'); if(!head) return; head.innerHTML='';
    const sel=getSelectedColumns();
    const tr=document.createElement('tr');
    if(sel.clave||sel.imagen){ const th=document.createElement('th'); th.className='text-left text-xs font-semibold text-gray-700 uppercase tracking-wider'; th.textContent='IMG/CLAVE'; tr.appendChild(th);} 
    // Columnas de cantidad y unidad cuando hay snapshot/ítems
    const hasSnapshot = currentItems && currentItems.length>0;
    if(hasSnapshot){
      const thC=document.createElement('th'); thC.className='text-center text-xs font-semibold text-gray-700 uppercase tracking-wider nowrap-cell'; thC.textContent='CANT'; tr.appendChild(thC);
      const thU=document.createElement('th'); thU.className='text-center text-xs font-semibold text-gray-700 uppercase tracking-wider nowrap-cell'; thU.textContent='UNIDAD'; tr.appendChild(thU);
    }
    if(sel.nombre||sel.descripcion){ const th=document.createElement('th'); th.className='text-left text-xs font-semibold text-gray-700 uppercase tracking-wider'; th.textContent='DESCRIPCIÓN'; tr.appendChild(th);} 
    if(sel.almacenes){ const th=document.createElement('th'); th.className='text-left text-xs font-semibold text-gray-700 uppercase tracking-wider'; th.textContent='ALMACÉN'; tr.appendChild(th);} 
    // Columnas de precio
    const hasUnitAndImporte = currentItems.some(x => x.unitPrice || x.importe);
    if(hasUnitAndImporte){
      const thPU=document.createElement('th'); thPU.className='text-right text-xs font-semibold text-gray-700 uppercase tracking-wider nowrap-cell'; thPU.textContent='P. UNIT.'; tr.appendChild(thPU);
      const thI=document.createElement('th'); thI.className='text-right text-xs font-semibold text-gray-700 uppercase tracking-wider nowrap-cell'; thI.textContent='IMPORTE'; tr.appendChild(thI);
    } else {
      if(sel.pventa){ const th=document.createElement('th'); th.className='text-right text-xs font-semibold text-gray-700 uppercase tracking-wider nowrap-cell'; th.textContent='P. VENTA'; tr.appendChild(th);} 
      if(sel.prenta){ const th=document.createElement('th'); th.className='text-right text-xs font-semibold text-gray-700 uppercase tracking-wider nowrap-cell'; th.textContent='P. RENTA'; tr.appendChild(th);} 
    }
    head.appendChild(tr);
  }
  function formatCurrency(value){ try{ return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(value)||0);}catch(e){ return `$${(Number(value)||0).toFixed(2)}`; } }
  function formatWeightKg(value){ const n=Number(value)||0; return `${n.toFixed(2)} kg`; }
  function renderTableRows(quotes){
    const body=document.getElementById('quotes-table-body');
    const emptyMsg=document.getElementById('empty-table-message');
    const totalsBox=document.getElementById('totals-section');
    if(!body) return; body.innerHTML='';
    if(!quotes||quotes.length===0){ if(emptyMsg) emptyMsg.classList.remove('hidden'); if(totalsBox) totalsBox.style.display='none'; return; }
    if(emptyMsg) emptyMsg.classList.add('hidden');
    const sel=getSelectedColumns();
    const hasUnitAndImporte = quotes.some(x => x.unitPrice || x.importe);
    let totalImporte = 0;
    for(const q of quotes){
      const tr=document.createElement('tr');
      if(sel.clave||sel.imagen){ const td=document.createElement('td'); td.className='align-top'; const wrap=document.createElement('div'); wrap.className='flex items-center space-x-2'; if(sel.imagen){ const img=document.createElement('img'); img.src=q.imagen||'img/logo-demo.jpg'; img.alt='img'; img.className='w-10 h-10 object-cover rounded'; wrap.appendChild(img);} if(sel.clave){ const span=document.createElement('span'); span.className='font-semibold text-gray-800'; span.textContent=q.clave||q.folio||'-'; wrap.appendChild(span);} td.appendChild(wrap); tr.appendChild(td);} 
      // Cantidad y unidad si hay snapshot
      if(currentItems && currentItems.length>0){
        const tdC=document.createElement('td'); tdC.className='text-center nowrap-cell'; tdC.textContent=String(q.cantidad ?? 1); tr.appendChild(tdC);
        const tdU=document.createElement('td'); tdU.className='text-center nowrap-cell'; tdU.textContent=q.unidad || 'PZA'; tr.appendChild(tdU);
      }
      if(sel.nombre||sel.descripcion){ const td=document.createElement('td'); const name=document.createElement('div'); name.className='text-gray-900 font-medium'; name.textContent=q.nombre||q.titulo||q.cliente?.nombre||'Cotización'; const desc=document.createElement('div'); desc.className='text-gray-600 text-sm product-description'; if(sel.descripcion){ desc.textContent=q.descripcion||q.notas||''; } td.appendChild(name); if(sel.descripcion) td.appendChild(desc); tr.appendChild(td);} 
      if(sel.almacenes){ const td=document.createElement('td'); td.textContent=q.almacen||q.ubicacion||'-'; tr.appendChild(td);} 
      if(hasUnitAndImporte){ const tdU=document.createElement('td'); tdU.className='text-right nowrap-cell'; tdU.textContent=formatCurrency(q.unitPrice||0); tr.appendChild(tdU); const tdI=document.createElement('td'); tdI.className='text-right nowrap-cell'; tdI.textContent=formatCurrency(q.importe||0); tr.appendChild(tdI); totalImporte += Number(q.importe||0); }
      else { if(sel.pventa){ const td=document.createElement('td'); td.className='text-right nowrap-cell'; td.textContent=formatCurrency(q.totalVenta ?? q.total_venta ?? q.total ?? 0); tr.appendChild(td);} if(sel.prenta){ const td=document.createElement('td'); td.className='text-right nowrap-cell'; td.textContent=formatCurrency(q.totalRenta ?? q.total_renta ?? q.total ?? 0); tr.appendChild(td);} }
      body.appendChild(tr);
    }
    // Fila de total cuando hay importe
    if(hasUnitAndImporte){
      const tr=document.createElement('tr');
      const hasSnapshot = currentItems && currentItems.length>0;
      const colCount = (sel.clave||sel.imagen?1:0) + (hasSnapshot?2:0) + (sel.nombre||sel.descripcion?1:0) + (sel.almacenes?1:0) + 1; // +1 por P. UNIT.
      for(let i=0;i<colCount;i++){ const td=document.createElement('td'); td.textContent=''; tr.appendChild(td);} 
      const tdTotal=document.createElement('td'); tdTotal.className='text-right nowrap-cell'; tdTotal.textContent=formatCurrency(totalImporte); tr.appendChild(tdTotal);
      body.appendChild(tr);
    }

    // Totales (Subtotal, IVA, Total)
    if(totalsBox){
      const subtotal = totalImporte;
      const iva = subtotal * 0.16;
      const total = subtotal + iva;
      const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent = formatCurrency(val); };
      set('total-subtotal', subtotal);
      set('total-iva', iva);
      set('total-total', total);
      totalsBox.style.display = '';
    }
  }
  function onFiltersChange(){ buildTableHeader(); renderTableRows(currentItems); }
  function wireFilters(){ ['filter-clave','filter-imagen','filter-nombre','filter-descripcion','filter-almacenes','filter-pventa','filter-prenta'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.addEventListener('change', onFiltersChange);} }); }
  let __pdfRunning = false;
  function generatePDF(){
    if (__pdfRunning) return; __pdfRunning = true;
    const elem=document.getElementById('pdf-template'); if(!elem){ __pdfRunning=false; return; }
    const opt={ margin:[0.2,0.2,0.2,0.2], filename:`reporte_cotizaciones_${Date.now()}.pdf`, image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2,useCORS:true}, jsPDF:{unit:'in',format:'letter',orientation:'portrait'} };
    try { document.body.classList.add('pdf-mode'); } catch(_) {}
    window.html2pdf().set(opt).from(elem).save().then(()=>{
      try { document.body.classList.remove('pdf-mode'); } catch(_) {}
      __pdfRunning = false;
    }).catch(()=>{
      try { document.body.classList.remove('pdf-mode'); } catch(_) {}
      __pdfRunning = false;
    });
  }
  function printReport(){ window.print(); }
  function generateTestPDF(){ generatePDF(); } function generatePDFWithPrint(){ generatePDF(); }
  function wireButtons(){ const btn=document.getElementById('download-pdf-btn'); if(btn){ btn.addEventListener('click', generatePDF);} window.printReport=printReport; window.generateTestPDF=generateTestPDF; window.generatePDFWithPrint=generatePDFWithPrint; }
  function maybeAutoGenerate(){ try{ const params=new URLSearchParams(window.location.search); if(params.get('auto')==='1'){ setTimeout(()=>{ generatePDF(); }, 700); } }catch(e){} }
  function goBack(){
    try {
      if (window.opener && !window.opener.closed) {
        try { window.opener.focus(); } catch(_) {}
        window.close();
        return;
      }
    } catch(_) {}
    // No opener: prefer navigating back over closing the entire app window
    try { window.history.back(); } catch(_) {}
  }
  try { window.goBack = goBack; } catch(_) {}
  function bootRender(){
    wireFilters();
    wireSummaryControls();
    renderSummaryCard(currentItems);
    try{ buildTableHeader(); renderTableRows(currentItems); }catch(e){}
    wireButtons();
    maybeAutoGenerate();
  }

  document.addEventListener('DOMContentLoaded', function(){
    setHeaderTimestamps();
    // Reintento para cargar snapshot si aún no está disponible
    let attempts = 0;
    const maxAttempts = 20; // aumentar ventana de espera a ~3s
    const tryInit = () => {
      const snap = readActiveQuote();
      if((currentItems && currentItems.length) || attempts >= maxAttempts){
        try { console.log('[REPORTE] Datos detectados:', { items: currentItems?.length||0, attempts }); } catch(_) {}
        bootRender();
      } else {
        attempts++;
        setTimeout(tryInit, 150);
      }
    };
    tryInit();

    // Solicitar datos al opener (página de renta/venta) como fallback
    try {
      if (window.opener) {
        let askCount = 0;
        const askMax = 15; // ~4.5s
        const askTimer = setInterval(() => {
          askCount++;
          try { window.opener.postMessage({ type: 'request_active_quote' }, '*'); } catch(_) {}
          if ((currentItems && currentItems.length) || askCount >= askMax) {
            clearInterval(askTimer);
          }
        }, 300);
      }
    } catch(_) {}
  });

  // Recibir snapshot por postMessage
  try {
    window.addEventListener('message', (ev)=>{
      const msg = ev?.data;
      if(!msg || typeof msg !== 'object') return;
      if(msg.type === 'active_quote' && msg.data){
        try { console.log('[REPORTE] Snapshot recibido via postMessage:', { items: Array.isArray(msg.data?.items)? msg.data.items.length : 0, tipo: msg.data?.tipo }); } catch(_) {}
        try { localStorage.setItem('active_quote', JSON.stringify(msg.data)); } catch(_) {}
        // Releer y re-renderizar
        const data = readActiveQuote();
        setConditionsFromSnapshot(data || msg.data);
        renderSummaryCard(currentItems);
        try{ buildTableHeader(); renderTableRows(currentItems); }catch(e){}
      }
    });
  } catch(_){}
})();
