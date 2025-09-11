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
    periodType: 'diario',
    dateStart: null,
    dateEnd: null,
    deliveryNeeded: true,
    deliveryExtra: 0,
  };

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
    priceWeek: document.getElementById('cr-price-week'),
    priceMonth: document.getElementById('cr-price-month'),
    total: document.getElementById('cr-total'),
    totalDetail: document.getElementById('cr-total-detail'),

    // config main
    periodType: document.getElementById('cr-period-type'),
    dateStart: document.getElementById('cr-date-start'),
    dateEnd: document.getElementById('cr-date-end'),
    durationText: document.getElementById('cr-duration-text'),
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
  };

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
      // threshold = 6 items to highlight
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

    // bind qty controls
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

    // Compute subtotal based on current period
    if (els.cartSubtotalValue) {
      const period = els.periodType?.value || 'diario';
      let subtotal = 0;
      state.cart.forEach(ci => {
        const p = state.products.find(x => x.id === ci.id);
        if (!p) return;
        let unit = p.price.diario;
        if (period === 'semanal') unit = p.price.semanal;
        if (period === 'mensual') unit = p.price.mensual;
        subtotal += unit * ci.qty;
      });
      els.cartSubtotalValue.textContent = currency(subtotal);
      // update label text to reflect period
      if (els.cartSubtotalWrap) {
        const labelNode = els.cartSubtotalWrap.querySelector('span');
        if (labelNode) labelNode.textContent = `Subtotal (${period}):`;
      }
    }

    // keep step 3 totals/summary/side in sync in case user navigates back and forth
    try { recalcTotal(); renderSummary(); renderSideList(); updateSummaryScrollHint(); } catch {}
  }

  function renderProducts(list) {
    els.productsWrap.innerHTML = '';
    list.forEach(p => {
      const card = document.createElement('article');
      card.className = 'cr-product';
      card.innerHTML = `
        <div class="cr-product__media">
          <img src="${p.image}" alt="${p.name}">
          <span class="cr-badge">${p.quality}</span>
          <span class="cr-stock">${p.stock} disponibles</span>
        </div>
        <div class="cr-product__body">
          <div class="cr-name">${p.name}</div>
          <div class="cr-desc">${p.desc}</div>
          <div class="cr-meta">
            <span>SKU: ${p.id}</span>
            <span>${p.brand}</span>
          </div>
          <div class="cr-pricebar">
            <span class="cr-from">Desde</span>
            <span class="cr-price">${currency(p.price.diario)}</span>
            <span class="cr-from">/día</span>
          </div>
        </div>
        <div class="cr-product__actions">
          <button class="cr-btn cr-btn--primary" data-id="${p.id}"><i class="fa-solid fa-plus"></i> Agregar</button>
        </div>
      `;
      els.productsWrap.appendChild(card);
    });

    els.foundCount.textContent = String(list.length);
    els.resultsText.textContent = `Mostrando ${list.length} producto${list.length !== 1 ? 's' : ''}`;

    // Bind add-to-cart buttons
    els.productsWrap.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', () => addToCart(btn.getAttribute('data-id')));
    });

    // apply list/grid class without removing other classes/attributes
    els.productsWrap.classList.remove('cr-grid', 'cr-list');
    els.productsWrap.classList.add(state.view === 'grid' ? 'cr-grid' : 'cr-list');
  }

  function filterProducts() {
    const q = (els.search.value || '').toLowerCase();
    const filters = [...document.querySelectorAll('#cr-filters input:checked')].map(i => i.value);
    state.filtered = state.products.filter(p => (
      (!q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)) &&
      (!filters.length || filters.includes(p.category))
    ));
    renderProducts(state.filtered);
  }

  function selectProduct(id) {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    state.selected = p;
    state.qty = 1;
    state.periodType = 'diario';

    // Fill side info
    els.selImage.src = p.image;
    els.selName.textContent = p.name;
    els.selDesc.textContent = p.desc;
    els.selSku.textContent = p.id;
    els.selBrand.textContent = p.brand;
    els.selStock.textContent = `${p.stock} disponibles`;
    els.priceDaily.textContent = currency(p.price.diario);
    els.priceWeek.textContent = currency(p.price.semanal);
    els.priceMonth.textContent = currency(p.price.mensual);

    // reset period
    els.periodType.value = 'diario';
    els.dateStart.valueAsDate = new Date();
    recalcEndDate();
    recalcTotal();

    // go to config step with animation
    gotoStep('config');
  }

  function renderSummary() {
    if (!els.summaryList) return;
    els.summaryList.innerHTML = '';
    state.cart.forEach(ci => {
      const p = state.products.find(x => x.id === ci.id);
      if (!p) return;
      const currentPeriod = els.periodType?.value || 'diario';
      const unit = (currentPeriod === 'semanal') ? p.price.semanal : (currentPeriod === 'mensual') ? p.price.mensual : p.price.diario;
      const line = document.createElement('div');
      line.style.display = 'grid';
      line.style.gridTemplateColumns = '1fr auto';
      line.style.alignItems = 'center';
      line.style.cursor = 'pointer';
      line.setAttribute('data-id', p.id);
      line.innerHTML = `
        <div>
          <div style="font-weight:600; font-size:14px;">${p.name}</div>
          <div style="color:#64748b; font-size:12px;">${ci.qty} x ${currency(unit)} / ${currentPeriod}</div>
        </div>
        <div style="font-weight:700; color:#2563eb;">${currency(unit * ci.qty)}</div>
      `;
      els.summaryList.appendChild(line);
    });
    els.summaryList.querySelectorAll('[data-id]').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-id');
        const p = state.products.find(x => x.id === id);
        if (!p) return;
        state.selected = p;
        els.selImage.src = p.image;
        els.selName.textContent = p.name;
        els.selDesc.textContent = p.desc;
        els.selSku.textContent = p.id;
        els.selBrand.textContent = p.brand;
        els.selStock.textContent = `${p.stock} disponibles`;
        els.priceDaily.textContent = currency(p.price.diario);
        els.priceWeek.textContent = currency(p.price.semanal);
        els.priceMonth.textContent = currency(p.price.mensual);
      });
    });
    updateSummaryScrollHint();
  }

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
    // bind once
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

  function renderSideList() {
    if (!els.sideList) return;
    els.sideList.innerHTML = '';
    const period = els.periodType?.value || 'diario';
    state.cart.forEach(ci => {
      const p = state.products.find(x => x.id === ci.id);
      if (!p) return;
      let unit = p.price.diario;
      if (period === 'semanal') unit = p.price.semanal;
      if (period === 'mensual') unit = p.price.mensual;
      const card = document.createElement('div');
      card.className = 'cr-side-item';
      card.innerHTML = `
        <div class="cr-side-item__media">
          <img src="${p.image}" alt="${p.name}">
        </div>
        <div class="cr-side-item__body">
          <div class="cr-side-item__title">${p.name}</div>
          <div class="cr-side-item__desc">${p.desc || ''}</div>
          <div class="cr-side-item__meta"><span>SKU: ${p.id}</span><span>Marca: ${p.brand}</span><span>Stock: ${p.stock} disp.</span></div>
          <div class="cr-side-item__prices">
            <div>Diario: <strong>${currency(p.price.diario)}</strong></div>
            <div>Semanal: <strong>${currency(p.price.semanal)}</strong></div>
            <div>Mensual: <strong>${currency(p.price.mensual)}</strong></div>
          </div>
          <div class="cr-side-item__line">
            ${ci.qty} x ${currency(unit)} / ${period}
            <span class="cr-side-item__line-total">${currency(unit * ci.qty)}</span>
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

  function gotoStep(step) {
    if (step === 'config') {
      els.secProducts.hidden = true;
      els.secConfig.hidden = false;
      requestAnimationFrame(() => {
        els.secConfig.classList.add('cr-section--active');
      });
      els.stepProducts.classList.remove('cr-step--active');
      els.stepProducts.classList.add('cr-step--done');
      els.stepConfig.classList.add('cr-step--active');
    } else if (step === 'shipping') {
      els.secProducts.hidden = true;
      els.secConfig.hidden = true;
      const secShipping = document.getElementById('cr-shipping-section');
      secShipping.hidden = false;
      requestAnimationFrame(() => {
        secShipping.classList.add('cr-section--active');
      });
      els.stepConfig.classList.remove('cr-step--active');
      els.stepConfig.classList.add('cr-step--done');
      els.stepShipping.classList.add('cr-step--active');
    } else {
      els.secConfig.classList.remove('cr-section--active');
      els.secConfig.hidden = true;
      els.secProducts.hidden = false;
      requestAnimationFrame(() => {
        els.secProducts.classList.add('cr-section--active');
      });
      els.stepConfig.classList.remove('cr-step--active');
      els.stepProducts.classList.add('cr-step--active');
    }
  }

  function recalcEndDate() {
    const start = els.dateStart.valueAsDate || new Date();
    let days = 1;
    if (els.periodType.value === 'semanal') days = 7;
    if (els.periodType.value === 'mensual') days = 30;
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + days);
    els.dateEnd.valueAsDate = end;
    els.durationText.textContent = `Duración total: ${days} día${days>1?'s':''}. Desde ${start.toLocaleDateString()} hasta ${end.toLocaleDateString()}`;
  }

  function recalcTotal() {
    let total = 0;
    const period = els.periodType.value;
    state.cart.forEach(ci => {
      const p = state.products.find(x => x.id === ci.id);
      if (!p) return;
      let unit = p.price.diario;
      if (period === 'semanal') unit = p.price.semanal;
      if (period === 'mensual') unit = p.price.mensual;
      total += unit * ci.qty;
    });
    els.total.textContent = currency(total);
    const totalUnits = state.cart.reduce((a,b)=>a+b.qty,0);
    els.totalDetail.textContent = totalUnits > 0 ? `Total por ${totalUnits} unidad(es) - tarifa ${period}` : 'Sin productos seleccionados';

    const delivery = els.needDelivery.checked ? Math.round(total * 0.3) : 0;
    state.deliveryExtra = delivery;
    els.deliveryExtra.textContent = `Costo adicional de entrega: ${currency(delivery)}`;
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

    els.periodType.addEventListener('change', () => { recalcEndDate(); recalcTotal(); renderSummary(); renderSideList(); renderCart(); });
    els.dateStart.addEventListener('change', () => { recalcEndDate(); recalcTotal(); });
    els.needDelivery.addEventListener('change', recalcTotal);

    els.backToProducts.addEventListener('click', () => gotoStep('products'));

    // go to config with cart
    function handleGoConfig() {
      if (state.cart.length === 0) {
        alert('Agrega al menos un producto al carrito.');
        return;
      }
      // feedback visual
      try { els.goConfig?.classList.add('is-loading'); } catch {}
      const first = state.products.find(x => x.id === state.cart[0].id);
      if (first) {
        state.selected = first;
        els.selImage.src = first.image;
        els.selName.textContent = first.name;
        els.selDesc.textContent = first.desc;
        els.selSku.textContent = first.id;
        els.selBrand.textContent = first.brand;
        els.selStock.textContent = `${first.stock} disponibles`;
        els.priceDaily.textContent = currency(first.price.diario);
        els.priceWeek.textContent = currency(first.price.semanal);
        els.priceMonth.textContent = currency(first.price.mensual);
      }
      renderSummary();
      renderSideList();
      recalcEndDate();
      recalcTotal();
      gotoStep('config');
      // desplazar a la tarjeta "Período de Renta"
      setTimeout(() => {
        try {
          document.getElementById('cr-config-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const title = document.getElementById('cr-period-title');
          if (title) {
            title.classList.add('cr-highlight');
            setTimeout(()=> title.classList.remove('cr-highlight'), 1200);
          }
        } catch {}
        try { els.goConfig?.classList.remove('is-loading'); } catch {}
      }, 50);
    }
    if (els.goConfig) {
      els.goConfig.addEventListener('click', (e) => { e.preventDefault(); handleGoConfig(); });
    }
    // Delegated fallback in case dynamic content affects the button
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t) return;
      const isBtn = (t.id === 'cr-go-config') || t.closest?.('#cr-go-config');
      if (isBtn) {
        e.preventDefault();
        handleGoConfig();
      }
    });

    // clear cart
    if (els.clearCart) {
      els.clearCart.addEventListener('click', () => {
        if (state.cart.length === 0) return;
        if (!confirm('¿Vaciar todos los productos seleccionados?')) return;
        state.cart = [];
        renderCart();
        renderSummary();
        recalcTotal();
      });
    }

    // step header clicks
    els.stepProducts.addEventListener('click', () => gotoStep('products'));
    els.stepConfig.addEventListener('click', () => gotoStep('config'));
    if (els.stepShipping) {
      els.stepShipping.addEventListener('click', () => gotoStep('shipping'));
    }

    els.addToQuote.addEventListener('click', () => {
      // por ahora solo redirige a cotizaciones.html con tipo preseleccionado de renta
      window.location.href = 'cotizaciones.html?tipo=RENTA';
    });
  }

  async function init() {
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
    const address = document.getElementById('cr-search-address').value;
    if (!address) return alert('Por favor, ingresa una dirección.');

    // Aquí puedes implementar la lógica para buscar la ubicación y calcular la distancia
    // Ejemplo: Usar la API de Google Maps para geocodificación y cálculo de distancia
    console.log(`Buscando ubicación para: ${address}`);
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
