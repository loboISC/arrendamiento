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

    window.updateDeliverySummary = updateDeliverySummary;

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

function ensureAccessoryKey(value) {
  if (value === undefined || value === null) return '';

  const coerceObject = (input) => ({ sku: input, id: input, name: input });

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      return accKey(coerceObject(trimmed));
    } catch {
      return trimmed.toLowerCase();
    }
  }

  if (typeof value === 'object') {
    try {
      return accKey(value);
    } catch {
      /* fall through */
    }
  }

  const stringValue = String(value ?? '').trim();
  if (!stringValue) return '';
  try {
    return accKey(coerceObject(stringValue));
  } catch {
    return stringValue.toLowerCase();
  }
}

// Renderiza accesorios reales en Paso 3 (Venta)
function renderAccessoriesVenta() {
  try {
    const grid = els.accGrid || document.getElementById('cr-accessories');
    if (!grid) return;
    grid.innerHTML = '';
    const accs = Array.isArray(state.accessories) ? state.accessories : [];
    accs.forEach(a => {
      const key = ensureAccessoryKey(a);
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

// Seleccionar/deseleccionar accesorio por clave normalizada
function toggleAccessorySelection(rawId) {
  if (!rawId) return;
  const id = ensureAccessoryKey(rawId);
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
      const rawKey = card.getAttribute('data-key') || card.getAttribute('data-name');
      const id = ensureAccessoryKey(rawKey);
      const selected = id ? state.accSelected.has(id) : false;
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

    const sanitizeAccessorySelectionState = () => {
      try {
        if (!(state.accSelected instanceof Set)) {
          state.accSelected = new Set(Array.isArray(state.accSelected) ? state.accSelected : []);
        }
        if (!(state.accConfirmed instanceof Set)) {
          state.accConfirmed = new Set(Array.isArray(state.accConfirmed) ? state.accConfirmed : []);
        }

        const normalizedSelected = new Set();
        state.accSelected.forEach((key) => {
          const normalized = ensureAccessoryKey(key);
          if (normalized) normalizedSelected.add(normalized);
        });

        const normalizedConfirmed = new Set();
        state.accConfirmed.forEach((key) => {
          const normalized = ensureAccessoryKey(key);
          if (normalized) normalizedConfirmed.add(normalized);
        });

        const normalizedQty = {};
        if (state.accQty && typeof state.accQty === 'object') {
          Object.keys(state.accQty).forEach((key) => {
            const normalized = ensureAccessoryKey(key);
            if (normalized) {
              normalizedQty[normalized] = Math.max(1, Number(state.accQty[key] || 1));
            }
          });
        }

        state.accSelected = normalizedSelected;
        state.accConfirmed = normalizedConfirmed;
        state.accQty = normalizedQty;
      } catch (error) {
        console.warn('[sanitizeAccessorySelectionState] Error normalizando estado de accesorios:', error);
      }
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
      const matchesCat = (!cat || cat === 'all' ? true : p.categorySlug === cat);
      
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
    if (state.filtered.length === 0 && cat && cat !== 'all') {
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
          // Mapear peso (kg) desde posibles campos del API
          const peso_kg = Number(
            it.peso_kg ?? it.peso ?? it.peso_unitario ?? it.peso_por_unidad ?? it.peso_producto ?? it.weight ?? it.weight_kg ?? 0
          ) || 0;
          return { 
            id, sku, name, desc, brand, image, category: originalCategory, categorySlug, stock, 
            quality: (it.condicion||it.estado||'Bueno'), price: { diario: p },
            id_almacen, nombre_almacen, ubicacion,
            peso_kg
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
          const peso_kg = Number(
            it.peso_kg ?? it.peso ?? it.peso_unitario ?? it.peso_por_unidad ?? it.peso_producto ?? it.weight ?? it.weight_kg ?? 0
          ) || 0;
          return { id, name, image, stock, subcat, price, sku, brand, desc, quality, peso_kg };
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
          const normalized = accKey(id);
          if (!normalized) return;
          if (state.accSelected.has(normalized)) {
            state.accSelected.delete(normalized);
            delete state.accQty[normalized];
            card.classList.remove('is-selected');
          } else {
            state.accSelected.add(normalized);
            if (!state.accQty[normalized]) state.accQty[normalized] = 1;
            card.classList.add('is-selected');
          }
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
    const map = new Map((state.accessories||[]).map(a => [ensureAccessoryKey(a), a]));

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
        row.setAttribute('data-acc', ensureAccessoryKey(acc)); // Use safe accessory key
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
          qty.addEventListener('input', () => {
            const raw = qty.value;
            if (raw === '') return;
            let v = parseInt(raw, 10);
            if (!Number.isFinite(v)) return;
            v = Math.max(1, v); // sin tope por stock
            state.accQty[id] = v; // solo estado
          });
          const normalizeAcc = () => {
            let v = parseInt(qty.value || '1', 10);
            if (!Number.isFinite(v) || v < 1) v = 1;
            state.accQty[id] = v;
            renderAccessoriesSummary();
            try { recalcTotalVenta(); updateAccessorySelectionStyles(); } catch {}
          };
          qty.addEventListener('change', normalizeAcc);
          qty.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); qty.blur(); } });
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
          // Permitir escritura libre; actualizar estado cuando sea número válido sin rerender
          qty.addEventListener('input', () => {
            const raw = qty.value;
            if (raw === '') return; // permitir vacío mientras escribe
            let v = parseInt(raw, 10);
            if (!Number.isFinite(v)) return; // esperar número válido
            v = Math.max(1, v); // sin tope por stock
            const item = state.cart.find(ci => ci.id === id);
            if (item) item.qty = v; // solo estado
          });
          // Normalizar al confirmar
          const normalize = () => {
            let v = parseInt(qty.value || '1', 10);
            if (!Number.isFinite(v) || v < 1) v = 1;
            const item = state.cart.find(ci => ci.id === id);
            if (item) item.qty = v;
            renderCart();
            try { renderSummaryVenta(); recalcTotalVenta(); } catch {}
          };
          qty.addEventListener('change', normalize);
          qty.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); qty.blur(); } });
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
        const accMap = new Map((state.accessories||[]).map(a => [ensureAccessoryKey(a), a]));
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
        // Registrar listener TEMPRANO para no perder el evento cuando los almacenes estén listos
        try {
          if (!document.__warehousesReadyBound) {
            document.addEventListener('warehouses:ready', () => { try { loadBranches(); } catch {} }, { once: false });
            document.__warehousesReadyBound = true;
          }
        } catch {}
        if (window.initializeWarehousesVenta) {
          await window.initializeWarehousesVenta();
          // Hidratar el select inmediatamente después de inicializar almacenes
          try { loadBranches(); } catch {}
        }
      } catch (error) {
        console.warn('Warehouses not available');
      }
      // cargar accesorios reales desde inventario
      try {
        state.accessories = await loadAccessoriesFromAPI();
        sanitizeAccessorySelectionState();
        renderAccessoriesVenta();
        populateAccessorySubcats();
        
      } catch {}

      // preselect category from URL if present
      const params = new URLSearchParams(window.location.search);
      const cat = params.get('categoria');
      // Mostrar inicialmente según radio seleccionado, si existe; si no, mostrar todo
      const selectedRadio = document.querySelector('#cr-filters input[type="radio"][name="cr-category"]:checked');
      if (selectedRadio) {
        if (selectedRadio.value === 'all') {
          state.filtered = state.products.slice();
        } else {
          state.filtered = state.products.filter(p => p.categorySlug === selectedRadio.value);
        }
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

    // Poblar select de sucursales con los almacenes disponibles
    function loadBranches() {
      try {
        const sel = document.getElementById('cr-branch-select');
        if (!sel) return;
        let warehouses = Array.isArray(state?.warehouses) ? state.warehouses : [];
        if (!Array.isArray(warehouses) || warehouses.length === 0) {
          warehouses = Array.isArray(window.state?.warehouses) ? window.state.warehouses : [];
        }
        // Fallback: leer de los chips renderizados en la card "Ubicación"
        if (!Array.isArray(warehouses) || warehouses.length === 0) {
          const chipNodes = Array.from(document.querySelectorAll('.cr-chip--warehouse[data-warehouse-id]'))
            .filter(n => n.getAttribute('data-warehouse-id') !== 'all');
          if (chipNodes.length) {
            warehouses = chipNodes.map(n => {
              const id = n.getAttribute('data-warehouse-id');
              const title = n.querySelector('.cr-chip__title')?.textContent?.trim() || 'Sucursal';
              const sub = n.querySelector('.cr-chip__subtitle')?.textContent?.trim() || '';
              return { id_almacen: id, nombre_almacen: title, ubicacion: sub };
            });
            try { console.log('[loadBranches] usando fallback desde chips de Ubicación:', warehouses); } catch {}
          }
        }
        if (!warehouses.length) { try { console.warn('[loadBranches] No hay almacenes disponibles para poblar el select'); } catch {} return; }
        const prev = (state?.selectedBranch?.id) || (window.state?.selectedBranch?.id) || '';
        const opts = [
          '<option value="" selected>Selecciona una sucursal</option>',
          ...warehouses.map(w => {
            const id = w.id_almacen ?? w.almacen_id ?? w.id ?? '';
            const name = w.nombre_almacen ?? w.nombre ?? w.name ?? 'Sucursal';
            const ub = w.ubicacion ?? w.ciudad ?? w.estado ?? '';
            const text = `${String(name)} — ${String(ub)}`.trim();
            return `<option value="${String(id)}">${text}</option>`;
          })
        ].join('');
        sel.innerHTML = opts;
        // Preseleccionar: prioridad selectedBranch, luego selectedWarehouse (card de Ubicación)
        if (prev) {
          sel.value = prev;
        } else {
          const sw = state?.selectedWarehouse || window.state?.selectedWarehouse || window.selectedWarehouse || null;
          if (sw) {
            const swId = sw.id_almacen ?? sw.almacen_id ?? sw.id ?? '';
            if (swId) sel.value = String(swId);
          }
        }
        // Actualizar resumen si hay selección válida
        if (sel.value) {
          try { updateBranchSummary(); } catch {}
        }
      } catch (e) { console.warn('[venta] loadBranches error:', e); }
    }
    // Exponer para depuración/manual
    try { window.loadBranches = loadBranches; } catch {}

    // Hidratar select en cuanto los almacenes estén listos
    try {
      if (!document.__warehousesReadyBound) {
        document.addEventListener('warehouses:ready', () => { try { loadBranches(); } catch {} }, { once: false });
        document.__warehousesReadyBound = true;
      }
    } catch {}
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
        try { loadBranches(); } catch {}
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
        // Asegurar enlaces y datos aunque no se use gotoStep('shipping')
        try { bindDeliveryMethod(); } catch {}
        try { bindShippingStep(); } catch {}
        try { loadBranches(); } catch {}
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

    // Actualiza el resumen de sucursal y el estado compartido (idempotente)
    function updateBranchSummary() {
      try {
        const branchSelect = document.getElementById('cr-branch-select');
        const branchSummary = document.getElementById('cr-branch-summary');
        const branchName = document.getElementById('cr-branch-name');
        if (!branchSelect || !branchSummary || !branchName) {
          console.warn('[venta] updateBranchSummary: elementos faltantes');
          return;
        }
        const selected = branchSelect.options[branchSelect.selectedIndex];
        if (selected && selected.value) {
          const parts = (selected.text || '').split('—');
          const name = (parts[0] || '').trim();
          const address = (parts[1] || '').trim();
          branchName.textContent = name || '-';
          branchSummary.hidden = false;
          const sb = { id: selected.value, name, address };
          state.selectedBranch = sb;
          try { if (window.state) window.state.selectedBranch = sb; } catch {}
        } else {
          branchSummary.hidden = true;
          state.selectedBranch = null;
          try { if (window.state) window.state.selectedBranch = null; } catch {}
        }
      } catch (e) { console.error('[venta] updateBranchSummary error:', e); }
    }

    function bindDeliveryMethod() {
      try {
        const rbBranch = document.getElementById('delivery-branch-radio');
        const rbHome = document.getElementById('delivery-home-radio');
        const cardBranch = document.getElementById('cr-branch-card');
        // Preferir el ID solicitado por el usuario; si no existe, retroceder al existente
        const homeWrap = document.getElementById('cr-delivery-home-wrap') || document.getElementById('cr-home-delivery-wrap');
        const branchSelect = document.getElementById('cr-branch-select');
        // Card de contacto: usar la inferior (donde está #cr-save-contact)
        const contactCard = (document.getElementById('cr-save-contact')?.closest('.cr-card')) || document.getElementById('cr-contact-card') || document.querySelector('.cr-contact-card');
        // Apuntar específicamente a la card de Costo de Envío
        const deliveryCostSection = (document.getElementById('calculate-shipping-cost-btn')?.closest('.cr-card')) || document.querySelector('.cr-card--muted');
        // Card de dirección de domicilio (la primera .cr-card dentro de #cr-home-delivery-wrap con título de camión)
        let homeAddressCard = null;
        try {
          const cardCandidate = homeWrap?.querySelector('.cr-card');
          const hasTruckIcon = !!cardCandidate?.querySelector('h3 i.fa-truck');
          homeAddressCard = hasTruckIcon ? cardCandidate : null;
        } catch {}

        // Manejar cambio de método de entrega
        const apply = () => {
          const isBranch = rbBranch && rbBranch.checked;
          if (cardBranch) cardBranch.style.display = isBranch ? 'block' : 'none';
          // No ocultar todo el wrapper porque contiene la card de contacto inferior; ocultar sólo la card de dirección
          if (homeAddressCard) homeAddressCard.style.display = isBranch ? 'none' : 'block';
          state.deliveryNeeded = !isBranch;
          // Asegurar SIEMPRE visible la card de contacto inferior
          if (contactCard) contactCard.style.display = 'block';
          
          // Mostrar/ocultar sección de costo de envío según el método
          if (deliveryCostSection) {
            deliveryCostSection.style.display = isBranch ? 'none' : 'block';
          }
          
          // Si es entrega en sucursal, validar selección
          if (isBranch) {
            try { loadBranches(); } catch {}
            try { updateBranchSummary(); } catch {}
            // Reintento corto para hidratar si los almacenes llegan tarde
            try {
              const sel = document.getElementById('cr-branch-select');
              if (sel && !sel.__retryHydrate) {
                sel.__retryHydrate = true;
                let attempts = 0;
                const maxAttempts = 10; // ~3s si interval=300ms
                const interval = setInterval(() => {
                  attempts++;
                  try { loadBranches(); } catch {}
                  if (sel.options && sel.options.length > 1) {
                    clearInterval(interval);
                  } else if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    sel.__retryHydrate = false;
                  }
                }, 300);
              }
            } catch {}
          }
        };

        // Inicializar eventos
        if (rbBranch && !rbBranch.__bound) { 
          rbBranch.addEventListener('change', apply); 
          rbBranch.__bound = true; 
        }
        if (rbHome && !rbHome.__bound) { 
          rbHome.addEventListener('change', apply); 
          rbHome.__bound = true; 
        }
        if (branchSelect && !branchSelect.__bound) {
          branchSelect.addEventListener('change', updateBranchSummary);
          branchSelect.__bound = true;
        }

        // Rehidratar opciones al interactuar con el select (por si los almacenes llegaron tarde)
        if (branchSelect && !branchSelect.__ensureLoad) {
          const ensureLoad = () => { try { loadBranches(); } catch {} };
          branchSelect.addEventListener('focus', ensureLoad);
          branchSelect.addEventListener('mousedown', ensureLoad);
          branchSelect.__ensureLoad = true;
        }

        // Estado inicial
        apply();
      } catch (e) { 
        console.error('Error en bindDeliveryMethod:', e);
      }
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

        // Enlazar botón Guardar datos del Paso Envío (usar el botón de la sección de contacto inferior)
        // Este botón solo debe mostrar el resumen, NO generar cotización
        const saveContactBtn = document.getElementById('cr-save-contact');
        if (saveContactBtn && !saveContactBtn.__bound) {
          saveContactBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Solo mostrar el resumen de cotización
            const summaryCard = document.getElementById('cr-quote-summary-card');
            if (summaryCard) {
              summaryCard.style.display = 'block';
              summaryCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          });
          saveContactBtn.__bound = true;
        }
        // Fallback opcional si existiera un botón separado
        const saveBtn = document.getElementById('cr-save-shipping-btn');
        if (saveBtn && !saveBtn.__bound) {
          saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            completeShippingStep();
          });
          saveBtn.__bound = true;
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
      try {
        console.log('[completeShippingStep] Iniciando generación de cotización...');
        
        // PASO 1: Validar que haya productos en el carrito
        if (!state.cart || state.cart.length === 0) {
          alert('No hay productos en el carrito. Agrega productos antes de generar la cotización.');
          return false;
        }
        
        // PASO 2: Verificar si hay un cliente seleccionado
        const clientLabel = document.getElementById('v-client-label');
        const clientHidden = document.getElementById('v-extra');
        const labelText = clientLabel ? clientLabel.textContent.trim() : '';
        const hiddenValue = clientHidden ? clientHidden.value.trim() : '';
        
        const hiddenIsValidId = hiddenValue && !isNaN(hiddenValue) && hiddenValue !== '';
        const labelIsValid = labelText && labelText !== '-' && labelText !== 'Seleccionar cliente' && labelText !== 'Seleccionar Cliente';
        const hasClient = labelIsValid && hiddenIsValidId;
        
        console.log('[completeShippingStep] Validación de cliente:', {
          labelText,
          hiddenValue,
          labelIsValid,
          hiddenIsValidId,
          hasClient
        });
        
        // PASO 3: Generar cotización directamente o abrir modal de cliente nuevo
        if (hasClient) {
          // Cliente existente: generar cotización directamente
          console.log('[completeShippingStep] Cliente existente detectado, generando cotización...');
          generateQuotationWithExistingClient();
          return false;
        } else {
          // Sin cliente: abrir modal de registro de cliente nuevo
          console.log('[completeShippingStep] Sin cliente, abriendo modal de registro...');
          showSaveClientModal();
          return false; // Detener flujo hasta que usuario registre cliente
        }
        
        // NOTA: Para cliente nuevo, el flujo continúa después de registrar el cliente
        // Ver: handleSaveClient()
        
      } catch (e) {
        console.error('[completeShippingStep] Error:', e);
        alert('Ocurrió un error al procesar la solicitud.');
        return false;
      }
    }
    
    // Exportar globalmente para que esté disponible desde el HTML
    window.completeShippingStep = completeShippingStep;
    
    // Función auxiliar para continuar con la validación de envío (llamada después de confirmar cliente)
    function validateShippingAndGenerate() {
      try {
        const rbBranch = document.getElementById('delivery-branch-radio');
        const isBranchDelivery = rbBranch && rbBranch.checked;
        
        // Validar selección de sucursal si es entrega en sucursal
        if (isBranchDelivery) {
          if (!state.selectedBranch) {
            alert('Por favor, selecciona una sucursal para continuar.');
            return false;
          }
        } else {
          // Validar dirección si es entrega a domicilio
          const street = document.getElementById('cr-delivery-street')?.value?.trim();
          const zip = document.getElementById('cr-delivery-zip')?.value?.trim();
          if (!street || !zip) {
            alert('Por favor, completa los datos de dirección para continuar.');
            return false;
          }
        }

        // Validar datos de contacto (comunes a ambos métodos) - priorizar card principal
        const contactCard = document.getElementById('cr-contact-card');
        const contactName = (contactCard?.querySelector('#cr-contact-name') || document.getElementById('cr-contact-name'))?.value?.trim();
        const contactPhone = (contactCard?.querySelector('#cr-contact-phone') || document.getElementById('cr-contact-phone'))?.value?.trim();
        const contactEmail = (contactCard?.querySelector('#cr-contact-email') || document.getElementById('cr-contact-email'))?.value?.trim();
        
        if (!contactName || !contactPhone) {
          alert('Por favor, completa los datos de contacto obligatorios (nombre y teléfono).');
          return false;
        }
        
        // Validar formato de correo si se proporcionó
        if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
          alert('Por favor, ingresa un correo electrónico válido.');
          return false;
        }
        
        // Sincronizar datos de envío con el estado y refrescar resumen
        syncShippingInfoFromDOM({ forceMethod: isBranchDelivery });
        
        // Mostrar resumen
        showSummaryCards();
        
        // Hacer scroll al resumen
        const summarySection = document.getElementById('cr-quote-summary-card');
        if (summarySection) {
          summarySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // Navegar a resumen sólo si existe sección dedicada
        try {
          if (document.getElementById('cr-summary-section') && typeof gotoStep === 'function') {
            gotoStep('summary');
          }
        } catch {}
        
        return true;
      } catch (e) {
        console.error('[validateShippingAndGenerate] Error:', e);
        alert('Ocurrió un error al procesar la información de envío.');
        return false;
      }
    }
    
    // Exportar globalmente para que esté disponible desde generateQuotationWithExistingClient
    window.validateShippingAndGenerate = validateShippingAndGenerate;
    
    // Actualizar el resumen de envío
    function updateDeliverySummary() {
      try {
        const deliverySummary = document.getElementById('cr-delivery-summary');
        const deliveryMethodInfo = document.getElementById('cr-delivery-method-info');
        const hojaPedidoBtn = document.getElementById('cr-open-hoja-pedido');

        if (!deliverySummary || !deliveryMethodInfo) return;

        const methodRows = [];

        if (state.shippingInfo) {
          const summaryPieces = [];
          let methodLabel = 'Método: No especificado';

          if (state.shippingInfo.method === 'branch') {
            methodLabel = 'Método: Recolección en Sucursal';
            summaryPieces.push(`
              <div style="display:grid; grid-template-columns:24px 1fr; gap:8px; align-items:center;">
                <div><i class="fa-solid fa-store" style="color:#8b5cf6;"></i></div>
                <div><strong>Sucursal:</strong> ${state.shippingInfo.branch?.name || 'No seleccionada'}</div>

                <div><i class="fa-solid fa-location-dot" style="color:#ef4444;"></i></div>
                <div><strong>Dirección:</strong> ${state.shippingInfo.branch?.address || 'No disponible'}</div>

                <div><i class="fa-solid fa-clock" style="color:#10b981;"></i></div>
                <div><strong>Horario:</strong> Lunes a Viernes de 9:00 AM a 6:00 PM</div>
              </div>
              <div style="margin-top:12px; background:#f8fafc; border-radius:8px; padding:12px; border:1px solid #e2e8f0;">
                <p style="margin:0 0 8px 0; color:#1e40af; font-size:14px;">
                  <i class="fa-solid fa-info-circle"></i> El pedido estará listo para recoger en 24-48 horas hábiles.
                </p>
                <p style="margin:0; font-size:13px; color:#475569;">
                  <strong>No olvides llevar:</strong> Identificación oficial y comprobante de pago.
                </p>
              </div>
            `);
          } else {
            const addr = state.shippingInfo.address || {};
            methodLabel = 'Método: Entrega a Domicilio';
            summaryPieces.push(`
              <div style="display:grid; grid-template-columns:24px 1fr; gap:8px; align-items:center;">
                <div><i class="fa-solid fa-truck" style="color:#8b5cf6;"></i></div>
                <div><strong>Dirección:</strong> ${addr.street || ''} ${addr.ext || ''} ${addr.int ? `Int. ${addr.int}` : ''}</div>

                <div><i class="fa-solid fa-map-marker-alt" style="color:#10b981;"></i></div>
                <div><strong>Colonia:</strong> ${addr.colony || ''}, C.P. ${addr.zip || ''}</div>

                <div><i class="fa-solid fa-city" style="color:#8b5cf6;"></i></div>
                <div><strong>Ciudad:</strong> ${addr.city || ''}, ${addr.state || ''}</div>

                ${addr.reference ? `
                  <div><i class="fa-solid fa-notes" style="color:#f59e0b;"></i></div>
                  <div><strong>Referencia:</strong> ${addr.reference}</div>
                ` : ''}
              </div>
              <div style="margin-top:12px; background:#f0f9ff; border-radius:8px; padding:12px; border:1px solid #e0f2fe;">
                <p style="margin:0 0 8px 0; color:#0369a1; font-size:14px;">
                  <i class="fa-solid fa-info-circle"></i> El tiempo de entrega es de 2 a 3 días hábiles después de confirmado el pago.
                </p>
                <p style="margin:0; font-size:13px; color:#475569;">
                  <strong>Horario de entrega:</strong> Lunes a Viernes de 9:00 AM a 6:00 PM
                </p>
              </div>
            `);
          }

          if (state.shippingInfo.contact) {
            const contact = state.shippingInfo.contact;
            summaryPieces.push(`
              <div style="margin-top:12px; padding-top:12px; border-top:1px dashed #e2e8f0;">
                <h4 style="margin:0 0 8px 0; font-size:15px; color:#1e293b;">
                  <i class="fa-solid fa-user" style="color:#8b5cf6;"></i> Datos de Contacto
                </h4>
                <div style="display:grid; grid-template-columns:24px 1fr; gap:8px; align-items:center;">
                  <div><i class="fa-solid fa-user" style="color:#8b5cf6;"></i></div>
                  <div><strong>Nombre:</strong> ${contact.name || ''}</div>

                  <div><i class="fa-solid fa-phone" style="color:#10b981;"></i></div>
                  <div><strong>Teléfono:</strong> ${contact.phone || ''}</div>

                  ${contact.email ? `
                    <div><i class="fa-solid fa-envelope" style="color:#ef4444;"></i></div>
                    <div><strong>Email:</strong> ${contact.email}</div>
                  ` : ''}

                  ${contact.company ? `
                    <div><i class="fa-solid fa-building" style="color:#8b5cf6;"></i></div>
                    <div><strong>Empresa:</strong> ${contact.company}</div>
                  ` : ''}
                </div>
              </div>
            `);
          }

          deliveryMethodInfo.innerHTML = `
            <div style="margin-bottom:12px; font-weight:600;">${methodLabel}</div>
            ${summaryPieces.join('')}
          `;
          deliverySummary.style.display = 'block';
        } else {
          deliveryMethodInfo.innerHTML = '<span style="color:#64748b;">No se ha configurado información de entrega.</span>';
          deliverySummary.style.display = 'none';
        }

        // Guardar snapshot para hoja de pedido
        try {
          const dataSnapshot = buildHojaPedidoSnapshot();
          sessionStorage.setItem('venta_hoja_pedido', JSON.stringify(dataSnapshot));
        } catch (snapshotError) {
          console.warn('[updateDeliverySummary] No se pudo guardar snapshot de hoja de pedido:', snapshotError);
        }

        if (hojaPedidoBtn && !hojaPedidoBtn.__bound) {
          hojaPedidoBtn.addEventListener('click', openHojaPedidoWindow);
          hojaPedidoBtn.__bound = true;
        }
      } catch (e) {
        console.error('Error en updateDeliverySummary:', e);
      }
    }

    function getStoredClientSnapshot() {
      try {
        const raw = localStorage.getItem('cr_selected_client');
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.warn('[getStoredClientSnapshot] Error leyendo cliente de localStorage:', error);
        return null;
      }
    }


    function getAssignedVendorFromState() {
      try {
        if (state?.assignedVendor) return state.assignedVendor;
        const select = document.getElementById('cr-sales-rep');
        if (select?.value) {
          return {
            id_usuario: select.value,
            nombre: select.options[select.selectedIndex]?.textContent?.trim() || select.value
          };
        }
        const stored = sessionStorage.getItem('venta_selected_vendor');
        return stored ? JSON.parse(stored) : null;
      } catch (error) {
        console.warn('[getAssignedVendorFromState] Error obteniendo vendedor:', error);
        return null;
      }
    }

    async function resolveProductsWithWarehouseInfo(products) {
      try {
        const needWarehouse = products.some(p => !p.almacen && typeof p.almacen !== 'string');
        if (!needWarehouse) return products;

        const headers = getAuthHeaders();
        const resp = await fetch(`${API_URL}/productos`, { headers });
        if (!resp.ok) return products;
        const catalog = await resp.json();
        if (!Array.isArray(catalog) || !catalog.length) return products;

        const map = new Map();

        catalog.forEach(item => {
          const id = String(item.id || item.id_producto || item.clave || item.sku || '').trim();
          if (!id) return;
          const entry = {
            almacen: item.nombre_almacen || item.almacen || item.sucursal || 'Principal',
            ubicacion: item.ubicacion || '',
            descripcion: item.descripcion || item.descripcion_larga || ''
          };
          map.set(id, entry);
        });

        return products.map(p => {
          const matched = map.get(String(p.id_producto || p.sku || '').trim());
          if (!matched) return p;
          return {
            ...p,
            almacen: matched.almacen || p.almacen,
            descripcion: p.descripcion || matched.descripcion || p.nombre,
            ubicacion_almacen: matched.ubicacion || p.ubicacion_almacen
          };
        });
      } catch (error) {
        console.warn('[resolveProductsWithWarehouseInfo] Error completando datos de almacén:', error);
        return products;
      }
    }


    function buildHojaPedidoSnapshot() {
      const folio = document.querySelector('[data-chip-folio]')?.textContent?.trim() || state.lastFolio || 'VEN-000000';

      const storedClient = getStoredClientSnapshot() || {};
      let formattedClient = null;
      try {
        if (typeof getExistingClientData === 'function') {
          formattedClient = getExistingClientData() || null;
        }
      } catch (error) {
        console.warn('[buildHojaPedidoSnapshot] No se pudo obtener cliente con getExistingClientData:', error);
      }

      const contact = state.shippingInfo?.contact || {};
      const address = state.shippingInfo?.address || {};
      const branch = state.shippingInfo?.branch || {};
 
      const vendor = getAssignedVendorFromState();


      const cliente = {
        id_cliente: formattedClient?.id_cliente || storedClient.id_cliente || storedClient.id || null,
        nombre: storedClient.nombre || storedClient.contacto_nombre || formattedClient?.contacto_nombre || contact.name || '',
        empresa: storedClient.empresa || storedClient.razon_social || contact.company || '',
        telefono: formattedClient?.contacto_telefono || storedClient.telefono || storedClient.contacto_telefono || contact.phone || '',
        email: formattedClient?.contacto_email || storedClient.email || storedClient.contacto_email || contact.email || '',
        direccion: address.street ? `${address.street || ''} ${address.ext || ''}`.trim() : (storedClient.direccion || storedClient.direccion_fiscal || storedClient.calle || ''),
        colonia: address.colony || storedClient.colonia || storedClient.colonia_fiscal || '',
        ciudad: address.city || storedClient.ciudad || storedClient.municipio || branch.city || '',
        estado: address.state || storedClient.estado || storedClient.estado_fiscal || branch.state || '',
        cp: address.zip || storedClient.cp || storedClient.codigo_postal || branch.zip || '',
        representante: contact.name || storedClient.contacto || storedClient.representante || formattedClient?.contacto_nombre || ''
      };

      let productos = [];
      try {
        if (typeof getCartProducts === 'function') {
          productos = getCartProducts() || [];
        }
      } catch (error) {
        console.warn('[buildHojaPedidoSnapshot] No se pudieron obtener productos con getCartProducts:', error);
        productos = [];
      }

      if ((!Array.isArray(productos) || productos.length === 0) && Array.isArray(state?.cart) && state.cart.length > 0) {
        try {
          productos = state.cart.map(cartItem => {
            const product = state.products?.find(p => String(p.id) === String(cartItem.id)) || {};
            const qty = Math.max(1, Number(cartItem.qty || 1));
            const unitPrice = Number(product.price?.venta || product.price?.diario || product.precio_unitario || 0) || 0;
            return {
              id_producto: String(product.id ?? cartItem.id ?? ''),
              nombre: product.name || product.nombre || '',
              sku: product.sku || product.clave || product.codigo || '',
              cantidad: qty,
              descripcion: product.desc || product.descripcion || product.descripcion_larga || '',
              almacen: product.nombre_almacen || product.almacen || state.selectedWarehouse?.nombre_almacen || '',
              precio_unitario: unitPrice,
              subtotal: unitPrice * qty
            };
          }).filter(item => item && (item.id_producto || item.nombre));
        } catch (error) {
          console.warn('[buildHojaPedidoSnapshot] Error generando productos desde state.cart:', error);
        }
      }

      if ((!Array.isArray(productos) || productos.length === 0) && typeof buildActiveQuoteSnapshotVenta === 'function') {
        try {
          const active = buildActiveQuoteSnapshotVenta();
          if (active?.items?.length) {
            productos = active.items.map(item => {
              const qty = Math.max(1, Number(item.cantidad ?? item.qty ?? 1));
              const unitPrice = Number(item.precio_unitario_venta ?? item.precio_unitario ?? item.unitPrice ?? 0) || 0;
              const subtotal = Number(item.importe ?? item.subtotal ?? unitPrice * qty);
              return {
                id_producto: String(item.id ?? item.sku ?? ''),
                nombre: item.nombre || item.name || '',
                sku: item.sku || '',
                cantidad: qty,
                descripcion: item.descripcion || item.desc || '',
                almacen: item.almacen?.nombre || active.almacen?.nombre || active.almacen?.id || '',
                precio_unitario: unitPrice,
                subtotal
              };
            }).filter(item => item && (item.id_producto || item.nombre));
          }
        } catch (error) {
          console.warn('[buildHojaPedidoSnapshot] Error usando buildActiveQuoteSnapshotVenta para productos:', error);
        }
      }

      if (!Array.isArray(productos)) {
        productos = [];
      }

      let accessories = [];
      if (typeof getAccessorySnapshot === 'function') {
        try { accessories = getAccessorySnapshot() || []; }
        catch (error) { console.warn('[buildHojaPedidoSnapshot] Error obteniendo accesorios con getAccessorySnapshot:', error); }
      }

      if ((!Array.isArray(accessories) || !accessories.length)) {
        try {
          const rawSession = sessionStorage.getItem('venta_accessories_snapshot');
          if (rawSession) accessories = JSON.parse(rawSession) || [];
        } catch (error) {
          console.warn('[buildHojaPedidoSnapshot] Error leyendo accesorios de sessionStorage:', error);
        }
      }

      if ((!Array.isArray(accessories) || !accessories.length)) {
        try {
          const rawLocal = localStorage.getItem('venta_accessories_snapshot');
          if (rawLocal) {
            accessories = JSON.parse(rawLocal) || [];
            try { sessionStorage.setItem('venta_accessories_snapshot', rawLocal); } catch (_) {}
          }
        } catch (error) {
          console.warn('[buildHojaPedidoSnapshot] Error leyendo accesorios de localStorage:', error);
        }
      }

      if (!Array.isArray(accessories)) {
        accessories = [];
      }

      const rawSelectedAccessories = (() => {
        try {
          return Array.isArray(state.accSelectedRaw)
            ? [...state.accSelectedRaw]
            : state.accSelectedRaw && typeof state.accSelectedRaw.values === 'function'
              ? [...state.accSelectedRaw.values()]
              : Array.isArray(state.accSelected)
                ? [...state.accSelected]
                : Array.from(state.accSelected || []);
        } catch (error) {
          console.warn('[buildHojaPedidoSnapshot] No se pudieron recopilar claves de accesorios sin normalizar:', error);
          return Array.from(state.accSelected || []);
        }
      })();

      const snapshot = {
        folio,
        generado_en: new Date().toISOString(),
        cliente: {
          id_cliente: cliente.id_cliente || null,
          nombre: cliente.nombre || contact.name || '',
          empresa: cliente.empresa || contact.company || '',
          telefono: cliente.telefono || contact.phone || '',
          email: cliente.email || contact.email || '',
          direccion: cliente.direccion || branch.address || '',
          colonia: cliente.colonia || '',
          ciudad: cliente.ciudad || branch.city || '',
          estado: cliente.estado || branch.state || '',
          cp: cliente.cp || branch.zip || '',
          representante: cliente.representante || contact.name || ''
        },
        envio: {
          metodo: state.shippingInfo?.method || 'desconocido',
          fecha_programada: document.getElementById('cr-delivery-time')?.value || '',
          distancia_km: state.shippingInfo?.address?.distance || '',
          referencia: address.reference || '',
          sucursal: branch.name || '',
          sucursal_direccion: branch.address || '',
          direccion: address.street ? `${address.street || ''} ${address.ext || ''}`.trim() : '',
          colonia: address.colony || '',
          ciudad: address.city || '',
          estado: address.state || '',
          cp: address.zip || '',
          contacto: contact.name || ''
        },
        vendedor: vendor ? {
          id_usuario: vendor.id_usuario || vendor.id,
          nombre: vendor.nombre || vendor.displayName || ''
        } : null,
        productos,
        accessories,
        condiciones: document.getElementById('cr-summary-conditions')?.value || '',
        notas: document.getElementById('cr-observations')?.value || '',
        totals: {
          subtotal: document.getElementById('cr-fin-subtotal')?.textContent || '',
          iva: document.getElementById('cr-fin-iva')?.textContent || '',
          total: document.getElementById('cr-fin-total')?.textContent || '',
          envio: document.getElementById('cr-fin-shipping')?.textContent || ''
        }
      };

      const productosPayload = JSON.stringify(snapshot.productos || []);
      const accesoriosPayload = JSON.stringify(accessories || []);
      const accesoriosDebugPayload = JSON.stringify({
        rawSelected: rawSelectedAccessories,
        normalizedSelected: Array.from(state.accSelected || []),
        snapshotCount: accessories?.length || 0
      });

      try { sessionStorage.setItem('venta_hoja_pedido_productos', productosPayload); } catch (error) {
        console.warn('[buildHojaPedidoSnapshot] No se pudieron persistir productos en sessionStorage:', error);
      }
      try { localStorage.setItem('venta_hoja_pedido_productos', productosPayload); } catch (error) {
        console.warn('[buildHojaPedidoSnapshot] No se pudieron persistir productos en localStorage:', error);
      }

      try { sessionStorage.setItem('venta_accessories_snapshot', accesoriosPayload); } catch (error) {
        console.warn('[buildHojaPedidoSnapshot] No se pudieron persistir accesorios en sessionStorage:', error);
      }
      try { localStorage.setItem('venta_accessories_snapshot', accesoriosPayload); } catch (error) {
        console.warn('[buildHojaPedidoSnapshot] No se pudieron persistir accesorios en localStorage:', error);
      }

      try { sessionStorage.setItem('venta_accessories_debug', accesoriosDebugPayload); } catch (_) {}
      try { localStorage.setItem('venta_accessories_debug', accesoriosDebugPayload); } catch (_) {}

      return snapshot;
    }

    function openHojaPedidoWindow() {
      try {
        const snapshot = buildHojaPedidoSnapshot();
        const payload = JSON.stringify(snapshot);
        sessionStorage.setItem('venta_hoja_pedido', payload);
        try {
          localStorage.setItem('venta_hoja_pedido', payload);
        } catch (storageError) {
          console.warn('[openHojaPedidoWindow] No se pudo guardar snapshot en localStorage:', storageError);
        }

        const hojaWindow = window.open('hoja_pedido.html', 'hojaPedido', 'width=1024,height=768');
        if (!hojaWindow) {
          alert('No se pudo abrir la hoja de pedido. Permite ventanas emergentes para este sitio.');
        }
      } catch (error) {
        console.warn('[openHojaPedidoWindow] No se pudo preparar snapshot para la hoja de pedido:', error);
        alert('Ocurrió un error al preparar la hoja de pedido. Intenta nuevamente.');
      }
    }
  
    // Funciones para botones PDF y Garantía
    function buildActiveQuoteSnapshotVenta() {
      try {
        const s = state || {};
        const items = (s.cart || []).map(ci => {
          const p = (s.products || []).find(x => x.id === ci.id);
          if (!p) return null;
          const qty = Math.max(1, Number(ci.qty || 1));
          const unitVenta = Number(p.price?.venta || p.price?.diario || 0);
          return {
            id: p.id || ci.id,
            sku: p.sku || p.clave || p.codigo || p.id || '',
            nombre: p.name || p.nombre || '',
            descripcion: p.desc || p.descripcion || '',
            imagen: p.image || p.imagen || '',
            unidad: p.unit || p.unidad || 'PZA',
            cantidad: qty,
            peso: Number(p.peso ?? p.weight ?? p.peso_kg ?? 0),
            precio_unitario_venta: unitVenta,
            dias: 1,
            importe: unitVenta * qty
          };
        }).filter(Boolean);

        // Detectar si aplica IVA desde la UI si existe, por defecto SÍ
        const getApplyIvaFromUI = () => {
          try {
            const sel = document.getElementById('cr-summary-apply-iva') || document.getElementById('venta-apply-iva') || document.getElementById('apply-iva') || document.getElementById('cr-apply-iva');
            if (sel && sel.tagName === 'SELECT') {
              const v = (sel.value || 'si').toLowerCase();
              return v === 'si' || v === 'true' || v === '1';
            }
            const chk = document.getElementById('venta-apply-iva-chk') || document.getElementById('apply-iva-chk');
            if (chk && 'checked' in chk) return !!chk.checked;
          } catch(_) {}
          return true; // por defecto aplica IVA
        };

        const getDiscountFromUI = () => {
          try {
            const sel = document.getElementById('cr-summary-apply-discount');
            const inp = document.getElementById('cr-summary-discount-percent-input');
            const apply = (sel?.value || 'no') === 'si';
            const pct = Math.max(0, Math.min(100, Number(inp?.value || 0)));
            return { apply, pct };
          } catch(_) { return { apply:false, pct:0 }; }
        };

        const getConditionsFromUI = () => {
          try {
            const ta = document.getElementById('cr-summary-conditions') || document.getElementById('venta-conditions') || document.getElementById('quote-conditions');
            if (ta) return String(ta.value || '').trim();
          } catch(_) {}
          return '';
        };

        const payload = {
          tipo: 'VENTA',
          fecha: new Date().toISOString(),
          moneda: 'MXN',
          folio: s.folio || s.quoteNumber || null,
          almacen: s.selectedWarehouse || null,
          cliente: s.client || s.cliente || (typeof window !== 'undefined' ? (window.selectedClient || null) : null),
          dias: 1,
          aplicaIVA: getApplyIvaFromUI(),
          discount: getDiscountFromUI(),
          envio: { costo: Number(state?.deliveryExtra || 0) || 0 },
          condiciones: getConditionsFromUI(),
          items
        };

        try { sessionStorage.setItem('active_quote', JSON.stringify(payload)); } catch (_) {}
        try { localStorage.setItem('active_quote', JSON.stringify(payload)); } catch (_) {}
        try { window.last_active_quote = payload; } catch (_) {}
        return payload;
      } catch (e) {
        console.warn('No se pudo preparar snapshot de cotización (VENTA):', e);
        return null;
      }
    }

    function exportToPDF() {
      try {
        if (!state.cart || state.cart.length === 0) {
          alert('Agrega al menos un producto al carrito.');
          return;
        }
        // Construir y persistir snapshot (storage) y obtener payload inmediato
        let payload = null;
        try { payload = buildActiveQuoteSnapshotVenta(); } catch (_) {}
        if (!payload) {
          try { payload = JSON.parse(sessionStorage.getItem('active_quote')); } catch (_) {}
          if (!payload) { try { payload = JSON.parse(localStorage.getItem('active_quote')); } catch (_) {} }
        }

        // Reusar una sola ventana de reporte si ya existe
        if (!window.__reportWin || window.__reportWin.closed) {
          try { window.__reportWin = window.open('reporte_venta_renta.html', '_blank'); } catch (_) { window.__reportWin = null; }
        } else {
          try { window.__reportWin.focus(); } catch (_) {}
        }

        const win = window.__reportWin;
        if (!win || win.closed) {
          // Fallback: misma ventana con storage ya escrito
          try { window.location.assign('reporte_venta_renta.html'); }
          catch (e) { window.location.href = 'reporte_venta_renta.html'; }
          return;
        }

        // Cancelar cualquier intervalo previo para evitar duplicados
        if (window.__reportPostTimer) {
          try { clearInterval(window.__reportPostTimer); } catch (_) {}
          window.__reportPostTimer = null;
        }

        // Enviar snapshot por postMessage varias veces para asegurar entrega
        let attempts = 0;
        const maxAttempts = 20; // ~4s
        window.__reportPostTimer = setInterval(() => {
          attempts++;
          try { win.postMessage({ type: 'active_quote', data: payload }, '*'); } catch (_) {}
          if (attempts >= maxAttempts || win.closed) {
            clearInterval(window.__reportPostTimer);
            window.__reportPostTimer = null;
          }
        }, 200);
      } catch (e) {
        console.error('Error al exportar a PDF:', e);
      }
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

    // Responder solicitudes del reporte pidiendo el snapshot (VENTA)
    try {
      window.addEventListener('message', (ev) => {
        try {
          const msg = ev?.data;
          if (!msg || typeof msg !== 'object') return;
          if (msg.type === 'request_active_quote') {
            // Asegurar snapshot actualizado en storage
            try { buildActiveQuoteSnapshotVenta(); } catch (_) {}
            let payload = null;
            try { payload = JSON.parse(sessionStorage.getItem('active_quote')); } catch (_) {}
            if (!payload) { try { payload = JSON.parse(localStorage.getItem('active_quote')); } catch (_) {} }
            if (!payload) { try { payload = window.last_active_quote || null; } catch (_) { payload = null; } }
            try { ev.source && ev.source.postMessage({ type: 'active_quote', data: payload }, '*'); } catch (_) {}
          }
        } catch (_) {}
      });
    } catch (_) {}

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
          const accMap = new Map((state.accessories||[]).map(a => [ensureAccessoryKey(a), a]));
          
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

    function exposeGlobals() {
      window.goToStep3 = goToStep3;
      window.goToStep4 = goToStep4;
      window.goToPreviousStep = goToPreviousStep;
      window.searchLocation = searchLocation;
      window.exportToPDF = exportToPDF;
      window.showDeposit = showDeposit;
      window.state = state;
      window.currency = currency;
      window.accKey = accKey;
      window.updateGrandTotal = updateGrandTotal;
      window.renderAccessoriesSummary = renderAccessoriesSummary;
      window.updateAccessorySelectionStyles = updateAccessorySelectionStyles;
      window.filterAccessories = function() {
        const q = (document.getElementById('cr-accessory-search')?.value || '').toLowerCase();
        document.querySelectorAll('#cr-accessories .cr-card[data-name]')
          .forEach(card => {
            const name = (card.getAttribute('data-name') || '').toLowerCase();
            card.style.display = name.includes(q) ? '' : 'none';
          });
      };

      if (typeof getCartProducts === 'function') {
        window.getCartProducts = getCartProducts;
      }
      if (typeof showCloneModal === 'function') {
        window.showCloneModal = showCloneModal;
      }
      if (typeof startCloneProcess === 'function') {
        window.startCloneProcess = startCloneProcess;
      }
      if (typeof saveQuotationFromMenu === 'function') {
        window.saveQuotationFromMenu = saveQuotationFromMenu;
      }
    }

    exposeGlobals();
    document.addEventListener('DOMContentLoaded', exposeGlobals, { once: true });

})();


// === FUNCIONALIDAD DE SELECCIÓN Y AUTOCOMPLETADO DE CLIENTE ===
(() => {
  const API_URL = 'http://localhost:3001/api';
  let selectedClientData = null;

  // Función para obtener headers con autenticación
  function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  // Función para formatear valores
  function formatValue(value) {
    return value || 'No especificado';
  }

  // Función para formatear moneda
  function formatCurrency(value) {
    if (!value || isNaN(value)) return '$0.00';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value);
  }

  // Función para formatear calificación
  function formatRating(rating) {
    if (!rating || isNaN(rating)) return 'Sin calificación';
    const stars = '⭐'.repeat(Math.round(rating));
    return `${stars} (${rating}/5)`;
  }

  // Función para renderizar detalles del cliente
  function renderClientDetails(client) {
    const content = document.getElementById('client-details-content');
    if (!content) return;

    // Mapeo inteligente de campos con múltiples posibles nombres
    const nombre = client.nombre || client.contacto || client.razon_social || '';
    const empresa = client.empresa || client.razon_social || '';
    const email = client.email || client.correo || '';
    const telefono = client.telefono || client.tel || client.phone || '';
    const rfc = client.rfc || '';
    const tipoCliente = client.tipo_cliente || client.tipo || 'Pequeña Empresa';
    
    const direccion = client.direccion || client.calle || client.domicilio || '';
    const ciudad = client.ciudad || client.municipio || client.localidad || '';
    const codigoPostal = client.codigo_postal || client.cp || '';
    const estado = client.estado_direccion || client.estado || '';
    
    const limiteCredito = parseFloat(client.limite_credito || client.credito_limite || 0);
    const diasCredito = parseInt(client.dias_credito || client.credito_dias || 30);
    const deudaActual = parseFloat(client.deuda_actual || client.saldo_pendiente || 0);
    const metodoPago = client.metodo_pago || client.forma_pago || 'Transferencia';
    
    const calGeneral = parseInt(client.calificacion_general || client.rating || 5);
    const calPago = parseInt(client.calificacion_pago || client.rating_pago || 5);
    const calComunicacion = parseInt(client.calificacion_comunicacion || client.rating_comunicacion || 5);
    const calEquipos = parseInt(client.calificacion_equipos || client.rating_equipos || 5);
    
    const notas = client.notas_generales || client.comentario || client.nota || client.observaciones || '';

    content.innerHTML = `
      <div style="display:grid;gap:20px;">
        <!-- Información Básica -->
        <div class="client-section">
          <h4 style="color:#374151;margin:0 0 15px 0;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-user" style="color:#3b82f6;"></i>
            Información Básica
          </h4>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;">
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Nombre</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(nombre)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Empresa</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(empresa)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Email</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(email)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Teléfono</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(telefono)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">RFC</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(rfc)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Tipo de Cliente</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(tipoCliente)}</p>
            </div>
          </div>
        </div>

        <!-- Información de Contacto -->
        <div class="client-section">
          <h4 style="color:#374151;margin:0 0 15px 0;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-location-dot" style="color:#10b981;"></i>
            Información de Contacto
          </h4>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;">
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Dirección</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(direccion)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Ciudad</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(ciudad)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Código Postal</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(codigoPostal)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Estado</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(estado)}</p>
            </div>
          </div>
        </div>

        <!-- Información Financiera -->
        <div class="client-section">
          <h4 style="color:#374151;margin:0 0 15px 0;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-dollar-sign" style="color:#f59e0b;"></i>
            Información Financiera
          </h4>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;">
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Límite de Crédito</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatCurrency(limiteCredito)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Días de Crédito</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${diasCredito} días</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Deuda Actual</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatCurrency(deudaActual)}</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Método de Pago</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${formatValue(metodoPago)}</p>
            </div>
          </div>
        </div>

        <!-- Calificaciones -->
        <div class="client-section">
          <h4 style="color:#374151;margin:0 0 15px 0;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-star" style="color:#fbbf24;"></i>
            Calificaciones
          </h4>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;">
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Calificación General</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${renderStars(calGeneral)} (${calGeneral}/5)</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Pago</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${renderStars(calPago)} (${calPago}/5)</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Comunicación</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${renderStars(calComunicacion)} (${calComunicacion}/5)</p>
            </div>
            <div class="info-item">
              <label style="font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Equipos</label>
              <p style="margin:4px 0 0 0;color:#1f2937;font-size:14px;">${renderStars(calEquipos)} (${calEquipos}/5)</p>
            </div>
          </div>
        </div>

        <!-- Notas Adicionales -->
        ${notas ? `
        <div class="client-section">
          <h4 style="color:#374151;margin:0 0 15px 0;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-sticky-note" style="color:#8b5cf6;"></i>
            Notas Adicionales
          </h4>
          <div class="info-item">
            <p style="margin:0;color:#1f2937;font-size:14px;line-height:1.5;background:#f9fafb;padding:12px;border-radius:6px;border-left:4px solid #6366f1;">
              ${formatValue(notas)}
            </p>
          </div>
        </div>
        ` : ''}
      </div>
    `;
  }

  // Función auxiliar para renderizar estrellas
  function renderStars(rating) {
    const fullStars = Math.floor(rating);
    let stars = '';
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars += '<i class="fa-solid fa-star" style="color:#fbbf24;"></i>';
      } else {
        stars += '<i class="fa-regular fa-star" style="color:#d1d5db;"></i>';
      }
    }
    return stars;
  }

  // Función para mostrar detalles del cliente seleccionado
  async function showClientDetails(clientData) {
    try {
      if (!clientData || (!clientData.id && !clientData.id_cliente)) {
        alert('Error: Datos de cliente inválidos');
        return;
      }

      selectedClientData = clientData;
      
      // Mostrar modal
      const modal = document.getElementById('client-details-modal');
      if (modal) {
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
      }

      // Renderizar detalles
      renderClientDetails(clientData);
      
    } catch (error) {
      renderClientDetails(clientData);
      const modal = document.getElementById('client-details-modal');
      if (modal) {
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
      }
    }
  }

  // Función para confirmar la selección del cliente
  function confirmClientSelection() {
    if (!selectedClientData) {
      return;
    }

    try {
      const clientDataCopy = { ...selectedClientData };
      
      // Actualizar los campos del formulario
      updateClientFields(clientDataCopy);
      
      // Cerrar ambos modales
      closeClientDetailsModal();
      closeClientModal();
      
      // Mostrar notificación de éxito
      showClientSelectionSuccess(clientDataCopy);
      
    } catch (error) {
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
        // Marcar explícitamente que se ha seleccionado un cliente
        clientLabel.setAttribute('data-selected', 'true');
        clientLabel.classList.add('has-client');
      }

      // Actualizar el campo oculto con el ID del cliente
      const clientHidden = document.getElementById('v-extra');
      if (clientHidden) {
        clientHidden.value = client.id || client.id_cliente || '';
      }

      // Almacenar datos completos del cliente en el estado global
      window.selectedClient = client;
      
      // Almacenar en localStorage solo después de una selección válida
      if (client && (client.id || client.id_cliente)) {
        localStorage.setItem('cr_selected_client', JSON.stringify(client));
      }
      
      // Cargar automáticamente los datos de contacto
      loadClientContactData(client);
      
    } catch (error) {
      // Error silencioso
    }
  }

  // Función para cargar los datos de contacto del cliente seleccionado
  function loadClientContactData(client) {
    try {
      // Mapeo correcto de campos con prefijo cr- (no v-)
      const contactFields = {
        'cr-contact-name': client.nombre || client.contacto || '',
        'cr-contact-phone': client.telefono || '',
        'cr-contact-email': client.email || '',
        'cr-contact-attn': client.atencion_nombre || client.contacto || '',
        'cr-contact-company': client.empresa || '',
        'cr-contact-mobile': client.telefono_alt || client.celular || '',
        'cr-contact-zip': client.codigo_postal || '',
        'cr-contact-state': client.estado_direccion || '',
        'cr-contact-municipio': client.ciudad || '',
        'cr-contact-country': 'México',
        'cr-contact-notes': client.notas_generales || client.nota || client.comentario || ''
      };

      // Campos de entrega (delivery)
      const deliveryFields = {
        'cr-delivery-address': client.direccion || '',
        'cr-delivery-city': client.ciudad || '',
        'cr-delivery-state': client.estado_direccion || '',
        'cr-delivery-zip': client.codigo_postal || '',
        'cr-delivery-colony': '' // No hay campo colonia en la BD
      };

      // Actualizar cada campo de contacto si existe
      Object.entries(contactFields).forEach(([fieldId, value]) => {
        const field = document.getElementById(fieldId);
        if (field && value) {
          field.value = value;
        }
      });

      // Actualizar campos de entrega
      Object.entries(deliveryFields).forEach(([fieldId, value]) => {
        const field = document.getElementById(fieldId);
        if (field && value) {
          field.value = value;
        }
      });

      // Configurar el tipo de persona basado en el tipo de cliente
      const condicionField = document.getElementById('cr-contact-condicion');
      if (condicionField) {
        if (client.tipo_cliente === 'Corporativo' || client.empresa || client.razon_social) {
          condicionField.value = 'moral';
        } else {
          condicionField.value = 'fisica';
        }
      }

      // Mostrar notificación de que los datos se cargaron
      showContactDataLoadedNotification(client.nombre || 'Cliente');

    } catch (error) {
      // Error silencioso
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
    
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);
    
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
    if (!client) {
      return;
    }

    const clientName = client.nombre || client.name || 'Cliente';
    
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
    
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 100);
    
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

  // Interceptar mensajes del iframe de clientes para mostrar detalles
  window.addEventListener('message', function(event) {
    try {
      let payload = null;
      const msg = event.data;
      
      if (typeof msg === 'object') {
        if (msg.type === 'select-client' && msg.payload) payload = msg.payload;
        else if (msg.type === 'cliente-seleccionado' && msg.data) payload = msg.data;
        else if (!msg.type && msg.id) payload = msg;
      }
      
      if (payload && (payload.id || payload.id_cliente)) {
        showClientDetails(payload);
        event.stopPropagation();
        return;
      }
      
    } catch (error) {
      // Error silencioso
    }
  }, true);

  // Event listeners para el modal de detalles del cliente
  function setupClientDetailsEventListeners() {
    const confirmBtn = document.getElementById('confirm-client-selection');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', confirmClientSelection);
    }

    document.querySelectorAll('[data-client-details-close]').forEach(btn => {
      btn.addEventListener('click', closeClientDetailsModal);
    });

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

  // ========================================
  // FUNCIONALIDAD DE GUARDADO DE BORRADORES
  // ========================================

  // Función para guardar cotización desde el menú lateral
  async function saveQuotationFromMenu() {
    try {
      console.log('[saveQuotationFromMenu] Iniciando guardado desde menú...');
      
      // Cerrar menú lateral primero para evitar conflictos de aria-hidden
      closeSideMenu();
      
      // Validar que hay productos en el carrito (opcional para borradores)
      const products = getCartProducts();
      if (!products || products.length === 0) {
        console.log('[saveQuotationFromMenu] No hay productos, pero se permite guardar borrador vacío');
      }

      // Verificar cliente desde la UI primero
      const clientLabel = document.getElementById('v-client-label');
      const clientHidden = document.getElementById('v-extra');
      const labelText = clientLabel ? clientLabel.textContent.trim() : '';
      const hiddenValue = clientHidden ? clientHidden.value : '';

      // Si no hay cliente activamente seleccionado en la UI, limpiar localStorage
      if (!labelText || labelText === '-' || labelText === 'Seleccionar Cliente' || !hiddenValue) {
        console.log('[saveQuotationFromMenu] No hay cliente seleccionado en UI, limpiando localStorage');
        localStorage.removeItem('cr_selected_client');
        showSaveClientModal();
        return;
      }

      // Solo si hay cliente en UI, verificar localStorage
      let storedClient = null;
      try {
        const storedData = localStorage.getItem('cr_selected_client');
        if (storedData) {
          storedClient = JSON.parse(storedData);
          // Verificar que el cliente almacenado corresponde con el seleccionado en UI
          if (storedClient.nombre !== hiddenValue) {
            console.log('[saveQuotationFromMenu] Cliente en localStorage no coincide con UI, limpiando');
            localStorage.removeItem('cr_selected_client');
            storedClient = null;
          } else {
            console.log('Cliente encontrado en localStorage:', storedClient);
          }
        }
      } catch (e) {
        console.warn('Error parsing stored client:', e);
        localStorage.removeItem('cr_selected_client');
      }

      console.log('[saveQuotationFromMenu] Estado del cliente:', {
        labelText,
        hiddenValue,
        storedClient
      });

      // Un cliente es válido solo si está seleccionado en UI y coincide con localStorage
      const isClientValid = labelText && 
                          hiddenValue && 
                          storedClient && 
                          (storedClient.nombre === hiddenValue) && 
                          (storedClient.id_cliente || storedClient.id);

      // Pequeño delay para que el menú se cierre completamente
      setTimeout(() => {
        if (isClientValid) {
          console.log('[saveQuotationFromMenu] Cliente válido encontrado, mostrando confirmación...');
          const modal = document.getElementById('cr-save-modal');
          if (modal) {
            // Actualizar información del cliente en el modal
            const nameEl = modal.querySelector('#cr-confirm-client-name');
            const repEl = modal.querySelector('#cr-confirm-client-rep');
            
            if (nameEl) {
              nameEl.textContent = storedClient?.empresa || 'Sin empresa registrada';
            }
            if (repEl) {
              repEl.textContent = storedClient?.nombre || hiddenValue || 'Cliente seleccionado';
            }

            // Mostrar el modal
            modal.hidden = false;
            document.body.classList.add('modal-open');

            // NOTA: El event listener se maneja globalmente en DOMContentLoaded
            // No agregar listeners duplicados aquí para evitar múltiples llamadas
            // El botón #cr-save-confirm ya tiene handleModalConfirm vinculado
            
          } else {
            console.error('Modal de confirmación no encontrado (#cr-save-modal)');
            showNotification('Error al mostrar confirmación', 'error');
          }
        } else {
          console.log('[saveQuotationFromMenu] No hay cliente válido, mostrando modal nuevo');
          showSaveClientModal();
        }
      }, 100);
      
    } catch (error) {
      console.error('[saveQuotationFromMenu] Error:', error);
      showNotification('Error al intentar guardar la cotización.', 'error');
    }
  }

  // Función para cerrar el menú lateral
  function closeSideMenu() {
    const menu = document.getElementById('cr-sidemenu');
    const backdrop = document.getElementById('cr-sidemenu-backdrop');
    const hamburger = document.getElementById('cr-hamburger');
    
    if (menu) {
      // Remover focus de cualquier elemento dentro del menú
      const focusedElement = menu.querySelector(':focus');
      if (focusedElement) {
        focusedElement.blur();
      }
      
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        menu.hidden = true;
      }, 200);
    }
    
    if (backdrop) {
      backdrop.hidden = true;
    }
    
    if (hamburger) {
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
    }
  }

  // Función para obtener productos del carrito
  function getCartProducts() {
    console.log('[getCartProducts] Obteniendo productos del carrito...');
    console.log('[getCartProducts] state.cart:', state.cart);
    
    const products = [];
    
    // Usar state.cart que es donde realmente están los productos
    state.cart.forEach(cartItem => {
      console.log('[getCartProducts] Buscando producto con ID:', cartItem.id, 'tipo:', typeof cartItem.id);
      
      // Buscar el producto completo en state.products
      // Comparar tanto string como number para evitar problemas de tipo
      const product = state.products.find(p => {
        return String(p.id) === String(cartItem.id);
      });
      
      if (product) {
        console.log('[getCartProducts] Producto encontrado:', product.name);
        const precio = Number(product.price?.venta || product.price?.diario || 0);
        products.push({
          id_producto: String(product.id),
          nombre: product.name || '',
          sku: product.sku || '',
          cantidad: cartItem.qty || 1,
          descripcion: product.desc || product.descripcion || '',
          almacen: product.nombre_almacen || state.selectedWarehouse?.nombre_almacen || '',
          precio_unitario: precio,
          subtotal: precio * (cartItem.qty || 1)
        });
      } else {
        console.error('[getCartProducts] ❌ Producto NO encontrado para ID:', cartItem.id);
        console.log('[getCartProducts] IDs disponibles:', state.products.map(p => p.id).slice(0, 10));
      }
    });
    
    console.log('[getCartProducts] Productos recopilados:', products);
    return products;
  }

  function getAccessorySnapshot() {
    try {
      if (!state || typeof state !== 'object') return [];
      if (!(state.accSelected instanceof Set) || state.accSelected.size === 0) return [];

      const accessoriesList = Array.isArray(state.accessories) ? state.accessories : [];
      if (!accessoriesList.length) return [];

      const accessoryMap = new Map();
      const alternativeKeys = new Map();

      accessoriesList.forEach((acc) => {
        const primaryKey = ensureAccessoryKey(acc);
        if (primaryKey) accessoryMap.set(primaryKey, acc);

        const candidates = [
          acc.id,
          acc.id_accesorio,
          acc.sku,
          acc.clave,
          acc.codigo,
          acc.codigo_barras,
          acc.name,
          acc.nombre
        ].map(ensureAccessoryKey).filter(Boolean);

        alternativeKeys.set(acc, candidates);
        candidates.forEach((key) => {
          if (!accessoryMap.has(key)) {
            accessoryMap.set(key, acc);
          }
        });
      });

      const selectedKeys = Array.from(state.accSelected);
      try {
        console.log('[getAccessorySnapshot] Seleccionados:', selectedKeys);
        console.log('[getAccessorySnapshot] Mapa (muestra):', Array.from(accessoryMap.keys()).slice(0, 10));
      } catch (_) {}

      const snapshot = selectedKeys.map((rawKey) => {
        const normalizedKey = ensureAccessoryKey(rawKey);
        let acc = accessoryMap.get(normalizedKey);

        if (!acc && accessoriesList.length) {
          acc = accessoriesList.find((item) => {
            const candidates = alternativeKeys.get(item) || [];
            return candidates.includes(normalizedKey);
          }) || null;
        }

        if (!acc) {
          console.warn('[getAccessorySnapshot] Sin coincidencia para:', rawKey, 'normalizado a', normalizedKey);
          return null;
        }

        const qtyCandidates = [
          rawKey,
          normalizedKey,
          ensureAccessoryKey(acc),
          ...(alternativeKeys.get(acc) || [])
        ].map(ensureAccessoryKey).filter(Boolean);

        let qty = 1;
        if (state.accQty && typeof state.accQty === 'object') {
          for (const candidate of qtyCandidates) {
            if (candidate && state.accQty[candidate] != null) {
              qty = Math.max(1, Number(state.accQty[candidate]));
              break;
            }
          }
        }

        const unitPrice = Number(
          acc.precio_unitario ?? acc.precio ?? acc.precio_venta ?? acc.price ?? acc.total ?? 0
        ) || 0;

        const almacen = [
          acc.nombre_almacen,
          acc.almacen,
          acc.store,
          acc.ubicacion,
          state.selectedWarehouse?.nombre_almacen,
          state.selectedWarehouse?.nombre
        ].find(value => typeof value === 'string' && value.trim()) || '';

        const sku = [
          acc.sku,
          acc.clave,
          acc.codigo,
          acc.codigo_barras,
          acc.id
        ].find(value => typeof value === 'string' && value.toString().trim()) || '';

        try {
          console.log('[getAccessorySnapshot] Incluyendo accesorio:', {
            key: rawKey,
            normalizedKey,
            resolvedKey: ensureAccessoryKey(acc),
            qty,
            sku
          });
        } catch (_) {}

        return {
          id: acc.id ?? acc.id_accesorio ?? rawKey,
          nombre: acc.name || acc.nombre || '',
          descripcion: acc.descripcion || acc.desc || acc.description || '',
          sku,
          cantidad: qty,
          almacen,
          precio_unitario: unitPrice,
          subtotal: unitPrice * qty
        };
      }).filter(Boolean);

      return snapshot;
    } catch (error) {
      console.warn('[getAccessorySnapshot] Error construyendo snapshot de accesorios:', error);
      return [];
    }
  }

  // Función para recopilar datos de la cotización
  function collectQuotationData() {
    try {
      console.log('[collectQuotationData] Iniciando recopilación...');
      const products = getCartProducts();
      console.log('[collectQuotationData] Productos obtenidos:', products.length);
      
      // Calcular totales y cantidad total
      let subtotal = 0;
      let cantidadTotal = 0;
      products.forEach(p => {
        subtotal += p.cantidad * p.precio_unitario;
        cantidadTotal += p.cantidad;
      });
      
      console.log('[collectQuotationData] Totales calculados:', {subtotal, cantidadTotal});
      
      const iva = subtotal * 0.16;
      const total = subtotal + iva;
      
      // Obtener fechas
      const fechaInicio = document.getElementById('v-date-start')?.value || new Date().toISOString().split('T')[0];
      const fechaFin = document.getElementById('v-date-end')?.value || new Date().toISOString().split('T')[0];
      
      // Obtener datos de contacto y entrega
      // Priorizar state.shippingInfo si existe (viene de validateShippingAndGenerate)
      const contactData = {
        contacto_nombre: state.shippingInfo?.contact?.name || document.getElementById('cr-contact-name')?.value || '',
        contacto_telefono: state.shippingInfo?.contact?.phone || document.getElementById('cr-contact-phone')?.value || '',
        contacto_email: state.shippingInfo?.contact?.email || document.getElementById('cr-contact-email')?.value || '',
        contacto_atencion: document.getElementById('cr-contact-attn')?.value || '',
        contacto_empresa: state.shippingInfo?.contact?.company || document.getElementById('cr-contact-company')?.value || '',
        contacto_celular: state.shippingInfo?.contact?.mobile || document.getElementById('cr-contact-mobile')?.value || '',
        contacto_cp: state.shippingInfo?.contact?.zip || document.getElementById('cr-contact-zip')?.value || '',
        contacto_estado: state.shippingInfo?.contact?.state || document.getElementById('cr-contact-state')?.value || '',
        contacto_municipio: document.getElementById('cr-contact-municipio')?.value || '',
        contacto_notas: document.getElementById('cr-contact-notes')?.value || ''
      };
      
      // Datos de entrega - priorizar state.shippingInfo.address si existe
      let entregaData = {};
      if (state.shippingInfo?.method === 'home' && state.shippingInfo?.address) {
        entregaData = {
          entrega_calle: state.shippingInfo.address.street || '',
          entrega_numero_ext: state.shippingInfo.address.ext || '',
          entrega_numero_int: state.shippingInfo.address.int || '',
          entrega_colonia: state.shippingInfo.address.colony || '',
          entrega_municipio: state.shippingInfo.address.city || '',
          entrega_estado: state.shippingInfo.address.state || '',
          entrega_cp: state.shippingInfo.address.zip || '',
          entrega_lote: state.shippingInfo.address.lote || '',
          hora_entrega_solicitada: state.shippingInfo.address.time || null, // ✅ null en lugar de ''
          entrega_referencia: state.shippingInfo.address.reference || '',
          entrega_kilometros: parseFloat(state.shippingInfo.address.distance) || 0
        };
      } else if (state.shippingInfo?.method === 'branch' && state.shippingInfo?.branch) {
        // Si es entrega en sucursal, usar datos de la sucursal
        entregaData = {
          entrega_direccion: state.shippingInfo.branch.address || '',
          entrega_ciudad: state.shippingInfo.branch.city || '',
          entrega_estado: state.shippingInfo.branch.state || '',
          entrega_cp: state.shippingInfo.branch.zip || '',
          entrega_sucursal: state.shippingInfo.branch.name || ''
        };
      } else {
        // Fallback a los campos del DOM
        const deliveryTime = document.getElementById('cr-delivery-time')?.value;
        entregaData = {
          entrega_calle: document.getElementById('cr-delivery-street')?.value || '',
          entrega_numero_ext: document.getElementById('cr-delivery-ext')?.value || '',
          entrega_numero_int: document.getElementById('cr-delivery-int')?.value || '',
          entrega_colonia: document.getElementById('cr-delivery-colony')?.value || '',
          entrega_municipio: document.getElementById('cr-delivery-city')?.value || '',
          entrega_estado: document.getElementById('cr-delivery-state')?.value || '',
          entrega_cp: document.getElementById('cr-delivery-zip')?.value || '',
          entrega_lote: document.getElementById('cr-delivery-lote')?.value || '',
          hora_entrega_solicitada: deliveryTime && deliveryTime.trim() !== '' ? deliveryTime : null, // ✅ null si está vacío
          entrega_referencia: document.getElementById('cr-delivery-reference')?.value || '',
          entrega_kilometros: parseFloat(document.getElementById('cr-delivery-distance')?.value) || 0
        };
      }
      
      // Capturar observaciones y condiciones
      const observaciones = document.getElementById('cr-observations')?.value || '';
      const condicionesField = document.getElementById('cr-summary-conditions');
      const condiciones = condicionesField?.value?.trim() || '';
      
      console.log('[collectQuotationData] 📝 Condiciones capturadas:', {
        fieldExists: !!condicionesField,
        value: condiciones,
        length: condiciones.length
      });
      
      // Recopilar accesorios seleccionados
      let accesorios = [];
      let accesoriosTotal = 0;
      
      if (state.accessories && state.accSelected && state.accSelected.size > 0) {
        console.log('[collectQuotationData] 🔧 Procesando accesorios:', {
          total: state.accSelected.size,
          ids: Array.from(state.accSelected)
        });
      } else {
        console.log('[collectQuotationData] ℹ️ No hay accesorios seleccionados');
      }

      accesorios = getAccessorySnapshot();

      if ((!Array.isArray(accesorios) || accesorios.length === 0)) {
        try {
          const stored = sessionStorage.getItem('venta_accessories_snapshot');
          if (stored) accesorios = JSON.parse(stored) || [];
        } catch (error) {
          console.warn('[collectQuotationData] Error recuperando accesorios desde storage:', error);
        }
      }

      accesoriosTotal = Array.isArray(accesorios)
        ? accesorios.reduce((total, acc) => total + Number(acc.subtotal || 0), 0)
        : 0;

      if (accesorios?.length) {
        console.log('[collectQuotationData] 🔧 Total accesorios:', accesorios.length, 'Monto:', accesoriosTotal);
      }
      
      const quotationData = {
        tipo_cotizacion: 'venta',
        estado: 'Borrador',
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        subtotal: subtotal,
        iva: iva,
        total: total,
        // Si no hay productos, enviar 1 para cumplir con la validación de la BD
        // (los borradores pueden guardarse sin productos reales)
        cantidad_total: cantidadTotal > 0 ? cantidadTotal : 1,
        productos: products,
        productos_seleccionados: JSON.stringify(products),
        accesorios: accesorios, // ✅ Accesorios agregados
        accesorios_seleccionados: JSON.stringify(accesorios), // ✅ JSON de accesorios
        notas: observaciones, // Observaciones
        condiciones: condiciones, // Condiciones
        ...contactData,
        ...entregaData
      };
      
      console.log('[collectQuotationData] ✅ Datos recopilados exitosamente:', quotationData);
      console.log('[collectQuotationData] 📦 Datos de entrega incluidos:', entregaData);
      return quotationData;
      
    } catch (error) {
      console.error('[collectQuotationData] ❌ Error:', error);
      return null;
    }
  }

  // Función para mostrar modal de confirmación (cliente existente)
  function showSaveConfirmModal() {
    try {
      // Establecer modo en guardar
      modalMode = 'save';
      
      // Validar que hay productos en el carrito
      const products = getCartProducts();
      if (!products || products.length === 0) {
        showNotification('No hay productos seleccionados para guardar.', 'error');
        return;
      }
      
      // Verificar que hay un cliente seleccionado 
      const clientData = getExistingClientData();
      if (!clientData || !clientData.id_cliente) {
        showNotification('Debe seleccionar un cliente antes de guardar la cotización.', 'error');
        showSaveClientModal();
        return;
      }
      
      // Obtener datos del cliente desde localStorage para mostrar
      const CLIENT_KEY = 'cr_selected_client';
      let empresa = 'No especificado';
      let representante = 'No especificado';
      
      try {
        const storedClient = localStorage.getItem(CLIENT_KEY);
        if (storedClient) {
          const clientData = JSON.parse(storedClient);
          empresa = clientData.empresa || clientData.razon_social || clientData.nombre || 'No especificado';
          representante = clientData.contacto || clientData.nombre || 'No especificado';
        }
      } catch (e) {
        console.warn('[showSaveConfirmModal] Error obteniendo datos del cliente:', e);
      }
      
      // Mostrar modal y actualizar datos
      const modal = document.getElementById('cr-save-modal');
      if (!modal) return;
      
      const clientNameEl = document.getElementById('cr-confirm-client-name');
      const clientRepEl = document.getElementById('cr-confirm-client-rep');
      
      if (clientNameEl) clientNameEl.textContent = empresa;
      if (clientRepEl) clientRepEl.textContent = representante;
      
      // Restaurar texto del botón para guardar
      const confirmBtn = modal.querySelector('#cr-save-confirm');
      if (confirmBtn) {
        confirmBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Sí, Guardar';
      }
      
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      
      // Bind del botón de confirmación si no está ya vinculado
      const confirmBtnAlt = modal.querySelector('[data-confirm-save]');
      if (confirmBtnAlt && !confirmBtnAlt.__bound) {
        confirmBtnAlt.addEventListener('click', handleModalConfirm);
        confirmBtnAlt.__bound = true;
      }

    } catch (error) {
      console.error('[showSaveConfirmModal] Error:', error);
      showNotification('Error al mostrar el modal de confirmación.', 'error');
    }
  }

  // Función para manejar confirmación del modal (decide entre guardar o generar)
  function handleModalConfirm() {
    console.log('[handleModalConfirm] Modo actual:', modalMode);
    
    if (modalMode === 'generate') {
      generateQuotationWithExistingClient();
    } else {
      saveQuotationWithExistingClient();
    }
  }

  // Función para cerrar modal de confirmación
  function closeSaveConfirmModal() {
    const modal = document.getElementById('cr-save-modal');
    if (modal) {
      // Remover focus del botón antes de cerrar
      const focusedElement = modal.querySelector(':focus');
      if (focusedElement) {
        focusedElement.blur();
      }
      
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      
      // Restaurar modo a save por defecto
      modalMode = 'save';
    }
  }

  // Función para guardar cotización con cliente existente
  async function saveQuotationWithExistingClient() {
    try {
      console.log('[saveQuotationWithExistingClient] Iniciando guardado con cliente existente...');
      
      // Obtener datos del cliente existente y validar
      const clientData = getExistingClientData();
      if (!clientData || !clientData.id_cliente) {
        showNotification('Error al obtener los datos del cliente seleccionado.', 'error');
        return;
      }
      
      // Recopilar datos de la cotización y validar
      const quotationData = collectQuotationData();
      console.log('[saveQuotationWithExistingClient] quotationData recibido:', quotationData);
      
      if (!quotationData) {
        showNotification('Error al recopilar los datos de la cotización.', 'error');
        return;
      }
      
      // Validar que tenga productos (el campo se llama 'productos' no 'products')
      if (!quotationData.productos || quotationData.productos.length === 0) {
        showNotification('No hay productos en la cotización.', 'warning');
        return;
      }
      
      // Enriquecer datos del cliente con la información más completa posible
      let enrichedClientData = {...clientData};
      try {
        const storedClient = localStorage.getItem('cr_selected_client');
        if (storedClient) {
          const fullClientData = JSON.parse(storedClient);
          enrichedClientData = {
            ...enrichedClientData,
            nombre_empresa: fullClientData.empresa || fullClientData.razon_social || '',
            rfc: fullClientData.rfc || '',
            regimen_fiscal: fullClientData.regimen_fiscal || '',
            direccion_fiscal: fullClientData.direccion_fiscal || fullClientData.direccion || '',
            contacto_principal: fullClientData.contacto || fullClientData.nombre || ''
          };
        }
      } catch (e) {
        console.warn('[saveQuotationWithExistingClient] Error al enriquecer datos:', e);
      }
      
      // Combinar datos enriquecidos
      const completeData = {
        ...quotationData,
        id_cliente: enrichedClientData.id_cliente,
        nombre_cliente: enrichedClientData.nombre || enrichedClientData.contacto_nombre || '',
        cliente_telefono: enrichedClientData.telefono || enrichedClientData.contacto_telefono || '',
        cliente_email: enrichedClientData.email || enrichedClientData.contacto_email || '',
        cliente_direccion: enrichedClientData.direccion || enrichedClientData.direccion_fiscal || '',
        cliente_tipo: enrichedClientData.tipo_cliente || 'Público en General',
        // Datos adicionales enriquecidos
        cliente_empresa: enrichedClientData.nombre_empresa || '',
        cliente_rfc: enrichedClientData.rfc || '',
        cliente_regimen: enrichedClientData.regimen_fiscal || '',
        cliente_contacto: enrichedClientData.contacto_principal || ''
      };
      
      console.log('[saveQuotationWithExistingClient] Datos completos:', completeData);
      
      // Cerrar modal de confirmación
      closeSaveConfirmModal();
      
      // Enviar al backend
      const result = await sendQuotationToBackend(completeData);
      
      if (result && result.success) {
        showNotification(`Cotización guardada exitosamente. Folio: ${result.numero_cotizacion}`, 'success');
        
        // Persistir cotización guardada
        try {
          sessionStorage.setItem('ultimaCotizacionGuardada', JSON.stringify({
            cotizacion: result,
            cliente: enrichedClientData
          }));
          
          // Limpiar localStorage si fue exitoso
          localStorage.removeItem('cr_draft_quotation');
        } catch (e) {
          console.warn('[saveQuotationWithExistingClient] Error al persistir resultado:', e);
        }
        
        // Opcional: limpiar carrito
        try {
          state.cart = [];
          // Intentar actualizar UI del carrito si la función está disponible
          if (typeof window.renderCart === 'function') {
            window.renderCart();
          } else {
            console.log('[saveQuotationWithExistingClient] Carrito limpiado (renderCart no disponible)');
            // Actualizar contador de carrito manualmente
            const countEl = document.getElementById('cr-cart-count');
            if (countEl) countEl.textContent = '0';
            const wrapEl = document.getElementById('cr-cart-count-wrap');
            if (wrapEl) wrapEl.classList.add('is-empty');
          }
        } catch (e) {
          console.warn('[saveQuotationWithExistingClient] Error al limpiar carrito:', e);
        }
        
      } else {
        throw new Error(result?.message || 'Error al guardar la cotización');
      }
      
    } catch (error) {
      console.error('[saveQuotationWithExistingClient] Error:', error);
      showNotification('Error al guardar la cotización.', 'error');
    }
  }

  // Función para obtener datos del cliente existente
  function getExistingClientData() {
    try {
      console.log('[getExistingClientData] Obteniendo datos del cliente existente...');
      
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
      
      // Si no hay datos en localStorage, obtener desde DOM
      if (!clientData) {
        const clientLabel = document.getElementById('v-client-label');
        const clientHidden = document.getElementById('v-extra');
        
        if (clientLabel && clientLabel.textContent.trim() && 
            clientLabel.textContent.trim() !== 'Seleccionar cliente' &&
            clientLabel.textContent.trim() !== '-') {
          clientData = {
            nombre: clientLabel.textContent.trim(),
            id_cliente: clientHidden ? clientHidden.value : null
          };
          console.log('[getExistingClientData] Cliente desde DOM:', clientData);
        }
      }
      
      if (!clientData || !clientData.id_cliente) {
        console.error('[getExistingClientData] No se encontraron datos del cliente o falta ID');
        return null;
      }
      
      // Obtener datos adicionales de los campos de contacto si están disponibles
      const contactoNombre = document.getElementById('cr-contact-name')?.value || clientData.nombre || '';
      const contactoEmail = document.getElementById('cr-contact-email')?.value || clientData.email || '';
      const contactoTelefono = document.getElementById('cr-contact-phone')?.value || clientData.telefono || clientData.celular || '';
      
      // Formatear datos para el backend
      const formattedData = {
        id_cliente: clientData.id_cliente || clientData.id,
        contacto_nombre: contactoNombre,
        contacto_email: contactoEmail,
        contacto_telefono: contactoTelefono,
        tipo_cliente: clientData.tipo_cliente || (clientData.empresa ? 'Empresa' : 'Público en General')
      };
      
      console.log('[getExistingClientData] Datos formateados:', formattedData);
      return formattedData;
      
    } catch (error) {
      console.error('[getExistingClientData] Error:', error);
      return null;
    }
  }

  // Función para cerrar modal de cliente nuevo
  function closeSaveClientModal() {
    const modal = document.getElementById('cr-save-client-modal');
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  // Vinculamos los manejadores de eventos para cerrar el modal
  function bindSaveClientModalEvents() {
    const modal = document.getElementById('cr-save-client-modal');
    if (!modal) return;

    // Cerrar con botones que tienen el atributo data-client-save-close
    const closeBtns = modal.querySelectorAll('[data-client-save-close]');
    closeBtns.forEach(btn => {
      if (!btn.__bound) {
        btn.addEventListener('click', closeSaveClientModal);
        btn.__bound = true;
      }
    });

    // Cerrar con Escape
    if (!modal.__escBound) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) {
          closeSaveClientModal();
        }
      });
      modal.__escBound = true;
    }

    // Vincular botón de guardar si existe
    const saveBtn = modal.querySelector('#cr-save-client-confirm');
    if (saveBtn && !saveBtn.__bound) {
      saveBtn.addEventListener('click', handleSaveClient);
      saveBtn.__bound = true;
    }
  }

  // Función para mostrar modal de cliente nuevo con autocompletado
  function showSaveClientModal() {
    console.log('[showSaveClientModal] Intentando mostrar modal de nuevo cliente');
    const modal = document.getElementById('cr-save-client-modal');
    if (!modal) {
      console.error('[showSaveClientModal] No se encontró el modal #cr-save-client-modal');
      return;
    }
    
    // Limpiar formulario primero
    const form = document.getElementById('cr-save-client-form');
    if (form) {
      form.reset();
      console.log('[showSaveClientModal] Formulario limpiado');
    }
    
    // Autocompletar con datos del formulario de contacto
    console.log('[showSaveClientModal] Autocompletando con datos del formulario de contacto...');
    
    // Datos básicos
    const contactName = document.getElementById('cr-contact-name')?.value || '';
    const contactPhone = document.getElementById('cr-contact-phone')?.value || '';
    const contactEmail = document.getElementById('cr-contact-email')?.value || '';
    const contactCompany = document.getElementById('cr-contact-company')?.value || '';
    const contactMobile = document.getElementById('cr-contact-mobile')?.value || '';
    const contactZip = document.getElementById('cr-contact-zip')?.value || '';
    const contactState = document.getElementById('cr-contact-state')?.value || '';
    const contactMunicipio = document.getElementById('cr-contact-municipio')?.value || '';
    const contactNotes = document.getElementById('cr-contact-notes')?.value || '';
    
    // Autocompletar campos del modal
    if (contactName) document.getElementById('cr-client-nombre').value = contactName;
    if (contactCompany) document.getElementById('cr-client-empresa').value = contactCompany;
    if (contactPhone) document.getElementById('cr-client-telefono').value = contactPhone;
    if (contactMobile) document.getElementById('cr-client-celular').value = contactMobile;
    if (contactEmail) document.getElementById('cr-client-email').value = contactEmail;
    if (contactZip) document.getElementById('cr-client-codigo-postal').value = contactZip;
    if (contactMunicipio) document.getElementById('cr-client-ciudad').value = contactMunicipio;
    if (contactNotes) document.getElementById('cr-client-notas').value = contactNotes;
    
    console.log('[showSaveClientModal] Campos autocompletados:', {
      nombre: contactName,
      empresa: contactCompany,
      telefono: contactPhone,
      email: contactEmail
    });
    
    // Vincular eventos si no se ha hecho
    bindSaveClientModalEvents();
    
    // Mostrar modal
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    console.log('[showSaveClientModal] Modal mostrado correctamente');

    // Intentar enfocar el primer campo vacío o el primero
    try {
      const firstEmptyInput = form.querySelector('input:not([type="hidden"]):not([value])') || 
                             form.querySelector('input:not([type="hidden"])');
      if (firstEmptyInput) {
        firstEmptyInput.focus();
      }
    } catch (e) {
      console.warn('[showSaveClientModal] No se pudo enfocar el primer campo:', e);
    }
  }

  // Función para guardar cliente nuevo y cotización
  async function handleSaveClient() {
    try {
      console.log('[handleSaveClient] Guardando cliente nuevo...');
      
      // Validar formulario
      const form = document.getElementById('cr-save-client-form');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      
      // Recopilar datos del formulario
      const formData = {
        nombre: document.getElementById('cr-client-nombre')?.value || '',
        empresa: document.getElementById('cr-client-empresa')?.value || '',
        telefono: document.getElementById('cr-client-telefono')?.value || '',
        celular: document.getElementById('cr-client-celular')?.value || '',
        email: document.getElementById('cr-client-email')?.value || '',
        rfc: document.getElementById('cr-client-rfc')?.value || '',
        razon_social: document.getElementById('cr-client-razon-social')?.value || '',
        rfc_facturacion: document.getElementById('cr-client-rfc-facturacion')?.value || '',
        curp: document.getElementById('cr-client-curp')?.value || '',
        regimen_fiscal: document.getElementById('cr-client-regimen-fiscal')?.value || '',
        direccion: document.getElementById('cr-client-domicilio')?.value || '',
        ciudad: document.getElementById('cr-client-ciudad')?.value || '',
        codigo_postal: document.getElementById('cr-client-codigo-postal')?.value || '',
        limite_credito: parseFloat(document.getElementById('cr-client-limite-credito')?.value) || 0,
        dias_credito: parseInt(document.getElementById('cr-client-dias-credito')?.value) || 30,
        metodo_pago: document.getElementById('cr-client-metodo-pago')?.value || 'Transferencia',
        tipo_cliente: document.getElementById('cr-client-segmento')?.value || 'Individual',
        notas_generales: document.getElementById('cr-client-notas')?.value || ''
      };
      
      // Deshabilitar botón
      const saveBtn = document.getElementById('cr-save-client-confirm');
      if (saveBtn) {
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        saveBtn.disabled = true;
      }
      
      // Guardar cliente
      const cliente = await saveCliente(formData);
      
      if (!cliente || !cliente.id_cliente) {
        throw new Error('No se pudo crear el cliente');
      }
      
      showNotification(`Cliente creado exitosamente: ${cliente.nombre}`, 'success');
      
      // Actualizar selector de cliente
      const clientLabel = document.getElementById('v-client-label');
      const clientHidden = document.getElementById('v-extra');
      if (clientLabel) clientLabel.textContent = cliente.nombre;
      if (clientHidden) clientHidden.value = cliente.id_cliente;
      
      // Guardar en localStorage
      localStorage.setItem('cr_selected_client', JSON.stringify(cliente));
      
      // Cerrar modal de cliente
      closeSaveClientModal();
      
      // Generar cotización aprobada (no borrador)
      try {
        showNotification('Generando cotización...', 'info');
        
        const quotationData = collectQuotationData();
        if (quotationData) {
          const completeData = {
            ...quotationData,
            id_cliente: cliente.id_cliente,
            estado: 'Aprobada', // ✅ Estado aprobada, no borrador
            contacto_nombre: cliente.nombre,
            contacto_email: cliente.email,
            contacto_telefono: cliente.telefono || cliente.celular,
            tipo_cliente: cliente.tipo_cliente || 'Individual'
          };
          
          const result = await sendQuotationToBackend(completeData);
          
          if (result && result.success) {
            // Mostrar modal de éxito
            showQuotationSuccessModal(result);
          } else {
            throw new Error(result?.message || 'Error al generar la cotización');
          }
        }
      } catch (quotationError) {
        console.error('[handleSaveClient] Error guardando cotización:', quotationError);
        showNotification('Cliente creado, pero no se pudo guardar la cotización como borrador', 'warning');
      }
      
      // Cerrar modal
      closeSaveClientModal();
      
      // Restaurar botón
      if (saveBtn) {
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cliente';
        saveBtn.disabled = false;
      }
      
    } catch (error) {
      console.error('[handleSaveClient] Error:', error);
      showNotification('Error al guardar el cliente: ' + error.message, 'error');
      
      // Restaurar botón
      const saveBtn = document.getElementById('cr-save-client-confirm');
      if (saveBtn) {
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cliente';
        saveBtn.disabled = false;
      }
    }
  }

  // Función para guardar cliente en el backend
  async function saveCliente(formData) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.API_CONFIG.getBaseUrl()}/api/clientes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error('Error en la respuesta del servidor');
      }
      
      const data = await response.json();
      return data.cliente || data;
      
    } catch (error) {
      console.error('[saveCliente] Error:', error);
      throw error;
    }
  }

  // ========== FUNCIONES PARA GENERAR COTIZACIÓN ==========
  
  // Variable global para controlar el modo del modal (guardar vs generar)
  let modalMode = 'save'; // 'save' o 'generate'
  
  // Función para mostrar modal de confirmación para generar cotización (cliente existente)
  function showGenerateQuotationModal() {
    try {
      console.log('[showGenerateQuotationModal] Mostrando modal de confirmación...');
      
      // Establecer modo en generar
      modalMode = 'generate';
      
      // Obtener datos del cliente desde localStorage
      const CLIENT_KEY = 'cr_selected_client';
      let empresa = 'No especificado';
      let representante = 'No especificado';
      
      try {
        const storedClient = localStorage.getItem(CLIENT_KEY);
        if (storedClient) {
          const clientData = JSON.parse(storedClient);
          empresa = clientData.empresa || clientData.razon_social || clientData.nombre || 'No especificado';
          representante = clientData.contacto || clientData.nombre || 'No especificado';
        }
      } catch (e) {
        console.warn('[showGenerateQuotationModal] Error obteniendo datos del cliente:', e);
      }
      
      // Mostrar modal y actualizar datos
      const modal = document.getElementById('cr-save-modal');
      if (!modal) {
        console.error('[showGenerateQuotationModal] No se encontró el modal #cr-save-modal');
        return;
      }
      
      const clientNameEl = document.getElementById('cr-confirm-client-name');
      const clientRepEl = document.getElementById('cr-confirm-client-rep');
      
      if (clientNameEl) clientNameEl.textContent = empresa;
      if (clientRepEl) clientRepEl.textContent = representante;
      
      // Cambiar texto del botón para generar cotización
      const confirmBtn = modal.querySelector('#cr-save-confirm');
      if (confirmBtn) {
        confirmBtn.innerHTML = '<i class="fa-solid fa-rocket"></i> Sí, Generar';
      }
      
      // Mostrar modal
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      console.log('[showGenerateQuotationModal] Modal mostrado correctamente');
      
    } catch (error) {
      console.error('[showGenerateQuotationModal] Error:', error);
    }
  }
  
  // Función para generar cotización con cliente existente
  async function generateQuotationWithExistingClient() {
    try {
      console.log('[generateQuotationWithExistingClient] Iniciando generación de cotización...');
      
      // Verificar si estamos en modo edición
      if (window.modoEdicion && window.cotizacionEditandoId) {
        console.log('[generateQuotationWithExistingClient] Modo edición detectado, actualizando cotización...');
        if (window.actualizarCotizacionVenta) {
          await window.actualizarCotizacionVenta();
        } else {
          showNotification('Error: Función de actualización no disponible', 'error');
        }
        return;
      }
      
      // NOTA: Ya no cerramos modal porque ahora se llama directamente desde completeShippingStep
      // Si se llamó desde el modal de confirmación, cerrar el modal
      const confirmModal = document.getElementById('cr-save-modal');
      if (confirmModal && !confirmModal.hidden) {
        closeSaveConfirmModal();
      }
      
      // Validar datos de envío
      const isValid = validateShippingAndGenerate();
      if (!isValid) {
        console.error('[generateQuotationWithExistingClient] Validación de envío falló');
        return;
      }
      
      // Obtener datos del cliente existente
      const clientData = getExistingClientData();
      if (!clientData || !clientData.id_cliente) {
        showNotification('Error al obtener los datos del cliente seleccionado.', 'error');
        return;
      }
      
      // Recopilar datos de la cotización
      const quotationData = collectQuotationData();
      if (!quotationData || !quotationData.productos || quotationData.productos.length === 0) {
        showNotification('No hay productos en la cotización.', 'warning');
        return;
      }
      
      // Combinar datos
      const completeData = {
        ...quotationData,
        id_cliente: clientData.id_cliente,
        estado: 'Aprobada', // Estado para cotización generada (no borrador)
        ...clientData
      };
      
      console.log('[generateQuotationWithExistingClient] Datos completos:', completeData);
      
      // Enviar al backend
      const result = await sendQuotationToBackend(completeData);
      
      if (result && result.success) {
        // Mostrar modal de éxito con información de la cotización
        showQuotationSuccessModal(result);
      } else {
        throw new Error(result?.message || 'Error al generar la cotización');
      }
      
    } catch (error) {
      console.error('[generateQuotationWithExistingClient] Error:', error);
      showNotification('Error al generar la cotización.', 'error');
    }
  }
  
  // Función para mostrar modal de éxito después de generar cotización
  function showQuotationSuccessModal(result) {
    try {
      console.log('[showQuotationSuccessModal] Mostrando modal de éxito:', result);
      
      // Crear modal dinámicamente
      const modalHTML = `
        <div id="cr-success-quotation-modal" class="cr-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 999999; background: rgba(2,6,23,.42); backdrop-filter: blur(2px); overflow-y: auto;">
          <div class="cr-modal__dialog" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(580px, 92vw); max-height: 90vh; overflow-y: auto; background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            
            <!-- Header -->
            <div class="cr-modal__header" style="display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #e2e8f0;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center;">
                  <i class="fa-solid fa-check" style="color: white; font-size: 18px;"></i>
                </div>
                <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #1e293b;">Cotización Generada Exitosamente</h3>
              </div>
              <button onclick="closeSuccessQuotationModal()" style="background: none; border: none; cursor: pointer; padding: 4px; color: #64748b; font-size: 20px;">
                <i class="fa-solid fa-times"></i>
              </button>
            </div>
            
            <!-- Body -->
            <div class="cr-modal__body" style="padding: 24px;">
              
              <!-- Info Card -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                  <div>
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Número de Cotización:</div>
                    <div style="font-size: 20px; font-weight: 700; color: #1e40af;">${result.numero_cotizacion || 'N/A'}</div>
                  </div>
                  <div>
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Estado:</div>
                    <div style="display: inline-flex; align-items: center; gap: 6px; background: #10b981; color: white; padding: 4px 12px; border-radius: 6px; font-size: 14px; font-weight: 600;">
                      <i class="fa-solid fa-check-circle"></i> Aprobada
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Cliente:</div>
                    <div style="font-size: 15px; font-weight: 600; color: #1e293b;">${result.cliente_nombre || result.contacto_nombre || 'N/A'}</div>
                  </div>
                  <div>
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">Total:</div>
                    <div style="font-size: 18px; font-weight: 700; color: #059669;">$${parseFloat(result.total || 0).toLocaleString('es-MX', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  </div>
                </div>
              </div>
              
              <!-- Important Info -->
              <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <div style="display: flex; align-items: start; gap: 12px;">
                  <i class="fa-solid fa-circle-info" style="color: #f59e0b; font-size: 20px; margin-top: 2px;"></i>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; color: #92400e; margin-bottom: 8px;">Información Importante</div>
                    <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; line-height: 1.6;">
                      <li>La cotización ha sido guardada con estado <strong>Aprobada</strong></li>
                      <li>Se ha registrado en el historial del cliente</li>
                      <li>Puede proceder a generar el contrato correspondiente</li>
                    </ul>
                  </div>
                </div>
              </div>
              
            </div>
            
            <!-- Footer -->
            <div class="cr-modal__footer" style="display: flex; align-items: center; justify-content: center; gap: 12px; padding: 20px 24px; border-top: 1px solid #e2e8f0; background: #f8fafc;">
              <button onclick="closeSuccessQuotationModal()" class="cr-btn cr-btn--ghost" style="min-width: 120px; padding: 10px 20px; border: 1px solid #cbd5e1; background: white; color: #475569; border-radius: 8px; font-weight: 500; cursor: pointer;">
                Cerrar
              </button>
              <button onclick="acceptQuotation('${result.id_cotizacion}', '${result.numero_cotizacion}')" class="cr-btn cr-btn--primary" style="min-width: 120px; padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <i class="fa-solid fa-file-contract"></i> Aceptar
              </button>
            </div>
            
          </div>
        </div>
      `;
      
      // Insertar modal en el DOM
      const existingModal = document.getElementById('cr-success-quotation-modal');
      if (existingModal) {
        existingModal.remove();
      }
      
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      // Limpiar carrito
      try {
        state.cart = [];
        if (typeof window.renderCart === 'function') {
          window.renderCart();
        } else {
          const countEl = document.getElementById('cr-cart-count');
          if (countEl) countEl.textContent = '0';
          const wrapEl = document.getElementById('cr-cart-count-wrap');
          if (wrapEl) wrapEl.classList.add('is-empty');
        }
      } catch (e) {
        console.warn('[showQuotationSuccessModal] Error al limpiar carrito:', e);
      }
      
    } catch (error) {
      console.error('[showQuotationSuccessModal] Error:', error);
    }
  }
  
  // Función para cerrar modal de éxito
  function closeSuccessQuotationModal() {
    const modal = document.getElementById('cr-success-quotation-modal');
    if (modal) {
      modal.remove();
    }
  }
  
  // Función para aceptar cotización (placeholder - puedes implementar lógica adicional)
  function acceptQuotation(idCotizacion, numeroCotizacion) {
    console.log('[acceptQuotation] Cotización aceptada:', {idCotizacion, numeroCotizacion});
    closeSuccessQuotationModal();
    showNotification(`Cotización ${numeroCotizacion} aceptada correctamente`, 'success');
    // Aquí puedes agregar lógica adicional, como redirigir a la vista de cotizaciones
    // window.location.href = `/cotizaciones/${idCotizacion}`;
  }

  // Función para enviar cotización al backend
  async function sendQuotationToBackend(data) {
    try {
      console.log('[sendQuotationToBackend] Enviando datos:', data);
      console.log('[sendQuotationToBackend] Tipo de cotización:', data.tipo_cotizacion);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${window.API_CONFIG.getBaseUrl()}/api/cotizaciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[sendQuotationToBackend] Error del servidor:', errorText);
        throw new Error('Error en la respuesta del servidor');
      }
      
      const result = await response.json();
      console.log('[sendQuotationToBackend] Respuesta del servidor:', result);
      
      return {
        success: true,
        numero_cotizacion: result.numero_cotizacion || result.folio || 'VEN-000',
        ...result
      };
      
    } catch (error) {
      console.error('[sendQuotationToBackend] Error:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Función para mostrar notificaciones
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;
    
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    notification.innerHTML = `<i class="fa-solid fa-${icon}"></i><span>${message}</span>`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  // Event listeners para modales de guardado
  document.addEventListener('DOMContentLoaded', function() {
    // Botón de guardar en el menú lateral
    // NOTA: La lógica de guardar está manejada en el HTML (switch statement)
    // No se necesita listener aquí para evitar conflictos
    // const saveMenuBtn = document.querySelector('[data-action="guardar"]');
    // if (saveMenuBtn) {
    //   saveMenuBtn.addEventListener('click', (e) => {
    //     e.preventDefault();
    //     saveQuotationFromMenu();
    //   });
    // }
    
    // Cerrar modal de confirmación
    document.querySelectorAll('[data-save-close]').forEach(btn => {
      btn.addEventListener('click', closeSaveConfirmModal);
    });
    
    // Cerrar modal de cliente nuevo
    document.querySelectorAll('[data-client-save-close]').forEach(btn => {
      btn.addEventListener('click', closeSaveClientModal);
    });
    
    // Guardar cliente nuevo
    const saveClientBtn = document.getElementById('cr-save-client-confirm');
    if (saveClientBtn) {
      saveClientBtn.addEventListener('click', handleSaveClient);
    }
    
    // Botón de confirmación del modal (guardar o generar según modo)
    // IMPORTANTE: Solo un event listener para evitar duplicados
    const confirmBtn = document.getElementById('cr-save-confirm');
    if (confirmBtn && !confirmBtn.__modalBound) {
      confirmBtn.addEventListener('click', handleModalConfirm);
      confirmBtn.__modalBound = true;
      console.log('[Init] Event listener agregado a #cr-save-confirm');
    }
  });

  // Exponer funciones globalmente
  window.showClientDetails = showClientDetails;
  window.confirmClientSelection = confirmClientSelection;
  window.closeClientDetailsModal = closeClientDetailsModal;
  window.closeClientModal = closeClientModal;
  window.loadClientContactData = loadClientContactData;
  window.saveQuotationFromMenu = saveQuotationFromMenu;
  window.collectQuotationData = collectQuotationData;
  window.sendQuotationToBackend = sendQuotationToBackend;
  window.handleModalConfirm = handleModalConfirm;
  window.generateQuotationWithExistingClient = generateQuotationWithExistingClient;
  window.showGenerateQuotationModal = showGenerateQuotationModal;
  window.showSaveClientModal = showSaveClientModal;
  window.validateShippingAndGenerate = validateShippingAndGenerate;
  window.completeShippingStep = completeShippingStep;
  window.closeSuccessQuotationModal = closeSuccessQuotationModal;
  window.acceptQuotation = acceptQuotation;
})();

/**
 * Inicializar funcionalidad de clonación para cotizaciones de venta
 */
const initCloneFunctionalityVenta = () => {
  console.log('[CLONE-VENTA] Inicializando funcionalidad de clonación');

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
   * @param {Object} externalData - Datos de cotización pasados externamente (opcional)
   */
  window.fillCloneModalWithCurrentQuotation = async (externalData = null) => {
    try {
      console.log('[CLONE-VENTA] Llenando modal con cotización actual');
      console.log('[CLONE-VENTA] Datos externos recibidos:', externalData);

      let quotationData = {};

      // Si se pasan datos externos (desde la lista), usarlos directamente
      if (externalData && externalData.id_cotizacion) {
        console.log('[CLONE-VENTA] Usando datos externos de la lista');
        quotationData = {
          id_cotizacion: externalData.id_cotizacion,
          numero_folio: externalData.numero_folio || externalData.numero_cotizacion || 'VEN-XXXX-XXXXXX',
          total: externalData.total || 0,
          fecha_creacion: externalData.fecha_creacion || externalData.fecha_cotizacion || new Date().toISOString().split('T')[0],
          id_vendedor: externalData.id_vendedor,
          vendedor_nombre: externalData.vendedor_nombre,
          id_cliente: externalData.id_cliente,
          cliente_nombre: externalData.cliente_nombre || externalData.nombre_cliente
        };
      } else {
        // Obtener datos básicos de la interfaz (modo edición)
        console.log('[CLONE-VENTA] Obteniendo datos de la interfaz de edición');
        quotationData = {
          id_cotizacion: window.cotizacionEditandoId,
          numero_folio: document.getElementById('v-quote-number')?.value || 'VEN-XXXX-XXXXXX',
          total: 0,
          fecha_creacion: document.getElementById('v-quote-date')?.value || new Date().toISOString().split('T')[0]
        };

        // Calcular total desde el DOM
        const totalElement = document.getElementById('cr-grand-total') || document.getElementById('cr-total');
        if (totalElement) {
          const totalText = totalElement.textContent.replace(/[^0-9.-]+/g, '');
          quotationData.total = parseFloat(totalText) || 0;
        }

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
              quotationData.total = fullData.total || quotationData.total;
              quotationData.id_cliente = fullData.id_cliente;
              quotationData.cliente_nombre = fullData.cliente_nombre || fullData.nombre_cliente;
            }
          } catch (error) {
            console.error('[CLONE-VENTA] Error cargando datos completos:', error);
          }
        }
      }

      console.log('[CLONE-VENTA] Datos de cotización procesados:', quotationData);
      cloneState.originalQuotation = quotationData;

      // Llenar información básica
      const folioEl = document.querySelector('[data-chip-folio]');
      if (folioEl) {
        folioEl.textContent = quotationData.numero_folio || 'VEN-XXXX-XXXXXX';
      }
      
      const totalEl = document.querySelector('[data-chip-total]');
      if (totalEl) {
        totalEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
          .format(quotationData.total || 0);
      }
      
      const fechaEl = document.querySelector('[data-chip-fecha-original]');
      if (fechaEl) {
        const fecha = quotationData.fecha_creacion || new Date();
        fechaEl.textContent = new Date(fecha).toLocaleDateString('es-MX');
      }

      // Cliente actual - priorizar datos de quotationData
      let clientName = 'No especificado';
      if (quotationData.cliente_nombre) {
        clientName = quotationData.cliente_nombre;
      } else {
        const clientLabel = document.getElementById('v-client-label');
        clientName = clientLabel?.textContent || 'No especificado';
      }
      
      const currentClientEl = document.getElementById('cr-clone-current-client');
      if (currentClientEl) {
        currentClientEl.textContent = clientName;
      }
      console.log('[CLONE-VENTA] Cliente actual:', clientName);

      // Vendedor actual - priorizar datos de quotationData
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const vendorName = quotationData.vendedor_nombre || currentUser.nombre || 'No asignado';
      const currentVendorEl = document.getElementById('cr-clone-current-vendor');
      if (currentVendorEl) {
        currentVendorEl.textContent = vendorName;
      }
      console.log('[CLONE-VENTA] Vendedor actual:', vendorName);

      // Establecer fecha actual por defecto
      if (newDateInput) {
        newDateInput.value = new Date().toISOString().split('T')[0];
      }

      // Cargar vendedores
      await loadVendorsVenta();

      // Abrir modal
      cloneModal.hidden = false;
      cloneModal.setAttribute('aria-hidden', 'false');

      console.log('[CLONE-VENTA] Modal llenado exitosamente');
    } catch (error) {
      console.error('[CLONE-VENTA] Error llenando modal:', error);
      showNotificationVenta('Error al preparar la clonación', 'error');
    }
  };

  /**
   * Cargar lista de vendedores
   */
  const loadVendorsVenta = async () => {
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

      console.log('[CLONE-VENTA] Vendedores cargados:', vendedores.length);
    } catch (error) {
      console.error('[CLONE-VENTA] Error cargando vendedores:', error);
    }
  };

  /**
   * Manejar selección de nuevo cliente
   */
  if (selectClientBtn) {
    selectClientBtn.addEventListener('click', () => {
      console.log('[CLONE-VENTA] Abriendo selector de clientes');
      
      // Ocultar temporalmente el modal de clonación
      const cloneModal = document.getElementById('cr-clone-modal');
      if (cloneModal) {
        cloneModal.style.display = 'none';
        console.log('[CLONE-VENTA] Modal de clonación ocultado temporalmente');
      }
      
      // Abrir modal de selección de clientes
      const clientModal = document.getElementById('v-client-modal');
      if (clientModal) {
        // Forzar z-index mayor para que aparezca sobre el modal de clonación
        clientModal.style.zIndex = '10000000';
        clientModal.style.position = 'fixed';
        clientModal.style.inset = '0';
        clientModal.style.display = 'flex';
        
        clientModal.hidden = false;
        clientModal.setAttribute('aria-hidden', 'false');
        
        // Marcar que estamos en modo clonación
        clientModal.setAttribute('data-clone-mode', 'true');
        
        // Escuchar selección de cliente
        const handleClientSelection = (event) => {
          console.log('[CLONE-VENTA] Mensaje recibido:', event.data);
          
          if (event.data && event.data.type === 'CLIENT_SELECTED_FOR_CLONE') {
            const clientData = event.data.clientData;
            console.log('[CLONE-VENTA] Cliente detectado para clonación:', clientData);
            
            // Guardar nuevo cliente
            cloneState.newClient = {
              id_cliente: clientData.id_cliente || clientData.id,
              nombre: clientData.nombre || clientData.razon_social,
              razon_social: clientData.razon_social || clientData.empresa,
              email: clientData.email,
              telefono: clientData.telefono
            };
            cloneState.keepOriginalClient = false;
            
            // Mostrar cliente seleccionado
            const selectedClientDiv = document.getElementById('cr-clone-selected-client');
            const clientNameSpan = document.getElementById('cr-clone-new-client-name');
            
            if (selectedClientDiv && clientNameSpan) {
              const displayName = clientData.razon_social || clientData.empresa || clientData.nombre || 'Cliente seleccionado';
              clientNameSpan.textContent = displayName;
              selectedClientDiv.style.display = 'block';
              console.log('[CLONE-VENTA] Cliente mostrado:', displayName);
            }
            
            // Cerrar modal de clientes
            clientModal.hidden = true;
            clientModal.setAttribute('aria-hidden', 'true');
            clientModal.removeAttribute('data-clone-mode');
            
            // Restaurar estilos originales del modal de cliente
            clientModal.style.zIndex = '';
            clientModal.style.position = '';
            clientModal.style.inset = '';
            clientModal.style.display = '';
            
            // Restaurar modal de clonación
            const cloneModal = document.getElementById('cr-clone-modal');
            if (cloneModal) {
              cloneModal.style.display = '';
              console.log('[CLONE-VENTA] Modal de clonación restaurado');
            }
            
            // Remover listener
            window.removeEventListener('message', handleClientSelection);
            
            console.log('[CLONE-VENTA] Nuevo cliente guardado en cloneState:', cloneState.newClient);
          }
        };
        
        // Agregar listener
        window.addEventListener('message', handleClientSelection);
        
        // Listener para cerrar modal sin seleccionar (botones X o backdrop)
        const closeClientModal = () => {
          clientModal.hidden = true;
          clientModal.setAttribute('aria-hidden', 'true');
          clientModal.removeAttribute('data-clone-mode');
          
          // Restaurar estilos originales del modal de cliente
          clientModal.style.zIndex = '';
          clientModal.style.position = '';
          clientModal.style.inset = '';
          clientModal.style.display = '';
          
          // Restaurar modal de clonación
          const cloneModal = document.getElementById('cr-clone-modal');
          if (cloneModal) {
            cloneModal.style.display = '';
            console.log('[CLONE-VENTA] Modal de clonación restaurado');
          }
          
          console.log('[CLONE-VENTA] Modal de cliente cerrado sin selección');
        };
        
        // Agregar listeners a botones de cerrar
        const closeButtons = clientModal.querySelectorAll('[data-client-close]');
        closeButtons.forEach(btn => {
          btn.addEventListener('click', closeClientModal, { once: true });
        });
        
        // Listener para ESC
        const handleEscape = (e) => {
          if (e.key === 'Escape' && !clientModal.hidden) {
            closeClientModal();
            document.removeEventListener('keydown', handleEscape);
          }
        };
        document.addEventListener('keydown', handleEscape);
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
      
      console.log('[CLONE-VENTA] Manteniendo cliente original');
      showNotificationVenta('Se mantendrá el cliente original', 'success');
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
      console.log('[CLONE-VENTA] Preparando confirmación');

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
        showNotificationVenta('Por favor ingrese el motivo de clonación', 'error');
        document.getElementById('cr-clone-reason')?.focus();
        return;
      }

      // Llenar modal de confirmación
      fillConfirmationModalVenta();

      // Cerrar modal de configuración y abrir confirmación
      cloneModal.hidden = true;
      confirmModal.hidden = false;
      confirmModal.setAttribute('aria-hidden', 'false');
    });
  }

  /**
   * Llenar modal de confirmación
   */
  const fillConfirmationModalVenta = () => {
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
        const div = document.createElement('div');
        // Obtener cantidad de productos del carrito de venta
        const cartCount = window.state?.cart?.length || 0;
        div.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> Copiar productos seleccionados (${cartCount} productos)`;
        optionsList.appendChild(div);
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
        console.log('[CLONE-VENTA] Iniciando proceso de clonación');
        
        // Deshabilitar botón
        confirmProceedBtn.disabled = true;
        confirmProceedBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clonando...';

        // Preparar datos para el backend
        const clientId = cloneState.newClient?.id_cliente || cloneState.newClient?.id;
        const vendorId = cloneState.newVendor;
        
        const cloneData = {
          nueva_fecha: cloneState.newDate,
          nuevo_cliente_id: clientId ? parseInt(clientId, 10) : null,
          nuevo_vendedor_id: vendorId ? parseInt(vendorId, 10) : null,
          motivo_clonacion: cloneState.reason,
          resetear_estado: cloneState.options.resetState,
          copiar_productos: cloneState.options.copyProducts,
          copiar_envio: cloneState.options.copyShipping
        };

        console.log('[CLONE-VENTA] Datos de clonación:', cloneData);
        console.log('[CLONE-VENTA] ID cotización origen:', cloneState.originalQuotation?.id_cotizacion || window.cotizacionEditandoId);

        // Llamar al backend
        const token = localStorage.getItem('token');
        const cotizacionId = cloneState.originalQuotation?.id_cotizacion || window.cotizacionEditandoId;
        
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
          console.error('[CLONE-VENTA] Error del backend:', errorData);
          throw new Error(errorData.error || errorData.message || 'Error al clonar cotización');
        }

        const result = await response.json();
        console.log('[CLONE-VENTA] Cotización clonada exitosamente:', result);

        // Extraer datos del clon (el backend devuelve {message, original_id, clon})
        const clonedQuotation = result.clon || result;
        const nuevoFolio = clonedQuotation.numero_folio || clonedQuotation.numero_cotizacion;
        const nuevoId = clonedQuotation.id_cotizacion;

        console.log('[CLONE-VENTA] Nuevo folio:', nuevoFolio);
        console.log('[CLONE-VENTA] Nuevo ID:', nuevoId);

        // Cerrar modales
        confirmModal.hidden = true;
        cloneModal.hidden = true;

        // Mostrar éxito
        showNotificationVenta(`Cotización clonada exitosamente: ${nuevoFolio}`, 'success');

        // Abrir automáticamente la nueva cotización clonada
        setTimeout(() => {
          const cloneUrl = `cotizacion_venta.html?edit=${nuevoId}`;
          // Intentar reutilizar la misma ventana cuando sea un clon dentro de la misma página
          window.open(cloneUrl, '_blank');

          // Si esta ventana fue abierta como modal independiente desde otra página, podemos cerrarla
          if (window.opener && !window.opener.closed) {
            window.close();
          }
        }, 1000);

      } catch (error) {
        console.error('[CLONE-VENTA] Error en clonación:', error);
        showNotificationVenta(error.message || 'Error al clonar cotización', 'error');
        
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

  /**
   * Función auxiliar para mostrar notificaciones
   */
  const showNotificationVenta = (message, type = 'success') => {
    // Reutilizar función existente si está disponible
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }

    // Fallback: crear notificación simple
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

  console.log('[CLONE-VENTA] Funcionalidad de clonación inicializada');
};

// Inicializar al cargar
try {
  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCloneFunctionalityVenta);
  } else {
    initCloneFunctionalityVenta();
  }
} catch (error) {
  console.error('[CLONE-VENTA] Error inicializando clonación:', error);
}
