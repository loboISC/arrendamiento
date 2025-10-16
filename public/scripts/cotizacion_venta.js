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

function populateAccessorySubcats() {
  try {
    if (!els.accSubcat) return;
    const subcats = Array.from(new Set((state.accessories||[]).map(a => (a.subcat||'otros').toString().toLowerCase()))).sort();
    const current = els.accSubcat.value;
    els.accSubcat.innerHTML = '<option value="todas" selected>Todas las subcategorías</option>' + subcats.map(s => `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('');
    // restore selection if still present
    if (current && Array.from(els.accSubcat.options).some(o=>o.value===current)) els.accSubcat.value = current;
  } catch {}
}

// Utilidad: clave segura para accesorios (evita comillas/espacios que rompen atributos)
function accKey(a) {
  try {
    const base = String(a?.sku || a?.id || a?.name || '').toLowerCase();
    return base
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  } catch { return String(a?.name||'').toLowerCase(); }
}

// Renderiza accesorios reales en Paso 3 (Venta)
function renderAccessoriesVenta() {
  try {
    const grid = els.accGrid || document.getElementById('cr-accessories');
    if (!grid) return;
    grid.innerHTML = '';
    const accs = Array.isArray(state.accessories) ? state.accessories : [];
    accs.forEach(a => {
      const key = accKey(a);
      const card = document.createElement('div');
      card.className = 'cr-card cr-acc-item';
      card.setAttribute('data-key', key);
      card.setAttribute('data-name', a.name);
      card.setAttribute('data-sku', a.sku || a.id || '');
      card.setAttribute('data-subcat', (a.subcat||'').toString().toLowerCase());
      card.setAttribute('data-stock', String(a.stock||0));
      card.setAttribute('data-price', String(a.price||0));
      card.innerHTML = `
        <div class="cr-product__media" style="height:140px; position:relative; overflow:hidden; border-radius:10px;">
          <img class="accesorios" src="${a.image||'img/default.jpg'}" alt="${a.name}" />
          <span class="cr-stock" style="position:absolute; top:8px; right:8px;">${a.stock||0} disponibles</span>
        </div>
        <h3 class="cr-product__name">${a.name}</h3>
        <div class="cr-product__desc">${(a.desc||'').toString()}</div>
        <div class="cr-product__meta">
          <div><i class="fa-solid fa-hashtag"></i> <strong>SKU:</strong> ${a.sku||'-'}</div>
          <div><i class="fa-solid fa-tags"></i> <strong>Subcat:</strong> ${(a.subcat||'otros')}</div>
        </div>
        <div class="cr-product__actions" style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:8px;">
          <button class="cr-btn cr-acc-btn" type="button" data-acc-id="${key}"><i class="fa-solid fa-cart-plus"></i> Agregar</button>
          <div class="cr-pricebar"><span class="cr-from">Desde</span> <span class="cr-price">${currency(a.price||0)}</span></div>
        </div>`;
      grid.appendChild(card);
    });
    // actualizar contador
    if (els.accCount) els.accCount.textContent = String(accs.length);
    grid.querySelectorAll('[data-acc-id]').forEach(btn => {
      if (btn.__bound) return; btn.__bound = true;
      btn.addEventListener('click', () => toggleAccessorySelection(btn.getAttribute('data-acc-id')));
    });
    updateAccessorySelectionStyles();
  } catch {}
}

// Seleccionar/deseleccionar accesorio por nombre (clave coherente con resumen)
function toggleAccessorySelection(id) {
  if (!id) return;
  if (state.accSelected.has(id)) state.accSelected.delete(id); else state.accSelected.add(id);
  // cantidad por defecto 1 si no existe
  if (state.accSelected.has(id) && !state.accQty[id]) state.accQty[id] = 1;
  try { renderAccessoriesSummary(); recalcTotalVenta(); } catch {}
  // actualizar badge
  try {
    const badge = document.getElementById('cr-acc-badge');
    const badgeCount = document.getElementById('cr-acc-badge-count');
    if (badge && badgeCount) { const c = state.accSelected.size; badgeCount.textContent = String(c); badge.hidden = c===0; }
  } catch {}
  updateAccessorySelectionStyles();
}

function updateAccessorySelectionStyles() {
  try {
    const grid = els.accGrid || document.getElementById('cr-accessories');
    if (!grid) return;
    grid.querySelectorAll('.cr-acc-item').forEach(card => {
      const id = card.getAttribute('data-key') || card.getAttribute('data-name');
      const selected = state.accSelected.has(id);
      card.classList.toggle('is-selected', selected);
      const btn = card.querySelector('[data-acc-id]');
      if (btn) {
        btn.classList.toggle('is-selected', selected);
        btn.innerHTML = selected ? '<i class="fa-solid fa-check"></i> Agregado' : '<i class="fa-solid fa-cart-plus"></i> Agregar';
      }
    });
  } catch {}
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
      warehouses: [],
      selectedWarehouse: null,
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
  // pasos (stepper)
  els.stepProducts = document.getElementById('cr-step-products');
  els.stepConfig = document.getElementById('cr-step-config');
  els.stepShipping = document.getElementById('cr-step-shipping');
  // menú hamburguesa (lateral)
  els.hamburger = document.getElementById('cr-hamburger');
  els.sideMenu = document.getElementById('cr-sidemenu');
  els.sideBackdrop = document.getElementById('cr-sidemenu-backdrop');
  els.sideCloseBtns = document.querySelectorAll('[data-close-menu]');
  // accesorios (Venta)
      els.accGrid = document.getElementById('cr-accessories');
      els.accSearch = document.getElementById('cr-accessory-search');
      els.accSubcat = document.getElementById('cr-acc-subcat');
      els.accSort = document.getElementById('cr-acc-sort');
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
  let sub = (els.accSubcat?.value || '').trim().toLowerCase();
  if (sub === 'todas') sub = '';
  const sort = (els.accSort?.value || 'name').toLowerCase();

  // Si se limpió la búsqueda y no hay tarjetas en el DOM por algún estado previo, repoblar desde estado
  if (!q && !sub && cards.length === 0 && Array.isArray(state.accessories)) {
    try { renderAccessoriesVenta(); } catch {}
  }
  // Recalcular tarjetas después de un posible repintado
  const allCards = Array.from(grid.querySelectorAll('.cr-acc-item'));

  // Siempre resetear display antes de recalcular
  allCards.forEach(c => { c.style.display = ''; });

  let filtered = allCards.filter(card => {
    const name = (card.getAttribute('data-name') || '').toLowerCase();
    const sku = (card.getAttribute('data-sku') || '').toLowerCase();
    const subcat = (card.getAttribute('data-subcat') || '').toLowerCase();
    const desc = (card.querySelector('.cr-product__desc')?.textContent || '').toLowerCase();
    const matchesText = !q || name.includes(q) || sku.includes(q) || desc.includes(q);
    const matchesSub = (!sub || subcat === sub);
    return matchesText && matchesSub;
  });
  filtered.sort((a,b)=>{
    if (sort==='stock') return (parseInt(b.getAttribute('data-stock')||'0',10)) - (parseInt(a.getAttribute('data-stock')||'0',10));
    const na=(a.getAttribute('data-name')||'').toLowerCase(); const nb=(b.getAttribute('data-name')||'').toLowerCase();
    return na.localeCompare(nb);
  });
  // Re-append en el orden filtrado y actualizar contador
  grid.innerHTML = '';
  filtered.forEach(n => { n.style.display=''; grid.appendChild(n); });
  if (els.accCount) els.accCount.textContent = String(filtered.length);
}

    function updateNotesCounters() {
      const n = state.notes.length;
      if (els.notesCount) { els.notesCount.textContent = String(n); els.notesCount.hidden = n === 0; }
      if (els.notesChip) els.notesChip.textContent = `${n} nota${n===1?'':'s'}`;
    }

    // Filtro por búsqueda y categoría (Venta)
    function filterProducts() {
      try {
        const qInput = els.search || document.getElementById('v-search-code');
        const q = (qInput?.value || '').trim().toLowerCase();
        const cat = document.querySelector('input[name="cr-category"]:checked')?.value || '';
        const base = (state.products||[]);

    state.filtered = base.filter(p => {
      const name = (p.name||'').toLowerCase();
      const id = String(p.id||'').toLowerCase();
      const sku = String(p.sku||'').toLowerCase();
      const brand = String(p.brand||'').toLowerCase();
      const desc = String(p.desc||'').toLowerCase();
      const matchesText = (!q || name.includes(q) || id.includes(q) || sku.includes(q) || brand.includes(q) || desc.includes(q));
      const matchesCat = (!cat ? true : p.categorySlug === cat);
      
      // Filter by warehouse if one is selected
      const matchesWarehouse = (!state.selectedWarehouse || 
        !state.selectedWarehouse.id_almacen || 
        p.id_almacen === state.selectedWarehouse.id_almacen ||
        p.almacen_id === state.selectedWarehouse.id_almacen);
      
      // Debug log for warehouse filtering
      if (state.selectedWarehouse && state.selectedWarehouse.id_almacen) {
        console.log(`[filterProducts] Product ${p.name}: warehouse ${p.id_almacen}, selected ${state.selectedWarehouse.id_almacen}, matches: ${matchesWarehouse}`);
      }
      
      return matchesText && matchesCat && matchesWarehouse;
    });
    // Si no hay resultados y hay categoría seleccionada, reintenta ignorando categoría
    if (state.filtered.length === 0 && cat) {
      state.filtered = base.filter(p => {
        const name = (p.name||'').toLowerCase();
        const id = String(p.id||'').toLowerCase();
        const sku = String(p.sku||'').toLowerCase();
        const brand = String(p.brand||'').toLowerCase();
        const desc = String(p.desc||'').toLowerCase();
        const matchesText = (!q || name.includes(q) || id.includes(q) || sku.includes(q) || brand.includes(q) || desc.includes(q));
        
        // Keep warehouse filter even when ignoring category
        const matchesWarehouse = (!state.selectedWarehouse || 
          !state.selectedWarehouse.id_almacen || 
          p.id_almacen === state.selectedWarehouse.id_almacen ||
          p.almacen_id === state.selectedWarehouse.id_almacen);
        
        return matchesText && matchesWarehouse;
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
          // Agregar campos de almacén
          const id_almacen = it.id_almacen;
          const nombre_almacen = it.nombre_almacen;
          const ubicacion = it.ubicacion || '';
          return { 
            id, sku, name, desc, brand, image, category: originalCategory, categorySlug, stock, 
            quality: (it.condicion||it.estado||'Bueno'), price: { diario: p },
            id_almacen, nombre_almacen, ubicacion
          };
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
            { id: 'P-001', sku: 'P-001', name: 'Marco estándar', desc: 'Módulo marco estándar', brand: 'ATS', image: 'img/default.jpg', category: 'ANDAMIO MARCO Y CRUCETA', categorySlug: 'marco_cruceta', stock: 50, quality: 'Nuevo', price: { diario: 120 }, id_almacen: 1, nombre_almacen: 'BODEGA 68 CDMX', ubicacion: 'CDMX' },
            { id: 'P-002', sku: 'P-002', name: 'Cruceta 2.0m', desc: 'Cruceta de 2.0m', brand: 'ATS', image: 'img/default.jpg', category: 'ANDAMIO MARCO Y CRUCETA', categorySlug: 'marco_cruceta', stock: 80, quality: 'Nuevo', price: { diario: 70 }, id_almacen: 2, nombre_almacen: 'TEXCOCO', ubicacion: 'Estado de México' },
            { id: 'P-003', sku: 'P-003', name: 'Templete 1.5m', desc: 'Templete reforzado', brand: 'ATS', image: 'img/default.jpg', category: 'TEMPLETES', categorySlug: 'templetes', stock: 20, quality: 'Bueno', price: { diario: 200 }, id_almacen: 1, nombre_almacen: 'BODEGA 68 CDMX', ubicacion: 'CDMX' }
          ];
        }
        console.log('[loadProductsFromAPI] Products with warehouse data:', filtered.slice(0, 3));
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
    const listEl = document.getElementById('cr-acc-summary-list');
    const badge = document.getElementById('cr-acc-badge');
    const badgeCount = document.getElementById('cr-acc-badge-count');
    if (!totalEl || !detailEl) return;
    let total = 0;
    const map = new Map((state.accessories||[]).map(a => [accKey(a), a]));

    // Render listado con controles de cantidad
    if (listEl) listEl.innerHTML = '';
    state.accSelected.forEach(id => {
      const acc = map.get(id);
      const qty = Math.max(1, Number(state.accQty?.[id]||1));
      if (!acc) return;
      const line = qty * Number(acc.price||0);
      total += line;
      if (listEl) {
        const row = document.createElement('div');
        row.className = 'cr-summary-row';
        row.setAttribute('data-acc', accKey(acc)); // Use safe accessory key
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr auto auto';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.innerHTML = `
          <div>
            <div style="font-weight:700; font-size:14px;">${acc.name}</div>
            <div style="color:#64748b; font-size:12px;">SKU: ${acc.sku||'-'}</div>
          </div>
          <div class="cr-qty" style="display:flex; align-items:center; gap:6px;">
            <button type="button" class="cr-btn cr-btn--sm" data-action="dec" aria-label="Disminuir">−</button>
            <input type="number" class="cr-input" data-action="qty" value="${qty}" min="1" style="width:64px; text-align:center;" />
            <button type="button" class="cr-btn cr-btn--sm" data-action="inc" aria-label="Aumentar">+</button>
          </div>
          <div style="text-align:right; display:flex; align-items:center; gap:8px;">
            <button type="button" class="cr-btn cr-btn--ghost cr-btn--sm" title="Eliminar" aria-label="Eliminar" data-action="remove"><i class="fa-solid fa-trash"></i></button>
            <strong class="cr-summary-item-total" style="color:#2563eb;">${currency(line)}</strong>
          </div>`;
        listEl.appendChild(row);
      }
    });

    // Bind controles de cantidad y eliminar
    if (listEl) {
      listEl.querySelectorAll('.cr-summary-row').forEach(row => {
        const id = row.getAttribute('data-acc');
        const dec = row.querySelector('[data-action="dec"]');
        const inc = row.querySelector('[data-action="inc"]');
        const qty = row.querySelector('[data-action="qty"]');
        const rem = row.querySelector('[data-action="remove"]');
        if (dec && !dec.__bound) { dec.addEventListener('click', () => { state.accQty[id] = Math.max(1,(Number(state.accQty[id]||1)-1)); renderAccessoriesSummary(); recalcTotalVenta(); updateAccessorySelectionStyles(); }); dec.__bound = true; }
        if (inc && !inc.__bound) { inc.addEventListener('click', () => { state.accQty[id] = Math.max(1,(Number(state.accQty[id]||1)+1)); renderAccessoriesSummary(); recalcTotalVenta(); updateAccessorySelectionStyles(); }); inc.__bound = true; }
        if (qty && !qty.__bound) {
          qty.addEventListener('change', () => { state.accQty[id] = Math.max(1, Number(qty.value||1)); renderAccessoriesSummary(); recalcTotalVenta(); updateAccessorySelectionStyles(); });
          qty.__bound = true;
        }
        if (rem && !rem.__bound) { rem.addEventListener('click', () => { state.accSelected.delete(id); delete state.accQty[id]; renderAccessoriesSummary(); recalcTotalVenta(); updateAccessorySelectionStyles(); }); rem.__bound = true; }
      });
    }

    totalEl.textContent = currency(total);
    detailEl.textContent = state.accSelected.size ? '' : 'Sin accesorios seleccionados';
    const count = state.accSelected.size;
    if (badge && badgeCount) { badgeCount.textContent = String(count); badge.hidden = count === 0; }
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

      // --- FAB de Notas: abrir/cerrar floater ---
      try {
        if (els.notesFab && !els.notesFab.__bound) {
          els.notesFab.addEventListener('click', (e) => {
            e.preventDefault();
            const hidden = els.notesFloater?.hidden !== false;
            if (hidden) {
              openNotesFloater();
              setTimeout(() => els.noteText?.focus(), 10);
            } else {
              try { document.getElementById('cr-note-text')?.blur(); } catch {}
              els.notesFloater?.setAttribute('aria-hidden','true');
              closeNotesFloater();
            }
          });
          els.notesFab.__bound = true;
        }
      } catch {}

      // --- Botón: Continuar a Envío ---
      try {
        const goShip = document.getElementById('cr-go-shipping');
        if (goShip && !goShip.__bound) {
          goShip.addEventListener('click', (e) => {
            e.preventDefault();
            try { /* cerrar menú si estuviera abierto */ els.sideBackdrop?.click?.(); } catch {}
            gotoStep('shipping');
          });
          goShip.__bound = true;
        }
      } catch {}

      // --- Botón: Volver a Productos (Paso 3) ---
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
      // Sincronizar buscadores (toolbar y cabecera de datos) y filtrar
      {
        const vSearch = document.getElementById('v-search-code');
        if (els.search && !els.search.__bound) {
          els.search.addEventListener('input', () => {
            if (vSearch) vSearch.value = els.search.value;
            filterProducts();
          });
          els.search.__bound = true;
        }
        if (vSearch && !vSearch.__bound) {
          vSearch.addEventListener('input', () => {
            if (els.search) els.search.value = vSearch.value;
            filterProducts();
          });
          vSearch.__bound = true;
        }
      }
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

      // navegación por números del stepper (clic en el número)
      try {
        els.stepProducts?.querySelector('.cr-step__number')?.addEventListener('click', (e)=>{
          e.preventDefault();
          try { closeMenu(); } catch {}
          gotoStep('products');
        });
        els.stepConfig?.querySelector('.cr-step__number')?.addEventListener('click', (e)=>{
          e.preventDefault();
          try { closeMenu(); } catch {}
          // Respetar validación existente: requiere al menos un producto
          if (!state.cart || state.cart.length === 0) {
            alert('Agrega al menos un producto al carrito.');
            return;
          }
          // Usa el mismo flujo que el botón Continuar para no romper nada
          handleGoConfig(e);
        });
        els.stepShipping?.querySelector('.cr-step__number')?.addEventListener('click', (e)=>{
          e.preventDefault();
          try { closeMenu(); } catch {}
          gotoStep('shipping');
        });
      } catch {}
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

      // --- Botón: Continuar a Envío ---
      try {
        const goShip = document.getElementById('cr-go-shipping');
        if (goShip && !goShip.__bound) {
          goShip.addEventListener('click', (e) => {
            e.preventDefault();
            try { /* cerrar menú si estuviera abierto */ els.sideBackdrop?.click?.(); } catch {}
            gotoStep('shipping');
            try { initializeMap(); } catch {}
          });
          goShip.__bound = true;
        }
      } catch {}

      // --- Carrusel (prev/next) ---
      try {
        const prev = document.getElementById('cr-car-prev');
        const next = document.getElementById('cr-car-next');
        const list = els.productsWrap;
        const doScroll = (dir) => {
          if (!list) return;
          const step = Math.max(160, Math.round(list.clientWidth * 0.9));
          list.scrollBy({ left: dir * step, behavior: 'smooth' });
        };
        if (prev && !prev.__bound) { prev.addEventListener('click', (e)=>{ e.preventDefault(); doScroll(-1); }); prev.__bound = true; }
        if (next && !next.__bound) { next.addEventListener('click', (e)=>{ e.preventDefault(); doScroll(1); }); next.__bound = true; }
        // actualizar estado de botones cuando el carrusel se desplaza
        list?.addEventListener('scroll', () => { try { updateCarouselButtons(); } catch {} });
        // y también al redimensionar
        window.addEventListener('resize', () => { try { updateCarouselButtons(); } catch {} });
      } catch {}

      // --- Menú hamburguesa (abrir/cerrar) ---
      try {
        const openMenu = () => {
          if (!els.sideMenu || !els.sideBackdrop || !els.hamburger) return;
          els.sideMenu.hidden = false;
          els.sideBackdrop.hidden = false;
          els.hamburger.classList.add('is-open');
          els.hamburger.setAttribute('aria-expanded','true');
          // asegurar accesibilidad
          els.sideMenu.removeAttribute('aria-hidden');
          els.sideMenu.classList.add('is-open');
        };
        const closeMenu = () => {
          if (!els.sideMenu || !els.sideBackdrop || !els.hamburger) return;
          els.sideMenu.hidden = true;
          els.sideBackdrop.hidden = true;
          els.hamburger.classList.remove('is-open');
          els.hamburger.setAttribute('aria-expanded','false');
          els.sideMenu.setAttribute('aria-hidden','true');
          els.sideMenu.classList.remove('is-open');
        };
        els.hamburger?.addEventListener('click', (e) => {
          e.preventDefault();
          const willOpen = els.sideMenu?.hidden !== false;
          if (willOpen) openMenu(); else closeMenu();
        });
        els.sideBackdrop?.addEventListener('click', closeMenu);
        els.sideCloseBtns?.forEach(btn => btn.addEventListener('click', closeMenu));
        document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeMenu(); });
      } catch {}
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
        const thead = tableWrap.querySelector('thead');
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
        // Limitar vista previa a ~3 filas visibles y activar scroll para ver más
        requestAnimationFrame(() => {
          try {
            const first = tbody.querySelector('tr');
            const rowH = first ? first.getBoundingClientRect().height : 64;
            const headH = thead ? thead.getBoundingClientRect().height : 44;
            const maxH = Math.round((headH || 44) + (rowH || 64) * 3 + 12);
            tableWrap.style.maxHeight = maxH + 'px';
            tableWrap.style.overflowY = 'auto';
            tableWrap.style.border = '1px solid #e2e8f0';
            tableWrap.style.borderRadius = '10px';
          } catch {}
        });
        // Use event delegation to prevent duplicate listeners
        if (!tbody.__bound) {
          tbody.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action="add"][data-id]');
            if (!btn) return; const tr = btn.closest('tr');
            const qtyInput = tr.querySelector('.cr-qty-input');
            const id = btn.getAttribute('data-id');
            const qty = Math.max(1, parseInt(qtyInput.value || '1', 10));
            for (let i=0;i<qty;i++) addToCart(id);
          });
          tbody.__bound = true;
        }
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
              <div class="cr-pricebar"><span class="cr-from">Desde</span> <span class="cr-price">${currency(Number(p.price?.diario||0))}</span></div>
            </div>
          </div>`;
        productsWrap.appendChild(card);
      });
      if (els.foundCount) els.foundCount.textContent = String(list.length);
      if (els.resultsText) els.resultsText.textContent = `Mostrando ${list.length} producto${list.length!==1?'s':''}`;
      // Bind event listeners with duplicate prevention
      productsWrap.querySelectorAll('[data-id]').forEach(btn => {
        if (!btn.__bound) {
          btn.addEventListener('click', () => addToCart(btn.getAttribute('data-id')));
          btn.__bound = true;
        }
      });
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
      // cargar almacenes
      try {
        if (window.initializeWarehousesVenta) {
          await window.initializeWarehousesVenta();
        }
      } catch (error) {
        console.warn('Warehouses not available');
      }
      // cargar accesorios reales desde inventario
      try {
        state.accessories = await loadAccessoriesFromAPI();
        renderAccessoriesVenta();
        populateAccessorySubcats();
        
      } catch {}

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
      // Importante: ya renderizamos accesorios con botones desde renderAccessoriesVenta()
      // No sobrescribir aquí con renderAccessoriesGrid(), porque esa versión no muestra el botón "Agregar".
      renderCart();
      bindEvents();
      // Accessories filters
      try {
        els.accSearch?.addEventListener('input', () => applyAccessoryFilters());
        els.accSubcat?.addEventListener('change', () => applyAccessoryFilters());
        els.accSort?.addEventListener('change', () => applyAccessoryFilters());
        const clr = document.getElementById('cr-acc-clear');
        if (clr && !clr.__bound) {
          clr.addEventListener('click', () => {
            if (els.accSearch) els.accSearch.value='';
            if (els.accSubcat) els.accSubcat.value='todas';
            applyAccessoryFilters();
          });
          clr.__bound = true;
        }
      } catch {}
      // aplicar filtros después de renderizar cards
      requestAnimationFrame(applyAccessoryFilters);
      // Toggle cuerpo de accesorios (sin cambiar la altura del card)
      const accToggle = document.getElementById('cr-acc-toggle');
      const accBody = document.getElementById('cr-acc-body');
      if (accToggle && accBody) {
        // Preparar estado inicial: colapsado visualmente pero ocupando el mismo alto
        try {
          accBody.classList.add('is-collapsed');
          accBody.removeAttribute('hidden');
          accToggle.setAttribute('aria-controls', 'cr-acc-body');
          accToggle.setAttribute('aria-expanded', 'false');
          accToggle.innerHTML = '<i class="fa-solid fa-plus"></i> Agregar accesorios';
        } catch {}

        accToggle.addEventListener('click', () => {
          const willOpen = accBody.classList.contains('is-collapsed');
          accBody.classList.toggle('is-collapsed');
          accToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          accToggle.innerHTML = willOpen
            ? '<i class="fa-solid fa-minus"></i> Ocultar accesorios'
            : '<i class="fa-solid fa-plus"></i> Agregar accesorios';
          if (willOpen) setTimeout(() => els.accSearch?.focus(), 10);
        });
      }
      applyAccessoryFilters();
      
      // Vincular botones PDF y Garant�a
      bindPDFAndDepositButtons();

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
        document.body.classList.remove('is-step-products','is-step-config','is-step-shipping','cr-mode-products','cr-mode-config','cr-mode-shipping');
        document.body.classList.add('is-step-config','cr-mode-config');
      } else if (step === 'shipping') {
        if (secShipping) { secShipping.hidden = false; requestAnimationFrame(() => secShipping.classList.add('cr-section--active')); }
        els.stepProducts?.classList.remove('cr-step--active');
        els.stepConfig?.classList.remove('cr-step--active');
        els.stepShipping?.classList.add('cr-step--active');
        document.body.classList.remove('is-step-products','is-step-config','is-step-shipping','cr-mode-products','cr-mode-config','cr-mode-shipping');
        document.body.classList.add('is-step-shipping','cr-mode-shipping');
        try { bindDeliveryMethod(); } catch {}
        try { bindShippingStep(); } catch {}
      } else {
        if (secProducts) { secProducts.hidden = false; requestAnimationFrame(() => secProducts.classList.add('cr-section--active')); }
        els.stepProducts?.classList.add('cr-step--active');
        els.stepConfig?.classList.remove('cr-step--active');
        els.stepShipping?.classList.remove('cr-step--active');
        document.body.classList.remove('is-step-products','is-step-config','is-step-shipping','cr-mode-products','cr-mode-config','cr-mode-shipping');
        document.body.classList.add('is-step-products','cr-mode-products');
      }
    }

    function goToStep3() {
      showSection('cr-config-section');
    }

    function goToStep4() {
      if (state.deliveryNeeded) {
        showSection('cr-shipping-section');
      }
    }

    function goToPreviousStep() {
      showSection('cr-config-section');
    }
  
    // Paso 4 (Venta): helpers completos de CP y búsqueda, espejo de Renta
    function normalizeMXStateName(name) {
      if (!name) return name; const n = String(name).toLowerCase();
      if (n.includes('distrito federal') || n.includes('mexico city') || n.includes('ciudad de méxico') || n.includes('ciudad de mexico')) return 'CDMX';
      return name;
    }
    function normalizeMXCityName(name) {
      if (!name) return name; const n = String(name).toLowerCase();
      if (n.includes('distrito federal') || n.includes('mexico city') || n.includes('ciudad de méxico') || n.includes('ciudad de mexico')) return 'Ciudad de México';
      return name;
    }
    function ensureColonyDatalist(inputEl, options) {
      if (!inputEl) return;
      let listId = inputEl.getAttribute('list');
      if (!listId) { listId = 'cr-colony-list'; inputEl.setAttribute('list', listId); }
      let dl = document.getElementById(listId);
      if (!dl) { dl = document.createElement('datalist'); dl.id = listId; inputEl.parentElement?.appendChild(dl); }
      if (Array.isArray(options)) dl.innerHTML = options.map(v => `<option value="${String(v).replace(/"/g,'&quot;')}"></option>`).join('');
    }
    function setZipStatus(type, text) {
      try {
        const zipEl = document.getElementById('cr-delivery-zip');
        if (!zipEl) return;
        let status = document.getElementById('cr-zip-status');
        if (!status) {
          status = document.createElement('div');
          status.id = 'cr-zip-status';
          status.className = 'cr-status';
          const parent = zipEl.closest('.cr-row') || zipEl.parentElement; parent?.appendChild(status);
        }
        status.textContent = text || '';
        status.classList.remove('is-loading','is-error','is-success');
        if (type === 'loading') { status.classList.add('is-loading'); status.innerHTML = `<span class="cr-spinner" aria-hidden="true"></span> ${text||''}`; }
        else if (type === 'error') { status.classList.add('is-error'); }
        else if (type === 'success') { status.classList.add('is-success'); }
      } catch {}
    }
    async function autofillFromPostalCodeMX(cp) {
      if (!cp || !/^\d{5}$/.test(cp)) return;
      setZipStatus('loading', 'Buscando CP...');
      const zipEl = document.getElementById('cr-delivery-zip');
      const cityEl = document.getElementById('cr-delivery-city');
      const stateEl = document.getElementById('cr-delivery-state');
      const colonyEl = document.getElementById('cr-delivery-colony');
      let city = ''; let state = ''; let colonies = [];
      try {
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
              if (edo) state = edo; if (muni) city = muni; if (Array.isArray(asents)) colonies = [...new Set(asents.filter(Boolean))];
            }
          } catch {}
        }
        const zRes = await fetch(`https://api.zippopotam.us/mx/${encodeURIComponent(cp)}`);
        if (zRes.ok) { const z = await zRes.json(); const place = Array.isArray(z.places) && z.places[0]; if (place) { city = city || place["place name"] || place["state abbreviation"] || ''; state = state || place["state"] || ''; } }
        const nRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&country=Mexico&postalcode=${encodeURIComponent(cp)}&limit=10`, { headers: { 'Accept': 'application/json' } });
        if (nRes.ok) { const data = await nRes.json(); if (Array.isArray(data)) { const subs = new Set(); for (const item of data) { const a = item?.address || {}; const s = a.suburb || a.neighbourhood || a.quarter || a.hamlet || ''; if (s) subs.add(s); } colonies = colonies.length ? colonies : Array.from(subs); } }
        if (zipEl) zipEl.value = cp;
        if (cityEl && city) cityEl.value = normalizeMXCityName(city);
        if (stateEl && state) stateEl.value = normalizeMXStateName(state);
        if (colonyEl) { ensureColonyDatalist(colonyEl, colonies); if (!colonyEl.value && colonies.length) colonyEl.value = colonies[0]; }
        const parts = []; if (city) parts.push(city); if (state) parts.push(state); if (colonies.length) parts.push(`${colonies.length} colonia(s)`);
        setZipStatus(parts.length ? 'success' : 'error', parts.length ? `Detectado: ${parts.join(', ')}` : 'No se encontró información para este CP');
      } catch {
        setZipStatus('error', 'No se encontró el CP');
      }
    }
    async function geocodeFreeTextMX(query) {
      if (!query || query.length < 4) return;
      try {
        setZipStatus('loading', 'Buscando dirección...');
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&country=Mexico&q=${encodeURIComponent(query)}&limit=10`, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) { setZipStatus('error', 'No se pudo buscar la dirección'); return; }
        const data = await res.json(); if (!Array.isArray(data) || data.length === 0) { setZipStatus('error', 'No se encontró la dirección'); return; }
        const best = data[0]; const addr = best?.address || {};
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
        const subs = new Set(); for (const i of data) { const a = i?.address || {}; const s = a.suburb || a.neighbourhood || a.quarter || a.hamlet || ''; if (s) subs.add(s); }
        ensureColonyDatalist(colonyEl, Array.from(subs));
        const pieces = []; if (postcode) pieces.push(postcode); if (city) pieces.push(city); if (state) pieces.push(state);
        setZipStatus('success', `Detectado: ${pieces.join(', ')}`);
      } catch {
        setZipStatus('error', 'No se pudo geocodificar');
      }
    }

    // Autocompletar datos de contacto por C.P. (MX) – espejo de renta
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
          // No hay datalist dedicado para municipio; sólo sugerencias lógicas
          if (muni) muniEl.value = normalizeMXCityName(muni);
        }
        if (countryEl && !countryEl.value) countryEl.value = 'México';
      } catch {}
    }

    function bindDeliveryMethod() {
      try {
        const rbBranch = document.getElementById('delivery-branch-radio');
        const rbHome = document.getElementById('delivery-home-radio');
        const cardBranch = document.getElementById('cr-branch-card');
        const homeWrap = document.getElementById('cr-home-delivery-wrap');
        const apply = () => {
          const isBranch = rbBranch && rbBranch.checked;
          if (cardBranch) cardBranch.style.display = isBranch ? 'block' : 'none';
          if (homeWrap) homeWrap.style.display = isBranch ? 'none' : 'block';
          state.deliveryNeeded = !isBranch;
        };
        if (rbBranch && !rbBranch.__bound) { rbBranch.addEventListener('change', apply); rbBranch.__bound = true; }
        if (rbHome && !rbHome.__bound) { rbHome.addEventListener('change', apply); rbHome.__bound = true; }
        // Estado inicial
        apply();
      } catch {}
    }

    function bindShippingStep() {
      try {
        // Botón calcular envío
        const calcBtn = document.getElementById('calculate-shipping-cost-btn');
        if (calcBtn && !calcBtn.__bound) {
          calcBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const km = Number(document.getElementById('cr-delivery-distance')?.value || 0);
            const zone = document.getElementById('cr-zone-type')?.value || 'metropolitana';
            // Regla: Metropolitana = km*4*12; Foráneo = km*4*18
            const factor = (zone === 'foraneo') ? 18 : 12;
            const cost = Math.max(0, Math.round((Number.isFinite(km) ? km : 0) * 4 * factor));
            const formula = `Costo = km × 4 × ${factor} (${zone})`;
            const costEl = document.getElementById('cr-delivery-cost');
            const display = document.getElementById('cr-delivery-cost-display');
            const hint = document.getElementById('cr-delivery-cost-formula');
            if (costEl) costEl.value = String(cost);
            if (display) display.textContent = `$${(Number(cost)||0).toFixed(0)}`;
            if (hint) hint.textContent = formula;
          });
          calcBtn.__bound = true;
        }

        // Abrir Google Maps con consulta básica (opcional, no mapa embebido)
        const mapsBtn = document.getElementById('open-google-maps-btn');
        if (mapsBtn && !mapsBtn.__bound) {
          mapsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const parts = [
              document.getElementById('cr-delivery-street')?.value || '',
              document.getElementById('cr-delivery-ext')?.value || '',
              document.getElementById('cr-delivery-colony')?.value || '',
              document.getElementById('cr-delivery-city')?.value || '',
              document.getElementById('cr-delivery-state')?.value || '',
              document.getElementById('cr-delivery-zip')?.value || ''
            ].filter(Boolean).join(' ');
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
            window.open(url, '_blank');
          });
          mapsBtn.__bound = true;
        }

        // Sincronizar checkbox de requiere entrega con estado
        const need = document.getElementById('cr-need-delivery');
        if (need && !need.__bound) {
          need.addEventListener('change', () => { state.deliveryNeeded = !!need.checked; });
          need.__bound = true;
        }

        // Entradas: CP y búsqueda con debounce
        const zipEl = document.getElementById('cr-delivery-zip');
        if (zipEl && !zipEl.__bound) {
          const debouncedZip = debounce(() => autofillFromPostalCodeMX(zipEl?.value?.trim()), 500);
          zipEl.addEventListener('input', debouncedZip);
          zipEl.addEventListener('change', () => autofillFromPostalCodeMX(zipEl?.value?.trim()));
          zipEl.__bound = true;
        }
        const searchEl = document.getElementById('cr-search-address');
        if (searchEl && !searchEl.__bound) {
          const debouncedSearch = debounce(() => searchLocation(), 700);
          searchEl.addEventListener('input', debouncedSearch);
          searchEl.addEventListener('keydown', (ev) => { if ((ev.key||ev.code)==='Enter'){ ev.preventDefault(); searchLocation(); }});
          searchEl.__bound = true;
        }

        // Contacto: autocompletar por CP y toggle usar datos de entrega
        const contactZip = document.getElementById('cr-contact-zip');
        if (contactZip && !contactZip.__bound) {
          const debouncedContactZip = debounce(() => autofillContactFromPostalCodeMX(contactZip?.value?.trim()), 500);
          contactZip.addEventListener('input', debouncedContactZip);
          contactZip.addEventListener('change', debouncedContactZip);
          contactZip.__bound = true;
        }
        const useDelivery = document.getElementById('cr-contact-use-delivery');
        if (useDelivery && !useDelivery.__bound) {
          const onToggle = () => {
            try {
              const dZip = document.getElementById('cr-delivery-zip')?.value?.trim();
              const dCity = document.getElementById('cr-delivery-city')?.value?.trim();
              const dState = document.getElementById('cr-delivery-state')?.value?.trim();
              const cZipEl = document.getElementById('cr-contact-zip');
              const cCityEl = document.getElementById('cr-contact-municipio');
              const cStateEl = document.getElementById('cr-contact-state');
              if (useDelivery.checked) {
                if (dZip && cZipEl) cZipEl.value = dZip;
                if (dCity && cCityEl) cCityEl.value = dCity;
                if (dState && cStateEl) cStateEl.value = dState;
                if (dZip) autofillContactFromPostalCodeMX(dZip);
              } else {
                if (cZipEl && cZipEl.value?.trim() === (dZip || '')) cZipEl.value = '';
                if (cCityEl && cCityEl.value?.trim() === (dCity || '')) cCityEl.value = '';
                if (cStateEl && cStateEl.value?.trim() === (dState || '')) cStateEl.value = '';
              }
            } catch {}
          };
          useDelivery.addEventListener('change', onToggle);
          useDelivery.__bound = true;
        }
      } catch {}
    }
  
    function searchLocation() {
      const address = document.getElementById('cr-search-address').value?.trim();
      if (!address) return alert('Por favor, ingresa una dirección.');
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
  
    // Funciones para botones PDF y Garantía
    function exportToPDF() {
      console.log(' Exportando cotización a PDF...');
      // TODO: Implementar exportación a PDF
      alert('Funcionalidad de exportar a PDF en desarrollo');
    }
    
    function showDeposit() {
      console.log('Mostrando información de garantía...');
      // TODO: Implementar modal de garantía
      alert('Funcionalidad de garantía en desarrollo');
    }

    // Vincular botones PDF y Garantía
    function bindPDFAndDepositButtons() {
      try {
        const pdfBtn = document.getElementById('cr-export-pdf');
        const depositBtn = document.getElementById('cr-show-deposit');
        
        if (pdfBtn && !pdfBtn.__bound) {
          pdfBtn.addEventListener('click', exportToPDF);
          pdfBtn.__bound = true;
        }
        
        if (depositBtn && !depositBtn.__bound) {
          depositBtn.addEventListener('click', showDeposit);
          depositBtn.__bound = true;
        }
      } catch (e) {
        console.error('Error vinculando botones PDF/Garantía:', e);
      }
    }

    // Exponer funcion globalmente para usarlas en el HTML
    window.goToStep3 = goToStep3;
    window.goToStep4 = goToStep4;
    window.goToPreviousStep = goToPreviousStep;
    window.searchLocation = searchLocation;
    window.exportToPDF = exportToPDF;
    window.showDeposit = showDeposit;
    // Exponer estado globalmente para resumen de venta
    window.state = state;
    window.currency = currency;
    window.accKey = accKey;
    window.updateGrandTotal = updateGrandTotal;
    // Buscador de accesorios dentro de #cr-accessories
    window.filterAccessories = function() {
      const q = (document.getElementById('cr-accessory-search')?.value || '').toLowerCase();
      document.querySelectorAll('#cr-accessories .cr-card[data-name]')
        .forEach(card => {
          const name = (card.getAttribute('data-name') || '').toLowerCase();
          card.style.display = name.includes(q) ? '' : 'none';
        });
    };
  

    // Función para actualizar el total combinado (módulos + accesorios)
    function updateGrandTotal() {
      try {
        const grandEl = document.getElementById('cr-grand-total');
        const grandDetailEl = document.getElementById('cr-grand-total-detail');
        
        if (!grandEl || !grandDetailEl) return;
        
        // Calcular total de productos (módulos)
        let modulesTotal = 0;
        if (state.cart && Array.isArray(state.cart)) {
          state.cart.forEach(ci => {
            const p = state.products?.find(x => x.id === ci.id);
            if (p) {
              const unitPrice = Number(p.price?.venta || p.price?.diario || 0);
              modulesTotal += unitPrice * ci.qty;
            }
          });
        }
        
        // Calcular total de accesorios
        let accessoriesTotal = 0;
        console.log('🔧 [DEBUG] Calculando accesorios:', {
          accessories: !!state.accessories,
          accSelected: !!state.accSelected,
          accSelectedSize: state.accSelected?.size || 0,
          accSelectedType: typeof state.accSelected
        });
        
        if (state.accessories && state.accSelected && state.accSelected.size > 0) {
          console.log('🔧 [DEBUG] Accesorios disponibles:', state.accessories.length);
          console.log('🔧 [DEBUG] Accesorios seleccionados:', Array.from(state.accSelected));
          
          // Usar la misma lógica que en el resumen de venta
          const accMap = new Map((state.accessories||[]).map(a => [window.accKey ? window.accKey(a) : a.id, a]));
          
          state.accSelected.forEach(id => {
            const acc = accMap.get(id);
            const qty = Math.max(1, Number(state.accQty?.[id] || 1));
            
            console.log(`🔧 [DEBUG] Accesorio ${id}:`, { acc: !!acc, qty, price: acc?.price });
            
            if (acc && qty > 0) {
              const itemTotal = Number(acc.price || 0) * qty;
              accessoriesTotal += itemTotal;
              console.log(`🔧 [DEBUG] Agregado: ${acc.name} - ${qty} x $${acc.price} = $${itemTotal}`);
            }
          });
        } else {
          console.log('🔧 [DEBUG] No hay accesorios seleccionados o estructura incorrecta');
        }
        
        // Total combinado
        const grandTotal = modulesTotal + accessoriesTotal;
        
        // Actualizar elementos
        grandEl.textContent = currency(grandTotal);
        
        // Crear detalle
        const parts = [];
        if (modulesTotal > 0) parts.push(`Módulos: ${currency(modulesTotal)}`);
        if (accessoriesTotal > 0) parts.push(`Accesorios: ${currency(accessoriesTotal)}`);
        grandDetailEl.textContent = parts.length > 0 ? parts.join(' · ') : '-';
        
        console.log('📊 Grand Total actualizado:', { modulesTotal, accessoriesTotal, grandTotal });
      } catch (e) {
        console.error('Error actualizando grand total:', e);
      }
    }


    document.addEventListener('DOMContentLoaded', init);
  })();
  


