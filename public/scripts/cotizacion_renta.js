/* Cotización Renta - lógica de flujo y UI
   Reutiliza patrones de transiciones/responsivo similares a servicios */

(() => {
  const state = {
    view: 'grid',
    products: [],
    filtered: [],
    selected: null,
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
    stockAvail: document.getElementById('cr-stock-available'),
    total: document.getElementById('cr-total'),
    totalDetail: document.getElementById('cr-total-detail'),

    // config main
    qtyInput: document.getElementById('cr-qty-input'),
    qtyBtns: document.querySelectorAll('.cr-qty__btn'),
    periodType: document.getElementById('cr-period-type'),
    dateStart: document.getElementById('cr-date-start'),
    dateEnd: document.getElementById('cr-date-end'),
    durationText: document.getElementById('cr-duration-text'),
    needDelivery: document.getElementById('cr-need-delivery'),
    deliveryAddress: document.getElementById('cr-delivery-address'),
    deliveryNotes: document.getElementById('cr-delivery-notes'),
    deliveryExtra: document.getElementById('cr-delivery-extra'),

    addToQuote: document.getElementById('cr-add-to-quote'),
    backToProducts: document.getElementById('cr-back-to-products'),

    // steps
    stepProducts: document.getElementById('cr-step-products'),
    stepConfig: document.getElementById('cr-step-config'),
  };

  // --- Datos mock de productos ---
  const mock = [
    {
      id: 'AND-EST-001',
      name: 'Andamio Estructural Modular 2m x 2m',
      brand: 'ProScaffold',
      category: 'andamios',
      desc: 'Andamio estructural modular de alta resistencia para construcción. Incluye... ',
      image: 'img/default.jpg',
      stock: 35,
      price: { diario: 15000, semanal: 90000, mensual: 300000 },
      meta: { altura: '2m', carga: '200kg/m²', material: 'Acero galvanizado', peso: '25kg' },
      quality: 'Bueno',
    },
    {
      id: 'TAL-ELE-001',
      name: 'Taladro Percutor Profesional 800W',
      brand: 'PowerDrill Pro',
      category: 'herramientas',
      desc: 'Taladro percutor ideal para perforación en concreto, ladrillo y... ',
      image: 'img/default.jpg',
      stock: 18,
      price: { diario: 8000, semanal: 45000, mensual: 150000 },
      meta: { potencia: '800W', rpm: '0-3000', mandril: '13mm', peso: '2.5kg' },
      quality: 'Nuevo',
    },
    {
      id: 'GRU-MOV-001',
      name: 'Grúa Torre Móvil 2 Toneladas',
      brand: 'CraneTech',
      category: 'maquinaria',
      desc: 'Grúa torre móvil autoregirible para construcción...',
      image: 'img/default.jpg',
      stock: 2,
      price: { diario: 180000, semanal: 1100000, mensual: 3800000 },
      meta: { capacidad: '2 ton', altura: '25m', base: 'Móvil sobre orugas' },
      quality: 'Bueno',
    },
  ];

  function currency(n) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
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
          <button class="cr-btn cr-btn--primary" data-id="${p.id}"><i class="fa-solid fa-plus"></i> Agregar a Renta</button>
        </div>
      `;
      els.productsWrap.appendChild(card);
    });

    els.foundCount.textContent = String(list.length);
    els.resultsText.textContent = `Mostrando ${list.length} producto${list.length !== 1 ? 's' : ''}`;

    // Bind add buttons
    els.productsWrap.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', () => selectProduct(btn.getAttribute('data-id')));
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
    els.stockAvail.textContent = p.stock;

    // reset controls
    els.qtyInput.value = 1;
    els.periodType.value = 'diario';
    els.dateStart.valueAsDate = new Date();
    recalcEndDate();
    recalcTotal();

    // go to config step with animation
    gotoStep('config');
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
    if (!state.selected) return;
    const p = state.selected.price;
    const qty = Number(els.qtyInput.value || 1);
    let unit = p.diario;
    if (els.periodType.value === 'semanal') unit = p.semanal;
    if (els.periodType.value === 'mensual') unit = p.mensual;

    const total = unit * qty;
    els.total.textContent = currency(total);
    els.totalDetail.textContent = `Por ${qty} unidad(es) - tarifa ${els.periodType.value}`;

    // entrega simple mock
    const delivery = els.needDelivery.checked ? Math.round(unit * 0.3) : 0;
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

    els.qtyBtns.forEach(b => b.addEventListener('click', () => {
      const action = b.getAttribute('data-action');
      let v = Number(els.qtyInput.value || 1);
      v = action === 'inc' ? v + 1 : Math.max(1, v - 1);
      els.qtyInput.value = v;
      recalcTotal();
    }));
    els.qtyInput.addEventListener('input', recalcTotal);

    els.periodType.addEventListener('change', () => { recalcEndDate(); recalcTotal(); });
    els.dateStart.addEventListener('change', () => { recalcEndDate(); recalcTotal(); });
    els.needDelivery.addEventListener('change', recalcTotal);

    els.backToProducts.addEventListener('click', () => gotoStep('products'));

    els.addToQuote.addEventListener('click', () => {
      // por ahora solo redirige a cotizaciones.html con tipo preseleccionado de renta
      window.location.href = 'cotizaciones.html?tipo=RENTA';
    });
  }

  function init() {
    // cargar datos
    state.products = mock;
    state.filtered = mock;
    renderProducts(mock);
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

  document.addEventListener('DOMContentLoaded', init);
})();
