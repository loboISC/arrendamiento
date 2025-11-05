    // --- Client picker modal wiring (mirror of Venta) ---
    try {
      const MODAL_ID = 'v-client-modal';
      const CLIENT_KEY = 'cr_selected_client';
      const modal = document.getElementById(MODAL_ID);
      const btnOpen = document.getElementById('v-pick-client');
      const btnCloses = modal?.querySelectorAll('[data-client-close]');
      const label = document.getElementById('v-client-label');
      const hidden = document.getElementById('v-extra');

      const setSelectedClient = (data) => {
        try {
          if (!data) return;
          const name = data.nombre || data.name || data.razon_social || '-';
          if (label) label.textContent = name;
          if (hidden) hidden.value = name; // conservar compatibilidad
          hidden?.dispatchEvent(new Event('input', { bubbles: true }));
          hidden?.dispatchEvent(new Event('change', { bubbles: true }));
        } catch {}
      };

      const openModal = (e) => { e?.preventDefault?.(); if (!modal) return; modal.hidden = false; modal.setAttribute('aria-hidden','false'); };
      const closeModal = () => { if (!modal) return; modal.hidden = true; modal.setAttribute('aria-hidden','true'); };

      const iframe = document.getElementById('v-client-iframe');
      const injectIframeBridge = () => {
        try {
          const doc = iframe?.contentDocument || iframe?.contentWindow?.document;
          if (!doc || doc.__clientBridge) return;
          doc.addEventListener('click', (ev) => {
            // Botones explícitos
            let pick = ev.target.closest('[data-select-client], [data-pick-client], .select-client, button.select, button[data-action="select"]');
            // Soporte a chip/píldora con icono de usuarios como en screenshot
            if (!pick) {
              const withUsersIcon = ev.target.closest('.chip, .pill, .cliente, .client-chip, .list-item, .item, li, tr');
              const hasUsers = withUsersIcon?.querySelector?.('i.fa-users, i.fa-solid.fa-users, [class*="fa-users"]');
              if (hasUsers) pick = withUsersIcon;
            }
            if (!pick) return;
            ev.preventDefault();
            ev.stopPropagation();
            const row = pick.closest('[data-id], tr, .row, li, .card, .item') || pick;
            const id = pick.getAttribute('data-id') || row?.getAttribute?.('data-id') || '';
            let name = pick.getAttribute('data-name')
              || row?.querySelector?.('[data-name]')?.getAttribute('data-name')
              || row?.querySelector?.('.name, .cliente-nombre, [data-cliente-nombre]')?.textContent?.trim()
              || pick.textContent?.trim()
              || '-';
            try { name = name.replace(/\s+/g,' ').trim(); } catch {}
            const payload = { id, nombre: name };
            try { localStorage.setItem(CLIENT_KEY, JSON.stringify(payload)); } catch {}
            setSelectedClient(payload);
            closeModal();
          }, { capture: true });
          doc.__clientBridge = true;
        } catch {}
      };
      btnOpen?.addEventListener('click', (e) => { openModal(e); try { iframe?.addEventListener('load', injectIframeBridge, { once: true }); injectIframeBridge(); } catch {} });
      btnCloses?.forEach(b => b.addEventListener('click', closeModal));
      document.addEventListener('keydown', (ev) => { if (!modal?.hidden && ev.key === 'Escape') closeModal(); });
      modal?.querySelector('.cr-modal__backdrop')?.addEventListener('click', closeModal);

      window.addEventListener('message', (ev) => {
        try {
          const msg = ev.data;
          if (!msg) return;
          let payload = null;
          if (typeof msg === 'object') {
            if (msg.type === 'select-client' && msg.payload) payload = msg.payload;
            else if (msg.type === 'cliente-seleccionado' && msg.data) payload = msg.data;
            else if (!msg.type) payload = msg; // aceptar objeto plano {nombre:..., id:...}
          } else if (typeof msg === 'string') {
            // Si recibimos solo un nombre como string
            payload = { nombre: String(msg) };
          }
          if (!payload) return;
          
          // Verificar si estamos seleccionando cliente para clonación
          const isSelectingForClone = sessionStorage.getItem('selecting-client-for-clone');
          
          if (isSelectingForClone === 'true') {
            // Modo clonación: guardar cliente seleccionado para el clon
            console.log('[CLONACIÓN] Cliente seleccionado para clonar:', payload);
            
            // Guardar en variable global de clonación
            if (window.setCloneClient) {
              window.setCloneClient(payload);
            }
            
            // Limpiar flag
            sessionStorage.removeItem('selecting-client-for-clone');
            
            // Cerrar modal
            closeModal();
          } else {
            // Modo normal: cliente para la cotización actual
            try { localStorage.setItem(CLIENT_KEY, JSON.stringify(payload)); } catch {}
            setSelectedClient(payload);
            closeModal();
          }
        } catch {}
      });

      window.addEventListener('storage', (ev) => { if (ev.key === CLIENT_KEY) { try { setSelectedClient(JSON.parse(ev.newValue)); closeModal(); } catch {} } });
    } catch {}
/* Cotización Renta - lógica de flujo y UI
   Reutiliza patrones de transiciones/responsivo similares a servicios */

(() => {
  // Backend config (alineado con public/js/cotizaciones.js)
  const API_URL = 'http://localhost:3001/api';
  const PRODUCTS_URL = `${API_URL}/productos`;
  // DEV: Forzar uso de datos mock para evitar pantalla vacía si la API falla
  const FORCE_MOCK = false; // usar datos REALES del backend

  function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = 'login.html';
      return null;
    }
    return token;
  }

  // --- Warehouse Management ---
  async function loadWarehouses() {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_URL}/productos/almacenes`, { headers });
      if (!response.ok) {
        console.warn('[loadWarehouses] API failed, using fallback data');
        return [
          { id_almacen: 1, nombre_almacen: 'BODEGA 68 CDMX', ubicacion: 'CDMX' },
          { id_almacen: 2, nombre_almacen: 'TEXCOCO', ubicacion: 'Estado de México' },
          { id_almacen: 3, nombre_almacen: 'MEXICALI', ubicacion: 'Baja California' }
        ];
      }
      const warehouses = await response.json();
      console.log('[loadWarehouses] Loaded warehouses:', warehouses);
      return warehouses;
    } catch (error) {
      console.error('[loadWarehouses] Error loading warehouses:', error);
      // Fallback data
      return [
        { id_almacen: 1, nombre_almacen: 'BODEGA 68 CDMX', ubicacion: 'CDMX' },
        { id_almacen: 2, nombre_almacen: 'TEXCOCO', ubicacion: 'Estado de México' },
        { id_almacen: 3, nombre_almacen: 'MEXICALI', ubicacion: 'Baja California' }
      ];
    }
  }

  // --- Branch Management (same as warehouses for shipping) ---
  async function loadBranches() {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_URL}/productos/almacenes`, { headers });
      if (!response.ok) {
        console.warn('[loadBranches] API failed, using fallback data');
        return [
          { id_almacen: 1, nombre_almacen: 'BODEGA 68 CDMX', ubicacion: 'Calle Ote. 174 290, Moctezuma 2da Secc, Venustiano Carranza, 15530 Ciudad de México, CDMX' },
          { id_almacen: 2, nombre_almacen: 'TEXCOCO', ubicacion: 'Ahuehuetes No int 6, Col ursula galvan santa Irene, Texcoco de Mora, CP. 56263, Estado de México, México' },
          { id_almacen: 3, nombre_almacen: 'MEXICALI', ubicacion: 'Baja California' }
        ];
      }
      const branches = await response.json();
      console.log('[loadBranches] Loaded branches:', branches);
      return branches;
    } catch (error) {
      console.error('[loadBranches] Error loading branches:', error);
      // Fallback data
      return [
        { id_almacen: 1, nombre_almacen: 'BODEGA 68 CDMX', ubicacion: 'Calle Ote. 174 290, Moctezuma 2da Secc, Venustiano Carranza, 15530 Ciudad de México, CDMX' },
        { id_almacen: 2, nombre_almacen: 'TEXCOCO', ubicacion: 'Ahuehuetes No int 6, Col ursula galvan santa Irene, Texcoco de Mora, CP. 56263, Estado de México, México' },
        { id_almacen: 3, nombre_almacen: 'MEXICALI', ubicacion: 'Baja California' }
      ];
    }
  }

  function populateBranchSelect(branches) {
    const branchSelect = document.getElementById('cr-branch-select');
    if (!branchSelect || !branches.length) return;

    // Store branches in state for later use
    state.branches = branches;

    // Clear existing options except the first one (placeholder)
    const placeholder = branchSelect.querySelector('option[value=""]');
    branchSelect.innerHTML = '';
    if (placeholder) {
      branchSelect.appendChild(placeholder);
    } else {
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Selecciona una sucursal';
      defaultOption.selected = true;
      branchSelect.appendChild(defaultOption);
    }

    // Add branch options from database
    branches.forEach(branch => {
      const option = document.createElement('option');
      option.value = branch.id_almacen;
      option.textContent = `${branch.nombre_almacen} — ${branch.ubicacion || 'Dirección no disponible'}`;
      option.setAttribute('data-branch-id', branch.id_almacen);
      option.setAttribute('data-branch-name', branch.nombre_almacen);
      option.setAttribute('data-branch-address', branch.ubicacion || '');
      branchSelect.appendChild(option);
    });

    console.log('[populateBranchSelect] Populated branch dropdown with', branches.length, 'branches');
  }

  function renderWarehouses(warehouses) {
    const popularContainer = document.querySelector('.cr-popular');
    const currentLocationContainer = document.querySelector('.cr-location-current');
    
    if (!popularContainer || !warehouses.length) return;

    // Store warehouses in state
    state.warehouses = warehouses;

    // Clear existing chips
    popularContainer.innerHTML = '';
    
    // Add 'TODOS LOS ALMACENES' chip
    const allChip = document.createElement('button');
    allChip.className = 'cr-chip';
    allChip.setAttribute('data-warehouse-id', 'all');
    allChip.setAttribute('data-warehouse-name', 'TODOS LOS ALMACENES');
    allChip.textContent = 'TODOS LOS ALMACENES';
    allChip.addEventListener('click', () => {
      // Remove active styling from all chips
      popularContainer.querySelectorAll('.cr-chip').forEach(c => {
        c.style.backgroundColor = '';
        c.style.borderColor = '';
        c.style.color = '';
      });
      // Highlight selected
      allChip.style.backgroundColor = '#2563eb';
      allChip.style.borderColor = '#2563eb';
      allChip.style.color = '#ffffff';
      // Update current location display
      if (currentLocationContainer) {
        const badge = currentLocationContainer.querySelector('.cr-location-badge');
        const name = currentLocationContainer.querySelector('.cr-location-name');
        const address = currentLocationContainer.querySelector('.cr-location-address');
        if (badge) badge.textContent = 'Almacén Seleccionado';
        if (name) name.textContent = 'TODOS LOS ALMACENES';
        if (address) address.textContent = 'Ver todos los productos';
      }
      // Clear selected warehouse and show all
      state.selectedWarehouse = null;
      filterProductsByWarehouse('all');
    });
    popularContainer.appendChild(allChip);
    
    // Add warehouse chips
    warehouses.forEach(warehouse => {
      const chip = document.createElement('button');
      chip.className = 'cr-chip';
      chip.setAttribute('data-warehouse-id', warehouse.id_almacen);
      chip.setAttribute('data-warehouse-name', warehouse.nombre_almacen);
      chip.textContent = warehouse.nombre_almacen;
      
      // Add click handler for warehouse selection
      chip.addEventListener('click', () => {
        // Remove active styling from all chips
        popularContainer.querySelectorAll('.cr-chip').forEach(c => {
          c.style.backgroundColor = '';
          c.style.borderColor = '';
          c.style.color = '';
        });
        // Add active styling to clicked chip
        chip.style.backgroundColor = '#2563eb';
        chip.style.borderColor = '#2563eb';
        chip.style.color = '#ffffff';
        
        // Update current location display
        if (currentLocationContainer) {
          const badge = currentLocationContainer.querySelector('.cr-location-badge');
          const name = currentLocationContainer.querySelector('.cr-location-name');
          const address = currentLocationContainer.querySelector('.cr-location-address');
          
          if (badge) badge.textContent = 'Almacén Seleccionado';
          if (name) name.textContent = warehouse.nombre_almacen;
          if (address) address.textContent = warehouse.ubicacion || `ID: ${warehouse.id_almacen}`;
        }
        
        // Store selected warehouse
        state.selectedWarehouse = warehouse;
        
        // Filter products by warehouse
        filterProductsByWarehouse(warehouse.id_almacen);
      });
      
      popularContainer.appendChild(chip);
    });

    // Default to 'TODOS' selected
    try { allChip.click(); } catch {}
    console.log('[renderWarehouses] Warehouses rendered with TODOS as default');
  }

  function updateFoundCount() {
    const count = state.filtered ? state.filtered.length : 0;
    if (els.foundCount) els.foundCount.textContent = String(count);
    if (els.resultsText) els.resultsText.textContent = `Mostrando ${count} producto${count !== 1 ? 's' : ''}`;
  }

  function filterProductsByWarehouse(warehouseId) {
    // Update selected warehouse in state
    if (!warehouseId || warehouseId === 'all') {
      state.selectedWarehouse = null;
    } else {
      // Find the warehouse object by ID
      const warehouse = state.warehouses?.find(w => 
        w.id_almacen === warehouseId || w.id_almacen === parseInt(warehouseId)
      );
      state.selectedWarehouse = warehouse || { id_almacen: warehouseId };
    }
    
    // Use existing filterProducts function to apply all filters including warehouse
    filterProducts();
  }

  // --- Period Modal Controls ---
  function openPeriodModal() {
    const modal = els.periodModal;
    if (!modal) return;
    // Sync proxy days with header days
    try {
      const headerDays = document.getElementById('cr-days');
      const proxyDays = document.getElementById('v-days-proxy');
      if (headerDays && proxyDays) proxyDays.value = headerDays.value || '1';
      // Default fecha de inicio si está vacía
      const dateStart = document.getElementById('cr-date-start');
      if (dateStart && !dateStart.value) {
        const today = new Date();
        const iso = new Date(today.getTime() - today.getTimezoneOffset()*60000).toISOString().slice(0,10);
        dateStart.value = iso;
      }
      // Disparar eventos para que la lógica existente recalcule al abrir
      if (headerDays) {
        headerDays.dispatchEvent(new Event('input', { bubbles: true }));
        headerDays.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Intentar recalcular fin y totales si hay funciones disponibles
      try { recalcEndDate?.(); } catch {}
      try { recalcTotal?.(); } catch {}
    } catch {}
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    // basic focus trap start
    try { modal.querySelector('input,button,select,textarea, [tabindex]')?.focus(); } catch {}
  }

  function closePeriodModal() {
    const modal = els.periodModal;
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  function bindPeriodModalEvents() {
    const modal = els.periodModal;
    if (!modal) return;
    // openers
    els.periodOpenBtn?.addEventListener('click', openPeriodModal);
    els.periodMoreBtn?.addEventListener('click', openPeriodModal);
    // closers
    modal.querySelectorAll('[data-period-close]')?.forEach(btn => btn.addEventListener('click', closePeriodModal));
    // backdrop click closes
    const backdrop = modal.querySelector('.cr-modal__backdrop');
    backdrop?.addEventListener('click', closePeriodModal);
    // ESC to close
    document.addEventListener('keydown', (e) => { if (!modal.hidden && e.key === 'Escape') closePeriodModal(); });
    // Sync proxy -> header
    const headerDays = document.getElementById('cr-days');
    const proxyDays = document.getElementById('v-days-proxy');
    if (headerDays && proxyDays) {
      const updateDaysBadge = () => {
        const badge = document.getElementById('cr-days-badge');
        if (badge) badge.textContent = String(Math.max(1, parseInt(headerDays.value || '1', 10)));
      };
      const syncToHeader = () => {
        const v = Math.max(1, parseInt(proxyDays.value || '1', 10));
        headerDays.value = String(v);
        // Dispatch events so existing logic reacts if listening
        headerDays.dispatchEvent(new Event('input', { bubbles: true }));
        headerDays.dispatchEvent(new Event('change', { bubbles: true }));
        updateDaysBadge();
      };
      proxyDays.addEventListener('input', syncToHeader);
      proxyDays.addEventListener('change', syncToHeader);
    }
  }

  // (bindPeriodModalEvents is initialized later inside init())

  // --- Contact ZIP autocomplete (Estado y Municipio) ---
  async function autofillContactFromPostalCodeMX(cp) {
    if (!cp || !/^\d{5}$/.test(cp)) return;
    try {
      const stateEl = document.getElementById('cr-contact-state');
      const muniEl = document.getElementById('cr-contact-municipio');
      const countryEl = document.getElementById('cr-contact-country');
      let state = '';
      let muni = '';
      let muniOptions = [];

      const copomexKey = window.COPOMEX_API_KEY || window.copomexToken || null;
      if (copomexKey) {
        try {
          const cRes = await fetch(`https://api.copomex.com/query/info_cp/${encodeURIComponent(cp)}?type=simplified&token=${encodeURIComponent(copomexKey)}`);
          if (cRes.ok) {
            const cj = await cRes.json();
            const info = cj?.response || cj?.["response"] || {};
            state = info?.estado || state;
            muni = info?.municipio || info?.municipio_nombre || muni;
            if (muni) muniOptions = [muni];
          }
        } catch {}

  
      }

      // Fallbacks
      if (!state || !muni) {
        try {
          const zRes = await fetch(`https://api.zippopotam.us/mx/${encodeURIComponent(cp)}`);
          if (zRes.ok) {
            const z = await zRes.json();
            const place = Array.isArray(z.places) && z.places[0];
            if (place) {
              muni = muni || place["place name"] || '';
              state = state || place["state"] || '';
            }
          }
        } catch {}
      }

      try {
        const nRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&country=Mexico&postalcode=${encodeURIComponent(cp)}&limit=10`, { headers: { 'Accept': 'application/json' } });
        if (nRes.ok) {
          const data = await nRes.json();
          if (Array.isArray(data)) {
            const munis = new Set(muni ? [muni] : []);
            for (const item of data) {
              const a = item?.address || {};
              if (!state) state = a.state || state;
              const m = a.municipality || a.city || a.town || a.village || '';
              if (m) munis.add(m);
            }
            muniOptions = Array.from(munis);
            if (!muni && muniOptions.length) muni = muniOptions[0];
          }
        }
      } catch {}

      if (stateEl && state) stateEl.value = normalizeMXStateName(state);
      if (muniEl) {
        ensureColonyDatalist(muniEl, muniOptions);
        if (muni) muniEl.value = normalizeMXCityName(muni);
      }
      if (countryEl && !countryEl.value) countryEl.value = 'México';
    } catch {}
  }

  // Free-text geocoding for addresses in Mexico
  async function geocodeFreeTextMX(query) {
    if (!query || query.length < 4) return;
    try {
      setZipStatus('loading', 'Buscando dirección...');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&country=Mexico&q=${encodeURIComponent(query)}&limit=10`, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) { setZipStatus('error', 'No se pudo buscar la dirección'); return; }
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) { setZipStatus('error', 'No se encontró la dirección'); return; }
      const best = data[0];
      const addr = best?.address || {};
      const zipEl = document.getElementById('cr-delivery-zip');
      const cityEl = document.getElementById('cr-delivery-city');
      const stateEl = document.getElementById('cr-delivery-state');
      const colonyEl = document.getElementById('cr-delivery-colony');
      const addressEl = document.getElementById('cr-delivery-address');

      const postcode = addr.postcode || '';
      const city = addr.city || addr.town || addr.village || addr.municipality || '';
      const state = addr.state || '';
      const suburb = addr.suburb || addr.neighbourhood || addr.quarter || '';

      if (zipEl && postcode) zipEl.value = postcode;
      if (cityEl && city) cityEl.value = normalizeMXCityName(city);
      if (stateEl && state) stateEl.value = normalizeMXStateName(state);
      if (colonyEl && suburb) colonyEl.value = suburb;
      if (addressEl && best?.display_name) addressEl.value = best.display_name;

      // Build colony suggestions from results
      const subs = new Set();
      for (const i of data) {
        const a = i?.address || {}; const s = a.suburb || a.neighbourhood || a.quarter || a.hamlet || '';
        if (s) subs.add(s);
      }
      ensureColonyDatalist(colonyEl, Array.from(subs));

      const pieces = [];
      if (postcode) pieces.push(postcode);
      if (city) pieces.push(city);
      if (state) pieces.push(state);
      if (colonies.length) pieces.push(`${colonies.length} colonia(s)`);
      setZipStatus('success', `Detectado: ${pieces.join(', ')}`);
    } catch (e) {
      setZipStatus('error', 'No se pudo geocodificar');
    }
  }
  

  // --- Draggable FAB support ---
  function applyFabSavedPosition() {
    const fab = els.notesFab;
    if (!fab) return;
    try {
      const raw = localStorage.getItem('cr_fab_pos');
      if (!raw) return;
      const pos = JSON.parse(raw);
      if (typeof pos.top === 'number') {
        fab.style.top = pos.top + 'px';
        fab.style.right = '20px';
        fab.style.left = 'auto';
      }
    } catch {}

    // Botón: Exportar PDF (muestra resúmenes y abre diálogo de impresión)
    try {
      const pdfBtn = document.getElementById('cr-export-pdf');
      if (pdfBtn && !pdfBtn.__bound) {
        pdfBtn.addEventListener('click', () => {
          try {
            const quoteCard = document.getElementById('cr-quote-summary-card');
            const finCard = document.getElementById('cr-financial-summary');
            if (quoteCard) { quoteCard.style.display = 'block'; quoteCard.hidden = false; }
            if (finCard) { finCard.style.display = 'block'; finCard.hidden = false; }
            bindQuoteSummaryEvents();
            renderQuoteSummaryTable();
            updateFinancialSummary();
            setTimeout(() => window.print(), 50);
          } catch {}
        });
        pdfBtn.__bound = true;
      }
    } catch {}

    // Botón: Mostrar Garantía (enfocar Resumen Financiero y resaltar Garantía)
    try {
      const depBtn = document.getElementById('cr-show-deposit');
      if (depBtn && !depBtn.__bound) {
        depBtn.addEventListener('click', () => {
          try {
            const finCard = document.getElementById('cr-financial-summary');
            const quoteCard = document.getElementById('cr-quote-summary-card');
            if (quoteCard) { quoteCard.style.display = 'block'; quoteCard.hidden = false; }
            if (finCard) {
              finCard.style.display = 'block'; finCard.hidden = false;
              updateFinancialSummary();
              finCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
              const depositEl = document.getElementById('cr-fin-deposit');
              if (depositEl) {
                depositEl.style.transition = 'background-color 0.6s';
                const prev = depositEl.style.backgroundColor;
                depositEl.style.backgroundColor = '#fef08a';
                setTimeout(() => { depositEl.style.backgroundColor = prev || ''; }, 800);
              }
            }
          } catch {}
        });
        depBtn.__bound = true;
      }
    } catch {}
  }

  function enableFabDrag() {
    const fab = els.notesFab;
    if (!fab || fab.__dragBound) return;
    let dragging = false; let moved = false;
    let startY = 0; let startTop = 0;
    let startX = 0; let startLeft = 0;
    let dragStartTime = 0;
    const DRAG_THRESHOLD = 12; // píxeles mínimos para considerar drag (evita falsos positivos)
    const CLICK_TIME_THRESHOLD = 200; // ms máximos para considerar click (sin drag)
    
    const onMove = (e) => {
      if (!dragging) return;
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      if (clientY == null) return;
      
      const dy = Math.abs(clientY - startY);
      const dx = Math.abs(clientX - startX);
      
      // Si se movió más del umbral, es un drag
      if (dy > DRAG_THRESHOLD || dx > DRAG_THRESHOLD) {
        if (!moved) {
          moved = true;
          fab.__isDragging = true;
          // Cuando detectamos drag real, prevenir el click futuro
          fab.__suppressClick = true;
        }
      }
      
      // Solo mover visualmente si realmente está arrastrando
      if (moved) {
        let newTop = startTop + (clientY - startY);
        const maxTop = window.innerHeight - fab.offsetHeight - 6;
        newTop = Math.max(60, Math.min(maxTop, newTop));
        fab.style.top = newTop + 'px';
        fab.style.right = '20px';
        fab.style.left = 'auto';
        // Evitar el warning de passive listeners: sólo preventDefault si es cancelable (touchmove)
        if (e && e.cancelable) {
          try { e.preventDefault(); } catch {}
        }
      }
    };
    
    const onUp = (e) => { 
      const elapsed = Date.now() - dragStartTime;
      const wasDragging = moved || fab.__isDragging;
      
      // Remover listeners primero
      window.removeEventListener('mousemove', onMove); 
      window.removeEventListener('mouseup', onUp); 
      window.removeEventListener('touchmove', onMove); 
      window.removeEventListener('touchend', onUp); 
      
      dragging = false;
      
      if (wasDragging) {
        // Realmente hubo arrastre - mantener suppressClick para prevenir el click
        fab.__suppressClick = true;
        fab.__isDragging = false;
        
        // Limpiar después de que el click handler se haya ejecutado (o no)
        setTimeout(() => { 
          fab.__suppressClick = false;
        }, 300);
        
        // Guardar posición si se movió
        try {
          const rect = fab.getBoundingClientRect();
          localStorage.setItem('cr_fab_pos', JSON.stringify({
            left: rect.left,
            top: rect.top
          }));
        } catch {}
        
        // Prevenir que el click se propague
        e.preventDefault();
        e.stopPropagation();
      } else {
        // No hubo drag - es un click válido
        // Solo suprimir si fue muy rápido (posible doble registro)
        if (elapsed < 50) {
          // Click muy rápido, esperar un poco para que el click handler lo procese
          setTimeout(() => {
            fab.__suppressClick = false;
          }, 50);
        } else {
          fab.__suppressClick = false;
        }
        fab.__isDragging = false;
        moved = false;
      }
    };
    
    const onDown = (e) => {
      // Reset completo de flags al iniciar
      dragging = true; 
      moved = false;
      fab.__suppressClick = false;
      fab.__isDragging = false;
      
      const rect = fab.getBoundingClientRect();
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      if (clientY == null) return;
      
      startY = clientY; 
      startX = clientX || rect.left; // Fallback si no hay touch
      startTop = rect.top;
      startLeft = rect.left;
      dragStartTime = Date.now();
      
      // Escuchar movimientos pero no prevenir default aún
      window.addEventListener('mousemove', onMove, { passive: true }); 
      window.addEventListener('mouseup', onUp); 
      window.addEventListener('touchmove', onMove, { passive: false }); 
      window.addEventListener('touchend', onUp);
      
      // NO prevenir default aquí - permitir que el click se procese normalmente
    };
    
    fab.addEventListener('mousedown', onDown);
    fab.addEventListener('touchstart', onDown, { passive: false });
    applyFabSavedPosition();
    fab.__dragBound = true;
  }
  function getAuthHeaders() {
    const token = checkAuth();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }
  const state = {
    view: 'grid',
    products: [],
    filtered: [],
    accessories: [],
    accessoriesFiltered: [],
    selected: null,
    cart: [], // [{id, qty}]
    qty: 1,
    days: 1,
    dateStart: null,
    dateEnd: null,
    deliveryNeeded: true,
    deliveryExtra: 0,
    accSelected: new Set(), // accesorios seleccionados por id (data-name)
    accConfirmed: new Set(), // accesorios confirmados visualmente
    notes: [], // {id, ts, step, text}
    warehouses: [], // almacenes disponibles
    selectedWarehouse: null, // almacén seleccionado
    branches: [], // sucursales disponibles (same as warehouses)
    selectedBranch: null, // sucursal seleccionada
    notesOpen: false, // estado del floater de notas
  };

  // ---- Notas: helpers ----
  function currentStepLabel() {
    const productsVisible = !document.getElementById('cr-step-products')?.hidden;
    const configVisible = !document.getElementById('cr-step-config')?.hidden;
    const shippingVisible = !document.getElementById('cr-step-shipping')?.hidden;
    if (productsVisible) return 'Paso 1 - Selección de Productos';
    if (configVisible) return 'Paso 2 - Configuración';
    if (shippingVisible) return 'Paso 3 - Accesorios';
    return 'Paso';
  }

  // Floating notes window open/close
  function openNotesFloater() {
    const floater = els.notesFloater;
    if (!floater) {
      console.warn('[Notes] Cannot open floater: element not found');
      return;
    }
    floater.hidden = false;
    floater.style.display = 'flex';
    floater.setAttribute('aria-hidden', 'false');
    // Mobile-friendly sizing/position
    try {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile) {
        floater.style.right = '8px';
        floater.style.left = 'auto';
        floater.style.top = '80px';
        floater.style.width = `calc(100vw - 16px)`;
        floater.style.maxWidth = 'none';
      }
    } catch {}
    if (els.notesStep) els.notesStep.textContent = currentStepLabel();
    renderNotes();
    // re-clamp after rendering for current viewport
    applyResponsiveTweaks();
    // Foco accesible al abrir
    try { document.getElementById('cr-note-text')?.focus?.(); } catch {}
    state.notesOpen = true;
  }
  function closeNotesFloater() {
    const floater = els.notesFloater;
    if (floater) {
      // Si algún elemento dentro del floater tiene foco, quitarlo antes de ocultar
      try {
        const ae = document.activeElement;
        if (ae && floater.contains(ae)) {
          ae.blur();
        }
      } catch {}
      floater.hidden = true;
      floater.style.display = 'none';
      floater.setAttribute('aria-hidden', 'true');
    }
    state.notesOpen = false;
  }

  // Renderizar lista lateral (ficha de enfocado) con totales por día
  function renderSideList() {
    if (!els.sideList) return;
    els.sideList.innerHTML = '';
    const days = Math.max(1, parseInt(els.days?.value || state.days || 1, 10));
    state.cart.forEach(ci => {
      const p = state.products.find(x => x.id === ci.id);
      if (!p) return;
      const unit = Number(p.price?.diario || 0);
      const card = document.createElement('div');
      card.className = 'cr-side-item';
      card.innerHTML = `
        <div class="cr-side-item__media">
          <img src="${p.image}" alt="${p.name}">
        </div>
        <div class="cr-side-item__body">
          <div class="cr-side-item__title">${p.name}</div>
          <div class="cr-side-item__meta"><span>SKU: ${p.id}</span><span>Marca: ${p.brand||''}</span><span>Stock: ${p.stock} disp.</span></div>
          <div class="cr-side-item__line">
            ${ci.qty} × ${currency(unit)} × ${days} día(s)
            <span class="cr-side-item__line-total">${currency(unit * ci.qty * days)}</span>
          </div>
        </div>
      `;
      els.sideList.appendChild(card);
    });
    if (state.cart.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = '#64748b';
      empty.style.fontSize = '13px';
      empty.textContent = 'No hay productos seleccionados.';
      els.sideList.appendChild(empty);
    }
  }

  // Navegar entre pasos y manejar clases activas
  function gotoStep(step) {
    const secProducts = document.getElementById('cr-products-section');
    const secConfig = document.getElementById('cr-config-section');
    const secShipping = document.getElementById('cr-shipping-section');

    // Reset classes/visibility
    [secProducts, secConfig, secShipping].forEach(sec => {
      if (!sec) return;
      sec.classList.remove('cr-section--active');
      sec.hidden = true;
    });

    if (step === 'config') {
      document.body.classList.add('cr-mode-config');
      document.body.classList.remove('cr-mode-shipping');
      if (secConfig) {
        secConfig.hidden = false;
        requestAnimationFrame(() => secConfig.classList.add('cr-section--active'));
      }
      els.stepProducts?.classList.remove('cr-step--active');
      els.stepProducts?.classList.add('cr-step--done');
      els.stepConfig?.classList.add('cr-step--active');
      els.stepShipping?.classList.remove('cr-step--active');
      // Refrescar visual del resumen por si el usuario ya tenía datos
      try { bindQuoteSummaryEvents(); renderQuoteSummaryTable(); } catch {}
    } else if (step === 'shipping') {
      document.body.classList.remove('cr-mode-config');
      document.body.classList.add('cr-mode-shipping');
      if (secShipping) {
        secShipping.hidden = false;
        requestAnimationFrame(() => secShipping.classList.add('cr-section--active'));
      }
      els.stepProducts?.classList.remove('cr-step--active');
      els.stepProducts?.classList.add('cr-step--done');
      els.stepConfig?.classList.remove('cr-step--active');
      els.stepConfig?.classList.add('cr-step--done');
      els.stepShipping?.classList.add('cr-step--active');
      // Ensure viewport starts at shipping section top
      setTimeout(() => secShipping?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 20);
      // Enlazar y renderizar el resumen al entrar al Paso 4
      try { bindQuoteSummaryEvents(); renderQuoteSummaryTable(); } catch {}
    } else {
      document.body.classList.remove('cr-mode-config');
      document.body.classList.remove('cr-mode-shipping');
      // Productos
      if (secProducts) {
        secProducts.hidden = false;
        requestAnimationFrame(() => secProducts.classList.add('cr-section--active'));
      }
      els.stepProducts?.classList.add('cr-step--active');
      els.stepConfig?.classList.remove('cr-step--active');
      els.stepShipping?.classList.remove('cr-step--active');
    }
  }

  function closeNotesModal() {
    if (els.notesModal) els.notesModal.hidden = true;
  }

  function closeAllNotes() {
    closeNotesFloater();
    closeNotesModal();
  }

  // --- Autocomplete by Postal Code (MX) using Nominatim ---
  function debounce(fn, wait) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), wait); };
  }

  async function autofillFromPostalCodeMX(cp) {
    if (!cp || !/^\d{5}$/.test(cp)) return;
    setZipStatus('loading', 'Buscando CP...');
    const zipEl = document.getElementById('cr-delivery-zip');
    const cityEl = document.getElementById('cr-delivery-city');
    const stateEl = document.getElementById('cr-delivery-state');
    const colonyEl = document.getElementById('cr-delivery-colony');

    let city = '';
    let state = '';
    let colonies = [];

    try {
      // 0) Prefer Copomex (SEPOMEX) if API key provided for highest precision
      const copomexKey = window.COPOMEX_API_KEY || window.copomexToken || null;
      if (copomexKey) {
        try {
          const cRes = await fetch(`https://api.copomex.com/query/info_cp/${encodeURIComponent(cp)}?type=simplified&token=${encodeURIComponent(copomexKey)}`);
          if (cRes.ok) {
            const cj = await cRes.json();
            const info = cj?.response || cj?.["response"] || {};
            const asents = Array.isArray(info?.asentamiento) ? info.asentamiento : (Array.isArray(info?.asentamientos) ? info.asentamientos : []);
            const muni = info?.municipio || info?.municipio_nombre || '';
            const edo = info?.estado || '';
            if (edo) state = edo;
            if (muni) city = muni; // municipio para ciudad en logística
            if (Array.isArray(asents)) colonies = [...new Set(asents.filter(Boolean))];
          }
        } catch (e) {
          // ignore and fallback
        }
      }

      // 1) Zippopotam: MX CP -> city/state (preciso)
      const zRes = await fetch(`https://api.zippopotam.us/mx/${encodeURIComponent(cp)}`);
      if (zRes.ok) {
        const z = await zRes.json();
        const place = Array.isArray(z.places) && z.places[0];
        if (place) {
          city = city || place["place name"] || place["state abbreviation"] || '';
          state = state || place["state"] || '';
        }
      }

      // 2) Nominatim: obtener posibles colonias/suburbs
      const nRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&country=Mexico&postalcode=${encodeURIComponent(cp)}&limit=10`, { headers: { 'Accept': 'application/json' } });
      if (nRes.ok) {
        const data = await nRes.json();
        if (Array.isArray(data)) {
          const subs = new Set();
          for (const item of data) {
            const a = item?.address || {}; const s = a.suburb || a.neighbourhood || a.quarter || a.hamlet || '';
            if (s) subs.add(s);
          }
          colonies = Array.from(subs);
        }
      }

      // Rellenar UI
      // Always reflect the searched CP in the delivery ZIP field to keep UI consistent
      if (zipEl) zipEl.value = cp;
      if (cityEl && city) cityEl.value = normalizeMXCityName(city);
      if (stateEl && state) stateEl.value = normalizeMXStateName(state);
      if (colonyEl) {
        ensureColonyDatalist(colonyEl, colonies);
        if (!colonyEl.value && colonies.length) colonyEl.value = colonies[0];
      }

      const pieces = [];
      if (city) pieces.push(city);
      if (state) pieces.push(state);
      if (colonies.length) pieces.push(`${colonies.length} colonia(s)`);
      if (pieces.length) setZipStatus('success', `Detectado: ${pieces.join(', ')}`);
      else setZipStatus('error', 'No se encontró información para este CP');
    } catch (e) {
      console.warn('[autofillFromPostalCodeMX] error', e);
      setZipStatus('error', 'No se encontró el CP');
    }
  }

  function ensureColonyDatalist(inputEl, options) {
    if (!inputEl) return;
    let listId = inputEl.getAttribute('list');
    if (!listId) {
      listId = 'cr-colony-list';
      inputEl.setAttribute('list', listId);
    }
    let dl = document.getElementById(listId);
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = listId;
      inputEl.parentElement?.appendChild(dl);
    }
    if (Array.isArray(options)) {
      dl.innerHTML = options.map(v => `<option value="${v.replace(/"/g,'&quot;')}"></option>`).join('');
    }
  }

  // --- Helpers accesorios ---
  function getAccessoryId(card) {
    if (!card) return '';
    const id = card.getAttribute('data-name');
    if (id) return id;
    const nameEl = card.querySelector('.cr-product__name, .cr-name, h3');
    return (nameEl?.textContent || '').trim();
  }

  // Cargar accesorios desde la misma API de productos, filtrando por categoría/tipo
  async function loadAccessoriesFromAPI() {
    try {
      const headers = getAuthHeaders();
      const resp = await fetch(PRODUCTS_URL, { headers });
      if (!resp.ok) return [];
      const data = await resp.json();
      if (!Array.isArray(data)) return [];
      // Regla backend: usar flags y nombres reales que expone listarProductos()
      // Incluir solo renta=true y categoria/subcategoria que contenga 'accesor'
      const acc = data.filter(it => {
        const renta = Boolean(it.renta || (Number(it.tarifa_renta||0) > 0));
        const cat = String(it.categoria || it.nombre_categoria || '').toLowerCase();
        const sub = String(it.nombre_subcategoria || '').toLowerCase();
        const isAccessory = cat.includes('accesor') || sub.includes('accesor');
        return renta && isAccessory;
      }).map(it => {
        const id = String(it.id || it.id_producto || '');
        const name = it.nombre || it.nombre_del_producto || it.name || 'Accesorio';
        const image = it.imagen_portada || it.imagen || it.image || 'img/default.jpg';
        const stock = Number(it.stock_total || it.stock || 0);
        const subcat = (it.nombre_subcategoria || '').toString().toLowerCase() || 'otros';
        const price = Number(it.tarifa_renta || it.precio || 0);
        const sku = String(it.clave || it.codigo_de_barras || it.id || it.id_producto || '');
        const brand = it.marca || '';
        const desc = it.descripcion || '';
        const quality = it.condicion || it.estado || '';
        return { id, name, image, stock, subcat, price, sku, brand, desc, quality };
      });
      return acc;
    } catch {
      return [];
    }
  }

  // Renderizar tarjetas de accesorios dentro de #cr-accessories manteniendo el diseño
  function renderAccessories(list) {
    const grid = document.getElementById('cr-accessories');
    if (!grid) return;
    grid.innerHTML = '';
    list.forEach(a => {
      const card = document.createElement('div');
      card.className = 'cr-card cr-acc-item';
      card.setAttribute('data-name', a.name);
      card.setAttribute('data-subcat', a.subcat || 'otros');
      card.setAttribute('data-stock', String(a.stock || 0));
      card.setAttribute('data-price', String(a.price || 0));
      card.setAttribute('data-sku', String(a.sku || ''));
      if (a.id) card.setAttribute('data-id', String(a.id));
      // Forzar layout consistente: tarjeta como grid y alturas mínimas
      card.style.display = 'grid';
      card.style.gridTemplateRows = 'auto 1fr';
      card.innerHTML = `
        <div class="cr-product__media">
          <img src="${a.image}" alt="${a.name}" onerror="this.src='img/default.jpg'" style="height:140px;width:100%;object-fit:contain;" />
          <span class="cr-badge">${a.quality || 'Accesorio'}</span>
          <span class="cr-stock">${a.stock || 0} disponibles</span>
        </div>
        <div class="cr-product__body">
          <div class="cr-name" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px;">${a.name}</div>
          <div class="cr-desc" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:36px;">${a.desc || (a.subcat||'').toString().toUpperCase()}</div>
          <div class="cr-meta">
            <span>SKU: ${a.sku || '-'}</span>
            <span>Marca: ${a.brand || ''}</span>
          </div>
          <div class="cr-product__actions" style="display:flex;justify-content:space-between;align-items:center;min-height:44px;">
            <button class="cr-btn cr-acc-btn" type="button"><i class="fa-solid fa-cart-plus"></i> Agregar</button>
            <div class="cr-pricebar"><span class="cr-from">Desde</span> <span class="cr-price">${currency(a.price || 0)}/día</span></div>
          </div>
        </div>`;
      grid.appendChild(card);
    });
    // Reaplicar filtros y botones
    applyAccessoryFilters();
    setupAccessoriesCarousel();

    // Delegación de clic para botón Agregar/Quitar sin cambiar el tamaño de la tarjeta
    if (!grid.__boundAccClicks) {
      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.cr-acc-btn');
        if (!btn) return;
        const card = btn.closest('.cr-acc-item');
        if (!card) return;
        toggleAccessory(card);
      });
      grid.__boundAccClicks = true;
    }
  }

  // Carrusel para accesorios (similar a productos): 4 ítems visibles
  function setupAccessoriesCarousel() {
    const list = document.getElementById('cr-accessories');
    if (!list) return;
    list.classList.add('cr-carousel');
    // Asegurar wrapper como en productos
    let wrap = list.parentElement;
    if (!wrap || !wrap.classList.contains('cr-carousel-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'cr-carousel-wrap';
      list.parentNode.insertBefore(wrap, list);
      wrap.appendChild(list);
    }
    // Crear controles si no existen y dentro del wrapper
    let prev = document.getElementById('cr-acc-prev');
    let next = document.getElementById('cr-acc-next');
    if (!prev) {
      prev = document.createElement('button');
      prev.id = 'cr-acc-prev';
      prev.className = 'cr-car-btn prev';
      prev.type = 'button';
      prev.setAttribute('aria-label','Anterior');
      prev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
      wrap.insertBefore(prev, list);
    }
    if (!next) {
      next = document.createElement('button');
      next.id = 'cr-acc-next';
      next.className = 'cr-car-btn next';
      next.type = 'button';
      next.setAttribute('aria-label','Siguiente');
      wrap.appendChild(next);
    }
    const step = () => Math.max(200, (list.clientWidth || 0) * 0.9);
    const onPrev = () => list.scrollBy({ left: -step(), behavior: 'smooth' });
    const onNext = () => list.scrollBy({ left: step(), behavior: 'smooth' });
    if (!prev.__bound) { prev.addEventListener('click', onPrev); prev.__bound = true; }
    if (!next.__bound) { next.addEventListener('click', onNext); next.__bound = true; }
    if (!list.__boundScrollAcc) {
      list.addEventListener('scroll', () => { try { updateAccessoriesCarouselButtons(); } catch {} });
      list.__boundScrollAcc = true;
    }
    window.addEventListener('resize', () => { try { updateAccessoriesCarouselButtons(); } catch {} });
    updateAccessoriesCarouselButtons();
  }

  function updateAccessoriesCarouselButtons() {
    const prev = document.getElementById('cr-acc-prev');
    const next = document.getElementById('cr-acc-next');
    const list = document.getElementById('cr-accessories');
    if (!prev || !next || !list) return;
    const maxScroll = list.scrollWidth - list.clientWidth - 2;
    const isCarousel = list.classList.contains('cr-carousel');
    prev.style.display = isCarousel ? 'grid' : 'none';
    next.style.display = isCarousel ? 'grid' : 'none';
    if (!isCarousel) return;
    prev.disabled = list.scrollLeft <= 2;
    next.disabled = list.scrollLeft >= maxScroll;
  }

  // --- Normalización de nombres MX (DF -> CDMX) ---
  function normalizeMXStateName(name) {
    if (!name) return name;
    const n = String(name).toLowerCase();
    if (n.includes('distrito federal') || n.includes('mexico city') || n.includes('ciudad de méxico') || n.includes('ciudad de mexico')) {
      return 'CDMX';
    }
    return name;
  }
  function normalizeMXCityName(name) {
    if (!name) return name;
    const n = String(name).toLowerCase();
    if (n.includes('distrito federal') || n.includes('mexico city') || n.includes('ciudad de méxico') || n.includes('ciudad de mexico')) {
      return 'Ciudad de México';
    }
    return name;
  }

  // Create/update a small status line below the ZIP input
  function setZipStatus(type, text) {
    try {
      const zipEl = document.getElementById('cr-delivery-zip');
      if (!zipEl) return;
      let status = document.getElementById('cr-zip-status');
      if (!status) {
        status = document.createElement('div');
        status.id = 'cr-zip-status';
        status.className = 'cr-status';
        // insert after ZIP input
        const parent = zipEl.closest('.cr-row') || zipEl.parentElement;
        parent?.appendChild(status);
      }
      status.textContent = text || '';
      status.classList.remove('is-loading', 'is-error', 'is-success');
      if (type === 'loading') {
        status.classList.add('is-loading');
        status.innerHTML = `<span class="cr-spinner" aria-hidden="true"></span> ${text || ''}`;
      } else if (type === 'error') {
        status.classList.add('is-error');
      } else if (type === 'success') {
        status.classList.add('is-success');
      }
    } catch {}
  }

  // Ensure floating UI stays within viewport on resize (mobile safety)
  function applyResponsiveTweaks() {
    // Clamp FAB vertically and keep on right edge
    if (els.notesFab) {
      const rect = els.notesFab.getBoundingClientRect();
      const maxTop = Math.max(60, window.innerHeight - els.notesFab.offsetHeight - 6);
      let newTop = rect.top;
      if (newTop < 60) newTop = 60;
      if (newTop > maxTop) newTop = maxTop;
      els.notesFab.style.top = newTop + 'px';
      els.notesFab.style.right = '20px';
      els.notesFab.style.left = 'auto';
    }
    // Clamp Floater and resize on small screens
    if (els.notesFloater && !els.notesFloater.hidden) {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile) {
        els.notesFloater.style.right = '8px';
        els.notesFloater.style.left = 'auto';
        // keep inside viewport vertically
        const rect = els.notesFloater.getBoundingClientRect();
        let top = rect.top;
        const minTop = 70;
        const maxTop = Math.max(minTop, window.innerHeight - Math.min(rect.height, window.innerHeight * 0.8));
        if (top < minTop) top = minTop;
        if (top > maxTop) top = maxTop;
        els.notesFloater.style.top = top + 'px';
        els.notesFloater.style.width = `calc(100vw - 16px)`;
        els.notesFloater.style.maxWidth = 'none';
      }
    }
  }

  function renderNotes() {
    if (!els.notesList) return;
    els.notesList.innerHTML = '';
    const fmt = new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    state.notes.slice().reverse().forEach(note => {
      const row = document.createElement('div');
      row.className = 'cr-card';
      row.style.padding = '10px 12px';
      row.style.display = 'grid';
      row.style.gap = '6px';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <small style="color:#64748b;">${fmt.format(new Date(note.ts))}</small>
          <span class="cr-location-badge">${note.step}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="white-space:pre-wrap;">${note.text}</div>
          <div style="display:flex;gap:8px;">
            <button class="cr-acc-remove" title="Eliminar" aria-label="Eliminar"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      `;
      const delBtn = row.querySelector('button');
      delBtn?.addEventListener('click', () => {
        state.notes = state.notes.filter(n => n.id !== note.id);
        persistNotes();
        renderNotes();
        updateNotesCounters();
      });
      els.notesList.appendChild(row);
    });
  }

  function updateNotesCounters() {
    const n = state.notes.length;
    if (els.notesCount) { els.notesCount.textContent = String(n); els.notesCount.hidden = n === 0; }
    if (els.notesChip) els.notesChip.textContent = `${n} nota${n===1?'':'s'}`;
  }

  function addNote(text) {
    const t = text.trim();
    if (!t) return;
    state.notes.push({ id: 'n_'+Date.now(), ts: Date.now(), step: currentStepLabel(), text: t });
    persistNotes();
    els.noteText.value = '';
    renderNotes();
    updateNotesCounters();
  }

  function persistNotes() {
    try { localStorage.setItem('cr_notes', JSON.stringify(state.notes)); } catch {}
  }
  function loadNotes() {
    try { const raw = localStorage.getItem('cr_notes'); if (raw) state.notes = JSON.parse(raw) || []; } catch { state.notes = []; }
  }

  // Drag handlers for floating window
  function enableNotesDrag() {
    if (!els.notesFloater || !els.notesFloaterHead) return;
    let dragging = false; let startX = 0; let startY = 0; let startLeft = 0; let startTop = 0;
    const floater = els.notesFloater;
    const onMove = (e) => {
      if (!dragging) return;
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      if (clientX == null || clientY == null) return;
      let newLeft = startLeft + (clientX - startX);
      let newTop = startTop + (clientY - startY);
      const maxLeft = window.innerWidth - floater.offsetWidth - 12;
      const maxTop = window.innerHeight - floater.offsetHeight - 12;
      newLeft = Math.max(12, Math.min(maxLeft, newLeft));
      newTop = Math.max(72, Math.min(maxTop, newTop));
      floater.style.left = newLeft + 'px';
      floater.style.right = 'auto';
      floater.style.top = newTop + 'px';
    };
    const onUp = () => { dragging = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp); };
    const onDown = (e) => {
      // No iniciar drag si el click fue en el botón de cerrar o en controles de formulario
      const t = e.target;
      const tag = (t.tagName || '').toLowerCase();
      if (t.closest('[data-close-notes]') || tag === 'input' || tag === 'textarea' || tag === 'select') {
        return; // permitir interacción normal
      }
      dragging = true;
      const rect = floater.getBoundingClientRect();
      const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
      startX = clientX; startY = clientY; startLeft = rect.left; startTop = rect.top;
      window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); window.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onUp);
      e.preventDefault();
    };
    els.notesFloaterHead.addEventListener('mousedown', onDown);
    els.notesFloaterHead.addEventListener('touchstart', onDown, { passive: false });
    // Hint visual de arrastre
    try { els.notesFloaterHead.style.cursor = 'grab'; } catch {}
  }

  const els = {
    gridBtn: document.getElementById('cr-grid-btn'),
    listBtn: document.getElementById('cr-list-btn'),
    productsWrap: document.getElementById('cr-products'),
    foundCount: document.getElementById('cr-found-count'),
    resultsText: document.getElementById('cr-results-text'),
    search: document.getElementById('cr-search-input'),
    filters: document.getElementById('cr-filters'),
    toggleFilters: document.getElementById('cr-toggle-filters'),
    // cart (step 2)
    cartList: document.getElementById('cr-cart-list'),
    cartCount: document.getElementById('cr-cart-count'),
    goConfig: document.getElementById('cr-go-config'),
    cartSubtotalWrap: document.getElementById('cr-cart-subtotal'),
    cartSubtotalValue: document.getElementById('cr-cart-subtotal-value'),
    clearCart: document.getElementById('cr-clear-cart'),
    cartCountWrap: document.getElementById('cr-cart-count-wrap'),

    // sections
    secProducts: document.getElementById('cr-products-section'),
    secConfig: document.getElementById('cr-config-section'),

    // config side
    selImage: document.getElementById('cr-selected-image'),
    selName: document.getElementById('cr-selected-name'),
    selDesc: document.getElementById('cr-selected-desc'),
    selSku: document.getElementById('cr-selected-sku'),
    selBrand: document.getElementById('cr-selected-brand'),
    selStock: document.getElementById('cr-selected-stock'),
    priceDaily: document.getElementById('cr-price-daily'),
    total: document.getElementById('cr-total'),
    totalDetail: document.getElementById('cr-total-detail'),

    // config main
    days: document.getElementById('cr-days'),
    dateStart: document.getElementById('cr-date-start'),
    dateEnd: document.getElementById('cr-date-end'),
    durationText: document.getElementById('cr-duration-text'),
    dailyRate: document.getElementById('cr-daily-rate'),
    needDelivery: document.getElementById('cr-need-delivery'),
    deliveryAddress: document.getElementById('cr-delivery-address'),
    deliveryNotes: document.getElementById('cr-delivery-notes'),
    deliveryExtra: document.getElementById('cr-delivery-extra'),
    summaryList: document.getElementById('cr-summary-list'),
    sideList: document.getElementById('cr-focused-list') || document.getElementById('cr-side-list'),

    addToQuote: document.getElementById('cr-add-to-quote'),
    backToProducts: document.getElementById('cr-back-to-products'),

    // steps
    stepProducts: document.getElementById('cr-step-products'),
    stepConfig: document.getElementById('cr-step-config'),
    stepShipping: document.getElementById('cr-step-shipping'),
    // accessories
    accSearch: document.getElementById('cr-accessory-search'),
    accSubcat: document.getElementById('cr-acc-subcat'),
    accGrid: document.getElementById('cr-accessories'),
    accCount: document.getElementById('cr-accessory-count'),
    accSort: document.getElementById('cr-acc-sort'),
    // notes
    notesFab: document.getElementById('cr-notes-fab'),
    notesModal: document.getElementById('cr-notes-modal'),
    notesBackdrop: document.querySelector('[data-close-notes]'),
    notesCloseBtns: document.querySelectorAll('[data-close-notes]'),
    notesCount: document.getElementById('cr-notes-count'),
    notesChip: document.getElementById('cr-notes-chip'),
    notesList: document.getElementById('cr-notes-list'),
    noteText: document.getElementById('cr-note-text'),
    noteSave: document.getElementById('cr-note-save'),
    notesStep: document.getElementById('cr-notes-step'),
    // floating window
    notesFloater: document.getElementById('cr-notes-floater'),
    notesFloaterHead: document.getElementById('cr-notes-floater-head'),
    // period modal
    periodModal: document.getElementById('v-period-modal'),
    periodOpenBtn: document.getElementById('v-period-modal-btn'),
    periodMoreBtn: document.getElementById('v-period-more'),
  };

  // Filtro por búsqueda y categoría (Renta/Venta)
  function filterProducts() {
    try {
      const mainQ = (els.search?.value || '').trim().toLowerCase();
      const headerQ = (document.getElementById('v-search-code')?.value || '').trim().toLowerCase();
      const q = headerQ || mainQ;
      // En renta usamos radios de categoría name="cr-category"
      let cat = '';
      try { cat = document.querySelector('input[name="cr-category"]:checked')?.value || ''; } catch {}
      
      // Get selected warehouse ID
      const selectedWarehouseId = state.selectedWarehouse?.id_almacen;
      
      state.filtered = (state.products || []).filter(p => (
        (!q || p.name.toLowerCase().includes(q)
          || String(p.id).toLowerCase().includes(q)
          || String(p.sku || '').toLowerCase().includes(q)
          || (p.brand || '').toLowerCase().includes(q))
        && (!cat || p.category === cat)
        && (!selectedWarehouseId || p.id_almacen === selectedWarehouseId || p.id_almacen === parseInt(selectedWarehouseId))
      ));
      
      renderProducts(state.filtered);
      updateFoundCount();
    } catch (e) {
      console.error('[filterProducts] error:', e);
    }
  }

  // Compatibilidad si hay atributos inline viejos
  window.filterProducts = filterProducts;

  // Renderizar productos (grid por defecto). En la página de Venta (#v-quote-header),
  // cuando state.view === 'list' mostramos una tabla para facilitar captura masiva.
  function renderProducts(list) {
    if (!els.productsWrap) return;
    
    if (!list || !Array.isArray(list)) {
      list = state.filtered || state.products || [];
    }
    
    const isVenta = !!document.getElementById('v-quote-header');
    els.productsWrap.innerHTML = '';

    if (state.view === 'list' && isVenta) {
      const tableWrap = document.createElement('div');
      tableWrap.className = 'cr-table-wrap';
      tableWrap.innerHTML = `
        <table class="cr-table cr-table--products" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="width:70px;">Cant</th>
              <th style="text-align:left;">Descripción</th>
              <th>Exist.</th>
              <th>Precio U.</th>
              <th>Total</th>
              <th>Imagen</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      `;
      
      const tbody = tableWrap.querySelector('tbody');
      
      list.forEach(p => {
        const unit = Number(p.price?.diario || 0);
        const tr = document.createElement('tr');
        const isZero = unit <= 0;
        tr.innerHTML = `
          <td><input type="number" min="1" value="1" class="cr-qty-input" style="width:70px;"></td>
          <td style="text-align:left;">
            <div style="font-weight:700;">${p.sku || p.id}</div>
            <div style="color:#475569;">${p.name}</div>
            <small style="color:#94a3b8;">${p.desc || ''}</small>
            ${isZero ? `<div style="margin-top:6px;"><span style="display:inline-block;background:#f97316;color:#fff;border:1px solid #ea580c;padding:2px 8px;border-radius:999px;font-size:12px;">No se puede rentar</span></div>` : ''}
          </td>
          <td>${(p.stock ?? 0)}<br><small>PZA</small></td>
          <td>${currency(unit)}</td>
          <td class="cr-line-total">${currency(unit)}</td>
          <td style="text-align:center;"><img src="${p.image}" alt="${p.name}" style="width:28px; height:28px; object-fit:cover; border-radius:6px;" onerror="this.src='img/default.jpg'"/></td>
          <td><button class="cr-btn cr-btn--sm" type="button" ${isZero ? 'disabled title="No disponible para renta"' : ''} data-action="add" data-id="${p.id}"><i class="fa-solid fa-cart-plus"></i> ${isZero ? 'No disponible' : 'Agregar'}</button></td>
        `;
        
        const qtyInput = tr.querySelector('.cr-qty-input');
        const lineTotal = tr.querySelector('.cr-line-total');
        qtyInput.addEventListener('input', () => {
          const q = Math.max(1, parseInt(qtyInput.value || '1', 10));
          lineTotal.textContent = currency(unit * q);
        });
        tbody.appendChild(tr);
      });

      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action="add"][data-id]');
        if (!btn) return;
        if (btn.disabled) return; // no funcional si precio es 0
        const tr = btn.closest('tr');
        const qtyInput = tr.querySelector('.cr-qty-input');
        const id = btn.getAttribute('data-id');
        const qty = Math.max(1, parseInt(qtyInput.value || '1', 10));
        for (let i = 0; i < qty; i++) addToCart(id);
      });

      // Agregar la tabla al contenedor
      els.productsWrap.appendChild(tableWrap);

      if (els.foundCount) els.foundCount.textContent = String(list.length);
      if (els.resultsText) els.resultsText.textContent = `Mostrando ${list.length} producto${list.length !== 1 ? 's' : ''}`;
      els.productsWrap.classList.remove('cr-grid', 'cr-list', 'cr-carousel');
      els.productsWrap.style.display = 'block';
      const wrapList = document.querySelector('.cr-carousel-wrap');
      if (wrapList) wrapList.classList.remove('is-carousel');
      // Forzar ocultamiento de flechas en Lista
      try {
        const prev = document.getElementById('cr-car-prev');
        const next = document.getElementById('cr-car-next');
        if (prev) { prev.style.display = 'none'; prev.hidden = true; prev.disabled = true; }
        if (next) { next.style.display = 'none'; next.hidden = true; next.disabled = true; }
      } catch {}
      try { updateCarouselButtons(); } catch {}
      window.addEventListener('scroll', updateCarouselButtons);
      window.addEventListener('resize', updateCarouselButtons);
      return;
    }

    // Vista tarjetas (grid/lista simple)
    list.forEach(p => {
      const card = document.createElement('article');
      card.className = 'cr-product';
      const unit = Number(p.price?.diario || 0);
      const isZero = unit <= 0;
      card.innerHTML = `
        <div class="cr-product__media">
          <img src="${p.image}" alt="${p.name}">
          <span class="cr-badge">${p.quality || ''}</span>
          ${isZero ? `<span class="cr-badge" style="background:#f97316;color:#fff;border-color:#ea580c;">No se puede rentar</span>` : ''}
          <span class="cr-stock">${p.stock} disponibles</span>
        </div>
        <div class="cr-product__body">
          <div class="cr-name">${p.name}</div>
          <div class="cr-desc">${p.desc || ''}</div>
          <div class="cr-meta">
            <span>SKU: ${p.sku || p.id}</span>
            <span>Marca: ${p.brand||''}</span>
          </div>
          <div class="cr-product__actions">
            <button class="cr-btn" type="button" data-id="${p.id}" ${isZero ? 'disabled title="No disponible para renta"' : ''}><i class="fa-solid fa-cart-plus"></i> ${isZero ? 'No disponible' : 'Agregar'}</button>
            <div class="cr-pricebar"><span class="cr-from">Desde</span> <span class="cr-price">${currency(unit)}/día</span></div>
          </div>
        </div>`;
      els.productsWrap.appendChild(card);
    });

    if (els.foundCount) els.foundCount.textContent = String(list.length);
    if (els.resultsText) els.resultsText.textContent = `Mostrando ${list.length} producto${list.length !== 1 ? 's' : ''}`;
    els.productsWrap.querySelectorAll('[data-id]').forEach(btn => {
      if (btn.disabled) return; // Evitar agregar si no es rentable
      btn.addEventListener('click', () => addToCart(btn.getAttribute('data-id')));
    });
    // Layout classes: en Venta (grid) usamos carrusel horizontal; en otros casos, grid/lista estándar
    els.productsWrap.classList.remove('cr-grid', 'cr-list', 'cr-carousel');
    const wrap = document.querySelector('.cr-carousel-wrap');
    if (state.view === 'grid' && isVenta) {
      els.productsWrap.classList.add('cr-carousel');
      els.productsWrap.style.display = ''; // usar estilos del carrusel (grid-auto-flow)
      if (wrap) wrap.classList.add('is-carousel');
    } else {
      els.productsWrap.classList.add(state.view === 'grid' ? 'cr-grid' : 'cr-list');
      // En lista forzamos block para que la tabla crezca a 100%
      els.productsWrap.style.display = (state.view === 'list') ? 'block' : '';
      if (wrap) wrap.classList.remove('is-carousel');
    }
    // Actualizar estado de flechas del carrusel (se deshabilitan en Lista)
    try { updateCarouselButtons(); } catch {}
  }

  // Actualiza el estado de los botones del carrusel según el modo y la posición de scroll
  function updateCarouselButtons() {
    const prevBtn = document.getElementById('cr-car-prev');
    const nextBtn = document.getElementById('cr-car-next');
    const list = els.productsWrap;
    if (!prevBtn || !nextBtn || !list) return;
    const isCarousel = list.classList.contains('cr-carousel');
    // Deshabilitar ambos si no estamos en carrusel
    prevBtn.disabled = !isCarousel;
    nextBtn.disabled = !isCarousel;
    // Mostrar/Ocultar por modo (fallback para navegadores sin :has)
    prevBtn.style.display = isCarousel ? 'grid' : 'none';
    nextBtn.style.display = isCarousel ? 'grid' : 'none';
    if (!isCarousel) return;
    // Habilitar/Deshabilitar por extremos
    const maxScroll = list.scrollWidth - list.clientWidth - 2; // tolerancia
    prevBtn.disabled = list.scrollLeft <= 2;
    nextBtn.disabled = list.scrollLeft >= maxScroll;
  }

  // UI: Renderizar la tabla de "Resumen de Cotización" (Paso 4) sin modificar la lógica existente
  function renderQuoteSummaryTable() {
    const tbody = document.getElementById('cr-summary-rows');
    if (!tbody) return; // La tabla no está presente
    
    // Los elementos del resumen financiero son opcionales
    const subEl = document.getElementById('cr-summary-subtotal');
    const discEl = document.getElementById('cr-summary-discount');
    const ivaEl = document.getElementById('cr-summary-iva');
    const totalEl = document.getElementById('cr-summary-total');

    // Limpiar cuerpo
    tbody.innerHTML = '';

    // Lectura del estado actual
    const days = Math.max(1, parseInt(els.days?.value || state.days || 1, 10));
    const apply = document.getElementById('cr-summary-apply-discount')?.value || 'no';
    const pct = parseFloat(document.getElementById('cr-summary-discount-percent-input')?.value || '0') || 0;
    const shippingCostValue = parseFloat(document.getElementById('cr-delivery-cost')?.value || '0') || 0;

    // Construir filas: Productos (módulos)
    let part = 1;
    let modulesDaily = 0; // por día
    let totalWeight = 0; // Variable para acumular peso total
    state.cart.forEach(ci => {
      const p = state.products.find(x => x.id === ci.id);
      if (!p) return;
      const daily = Number(p.price?.diario || 0);
      const lineTotal = daily * ci.qty * days;
      modulesDaily += daily * ci.qty;
      // Acumular peso total
      const peso = Number(p.peso || 0);
      totalWeight += peso * ci.qty;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="text-align:center;"><img src="${p.image || 'img/default.jpg'}" alt="${p.name}" style="width:40px; height:40px; object-fit:cover; border-radius:6px;" onerror="this.src='img/default.jpg'"/></td>
        <td>${part++}</td>
        <td>${p.peso || p.weight || 0} kg</td>
        <td>${p.sku || '-'}</td>
        <td>${p.name || '-'}</td>
        <td>${ci.qty}</td>
        <td>${currency(daily)}</td>
        <td>${apply === 'si' ? (pct.toFixed(2) + '%') : '0%'}</td>
        <td>${currency(lineTotal)}</td>`;
      tbody.appendChild(tr);
    });

    // Construir filas: Accesorios seleccionados
    let accDaily = 0;
    try {
      const selected = Array.from(state.accSelected || []);
      selected.forEach(id => {
        const node = document.querySelector(`#cr-accessories .cr-acc-item[data-name="${CSS.escape(id)}"]`);
        if (!node) return;
        const price = parseFloat(node.getAttribute('data-price') || '0') || 0;
        const sku = node.getAttribute('data-sku') || '-';
        const qty = Math.max(1, parseInt((state.accQty && state.accQty[id]) || '1', 10));
        const lineTotal = price * qty * days;
        accDaily += price * qty;
        const image = node.getAttribute('data-image') || node.querySelector('img')?.src || 'img/default.jpg';
        const peso = parseFloat(node.getAttribute('data-peso') || node.getAttribute('data-weight') || '0') || 0;
        // Acumular peso de accesorios al total
        totalWeight += peso * qty;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="text-align:center;"><img src="${image}" alt="${id}" style="width:40px; height:40px; object-fit:cover; border-radius:6px;" onerror="this.src='img/default.jpg'"/></td>
          <td>${part++}</td>
          <td>${peso} kg</td>
          <td>${sku}</td>
          <td>[Acc] ${id}</td>
          <td>${qty}</td>
          <td>${currency(price)}</td>
          <td>${apply === 'si' ? (pct.toFixed(2) + '%') : '0%'}</td>
          <td>${currency(lineTotal)}</td>`;
        tbody.appendChild(tr);
      });
    } catch {}

    // Agregar fila del peso total al final de la tabla
    if (state.cart.length > 0 || (state.accSelected && state.accSelected.size > 0)) {
      const weightRow = document.createElement('tr');
      weightRow.style.borderTop = '2px solid #e2e8f0';
      weightRow.style.backgroundColor = '#f8fafc';
      weightRow.style.fontWeight = 'bold';
      weightRow.innerHTML = `
        <td colspan="2" style="text-align:right; padding:8px; font-weight:bold;">Peso Total:</td>
        <td style="padding:8px; font-weight:bold; color:#059669;">${totalWeight.toFixed(2)} kg</td>
        <td colspan="5"></td>`;
      tbody.appendChild(weightRow);
    }

    // Subtotales
    const rentPerDay = modulesDaily + accDaily; // por día
    const subtotal = rentPerDay * days;        // Total por N días (sin envío/desc/IVA)

    // Envío: usar input oculto, si no existe cae a 0
    let shippingCostValue2 = 0;
    const deliveryBranchRadio = document.getElementById('delivery-branch-radio');
    const deliveryHomeRadio = document.getElementById('delivery-home-radio');
    if (deliveryHomeRadio?.checked) {
      shippingCostValue2 = parseFloat(document.getElementById('cr-delivery-cost')?.value || '0') || 0;
    } else if (deliveryBranchRadio?.checked) {
      shippingCostValue2 = 0; // Si es entrega en sucursal, el envío es 0
    } else {
      // Fallback: si no hay radios, intenta inferir por texto del método
      const methodTxt = (document.getElementById('cr-delivery-method')?.textContent || '').toLowerCase();
      const isPickup = /sucursal|recolec/.test(methodTxt);
      shippingCostValue2 = isPickup ? 0 : (parseFloat(document.getElementById('cr-delivery-cost')?.value || '0') || 0);
    }

    // Descuento: respetar controles de resumen
    let discount = 0;
    try {
      const apply = document.getElementById('cr-summary-apply-discount')?.value || 'no';
      const pct = parseFloat(document.getElementById('cr-summary-discount-percent-input')?.value || '0') || 0;
      if (apply === 'si' && pct > 0) discount = subtotal * (pct/100);
    } catch {}

    const taxable = Math.max(0, subtotal - discount + shippingCostValue2);
    const applyIVA = (document.getElementById('cr-summary-apply-iva')?.value || 'si') === 'si';
    const iva = applyIVA ? (taxable * 0.16) : 0;
    const total = taxable + iva;

    // Garantía: precio de venta × cantidad (productos) + precio de venta × cantidad (accesorios)
    let prodGuarantee = 0;
    state.cart.forEach(ci => {
      const p = state.products.find(x => x.id === ci.id);
      if (!p) return;
      const sale = Number(p.sale || p.precio_venta || 0);
      prodGuarantee += sale * Math.max(1, Number(ci.qty || 1));
    });
    let accGuarantee = 0;
    try {
      const selected = Array.from(state.accSelected || []);
      selected.forEach(id => {
        const node = document.querySelector(`#cr-accessories .cr-acc-item[data-name="${CSS.escape(id)}"]`);
        if (!node) return;
        const saleAttr = node.getAttribute('data-sale') ?? node.getAttribute('data-venta') ?? '0';
        const sale = parseFloat(saleAttr || '0') || 0;
        const qty = Math.max(1, parseInt((state.accQty && state.accQty[id]) || '1', 10));
        accGuarantee += sale * qty;
      });
    } catch {}
    const deposit = prodGuarantee + accGuarantee;

    // Pintar en UI
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatCurrency(val); };
    set('cr-fin-day', rentPerDay);
    const daysEl = document.getElementById('cr-fin-days'); if (daysEl) daysEl.textContent = String(days);
    set('cr-fin-total-days', subtotal);
    set('cr-fin-subtotal', subtotal);
    set('cr-fin-shipping', shippingCostValue2);
    const shipRow = document.getElementById('cr-fin-shipping-row');
    if (shipRow) shipRow.style.display = shippingCostValue2 > 0 ? 'grid' : 'none';
    set('cr-fin-discount', discount);
    set('cr-fin-iva', iva);
    set('cr-fin-total', total);
    set('cr-fin-deposit', deposit);
    
    // Mostrar peso total si existe el elemento
    const weightEl = document.getElementById('cr-total-weight');
    if (weightEl) {
      weightEl.textContent = `${totalWeight.toFixed(2)} kg`;
    }
  }

  // Enlazar eventos para refrescar el resumen (sin tocar tu lógica)
  function bindQuoteSummaryEvents() {
    try {
      const daysEl = document.getElementById('cr-days');
      if (daysEl && !daysEl.__boundSummary) {
        const rerender = () => { renderQuoteSummaryTable(); try { updateFinancialSummary(); } catch {} };
        daysEl.addEventListener('input', rerender);
        daysEl.addEventListener('change', rerender);
        daysEl.__boundSummary = true;
      }

      const applyEl = document.getElementById('cr-summary-apply-discount');
      if (applyEl && !applyEl.__boundSummary) {
        applyEl.addEventListener('change', () => { renderQuoteSummaryTable(); try { updateFinancialSummary(); } catch {} });
        applyEl.__boundSummary = true;
      }

      const pctEl = document.getElementById('cr-summary-discount-percent-input');
      if (pctEl && !pctEl.__boundSummary) {
        const rerender = () => { renderQuoteSummaryTable(); try { updateFinancialSummary(); } catch {} };
        pctEl.addEventListener('input', rerender);
        pctEl.addEventListener('change', rerender);
        pctEl.__boundSummary = true;
      }

      // IVA toggle
      const ivaEl = document.getElementById('cr-summary-apply-iva');
      if (ivaEl && !ivaEl.__boundSummary) {
        ivaEl.addEventListener('change', () => { renderQuoteSummaryTable(); try { updateFinancialSummary(); } catch {} });
        ivaEl.__boundSummary = true;
      }

      // También refrescar cuando cambian los km o tipo de zona (costo de envío visible)
      const kmInput = document.getElementById('cr-delivery-distance');
      if (kmInput && !kmInput.__boundSummary) {
        kmInput.addEventListener('input', () => { renderQuoteSummaryTable(); try { updateFinancialSummary(); } catch {} });
        kmInput.__boundSummary = true;
      }
      const zoneSelect = document.getElementById('cr-zone-type');
      if (zoneSelect && !zoneSelect.__boundSummary) {
        zoneSelect.addEventListener('change', () => { renderQuoteSummaryTable(); try { updateFinancialSummary(); } catch {} });
        zoneSelect.__boundSummary = true;
      }
    } catch {}
  }

  // Resumen Financiero (debajo de Costo de Envío)
  function updateFinancialSummary() {
    const wrap = document.getElementById('cr-financial-summary');
    if (!wrap) return; // Card no presente
    const days = Math.max(1, parseInt(document.getElementById('cr-days')?.value || state.days || 1, 10));

    // Totales de productos y accesorios
    let modulesDaily = 0; // por día
    state.cart.forEach(ci => {
      const p = state.products.find(x => x.id === ci.id);
      if (!p) return;
      const daily = Number(p.price?.diario || 0);
      modulesDaily += daily * ci.qty;
    });
    // Accesorios por día
    let accDaily = 0;
    try {
      const selected = Array.from(state.accSelected || []);
      selected.forEach(id => {
        const node = document.querySelector(`#cr-accessories .cr-acc-item[data-name="${CSS.escape(id)}"]`);
        if (!node) return;
        const price = parseFloat(node.getAttribute('data-price') || '0');
        const qty = Math.max(1, parseInt((state.accQty && state.accQty[id]) || '1', 10));
        accDaily += price * qty;
      });
    } catch {}

    const rentPerDay = modulesDaily + accDaily; // Renta por Día
    const subtotal = rentPerDay * days;        // Total por N días (sin envío/desc/IVA)

    // Envío: usar input oculto, si no existe cae a 0
    let shippingCostValue2 = 0;
    const deliveryBranchRadio = document.getElementById('delivery-branch-radio');
    const deliveryHomeRadio = document.getElementById('delivery-home-radio');
    if (deliveryHomeRadio?.checked) {
      shippingCostValue2 = parseFloat(document.getElementById('cr-delivery-cost')?.value || '0') || 0;
    } else if (deliveryBranchRadio?.checked) {
      shippingCostValue2 = 0; // Si es entrega en sucursal, el envío es 0
    }

    // Descuento: respetar controles de resumen
    let discount = 0;
    try {
      const apply = document.getElementById('cr-summary-apply-discount')?.value || 'no';
      const pct = parseFloat(document.getElementById('cr-summary-discount-percent-input')?.value || '0') || 0;
      if (apply === 'si' && pct > 0) discount = subtotal * (pct/100);
    } catch {}

    const taxable = Math.max(0, subtotal - discount + shippingCostValue2);
    const applyIVA = (document.getElementById('cr-summary-apply-iva')?.value || 'si') === 'si';
    const iva = applyIVA ? (taxable * 0.16) : 0;
    const total = taxable + iva;

    // Garantía: precio de venta × cantidad (productos) + precio de venta × cantidad (accesorios)
    let prodGuarantee = 0;
    state.cart.forEach(ci => {
      const p = state.products.find(x => x.id === ci.id);
      if (!p) return;
      const sale = Number(p.sale || p.precio_venta || 0);
      prodGuarantee += sale * Math.max(1, Number(ci.qty || 1));
    });
    let accGuarantee = 0;
    try {
      const selected = Array.from(state.accSelected || []);
      selected.forEach(id => {
        const node = document.querySelector(`#cr-accessories .cr-acc-item[data-name="${CSS.escape(id)}"]`);
        if (!node) return;
        const saleAttr = node.getAttribute('data-sale') ?? node.getAttribute('data-venta') ?? '0';
        const sale = parseFloat(saleAttr || '0') || 0;
        const qty = Math.max(1, parseInt((state.accQty && state.accQty[id]) || '1', 10));
        accGuarantee += sale * qty;
      });
    } catch {}
    const deposit = prodGuarantee + accGuarantee;

    // Pintar en UI
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = formatCurrency(val); };
    set('cr-fin-day', rentPerDay);
    const daysEl = document.getElementById('cr-fin-days'); if (daysEl) daysEl.textContent = String(days);
    set('cr-fin-total-days', subtotal);
    set('cr-fin-subtotal', subtotal);
    set('cr-fin-shipping', shippingCostValue2);
    set('cr-fin-discount', discount);
    set('cr-fin-iva', iva);
    const ivaLabel = document.getElementById('cr-fin-iva-label');
    if (ivaLabel) ivaLabel.textContent = `IVA (${applyIVA ? '16%' : '0%'}):`;
    set('cr-fin-total', total);
    set('cr-fin-deposit', deposit);
    
    // Ocultar/mostrar fila de Costo de Envío según método de entrega
    const shippingRow = document.getElementById('cr-fin-shipping-row');
    if (shippingRow) {
      const isBranchDelivery = deliveryBranchRadio?.checked === true;
      shippingRow.style.display = isBranchDelivery ? 'none' : 'grid';
    }
  }

  // Enlazar eventos para refrescar el resumen (sin tocar tu lógica)
  function bindQuoteSummaryEvents() {
    try {
      const daysEl = document.getElementById('cr-days');
      if (daysEl && !daysEl.__boundSummary) {
        const rerender = () => { renderQuoteSummaryTable(); try { updateFinancialSummary(); } catch {} };
        daysEl.addEventListener('input', rerender);
        daysEl.addEventListener('change', rerender);
        daysEl.__boundSummary = true;
      }

      const applyEl = document.getElementById('cr-summary-apply-discount');
      if (applyEl && !applyEl.__boundSummary) {
        applyEl.addEventListener('change', () => { renderQuoteSummaryTable(); try { updateFinancialSummary(); } catch {} });
        applyEl.__boundSummary = true;
      }

      const pctEl = document.getElementById('cr-summary-discount-percent-input');
      if (pctEl && !pctEl.__boundSummary) {
        const rerender = () => { renderQuoteSummaryTable(); try { updateFinancialSummary(); } catch {} };
        pctEl.addEventListener('input', rerender);
        pctEl.addEventListener('change', rerender);
        pctEl.__boundSummary = true;
      }

      // También refrescar cuando cambian los km o tipo de zona (costo de envío visible)
      const kmInput = document.getElementById('cr-delivery-distance');
      if (kmInput && !kmInput.__boundSummary) {
        kmInput.addEventListener('input', () => { renderQuoteSummaryTable(); try { updateFinancialSummary(); } catch {} });
        kmInput.__boundSummary = true;
      }
      const zoneSelect = document.getElementById('cr-zone-type');
      if (zoneSelect && !zoneSelect.__boundSummary) {
        zoneSelect.addEventListener('change', () => { renderQuoteSummaryTable(); try { updateFinancialSummary(); } catch {} });
        zoneSelect.__boundSummary = true;
      }
    } catch {}
  }

  // Enriquecer accesorios con precio de venta desde productos API
  function enrichAccessorySaleFromProducts() {
    try {
      if (!Array.isArray(state.products) || state.products.length === 0) return;
      const nodes = document.querySelectorAll('#cr-accessories .cr-acc-item');
      if (!nodes || nodes.length === 0) return;
      const norm = (s) => (s||'').toString().trim().toLowerCase();
      const normSKU = (s) => norm(s).replace(/[^a-z0-9]/g, ''); // priorizar SKU con normalización
      nodes.forEach(node => {
        // Si ya tiene data-sale o data-venta, no tocar
        const existing = node.getAttribute('data-sale') ?? node.getAttribute('data-venta');
        if (existing && parseFloat(existing) > 0) return;
        const name = norm(node.getAttribute('data-name'));
        const sku = normSKU(node.getAttribute('data-sku'));
        // Buscar primero por SKU, luego por nombre
        let found = null;
        if (sku) {
          if (state.bySku && state.bySku.has(sku)) {
            found = state.bySku.get(sku);
          } else {
            found = state.products.find(p => normSKU(p.sku) === sku);
          }
        }
        if (!found && name) found = state.products.find(p => norm(p.name) === name);
        const sale = found ? Number(found.sale || found.precio_venta || 0) : 0;
        if (sale > 0) node.setAttribute('data-sale', String(sale));
      });
    } catch (e) {
      console.warn('[enrichAccessorySaleFromProducts] fallo al enriquecer accesorios:', e);
    }
  }

  function applyAccessoryFilters() {
    if (!els.accGrid) return;
    const q = (els.accSearch?.value || '').trim().toLowerCase();
    const sub = (els.accSubcat?.value || 'todas').toLowerCase();
    const sort = (els.accSort?.value || 'name');
    const items = Array.from(els.accGrid.querySelectorAll('.cr-acc-item'));

    const filtered = [];
    items.forEach(it => {
      const name = (it.getAttribute('data-name') || '').toLowerCase();
      const sku = (it.getAttribute('data-sku') || '').toLowerCase();
      const pid = (it.getAttribute('data-id') || '').toLowerCase();
      // fallback por si el SKU está solo en el texto pintado
      const text = (it.innerText || '').toLowerCase();
      const cat = (it.getAttribute('data-subcat') || '').toLowerCase();
      const matchName = !q || name.includes(q) || sku.includes(q) || pid.includes(q) || text.includes(q);
      const matchCat = sub === 'todas' || cat === sub;
      it.style.display = matchName && matchCat ? '' : 'none';
      if (matchName && matchCat) filtered.push(it);
    });

    // Orden
    filtered.sort((a,b) => {
      if (sort === 'stock') {
        const sa = parseInt(a.getAttribute('data-stock') || '0', 10);
        const sb = parseInt(b.getAttribute('data-stock') || '0', 10);
        return sb - sa;
      }
      const na = (a.getAttribute('data-name') || '').toLowerCase();
      const nb = (b.getAttribute('data-name') || '').toLowerCase();
      return na.localeCompare(nb);
    });
    filtered.forEach(node => els.accGrid.appendChild(node));

    const visible = filtered.length;
    const cnt = document.getElementById('cr-accessory-count');
    if (cnt) cnt.textContent = String(visible);

    let empty = document.getElementById('cr-acc-empty');
    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'cr-acc-empty';
      empty.style.display = 'none';
      empty.style.padding = '12px';
      empty.style.border = '1px dashed #e2e8f0';
      empty.style.borderRadius = '10px';
      empty.style.color = '#64748b';
      empty.style.textAlign = 'center';
      empty.textContent = 'No hay accesorios que coincidan con tu búsqueda.';
      els.accGrid?.appendChild(empty);
    }
    empty.style.display = visible === 0 ? 'block' : 'none';

    // NO cambiar clases cuando es carrusel para evitar desbordes y saltos de tamaño
    if (!els.accGrid.classList.contains('cr-carousel')) {
      els.accGrid.classList.remove('cr-grid','cr-list');
      els.accGrid.classList.add(visible <= 2 ? 'cr-list' : 'cr-grid');
    } else {
      els.accGrid.classList.add('cr-grid');
    }

    // Enriquecer precios de venta en accesorios visibles
    try { enrichAccessorySaleFromProducts(); } catch {}
    refreshAccessoryButtons();
  }

  // Compatibilidad con atributo inline previo
  window.filterAccessories = applyAccessoryFilters;
  

  function refreshAccessoryButtons() {
    if (!els.accGrid) return;
    els.accGrid.querySelectorAll('.cr-acc-item').forEach(card => {
      let btn = card.querySelector('.cr-acc-btn');
      const id = getAccessoryId(card);
      const isSel = state.accSelected.has(id);
      // No inyectar controles adicionales para no crecer la tarjeta
      if (!btn) return;
      // update visual del botón y tarjeta
      btn.classList.toggle('is-selected', isSel);
      card.classList.toggle('is-selected', isSel);
      btn.innerHTML = isSel
        ? '<i class="fa-solid fa-circle-check"></i> Agregado'
        : '<i class="fa-solid fa-cart-plus"></i> Agregar';
    });
  }

  function toggleAccessory(card) {
    const id = getAccessoryId(card);
    if (!id) return;
    if (state.accSelected.has(id)) {
      state.accSelected.delete(id);
      if (state.accQty) delete state.accQty[id];
      state.accConfirmed.delete(id);
    } else {
      state.accSelected.add(id);
    }
    refreshAccessoryButtons();
    renderAccessoriesSummary();
    try { recalcTotal(); } catch {}
  }

  function ensureAccSummaryDOM() {
    const card = document.getElementById('cr-acc-summary-card');
    if (!card) return null;
    let head = card.querySelector('.cr-card__row');
    if (!head) {
      // Create a lightweight header row to host tools (keep existing H3 title intact)
      head = document.createElement('div');
      head.className = 'cr-card__row cr-acc-headrow';
      const title = card.querySelector('h3.cr-card__title');
      if (title) title.after(head); else card.prepend(head);
    }
    let tools = card.querySelector('.cr-acc-tools');
    if (!tools) {
      tools = document.createElement('div');
      tools.className = 'cr-acc-tools';
      head.appendChild(tools);
      const count = document.createElement('div');
      count.id = 'cr-acc-items-count';
      count.className = 'cr-count cr-acc-countbadge';
      count.innerHTML = '<i class="fa-solid fa-cubes"></i> <span>0</span> ítems';
      tools.appendChild(count);
      const clearBtn = document.createElement('button');
      clearBtn.id = 'cr-acc-clear-all';
      clearBtn.className = 'cr-btn cr-btn--ghost cr-acc-clearbtn';
      clearBtn.type = 'button';
      clearBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Vaciar';
      tools.appendChild(clearBtn);
    }
    let list = card.querySelector('#cr-acc-list');
    if (!list) {
      list = document.createElement('div');
      list.id = 'cr-acc-list';
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '8px';
      list.style.maxHeight = '240px';
      list.style.overflow = 'auto';
      card.insertBefore(list, card.querySelector('.cr-total'));
    }
    return { card, head, tools, list };
  }

  function renderAccessoriesSummary() {
    const dom = ensureAccSummaryDOM();
    if (!dom) return;
    const { list } = dom;
    list.innerHTML = '';
    const selected = Array.from(state.accSelected || []);
    const days = Math.max(1, parseInt(document.getElementById('cr-days')?.value || state.days || 1, 10));
    let unitTotal = 0;
    selected.forEach(id => {
      const node = Array.from((els.accGrid||document).querySelectorAll('.cr-acc-item')).find(n => (n.getAttribute('data-name')||'') === id);
      if (!node) return;
      const name = id;
      const sku = node.getAttribute('data-sku') || '-';
      const stock = parseInt(node.getAttribute('data-stock')||'0', 10);
      const price = parseFloat(node.getAttribute('data-price')||'0');
      const qty = Math.max(1, parseInt((state.accQty && state.accQty[id]) || '1', 10));
      unitTotal += price * qty;
      const row = document.createElement('div');
      row.className = 'cr-acc-row';
      row.setAttribute('data-id', id);
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1fr auto auto';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      const lineTotal = price * qty * days;
      row.innerHTML = `
        <div>
          <div style="font-weight:600; font-size:14px;">${name}</div>
          <div style="color:#64748b; font-size:12px;">SKU: ${sku}</div>
          <div style="color:#64748b; font-size:12px; margin-top:2px;">${qty} × ${currency(price)} × ${days} día(s) = <strong>${currency(lineTotal)}</strong></div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="cr-btn cr-btn--ghost cr-acc-dec" type="button" aria-label="Restar">-</button>
          <input class="cr-input cr-acc-q" type="number" min="1" value="${qty}" style="width:60px; text-align:right;" />
          <button class="cr-btn cr-btn--ghost cr-acc-inc" type="button" aria-label="Sumar">+</button>
        </div>
        <div style="display:flex; align-items:center; gap:8px; justify-content:flex-end; white-space:nowrap;">
          <small style="color:#64748b;">de ${stock} disp.</small>
          <button class="cr-btn cr-btn--ghost cr-acc-del" type="button" title="Eliminar" aria-label="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </div>`;
      list.appendChild(row);
    });
    // Totales (aplican días de renta)
    const totalEl = document.getElementById('cr-acc-total');
    const detailEl = document.getElementById('cr-acc-total-detail');
    const accTotal = unitTotal * days;
    if (totalEl) totalEl.textContent = currency(accTotal);
    if (detailEl) {
      const units = selected.reduce((a,id)=> a + Math.max(1, parseInt((state.accQty && state.accQty[id]) || '1',10)), 0);
      detailEl.textContent = selected.length > 0
        ? `${units} ítem(s) · ${currency(unitTotal)} × ${days} día(s)`
        : 'Sin accesorios seleccionados';
    }
    // Badge en cabecera de accesorios si existe
    try {
      const badge = document.getElementById('cr-acc-badge');
      const badgeCount = document.getElementById('cr-acc-badge-count');
      if (badge && badgeCount) { badge.hidden = selected.length === 0; badgeCount.textContent = String(selected.length); }
    } catch {}
    // Contador en toolbar
    const countWrap = document.getElementById('cr-acc-items-count');
    if (countWrap) countWrap.querySelector('span').textContent = String(selected.length);
  }

  // Delegación de eventos para +/-/input/remove/clear
  (function bindAccSummaryEvents(){
    const card = document.getElementById('cr-acc-summary-card');
    if (!card || card.__bound) return;
    card.addEventListener('click', (e) => {
      const row = e.target.closest('.cr-acc-row');
      const id = row?.getAttribute('data-id');
      if (!id) return;
      if (e.target.closest('.cr-acc-inc')) {
        const prev = Math.max(1, parseInt((state.accQty && state.accQty[id]) || '1', 10));
        if (!state.accQty) state.accQty = {}; state.accQty[id] = prev + 1;
        renderAccessoriesSummary();
        try { renderQuoteSummaryTable(); } catch {}
        try { recalcTotal(); } catch {}
      } else if (e.target.closest('.cr-acc-dec')) {
        const prev = Math.max(1, parseInt((state.accQty && state.accQty[id]) || '1', 10));
        const next = Math.max(1, prev - 1);
        if (!state.accQty) state.accQty = {}; state.accQty[id] = next;
        renderAccessoriesSummary();
        try { renderQuoteSummaryTable(); } catch {}
        try { recalcTotal(); } catch {}
      } else if (e.target.closest('.cr-acc-del')) {
        state.accSelected.delete(id);
        if (state.accQty) delete state.accQty[id];
        state.accConfirmed.delete(id);
        refreshAccessoryButtons();
        renderAccessoriesSummary();
        try { renderQuoteSummaryTable(); } catch {}
        try { recalcTotal(); } catch {}
      }
    });
    card.addEventListener('input', (e) => {
      const row = e.target.closest('.cr-acc-row');
      if (!row) return;
      if (e.target.classList.contains('cr-acc-q')) {
        const id = row.getAttribute('data-id');
        if (!id) return;
        const raw = e.target.value;
        // Permitir vacío mientras escribe
        if (raw === '') return;
        let val = parseInt(raw, 10);
        if (!Number.isFinite(val)) return; // esperar a que sea número válido
        if (!state.accQty) state.accQty = {}; state.accQty[id] = val;
        // No re-render en cada tecla para no interrumpir edición
      }
    });
    // Normalizar al confirmar (change/blur/Enter)
    card.addEventListener('change', (e) => {
      const row = e.target.closest('.cr-acc-row');
      if (!row) return;
      if (e.target.classList.contains('cr-acc-q')) {
        const id = row.getAttribute('data-id');
        if (!id) return;
        let val = parseInt(e.target.value || '1', 10);
        if (!Number.isFinite(val) || val < 1) val = 1;
        if (!state.accQty) state.accQty = {}; state.accQty[id] = val;
        renderAccessoriesSummary();
        try { renderQuoteSummaryTable(); } catch {}
        try { recalcTotal(); } catch {}
      }
    });
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const row = e.target.closest('.cr-acc-row');
      if (!row) return;
      if (e.target.classList.contains('cr-acc-q')) {
        e.preventDefault();
        e.target.blur(); // dispara change y normaliza
      }
    });
    card.addEventListener('click', (e) => {
      if (e.target.closest('#cr-acc-clear-all')) {
        state.accSelected = new Set();
        state.accQty = {};
        state.accConfirmed = new Set();
        refreshAccessoryButtons();
        renderAccessoriesSummary();
        try { renderQuoteSummaryTable(); } catch {}
        try { recalcTotal(); } catch {}
      }
    });
    card.__bound = true;
  })();

  function removeAccessory(card) {
    const id = getAccessoryId(card);
    if (!id) return;
    // clear states
    state.accSelected.delete(id);
    state.accConfirmed.delete(id);
    if (state.accQty) delete state.accQty[id];
    // reset UI immediately
    refreshAccessoryButtons();
    renderAccessoriesSummary();
  }

  function confirmAccessory(card) {
    const id = getAccessoryId(card);
    if (!id) return;
    const qtyEl = card.querySelector('.cr-acc-qty');
    const qty = Math.max(1, parseInt(qtyEl?.value || '1', 10));
    // store qty by id in a map-like object
    if (!state.accQty) state.accQty = {};
    state.accQty[id] = qty;
    state.accConfirmed.add(id);
    renderAccessoriesSummary();
    // Update confirm button UI immediately
    const confirmBtn = card.querySelector('.cr-acc-confirm');
    if (confirmBtn) {
      confirmBtn.textContent = 'Confirmado';
      confirmBtn.classList.add('is-confirmed');
      confirmBtn.disabled = false;
    }

    // Toast dentro de la tarjeta
    let toast = card.querySelector('.cr-acc-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'cr-acc-toast';
      toast.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span class="cr-acc-toast__text"></span>';
      card.appendChild(toast);
    }
  }

  

  // --- Datos mock de productos ---
  const mock = [];

async function loadProductsFromAPI() {
  if (FORCE_MOCK) return mock;
  try {
    const headers = getAuthHeaders();
    const resp = await fetch(PRODUCTS_URL, { headers });
    if (!resp.ok) {
      if (resp.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return mock;
      }
      const txt = await resp.text().catch(()=> '');
      console.warn('Productos API no OK:', resp.status, txt);
      return mock;
    }
    const data = await resp.json();
    if (!Array.isArray(data)) return mock;
    
    // Mapear respuesta del backend de productos (src/controllers/productos.js)
    // y adaptarla a la estructura esperada por la UI de renta, sin romper el diseño.
    console.log('[renta] productos API recibidos:', data.length);
    const mapped = data
      .map(it => {
        const id = String(it.id || it.id_producto || 0);
        const sku = String(it.clave || it.codigo || it.sku || it.codigo_producto || it.id || it.id_producto || '');
        const name = it.name || it.nombre || it.nombre_del_producto || `#${id}`;
        const desc = it.descripcion || '';
        const brand = it.marca || '';
        const image = it.image || it.imagen || it.imagen_portada || 'img/default.jpg';
        // Determinar categoría para coincidir con los radios: marco_cruceta | multidireccional | templetes
        const rawCat = (it.nombre_subcategoria || it.categoria || '').toString().toLowerCase();
        let category = '';
        if (rawCat.includes('marco') || rawCat.includes('cruceta')) category = 'marco_cruceta';
        else if (rawCat.includes('multi') || rawCat.includes('multidireccional')) category = 'multidireccional';
        else if (rawCat.includes('templet') || rawCat.includes('temple')) category = 'templetes';
        // Stock disponible estimado para renta
        const stock_total = Number(it.stock_total || 0);
        const en_renta = Number(it.en_renta || 0);
        const reservado = Number(it.reservado || 0);
        const en_mantenimiento = Number(it.en_mantenimiento || 0);
        const stock = Math.max(0, stock_total - en_renta - reservado - en_mantenimiento);
        // Precios para renta: usar tarifa_renta
        const pDia = Number(it.tarifa_renta || 0);
        const pSem = Number(it.precio_semanal || (pDia * 6));
        const pMes = Number(it.precio_mensual || (pDia * 20));
        // Precio de venta (para garantía)
        const sale = Number(it.precio_venta || 0);
        return {
          id, sku, name, desc, brand, image, category, stock,
          quality: (it.condicion || it.estado || 'Bueno'),
          price: { diario: pDia, semanal: pSem, mensual: pMes },
          sale,
          peso: Number(it.peso || it.weight || 0), // Agregar campo peso
          id_almacen: it.id_almacen, // Agregar ID del almacén para filtrado
          nombre_almacen: it.nombre_almacen // Agregar nombre del almacén para referencia
        };
      });
    console.log('[renta] productos mapeados para UI:', mapped.length);
    if (mapped.length === 0) {
      console.warn('[renta] API devolvió 0 productos o no se pudieron mapear. Usando demo para no dejar la pantalla vacía.');
      const defaultMock = [
        { id: 'MC-200-001', name: 'Módulo 200 Marco-Cruceta', brand: 'AndamiosMX', category: 'marco_cruceta', desc: 'Módulo de 2.0m para sistema Marco-Cruceta.', image: 'img/default.jpg', stock: 50, price: { diario: 12000, semanal: 70000, mensual: 240000 }, quality: 'Bueno', peso: 25.5 },
        { id: 'MD-RO-001', name: 'Roseta Multidireccional', brand: 'MultiScaf', category: 'multidireccional', desc: 'Roseta para unión de montantes.', image: 'img/default.jpg', stock: 200, price: { diario: 500, semanal: 3000, mensual: 10000 }, quality: 'Nuevo', peso: 1.2 },
        { id: 'TP-PLA-001', name: 'Templete Plataforma 1.5m x 2.0m', brand: 'Templex', category: 'templetes', desc: 'Plataforma metálica antideslizante.', image: 'img/default.jpg', stock: 25, price: { diario: 6000, semanal: 36000, mensual: 120000 }, quality: 'Bueno', peso: 18.3 },
      ];
      return defaultMock;
    }
    return mapped;
  } catch (e) {
    console.warn('Fallo cargando equipos desde API, usando mock:', e);
    return mock;
  }
}

function currency(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
}

  // Recalcular fecha de fin según días
  function recalcEndDate() {
    if (!els.dateStart || !els.dateEnd || !els.durationText) return;
    const start = els.dateStart.valueAsDate || new Date();
    const days = Math.max(1, parseInt(els.days?.value || state.days || 1, 10));
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + days);
    els.dateEnd.valueAsDate = end;
    els.durationText.textContent = `Duración total: ${days} día${days>1?'s':''}. Desde ${start.toLocaleDateString()} hasta ${end.toLocaleDateString()}`;
  }

  // Recalcular total basado en tarifa diaria × cantidad × días
  function recalcTotal() {
    if (!els.total || !els.totalDetail) return;
    const days = Math.max(1, parseInt(els.days?.value || state.days || 1, 10));
    let total = 0;
    state.cart.forEach(ci => {
      const p = state.products.find(x => x.id === ci.id);
      if (!p) return;
      const daily = Number(p.price?.diario || 0);
      total += daily * ci.qty * days;
    });
    // Calcular subtotal de accesorios (por día × días)
    let accTotalUnit = 0;
    try {
      const selected = Array.from(state.accSelected || []);
      selected.forEach(id => {
        const node = document.querySelector(`#cr-accessories .cr-acc-item[data-name="${CSS.escape(id)}"]`);
        if (!node) return;
        const price = parseFloat(node.getAttribute('data-price') || '0');
        const qty = Math.max(1, parseInt((state.accQty && state.accQty[id]) || '1', 10));
        accTotalUnit += price * qty;
      });
    } catch {}
    const accTotal = accTotalUnit * days;
    // Total mostrado en tarjeta: SOLO módulos (productos) sin accesorios
    els.total.textContent = currency(total);
    // Ocultar el detalle debajo del total (solo mostrar el número)
    if (els.totalDetail) { els.totalDetail.textContent = ''; els.totalDetail.hidden = true; }
    // Mantener cálculo de entrega basado solo en módulos (como antes)
    const delivery = els.needDelivery?.checked ? Math.round(total * 0.3) : 0;
    state.deliveryExtra = delivery;
    if (els.deliveryExtra) els.deliveryExtra.textContent = `Costo adicional de entrega: ${currency(delivery)}`;

    // Actualizar bloque de total combinado si existe
    const grandEl = document.getElementById('cr-grand-total');
    const grandDetailEl = document.getElementById('cr-grand-total-detail');
    if (grandEl && grandDetailEl) {
      const grand = total + accTotal;
      grandEl.textContent = currency(grand);
      const parts = [];
      parts.push(`Módulos: ${currency(total)} (${days} día(s))`);
      if (accTotalUnit > 0) parts.push(`Accesorios: ${currency(accTotal)} (${currency(accTotalUnit)} × ${days} día(s))`);
      grandDetailEl.textContent = parts.join(' · ');
    }

    // Total final con entrega
    const finalEl = document.getElementById('cr-final-total');
    const finalDetailEl = document.getElementById('cr-final-total-detail');
    if (finalEl && finalDetailEl) {
      const grand = total + accTotal;
      const final = grand + delivery;
      finalEl.textContent = currency(final);
      finalDetailEl.textContent = `Incluye entrega: ${currency(delivery)}`;
    }
  }

  function addToCart(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    const item = state.cart.find(x => x.id === id);
    if (item) item.qty += 1; else state.cart.push({ id, qty: 1 });
    renderCart();
    // Actualizar tabla de resumen cuando se agregan productos
    try { renderQuoteSummaryTable(); } catch {}
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter(x => x.id !== id);
    renderCart();
    // Actualizar tabla de resumen cuando se remueven productos
    try { renderQuoteSummaryTable(); } catch {}
  }

  function updateCartQuantity(id, qty) {
    const item = state.cart.find(x => x.id === id);
    if (!item) return;
    
    const newQty = Math.max(1, parseInt(qty, 10) || 1);
    item.qty = newQty;
    renderCart();
    // Actualizar tabla de resumen cuando se actualiza cantidad
    try { renderQuoteSummaryTable(); } catch {}
  }

  function clearCart() {
    state.cart = [];
    renderCart();
    // Actualizar tabla de resumen cuando se limpia el carrito
    try { renderQuoteSummaryTable(); } catch {}
  }

  function changeCartQty(id, delta) {
    const item = state.cart.find(x => x.id === id);
    if (!item) return;
    const next = Math.max(1, item.qty + delta);
    item.qty = next; // permitir exceder stock
    renderCart();
    // Actualizar tabla de resumen cuando se cambia cantidad
    try { renderQuoteSummaryTable(); } catch {}
  }

  function renderCart() {
    if (!els.cartList) return;
    els.cartList.innerHTML = '';
    state.cart.forEach(ci => {
      const p = state.products.find(x => x.id === ci.id);
      if (!p) return;
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1fr auto';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.innerHTML = `
        <div style="display:flex; flex-direction:column;">
          <strong style="font-size:13px;">${p.name}</strong>
          <span style="color:#64748b; font-size:12px;">SKU: ${p.id}</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="cr-qty__btn" data-act="dec" data-id="${p.id}">-</button>
          <input type="number" min="1" value="${ci.qty}" data-id="${p.id}" style="width:56px; padding:6px 8px; border:1px solid #e2e8f0; border-radius:8px;" />
          <button class="cr-qty__btn" data-act="inc" data-id="${p.id}">+</button>
          <button class="cr-btn cr-btn--ghost" data-act="rm" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
          <span style="color:#64748b; font-size:12px;">de ${p.stock} disp.</span>
        </div>
      `;
      els.cartList.appendChild(row);
    });

    if (els.cartCount) els.cartCount.textContent = String(state.cart.reduce((a,b)=>a+b.qty,0));
    if (els.cartCountWrap) {
      const count = state.cart.reduce((a,b)=>a+b.qty,0);
      if (count >= 6) {
        els.cartCountWrap.style.background = '#fee2e2';
        els.cartCountWrap.style.border = '1px solid #fecaca';
        els.cartCountWrap.style.color = '#b91c1c';
        els.cartCountWrap.style.borderRadius = '10px';
        els.cartCountWrap.style.padding = '6px 10px';
      } else {
        els.cartCountWrap.style.background = '';
        els.cartCountWrap.style.border = '';
        els.cartCountWrap.style.color = '';
        els.cartCountWrap.style.borderRadius = '';
        els.cartCountWrap.style.padding = '';
      }
    }

    // Bind qty controls
    els.cartList.querySelectorAll('[data-act="dec"]').forEach(b=>b.addEventListener('click',()=>changeCartQty(b.getAttribute('data-id'),-1)));
    els.cartList.querySelectorAll('[data-act="inc"]').forEach(b=>b.addEventListener('click',()=>changeCartQty(b.getAttribute('data-id'),+1)));
    els.cartList.querySelectorAll('[data-act="rm"]').forEach(b=>b.addEventListener('click',()=>removeFromCart(b.getAttribute('data-id'))));
    // Allow free typing: input updates state when numeric, but does not rerender; normalize on change/Enter
    els.cartList.querySelectorAll('input[type="number"]').forEach(inp=>{
      const id = inp.getAttribute('data-id');
      const item = state.cart.find(x=>x.id===id);
      if (!item) return;
      inp.addEventListener('input',()=>{
        const raw = inp.value;
        if (raw === '') return; // allow clearing while typing
        let v = parseInt(raw, 10);
        if (!Number.isFinite(v)) return; // wait until valid number
        v = Math.max(1, v);
        item.qty = v; // update state silently, sin límite por stock
      });
      const normalize = ()=>{
        let v = parseInt(inp.value || '1', 10);
        if (!Number.isFinite(v) || v < 1) v = 1;
        item.qty = v;
        renderCart();
        try { renderQuoteSummaryTable(); } catch {}
      };
      inp.addEventListener('change', normalize);
      inp.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    });

    // Switch to 2-column grid layout if many items
    const many = state.cart.length >= 4;
    if (many) {
      els.cartList.style.display = 'grid';
      els.cartList.style.gridTemplateColumns = '1fr 1fr';
      els.cartList.style.alignItems = 'start';
    } else {
      els.cartList.style.display = 'flex';
      els.cartList.style.flexDirection = 'column';
    }

    // Subtotal por día
    if (els.cartSubtotalValue) {
      let subtotal = 0;
      state.cart.forEach(ci => {
        const p = state.products.find(x => x.id === ci.id);
        if (!p) return;
        const unit = Number(p.price?.diario || 0);
        subtotal += unit * ci.qty;
      });
      els.cartSubtotalValue.textContent = currency(subtotal);
      if (els.cartSubtotalWrap) {
        const labelNode = els.cartSubtotalWrap.querySelector('span');
        if (labelNode) labelNode.textContent = 'Subtotal (por día):';
      }
    }

    // Mantener sincronizado paso 3
    try { recalcTotal(); renderSummary(); renderSideList(); updateSummaryScrollHint(); renderQuoteSummaryTable(); } catch {}
  }

  function selectProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    state.selected = p;
    state.qty = 1;

    // Llenar lateral
    if (els.selImage) els.selImage.src = p.image;
    if (els.selName) els.selName.textContent = p.name;
    if (els.selDesc) els.selDesc.textContent = p.desc;
    if (els.selSku) els.selSku.textContent = p.id;
    if (els.selBrand) els.selBrand.textContent = p.brand;
    if (els.selStock) els.selStock.textContent = `${p.stock} disponibles`;
    if (els.priceDaily) els.priceDaily.textContent = currency(p.price.diario);
    if (els.dailyRate) els.dailyRate.value = currency(p.price.diario);

    // Mantener días actuales del header; solo asegurar fecha inicio
    if (els.dateStart) els.dateStart.valueAsDate = new Date();
    recalcEndDate();
    recalcTotal();

    // Ir a configuración
    gotoStep('config');
  }

// Continuar desde (Productos) hacia Paso 3 (Configuración)
function handleGoConfig(e) {
  try {
    e?.preventDefault?.();
    if (state.cart.length === 0) {
      alert('Agrega al menos un producto al carrito.');
      return;
    }
    // feedback visual
    try { els.goConfig?.classList.add('is-loading'); } catch {}
    const first = state.products.find(x => x.id === state.cart[0].id);
    if (first) {
      state.selected = first;
      // Llenar lateral con tolerancia
      if (els.selImage) els.selImage.src = first.image || 'img/default.jpg';
      if (els.selName) els.selName.textContent = first.name || '';
      if (els.selDesc) els.selDesc.textContent = first.desc || '';
      if (els.selSku) els.selSku.textContent = first.id || '';
      if (els.selBrand) els.selBrand.textContent = first.brand || '';
      if (els.selStock) els.selStock.textContent = `${first.stock ?? 0} disponibles`;
      if (els.priceDaily) els.priceDaily.textContent = currency(first.price?.diario || 0);
      if (els.dailyRate) els.dailyRate.value = currency(first.price?.diario || 0);
    }
    // Mantener días actuales del header; solo asegurar fecha inicio
    if (els.dateStart) els.dateStart.valueAsDate = new Date();
    recalcEndDate();
    recalcTotal();
    renderSummary();
    renderSideList();
    gotoStep('config');
    // Desplazar al inicio de Configuración para evitar hueco visual
    setTimeout(() => {
      try {
        document.getElementById('cr-config-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {}
    }, 40);
  } catch (err) {
    console.error('[handleGoConfig] error:', err);
  } finally {
    try { els.goConfig?.classList.remove('is-loading'); } catch {}
  }
}

  function renderSummary() {
    if (!els.summaryList) return;
    els.summaryList.innerHTML = '';
    state.cart.forEach(ci => {
      const p = state.products.find(x => x.id === ci.id);
      if (!p) return;
      const days = Math.max(1, parseInt(els.days?.value || state.days || 1, 10));
      const unit = Number(p.price?.diario || 0);
      const line = document.createElement('div');
      line.style.display = 'grid';
      line.style.gridTemplateColumns = '1fr auto';
      line.style.alignItems = 'center';
      line.style.cursor = 'pointer';
      line.setAttribute('data-id', p.id);
      line.innerHTML = `
        <div>
          <div style="font-weight:600; font-size:14px;">${p.name}</div>
          <div style="color:#64748b; font-size:12px;">${ci.qty} × ${currency(unit)} × ${days} día(s)</div>
        </div>
        <div style="text-align:right;">
          <div class="cr-summary-item-total">${currency(unit * ci.qty * days)}</div>
        </div>
      `;
      line.addEventListener('click', () => {
        selectProduct(p.id);
      });
      els.summaryList.appendChild(line);
    });
    updateSummaryScrollHint();
  }

  // Mostrar pista visual si el resumen tiene scroll y no está al final
  function updateSummaryScrollHint() {
    const el = els.summaryList;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 1;
    const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
    if (hasOverflow && !atBottom) {
      el.classList.add('show-scroll-hint');
    } else {
      el.classList.remove('show-scroll-hint');
    }
    if (!el.__hintBound) {
      el.addEventListener('scroll', () => {
        const atEnd = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 2;
        if (atEnd) el.classList.remove('show-scroll-hint');
        else if (el.scrollHeight > el.clientHeight + 1) el.classList.add('show-scroll-hint');
      });
      window.addEventListener('resize', () => updateSummaryScrollHint());
      el.__hintBound = true;
    }
  }

  function bindEvents() {
    els.gridBtn.addEventListener('click', () => { state.view = 'grid'; els.gridBtn.classList.add('is-active'); els.listBtn.classList.remove('is-active'); renderProducts(state.filtered); });
    els.listBtn.addEventListener('click', () => { state.view = 'list'; els.listBtn.classList.add('is-active'); els.gridBtn.classList.remove('is-active'); renderProducts(state.filtered); });

    els.search.addEventListener('input', filterProducts);
    els.toggleFilters.addEventListener('click', () => {
      const hidden = els.filters.hasAttribute('hidden');
      if (hidden) els.filters.removeAttribute('hidden'); else els.filters.setAttribute('hidden', '');
      els.toggleFilters.textContent = hidden ? 'Ocultar' : 'Mostrar';
    });
    document.getElementById('cr-products-section').addEventListener('change', e => {
      if (e.target.matches('#cr-filters input')) filterProducts();
    });

    if (els.days) {
      const handleDays = () => {
        state.days = Math.max(1, parseInt(els.days.value || '1', 10));
        try { recalcEndDate?.(); } catch {}
        try { recalcTotal?.(); } catch {}
        try { renderCart?.(); } catch {}
        try { renderSummary?.(); } catch {}
        try { renderAccessoriesSummary?.(); } catch {}
        try { renderSideList?.(); } catch {}
        try { renderQuoteSummaryTable?.(); } catch {}
      };
      els.days.addEventListener('input', handleDays);
      els.days.addEventListener('change', handleDays);
    }
    if (els.dateStart) {
      els.dateStart.addEventListener('change', () => { recalcEndDate(); });
    }

    // step header clicks
    els.stepProducts.addEventListener('click', () => gotoStep('products'));
    els.stepConfig.addEventListener('click', () => gotoStep('config'));
    if (els.stepShipping) {
      els.stepShipping.addEventListener('click', () => gotoStep('shipping'));
    }

    if (els.addToQuote) {
      els.addToQuote.addEventListener('click', () => {
        // por ahora solo redirige a cotizaciones.html con tipo preseleccionado de renta
        window.location.href = 'cotizaciones.html?tipo=RENTA';
      });
    }

    // Continuar a configuración
    if (els.goConfig) {
      els.goConfig.addEventListener('click', handleGoConfig);
    }
    // Vaciar carrito
    if (els.clearCart) {
      els.clearCart.addEventListener('click', () => { state.cart = []; renderCart(); });
    }
    // Continuar a Envío (Paso 4)
    const goShipping = document.getElementById('cr-go-shipping');
    if (goShipping) {
      goShipping.addEventListener('click', () => {
        gotoStep('shipping');
        setTimeout(() => {
          try {
            document.getElementById('cr-shipping-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } catch {}
        }, 30);
      });
    }

    // Volver a Productos (Paso 3)
    try {
      const backBtn = document.getElementById('cr-back-to-products');
      if (backBtn && !backBtn.__bound) {
        backBtn.addEventListener('click', (e) => {
          e.preventDefault();
          gotoStep('products');
        });
        backBtn.__bound = true;
      }
    } catch {}

    // Autocomplete: detect changes on CP and search address
    const zipEl = document.getElementById('cr-delivery-zip');
    const searchEl = document.getElementById('cr-search-address');
    const debouncedZip = debounce(() => autofillFromPostalCodeMX(zipEl?.value?.trim()), 500);
    const debouncedSearch = debounce(() => {
      const v = searchEl?.value?.trim();
      if (!v) return;
      if (/^\d{5}$/.test(v)) { autofillFromPostalCodeMX(v); return; }
      geocodeFreeTextMX(v);
    }, 600);
    if (zipEl) {
      zipEl.addEventListener('input', debouncedZip);
      zipEl.addEventListener('change', debouncedZip);
    }
    if (searchEl) {
      searchEl.addEventListener('input', debouncedSearch);
      searchEl.addEventListener('change', debouncedSearch);
    }

    // Notas: abrir/cerrar floater (resolver botón de cierre)
    try {
      if (els.notesFab && !els.notesFab.__bound) {
        els.notesFab.addEventListener('click', (e) => { e.preventDefault(); openNotesFloater(); });
        els.notesFab.__bound = true;
      }
      els.notesCloseBtns?.forEach(btn => {
        if (!btn.__bound) {
          btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeNotesFloater(); });
          btn.__bound = true;
        }
      });
    } catch {}

    // Método de entrega: sucursal vs domicilio
    const rBranch = document.getElementById('delivery-branch-radio');
    const rHome = document.getElementById('delivery-home-radio');
    const needDelivery = document.getElementById('cr-need-delivery');
    const homeWrap = document.getElementById('cr-home-delivery-wrap');
    const branchCard = document.getElementById('cr-branch-card');
    const branchSelect = document.getElementById('cr-branch-select');
    const branchSummary = document.getElementById('cr-branch-summary');
    const branchName = document.getElementById('cr-branch-name');

    function applyDeliveryMethodUI(method) {
      const isBranch = method === 'branch';
      if (needDelivery) needDelivery.checked = !isBranch; // clave para no alterar lógica de costos
      if (homeWrap) homeWrap.style.display = isBranch ? 'none' : '';
      if (branchCard) branchCard.style.display = isBranch ? '' : 'none';
      // Si es sucursal, limpiar distancia/costo (visualmente)
      if (isBranch) {
        try {
          const dist = document.getElementById('cr-delivery-distance');
          const cost = document.getElementById('cr-delivery-cost');
          if (dist) dist.value = '';
          if (cost) cost.value = '0'; // asegurar costo 0 en sucursal
          const display = document.getElementById('cr-delivery-cost-display');
          if (display) display.textContent = '$0';
          const extra = document.getElementById('cr-delivery-extra');
          if (extra) extra.textContent = 'Entrega en sucursal: sin costo adicional.';
          // Limpiar campos de dirección de envío a domicilio
          document.getElementById('cr-delivery-street').value = '';
          document.getElementById('cr-delivery-ext').value = '';
          document.getElementById('cr-delivery-int').value = '';
          document.getElementById('cr-delivery-colony').value = '';
          document.getElementById('cr-delivery-zip').value = '';
          document.getElementById('cr-delivery-city').value = '';
          document.getElementById('cr-delivery-state').value = '';
          document.getElementById('cr-delivery-reference').value = '';

        } catch {}
      } else {
        const extra = document.getElementById('cr-delivery-extra');
        if (extra) extra.textContent = 'Costo adicional de entrega: $0';
      }
      // Recalcular totales si corresponde
      try { recalcTotal(); } catch {}
    }

    if (rBranch) {
      rBranch.addEventListener('change', (e) => {
        if (e.target.checked) applyDeliveryMethodUI('branch');
      });
    }
    if (rHome) {
      rHome.addEventListener('change', (e) => {
        if (e.target.checked) applyDeliveryMethodUI('home');
      });
    }
    if (branchSelect) {
      branchSelect.addEventListener('change', () => {
        const text = branchSelect.options[branchSelect.selectedIndex]?.text || '';
        if (branchName) branchName.textContent = text;
        if (branchSummary) branchSummary.hidden = !branchSelect.value;
      });
    }
    // Asegura estado inicial coherente
    if (rBranch?.checked) applyDeliveryMethodUI('branch');
    else applyDeliveryMethodUI('home');

    // Abrir Google Maps con el destino (y origen si hay sucursal)
    const openMapsBtn = document.getElementById('open-google-maps-btn');
    if (openMapsBtn) {
      openMapsBtn.addEventListener('click', () => {
        // Construir destino desde campos de domicilio
        const street = document.getElementById('cr-delivery-street')?.value?.trim();
        const ext = document.getElementById('cr-delivery-ext')?.value?.trim();
        const interior = document.getElementById('cr-delivery-int')?.value?.trim();
        const colony = document.getElementById('cr-delivery-colony')?.value?.trim();
        const zip = document.getElementById('cr-delivery-zip')?.value?.trim();
        const city = document.getElementById('cr-delivery-city')?.value?.trim();
        const state = document.getElementById('cr-delivery-state')?.value?.trim();
        const parts = [street, ext && `#${ext}`, interior && `Int ${interior}`, colony, zip, city, state, 'México'];
        const dest = parts.filter(Boolean).join(', ');

        // Origen: si el usuario seleccionó sucursal, usar su dirección del option
        let origin = '';
        if (branchSelect?.value) {
          const optText = branchSelect.options[branchSelect.selectedIndex]?.text || '';
          // El texto del option ya incluye nombre y dirección; úsalo como origen
          origin = optText;
        }

        let url = 'https://www.google.com/maps';
        if (dest && origin) {
          url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}`;
        } else if (dest) {
          url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`;
        } else if (origin) {
          url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(origin)}`;
        }
        window.open(url, '_blank', 'noopener');
      });
    }

    // Calcular Envío: Metropolitana => km*4*12, Foráneo => km*4*18; solo si km>5
    function calculateAndRenderShippingCost() {
      try {
        const km = parseFloat(document.getElementById('cr-delivery-distance')?.value || '0') || 0;
        const zone = document.getElementById('cr-zone-type')?.value || 'metropolitana';
        const hiddenCost = document.getElementById('cr-delivery-cost');
        const display = document.getElementById('cr-delivery-cost-display');
        const extraNote = document.getElementById('cr-delivery-extra');
        const formula = document.getElementById('cr-delivery-cost-formula');

        let cost = 0;
        if (km > 5) {
          if (zone === 'foraneo') cost = km * 4 * 18;
          else cost = km * 4 * 12; // metropolitana por defecto
        } else {
          cost = 0;
        }

        if (hiddenCost) hiddenCost.value = String(cost.toFixed(2));
        if (display) display.textContent = formatCurrency(cost);
        if (extraNote) {
          extraNote.textContent = km > 5 
            ? `Costo adicional de entrega: ${formatCurrency(cost)}`
            : 'Entrega sin costo adicional (≤ 5 km)';
        }
        if (formula) {
          const base = zone === 'foraneo' ? 'km × 4 × 18' : 'km × 4 × 12';
          formula.textContent = km > 5 ? `Fórmula aplicada: ${base} (km = ${km})` : 'No se cobra envío cuando km ≤ 5';
        }
        // Mantener consistencia con totales
        try { recalcTotal(); renderQuoteSummaryTable(); } catch {}
      } catch {}
    }

    const calcBtn = document.getElementById('calculate-shipping-cost-btn');
    if (calcBtn) calcBtn.addEventListener('click', calculateAndRenderShippingCost);

    // Recalcular en vivo al cambiar km o zona
    const kmInput = document.getElementById('cr-delivery-distance');
    const zoneSelect = document.getElementById('cr-zone-type');
    if (kmInput) kmInput.addEventListener('input', calculateAndRenderShippingCost);
    if (zoneSelect) zoneSelect.addEventListener('change', calculateAndRenderShippingCost);

    // Autocomplete de contacto por CP (estado y municipio)
    const contactZip = document.getElementById('cr-contact-zip');
    const debouncedContactZip = debounce(() => autofillContactFromPostalCodeMX(contactZip?.value?.trim()), 500);
    if (contactZip) {
      contactZip.addEventListener('input', debouncedContactZip);
      contactZip.addEventListener('change', debouncedContactZip);
    }

    // Toggle: Usar datos de entrega para contacto
    const useDelivery = document.getElementById('cr-contact-use-delivery');
    if (useDelivery) {
      const onToggle = () => {
        try {
          const dZip = document.getElementById('cr-delivery-zip')?.value?.trim();
          const dCity = document.getElementById('cr-delivery-city')?.value?.trim();
          const dState = document.getElementById('cr-delivery-state')?.value?.trim();
          const cZipEl = document.getElementById('cr-contact-zip');
          const cCityEl = document.getElementById('cr-contact-municipio');
          const cStateEl = document.getElementById('cr-contact-state');

          if (useDelivery.checked) {
            // Copiar desde entrega a contacto
            if (dZip && cZipEl) cZipEl.value = dZip;
            if (dCity && cCityEl) cCityEl.value = dCity;
            if (dState && cStateEl) cStateEl.value = dState;
            // Reaplicar autocompletado para validar y sugerir
            if (dZip) autofillContactFromPostalCodeMX(dZip);
          } else {
            // Limpiar SOLO si siguen iguales a los de entrega
            if (cZipEl && cZipEl.value?.trim() === (dZip || '')) cZipEl.value = '';
            if (cCityEl && cCityEl.value?.trim() === (dCity || '')) cCityEl.value = '';
            if (cStateEl && cStateEl.value?.trim() === (dState || '')) cStateEl.value = '';
          }
        } catch {}
      };
      useDelivery.addEventListener('change', onToggle);
    }
  }

  function formatCurrency(n) {
    try {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(Number(n) || 0);
    } catch {
      const v = (Number(n) || 0).toFixed(2);
      return `$${v}`;
    }
  }

  async function init() {
    // Ensure notes UI starts closed on page load (prevents auto-open on refresh)
    try {
      const floater = document.getElementById('cr-notes-floater');
      if (floater) {
        floater.hidden = true;
        floater.style.display = 'none';
        floater.setAttribute('aria-hidden', 'true');
      }
    } catch {}

    // Cliente: iniciar en blanco (no prefill). Se llenará sólo al seleccionar en el modal.
    try {
      const label = document.getElementById('v-client-label');
      const hidden = document.getElementById('v-extra');
      if (label) label.textContent = '';
      if (hidden) {
        hidden.value = '';
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } catch {}
    // cargar datos
    state.products = await loadProductsFromAPI();
    // Construir índice por SKU para lookups O(1)
    try {
      const norm = (s) => (s||'').toString().trim().toLowerCase();
      const normSKU = (s) => norm(s).replace(/[^a-z0-9]/g, '');
      state.bySku = new Map();
      (state.products||[]).forEach(p => {
        const key = normSKU(p.sku);
        if (key) state.bySku.set(key, p);
      });
    } catch {}

    // Inicializar filtro con todos los productos
    state.filtered = state.products.slice();
    renderProducts(state.filtered);
    // Enriquecer precios de venta en accesorios (si están en el DOM)
    try { enrichAccessorySaleFromProducts(); } catch {}

    // Cargar y renderizar accesorios (según backend: renta=true y cat/subcat 'accesor')
    try {
      state.accessories = await loadAccessoriesFromAPI();
      renderAccessories(state.accessories);
      // Enriquecer inmediatamente tras pintar accesorios
      try { enrichAccessorySaleFromProducts(); } catch {}
    } catch (e) {
      console.warn('[renta] accesorios no disponibles:', e);
    }

    // Activar navegación del carrusel (solo en vista Grid)
    try {
      const prevBtn = document.getElementById('cr-car-prev');
      const nextBtn = document.getElementById('cr-car-next');
      const list = document.getElementById('cr-products');

      const step = () => Math.max(200, (list?.clientWidth || 0) * 0.9);
      const onPrev = () => list && list.scrollBy({ left: -step(), behavior: 'smooth' });
      const onNext = () => list && list.scrollBy({ left: step(), behavior: 'smooth' });

      if (prevBtn && !prevBtn.__bound) { prevBtn.addEventListener('click', onPrev); prevBtn.__bound = true; }
      if (nextBtn && !nextBtn.__bound) { nextBtn.addEventListener('click', onNext); nextBtn.__bound = true; }
      if (list && !list.__boundScroll) { list.addEventListener('scroll', () => { try { updateCarouselButtons(); } catch {} }); list.__boundScroll = true; }

      const updateControlsVisibility = () => {
        const inGrid = state.view === 'grid';
        const isCarousel = !!list && list.classList.contains('cr-carousel');
        if (prevBtn) prevBtn.style.display = inGrid && isCarousel ? 'grid' : 'none';
        if (nextBtn) nextBtn.style.display = inGrid && isCarousel ? 'grid' : 'none';
        try { updateCarouselButtons(); } catch {}
      };
      updateControlsVisibility();
      els.gridBtn?.addEventListener('click', updateControlsVisibility);
      els.listBtn?.addEventListener('click', updateControlsVisibility);
      window.addEventListener('resize', () => { try { updateCarouselButtons(); } catch {} });
    } catch {}

    // --- VENTA/RENTA header bindings ---
    try {
      // Enlazar modal de Período de Renta
      bindPeriodModalEvents();

      // Sincronizar cambios del input de días del header con el estado y totales
      const headerDays = document.getElementById('cr-days');
      if (headerDays) {
        const onDaysChange = () => {
          const v = Math.max(1, parseInt(headerDays.value || '1', 10));
          state.days = v;
          try { recalcEndDate?.(); } catch {}
          try { recalcTotal?.(); } catch {}
          try { renderSideList?.(); } catch {}
          // actualizar badge azul en el header
          try {
            const badge = document.getElementById('cr-days-badge');
            if (badge) badge.textContent = String(v);
          } catch {}
        };
        headerDays.addEventListener('input', onDaysChange);
        headerDays.addEventListener('change', onDaysChange);
      }

      // Sincronizar chip de moneda con el select (solo UI, sin tocar lógica de cálculo)
      const currencySel = document.getElementById('v-currency');
      const currencyBadge = document.getElementById('v-currency-badge');
      if (currencySel && currencyBadge) {
        const syncBadge = () => { currencyBadge.textContent = currencySel.value; };
        syncBadge();
        currencySel.addEventListener('change', syncBadge);
      }

      // Default de fecha de inicio: hoy (solo si está vacío), y recalcular al cambiar
      const dateStart = document.getElementById('cr-date-start');
      if (dateStart) {
        if (!dateStart.value) {
          const today = new Date();
          const iso = new Date(today.getTime() - today.getTimezoneOffset()*60000).toISOString().slice(0,10);
          dateStart.value = iso;
        }
        const onStartChange = () => {
          try { recalcEndDate?.(); } catch {}
          try { recalcTotal?.(); } catch {}
          try { renderSideList?.(); } catch {}
        };
        dateStart.addEventListener('change', onStartChange);
        dateStart.addEventListener('input', onStartChange);
      }

      const hSearch = document.getElementById('v-search-code');
      if (hSearch && !hSearch.__bound) {
        hSearch.addEventListener('input', () => {
          // sincroniza con buscador principal
          if (els.search && els.search.value !== hSearch.value) els.search.value = hSearch.value;
          filterProducts();
        });
        hSearch.__bound = true;
      }

      if (els.search && !els.search.__mirror) {
        els.search.addEventListener('input', () => {
          const v = els.search.value || '';
          if (hSearch && hSearch.value !== v) hSearch.value = v;
          filterProducts();
        });
        els.search.__mirror = true;
      }

      // Bind filtros de accesorios: búsqueda por clave (SKU) y nombre
      const accGrid = document.getElementById('cr-accessories');
      const accSearch = document.getElementById('cr-accessory-search');
      const accSubcat = document.getElementById('cr-acc-subcat');
      const accSort = document.getElementById('cr-acc-sort');
      if (typeof els === 'object') {
        els.accGrid = accGrid; els.accSearch = accSearch; els.accSubcat = accSubcat; els.accSort = accSort;
      }
      if (accGrid && !accGrid.__filtersBound) {
        accSearch?.addEventListener('input', applyAccessoryFilters);
        accSubcat?.addEventListener('change', applyAccessoryFilters);
        accSort?.addEventListener('change', applyAccessoryFilters);
        accGrid.__filtersBound = true;
      }
      try { applyAccessoryFilters(); } catch {}
    } catch {}

  // --- Side menu (hamburger) bindings ----
  try {
    const btn = document.getElementById('cr-hamburger');
    const menu = document.getElementById('cr-sidemenu');
    const backdrop = document.getElementById('cr-sidemenu-backdrop');
    const closeBtn = document.querySelector('[data-close-menu]');
    
    // Asegurar estado inicial correcto al cargar la página
    if (menu) {
      menu.hidden = true;
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) {
      backdrop.hidden = true;
    }
    if (btn) {
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
    
    // Flag para prevenir múltiples toggles simultáneos
    let isToggling = false;
    
    // Función unificada para obtener el estado real del menú
    const getMenuState = () => {
      if (!menu) return false;
      // El menú está abierto si tiene la clase 'is-open' Y no está hidden
      return menu.classList.contains('is-open') && !menu.hidden;
    };
    
    const openMenu = () => {
      if (!menu || !backdrop || isToggling) return;
      isToggling = true;
      
      // Asegurar que el backdrop y menú sean visibles primero
      menu.hidden = false; 
      backdrop.hidden = false;
      
      // Usar requestAnimationFrame para la animación
      requestAnimationFrame(() => { 
        menu.classList.add('is-open'); 
        if (btn) {
          btn.classList.add('is-open');
          btn.setAttribute('aria-expanded','true');
        }
        menu.setAttribute('aria-hidden','false');
        isToggling = false;
      });
    };
    
    const closeMenu = () => {
      if (!menu || !backdrop || isToggling) return;
      isToggling = true;
      
      // Remover clases primero para iniciar la animación de cierre
      menu.classList.remove('is-open'); 
      if (btn) {
        btn.classList.remove('is-open');
        btn.setAttribute('aria-expanded','false');
      }
      menu.setAttribute('aria-hidden','true');
      
      // Ocultar después de la animación
      setTimeout(() => { 
        menu.hidden = true; 
        backdrop.hidden = true; 
        isToggling = false;
      }, 250); // Aumentado a 250ms para que coincida con la transición CSS
    };
    
    const toggleMenu = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation(); // Prevenir que se propague y active otros listeners
      }
      
      // Usar función unificada para obtener estado
      const isOpen = getMenuState();
      
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    };
    
    // Listener único en el botón (con stopPropagation)
    if (btn && !btn.__menuBound) {
      btn.addEventListener('click', toggleMenu);
      btn.__menuBound = true;
    }
    
    // Cerrar con backdrop
    if (backdrop && !backdrop.__menuBound) {
      backdrop.addEventListener('click', closeMenu);
      backdrop.__menuBound = true;
    }
    
    // Cerrar con botón de cerrar
    if (closeBtn && !closeBtn.__menuBound) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
      });
      closeBtn.__menuBound = true;
    }
    
    // Cerrar con Escape
    window.addEventListener('keydown', (e) => { 
      if (e.key === 'Escape' && getMenuState()) {
        e.preventDefault();
        closeMenu(); 
      }
    });
    
    // Cerrar al hacer click en items del menú (excepto los que abren modales)
    document.querySelectorAll('#cr-sidemenu .cr-menu-item').forEach(it => {
      if (!it.__menuBound) {
        it.addEventListener('click', (e) => {
          // Solo cerrar si no tiene data-action o si es un link externo
          if (!it.hasAttribute('data-action') || it.target === '_blank') {
            closeMenu();
          }
        });
        it.__menuBound = true;
      }
    });

    // Event listeners para acciones del menú lateral
    // COMENTADO: Ahora se maneja directamente en el HTML con lógica condicional
    /*
    document.querySelectorAll('[data-action="guardar"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        saveQuotationFromMenu();
      });
    });
    */

    // Event listeners para modal de guardado
    document.querySelectorAll('[data-save-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeSaveModal();
      });
    });

    // Event listener para botón de guardar en modal (cliente existente)
    const saveModalBtn = document.getElementById('cr-save-confirm');
    if (saveModalBtn) {
      saveModalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        saveQuotationWithExistingClient();
      });
    }

    // Event listeners para modal de confirmación
    document.querySelectorAll('[data-confirm-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeConfirmSaveModal();
      });
    });

    // Event listener para botón de confirmación de guardado
    const confirmSaveBtn = document.getElementById('cr-confirm-save-btn');
    if (confirmSaveBtn) {
      confirmSaveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        saveQuotationWithExistingClient();
      });
    }

  } catch {}
  
  // NOTA: El fallback de delegación ha sido eliminado porque causaba conflictos.
  // Ahora usamos listeners directos con flags __menuBound para evitar duplicados.

  // preselect category from URL if present--
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('categoria');
    if (cat) {
      // marcar solo esa categoría en los filtros (radios)
      const radios = document.querySelectorAll('#cr-filters input[type="radio"]');
      radios.forEach(rb => { rb.checked = (rb.value === cat); });
      state.filtered = state.products.filter(p => p.category === cat);
    } else {
    state.filtered = state.products;
  }

    renderProducts(state.filtered);
    renderCart();
    bindEvents();
    // Accessories filters
    if (els.accSubcat) els.accSubcat.addEventListener('change', applyAccessoryFilters);
    if (els.accSort) els.accSort.addEventListener('change', applyAccessoryFilters);
    const clearBtn = document.getElementById('cr-acc-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => { if (els.accSearch) { els.accSearch.value = ''; applyAccessoryFilters(); els.accSearch.focus(); } });
    // Toggle cuerpo de accesorios
    const accToggle = document.getElementById('cr-acc-toggle');
    const accBody = document.getElementById('cr-acc-body');
    if (accToggle && accBody) {
      accToggle.addEventListener('click', () => {
        const willOpen = accBody.hidden;
        accBody.hidden = !accBody.hidden;
        accToggle.textContent = willOpen ? 'Ocultar accesorios' : 'Agregar accesorios';
        if (willOpen) setTimeout(() => els.accSearch?.focus(), 10);
      });
    }
    applyAccessoryFilters();

    // Notes wiring (available since step 1)
    loadNotes();
    updateNotesCounters();
    // Asegurar que el FAB tenga el listener de click (sin duplicar)
    const fab = document.getElementById('cr-notes-fab'); // Re-buscar para asegurar que existe
    const floater = document.getElementById('cr-notes-floater'); // Re-buscar para asegurar que existe
    if (fab && !fab.__clickBound) {
      // Actualizar referencia en els si cambió
      if (!els.notesFab) els.notesFab = fab;
      if (!els.notesFloater) els.notesFloater = floater;
      
      fab.addEventListener('click', (e) => {
        // Si se está suprimiendo el click (porque hubo drag), no hacer nada
        if (fab.__suppressClick || fab.__isDragging) {
          console.log('[Notes] Click suprimido (drag detectado)');
          // Reset flags después de verificar
          setTimeout(() => {
            fab.__suppressClick = false;
            fab.__isDragging = false;
          }, 50);
          return;
        }
        
        // Usar estado controlado en lugar de consultar el DOM
        const isOpen = !!state.notesOpen;
        console.log('[Notes] FAB click, notesOpen:', isOpen);
        if (!isOpen) {
          closeNotesModal();
          openNotesFloater();
        } else {
          closeNotesFloater();
        }
      });
      fab.__clickBound = true;
      console.log('[Notes] FAB click handler bound successfully'); // Debug temporal
    } else if (!fab) {
      console.warn('[Notes] FAB element not found during initialization');
    } else if (fab.__clickBound) {
      console.log('[Notes] FAB click handler already bound');
    }
    if (els.noteSave) els.noteSave.addEventListener('click', () => addNote(els.noteText?.value || ''));
    if (els.noteText) els.noteText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote(els.noteText.value); }
    });
    els.notesCloseBtns?.forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); closeAllNotes(); }));
    // Close button handler
    document.addEventListener('click', function(e) {
      if (e.target.closest('[data-close-notes]')) {
        closeNotesFloater();
      }
    });
    // Close on Escape
    window.addEventListener('keydown', (e) => { 
      if (e.key === 'Escape') { 
        e.preventDefault();
        closeNotesFloater(); 
      } 
    });
    enableNotesDrag();
    enableFabDrag();
    // Resumen de Cotización: enlazar eventos y render inicial
    try { bindQuoteSummaryEvents(); renderQuoteSummaryTable(); } catch {}

    // Mostrar y generar Resumen de Cotización solo cuando el usuario presione "Guardar datos"
    try {
      const saveBtn = document.getElementById('cr-save-contact');
      if (saveBtn && !saveBtn.__bound) {
        saveBtn.addEventListener('click', () => { showSection('cr-shipping-section'); showQuoteSummary(); });
        saveBtn.__bound = true;
      }
      const saveBranchBtn = document.getElementById('cr-save-contact-branch');
      if (saveBranchBtn && !saveBranchBtn.__bound) {
        saveBranchBtn.addEventListener('click', () => { showSection('cr-shipping-section'); showQuoteSummary(); });
        saveBranchBtn.__bound = true;
      }
    } catch(e) { console.error('[bindEvents] error binding save button', e); }

    // Load and render warehouses
    try {
      const warehouses = await loadWarehouses();
      state.warehouses = warehouses;
      renderWarehouses(warehouses);
    } catch (error) {
      console.error('[init] Error loading warehouses:', error);
    }

    // Load and populate branches for shipping section
    try {
      const branches = await loadBranches();
      populateBranchSelect(branches);
    } catch (error) {
      console.error('[init] Error loading branches:', error);
    }

    // Detectar modo edición y cargar datos si corresponde
    try {
      detectarModoEdicion();
    } catch (error) {
      console.error('[init] Error detectando modo edición:', error);
    }
  }

  function showSection(step) {
    const sections = document.querySelectorAll('.cr-section');
    sections.forEach(section => section.hidden = true);

    const activeSection = document.getElementById(step);
    if (activeSection) {
      activeSection.hidden = false;
      activeSection.classList.add('fade-in');
    }
  }

  function goToStep3() {
    showSection('cr-config-section');
  }

  function goToStep4() {
    if (state.deliveryNeeded) {
      showSection('cr-shipping-section');
      initializeMap();
    }
  }

  function goToPreviousStep() {
    showSection('cr-config-section');
  }

  function initializeMap() {
    const mapElement = document.getElementById('cr-map');
    mapElement.innerHTML = '<p>Cargando mapa...</p>'; // Placeholder para el mapa

    // Aquí puedes integrar un mapa interactivo como Google Maps o Leaflet
    // Ejemplo: Inicializar Google Maps
    // const map = new google.maps.Map(mapElement, { center: { lat: 19.4326, lng: -99.1332 }, zoom: 12 });
  }

  function searchLocation() {
    const address = document.getElementById('cr-search-address').value?.trim();
    if (!address) return alert('Por favor, ingresa una dirección.');
    // Si es CP de 5 dígitos, usa flujo de CP; si no, geocodifica texto libre
    if (/^\d{5}$/.test(address)) {
      autofillFromPostalCodeMX(address);
    } else {
      geocodeFreeTextMX(address).then(() => {
        // Si geocoding trajo un CP, enriquecemos colonias con flujo CP
        const zip = document.getElementById('cr-delivery-zip')?.value?.trim();
        if (/^\d{5}$/.test(zip)) {
          autofillFromPostalCodeMX(zip);
        }
      });
    }
  }

  function completeShippingStep() {
    alert('Detalles de envío confirmados.');
    // Aquí puedes guardar los datos de envío y proceder al siguiente paso
  }

  // --- Funciones de Guardado ---
  
  // Funciones auxiliares para fechas
  function getFechaInicio() {
    try {
      // Intentar obtener de varios elementos posibles
      const dateStartEl = document.getElementById('cr-date-start') || 
                         document.getElementById('v-date-start') ||
                         els.dateStart;
      
      if (dateStartEl && dateStartEl.value) {
        return dateStartEl.value;
      }
      
      // Si hay fecha en el estado
      if (state.dateStart) {
        return state.dateStart;
      }
      
      // Si no hay fecha seleccionada, usar hoy
      const today = new Date();
      return today.toISOString().split('T')[0];
    } catch {
      const today = new Date();
      return today.toISOString().split('T')[0];
    }
  }
  
  function getFechaFin() {
    try {
      // Intentar obtener de varios elementos posibles
      const dateEndEl = document.getElementById('cr-date-end') || 
                       document.getElementById('v-date-end') ||
                       els.dateEnd;
      
      if (dateEndEl && dateEndEl.value) {
        return dateEndEl.value;
      }
      
      // Si hay fecha en el estado
      if (state.dateEnd) {
        return state.dateEnd;
      }
      
      // Calcular fecha fin basada en fecha inicio + días
      const fechaInicio = new Date(getFechaInicio());
      const dias = state.days || 1;
      const fechaFin = new Date(fechaInicio);
      fechaFin.setDate(fechaFin.getDate() + dias);
      return fechaFin.toISOString().split('T')[0];
    } catch {
      // Fallback: hoy + días
      const today = new Date();
      const dias = state.days || 1;
      today.setDate(today.getDate() + dias);
      return today.toISOString().split('T')[0];
    }
  }
  
  // Funciones auxiliares para datos de entrega
  function getDeliveryAddress() {
    try {
      if (!state.deliveryNeeded) return null;
      
      const address = {
        calle: document.getElementById('cr-delivery-street')?.value?.trim() || '',
        numero: document.getElementById('cr-delivery-number')?.value?.trim() || '',
        colonia: document.getElementById('cr-delivery-neighborhood')?.value?.trim() || '',
        ciudad: document.getElementById('cr-delivery-city')?.value?.trim() || '',
        estado: document.getElementById('cr-delivery-state')?.value?.trim() || '',
        codigo_postal: document.getElementById('cr-delivery-zip')?.value?.trim() || '',
        referencias: document.getElementById('cr-delivery-references')?.value?.trim() || ''
      };
      
      // Construir dirección completa
      const parts = [address.calle, address.numero, address.colonia, address.ciudad, address.estado, address.codigo_postal].filter(p => p);
      return parts.length > 0 ? parts.join(', ') : null;
    } catch {
      return null;
    }
  }
  
  function getDeliveryDistance() {
    try {
      // Buscar en el DOM o estado la distancia calculada
      const distanceEl = document.getElementById('cr-delivery-distance');
      if (distanceEl && distanceEl.textContent) {
        const match = distanceEl.textContent.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }
  
  function getDeliveryCalculationDetails() {
    try {
      if (!state.deliveryNeeded) return null;
      
      const subtotal = calculateSubtotal();
      const percentage = 0.3; // 30% del subtotal
      const calculatedCost = Math.round(subtotal * percentage);
      
      return {
        metodo: 'porcentaje_subtotal',
        porcentaje: percentage * 100,
        subtotal_base: subtotal,
        costo_calculado: calculatedCost,
        costo_final: state.deliveryExtra || calculatedCost
      };
    } catch {
      return null;
    }
  }
  
  function getCustomNotes() {
    try {
      // 1. Intentar obtener de campo de condiciones del resumen
      const conditionsTextarea = document.getElementById('cr-summary-conditions');
      if (conditionsTextarea && conditionsTextarea.value?.trim()) {
        return conditionsTextarea.value.trim();
      }
      
      // 2. Obtener notas personalizadas del usuario
      const notesTextarea = document.getElementById('cr-notes-text') || 
                           document.querySelector('.cr-notes textarea') ||
                           els.noteText;
      
      if (notesTextarea && notesTextarea.value?.trim()) {
        return notesTextarea.value.trim();
      }
      
      // 3. Si hay notas en el estado
      if (state.notes && state.notes.length > 0) {
        return state.notes.join('\n');
      }
      
      return `Cotización de renta generada el ${new Date().toLocaleString()}`;
    } catch {
      return `Cotización de renta generada el ${new Date().toLocaleString()}`;
    }
  }
  
  // Función para recopilar datos de la cotización
  function collectQuotationData() {
    try {
      // Datos básicos de la cotización
      const quotationData = {
        tipo: 'RENTA', // Por defecto RENTA, se puede cambiar según la página
        fecha_cotizacion: new Date().toISOString().split('T')[0],
        
        // Datos del almacén seleccionado
        id_almacen: state.selectedWarehouse?.id_almacen || null,
        nombre_almacen: state.selectedWarehouse?.nombre_almacen || null,
        ubicacion_almacen: state.selectedWarehouse?.ubicacion || null,
        
        // Productos seleccionados
        productos_seleccionados: state.cart.map(item => {
          const product = state.products.find(p => p.id === item.id);
          return {
            id_producto: item.id,
            nombre: product?.name || '',
            sku: product?.sku || '',
            cantidad: item.qty,
            precio_unitario: product?.price?.diario || 0,
            precio_semanal: product?.price?.semanal || 0,
            precio_mensual: product?.price?.mensual || 0,
            subtotal: (product?.price?.diario || 0) * item.qty * (state.days || 1)
          };
        }),
        
        // Configuración de período (solo por días)
        dias_periodo: state.days || 1,
        fecha_inicio: getFechaInicio(),
        fecha_fin: getFechaFin(),
        periodo: 'Día', // Siempre por días
        
        // Cálculos financieros
        subtotal: calculateSubtotal(),
        iva: calculateIVA(),
        costo_envio: getDeliveryCost(),
        total: calculateTotalWithIVA(),
        
        // Datos de entrega
        requiere_entrega: state.deliveryNeeded || false,
        direccion_entrega: getDeliveryAddress(),
        tipo_envio: state.deliveryNeeded ? 'envio' : 'local',
        distancia_km: getDeliveryDistance(),
        detalle_calculo: getDeliveryCalculationDetails(),
        
        // Campos de entrega detallados
        entrega_lote: document.getElementById('cr-delivery-lote')?.value || null,
        hora_entrega_solicitada: document.getElementById('cr-delivery-time')?.value || null,
        entrega_calle: document.getElementById('cr-delivery-street')?.value || null,
        entrega_numero_ext: document.getElementById('cr-delivery-ext')?.value || null,
        entrega_numero_int: document.getElementById('cr-delivery-int')?.value || null,
        entrega_colonia: document.getElementById('cr-delivery-colony')?.value || null,
        entrega_cp: document.getElementById('cr-delivery-zip')?.value || null,
        entrega_municipio: document.getElementById('cr-delivery-city')?.value || null,
        entrega_estado: document.getElementById('cr-delivery-state')?.value || null,
        entrega_referencia: document.getElementById('cr-observations')?.value || 
                           document.getElementById('cr-delivery-reference')?.value || null,
        entrega_kilometros: parseFloat(document.getElementById('cr-delivery-distance')?.value) || 0,
        tipo_zona: document.getElementById('cr-zone-type')?.value || null,
        
        // Notas del sistema
        notas_internas: state.notes || [],
        notas: getCustomNotes(),
        
        // Accesorios seleccionados (campo separado para BD)
        accesorios_seleccionados: JSON.stringify(getSelectedAccessoriesForDB()),
        
        // Configuración especial
        configuracion_especial: {
          view: state.view,
          accessories: getSelectedAccessories(),
          delivery_needed: state.deliveryNeeded,
          delivery_extra: state.deliveryExtra
        },
        
        // Moneda
        moneda: 'MXN',
        tipo_cambio: 1.0000,
        
        // Estado inicial
        estado: 'Borrador',
        prioridad: 'Media',
        
        // Usuario autenticado
        creado_por: getCurrentUserId(),
        modificado_por: getCurrentUserId(),
        
        // Campos adicionales para la cotización
        precio_unitario: calculateAverageUnitPrice(),
        cantidad_total: getTotalQuantity(),
        id_vendedor: getCurrentUserId(),
        metodo_pago: getPaymentMethod(),
        terminos_pago: getPaymentTerms()
      };
      
      return quotationData;
    } catch (error) {
      console.error('[collectQuotationData] Error:', error);
      return null;
    }
  }
  
  // Función para calcular subtotal
  function calculateSubtotal() {
    try {
      return state.cart.reduce((total, item) => {
        const product = state.products.find(p => p.id === item.id);
        const pricePerDay = product?.price?.diario || 0;
        return total + (pricePerDay * item.qty * (state.days || 1));
      }, 0);
    } catch {
      return 0;
    }
  }
  
  // Función para calcular IVA
  function calculateIVA() {
    try {
      const subtotal = calculateSubtotal();
      return Math.round(subtotal * 0.16); // 16% de IVA
    } catch {
      return 0;
    }
  }
  
  // Función para obtener costo de envío
  function getDeliveryCost() {
    try {
      if (!state.deliveryNeeded) return 0;
      return state.deliveryExtra || 0;
    } catch {
      return 0;
    }
  }
  
  // Función para calcular total con IVA
  function calculateTotalWithIVA() {
    try {
      const subtotal = calculateSubtotal();
      const iva = calculateIVA();
      const delivery = getDeliveryCost();
      return subtotal + iva + delivery;
    } catch {
      return 0;
    }
  }
  
  // Función para calcular total (legacy - sin IVA)
  function calculateTotal() {
    try {
      const subtotal = calculateSubtotal();
      const delivery = state.deliveryExtra || 0;
      return subtotal + delivery;
    } catch {
      return 0;
    }
  }
  
  // Función para obtener ID del usuario actual
  function getCurrentUserId() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.id || user.id_usuario || null;
    } catch {
      return null;
    }
  }
  
  // Función para obtener accesorios seleccionados
  function getSelectedAccessories() {
    try {
      const accessories = [];
      
      // Buscar accesorios confirmados en el estado
      if (state.accConfirmed && state.accConfirmed.size > 0) {
        state.accConfirmed.forEach(id => {
          const qty = (state.accQty && state.accQty[id]) || 1;
          
          // Buscar el accesorio en el DOM para obtener más datos
          const accCard = document.querySelector(`#cr-accessories .cr-acc-item[data-name="${CSS.escape(id)}"]`);
          if (accCard) {
            const name = accCard.querySelector('.cr-acc-name')?.textContent?.trim() || id;
            const price = parseFloat(accCard.getAttribute('data-price') || '0');
            
            accessories.push({
              id: id,
              nombre: name,
              cantidad: qty,
              precio_unitario: price,
              subtotal: price * qty * (state.days || 1)
            });
          }
        });
      }
      
      return accessories;
    } catch (error) {
      console.warn('[getSelectedAccessories] Error:', error);
      return [];
    }
  }
  
  // Función para obtener accesorios seleccionados formateados para la BD
  function getSelectedAccessoriesForDB() {
    try {
      const accessories = [];
      
      console.log('[getSelectedAccessoriesForDB] 🔧 Procesando accesorios:', {
        accSelected: state.accSelected?.size || 0,
        accConfirmed: state.accConfirmed?.size || 0
      });
      
      // Usar accSelected (accesorios seleccionados) o accConfirmed (confirmados)
      const selectedSet = state.accSelected?.size > 0 ? state.accSelected : state.accConfirmed;
      
      if (selectedSet && selectedSet.size > 0) {
        selectedSet.forEach(id => {
          const qty = Math.max(1, parseInt((state.accQty && state.accQty[id]) || '1', 10));
          
          // Buscar el accesorio en el DOM para obtener más datos
          const accCard = document.querySelector(`#cr-accessories .cr-acc-item[data-name="${CSS.escape(id)}"]`);
          if (accCard) {
            const name = accCard.querySelector('.cr-acc-name')?.textContent?.trim() || id;
            const sku = accCard.getAttribute('data-sku') || accCard.getAttribute('data-key') || '';
            const productId = accCard.getAttribute('data-id') || '';
            const price = parseFloat(accCard.getAttribute('data-price') || '0');
            
            accessories.push({
              id_producto: productId || id,
              nombre: name,
              sku: sku,
              cantidad: qty,
              precio_unitario: price,
              subtotal: price * qty * (state.days || 1)
            });
            
            console.log(`[getSelectedAccessoriesForDB] ✅ Accesorio agregado: ${name} (SKU: ${sku}) x${qty}`);
          } else {
            console.warn(`[getSelectedAccessoriesForDB] ⚠️ Accesorio no encontrado en DOM: ${id}`);
          }
        });
      }
      
      console.log('[getSelectedAccessoriesForDB] 🔧 Total accesorios:', accessories.length);
      return accessories;
    } catch (error) {
      console.warn('[getSelectedAccessoriesForDB] Error:', error);
      return [];
    }
  }
  
  // Función para calcular precio unitario promedio
  function calculateAverageUnitPrice() {
    try {
      if (!state.cart || state.cart.length === 0) return 0;
      
      const totalPrice = state.cart.reduce((sum, item) => {
        const product = state.products.find(p => p.id === item.id);
        return sum + ((product?.price?.diario || 0) * item.qty);
      }, 0);
      
      const totalQuantity = getTotalQuantity();
      return totalQuantity > 0 ? Math.round(totalPrice / totalQuantity) : 0;
    } catch {
      return 0;
    }
  }
  
  // Función para obtener cantidad total
  function getTotalQuantity() {
    try {
      return state.cart.reduce((total, item) => total + item.qty, 0);
    } catch {
      return 0;
    }
  }
  
  // Función para obtener método de pago
  function getPaymentMethod() {
    try {
      // Buscar en el DOM si hay un selector de método de pago
      const paymentMethodEl = document.getElementById('cr-payment-method') || 
                             document.getElementById('v-payment-method');
      
      if (paymentMethodEl && paymentMethodEl.value) {
        return paymentMethodEl.value;
      }
      
      // Default para rentas
      return 'Transferencia';
    } catch {
      return 'Transferencia';
    }
  }
  
  // Función para obtener términos de pago
  function getPaymentTerms() {
    try {
      // Buscar en el DOM si hay un selector de términos
      const paymentTermsEl = document.getElementById('cr-payment-terms') || 
                            document.getElementById('v-payment-terms');
      
      if (paymentTermsEl && paymentTermsEl.value) {
        return paymentTermsEl.value;
      }
      
      // Para rentas, típicamente es anticipado
      return 'Anticipado';
    } catch {
      return 'Anticipado';
    }
  }
  
  // Función para sincronizar estado con elementos del DOM
  function syncStateFromDOM() {
    try {
      // Sincronizar fechas
      const dateStartEl = document.getElementById('cr-date-start') || els.dateStart;
      const dateEndEl = document.getElementById('cr-date-end') || els.dateEnd;
      
      if (dateStartEl && dateStartEl.value) {
        state.dateStart = dateStartEl.value;
      }
      
      if (dateEndEl && dateEndEl.value) {
        state.dateEnd = dateEndEl.value;
      }
      
      // Sincronizar días
      const daysEl = document.getElementById('cr-days') || els.days;
      if (daysEl && daysEl.value) {
        state.days = Math.max(1, parseInt(daysEl.value, 10));
      }
      
      console.log('[syncStateFromDOM] Estado sincronizado:', {
        dateStart: state.dateStart,
        dateEnd: state.dateEnd,
        days: state.days
      });
    } catch (error) {
      console.warn('[syncStateFromDOM] Error:', error);
    }
  }

  // Función para guardar cotización (desde menú lateral)
  async function saveQuotationFromMenu() {
    try {
      console.log('[saveQuotationFromMenu] Iniciando guardado desde menú...');
      
      // Sincronizar estado antes de guardar
      syncStateFromDOM();
      
      // Validar que hay productos en el carrito
      if (!state.cart || state.cart.length === 0) {
        alert('No hay productos seleccionados para guardar.');
        return;
      }
      
      // Recopilar datos
      const quotationData = collectQuotationData();
      if (!quotationData) {
        alert('Error al recopilar los datos de la cotización.');
        return;
      }
      
      console.log('[saveQuotationFromMenu] Datos recopilados:', quotationData);
      
      // Mostrar modal de guardado para capturar datos del cliente
      showSaveModal();
      
    } catch (error) {
      console.error('[saveQuotationFromMenu] Error:', error);
      alert('Error al intentar guardar la cotización.');
    }
  }
  
  // Función para guardar cotización con datos del cliente (desde modal)
  async function saveQuotationWithClientData() {
    try {
      console.log('[saveQuotationWithClientData] Guardando con datos del cliente...');
      
      // Obtener datos del modal
      const clientData = getClientDataFromModal();
      if (!clientData) {
        alert('Por favor complete los datos del cliente.');
        return;
      }
      
      // Recopilar datos de la cotización
      const quotationData = collectQuotationData();
      if (!quotationData) {
        alert('Error al recopilar los datos de la cotización.');
        return;
      }
      
      // Combinar datos del cliente con la cotización
      const completeData = {
        ...quotationData,
        ...clientData
      };
      
      // Enviar al backend
      const result = await sendQuotationToBackend(completeData);
      
      if (result.success) {
        alert(`Cotización guardada exitosamente. Número: ${result.numero_cotizacion}`);
        // Cerrar modal
        closeSaveModal();
        // Opcional: limpiar carrito o redirigir
      } else {
        alert(`Error al guardar: ${result.message}`);
      }
      
    } catch (error) {
      console.error('[saveQuotationWithClientData] Error:', error);
      alert('Error al guardar la cotización.');
    }
  }

  // Función para obtener datos del cliente existente seleccionado
  function getExistingClientData() {
    try {
      console.log('[getExistingClientData] Obteniendo datos del cliente existente...');
      
      // Primero intentar obtener desde localStorage
      const CLIENT_KEY = 'cr_selected_client';
      const storedClient = localStorage.getItem(CLIENT_KEY);
      let clientData = null;
      
      if (storedClient) {
        try {
          clientData = JSON.parse(storedClient);
          console.log('[getExistingClientData] Cliente desde localStorage:', clientData);
        } catch (e) {
          console.warn('[getExistingClientData] Error parseando localStorage:', e);
        }
      }
      
      // Si no hay datos en localStorage, obtener desde los campos del DOM
      if (!clientData) {
        const clientLabel = document.getElementById('v-client-label');
        const clientHidden = document.getElementById('v-extra');
        
        if (clientLabel && clientLabel.textContent.trim() && 
            clientLabel.textContent.trim() !== 'Seleccionar cliente') {
          
          clientData = {
            nombre: clientLabel.textContent.trim(),
            id_cliente: clientHidden ? clientHidden.value : null
          };
          console.log('[getExistingClientData] Cliente desde DOM:', clientData);
        }
      }
      
      // Si aún no tenemos datos, intentar desde los campos de contacto
      if (!clientData) {
        const contactName = document.getElementById('cr-contact-name')?.value?.trim();
        const contactEmail = document.getElementById('cr-contact-email')?.value?.trim();
        const contactPhone = document.getElementById('cr-contact-phone')?.value?.trim();
        const contactCompany = document.getElementById('cr-contact-company')?.value?.trim();
        
        if (contactName || contactEmail) {
          clientData = {
            nombre: contactName,
            email: contactEmail,
            telefono: contactPhone,
            empresa: contactCompany
          };
          console.log('[getExistingClientData] Cliente desde campos de contacto:', clientData);
        }
      }
      
      if (!clientData) {
        console.error('[getExistingClientData] No se encontraron datos del cliente');
        return null;
      }
      
      // Formatear datos para el backend
      const formattedData = {
        id_cliente: clientData.id_cliente || clientData.id,
        contacto_nombre: clientData.nombre,
        contacto_email: clientData.email,
        contacto_telefono: clientData.telefono || clientData.celular,
        tipo_cliente: clientData.empresa ? 'Empresa' : 'Público en General'
      };
      
      console.log('[getExistingClientData] Datos formateados:', formattedData);
      return formattedData;
      
    } catch (error) {
      console.error('[getExistingClientData] Error:', error);
      return null;
    }
  }
  
  // Función para obtener datos del cliente desde el modal
  function getClientDataFromModal() {
    try {
      // Verificar si hay un cliente seleccionado en el modal de selección
      const selectedClientId = getSelectedClientId();
      if (selectedClientId) {
        return getSelectedClientData(selectedClientId);
      }
      
      // Si no hay cliente seleccionado, usar datos del formulario
      const inputs = document.querySelectorAll('#cr-save-modal input');
      const nombre = inputs[0]?.value?.trim() || '';
      const correo = inputs[1]?.value?.trim() || '';
      const telefono = inputs[2]?.value?.trim() || '';
      const empresa = inputs[3]?.value?.trim() || '';
      
      // Validar campos requeridos
      if (!correo && !nombre) {
        return null;
      }
      
      return {
        contacto_email: correo,
        contacto_nombre: nombre,
        contacto_telefono: telefono,
        tipo_cliente: empresa ? 'Empresa' : 'Público en General',
        descripcion: empresa || 'Cliente desde cotización web'
      };
    } catch (error) {
      console.error('[getClientDataFromModal] Error:', error);
      return null;
    }
  }
  
  // Función para obtener ID del cliente seleccionado
  function getSelectedClientId() {
    try {
      console.log('[getSelectedClientId] Verificando cliente seleccionado...');
      
      // PRIORIDAD 1: Verificar el estado actual del DOM (v-client-label y v-extra)
      const clientLabel = document.getElementById('v-client-label');
      const clientHidden = document.getElementById('v-extra');
      
      console.log('[getSelectedClientId] DOM Label text:', clientLabel?.textContent);
      console.log('[getSelectedClientId] DOM Hidden value:', clientHidden?.value);
      
      // Si el label tiene contenido válido, hay cliente seleccionado
      if (clientLabel && clientLabel.textContent.trim() && 
          clientLabel.textContent.trim() !== 'Seleccionar cliente' &&
          clientLabel.textContent.trim() !== '') {
        console.log('[getSelectedClientId] ✅ Cliente encontrado en DOM label:', clientLabel.textContent.trim());
        
        // Si hay un campo hidden con ID, usarlo
        if (clientHidden && clientHidden.value && clientHidden.value.trim()) {
          console.log('[getSelectedClientId] ✅ ID encontrado en campo hidden:', clientHidden.value);
          return clientHidden.value.trim();
        }
        
        // Si no hay ID específico, pero hay nombre, considerarlo como seleccionado
        return 'selected'; // Valor que indica que hay cliente seleccionado
      }
      
      // Si el DOM está vacío, verificar si es porque no hay cliente seleccionado
      if ((!clientLabel || !clientLabel.textContent.trim()) && 
          (!clientHidden || !clientHidden.value.trim())) {
        console.log('[getSelectedClientId] ❌ DOM indica que NO hay cliente seleccionado');
        
        // Limpiar localStorage para evitar conflictos
        localStorage.removeItem('cr_selected_client');
        console.log('[getSelectedClientId] 🧹 localStorage limpiado para evitar conflictos');
        
        return null;
      }
      
      // PRIORIDAD 2: Verificar localStorage solo si DOM no es concluyente
      const storedClient = localStorage.getItem('cr_selected_client');
      if (storedClient) {
        try {
          const clientData = JSON.parse(storedClient);
          if (clientData && (clientData.id_cliente || clientData.id)) {
            console.log('[getSelectedClientId] ⚠️ Cliente encontrado en localStorage (pero DOM vacío):', clientData);
            
            // Verificar si este cliente debería estar en el DOM
            // Si localStorage tiene datos pero DOM está vacío, probablemente es datos antiguos
            console.log('[getSelectedClientId] ⚠️ Posible conflicto: localStorage tiene datos pero DOM está vacío');
            return null; // Priorizar el estado actual del DOM
          }
        } catch (e) {
          console.log('[getSelectedClientId] Error parsing localStorage client data:', e);
        }
      }
      
      // PRIORIDAD 3: Buscar en el DOM el cliente seleccionado (fallback)
      const selectedClient = document.querySelector('.client-card.selected') ||
                            document.querySelector('[data-client-selected="true"]') ||
                            document.querySelector('.cr-client-item.active');
      
      if (selectedClient) {
        const clientId = selectedClient.getAttribute('data-client-id') ||
                        selectedClient.getAttribute('data-id') ||
                        selectedClient.dataset.clientId;
        if (clientId) {
          console.log('[getSelectedClientId] ✅ Cliente encontrado en DOM selector:', clientId);
          return clientId;
        }
      }
      
      // PRIORIDAD 4: Buscar en el estado global si existe
      if (window.selectedClient && window.selectedClient.id) {
        console.log('[getSelectedClientId] ✅ Cliente encontrado en estado global:', window.selectedClient.id);
        return window.selectedClient.id;
      }
      
      console.log('[getSelectedClientId] ❌ No se encontró cliente seleccionado');
      return null;
    } catch (error) {
      console.error('[getSelectedClientId] Error:', error);
      return null;
    }
  }
  
  // Función para obtener datos del cliente seleccionado
  function getSelectedClientData(clientId) {
    try {
      // Si hay datos del cliente en el estado global
      if (window.selectedClient && window.selectedClient.id == clientId) {
        const client = window.selectedClient;
        return {
          id_cliente: clientId,
          contacto_email: client.email || client.contacto_email || '',
          contacto_nombre: client.nombre || client.contacto_nombre || '',
          contacto_telefono: client.telefono || client.contacto_telefono || '',
          tipo_cliente: client.tipo_cliente || 'Empresa',
          descripcion: client.descripcion || client.nombre || 'Cliente existente',
          requiere_factura: client.requiere_factura || false,
          datos_facturacion: client.datos_facturacion || null,
          uso_cfdi: client.uso_cfdi || 'G03'
        };
      }
      
      // Buscar en el DOM los datos del cliente
      const clientCard = document.querySelector(`[data-client-id="${clientId}"]`);
      if (clientCard) {
        return {
          id_cliente: clientId,
          contacto_email: clientCard.querySelector('.client-email')?.textContent?.trim() || '',
          contacto_nombre: clientCard.querySelector('.client-name')?.textContent?.trim() || '',
          contacto_telefono: clientCard.querySelector('.client-phone')?.textContent?.trim() || '',
          tipo_cliente: 'Empresa',
          descripcion: 'Cliente existente'
        };
      }
      
      return null;
    } catch (error) {
      console.error('[getSelectedClientData] Error:', error);
      return null;
    }
  }
  
  // Función para enviar cotización al backend
  async function sendQuotationToBackend(quotationData) {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_URL}/cotizaciones`, {
        method: 'POST',
        headers,
        body: JSON.stringify(quotationData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error del servidor');
      }
      
      const result = await response.json();
      return { success: true, ...result };
      
    } catch (error) {
      console.error('[sendQuotationToBackend] Error:', error);
      return { success: false, message: error.message };
    }
  }
  
  // Función para mostrar modal de guardado
  function showSaveModal() {
    const modal = document.getElementById('cr-save-modal');
    if (modal) {
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
    }
  }
  
  // Función para cerrar modal de guardado
  function closeSaveModal() {
    const modal = document.getElementById('cr-save-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
  }
  
  // Función para mostrar modal de confirmación
  function showConfirmSaveModal() {
    try {
      // Validar que hay productos en el carrito
      if (!state.cart || state.cart.length === 0) {
        alert('No hay productos seleccionados para guardar.');
        return;
      }
      
      // Verificar que hay un cliente seleccionado
      const selectedClientId = getSelectedClientId();
      if (!selectedClientId) {
        // Si no hay cliente seleccionado, mostrar modal de guardado para crear uno
        alert('Debe seleccionar un cliente antes de guardar la cotización. Se abrirá el modal para crear un cliente.');
        showSaveModal();
        return;
      }
      
      // Mostrar modal de confirmación
      const confirmModal = document.getElementById('cr-confirm-save-modal');
      if (confirmModal) {
        confirmModal.hidden = false;
        confirmModal.setAttribute('aria-hidden', 'false');
        
        // Bind del botón de confirmación si no está ya vinculado
        const confirmBtn = document.getElementById('cr-confirm-save-btn');
        if (confirmBtn && !confirmBtn.__bound) {
          confirmBtn.addEventListener('click', saveQuotationWithExistingClient);
          confirmBtn.__bound = true;
        }
      }
    } catch (error) {
      console.error('[showConfirmSaveModal] Error:', error);
      alert('Error al mostrar el modal de confirmación.');
    }
  }
  
  // Función para cerrar modal de confirmación
  function closeConfirmSaveModal() {
    const confirmModal = document.getElementById('cr-confirm-save-modal');
    if (confirmModal) {
      confirmModal.hidden = true;
      confirmModal.setAttribute('aria-hidden', 'true');
    }
  }
  
  // Función para guardar cotización con cliente existente
  async function saveQuotationWithExistingClient() {
    try {
      console.log('[saveQuotationWithExistingClient] Iniciando guardado con cliente existente...');
      
      // Sincronizar estado antes de guardar
      syncStateFromDOM();
      
      // Obtener datos del cliente existente seleccionado
      const clientData = getExistingClientData();
      if (!clientData) {
        alert('Error al obtener los datos del cliente seleccionado.');
        return;
      }
      
      // Recopilar datos de la cotización
      const quotationData = collectQuotationData();
      if (!quotationData) {
        alert('Error al recopilar los datos de la cotización.');
        return;
      }
      
      // Combinar datos del cliente con la cotización
      const completeData = {
        ...quotationData,
        ...clientData
      };
      
      console.log('[saveQuotationWithExistingClient] Datos completos:', completeData);
      
      // Cerrar modal de confirmación
      closeConfirmSaveModal();
      
      // Enviar al backend
      const result = await sendQuotationToBackend(completeData);
      
      if (result.success) {
        alert(`Cotización guardada exitosamente. Número: ${result.numero_cotizacion}`);
        // Opcional: limpiar carrito o redirigir
      } else {
        alert(`Error al guardar: ${result.message}`);
      }
      
    } catch (error) {
      console.error('[saveQuotationWithExistingClient] Error:', error);
      alert('Error al guardar la cotización.');
    }
  }

  // Función principal para generar cotización final (no borrador)
  async function generateQuotation() {
    try {
      console.log('[generateQuotation] Iniciando generación/actualización de cotización...');
      
      // Verificar si estamos en modo edición
      if (window.modoEdicion && window.cotizacionEditandoId) {
        console.log('[generateQuotation] MODO EDICIÓN: Actualizando cotización existente');
        await actualizarCotizacionExistente();
        return;
      }
      
      console.log('[generateQuotation] MODO CREACIÓN: Generando nueva cotización');
      
      // Validar que hay productos en el carrito
      if (!state.cart || state.cart.length === 0) {
        alert('No hay productos seleccionados para generar la cotización.');
        return;
      }

      // Sincronizar estado antes de procesar
      syncStateFromDOM();
      
      // Verificar si hay un cliente seleccionado
      const selectedClientId = getSelectedClientId();
      console.log('[generateQuotation] Cliente seleccionado ID:', selectedClientId);
      
      // Debug adicional: verificar elementos DOM
      const clientLabel = document.getElementById('v-client-label');
      const clientHidden = document.getElementById('v-extra');
      console.log('[generateQuotation] Debug DOM - Label:', clientLabel?.textContent);
      console.log('[generateQuotation] Debug DOM - Hidden:', clientHidden?.value);
      console.log('[generateQuotation] Debug localStorage:', localStorage.getItem('cr_selected_client'));
      
      if (selectedClientId) {
        console.log('[generateQuotation] CASO 1: Cliente existente detectado');
        // CASO 1: Cliente existente seleccionado
        await generateQuotationWithExistingClient();
      } else {
        console.log('[generateQuotation] CASO 2: No hay cliente - crear nuevo');
        // CASO 2: No hay cliente seleccionado - crear cliente nuevo
        await generateQuotationWithNewClient();
      }
      
    } catch (error) {
      console.error('[generateQuotation] Error:', error);
      alert('Error al generar la cotización.');
    }
  }

  // Función para actualizar cotización existente
  async function actualizarCotizacionExistente() {
    try {
      console.log('[actualizarCotizacionExistente] Actualizando cotización ID:', window.cotizacionEditandoId);
      
      // Recopilar datos del formulario usando collectQuotationData
      const datosActualizados = collectQuotationData();
      console.log('[actualizarCotizacionExistente] Datos recopilados:', datosActualizados);
      
      // Agregar campos adicionales para actualización
      datosActualizados.motivo_cambio = 'Actualización desde formulario de edición';
      datosActualizados.modificado_por = window.usuarioActual?.id || 3;
      
      // Hacer la petición PUT al backend
      console.log('[actualizarCotizacionExistente] Enviando PUT a:', `http://localhost:3001/api/cotizaciones/${window.cotizacionEditandoId}`);
      console.log('[actualizarCotizacionExistente] Body:', JSON.stringify(datosActualizados, null, 2));
      
      // Obtener token de autenticación
      const token = localStorage.getItem('token');
      console.log('[actualizarCotizacionExistente] Token encontrado:', token ? 'Sí' : 'No');
      
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Agregar token si existe
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`http://localhost:3001/api/cotizaciones/${window.cotizacionEditandoId}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(datosActualizados)
      });
      
      console.log('[actualizarCotizacionExistente] Response status:', response.status);
      
      if (!response.ok) {
        let errorMsg = 'Error al actualizar la cotización';
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.detalle || errorMsg;
          console.error('[actualizarCotizacionExistente] Error del servidor:', errorData);
        } catch (e) {
          const errorText = await response.text();
          console.error('[actualizarCotizacionExistente] Error text:', errorText);
          errorMsg = errorText || errorMsg;
        }
        throw new Error(errorMsg);
      }
      
      const resultado = await response.json();
      console.log('[actualizarCotizacionExistente] Cotización actualizada exitosamente:', resultado);
      
      // Mantener el ID guardado para que el historial funcione
      if (resultado.id_cotizacion) {
        window.cotizacionEditandoId = resultado.id_cotizacion;
        window.selectedQuotationForCloning = resultado;
        console.log('[actualizarCotizacionExistente] ID guardado para historial:', resultado.id_cotizacion);
      }
      
      // Mostrar notificación de éxito
      showNotification(`✅ Cotización ${resultado.numero_cotizacion} actualizada exitosamente`, 'success');
      
      // NO limpiar sessionStorage ni redirigir - mantener en la página de edición
      // sessionStorage.removeItem('cotizacionParaEditar');
      
      // NO redirigir - el usuario puede seguir editando o ver el historial
      // setTimeout(() => {
      //   window.location.href = 'cotizaciones.html';
      // }, 2000);
      
    } catch (error) {
      console.error('[actualizarCotizacionExistente] Error:', error);
      alert(`Error al actualizar la cotización: ${error.message}`);
    }
  }

  // CASO 1: Generar cotización con cliente existente
  async function generateQuotationWithExistingClient() {
    try {
      console.log('[generateQuotationWithExistingClient] Generando cotización con cliente existente...');
      
      // Obtener datos del cliente existente
      const clientData = getExistingClientData();
      if (!clientData) {
        alert('Error al obtener los datos del cliente seleccionado.');
        return;
      }
      
      // Recopilar datos de la cotización
      const quotationData = collectQuotationData();
      if (!quotationData) {
        alert('Error al recopilar los datos de la cotización.');
        return;
      }
      
      // Configurar como cotización APROBADA (no borrador)
      quotationData.estado = 'Aprobada';
      quotationData.fecha_aprobacion = new Date().toISOString();
      
      // Combinar datos
      const completeData = {
        ...quotationData,
        ...clientData
      };
      
      console.log('[generateQuotationWithExistingClient] Datos completos:', completeData);
      
      // Enviar al backend
      const result = await sendQuotationToBackend(completeData);
      
      if (result.success) {
        // Mostrar modal de éxito con opción de pasar a contrato
        showQuotationSuccessModal(result, clientData);
      } else {
        alert(`Error al generar la cotización: ${result.message}`);
      }
      
    } catch (error) {
      console.error('[generateQuotationWithExistingClient] Error:', error);
      alert('Error al generar la cotización con cliente existente.');
    }
  }

  // CASO 2: Generar cotización con cliente nuevo
  async function generateQuotationWithNewClient() {
    try {
      console.log('[generateQuotationWithNewClient] Generando cotización con cliente nuevo...');
      
      // Mostrar modal para capturar datos del cliente
      showNewClientModalForQuotation();
      
    } catch (error) {
      console.error('[generateQuotationWithNewClient] Error:', error);
      alert('Error al iniciar proceso de cotización con cliente nuevo.');
    }
  }

  // Función para mostrar modal de cliente nuevo específico para cotización
  function showNewClientModalForQuotation() {
    const modal = document.getElementById('cr-save-client-modal');
    if (modal) {
      // Limpiar el formulario
      const form = modal.querySelector('form');
      if (form) {
        form.reset();
      }
      
      // AUTORRELLENAR con datos de contacto antes de mostrar el modal
      prefillClientModalFromContact();
      
      // Cambiar el texto del botón para indicar que es para cotización
      const saveBtn = modal.querySelector('[data-save-client]');
      if (saveBtn) {
        saveBtn.textContent = 'Crear Cliente y Generar Cotización';
        // Cambiar el handler para que genere cotización después de crear cliente
        saveBtn.onclick = handleCreateClientAndGenerateQuotation;
      }
      
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      
      // Enfocar el primer campo vacío o el nombre si ya está lleno
      const firstEmptyInput = modal.querySelector('input[type="text"]:not([value]), input[type="email"]:not([value])') ||
                             modal.querySelector('#cr-cliente-nombre');
      if (firstEmptyInput) {
        setTimeout(() => firstEmptyInput.focus(), 100);
      }
    }
  }

  // Función para autorrellenar modal de cliente con datos de contacto
  function prefillClientModalFromContact() {
    try {
      console.log('[prefillClientModalFromContact] Autorrellenando modal con datos de contacto...');
      
      // Obtener datos de la sección de contacto
      const contactName = document.getElementById('cr-contact-name')?.value?.trim();
      const contactPhone = document.getElementById('cr-contact-phone')?.value?.trim();
      const contactEmail = document.getElementById('cr-contact-email')?.value?.trim();
      const contactMobile = document.getElementById('cr-contact-mobile')?.value?.trim();
      const contactCompany = document.getElementById('cr-contact-company')?.value?.trim();
      const contactAttn = document.getElementById('cr-contact-attn')?.value?.trim();
      const contactNotes = document.getElementById('cr-contact-notes')?.value?.trim();
      
      // Datos de dirección si están disponibles
      const contactAddress = document.getElementById('cr-contact-address')?.value?.trim();
      const contactCity = document.getElementById('cr-contact-city')?.value?.trim() || 
                         document.getElementById('cr-contact-municipio')?.value?.trim();
      const contactState = document.getElementById('cr-contact-state')?.value?.trim();
      const contactZip = document.getElementById('cr-contact-zip')?.value?.trim();
      const contactCountry = document.getElementById('cr-contact-country')?.value?.trim();
      
      console.log('[prefillClientModalFromContact] Datos encontrados:', {
        contactName, contactPhone, contactEmail, contactCompany, contactCity
      });
      
      // Llenar campos básicos del modal de cliente
      if (contactName) {
        const nameField = document.getElementById('cr-cliente-nombre');
        if (nameField) {
          nameField.value = contactName;
          console.log('[prefillClientModalFromContact] ✅ Nombre llenado:', contactName);
        }
      }
      
      if (contactEmail) {
        const emailField = document.getElementById('cr-cliente-email');
        if (emailField) {
          emailField.value = contactEmail;
          console.log('[prefillClientModalFromContact] ✅ Email llenado:', contactEmail);
        }
      }
      
      if (contactPhone) {
        const phoneField = document.getElementById('cr-cliente-telefono');
        if (phoneField) {
          phoneField.value = contactPhone;
          console.log('[prefillClientModalFromContact] ✅ Teléfono llenado:', contactPhone);
        }
      }
      
      if (contactMobile) {
        const mobileField = document.getElementById('cr-cliente-celular');
        if (mobileField) {
          mobileField.value = contactMobile;
          console.log('[prefillClientModalFromContact] ✅ Celular llenado:', contactMobile);
        }
      }
      
      if (contactCompany) {
        const companyField = document.getElementById('cr-cliente-empresa');
        if (companyField) {
          companyField.value = contactCompany;
          console.log('[prefillClientModalFromContact] ✅ Empresa llenada:', contactCompany);
        }
      }
      
      // Llenar datos de facturación si están disponibles
      if (contactCompany) {
        const razonSocialField = document.getElementById('cr-cliente-razon-social');
        if (razonSocialField && !razonSocialField.value) {
          razonSocialField.value = contactCompany;
          console.log('[prefillClientModalFromContact] ✅ Razón social llenada:', contactCompany);
        }
      }
      
      if (contactAddress) {
        const addressField = document.getElementById('cr-cliente-domicilio');
        if (addressField) {
          addressField.value = contactAddress;
          console.log('[prefillClientModalFromContact] ✅ Domicilio llenado:', contactAddress);
        }
      }
      
      if (contactCity) {
        const cityField = document.getElementById('cr-cliente-ciudad');
        if (cityField) {
          cityField.value = contactCity;
          console.log('[prefillClientModalFromContact] ✅ Ciudad llenada:', contactCity);
        }
      }
      
      if (contactZip) {
        const zipField = document.getElementById('cr-cliente-codigo-postal');
        if (zipField) {
          zipField.value = contactZip;
          console.log('[prefillClientModalFromContact] ✅ Código postal llenado:', contactZip);
        }
      }
      
      if (contactNotes) {
        const notesField = document.getElementById('cr-cliente-notas');
        if (notesField) {
          notesField.value = contactNotes;
          console.log('[prefillClientModalFromContent] ✅ Notas llenadas:', contactNotes);
        }
      }
      
      // Si hay persona de atención diferente al nombre, agregarla a las notas
      if (contactAttn && contactAttn !== contactName) {
        const notesField = document.getElementById('cr-cliente-notas');
        if (notesField) {
          const existingNotes = notesField.value;
          const attnNote = `Persona de atención: ${contactAttn}`;
          notesField.value = existingNotes ? `${existingNotes}\n${attnNote}` : attnNote;
          console.log('[prefillClientModalFromContact] ✅ Persona de atención agregada a notas');
        }
      }
      
      console.log('[prefillClientModalFromContact] ✅ Modal autorrellenado exitosamente');
      
    } catch (error) {
      console.error('[prefillClientModalFromContact] Error:', error);
      // No mostrar error al usuario, solo continuar sin autorrellenar
    }
  }

  // Handler para crear cliente y generar cotización
  async function handleCreateClientAndGenerateQuotation() {
    try {
      console.log('[handleCreateClientAndGenerateQuotation] Creando cliente y generando cotización...');
      
      // Obtener datos del formulario del cliente
      const clientFormData = getClientFormData();
      if (!clientFormData) {
        alert('Por favor complete todos los campos requeridos del cliente.');
        return;
      }
      
      // Crear el cliente primero
      const clientResult = await createNewClient(clientFormData);
      if (!clientResult.success) {
        alert(`Error al crear el cliente: ${clientResult.message}`);
        return;
      }
      
      console.log('[handleCreateClientAndGenerateQuotation] Cliente creado:', clientResult.cliente);
      
      // Cerrar modal de cliente
      const modal = document.getElementById('cr-save-client-modal');
      if (modal) {
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
      }
      
      // Recopilar datos de la cotización
      const quotationData = collectQuotationData();
      if (!quotationData) {
        alert('Error al recopilar los datos de la cotización.');
        return;
      }
      
      // Configurar como cotización APROBADA
      quotationData.estado = 'Aprobada';
      quotationData.fecha_aprobacion = new Date().toISOString();
      
      // Combinar con datos del cliente creado
      const completeData = {
        ...quotationData,
        id_cliente: clientResult.cliente.id_cliente,
        contacto_nombre: clientResult.cliente.nombre,
        contacto_email: clientResult.cliente.email,
        contacto_telefono: clientResult.cliente.telefono || clientResult.cliente.celular,
        tipo_cliente: clientResult.cliente.empresa ? 'Empresa' : 'Público en General'
      };
      
      console.log('[handleCreateClientAndGenerateQuotation] Datos completos para cotización:', completeData);
      
      // Enviar cotización al backend
      const quotationResult = await sendQuotationToBackend(completeData);
      
      if (quotationResult.success) {
        // Mostrar modal de éxito
        showQuotationSuccessModal(quotationResult, clientResult.cliente);
      } else {
        alert(`Cliente creado exitosamente, pero error al generar cotización: ${quotationResult.message}`);
      }
      
    } catch (error) {
      console.error('[handleCreateClientAndGenerateQuotation] Error:', error);
      alert('Error al crear cliente y generar cotización.');
    }
  }

  // Función para mostrar modal de éxito con datos de cotización
  function showQuotationSuccessModal(quotationResult, clientData) {
    // Crear modal dinámicamente si no existe
    let modal = document.getElementById('quotation-success-modal');
    if (!modal) {
      modal = createQuotationSuccessModal();
      document.body.appendChild(modal);
    }
    
    // Guardar ID de la cotización creada para que el historial funcione
    if (quotationResult && quotationResult.id_cotizacion) {
      window.cotizacionEditandoId = quotationResult.id_cotizacion;
      window.selectedQuotationForCloning = quotationResult;
      console.log('[MODAL] ID de cotización guardado para historial:', quotationResult.id_cotizacion);
    }
    
    // Llenar datos en el modal
    populateSuccessModal(modal, quotationResult, clientData);
    
    // Mostrar modal
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
  }

  // Crear modal de éxito para cotización
  function createQuotationSuccessModal() {
    const modal = document.createElement('div');
    modal.id = 'quotation-success-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'quotation-success-title');
    modal.setAttribute('aria-hidden', 'true');
    modal.hidden = true;
    
    // Estilos inline para evitar conflictos con CSS existente
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
    `;
    
    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 12px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        max-width: 600px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        position: relative;
      ">
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 24px 0 24px;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 24px;
        ">
          <h3 id="quotation-success-title" style="
            margin: 0;
            font-size: 20px;
            font-weight: 600;
            color: #111827;
            display: flex;
            align-items: center;
          ">
            <i class="fa-solid fa-check-circle" style="color: #10b981; margin-right: 12px; font-size: 24px;"></i>
            Cotización Generada Exitosamente
          </h3>
          <button type="button" id="close-modal-x" style="
            background: none;
            border: none;
            font-size: 24px;
            color: #6b7280;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: color 0.2s;
          " onmouseover="this.style.color='#374151'" onmouseout="this.style.color='#6b7280'">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
        
        <div style="padding: 0 24px 24px 24px;">
          <div style="
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 1px solid #0ea5e9;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
          ">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">Número de Cotización:</div>
                <div id="success-quotation-number" style="font-size: 20px; color: #0ea5e9; font-weight: bold;">-</div>
              </div>
              <div>
                <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">Estado:</div>
                <div style="color: #10b981; font-weight: bold; font-size: 16px;">✅ Aprobada</div>
              </div>
              <div>
                <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">Cliente:</div>
                <div id="success-client-name" style="font-weight: 500;">-</div>
              </div>
              <div>
                <div style="font-weight: 600; color: #374151; margin-bottom: 4px;">Total:</div>
                <div id="success-total" style="font-size: 20px; color: #059669; font-weight: bold;">-</div>
              </div>
            </div>
          </div>
          
          <div style="
            background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
            border: 1px solid #eab308;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
          ">
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
              <i class="fa-solid fa-info-circle" style="color: #eab308; margin-right: 12px; font-size: 18px;"></i>
              <div style="font-weight: 600; color: #92400e;">Información Importante</div>
            </div>
            <ul style="margin: 0; padding-left: 20px; color: #92400e; line-height: 1.6;">
              <li>La cotización ha sido guardada con estado <strong>Aprobada</strong></li>
              <li>Se ha registrado en el historial del cliente</li>
              <li>Puede proceder a generar el contrato correspondiente</li>
            </ul>
          </div>
          
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button type="button" id="close-modal-btn" style="
              background: #f3f4f6;
              border: 1px solid #d1d5db;
              color: #374151;
              padding: 12px 24px;
              border-radius: 8px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
            " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
              Cerrar
            </button>
            <button type="button" id="contract-btn" style="
              background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
              border: none;
              color: white;
              padding: 12px 24px;
              border-radius: 8px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 8px -1px rgba(0, 0, 0, 0.15)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(0, 0, 0, 0.1)'">
              <i class="fa-solid fa-file-contract" style="margin-right: 8px;"></i>
              Pasar a Contrato
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Agregar event listeners después de crear el HTML
    setTimeout(() => {
      // Botón X para cerrar
      const closeXBtn = modal.querySelector('#close-modal-x');
      if (closeXBtn) {
        closeXBtn.addEventListener('click', closeQuotationSuccessModal);
      }
      
      // Botón "Cerrar"
      const closeBtn = modal.querySelector('#close-modal-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', closeQuotationSuccessModal);
      }
      
      // Botón "Pasar a Contrato"
      const contractBtn = modal.querySelector('#contract-btn');
      if (contractBtn) {
        contractBtn.addEventListener('click', goToContract);
      }
      
      // Cerrar al hacer click en el backdrop
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          closeQuotationSuccessModal();
        }
      });
      
      // Cerrar con tecla Escape
      const handleEscape = function(e) {
        if (e.key === 'Escape' && !modal.hidden) {
          closeQuotationSuccessModal();
          document.removeEventListener('keydown', handleEscape);
        }
      };
      document.addEventListener('keydown', handleEscape);
      
    }, 0);
    
    return modal;
  }

  // Llenar datos en el modal de éxito
  function populateSuccessModal(modal, quotationResult, clientData) {
    // Número de cotización
    const numberEl = modal.querySelector('#success-quotation-number');
    if (numberEl) {
      numberEl.textContent = quotationResult.numero_cotizacion || 'N/A';
    }
    
    // Nombre del cliente
    const clientNameEl = modal.querySelector('#success-client-name');
    if (clientNameEl) {
      clientNameEl.textContent = clientData.nombre || clientData.contacto_nombre || 'N/A';
    }
    
    // Total
    const totalEl = modal.querySelector('#success-total');
    if (totalEl) {
      const total = quotationResult.total || calculateTotalWithIVA();
      totalEl.textContent = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
      }).format(total);
    }
  }

  // Cerrar modal de éxito
  function closeQuotationSuccessModal() {
    console.log('[MODAL] Cerrando modal de éxito...');
    const modal = document.getElementById('quotation-success-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      modal.style.display = 'none';
      console.log('[MODAL] Modal de éxito cerrado');
    } else {
      console.warn('[MODAL] No se encontró el modal de éxito');
    }
  }

  // Ir a contrato con datos de cotización
  function goToContract() {
    try {
      // Obtener datos de la cotización generada
      const quotationData = collectQuotationData();
      const clientData = getExistingClientData() || JSON.parse(localStorage.getItem('cr_selected_client') || '{}');
      
      // Preparar datos para el contrato
      const contractData = {
        cotizacion: quotationData,
        cliente: clientData,
        productos: state.cart,
        timestamp: new Date().toISOString()
      };
      
      // Guardar en sessionStorage para el contrato
      sessionStorage.setItem('contract_data', JSON.stringify(contractData));
      
      // Cerrar modal
      closeQuotationSuccessModal();
      
      // Abrir página de contratos
      window.open('contratos.html', '_blank');
      
    } catch (error) {
      console.error('[goToContract] Error:', error);
      alert('Error al preparar datos para el contrato.');
    }
  }

  // Función auxiliar para obtener datos del formulario de cliente
  function getClientFormData() {
    const form = document.getElementById('cr-save-client-form');
    if (!form) return null;

    // Validar campos requeridos
    const nombre = form.querySelector('#cr-cliente-nombre')?.value.trim();
    const email = form.querySelector('#cr-cliente-email')?.value.trim();
    
    if (!nombre || !email) {
      return null;
    }

    // Función auxiliar para sanitizar números (reutilizada del código existente)
    const sanitizeNumeric = (value) => {
      if (!value || value.trim() === '') return null;
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    };

    // Recopilar datos del formulario (misma lógica que handleSaveClient)
    return {
      // Datos básicos
      nombre: nombre,
      empresa: form.querySelector('#cr-cliente-empresa')?.value.trim() || null,
      telefono: form.querySelector('#cr-cliente-telefono')?.value.trim() || null,
      celular: form.querySelector('#cr-cliente-celular')?.value.trim() || null,
      email: email,
      rfc: form.querySelector('#cr-cliente-rfc')?.value.trim() || null,
      curp: form.querySelector('#cr-cliente-curp')?.value.trim() || null,
      
      // Datos de facturación
      razon_social: form.querySelector('#cr-cliente-razon-social')?.value.trim() || null,
      fact_rfc: form.querySelector('#cr-cliente-fact-rfc')?.value.trim() || null,
      regimen_fiscal: form.querySelector('#cr-cliente-regimen-fiscal')?.value || null,
      domicilio: form.querySelector('#cr-cliente-domicilio')?.value.trim() || null,
      ciudad: form.querySelector('#cr-cliente-ciudad')?.value.trim() || null,
      codigo_postal: form.querySelector('#cr-cliente-codigo-postal')?.value.trim() || null,
      
      // Información financiera
      limite_credito: sanitizeNumeric(form.querySelector('#cr-cliente-limite-credito')?.value),
      terminos_pago: sanitizeNumeric(form.querySelector('#cr-cliente-terminos-pago')?.value),
      metodo_pago: form.querySelector('#cr-cliente-metodo-pago')?.value || 'Transferencia',
      segmento: form.querySelector('#cr-cliente-segmento')?.value || 'Individual',
      
      // Notas
      notas_generales: form.querySelector('#cr-cliente-notas')?.value.trim() || null,
      
      // Campos por defecto
      estado: 'Activo',
      tipo_cliente: 'Individual',
      pais: 'MÉXICO'
    };
  }

  // Función auxiliar para crear nuevo cliente (reutiliza saveCliente existente)
  async function createNewClient(clientFormData) {
    try {
      const cliente = await saveCliente(clientFormData);
      return {
        success: true,
        cliente: cliente
      };
    } catch (error) {
      console.error('[createNewClient] Error:', error);
      return {
        success: false,
        message: error.message || 'Error al crear el cliente'
      };
    }
  }

  // Exponer funciones globalmente para usarlas en el HTML
  window.showSection = showSection;
  window.addToCart = addToCart;
  window.removeFromCart = removeFromCart;
  window.updateCartQuantity = updateCartQuantity;
  window.clearCart = clearCart;
  window.completeShippingStep = completeShippingStep;
  window.saveQuotationFromMenu = saveQuotationFromMenu;
  window.saveQuotationWithClientData = saveQuotationWithClientData;
  window.showConfirmSaveModal = showConfirmSaveModal;
  window.closeConfirmSaveModal = closeConfirmSaveModal;
  window.saveQuotationWithExistingClient = saveQuotationWithExistingClient;
  window.generateQuotation = generateQuotation;
  window.closeQuotationSuccessModal = closeQuotationSuccessModal;
  window.goToContract = goToContract;
  window.actualizarCotizacionRenta = actualizarCotizacionExistente; // ✅ Exponer función de actualización
  
  // Función de debug temporal para verificar estado del cliente
  window.debugClientState = function() {
    console.log('=== DEBUG CLIENT STATE ===');
    const clientLabel = document.getElementById('v-client-label');
    const clientHidden = document.getElementById('v-extra');
    const storedClient = localStorage.getItem('cr_selected_client');
    
    console.log('Label element:', clientLabel);
    console.log('Label text:', clientLabel?.textContent);
    console.log('Hidden element:', clientHidden);
    console.log('Hidden value:', clientHidden?.value);
    console.log('LocalStorage client:', storedClient);
    
    if (storedClient) {
      try {
        console.log('Parsed localStorage:', JSON.parse(storedClient));
      } catch (e) {
        console.log('Error parsing localStorage:', e);
      }
    }
    
    const selectedId = getSelectedClientId();
    console.log('getSelectedClientId() result:', selectedId);
    console.log('=== END DEBUG ===');
  };

  // ============================================================================
  // FUNCIONALIDAD DE EDICIÓN DE COTIZACIONES
  // ============================================================================

  // Función para detectar modo edición y cargar datos
  window.detectarModoEdicion = function() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const editId = urlParams.get('edit');
      
      if (editId) {
        console.log('[detectarModoEdicion] Modo edición detectado, ID:', editId);
        window.modoEdicion = true;
        window.cotizacionEditandoId = editId;
        
        // Cargar datos desde sessionStorage
        const cotizacionData = sessionStorage.getItem('cotizacionParaEditar');
        if (cotizacionData) {
          try {
            const cotizacion = JSON.parse(cotizacionData);
            console.log('[detectarModoEdicion] Datos de cotización encontrados:', cotizacion);
            
            // Guardar datos para clonación (disponible cuando se abra el modal de clonar)
            window.selectedQuotationForCloning = cotizacion;
            console.log('[detectarModoEdicion] Datos guardados para clonación');
            
            // Cargar datos en el formulario
            setTimeout(() => {
              cargarDatosEnFormularioRenta(cotizacion);
              actualizarTituloEdicion(cotizacion);
            }, 500);
            
          } catch (e) {
            console.error('[detectarModoEdicion] Error parsing cotización data:', e);
          }
        }
      } else {
        window.modoEdicion = false;
        window.cotizacionEditandoId = null;
        window.selectedQuotationForCloning = null;
      }
    } catch (error) {
      console.error('[detectarModoEdicion] Error:', error);
    }
  };

  // Función para cargar datos de cotización en el formulario de renta
  window.cargarDatosEnFormularioRenta = function(cotizacion) {
    try {
      console.log('[cargarDatosEnFormularioRenta] Cargando datos:', cotizacion);
      
      // Log detallado de datos del cliente (vienen del JOIN con tabla clientes)
      console.log('[cargarDatosEnFormularioRenta] Datos del cliente:', {
        cliente_nombre: cotizacion.cliente_nombre,
        cliente_telefono: cotizacion.cliente_telefono,
        cliente_celular: cotizacion.cliente_celular,
        cliente_email: cotizacion.cliente_email,
        cliente_empresa: cotizacion.cliente_empresa,
        cliente_representante: cotizacion.cliente_representante,
        cliente_atencion: cotizacion.cliente_atencion,
        cliente_direccion: cotizacion.cliente_direccion,
        cliente_cp: cotizacion.cliente_cp,
        cliente_estado: cotizacion.cliente_estado,
        cliente_municipio: cotizacion.cliente_municipio,
        cliente_pais: cotizacion.cliente_pais,
        cliente_tipo_persona: cotizacion.cliente_tipo_persona,
        cliente_descripcion: cotizacion.cliente_descripcion
      });
      
      // Log detallado de datos de entrega
      console.log('[cargarDatosEnFormularioRenta] Datos de entrega:', {
        direccion_entrega: cotizacion.direccion_entrega,
        entrega_lote: cotizacion.entrega_lote,
        hora_entrega_solicitada: cotizacion.hora_entrega_solicitada,
        costo_envio: cotizacion.costo_envio,
        requiere_entrega: cotizacion.requiere_entrega
      });
      
      // Datos de contacto desde la tabla clientes (JOIN)
      setInputValueSafe('cr-contact-name', cotizacion.cliente_nombre || cotizacion.contacto_nombre);
      setInputValueSafe('cr-contact-phone', cotizacion.cliente_telefono || cotizacion.contacto_telefono);
      setInputValueSafe('cr-contact-email', cotizacion.cliente_email || cotizacion.contacto_email);
      setInputValueSafe('cr-contact-attn', cotizacion.cliente_atencion);
      setInputValueSafe('cr-contact-company', cotizacion.cliente_empresa);
      setInputValueSafe('cr-contact-mobile', cotizacion.cliente_celular);
      setInputValueSafe('cr-contact-zip', cotizacion.cliente_cp);
      setInputValueSafe('cr-contact-country', cotizacion.cliente_pais || 'México');
      setInputValueSafe('cr-contact-state', cotizacion.cliente_estado);
      setInputValueSafe('cr-contact-municipio', cotizacion.cliente_municipio);
      setInputValueSafe('cr-contact-notes', cotizacion.cliente_descripcion);
      
      // Condiciones (dropdown) - desde tipo de persona del cliente
      const condicionSelect = document.getElementById('cr-contact-condicion');
      if (condicionSelect && cotizacion.cliente_tipo_persona) {
        // Mapear tipo de cliente a condición
        if (cotizacion.cliente_tipo_persona === 'EMPRESA') {
          condicionSelect.value = 'Persona Moral';
        } else if (cotizacion.cliente_tipo_persona === 'PERSONA') {
          condicionSelect.value = 'Persona Física';
        }
      }
      
      // Datos de entrega completos
      setInputValueSafe('cr-delivery-address', cotizacion.direccion_entrega);
      setInputValueSafe('cr-delivery-lote', cotizacion.entrega_lote);
      setInputValueSafe('cr-delivery-time', cotizacion.hora_entrega_solicitada);
      setInputValueSafe('cr-delivery-street', cotizacion.entrega_calle);
      setInputValueSafe('cr-delivery-ext', cotizacion.entrega_numero_ext);
      setInputValueSafe('cr-delivery-int', cotizacion.entrega_numero_int);
      setInputValueSafe('cr-delivery-colony', cotizacion.entrega_colonia);
      setInputValueSafe('cr-delivery-zip', cotizacion.entrega_cp);
      setInputValueSafe('cr-delivery-city', cotizacion.entrega_municipio);
      setInputValueSafe('cr-delivery-state', cotizacion.entrega_estado);
      setInputValueSafe('cr-delivery-reference', cotizacion.entrega_referencia);
      setInputValueSafe('cr-delivery-distance', cotizacion.entrega_kilometros);
      setInputValueSafe('cr-delivery-cost', cotizacion.costo_envio);
      
      // Tipo de zona (dropdown)
      const zoneType = document.getElementById('cr-zone-type');
      if (zoneType && cotizacion.tipo_zona) {
        zoneType.value = cotizacion.tipo_zona;
      }
      
      // Checkbox de requiere entrega
      const needDelivery = document.getElementById('cr-need-delivery');
      if (needDelivery) {
        needDelivery.checked = cotizacion.requiere_entrega || false;
      }
      
      // Mostrar costo de envío calculado
      const deliveryCostDisplay = document.getElementById('cr-delivery-cost-display');
      if (deliveryCostDisplay && cotizacion.costo_envio) {
        deliveryCostDisplay.textContent = `$${parseFloat(cotizacion.costo_envio || 0).toFixed(2)}`;
      }
      
      // Cargar observaciones y condiciones
      setInputValueSafe('cr-observations', cotizacion.entrega_referencia || '');
      setInputValueSafe('cr-summary-conditions', cotizacion.notas || '');
      
      // Actualizar contador de observaciones
      const observationsCounter = document.getElementById('cr-observations-counter');
      if (observationsCounter && cotizacion.entrega_referencia) {
        observationsCounter.textContent = `${cotizacion.entrega_referencia.length}/500`;
      }
      
      // Inicializar estado si no existe
      if (typeof state === 'undefined') {
        window.state = {
          cart: [],
          days: cotizacion.dias_periodo || 15,
          view: 'grid',
          delivery: { 
            needed: cotizacion.requiere_entrega || false, 
            cost: parseFloat(cotizacion.costo_envio || 0) 
          },
          discount: parseFloat(cotizacion.descuento_monto || 0)
        };
      } else {
        // Actualizar estado existente
        state.days = cotizacion.dias_periodo || 15;
        state.delivery = { 
          needed: cotizacion.requiere_entrega || false, 
          cost: parseFloat(cotizacion.costo_envio || 0) 
        };
        state.discount = parseFloat(cotizacion.descuento_monto || 0);
      }
      
      // Datos del proyecto - usar los campos correctos del HTML
      const dias = cotizacion.dias_periodo || 15;
      setInputValueSafe('cr-days', dias, '15');
      
      // Fecha de inicio
      if (cotizacion.fecha_inicio) {
        try {
          const fecha = cotizacion.fecha_inicio.split('T')[0];
          setInputValueSafe('cr-date-start', fecha);
        } catch (e) {
          console.warn('Error setting fecha_inicio:', e);
        }
      }
      
      // Cargar productos en el carrito del estado
      if (cotizacion.productos_seleccionados) {
        let productos = [];
        try {
          // Si productos_seleccionados ya es un array, usarlo directamente
          if (Array.isArray(cotizacion.productos_seleccionados)) {
            productos = cotizacion.productos_seleccionados;
          } else if (typeof cotizacion.productos_seleccionados === 'string') {
            productos = JSON.parse(cotizacion.productos_seleccionados);
          }
        } catch (e) {
          console.warn('Error parsing productos_seleccionados:', e);
          productos = [];
        }
        
        console.log('[cargarDatosEnFormularioRenta] Productos a cargar:', productos);
        
        if (Array.isArray(productos) && productos.length > 0) {
          cargarProductosEnCarritoEstado(productos);
        }
      }
      
      // Cargar accesorios (con estrategia de reintentos)
      if (cotizacion.accesorios_seleccionados) {
        const cargarAccesorios = (intentos = 0, maxIntentos = 10) => {
          try {
            const accesorios = typeof cotizacion.accesorios_seleccionados === 'string' 
              ? JSON.parse(cotizacion.accesorios_seleccionados)
              : cotizacion.accesorios_seleccionados;
            
            console.log(`[cargarDatosEnFormularioRenta] 🔧 Intento ${intentos + 1}/${maxIntentos} - Accesorios a cargar:`, accesorios?.length || 0);
            
            // Verificar que el catálogo de accesorios esté disponible
            if (!state?.accessories || state.accessories.length === 0) {
              if (intentos < maxIntentos) {
                console.log(`[cargarDatosEnFormularioRenta] ⏳ Catálogo no disponible, reintentando en 300ms...`);
                setTimeout(() => cargarAccesorios(intentos + 1, maxIntentos), 300);
                return;
              } else {
                console.error('[cargarDatosEnFormularioRenta] ❌ Catálogo de accesorios no disponible después de múltiples intentos');
                return;
              }
            }
            
            if (Array.isArray(accesorios) && accesorios.length > 0) {
              // Limpiar accesorios actuales
              state.accSelected = new Set();
              state.accConfirmed = new Set();
              state.accQty = {};
              
              // Agregar accesorios al state
              accesorios.forEach(accesorio => {
                const accSku = accesorio.sku;
                const accId = accesorio.id_producto;
                const cantidad = parseInt(accesorio.cantidad) || 1;
                
                // Buscar el accesorio en state.accessories por SKU o nombre
                const existeEnAccessories = state.accessories?.find(a => {
                  // Comparar por SKU primero
                  if (accSku && a.sku) {
                    return String(a.sku).toLowerCase() === String(accSku).toLowerCase();
                  }
                  // Fallback: comparar por nombre
                  if (accesorio.nombre && a.name) {
                    return String(a.name).toLowerCase() === String(accesorio.nombre).toLowerCase();
                  }
                  return false;
                });
                
                if (existeEnAccessories) {
                  // Usar el nombre como clave (así funciona en renta)
                  const key = existeEnAccessories.name || existeEnAccessories.sku || accId;
                  state.accSelected.add(key);
                  state.accConfirmed.add(key);
                  state.accQty[key] = cantidad;
                  console.log(`[cargarDatosEnFormularioRenta] ✅ Accesorio agregado: ${accesorio.nombre} (SKU: ${accSku}) x${cantidad}`);
                } else {
                  console.warn(`[cargarDatosEnFormularioRenta] ⚠️ Accesorio no encontrado: ${accesorio.nombre} (SKU: ${accSku})`);
                }
              });
              
              console.log('[cargarDatosEnFormularioRenta] 🔧 Accesorios cargados:', {
                selected: Array.from(state.accSelected),
                confirmed: Array.from(state.accConfirmed),
                quantities: state.accQty
              });
              
              // Actualizar UI de accesorios
              setTimeout(() => {
                if (typeof renderAccessoriesSummary === 'function') {
                  renderAccessoriesSummary();
                }
                if (typeof recalcTotal === 'function') {
                  recalcTotal();
                }
                console.log('[cargarDatosEnFormularioRenta] 🎨 UI de accesorios actualizada');
              }, 500);
            }
            
          } catch (e) {
            console.error('[cargarDatosEnFormularioRenta] Error cargando accesorios:', e);
          }
        };
        
        // Iniciar carga de accesorios
        cargarAccesorios();
      }
      
      // Navegar al paso 4 (resumen) para mostrar la cotización completa
      setTimeout(() => {
        try {
          console.log('[cargarDatosEnFormularioRenta] Navegando al paso 4...');
          
          // Asegurar que el estado de días esté actualizado
          if (typeof state !== 'undefined') {
            state.days = cotizacion.dias_periodo || 15;
          }
          
          // Navegar al paso 4
          if (typeof gotoStep === 'function') {
            gotoStep(4); // Ir al paso de resumen
            console.log('[cargarDatosEnFormularioRenta] gotoStep(4) ejecutado');
          } else {
            // Fallback: mostrar sección directamente
            const sections = document.querySelectorAll('.cr-section');
            sections.forEach(section => section.hidden = true);
            const step4 = document.getElementById('cr-shipping-section');
            if (step4) {
              step4.hidden = false;
              console.log('[cargarDatosEnFormularioRenta] Sección de resumen mostrada directamente');
            }
          }
          
          // Actualizar cálculos y UI
          if (typeof recalcTotal === 'function') {
            recalcTotal();
            console.log('[cargarDatosEnFormularioRenta] recalcTotal() ejecutado');
          }
          if (typeof renderSideList === 'function') {
            renderSideList();
            console.log('[cargarDatosEnFormularioRenta] renderSideList() ejecutado');
          }
          
          // Forzar actualización del resumen de cotización
          if (typeof showQuoteSummary === 'function') {
            showQuoteSummary();
            console.log('[cargarDatosEnFormularioRenta] showQuoteSummary() ejecutado');
          }
          
          // Última actualización forzada del resumen
          setTimeout(() => {
            if (typeof forzarActualizacionResumen === 'function') {
              forzarActualizacionResumen();
              console.log('[cargarDatosEnFormularioRenta] forzarActualizacionResumen() ejecutado');
            }
          }, 500);
          
        } catch (e) {
          console.warn('Error navegando al paso 4:', e);
        }
      }, 1500);
      
      console.log('[cargarDatosEnFormularioRenta] Datos cargados exitosamente');
    } catch (error) {
      console.error('[cargarDatosEnFormularioRenta] Error:', error);
    }
  };

  // Función para cargar productos en el carrito
  window.cargarProductosEnCarrito = function(productos) {
    try {
      // Limpiar carrito actual
      const cartContainer = document.getElementById('cr-cart-items');
      if (cartContainer) {
        cartContainer.innerHTML = '';
      }
      
      // Agregar cada producto
      productos.forEach(producto => {
        const productData = {
          name: producto.descripcion || '',
          price: producto.precio || 0,
          quantity: producto.cantidad || 1
        };
        
        // Simular agregar al carrito
        if (typeof addToCart === 'function') {
          addToCart(productData);
        }
      });
      
      console.log('[cargarProductosEnCarrito] Productos cargados:', productos.length);
    } catch (error) {
      console.error('[cargarProductosEnCarrito] Error:', error);
    }
  };

  // Función específica para cargar productos en el estado del carrito
  window.cargarProductosEnCarritoEstado = function(productos) {
    try {
      console.log('[cargarProductosEnCarritoEstado] Cargando productos en estado:', productos);
      
      // Asegurar que el estado existe
      if (typeof state === 'undefined') {
        console.warn('[cargarProductosEnCarritoEstado] Estado no definido, creando estado básico');
        window.state = {
          cart: [],
          days: 15,
          view: 'grid',
          delivery: { needed: false, cost: 0 },
          discount: 0
        };
      }
      
      // Asegurar propiedades del estado
      if (!state.cart) state.cart = [];
      if (!state.days) state.days = 15;
      if (!state.delivery) state.delivery = { needed: false, cost: 0 };
      if (!state.discount) state.discount = 0;
      if (!state.products) state.products = [];
      
      // Limpiar carrito actual en el estado
      state.cart = [];
      
      // Agregar cada producto directamente al estado
      productos.forEach(producto => {
        const productData = {
          sku: producto.sku || producto.id_producto || '',
          name: producto.nombre || producto.descripcion || '',
          price: parseFloat(producto.precio_unitario || producto.precio || 0),
          qty: parseInt(producto.cantidad || 1), // Usar 'qty' en lugar de 'quantity'
          quantity: parseInt(producto.cantidad || 1), // Mantener ambos para compatibilidad
          id: producto.id_producto || producto.sku || '',
          category: producto.categoria || '',
          stock: producto.stock || 999
        };
        
        console.log('[cargarProductosEnCarritoEstado] Agregando producto:', productData);
        
        // Agregar al carrito
        state.cart.push(productData);
        
        // También agregar a products si no existe
        const existingProduct = state.products.find(p => p.id === productData.id);
        if (!existingProduct) {
          state.products.push(productData);
        }
      });
      
      console.log('[cargarProductosEnCarritoEstado] Estado del carrito después de cargar:', state.cart);
      
      // Forzar actualización de la UI con múltiples intentos
      const actualizarUI = () => {
        try {
          console.log('[cargarProductosEnCarritoEstado] Actualizando UI...');
          
          // Actualizar días en el estado
          const diasInput = document.getElementById('cr-days');
          if (diasInput) {
            const diasValue = state.days || 15;
            diasInput.value = diasValue;
            console.log('[cargarProductosEnCarritoEstado] Días actualizados en input:', diasValue);
          }
          
          // Llamar funciones de renderizado
          if (typeof renderCart === 'function') {
            renderCart();
            console.log('[cargarProductosEnCarritoEstado] renderCart() ejecutado');
          }
          
          if (typeof renderSideList === 'function') {
            renderSideList();
            console.log('[cargarProductosEnCarritoEstado] renderSideList() ejecutado');
          }
          
          if (typeof recalcTotal === 'function') {
            recalcTotal();
            console.log('[cargarProductosEnCarritoEstado] recalcTotal() ejecutado');
          }
          
          // Forzar actualización del resumen financiero
          if (typeof updateFinancialSummary === 'function') {
            updateFinancialSummary();
          }
          
          // Actualizar contadores
          if (typeof updateFoundCount === 'function') {
            updateFoundCount();
          }
          
          // Forzar actualización del resumen
          if (typeof forzarActualizacionResumen === 'function') {
            forzarActualizacionResumen();
          }
          
        } catch (e) {
          console.warn('Error actualizando UI del carrito:', e);
        }
      };
      
      // Ejecutar actualización inmediatamente y después de un delay
      actualizarUI();
      setTimeout(actualizarUI, 200);
      setTimeout(actualizarUI, 500);
      setTimeout(() => {
        // Última actualización forzada
        if (typeof forzarActualizacionResumen === 'function') {
          forzarActualizacionResumen();
        }
      }, 1000);
      
      console.log('[cargarProductosEnCarritoEstado] Productos cargados exitosamente:', productos.length);
    } catch (error) {
      console.error('[cargarProductosEnCarritoEstado] Error:', error);
    }
  };

  // Función para actualizar título en modo edición con indicadores visuales
  window.actualizarTituloEdicion = function(cotizacion) {
    try {
      // 1. Cambiar el título principal
      const pageTitle = document.querySelector('h1, .page-title, .main-title, .cr-title');
      if (pageTitle && cotizacion.numero_cotizacion) {
        pageTitle.innerHTML = `<i class="fa-solid fa-edit"></i> Editando Cotización: ${cotizacion.numero_cotizacion}`;
        pageTitle.style.color = '#f39c12'; // Color naranja para indicar edición
        console.log('[actualizarTituloEdicion] Título actualizado');
      }
      
      // 2. Cambiar el botón "Generar Cotización" por "Actualizar Cotización"
      const generateBtn = document.querySelector('[onclick="generateQuotation()"]');
      if (generateBtn) {
        generateBtn.innerHTML = `
          <i class="fa-solid fa-sync-alt"></i>
          <span>Actualizar Cotización</span>
        `;
        
        // Cambiar el onclick para que llame a la función de actualización
        generateBtn.removeAttribute('onclick');
        generateBtn.addEventListener('click', async function(e) {
          e.preventDefault();
          console.log('[Botón Actualizar Renta] Click detectado');
          
          if (window.actualizarCotizacionRenta) {
            try {
              await window.actualizarCotizacionRenta();
            } catch (error) {
              console.error('[Botón Actualizar Renta] Error:', error);
            }
          } else {
            console.error('[Botón Actualizar Renta] Función actualizarCotizacionRenta no disponible');
            alert('Error: Función de actualización no disponible');
          }
        });
        
        // Cambiar color del botón para indicar edición
        generateBtn.style.background = 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)';
        generateBtn.style.color = 'white';
        
        console.log('[actualizarTituloEdicion] Botón actualizado');
      }
      
      // 3. Cambiar texto del botón de guardar en el menú lateral (si existe)
      const btnGuardar = document.querySelector('[data-action="guardar"]');
      if (btnGuardar) {
        btnGuardar.innerHTML = '<i class="fa-solid fa-save"></i> Actualizar Cotización';
      }
      
      // 4. Agregar badge de "MODO EDICIÓN" visible
      const header = document.querySelector('.cr-header');
      if (header && !document.getElementById('modo-edicion-badge')) {
        const badge = document.createElement('div');
        badge.id = 'modo-edicion-badge';
        badge.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #f39c12;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 14px;
          z-index: 9999;
          box-shadow: 0 4px 12px rgba(243, 156, 18, 0.4);
          animation: pulse 2s infinite;
        `;
        badge.innerHTML = `<i class="fa-solid fa-edit"></i> MODO EDICIÓN: ${cotizacion.numero_cotizacion}`;
        document.body.appendChild(badge);
        
        // Agregar animación de pulso
        if (!document.getElementById('pulse-animation-style')) {
          const style = document.createElement('style');
          style.id = 'pulse-animation-style';
          style.textContent = `
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.05); }
            }
          `;
          document.head.appendChild(style);
        }
      }
      
    } catch (error) {
      console.error('[actualizarTituloEdicion] Error:', error);
    }
  };

  // Función auxiliar para asignar valores seguros a inputs
  window.setInputValueSafe = function(elementId, value, defaultValue = '') {
    try {
      const element = document.getElementById(elementId);
      if (element) {
        const safeValue = (value !== null && value !== undefined && value !== 'undefined') ? value : defaultValue;
        element.value = safeValue;
        console.log(`[setInputValueSafe] ${elementId}: "${safeValue}"`);
      }
    } catch (e) {
      console.warn(`[setInputValueSafe] Error setting ${elementId}:`, e);
    }
  };

  // Función para forzar actualización del resumen de cotización
  window.forzarActualizacionResumen = function() {
    try {
      console.log('[forzarActualizacionResumen] Iniciando actualización forzada...');
      
      // Verificar estado del carrito
      if (typeof state !== 'undefined' && state.cart) {
        console.log('[forzarActualizacionResumen] Productos en carrito:', state.cart.length);
        console.log('[forzarActualizacionResumen] Carrito:', state.cart);
      }
      
      // Actualizar tabla de resumen de cotización (usar el ID correcto)
      const resumenTabla = document.getElementById('cr-summary-rows');
      if (resumenTabla && typeof state !== 'undefined' && state.cart) {
        console.log('[forzarActualizacionResumen] Actualizando tabla de resumen...');
        
        resumenTabla.innerHTML = '';
        
        state.cart.forEach((item, index) => {
          const row = document.createElement('tr');
          const cantidad = item.qty || item.quantity || 1;
          const subtotal = cantidad * (item.price || 0);
          
          row.innerHTML = `
            <td>
              <button class="cr-btn cr-btn--sm cr-btn--danger" onclick="removeFromCart(${index})" style="padding:4px 8px;">
                <i class="fa-solid fa-times"></i>
              </button>
            </td>
            <td>${index + 1}</td>
            <td>-</td>
            <td>${item.sku || '-'}</td>
            <td>${item.name || 'Producto'}</td>
            <td>${cantidad}</td>
            <td>$${(item.price || 0).toFixed(2)}</td>
            <td>0%</td>
            <td>$${subtotal.toFixed(2)}</td>
          `;
          resumenTabla.appendChild(row);
        });
        
        console.log('[forzarActualizacionResumen] Tabla actualizada con', state.cart.length, 'productos');
        
        // Mostrar la tabla de resumen
        const summaryCard = document.getElementById('cr-quote-summary-card');
        if (summaryCard) {
          summaryCard.style.display = 'block';
        }
        
        // Mostrar el resumen financiero
        const financialSummary = document.getElementById('cr-financial-summary');
        if (financialSummary) {
          financialSummary.style.display = 'block';
        }
      }
      
      // Actualizar resumen financiero manualmente
      try {
        let subtotalDia = 0;
        if (typeof state !== 'undefined' && state.cart) {
          subtotalDia = state.cart.reduce((sum, item) => {
            const cantidad = item.qty || item.quantity || 1;
            return sum + (cantidad * (item.price || 0));
          }, 0);
        }
        
        const dias = (typeof state !== 'undefined' && state.days) ? state.days : 15;
        const totalDias = subtotalDia * dias;
        const costoEnvio = (typeof state !== 'undefined' && state.delivery) ? state.delivery.cost : 0;
        const descuento = (typeof state !== 'undefined' && state.discount) ? state.discount : 0;
        const subtotal = totalDias + costoEnvio - descuento;
        const iva = subtotal * 0.16;
        const total = subtotal + iva;
        const garantia = total * 0.1;
        
        console.log('[forzarActualizacionResumen] Cálculos:', {
          subtotalDia,
          dias,
          totalDias,
          subtotal,
          iva,
          total,
          garantia
        });
        
        // Actualizar elementos del resumen financiero con IDs correctos
        const updateElement = (id, value) => {
          const element = document.getElementById(id);
          if (element) {
            element.textContent = `$${value.toFixed(2)}`;
            console.log(`[forzarActualizacionResumen] Actualizado ${id}: $${value.toFixed(2)}`);
          } else {
            console.warn(`[forzarActualizacionResumen] Elemento no encontrado: ${id}`);
          }
        };
        
        // Usar los IDs correctos del HTML
        updateElement('cr-fin-day', subtotalDia);
        updateElement('cr-fin-total-days', totalDias);
        updateElement('cr-fin-subtotal', subtotal);
        updateElement('cr-fin-shipping', costoEnvio);
        updateElement('cr-fin-discount', descuento);
        updateElement('cr-fin-iva', iva);
        updateElement('cr-fin-total', total);
        updateElement('cr-fin-deposit', garantia);
        
        // Actualizar texto de días
        const diasText = document.getElementById('cr-fin-days');
        if (diasText) {
          diasText.textContent = dias;
          console.log(`[forzarActualizacionResumen] Días actualizados: ${dias}`);
        }
        
      } catch (e) {
        console.warn('Error actualizando cálculos financieros:', e);
      }
      
      // Llamar funciones originales
      if (typeof renderSideList === 'function') {
        renderSideList();
      }
      
      if (typeof recalcTotal === 'function') {
        recalcTotal();
      }
      
      console.log('[forzarActualizacionResumen] Actualización completada');
    } catch (error) {
      console.error('[forzarActualizacionResumen] Error:', error);
    }
  };

  // Función para recopilar datos del formulario
  window.recopilarDatosFormulario = function() {
    const datos = {
      contacto_nombre: document.getElementById('cr-contact-name')?.value || '',
      contacto_telefono: document.getElementById('cr-contact-phone')?.value || '',
      contacto_email: document.getElementById('cr-contact-email')?.value || '',
      direccion_entrega: document.getElementById('cr-delivery-address')?.value || '',
      fecha_inicio: document.getElementById('cr-date-start')?.value || null,
      fecha_fin: document.getElementById('cr-date-end')?.value || null,
      dias_periodo: parseInt(document.getElementById('cr-days')?.value) || 15,
      garantia_monto: 0, // Campo no disponible en el formulario actual
      costo_envio: 0, // Se calculará automáticamente
      descuento_monto: 0, // Campo no disponible en el formulario actual
      estado: 'Aprobada',
      motivo_cambio: 'Actualización desde formulario de edición'
    };
    
    // Recopilar productos del carrito del estado
    const productos = [];
    try {
      if (typeof state !== 'undefined' && state.cart && Array.isArray(state.cart)) {
        state.cart.forEach(item => {
          productos.push({
            sku: item.sku || item.id || '',
            nombre: item.name || '',
            descripcion: item.name || '',
            cantidad: item.quantity || 1,
            precio_unitario: item.price || 0,
            precio: item.price || 0,
            subtotal: (item.quantity || 1) * (item.price || 0),
            id_producto: item.id || item.sku || '',
            categoria: item.category || ''
          });
        });
      } else if (window.cart && Array.isArray(window.cart)) {
        // Fallback para window.cart
        window.cart.forEach(item => {
          productos.push({
            descripcion: item.name || '',
            cantidad: item.quantity || 1,
            precio_unitario: item.price || 0,
            precio: item.price || 0,
            subtotal: (item.quantity || 1) * (item.price || 0)
          });
        });
      }
    } catch (e) {
      console.warn('Error recopilando productos del carrito:', e);
    }
    
    console.log('[recopilarDatosFormulario] Productos recopilados:', productos);
    datos.productos_seleccionados = JSON.stringify(productos);
    
    // Calcular totales
    const subtotal = productos.reduce((sum, p) => sum + p.subtotal, 0);
    const totalDias = subtotal * datos.dias_periodo;
    
    // Obtener costo de envío del estado si está disponible
    let costoEnvio = 0;
    try {
      if (typeof state !== 'undefined' && state.delivery && state.delivery.cost) {
        costoEnvio = parseFloat(state.delivery.cost) || 0;
      }
    } catch (e) {
      console.warn('Error obteniendo costo de envío:', e);
    }
    
    const subtotalFinal = totalDias + costoEnvio - datos.descuento_monto;
    const iva = subtotalFinal * 0.16;
    const total = subtotalFinal + iva;
    
    datos.subtotal = subtotalFinal;
    datos.iva = iva;
    datos.total = total;
    datos.costo_envio = costoEnvio;
    
    console.log('[recopilarDatosFormulario] Datos finales:', datos);
    return datos;
  };
  // Buscador de accesorios dentro de #cr-accessories
  window.filterAccessories = function() {
    const q = (document.getElementById('cr-accessory-search')?.value || '').toLowerCase();
    document.querySelectorAll('#cr-accessories .cr-card[data-name]')
      .forEach(card => {
        const name = (card.getAttribute('data-name') || '').toLowerCase();
        card.style.display = name.includes(q) ? '' : 'none';
      });
  }

  // ============================================================================
  // ENHANCED CLIENT SELECTION FUNCTIONALITY
  // ============================================================================

  // Variable global para almacenar el cliente seleccionado temporalmente
  let selectedClientData = null;

  // Función para mostrar detalles del cliente seleccionado
  async function showClientDetails(clientData) {
    try {
      console.log('[showClientDetails] Mostrando detalles del cliente:', clientData);
      
      // Validar que clientData tenga información
      if (!clientData || (!clientData.id && !clientData.id_cliente)) {
        console.error('[showClientDetails] Datos de cliente inválidos:', clientData);
        alert('Error: Datos de cliente inválidos');
        return;
      }
      
      // Almacenar datos del cliente temporalmente
      selectedClientData = clientData;
      
      // Obtener detalles completos del cliente desde la API
      const clientDetails = await fetchClientDetails(clientData.id || clientData.id_cliente);
      
      // Usar los datos completos del API si están disponibles, sino usar los datos básicos
      const fullClientData = clientDetails || clientData;
      
      // Actualizar selectedClientData con los datos completos
      selectedClientData = fullClientData;
      
      // Renderizar los detalles en el modal
      renderClientDetails(fullClientData);
      
      // Mostrar el modal de detalles
      const modal = document.getElementById('client-details-modal');
      if (modal) {
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
      }
      
    } catch (error) {
      console.error('[showClientDetails] Error:', error);
      // Si falla la carga de detalles, mostrar con datos básicos
      renderClientDetails(clientData);
      const modal = document.getElementById('client-details-modal');
      if (modal) {
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
      }
    }
  }

  // Función para obtener detalles completos del cliente desde la API
  async function fetchClientDetails(clientId) {
    try {
      console.log('[fetchClientDetails] Obteniendo detalles para cliente ID:', clientId);
      
      const response = await fetch(`http://localhost:3001/api/clientes/${clientId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      console.log('[fetchClientDetails] Response status:', response.status);

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const clientDetails = await response.json();
      console.log('[fetchClientDetails] Detalles completos obtenidos:', clientDetails);
      console.log('[fetchClientDetails] Campos en detalles:', Object.keys(clientDetails));
      
      // Debug específico para campos de dirección (esquema real)
      console.log('[fetchClientDetails] Campos de dirección en API:');
      console.log('- codigo_postal:', clientDetails.codigo_postal);
      console.log('- ciudad:', clientDetails.ciudad);
      console.log('- estado_direccion:', clientDetails.estado_direccion);
      console.log('- direccion:', clientDetails.direccion);
      console.log('- telefono_alt:', clientDetails.telefono_alt);
      console.log('- atencion_nombre:', clientDetails.atencion_nombre);
      
      return clientDetails;
      
    } catch (error) {
      console.error('[fetchClientDetails] Error al obtener detalles:', error);
      return null;
    }
  }

  // Función para renderizar los detalles del cliente en el modal
  function renderClientDetails(client) {
    const container = document.getElementById('client-details-content');
    if (!container) return;

    const formatValue = (value) => value || 'No especificado';
    const formatMoney = (value) => {
      if (!value || value === 0) return '$0.00';
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
      }).format(value);
    };

    const formatRating = (rating) => {
      if (!rating) return 'Sin calificar';
      const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
      return `${stars} (${rating}/5)`;
    };

    container.innerHTML = `
      <div class="client-details-container">
        <!-- Información básica -->
        <div class="client-section">
          <h4 style="color:#374151;margin:0 0 15px 0;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-user" style="color:#6366f1;"></i>
            Información Básica
          </h4>
          <div class="client-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Nombre</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(client.nombre)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Empresa</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(client.empresa || client.razon_social)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Email</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(client.email)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Teléfono</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(client.telefono || client.celular)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">RFC</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(client.rfc || client.fact_rfc)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Tipo de Cliente</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(client.tipo_cliente || client.segmento)}</p>
            </div>
          </div>
        </div>

        <!-- Información de contacto -->
        <div class="client-section" style="margin-top:25px;">
          <h4 style="color:#374151;margin:0 0 15px 0;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-map-marker-alt" style="color:#10b981;"></i>
            Información de Contacto
          </h4>
          <div class="client-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Dirección</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(client.direccion || client.domicilio)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Ciudad</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(client.ciudad)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Código Postal</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(client.codigo_postal)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Estado</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(client.estado_direccion || client.estado)}</p>
            </div>
          </div>
        </div>

        <!-- Información financiera -->
        <div class="client-section" style="margin-top:25px;">
          <h4 style="color:#374151;margin:0 0 15px 0;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-dollar-sign" style="color:#f59e0b;"></i>
            Información Financiera
          </h4>
          <div class="client-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Límite de Crédito</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatMoney(client.limite_credito)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Días de Crédito</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${client.dias_credito || 0} días</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Deuda Actual</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatMoney(client.deuda_actual)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Método de Pago</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(client.metodo_pago)}</p>
            </div>
          </div>
        </div>

        ${client.cal_general ? `
        <div class="client-section" style="margin-top:25px;">
          <h4 style="color:#374151;margin:0 0 15px 0;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-star" style="color:#f59e0b;"></i>
            Calificaciones
          </h4>
          <div class="client-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Calificación General</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatRating(client.cal_general)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Pago</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatRating(client.cal_pago)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Comunicación</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatRating(client.cal_comunicacion)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Equipos</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatRating(client.cal_equipos)}</p>
            </div>
          </div>
        </div>
        ` : ''}

        ${client.notas_generales || client.comentario ? `
        <div class="client-section" style="margin-top:25px;">
          <h4 style="color:#374151;margin:0 0 15px 0;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-sticky-note" style="color:#8b5cf6;"></i>
            Notas Adicionales
          </h4>
          <div class="info-item">
            <p style="margin:0;color:#1f2937;font-size:14px;line-height:1.5;background:#f9fafb;padding:12px;border-radius:6px;border-left:4px solid #6366f1;">
              ${formatValue(client.notas_generales || client.comentario)}
            </p>
          </div>
        </div>
        ` : ''}
      </div>
    `;
  }

  // Función para confirmar la selección del cliente
  function confirmClientSelection() {
    if (!selectedClientData) {
      console.error('[confirmClientSelection] No hay cliente seleccionado');
      return;
    }

    try {
      console.log('[confirmClientSelection] Confirmando selección:', selectedClientData);
      
      // Guardar una copia local de los datos del cliente antes de cerrar modales
      const clientDataCopy = { ...selectedClientData };
      
      // Actualizar los campos del formulario
      updateClientFields(clientDataCopy);
      
      // Cerrar ambos modales
      closeClientDetailsModal();
      closeClientModal();
      
      // Mostrar notificación de éxito con la copia de datos
      showClientSelectionSuccess(clientDataCopy);
      
    } catch (error) {
      console.error('[confirmClientSelection] Error:', error);
      alert('Error al confirmar la selección del cliente');
    }
  }

  // Función para actualizar los campos del cliente en el formulario
  function updateClientFields(client) {
    try {
      // Actualizar el label visible del cliente
      const clientLabel = document.getElementById('v-client-label');
      if (clientLabel) {
        clientLabel.textContent = client.nombre || 'Cliente seleccionado';
      }

      // Actualizar el campo oculto con el ID del cliente
      const clientHidden = document.getElementById('v-extra');
      if (clientHidden) {
        clientHidden.value = client.id || client.id_cliente || '';
      }

      // Almacenar datos completos del cliente en el estado global
      window.selectedClient = client;
      
      // Cargar automáticamente los datos de contacto
      loadClientContactData(client);
      
      console.log('[updateClientFields] Campos actualizados:', {
        nombre: client.nombre,
        id: client.id || client.id_cliente
      });
      
    } catch (error) {
      console.error('[updateClientFields] Error:', error);
    }
  }

  // Función para cargar los datos de contacto del cliente seleccionado
  function loadClientContactData(client) {
    try {
      console.log('[loadClientContactData] Cargando datos de contacto:', client);
      console.log('[loadClientContactData] Campos disponibles del cliente:', Object.keys(client));
      
      // Debug específico para campos de la BD real
      console.log('[loadClientContactData] Debug campos específicos (esquema real):');
      console.log('- codigo_postal:', client.codigo_postal);
      console.log('- ciudad:', client.ciudad);
      console.log('- estado_direccion:', client.estado_direccion);
      console.log('- direccion:', client.direccion);
      console.log('- telefono_alt:', client.telefono_alt);
      console.log('- atencion_nombre:', client.atencion_nombre);
      console.log('- notas_generales:', client.notas_generales);
      console.log('- nota:', client.nota);

      // Mapear campos del cliente a campos de contacto (basado en esquema real de BD)
      const contactFields = {
        'cr-contact-name': client.nombre || client.contacto || '',
        'cr-contact-phone': client.telefono || '',
        'cr-contact-email': client.email || '',
        'cr-contact-attn': client.atencion_nombre || client.contacto || '',
        'cr-contact-company': client.empresa || '',
        'cr-contact-mobile': client.telefono_alt || client.telefono || '',
        'cr-contact-zip': client.codigo_postal || '',
        'cr-contact-country': 'México', // Valor por defecto
        'cr-contact-state': client.estado_direccion || '', // Campo correcto: estado_direccion
        'cr-contact-municipio': client.ciudad || '',
        'cr-contact-notes': client.notas_generales || client.nota || ''
      };

      // Campos adicionales basados en esquema real de BD
      const additionalFields = {
        // Dirección completa si existe
        'cr-delivery-address': client.direccion || '',
        'cr-delivery-city': client.ciudad || '',
        'cr-delivery-state': client.estado_direccion || '', // Campo correcto: estado_direccion
        'cr-delivery-zip': client.codigo_postal || '',
        'cr-delivery-colony': '' // No hay campo colonia en la BD
      };

      // Actualizar cada campo de contacto
      Object.entries(contactFields).forEach(([fieldId, value]) => {
        const field = document.getElementById(fieldId);
        if (field && value) {
          field.value = value;
          console.log(`[loadClientContactData] Campo ${fieldId} actualizado:`, value);
        }
      });

      // Actualizar campos adicionales (dirección, entrega, etc.)
      Object.entries(additionalFields).forEach(([fieldId, value]) => {
        const field = document.getElementById(fieldId);
        if (field && value) {
          field.value = value;
          console.log(`[loadClientContactData] Campo adicional ${fieldId} actualizado:`, value);
        }
      });

      // Configurar el tipo de persona basado en el tipo de cliente
      const condicionField = document.getElementById('cr-contact-condicion');
      if (condicionField) {
        // Si es empresa/corporativo, establecer como persona moral
        if (client.tipo_cliente === 'Corporativo' || client.empresa || client.razon_social) {
          condicionField.value = 'moral';
        } else {
          condicionField.value = 'fisica';
        }
      }

      // Mostrar notificación de que los datos se cargaron
      showContactDataLoadedNotification(client.nombre || 'Cliente');

    } catch (error) {
      console.error('[loadClientContactData] Error al cargar datos de contacto:', error);
    }
  }

  // Función para mostrar notificación de datos de contacto cargados
  function showContactDataLoadedNotification(clientName) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      background: #3b82f6;
      color: white;
      padding: 10px 16px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 500;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    
    notification.innerHTML = `
      <i class="fa-solid fa-info-circle"></i>
      Datos de contacto cargados de ${clientName}
    `;
    
    document.body.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remover después de 2.5 segundos
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 2500);
  }

  // Función para mostrar notificación de éxito
  function showClientSelectionSuccess(client) {
    // Validar que el cliente tenga datos
    if (!client) {
      console.error('[showClientSelectionSuccess] Cliente es null o undefined');
      return;
    }

    const clientName = client.nombre || client.name || 'Cliente';
    
    // Crear notificación temporal
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;
    
    notification.innerHTML = `
      <i class="fa-solid fa-check-circle"></i>
      Cliente "${clientName}" seleccionado correctamente
    `;
    
    document.body.appendChild(notification);
    
    // Animar entrada
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remover después de 3 segundos
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // Función para cerrar el modal de detalles del cliente
  function closeClientDetailsModal() {
    const modal = document.getElementById('client-details-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
    selectedClientData = null;
  }

  // Función para cerrar el modal de selección de clientes
  function closeClientModal() {
    const modal = document.getElementById('v-client-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  // Mejorar el manejo de mensajes del iframe para mostrar detalles
  const originalMessageHandler = window.addEventListener;
  
  // Interceptar mensajes del iframe de clientes para mostrar detalles
  window.addEventListener('message', function(event) {
    try {
      let payload = null;
      const msg = event.data;
      
      if (typeof msg === 'object') {
        if (msg.type === 'select-client' && msg.payload) payload = msg.payload;
        else if (msg.type === 'cliente-seleccionado' && msg.data) payload = msg.data;
        else if (!msg.type && msg.id) payload = msg; // objeto plano con id
      }
      
      if (payload && (payload.id || payload.id_cliente)) {
        console.log('[Enhanced Client Selection] Cliente seleccionado desde iframe:', payload);
        
        // Verificar si estamos en modo clonación
        const isCloneMode = sessionStorage.getItem('clone-mode') === 'true';
        console.log('🔍 [CLONACIÓN] ¿Está en modo clonación?', isCloneMode);
        
        if (isCloneMode) {
          console.log('🔄 [CLONACIÓN] Cliente seleccionado en modo clonación, abriendo historial...');
          // En modo clonación, abrir directamente el historial del cliente
          openClientHistoryForCloning(payload);
        } else {
          console.log('📋 [NORMAL] Cliente seleccionado en modo normal, mostrando detalles...');
          // En modo normal, mostrar detalles primero
          showClientDetails(payload);
        }
        
        // Prevenir el comportamiento por defecto
        event.stopPropagation();
        return;
      }
      
    } catch (error) {
      console.error('[Enhanced Client Selection] Error procesando mensaje:', error);
    }
  }, true); // Usar capture para interceptar antes que otros handlers

  // Event listeners para el modal de detalles del cliente
  function setupClientDetailsEventListeners() {
    // Botón de confirmar selección
    const confirmBtn = document.getElementById('confirm-client-selection');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', confirmClientSelection);
    }

    // Botones de cerrar modal de detalles
    document.querySelectorAll('[data-client-details-close]').forEach(btn => {
      btn.addEventListener('click', closeClientDetailsModal);
    });

    // Cerrar modal al hacer clic en el backdrop
    const detailsModal = document.getElementById('client-details-modal');
    if (detailsModal) {
      detailsModal.addEventListener('click', function(e) {
        if (e.target === detailsModal || e.target.hasAttribute('data-client-details-close')) {
          closeClientDetailsModal();
        }
      });
    }
  }

  // Configurar event listeners cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupClientDetailsEventListeners);
  } else {
    setupClientDetailsEventListeners();
  }

  // Función para limpiar los campos de contacto
  function clearClientContactData() {
    try {
      const contactFieldIds = [
        'cr-contact-name', 'cr-contact-phone', 'cr-contact-email',
        'cr-contact-attn', 'cr-contact-company', 'cr-contact-mobile',
        'cr-contact-zip', 'cr-contact-state', 'cr-contact-municipio',
        'cr-contact-notes', 'cr-contact-address', 'cr-delivery-address',
        'cr-delivery-city', 'cr-delivery-state', 'cr-delivery-zip',
        'cr-delivery-colony'
      ];

      contactFieldIds.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
          field.value = '';
        }
      });

      // Restablecer país a México y condición a persona física
      const countryField = document.getElementById('cr-contact-country');
      if (countryField) countryField.value = 'México';

      const condicionField = document.getElementById('cr-contact-condicion');
      if (condicionField) condicionField.value = 'fisica';

      console.log('[clearClientContactData] Campos de contacto limpiados');
    } catch (error) {
      console.error('[clearClientContactData] Error:', error);
    }
  }

  // Exponer funciones globalmente
  window.showClientDetails = showClientDetails;
  window.confirmClientSelection = confirmClientSelection;
  window.closeClientDetailsModal = closeClientDetailsModal;
  window.closeClientModal = closeClientModal;
  window.loadClientContactData = loadClientContactData;
  window.clearClientContactData = clearClientContactData;

  document.addEventListener('DOMContentLoaded', init);

  // Delegación global: reflejar IVA y Descuento en tiempo real aunque el listener aún no esté enlazado
  document.addEventListener('change', (ev) => {
    const target = ev.target;
    if (!target) return;
    const id = target.id || '';
    if (id === 'cr-summary-apply-iva' || id === 'cr-summary-apply-discount') {
      try { renderQuoteSummaryTable(); } catch {}
      try { updateFinancialSummary(); } catch {}
    }
  });
  // Delegación global para el porcentaje de descuento (input en tiempo real)
  document.addEventListener('input', (ev) => {
    const target = ev.target;
    if (!target) return;
    const id = target.id || '';
    if (id === 'cr-summary-discount-percent-input') {
      try { renderQuoteSummaryTable(); } catch {}
      try { updateFinancialSummary(); } catch {}
    }
  });
  // Delegación global para método de entrega (sucursal vs domicilio)
  document.addEventListener('change', (ev) => {
    const target = ev.target;
    if (!target) return;
    const id = target.id || '';
    if (id === 'delivery-branch-radio' || id === 'delivery-home-radio') {
      try { renderQuoteSummaryTable(); } catch {}
      try { updateFinancialSummary(); } catch {}
    }
  });

  function showQuoteSummary() {
    // Primero mostrar el resumen
    const quoteCard = document.getElementById('cr-quote-summary-card');
    let finCard = document.getElementById('cr-financial-summary');

    // Asegurar contenedor de destino después de los detalles de entrega
    const deliveryWrap = document.getElementById('cr-home-delivery-wrap');
    const shippingSection = document.getElementById('cr-shipping-section');

    // Crear la card financiera si no existe aún
    if (!finCard) {
      finCard = document.createElement('div');
      finCard.id = 'cr-financial-summary';
      finCard.className = 'cr-card';
      finCard.style = 'margin-top:12px; display:none;';
      finCard.innerHTML = `
        <div class="cr-card__row" style="justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px;">
          <h3 class="cr-card__title" style="margin:0; display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-calculator"></i> Resumen Financiero
          </h3>
          <!-- Toolbar de IVA (derecha) -->
          <div class="cr-toolbar" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <label style="font-size:12px; color:#475569;">Aplica IVA:</label>
            <select id="cr-summary-apply-iva" class="cr-input cr-input--sm" style="max-width:110px;">
              <option value="si" selected>SI</option>
              <option value="no">NO</option>
            </select>
          </div>
        </div>
        <div style="background:#ecfdf5; border:1px solid #22c55e; border-radius:10px; padding:12px;">
          <div style="display:grid; grid-template-columns: 1fr auto; row-gap:6px; column-gap:12px; align-items:center;">
            <div>Renta por Día:</div>
            <div id="cr-fin-day" class="cr-total__value">$0.00</div>
            <div>Total por <span id="cr-fin-days">1</span> días:</div>
            <div id="cr-fin-total-days" class="cr-total__value">$0.00</div>
            <div>Sub-Total:</div>
            <div id="cr-fin-subtotal" class="cr-total__value">$0.00</div>
            <div id="cr-fin-shipping-row" style="display:grid; grid-column:1 / -1; grid-template-columns: 1fr auto; align-items:center;">
              <div>Costo de Envío:</div>
              <div id="cr-fin-shipping" class="cr-total__value">$0.00</div>
            </div>
            <div>Descuento:</div>
            <div id="cr-fin-discount" class="cr-total__value">$0.00</div>
            <div id="cr-fin-iva-label">IVA (16%):</div>
            <div id="cr-fin-iva" class="cr-total__value">$0.00</div>
            <div style="grid-column:1 / -1; height:1px; background:#16a34a; margin:6px 0;"></div>
            <div style="font-weight:800;">Total:</div>
            <div id="cr-fin-total" class="cr-total__value" style="color:#16a34a;">$0.00</div>
            <div>Garantía:</div>
            <div id="cr-fin-deposit" class="cr-total__value">$0.00</div>
          </div>
        </div>
      `;
    }

    // Mover las cards de resumen para que queden DESPUÉS de los detalles de entrega
    if (deliveryWrap && deliveryWrap.parentElement && quoteCard) {
      const parent = deliveryWrap.parentElement;
      parent.insertBefore(quoteCard, deliveryWrap.nextSibling);
      parent.insertBefore(finCard, quoteCard.nextSibling);
    } else if (shippingSection && quoteCard) {
      // Fallback: colocarlas al final de la sección de envío
      shippingSection.appendChild(quoteCard);
      shippingSection.appendChild(finCard);
    }

    if (quoteCard) { quoteCard.style.display = 'block'; quoteCard.hidden = false; }
    if (finCard) { finCard.style.display = 'block'; finCard.hidden = false; }

    renderQuoteSummaryTable();
    try { updateFinancialSummary(); } catch(e) { console.error('[cr-save-contact] error updating financial summary:', e); }

    // Asegurar que el scroll vaya al resumen si es necesario
    quoteCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Reasegurar enlaces por si los nodos fueron reubicados
    try { bindQuoteSummaryEvents(); } catch {}
  }

  try {
    const saveBtn = document.getElementById('cr-save-contact');
    if (saveBtn && !saveBtn.__bound) {
      saveBtn.addEventListener('click', () => { showSection('cr-shipping-section'); showQuoteSummary(); });
      saveBtn.__bound = true;
    }
    const saveBranchBtn = document.getElementById('cr-save-contact-branch');
    if (saveBranchBtn && !saveBranchBtn.__bound) {
      saveBranchBtn.addEventListener('click', () => { showSection('cr-shipping-section'); showQuoteSummary(); });
      saveBranchBtn.__bound = true;
    }
  } catch(e) { console.error('[bindEvents] error binding save button', e); }

  // Exportar funciones necesarias para otros módulos
  window.collectQuotationData = collectQuotationData;
  window.sendQuotationToBackend = sendQuotationToBackend;
  window.closeQuotationSuccessModal = closeQuotationSuccessModal;
  window.goToContract = goToContract;
})();

// === FUNCIONALIDAD GUARDAR CLIENTE ===
(() => {
  const API_URL = 'http://localhost:3001/api';
  
  // Función para sanitizar campos numéricos
  const sanitizeNumeric = (value) => {
    if (value === '' || value === undefined || value === null) return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  };

  // Función para mostrar notificaciones
  window.showNotification = (message, type = 'success') => {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `cr-notification cr-notification--${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-weight: 500;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    // Agregar estilos de animación si no existen
    if (!document.querySelector('#cr-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'cr-notification-styles';
      styles.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto-remover después de 4 segundos
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 4000);
  };

  // Función para guardar cliente
  const saveCliente = async (formData) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/clientes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al guardar cliente');
      }

      const cliente = await response.json();
      return cliente;
    } catch (error) {
      console.error('Error al guardar cliente:', error);
      throw error;
    }
  };

  // Manejar el envío del formulario
  const handleSaveClient = async () => {
    const form = document.getElementById('cr-save-client-form');
    const modal = document.getElementById('cr-save-client-modal');
    
    if (!form || !modal) return;

    // Validar campos requeridos
    const nombre = form.querySelector('#cr-cliente-nombre').value.trim();
    const email = form.querySelector('#cr-cliente-email').value.trim();
    
    if (!nombre) {
      showNotification('El nombre es requerido', 'error');
      form.querySelector('#cr-cliente-nombre').focus();
      return;
    }
    
    if (!email) {
      showNotification('El email es requerido', 'error');
      form.querySelector('#cr-cliente-email').focus();
      return;
    }

    // Recopilar datos del formulario
    const formData = {
      // Datos básicos
      nombre: nombre,
      empresa: form.querySelector('#cr-cliente-empresa').value.trim() || null,
      telefono: form.querySelector('#cr-cliente-telefono').value.trim() || null,
      celular: form.querySelector('#cr-cliente-celular').value.trim() || null,
      email: email,
      rfc: form.querySelector('#cr-cliente-rfc').value.trim() || null,
      curp: form.querySelector('#cr-cliente-curp').value.trim() || null,
      
      // Datos de facturación
      razon_social: form.querySelector('#cr-cliente-razon-social').value.trim() || null,
      fact_rfc: form.querySelector('#cr-cliente-fact-rfc').value.trim() || null,
      regimen_fiscal: form.querySelector('#cr-cliente-regimen-fiscal').value || null,
      domicilio: form.querySelector('#cr-cliente-domicilio').value.trim() || null,
      ciudad: form.querySelector('#cr-cliente-ciudad').value.trim() || null,
      codigo_postal: form.querySelector('#cr-cliente-codigo-postal').value.trim() || null,
      
      // Información financiera
      limite_credito: sanitizeNumeric(form.querySelector('#cr-cliente-limite-credito').value),
      terminos_pago: sanitizeNumeric(form.querySelector('#cr-cliente-terminos-pago').value),
      metodo_pago: form.querySelector('#cr-cliente-metodo-pago').value || 'Transferencia',
      segmento: form.querySelector('#cr-cliente-segmento').value || 'Individual',
      
      // Notas
      notas_generales: form.querySelector('#cr-cliente-notas').value.trim() || null,
      
      // Campos por defecto
      estado: 'Activo',
      tipo_cliente: 'Individual',
      pais: 'MÉXICO'
    };

    try {
      // Mostrar loading
      const saveBtn = document.getElementById('cr-save-client-confirm');
      const originalText = saveBtn.innerHTML;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
      saveBtn.disabled = true;

      // Guardar cliente
      const cliente = await saveCliente(formData);
      
      // Éxito - actualizar selector de cliente si existe
      showNotification(`Cliente "${cliente.nombre}" guardado exitosamente`, 'success');
      
      // Actualizar el cliente seleccionado en la cotización
      const clientLabel = document.getElementById('v-client-label');
      const clientHidden = document.getElementById('v-extra');
      
      if (clientLabel) {
        clientLabel.textContent = cliente.nombre;
      }
      if (clientHidden) {
        clientHidden.value = cliente.nombre;
        // Disparar eventos para notificar el cambio
        clientHidden.dispatchEvent(new Event('input', { bubbles: true }));
        clientHidden.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Guardar en localStorage para persistencia
      try {
        const CLIENT_KEY = 'cr_selected_client';
        const clientData = { 
          id: cliente.id_cliente, 
          nombre: cliente.nombre,
          email: cliente.email,
          telefono: cliente.telefono,
          empresa: cliente.empresa,
          razon_social: cliente.razon_social
        };
        localStorage.setItem(CLIENT_KEY, JSON.stringify(clientData));
      } catch(e) {
        console.warn('No se pudo guardar en localStorage:', e);
      }
      
      // Ahora guardar la cotización como borrador con el cliente recién creado
      try {
        showNotification('Guardando cotización como borrador...', 'success');
        
        // Recopilar datos de la cotización
        const quotationData = collectQuotationData();
        if (quotationData) {
          // Combinar datos del cliente con la cotización
          const completeData = {
            ...quotationData,
            id_cliente: cliente.id_cliente,
            contacto_nombre: cliente.nombre,
            contacto_email: cliente.email,
            contacto_telefono: cliente.telefono || cliente.celular,
            tipo_cliente: cliente.empresa ? 'Empresa' : 'Público en General'
          };
          
          // Enviar al backend
          const result = await sendQuotationToBackend(completeData);
          
          if (result.success) {
            showNotification(`Cotización guardada como borrador. Folio: ${result.numero_cotizacion}`, 'success');
          } else {
            showNotification(`Cliente creado, pero error al guardar cotización: ${result.message}`, 'error');
          }
        } else {
          showNotification('Cliente creado exitosamente. Agregue productos para crear la cotización.', 'success');
        }
      } catch (quotationError) {
        console.error('Error guardando cotización:', quotationError);
        showNotification('Cliente creado exitosamente, pero no se pudo guardar la cotización como borrador', 'error');
      }
      
      // Cerrar modal y limpiar formulario
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      form.reset();
      
      // Restaurar botón
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
      
    } catch (error) {
      // Error
      showNotification(error.message || 'Error al guardar cliente', 'error');
      
      // Restaurar botón
      const saveBtn = document.getElementById('cr-save-client-confirm');
      saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cliente';
      saveBtn.disabled = false;
    }
  };

  // Vincular evento al botón de guardar
  try {
    const saveBtn = document.getElementById('cr-save-client-confirm');
    if (saveBtn) {
      saveBtn.addEventListener('click', handleSaveClient);
    }
  } catch(e) {
    console.error('Error vinculando botón de guardar cliente:', e);
  }

  // Exportar función saveCliente para uso en otras partes del código
  window.saveCliente = saveCliente;
})();

// === FUNCIONALIDAD CLONACIÓN DE COTIZACIÓN ===
(() => {
  const API_URL = 'http://localhost:3001/api';
  let selectedCloneClient = null;
  let originalQuotationData = null;

  // Función global para establecer cliente seleccionado para clonación
  window.setCloneClient = (clientData) => {
    console.log('[CLONACIÓN] Estableciendo cliente para clon:', clientData);
    selectedCloneClient = clientData;
    
    // Mostrar en el modal de clonación
    const selectedClientDiv = document.getElementById('cr-clone-selected-client');
    const clientNameSpan = document.getElementById('cr-clone-new-client-name');
    
    if (selectedClientDiv && clientNameSpan) {
      clientNameSpan.textContent = clientData.nombre || clientData.empresa || 'Cliente seleccionado';
      selectedClientDiv.style.display = 'block';
    }
    
    showNotification(`Cliente seleccionado: ${clientData.nombre || clientData.empresa}`, 'success');
  };

  // Función para cargar vendedores en el select
  window.loadVendors = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_URL}/usuarios`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const usuarios = await response.json();
        const vendorSelect = document.getElementById('cr-clone-vendor-select');
        
        if (vendorSelect) {
          // Limpiar opciones existentes (excepto la primera)
          vendorSelect.innerHTML = '<option value="">Mantener vendedor actual</option>';
          
          // Agregar vendedores
          usuarios.filter(u => ['Rentas', 'Ventas', 'director general'].includes(u.rol))
                  .forEach(vendor => {
            const option = document.createElement('option');
            option.value = vendor.id_usuario;
            option.textContent = `${vendor.nombre} (${vendor.rol})`;
            vendorSelect.appendChild(option);
          });
        }
      }
    } catch (error) {
      console.error('Error cargando vendedores:', error);
    }
  };

  // Función para llenar datos de la cotización original
  const fillOriginalQuotationData = () => {
    try {
      const modal = document.getElementById('cr-clone-modal');
      if (!modal) return;

      // Obtener datos actuales de la página
      const folio = document.getElementById('v-quote-number')?.value || 'SIN-FOLIO';
      const total = document.getElementById('cr-grand-total')?.textContent?.trim() || '$0.00';
      const fecha = document.getElementById('v-quote-date')?.value || new Date().toISOString().split('T')[0];
      
      // Cliente actual
      const clientLabel = document.getElementById('v-client-label');
      const clientName = clientLabel ? clientLabel.textContent.trim() : 'No seleccionado';
      
      // Vendedor actual (obtener del localStorage del usuario logueado)
      let vendorName = 'No asignado';
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          vendorName = user.nombre || 'Usuario actual';
        }
      } catch(e) {
        console.warn('No se pudo obtener datos del usuario:', e);
      }

      // Llenar campos de la modal
      const folioEl = modal.querySelector('[data-chip-folio]');
      const totalEl = modal.querySelector('[data-chip-total]');
      const fechaEl = modal.querySelector('[data-chip-fecha-original]');
      const clientEl = modal.querySelector('#cr-clone-current-client');
      const vendorEl = modal.querySelector('#cr-clone-current-vendor');

      if (folioEl) folioEl.textContent = folio;
      if (totalEl) totalEl.textContent = total;
      if (fechaEl) fechaEl.textContent = fecha;
      if (clientEl) clientEl.textContent = clientName;
      if (vendorEl) vendorEl.textContent = vendorName;

      // Establecer fecha por defecto (hoy)
      const newDateInput = modal.querySelector('#cr-clone-new-date');
      if (newDateInput) {
        newDateInput.value = new Date().toISOString().split('T')[0];
      }

      // Guardar datos originales para la clonación
      originalQuotationData = {
        folio: folio,
        total: total,
        fecha: fecha,
        cliente: clientName,
        vendedor: vendorName,
        // Aquí se agregarían más datos según sea necesario
        productos: getSelectedProducts(),
        configuracion: getCurrentConfiguration()
      };

    } catch (error) {
      console.error('Error llenando datos originales:', error);
    }
  };

  // Función para obtener productos seleccionados
  const getSelectedProducts = () => {
    try {
      // Obtener del estado global o del DOM
      return window.state?.cart || [];
    } catch (error) {
      console.error('Error obteniendo productos:', error);
      return [];
    }
  };

  // Función para obtener configuración actual
  const getCurrentConfiguration = () => {
    try {
      return {
        periodo: document.getElementById('v-period')?.value || 'Inmediato',
        dias: document.getElementById('v-days')?.value || 15,
        almacen: window.state?.selectedWarehouse || null,
        envio: {
          tipo: document.getElementById('v-shipping-type')?.value || 'local',
          direccion: document.getElementById('v-shipping-address')?.value || '',
          costo: document.getElementById('v-shipping-cost')?.value || 0
        }
      };
    } catch (error) {
      console.error('Error obteniendo configuración:', error);
      return {};
    }
  };

  // Función para mostrar modal de confirmación antes de clonar
  const showCloneConfirmationModal = () => {
    const modal = document.getElementById('cr-clone-modal');
    if (!modal) return;

    // Obtener valores del formulario
    const newDate = modal.querySelector('#cr-clone-new-date').value;
    const reason = modal.querySelector('#cr-clone-reason').value;
    const resetState = modal.querySelector('#cr-clone-reset-state').checked;
    const copyProducts = modal.querySelector('#cr-clone-copy-products').checked;
    const copyShipping = modal.querySelector('#cr-clone-copy-shipping').checked;

    if (!newDate) {
      showNotification('Por favor selecciona una fecha para el clon', 'error');
      return;
    }

    // Obtener datos de la cotización
    const quotationData = window.selectedQuotationForCloning;
    if (!quotationData) {
      showNotification('No hay cotización seleccionada', 'error');
      return;
    }

    // Abrir modal de confirmación
    const confirmModal = document.getElementById('cr-clone-confirm-modal');
    if (!confirmModal) return;

    // Llenar datos originales
    document.getElementById('confirm-original-folio').textContent = 
      quotationData.numero_folio || quotationData.numero_cotizacion || '-';
    
    document.getElementById('confirm-original-client').textContent = 
      quotationData.cliente_nombre || quotationData.contacto_nombre || '-';
    
    const totalFormatted = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(quotationData.total || 0);
    document.getElementById('confirm-original-total').textContent = totalFormatted;

    // Llenar datos del clon
    const newDateFormatted = new Date(newDate).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    document.getElementById('confirm-new-date').textContent = newDateFormatted;
    
    const newClientName = selectedCloneClient 
      ? (selectedCloneClient.nombre || selectedCloneClient.empresa)
      : (quotationData.cliente_nombre || quotationData.contacto_nombre || 'Cliente actual');
    document.getElementById('confirm-new-client').textContent = newClientName;
    
    // Estado siempre es "Clonación" para clones
    document.getElementById('confirm-new-status').textContent = 'Clonación';

    // Llenar opciones
    const optionsList = document.getElementById('confirm-options-list');
    optionsList.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: ${resetState ? '#059669' : '#6b7280'};">
        <i class="fa-solid ${resetState ? 'fa-check-circle' : 'fa-circle'}"></i>
        <span>Resetear estado a "Borrador"</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; color: ${copyProducts ? '#059669' : '#6b7280'};">
        <i class="fa-solid ${copyProducts ? 'fa-check-circle' : 'fa-circle'}"></i>
        <span>Copiar productos seleccionados (${copyProducts ? quotationData.productos_seleccionados?.length || 0 : 0} productos)</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; color: ${copyShipping ? '#059669' : '#6b7280'};">
        <i class="fa-solid ${copyShipping ? 'fa-check-circle' : 'fa-circle'}"></i>
        <span>Copiar configuración de envío</span>
      </div>
    `;

    // Mostrar motivo si existe
    const reasonContainer = document.getElementById('confirm-reason-container');
    const reasonText = document.getElementById('confirm-reason-text');
    if (reason && reason.trim()) {
      reasonText.textContent = reason;
      reasonContainer.style.display = 'block';
    } else {
      reasonContainer.style.display = 'none';
    }

    // Mostrar modal
    confirmModal.hidden = false;
    confirmModal.setAttribute('aria-hidden', 'false');
  };

  // Función para clonar la cotización
  const cloneQuotation = async () => {
    try {
      const modal = document.getElementById('cr-clone-modal');
      if (!modal) return;

      // Obtener datos de la cotización seleccionada
      const quotationData = window.selectedQuotationForCloning;
      if (!quotationData) {
        showNotification('No hay cotización seleccionada para clonar', 'error');
        return;
      }

      // Obtener valores del formulario
      const newDate = modal.querySelector('#cr-clone-new-date').value;
      const newVendor = modal.querySelector('#cr-clone-vendor-select').value;
      const reason = modal.querySelector('#cr-clone-reason').value;
      const resetState = modal.querySelector('#cr-clone-reset-state').checked;
      const copyProducts = modal.querySelector('#cr-clone-copy-products').checked;
      const copyShipping = modal.querySelector('#cr-clone-copy-shipping').checked;

      if (!newDate) {
        showNotification('Por favor selecciona una fecha para el clon', 'error');
        return;
      }

      // Log de cliente seleccionado para debug
      console.log('[CLONACIÓN] Cliente seleccionado para clon:', selectedCloneClient);
      console.log('[CLONACIÓN] Cliente original:', quotationData.id_cliente);
      
      // Determinar ID del cliente a usar
      const clienteId = selectedCloneClient 
        ? (selectedCloneClient.id_cliente || selectedCloneClient.id || parseInt(selectedCloneClient.id)) 
        : quotationData.id_cliente;
      console.log('[CLONACIÓN] ID de cliente que se usará:', clienteId);

      // Si se seleccionó un cliente nuevo, obtener sus datos completos del backend
      let datosContactoCliente = {
        contacto_nombre: quotationData.contacto_nombre,
        contacto_telefono: quotationData.contacto_telefono,
        contacto_email: quotationData.contacto_email
      };

      if (selectedCloneClient && clienteId !== quotationData.id_cliente) {
        console.log('[CLONACIÓN] Obteniendo datos completos del cliente nuevo...');
        try {
          const token = localStorage.getItem('token');
          const clienteResponse = await fetch(`${API_URL}/clientes/${clienteId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (clienteResponse.ok) {
            const clienteCompleto = await clienteResponse.json();
            console.log('[CLONACIÓN] Datos completos del cliente obtenidos:', clienteCompleto);
            
            datosContactoCliente = {
              contacto_nombre: clienteCompleto.nombre || clienteCompleto.empresa || selectedCloneClient.nombre,
              contacto_telefono: clienteCompleto.telefono || selectedCloneClient.telefono || '',
              contacto_email: clienteCompleto.email || selectedCloneClient.email || ''
            };
            console.log('[CLONACIÓN] Datos de contacto actualizados:', datosContactoCliente);
          } else {
            console.warn('[CLONACIÓN] No se pudieron obtener datos del cliente, usando datos del selector');
            datosContactoCliente = {
              contacto_nombre: selectedCloneClient.nombre || selectedCloneClient.empresa,
              contacto_telefono: selectedCloneClient.telefono || '',
              contacto_email: selectedCloneClient.email || ''
            };
          }
        } catch (error) {
          console.error('[CLONACIÓN] Error obteniendo datos del cliente:', error);
          // Usar datos básicos del selector si falla
          datosContactoCliente = {
            contacto_nombre: selectedCloneClient.nombre || selectedCloneClient.empresa,
            contacto_telefono: selectedCloneClient.telefono || '',
            contacto_email: selectedCloneClient.email || ''
          };
        }
      }

      // Preparar datos del clon
      const cloneData = {
        // Tipo de cotización
        tipo: 'RENTA',
        
        // Datos básicos
        fecha_cotizacion: newDate,
        es_clon: true,
        clon_de_folio: quotationData.numero_folio || quotationData.numero_cotizacion,
        cotizacion_origen: quotationData.id_cotizacion,
        motivo_cambio: reason || 'Clonación de cotización',
        
        // Cliente (usar el seleccionado o mantener el actual)
        id_cliente: clienteId,
        
        // Vendedor (usar el seleccionado o mantener el actual)
        id_vendedor: newVendor ? parseInt(newVendor) : quotationData.id_vendedor,
        creado_por: window.usuarioActual?.id || quotationData.creado_por || 3,
        
        // Estado (siempre "Clonación" para clones)
        estado: 'Clonación',
        
        // Período y fechas (copiar de original)
        periodo: quotationData.periodo,
        dias_periodo: quotationData.dias_periodo,
        fecha_inicio: quotationData.fecha_inicio,
        fecha_fin: quotationData.fecha_fin,
        
        // Montos (copiar de original si hay productos)
        subtotal: copyProducts ? quotationData.subtotal : 0,
        iva: copyProducts ? quotationData.iva : 0,
        total: copyProducts ? quotationData.total : 0,
        
        // Productos y configuración
        productos_seleccionados: copyProducts ? quotationData.productos_seleccionados : [],
        configuracion_especial: copyProducts ? quotationData.configuracion_especial : {},
        
        // Notas
        notas: quotationData.notas || '',
        
        // Datos de envío (si se copian)
        ...(copyShipping ? {
          tipo_envio: quotationData.tipo_envio,
          direccion_entrega: quotationData.direccion_entrega,
          costo_envio: quotationData.costo_envio,
          requiere_entrega: quotationData.requiere_entrega,
          entrega_lote: quotationData.entrega_lote,
          hora_entrega_solicitada: quotationData.hora_entrega_solicitada,
          entrega_calle: quotationData.entrega_calle,
          entrega_numero_ext: quotationData.entrega_numero_ext,
          entrega_numero_int: quotationData.entrega_numero_int,
          entrega_colonia: quotationData.entrega_colonia,
          entrega_cp: quotationData.entrega_cp,
          entrega_municipio: quotationData.entrega_municipio,
          entrega_estado: quotationData.entrega_estado,
          entrega_referencia: quotationData.entrega_referencia,
          entrega_kilometros: quotationData.entrega_kilometros,
          tipo_zona: quotationData.tipo_zona,
          distancia_km: quotationData.distancia_km,
          detalle_calculo: quotationData.detalle_calculo
        } : {}),
        
        // Datos de contacto (del cliente nuevo si se seleccionó, o del original)
        contacto_nombre: datosContactoCliente.contacto_nombre,
        contacto_telefono: datosContactoCliente.contacto_telefono,
        contacto_email: datosContactoCliente.contacto_email,
        
        // Cambios realizados en el clon
        cambios_en_clon: {
          fecha_cambiada: newDate !== quotationData.fecha_cotizacion,
          cliente_cambiado: !!selectedCloneClient,
          vendedor_cambiado: !!newVendor,
          productos_copiados: copyProducts,
          envio_copiado: copyShipping,
          estado_reseteado: resetState
        }
      };

      // Mostrar loading
      const cloneBtn = modal.querySelector('[data-clone-confirm]');
      const originalText = cloneBtn.innerHTML;
      cloneBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clonando...';
      cloneBtn.disabled = true;

      // Enviar al backend
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      console.log('[CLONACIÓN] Enviando datos al backend:', cloneData);
      
      const response = await fetch(`${API_URL}/cotizaciones`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cloneData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[CLONACIÓN] Error del servidor:', errorText);
        throw new Error('Error al clonar cotización');
      }

      const result = await response.json();
      console.log('[CLONACIÓN] Cotización clonada exitosamente:', result);
      
      // Éxito
      showNotification('Cotización clonada exitosamente', 'success');
      
      // Cerrar modal y limpiar
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      resetCloneForm();
      
      // Opcional: Redirigir a la nueva cotización
      setTimeout(() => {
        if (result.clon && result.clon.numero_folio) {
          showNotification(`Nueva cotización: ${result.clon.numero_folio}`, 'success');
          // window.location.href = `cotizacion_renta.html?id=${result.clon.id_cotizacion}`;
        }
      }, 2000);

    } catch (error) {
      console.error('Error clonando cotización:', error);
      showNotification('Error al clonar la cotización', 'error');
    } finally {
      // Restaurar botón
      const cloneBtn = document.querySelector('[data-clone-confirm]');
      if (cloneBtn) {
        cloneBtn.innerHTML = '<i class="fa-solid fa-clone"></i> Clonar';
        cloneBtn.disabled = false;
      }
    }
  };

  // Función para resetear el formulario de clonación
  const resetCloneForm = () => {
    const modal = document.getElementById('cr-clone-modal');
    if (!modal) return;

    // Resetear campos
    modal.querySelector('#cr-clone-new-date').value = new Date().toISOString().split('T')[0];
    modal.querySelector('#cr-clone-vendor-select').value = '';
    modal.querySelector('#cr-clone-reason').value = '';
    modal.querySelector('#cr-clone-reset-state').checked = true;
    modal.querySelector('#cr-clone-copy-products').checked = true;
    modal.querySelector('#cr-clone-copy-shipping').checked = false;

    // Ocultar cliente seleccionado
    const selectedClientDiv = modal.querySelector('#cr-clone-selected-client');
    if (selectedClientDiv) {
      selectedClientDiv.style.display = 'none';
    }

    // Resetear cliente seleccionado
    selectedCloneClient = null;
    originalQuotationData = null;
  };

  // Event listeners
  try {
    // Botón "Seleccionar todo"
    const selectAllBtn = document.getElementById('cr-clone-select-all');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.cr-clone-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        // Si todos están marcados, desmarcar todos; si no, marcar todos
        checkboxes.forEach(cb => cb.checked = !allChecked);
        
        const action = allChecked ? 'desmarcadas' : 'marcadas';
        showNotification(`Todas las opciones ${action}`, 'success');
      });
    }
    
    // Botón de clonar (abre modal de confirmación)
    const cloneBtn = document.querySelector('[data-clone-confirm]');
    if (cloneBtn) {
      cloneBtn.addEventListener('click', () => {
        if (window.__cloneFlowV2Active) {
          console.log('[CLONACIÓN] Flujo legacy omitido: manejado por nueva implementación');
          return;
        }
        // Mostrar modal de confirmación
        showCloneConfirmationModal();
      });
    }

    // Botones del modal de confirmación
    const confirmProceedBtn = document.getElementById('cr-clone-confirm-proceed');
    if (confirmProceedBtn) {
      confirmProceedBtn.addEventListener('click', () => {
        if (window.__cloneFlowV2Active) {
          console.log('[CLONACIÓN] Flujo legacy omitido en confirmación: ya existe flujo V2');
          return;
        }
        // Cerrar modal de confirmación
        const confirmModal = document.getElementById('cr-clone-confirm-modal');
        if (confirmModal) {
          confirmModal.hidden = true;
          confirmModal.setAttribute('aria-hidden', 'true');
        }
        
        // Ejecutar clonación
        cloneQuotation();
      });
    }

    const confirmCancelBtn = document.getElementById('cr-clone-confirm-cancel-btn');
    const confirmCancelX = document.getElementById('cr-clone-confirm-cancel');
    
    const closeConfirmModal = () => {
      const confirmModal = document.getElementById('cr-clone-confirm-modal');
      if (confirmModal) {
        confirmModal.hidden = true;
        confirmModal.setAttribute('aria-hidden', 'true');
      }
    };
    
    if (confirmCancelBtn) {
      confirmCancelBtn.addEventListener('click', closeConfirmModal);
    }
    if (confirmCancelX) {
      confirmCancelX.addEventListener('click', closeConfirmModal);
    }

    // Botón mantener cliente actual
    const keepClientBtn = document.getElementById('cr-clone-keep-client');
    if (keepClientBtn) {
      keepClientBtn.addEventListener('click', () => {
        selectedCloneClient = null;
        const selectedClientDiv = document.getElementById('cr-clone-selected-client');
        if (selectedClientDiv) {
          selectedClientDiv.style.display = 'none';
        }
        showNotification('Se mantendrá el cliente actual', 'success');
      });
    }

    // Botón seleccionar cliente
    const selectClientBtn = document.getElementById('cr-clone-select-client');
    if (selectClientBtn) {
      selectClientBtn.addEventListener('click', () => {
        // Marcar que estamos seleccionando cliente para clonación
        sessionStorage.setItem('selecting-client-for-clone', 'true');
        
        // Abrir modal de selección de cliente
        const clientModal = document.getElementById('v-client-modal');
        if (clientModal) {
          clientModal.hidden = false;
          clientModal.setAttribute('aria-hidden', 'false');
        }
      });
    }

    // NOTA: La función startCloneProcess fue eliminada
    // El flujo de clonación ahora se maneja directamente desde el HTML (cotizacion_renta.html)
    // mediante el evento 'clonar' que abre el modal cr-clone-modal

    // Función para abrir historial del cliente en modo clonación (DEPRECATED - ya no se usa)
    const openClientHistoryForCloning = (clientData) => {
      console.log('🔄 [CLONACIÓN] Abriendo historial para cliente:', clientData);
      
      // Limpiar modo clonación del sessionStorage
      sessionStorage.removeItem('clone-mode');
      
      // Cerrar modal de selección de cliente
      safeCloseModal('client-selection-modal');
      
      // Construir URL del historial del cliente
      const clientId = clientData.id || clientData.id_cliente;
      const historialUrl = `clientes.html?action=historial&id=${clientId}&clone=true`;
      
      console.log('🔄 [CLONACIÓN] Abriendo ventana de historial:', historialUrl);
      
      // Abrir ventana de historial del cliente
      const historialWindow = window.open(
        historialUrl,
        'client-history-clone',
        'width=1200,height=800,scrollbars=yes,resizable=yes'
      );
      
      if (historialWindow) {
        console.log('🔄 [CLONACIÓN] Ventana de historial abierta exitosamente');
        showNotification(`Abriendo historial de ${clientData.nombre || clientData.empresa}...`, 'success');
      } else {
        console.error('🔄 [CLONACIÓN] Error: No se pudo abrir ventana de historial');
        showNotification('Error: No se pudo abrir el historial del cliente', 'error');
      }
    };

    // Función para cerrar modales de forma segura (sin errores de accesibilidad)
    window.safeCloseModal = (modalId) => {
      const modal = document.getElementById(modalId);
      if (modal && !modal.hidden) {
        // Remover focus de cualquier elemento dentro del modal
        const focusedElement = modal.querySelector(':focus');
        if (focusedElement) {
          focusedElement.blur();
        }
        
        // Ocultar modal
        modal.setAttribute('hidden', 'true');
        modal.setAttribute('aria-hidden', 'true');
        
        // Remover atributos específicos si existen
        modal.removeAttribute('data-clone-mode');
        
        console.log(`Modal ${modalId} cerrado de forma segura`);
      }
    };

    // Función para abrir modales de forma segura
    window.safeOpenModal = (modalId) => {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.removeAttribute('hidden');
        modal.setAttribute('aria-hidden', 'false');
        
        // Enfocar el primer elemento focuseable si existe
        const firstFocusable = modal.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
          setTimeout(() => firstFocusable.focus(), 100);
        }
        
        console.log(`Modal ${modalId} abierto de forma segura`);
      }
    };

    // Función para llenar el modal de clonación con datos de cotización seleccionada
    window.fillCloneModalWithQuotationData = (quotationData) => {
      try {
        // Llenar información de la cotización original
        const folioElement = document.querySelector('[data-chip-folio]');
        if (folioElement) {
          folioElement.textContent = quotationData.numero_folio || quotationData.numero_cotizacion || 'Sin folio';
        }
        
        const totalElement = document.querySelector('[data-chip-total]');
        if (totalElement) {
          const total = quotationData.total || 0;
          totalElement.textContent = new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
          }).format(total);
        }
        
        const fechaElement = document.querySelector('[data-chip-fecha-original]');
        if (fechaElement) {
          const fecha = quotationData.fecha_creacion || quotationData.fecha_cotizacion;
          if (fecha) {
            const fechaFormateada = new Date(fecha).toLocaleDateString('es-MX');
            fechaElement.textContent = fechaFormateada;
          }
        }
        
        const vendedorElement = document.getElementById('cr-clone-current-vendor');
        if (vendedorElement) {
          // Mostrar vendedor de la cotización o el usuario actual
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          const vendorName = quotationData.vendedor_nombre || currentUser.nombre || 'Sin vendedor';
          vendedorElement.textContent = vendorName;
        }
        
        // Mostrar información del cliente de la cotización original
        const clienteElement = document.getElementById('cr-clone-current-client');
        if (clienteElement) {
          // Intentar obtener nombre del cliente de diferentes fuentes
          const clientName = quotationData.cliente_nombre || 
                           quotationData.nombre_cliente || 
                           quotationData.empresa || 
                           quotationData.nombre ||
                           'Cliente no especificado';
          clienteElement.textContent = clientName;
        }
        
        // Guardar datos de la cotización original para el proceso de clonación
        window.selectedQuotationForCloning = quotationData;
        
        // Configurar autorización para cambio de vendedor
        window.setupVendorChangeAuthorization(quotationData);
        
        console.log('Modal de clonación llenado con datos:', quotationData);
      } catch (error) {
        console.error('Error llenando modal de clonación:', error);
      }
    };

    // Función para configurar autorización de cambio de vendedor
    window.setupVendorChangeAuthorization = (quotationData) => {
      const vendorSelect = document.getElementById('cr-clone-vendor-select');
      if (!vendorSelect) return;
      
      vendorSelect.addEventListener('change', function() {
        const selectedVendorId = this.value;
        const originalVendorId = quotationData.id_vendedor;
        
        // Si se selecciona un vendedor diferente al original, pedir autorización
        if (selectedVendorId && selectedVendorId !== originalVendorId?.toString()) {
          window.requestVendorChangeAuthorization(selectedVendorId, originalVendorId, this);
        }
      });
    };

    // Función para solicitar autorización de cambio de vendedor
    window.requestVendorChangeAuthorization = (newVendorId, originalVendorId, selectElement) => {
      // Crear modal de autorización
      const authModal = window.createAuthorizationModal();
      document.body.appendChild(authModal);
      
      // Mostrar modal
      authModal.style.display = 'flex';
      
      // Enfocar campo de contraseña
      const passwordInput = authModal.querySelector('#auth-password');
      if (passwordInput) {
        passwordInput.focus();
      }
      
      // Manejar confirmación
      const confirmBtn = authModal.querySelector('#auth-confirm');
      const cancelBtn = authModal.querySelector('#auth-cancel');
      
      const handleConfirm = async () => {
        const password = passwordInput.value.trim();
        if (!password) {
          window.showNotification('Por favor ingrese la contraseña', 'error');
          return;
        }
        
        try {
          // Verificar contraseña con el backend
          const isAuthorized = await window.verifyUserPassword(password);
          
          if (isAuthorized) {
            window.showNotification('Autorización exitosa. Cambio de vendedor permitido.', 'success');
            // Marcar que el cambio fue autorizado
            selectElement.dataset.authorized = 'true';
            closeAuthModal();
          } else {
            window.showNotification('Contraseña incorrecta', 'error');
            passwordInput.value = '';
            passwordInput.focus();
          }
        } catch (error) {
          console.error('Error verificando contraseña:', error);
          window.showNotification('Error al verificar autorización', 'error');
        }
      };
      
      const closeAuthModal = () => {
        if (!selectElement.dataset.authorized) {
          // Si no se autorizó, revertir selección
          selectElement.value = originalVendorId || '';
        }
        authModal.remove();
      };
      
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', closeAuthModal);
      
      // Permitir confirmar con Enter
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleConfirm();
        }
      });
    };

    // Función para crear modal de autorización
    window.createAuthorizationModal = () => {
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
      `;
      
      modal.innerHTML = `
        <div style="
          background: white;
          border-radius: 12px;
          padding: 24px;
          width: 400px;
          max-width: 90vw;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        ">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <i class="fa-solid fa-shield-halved" style="color: #f59e0b; font-size: 24px;"></i>
            <h3 style="margin: 0; color: #374151;">Autorización Requerida</h3>
          </div>
          
          <p style="margin: 0 0 16px 0; color: #6b7280;">
            Para cambiar el vendedor de esta cotización, ingrese su contraseña:
          </p>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151;">
              Contraseña:
            </label>
            <input 
              type="password" 
              id="auth-password"
              style="
                width: 100%;
                padding: 10px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 14px;
                box-sizing: border-box;
              "
              placeholder="Ingrese su contraseña"
            />
          </div>
          
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button 
              id="auth-cancel"
              style="
                padding: 8px 16px;
                border: 1px solid #d1d5db;
                background: white;
                color: #374151;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
              "
            >
              Cancelar
            </button>
            <button 
              id="auth-confirm"
              style="
                padding: 8px 16px;
                border: none;
                background: #3b82f6;
                color: white;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
              "
            >
              Autorizar
            </button>
          </div>
        </div>
      `;
      
      return modal;
    };

    // Función para verificar contraseña del usuario
    window.verifyUserPassword = async (password) => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No hay sesión activa');
        }
        
        const response = await fetch('/api/auth/verify-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ password })
        });
        
        if (!response.ok) {
          return false;
        }
        
        const result = await response.json();
        return result.valid === true;
      } catch (error) {
        console.error('Error verificando contraseña:', error);
        return false;
      }
    };

    // NOTA: Los listeners de clonación fueron eliminados
    // El botón de clonar ahora se maneja directamente en cotizacion_renta.html
    // que abre el modal cr-clone-modal cuando hay una cotización abierta

  } catch(e) {
    console.error('Error configurando eventos de clonación:', e);
  }

  // Función para abrir historial del cliente en modo clonación (fuera del try-catch)
  window.openClientHistoryForCloning = (clientData) => {
    console.log('🔄 [CLONACIÓN] Abriendo historial para cliente:', clientData);
    
    // Limpiar modo clonación del sessionStorage
    sessionStorage.removeItem('clone-mode');
    
    // Cerrar modal de selección de cliente
    window.safeCloseModal('client-selection-modal');
    
    // Construir URL del historial del cliente
    const clientId = clientData.id || clientData.id_cliente;
    const historialUrl = `clientes.html?action=historial&id=${clientId}&clone=true`;
    
    console.log('🔄 [CLONACIÓN] Abriendo ventana de historial:', historialUrl);
    
    // Abrir ventana de historial del cliente
    const historialWindow = window.open(
      historialUrl,
      'client-history-clone',
      'width=1200,height=800,scrollbars=yes,resizable=yes'
    );
    
    if (historialWindow) {
      console.log('🔄 [CLONACIÓN] Ventana de historial abierta exitosamente');
      window.showNotification(`Abriendo historial de ${clientData.nombre || clientData.empresa}...`, 'success');
    } else {
      console.error('🔄 [CLONACIÓN] Error: No se pudo abrir ventana de historial');
      window.showNotification('Error: No se pudo abrir el historial del cliente', 'error');
    }
  };

  // Listener global para tecla Escape (cerrar modales de forma segura)
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      // Lista de modales que pueden cerrarse con Escape
      const modalIds = [
        'client-selection-modal',
        'client-details-modal', 
        'cr-clone-modal',
        'cr-save-modal',
        'cr-save-client-modal'
      ];
      
      // Cerrar el primer modal visible que encuentre
      for (const modalId of modalIds) {
        const modal = document.getElementById(modalId);
        if (modal && !modal.hidden) {
          window.safeCloseModal(modalId);
          event.preventDefault();
          break;
        }
      }
    }
  });

  // Listener para recibir datos de cotización seleccionada
  window.addEventListener('message', function(event) {
    console.log('Mensaje recibido:', event.data);
    
    if (event.data && event.data.type === 'QUOTATION_SELECTED_FOR_CLONING') {
      const quotationData = event.data.quotationData;
      console.log('Cotización seleccionada para clonar:', quotationData);
      
      // Cerrar modales abiertos de forma segura
      window.safeCloseModal('client-selection-modal');
      window.safeCloseModal('client-details-modal');
      
      // Llenar el modal de clonación con los datos de la cotización seleccionada
      window.fillCloneModalWithQuotationData(quotationData);
      
      // Abrir el modal de clonación de forma segura
      window.safeOpenModal('cr-clone-modal');
      
      // Cargar vendedores
      window.loadVendors();
    }
  });

  // Función de notificación (reutilizar la existente)
  const showNotification = (message, type = 'success') => {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `cr-notification cr-notification--${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-weight: 500;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remover después de 4 segundos
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 4000);
  };

})();

// === SISTEMA DE HISTORIAL DE COTIZACIÓN ===
(() => {
  const API_URL = 'http://localhost:3001/api';
  let currentHistoryData = [];
  let filteredHistoryData = [];

  // Función para cargar el historial de la cotización
  const loadQuotationHistory = async () => {
    try {
      showLoadingState();
      
      // Obtener ID de la cotización actual (simulado por ahora)
      const quotationId = getCurrentQuotationId();
      
      if (!quotationId) {
        showEmptyState('No se pudo identificar la cotización actual');
        return;
      }

      // Cargar información básica de la cotización
      await loadQuotationInfo(quotationId);
      
      // Cargar historial desde el backend
      const historyData = await fetchQuotationHistory(quotationId);
      
      if (!historyData || historyData.length === 0) {
        showEmptyState();
        return;
      }

      currentHistoryData = historyData;
      filteredHistoryData = [...historyData];
      
      // Renderizar historial
      renderHistoryTimeline(filteredHistoryData);
      updateHistoryStats(filteredHistoryData);
      loadUsersForFilter(filteredHistoryData);
      
      showContentState();

    } catch (error) {
      console.error('Error cargando historial:', error);
      showEmptyState('Error al cargar el historial');
    }
  };

  // Función para obtener ID de cotización actual
  const getCurrentQuotationId = () => {
    console.log('[HISTORIAL] Buscando ID de cotización...');
    
    // Intentar obtener ID de diferentes fuentes
    // 1. De la URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');
    console.log('[HISTORIAL] ID desde URL:', urlId);
    if (urlId && !isNaN(urlId)) {
      console.log('[HISTORIAL] ✅ Usando ID de URL:', urlId);
      return urlId;
    }
    
    // 2. De la cotización que se está editando
    console.log('[HISTORIAL] window.cotizacionEditandoId:', window.cotizacionEditandoId);
    if (window.cotizacionEditandoId) {
      console.log('[HISTORIAL] ✅ Usando ID de cotización editando:', window.cotizacionEditandoId);
      return window.cotizacionEditandoId;
    }
    
    // 3. De la cotización seleccionada para clonar
    console.log('[HISTORIAL] window.selectedQuotationForCloning:', window.selectedQuotationForCloning);
    if (window.selectedQuotationForCloning?.id_cotizacion) {
      console.log('[HISTORIAL] ✅ Usando ID de cotización para clonar:', window.selectedQuotationForCloning.id_cotizacion);
      return window.selectedQuotationForCloning.id_cotizacion;
    }
    
    // 4. Fallback a null (no usar DEMO-001 que causa error)
    console.warn('[HISTORIAL] ❌ No se encontró ID de cotización');
    return null;
  };

  // Función para cargar información de la cotización
  const loadQuotationInfo = async (quotationId) => {
    try {
      // Obtener datos actuales de la página o del backend
      const folio = document.getElementById('v-quote-number')?.value || quotationId;
      const estado = 'Borrador'; // Se obtendría del backend
      const revisiones = 3; // Se obtendría del backend
      const ultimaMod = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Llenar información en la modal
      const modal = document.getElementById('cr-history-modal');
      if (modal) {
        const folioEl = modal.querySelector('#cr-history-folio');
        const estadoEl = modal.querySelector('#cr-history-estado');
        const revisionesEl = modal.querySelector('#cr-history-revisiones');
        const ultimaModEl = modal.querySelector('#cr-history-ultima-mod');

        if (folioEl) folioEl.textContent = folio;
        if (estadoEl) estadoEl.textContent = estado;
        if (revisionesEl) revisionesEl.textContent = revisiones;
        if (ultimaModEl) ultimaModEl.textContent = ultimaMod;
      }
    } catch (error) {
      console.error('Error cargando info de cotización:', error);
    }
  };

  // Función para obtener historial del backend
  const fetchQuotationHistory = async (quotationId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/cotizaciones/${quotationId}/historial`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Si no se encuentra, usar datos simulados para demo
          return getFallbackHistoryData();
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transformar datos del backend al formato esperado por el frontend
      return transformBackendHistoryData(data.historial || []);
      
    } catch (error) {
      console.error('Error obteniendo historial:', error);
      // En caso de error, usar datos simulados
      return getFallbackHistoryData();
    }
  };

  // Función para obtener datos simulados como fallback
  const getFallbackHistoryData = () => {
    return [
      {
        id: 1,
        fecha: '2024-10-20T10:30:00Z',
        usuario: { nombre: 'Irving Arellano', rol: 'Ingeniero en Sistemas' },
        tipo: 'creacion',
        descripcion: 'Cotización creada',
        cambios: {
          estado_nuevo: 'Borrador',
          total_nuevo: 15000.00
        },
        motivo: 'Creación inicial de cotización'
      },
      {
        id: 2,
        fecha: '2024-10-20T11:15:00Z',
        usuario: { nombre: 'Karla Rentería', rol: 'Rentas' },
        tipo: 'productos',
        descripcion: 'Productos agregados al carrito',
        cambios: {
          productos_agregados: ['Andamio Tubular 2x2', 'Plataforma Metálica'],
          total_anterior: 15000.00,
          total_nuevo: 18500.00
        },
        motivo: 'Agregado de productos adicionales solicitados por cliente'
      },
      {
        id: 3,
        fecha: '2024-10-20T14:22:00Z',
        usuario: { nombre: 'Bryan Dirección', rol: 'director general' },
        tipo: 'estado',
        descripcion: 'Estado cambiado de Borrador a Revisión',
        cambios: {
          estado_anterior: 'Borrador',
          estado_nuevo: 'Revisión',
          total_actual: 18500.00
        },
        motivo: 'Revisión por monto alto - requiere aprobación gerencial'
      }
    ];
  };

  // Función para transformar datos del backend al formato del frontend
  const transformBackendHistoryData = (backendHistory) => {
    return backendHistory.map((entry, index) => ({
      id: index + 1,
      fecha: entry.fecha,
      usuario: entry.usuario_info || { nombre: 'Usuario desconocido', rol: 'Sin rol' },
      tipo: detectChangeType(entry.cambios),
      descripcion: generateDescription(entry.cambios),
      cambios: entry.cambios,
      motivo: entry.motivo || 'Sin motivo especificado'
    }));
  };

  // Función para detectar el tipo de cambio
  const detectChangeType = (cambios) => {
    if (cambios.estado_anterior || cambios.estado_nuevo) return 'estado';
    if (cambios.total_anterior || cambios.total_nuevo) return 'total';
    if (cambios.vendedor_anterior || cambios.vendedor_nuevo) return 'vendedor';
    if (cambios.id_cliente_anterior || cambios.id_cliente_nuevo) return 'cliente';
    if (cambios.productos_agregados) return 'productos';
    return 'modificacion';
  };

  // Función para generar descripción basada en cambios
  const generateDescription = (cambios) => {
    if (cambios.estado_anterior && cambios.estado_nuevo) {
      return `Estado cambiado de ${cambios.estado_anterior} a ${cambios.estado_nuevo}`;
    }
    if (cambios.total_anterior && cambios.total_nuevo) {
      return `Total modificado de $${cambios.total_anterior} a $${cambios.total_nuevo}`;
    }
    if (cambios.vendedor_anterior && cambios.vendedor_nuevo) {
      return `Vendedor reasignado de ${cambios.vendedor_anterior} a ${cambios.vendedor_nuevo}`;
    }
    if (cambios.productos_agregados) {
      return `Productos agregados: ${cambios.productos_agregados.join(', ')}`;
    }
    return 'Cotización modificada';
  };

  // Función para renderizar el timeline del historial
  const renderHistoryTimeline = (historyData) => {
    const container = document.getElementById('cr-history-content');
    if (!container) return;

    container.innerHTML = '';

    // Crear línea de tiempo
    const timeline = document.createElement('div');
    timeline.style.cssText = `
      position: relative;
      padding-left: 30px;
    `;

    // Línea vertical del timeline
    const timelineLine = document.createElement('div');
    timelineLine.style.cssText = `
      position: absolute;
      left: 15px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: linear-gradient(to bottom, #3b82f6, #e5e7eb);
    `;
    timeline.appendChild(timelineLine);

    // Renderizar cada entrada del historial
    historyData.forEach((entry, index) => {
      const timelineItem = createTimelineItem(entry, index === 0);
      timeline.appendChild(timelineItem);
    });

    container.appendChild(timeline);
  };

  // Función para crear un elemento del timeline
  const createTimelineItem = (entry, isLatest = false) => {
    const item = document.createElement('div');
    item.style.cssText = `
      position: relative;
      margin-bottom: 24px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      ${isLatest ? 'border-color: #3b82f6; box-shadow: 0 4px 12px rgba(59,130,246,0.15);' : ''}
    `;

    // Punto del timeline
    const timelinePoint = document.createElement('div');
    timelinePoint.style.cssText = `
      position: absolute;
      left: -23px;
      top: 20px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${getTypeColor(entry.tipo)};
      border: 3px solid white;
      box-shadow: 0 0 0 2px ${getTypeColor(entry.tipo)};
    `;
    item.appendChild(timelinePoint);

    // Contenido del item
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 8px;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <i class="${getTypeIcon(entry.tipo)}" style="color: ${getTypeColor(entry.tipo)};"></i>
            <span style="font-weight: 600; color: #1f2937;">${entry.descripcion}</span>
            ${isLatest ? '<span style="background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">ÚLTIMO</span>' : ''}
          </div>
          <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
            Por <strong>${entry.usuario.nombre}</strong> (${entry.usuario.rol}) • 
            ${formatDate(entry.fecha)}
          </div>
        </div>
      </div>
      
      ${entry.motivo ? `
        <div style="background: #f9fafb; border-left: 3px solid ${getTypeColor(entry.tipo)}; padding: 8px 12px; margin-bottom: 12px; border-radius: 0 6px 6px 0;">
          <div style="font-size: 13px; color: #374151;">
            <i class="fa-solid fa-quote-left" style="opacity: 0.5; margin-right: 4px;"></i>
            ${entry.motivo}
          </div>
        </div>
      ` : ''}
      
      ${renderChangesDetails(entry.cambios, entry.tipo)}
    `;
    
    item.appendChild(content);
    return item;
  };

  // Función para renderizar detalles de cambios
  const renderChangesDetails = (cambios, tipo) => {
    if (!cambios) return '';

    let details = '<div style="background: #f8fafc; border-radius: 6px; padding: 12px; font-size: 13px;">';
    details += '<div style="font-weight: 500; color: #374151; margin-bottom: 8px;">Detalles del cambio:</div>';
    details += '<div style="display: grid; gap: 4px;">';

    Object.entries(cambios).forEach(([key, value]) => {
      const label = getChangeLabel(key);
      const formattedValue = formatChangeValue(value, key);
      details += `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #6b7280;">${label}:</span>
          <span style="color: #1f2937; font-weight: 500;">${formattedValue}</span>
        </div>
      `;
    });

    details += '</div></div>';
    return details;
  };

  // Funciones auxiliares para el timeline
  const getTypeColor = (tipo) => {
    const colors = {
      'creacion': '#10b981',
      'estado': '#f59e0b',
      'productos': '#3b82f6',
      'vendedor': '#8b5cf6',
      'cliente': '#ef4444',
      'total': '#06b6d4'
    };
    return colors[tipo] || '#6b7280';
  };

  const getTypeIcon = (tipo) => {
    const icons = {
      'creacion': 'fa-solid fa-plus-circle',
      'estado': 'fa-solid fa-exchange-alt',
      'productos': 'fa-solid fa-cubes',
      'vendedor': 'fa-solid fa-user-tie',
      'cliente': 'fa-solid fa-user',
      'total': 'fa-solid fa-dollar-sign'
    };
    return icons[tipo] || 'fa-solid fa-edit';
  };

  const getChangeLabel = (key) => {
    const labels = {
      'estado_anterior': 'Estado anterior',
      'estado_nuevo': 'Estado nuevo',
      'total_anterior': 'Total anterior',
      'total_nuevo': 'Total nuevo',
      'total_actual': 'Total actual',
      'vendedor_anterior': 'Vendedor anterior',
      'vendedor_nuevo': 'Vendedor nuevo',
      'productos_agregados': 'Productos agregados'
    };
    return labels[key] || key.replace('_', ' ');
  };

  const formatChangeValue = (value, key) => {
    if (key.includes('total') && typeof value === 'number') {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
      }).format(value);
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value?.toString() || '—';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para actualizar estadísticas
  const updateHistoryStats = (historyData) => {
    const totalChanges = historyData.length;
    const uniqueUsers = [...new Set(historyData.map(h => h.usuario.nombre))].length;
    const firstDate = new Date(Math.min(...historyData.map(h => new Date(h.fecha))));
    const lastDate = new Date(Math.max(...historyData.map(h => new Date(h.fecha))));
    const daysDiff = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) || 1;

    // Actualizar elementos
    const totalEl = document.getElementById('cr-stats-total-changes');
    const usersEl = document.getElementById('cr-stats-users');
    const daysEl = document.getElementById('cr-stats-days');

    if (totalEl) totalEl.textContent = totalChanges;
    if (usersEl) usersEl.textContent = uniqueUsers;
    if (daysEl) daysEl.textContent = daysDiff;

    // Mostrar estadísticas
    const statsContainer = document.getElementById('cr-history-stats');
    if (statsContainer) {
      statsContainer.style.display = 'block';
    }
  };

  // Función para cargar usuarios en filtro
  const loadUsersForFilter = (historyData) => {
    const userSelect = document.getElementById('cr-history-filter-user');
    if (!userSelect) return;

    const uniqueUsers = [...new Set(historyData.map(h => h.usuario.nombre))];
    
    // Limpiar opciones existentes (excepto la primera)
    userSelect.innerHTML = '<option value="">Todos los usuarios</option>';
    
    uniqueUsers.forEach(userName => {
      const option = document.createElement('option');
      option.value = userName;
      option.textContent = userName;
      userSelect.appendChild(option);
    });
  };

  // Función para filtrar historial
  const filterHistory = () => {
    const typeFilter = document.getElementById('cr-history-filter-type')?.value || '';
    const userFilter = document.getElementById('cr-history-filter-user')?.value || '';

    filteredHistoryData = currentHistoryData.filter(entry => {
      const matchesType = !typeFilter || entry.tipo === typeFilter;
      const matchesUser = !userFilter || entry.usuario.nombre === userFilter;
      return matchesType && matchesUser;
    });

    renderHistoryTimeline(filteredHistoryData);
    updateHistoryStats(filteredHistoryData);
  };

  // Función para exportar historial
  const exportHistory = () => {
    try {
      const csvContent = generateHistoryCSV(filteredHistoryData);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `historial_cotizacion_${getCurrentQuotationId()}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showNotification('Historial exportado exitosamente', 'success');
    } catch (error) {
      console.error('Error exportando historial:', error);
      showNotification('Error al exportar historial', 'error');
    }
  };

  // Función para generar CSV
  const generateHistoryCSV = (historyData) => {
    const headers = ['Fecha', 'Usuario', 'Rol', 'Tipo', 'Descripción', 'Motivo', 'Detalles'];
    const rows = historyData.map(entry => [
      formatDate(entry.fecha),
      entry.usuario.nombre,
      entry.usuario.rol,
      entry.tipo,
      entry.descripcion,
      entry.motivo || '',
      JSON.stringify(entry.cambios || {})
    ]);

    return [headers, ...rows].map(row => 
      row.map(field => `"${field?.toString().replace(/"/g, '""') || ''}"`).join(',')
    ).join('\n');
  };

  // Estados de la modal
  const showLoadingState = () => {
    document.getElementById('cr-history-loading')?.style.setProperty('display', 'block');
    document.getElementById('cr-history-empty')?.style.setProperty('display', 'none');
    document.getElementById('cr-history-content')?.style.setProperty('display', 'none');
    document.getElementById('cr-history-stats')?.style.setProperty('display', 'none');
  };

  const showEmptyState = (message = null) => {
    document.getElementById('cr-history-loading')?.style.setProperty('display', 'none');
    document.getElementById('cr-history-empty')?.style.setProperty('display', 'block');
    document.getElementById('cr-history-content')?.style.setProperty('display', 'none');
    document.getElementById('cr-history-stats')?.style.setProperty('display', 'none');
    
    if (message) {
      const emptyDiv = document.getElementById('cr-history-empty');
      if (emptyDiv) {
        const messageDiv = emptyDiv.querySelector('div:last-child');
        if (messageDiv) messageDiv.textContent = message;
      }
    }
  };

  const showContentState = () => {
    document.getElementById('cr-history-loading')?.style.setProperty('display', 'none');
    document.getElementById('cr-history-empty')?.style.setProperty('display', 'none');
    document.getElementById('cr-history-content')?.style.setProperty('display', 'block');
  };

  // Event listeners
  try {
    // Filtros
    const typeFilter = document.getElementById('cr-history-filter-type');
    const userFilter = document.getElementById('cr-history-filter-user');
    const refreshBtn = document.getElementById('cr-history-refresh');
    const exportBtn = document.getElementById('cr-history-export');

    if (typeFilter) typeFilter.addEventListener('change', filterHistory);
    if (userFilter) userFilter.addEventListener('change', filterHistory);
    if (refreshBtn) refreshBtn.addEventListener('click', loadQuotationHistory);
    if (exportBtn) exportBtn.addEventListener('click', exportHistory);

  } catch(e) {
    console.error('Error configurando eventos de historial:', e);
  }

  // Función de notificación (reutilizar)
  const showNotification = (message, type = 'success') => {
    const notification = document.createElement('div');
    notification.className = `cr-notification cr-notification--${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-weight: 500;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 4000);
  };

  // Exponer función global para ser llamada desde el menú
  window.loadQuotationHistory = loadQuotationHistory;

  // ============================================================================
  // FUNCIONALIDAD DE CLONACIÓN DE COTIZACIONES
  // ============================================================================

  /**
   * Inicializar funcionalidad de clonación
   */
  const initCloneFunctionality = () => {
    window.__cloneFlowV2Active = true;
    console.log('[CLONE] Inicializando funcionalidad de clonación');

    // Elementos del DOM
    const cloneModal = document.getElementById('cr-clone-modal');
    const confirmModal = document.getElementById('cr-clone-confirm-modal');
    const selectClientBtn = document.getElementById('cr-clone-select-client');
    const keepClientBtn = document.getElementById('cr-clone-keep-client');
    const selectAllBtn = document.getElementById('cr-clone-select-all');
    const cloneBtn = document.getElementById('cr-clone-btn');
    const confirmProceedBtn = document.getElementById('cr-clone-confirm-proceed');
    const confirmCancelBtn = document.getElementById('cr-clone-confirm-cancel-btn');
    const newDateInput = document.getElementById('cr-clone-new-date');

    // Estado de la clonación
    let cloneState = {
      originalQuotation: null,
      newClient: null,
      newClientId: null,
      keepOriginalClient: true,
      newVendor: null,
      newDate: null,
      reason: '',
      options: {
        resetState: true,
        copyProducts: true,
        copyShipping: false
      }
    };

    /**
     * Llenar modal con datos de cotización actual
     */
    window.fillCloneModalWithCurrentQuotation = async () => {
      try {
        console.log('[CLONE] Llenando modal con cotización actual');

        // Obtener datos de la cotización actual
        const quotationData = window.collectQuotationData();
        
        // Si hay un ID de cotización en edición, cargar datos completos
        if (window.cotizacionEditandoId) {
          try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3001/api/cotizaciones/${window.cotizacionEditandoId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
              const fullData = await response.json();
              quotationData.id_cotizacion = fullData.id_cotizacion;
              quotationData.numero_folio = fullData.numero_folio || fullData.numero_cotizacion;
              quotationData.fecha_creacion = fullData.fecha_creacion || fullData.fecha_cotizacion;
              quotationData.id_vendedor = fullData.id_vendedor;
              quotationData.vendedor_nombre = fullData.vendedor_nombre;
              quotationData.id_cliente = fullData.id_cliente ?? quotationData.id_cliente;
              quotationData.cliente_nombre = fullData.cliente_nombre || fullData.nombre_cliente || fullData.contacto_nombre || quotationData.cliente_nombre;
              quotationData.contacto_nombre = fullData.contacto_nombre || quotationData.contacto_nombre;
              quotationData.contacto_email = fullData.contacto_email || quotationData.contacto_email;
              quotationData.contacto_telefono = fullData.contacto_telefono || quotationData.contacto_telefono;
            }
          } catch (error) {
            console.error('[CLONE] Error cargando datos completos:', error);
          }
        }

        // Resolver datos del cliente original combinando backend, DOM y storage
        let storedClient = null;
        let storedClientId = null;
        const storedClientRaw = localStorage.getItem('cr_selected_client');
        if (storedClientRaw) {
          try {
            storedClient = JSON.parse(storedClientRaw);
            storedClientId = storedClient?.id_cliente || storedClient?.id || null;
            if (storedClientId !== null && !Number.isNaN(Number(storedClientId))) {
              storedClientId = Number(storedClientId);
            } else {
              storedClientId = null;
            }
          } catch (err) {
            console.warn('[CLONE] No se pudo parsear cr_selected_client:', err);
            storedClient = null;
            storedClientId = null;
          }
        }

        const clientHiddenValue = document.getElementById('v-extra')?.value;
        const domClientId = clientHiddenValue && !Number.isNaN(Number(clientHiddenValue))
          ? Number(clientHiddenValue)
          : null;
        const domClientName = document.getElementById('v-client-label')?.textContent?.trim();

        const backendClientId = quotationData.id_cliente ? Number(quotationData.id_cliente) : null;

        if (storedClientId && backendClientId && storedClientId !== backendClientId) {
          console.log('[CLONE] Limpiando cr_selected_client por desajuste con la cotización actual');
          localStorage.removeItem('cr_selected_client');
          storedClient = null;
          storedClientId = null;
        }

        if (storedClientId && domClientId && storedClientId !== domClientId) {
          console.log('[CLONE] Ignorando cr_selected_client: mismatch con el cliente del formulario');
          storedClient = null;
          storedClientId = null;
        }

        const inferredClientId = [
          backendClientId,
          domClientId,
          storedClientId
        ].find(value => value !== undefined && value !== null && value !== '' && !Number.isNaN(Number(value))) ?? null;

        const inferredClientName = [
          quotationData.cliente_nombre,
          quotationData.contacto_nombre,
          domClientName,
          storedClient?.empresa,
          storedClient?.nombre,
          storedClient?.razon_social
        ].find(name => name && name !== '-' && name !== 'Seleccionar cliente') || 'No especificado';

        quotationData.id_cliente = inferredClientId ? Number(inferredClientId) : quotationData.id_cliente;
        quotationData.cliente_nombre = inferredClientName;

        // Si seguimos sin nombre de cliente pero tenemos ID, consultar al backend
        if ((!quotationData.cliente_nombre || quotationData.cliente_nombre === 'No especificado') && quotationData.id_cliente) {
          try {
            const token = localStorage.getItem('token');
            const clienteResponse = await fetch(`http://localhost:3001/api/clientes/${quotationData.id_cliente}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (clienteResponse.ok) {
              const clienteInfo = await clienteResponse.json();
              quotationData.cliente_nombre = clienteInfo.empresa || clienteInfo.nombre || quotationData.cliente_nombre;
            }
          } catch (error) {
            console.warn('[CLONE] No fue posible obtener el nombre del cliente original:', error);
          }
        }

        // Reiniciar cualquier cliente nuevo previo
        cloneState.newClient = null;
        cloneState.newClientId = null;
        cloneState.keepOriginalClient = true;

        cloneState.originalQuotation = quotationData;

        // Llenar información básica
        document.querySelector('[data-chip-folio]').textContent = 
          quotationData.numero_folio || quotationData.numero_cotizacion || 'REN-XXXX-XXXXXX';
        
        document.querySelector('[data-chip-total]').textContent = 
          new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
            .format(quotationData.total || 0);
        
        const fecha = quotationData.fecha_creacion || quotationData.fecha_cotizacion || new Date();
        document.querySelector('[data-chip-fecha-original]').textContent = 
          new Date(fecha).toLocaleDateString('es-MX');

        // Cliente actual
        const clientDisplayName = quotationData.cliente_nombre || 'No especificado';
        const clientLabelElement = document.getElementById('cr-clone-current-client');
        if (clientLabelElement) {
          clientLabelElement.textContent = clientDisplayName;
          clientLabelElement.dataset.clientId = quotationData.id_cliente || '';
        }

        // Vendedor actual
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const vendorName = quotationData.vendedor_nombre || currentUser.nombre || 'No asignado';
        document.getElementById('cr-clone-current-vendor').textContent = vendorName;

        // Establecer fecha actual por defecto
        if (newDateInput) {
          newDateInput.value = new Date().toISOString().split('T')[0];
        }

        // Cargar vendedores
        await loadVendors();

        // Abrir modal
        cloneModal.hidden = false;
        cloneModal.setAttribute('aria-hidden', 'false');

        console.log('[CLONE] Modal llenado exitosamente');
      } catch (error) {
        console.error('[CLONE] Error llenando modal:', error);
        showNotification('Error al preparar la clonación', 'error');
      }
    };

    /**
     * Cargar lista de vendedores
     */
    const loadVendors = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3001/api/usuarios', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error cargando vendedores');

        const usuarios = await response.json();
        const vendorSelect = document.getElementById('cr-clone-vendor-select');
        
        if (!vendorSelect) return;

        // Limpiar opciones existentes excepto la primera
        vendorSelect.innerHTML = '<option value="">Mantener vendedor actual</option>';

        // Filtrar solo vendedores relevantes
        const vendedores = usuarios.filter(u => 
          ['Rentas', 'Ventas', 'director general', 'Administrador'].includes(u.rol)
        );

        vendedores.forEach(vendedor => {
          const option = document.createElement('option');
          option.value = vendedor.id_usuario || vendedor.id;
          option.textContent = `${vendedor.nombre} (${vendedor.rol})`;
          vendorSelect.appendChild(option);
        });

        console.log('[CLONE] Vendedores cargados:', vendedores.length);
      } catch (error) {
        console.error('[CLONE] Error cargando vendedores:', error);
      }
    };

    /**
     * Manejar selección de nuevo cliente
     */
    if (selectClientBtn) {
      selectClientBtn.addEventListener('click', () => {
        console.log('[CLONE] Abriendo selector de clientes');
        
        // Abrir modal de selección de clientes
        const clientModal = document.getElementById('v-client-modal');
        if (clientModal) {
          clientModal.hidden = false;
          clientModal.setAttribute('aria-hidden', 'false');
          
          // Marcar que estamos en modo clonación
          clientModal.setAttribute('data-clone-mode', 'true');
          
          // Escuchar selección de cliente
          window.addEventListener('message', function handleClientSelection(event) {
            if (event.data && event.data.type === 'CLIENT_SELECTED_FOR_CLONE') {
              const clientData = event.data.clientData;
              
              // Guardar nuevo cliente
              cloneState.newClient = clientData;
              const clientIdValue = clientData.id_cliente || clientData.id;
              cloneState.newClientId = clientIdValue ? parseInt(clientIdValue, 10) : null;
              cloneState.keepOriginalClient = false;
              
              // Mostrar cliente seleccionado
              const selectedClientDiv = document.getElementById('cr-clone-selected-client');
              const clientNameSpan = document.getElementById('cr-clone-new-client-name');
              
              if (selectedClientDiv && clientNameSpan) {
                clientNameSpan.textContent = clientData.nombre || clientData.razon_social || 'Cliente seleccionado';
                selectedClientDiv.style.display = 'block';
              }
              
              // Cerrar modal de clientes
              clientModal.hidden = true;
              clientModal.setAttribute('aria-hidden', 'true');
              clientModal.removeAttribute('data-clone-mode');
              
              // Remover listener
              window.removeEventListener('message', handleClientSelection);
              
              console.log('[CLONE] Nuevo cliente seleccionado:', clientData);
            }
          });
        }
      });
    }

    /**
     * Manejar mantener cliente actual
     */
    if (keepClientBtn) {
      keepClientBtn.addEventListener('click', () => {
        cloneState.newClient = null;
        cloneState.keepOriginalClient = true;
        
        // Ocultar div de nuevo cliente
        const selectedClientDiv = document.getElementById('cr-clone-selected-client');
        if (selectedClientDiv) {
          selectedClientDiv.style.display = 'none';
        }
        
        console.log('[CLONE] Manteniendo cliente original');
        showNotification('Se mantendrá el cliente original', 'success');
      });
    }

    /**
     * Manejar seleccionar todo
     */
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.cr-clone-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
          cb.checked = !allChecked;
        });
        
        selectAllBtn.innerHTML = allChecked 
          ? '<i class="fa-solid fa-check-double"></i> Seleccionar Todo'
          : '<i class="fa-solid fa-xmark"></i> Deseleccionar Todo';
      });
    }

    /**
     * Manejar botón de clonar (abrir modal de confirmación)
     */
    if (cloneBtn) {
      cloneBtn.addEventListener('click', () => {
        console.log('[CLONE] Preparando confirmación');

        // Recopilar datos del formulario
        cloneState.newDate = newDateInput?.value || new Date().toISOString().split('T')[0];
        cloneState.reason = document.getElementById('cr-clone-reason')?.value || '';
        cloneState.newVendor = document.getElementById('cr-clone-vendor-select')?.value || null;
        
        // Recopilar opciones
        cloneState.options = {
          resetState: document.getElementById('cr-clone-reset-state')?.checked || false,
          copyProducts: document.getElementById('cr-clone-copy-products')?.checked || false,
          copyShipping: document.getElementById('cr-clone-copy-shipping')?.checked || false
        };

        // Validar
        if (!cloneState.reason.trim()) {
          showNotification('Por favor ingrese el motivo de clonación', 'error');
          document.getElementById('cr-clone-reason')?.focus();
          return;
        }

        // Llenar modal de confirmación
        fillConfirmationModal();

        // Cerrar modal de configuración y abrir confirmación
        cloneModal.hidden = true;
        confirmModal.hidden = false;
        confirmModal.setAttribute('aria-hidden', 'false');
      });
    }

    /**
     * Llenar modal de confirmación
     */
    const fillConfirmationModal = () => {
      // Cotización original
      const originalFolioEl = document.getElementById('confirm-original-folio');
      if (originalFolioEl) {
        originalFolioEl.textContent = cloneState.originalQuotation?.numero_folio || 'N/A';
      }
      
      const originalClientEl = document.getElementById('confirm-original-client');
      if (originalClientEl) {
        originalClientEl.textContent = document.getElementById('cr-clone-current-client')?.textContent || 'N/A';
      }
      
      const originalTotalEl = document.getElementById('confirm-original-total');
      if (originalTotalEl) {
        originalTotalEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
          .format(cloneState.originalQuotation?.total || 0);
      }

      // Nueva cotización
      const newDateEl = document.getElementById('confirm-new-date');
      if (newDateEl) {
        newDateEl.textContent = new Date(cloneState.newDate).toLocaleDateString('es-MX');
      }
      
      const newClientEl = document.getElementById('confirm-new-client');
      if (newClientEl) {
        const newClientName = cloneState.newClient 
          ? (cloneState.newClient.nombre || cloneState.newClient.razon_social)
          : document.getElementById('cr-clone-current-client')?.textContent;
        newClientEl.textContent = newClientName || 'N/A';
      }
      
      const newStatusEl = document.getElementById('confirm-new-status');
      if (newStatusEl) {
        newStatusEl.textContent = 'Clonación';
      }

      // Opciones de clonación
      const optionsList = document.getElementById('confirm-options-list');
      if (optionsList) {
        optionsList.innerHTML = '';

        if (cloneState.options.resetState) {
          const div = document.createElement('div');
          div.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i> Resetear estado a "Borrador"';
          optionsList.appendChild(div);
        }

        if (cloneState.options.copyProducts) {
          const productosDiv = document.createElement('div');
          const productCount = Array.isArray(cloneState.originalQuotation?.productos_seleccionados)
            ? cloneState.originalQuotation.productos_seleccionados.length
            : 0;
          productosDiv.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> Copiar productos seleccionados (${productCount} productos)`;
          optionsList.appendChild(productosDiv);

          const accesoriosDiv = document.createElement('div');
          let accessoryCount = 0;
          if (Array.isArray(cloneState.originalQuotation?.accesorios_seleccionados)) {
            accessoryCount = cloneState.originalQuotation.accesorios_seleccionados.length;
          } else if (typeof cloneState.originalQuotation?.accesorios_seleccionados === 'string') {
            try {
              const parsed = JSON.parse(cloneState.originalQuotation.accesorios_seleccionados);
              accessoryCount = Array.isArray(parsed) ? parsed.length : 0;
            } catch (error) {
              accessoryCount = 0;
            }
          }
          accesoriosDiv.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> Copiar accesorios seleccionados (${accessoryCount} accesorios)`;
          optionsList.appendChild(accesoriosDiv);
        }

        if (cloneState.options.copyShipping) {
          const div = document.createElement('div');
          div.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i> Copiar configuración de envío';
          optionsList.appendChild(div);
        }
      }
      
      // Mostrar motivo
      const reasonContainer = document.getElementById('confirm-reason-container');
      const reasonText = document.getElementById('confirm-reason-text');
      if (reasonContainer && reasonText && cloneState.reason) {
        reasonText.textContent = cloneState.reason;
        reasonContainer.style.display = 'block';
      }
    };

    /**
     * Manejar confirmación de clonación
     */
    if (confirmProceedBtn) {
      confirmProceedBtn.addEventListener('click', async () => {
        try {
          console.log('[CLONE] Iniciando proceso de clonación');
          
          // Deshabilitar botón
          confirmProceedBtn.disabled = true;
          confirmProceedBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clonando...';

          // Preparar datos para el backend
          const clientId = cloneState.newClientId;
          const vendorId = cloneState.newVendor;
          const cotizacionId = cloneState.originalQuotation?.id_cotizacion || window.cotizacionEditandoId;

          const cloneData = {
            nueva_fecha: cloneState.newDate,
            nuevo_cliente_id: Number.isInteger(clientId) ? clientId : null,
            nuevo_vendedor_id: vendorId ? parseInt(vendorId, 10) : null,
            motivo_clonacion: cloneState.reason,
            resetear_estado: cloneState.options.resetState,
            copiar_productos: cloneState.options.copyProducts,
            copiar_envio: cloneState.options.copyShipping
          };

          console.log('[CLONE] Datos de clonación:', cloneData);

          // Llamar al backend
          const token = localStorage.getItem('token');
          const response = await fetch(`http://localhost:3001/api/cotizaciones/${cotizacionId}/clonar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(cloneData)
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('[CLONE] Error del backend:', errorData);
            throw new Error(errorData.error || errorData.message || 'Error al clonar cotización');
          }

          const result = await response.json();
          console.log('[CLONE] Cotización clonada exitosamente:', result);

          const clonedQuotation = result.clon || result;
          const nuevoFolio = clonedQuotation.numero_folio || clonedQuotation.numero_cotizacion;
          const nuevoId = clonedQuotation.id_cotizacion;

          // Cerrar modales
          confirmModal.hidden = true;
          cloneModal.hidden = true;

          // Mostrar éxito
          showNotification(`Cotización clonada exitosamente: ${nuevoFolio}`, 'success');

          // Abrir automáticamente la nueva cotización clonada
          setTimeout(() => {
            const cloneUrl = `cotizacion_renta.html?edit=${nuevoId}`;
            window.open(cloneUrl, '_blank');

            if (window.opener && !window.opener.closed) {
              window.close();
            }
          }, 1000);

        } catch (error) {
          console.error('[CLONE] Error en clonación:', error);
          showNotification(error.message || 'Error al clonar cotización', 'error');
          
          // Rehabilitar botón
          confirmProceedBtn.disabled = false;
          confirmProceedBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Clonación';
        }
      });
    }

    /**
     * Manejar cancelación
     */
    if (confirmCancelBtn) {
      confirmCancelBtn.addEventListener('click', () => {
        confirmModal.hidden = true;
        cloneModal.hidden = false;
      });
    }

    // Cerrar modal de confirmación con X
    const confirmCloseBtn = document.getElementById('cr-clone-confirm-cancel');
    if (confirmCloseBtn) {
      confirmCloseBtn.addEventListener('click', () => {
        confirmModal.hidden = true;
        cloneModal.hidden = false;
      });
    }

    console.log('[CLONE] Funcionalidad de clonación inicializada');
  };

  // Inicializar al cargar
  try {
    initCloneFunctionality();
  } catch (error) {
    console.error('[CLONE] Error inicializando clonación:', error);
  }

  // Nota: window.fillCloneModalWithCurrentQuotation ya está expuesta dentro de initCloneFunctionality

})();
