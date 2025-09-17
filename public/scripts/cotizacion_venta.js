const API_PRODUCTOS_URL = 'http://localhost:3001/api/productos';
const API_ALMACENES_URL = 'http://localhost:3001/api/productos/almacenes'; // Updated to use productos endpoint
const API_CATEGORIAS_URL = 'http://localhost:3001/api/productos/categorias'; // Updated to use productos endpoint
const API_ACCESORIOS_URL = 'http://localhost:3001/api/productos/disponibles'; // Updated to use productos endpoint and filter by category

(function(){
  const steps = Array.from(document.querySelectorAll('.step-content'));
  const dots = Array.from(document.querySelectorAll('.step-indicator .step'));

  const continueToConfigBtn = document.getElementById('continue-to-configuration');
  const continueToShippingBtn = document.getElementById('continue-to-shipping');
  const prevBtnConfig = document.getElementById('prevBtnConfig');
  const prevBtnShipping = document.getElementById('prevBtnShipping');
  const continueToAccessoriesBtn = document.getElementById('continue-to-accessories');
  const continueToAccessoryQuantityBtn = document.getElementById('continue-to-accessory-quantity');
  const continueToClientInfoBtn = document.getElementById('continue-to-client-info');
  const continueToLogisticsBtn = document.getElementById('continue-to-logistics');
  const continueToSummaryBtn = document.getElementById('continue-to-summary');
  const btnGuardarCotizacion = document.getElementById('btnGuardarCotizacion');
  const btnGenerarPdf = document.getElementById('btnGenerarPdf');
  const btnEnviarCorreo = document.getElementById('btnEnviarCorreo');
  const btnEnviarWhatsapp = document.getElementById('btnEnviarWhatsapp');
  const btnFinishQuote = document.getElementById('btnFinishQuote');
  const btnGenerateSurveyLink = document.getElementById('btnGenerateSurveyLink');

  // New Logistics elements
  const logisticsKilometersInput = document.getElementById('logistics-kilometers');
  const logisticsZoneTypeSelect = document.getElementById('logistics-zone-type');
  const openGoogleMapsBtn = document.getElementById('open-google-maps-btn');
  const calculateShippingCostBtn = document.getElementById('calculate-shipping-cost-btn');
  const logisticsCalculatedCostSpan = document.getElementById('logistics-calculated-cost');

  // Notes related elements
  const notesSidebar = document.getElementById('notesSidebar');
  const openNotesBtn = document.getElementById('openNotesBtn');
  const closeNotesBtn = document.getElementById('closeNotesBtn');
  const saveNoteBtn = document.getElementById('saveNoteBtn');
  const noteContentInput = document.getElementById('noteContent'); // Corrected ID to match HTML
  const notesListDiv = document.getElementById('notesList');
  const notesCountSpan = document.getElementById('notesCount');
  const currentStepNotesSpan = document.getElementById('currentStepNotes');
  const currentStepNameNotesSpan = document.getElementById('currentStepNameNotes');

  const modal = {
    prod: document.getElementById('modalProducto'),
    acc: document.getElementById('modalAccesorio'),
    fac: document.getElementById('modalFacturacion'),
  };
  let current = 0;
  const pDots = document.getElementById('progressDots');

  const productsPerPage = 3; // Number of products to display per page in Step 2
  let currentProductPage = 0; // Current page index (0-based)
  let totalProductPages = 0;  // Total number of pages

  let allProducts = [];
  let allWarehouses = [];
  let allCategories = [];
  let allSubcategories = []; // Global to store all subcategories
  let idCategoriaAccesorios = ''; // Global variable to store the ID of the "Accesorios" category
  let allAccessories = []; // Initialize allAccessories as an empty array

  let filtroBusquedaProducto = '';
  let filtroCategoria = '';
  let filtroSubcategoria = '';
  let filtroCondicion = '';
  let filtroAlmacen = '';
  let filtroBusquedaAlmacen = '';
  let filtroBusquedaAccesorio = '';
  let filtroSubcategoriaAccesorio = '';

  const seleccion = { 
    productos: [], 
    accesorios: [], 
    cliente: {}, 
    logistica: { 
      kilometers: 0, 
      zoneType: 'metropolitana', 
      costoEnvio: 0 
    }
  };

  let notes = JSON.parse(localStorage.getItem('cotizacionVentaNotes') || '[]');

  console.log('Script cargado correctamente! (antes de llamadas iniciales)');

  function saveNotes() {
    localStorage.setItem('cotizacionVentaNotes', JSON.stringify(notes));
    renderNotes();
  }

  function cryptoRandomId(){
    try { return crypto.randomUUID(); } catch { return 'id-' + Math.random().toString(36).slice(2); }
  }

  function renderNotes() {
    if (!notesListDiv) return;
    notesListDiv.innerHTML = '';
    if (notes.length === 0) {
      notesListDiv.innerHTML = `
        <div class="cr-empty-state">
          <i class="cr-empty-state__icon fa-regular fa-note-sticky"></i>
          <p class="cr-empty-state__text">No hay notas para este paso aún.</p>
          <p class="cr-empty-state__help">Usa el cuadro de texto de arriba para añadir una nota.</p>
        </div>
      `;
    }

    // Sort notes by timestamp (newest first)
    notes.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

    notes.forEach(note => {
      const noteItem = document.createElement('div');
      noteItem.className = 'cr-note-item';
      noteItem.innerHTML = `
        <div class="cr-note-item__header">
          <span class="cr-note-item__step">Paso ${note.stepNumber}: ${note.stepName}</span>
          <span class="cr-note-item__timestamp">${new Date(note.timestamp).toLocaleString()}</span>
        </div>
        <div class="cr-note-item__content">${note.content}</div>
      `;
      notesListDiv.appendChild(noteItem);
    });
    if (notesCountSpan) notesCountSpan.textContent = notes.length;
  }

  function updateNotesStepInfo() {
    if (currentStepNotesSpan) currentStepNotesSpan.textContent = `Paso ${current + 1}`; 
    if (currentStepNameNotesSpan) currentStepNameNotesSpan.textContent = steps[current].dataset.name || '';
  }

  // --- Utility functions for badges and normalization ---
  function estadoBadge(estado) {
    const s = (estado || '').toLowerCase();
    if (s === 'activo') return `<span class="badge-estado badge-disponible">Activo</span>`;
    if (s === 'inactivo') return `<span class="badge-estado badge-fueraservicio">Inactivo</span>`;
    if (s === 'mantenimiento') return `<span class="badge-estado badge-mantenimiento">Mantenimiento</span>`;
    return `<span class="badge-estado">${estado}</span>`;
  }
  
  function condicionBadge(condicion) {
    const c = (condicion || '').toLowerCase();
    if (c === 'nuevo') return `<span class="badge-estado" style="background:#e3f2fd;color:#1976d2;">Nuevo</span>`;
    if (c === 'usado') return `<span class="badge-estado" style="background:#fff3e0;color:#e65100;">Usado</span>`; // New condition for 'Usado'
    // If only 'Nuevo' and 'Usado' are expected, you might not need 'regular' or a generic fallback
    // If other conditions are possible from API, add more specific styles or use a generic one
    return `<span class="badge-estado">${condicion}</span>`;
  }

  async function normalizeProduct(item) {
    const tarifa = Number(item.tarifa_renta ?? item.tarifa ?? item.tarifa_dia ?? item.precio_renta ?? 0) || 0;
    const precioVenta = Number(item.precio_unitario ?? item.precio_venta ?? 0) || 0;
    const val = v => v === true || v === 1 || v === '1' || (typeof v === 'string' && v.toLowerCase() === 'true');
    let renta = val(item.renta);
    let venta = val(item.venta);
    if (!renta && tarifa > 0) renta = true; // inferir por precio de renta
    if (!venta && precioVenta > 0) venta = true; // inferir por precio de venta

    let imagenBase64 = null;
    let imageNaturalWidth = 0;
    let imageNaturalHeight = 0;
    const imgSrc = item.imagen && item.imagen !== '' ? item.imagen : 'img/default.jpg';

    if (imgSrc !== 'img/default.jpg') { // Avoid trying to fetch default.jpg if it causes issues
      try {
        const response = await fetch(imgSrc);
        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          imagenBase64 = await new Promise(resolve => {
            reader.onloadend = () => {
              const img = new Image();
              img.onload = () => {
                imageNaturalWidth = img.naturalWidth;
                imageNaturalHeight = img.naturalHeight;
                resolve(reader.result);
              };
              img.onerror = () => resolve(null);
              img.src = reader.result;
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } else {
          console.warn(`No se pudo cargar la imagen ${imgSrc}. Status: ${response.status}`);
        }
      } catch (e) {
        console.error(`Error al procesar la imagen ${imgSrc}:`, e);
      }
    }

    return {
      __tipo: 'producto',
      id: item.id_producto || item.id || cryptoRandomId(),
      nombre: item.nombre,
      clave: item.clave || item.codigo || '',
      categoria: item.nombre_categoria || item.categoria || '',
      id_categoria: allCategories.find(cat => cat.nombre_categoria === (item.nombre_categoria || item.categoria))?.id_categoria || null,
      estado: item.estado || 'Activo',
      condicion: item.condicion || 'Nuevo',
      ubicacion: item.ubicacion || '',
      peso: item.peso || '',
      descripcion: item.descripcion || '',
      renta,
      venta,
      tarifa,
      precio_venta: precioVenta,
      imagen: imgSrc, // Keep original image path for display
      imagenBase64, // Base64 for PDF
      imageNaturalWidth, // Natural width for aspect ratio calculation
      imageNaturalHeight, // Natural height for aspect ratio calculation
      id_almacen: item.id_almacen || null,
      nombre_almacen: item.nombre_almacen || 'N/A',
      id_subcategoria: item.id_subcategoria || null,
      nombre_subcategoria: item.nombre_subcategoria || null,
      stock_total: item.stock_total || 0,
      stock_venta: item.stock_venta || 0,
      en_renta: item.en_renta || 0,
    };
  }

  async function fetchProductsForSale(){
    let ok = false;
    try {
      const resp = await fetch(API_PRODUCTOS_URL + '/disponibles', { // Updated endpoint
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      let data = await resp.json();
      allProducts = Array.isArray(data) ? await Promise.all(data.map(async item => await normalizeProduct(item))) : [];
      console.log('Productos de venta cargados:', allProducts.length);
      ok = true;
    } catch (e) {
      console.warn('Fallo al cargar productos de venta desde API. Usando fallback.', e);
      allProducts = [
        { id:'fallback-prod-1', nombre:'Módulo 200 Marco-Cruceta', clave:'MC-200-001', categoria:'Andamio Marco y Cruceta', descripcion:'Módulo de 2.0m para sistema Marco-Cruceta, incluye crucetas reforzadas.', precio_venta:12000, stock_venta:50, imagen:'img/default.jpg', nombre_almacen:'Sede Principal', condicion:'Nuevo', estado:'Activo' },
        { id:'fallback-prod-2', nombre:'Módulo 150 Marco-Cruceta', clave:'MC-150-001', categoria:'Andamio Marco y Cruceta', descripcion:'Módulo de 1.5m compatible con sistema Marco-Cruceta.', precio_venta:10000, stock_venta:40, imagen:'img/default.jpg', nombre_almacen:'CDMX', condicion:'Usado', estado:'Activo' },
        { id:'fallback-prod-3', nombre:'Módulo 100 Marco-Cruceta', clave:'MC-100-001', categoria:'Andamio Marco y Cruceta', descripcion:'Módulo de 1.0m para ajustes de altura en Marco-Cruceta.', precio_venta:8000, stock_venta:60, imagen:'img/default.jpg', nombre_almacen:'EdoMex', condicion:'Nuevo', estado:'Activo' },
      ].map(p => normalizeProduct(p)); // Still call normalizeProduct as a function
    }
    renderStepProductos();
  }

  async function fetchAccessories(){
    let ok = false;
    try {
      const resp = await fetch(API_ACCESORIOS_URL, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      let data = await resp.json();
      
      // Filter accessories by idCategoriaAccesorios before normalizing
      const filteredData = Array.isArray(data) ? data.filter(item => {
        // Assuming 'categoria' or 'id_categoria' is present in the raw data
        // We need to ensure idCategoriaAccesorios is set before this filter runs
        // For now, let's assume it's set by loadFilterCategories which is called before fetchAccessories.
        // Also, check for 'categoria' string as a fallback or for initial loading before ID is known
        return (item.id_categoria && String(item.id_categoria) === String(idCategoriaAccesorios)) ||
               (item.categoria && item.categoria.toLowerCase() === 'accesorios');
      }) : [];
      
      allAccessories = await Promise.all(filteredData.map(async item => await normalizeProduct(item)));
      console.log('Accesorios cargados y filtrados:', allAccessories.length);
      ok = true;
    } catch (e) {
      console.warn('Fallo al cargar accesorios desde API. Usando fallback.', e);
      // TODO: Implement actual API call for accessories
      allAccessories = [
        { id:'acc-1', nombre:'Rueda con Freno 8"', clave:'RUED-001', categoria:'Accesorios', nombre_subcategoria:'Ruedas', descripcion:'Rueda giratoria con freno para andamios, 8 pulgadas.', precio_venta:250, stock_venta:100, imagen:'img/default.jpg', nombre_almacen:'Sede Principal', condicion:'Bueno', estado:'Activo' },
        { id:'acc-2', nombre:'Plataforma Antideslizante 2m', clave:'PLAT-002', categoria:'Accesorios', nombre_subcategoria:'Plataformas', descripcion:'Plataforma metálica antideslizante de 2 metros de largo.', precio_venta:400, stock_venta:75, imagen:'img/default.jpg', nombre_almacen:'CDMX', condicion:'Bueno', estado:'Activo' },
        { id:'acc-3', nombre:'Escalera de Acceso 1m', clave:'ESCA-001', categoria:'Accesorios', nombre_subcategoria:'Escaleras', descripcion:'Escalera de gancho para acceso a plataformas de 1 metro.', precio_venta:180, stock_venta:60, imagen:'img/default.jpg', nombre_almacen:'EdoMex', condicion:'Bueno', estado:'Activo' },
        { id:'acc-4', nombre:'Tornillo Nivelador', clave:'TORN-005', categoria:'Accesorios', nombre_subcategoria:'Tornillos', descripcion:'Tornillo nivelador con base ajustable para andamios.', precio_venta:50, stock_venta:200, imagen:'img/default.jpg', nombre_almacen:'Puebla', condicion:'Nuevo', estado:'Activo' },
      ].map(a => normalizeProduct(a)); // Still call normalizeProduct as a function
    }
    renderStepAccesorios();
  }

  async function loadWarehouses(){
    try {
      const resp = await fetch(API_ALMACENES_URL, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      allWarehouses = Array.isArray(data) ? data : [];
      console.log('Almacenes cargados:', allWarehouses.length);
    } catch (e) {
      console.warn('Fallo al cargar almacenes desde API. Usando fallback.', e);
      allWarehouses = [
        { id_almacen:'wh-1', nombre_almacen:'Sede Principal', direccion:'Oriente 174 No. 290, CDMX', cp:'08500', ciudad:'Ciudad de México' },
        { id_almacen:'wh-2', nombre_almacen:'CDMX', direccion:'Av. Insurgentes Sur 1234, CDMX', cp:'03920', ciudad:'Ciudad de México' },
        { id_almacen:'wh-3', nombre_almacen:'EdoMex', direccion:'Calle Falsa 123, Toluca, EdoMex', cp:'50000', ciudad:'Toluca' },
        { id_almacen:'wh-4', nombre_almacen:'Puebla', direccion:'Blvd. Atlixcayotl 456, Puebla, Pue.', cp:'72190', ciudad:'Puebla' },
      ];
    }
    renderWarehouseFilter();
  }

  async function loadFilterCategories() {
    try {
        const response = await fetch(`${API_CATEGORIAS_URL}`, { headers: getAuthHeaders() });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allCategories = await response.json();

        const filterCategorySelect = document.getElementById('filterCategory');
        if (filterCategorySelect) {
            while (filterCategorySelect.options.length > 1) {
                filterCategorySelect.remove(1);
            }
            allCategories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id_categoria;
                option.textContent = cat.nombre_categoria;
                filterCategorySelect.appendChild(option);
            });
            const accesoriosCategory = allCategories.find(cat => cat.nombre_categoria.toLowerCase() === 'accesorios');
            if (accesoriosCategory) {
                idCategoriaAccesorios = accesoriosCategory.id_categoria;
                console.log('ID de la categoría Accesorios:', idCategoriaAccesorios);
                // Now populate accessory subcategories using the found ID
                loadAndPopulateFilterSubcategories('filterAccessorySubcategory', idCategoriaAccesorios);
            }
        }
        return allCategories; // Return allCategories after loading
    } catch (error) {
        console.error('Error al cargar categorías para filtro:', error);
        return []; // Return an empty array on error
    }
  }

  async function loadAndPopulateFilterSubcategories(selectId, id_categoria_padre) {
    const filterSubcategorySelect = document.getElementById(selectId);
    if (!filterSubcategorySelect) return [];

    while (filterSubcategorySelect.options.length > 1) {
        filterSubcategorySelect.remove(1);
    }

    if (!id_categoria_padre) {
        filterSubcategorySelect.style.display = 'none';
        return [];
    }
    
    try {
        const response = await fetch(`${API_PRODUCTOS_URL}/subcategorias?id_categoria_padre=${id_categoria_padre}`, { headers: getAuthHeaders() }); // Updated endpoint
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const subcategories = await response.json(); // Use a local variable to avoid overwriting allSubcategories

        if (subcategories.length > 0) {
            filterSubcategorySelect.style.display = 'block';
            subcategories.forEach(sub => {
                const option = document.createElement('option');
                option.value = sub.id_subcategoria;
                option.textContent = sub.nombre_subcategoria;
                filterSubcategorySelect.appendChild(option);
            });
        } else {
            filterSubcategorySelect.style.display = 'none';
        }
        return subcategories;
    } catch (error) {
        console.error(`Error al cargar las subcategorías para filtro (${selectId}):`, error);
        filterSubcategorySelect.style.display = 'none';
        return [];
    }
  }

  function getAuthHeaders() {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  function render(){
    console.log('Rendering step:', current);
    steps.forEach((el,i)=>{ 
      el.hidden = i !== current; 
      el.classList.toggle('cr-section--active', i === current);
    });
    console.log('Estado hidden del paso actual ('+current+'):', steps[current].hidden);
    dots.forEach((d,i)=>{ d.classList.toggle('active', i === current); });
    
    // progress dots visual
    pDots.innerHTML = '';
    for (let i=0; i<steps.length; i++) {
      const dot = document.createElement('div');
      dot.className = 'dot' + (i < current ? ' completed' : i===current ? ' active' : '');
      pDots.appendChild(dot);
    }

    // step-specific renders
    if (current === 0) {
      renderStepProductos();
    } else if (current === 1) {
      console.log('Rendering Resumen Productos for step 1.');
      renderResumenProductos();
      renderStepAccesorios();
      renderResumenAccesorios();
      renderClientSummary();
      populateClientInfoInputs();
      renderLogisticsSummary();
      updatePaginationControls(); // Add this line
      updateNotesStepInfo(); // Update notes step info on render
    } else if (current === 2) {
      renderSummary();
      renderFinalizationStep();
    }

    // UX rules for navigation buttons
    continueToConfigBtn.disabled = seleccion.productos.length === 0; // Check conditions for going to configuration step
    continueToShippingBtn.disabled = false; // Add validation later

    // Populate select-branch dropdown
    const selectBranch = document.getElementById('select-branch');
    if (selectBranch) {
      while (selectBranch.options.length > 0) { // Clear existing options (including hardcoded ones)
        selectBranch.remove(0);
      }
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Seleccionar Sucursal';
      selectBranch.appendChild(defaultOption);

      allWarehouses.forEach(wh => {
        const option = document.createElement('option');
        option.value = wh.id_almacen;
        option.textContent = wh.nombre_almacen;
        selectBranch.appendChild(option);
      });

      // Set selected branch if already in seleccion.logistica
      if (seleccion.logistica.sucursal) {
        const selectedWarehouseId = String(seleccion.logistica.sucursal);
        const warehouseExists = allWarehouses.some(wh => String(wh.id_almacen) === selectedWarehouseId);
        if (warehouseExists) {
          selectBranch.value = selectedWarehouseId;
        } else {
          console.warn(`Warehouse with ID ${selectedWarehouseId} not found in allWarehouses.`);
          selectBranch.value = ''; // Reset to default if not found
        }
      }
    }
  }

  // General navigation
  // prevBtn.addEventListener('click', ()=>{ if(current>0){ current--; render(); }}); // Removed prevBtn

  // Specific "Continue" buttons for each step
  // Removed continueToQuantityBtn, now continueToConfigBtn handles the first step transition
  continueToConfigBtn.addEventListener('click', ()=>{ if(current===0 && seleccion.productos.length > 0){ current = 1; render(); }});
  continueToShippingBtn.addEventListener('click', ()=>{ if(current===1){ current = 2; render(); }});

  // Pagination buttons for Step 2
  document.getElementById('prevPageBtn')?.addEventListener('click', () => {
    if (currentProductPage > 0) {
      currentProductPage--;
      renderResumenProductos(); // Re-render products for the new page
    }
  });

  document.getElementById('nextPageBtn')?.addEventListener('click', () => {
    if (currentProductPage < totalProductPages - 1) {
      currentProductPage++;
      renderResumenProductos(); // Re-render products for the new page
    }
  });

  // Previous buttons for consolidated steps
  prevBtnConfig.addEventListener('click', ()=>{ current = 0; render(); });
  prevBtnShipping.addEventListener('click', ()=>{ current = 1; render(); });

  // Action buttons
  btnGuardarCotizacion?.addEventListener('click', ()=>{ alert('Guardar Cotización (pendiente de implementar)'); });
  btnGenerarPdf?.addEventListener('click', generarPDF);
  btnEnviarCorreo?.addEventListener('click', enviarPorCorreo);
  btnEnviarWhatsapp?.addEventListener('click', enviarPorWhatsapp);
  btnFinishQuote?.addEventListener('click', ()=>{ 
    alert('Finalizar Cotización (simulado). Se ha generado una orden de pedido y se ha notificado al cliente si es recogida en sucursal.'); 
    // Simulate sending notification if pickup
    if (seleccion.logistica.tipoEntrega === 'Entrega en Sucursal') {
      const contactMethod = seleccion.cliente.email || seleccion.cliente.cell || 'el cliente';
      console.log(`Simulando envío de notificación de recogida a ${contactMethod}.`);
    }
    // Render finalization step to update UI
    renderFinalizationStep();
  });
  btnGenerateSurveyLink?.addEventListener('click', ()=>{ alert('Generar Link/QR Encuesta (pendiente de implementar)'); });

  // Notes event listeners
  openNotesBtn?.addEventListener('click', () => { notesSidebar.classList.add('cr-sidebar--open'); updateNotesStepInfo(); renderNotes(); });
  closeNotesBtn?.addEventListener('click', () => { notesSidebar.classList.remove('cr-sidebar--open'); });
  saveNoteBtn?.addEventListener('click', () => {
    const content = noteContentInput.value.trim();
    if (content) {
      notes.push({
        id: cryptoRandomId(),
        content: content,
        timestamp: new Date().toISOString(),
        stepNumber: current + 1,
        stepName: steps[current].dataset.name || `Paso ${current + 1}`
      });
      noteContentInput.value = '';
      saveNotes();
    }
  });

  noteContentInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      saveNoteBtn.click(); // Trigger save button click
    }
  });

  // Modals management
  document.getElementById('mpCancelar')?.addEventListener('click', ()=> modal.prod.style.display='none');
  document.getElementById('mpGuardar')?.addEventListener('click', ()=> { modal.prod.style.display='none'; /* guardar cambios */});
  document.getElementById('maCancelar')?.addEventListener('click', ()=> modal.acc.style.display='none');
  document.getElementById('maGuardar')?.addEventListener('click', ()=> { modal.acc.style.display='none'; /* guardar cambios */});
  document.getElementById('mfCancelar')?.addEventListener('click', ()=> modal.fac.style.display='none');
  document.getElementById('mfTimbrar')?.addEventListener('click', ()=> { modal.fac.style.display='none'; alert('Timbrado simulado.'); });

  // Render helpers
  function fichaProductoTemplate(item, selected){
    const precioFmt = new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:2 }).format(Number(item.precio_venta||0));
    const tarifaFmt = new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:2 }).format(Number(item.tarifa||0));
    const imgSrc = item.imagen && item.imagen !== '' ? item.imagen : 'img/default.jpg';

    return `
      <div class="product-card ${selected? 'selected':''}" data-id="${item.id}" data-type="${item.__tipo}">
        ${condicionBadge(item.condicion)}
        <div class="stock-badge">Total: ${item.stock_total || 0} | Venta: ${item.stock_venta || 0}</div>
        <div class="product-image-container">
          <img src="${imgSrc}" class="product-image" alt="${item.nombre}" onerror="this.onerror=null;this.src='img/default.jpg';">
        </div>
        <div class="product-info">
          <div class="product-title">${item.nombre}</div>
          <div class="product-key">Clave: ${item.clave}</div>
          <div class="product-category">Categoría: ${item.categoria}</div>
          <div class="product-warehouse">Almacén: ${item.nombre_almacen}</div>
          <div class="product-price">
            ${item.venta ? `<span class="price-venta">Venta: ${precioFmt}</span>` : ''}
          </div>
          <div class="product-description">${item.descripcion.substring(0, 100)}...</div>
          <button class="add-to-cart-btn">${selected ? 'Seleccionado' : '+ Agregar'}</button>
        </div>
      </div>`;
  }

  function renderStepProductos(){
    const wrap = document.getElementById('gridProductos');
    if (!wrap) return;

    console.log('renderStepProductos ejecutado.');
    console.log('Filtros actuales: ', { 
      filtroBusquedaProducto, 
      filtroCategoria, 
      filtroSubcategoria, 
      filtroCondicion, 
      filtroAlmacen 
    });
    console.log('Total de productos disponibles: ', allProducts.length, allProducts);
    console.log('Productos seleccionados antes de filtrar:', seleccion.productos);

    const filteredProducts = allProducts.filter(p => {
      const matchesSearch = (p.nombre.toLowerCase().includes(filtroBusquedaProducto.toLowerCase()) || p.clave.toLowerCase().includes(filtroBusquedaProducto.toLowerCase()));
      const matchesCategory = filtroCategoria === '' || String(p.id_categoria) === filtroCategoria;
      const matchesSubcategory = filtroSubcategoria === '' || String(p.id_subcategoria) === filtroSubcategoria;
      const matchesCondition = filtroCondicion === '' || p.condicion.toLowerCase() === filtroCondicion.toLowerCase();
      const matchesWarehouse = filtroAlmacen === '' || String(p.id_almacen) === filtroAlmacen;

      console.log(`Producto ${p.nombre}: `,
        `Search: ${matchesSearch}, Category: ${matchesCategory} (p.id_categoria: ${p.id_categoria}), Subcategory: ${matchesSubcategory} (p.id_subcategoria: ${p.id_subcategoria}), Condition: ${matchesCondition} (p.condicion: ${p.condicion}), Warehouse: ${matchesWarehouse} (p.id_almacen: ${p.id_almacen})`
      );
      return matchesSearch && matchesCategory && matchesSubcategory && matchesCondition && matchesWarehouse;
    });

    console.log('Productos filtrados:', filteredProducts.length, filteredProducts);

    if (!filteredProducts || filteredProducts.length === 0) {
      wrap.innerHTML = `<div class="muted" style="grid-column:1/-1;text-align:center;padding:24px">No se encontraron productos que coincidan con los filtros.</div>`;
      return;
    }
    wrap.innerHTML = filteredProducts.map(p=>fichaProductoTemplate(p, seleccion.productos.some(s=>s.id===p.id))).join('');
    wrap.querySelectorAll('.product-card').forEach(card=>{
      card.addEventListener('click', ()=>{
        const id = card.getAttribute('data-id');
        const prod = allProducts.find(p=>String(p.id)===String(id));
        const idx = seleccion.productos.findIndex(s=>String(s.id)===String(id));
        if (idx>=0) { seleccion.productos.splice(idx,1); }
        else if (prod) { seleccion.productos.push({ ...prod, cantidad:1 }); }
        render(); // Re-render to update selected state and button status
      });
    });
    const contSel = document.getElementById('contadorSeleccionCart'); // Change to contadorSeleccionCart
    if (contSel) contSel.textContent = `${seleccion.productos.length} ítems`;
    console.log('Contador de productos seleccionados actualizado a:', seleccion.productos.length);
  }

  function renderWarehouseFilter() {
    const warehouseListDiv = document.getElementById('warehouse-list');
    if (!warehouseListDiv) { console.log('warehouseListDiv no encontrado'); return; }

    const filteredWarehouses = allWarehouses.filter(wh => {
      const searchTerm = filtroBusquedaAlmacen.toLowerCase();
      return (wh.nombre_almacen?.toLowerCase() || '').includes(searchTerm) || 
             (wh.ciudad?.toLowerCase() || '').includes(searchTerm) || 
             (wh.cp || '').includes(searchTerm);
    });

    if (filteredWarehouses.length === 0) {
      warehouseListDiv.innerHTML = `<p class="muted">No se encontraron almacenes.</p>`;
      return;
    }

    warehouseListDiv.innerHTML = filteredWarehouses.map(wh => `
      <div class="warehouse-option ${String(wh.id_almacen) === filtroAlmacen ? 'selected' : ''}" data-id="${wh.id_almacen}">
        <div class="warehouse-option__name">${wh.nombre_almacen || 'N/A'}</div>
        <div class="warehouse-option__location">${wh.ciudad || 'N/A'}</div>
      </div>
    `).join('');

    warehouseListDiv.querySelectorAll('.warehouse-option').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        filtroAlmacen = (filtroAlmacen === id) ? '' : id; // Toggle selection
        renderWarehouseFilter();
        renderStepProductos();
      });
    });
  }

  function renderStepAccesorios(){
    const wrap = document.getElementById('gridAccesorios');
    if (!wrap) {
      console.error('Elemento #gridAccesorios no encontrado.');
      return;
    }

    console.log('--- DEBUG: renderStepAccesorios ---');
    console.log('Estado inicial de allAccessories:', allAccessories);
    console.log('ID de la categoría Accesorios en renderStepAccesorios:', idCategoriaAccesorios);
    console.log('Filtro de búsqueda de accesorios (filtroBusquedaAccesorio):', filtroBusquedaAccesorio);
    console.log('Filtro de subcategoría de accesorios (filtroSubcategoriaAccesorio):', filtroSubcategoriaAccesorio);

    const filteredAccessories = allAccessories.filter(a => {
      // Filter by the 'Accesorios' category ID
      const matchesCategory = idCategoriaAccesorios === '' || (a.categoria && a.categoria.toLowerCase() === 'accesorios');
      const matchesSearch = (a.nombre.toLowerCase().includes(filtroBusquedaAccesorio.toLowerCase()) || a.clave.toLowerCase().includes(filtroBusquedaAccesorio.toLowerCase()));
      const matchesSubcategory = filtroSubcategoriaAccesorio === '' || (a.id_subcategoria && String(a.id_subcategoria) === filtroSubcategoriaAccesorio);

      console.log(`Accesorio ${a.nombre}: `,
        `Category Match: ${matchesCategory} (Accesorio categoria: ${a.categoria}, idCategoriaAccesorios: ${idCategoriaAccesorios}), `,
        `Search Match: ${matchesSearch}, `,
        `Subcategory Match: ${matchesSubcategory} (Accesorio id_subcategoria: ${a.id_subcategoria}, filtroSubcategoriaAccesorio: ${filtroSubcategoriaAccesorio})`
      );

      return matchesCategory && matchesSearch && matchesSubcategory;
    });

    console.log('Accesorios filtrados (después de la lógica de filtrado):', filteredAccessories.length, filteredAccessories);

    if (!filteredAccessories || filteredAccessories.length === 0) {
      wrap.innerHTML = `<div class="muted" style="grid-column:1/-1;text-align:center;padding:24px">No se encontraron accesorios que coincidan con los filtros.</div>`;
      document.getElementById('cr-accessory-count').textContent = '0';
      console.log('No se encontraron accesorios filtrados. Contenedor de accesorios vaciado.');
      return;
    }

    wrap.innerHTML = filteredAccessories.map(a=>fichaProductoTemplate(a, seleccion.accesorios.some(s=>s.id===a.id))).join('');
    wrap.querySelectorAll('.product-card').forEach(card=>{
      card.addEventListener('click', ()=>{
        const id = card.getAttribute('data-id');
        const acc = allAccessories.find(a=>String(a.id)===String(id));
        const idx = seleccion.accesorios.findIndex(s=>String(s.id)===String(id));
        if (idx>=0) { seleccion.accesorios.splice(idx,1); }
        else { seleccion.accesorios.push({ ...acc, cantidad:1 }); }
        render(); // Re-render to update selected state
      });
    });
    document.getElementById('cr-accessory-count').textContent = filteredAccessories.length;
    console.log('Accesorios renderizados. Contador actualizado.');
  }
  function renderResumenProductos(){
    console.log('renderResumenProductos ejecutado.');
    const cont = document.getElementById('resumenProductos');
    if (!cont) { 
      console.error('Error: Elemento #resumenProductos no encontrado en el DOM.');
      return; 
    }
    cont.innerHTML = '';
    console.log('Contenedor #resumenProductos vaciado.');

    totalProductPages = Math.ceil(seleccion.productos.length / productsPerPage);
    if (currentProductPage >= totalProductPages && totalProductPages > 0) {
      currentProductPage = totalProductPages - 1;
    }
    if (seleccion.productos.length === 0) {
      cont.innerHTML = `<p class="muted" style="text-align:center;padding:24px">No hay productos seleccionados.</p>`;
      updatePaginationControls();
      return;
    }

    const startIndex = currentProductPage * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const productsToDisplay = seleccion.productos.slice(startIndex, endIndex);

    console.log('Productos a mostrar en la página actual:', productsToDisplay);

    productsToDisplay.forEach(p=>{
      console.log('Producto a renderizar:', p.nombre, 'Imagen:', p.imagen);
      const precioFmt = new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:2 }).format(Number(p.precio_venta||0));
      const subtotalProducto = new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:2 }).format(Number(p.cantidad * p.precio_venta||0));

      const row = document.createElement('div');
      row.className = 'cr-card cr-product-qty-item';
      row.innerHTML = `
        <img src="${p.imagen}" alt="${p.nombre}" class="cr-product-qty-item__image">
        <div class="cr-product-qty-item__info">
          <div class="cr-product-qty-item__title">${p.nombre}</div>
          <div class="cr-product-qty-item__description">${p.descripcion || 'No hay descripción disponible.'}</div>
          <div class="cr-product-qty-item__details">
            <div class="cr-product-qty-item__price">Precio: ${precioFmt}</div>
            <div class="cr-product-qty-item__stock">Stock disponible: ${p.stock_venta}</div>
          </div>
        </div>
        <div class="cr-product-qty-item__actions">
          <div class="cr-product-qty-item__controls">
            <button class="cr-btn cr-btn--icon quantity-decrease" data-id="${p.id}"><i class="fa-solid fa-minus"></i></button>
            <input type="number" min="1" max="${p.stock_venta}" value="${p.cantidad}" class="cr-input quantity-input" data-id="${p.id}">
            <button class="cr-btn cr-btn--icon quantity-increase" data-id="${p.id}"><i class="fa-solid fa-plus"></i></button>
          </div>
          <div class="cr-product-qty-item__subtotal">Subtotal: <span class="subtotal-value">${subtotalProducto}</span></div>
        </div>
      `;
      console.log('HTML de la fila del producto '+p.nombre+':', row.innerHTML);
      cont.appendChild(row);
      console.log('Fila del producto '+p.nombre+' añadida al contenedor.');

      // Add event listeners for quantity controls
      row.querySelector('.quantity-decrease').addEventListener('click', () => {
        if (p.cantidad > 1) {
          p.cantidad--;
          render();
        }
      });

      row.querySelector('.quantity-increase').addEventListener('click', () => {
        if (p.cantidad < p.stock_venta) {
          p.cantidad++;
          render();
        }
      });

      row.querySelector('.quantity-input').addEventListener('change', (e) => {
        let newQty = parseInt(e.target.value);
        if (isNaN(newQty) || newQty < 1) newQty = 1;
        if (newQty > p.stock_venta) newQty = p.stock_venta;
        p.cantidad = newQty;
        render();
      });
    });
    updatePaginationControls();
  }

 

  function renderResumenAccesorios(){
    const cont = document.getElementById('resumenAccesorios');
    cont.innerHTML = '';
    if (seleccion.accesorios.length === 0) {
      cont.innerHTML = `<p class="muted" style="text-align:center;padding:24px">No hay accesorios seleccionados.</p>`;
      return;
    }
    seleccion.accesorios.forEach(a=>{
      const row = document.createElement('div');
      row.className = 'card inline';
      row.style.alignItems = 'center';
      row.style.gap = '12px';
      row.innerHTML = `
        <img src="${a.imagen}" alt="${a.nombre}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;background:#101722">
        <div style="flex:1 1 auto">
          <div style="font-weight:700">${a.nombre}</div>
          <div class="muted" style="font-size:12px">SKU: ${a.clave}</div>
          <div class="muted" style="font-size:12px">$${a.precio_venta} / pieza</div>
        </div>
        <label style="font-size:12px">Cantidad:</label>
        <input type="number" min="1" max="${a.stock_venta}" value="${a.cantidad}" style="width:80px" class="form-control qty-input">
      `;
      row.querySelector('.qty-input').addEventListener('input', (e)=>{ a.cantidad = Math.max(1, Math.min(parseInt(e.target.value||'1'), a.stock_venta)); });
      cont.appendChild(row);
    });
  }

  function updatePaginationControls() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const currentPageSpan = document.getElementById('currentPageSpan');
    const totalPagesSpan = document.getElementById('totalPagesSpan');

    if (prevBtn) prevBtn.disabled = currentProductPage === 0;
    if (nextBtn) nextBtn.disabled = currentProductPage >= totalProductPages - 1 || totalProductPages === 0;
    if (currentPageSpan) currentPageSpan.textContent = currentProductPage + 1;
    if (totalPagesSpan) totalPagesSpan.textContent = totalProductPages;
  }

  function calculateShippingCost(kilometers, zoneType) {
    let cost = 0;
    if (kilometers > 0) {
      if (zoneType === 'metropolitana') {
        cost = kilometers * 4 * 12;
      } else if (zoneType === 'foraneo') {
        cost = kilometers * 4 * 18;
      }
    }
    return cost;
  }

  function calculateTotals() {
    let subtotalProductos = seleccion.productos.reduce((sum, p) => sum + (p.cantidad * p.precio_venta), 0);
    let subtotalAccesorios = seleccion.accesorios.reduce((sum, a) => sum + (a.cantidad * a.precio_venta), 0);

    // Update logistics costs if applicable
    if (seleccion.logistica.kilometers && seleccion.logistica.zoneType) {
      seleccion.logistica.costoEnvio = calculateShippingCost(
        seleccion.logistica.kilometers,
        seleccion.logistica.zoneType
      );
    } else {
      seleccion.logistica.costoEnvio = 0;
    }

    const shippingCost = seleccion.logistica.costoEnvio;
    const totalBeforeIva = subtotalProductos + subtotalAccesorios + shippingCost;
    const iva = totalBeforeIva * 0.16;
    const total = totalBeforeIva + iva;

    const currencyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

    // Update elements in Step 2
    const step2SubtotalProductosSpan = document.getElementById('step2-subtotal-productos');
    if (step2SubtotalProductosSpan) step2SubtotalProductosSpan.textContent = currencyFmt.format(subtotalProductos);

    const crAccTotalSpan = document.getElementById('cr-acc-total');
    if (crAccTotalSpan) crAccTotalSpan.textContent = currencyFmt.format(subtotalAccesorios);

    const crAccTotalDetailSpan = document.getElementById('cr-acc-total-detail');
    if (crAccTotalDetailSpan) {
      crAccTotalDetailSpan.textContent = seleccion.accesorios.length > 0
        ? `${seleccion.accesorios.length} accesorios seleccionados`
        : 'Sin accesorios seleccionados';
    }

    const logisticsCalculatedCostSpan = document.getElementById('logistics-calculated-cost');
    if (logisticsCalculatedCostSpan) logisticsCalculatedCostSpan.textContent = currencyFmt.format(shippingCost);

    // Update elements in Final Summary (Step 3)
    const tSubtotalSpan = document.getElementById('tSubtotal');
    if (tSubtotalSpan) tSubtotalSpan.textContent = currencyFmt.format(subtotalProductos + subtotalAccesorios);

    const tEnvioSpan = document.getElementById('tEnvio');
    if (tEnvioSpan) tEnvioSpan.textContent = currencyFmt.format(shippingCost);

    const tIvaSpan = document.getElementById('tIva');
    if (tIvaSpan) tIvaSpan.textContent = currencyFmt.format(iva);

    const tTotalSpan = document.getElementById('tTotal');
    if (tTotalSpan) tTotalSpan.textContent = currencyFmt.format(total);

    // Also update the logistics summary
    renderLogisticsSummary();
  }

  function renderSummary() {
    const sumProductosDiv = document.getElementById('sumProductos');
    const sumAccesoriosDiv = document.getElementById('sumAccesorios');
    const logisticaTipoSpan = document.getElementById('logistica-tipo');
    const logisticaCostoSpan = document.getElementById('logistica-costo');
    const tSubtotalSpan = document.getElementById('tSubtotal');
    const tEnvioSpan = document.getElementById('tEnvio');
    const tIvaSpan = document.getElementById('tIva');
    const tTotalSpan = document.getElementById('tTotal');

    let subtotal = 0;

    sumProductosDiv.innerHTML = '';
    seleccion.productos.forEach(p => {
      const itemTotal = p.cantidad * p.precio_venta;
      subtotal += itemTotal;
      sumProductosDiv.innerHTML += `
        <div class="row">
          <span>${p.nombre} (x${p.cantidad})</span>
          <strong>$${itemTotal.toFixed(2)}</strong>
        </div>
      `;
    });
    if (seleccion.productos.length === 0) sumProductosDiv.innerHTML = `<p class="muted">No hay productos seleccionados.</p>`;

    sumAccesoriosDiv.innerHTML = '';
    seleccion.accesorios.forEach(a => {
      const itemTotal = a.cantidad * a.precio_venta;
      subtotal += itemTotal;
      sumAccesoriosDiv.innerHTML += `
        <div class="row">
          <span>${a.nombre} (x${a.cantidad})</span>
          <strong>$${itemTotal.toFixed(2)}</strong>
        </div>
      `;
    });
    if (seleccion.accesorios.length === 0) sumAccesoriosDiv.innerHTML = `<p class="muted">No hay accesorios seleccionados.</p>`;

    logisticaTipoSpan.textContent = seleccion.logistica.tipoEntrega || 'N/A';
    logisticaCostoSpan.textContent = `$${(seleccion.logistica.costoEnvio || 0).toFixed(2)}`;
    
    const shippingCost = seleccion.logistica.costoEnvio || 0;
    const iva = (subtotal + shippingCost) * 0.16;
    const total = subtotal + shippingCost + iva;

    tSubtotalSpan.textContent = `$${subtotal.toFixed(2)}`;
    tEnvioSpan.textContent = `$${shippingCost.toFixed(2)}`;
    tIvaSpan.textContent = `$${iva.toFixed(2)}`;
    tTotalSpan.textContent = `$${total.toFixed(2)}`;

    // Update logistics display based on selected option
    const deliveryBranchRadio = document.getElementById('delivery-branch-radio');
    const deliverySiteRadio = document.getElementById('delivery-site-radio');
    const branchSelectionDiv = document.getElementById('branch-selection');
    const siteDeliveryDetailsDiv = document.getElementById('site-delivery-details');

    if (deliveryBranchRadio && deliverySiteRadio && branchSelectionDiv && siteDeliveryDetailsDiv) {
      if (deliveryBranchRadio.checked) {
        seleccion.logistica.tipoEntrega = 'Entrega en Sucursal';
        branchSelectionDiv.style.display = 'block';
        siteDeliveryDetailsDiv.style.display = 'none';
      } else {
        seleccion.logistica.tipoEntrega = 'Entrega a Domicilio';
        branchSelectionDiv.style.display = 'none';
        siteDeliveryDetailsDiv.style.display = 'block';
      }
    }

    // Add event listeners to update seleccion.logistica (delivery details)
    document.getElementById('delivery-street')?.addEventListener('input', (e) => { seleccion.logistica.deliveryStreet = e.target.value; renderLogisticsSummary(); });
    document.getElementById('delivery-ext-num')?.addEventListener('input', (e) => { seleccion.logistica.deliveryExtNum = e.target.value; renderLogisticsSummary(); });
    document.getElementById('delivery-int-num')?.addEventListener('input', (e) => { seleccion.logistica.deliveryIntNum = e.target.value; renderLogisticsSummary(); });
    document.getElementById('delivery-colony')?.addEventListener('input', (e) => { seleccion.logistica.deliveryColony = e.target.value; renderLogisticsSummary(); });
    document.getElementById('delivery-zip')?.addEventListener('input', (e) => { seleccion.logistica.deliveryZip = e.target.value; renderLogisticsSummary(); });
    document.getElementById('delivery-city')?.addEventListener('input', (e) => { seleccion.logistica.deliveryCity = e.target.value; renderLogisticsSummary(); });
    document.getElementById('delivery-state')?.addEventListener('input', (e) => { seleccion.logistica.deliveryState = e.target.value; renderLogisticsSummary(); });
    document.getElementById('delivery-reference')?.addEventListener('input', (e) => { seleccion.logistica.deliveryReference = e.target.value; renderLogisticsSummary(); });

    // Event listeners for delivery method radio buttons
    deliveryBranchRadio?.addEventListener('change', (e) => {
      if (e.target.checked) {
        seleccion.logistica.tipoEntrega = 'Entrega en Sucursal';
        seleccion.logistica.kilometers = 0;
        seleccion.logistica.zoneType = 'metropolitana';
        calculateTotals(); // Recalculate totals as shipping cost might change
        renderLogisticsSummary();
      }
    });
    deliverySiteRadio?.addEventListener('change', (e) => {
      if (e.target.checked) {
        seleccion.logistica.tipoEntrega = 'Entrega a Domicilio';
        // You might want to reset or keep previous values for kilometers/zoneType here
        calculateTotals(); // Recalculate totals as shipping cost might change
        renderLogisticsSummary();
      }
    });

    // Event listener for select-branch dropdown
    document.getElementById('select-branch')?.addEventListener('change', (e) => {
      seleccion.logistica.sucursal = e.target.value;
      renderLogisticsSummary();
    });
  }

  function populateClientInfoInputs() {
    const client = seleccion.cliente;
    if (client) {
      document.getElementById('client-contact').value = client.contact || '';
      document.getElementById('client-company-name').value = client.companyName || '';
      document.getElementById('client-phone').value = client.phone || '';
      document.getElementById('client-cell').value = client.cell || '';
      document.getElementById('client-email').value = client.email || '';
      document.getElementById('fiscal-rfc').value = client.fiscalRfc || '';
      document.getElementById('fiscal-company-name').value = client.fiscalCompanyName || '';
    }

    // Add event listeners to update seleccion.cliente
    document.getElementById('client-contact')?.addEventListener('input', (e) => { seleccion.cliente.contact = e.target.value; renderClientSummary(); });
    document.getElementById('client-company-name')?.addEventListener('input', (e) => { seleccion.cliente.companyName = e.target.value; renderClientSummary(); });
    document.getElementById('client-phone')?.addEventListener('input', (e) => { seleccion.cliente.phone = e.target.value; renderClientSummary(); });
    document.getElementById('client-cell')?.addEventListener('input', (e) => { seleccion.cliente.cell = e.target.value; renderClientSummary(); });
    document.getElementById('client-email')?.addEventListener('input', (e) => { seleccion.cliente.email = e.target.value; renderClientSummary(); });
    document.getElementById('fiscal-rfc')?.addEventListener('input', (e) => { seleccion.cliente.fiscalRfc = e.target.value; renderClientSummary(); });
    document.getElementById('fiscal-company-name')?.addEventListener('input', (e) => { seleccion.cliente.fiscalCompanyName = e.target.value; renderClientSummary(); });
  }

  function renderClientSummary() {
    const clientSummaryDiv = document.getElementById('client-summary');
    if (!clientSummaryDiv) return;

    const client = seleccion.cliente;
    if (Object.keys(client).length === 0) {
      clientSummaryDiv.innerHTML = `<p class="muted">No se ha ingresado información del cliente.</p>`;
      return;
    }

    clientSummaryDiv.innerHTML = `
      <div class="cr-card__title">Contacto</div>
      <p><strong>Representante:</strong> ${client.contact || 'N/A'}</p>
      <p><strong>Empresa:</strong> ${client.companyName || 'N/A'}</p>
      <p><strong>Teléfono:</strong> ${client.phone || 'N/A'}</p>
      <p><strong>Celular:</strong> ${client.cell || 'N/A'}</p>
      <p><strong>Email:</strong> ${client.email || 'N/A'}</p>
      ${client.fiscalRfc || client.fiscalCompanyName ? `
        <div class="cr-card__title" style="margin-top:12px;">Datos Fiscales</div>
        <p><strong>RFC:</strong> ${client.fiscalRfc || 'N/A'}</p>
        <p><strong>Razón Social Fiscal:</strong> ${client.fiscalCompanyName || 'N/A'}</p>
      ` : ''}
    `;
  }

  function renderLogisticsSummary() {
    const logisticsSummaryDiv = document.getElementById('logistics-summary');
    if (!logisticsSummaryDiv) return;

    const logistics = seleccion.logistica;
    if (Object.keys(logistics).length === 0) {
      logisticsSummaryDiv.innerHTML = `<p class="muted">No se ha ingresado información de logística.</p>`;
      return;
    }

    const currencyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

    logisticsSummaryDiv.innerHTML = `
      <div class="cr-card__title">Entrega</div>
      <p><strong>Tipo de Entrega:</strong> ${logistics.tipoEntrega || 'N/A'}</p>
      ${logistics.tipoEntrega === 'Entrega en Sucursal' ?
        `<p><strong>Sucursal:</strong> ${allWarehouses.find(wh => wh.id_almacen === logistics.sucursal)?.nombre_almacen || 'N/A'}</p>` :
        `
          <p><strong>Dirección:</strong> ${logistics.deliveryStreet || 'N/A'} ${logistics.deliveryExtNum || ''} ${logistics.deliveryIntNum ? `Int. ${logistics.deliveryIntNum}` : ''}</p>
          <p><strong>Colonia:</strong> ${logistics.deliveryColony || 'N/A'}</p>
          <p><strong>C.P.:</strong> ${logistics.deliveryZip || 'N/A'}</p>
          <p><strong>Ciudad:</strong> ${logistics.deliveryCity || 'N/A'}</p>
          <p><strong>Estado:</strong> ${logistics.deliveryState || 'N/A'}</p>
          <p><strong>Referencia:</strong> ${logistics.deliveryReference || 'N/A'}</p>
          <p><strong>Kilómetros:</strong> ${logistics.kilometers || 'N/A'} km</p>
          <p><strong>Tipo de Zona:</strong> ${logistics.zoneType === 'metropolitana' ? 'Metropolitana' : 'Foráneo'}</p>
        `
      }
      <p><strong>Costo de Envío:</strong> ${currencyFmt.format(logistics.costoEnvio)}</p>
    `;
  }

  // Datos de la empresa (copia de public/plantillas_pdf/cotizacion_venta.js)
  const empresa = {
    nombre: 'ANDAMIOS Y PROYECTOS TORRES, S.A. DE C.V.',
    direccion: 'Oriente 174 No. 290, Col. Moctezuma 2a Sección c.p. 15330, Venustiano Carranza,CDMX',
    telefono: '(01) 55-55-71-71-05, 55-26-46-00-24',
    celular: '55-62-55-78-19',
    email: 'ventas@andamiostorres.com',
    certificacion: 'ISO 9001:2015 CERTIFIED'
  };

  // Función para generar PDF
  async function generarPDF() {
    console.log('Iniciando generación de PDF con jsPDF...');
    try {
      // Asegurar que los totales estén calculados antes de generar el PDF
      calculateTotals();

      const totalesParaPDF = {
        subtotalProductos: seleccion.productos.reduce((sum, p) => sum + (p.cantidad * p.precio_venta), 0),
        subtotalAccesorios: seleccion.accesorios.reduce((sum, a) => sum + (a.cantidad * a.precio_venta), 0),
        shippingCost: seleccion.logistica.costoEnvio,
        iva: (seleccion.productos.reduce((sum, p) => sum + (p.cantidad * p.precio_venta), 0) + seleccion.accesorios.reduce((sum, a) => sum + (a.cantidad * a.precio_venta), 0) + seleccion.logistica.costoEnvio) * 0.16,
        total: (seleccion.productos.reduce((sum, p) => sum + (p.cantidad * p.precio_venta), 0) + seleccion.accesorios.reduce((sum, a) => sum + (a.cantidad * a.precio_venta), 0) + seleccion.logistica.costoEnvio) * 1.16,
      };

      const { jsPDF } = window.jspdf; // Get jsPDF from window object
      const doc = new jsPDF();

      // Define content for PDF directly
      const pdfData = prepararDatosParaJsPDF(seleccion, totalesParaPDF);

      let currentY = 20; // Starting Y position

      // Logo
      const img = new Image();
      img.src = 'img/logo-demo.jpg'; // CORRECCIÓN: Cambiado a logo-demo.jpg
      await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; }); // Esperar a que la imagen cargue
      if (img.complete && img.naturalHeight !== 0) {
        const imgWidth = 10; // Ancho deseado en mm, Reducido a 10
        const imgHeight = img.naturalHeight * imgWidth / img.naturalWidth; // Altura proporcional
        doc.addImage(img, 'JPEG', 15, 10, imgWidth, imgHeight); // Posición y tamaño ajustados (Y a 10)
      } else {
        console.warn("No se pudo cargar la imagen del logo.");
      }

      // Company Info (aligned with logo, on the right side)
      const companyInfoStartX = 32; // Ajustado para el nuevo tamaño del logo
      doc.setFontSize(8); // Reducido el tamaño de fuente
      doc.text(pdfData.empresa.nombre, companyInfoStartX, 16.5, null, null, "left"); // Ajustado Y
      doc.setFontSize(7); // Reducido el tamaño de fuente
      doc.text(pdfData.empresa.certificacion, companyInfoStartX, 19.5, null, null, "left"); // Ajustado Y
      doc.text(pdfData.empresa.direccion, companyInfoStartX, 22.5, null, null, "left"); // Ajustado Y
      doc.text(`Tel: ${pdfData.empresa.telefono} | Cel: ${pdfData.empresa.celular}`, companyInfoStartX, 25.5, null, null, "left"); // Ajustado Y
      doc.text(`Email: ${pdfData.empresa.email}`, companyInfoStartX, 28.5, null, null, "left"); // Ajustado Y

      // Cotización Info (positioned separately on the right side)
      const quoteInfoCol1X = 130; // X position for quote labels
      const quoteInfoCol2X = 155; // X position for quote details
      doc.setFontSize(9); // Reducido el tamaño de fuente
      doc.text("Cotización:", quoteInfoCol1X, 16.5);
      doc.setFontSize(8); // Reducido el tamaño de fuente
      doc.text(`${pdfData.numeroCotizacion}`, quoteInfoCol2X, 16.5);
      doc.text("Fecha:", quoteInfoCol1X, 19.5);
      doc.text(`${pdfData.fechaFormateada}`, quoteInfoCol2X, 19.5);
      doc.text("Moneda:", quoteInfoCol1X, 22.5);
      doc.text(`MXM`, quoteInfoCol2X, 22.5);

      // Blue Line after header (positioned after all header elements)
      currentY = 30; // Ajustado para estar debajo de toda la información del encabezado
      doc.setDrawColor(0, 0, 255); // Blue color
      doc.line(15, currentY + 5, 195, currentY + 5); // Ajuste de Y para la línea
      doc.setDrawColor(0, 0, 0); // Reset to black
      currentY += 15; // Espacio después de la línea azul

      // DATOS DEL CLIENTE
      doc.setFontSize(12);
      doc.text("DATOS DEL CLIENTE:", 20, currentY);
      doc.setFontSize(10);
      currentY += 8;
      doc.text(`Nombre: ${pdfData.clienteNombre}`, 20, currentY);
      currentY += 5;
      doc.text(`Teléfono: ${pdfData.clienteTelefono}`, 20, currentY);
      currentY += 5;
      doc.text(`Email: ${pdfData.clienteEmail}`, 20, currentY);
      currentY += 5;
      doc.text(`Dirección: ${pdfData.clienteDomicilio}`, 20, currentY);
      currentY += 10;

      // DESCRIPCIÓN DEL TRABAJO
      doc.setFontSize(12);
      doc.text("DESCRIPCIÓN DEL TRABAJO:", 20, currentY);
      doc.setFontSize(10);
      currentY += 8;
      doc.text(`${pdfData.descripcion}`, 20, currentY);
      currentY += 10;

      // DETALLE DE PRODUCTOS (Header)
      doc.setFontSize(12);
      doc.text("DETALLE DE PRODUCTOS:", 20, currentY);
      currentY += 8;

      // Products Table (modified column widths and added didDrawCell for custom rendering)
      const productsTableColumns = ["IMG", "CLAVE", "DESCRIPCIÓN", "CANT.", "P.UNIT.", "IMPORTE"];
      const productsTableRows = [];

      // Calculate max image height to adjust row height dynamically
      const maxImageDisplayHeight = 18; // Altura máxima deseada para las imágenes en mm

      for (const item of pdfData.items) {
        productsTableRows.push([
          '', // Vacío, didDrawCell se encargará de la imagen
          item.clave,
          item.descripcion,
          item.cantidad,
          `$${Number(item.precio).toFixed(2)}`,
          `$${Number(item.subtotal).toFixed(2)}`
        ]);
      }

      doc.autoTable({
        startY: currentY,
        head: [productsTableColumns],
        body: productsTableRows,
        headStyles: { fillColor: [0, 0, 255], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' }, // Blue header
        bodyStyles: { fillColor: [230, 242, 255], textColor: [0, 0, 0] }, // Light blue body
        styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak', halign: 'left' },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center', valign: 'middle', cellHeight: maxImageDisplayHeight + 12 }, // IMG, Ajustado cellHeight para más padding
          1: { cellWidth: 20, fontStyle: 'bold' }, // CLAVE
          2: { cellWidth: 15 }, // DESCRIPCIÓN (Ajustado a 15 para un ajuste final)
          3: { cellWidth: 15, halign: 'center' }, // CANT.
          4: { cellWidth: 25, halign: 'right' }, // P.UNIT.
          5: { cellWidth: 40, halign: 'right' }  // IMPORTE
        },
        margin: { left: 10, right: 10 }, // Explicit margins
        tableWidth: 'wrap', // Auto adjust table width
        didDrawCell: function (data) {
          if (data.column.index === 0 && data.cell.section === 'body') {
            // Más robusto: verificar el array antes de acceder al índice
            if (!pdfData.items || data.row.index < 0 || data.row.index >= pdfData.items.length) {
              console.error('didDrawCell: Invalid or missing pdfData.items for row index', data.row.index);
              return;
            }
            const item = pdfData.items[data.row.index];
            
            if (!item) {
              console.error('didDrawCell: Item is UNDEFINED for row index', data.row.index);
              return;
            }
            
            const imgData = item.imagenBase64; 
            console.log(`didDrawCell: Item ${item.nombre} (index: ${data.row.index}) - imgData present: ${!!imgData}, NaturalWidth: ${item.imageNaturalWidth}, NaturalHeight: ${item.imageNaturalHeight}`);
            if (imgData) {
              const cellWidth = data.cell.width;
              const cellHeight = data.cell.height;
              
              let imgDrawWidth = maxImageDisplayHeight; // Empezar con la altura deseada
              let imgDrawHeight = maxImageDisplayHeight; 
              
              if (item.imageNaturalWidth > 0 && item.imageNaturalHeight > 0) {
                 const naturalAspectRatio = item.imageNaturalWidth / item.imageNaturalHeight;
                 imgDrawWidth = maxImageDisplayHeight * naturalAspectRatio;
                 if (imgDrawWidth > cellWidth - 2) { // Si el ancho calculado excede el de la celda
                   imgDrawWidth = cellWidth - 2; // Reducir al máximo permitido por la celda
                   imgDrawHeight = imgDrawWidth / naturalAspectRatio; // Recalcular altura proporcionalmente
                 }
              } else {
                  console.warn('didDrawCell: imageNaturalWidth or imageNaturalHeight is 0 or undefined for item', item.nombre, 'Width:', item.imageNaturalWidth, 'Height:', item.imageNaturalHeight);
              }
              console.log(`didDrawCell: Drawing image for ${item.nombre} - x:${data.cell.x + (cellWidth - imgDrawWidth) / 2}, y:${data.cell.y + (cellHeight - imgDrawHeight) / 2}, width:${imgDrawWidth}, height:${imgDrawHeight}`);
              doc.addImage(imgData, 'JPEG', data.cell.x + (cellWidth - imgDrawWidth) / 2, data.cell.y + (cellHeight - imgDrawHeight) / 2, imgDrawWidth, imgDrawHeight);
            } else {
                console.warn(`didDrawCell: No imgData present for item ${item.nombre} (index: ${data.row.index})`);
            }
          }
        },
      });

      currentY = doc.autoTable.previous.finalY + 10; // Update Y position after table

      // DEBUG: Log pdfData before rendering totals
      console.log('pdfData before rendering RESUMEN DE COSTOS:', pdfData);

      // RESUMEN DE COSTOS
      doc.setFontSize(12);
      doc.text("RESUMEN DE COSTOS:", 20, currentY);
      currentY += 8;
      doc.setFontSize(10);
      doc.text(`SubTotal: $${Number(Number(pdfData.subtotalProductos) + Number(pdfData.subtotalAccesorios)).toFixed(2)}`, 20, currentY);
      currentY += 5;
      doc.text(`Envío: ${pdfData.distanciaKm} km - $${Number(pdfData.costoEnvio).toFixed(2)}`, 20, currentY); // Incluye kilómetros
      currentY += 5;
      doc.text(`IVA (16%): $${Number(pdfData.iva).toFixed(2)}`, 20, currentY);
      currentY += 5;
      doc.setFontSize(12);
      doc.text(`TOTAL: $${Number(pdfData.totalFinal).toFixed(2)}`, 20, currentY);
      currentY += 10;

      // Condiciones
      doc.setFontSize(12);
      doc.text("CONDICIONES:", 20, currentY);
      doc.setFontSize(10);
      currentY += 8;
      doc.text(`${pdfData.condicionesPago}`, 20, currentY);
      currentY += 5;
      doc.text(`GARANTÍA: ${pdfData.garantia}`, 20, currentY);
      currentY += 10;

      // Información Importante
      doc.setFontSize(12);
      doc.text("Información Importante:", 20, currentY);
      doc.setFontSize(10);
      currentY += 8;
      doc.text(`• La cotización es válida por 30 días`, 20, currentY);
      currentY += 15;

      // Footer (Page number already handled by autoTable hook)
      doc.setFontSize(8);
      doc.text(`Hora: ${new Date().toLocaleTimeString('es-MX')}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, null, null, "center");
      
      doc.save(`Cotizacion_Venta_${new Date().getTime()}.pdf`);
      alert('PDF generado exitosamente.');
      
    } catch (error) {
      console.error('Error en generarPDF:', error);
      alert('Error al generar el PDF. Por favor intente nuevamente.');
    }
  }

  // Nueva función para preparar los datos para jsPDF
  function prepararDatosParaJsPDF(seleccion, totales) {
    const numeroCotizacion = "VENTA-" + new Date().getTime();
    const fecha = new Date().toISOString().slice(0, 10);
    const fechaFormateada = new Date(fecha).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const clienteNombre = seleccion.cliente.contact || 'N/A';
    const clienteCompanyName = seleccion.cliente.companyName || 'N/A';
    const clienteTelefono = seleccion.cliente.phone || seleccion.cliente.cell || 'N/A';
    const clienteEmail = seleccion.cliente.email || 'N/A';
    
    const clienteDomicilio = [
      seleccion.logistica.deliveryStreet,
      seleccion.logistica.deliveryExtNum,
      seleccion.logistica.deliveryIntNum ? `Int. ${seleccion.logistica.deliveryIntNum}` : '',
      seleccion.logistica.deliveryColony
    ].filter(Boolean).join(', ');
    const clienteCiudad = seleccion.logistica.deliveryCity || 'N/A';
    const condiciones = seleccion.cliente.companyName ? 'Empresa' : 'Particular';
    const descripcion = "Venta de productos y accesorios";
    const dias = "N/A";
    const condicionesPago = "Pago en una sola exhibición";
    const documentacion = "Identificación oficial, Comprobante de domicilio";

    let fechaEntrega = '';
    const fechaEntregaFormateada = fechaEntrega ? new Date(fechaEntrega).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

    const items = [
      ...seleccion.productos.map(p => {
        console.log('Producto para PDF:', p.nombre, 'Cantidad:', p.cantidad, 'Precio Venta:', p.precio_venta);
        return {
          descripcion: p.nombre,
          cantidad: p.cantidad,
          precio: p.precio_venta,
          subtotal: p.cantidad * p.precio_venta,
          imagenBase64: p.imagenBase64,
          imageNaturalWidth: p.imageNaturalWidth || 0,
          imageNaturalHeight: p.imageNaturalHeight || 0,
          clave: p.clave,
        }
      }),
      ...seleccion.accesorios.map(a => {
        console.log('Accesorio para PDF:', a.nombre, 'Cantidad:', a.cantidad, 'Precio Venta:', a.precio_venta);
        return {
          descripcion: a.nombre,
          cantidad: a.cantidad,
          precio: a.precio_venta,
          subtotal: a.cantidad * a.precio_venta,
          imagenBase64: a.imagenBase64,
          imageNaturalWidth: a.imageNaturalWidth || 0,
          imageNaturalHeight: a.imageNaturalHeight || 0,
          clave: a.clave,
        }
      })
    ];

    const subtotalProductosCalc = Number(seleccion.productos.reduce((sum, p) => sum + (p.cantidad * p.precio_venta), 0));
    const subtotalAccesoriosCalc = Number(seleccion.accesorios.reduce((sum, a) => sum + (a.cantidad * a.precio_venta), 0));
    const totalEquipos = Number(subtotalProductosCalc + subtotalAccesoriosCalc);
    
    const rentaDia = 0;
    const totalDias = 0;
    const costoEnvio = Number(totales.shippingCost);
    const subtotal = Number(totalEquipos);
    const iva = Number((totalEquipos + costoEnvio) * 0.16);
    const totalFinal = Number(totalEquipos + costoEnvio + iva);
    const garantia = "3 meses de garantía desde la compra";

    console.log('Debug Subtotal Productos:', subtotalProductosCalc);
    console.log('Debug Subtotal Accesorios:', subtotalAccesoriosCalc);
    console.log('Debug Subtotal calculado:', totalEquipos);

    let direccionEntregaStr = '';
    if (seleccion.logistica.tipoEntrega === 'Entrega a Domicilio') {
      direccionEntregaStr = [
        seleccion.logistica.deliveryStreet,
        seleccion.logistica.deliveryExtNum,
        seleccion.logistica.deliveryIntNum ? `Int. ${seleccion.logistica.deliveryIntNum}` : '',
        seleccion.logistica.deliveryColony,
        seleccion.logistica.deliveryZip,
        seleccion.logistica.deliveryCity,
        seleccion.logistica.deliveryState
      ].filter(Boolean).join(', ');
      if (seleccion.logistica.deliveryReference) {
        direccionEntregaStr += ` (Ref: ${seleccion.logistica.deliveryReference})`;
      }
    } else if (seleccion.logistica.tipoEntrega === 'Entrega en Sucursal') {
      const sucursal = allWarehouses.find(wh => wh.id_almacen === seleccion.logistica.sucursal);
      direccionEntregaStr = sucursal ? sucursal.nombre_almacen : 'N/A';
    }

    const tipoEnvio = seleccion.logistica.tipoEntrega || 'N/A';
    const distanciaKm = seleccion.logistica.kilometers || 'N/A';
    const detalleCalculo = seleccion.logistica.zoneType === 'metropolitana' ? 'Metropolitana' : (seleccion.logistica.zoneType === 'foraneo' ? 'Foráneo' : 'N/A');
    const origenEnvio = empresa.direccion;

    return {
      empresa,
      numeroCotizacion,
      fecha,
      fechaFormateada,
      clienteNombre,
      clienteCompanyName,
      clienteTelefono,
      clienteEmail,
      clienteDomicilio,
      clienteCiudad,
      condiciones,
      descripcion,
      dias,
      condicionesPago,
      documentacion,
      fechaEntregaFormateada,
      items,
      totalEquipos,
      rentaDia,
      totalDias,
      costoEnvio,
      subtotalProductos: subtotalProductosCalc,
      subtotalAccesorios: subtotalAccesoriosCalc,
      subtotal,
      iva,
      totalFinal,
      garantia,
      direccionEntregaStr,
      tipoEnvio,
      distanciaKm,
      detalleCalculo,
      origenEnvio,
    };
  }

  // --- Funciones de envío (Email y WhatsApp) ---
  function enviarPorCorreo() {
    calculateTotals(); // Asegurar que los totales estén actualizados
    const subject = encodeURIComponent("Tu Cotización de Venta está Lista!");
    const body = encodeURIComponent("Hola,\n\nTenemos lista tu cotización. Puedes revisarla adjunta.\n\nGracias por tu preferencia.\n\nSaludos,");
    const email = seleccion.cliente.email || '';
    if (email) {
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    } else {
      alert('No se encontró un correo electrónico del cliente para enviar la cotización.');
    }
  }

  function enviarPorWhatsapp() {
    calculateTotals(); // Asegurar que los totales estén actualizados
    const message = encodeURIComponent("Hola, tenemos lista tu cotización de venta. ¡Contáctanos para más detalles!");
    const phone = seleccion.cliente.cell || seleccion.cliente.phone || '';
    if (phone) {
      const cleanedPhone = phone.replace(/\D/g, ''); 
      window.open(`https://wa.me/${cleanedPhone}?text=${message}`, '_blank');
    } else {
      alert('No se encontró un número de teléfono del cliente para enviar la cotización por WhatsApp.');
    }
  }

  // Render finalization step - dummy for now
  function renderFinalizationStep() {
    const orderStatusMessage = document.getElementById('order-status-message');
    const pickupInfoDiv = document.getElementById('pickup-info');
    const surveyInfoDiv = document.getElementById('survey-info');
    const pickupBranchNameSpan = document.getElementById('pickup-branch-name');
    const pickupContactMethodSpan = document.getElementById('pickup-contact-method');
    
    // Default message
    if (orderStatusMessage) {
      orderStatusMessage.textContent = 'La orden de pedido ha sido generada y enviada al almacén. Esperando confirmación de disponibilidad.';
    }
    if (pickupInfoDiv) pickupInfoDiv.style.display = 'none';
    if (surveyInfoDiv) surveyInfoDiv.style.display = 'block'; // Always show survey info by default for now

    if (seleccion.logistica.tipoEntrega === 'Entrega en Sucursal') {
      if (pickupInfoDiv) pickupInfoDiv.style.display = 'block';
      if (pickupBranchNameSpan) pickupBranchNameSpan.textContent = allWarehouses.find(wh => wh.id_almacen === seleccion.logistica.sucursal)?.nombre_almacen || 'N/A';
      if (pickupContactMethodSpan) pickupContactMethodSpan.textContent = seleccion.cliente.email || seleccion.cliente.cell || 'el cliente';
      if (surveyInfoDiv) surveyInfoDiv.style.display = 'none'; // Hide survey for pickup, if needed
    }
  }

  // Call initial rendering functions
  render(); // Initial render
  fetchProductsForSale();
  loadWarehouses();
  loadFilterCategories().then(categories => {
    const accesoriosCategory = categories.find(cat => cat.nombre_categoria.toLowerCase() === 'accesorios');
    if (accesoriosCategory) {
      idCategoriaAccesorios = accesoriosCategory.id_categoria; // Assign the ID to the global variable
      loadAndPopulateFilterSubcategories('filterAccessorySubcategory', idCategoriaAccesorios);
    } else {
      console.warn('Categoría "Accesorios" no encontrada. No se pueden cargar subcategorías de accesorios dinámicamente.');
    }
  });
  fetchAccessories();

  document.addEventListener('DOMContentLoaded', () => {
    renderNotes(); // Initial render of notes
    updateNotesStepInfo(); // Initial update of notes step info

    // Initial load of logistics input values and calculate totals
    if (logisticsKilometersInput) logisticsKilometersInput.value = seleccion.logistica.kilometers;
    if (logisticsZoneTypeSelect) logisticsZoneTypeSelect.value = seleccion.logistica.zoneType;
    calculateTotals(); // Calculate initial totals
  });

  // New event listeners for logistics elements
  openGoogleMapsBtn?.addEventListener('click', () => {
    const address = `${seleccion.logistica.deliveryStreet || ''}, ${seleccion.logistica.deliveryCity || ''}, ${seleccion.logistica.deliveryState || ''}`;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(googleMapsUrl, '_blank');
  });

  logisticsKilometersInput?.addEventListener('input', (e) => {
    seleccion.logistica.kilometers = parseFloat(e.target.value) || 0;
    calculateTotals();
  });

  logisticsZoneTypeSelect?.addEventListener('change', (e) => {
    seleccion.logistica.zoneType = e.target.value;
    calculateTotals();
  });

  calculateShippingCostBtn?.addEventListener('click', () => {
    calculateTotals(); // Trigger recalculation on click
  });

  // Update render function to call calculateTotals
  const originalRender = render; // Keep a reference to the original render
  render = () => {
    originalRender(); // Call the original render function
    calculateTotals(); // Recalculate and update totals on every render
  };

  // Modify existing event listeners for product/accessory quantity changes to call calculateTotals
  // This part needs to be done directly within renderResumenProductos and renderResumenAccesorios
  // since the event listeners are added dynamically.

})();