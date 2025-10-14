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

  // Poblar tabla de Resumen de Cotización (adaptado para VENTA)
  function populateQuoteSummaryVenta() {
    console.log('📋 [VENTA] Poblando tabla de resumen...');
    
    const tbody = document.getElementById('cr-summary-rows');
    if (!tbody) {
      console.error('❌ No se encontró #cr-summary-rows');
      return;
    }
    
    tbody.innerHTML = '';
    let subtotal = 0;
    let rowCount = 0;
    
    // Acceder al estado global directamente
    const state = window.state;
    if (!state) {
      console.error('❌ window.state no existe');
      return;
    }
    
    // Obtener porcentaje de descuento actual (al inicio para usar en toda la función)
    const discountSelect = document.getElementById('cr-summary-apply-discount');
    const discountInput = document.getElementById('cr-summary-discount-percent-input');
    const discountPercent = (discountSelect?.value === 'si') ? Number(discountInput?.value || 0) : 0;
    
    console.log('🔍 Estado disponible:', {
      cart: state.cart?.length || 0,
      products: state.products?.length || 0,
      accessories: state.accessories?.length || 0,
      accSelected: state.accSelected?.size || 0,
      discountPercent: discountPercent
    });
    
    // Agregar productos del carrito
    if (state.cart && Array.isArray(state.cart) && state.cart.length > 0) {
      console.log('🛒 Procesando carrito:', state.cart);
      
      state.cart.forEach((ci, index) => {
        const p = state.products?.find(x => x.id === ci.id);
        console.log(`Producto ${index}:`, { ci, p });
        
        if (!p) {
          console.warn(`⚠️ Producto no encontrado: ${ci.id}`);
          return;
        }
        
        const unitPrice = Number(p.price?.diario || p.price?.venta || 0);
        const lineTotal = unitPrice * ci.qty;
        subtotal += lineTotal;
        rowCount++;
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${p.stock || 0}</td>
          <td>-</td>
          <td>${p.sku || p.id}</td>
          <td style="text-align:left;">${p.name}</td>
          <td>${ci.qty}</td>
          <td>${formatCurrency(unitPrice)}</td>
          <td>${discountPercent}%</td>
          <td>${formatCurrency(lineTotal)}</td>
        `;
        tbody.appendChild(row);
        
        console.log(`✅ Fila agregada: ${p.name} - ${formatCurrency(lineTotal)} (Desc: ${discountPercent}%)`);
      });
    } else {
      console.warn('⚠️ Carrito vacío o no existe');
    }
    
    // Agregar accesorios seleccionados
    if (state.accessories && state.accSelected && state.accSelected.size > 0) {
      console.log('🔧 Procesando accesorios:', Array.from(state.accSelected));
      
      // Usar la función accKey del archivo principal
      const accMap = new Map((state.accessories||[]).map(a => [window.accKey ? window.accKey(a) : getAccKey(a), a]));
      
      state.accSelected.forEach(id => {
        const acc = accMap.get(id);
        const qty = Math.max(1, Number(state.accQty?.[id] || 1));
        
        if (!acc) {
          console.warn(`⚠️ Accesorio no encontrado: ${id}`);
          return;
        }
        
        const unitPrice = Number(acc.price || 0);
        const lineTotal = unitPrice * qty;
        subtotal += lineTotal;
        rowCount++;
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${acc.stock || 0}</td>
          <td>-</td>
          <td>${acc.sku || acc.id || '-'}</td>
          <td style="text-align:left;">${acc.name}</td>
          <td>${qty}</td>
          <td>${formatCurrency(unitPrice)}</td>
          <td>${discountPercent}%</td>
          <td>${formatCurrency(lineTotal)}</td>
        `;
        tbody.appendChild(row);
        
        console.log(`✅ Accesorio agregado: ${acc.name} - ${formatCurrency(lineTotal)}`);
      });
    } else {
      console.log('ℹ️ Sin accesorios seleccionados');
    }
    
    console.log(`📊 Resumen: ${rowCount} filas, subtotal: ${formatCurrency(subtotal)}`);
    
    // Calcular totales (usando discountPercent ya definido al inicio)
    const discountAmount = subtotal * (discountPercent / 100);
    const afterDiscount = subtotal - discountAmount;
    const iva = afterDiscount * 0.16;
    const total = afterDiscount + iva;
    
    // Actualizar elementos de totales
    const subtotalEl = document.getElementById('cr-summary-subtotal');
    const discountEl = document.getElementById('cr-summary-discount');
    const ivaEl = document.getElementById('cr-summary-iva');
    const totalEl = document.getElementById('cr-summary-total');
    
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (discountEl) discountEl.textContent = formatCurrency(discountAmount);
    if (ivaEl) ivaEl.textContent = formatCurrency(iva);
    if (totalEl) totalEl.textContent = formatCurrency(total);
    
    console.log('💰 Totales actualizados:', {
      subtotal: formatCurrency(subtotal),
      descuento: formatCurrency(discountAmount),
      iva: formatCurrency(iva),
      total: formatCurrency(total)
    });
  }

  // Poblar Resumen Financiero (adaptado para VENTA - sin días, sin garantía)
  function populateFinancialSummaryVenta() {
    console.log('💹 [VENTA] Poblando resumen financiero...');
    
    const state = window.state;
    if (!state) {
      console.error('❌ window.state no existe para resumen financiero');
      return;
    }
    
    // Calcular subtotal de productos
    let productSubtotal = 0;
    if (state.cart && Array.isArray(state.cart)) {
      state.cart.forEach(ci => {
        const p = state.products?.find(x => x.id === ci.id);
        if (!p) return;
        productSubtotal += (Number(p.price?.diario || p.price?.venta || 0) * ci.qty);
      });
    }
    
    // Calcular subtotal de accesorios
    let accSubtotal = 0;
    if (state.accessories && state.accSelected) {
      const accMap = new Map((state.accessories||[]).map(a => [window.accKey ? window.accKey(a) : getAccKey(a), a]));
      state.accSelected.forEach(id => {
        const acc = accMap.get(id);
        const qty = Math.max(1, Number(state.accQty?.[id] || 1));
        if (!acc) return;
        accSubtotal += (Number(acc.price || 0) * qty);
      });
    }
    
    const subtotal = productSubtotal + accSubtotal;
    
    // Obtener costo de envío
    const shippingCost = Number(document.getElementById('cr-delivery-cost')?.value || 0);
    
    // Obtener descuento (reutilizar valores de la función de resumen)
    const currentDiscountSelect = document.getElementById('cr-summary-apply-discount');
    const currentDiscountInput = document.getElementById('cr-summary-discount-percent-input');
    const currentDiscountPercent = (currentDiscountSelect?.value === 'si') ? Number(currentDiscountInput?.value || 0) : 0;
    const discountAmount = subtotal * (currentDiscountPercent / 100);
    
    // Calcular totales
    const afterDiscount = subtotal - discountAmount;
    const iva = afterDiscount * 0.16;
    const finalTotal = afterDiscount + iva + shippingCost;
    
    // Actualizar elementos del resumen financiero
    const unitPriceEl = document.getElementById('cr-fin-unit-price');
    const subtotalEl = document.getElementById('cr-fin-subtotal');
    const shippingEl = document.getElementById('cr-fin-shipping');
    const discountEl = document.getElementById('cr-fin-discount');
    const ivaEl = document.getElementById('cr-fin-iva');
    const totalEl = document.getElementById('cr-fin-total');
    
    // Para precio unitario, mostrar el promedio si hay múltiples productos
    const totalItems = (state.cart?.reduce((sum, ci) => sum + ci.qty, 0) || 0) + 
                      (state.accSelected ? Array.from(state.accSelected).reduce((sum, id) => sum + Math.max(1, Number(state.accQty?.[id] || 1)), 0) : 0);
    const avgUnitPrice = totalItems > 0 ? subtotal / totalItems : 0;
    
    if (unitPriceEl) unitPriceEl.textContent = formatCurrency(avgUnitPrice);
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (shippingEl) shippingEl.textContent = formatCurrency(shippingCost);
    if (discountEl) discountEl.textContent = formatCurrency(discountAmount);
    if (ivaEl) ivaEl.textContent = formatCurrency(iva);
    if (totalEl) totalEl.textContent = formatCurrency(finalTotal);
    
    console.log('💰 Resumen financiero actualizado:', {
      unitPrice: formatCurrency(avgUnitPrice),
      subtotal: formatCurrency(subtotal),
      shipping: formatCurrency(shippingCost),
      discount: formatCurrency(discountAmount),
      iva: formatCurrency(iva),
      total: formatCurrency(finalTotal)
    });
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
        console.log('🔄 Recalculando por cambio de descuento');
        
        // Habilitar/deshabilitar input de porcentaje según selección
        const discountInput = document.getElementById('cr-summary-discount-percent-input');
        if (discountInput) {
          const isEnabled = discountSelect.value === 'si';
          // Usar readonly en lugar de disabled para mantener la funcionalidad del teclado
          discountInput.readOnly = !isEnabled;
          discountInput.style.opacity = isEnabled ? '1' : '0.6';
          discountInput.style.backgroundColor = isEnabled ? 'white' : '#f3f4f6';
          discountInput.style.cursor = isEnabled ? 'text' : 'not-allowed';
          if (!isEnabled) discountInput.value = '0';
        }
        
        populateQuoteSummaryVenta();
        populateFinancialSummaryVenta();
        // Actualizar grand total
        if (window.updateGrandTotal) window.updateGrandTotal();
      });
      discountSelect.__boundVenta = true;
    }
    
    if (discountInput && !discountInput.__boundVenta) {
      discountInput.addEventListener('input', () => {
        console.log('🔄 Recalculando por cambio de porcentaje');
        populateQuoteSummaryVenta();
        populateFinancialSummaryVenta();
        // Actualizar grand total
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
