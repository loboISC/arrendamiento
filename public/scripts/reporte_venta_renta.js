(function(){
  let currentMode = 'MIXTO'; // RENTA | VENTA | MIXTO
  let currentItems = [];
  let currentMeta = null; // folio, moneda, cliente, dias
  let currentSnapshot = null; // snapshot completo para sincronizar totales externos (garantía, IVA, etc.)

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

  function showTotalsFallbackIfHidden(){
    try{
      const tbl = document.getElementById('cr-totals-paired-table');
      const host = tbl ? tbl.parentElement : null;
      if (!host) return;
      const hidden = !tbl || tbl.offsetHeight === 0 || tbl.offsetWidth === 0;
      let fb = document.getElementById('cr-totals-fallback');
      if (!hidden){ if (fb) fb.remove(); return; }
      if (!fb){
        fb = document.createElement('div');
        fb.id = 'cr-totals-fallback';
        fb.className = 'soft-border';
        fb.style.cssText = 'padding:8px; background:#fff;';
        host.appendChild(fb);
      }
      const getTxt = id => document.getElementById(id)?.textContent || '';
      fb.innerHTML = `
        <div style="display:grid; grid-template-columns: 1fr auto; gap:6px; font-size:12px; color:#334155;">
          <div style="font-weight:600;">SUB-TOTAL:</div><div>${getTxt('cr-fin-subtotal')}</div>
          <div style="font-weight:600;">COSTO DE ENVÍO:</div><div>${getTxt('cr-fin-shipping')}</div>
          <div id="fb-iva-row" style="display:${(document.getElementById('cr-iva-row')?.style.display==='none')?'none':'contents'};">
            <div style="font-weight:600;">IVA (16%):</div><div>${getTxt('cr-fin-iva')}</div>
          </div>
          <div style="font-weight:800; border-top:1px solid #e5e7eb; padding-top:4px;">TOTAL:</div><div style="font-weight:800; color:#0f766e; border-top:1px solid #e5e7eb; padding-top:4px;">${getTxt('cr-fin-total')}</div>
        </div>
      `;
    }catch(_){ }
  }

  // Validar totales mostrados vs. snapshot.totals
  function validateTotalsAgainstSnapshot(){
    try{
      if (!currentSnapshot || !currentSnapshot.totals) return;
      const t = currentSnapshot.totals;
      const getNum = (id) => parseMoney(document.getElementById(id)?.textContent || '');
      const domSub = getNum('cr-fin-subtotal');
      const domIva = getNum('cr-fin-iva');
      const domTot = getNum('cr-fin-total');
      const diffs = [];
      const eps = 0.01;
      if (typeof t.subtotal !== 'undefined' && Math.abs(domSub - Number(t.subtotal)) > eps) diffs.push({ campo: 'subtotal', dom: domSub, snapshot: Number(t.subtotal) });
      if (typeof t.iva !== 'undefined' && Math.abs(domIva - Number(t.iva)) > eps) diffs.push({ campo: 'iva', dom: domIva, snapshot: Number(t.iva) });
      if (typeof t.total !== 'undefined' && Math.abs(domTot - Number(t.total)) > eps) diffs.push({ campo: 'total', dom: domTot, snapshot: Number(t.total) });
      if (diffs.length){
        // Auditoría en consola sin afectar UI
        try { console.warn('[REPORTE][VALIDACION] Diferencias en totales (DOM vs snapshot):', diffs); } catch(_){ }
      }
    }catch(_){ }
  }

  // Asegurar visibilidad de la tabla de costos y re-alinear en cambios
  function ensureTotalsVisible(){
    try{
      const tbl = document.getElementById('cr-totals-paired-table');
      if (!tbl) return;
      const cont = tbl.closest('.cr-summary-totals') || tbl.parentElement;
      if (cont) {
        const contStyle = window.getComputedStyle(cont);
        if (contStyle.display === 'none') cont.style.display = '';
      }
      const cs = window.getComputedStyle(tbl);
      if (cs.display === 'none') tbl.style.display = 'table';
      if (cs.visibility === 'hidden') tbl.style.visibility = 'visible';
      try {
        requestAnimationFrame(()=>{
          try { alignTotalsToImporte(); } catch(_){ }
          requestAnimationFrame(()=>{ 
            try { alignTotalsToImporte(); } catch(_){ }
            // Fallback duro: si sigue sin ocupar ancho, forzar layout estático visible
            try {
              if (tbl.offsetWidth === 0) {
                forceStaticTotals();
              }
            } catch(_){ }
          });
        });
      } catch(_){ }
    }catch(_){ }
  }

  function forceStaticTotals(){
    try{
      const tbl = document.getElementById('cr-totals-paired-table');
      if (!tbl) return;
      // Mostrar tabla sin alineación avanzada
      tbl.style.position = 'relative';
      tbl.style.left = '';
      tbl.style.right = '';
      tbl.style.width = '100%';
      tbl.style.maxWidth = '';
      tbl.style.margin = '0';
      tbl.style.display = 'table';
      tbl.style.visibility = 'visible';
    }catch(_){ }
  }

  function observeSummaryRows(){
    try{
      const body = document.getElementById('cr-summary-rows');
      if (!body || body.__obsInstalled) return;
      const obs = new MutationObserver(()=>{
        try { ensureTotalsVisible(); alignTotalsToImporte(); } catch(_){ }
      });
      obs.observe(body, { childList: true, subtree: false });
      body.__obsInstalled = true;
    }catch(_){ }
  }

  // Poblar bloque de VENDEDOR (nombre, correo, puesto)
  function populateVendorFromUser(user){
    try{
      if(!user) return;
      setText('vendor-nombre', user.nombre || user.name || '—');
      setText('vendor-email', user.correo || user.email || '—');
      setText('vendor-rol', user.rol || user.puesto || '—');
      // Componer línea central: "Nombre, Tel. 555..., correo"
      const parts = [];
      const nombre = user.nombre || user.name;
      if (nombre) parts.push(nombre);
      const tel = user.telefono || user.celular || user.tel || user.phone;
      if (tel) parts.push(`Tel. ${tel}`);
      const correo = user.correo || user.email;
      if (correo) parts.push(correo);
      const line = parts.length ? parts.join(', ') : '—';
      setText('vendor-line', line);
    }catch(_){ }
  }

  function tryPopulateVendor(){
    // 1) currentUser (esquema moderno de auth.js)
    try{ const s = localStorage.getItem('currentUser'); if(s){ try{ populateVendorFromUser(JSON.parse(s)); return; }catch(_){} } }catch(_){ }
    // 2) opener
    try{ if(window.opener){ const s2 = window.opener.localStorage?.getItem('currentUser'); if(s2){ try{ populateVendorFromUser(JSON.parse(s2)); return; }catch(_){} } } }catch(_){ }
    // 3) user (algunos módulos guardan este formato)
    try{ const s3 = localStorage.getItem('user'); if(s3){ try{ populateVendorFromUser(JSON.parse(s3)); return; }catch(_){} } }catch(_){ }
  }

  // Alinear la tabla de totales debajo de la columna 'Importe'
  function alignTotalsToImporte(){
    try{
      const totalsTable = document.getElementById('cr-totals-paired-table');
      if (!totalsTable) return;
      // Alineación simplificada: ocupar toda la columna derecha del grid
      totalsTable.style.position = 'relative';
      totalsTable.style.left = '';
      totalsTable.style.right = '';
      totalsTable.style.width = '100%';
      totalsTable.style.maxWidth = '';
      totalsTable.style.margin = '0';
    }catch(_){ }
  }

  function __normLabel(s){
    try{
      return String(s||'')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'') // quitar acentos
        .replace(/[^a-z0-9 ]/gi,' ') // quitar puntuación
        .replace(/\s+/g,' ') // colapsar espacios
        .trim()
        .toUpperCase();
    }catch(_){ return String(s||'').toUpperCase(); }
  }
  // Intentar leer un valor numérico de la tarjeta del opener buscando la celda con una etiqueta
  function readSummaryValueFromOpener(labelStartsWith){
    try{
      if(!window.opener || !window.opener.document) return null;
      const tds = window.opener.document.querySelectorAll('td');
      const variants = [labelStartsWith, labelStartsWith?.replace('-', ''), labelStartsWith?.replace('Í','I')].filter(Boolean);
      const needles = variants.map(__normLabel);
      for(const td of tds){
        const txt = __normLabel(td.textContent||'');
        if(needles.some(n => txt.startsWith(__normLabel(n)))){
          const valTd = td.nextElementSibling;
          if(valTd){
            const num = parseMoney(valTd.textContent||'');
            if(isFinite(num)) return num;
          }
        }
      }
    }catch(_){ }
    return null;
  }

  function parseMoney(val){
    if(val == null) return 0;
    if(typeof val === 'number' && isFinite(val)) return val;
    const s = String(val).trim();
    const n = s.replace(/[^0-9.,-]/g,'').replace(/,/g,'');
    const num = parseFloat(n);
    return isFinite(num) ? num : 0;
  }

  function pickFirstMoney(...vals){
    for (const val of vals){
      if (val == null) continue;
      if (typeof val === 'number' && isFinite(val)) return val;
      const str = String(val).trim();
      if (!str || !/[0-9]/.test(str)) continue;
      const num = parseMoney(str);
      if (isFinite(num)) return num;
    }
    return 0;
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

  // ===== Observaciones (paso 3) =====
  function setObservationsOutput(text){
    try{
      const el = document.getElementById('cr-observations-output');
      if (!el) return;
      const val = (text == null || String(text).trim() === '') ? '—' : String(text);
      el.textContent = val;
    }catch(_){ }
  }

  function populateObservations(data){
    try{
      // 1) Desde snapshot del reporte si viene incluido
      let obs = (data && (data.observaciones || data.observations || data.notas || data.nota)) ||
                (currentSnapshot && (currentSnapshot.observaciones || currentSnapshot.observations || currentSnapshot.notas || currentSnapshot.nota)) || '';
      // 2) Local/session storage
      if (!obs) {
        try { obs = sessionStorage.getItem('cr_observations') || ''; } catch(_){ }
        if (!obs) { try { obs = localStorage.getItem('cr_observations') || ''; } catch(_){ }
        }
      }
      // 3) Opener textarea del paso 3
      if (!obs) {
        try { if (window.opener && window.opener.document) { obs = window.opener.document.getElementById('cr-observations')?.value || ''; } } catch(_){ }
      }
      setObservationsOutput(obs);
      return obs;
    }catch(_){ setObservationsOutput(''); }
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
      const days = Math.max(1, Number(it.dias || (currentMeta?.dias ?? 1) || 1));
      const unit = Number(it.unitPrice||0);
      const saleUnit = Number(it.salePrice || it.unitVenta || 0);
      const importe = qty * unit * (currentMode==='VENTA' ? 1 : days);
      const garantia = qty * (isFinite(saleUnit) ? saleUnit : 0);
      const unitW = parseWeightKg(it.peso ?? it.weight ?? 0);
      const totalW = unitW * qty;
      subtotal += importe;
      weight += totalW;
      const nombre = it.nombre || it.name || it.descripcion || '-';
      const descripcion = it.descripcion || it.desc || '';
      return { idx: idx+1, img: it.imagen, clave: it.clave, nombre, descripcion, qty, days, unit, garantia, importe, pesoUnit: unitW, pesoTotal: totalW };
    });
    return { rows, subtotal, weight };
  }

  function isFilterChecked(id, fallback=true){ const el=document.getElementById(id); if(!el) return fallback; return !!el.checked; }
  function getSummaryColumnState(){
    const showClave = isFilterChecked('filter-clave', true);
    const showImagen = isFilterChecked('filter-imagen', true);
    const showNombre = isFilterChecked('filter-nombre', true);
    const showDescripcion = isFilterChecked('filter-descripcion', true);
    return {
      img: showClave || showImagen,
      showClave,
      showImagen,
      part: isFilterChecked('filter-part', true),
      peso: isFilterChecked('filter-peso', true),
      desc: showNombre || showDescripcion,
      showNombre,
      showDescripcion,
      cant: isFilterChecked('filter-cant', true),
      unit: isFilterChecked('filter-punit', true),
      gar: isFilterChecked('filter-garantia', true),
      importe: isFilterChecked('filter-importe', true)
    };
  }
  function applySummaryHeaderVisibility(state){
    const ths=document.querySelectorAll('.cr-table--summary thead th[data-col]');
    ths.forEach(th=>{
      const key=th.getAttribute('data-col');
      if(!key) return;
      const visible = state.hasOwnProperty(key) ? !!state[key] : true;
      th.style.display = visible ? '' : 'none';
    });
  }

  function renderSummaryCard(items){
    const tbody = document.getElementById('cr-summary-rows'); if(!tbody) return; tbody.innerHTML='';
    const summaryCols = getSummaryColumnState();
    const showGarColumn = (currentMode === 'RENTA') && summaryCols.gar;
    const headerState = { ...summaryCols, gar: showGarColumn };
    applySummaryHeaderVisibility(headerState);
    const { rows, subtotal, weight } = calcItemTotals(items||[]);
    // Mostrar/ocultar filas sólo renta en el bloque de totales
    try {
      const onlyRenta = document.querySelectorAll('.only-renta');
      onlyRenta.forEach(el => { el.style.display = (currentMode === 'RENTA') ? '' : 'none'; });
    } catch(_){ }
    for(const r of rows){
      const tr=document.createElement('tr');
      // IMG/CLAVE combinado
      if (summaryCols.img) {
        const tdImg=document.createElement('td'); tdImg.style.textAlign='center'; tdImg.title = r.clave || '';
        if (summaryCols.showImagen) {
          const img=document.createElement('img'); img.src=r.img||'img/logo-demo.jpg'; img.alt=(r.clave||'IMG'); img.style.width='40px'; img.style.height='40px'; img.style.objectFit='cover'; img.style.borderRadius='6px'; img.onerror=function(){ this.src='img/default.jpg'; };
          tdImg.appendChild(img);
        }
        if (summaryCols.showClave) {
          const claveSmall=document.createElement('div'); claveSmall.style.fontSize='10px'; claveSmall.style.color='#64748b'; claveSmall.style.marginTop='2px'; claveSmall.textContent=r.clave||'-';
          tdImg.appendChild(claveSmall);
        }
        tr.appendChild(tdImg);
      }
      if (summaryCols.part) {
        const tdPart=document.createElement('td'); tdPart.textContent=String(r.idx); tr.appendChild(tdPart);
      }
      if (summaryCols.peso) {
        const tdPeso=document.createElement('td'); tdPeso.textContent=formatWeightKg(r.pesoUnit ?? 0); tr.appendChild(tdPeso);
      }
      if (summaryCols.desc) {
        const tdDesc=document.createElement('td');
        tdDesc.style.textAlign='left';
        tdDesc.classList.add('desc-cell');
        if (summaryCols.showNombre) {
          const nameLine = document.createElement('div');
          nameLine.className = 'desc-name';
          nameLine.textContent = r.nombre || r.descripcion || '-';
          tdDesc.appendChild(nameLine);
        }
        if (summaryCols.showDescripcion && r.descripcion) {
          const descLine = document.createElement('div');
          descLine.className = 'desc-line';
          descLine.textContent = r.descripcion;
          tdDesc.appendChild(descLine);
        }
        tr.appendChild(tdDesc);
      }
      if (summaryCols.cant) {
        const tdQty=document.createElement('td'); tdQty.textContent=String(r.qty||1); tr.appendChild(tdQty);
      }
      if (summaryCols.unit) {
        const tdUnit=document.createElement('td'); tdUnit.className='nowrap-cell'; tdUnit.textContent=formatCurrency(r.unit||0); tr.appendChild(tdUnit);
      }
      if (showGarColumn) {
        const tdGar=document.createElement('td'); tdGar.className='nowrap-cell'; tdGar.textContent=formatCurrency(r.garantia||0); tr.appendChild(tdGar);
      }
      if (summaryCols.importe) {
        const tdImp=document.createElement('td'); tdImp.className='nowrap-cell'; tdImp.textContent=formatCurrency(r.importe||0); tr.appendChild(tdImp);
      }
      tbody.appendChild(tr);
    }
    // Totales con descuento y envío
    const ds = getDiscountState();
    const applyIvaSel = document.getElementById('cr-summary-apply-iva');
    const applyIva = (applyIvaSel?.value || 'si') === 'si';
    const discount = (ds && ds.apply) ? (subtotal * (Number(ds.pct)||0) / 100) : 0;
    const shipping = Number(currentMeta?.shipping || 0);
    const taxable = Math.max(0, subtotal - discount + shipping);
    const iva = applyIva ? (taxable * 0.16) : 0;
    const total = taxable + iva;
    // Subtotal mostrado sigue la estructura deseada (descuento ya aplicado y sumado envío)
    const subtotalEl=document.getElementById('cr-total-subtotal'); if(subtotalEl) subtotalEl.textContent = formatCurrency(taxable);
    const ivaEl=document.getElementById('cr-total-iva'); if(ivaEl) ivaEl.textContent = formatCurrency(iva);
    const totalEl=document.getElementById('cr-total-total'); if(totalEl) totalEl.textContent = formatCurrency(total);

    // Determinar valores finales preferentemente desde snapshot.totals
    let outSubtotal = taxable, outIva = iva, outTotal = total;
    try {
      const t = currentSnapshot?.totals || null;
      if (t) {
        if (typeof t.subtotal !== 'undefined') outSubtotal = Number(t.subtotal)||0;
        if (typeof t.iva !== 'undefined') outIva = Number(t.iva)||0;
        if (typeof t.total !== 'undefined') outTotal = Number(t.total)||0;
      }
    } catch(_){ }
    // Escribir en elementos antiguos y nuevos (cr-fin-*)
    if (subtotalEl) subtotalEl.textContent = formatCurrency(outSubtotal);
    if (ivaEl) ivaEl.textContent = formatCurrency(outIva);
    if (totalEl) totalEl.textContent = formatCurrency(outTotal);
    const finSubtotalEl = document.getElementById('cr-fin-subtotal'); if (finSubtotalEl) finSubtotalEl.textContent = formatCurrency(outSubtotal);
    const finIvaEl = document.getElementById('cr-fin-iva'); if (finIvaEl) finIvaEl.textContent = formatCurrency(outIva);
    const finTotalEl = document.getElementById('cr-fin-total'); if (finTotalEl) finTotalEl.textContent = formatCurrency(outTotal);

    // Envío
    const shippingFromSnapshot = (currentSnapshot?.envio && typeof currentSnapshot.envio.costo !== 'undefined') ? Number(currentSnapshot.envio.costo)||0 : (currentSnapshot?.totals && typeof currentSnapshot.totals.envio !== 'undefined' ? Number(currentSnapshot.totals.envio)||0 : Number(currentMeta?.shipping||0));
    const finShipEl = document.getElementById('cr-fin-shipping');
    if (finShipEl) {
      const finShipLbl = finShipEl.previousElementSibling; // "COSTO DE ENVÍO:" cell
      if (shippingFromSnapshot > 0) {
        if (finShipLbl) finShipLbl.textContent = 'COSTO DE ENVÍO:';
        finShipEl.textContent = formatCurrency(shippingFromSnapshot);
      } else {
        if (finShipLbl) finShipLbl.textContent = '';
        finShipEl.textContent = '';
      }
    }
    const wEl=document.getElementById('cr-total-weight'); if(wEl) wEl.textContent = formatWeightKg(weight);

    // Mostrar/ocultar fila de IVA según selección
    try {
      const ivaRow = document.getElementById('cr-iva-row');
      if (ivaRow) ivaRow.style.display = applyIva ? '' : 'none';
    } catch(_){ }

    // Campos específicos de RENTA: Renta diaria, X días, Garantía, Descuento
    try {
      if (currentMode === 'RENTA') {
        const days = Math.max(1, Number(currentMeta?.dias || 1));
        // renta diaria = suma de qty*unit (precio renta por día)
        const rentaDiaria = rows.reduce((acc, r) => acc + (Number(r.qty||0) * Number(r.unit||0)), 0);
        const xDias = rentaDiaria * days;
        // garantía total
        // Preferir valor del snapshot si viene desde la tarjeta de resumen financiero
        let garantiaTotal = null;
        try {
          if (currentSnapshot) {
            const t = currentSnapshot.totals || {};
            if (t && typeof t.garantia !== 'undefined') garantiaTotal = Number(t.garantia)||0;
            else if (typeof currentSnapshot.garantia !== 'undefined') garantiaTotal = Number(currentSnapshot.garantia)||0;
            else if (typeof currentSnapshot.deposito !== 'undefined') garantiaTotal = Number(currentSnapshot.deposito)||0;
          }
        } catch(_) { }
        if (garantiaTotal == null) {
          // Intentar leer directamente del DOM de la ventana de cotización
          try {
            if (window.opener && window.opener.document) {
              const garText = window.opener.document.getElementById('cr-total-garantia')?.textContent || '';
              const parsed = parseMoney(garText);
              if (isFinite(parsed) && parsed > 0) garantiaTotal = parsed;
            }
          } catch(_) { }
        }
        if (garantiaTotal == null) {
          // Último intento basado en etiqueta 'GARANTÍA'
          const parsed = readSummaryValueFromOpener('GARANTÍA');
          if(parsed != null) garantiaTotal = parsed;
        }
        if (garantiaTotal == null) {
          // Fallback: suma por ítem (venta)
          garantiaTotal = rows.reduce((acc, r) => acc + (Number(r.garantia||0)), 0);
        }
        const rentaEl = document.getElementById('cr-renta-diaria'); if (rentaEl) rentaEl.textContent = formatCurrency(rentaDiaria);
        const xDiasLabel = document.getElementById('cr-x-dias-label'); if (xDiasLabel) xDiasLabel.textContent = String(days);
        const xDiasEl = document.getElementById('cr-x-dias'); if (xDiasEl) xDiasEl.textContent = formatCurrency(xDias);
        const garEl = document.getElementById('cr-total-garantia'); if (garEl) garEl.textContent = formatCurrency(garantiaTotal);
        const descEl = document.getElementById('cr-total-descuento'); if (descEl) descEl.textContent = formatCurrency(discount);

        // Escribir en cr-fin-* también
        const finDayEl = document.getElementById('cr-fin-day'); if (finDayEl) finDayEl.textContent = formatCurrency(rentaDiaria);
        const finDaysNumEl = document.getElementById('cr-fin-days'); if (finDaysNumEl) finDaysNumEl.textContent = String(days);
        const finTotalDaysEl = document.getElementById('cr-fin-total-days'); if (finTotalDaysEl) finTotalDaysEl.textContent = formatCurrency(xDias);
        const finDepositEl = document.getElementById('cr-fin-deposit'); if (finDepositEl) finDepositEl.textContent = formatCurrency(garantiaTotal);
        const finDiscountEl = document.getElementById('cr-fin-discount'); if (finDiscountEl) finDiscountEl.textContent = formatCurrency(discount);

        // Overrides desde snapshot.totals si existen
        try {
          const t = currentSnapshot?.totals || null;
          if (t) {
            const tRenta = Number(t.rentaDiaria||0), tXDias = Number(t.xDias||0), tGar = Number(t.garantia||0), tDesc = Number(t.descuento||0);
            if (rentaEl && !isNaN(tRenta)) rentaEl.textContent = formatCurrency(tRenta);
            if (xDiasEl && !isNaN(tXDias)) xDiasEl.textContent = formatCurrency(tXDias);
            if (garEl && !isNaN(tGar)) garEl.textContent = formatCurrency(tGar);
            if (descEl && !isNaN(tDesc)) descEl.textContent = formatCurrency(tDesc);
            const finDayEl2 = document.getElementById('cr-fin-day'); if (finDayEl2 && !isNaN(tRenta)) finDayEl2.textContent = formatCurrency(tRenta);
            const finTotalDaysEl2 = document.getElementById('cr-fin-total-days'); if (finTotalDaysEl2 && !isNaN(tXDias)) finTotalDaysEl2.textContent = formatCurrency(tXDias);
            const finDepositEl2 = document.getElementById('cr-fin-deposit'); if (finDepositEl2 && !isNaN(tGar)) finDepositEl2.textContent = formatCurrency(tGar);
            const finDiscountEl2 = document.getElementById('cr-fin-discount'); if (finDiscountEl2 && !isNaN(tDesc)) finDiscountEl2.textContent = formatCurrency(tDesc);
            const finDaysNumEl2 = document.getElementById('cr-fin-days'); if (finDaysNumEl2) finDaysNumEl2.textContent = String(Number(currentSnapshot?.dias||days)||0);
          }
        } catch(_){ }

        // Overrides desde la tarjeta del opener para que coincida al 100%
        try {
          const rentaDiariaOv = readSummaryValueFromOpener('RENTA DIARIA');
          if (rentaDiariaOv != null && rentaEl) rentaEl.textContent = formatCurrency(rentaDiariaOv);
          // El label de X días contiene el número, solo usamos el importe a la derecha
          const xDiasOv = readSummaryValueFromOpener('X ');
          if (xDiasOv != null && xDiasEl) xDiasEl.textContent = formatCurrency(xDiasOv);
          const garOv = readSummaryValueFromOpener('GARANTÍA');
          if (garOv != null && garEl) garEl.textContent = formatCurrency(garOv);
          const descOv = readSummaryValueFromOpener('DESCUENTO');
          if (descOv != null && descEl) descEl.textContent = formatCurrency(descOv);
          const subOv = readSummaryValueFromOpener('SUB-TOTAL');
          if (subOv != null && subtotalEl) subtotalEl.textContent = formatCurrency(subOv);
          const ivaOv = readSummaryValueFromOpener('IVA');
          if (ivaOv != null && ivaEl) ivaEl.textContent = formatCurrency(ivaOv);
          const totOv = readSummaryValueFromOpener('TOTAL');
          if (totOv != null && totalEl) totalEl.textContent = formatCurrency(totOv);
        } catch(_){ }
      }
    } catch(_){ }

    // Validación silenciosa de totales contra snapshot
    try { validateTotalsAgainstSnapshot(); } catch(_){ }
  }

  function wireSummaryControls(){
    const sel=document.getElementById('cr-summary-apply-discount');
    const inp=document.getElementById('cr-summary-discount-percent-input');
    const ivaSel=document.getElementById('cr-summary-apply-iva');
    if(sel){ sel.addEventListener('change', ()=>renderSummaryCard(currentItems)); }
    if(inp){ inp.addEventListener('input', ()=>renderSummaryCard(currentItems)); }
    if(ivaSel){ ivaSel.addEventListener('change', ()=>renderSummaryCard(currentItems)); }
    // Sync initial disabled state
    getDiscountState();

    // Mantener alineación en scroll/resize
    try {
      const wrap = document.querySelector('.cr-summary-wrap');
      if (wrap && !wrap.__alignedScroll) {
        wrap.addEventListener('scroll', alignTotalsToImporte, { passive: true });
        wrap.__alignedScroll = true;
      }
      window.addEventListener('resize', alignTotalsToImporte);
    } catch(_){}
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
      if(!raw){
        try{
          const params = new URLSearchParams(window.location.search);
          const p = params.get('payload');
          if(p){
            const json = decodeURIComponent(escape(window.atob(p)));
            raw = json;
            try { localStorage.setItem('active_quote', raw); } catch(_) {}
          }
        }catch(_){}
      }
      if(!raw) return null;
      const data = JSON.parse(raw);
      currentSnapshot = data; // conservar snapshot completo para sincronización
      currentMode = data?.tipo || 'MIXTO';
      const shippingFromObj = (
        data?.envio?.costo ?? data?.envio?.precio ?? data?.shipping ?? null
      );
      const shippingFromTotals = parseMoney(data?.totals?.envio);
      currentMeta = {
        folio: data?.folio || null,
        moneda: data?.moneda || 'MXN',
        dias: data?.dias || 1,
        cliente: data?.cliente || null,
        shipping: Number(shippingFromObj ?? shippingFromTotals ?? 0) || 0
      };
      const items = Array.isArray(data?.items) ? data.items : [];
      const accessoriesRaw = (()=>{
        if (Array.isArray(data?.accessories)) return data.accessories;
        try { const s = sessionStorage.getItem('venta_accessories_snapshot'); if (s) return JSON.parse(s); } catch(_) {}
        try { const l = localStorage.getItem('venta_accessories_snapshot'); if (l) return JSON.parse(l); } catch(_) {}
        try { const sR = sessionStorage.getItem('renta_accessories_snapshot'); if (sR) return JSON.parse(sR); } catch(_) {}
        try { const lR = localStorage.getItem('renta_accessories_snapshot'); if (lR) return JSON.parse(lR); } catch(_) {}
        try {
          if (window.opener) {
            const s2 = window.opener.sessionStorage?.getItem('venta_accessories_snapshot');
            if (s2) return JSON.parse(s2);
            const l2 = window.opener.localStorage?.getItem('venta_accessories_snapshot');
            if (l2) return JSON.parse(l2);
            const s2r = window.opener.sessionStorage?.getItem('renta_accessories_snapshot');
            if (s2r) return JSON.parse(s2r);
            const l2r = window.opener.localStorage?.getItem('renta_accessories_snapshot');
            if (l2r) return JSON.parse(l2r);
          }
        } catch(_){}
        return [];
      })();

      const pickMoney = (...vals) => {
        for (const val of vals){
          if (val == null) continue;
          if (typeof val === 'number' && isFinite(val)) return val;
          const str = String(val).trim();
          if (!str || !/[0-9]/.test(str)) continue;
          const num = parseMoney(str);
          if (isFinite(num)) return num;
        }
        return 0;
      };

      const normProduct = it => {
        const cantidad = Math.max(1, Number(it.cantidad || it.qty || 1));
        const dias = Math.max(1, Number(it.dias || data?.dias || 1));
        // Modo de cálculo según tipo
        const unitVenta = pickMoney(
          it.precio_unitario_venta,
          it.precio_de_venta,
          it.precio_venta,
          it.precioVenta,
          it.sale,
          it.pventa,
          it.price_venta,
          it.precioUnitarioVenta,
          it.producto?.precio_unitario_venta,
          it.producto?.precio_venta,
          it.producto?.precioVenta,
          it.product?.precio_unitario_venta,
          it.product?.precio_venta,
          it.product?.precioVenta
        );
        const unitRenta = pickMoney(
          it.precio_unitario_renta,
          it.tarifa_renta,
          it.precio_unitario,
          it.price,
          it.renta_diaria,
          it.precio_renta,
          it.producto?.precio_unitario_renta,
          it.producto?.precio_renta,
          it.product?.precio_unitario_renta,
          it.product?.precio_renta
        );
        const unitPrice = (currentMode === 'VENTA' && unitVenta > 0) ? unitVenta : (unitRenta || unitVenta);
        let importe = 0;
        if (it.importe != null && String(it.importe).trim() !== '') {
          importe = pickMoney(it.importe);
        }
        if (!importe) {
          importe = unitPrice * cantidad * (currentMode === 'VENTA' ? 1 : dias);
        }
        const saleUnit = pickMoney(
          it.salePrice,
          it.precio_venta,
          it.precioVenta,
          it.precio_de_venta,
          it.precio_unitario,
          it.sale,
          it.pventa,
          it.price_venta,
          it.producto?.precio_venta,
          it.producto?.precioVenta,
          it.producto?.precio_unitario,
          it.product?.precio_venta,
          it.product?.precioVenta,
          it.product?.precio_unitario,
          it.accesorio?.precio_venta,
          it.accesorio?.precio_unitario,
          unitVenta || null,
          unitPrice || null
        );
        return {
          clave: it.sku || it.clave || it.codigo || it.id || '',
          imagen: it.imagen || it.image || it.img || '',
          nombre: it.nombre || it.name || '',
          descripcion: it.descripcion || it.desc || '',
          almacen: data?.almacen?.nombre || data?.almacen || '',
          unidad: it.unidad || 'PZA',
          cantidad,
          dias,
          unitPrice,
          salePrice: saleUnit,
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
      };

      const normAccessory = acc => {
        const cantidad = Math.max(1, Number(acc.cantidad || acc.qty || acc.quantity || 1));
        const dias = Math.max(1, Number(acc.dias || data?.dias || 1));
        const unitVenta = pickMoney(
          acc.precio_unitario_venta,
          acc.precio_venta,
          acc.precioVenta,
          acc.sale,
          acc.pventa,
          acc.price,
          acc.precio,
          acc.producto?.precio_unitario_venta,
          acc.producto?.precio_venta,
          acc.producto?.precioVenta,
          acc.accessory?.precio_unitario_venta,
          acc.accessory?.precio_venta
        );
        const unitRenta = pickMoney(
          acc.precio_unitario_renta,
          acc.tarifa_renta,
          acc.price,
          acc.precio,
          acc.producto?.precio_unitario_renta,
          acc.producto?.precio_renta,
          acc.accessory?.precio_unitario_renta,
          acc.accessory?.precio_renta,
          unitVenta
        );
        const unitPrice = (currentMode === 'VENTA' && unitVenta > 0) ? unitVenta : (unitRenta || unitVenta);
        let importe = 0;
        if (acc.importe != null && String(acc.importe).trim() !== '') {
          importe = pickMoney(acc.importe);
        }
        if (!importe) {
          importe = unitPrice * cantidad * (currentMode === 'VENTA' ? 1 : dias);
        }
        const salePrice = pickMoney(
          acc.salePrice,
          acc.precio_venta,
          acc.precioVenta,
          acc.precio_unitario,
          acc.sale,
          acc.pventa,
          acc.precio,
          acc.producto?.precio_venta,
          acc.producto?.precioVenta,
          acc.producto?.precio_unitario,
          acc.accessory?.precio_venta,
          acc.accessory?.precioVenta,
          acc.accessory?.precio_unitario,
          unitVenta || null,
          unitPrice || null
        );
        return {
          clave: acc.sku || acc.clave || acc.id || acc.codigo || '',
          imagen: acc.imagen || acc.image || acc.img || '',
          nombre: acc.nombre || acc.name || `[Acc] ${acc.id||acc.clave||''}`,
          descripcion: acc.descripcion || acc.desc || '',
          almacen: data?.almacen?.nombre || data?.almacen || '',
          unidad: acc.unidad || 'PZA',
          cantidad,
          dias,
          unitPrice,
          salePrice,
          peso: Number(acc.peso ?? acc.weight ?? 0),
          importe,
          totalRenta: (currentMode === 'VENTA') ? 0 : importe,
          totalVenta: (currentMode === 'VENTA') ? importe : 0
        };
      };

      const normItems = items.map(normProduct);
      const normAccessories = (Array.isArray(accessoriesRaw) ? accessoriesRaw : []).map(normAccessory);
      currentItems = normItems.concat(normAccessories);
      populateHeaderFromSnapshot(data);
      setConditionsFromSnapshot(data);
      // Inicializar controles desde snapshot: Aplica IVA y Descuento
      try {
        // Aplica IVA
        const ivaSel = document.getElementById('cr-summary-apply-iva');
        if (ivaSel && typeof data?.aplicaIVA !== 'undefined') {
          ivaSel.value = (data.aplicaIVA ? 'si' : 'no');
        }
        // Descuento
        const d = data?.discount;
        const dSel = document.getElementById('cr-summary-apply-discount');
        const dPct = document.getElementById('cr-summary-discount-percent-input');
        if (dSel && dPct && d && (typeof d.apply !== 'undefined' || typeof d.pct !== 'undefined')) {
          dSel.value = (d.apply ? 'si' : 'no');
          dPct.value = Math.max(0, Math.min(100, Number(d.pct||0)));
          // Habilitar/deshabilitar input de % según selección
          dPct.disabled = !d.apply;
        }
      } catch(_) {}
      return data;
    }catch(e){
      console.warn('No se pudo leer active_quote:', e);
      return null;
    }
  }
  function fmtDate(d){ const pad=n=>String(n).padStart(2,'0'); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`; }
  function fmtDateTime(d){ const pad=n=>String(n).padStart(2,'0'); return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function setHeaderTimestamps(){ const now=new Date(); const elDate=document.getElementById('current-date'); const elTs=document.getElementById('creation-timestamp'); if(elDate) elDate.textContent=fmtDate(now); if(elTs) elTs.textContent=fmtDateTime(now); }

  // Fallbacks para el panel derecho: folio y moneda desde URL u opener si no hay snapshot
  function applyHeaderFallbacks(){
    try {
      const qEl = document.getElementById('quote-number');
      const mEl = document.getElementById('currency-code');
      const isUnset = el => !el || !el.textContent || el.textContent.trim() === '—' || el.textContent.trim() === '';
      const params = new URLSearchParams(window.location.search);
      // Folio por URL: ?folio= o ?cotizacion=
      if (isUnset(qEl)) {
        const folio = params.get('folio') || params.get('cotizacion') || params.get('quote');
        if (folio) setText('quote-number', folio);
        else {
          // Intentar leer del opener
          try {
            if (window.opener && window.opener.document) {
              const fromId = window.opener.document.getElementById('quote-number')?.textContent;
              if (fromId && String(fromId).trim()) setText('quote-number', String(fromId).trim());
            }
          } catch(_) { }
        }
      }
      // Moneda por URL: ?moneda= o ?currency=
      if (isUnset(mEl)) {
        const mon = params.get('moneda') || params.get('currency');
        if (mon) setText('currency-code', mon);
        else {
          try {
            if (window.opener && window.opener.document) {
              const fromId = window.opener.document.getElementById('currency-code')?.textContent;
              if (fromId && String(fromId).trim()) setText('currency-code', String(fromId).trim());
            }
          } catch(_) { }
        }
      }
    } catch(_) { }
  }
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
  function onFiltersChange(){ buildTableHeader(); renderTableRows(currentItems); renderSummaryCard(currentItems); }
  function wireFilters(){ ['filter-clave','filter-imagen','filter-nombre','filter-descripcion','filter-part','filter-peso','filter-cant','filter-punit','filter-garantia','filter-importe','filter-almacenes','filter-pventa','filter-prenta'].forEach(id=>{ const el=document.getElementById(id); if(el){ el.addEventListener('change', onFiltersChange);} }); }
  let __pdfRunning = false;
  function generatePDF(){
    if (__pdfRunning) return; __pdfRunning = true;
    const elem=document.getElementById('pdf-template'); if(!elem){ __pdfRunning=false; return; }
    const prepareClone=()=>{
      const wrapper=document.createElement('div');
      const temp=elem.cloneNode(true);
      const syncValues=(selector)=>{
        const live=elem.querySelectorAll(selector);
        const dupe=temp.querySelectorAll(selector);
        dupe.forEach((node,idx)=>{
          const src=live[idx];
          if(!src) return;
          if('value' in node) node.value=src.value;
          if('checked' in node) node.checked=src.checked;
          if('selectedIndex' in node) node.selectedIndex=src.selectedIndex;
          if(node.textContent!==undefined && src.textContent!==undefined && !node.children.length) node.textContent=src.textContent;
        });
      };
      syncValues('textarea');
      syncValues('input');
      syncValues('select');
      syncValues('[data-sync-text]');
      temp.id='pdf-template-clone';
      temp.classList.add('pdf-fit');
      Object.assign(wrapper.style,{
        position:'fixed',
        top:'0',
        left:'0',
        width:'210mm',
        maxWidth:'210mm',
        zIndex:'-1',
        opacity:'0',
        pointerEvents:'none',
        background:'#fff'
      });
      wrapper.appendChild(temp);
      document.body.appendChild(wrapper);
      return { wrapper, temp };
    };
    const { wrapper:cloneWrapper, temp:clone } = prepareClone();
    const opt={
      margin:[2,2,4,2],
      filename:`reporte_cotizaciones_${Date.now()}.pdf`,
      image:{type:'jpeg',quality:0.98},
      html2canvas:{
        scale:1.5,
        useCORS:true,
        scrollY:0
      },
      pagebreak:{mode:['css','legacy']},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    };
    const cleanup=()=>{
      try { document.body.classList.remove('pdf-mode'); } catch(_) {}
      if(cloneWrapper && cloneWrapper.parentNode) cloneWrapper.parentNode.removeChild(cloneWrapper);
      __pdfRunning=false;
    };
    try { document.body.classList.add('pdf-mode'); } catch(_) {}
    window.html2pdf().set(opt).from(clone).save().then(cleanup).catch(cleanup);
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
    applyHeaderFallbacks();
    // Asegurar tabla de costos visible y observar cambios de filas
    try { forceStaticTotals(); ensureTotalsVisible(); observeSummaryRows(); setTimeout(()=>{ alignTotalsToImporte(); showTotalsFallbackIfHidden(); }, 0); } catch(_){ }
  }

  document.addEventListener('DOMContentLoaded', function(){
    setHeaderTimestamps();
    // Intentar poblar vendedor de inmediato
    tryPopulateVendor();
    // Escuchar evento global del módulo de autenticación
    try{ document.addEventListener('userLoaded', (e)=>{ try{ populateVendorFromUser(e.detail); }catch(_){} }); }catch(_){ }
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
        applyHeaderFallbacks();
        try { forceStaticTotals(); ensureTotalsVisible(); observeSummaryRows(); setTimeout(()=>{ alignTotalsToImporte(); showTotalsFallbackIfHidden(); }, 0); } catch(_){ }
        populateObservations(data || msg.data);
      }
    });
  } catch(_){}

  // Exponer getters de depuración (solo lectura) y funciones útiles
  try {
    Object.defineProperty(window, 'currentItems', { get(){ return currentItems; } });
    Object.defineProperty(window, 'currentMode', { get(){ return currentMode; } });
    Object.defineProperty(window, 'currentMeta', { get(){ return currentMeta; } });
    window.renderSummaryCard = renderSummaryCard;
  } catch(_){ }
})();
