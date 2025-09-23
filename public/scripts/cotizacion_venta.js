/* Cotización Renta - lógica de flujo y UI
   Reutiliza patrones de transiciones/responsivo similares a servicios */

   (() => {
    // Backend config (alineado con public/js/cotizaciones.js)
    const API_URL = 'http://localhost:3001/api';
    const EQUIPOS_URL = `${API_URL}/equipos`;
    // DEV: Forzar uso de datos mock para evitar pantalla vacía si la API falla
    const FORCE_MOCK = true; // cambia a false cuando tu API esté OK
  
    function checkAuth() {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = 'login.html';
        return null;
      }
      return token;
    }

  // --- Helpers accesorios ---
  function getAccessoryId(card) {
    if (!card) return '';
    // Preferimos atributo de datos
    let id = card.getAttribute('data-name');
    if (id) return id;
    // Fallback al nombre visible
    const nameEl = card.querySelector('.cr-product__name, .cr-name, h3');
    return (nameEl?.textContent || '').trim();
  }

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
    }
  
    function enableFabDrag() {
      const fab = els.notesFab;
      if (!fab) return;
      let dragging = false; let moved = false;
      let startY = 0; let startTop = 0;
      const onMove = (e) => {
        if (!dragging) return;
        const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
        if (clientY == null) return;
        const dy = clientY - startY;
        if (Math.abs(dy) > 3) moved = true;
        let newTop = startTop + dy;
        const maxTop = window.innerHeight - fab.offsetHeight - 6;
        newTop = Math.max(60, Math.min(maxTop, newTop));
        fab.style.top = newTop + 'px';
        fab.style.right = '20px';
        fab.style.left = 'auto';
        e.preventDefault();
      };
      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onUp);
        try {
          const rect = fab.getBoundingClientRect();
          localStorage.setItem('cr_fab_pos', JSON.stringify({ top: rect.top }));
        } catch {}
        if (moved) {
          fab.__suppressClick = true;
          setTimeout(() => { fab.__suppressClick = false; }, 0);
        }
      };
      const onDown = (e) => {
        dragging = true; moved = false;
        const rect = fab.getBoundingClientRect();
        const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY);
        startY = clientY; startTop = rect.top;
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onUp);
        e.preventDefault();
      };
      fab.addEventListener('mousedown', onDown);
      fab.addEventListener('touchstart', onDown, { passive: false });
      fab.addEventListener('click', (e) => { if (fab.__suppressClick) { e.stopPropagation(); e.preventDefault(); } });
      applyFabSavedPosition();
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
      if (!els.notesFloater) return;
      els.notesFloater.hidden = false;
      els.notesFloater.style.display = 'flex';
      // Mobile-friendly sizing/position
      try {
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile) {
          els.notesFloater.style.right = '8px';
          els.notesFloater.style.left = 'auto';
          els.notesFloater.style.top = '80px';
          els.notesFloater.style.width = `calc(100vw - 16px)`;
          els.notesFloater.style.maxWidth = 'none';
        }
      } catch {}
      if (els.notesStep) els.notesStep.textContent = currentStepLabel();
      renderNotes();
      // re-clamp after rendering for current viewport
      applyResponsiveTweaks();
    }
    function closeNotesFloater() {
      if (els.notesFloater) {
        els.notesFloater.hidden = true;
        els.notesFloater.style.display = 'none';
      }
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
        // Do not start drag when clicking close button or interactive elements
        const t = e.target;
        const tag = (t.tagName || '').toLowerCase();
        if (t.closest('[data-close-notes]') || tag === 'button' || tag === 'input' || tag === 'textarea' || tag === 'select' || t.closest('button') || t.closest('a')) {
          return; // allow normal click (e.g., close)
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
    };
  
    // Filtro por búsqueda y categoría (Venta)
    function filterProducts() {
      try {
        const q = (els.search?.value || '').trim().toLowerCase();
        const filters = [...document.querySelectorAll('#cr-filters input:checked')].map(i => i.value);
        state.filtered = (state.products || []).filter(p => (
          (!q || p.name.toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q) || (p.brand||'').toLowerCase().includes(q)) &&
          (!filters.length || filters.includes(p.category))
        ));
        renderProducts(state.filtered);
      } catch (e) {
        console.error('[filterProducts] error:', e);
      }
    }
    // Compat global si hubiese atributos inline
    window.filterProducts = filterProducts;
  
    // Renderizar productos (grid por defecto). En la página de Venta (#v-quote-header),
    // cuando state.view === 'list' mostramos una tabla para facilitar captura masiva.
    function renderProducts(list) {
  
      if (!els.productsWrap) return;
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
                <th>Importe</th>
                <th>Img</th>
                <th style="width:120px;">Acción</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>`;
        els.productsWrap.appendChild(tableWrap);
        const tbody = tableWrap.querySelector('tbody');
  
        list.forEach(p => {
          const unit = Number(p.price?.diario || 0);
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><input type="number" min="1" value="1" class="cr-qty-input" style="width:70px;"></td>
            <td style="text-align:left;">
              <div style="font-weight:700;">${p.id}</div>
              <div style="color:#475569;">${p.name}</div>
              <small style="color:#94a3b8;">${p.desc || ''}</small>
            </td>
            <td>${(p.stock ?? 0)}<br><small>PZA</small></td>
            <td>${currency(unit)}</td>
            <td class="cr-line-total">${currency(unit)}</td>
            <td style="text-align:center;"><img src="${p.image}" alt="${p.name}" style="width:28px; height:28px; object-fit:cover; border-radius:6px;" onerror="this.src='img/default.jpg'"/></td>
            <td><button class="cr-btn cr-btn--sm" type="button" data-action="add" data-id="${p.id}"><i class="fa-solid fa-cart-plus"></i> Agregar</button></td>`;
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
          const tr = btn.closest('tr');
          const qtyInput = tr.querySelector('.cr-qty-input');
          const id = btn.getAttribute('data-id');
          const qty = Math.max(1, parseInt(qtyInput.value || '1', 10));
          for (let i = 0; i < qty; i++) addToCart(id);
        });
  
        if (els.foundCount) els.foundCount.textContent = String(list.length);
        if (els.resultsText) els.resultsText.textContent = `Mostrando ${list.length} producto${list.length !== 1 ? 's' : ''}`;
        els.productsWrap.classList.remove('cr-grid', 'cr-list', 'cr-carousel');
        els.productsWrap.style.display = 'block';
        const wrapList = document.querySelector('.cr-carousel-wrap');
        if (wrapList) wrapList.classList.remove('is-carousel');
        // Forzar ocultamiento de flechas en LISTA
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
        card.innerHTML = `
          <div class="cr-product__media">
            <img src="${p.image}" alt="${p.name}">
            <span class="cr-badge">${p.quality || ''}</span>
            <span class="cr-stock">${p.stock} disponibles</span>
          </div>
          <div class="cr-product__body">
            <div class="cr-name">${p.name}</div>
            <div class="cr-desc">${p.desc || ''}</div>
            <div class="cr-meta">
              <span>SKU: ${p.id}</span>
              <span>Marca: ${p.brand||''}</span>
            </div>
            <div class="cr-product__actions">
              <button class="cr-btn" type="button" data-id="${p.id}"><i class="fa-solid fa-cart-plus"></i> Agregar</button>
              <div class="cr-pricebar"><span class="cr-from">Desde</span> <span class="cr-price">${currency(Number(p.price?.diario||0))}/día</span></div>
            </div>
          </div>`;
        els.productsWrap.appendChild(card);
      });
  
      if (els.foundCount) els.foundCount.textContent = String(list.length);
      if (els.resultsText) els.resultsText.textContent = `Mostrando ${list.length} producto${list.length !== 1 ? 's' : ''}`;
      els.productsWrap.querySelectorAll('[data-id]').forEach(btn => {
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
      const subEl = document.getElementById('cr-summary-subtotal');
      const discEl = document.getElementById('cr-summary-discount');
      const ivaEl = document.getElementById('cr-summary-iva');
      const totalEl = document.getElementById('cr-summary-total');
      if (!tbody || !subEl || !discEl || !ivaEl || !totalEl) return; // La card puede no estar en este paso
  
      // Lectura no intrusiva del estado actual
      const days = Math.max(1, parseInt(els.days?.value || state.days || 1, 10));
      let total = 0;
      state.cart.forEach(ci => {
        const p = state.products.find(x => x.id === ci.id);
        if (!p) return;
        const daily = Number(p.price?.diario || 0);
        total += daily * ci.qty * days;
      });
      els.total.textContent = currency(total);
      const totalUnits = state.cart.reduce((a,b)=>a+b.qty,0);
      els.totalDetail.textContent = totalUnits > 0 ? `Total por ${totalUnits} unidad(es) × ${days} día(s)` : 'Sin productos seleccionados';
      const delivery = els.needDelivery?.checked ? Math.round(total * 0.3) : 0;
      state.deliveryExtra = delivery;
      if (els.deliveryExtra) els.deliveryExtra.textContent = `Costo adicional de entrega: ${currency(delivery)}`;
  
      // Calcular total de accesorios aplicando días
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
  
    // Enlazar eventos para refrescar el resumen (sin tocar tu lógica)
    function bindQuoteSummaryEvents() {
      try {
        const daysEl = document.getElementById('cr-days');
        if (daysEl && !daysEl.__boundSummary) {
          daysEl.addEventListener('input', () => renderQuoteSummaryTable());
          daysEl.addEventListener('change', () => renderQuoteSummaryTable());
          daysEl.__boundSummary = true;
        }
  
        const applyEl = document.getElementById('cr-summary-apply-discount');
        if (applyEl && !applyEl.__boundSummary) {
          applyEl.addEventListener('change', () => renderQuoteSummaryTable());
          applyEl.__boundSummary = true;
        }
  
        const pctEl = document.getElementById('cr-summary-discount-percent-input');
        if (pctEl && !pctEl.__boundSummary) {
          pctEl.addEventListener('input', () => renderQuoteSummaryTable());
          pctEl.addEventListener('change', () => renderQuoteSummaryTable());
          pctEl.__boundSummary = true;
        }
  
        // También refrescar cuando cambian los km o tipo de zona (costo de envío visible)
        const kmInput = document.getElementById('cr-delivery-distance');
        if (kmInput && !kmInput.__boundSummary) {
          kmInput.addEventListener('input', () => renderQuoteSummaryTable());
          kmInput.__boundSummary = true;
        }
        const zoneSelect = document.getElementById('cr-zone-type');
        if (zoneSelect && !zoneSelect.__boundSummary) {
          zoneSelect.addEventListener('change', () => renderQuoteSummaryTable());
          zoneSelect.__boundSummary = true;
        }
      } catch {}
    }
  
    // ---- Accesorios: filtros, orden y layout ----
    function applyAccessoryFilters() {
      if (!els.accGrid) return;
      const q = (els.accSearch?.value || '').trim().toLowerCase();
      const sub = (els.accSubcat?.value || 'todas').toLowerCase();
      const sort = (els.accSort?.value || 'name');
      const items = Array.from(els.accGrid.querySelectorAll('.cr-acc-item'));
  
      // Filter first
      const filtered = [];
      items.forEach(it => {
        const name = (it.getAttribute('data-name') || '').toLowerCase();
        const cat = (it.getAttribute('data-subcat') || '').toLowerCase();
        const matchName = !q || name.includes(q);
        const matchCat = sub === 'todas' || cat === sub;
        const show = matchName && matchCat;
        it.style.display = show ? '' : 'none';
        if (show) filtered.push(it);
      });
  
      // Sort visible only
      filtered.sort((a,b) => {
        if (sort === 'stock') {
          const sa = parseInt(a.getAttribute('data-stock') || '0', 10);
          const sb = parseInt(b.getAttribute('data-stock') || '0', 10);
          return sb - sa; // desc
        }
        // name
        const na = (a.getAttribute('data-name') || '').toLowerCase();
        const nb = (b.getAttribute('data-name') || '').toLowerCase();
        return na.localeCompare(nb);
      });
  
      // Re-append in sorted order (keep hidden ones in place but after)
      filtered.forEach(node => els.accGrid.appendChild(node));
  
      // Count and empty state
      const visible = filtered.length;
      if (els.accCount) els.accCount.textContent = String(visible);
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
  
      // Auto layout switch
      els.accGrid.classList.remove('cr-grid','cr-list');
      els.accGrid.classList.add(visible <= 2 ? 'cr-list' : 'cr-grid');
  
      // Re-apply selection styling/buttons
      refreshAccessoryButtons();
    }
  
    // Compatibilidad con atributo inline previo
    window.filterAccessories = applyAccessoryFilters;
    
  
    function refreshAccessoryButtons() {
      if (!els.accGrid) return;
      els.accGrid.querySelectorAll('.cr-acc-item').forEach(card => {
        let btn = card.querySelector('.cr-acc-btn');
        let qty = card.querySelector('.cr-acc-qty');
        let confirm = card.querySelector('.cr-acc-confirm');
        let remove = card.querySelector('.cr-acc-remove');
        const id = getAccessoryId(card);
        const isSel = state.accSelected.has(id);
        const isConfirmed = state.accConfirmed.has(id);
        if (!btn) {
          btn = document.createElement('button');
          btn.className = 'cr-btn cr-acc-btn';
          btn.type = 'button';
          // qty input
          qty = document.createElement('input');
          qty.type = 'number';
          qty.min = '1';
          qty.value = '1';
          qty.className = 'cr-acc-qty';
          // confirm button
          confirm = document.createElement('button');
          confirm.type = 'button';
          confirm.className = 'cr-btn cr-btn--ghost cr-acc-confirm';
          confirm.textContent = 'Confirmar';
          // remove icon button
          remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'cr-acc-remove';
          remove.innerHTML = '<i class="fa-solid fa-trash"></i>';
  
          const actions = document.createElement('div');
          actions.className = 'cr-acc-actions';
          actions.appendChild(btn);
          actions.appendChild(qty);
          actions.appendChild(confirm);
          actions.appendChild(remove);
          card.appendChild(actions);
  
          btn.addEventListener('click', () => toggleAccessory(card));
          confirm.addEventListener('click', () => confirmAccessory(card));
          remove.addEventListener('click', () => removeAccessory(card));
        }
        btn.innerHTML = isSel ? '<i class="fa-solid fa-check"></i> Agregado' : '<i class="fa-solid fa-plus"></i> Agregar';
        btn.classList.toggle('is-selected', isSel);
        card.classList.toggle('is-selected', isSel);
        if (qty) qty.disabled = !isSel;
        if (confirm) {
          confirm.disabled = !isSel;
          // set visual state for confirm button
          if (isSel && isConfirmed) {
            confirm.textContent = 'Confirmado';
            confirm.classList.add('is-confirmed');
          } else {
            confirm.textContent = 'Confirmar';
            confirm.classList.remove('is-confirmed');
          }
        }
        if (remove) remove.disabled = !isSel;
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
    }
  
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
      const txt = toast.querySelector('.cr-acc-toast__text');
      if (txt) txt.textContent = `${qty} × ${id} confirmado`;
      toast.style.display = 'inline-flex';
      clearTimeout(card.__toastTimer);
      card.__toastTimer = setTimeout(() => { if (toast) toast.style.display = 'none'; }, 1600);
    }
  
    function renderAccessoriesSummary() {
      const card = document.getElementById('cr-acc-summary-card');
      const totalEl = document.getElementById('cr-acc-total');
      const detailEl = document.getElementById('cr-acc-total-detail');
      const badge = document.getElementById('cr-acc-badge');
      const badgeCount = document.getElementById('cr-acc-badge-count');
      if (!card || !totalEl || !detailEl) return;
      const selected = Array.from(state.accSelected);
      if (selected.length === 0) {
        totalEl.textContent = '0';
        detailEl.textContent = 'Sin accesorios seleccionados';
        if (badge) badge.hidden = true;
        return;
      }
      let total = 0;
      const lines = [];
      selected.forEach(id => {
        const node = Array.from(els.accGrid.querySelectorAll('.cr-acc-item')).find(n => (n.getAttribute('data-name')||'') === id);
        if (!node) return;
        const price = parseFloat(node.getAttribute('data-price') || '0');
        const qty = Math.max(1, parseInt((state.accQty && state.accQty[id]) || '1', 10));
        total += price * qty;
        lines.push(`${qty} x ${id} @ $${price.toLocaleString('es-MX')} = $${(price*qty).toLocaleString('es-MX')}`);
      });
      totalEl.textContent = `$${total.toLocaleString('es-MX')}`;
      detailEl.textContent = lines.join(' · ');
      if (badge && badgeCount) { badge.hidden = false; badgeCount.textContent = String(selected.length); }
    }
  
    // --- Datos mock de productos ---
    const mock = [
      // Marco y cruceta
      {
        id: 'MC-200-001',
        name: 'Módulo 200 Marco-Cruceta',
        brand: 'AndamiosMX',
        category: 'marco_cruceta',
        desc: 'Módulo de 2.0m para sistema Marco-Cruceta. Incluye crucetas reforzadas.',
        image: 'img/default.jpg',
        stock: 50,
        price: { diario: 12000, semanal: 70000, mensual: 240000 },
        meta: { altura: '2.0m', ancho: '1.2m', material: 'Acero galvanizado' },
        quality: 'Bueno',
      },
      {
        id: 'MC-150-001',
        name: 'Módulo 150 Marco-Cruceta',
        brand: 'AndamiosMX',
        category: 'marco_cruceta',
        desc: 'Módulo de 1.5m compatible con sistema Marco-Cruceta.',
        image: 'img/default.jpg',
        stock: 40,
        price: { diario: 10000, semanal: 60000, mensual: 200000 },
        meta: { altura: '1.5m', ancho: '1.2m', material: 'Acero galvanizado' },
        quality: 'Bueno',
      },
      {
        id: 'MC-100-001',
        name: 'Módulo 100 Marco-Cruceta',
        brand: 'AndamiosMX',
        category: 'marco_cruceta',
        desc: 'Módulo de 1.0m para ajustes de altura en Marco-Cruceta.',
        image: 'img/default.jpg',
        stock: 60,
        price: { diario: 8000, semanal: 48000, mensual: 160000 },
        meta: { altura: '1.0m', ancho: '1.2m', material: 'Acero galvanizado' },
        quality: 'Bueno',
      },
      // Multidireccional
      {
        id: 'MD-RO-001',
        name: 'Roseta Multidireccional',
        brand: 'MultiScaf',
        category: 'multidireccional',
        desc: 'Roseta para unión de montantes en sistema multidireccional.',
        image: 'img/default.jpg',
        stock: 200,
        price: { diario: 500, semanal: 3000, mensual: 10000 },
        meta: { diametro: 'Ø48.3mm', material: 'Acero' },
        quality: 'Nuevo',
      },
      // Templetes
      {
        id: 'TP-PLA-001',
        name: 'Templete Plataforma 1.5m x 2.0m',
        brand: 'Templex',
        category: 'templetes',
        desc: 'Plataforma metálica para templetes con superficie antideslizante.',
        image: 'img/default.jpg',
        stock: 25,
        price: { diario: 6000, semanal: 36000, mensual: 120000 },
        meta: { dimensiones: '1.5x2.0m', material: 'Acero' },
        quality: 'Bueno',
      },
    ];
  
    async function loadProductsFromAPI() {
      if (FORCE_MOCK) return mock;
      try {
        const headers = getAuthHeaders();
        const resp = await fetch(EQUIPOS_URL, { headers });
        if (!resp.ok) {
          if (resp.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return mock;
          }
          const txt = await resp.text().catch(()=> '');
          console.warn('Equipos API no OK:', resp.status, txt);
          return mock;
        }
        const data = await resp.json();
        if (!Array.isArray(data)) return mock;
        // Mapear a la estructura esperada por la UI
        return data.map((it, idx) => {
          const id = String(it.clave || it.sku || it.id || idx+1);
          const name = String(it.nombre || it.name || 'Equipo');
          const desc = String(it.descripcion || it.desc || '');
          const brand = String(it.marca || it.brand || '-');
          const image = it.imagen || it.image || 'img/default.jpg';
          const categoryRaw = String(it.categoria || it.category || '').toLowerCase();
          let category = 'marco_cruceta';
          if (categoryRaw.includes('multi')) category = 'multidireccional';
          else if (categoryRaw.includes('templet') || categoryRaw.includes('temple')) category = 'templetes';
          const stock = Number(it.stock || it.existencias || 0);
          // Precios: tomar presentes o estimar
          const pDia = Number(it.precio_diario || it.precio || it.price || 0);
          const pSem = Number(it.precio_semanal || (pDia * 6));
          const pMes = Number(it.precio_mensual || (pDia * 20));
          return {
            id, name, desc, brand, image, category, stock,
            quality: (it.estado || it.quality || 'Bueno'),
            price: { diario: pDia, semanal: pSem, mensual: pMes }
          };
        });
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
      els.total.textContent = currency(total);
      const totalUnits = state.cart.reduce((a,b)=>a+b.qty,0);
      els.totalDetail.textContent = totalUnits > 0 ? `Total por ${totalUnits} unidad(es) × ${days} día(s)` : 'Sin productos seleccionados';
      const delivery = els.needDelivery?.checked ? Math.round(total * 0.3) : 0;
      state.deliveryExtra = delivery;
      if (els.deliveryExtra) els.deliveryExtra.textContent = `Costo adicional de entrega: ${currency(delivery)}`;
  
      // Calcular total de accesorios aplicando días
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
    }
  
    function removeFromCart(id) {
      state.cart = state.cart.filter(x => x.id !== id);
      renderCart();
    }
  
    function changeCartQty(id, delta) {
      const item = state.cart.find(x => x.id === id);
      if (!item) return;
      const p = state.products.find(x => x.id === id);
      const next = Math.max(1, item.qty + delta);
      item.qty = p ? Math.min(p.stock, next) : next;
      renderCart();
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
      els.cartList.querySelectorAll('input[type="number"]').forEach(inp=>inp.addEventListener('input',()=>{
        const id = inp.getAttribute('data-id');
        const item = state.cart.find(x=>x.id===id);
        const p = state.products.find(x=>x.id===id);
        if (item) {
          let v = Math.max(1, Number(inp.value||1));
          if (p) v = Math.min(p.stock, v);
          item.qty = v;
          renderCart();
        }
      }));
  
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
      state.days = 1;
  
      // Llenar lateral
      if (els.selImage) els.selImage.src = p.image;
      if (els.selName) els.selName.textContent = p.name;
      if (els.selDesc) els.selDesc.textContent = p.desc;
      if (els.selSku) els.selSku.textContent = p.id;
      if (els.selBrand) els.selBrand.textContent = p.brand;
      if (els.selStock) els.selStock.textContent = `${p.stock} disponibles`;
      if (els.priceDaily) els.priceDaily.textContent = currency(p.price.diario);
      if (els.dailyRate) els.dailyRate.value = currency(p.price.diario);
  
      // Reset días y fechas
      if (els.days) els.days.value = '1';
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
      // Reset días y fechas
      state.days = 1;
      if (els.days) els.days.value = '1';
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
        els.days.addEventListener('input', () => { state.days = Math.max(1, parseInt(els.days.value || '1', 10)); recalcEndDate(); renderCart(); });
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
            if (cost) cost.value = '';
            const extra = document.getElementById('cr-delivery-extra');
            if (extra) extra.textContent = 'Entrega en sucursal: sin costo adicional.';
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
      // cargar datos
      state.products = await loadProductsFromAPI();
  
      // preselect category from URL if present
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
      if (els.accSearch) els.accSearch.addEventListener('input', applyAccessoryFilters);
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
      if (els.notesFab) els.notesFab?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (els.notesFab.__suppressClick) return;
        if (els.notesFloater && els.notesFloater.hidden) {
          closeNotesModal();
          openNotesFloater();
        } else {
          closeNotesFloater();
        }
      });
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
          saveBtn.addEventListener('click', () => {
            const card = document.getElementById('cr-quote-summary-card');
            if (card) { card.style.display = ''; card.hidden = false; }
            try { bindQuoteSummaryEvents(); renderQuoteSummaryTable(); } catch {}
            try { card?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
          });
          saveBtn.__bound = true;
        }
      } catch {}

      // --- Side menu (hamburger) bindings ---
      try {
        const btn = document.getElementById('cr-hamburger');
        const menu = document.getElementById('cr-sidemenu');
        const backdrop = document.getElementById('cr-sidemenu-backdrop');
        const closeBtn = document.querySelector('[data-close-menu]');
        const openMenu = () => {
          if (!menu || !backdrop) return;
          menu.hidden = false; backdrop.hidden = false;
          requestAnimationFrame(() => { menu.classList.add('is-open'); btn?.setAttribute('aria-expanded','true'); menu.setAttribute('aria-hidden','false'); });
        };
        const closeMenu = () => {
          if (!menu || !backdrop) return;
          menu.classList.remove('is-open'); btn?.setAttribute('aria-expanded','false'); menu.setAttribute('aria-hidden','true');
          setTimeout(() => { menu.hidden = true; backdrop.hidden = true; }, 200);
        };
        btn?.addEventListener('click', () => { const isOpen = menu?.classList.contains('is-open'); isOpen ? closeMenu() : openMenu(); });
        backdrop?.addEventListener('click', closeMenu);
        closeBtn?.addEventListener('click', closeMenu);
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
        document.querySelectorAll('#cr-sidemenu .cr-menu-item').forEach(it => {
          it.addEventListener('click', () => { closeMenu(); });
        });
      } catch {}

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
  
    // Exponer funciones globalmente para usarlas en el HTML
    window.goToStep3 = goToStep3;
    window.goToStep4 = goToStep4;
    window.goToPreviousStep = goToPreviousStep;
    window.searchLocation = searchLocation;
    window.completeShippingStep = completeShippingStep;
    // Buscador de accesorios dentro de #cr-accessories
    window.filterAccessories = function() {
      const q = (document.getElementById('cr-accessory-search')?.value || '').toLowerCase();
      document.querySelectorAll('#cr-accessories .cr-card[data-name]')
        .forEach(card => {
          const name = (card.getAttribute('data-name') || '').toLowerCase();
          card.style.display = name.includes(q) ? '' : 'none';
        });
    }
  
    document.addEventListener('DOMContentLoaded', init);
  })();
  