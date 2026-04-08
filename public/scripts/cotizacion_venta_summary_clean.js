/**
 * RESUMEN DE COTIZACIÓN Y DATOS FINANCIEROS - MÓDULO DE VENTA
 * Gestiona visualización de resúmenes, cálculos de descuentos e IVA
 */

(() => {
  'use strict';

  // ============================================================================
  // CONFIGURACIÓN Y CONSTANTES
  // ============================================================================

  const CONFIG = {
    IVA_RATE: 0.16,
    SHIPPING_FREE_THRESHOLD_KM: 5,
    SHIPPING_BASE_RATE: 4,
    SHIPPING_METRO_FACTOR: 12,
    SHIPPING_REMOTE_FACTOR: 18,
    DISCOUNT_MAX_PERCENT: 100,
    AUTO_CALC_DEBOUNCE_MS: 200
  };

  const DOM_IDS = {
    // Botones
    saveContact: 'cr-save-contact',
    calculateShipping: 'calculate-shipping-cost-btn',
    // Radios
    branchRadio: 'delivery-branch-radio',
    homeRadio: 'delivery-home-radio',
    // Entrega
    distance: 'cr-delivery-distance',
    zone: 'cr-zone-type',
    deliveryMethod: 'cr-delivery-method',
    costHidden: 'cr-delivery-cost',
    costDisplay: 'cr-delivery-cost-display',
    // Cards
    homeWrap: 'cr-home-delivery-wrap',
    branchCard: 'cr-branch-card',
    branchSelect: 'cr-branch-select',
    branchSummary: 'cr-branch-summary',
    branchName: 'cr-branch-name',
    // Resumen
    summaryCard: 'cr-quote-summary-card',
    financialCard: 'cr-financial-summary',
    summaryRows: 'cr-summary-rows',
    // Descuentos
    discountSelect: 'cr-summary-apply-discount',
    discountInput: 'cr-summary-discount-percent-input',
    // IVA
    ivaSelect: 'cr-apply-iva',
    // Totales
    subtotal: 'cr-summary-subtotal',
    discount: 'cr-summary-discount',
    iva: 'cr-summary-iva',
    total: 'cr-summary-total',
    weight: 'cr-summary-weight-total'
  };

  // ============================================================================
  // UTILIDADES GENERALES
  // ============================================================================

  /**
   * Obtiene elemento del DOM por ID
   */
  function getElement(id) {
    return document.getElementById(id);
  }

  /**
   * Valida si un valor es numérico válido
   */
  function isValidNumber(value) {
    if (value === null || value === undefined) return false;
    const num = parseFloat(String(value).trim());
    return Number.isFinite(num);
  }

  /**
   * Convierte diversas representaciones de peso a kg
   */
  function parseWeightKg(value) {
    if (!value) return 0;
    try {
      if (typeof value === 'number' && isFinite(value)) return Math.max(0, value);
      const str = String(value).toLowerCase().trim();
      const match = str.match(/([0-9]+(?:\.[0-9]+)?)/);
      if (!match) return 0;
      const num = Number(match[1]);
      if (!isFinite(num)) return 0;
      return str.includes('lb') ? +(num * 0.453592).toFixed(3) : Math.max(0, num);
    } catch {
      return 0;
    }
  }

  /**
   * Formatea valor a moneda MXN
   */
  function formatCurrency(amount) {
    try {
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

  /**
   * Normaliza clave de accesorio
   */
  function getNormalizedAccessoryKey(accessory) {
    try {
      const base = String(accessory?.sku || accessory?.id || accessory?.name || '').toLowerCase();
      return base
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    } catch {
      return String(accessory?.name || '').toLowerCase();
    }
  }

  /**
   * Asegura la estructura del mapa de descuentos
   */
  function ensureItemDiscountsMap() {
    const state = window.state;
    if (!state) return {};
    if (typeof state.itemDiscounts !== 'object' || state.itemDiscounts === null) {
      state.itemDiscounts = {};
    }
    return state.itemDiscounts;
  }

  /**
   * Construye clave única para item (producto o accesorio)
   */
  function getItemDiscountKey(itemId, itemType = 'prod') {
    return `${itemType}:${String(itemId ?? '')}`;
  }

  // ============================================================================
  // CÁLCULOS DE ENVÍO
  // ============================================================================

  /**
   * Calcula coste de envío basado en km y zona
   */
  function calculateShippingCost(km, zone = 'metropolitana') {
    if (km <= CONFIG.SHIPPING_FREE_THRESHOLD_KM) return 0;
    const factor = zone === 'foraneo' ? CONFIG.SHIPPING_REMOTE_FACTOR : CONFIG.SHIPPING_METRO_FACTOR;
    return Math.max(0, km * CONFIG.SHIPPING_BASE_RATE * factor);
  }

  /**
   * Extrae número de texto de coste formateado
   */
  function extractNumericValue(text) {
    const cleaned = String(text || '').replace(/[^0-9.,-]/g, '').replace(/,/g, '');
    return Number(cleaned) || 0;
  }

  /**
   * Calcula y renderiza coste de envío automáticamente
   */
  function calculateAndRenderShippingCost() {
    try {
      const distEl = getElement(DOM_IDS.distance);
      const zoneEl = getElement(DOM_IDS.zone);
      const costEl = getElement(DOM_IDS.costHidden);
      const displayEl = getElement(DOM_IDS.costDisplay);

      if (!distEl) return;

      const km = Math.max(0, parseFloat(distEl.value) || 0);
      const zone = zoneEl?.value || 'metropolitana';
      const cost = calculateShippingCost(km, zone);

      if (costEl) costEl.value = String(cost);
      if (displayEl) {
        try { displayEl.__programmatic = true; } catch { }
        displayEl.textContent = formatCurrency(cost);
        try { setTimeout(() => { displayEl.__programmatic = false; }, 0); } catch { }
      }

      if (window.updateAllTotals) window.updateAllTotals();

      // Guardar para restauración
      try {
        window.state = window.state || {};
        if (cost > 0) window.state.lastHomeShippingCost = cost;
      } catch { }
    } catch (error) {
      console.error('[calculateAndRenderShippingCost] Error:', error);
    }
  }

  /**
   * Vincul eventos de cálculo automático de envío
   */
  function bindAutoShippingCalculation() {
    const distEl = getElement(DOM_IDS.distance);
    const zoneEl = getElement(DOM_IDS.zone);

    if (distEl && !distEl.__ventaBound) {
      distEl.addEventListener('input', calculateAndRenderShippingCost);
      distEl.addEventListener('change', calculateAndRenderShippingCost);
      distEl.__ventaBound = true;
    }

    if (zoneEl && !zoneEl.__ventaBound) {
      zoneEl.addEventListener('change', calculateAndRenderShippingCost);
      zoneEl.__ventaBound = true;
    }
  }

  /**
   * Establece visibilidad de cards de envío a domicilio
   */
  function setHomeDeliveryCardsVisibility(visible) {
    try {
      const homeWrap = getElement(DOM_IDS.homeWrap);
      if (!homeWrap) return;

      const cards = homeWrap.querySelectorAll(':scope > .cr-card');
      [0, 1].forEach(idx => {
        if (cards[idx]) cards[idx].style.display = visible ? '' : 'none';
      });
    } catch { }
  }

  /**
   * Determina tipo de entrega actual
   */
  function getDeliveryType() {
    try {
      const branchRadio = getElement(DOM_IDS.branchRadio);
      const homeRadio = getElement(DOM_IDS.homeRadio);

      if (branchRadio?.checked) return 'pickup';
      if (homeRadio?.checked) return 'home';

      const methodTxt = (getElement(DOM_IDS.deliveryMethod)?.textContent || '').toLowerCase();
      if (/sucursal|recolec/.test(methodTxt)) return 'pickup';
      if (/domicilio|envio|entrega/.test(methodTxt)) return 'home';

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // ============================================================================
  // GESTIÓN DE ENTREGAS (RADIOS Y SELECTORES)
  // ============================================================================

  /**
   * Vincula eventos de radios de método de entrega
   */
  function bindDeliveryMethodButtons() {
    const branchRadio = getElement(DOM_IDS.branchRadio);
    const homeRadio = getElement(DOM_IDS.homeRadio);
    const branchSelect = getElement(DOM_IDS.branchSelect);

    if (branchRadio && !branchRadio.__ventaBound) {
      branchRadio.addEventListener('change', () => {
        if (!branchRadio.checked) return;
        handlePickupSelection();
      });
      branchRadio.__ventaBound = true;
    }

    if (homeRadio && !homeRadio.__ventaBound) {
      homeRadio.addEventListener('change', () => {
        if (!homeRadio.checked) return;
        handleHomeDeliverySelection();
      });
      homeRadio.__ventaBound = true;
    }

    if (branchSelect && !branchSelect.__ventaBound) {
      branchSelect.addEventListener('change', handleBranchSelection);
      branchSelect.__ventaBound = true;
    }
  }

  /**
   * Maneja selección de recogida en sucursal
   */
  function handlePickupSelection() {
    try {
      window.state = window.state || {};

      // Guardar último costo de domicilio
      try {
        const hPrev = Number(getElement(DOM_IDS.costHidden)?.value || 0);
        const dPrevTxt = extractNumericValue(getElement(DOM_IDS.costDisplay)?.textContent || '');
        const prev = isFinite(hPrev) && hPrev > 0 ? hPrev : (isFinite(dPrevTxt) ? dPrevTxt : 0);
        if (isFinite(prev) && prev > 0) window.state.lastHomeShippingCost = prev;
      } catch { }

      window.state.deliveryType = 'pickup';
      if (document.body) document.body.dataset.delivery = 'pickup';

      if (getElement(DOM_IDS.branchCard)) getElement(DOM_IDS.branchCard).style.display = '';
      setHomeDeliveryCardsVisibility(false);

      // Resetear costo a 0
      if (getElement(DOM_IDS.costHidden)) getElement(DOM_IDS.costHidden).value = '0';
      if (getElement(DOM_IDS.costDisplay)) {
        try { getElement(DOM_IDS.costDisplay).__programmatic = true; } catch { }
        getElement(DOM_IDS.costDisplay).textContent = '$0';
        try { setTimeout(() => { getElement(DOM_IDS.costDisplay).__programmatic = false; }, 0); } catch { }
      }

      if (getElement(DOM_IDS.deliveryMethod)) {
        getElement(DOM_IDS.deliveryMethod).textContent = 'Método: Recolección en Sucursal';
      }

      syncDeliveryState();
      if (window.updateAllTotals) window.updateAllTotals();
    } catch (error) {
      console.error('[handlePickupSelection] Error:', error);
    }
  }

  /**
   * Maneja selección de entrega a domicilio
   */
  function handleHomeDeliverySelection() {
    try {
      window.state = window.state || {};
      window.state.deliveryType = 'home';
      if (document.body) document.body.dataset.delivery = 'home';

      if (getElement(DOM_IDS.branchCard)) getElement(DOM_IDS.branchCard).style.display = 'none';
      setHomeDeliveryCardsVisibility(true);

      if (getElement(DOM_IDS.deliveryMethod)) {
        getElement(DOM_IDS.deliveryMethod).textContent = 'Método: Entrega a Domicilio';
      }

      // Restaurar último costo
      try {
        const last = window.state.lastHomeShippingCost;
        if (isFinite(last) && last > 0) {
          if (getElement(DOM_IDS.costHidden)) getElement(DOM_IDS.costHidden).value = String(last);
          if (getElement(DOM_IDS.costDisplay)) {
            try { getElement(DOM_IDS.costDisplay).__programmatic = true; } catch { }
            getElement(DOM_IDS.costDisplay).textContent = formatCurrency(last);
            try { setTimeout(() => { getElement(DOM_IDS.costDisplay).__programmatic = false; }, 0); } catch { }
          }
        }
      } catch { }

      if (window.updateAllTotals) window.updateAllTotals();
      syncDeliveryState();
    } catch (error) {
      console.error('[handleHomeDeliverySelection] Error:', error);
    }
  }

  /**
   * Maneja selección de sucursal específica
   */
  function handleBranchSelection(event) {
    try {
      if (!event.target.value) return;

      window.state = window.state || {};
      window.state.deliveryType = 'pickup';
      if (document.body) document.body.dataset.delivery = 'pickup';

      const branchSelect = event.target;
      const branchName = branchSelect.options[branchSelect.selectedIndex]?.text || '';

      if (getElement(DOM_IDS.deliveryMethod)) {
        getElement(DOM_IDS.deliveryMethod).textContent = `Método: Recolección en Sucursal · ${branchName}`;
      }

      if (getElement(DOM_IDS.costHidden)) getElement(DOM_IDS.costHidden).value = '0';
      if (getElement(DOM_IDS.costDisplay)) {
        try { getElement(DOM_IDS.costDisplay).__programmatic = true; } catch { }
        getElement(DOM_IDS.costDisplay).textContent = '$0';
        try { setTimeout(() => { getElement(DOM_IDS.costDisplay).__programmatic = false; }, 0); } catch { }
      }

      const branchSummary = getElement(DOM_IDS.branchSummary);
      const branchNameEl = getElement(DOM_IDS.branchName);
      if (branchSummary && branchNameEl) {
        branchNameEl.textContent = branchName;
        branchSummary.hidden = false;
      }

      if (window.updateAllTotals) window.updateAllTotals();
    } catch (error) {
      console.error('[handleBranchSelection] Error:', error);
    }
  }

  /**
   * Sincroniza estado de entrega con UI
   */
  function syncDeliveryState() {
    try {
      const st = window.state || (window.state = {});
      const type = getDeliveryType();
      st.deliveryType = type;

      if (type === 'pickup') {
        if (getElement(DOM_IDS.costHidden)) getElement(DOM_IDS.costHidden).value = '0';
        if (getElement(DOM_IDS.costDisplay)) getElement(DOM_IDS.costDisplay).textContent = '$0';
      }

      if (window.populateFinancialSummaryVenta) window.populateFinancialSummaryVenta();
    } catch (error) {
      console.error('[syncDeliveryState] Error:', error);
    }
  }

  // ============================================================================
  // RESUMEN DE COTIZACIÓN
  // ============================================================================

  /**
   * Poblamiento de tabla de resumen con descuentos
   */
  function populateQuoteSummaryVenta() {
    console.log('[populateQuoteSummaryVenta] Poblando tabla de resumen');

    const tbody = getElement(DOM_IDS.summaryRows);
    if (!tbody) {
      console.error('[populateQuoteSummaryVenta] No se encontró #cr-summary-rows');
      return;
    }

    tbody.innerHTML = '';
    let subtotalNeto = 0;
    let totalDescuentoCalculado = 0;
    let rowCount = 0;
    let totalWeightKg = 0;

    const state = window.state;
    if (!state) return;

    const discountSelect = getElement(DOM_IDS.discountSelect);
    const discountInput = getElement(DOM_IDS.discountInput);
    const hasGlobalDiscount = discountSelect?.value === 'si';
    const globalPercent = hasGlobalDiscount ? Number(discountInput?.value || 0) : 0;

    const itemDiscounts = ensureItemDiscountsMap();

    const createRow = (item, type, index, qty) => {
      const itemKey = getItemDiscountKey(item.id, type);

      if (itemDiscounts[itemKey] === undefined && hasGlobalDiscount) {
        itemDiscounts[itemKey] = globalPercent;
      } else if (!hasGlobalDiscount) {
        itemDiscounts[itemKey] = 0;
      }

      const currentPercent = Number(itemDiscounts[itemKey] || 0);
      const unitPriceIVA = Number(type === 'prod' ? (item.price?.diario || item.price?.venta || 0) : (item.price || 0));
      const unitPriceNet = unitPriceIVA / (1 + CONFIG.IVA_RATE);
      const rowSubtotal = unitPriceNet * qty;
      const rowDiscount = rowSubtotal * (currentPercent / 100);
      const rowTotal = rowSubtotal - rowDiscount;

      subtotalNeto += rowSubtotal;
      totalDescuentoCalculado += rowDiscount;

      const wPerUnit = parseWeightKg(item?.peso_kg ?? item?.peso ?? item?.weight ?? 0);
      totalWeightKg += (wPerUnit * qty);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width:36px; text-align: center;">
          <img src="${item.image || 'img/default.jpg'}" alt="" style="width:28px; height:28px; object-fit:contain; border-radius:6px;" onerror="this.src='img/default.jpg'" />
        </td>
        <td>${index}</td>
        <td>${wPerUnit ? (Number(wPerUnit).toFixed(1) + ' kg') : '-'}</td>
        <td>${item.sku || item.id || '-'}</td>
        <td style="text-align:left;">${item.name || ''}</td>
        <td>${qty}</td>
        <td>${formatCurrency(unitPriceNet)}</td>
        <td>${formatCurrency(rowDiscount)}</td>
        <td>
          <input type="number" class="cr-item-discount-input" data-key="${itemKey}" 
            value="${currentPercent}" min="0" max="100" step="0.5"
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
      const accMap = new Map((state.accessories || []).map(a => {
        const key = window.accKey ? window.accKey(a) : getNormalizedAccessoryKey(a);
        return [key, a];
      }));
      state.accSelected.forEach(id => {
        const acc = accMap.get(id);
        if (acc) {
          rowCount++;
          const qty = Math.max(1, Number(state.accQty?.[id] || 1));
          tbody.appendChild(createRow(acc, 'acc', rowCount, qty));
        }
      });
    }

    // Event listeners para descuentos individuales
    tbody.querySelectorAll(DOM_IDS.itemDiscountInputs).forEach(input => {
      input.addEventListener('change', (e) => {
        const key = input.getAttribute('data-key');
        const val = Math.min(CONFIG.DISCOUNT_MAX_PERCENT, Math.max(0, parseFloat(e.target.value) || 0));
        e.target.value = val;
        itemDiscounts[key] = val;
        populateQuoteSummaryVenta();
        populateFinancialSummaryVenta();
        if (window.updateGrandTotal) window.updateGrandTotal();
      });
      input.addEventListener('wheel', (e) => e.preventDefault());
    });

    // Actualizar totales
    const subtotalFinal = subtotalNeto - totalDescuentoCalculado;
    const ivaFinal = subtotalFinal * CONFIG.IVA_RATE;
    const totalFinal = subtotalFinal + ivaFinal;

    if (getElement(DOM_IDS.subtotal)) getElement(DOM_IDS.subtotal).textContent = formatCurrency(subtotalFinal);
    if (getElement(DOM_IDS.discount)) getElement(DOM_IDS.discount).textContent = formatCurrency(totalDescuentoCalculado);
    if (getElement(DOM_IDS.iva)) getElement(DOM_IDS.iva).textContent = formatCurrency(ivaFinal);
    if (getElement(DOM_IDS.total)) getElement(DOM_IDS.total).textContent = formatCurrency(totalFinal);
    if (getElement(DOM_IDS.weight)) getElement(DOM_IDS.weight).textContent = `${totalWeightKg.toFixed(2)} kg`;
  }

  /**
   * Poblamiento de resumen financiero
   */
  function populateFinancialSummaryVenta() {
    console.log('[populateFinancialSummaryVenta] Poblando resumen financiero');

    const state = window.state;
    if (!state) return;

    let subtotalNeto = 0;
    let totalDescuento = 0;
    const itemDiscounts = ensureItemDiscountsMap();
    const discountSelect = getElement(DOM_IDS.discountSelect);
    const hasGlobalDiscount = discountSelect?.value === 'si';

    const addLine = (item, type, qty) => {
      const unitPriceIVA = Number(type === 'prod' ? (item.price?.diario || item.price?.venta || 0) : (item.price || 0));
      const unitPriceNet = unitPriceIVA / (1 + CONFIG.IVA_RATE);
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
      const accMap = new Map((state.accessories || []).map(a => {
        const key = window.accKey ? window.accKey(a) : getNormalizedAccessoryKey(a);
        return [key, a];
      }));
      state.accSelected.forEach(id => {
        const acc = accMap.get(id);
        if (acc) {
          const qty = Math.max(1, Number(state.accQty?.[id] || 1));
          addLine(acc, 'acc', qty);
        }
      });
    }

    // Envío
    const homeRadio = getElement(DOM_IDS.homeRadio);
    const isHome = homeRadio?.checked;
    const costEl = getElement(DOM_IDS.costHidden);
    const shippingCost = isHome ? (parseFloat(costEl?.value) || 0) : 0;

    // IVA
    const ivaSelect = getElement(DOM_IDS.ivaSelect);
    const applyIVA = ivaSelect?.value === 'si';

    const afterDiscount = subtotalNeto - totalDescuento;
    const ivaAmount = applyIVA ? (afterDiscount * CONFIG.IVA_RATE) : 0;
    const finalTotal = afterDiscount + ivaAmount + shippingCost;

    if (getElement(DOM_IDS.financialSubtotal)) {
      getElement(DOM_IDS.financialSubtotal).textContent = formatCurrency(afterDiscount);
    }

    const shippingEl = getElement(DOM_IDS.financialShipping);
    if (shippingEl) {
      shippingEl.textContent = formatCurrency(shippingCost);
      shippingEl.style.display = shippingCost > 0 ? '' : 'none';
      if (shippingEl.previousElementSibling) {
        shippingEl.previousElementSibling.style.display = shippingCost > 0 ? '' : 'none';
      }
    }

    if (getElement(DOM_IDS.financialDiscount)) {
      getElement(DOM_IDS.financialDiscount).textContent = formatCurrency(totalDescuento);
    }
    if (getElement(DOM_IDS.financialIva)) {
      getElement(DOM_IDS.financialIva).textContent = formatCurrency(ivaAmount);
    }
    if (getElement(DOM_IDS.financialTotal)) {
      getElement(DOM_IDS.financialTotal).textContent = formatCurrency(finalTotal);
    }
  }

  /**
   * Muestra cards de resumen
   */
  function showSummaryCards() {
    console.log('[showSummaryCards] Mostrando cards de resumen');

    const summaryCard = getElement(DOM_IDS.summaryCard);
    const financialCard = getElement(DOM_IDS.financialCard);

    if (summaryCard) {
      summaryCard.style.display = 'block';
      populateQuoteSummaryVenta();
    }

    if (financialCard) {
      financialCard.style.display = 'block';
      syncDeliveryState();
      populateFinancialSummaryVenta();
      if (window.updateGrandTotal) window.updateGrandTotal();
    }

    setTimeout(() => {
      summaryCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // ============================================================================
  // CONTROLES DE DESCUENTO E IVA
  // ============================================================================

  /**
   * Vincula eventos de descuentos globales
   */
  function bindDiscountControls() {
    console.log('[bindDiscountControls] Vinculando controles de descuento');

    const discountSelect = getElement(DOM_IDS.discountSelect);
    const discountInput = getElement(DOM_IDS.discountInput);

    if (discountSelect && !discountSelect.__boundVenta) {
      discountSelect.addEventListener('change', () => {
        const isEnabled = discountSelect.value === 'si';
        if (discountInput) {
          discountInput.readOnly = !isEnabled;
          discountInput.style.opacity = isEnabled ? '1' : '0.6';
          discountInput.style.backgroundColor = isEnabled ? 'white' : '#f3f4f6';
          discountInput.style.cursor = isEnabled ? 'text' : 'not-allowed';
          if (!isEnabled) discountInput.value = '0';
        }

        const state = window.state;
        if (state) {
          const itemDiscounts = ensureItemDiscountsMap();
          const targetPercent = isEnabled ? parseFloat(discountInput?.value || 0) : 0;
          Object.keys(itemDiscounts).forEach(k => { itemDiscounts[k] = targetPercent; });
        }

        populateQuoteSummaryVenta();
        populateFinancialSummaryVenta();
        if (window.updateGrandTotal) window.updateGrandTotal();
      });
      discountSelect.__boundVenta = true;
    }

    if (discountInput && !discountInput.__boundVenta) {
      discountInput.addEventListener('change', () => {
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

    if (discountSelect && discountInput) {
      const isEnabled = discountSelect.value === 'si';
      discountInput.readOnly = !isEnabled;
      discountInput.style.opacity = isEnabled ? '1' : '0.6';
      discountInput.style.backgroundColor = isEnabled ? 'white' : '#f3f4f6';
      discountInput.style.cursor = isEnabled ? 'text' : 'not-allowed';
      if (!isEnabled) discountInput.value = '0';
    }
  }

  /**
   * Solicita autorización de admin para quitar IVA
   */
  async function requestAdminAuthorizationForIVA() {
    const { value: password } = await Swal.fire({
      title: 'Se requiere autorización',
      text: 'Por favor, ingrese la contraseña de un administrador para quitar el IVA.',
      input: 'password',
      inputPlaceholder: 'Contraseña',
      showCancelButton: true,
      confirmButtonText: 'Autorizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#64748b'
    });

    if (!password) return false;

    try {
      const resp = await fetch('/api/auth/verify-admin-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ password })
      });
      const data = await resp.json();
      if (resp.ok && data.valid) return true;
      Swal.fire('Denegado', 'Privilegios insuficientes o contraseña incorrecta.', 'error');
      return false;
    } catch (e) {
      console.error('[requestAdminAuthorizationForIVA] Error:', e);
      Swal.fire('Error', 'No se pudo verificar la autorización.', 'error');
      return false;
    }
  }

  /**
   * Vincula evento de cambio de IVA
   */
  function bindIVAControl() {
    const ivaSelect = getElement(DOM_IDS.ivaSelect);
    if (ivaSelect && !ivaSelect.__boundVenta) {
      ivaSelect.addEventListener('change', async (e) => {
        if (e.target.value === 'no') {
          const autorizado = await requestAdminAuthorizationForIVA();
          if (!autorizado) {
            ivaSelect.value = 'si';
            return;
          }
        }
        populateFinancialSummaryVenta();
        if (window.updateGrandTotal) window.updateGrandTotal();
      });
      ivaSelect.__boundVenta = true;
    }
  }

  /**
   * Vincula botón de guardar datos y mostrar resumen
   */
  function bindSaveDataButton() {
    const saveBtn = getElement(DOM_IDS.saveContact);
    if (saveBtn && !saveBtn.__boundVenta) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        try {
          const st = window.state || (window.state = {});
          const dtype = st.deliveryType || getDeliveryType();
          if (dtype === 'pickup') {
            if (getElement(DOM_IDS.costHidden)) getElement(DOM_IDS.costHidden).value = '0';
            if (getElement(DOM_IDS.costDisplay)) {
              try { getElement(DOM_IDS.costDisplay).__programmatic = true; } catch { }
              getElement(DOM_IDS.costDisplay).textContent = '$0';
              try { setTimeout(() => { getElement(DOM_IDS.costDisplay).__programmatic = false; }, 0); } catch { }
            }
          }
        } catch { }
        showSummaryCards();
      });
      saveBtn.__boundVenta = true;
    }
  }

  /**
   * Actualiza todos los totales
   */
  function updateAllTotals() {
    try {
      if (window.updateGrandTotal) window.updateGrandTotal();

      const summaryCard = getElement(DOM_IDS.summaryCard);
      const financialCard = getElement(DOM_IDS.financialCard);

      if (summaryCard && summaryCard.style.display !== 'none') {
        populateQuoteSummaryVenta();
      }
      if (financialCard && financialCard.style.display !== 'none') {
        populateFinancialSummaryVenta();
      }
    } catch (e) {
      console.error('[updateAllTotals] Error:', e);
    }
  }

  // ============================================================================
  // INICIALIZACIÓN
  // ============================================================================

  /**
   * Inicializa módulo de resumen
   */
  function initVentaSummary() {
    setTimeout(() => {
      bindSaveDataButton();
      bindDiscountControls();
      bindIVAControl();
      bindDeliveryMethodButtons();
      bindAutoShippingCalculation();

      // Observar cambios en método de entrega
      try {
        const methodEl = getElement(DOM_IDS.deliveryMethod);
        if (methodEl && !methodEl.__obsVenta) {
          const mo = new MutationObserver(() => { try { syncDeliveryState(); } catch { } });
          mo.observe(methodEl, { childList: true, subtree: true, characterData: true });
          methodEl.__obsVenta = mo;
        }
      } catch { }

      if (window.updateGrandTotal) window.updateGrandTotal();
      console.log('[initVentaSummary] Inicialización completada');
    }, 100);
  }

  // Exponer globalmente
  window.showSummaryCards = showSummaryCards;
  window.populateQuoteSummaryVenta = populateQuoteSummaryVenta;
  window.populateFinancialSummaryVenta = populateFinancialSummaryVenta;
  window.updateAllTotals = updateAllTotals;

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVentaSummary);
  } else {
    initVentaSummary();
  }
})();
