/**
 * COTIZACIÓN VENTA - Sistema de cotización de productos para venta
 * 
 * Estructura:
 * - Configuración y constantes
 * - Autenticación
 * - Estado global
 * - Funciones de utilidad
 * - Funciones de API
 * - Funciones de negocio
 * - Funciones de UI
 * - Inicialización
 */

(() => {
  'use strict';

  // ============================================
  // CONFIGURACIÓN Y CONSTANTES
  // ============================================
  const CONFIG = {
    API_BASE: '/api',
    QUOTE_PREFIX: 'VEN',
    QUOTE_FORMAT_REGEX: /^VEN-\d{4}-\d{4}$/,
    CURRENCY_OPTIONS: { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 },
    DATE_FORMAT_OPTIONS: { dateStyle: 'short', timeStyle: 'short' },
    IVA_RATE: 0.16,
    DEFAULT_QUANTITY: 1,
    MIN_QUANTITY: 1,
    SKELETON_COUNT: 6,
    DEBOUNCE_DELAY: 300
  };

  const API_ENDPOINTS = {
    productos: `${CONFIG.API_BASE}/productos`,
    cotizacionesSiguiente: `${CONFIG.API_BASE}/cotizaciones/siguiente-numero?tipo=VENTA`,
    usuarios: `${CONFIG.API_BASE}/usuarios`,
    verificarPassword: `${CONFIG.API_BASE}/auth/verify-password`
  };

  const CATEGORY_SLUGS = {
    MARCO_CRUCETA: 'marco_cruceta',
    MULTIDIRECCIONAL: 'multidireccional',
    TEMPLETES: 'templetes',
    ACCESORIOS: 'accesorios'
  };

  const DOM_SELECTORS = {
    products: '#cr-products',
    accessories: '#cr-accessories',
    search: '#cr-search-input',
    filters: '#cr-filters',
    notesFab: '#cr-notes-fab',
    notesFloater: '#cr-notes-floater',
    notesList: '#cr-notes-list',
    quoteNumber: '#v-quote-number',
    cartCount: '#cr-cart-count',
    summaryCard: '#cr-quote-summary-card',
    financialCard: '#cr-financial-summary'
  };

  // ============================================
  // ESTADO GLOBAL
  // ============================================
  const state = {
    view: 'grid',
    products: [],
    filtered: [],
    accessories: [],
    warehouses: [],
    selectedWarehouse: null,
    selected: null,
    cart: [],
    accSelected: new Set(),
    accQty: {},
    notes: [],
    itemDiscounts: {},
    discountExclusions: new Set()
  };

  const domElements = {};

  // ============================================
  // AUTENTICACIÓN
  // ============================================
  function getAuthToken() {
    try {
      return localStorage.getItem('token');
    } catch {
      return null;
    }
  }

  function getAuthHeaders() {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // ============================================
  // UTILIDADES GENERALES
  // ============================================
  function formatCurrency(amount) {
    try {
      return new Intl.NumberFormat('es-MX', CONFIG.CURRENCY_OPTIONS)
        .format(Number(amount) || 0);
    } catch {
      return `$${(Number(amount) || 0).toFixed(2)}`;
    }
  }

  function formatDate(date) {
    try {
      return new Intl.DateTimeFormat('es-MX', CONFIG.DATE_FORMAT_OPTIONS)
        .format(new Date(date));
    } catch {
      return new Date(date).toLocaleString('es-MX');
    }
  }

  function debounce(fn, delay = CONFIG.DEBOUNCE_DELAY) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(null, args), delay);
    };
  }

  function normalizeString(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function safeParseJSON(jsonString, fallback = null) {
    try {
      return JSON.parse(jsonString);
    } catch {
      return fallback;
    }
  }

  function getSelectValue(selector) {
    const element = document.querySelector(selector);
    return element?.value || '';
  }

  function setElementText(selector, text) {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = String(text || '');
    }
  }

  function setElementHTML(selector, html) {
    const element = document.querySelector(selector);
    if (element) {
      element.innerHTML = html;
    }
  }

  // ============================================
  // NORMALIZACIÓN DE CLAVES (ACCESORIOS)
  // ============================================
  function normalizeAccessoryKey(accessory) {
    const base = String(
      accessory?.sku || accessory?.id || accessory?.name || ''
    ).toLowerCase();

    if (!base) return '';

    return base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function normalizeAccessoryValue(value) {
    if (value === undefined || value === null) return '';

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? normalizeAccessoryKey({ name: trimmed }) : '';
    }

    if (typeof value === 'object') {
      return normalizeAccessoryKey(value);
    }

    return normalizeAccessoryKey({ name: String(value) });
  }

  function createAccessoryDiscountKey(accessoryId) {
    return `acc:${String(accessoryId ?? '')}`;
  }

  function createProductDiscountKey(productId) {
    return `prod:${String(productId ?? '')}`;
  }

  // ============================================
  // NORMALIZACIÓN DE CATEGORÍAS
  // ============================================
  function normalizeCategoryName(name) {
    const normalized = normalizeString(name);

    const categoryMap = {
      [CATEGORY_SLUGS.MARCO_CRUCETA]: ['marco', 'cruceta', 'andamio'],
      [CATEGORY_SLUGS.MULTIDIRECCIONAL]: ['multidireccional', 'multi'],
      [CATEGORY_SLUGS.TEMPLETES]: ['templet', 'templete'],
      [CATEGORY_SLUGS.ACCESORIOS]: ['accesor']
    };

    for (const [slug, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(keyword => normalized.includes(keyword))) {
        return slug;
      }
    }

    return null;
  }

  // ============================================
  // FUNCIONES DE CACHÉ DOM
  // ============================================
  function cacheAllDOMElements() {
    const selectorMap = {
      productsWrap: '#cr-products',
      foundCount: '#cr-found-count',
      search: '#cr-search-input',
      gridBtn: '#cr-grid-btn',
      listBtn: '#cr-list-btn',
      accessories: '#cr-accessories',
      accessorySearch: '#cr-accessory-search',
      accessorySubcat: '#cr-acc-subcat',
      accessorySort: '#cr-acc-sort',
      notesFab: '#cr-notes-fab',
      notesFloater: '#cr-notes-floater',
      notesList: '#cr-notes-list',
      notesCount: '#cr-notes-count',
      quoteNumber: '#v-quote-number',
      cartCount: '#cr-cart-count',
      cartCountWrap: '#cr-cart-count-wrap'
    };

    for (const [key, selector] of Object.entries(selectorMap)) {
      domElements[key] = document.querySelector(selector);
    }

    window.__ventaEls = domElements;
  }

  // ============================================
  // CARGA DE DATOS DESDE API
  // ============================================
  async function loadProductsFromAPI() {
    try {
      const response = await fetch(API_ENDPOINTS.productos, {
        headers: getAuthHeaders()
      });

      if (!response.ok) return [];

      const data = await response.json();
      if (!Array.isArray(data)) return [];

      return data.map(item => mapProductFromAPI(item))
        .filter(p => p.categorySlug);
    } catch (error) {
      console.error('Error cargando productos:', error);
      return [];
    }
  }

  function mapProductFromAPI(item) {
    const id = String(item.id || item.id_producto || item.clave || '');
    const name = String(item.nombre || item.nombre_del_producto || 'Producto');
    const categorySlug = normalizeCategoryName(item.categoria || '');

    if (!categorySlug || categorySlug === CATEGORY_SLUGS.ACCESORIOS) {
      return null;
    }

    return {
      id,
      sku: String(item.clave || item.codigo_de_barras || id),
      name,
      desc: String(item.descripcion || ''),
      brand: String(item.marca || ''),
      image: item.imagen || item.imagen_portada || 'img/default.jpg',
      category: item.categoria || '',
      categorySlug,
      stock: Number(item.stock_venta || item.stock_total || item.stock || 0),
      quality: item.condicion || item.estado || 'Bueno',
      price: { diario: this.extractPrice(item) },
      id_almacen: item.id_almacen,
      nombre_almacen: item.nombre_almacen,
      ubicacion: item.ubicacion || '',
      peso_kg: this.extractWeight(item)
    };
  }

  function extractPrice(item) {
    const pVenta = Number(item.precio_venta || 0);
    const pRenta = Number(item.tarifa_renta || 0);
    return pVenta > 0 ? pVenta : pRenta;
  }

  function extractWeight(item) {
    return Number(
      item.peso_kg || item.peso || item.peso_unitario || 
      item.peso_por_unidad || item.peso_producto || 
      item.weight || item.weight_kg || 0
    ) || 0;
  }

  async function loadAccessoriesFromAPI() {
    try {
      const response = await fetch(API_ENDPOINTS.productos, {
        headers: getAuthHeaders()
      });

      if (!response.ok) return [];

      const data = await response.json();
      if (!Array.isArray(data)) return [];

      return data
        .filter(item => isAccessory(item))
        .map(item => mapAccessoryFromAPI(item));
    } catch (error) {
      console.error('Error cargando accesorios:', error);
      return [];
    }
  }

  function isAccessory(item) {
    const category = (item.categoria || item.nombre_subcategoria || '').toLowerCase();
    const type = (item.tipo_de_producto || '').toLowerCase();
    return category.includes('accesor') || type.includes('accesor');
  }

  function mapAccessoryFromAPI(item) {
    const id = normalizeAccessoryValue(item) || String(
      item.id || item.id_producto || item.clave || item.codigo || item.nombre || ''
    );

    return {
      id,
      name: String(item.nombre || item.nombre_del_producto || id),
      image: item.imagen || item.imagen_portada || 'img/default.jpg',
      stock: Number(item.stock_total || item.stock || 0),
      subcat: (item.nombre_subcategoria || 'otros').toLowerCase(),
      price: Number(item.precio_venta || item.tarifa_renta || item.precio || 0),
      sku: String(item.clave || item.codigo_de_barras || id),
      brand: item.marca || '',
      desc: item.descripcion || '',
      quality: item.condicion || item.estado || '',
      peso_kg: this.extractWeight(item)
    };
  }

  // ============================================
  // FUNCIONES DE RENDERIZADO
  // ============================================
  function renderProductsGrid(products) {
    const container = domElements.productsWrap;
    if (!container) return;

    container.innerHTML = '';

    products.forEach(product => {
      const card = createProductCard(product);
      container.appendChild(card);
    });

    updateProductCount(products.length);
  }

  function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'cr-card cr-product-card';
    card.setAttribute('data-id', product.id);
    card.setAttribute('data-sku', product.sku);

    card.innerHTML = `
      <div class="cr-product__media">
        <img src="${product.image}" alt="${product.name}" 
             onerror="this.src='img/default.jpg'" />
        <span class="cr-stock">${product.stock} disponibles</span>
      </div>
      <h3 class="cr-product__name">${product.name}</h3>
      <p class="cr-product__desc">${product.desc}</p>
      <div class="cr-product__price">
        ${formatCurrency(product.price?.diario || 0)}
      </div>
      <button class="cr-btn cr-btn--primary" type="button" 
              data-add-to-cart="${product.id}">
        <i class="fa-solid fa-cart-plus"></i> Agregar
      </button>
    `;

    card.addEventListener('click', (e) => {
      if (!e.target.closest('[data-add-to-cart]')) {
        selectProduct(product.id);
      }
    });

    return card;
  }

  function updateProductCount(count) {
    setElementText('#cr-found-count', count);
  }

  function renderAccessoriesGrid(accessories) {
    const container = domElements.accessories;
    if (!container) return;

    container.innerHTML = '';

    accessories.forEach(accessory => {
      const card = createAccessoryCard(accessory);
      container.appendChild(card);
    });
  }

  function createAccessoryCard(accessory) {
    const card = document.createElement('div');
    card.className = 'cr-card cr-acc-item';
    const normalizedKey = normalizeAccessoryValue(accessory);
    card.setAttribute('data-key', normalizedKey);
    card.setAttribute('data-name', accessory.name);
    card.setAttribute('data-sku', accessory.sku);
    card.setAttribute('data-subcat', accessory.subcat);
    card.setAttribute('data-stock', accessory.stock);
    card.setAttribute('data-price', accessory.price);

    card.innerHTML = `
      <div class="cr-product__media">
        <img src="${accessory.image}" alt="${accessory.name}" 
             onerror="this.src='img/default.jpg'" />
        <span class="cr-stock">${accessory.stock} disponibles</span>
      </div>
      <h3 class="cr-product__name">${accessory.name}</h3>
      <p class="cr-product__desc">${accessory.desc}</p>
      <div class="cr-product__meta">
        <div><strong>SKU:</strong> ${accessory.sku}</div>
        <div><strong>Subcat:</strong> ${accessory.subcat}</div>
      </div>
      <div class="cr-product__price">
        ${formatCurrency(accessory.price)}
      </div>
      <button class="cr-btn cr-btn--primary cr-acc-btn" 
              type="button" data-acc-id="${normalizedKey}">
        <i class="fa-solid fa-cart-plus"></i> Agregar
      </button>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.cr-acc-btn')) return;
      toggleAccessorySelection(normalizedKey);
    });

    return card;
  }

  function showSkeletonLoading(container, count = CONFIG.SKELETON_COUNT) {
    if (!container) return;

    container.innerHTML = '';
    container.className = 'skeleton-container';

    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton-card';
      skeleton.innerHTML = `
        <div class="skeleton-image"></div>
        <div class="skeleton-content">
          <div class="skeleton-line title"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line" style="width: 60%;"></div>
        </div>
      `;
      container.appendChild(skeleton);
    }
  }

  // ============================================
  // GESTIÓN DE CARRITO Y ACCESORIOS
  // ============================================
  function addProductToCart(productId, quantity = CONFIG.DEFAULT_QUANTITY) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = state.cart.find(item => item.id === productId);
    if (existingItem) {
      showWarning(`"${product.name}" ya está en tu cotización`);
      return;
    }

    showQuantityDialog(product).then(qty => {
      if (qty && qty > 0) {
        state.cart.push({ id: productId, qty });
        state.discountExclusions.delete(createProductDiscountKey(productId));
        updateCartUI();
      }
    });
  }

  function showQuantityDialog(product) {
    return Swal.fire({
      title: 'CANTIDAD',
      html: `Ingresa la cantidad para:<br><strong>${product.name}</strong>`,
      input: 'number',
      inputValue: CONFIG.DEFAULT_QUANTITY,
      inputAttributes: { min: CONFIG.MIN_QUANTITY, step: '1' },
      showCancelButton: true,
      confirmButtonText: 'Agregar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      inputValidator: (value) => {
        if (!value || parseInt(value, 10) < CONFIG.MIN_QUANTITY) {
          return `Debe ser mayor a ${CONFIG.MIN_QUANTITY - 1}`;
        }
      }
    }).then(result => result.isConfirmed ? parseInt(result.value, 10) : null);
  }

  function updateCartUI() {
    try {
      const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
      setElementText('#cr-cart-count', count);
      
      const wrap = document.querySelector('#cr-cart-count-wrap');
      if (wrap) {
        wrap.classList.toggle('is-empty', count === 0);
      }

      renderCart();
      updateAllTotals();
    } catch (error) {
      console.error('Error actualizando carrito:', error);
    }
  }

  function renderCart() {
    // Implementar según necesidad
  }

  function toggleAccessorySelection(accessoryId) {
    if (!accessoryId) return;

    if (state.accSelected.has(accessoryId)) {
      state.accSelected.delete(accessoryId);
      delete state.accQty[accessoryId];
    } else {
      state.accSelected.add(accessoryId);
      state.accQty[accessoryId] = CONFIG.DEFAULT_QUANTITY;
    }

    state.discountExclusions.delete(createAccessoryDiscountKey(accessoryId));
    updateAccessoryStyles();
    updateAllTotals();
  }

  function updateAccessoryStyles() {
    const container = domElements.accessories;
    if (!container) return;

    container.querySelectorAll('.cr-acc-item').forEach(card => {
      const key = card.getAttribute('data-key');
      const isSelected = key && state.accSelected.has(key);
      card.classList.toggle('is-selected', isSelected);
      
      const btn = card.querySelector('.cr-acc-btn');
      if (btn) {
        btn.classList.toggle('is-selected', isSelected);
        btn.innerHTML = isSelected 
          ? '<i class="fa-solid fa-check"></i> Agregado'
          : '<i class="fa-solid fa-cart-plus"></i> Agregar';
      }
    });
  }

  // ============================================
  // FUNCIONES DE FILTRADO Y BÚSQUEDA
  // ============================================
  function filterProducts() {
    const query = domElements.search?.value?.toLowerCase() || '';
    const category = getSelectValue('input[name="cr-category"]:checked');

    state.filtered = state.products.filter(product => {
      const matchesText = matchesQuery(product, query);
      const matchesCategory = matchesProductCategory(product, category);
      const matchesWarehouse = matchesSelectedWarehouse(product);

      return matchesText && matchesCategory && matchesWarehouse;
    });

    renderProductsGrid(state.filtered);
  }

  function matchesQuery(product, query) {
    if (!query) return true;

    const fields = [
      product.name,
      product.id,
      product.sku,
      product.brand,
      product.desc
    ].map(f => String(f).toLowerCase());

    return fields.some(field => field.includes(query));
  }

  function matchesProductCategory(product, category) {
    return !category || category === 'all' || product.categorySlug === category;
  }

  function matchesSelectedWarehouse(product) {
    if (!state.selectedWarehouse?.id_almacen) return true;
    return product.id_almacen === state.selectedWarehouse.id_almacen ||
           product.almacen_id === state.selectedWarehouse.id_almacen;
  }

  function filterAccessories() {
    const query = domElements.accessorySearch?.value?.toLowerCase() || '';
    const subcat = domElements.accessorySubcat?.value?.toLowerCase() || '';
    const sort = domElements.accessorySort?.value || 'name';

    let filtered = Array.from(domElements.accessories?.querySelectorAll('.cr-acc-item') || [])
      .filter(card => {
        const matchesText = matchesAccessoryQuery(card, query);
        const matchesSubcat = !subcat || card.getAttribute('data-subcat') === subcat;
        return matchesText && matchesSubcat;
      });

    filtered.sort((a, b) => sortAccessories(a, b, sort));

    renderFilteredAccessories(filtered);
  }

  function matchesAccessoryQuery(card, query) {
    const fields = [
      card.getAttribute('data-name'),
      card.getAttribute('data-sku'),
      card.querySelector('.cr-product__desc')?.textContent
    ].map(f => String(f).toLowerCase());

    return !query || fields.some(field => field.includes(query));
  }

  function sortAccessories(cardA, cardB, sortBy) {
    if (sortBy === 'stock') {
      return parseInt(cardB.getAttribute('data-stock'), 10) - 
             parseInt(cardA.getAttribute('data-stock'), 10);
    }

    const nameA = cardA.getAttribute('data-name').toLowerCase();
    const nameB = cardB.getAttribute('data-name').toLowerCase();
    return nameA.localeCompare(nameB);
  }

  function renderFilteredAccessories(filteredCards) {
    const container = domElements.accessories;
    if (!container) return;

    container.innerHTML = '';
    filteredCards.forEach(card => container.appendChild(card));
  }

  // ============================================
  // GESTIÓN DE NOTAS
  // ============================================
  function renderNotes() {
    const container = domElements.notesList;
    if (!container) return;

    container.innerHTML = '';

    state.notes.slice().reverse().forEach(note => {
      const row = document.createElement('div');
      row.className = 'cr-card';
      row.innerHTML = `
        <div style="padding:10px 12px;">
          <small style="color:#64748b;">${formatDate(note.ts)}</small>
          <div style="white-space:pre-wrap; margin-top:8px;">${note.text}</div>
          <button class="cr-btn cr-btn--ghost cr-btn--sm" title="Eliminar">
            <i class="fa-solid fa-trash"></i> Eliminar
          </button>
        </div>
      `;

      const deleteBtn = row.querySelector('button');
      deleteBtn?.addEventListener('click', () => {
        state.notes = state.notes.filter(n => n.id !== note.id);
        persistNotes();
        renderNotes();
        updateNotesCounter();
      });

      container.appendChild(row);
    });
  }

  function updateNotesCounter() {
    const count = state.notes.length;
    setElementText('#cr-notes-count', count);
    const badge = document.querySelector('#cr-notes-count');
    if (badge) badge.hidden = count === 0;
  }

  function persistNotes() {
    try {
      sessionStorage.setItem('ventaNotes', JSON.stringify(state.notes));
    } catch {
      console.warn('No se pudieron guardar notas');
    }
  }

  // ============================================
  // NÚMERO DE COTIZACIÓN
  // ============================================
  function generateQuoteNumber() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `${CONFIG.QUOTE_PREFIX}-${year}-${String(random).padStart(4, '0')}`;
  }

  async function getNextQuoteNumberFromServer() {
    try {
      const response = await fetch(API_ENDPOINTS.cotizacionesSiguiente, {
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        return data.numero_cotizacion || data.numero_folio || data.siguiente_numero;
      }
    } catch (error) {
      console.warn('Error obteniendo número de cotización del servidor:', error);
    }

    return generateQuoteNumber();
  }

  function validateQuoteNumberFormat(quoteNumber) {
    if (!quoteNumber || !quoteNumber.trim()) return false;
    return CONFIG.QUOTE_FORMAT_REGEX.test(quoteNumber.trim());
  }

  async function initializeQuoteNumber() {
    const input = domElements.quoteNumber;
    if (!input) return;

    const isInEditMode = isEditMode();
    const currentValue = input.value.trim();
    const isValidFormat = validateQuoteNumberFormat(currentValue);

    if (currentValue && isValidFormat) {
      return; // Mantener el número actual si es válido
    }

    if (isInEditMode) {
      return; // En modo edición, esperar a que se carguen los datos
    }

    const quoteNumber = await getNextQuoteNumberFromServer();
    input.value = quoteNumber;
  }

  function isEditMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return !!urlParams.get('edit') || !!window.modoEdicion;
  }

  // ============================================
  // FUNCIONES DE TOTALES
  // ============================================
  function updateAllTotals() {
    try {
      renderCart();
      updateCartUI();
      updateFinancialSummary();
    } catch (error) {
      console.error('Error actualizando totales:', error);
    }
  }

  function updateFinancialSummary() {
    // Implementar según necesidad
  }

  // ============================================
  // EVENTOS Y DELEGACIÓN
  // ============================================
  function setupEventListeners() {
    // Búsqueda de productos
    const searchInput = domElements.search;
    if (searchInput) {
      searchInput.addEventListener('input', debounce(filterProducts));
    }

    // Filtros de productos
    document.addEventListener('change', (e) => {
      if (e.target.name === 'cr-category') {
        filterProducts();
      }
    });

    // Búsqueda y filtros de accesorios
    if (domElements.accessorySearch) {
      domElements.accessorySearch.addEventListener('input', debounce(filterAccessories));
    }

    if (domElements.accessorySubcat) {
      domElements.accessorySubcat.addEventListener('change', filterAccessories);
    }

    if (domElements.accessorySort) {
      domElements.accessorySort.addEventListener('change', filterAccessories);
    }

    // Agregar al carrito con delegación
    document.addEventListener('click', (e) => {
      const addBtn = e.target.closest('[data-add-to-cart]');
      if (addBtn) {
        const productId = addBtn.getAttribute('data-add-to-cart');
        addProductToCart(productId);
      }
    });

    // Notas
    if (domElements.notesFab) {
      domElements.notesFab.addEventListener('click', () => {
        domElements.notesFloater?.classList.toggle('hidden');
      });
    }
  }

  // ============================================
  // NOTIFICACIONES
  // ============================================
  function showWarning(message) {
    Swal.fire({
      icon: 'warning',
      title: 'Atención',
      text: message,
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'Entendido'
    });
  }

  function showSuccess(message) {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
    });

    Toast.fire({
      icon: 'success',
      title: message
    });
  }

  // ============================================
  // INICIALIZACIÓN
  // ============================================
  async function init() {
    try {
      console.log('[VENTA] Inicializando cotización de venta...');

      cacheAllDOMElements();
      setupEventListeners();

      // Cargar datos
      showSkeletonLoading(domElements.productsWrap);
      state.products = await loadProductsFromAPI();
      state.accessories = await loadAccessoriesFromAPI();

      // Renderizar
      if (state.products.length > 0) {
        state.filtered = state.products;
        renderProductsGrid(state.filtered);
      }

      if (state.accessories.length > 0) {
        renderAccessoriesGrid(state.accessories);
      }

      // Inicializar número de cotización
      await initializeQuoteNumber();

      console.log('[VENTA] ✅ Inicialización completada');
    } catch (error) {
      console.error('[VENTA] ❌ Error en inicialización:', error);
    }
  }

  // ============================================
  // EXPOSICIÓN GLOBAL
  // ============================================
  window.cotizacionVenta = {
    filterProducts,
    addProductToCart,
    toggleAccessorySelection,
    initializeQuoteNumber,
    updateAllTotals,
    state
  };

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
