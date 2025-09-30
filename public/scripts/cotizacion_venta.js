/* Cotización Renta - lógica de flujo y UI
   Reutiliza patrones de transiciones/responsivo similares a servicios */

   (() => {
    // Backend config (alineado con public/js/cotizaciones.js)
    const API_URL = 'http://localhost:3001/api';
    const PRODUCTOS_URL = `${API_URL}/productos`;
    // DEV: Forzar uso de datos mock para evitar pantalla vacía si la API falla
    const FORCE_MOCK = false; // usa la API real de productos para Venta; cambiar a true solo si la API falla

    // Headers con JWT si existe (igual que en Renta)
    function getAuthHeaders() {
      const token = checkAuth();
      return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
    }

// Lista lateral enfocada (izquierda) en Paso 3 para Venta
function renderFocusedListVenta() {
  const list = document.getElementById('cr-focused-list');
  if (!list) return;
  list.innerHTML = '';
  state.cart.forEach(ci => {
    const p = state.products.find(x => x.id === ci.id); if (!p) return;
    const unit = Number(p.price?.diario || 0);
    const item = document.createElement('div');
    item.className = 'cr-side-item';
    item.setAttribute('data-id', p.id);
    item.innerHTML = `
      <div class="cr-side-item__media">
        <img src="${p.image}" alt="${p.name}" />
      </div>
      <div class="cr-side-item__body">
        <div class="cr-side-item__title">${p.name}</div>
        <div class="cr-selected-meta" style="grid-template-columns: 1fr; gap:6px;">
          <span class="cr-chip">SKU: ${p.sku || p.id}</span>
          ${p.brand ? `<span class="cr-chip">Marca: ${p.brand}</span>` : ''}
          ${p.stock!=null ? `<span class="cr-chip">Stock: ${p.stock} disp.</span>` : ''}
        </div>
        <div class="cr-side-item__line">${ci.qty} × ${currency(unit)} <span class="cr-side-item__line-total">${currency(unit * ci.qty)}</span></div>
      </div>`;
    item.addEventListener('click', () => selectProduct(p.id));
    list.appendChild(item);
  });
}

    // Carrito mínimo para habilitar el botón Continuar
    function addToCart(id) {
      const p = state.products.find(x => x.id === id);
      if (!p) return;
      const found = state.cart.find(ci => ci.id === id);
      if (found) found.qty += 1; else state.cart.push({ id, qty: 1 });
      try { renderCart(); } catch {}
      const count = state.cart.reduce((a,b)=>a+b.qty,0);
      const cntEl = document.getElementById('cr-cart-count'); if (cntEl) cntEl.textContent = String(count);
      const wrap = document.getElementById('cr-cart-count-wrap'); if (wrap) wrap.classList.toggle('is-empty', count===0);
      // actualizar resumen y total (Paso 3) por si ya estamos ahí
      try { renderSummaryVenta(); renderFocusedListVenta(); recalcTotalVenta(); } catch {}
    }

    // Autenticación mínima: toma token si existe, no redirige
    function checkAuth() {
      try { return localStorage.getItem('token'); } catch { return null; }
    }
    
    // Estado global (único)
    const state = {
      view: 'grid',
      products: [],
      filtered: [],
      accessories: [],
      selected: null,
      cart: [],
      qty: 1,
      days: 1,
      dateStart: null,
      dateEnd: null,
      deliveryNeeded: true,
      deliveryExtra: 0,
      accSelected: new Set(),
      accConfirmed: new Set(),
      accQty: {},
      notes: [],
    };

    // Cache simple de elementos requeridos por render
    var els = window.__ventaEls || {};
    function cacheEls() {
      els.productsWrap = document.getElementById('cr-products');
      els.foundCount = document.getElementById('cr-found-count');
      els.resultsText = document.getElementById('cr-results-text');
      els.gridBtn = document.getElementById('cr-grid-btn');
      els.listBtn = document.getElementById('cr-list-btn');
      els.search = document.getElementById('cr-search-input');
      els.filters = document.getElementById('cr-filters');
      els.toggleFilters = document.getElementById('cr-toggle-filters');
      els.goConfig = document.getElementById('cr-go-config');
      els.accSearch = document.getElementById('cr-accessory-search');
      els.accSubcat = document.getElementById('cr-acc-subcat');
      els.accSort = document.getElementById('cr-acc-sort');
      els.accGrid = document.getElementById('cr-accessories');
      els.accCount = document.getElementById('cr-accessory-count');
      // notes
      els.notesFab = document.getElementById('cr-notes-fab');
      els.notesFloater = document.getElementById('cr-notes-floater');
      els.notesFloaterHead = document.getElementById('cr-notes-floater-head');
      els.notesCloseBtns = document.querySelectorAll('[data-close-notes]');
      els.noteText = document.getElementById('cr-note-text');
      els.noteSave = document.getElementById('cr-note-save');
      els.notesList = document.getElementById('cr-notes-list');
      els.notesCount = document.getElementById('cr-notes-count');
      els.notesChip = document.getElementById('cr-notes-chip');
      window.__ventaEls = els;
    }

    // Normaliza nombre de categoría a slug usado por los radios de filtros
    function normalizeCategory(name) {
      // Quitar acentos y normalizar separadores
      let n = (name || '').toString().toLowerCase();
      if (!n) return null;
      try { n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch {}
      n = n.replace(/[\/_-]+/g, ' ').replace(/\s+/g, ' ').trim();
      // Aceptar variantes exactas del inventario
      if (n.includes('accesorio') || n.includes('accesorios')) return 'accesorios';
      const hasMarco = n.includes('marco') || n.includes('andamio marco');
      const hasCruceta = n.includes('cruceta') || n.includes('cruzeta');
      if ((hasMarco && hasCruceta) || n.includes('andamio marco y cruceta')) return 'marco_cruceta';
      if (n.includes('multidireccional') || n.includes('multi direccional') || n.includes('multi')) return 'multidireccional';
      if (n.includes('templet') || n.includes('templete') || n.includes('templetes')) return 'templetes';
      return null; // no coincide con categorías principales
    }

    // Utilidad: debounce simple
    function debounce(fn, wait = 300) {
      let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, args), wait); };
    }

    // --- Helpers accesorios ---
    function getAccessoryId(card) {
      if (!card) return '';
      let id = card.getAttribute('data-name');
      if (id) return id;
      const nameEl = card.querySelector('.cr-product__name, .cr-name, h3');
      return (nameEl?.textContent || '').trim();
    }

    // Floating notes window open/close (simple)
    function openNotesFloater() {
      if (!els.notesFloater) return;
      els.notesFloater.hidden = false;
      els.notesFloater.style.display = 'flex';
    }
    function closeNotesFloater() {
      if (!els.notesFloater) return;
      els.notesFloater.hidden = true;
      els.notesFloater.style.display = 'none';
    }
    function closeNotesModal() { if (els.notesModal) els.notesModal.hidden = true; }

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
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div style="white-space:pre-wrap;">${note.text}</div>
            <div style="display:flex;gap:8px;">
              <button class="cr-acc-remove" title="Eliminar" aria-label="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>`;
        row.querySelector('button')?.addEventListener('click', () => {
          state.notes = state.notes.filter(n => n.id !== note.id);
          persistNotes(); renderNotes(); updateNotesCounters();
        });
        els.notesList.appendChild(row);
      });
    }

    // Filtros para Accesorios (búsqueda, subcategoría, orden)
    function applyAccessoryFilters() {
      const grid = els.accGrid || document.getElementById('cr-accessories');
      if (!grid) return;
      const cards = Array.from(grid.querySelectorAll('.cr-acc-item'));
      const q = (els.accSearch?.value || '').trim().toLowerCase();
      const sub = (els.accSubcat?.value || '').trim().toLowerCase();
      const sort = (els.accSort?.value || 'name').toLowerCase();

      let filtered = cards.filter(card => {
        const name = (card.getAttribute('data-name') || '').toLowerCase();
        const subcat = (card.getAttribute('data-subcat') || '').toLowerCase();
        return (!q || name.includes(q)) && (!sub || subcat === sub);
      });
      filtered.sort((a,b)=>{
        if (sort==='stock') return (parseInt(b.getAttribute('data-stock')||'0',10)) - (parseInt(a.getAttribute('data-stock')||'0',10));
        const na=(a.getAttribute('data-name')||'').toLowerCase(); const nb=(b.getAttribute('data-name')||'').toLowerCase();
        return na.localeCompare(nb);
      });
      // Re-append in order and show/hide
      grid.innerHTML = '';
      filtered.forEach(n=>grid.appendChild(n));
      if (els.accCount) els.accCount.textContent = String(filtered.length);
    }
    function updateNotesCounters() {
      const n = state.notes.length;
      if (els.notesCount) { els.notesCount.textContent = String(n); els.notesCount.hidden = n === 0; }
      if (els.notesChip) els.notesChip.textContent = `${n} nota${n===1?'':'s'}`;
    }
    function addNote(text) {
      const t = (text||'').trim(); if (!t) return;
      state.notes.push({ id: 'n_'+Date.now(), ts: Date.now(), text: t });
      persistNotes(); els.noteText && (els.noteText.value=''); renderNotes(); updateNotesCounters();
    }
    function persistNotes() { try { localStorage.setItem('cr_notes', JSON.stringify(state.notes)); } catch {} }
    function loadNotes() { try { const raw = localStorage.getItem('cr_notes'); if (raw) state.notes = JSON.parse(raw)||[]; } catch { state.notes=[]; } }

    // Drag handlers (simple)
    function enableNotesDrag() {
      if (!els.notesFloater || !els.notesFloaterHead) return;
      let dragging=false, startX=0, startY=0, startLeft=0, startTop=0; const floater=els.notesFloater;
      const onMove=(e)=>{ if(!dragging) return; const cx=e.clientX??e.touches?.[0]?.clientX; const cy=e.clientY??e.touches?.[0]?.clientY; if(cx==null||cy==null) return; floater.style.left=(startLeft+(cx-startX))+'px'; floater.style.top=(startTop+(cy-startY))+'px'; floater.style.right='auto'; };
      const onUp=()=>{ dragging=false; window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); window.removeEventListener('touchmove',onMove); window.removeEventListener('touchend',onUp); };
      const onDown=(e)=>{ const rect=floater.getBoundingClientRect(); const cx=e.clientX??e.touches?.[0]?.clientX; const cy=e.clientY??e.touches?.[0]?.clientY; startX=cx; startY=cy; startLeft=rect.left; startTop=rect.top; dragging=true; window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp); window.addEventListener('touchmove',onMove,{passive:false}); window.addEventListener('touchend',onUp); e.preventDefault(); };
      els.notesFloaterHead.addEventListener('mousedown', onDown);
      els.notesFloaterHead.addEventListener('touchstart', onDown, { passive:false });
    }
    function enableFabDrag() { /* opcional para venta, no necesario si el FAB no es draggable */ }

    // Filtro por búsqueda y categoría (Venta)
function filterProducts() {
  try {
    const q = (els.search?.value || '').trim().toLowerCase();
    const cat = document.querySelector('input[name="cr-category"]:checked')?.value || '';
    let base = (state.products||[]);
    state.filtered = base.filter(p => {
      const matchesText = (!q || p.name.toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q) || String(p.sku||'').toLowerCase().includes(q) || (p.brand||'').toLowerCase().includes(q));
      const matchesCat = (!cat ? true : p.categorySlug === cat);
      return matchesText && matchesCat;
    });
    // Si no hay resultados y hay categoría seleccionada, reintentar ignorando categoría
    if (state.filtered.length === 0 && cat) {
      state.filtered = base.filter(p => {
        return (!q || p.name.toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q) || String(p.sku||'').toLowerCase().includes(q) || (p.brand||'').toLowerCase().includes(q));
      });
    }
    renderProducts(state.filtered);
    try { console.debug('[venta] productos totales:', base.length, 'filtrados:', state.filtered.length, 'cat:', cat||'(ninguna)'); } catch {}
  } catch(e) { console.error('[filterProducts] error:', e); }
}
    window.filterProducts = filterProducts;

    // --- Helpers mínimos restaurados para que init() funcione ---
    function currency(n) {
      try { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n)||0); }
      catch { return `$${(Number(n)||0).toFixed(0)}`; }
    }

    async function loadProductsFromAPI() {
      try {
        const headers = getAuthHeaders();
        const resp = await fetch(PRODUCTOS_URL, { headers });
        if (!resp.ok) return [];
        const data = await resp.json();
        if (!Array.isArray(data)) return [];
        const mapped = data.map((it, idx) => {
          const id = String(it.id || it.id_producto || it.clave || idx+1);
          const name = String(it.nombre || it.nombre_del_producto || 'Producto');
          const desc = String(it.descripcion || '');
          const brand = String(it.marca || '');
          const image = it.imagen || it.imagen_portada || 'img/default.jpg';
          const sku = String(it.clave || it.codigo_de_barras || id);
          const originalCategory = it.categoria || it.category || '';
          const categorySlug = normalizeCategory(originalCategory);
          const stock = Number(it.stock_venta ?? it.stock_total ?? it.stock ?? 0);
          const pVenta = Number(it.precio_venta || 0);
          const pRenta = Number(it.tarifa_renta || 0);
          const p = pVenta > 0 ? pVenta : pRenta;
          return { id, sku, name, desc, brand, image, category: originalCategory, categorySlug, stock, quality: (it.condicion||it.estado||'Bueno'), price: { diario: p } };
        });
        // Excluir accesorios y dejar solo categorías principales del inventario
        const mainCats = new Set(['marco_cruceta','multidireccional','templetes']);
        const filtered = mapped.filter(p => mainCats.has(p.categorySlug));
        if (!filtered.length && mapped.length) {
          // si no se pudo categorizar, devolver mapped; el filtro estricto se hará por radios
          return mapped;
        }
        if (!filtered.length) {
          // Fallback de demostración si tampoco hay mapeo
          return [
            { id: 'P-001', sku: 'P-001', name: 'Marco estándar', desc: 'Módulo marco estándar', brand: 'ATS', image: 'img/default.jpg', category: 'ANDAMIO MARCO Y CRUCETA', categorySlug: 'marco_cruceta', stock: 50, quality: 'Nuevo', price: { diario: 120 } },
            { id: 'P-002', sku: 'P-002', name: 'Cruceta 2.0m', desc: 'Cruceta de 2.0m', brand: 'ATS', image: 'img/default.jpg', category: 'ANDAMIO MARCO Y CRUCETA', categorySlug: 'marco_cruceta', stock: 80, quality: 'Nuevo', price: { diario: 70 } },
            { id: 'P-003', sku: 'P-003', name: 'Templete 1.5m', desc: 'Templete reforzado', brand: 'ATS', image: 'img/default.jpg', category: 'TEMPLETES', categorySlug: 'templetes', stock: 20, quality: 'Bueno', price: { diario: 200 } }
          ];
        }
        return filtered;
      } catch { return []; }
    }

    async function loadAccessoriesFromAPI() {
      try {
        const headers = getAuthHeaders();
        const resp = await fetch(PRODUCTOS_URL, { headers });
        if (!resp.ok) return [];
        const data = await resp.json();
        if (!Array.isArray(data)) return [];
        return data.filter(it => {
          const cat = (it.categoria || it.nombre_subcategoria || '').toString().toLowerCase();
          const tipo = (it.tipo_de_producto || '').toString().toLowerCase();
          return cat.includes('accesor') || tipo.includes('accesor');
        }).map(it => {
          const id = String(it.id || it.id_producto || it.clave || it.codigo || it.codigo_producto || it.sku || it.nombre || Date.now());
          const name = String(it.nombre || it.nombre_del_producto || it.descripcion_corta || id);
          const image = it.imagen || it.imagen_portada || 'img/default.jpg';
          const stock = Number(it.stock_total || it.stock || 0);
          const subcat = (it.nombre_subcategoria || '').toString().toLowerCase() || 'otros';
          const price = Number(it.precio_venta || it.tarifa_renta || it.precio || 0);
          const sku = String(it.clave || it.codigo_de_barras || id);
          const brand = it.marca || '';
          const desc = it.descripcion || '';
          const quality = it.condicion || it.estado || '';
          return { id, name, image, stock, subcat, price, sku, brand, desc, quality };
        });
      } catch { return []; }
    }

    function renderAccessoriesGrid(items) {
      if (!els.productsWrap) { /* noop */ }
      const grid = document.getElementById('cr-accessories');
      if (!grid) return;
      grid.innerHTML = '';
      items.forEach(a => {
        const card = document.createElement('div');
        card.className = 'cr-card cr-acc-item';
        card.setAttribute('data-name', a.name);
        card.setAttribute('data-sku', a.sku || '');
        card.setAttribute('data-subcat', a.subcat || 'otros');
        card.setAttribute('data-stock', String(a.stock||0));
        card.setAttribute('data-price', String(a.price||0));
        card.innerHTML = `
          <img src="${a.image}" alt="${a.name}" onerror="this.src='img/default.jpg'" />
          <h3 class="cr-product__name">${a.name}</h3>
          <p class="cr-product__desc">${a.desc||''}</p>
          <div class="cr-product__meta">
            <div><i class="fa-solid fa-hashtag"></i> <strong>SKU:</strong> ${a.sku||'-'}</div>
            <div><i class="fa-solid fa-tags"></i> <strong>Subcat:</strong> ${a.subcat||'otros'}</div>
            <div><i class="fa-solid fa-boxes-stacked"></i> <strong>Stock:</strong> ${a.stock||0}</div>
          </div>
          <small style="color:#64748b;"><i class="fa-solid fa-dollar-sign"></i> Precio ref.: ${currency(a.price||0)}</small>`;
        card.addEventListener('click', () => {
          const id = getAccessoryId(card);
          if (!id) return;
          if (state.accSelected.has(id)) { state.accSelected.delete(id); delete state.accQty[id]; card.classList.remove('is-selected'); }
          else { state.accSelected.add(id); if (!state.accQty[id]) state.accQty[id] = 1; card.classList.add('is-selected'); }
          try { renderAccessoriesSummary(); } catch {}
          try { recalcTotalVenta(); } catch {}
        });
        grid.appendChild(card);
      });
    }

    // Render de resumen de accesorios (Venta)
    function renderAccessoriesSummary() {
      try {
        const totalEl = document.getElementById('cr-acc-total');
        const detailEl = document.getElementById('cr-acc-total-detail');
        const badge = document.getElementById('cr-acc-badge');
        const badgeCount = document.getElementById('cr-acc-badge-count');
        if (!totalEl || !detailEl) return;
        let total = 0;
        const lines = [];
        const map = new Map((state.accessories||[]).map(a => [a.name, a]));
        state.accSelected.forEach(id => {
          const acc = map.get(id);
          const qty = Math.max(1, Number(state.accQty?.[id]||1));
          if (!acc) return;
          const line = qty * Number(acc.price||0);
          total += line;
          lines.push(`${qty} × ${acc.name} (${currency(acc.price||0)}) = ${currency(line)}`);
        });
        totalEl.textContent = currency(total);
        detailEl.textContent = lines.length ? lines.join(' · ') : 'Sin accesorios seleccionados';
        const count = state.accSelected.size;
        if (badge && badgeCount) {
          badgeCount.textContent = String(count);
          badge.hidden = count === 0;
        }
      } catch {}
    }

    function renderCart() {
      const list = document.getElementById('cr-cart-list');
      if (!list) return;
      list.innerHTML = '';
      let subtotal = 0;
      state.cart.forEach(ci => {
        const p = state.products.find(x => x.id === ci.id);
        if (!p) return;
        const unit = Number(p.price?.diario || 0);
        const line = unit * ci.qty;
        subtotal += line;
        const row = document.createElement('div');
        row.className = 'cr-cart-row';
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr auto auto';
        row.style.alignItems = 'center';
        row.style.gap = '10px';
        row.setAttribute('data-id', p.id);
        row.innerHTML = `
          <div style="display:flex;flex-direction:column;">
            <strong style="font-size:13px;">${p.name}</strong>
            <span style="color:#64748b; font-size:12px;">SKU: ${p.sku || p.id}</span>
          </div>
          <div class="cr-qty" style="display:flex; align-items:center; gap:6px;">
            <button type="button" class="cr-btn cr-btn--sm" data-action="dec" aria-label="Disminuir">−</button>
            <input type="number" class="cr-input" data-action="qty" value="${ci.qty}" min="1" style="width:64px; text-align:center;" />
            <button type="button" class="cr-btn cr-btn--sm" data-action="inc" aria-label="Aumentar">+</button>
          </div>
          <div class="cr-line" style="text-align:right; min-width:120px; display:flex; align-items:center; gap:8px; justify-content:flex-end;">
            <button type="button" class="cr-btn cr-btn--ghost cr-btn--sm" title="Eliminar" aria-label="Eliminar" data-action="remove"><i class="fa-solid fa-trash"></i></button>
            <strong class="cr-line-total" style="color:#2563eb;">${currency(line)}</strong>
          </div>`;
        list.appendChild(row);
      });
      // Subtotal visual en la tarjeta de Seleccionados
      const subEl = document.getElementById('cr-cart-subtotal-value');
      if (subEl) subEl.textContent = currency(subtotal);
      // Sincronizar totales de Paso 3
      try { renderSummaryVenta(); renderFocusedListVenta(); recalcTotalVenta(); } catch {}
      // Delegación de eventos para +/- y qty
      list.querySelectorAll('.cr-cart-row').forEach(row => {
        const id = row.getAttribute('data-id');
        const dec = row.querySelector('[data-action="dec"]');
        const inc = row.querySelector('[data-action="inc"]');
        const qty = row.querySelector('[data-action="qty"]');
        const rem = row.querySelector('[data-action="remove"]');
        if (dec && !dec.__bound) { dec.addEventListener('click', () => updateCartQty(id, (getCartQty(id)-1))); dec.__bound = true; }
        if (inc && !inc.__bound) { inc.addEventListener('click', () => updateCartQty(id, (getCartQty(id)+1))); inc.__bound = true; }
        if (qty && !qty.__bound) {
          qty.addEventListener('change', () => updateCartQty(id, Number(qty.value||1)));
          qty.addEventListener('input', () => {/* live typing no-op */});
          qty.__bound = true;
        }
        if (rem && !rem.__bound) { rem.addEventListener('click', () => removeFromCart(id)); rem.__bound = true; }
      });
    }

    function getCartQty(id) { const item = state.cart.find(ci => ci.id === id); return item ? item.qty : 0; }
    function updateCartQty(id, newQty) {
      newQty = Math.max(1, Number(newQty||1));
      const item = state.cart.find(ci => ci.id === id);
      if (!item) return;
      item.qty = newQty;
      renderCart();
    }
    function removeFromCart(id) {
      state.cart = state.cart.filter(ci => ci.id !== id);
      renderCart();
    }
    function recalcCartSubtotal() {
      let subtotal = 0;
      state.cart.forEach(ci => {
        const p = state.products.find(x => x.id === ci.id); if (!p) return;
        subtotal += (Number(p.price?.diario||0) * ci.qty);
      });
      const subEl = document.getElementById('cr-cart-subtotal-value');
      if (subEl) subEl.textContent = currency(subtotal);
      try { recalcTotalVenta(); } catch {}
      return subtotal;
    }

    // Total estimado en Venta (sin días): suma módulos + accesorios
    function recalcTotalVenta() {
      try {
        const totalEl = document.getElementById('cr-total');
        const detailEl = document.getElementById('cr-total-detail');
        if (!totalEl || !detailEl) return;
        // módulos seleccionados
        let modTotal = 0;
        state.cart.forEach(ci => {
          const p = state.products.find(x => x.id === ci.id); if (!p) return;
          const unit = Number(p.price?.diario || 0);
          modTotal += unit * ci.qty;
        });
        // accesorios seleccionados
        let accTotal = 0;
        const accMap = new Map((state.accessories||[]).map(a => [a.name, a]));
        state.accSelected.forEach(id => {
          const a = accMap.get(id); const qty = Math.max(1, Number(state.accQty?.[id]||1));
          if (!a) return; accTotal += (Number(a.price||0) * qty);
        });
        const grand = modTotal + accTotal;
        totalEl.textContent = currency(grand);
        const parts = [];
        if (modTotal > 0) parts.push(`Módulos: ${currency(modTotal)}`);
        if (accTotal > 0) parts.push(`Accesorios: ${currency(accTotal)}`);
        detailEl.textContent = parts.length ? parts.join(' · ') : '-';
      } catch {}
    }

    // Resumen de productos en Paso 3 (Venta) sin días
    function renderSummaryVenta() {
      const list = document.getElementById('cr-summary-list');
      if (!list) return;
      list.innerHTML = '';
      state.cart.forEach(ci => {
        const p = state.products.find(x => x.id === ci.id); if (!p) return;
        const unit = Number(p.price?.diario || 0);
        const line = document.createElement('div');
        line.className = 'cr-summary-row';
        line.style.display = 'grid'; line.style.gridTemplateColumns = '1fr auto auto'; line.style.alignItems = 'center'; line.style.cursor = 'pointer'; line.style.gap = '8px';
        line.setAttribute('data-id', p.id);
        line.innerHTML = `
          <div>
            <div style="font-weight:600; font-size:14px;">${p.name}</div>
            <div style="color: #64748b; font-size:12px;">${ci.qty} × ${currency(unit)}</div>
          </div>
          <button type="button" class="cr-btn cr-btn--ghost cr-btn--sm" title="Eliminar" aria-label="Eliminar" data-remove><i class="fa-solid fa-trash"></i></button>
          <div style="text-align:right;"><div class="cr-summary-item-total">${currency(unit * ci.qty)}</div></div>`;
        line.addEventListener('click', () => selectProduct(p.id));
        list.appendChild(line);
      });
      try { updateSummaryScrollHint(); } catch {}

      // bind remove buttons
      list.querySelectorAll('[data-remove]').forEach(btn => {
        if (btn.__bound) return; btn.__bound = true;
        btn.addEventListener('click', (e) => { e.stopPropagation(); const id = btn.closest('[data-id]')?.getAttribute('data-id'); if (id) removeFromCart(id); });
      });
    }

    // Selección y vista lateral del producto (Paso 3 - Venta)
    function selectProduct(id) {
      try {
        const p = state.products.find(x => x.id === id);
        if (!p) return;
        state.selected = p;
        const img = document.getElementById('cr-selected-image');
        const nameEl = document.getElementById('cr-selected-name');
        const descEl = document.getElementById('cr-selected-desc');
        const skuEl = document.getElementById('cr-selected-sku');
        const brandEl = document.getElementById('cr-selected-brand');
        const stockEl = document.getElementById('cr-selected-stock');
        const prices = document.querySelector('.cr-prices');
        const metaBox = document.querySelector('.cr-selected-meta');
        if (img) { img.src = p.image || 'img/default.jpg'; img.hidden = false; }
        if (nameEl) { nameEl.textContent = p.name || '-'; nameEl.hidden = false; }
        if (descEl) { descEl.textContent = p.desc || ''; descEl.hidden = !p.desc; }
        if (skuEl) skuEl.textContent = p.sku || p.id || '-';
        if (brandEl) brandEl.textContent = p.brand || '-';
        if (stockEl) stockEl.textContent = (p.stock ?? '-')
        if (metaBox) metaBox.hidden = false;
        if (prices) { const daily = document.getElementById('cr-price-daily'); if (daily) daily.textContent = currency(p.price?.diario||0); prices.hidden = false; }
        // Marcar en resumen como seleccionado (estilo)
        try {
          document.querySelectorAll('#cr-summary-list [data-id]')?.forEach(el => el.classList.toggle('is-selected', el.getAttribute('data-id') === id));
        } catch {}
      } catch {}
    }

    function updateSummaryScrollHint() { /* opcional: mostrar un hint si hay overflow */ }

    function handleGoConfig(e) {
      try {
        e?.preventDefault?.();
        if (!state.cart || state.cart.length === 0) {
          alert('Agrega al menos un producto al carrito.');
          return;
        }
        gotoStep('config');
        // Al entrar al Paso 3, pintar resumen, accesorios y total, y enfocar primer producto
        try { renderSummaryVenta(); renderFocusedListVenta(); renderAccessoriesSummary(); recalcTotalVenta(); } catch {}
        try {
          const first = state.cart[0]?.id;
          if (first) selectProduct(first);
        } catch {}
        // Ajuste de scroll para evitar que el header cubra el panel izquierdo
        try {
          const sec = document.getElementById('cr-config-section');
          if (sec) {
            const top = sec.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top, behavior: 'smooth' });
          }
        } catch {}
      } catch {}
    }

    function bindEvents() {
      // vista
      if (els.gridBtn) els.gridBtn.addEventListener('click', () => { state.view='grid'; els.gridBtn.classList.add('is-active'); els.listBtn?.classList.remove('is-active'); renderProducts(state.filtered); });
      if (els.listBtn) els.listBtn.addEventListener('click', () => { state.view='list'; els.listBtn.classList.add('is-active'); els.gridBtn?.classList.remove('is-active'); renderProducts(state.filtered); });
      // búsqueda y filtros
      els.search?.addEventListener('input', filterProducts);
      // radios de categoría
      try {
        document.querySelectorAll('#cr-filters input[type="radio"][name="cr-category"]').forEach(rb => {
          rb.addEventListener('change', () => filterProducts());
        });
      } catch {}
      els.toggleFilters?.addEventListener('click', () => {
        const hidden = els.filters?.hasAttribute('hidden');
        if (!els.filters) return;
        if (hidden) els.filters.removeAttribute('hidden'); else els.filters.setAttribute('hidden','');
        els.toggleFilters.textContent = hidden ? 'Ocultar' : 'Mostrar';
      });
      // continuar
      if (els.goConfig && !els.goConfig.__bound) { els.goConfig.addEventListener('click', handleGoConfig); els.goConfig.__bound = true; }
      // Vaciar carrito
      try {
        const clearBtn = document.getElementById('cr-clear-cart');
        if (clearBtn && !clearBtn.__bound) {
          clearBtn.addEventListener('click', () => { state.cart = []; renderCart(); recalcTotalVenta(); });
          clearBtn.__bound = true;
        }
      } catch {}
      // volver a productos en paso 3
      try { document.getElementById('cr-back-to-products')?.addEventListener('click', (e)=>{ e.preventDefault(); gotoStep('products'); }); } catch {}
      // notas flotantes
      if (els.notesFab && !els.notesFab.__bound) {
        els.notesFab.addEventListener('click', (e) => {
          e.preventDefault();
          if (!els.notesFloater) return;
          const wasHidden = els.notesFloater.hidden;
          if (wasHidden) {
            els.notesFloater.hidden = false; els.notesFloater.style.display = 'flex'; els.notesFloater.removeAttribute('aria-hidden');
            setTimeout(() => els.noteText?.focus(), 10);
          } else {
            // evitar el warning de aria-hidden con foco dentro
            try { document.getElementById('cr-note-text')?.blur(); } catch {}
            els.notesFloater.setAttribute('aria-hidden','true');
            els.notesFloater.hidden = true; els.notesFloater.style.display = 'none';
          }
        });
        els.notesFab.__bound = true;
      }
      // Guardar nota
      if (els.noteSave && !els.noteSave.__bound) {
        els.noteSave.addEventListener('click', () => { try { addNote(els.noteText?.value); } catch {} });
        els.noteSave.__bound = true;
      }
      // Ctrl + Enter en textarea
      if (els.noteText && !els.noteText.__bound) {
        els.noteText.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
            ev.preventDefault();
            try { addNote(els.noteText.value); } catch {}
          }
        });
        els.noteText.__bound = true;
      }
      els.notesCloseBtns?.forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation(); if (!els.notesFloater) return;
        try { document.getElementById('cr-note-text')?.blur(); } catch {}
        els.notesFloater.setAttribute('aria-hidden','true');
        els.notesFloater.hidden = true; els.notesFloater.style.display = 'none';
      }));
      // drag de notas
      try { enableNotesDrag(); } catch {}
    }

    // Render de productos (grid o lista)
    function renderProducts(list) {
      // fallback defensivo por si 'els' aún no fue cacheado
      const productsWrap = (typeof els !== 'undefined' && els.productsWrap) || document.getElementById('cr-products');
      if (!productsWrap) return;
      const isVenta = !!document.getElementById('v-quote-header');
      productsWrap.innerHTML = '';

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
              <div style="font-weight:700;">${p.sku || p.id}</div>
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
          if (!btn) return; const tr = btn.closest('tr');
          const qtyInput = tr.querySelector('.cr-qty-input');
          const id = btn.getAttribute('data-id');
          const qty = Math.max(1, parseInt(qtyInput.value || '1', 10));
          for (let i=0;i<qty;i++) addToCart(id);
        });
        if (els.foundCount) els.foundCount.textContent = String(list.length);
        if (els.resultsText) els.resultsText.textContent = `Mostrando ${list.length} producto${list.length!==1?'s':''}`;
        els.productsWrap.classList.remove('cr-grid','cr-list','cr-carousel');
        els.productsWrap.style.display = 'block';
        const wrapList = document.querySelector('.cr-carousel-wrap');
        if (wrapList) wrapList.classList.remove('is-carousel');
        try { updateCarouselButtons(); } catch {}
        window.addEventListener('scroll', updateCarouselButtons);
        window.addEventListener('resize', updateCarouselButtons);
        return;
      }

      // Grid/cards
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
            <div class="cr-meta"><span>SKU: ${p.sku || p.id}</span><span>Marca: ${p.brand||''}</span></div>
            <div class="cr-product__actions">
              <button class="cr-btn" type="button" data-id="${p.id}"><i class="fa-solid fa-cart-plus"></i> Agregar</button>
              <div class="cr-pricebar"><span class="cr-from">Desde</span> <span class="cr-price">${currency(Number(p.price?.diario||0))}/día</span></div>
            </div>
          </div>`;
        productsWrap.appendChild(card);
      });
      if (els.foundCount) els.foundCount.textContent = String(list.length);
      if (els.resultsText) els.resultsText.textContent = `Mostrando ${list.length} producto${list.length!==1?'s':''}`;
      productsWrap.querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', () => addToCart(btn.getAttribute('data-id'))));
      productsWrap.classList.remove('cr-grid','cr-list','cr-carousel');
      const wrap = document.querySelector('.cr-carousel-wrap');
      if (state.view === 'grid' && isVenta) {
        productsWrap.classList.add('cr-carousel');
        productsWrap.style.display = '';
        if (wrap) wrap.classList.add('is-carousel');
      } else {
        productsWrap.classList.add(state.view === 'grid' ? 'cr-grid' : 'cr-list');
        productsWrap.style.display = (state.view === 'list') ? 'block' : '';
        if (wrap) wrap.classList.remove('is-carousel');
      }
      try { updateCarouselButtons(); } catch {}
    }

    // Carrusel: habilitar/deshabilitar flechas
    function updateCarouselButtons() {
      const prevBtn = document.getElementById('cr-car-prev');
      const nextBtn = document.getElementById('cr-car-next');
      const list = els.productsWrap;
      if (!prevBtn || !nextBtn || !list) return;
      const isCarousel = list.classList.contains('cr-carousel');
      prevBtn.disabled = !isCarousel; nextBtn.disabled = !isCarousel;
      prevBtn.style.display = isCarousel ? 'grid' : 'none';
      nextBtn.style.display = isCarousel ? 'grid' : 'none';
      if (!isCarousel) return;
      const maxScroll = list.scrollWidth - list.clientWidth - 2;
      prevBtn.disabled = list.scrollLeft <= 2;
      nextBtn.disabled = list.scrollLeft >= maxScroll;
    }

    // ... (rest of the code remains the same)

    async function init() {
      // cachear elementos del DOM usados por este archivo
      cacheEls();
      // Ensure notes UI starts closed on page load (prevents auto-open on refresh)
      try {
        const floater = document.getElementById('cr-notes-floater');
        if (floater) {
          floater.hidden = true;
          floater.style.display = 'none';
          floater.setAttribute('aria-hidden', 'true');
        }
      } catch {}
      // Cargar notas previas y pintar contadores
      try { loadNotes(); renderNotes(); updateNotesCounters(); } catch {}
      // cargar datos
      state.products = await loadProductsFromAPI();
      state.accessories = await loadAccessoriesFromAPI();

      // preselect category from URL if present
      const params = new URLSearchParams(window.location.search);
      const cat = params.get('categoria');
      // Mostrar inicialmente según radio seleccionado, si existe; si no, mostrar todo
      const selectedRadio = document.querySelector('#cr-filters input[type="radio"][name="cr-category"]:checked');
      if (selectedRadio) {
        state.filtered = state.products.filter(p => p.categorySlug === selectedRadio.value);
      } else {
        state.filtered = state.products.slice();
      }

      renderProducts(state.filtered);
      // Aplicar filtros de texto/categoría actuales (si los hay)
      try { filterProducts(); } catch {}
      renderAccessoriesGrid(state.accessories);
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

    }

    // Navegación entre pasos: products, config, shipping
    function gotoStep(step) {
      const secProducts = document.getElementById('cr-products-section');
      const secConfig = document.getElementById('cr-config-section');
      const secShipping = document.getElementById('cr-shipping-section');

      [secProducts, secConfig, secShipping].forEach(sec => { if (sec) { sec.hidden = true; sec.classList.remove('cr-section--active'); } });

      if (step === 'config') {
        if (secConfig) { secConfig.hidden = false; requestAnimationFrame(() => secConfig.classList.add('cr-section--active')); }
        els.stepProducts?.classList.remove('cr-step--active');
        els.stepConfig?.classList.add('cr-step--active');
        els.stepShipping?.classList.remove('cr-step--active');
        document.body.classList.remove('is-step-products','is-step-config','is-step-shipping');
        document.body.classList.add('is-step-config');
      } else if (step === 'shipping') {
        if (secShipping) { secShipping.hidden = false; requestAnimationFrame(() => secShipping.classList.add('cr-section--active')); }
        els.stepProducts?.classList.remove('cr-step--active');
        els.stepConfig?.classList.remove('cr-step--active');
        els.stepShipping?.classList.add('cr-step--active');
        document.body.classList.remove('is-step-products','is-step-config','is-step-shipping');
        document.body.classList.add('is-step-shipping');
      } else {
        if (secProducts) { secProducts.hidden = false; requestAnimationFrame(() => secProducts.classList.add('cr-section--active')); }
        els.stepProducts?.classList.add('cr-step--active');
        els.stepConfig?.classList.remove('cr-step--active');
        els.stepShipping?.classList.remove('cr-step--active');
        document.body.classList.remove('is-step-products','is-step-config','is-step-shipping');
        document.body.classList.add('is-step-products');
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
    };
  
    document.addEventListener('DOMContentLoaded', init);
  })();
  