/* Funciones específicas para el Resumen de Cotización y Resumen Financiero en VENTA */

(() => {
  // === FUNCIONES ESPECÍFICAS PARA VENTA ===

  // Debugging: función para verificar el estado
  function debugState() {
    const state = window.state;
    console.log('🔍 [DEBUG] Estado actual:', {
      state: !!state,
      cart: state?.cart,
      cartLength: state?.cart?.length || 0,
      products: state?.products?.length || 0,
      accessories: state?.accessories?.length || 0,
      accSelected: state?.accSelected?.size || 0
    });
    return state;
  }

  function bindDeliveryButtons() {
    const calcBtn = document.getElementById('calculate-shipping-cost-btn');
    const radioBranch = document.getElementById('delivery-branch-radio');
    const radioHome = document.getElementById('delivery-home-radio');
    const branchCard = document.getElementById('cr-branch-card');
    const homeWrap = document.getElementById('cr-home-delivery-wrap');
    // Helpers para mostrar/ocultar solo las 2 primeras cards dentro de homeWrap (detalles domicilio y costo envío)
    function setHomeDeliveryCardsVisible(visible) {
      try {
        if (!homeWrap) return;
        const cards = homeWrap.querySelectorAll(':scope > .cr-card');
        // Índices 0 y 1 corresponden a: Detalles de Entrega a Domicilio, Costo de Envío
        if (cards[0]) cards[0].style.display = visible ? '' : 'none';
        if (cards[1]) cards[1].style.display = visible ? '' : 'none';
        // No tocar Observaciones, Contacto, ni Resúmenes
      } catch { }
    }
    const branchSelect = document.getElementById('cr-branch-select');
    // Reemplazamos el botón manual por cálculo en tiempo real cuando el usuario escribe
    const distanceEl = document.getElementById('cr-delivery-distance');
    const zoneEl = document.getElementById('cr-zone-type');

    function safeParseFloat(v) {
      try {
        if (v === null || v === undefined) return null;
        const s = String(v).trim();
        if (s === '') return null;
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : null;
      } catch { return null; }
    }

    function calculateAndRenderShippingCostVenta() {
      try {
        try { const dispCheck = document.getElementById('cr-delivery-cost-display'); if (dispCheck && dispCheck.__manualOverride && document.activeElement === dispCheck) return; } catch { }
        try { if (distanceEl && distanceEl.__suppressCalc) { distanceEl.__suppressCalc = false; return; } } catch { }
        const km = Math.max(0, Number(safeParseFloat(distanceEl?.value) ?? 0));
        const zone = (zoneEl?.value || 'metropolitana');
        const factor = (zone === 'foraneo') ? 18 : 12;
        // Regla: si la distancia es menor o igual a 5 km, el envío es gratis (0)
        const cost = (km <= 5) ? 0 : Math.max(0, km * 4 * factor);
        const costEl = document.getElementById('cr-delivery-cost');
        const display = document.getElementById('cr-delivery-cost-display');
        const formula = document.getElementById('cr-delivery-cost-formula');
        if (costEl) costEl.value = String(cost);
        if (display) {
          try { display.__programmatic = true; } catch { }
          display.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(cost);
          try { setTimeout(() => { display.__programmatic = false; }, 0); } catch { }
        }
        if (formula) formula.textContent = `Costo = km × 4 × ${factor} (${zone})`;
        // Actualizar totales en la vista
        if (window.updateAllTotals) window.updateAllTotals();
        // Guardar último costo si aplica
        try {
          window.state = window.state || {};
          if (cost > 0) window.state.lastHomeShippingCost = cost;
        } catch { }
      } catch { }
    }

    if (distanceEl && !distanceEl.__ventaBound) {
      distanceEl.addEventListener('input', calculateAndRenderShippingCostVenta);
      distanceEl.addEventListener('change', calculateAndRenderShippingCostVenta);
      distanceEl.__ventaBound = true;
    }
    if (zoneEl && !zoneEl.__ventaBound) {
      zoneEl.addEventListener('change', calculateAndRenderShippingCostVenta);
      zoneEl.__ventaBound = true;
    }

    // Permitir editar el display del costo y sincronizar km automáticamente
    try {
      const display = document.getElementById('cr-delivery-cost-display');
      const hidden = document.getElementById('cr-delivery-cost');
      if (display) {
        display.contentEditable = 'true';
        display.style.cursor = 'text';
        if (!display.__editableBound) {
          const __scheduleKey = '__venta_summary_schedule_recalc';
          if (!window[__scheduleKey]) window[__scheduleKey] = debounce(() => { try { if (typeof calculateAndRenderShippingCostVenta === 'function') calculateAndRenderShippingCostVenta(); if (window.updateAllTotals) window.updateAllTotals(); } catch { } }, 200);
          display.addEventListener('input', () => {
            try {
              if (display.__programmatic) return;
              try { display.__manualOverride = true; clearTimeout(display.__manualOverrideTimer); } catch { }
              try { display.__manualOverrideTimer = setTimeout(() => { try { display.__manualOverride = false; } catch { } }, 5000); } catch { }
              const txt = display.textContent || '';
              const num = Number(String(txt).replace(/[^0-9.,-]/g, '').replace(/,/g, '')) || 0;
              if (hidden) hidden.value = String(num);
              const zone = (zoneEl?.value || 'metropolitana');
              const factor = (zone === 'foraneo') ? 18 : 12;
              let km = 0;
              if (num > 0) km = +(num / (4 * factor)).toFixed(1);
              if (distanceEl) { try { distanceEl.__suppressCalc = true; } catch { } distanceEl.value = String(km); distanceEl.dispatchEvent(new Event('input', { bubbles: true })); }
              try { window[__scheduleKey](); } catch { }
            } catch { }
          });
          display.addEventListener('blur', () => {
            try { const v = Number(String(display.textContent || '').replace(/[^0-9.,-]/g, '').replace(/,/g, '')) || 0; display.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(v); } catch { }
            try { display.__manualOverride = false; clearTimeout(display.__manualOverrideTimer); } catch { }
          });
          display.__editableBound = true;
        }
      }
    } catch { }

    // Cambio a Entrega en Sucursal
    if (radioBranch && !radioBranch.__ventaBound) {
      radioBranch.addEventListener('change', () => {
        if (!radioBranch.checked) return;
        try {
          window.state = window.state || {};
          // Guardar último costo de domicilio (si existe) antes de poner 0
          try {
            const hPrev = Number(document.getElementById('cr-delivery-cost')?.value || 0);
            const dPrevTxt = (document.getElementById('cr-delivery-cost-display')?.textContent || '').replace(/[^0-9.,-]/g, '').replace(/,/g, '');
            const dPrev = Number(dPrevTxt);
            const prev = isFinite(hPrev) && hPrev > 0 ? hPrev : (isFinite(dPrev) ? dPrev : 0);
            if (isFinite(prev) && prev > 0) window.state.lastHomeShippingCost = prev;
          } catch { }
          window.state.deliveryType = 'pickup';
          document.body && (document.body.dataset.delivery = 'pickup');
          // UI toggles
          if (branchCard) branchCard.style.display = '';
          // Ocultar solo las 2 primeras cards de domicilio
          setHomeDeliveryCardsVisible(false);
          // Reset envío a 0
          const h = document.getElementById('cr-delivery-cost'); if (h) h.value = '0';
          const d = document.getElementById('cr-delivery-cost-display'); if (d) { try { d.__programmatic = true; } catch { } d.textContent = '$0'; try { setTimeout(() => { d.__programmatic = false; }, 0); } catch { } }
          const m = document.getElementById('cr-delivery-method'); if (m) m.textContent = 'Método: Recolección en Sucursal';
          // Repintar
          try { syncDeliveryTypeAndShippingUI(); } catch { }
          if (window.updateAllTotals) window.updateAllTotals();
        } catch { }
      });
      radioBranch.__ventaBound = true;
    }

    // Cambio a Entrega a Domicilio
    if (radioHome && !radioHome.__ventaBound) {
      radioHome.addEventListener('change', () => {
        if (!radioHome.checked) return;
        try {
          window.state = window.state || {};
          window.state.deliveryType = 'home';
          document.body && (document.body.dataset.delivery = 'home');
          if (branchCard) branchCard.style.display = 'none';
          // Mostrar nuevamente las 2 primeras cards de domicilio
          setHomeDeliveryCardsVisible(true);
          const m = document.getElementById('cr-delivery-method'); if (m) m.textContent = 'Método: Entrega a Domicilio';
          // Restaurar último costo de domicilio si lo tenemos
          try {
            const last = window.state.lastHomeShippingCost;
            if (isFinite(last) && last > 0) {
              const h = document.getElementById('cr-delivery-cost'); if (h) h.value = String(last);
              const d = document.getElementById('cr-delivery-cost-display'); if (d) { try { d.__programmatic = true; } catch { } d.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(last); try { setTimeout(() => { d.__programmatic = false; }, 0); } catch { } }
            }
          } catch { }
          if (window.updateAllTotals) window.updateAllTotals();
          try { syncDeliveryTypeAndShippingUI(); } catch { }
        } catch { }
      });
      radioHome.__ventaBound = true;
    }

    // Selección de sucursal concreta: también refuerza pickup y costo 0
    if (branchSelect && !branchSelect.__ventaBound) {
      branchSelect.addEventListener('change', () => {
        try {
          if (branchSelect.value) {
            window.state = window.state || {};
            window.state.deliveryType = 'pickup';
            document.body && (document.body.dataset.delivery = 'pickup');
            const name = branchSelect.options[branchSelect.selectedIndex]?.text || '';
            const m = document.getElementById('cr-delivery-method'); if (m) m.textContent = `Método: Recolección en Sucursal · ${name}`;
            const h = document.getElementById('cr-delivery-cost'); if (h) h.value = '0';
            const d = document.getElementById('cr-delivery-cost-display'); if (d) { try { d.__programmatic = true; } catch { } d.textContent = '$0'; try { setTimeout(() => { d.__programmatic = false; }, 0); } catch { } }
            const sum = document.getElementById('cr-branch-summary'); const nm = document.getElementById('cr-branch-name');
            if (sum && nm) { nm.textContent = name; sum.hidden = false; }
            if (window.updateAllTotals) window.updateAllTotals();
          }
        } catch { }
      });
      branchSelect.__ventaBound = true;
    }
    // Ejecutar cálculo inicial para sincronizar UI con valores actuales
    try { if (typeof calculateAndRenderShippingCostVenta === 'function') calculateAndRenderShippingCostVenta(); } catch { }
  }

  // Sincroniza el tipo de entrega en estado y ajusta UI/costo de envío
  function syncDeliveryTypeAndShippingUI() {
    try {
      const st = window.state || (window.state = {});
      const type = getDeliveryType();
      st.deliveryType = type;
      try { document.body && (document.body.dataset.delivery = type); } catch { }
      // Si es pickup, forzar costo de envío = 0 en los campos
      const hiddenCostEl = document.getElementById('cr-delivery-cost');
      const displayCostEl = document.getElementById('cr-delivery-cost-display');
      if (type === 'pickup') {
        if (hiddenCostEl) hiddenCostEl.value = '0';
        if (displayCostEl) displayCostEl.textContent = '$0';
      }
      // Acomodar visibilidad de la fila en la card financiera si ya existe
      try { populateFinancialSummaryVenta(); } catch { }
    } catch { }
  }

  // Determina el tipo de entrega basado en el contenido visible del método
  function getDeliveryType() {
    try {
      // Radios tienen prioridad si existen
      const rBranch = document.getElementById('delivery-branch-radio');
      const rHome = document.getElementById('delivery-home-radio');
      if (rBranch && rBranch.checked) return 'pickup';
      if (rHome && rHome.checked) return 'home';
      const txt = (document.getElementById('cr-delivery-method')?.textContent || '').toLowerCase();
      if (/sucursal|recolec/.test(txt)) return 'pickup';
      if (/domicilio|envio|entrega/.test(txt)) return 'home';
      return 'unknown';
    } catch { return 'unknown'; }
  }

  // Intenta convertir distintos formatos de peso a número en kg
  function parseWeightKg(val) {
    if (val == null) return 0;
    try {
      if (typeof val === 'number' && isFinite(val)) return Math.max(0, val);
      const s = String(val).toLowerCase().trim();
      // Extrae número (soporta "5", "5.2", "5 kg", "0.2kg")
      const m = s.match(/([0-9]+(?:\.[0-9]+)?)/);
      if (!m) return 0;
      const n = Number(m[1]);
      if (!isFinite(n)) return 0;
      // Si especifica lb, convertir a kg aprox
      if (s.includes('lb')) return +(n * 0.453592).toFixed(3);
      return Math.max(0, n);
    } catch { return 0; }
  }

  // Mostrar/ocultar cards de resumen al hacer clic en "Guardar datos"
  function showSummaryCards() {
    console.log('🚀 [VENTA] Mostrando cards de resumen...');

    const summaryCard = document.getElementById('cr-quote-summary-card');
    const financialCard = document.getElementById('cr-financial-summary');

    // Debug del estado antes de poblar
    const state = debugState();

    if (summaryCard) {
      summaryCard.style.display = 'block';
      console.log('✅ Card de resumen mostrada');

      // Debug: verificar si los controles de descuento están presentes
      const discountSelect = document.getElementById('cr-summary-apply-discount');
      const discountInput = document.getElementById('cr-summary-discount-percent-input');
      const toolbar = summaryCard.querySelector('.cr-card__row .cr-toolbar');

      console.log('🔍 [DEBUG] Controles de descuento:', {
        select: !!discountSelect,
        input: !!discountInput,
        toolbar: !!toolbar,
        selectVisible: discountSelect ? getComputedStyle(discountSelect).display !== 'none' : false,
        inputVisible: discountInput ? getComputedStyle(discountInput).display !== 'none' : false,
        toolbarVisible: toolbar ? getComputedStyle(toolbar).display !== 'none' : false
      });

      if (discountSelect) {
        console.log('📋 Select encontrado:', discountSelect.outerHTML.substring(0, 100) + '...');
      }
      if (discountInput) {
        console.log('📝 Input encontrado:', discountInput.outerHTML.substring(0, 100) + '...');
      }

      populateQuoteSummaryVenta();
    } else {
      console.error('❌ No se encontró #cr-quote-summary-card');
    }

    if (financialCard) {
      financialCard.style.display = 'block';
      console.log('✅ Card financiera mostrada');
      // Intentar establecer un flag de tipo de entrega en el estado para evitar depender del texto
      try {
        syncDeliveryTypeAndShippingUI();
      } catch { }
      populateFinancialSummaryVenta();
      // Actualizar grand total
      if (window.updateGrandTotal) window.updateGrandTotal();
    } else {
      console.error('❌ No se encontró #cr-financial-summary');
    }

    // Scroll suave hacia las cards
    setTimeout(() => {
      summaryCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // Utilidad para asegurar que existan las funciones de claves de descuento
  function getItemDiscountKey(id, type = 'prod') {
    return `${type}:${String(id ?? '')}`;
  }

  function ensureItemDiscountsMap() {
    const state = window.state;
    if (!state) return {};
    if (typeof state.itemDiscounts !== 'object' || state.itemDiscounts === null) {
      // Intentar migrar desde discountExclusions si existe
      const newDiscounts = {};
      if (state.discountExclusions instanceof Set) {
        // En el estado anterior, los excluidos tenían 0 y los no incluidos tenían el global
        // Pero es mejor empezar de cero o usar los datos cargados
      }
      state.itemDiscounts = newDiscounts;
    }
    return state.itemDiscounts;
  }

  // Poblar tabla de Resumen de Cotización (adaptado para VENTA)
  function populateQuoteSummaryVenta() {
    console.log('📋 [VENTA] Poblando tabla de resumen...');

    const tbody = document.getElementById('cr-summary-rows');
    if (!tbody) {
      console.error('❌ No se encontró #cr-summary-rows');
      return;
    }

    tbody.innerHTML = '';
    let subtotalNeto = 0;
    let totalDescuentoCalculado = 0;
    let rowCount = 0;
    let totalWeightKg = 0;

    const state = window.state;
    if (!state) return;

    const discountSelect = document.getElementById('cr-summary-apply-discount');
    const discountInputGlobal = document.getElementById('cr-summary-discount-percent-input');
    const hasGlobalDiscount = discountSelect?.value === 'si';
    const globalPercent = hasGlobalDiscount ? Number(discountInputGlobal?.value || 0) : 0;

    const itemDiscounts = ensureItemDiscountsMap();

    // Función auxiliar para renderizar fila
    const createRow = (item, type, index, qty) => {
      const itemKey = getItemDiscountKey(item.id, type);

      // Si no tiene un descuento individual asignado y el global está activo, usar el global
      if (itemDiscounts[itemKey] === undefined && hasGlobalDiscount) {
        itemDiscounts[itemKey] = globalPercent;
      } else if (!hasGlobalDiscount) {
        itemDiscounts[itemKey] = 0;
      }

      const currentPercent = Number(itemDiscounts[itemKey] || 0);

      // Cálculo consistente: Precio BD (con IVA) / 1.16 = Precio NETO
      const unitPriceIVA = Number(type === 'prod' ? (item.price?.diario || item.price?.venta || 0) : (item.price || 0));
      const unitPriceNet = unitPriceIVA / 1.16;
      const rowSubtotal = unitPriceNet * qty;
      const rowDiscount = rowSubtotal * (currentPercent / 100);
      const rowTotal = rowSubtotal - rowDiscount;

      subtotalNeto += rowSubtotal;
      totalDescuentoCalculado += rowDiscount;

      const wPerUnit = parseWeightKg(item?.peso_kg ?? item?.peso ?? item?.weight ?? 0);
      totalWeightKg += (wPerUnit * qty);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width:36px;">
          <img src="${item.image || 'img/default.jpg'}" alt="${item.name || ''}" style="width:28px; height:28px; object-fit:contain; border-radius:6px;" onerror="this.src='img/default.jpg'" />
        </td>
        <td>${index}</td>
        <td>${wPerUnit ? (Number(wPerUnit).toFixed(1) + ' kg') : '-'}</td>
        <td>${item.sku || item.id || '-'}</td>
        <td style="text-align:left;">${item.name || ''}</td>
        <td>${qty}</td>
        <td>${formatCurrency(unitPriceNet)}</td>
        <td>${formatCurrency(rowDiscount)}</td>
        <td>
          <input type="number" class="cr-item-discount-input" 
            data-key="${itemKey}" 
            value="${currentPercent}" 
            min="0" max="100" step="0.5"
            style="width:60px; text-align:center; padding:2px; border:1px solid #cbd5e1; border-radius:4px;"
            ${!hasGlobalDiscount ? 'disabled' : ''}>
        </td>
        <td style="font-weight:600;">${formatCurrency(rowTotal)}</td>
      `;
      return tr;
    };

    // Productos
    if (state.cart && Array.isArray(state.cart)) {
      state.cart.forEach((ci, idx) => {
        const p = state.products?.find(x => x.id === ci.id);
        if (p) {
          rowCount++;
          tbody.appendChild(createRow(p, 'prod', rowCount, ci.qty));
        }
      });
    }

    // Accesorios
    if (state.accessories && state.accSelected) {
      const accMap = new Map((state.accessories || []).map(a => [window.accKey ? window.accKey(a) : getAccKey(a), a]));
      state.accSelected.forEach(id => {
        const acc = accMap.get(id);
        if (acc) {
          rowCount++;
          const qty = Math.max(1, Number(state.accQty?.[id] || 1));
          tbody.appendChild(createRow(acc, 'acc', rowCount, qty));
        }
      });
    }

    // Vincular eventos a los inputs de la tabla
    tbody.querySelectorAll('.cr-item-discount-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const key = input.getAttribute('data-key');
        const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
        e.target.value = val;
        itemDiscounts[key] = val;
        // Al cambiar individualmente, perdemos la "sincronía perfecta" con el global, lo cual es correcto
        populateQuoteSummaryVenta();
        populateFinancialSummaryVenta();
        if (window.updateGrandTotal) window.updateGrandTotal();
      });
      // Evitar que el scroll del mouse cambie el valor sin querer
      input.addEventListener('wheel', (e) => e.preventDefault());
    });

    // Totales Finales
    const constantIVA = 0.16;
    const subtotalFinal = subtotalNeto - totalDescuentoCalculado;
    const ivaFinal = subtotalFinal * constantIVA;
    const totalFinal = subtotalFinal + ivaFinal;

    const subtotalEl = document.getElementById('cr-summary-subtotal');
    const discountEl = document.getElementById('cr-summary-discount');
    const ivaEl = document.getElementById('cr-summary-iva');
    const totalEl = document.getElementById('cr-summary-total');
    const weightEl = document.getElementById('cr-summary-weight-total');

    const finalBaseSubtotalTable = subtotalNeto - totalDescuentoCalculado;
    if (subtotalEl) subtotalEl.textContent = formatCurrency(finalBaseSubtotalTable);
    if (discountEl) discountEl.textContent = formatCurrency(totalDescuentoCalculado);
    if (ivaEl) ivaEl.textContent = formatCurrency(ivaFinal);
    if (totalEl) totalEl.textContent = formatCurrency(totalFinal);
    if (weightEl) weightEl.textContent = `${totalWeightKg.toFixed(2)} kg`;
  }

  // Poblar Resumen Financiero (adaptado para VENTA - sin días, sin garantía)
  function populateFinancialSummaryVenta() {
    console.log('💹 [VENTA] Poblando resumen financiero...');

    const state = window.state;
    if (!state) return;

    let subtotalNeto = 0;
    let totalDescuento = 0;
    const itemDiscounts = ensureItemDiscountsMap();
    const discountSelect = document.getElementById('cr-summary-apply-discount');
    const hasGlobalDiscount = discountSelect?.value === 'si';

    // Función unificada para sumar líneas
    const addLine = (item, type, qty) => {
      const unitPriceIVA = Number(type === 'prod' ? (item.price?.diario || item.price?.venta || 0) : (item.price || 0));
      const unitPriceNet = unitPriceIVA / 1.16;
      const lineSubtotal = unitPriceNet * qty;

      const itemKey = getItemDiscountKey(item.id, type);
      const percent = hasGlobalDiscount ? (itemDiscounts[itemKey] ?? 0) : 0;

      subtotalNeto += lineSubtotal;
      totalDescuento += lineSubtotal * (percent / 100);
    };

    if (state.cart) {
      state.cart.forEach(ci => {
        const p = state.products?.find(x => x.id === ci.id);
        if (p) addLine(p, 'prod', ci.qty);
      });
    }

    if (state.accessories && state.accSelected) {
      const accMap = new Map((state.accessories || []).map(a => [window.accKey ? window.accKey(a) : getAccKey(a), a]));
      state.accSelected.forEach(id => {
        const acc = accMap.get(id);
        if (acc) {
          const qty = Math.max(1, Number(state.accQty?.[id] || 1));
          addLine(acc, 'acc', qty);
        }
      });
    }

    // Otros cargos (Envío)
    const rbHome = document.getElementById('delivery-home-radio');
    const isHome = rbHome && rbHome.checked;
    const hiddenCostEl = document.getElementById('cr-delivery-cost');
    let shippingCost = isHome ? (parseFloat(hiddenCostEl?.value) || 0) : 0;

    // IVA toggle
    const ivaSelect = document.getElementById('cr-apply-iva');
    const applyIVA = (ivaSelect?.value === 'si');

    const afterDiscount = subtotalNeto - totalDescuento;
    const ivaAmount = applyIVA ? (afterDiscount * 0.16) : 0;
    const finalTotal = afterDiscount + ivaAmount + shippingCost;

    // UI Update
    const unitPriceEl = document.getElementById('cr-fin-unit-price');
    const subtotalEl = document.getElementById('cr-fin-subtotal');
    const shippingEl = document.getElementById('cr-fin-shipping');
    const discountEl = document.getElementById('cr-fin-discount');
    const ivaEl = document.getElementById('cr-fin-iva');
    const totalEl = document.getElementById('cr-fin-total');

    const finalBaseSubtotalFin = subtotalNeto - totalDescuento;
    if (subtotalEl) subtotalEl.textContent = formatCurrency(finalBaseSubtotalFin);
    if (shippingEl) {
      shippingEl.textContent = formatCurrency(shippingCost);
      shippingEl.style.display = shippingCost > 0 ? '' : 'none';
      if (shippingEl.previousElementSibling) shippingEl.previousElementSibling.style.display = shippingCost > 0 ? '' : 'none';
    }
    if (discountEl) discountEl.textContent = formatCurrency(totalDescuento);
    if (ivaEl) ivaEl.textContent = formatCurrency(ivaAmount);
    if (totalEl) totalEl.textContent = formatCurrency(finalTotal);
  }

  // Utilidades
  function formatCurrency(amount) {
    try {
      // Usar la función currency del archivo principal si existe
      if (window.currency && typeof window.currency === 'function') {
        return window.currency(amount);
      }

      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        maximumFractionDigits: 2
      }).format(Number(amount) || 0);
    } catch {
      return `$${(Number(amount) || 0).toFixed(2)}`;
    }
  }

  function getAccKey(a) {
    try {
      const base = String(a?.sku || a?.id || a?.name || '').toLowerCase();
      return base
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    } catch {
      return String(a?.name || '').toLowerCase();
    }
  }

  // Bind del botón "Guardar datos" y eventos de descuento
  function bindSaveDataButton() {
    console.log('🔗 [VENTA] Vinculando botón Guardar datos...');

    const saveBtn = document.getElementById('cr-save-contact');
    if (saveBtn && !saveBtn.__boundVenta) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🖱️ Botón "Guardar datos" clickeado');
        // Si el método es pickup, garantizar envío = 0 antes de mostrar resúmenes
        try {
          const st = window.state || (window.state = {});
          const dtype = st.deliveryType || getDeliveryType();
          if (dtype === 'pickup') {
            const h = document.getElementById('cr-delivery-cost'); if (h) h.value = '0';
            const d = document.getElementById('cr-delivery-cost-display'); if (d) { try { d.__programmatic = true; } catch { } d.textContent = '$0'; try { setTimeout(() => { d.__programmatic = false; }, 0); } catch { } }
          }
        } catch { }
        showSummaryCards();
      });
      saveBtn.__boundVenta = true;
      console.log('✅ Botón "Guardar datos" vinculado');
    } else if (!saveBtn) {
      console.error('❌ No se encontró el botón #cr-save-contact');
    }

  }

  // Función para vincular controles de descuento
  function bindDiscountControls() {
    console.log('🔗 [VENTA] Vinculando controles de descuento...');

    // Bind eventos de descuento para recalcular
    const discountSelect = document.getElementById('cr-summary-apply-discount');
    const discountInput = document.getElementById('cr-summary-discount-percent-input');

    if (discountSelect && !discountSelect.__boundVenta) {
      discountSelect.addEventListener('change', () => {
        console.log('🔄 Recalculando por cambio de descuento global');

        const isEnabled = discountSelect.value === 'si';
        const dInput = document.getElementById('cr-summary-discount-percent-input');
        if (dInput) {
          dInput.readOnly = !isEnabled;
          dInput.style.opacity = isEnabled ? '1' : '0.6';
          dInput.style.backgroundColor = isEnabled ? 'white' : '#f3f4f6';
          dInput.style.cursor = isEnabled ? 'text' : 'not-allowed';
          if (!isEnabled) dInput.value = '0';
        }

        // Al habilitar/deshabilitar, resetear los descuentos individuales al valor global
        const state = window.state;
        if (state) {
          const itemDiscounts = ensureItemDiscountsMap();
          const targetPercent = isEnabled ? parseFloat(dInput?.value || 0) : 0;

          // Resetear todas las claves
          Object.keys(itemDiscounts).forEach(k => {
            itemDiscounts[k] = targetPercent;
          });

          // También poblar claves de ítems actuales si no existen
          const syncMap = (list, type) => {
            if (list) list.forEach(item => {
              const id = item.id || (item.id_producto);
              if (id) itemDiscounts[getItemDiscountKey(id, type)] = targetPercent;
            });
          };
          syncMap(state.cart, 'prod');
          if (state.accSelected && state.accessories) {
            state.accSelected.forEach(id => itemDiscounts[getItemDiscountKey(id, 'acc')] = targetPercent);
          }
        }

        populateQuoteSummaryVenta();
        populateFinancialSummaryVenta();
        if (window.updateGrandTotal) window.updateGrandTotal();
      });
      discountSelect.__boundVenta = true;
    }

    if (discountInput && !discountInput.__boundVenta) {
      discountInput.addEventListener('change', () => {
        console.log('🔄 Sincronizando descuentos individuales con el nuevo valor global');
        const state = window.state;
        const isEnabled = discountSelect?.value === 'si';
        if (state && isEnabled) {
          const itemDiscounts = ensureItemDiscountsMap();
          const targetPercent = parseFloat(discountInput.value || 0);
          Object.keys(itemDiscounts).forEach(k => itemDiscounts[k] = targetPercent);
        }
        populateQuoteSummaryVenta();
        populateFinancialSummaryVenta();
        if (window.updateGrandTotal) window.updateGrandTotal();
      });
      discountInput.__boundVenta = true;
    }

    // Inicializar estado del input de descuento
    if (discountSelect && discountInput) {
      const isEnabled = discountSelect.value === 'si';
      // Usar readonly en lugar de disabled para mantener la funcionalidad del teclado
      discountInput.readOnly = !isEnabled;
      discountInput.style.opacity = isEnabled ? '1' : '0.6';
      discountInput.style.backgroundColor = isEnabled ? 'white' : '#f3f4f6';
      discountInput.style.cursor = isEnabled ? 'text' : 'not-allowed';
      if (!isEnabled) discountInput.value = '0';
    }

    console.log('✅ Controles de descuento vinculados');
  }

  // Inicializar cuando el DOM esté listo
  function initVentaSummary() {

    // Esperar un poco para asegurar que el estado esté disponible
    setTimeout(() => {
      bindSaveDataButton();
      bindDiscountControls();
      // Bind IVA controls
      try {
        const ivaSelect = document.getElementById('cr-apply-iva');
        if (ivaSelect && !ivaSelect.__boundVenta) {
          ivaSelect.addEventListener('change', () => {
            try {
              populateFinancialSummaryVenta();
              // actualizar grand total si existe
              if (window.updateGrandTotal) window.updateGrandTotal();
            } catch { }
          });
          ivaSelect.__boundVenta = true;
        }
      } catch { }
      // Vincular botones de entrega para fijar el tipo correctamente
      try { bindDeliveryButtons(); } catch { }
      // Observar cambios en el método de entrega para re-sincronizar
      try {
        const methodEl = document.getElementById('cr-delivery-method');
        if (methodEl && !methodEl.__obsVenta) {
          const mo = new MutationObserver(() => { try { syncDeliveryTypeAndShippingUI(); } catch { } });
          mo.observe(methodEl, { childList: true, subtree: true, characterData: true });
          methodEl.__obsVenta = mo;
        }
      } catch { }
      // Actualizar grand total inicial
      if (window.updateGrandTotal) window.updateGrandTotal();
      console.log('✅ Resumen de venta inicializado');
    }, 100);
  }

  // Función de debugging para controles de descuentos
  function debugDiscountControls() {
    const discountSelect = document.getElementById('cr-summary-apply-discount');
    const discountInput = document.getElementById('cr-summary-discount-percent-input');
    const toolbar = summaryCard ? summaryCard.querySelector('.cr-card__row .cr-toolbar') : null;

    console.log('🔍 [DEBUG] Estado de controles de descuento:');
    console.log('Card visible:', summaryCard ? getComputedStyle(summaryCard).display !== 'none' : false);
    console.log('Select existe:', !!discountSelect);
    console.log('Input existe:', !!discountInput);
    console.log('Toolbar existe:', !!toolbar);

    if (discountSelect) {
      console.log('Select HTML:', discountSelect.outerHTML);
      console.log('Select estilos:', {
        display: getComputedStyle(discountSelect).display,
        visibility: getComputedStyle(discountSelect).visibility,
        opacity: getComputedStyle(discountSelect).opacity
      });
    }

    if (discountInput) {
      console.log('Input HTML:', discountInput.outerHTML);
      console.log('Input estilos:', {
        display: getComputedStyle(discountInput).display,
        visibility: getComputedStyle(discountInput).visibility,
        opacity: getComputedStyle(discountInput).opacity
      });
    }

    if (toolbar) {
      console.log('Toolbar HTML:', toolbar.outerHTML);
      console.log('Toolbar estilos:', {
        display: getComputedStyle(toolbar).display,
        visibility: getComputedStyle(toolbar).visibility
      });
    }

    return {
      summaryCard: !!summaryCard,
      discountSelect: !!discountSelect,
      discountInput: !!discountInput,
      toolbar: !!toolbar
    };
  }

  // Función para actualizar todos los totales
  function updateAllTotals() {
    try {
      // Actualizar grand total
      if (window.updateGrandTotal) window.updateGrandTotal();

      // Si las cards están visibles, actualizar también los resúmenes
      const summaryCard = document.getElementById('cr-quote-summary-card');
      const financialCard = document.getElementById('cr-financial-summary');

      if (summaryCard && summaryCard.style.display !== 'none') {
        populateQuoteSummaryVenta();
      }

      if (financialCard && financialCard.style.display !== 'none') {
        populateFinancialSummaryVenta();
      }
    } catch (e) {
      console.error('Error actualizando totales:', e);
    }
  }

  // Exponer funciones globalmente
  window.showSummaryCards = showSummaryCards;
  window.populateQuoteSummaryVenta = populateQuoteSummaryVenta;
  window.populateFinancialSummaryVenta = populateFinancialSummaryVenta;
  window.bindSaveDataButton = bindSaveDataButton;
  window.debugVentaState = debugState;
  window.debugDiscountControls = debugDiscountControls;
  window.updateAllTotals = updateAllTotals;

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVentaSummary);
  } else {
    initVentaSummary();
  }
})();
