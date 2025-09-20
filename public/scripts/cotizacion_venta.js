const API_PRODUCTOS_URL = 'http://localhost:3001/api/productos';
const API_ALMACENES_URL = 'http://localhost:3001/api/productos/almacenes'; // Updated to use productos endpoint
const API_CATEGORIAS_URL = 'http://localhost:3001/api/productos/categorias'; // Updated to use productos endpoint
const API_ACCESORIOS_URL = 'http://localhost:3001/api/productos/disponibles'; // Updated to use productos endpoint and filter by category

if (!document.getElementById('popCheckStyle')) {
  const style = document.createElement('style');
  style.id = 'popCheckStyle';
  style.innerHTML = `@keyframes popCheck{0%{transform:scale(0.5);opacity:0;}60%{transform:scale(1.15);opacity:1;}100%{transform:scale(1);opacity:1;}}`;
  document.head.appendChild(style);
}

let currentProductPage = 0; // Current page index (0-based)
let totalProductPages = 0;  // Total number of pages

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
      costoEnvio: 0,
      sucursal: '', // Default empty branch selection
    },
    includeFullDescription: true, // New property for description toggle
    discountPercentage: 0, // New property for discount percentage
    quoteDescription: '', // New property for quote description
  };

  let notes = JSON.parse(localStorage.getItem('cotizacionVentaNotes') || '[]');

  console.log('Script cargado correctamente! (antes de llamadas iniciales)');

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

    // Actualizar costos logísticos si aplica
    if (seleccion.logistica.tipoEntrega === 'Entrega en Sucursal') {
      seleccion.logistica.costoEnvio = 0; // Costo de envío es 0 si se recoge en sucursal
    } else if (seleccion.logistica.kilometers && seleccion.logistica.zoneType) {
      seleccion.logistica.costoEnvio = calculateShippingCost(
        seleccion.logistica.kilometers,
        seleccion.logistica.zoneType
      );
    } else {
      seleccion.logistica.costoEnvio = 0;
    }

    const shippingCost = seleccion.logistica.costoEnvio;
    let totalBeforeIva = subtotalProductos + subtotalAccesorios + shippingCost;

    // Aplicar descuento si aplica
    let discountAmount = 0;
    if (seleccion.discountPercentage > 0) {
      discountAmount = totalBeforeIva * (seleccion.discountPercentage / 100);
      totalBeforeIva -= discountAmount;
    }

    const iva = totalBeforeIva * 0.16;
    const totalFinal = totalBeforeIva + iva;

    return {
      subtotalProductos: subtotalProductos,
      subtotalAccesorios: subtotalAccesorios,
      shippingCost: shippingCost,
      totalBeforeDiscount: subtotalProductos + subtotalAccesorios + shippingCost,
      discountAmount: discountAmount,
      totalAfterDiscount: totalBeforeIva,
      iva: iva,
      total: totalFinal
    };
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
     function renderStepProductos() {
  const productosContainer = document.getElementById('gridProductos');
  if (!productosContainer) return;

  // Filtrar productos según los filtros activos
  let productosFiltrados = allProducts.filter(prod => {
    let match = true;
    if (filtroBusquedaProducto && !prod.nombre.toLowerCase().includes(filtroBusquedaProducto.toLowerCase())) match = false;
    if (filtroCategoria && prod.id_categoria !== filtroCategoria) match = false;
    if (filtroSubcategoria && prod.id_subcategoria !== filtroSubcategoria) match = false;
    if (filtroCondicion && prod.condicion !== filtroCondicion) match = false;
    if (filtroAlmacen && prod.id_almacen !== filtroAlmacen) match = false;
    return match;
  });

  // Renderizar productos SIN paginación, todos los productos filtrados
  productosContainer.innerHTML = '';
  if (productosFiltrados.length === 0) {
    productosContainer.innerHTML = '<p class="muted">No hay productos para mostrar.</p>';
  } else {
    productosFiltrados.forEach(prod => {
      const seleccionado = seleccion.productos.some(p => p.id === prod.id);
      const card = document.createElement('div');
      card.className = 'producto-card-old';
      card.style.position = 'relative';
      card.style.display = 'inline-block';
      card.style.verticalAlign = 'top';
      card.style.width = '320px';
      card.style.margin = '12px 16px 16px 0';
      card.style.background = '#fff';
      card.style.borderRadius = '12px';
      card.style.boxShadow = '0 2px 12px #0002';
      card.style.padding = '18px 16px 16px 16px';
      card.style.transition = 'box-shadow .25s,border .25s';
      if (seleccionado) {
        card.style.border = '3px solid #1976d2';
        card.style.boxShadow = '0 0 16px #1976d2aa';
      }
      // Check animado
      if (seleccionado) {
        const checkDiv = document.createElement('div');
        checkDiv.className = 'check-anim';
        checkDiv.style.position = 'absolute';
        checkDiv.style.top = '10px';
        checkDiv.style.right = '10px';
        checkDiv.style.width = '38px';
        checkDiv.style.height = '38px';
        checkDiv.style.zIndex = '2';
        checkDiv.style.display = 'flex';
        checkDiv.style.alignItems = 'center';
        checkDiv.style.justifyContent = 'center';
        checkDiv.style.background = 'rgba(25,118,210,0.95)';
        checkDiv.style.borderRadius = '50%';
        checkDiv.style.boxShadow = '0 2px 8px #1976d2aa';
        checkDiv.style.animation = 'popCheck .4s';
        checkDiv.innerHTML = "<svg width='22' height='22' viewBox='0 0 22 22'><circle cx='11' cy='11' r='10' fill='#fff' opacity='0.15'/><path d='M6 12l3 3 7-7' stroke='#fff' stroke-width='2.5' fill='none' stroke-linecap='round'/></svg>";
        card.appendChild(checkDiv);
        console.log('CHECKDIV AGREGADO', card, checkDiv);
      }
      // Contenido principal
      const imgDiv = document.createElement('div');
      imgDiv.style.height = '110px';
      imgDiv.style.display = 'flex';
      imgDiv.style.alignItems = 'center';
      imgDiv.style.justifyContent = 'center';
      const img = document.createElement('img');
      img.src = prod.imagen;
      img.alt = prod.nombre;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100px';
      img.style.objectFit = 'contain';
      imgDiv.appendChild(img);
      card.appendChild(imgDiv);
      // Nombre
      const nombreDiv = document.createElement('div');
      nombreDiv.style.marginTop = '4px';
      nombreDiv.style.fontWeight = 'bold';
      nombreDiv.style.fontSize = '16px';
      nombreDiv.textContent = prod.nombre;
      card.appendChild(nombreDiv);
      // Clave, categoría, almacén
      const claveDiv = document.createElement('div');
      claveDiv.style.color = '#888';
      claveDiv.style.fontSize = '13px';
      claveDiv.textContent = 'Clave: ' + (prod.clave || '');
      card.appendChild(claveDiv);
      const catDiv = document.createElement('div');
      catDiv.style.color = '#888';
      catDiv.style.fontSize = '13px';
      catDiv.textContent = 'Categoría: ' + (prod.categoria || '');
      card.appendChild(catDiv);
      const almDiv = document.createElement('div');
      almDiv.style.color = '#888';
      almDiv.style.fontSize = '13px';
      almDiv.textContent = 'Almacén: ' + (prod.nombre_almacen || '');
      card.appendChild(almDiv);
      // Precio
      const precioDiv = document.createElement('div');
      precioDiv.style.color = '#1976d2';
      precioDiv.style.fontWeight = 'bold';
      precioDiv.style.fontSize = '15px';
      precioDiv.textContent = 'Venta: $' + prod.precio_venta.toLocaleString('es-MX');
      card.appendChild(precioDiv);
      // Stock
      const stockDiv = document.createElement('div');
      stockDiv.style.fontSize = '13px';
      stockDiv.style.color = '#666';
      stockDiv.style.marginBottom = '4px';
      stockDiv.textContent = 'Stock: ' + prod.stock_venta;
      card.appendChild(stockDiv);
      // Condición
      const condDiv = document.createElement('div');
      condDiv.style.marginBottom = '6px';
      condDiv.innerHTML = condicionBadge(prod.condicion);
      card.appendChild(condDiv);
      // Botón agregar
      const btn = document.createElement('button');
      btn.className = 'btn-agregar-producto';
      btn.setAttribute('data-id', prod.id);
      btn.style.width = '100%';
      btn.style.background = '#1976d2';
      btn.style.color = '#fff';
      btn.style.padding = '7px 0';
      btn.style.border = 'none';
      btn.style.borderRadius = '5px';
      btn.style.cursor = 'pointer';
      btn.textContent = '+ Agregar';
      card.appendChild(btn);
      productosContainer.appendChild(card);
    });
  }
  // Listeners para agregar producto
  productosContainer.querySelectorAll('.btn-agregar-producto').forEach(btn => {
    btn.addEventListener('click', () => {
      const prodId = btn.getAttribute('data-id');
      const prod = allProducts.find(p => String(p.id) === String(prodId));
      if (prod) {
        let existente = seleccion.productos.find(p => p.id === prod.id);
        if (existente) {
          existente.cantidad += 1;
        } else {
          seleccion.productos.push({ ...prod, cantidad: 1 });
        }
        updateSummaryDisplay();
        renderResumenProductos && renderResumenProductos();
        console.log('CLICK +AGREGAR, SELECCION:', JSON.stringify(seleccion.productos));
        renderStepProductos();
      }
    });
  });
}
function renderStepAccesorios() {
  const accesoriosContainer = document.getElementById('accesorios-list');
  if (!accesoriosContainer) return;

  // Filtrar accesorios según los filtros activos
  let accesoriosFiltrados = allAccessories.filter(acc => {
    let match = true;
    if (filtroBusquedaAccesorio && !acc.nombre.toLowerCase().includes(filtroBusquedaAccesorio.toLowerCase())) match = false;
    if (filtroSubcategoriaAccesorio && acc.id_subcategoria !== filtroSubcategoriaAccesorio) match = false;
    return match;
  });

  accesoriosContainer.innerHTML = accesoriosFiltrados.length === 0
    ? '<p class="muted">No hay accesorios para mostrar.</p>'
    : accesoriosFiltrados.map(acc => `
      <div class="accesorio-card">
        <img src="${acc.imagen}" alt="${acc.nombre}" class="accesorio-img" />
        <div class="accesorio-info">
          <h5>${acc.nombre}</h5>
          <div class="accesorio-precio">$${acc.precio_venta.toLocaleString('es-MX')}</div>
          <div class="accesorio-stock">Stock: ${acc.stock_venta}</div>
          <div class="accesorio-condicion">${condicionBadge(acc.condicion)}</div>
          <div class="accesorio-acciones">
            <button class="btn-agregar-accesorio" data-id="${acc.id}">Agregar</button>
          </div>
        </div>
      </div>
    `).join('');

  // Listeners para agregar accesorio
  accesoriosContainer.querySelectorAll('.btn-agregar-accesorio').forEach(btn => {
    btn.addEventListener('click', () => {
      const accId = btn.getAttribute('data-id');
      const acc = allAccessories.find(a => String(a.id) === String(accId));
      if (acc) {
        let existente = seleccion.accesorios.find(a => a.id === acc.id);
        if (existente) {
          existente.cantidad += 1;
        } else {
          seleccion.accesorios.push({ ...acc, cantidad: 1 });
        }
        updateSummaryDisplay();
        renderStepAccesorios();
      }
    });
  });
}
//aqui va resumen 
function renderResumenProductos() {
  const resumenContainer = document.getElementById('resumenProductosCart') || document.getElementById('resumenProductos');
  if (!resumenContainer) return;
  if (!seleccion.productos.length) {
    resumenContainer.innerHTML = '<div style="color:#888">No hay productos seleccionados.</div>';
    return;
  }
  resumenContainer.innerHTML = seleccion.productos.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #f0f0f0;">
      <span>${p.nombre} <span style="color:#888;font-size:13px;">x${p.cantidad}</span></span>
      <span style="color:#1976d2;font-weight:bold;">$${(p.precio_venta * p.cantidad).toLocaleString('es-MX')}</span>
    </div>
  `).join('');
}
function renderLogisticsSummary() {
  const resumenLogisticaDiv = document.getElementById('resumen-logistica');
  if (!resumenLogisticaDiv) return;

  const tipoEntrega = seleccion.logistica.tipoEntrega || 'Entrega a Domicilio';
  const sucursal = seleccion.logistica.sucursal || '';
  const km = seleccion.logistica.kilometers || 0;
  const zona = seleccion.logistica.zoneType || '';
  const costo = seleccion.logistica.costoEnvio || 0;

  resumenLogisticaDiv.innerHTML = `
    <div><strong>Tipo de Entrega:</strong> ${tipoEntrega}</div>
    ${tipoEntrega === 'Entrega en Sucursal' ? `<div><strong>Sucursal:</strong> ${sucursal}</div>` : ''}
    ${tipoEntrega !== 'Entrega en Sucursal' ? `<div><strong>Kilómetros:</strong> ${km}</div>
    <div><strong>Zona:</strong> ${zona}</div>
    <div><strong>Costo de Envío:</strong> $${costo.toLocaleString('es-MX')}</div>` : ''}
  `;
}  

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
      console.log('Almacenes cargados:', allWarehouses.length, allWarehouses);
    } catch (e) {
      console.warn('Fallo al cargar almacenes desde API. Usando fallback.', e);
      allWarehouses = [
        { id_almacen:'cdmx', nombre_almacen:'CDMX', direccion:'Av. Insurgentes Sur 1234, CDMX', cp:'03920', ciudad:'Ciudad de México' },
        { id_almacen:'texcoco', nombre_almacen:'Texcoco', direccion:'Calle Falsa 123, Texcoco, EdoMex', cp:'56100', ciudad:'Texcoco' },
        { id_almacen:'mexicali', nombre_almacen:'Mexicali', direccion:'Blvd. Benito Juárez 789, Mexicali, B.C.', cp:'21000', ciudad:'Mexicali' },
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

  function render() {
    console.log('Rendering step:', current);
    steps.forEach((el, i) => { 
      el.hidden = i !== current; 
      el.classList.toggle('cr-section--active', i === current);
    });
    console.log('Estado hidden del paso actual (' + current + '):', steps[current].hidden);
    dots.forEach((d, i) => { d.classList.toggle('active', i === current); });
    
    // progress dots visual
    pDots.innerHTML = '';
    for (let i = 0; i < steps.length; i++) {
      const dot = document.createElement('div');
      dot.className = 'dot' + (i < current ? ' completed' : i === current ? ' active' : '');
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
    continueToConfigBtn.disabled = false; // Check conditions for going to configuration step
    continueToShippingBtn.disabled = false; // Add validation later

    // Populate select-branch dropdown
    const selectBranch = document.getElementById('select-branch');
    // Removed duplicated local variables as they are now handled by updateDeliveryDisplay()
    // const deliveryBranchRadio = document.getElementById('delivery-branch-radio');
    // const deliverySiteRadio = document.getElementById('delivery-site-radio');
    // const branchSelectionDiv = document.getElementById('branch-selection');
    // const siteDeliveryDetailsDiv = document.getElementById('site-delivery-details');

    console.log('Debug render: seleccion.logistica.tipoEntrega', seleccion.logistica.tipoEntrega);
    console.log('Debug render: branchSelectionDiv', document.getElementById('branch-selection'));
    console.log('Debug render: siteDeliveryDetailsDiv', document.getElementById('site-delivery-details'));

    // Call new function to handle delivery display logic
   // updateDeliveryDisplay();

    if (selectBranch) {
      while (selectBranch.options.length > 0) { // Clear existing options (including hardcoded ones)
        selectBranch.remove(0);
      }
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Seleccionar Sucursal';
      selectBranch.appendChild(defaultOption);

      console.log('Almacenes disponibles para dropdown:', allWarehouses.length, allWarehouses);
      allWarehouses.forEach(wh => {
        const option = document.createElement('option');
        option.value = wh.id_almacen;
        option.textContent = wh.nombre_almacen;
        selectBranch.appendChild(option);
        console.log('Dropdown: Added option for warehouse:', wh.nombre_almacen, 'with value:', wh.id_almacen);
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
    updateSummaryDisplay(); // Call updateSummaryDisplay to update all totals display
  }

  // General navigation
  // prevBtn.addEventListener('click', ()=>{ if(current>0){ current--; render(); }}); // Removed prevBtn

  // Specific "Continue" buttons for each step
  // Removed continueToQuantityBtn, now continueToConfigBtn handles the first step transition
  continueToConfigBtn.addEventListener('click', ()=>{
  if (seleccion.productos.length > 0) {
    current = 1;
    render();
  }
});
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

  async function generarPDF() {
    console.log('Iniciando generación de PDF con jsPDF...');
    try {
      // Asegurar que los totales estén calculados antes de generar el PDF
      // calculateTotals(); // This line is removed as per the edit hint

      const totalesParaPDF = calculateTotals(); // This line is kept as it was not explicitly removed

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
        const imgWidth = 28; // Ancho deseado en mm, Aumentado a 28 (era 25)
        const imgHeight = img.naturalHeight * imgWidth / img.naturalWidth; // Altura proporcional
        doc.addImage(img, 'JPEG', 15, 10, imgWidth, imgHeight); // Posición y tamaño ajustados (Y a 10)
      } else {
        console.warn("No se pudo cargar la imagen del logo.");
      }

      // Company Info (aligned with logo, on the right side)
      const companyInfoStartX = 48; // Ajustado para el nuevo tamaño del logo (era 45)
      doc.setFontSize(5); // Reducido el tamaño de fuente (era 6)
      doc.text(pdfData.empresa.nombre, companyInfoStartX, 16.5, null, null, "left"); // Ajustado Y
      doc.setFontSize(7); // Mantiene el tamaño de fuente 7
      doc.text(pdfData.empresa.certificacion, companyInfoStartX, 19.5, null, null, "left"); // Ajustado Y
      doc.text(pdfData.empresa.direccion, companyInfoStartX, 22.5, null, null, "left"); // Ajustado Y
      doc.text(`Tel: ${pdfData.empresa.telefono} | Cel: ${pdfData.empresa.celular}`, companyInfoStartX, 25.5, null, null, "left"); // Ajustado Y
      doc.text(`Email: ${pdfData.empresa.email}`, companyInfoStartX, 28.5, null, null, "left"); // Ajustado Y

      // Cotización Info (positioned separately on the right side)
      const quoteInfoCol1X = 160; // X position for quote labels (era 155)
      const quoteInfoCol2X = 185; // X position for quote details (era 180)
      doc.setFontSize(9); // Mantiene el tamaño de fuente 9
      doc.text("Cotización:", quoteInfoCol1X, 16.5);
      doc.setFontSize(8); // Mantiene el tamaño de fuente 8
      doc.text(`${pdfData.numeroCotizacion}`, quoteInfoCol2X, 16.5);
      doc.text("Fecha:", quoteInfoCol1X, 19.5);
      doc.text(`${pdfData.fechaFormateada}`, quoteInfoCol2X, 19.5);
      doc.text("Moneda:", quoteInfoCol1X, 22.5);
      doc.text(`MXM`, quoteInfoCol2X, 22.5);

      // Blue Line after header (positioned after all header elements)
      currentY = 35; // Ajustado para estar debajo de toda la información del encabezado
      doc.setDrawColor(0, 0, 255); // Blue color
      doc.line(15, currentY + 5, 195, currentY + 5); // Ajuste de Y para la línea
      doc.setDrawColor(0, 0, 0); // Reset to black
      currentY += 15; // Espacio después de la línea azul

      // Function to draw repeating header (logo, company info, quotation info, client info)
      const drawRepeatingHeader = (doc, pdfData, pageNumber) => {
        let headerY = 10; // Initial Y position for header elements

        // Logo
        if (img.complete && img.naturalHeight !== 0) {
          const imgWidth = 28; // Ancho deseado en mm
          const imgHeight = img.naturalHeight * imgWidth / img.naturalWidth; // Altura proporcional
          doc.addImage(img, 'JPEG', 15, headerY, imgWidth, imgHeight);
          headerY = Math.max(headerY, 10 + imgHeight); // Update headerY based on logo height
        }

        // Company Info
        const companyInfoStartX = 48;
        doc.setFontSize(5); // Reducido el tamaño de fuente
        doc.text(pdfData.empresa.nombre, companyInfoStartX, 16.5, null, null, "left");
        doc.setFontSize(7);
        doc.text(pdfData.empresa.certificacion, companyInfoStartX, 19.5, null, null, "left");
        doc.text(pdfData.empresa.direccion, companyInfoStartX, 22.5, null, null, "left");
        doc.text(`Tel: ${pdfData.empresa.telefono} | Cel: ${pdfData.empresa.celular}`, companyInfoStartX, 25.5, null, null, "left");
        doc.text(`Email: ${pdfData.empresa.email}`, companyInfoStartX, 28.5, null, null, "left");
        
        // Quotation Info
        const quoteInfoCol1X = 160; // X position for quote labels
        const quoteInfoCol2X = 185; // X position for quote details
        doc.setFontSize(9);
        doc.text("Cotización:", quoteInfoCol1X, 16.5);
        doc.setFontSize(8);
        doc.text(`${pdfData.numeroCotizacion}`, quoteInfoCol2X, 16.5);
        doc.text("Fecha:", quoteInfoCol1X, 19.5);
        doc.text(`${pdfData.fechaFormateada}`, quoteInfoCol2X, 19.5);
        doc.text("Moneda:", quoteInfoCol1X, 22.5);
        doc.text(`MXM`, quoteInfoCol2X, 22.5);

        // Blue Line after header
        let lineY = Math.max(headerY, 35); // Ensure line is below all header text
        doc.setDrawColor(0, 0, 255);
        doc.line(15, lineY + 5, 195, lineY + 5);
        doc.setDrawColor(0, 0, 0);
        lineY += 15; // Space after the blue line

        // Client Data (repeating)
        let clientY = lineY; // Start client data after the blue line
        doc.setFontSize(12);
        doc.text("CLIENTE:", 20, clientY - 8); 
        doc.setFontSize(10);
        doc.text(`Empresa: ${pdfData.cliente.nombre}`, 20, clientY);
        clientY += 5;
        doc.text(`Contacto: ${pdfData.cliente.contacto}`, 20, clientY);
        clientY += 5;
        doc.text(`Domicilio: ${pdfData.cliente.domicilio}`, 20, clientY);
        clientY += 5;
        doc.text(`Ciudad: ${pdfData.cliente.ciudad}`, 20, clientY);
        clientY += 5;
        doc.text(`Teléfono: ${pdfData.cliente.telefono}`, 20, clientY);
        clientY += 5;
        doc.text(`Email: ${pdfData.cliente.email}`, 20, clientY);
        clientY += 10; // Space after client data

        return clientY; // Return the final Y position for content on the page
      };

      // DESCRIPTION OF QUOTATION
      doc.setFontSize(12);
      doc.text("DESCRIPCIÓN DE LA COTIZACIÓN:", 20, currentY);
      doc.setFontSize(10);
      currentY += 8;
      doc.text("Aquí va la descripción general de la cotización.", 20, currentY, { maxWidth: 170 }); // Placeholder
      currentY += 10;

      // PRODUCTOS Y ACCESORIOS
      doc.setFontSize(12);
      doc.text("PRODUCTOS Y ACCESORIOS:", 20, currentY);
      currentY += 8;

      const head = [
        { content: 'IMG/CLAVE', styles: { cellWidth: 35 } },
        { content: 'PART.', styles: { cellWidth: 15 } },
        { content: 'PESO', styles: { cellWidth: 15 } },
        { content: 'DESCRIPCIÓN', styles: { cellWidth: 50, halign: 'left' } },
        { content: 'CANT.', styles: { cellWidth: 15 } },
        { content: 'P.UNIT.', styles: { cellWidth: 20 } },
        { content: 'GARANT.', styles: { cellWidth: 15 } },
        { content: 'IMPORTE', styles: { cellWidth: 25 } }
      ];

      const productsTableRows = pdfData.items.map(item => [
        { content: item.imagenBase64, clave: item.clave, descripcion: item.descripcion, originalItem: item }, // Custom data for IMG/CLAVE
        item.clave, // Part number
        item.peso || 'N/A',
        item.descripcion,
        item.cantidad,
        `$${item.precio}`,
        '3 Meses', // Hardcoded as per user request
        `$${item.subtotal}`,
      ]);

      const maxImageDisplayHeight = 40; // Altura máxima para la imagen dentro de la celda, AUMENTADO A 40
      const padding = 2; // Padding alrededor de la imagen y el texto dentro de la celda

      doc.autoTable({
        startY: currentY,
        head: [head],
        body: productsTableRows,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 1,
          lineColor: 200,
          lineWidth: 0.1,
          overflow: 'linebreak',
          valign: 'middle',
          halign: 'center',
        },
        headStyles: {
          fillColor: [0, 0, 0],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 40, cellHeight: maxImageDisplayHeight + (padding * 2) + 15, halign: 'left' }, // IMG/CLAVE, AUMENTADO A 40
          1: { cellWidth: 15 }, // PART.
          2: { cellWidth: 15 }, // PESO
          3: { cellWidth: 45, halign: 'left' }, // DESCRIPCIÓN, AJUSTADO A 45
          4: { cellWidth: 15 }, // CANT.
          5: { cellWidth: 20 }, // P.UNIT.
          6: { cellWidth: 15 }, // GARANT.
          7: { cellWidth: 25 }, // IMPORTE
        },
        tableWidth: 'auto', // Cambiado a 'auto' para que abarque el ancho de la hoja
        didDrawCell: function (data) {
          if (data.column.index === 0 && data.cell.section === 'body') { // Column 0 is IMG/CLAVE
            const cellContent = data.cell.raw;
            const item = cellContent.originalItem;

            if (item && item.imagenBase64) {
              const imgData = item.imagenBase64;
              const imgNaturalWidth = item.imageNaturalWidth || 1;
              const imgNaturalHeight = item.imageNaturalHeight || 1;

              const cell = data.cell;
              const cellWidth = cell.width;
              const cellHeight = cell.height;

              // Calculate image dimensions to fit within cell, maintaining aspect ratio
              let imgDrawWidth = cellWidth - (padding * 2);
              let imgDrawHeight = imgNaturalHeight * imgDrawWidth / imgNaturalWidth;

              if (imgDrawHeight > (maxImageDisplayHeight + padding)) {
                imgDrawHeight = maxImageDisplayHeight + padding;
                imgDrawWidth = imgNaturalWidth * imgDrawHeight / imgNaturalHeight;
              }
              if (imgDrawWidth > cellWidth - (padding * 2)) {
                imgDrawWidth = cellWidth - (padding * 2);
                imgDrawHeight = imgNaturalHeight * imgDrawWidth / imgNaturalHeight;
              }

              const imgX = cell.x + (cellWidth - imgDrawWidth) / 2;
              const imgY = cell.y + padding; // Adjusted to give some top padding

              doc.setFillColor(230, 240, 255); // Light blue background for image box
              doc.rect(cell.x, cell.y, cellWidth, cellHeight, 'F'); // Draw filled rectangle for the cell background

              doc.addImage(imgData, 'JPEG', imgX, imgY, imgDrawWidth, imgDrawHeight);

              // Add clave and descripcion below the image, centered
              const textY = imgY + imgDrawHeight + 2; // Position text 2mm below the image
              doc.setFontSize(7); // Smaller font for detail text
              doc.setTextColor(0, 0, 0); // Black text color

              const claveText = `Clave: ${item.clave}`;
              const descText = item.descripcion;

              const claveTextDim = doc.getTextDimensions(claveText, { fontSize: 7 });
              const descTextDim = doc.getTextDimensions(descText, { fontSize: 7 });

              // Calculate text block position based on actual text widths
              const textBlockWidth = Math.max(claveTextDim.w, descTextDim.w);
              const textBlockX = cell.x + (cellWidth - textBlockWidth) / 2;

              doc.text(claveText, cell.x + cellWidth / 2, textY, { align: 'center' });
              doc.text(descText, cell.x + cellWidth / 2, textY + claveTextDim.h + 1, { align: 'center' });

            } else if (item) {
              // Fallback if image not available, show clave and description, centered in the entire cell
              doc.setFontSize(8);
              doc.setTextColor(0, 0, 0);
              doc.text(`Clave: ${item.clave || 'N/A'}`, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 - 4, { align: 'center' });
              doc.text(item.descripcion || 'N/A', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 4, { align: 'center' });
            }
            else {
              console.warn(`didDrawCell: Item is UNDEFINED or missing image for row index ${data.row.index} column ${data.column.index}`);
              doc.text('N/A', data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, { align: 'center', valign: 'middle' });
            }
          }
        },
        didDrawPage: function (data) {
          const finalHeaderY = drawRepeatingHeader(doc, pdfData, data.pageNumber);
          // Adjust startY for subsequent pages
          data.cursor.y = finalHeaderY; // Use the returned Y position
        },
        margin: { top: currentY }
      });
      currentY = doc.autoTable.previous.finalY + 10;

      // LOGÍSTICA
      doc.setFontSize(12);
      doc.text("LOGÍSTICA:", 20, currentY);
      doc.setFontSize(10);
      currentY += 8;
      if (pdfData.logisticsInfo.tipoEntrega === 'Entrega en Sucursal') {
        doc.text(`Tipo de Entrega: Recoger en Sucursal (${pdfData.logisticsInfo.sucursal})`, 20, currentY);
        currentY += 5;
      } else {
        doc.text(`Tipo de Entrega: ${pdfData.logisticsInfo.tipoEntrega}`, 20, currentY);
        currentY += 5;
        doc.text(`Dirección: ${pdfData.logisticsInfo.deliveryAddress}`, 20, currentY);
        currentY += 5;
        if (pdfData.logisticsInfo.deliveryColony !== 'N/A') {
          doc.text(`Colonia: ${pdfData.logisticsInfo.deliveryColony}`, 20, currentY);
          currentY += 5;
        }
        if (pdfData.logisticsInfo.deliveryZip !== 'N/A') {
          doc.text(`C.P.: ${pdfData.logisticsInfo.deliveryZip}`, 20, currentY);
          currentY += 5;
        }
        doc.text(`Ciudad: ${pdfData.logisticsInfo.deliveryCity}, Estado: ${pdfData.logisticsInfo.deliveryState}`, 20, currentY);
        currentY += 5;
        if (pdfData.logisticsInfo.deliveryReference !== 'N/A') {
          doc.text(`Referencia: ${pdfData.logisticsInfo.deliveryReference}`, 20, currentY);
          currentY += 5;
        }
        if (pdfData.logisticsInfo.kilometers > 0) {
          doc.text(`Kilómetros: ${pdfData.logisticsInfo.kilometers} km (${pdfData.logisticsInfo.zoneType})`, 20, currentY);
          currentY += 5;
        }
      }
      doc.text(`Costo de Envío: $${pdfData.costoEnvio}`, 20, currentY);
      currentY += 10;

      // RESUMEN DE COSTOS
      doc.setFontSize(12);
      doc.text("RESUMEN DE COSTOS:", 20, currentY);
      doc.setFontSize(10);
      currentY += 8;
      doc.text(`Subtotal Productos: $${pdfData.subtotalProductos}`, 20, currentY);
      currentY += 5;
      doc.text(`Subtotal Accesorios: $${pdfData.subtotalAccesorios}`, 20, currentY);
      currentY += 5;
      if (Number(pdfData.discountAmount) > 0) {
        doc.text(`Descuento (${pdfData.discountPercentage}%): -${pdfData.discountAmount}`, 20, currentY);
        currentY += 5;
      }
      doc.text(`Costo de Envío: $${pdfData.costoEnvio}`, 20, currentY);
      currentY += 5;
      doc.text(`IVA (16%): $${pdfData.iva}`, 20, currentY);
      currentY += 5;
      doc.setFontSize(12);
      doc.text(`Total Final: $${pdfData.totalFinal}`, 20, currentY);
      currentY += 10;

      // GARANTÍA
      doc.setFontSize(12);
      doc.text("GARANTÍA:", 20, currentY);
      doc.setFontSize(10);
      currentY += 8;
      doc.text("Todos los productos tienen 3 Meses de garantía desde la fecha de compra.", 20, currentY, { maxWidth: 170 });
      currentY += 10;

      // NOTAS
      if (pdfData.notes && pdfData.notes.length > 0) {
        doc.setFontSize(12);
        doc.text("NOTAS:", 20, currentY);
        doc.setFontSize(10);
        currentY += 8;
        pdfData.notes.forEach(note => {
          doc.text(`- ${note}`, 20, currentY, { maxWidth: 170 });
          currentY += doc.getTextDimensions(note, { fontSize: 10, maxWidth: 170 }).h + 2;
        });
        currentY += 5;
      }

      // INFORMACIÓN IMPORTANTE
      doc.setFontSize(12);
      doc.text("INFORMACIÓN IMPORTANTE:", 20, currentY);
      doc.setFontSize(10);
      currentY += 8;
      doc.text("Esta cotización es válida por 30 días a partir de la fecha de emisión.", 20, currentY, { maxWidth: 170 });
      currentY += 10;


      doc.save(`${pdfData.numeroCotizacion}.pdf`);
      console.log('PDF generado exitosamente con jsPDF');
    } catch (error) {
      console.error('Error en generarPDF:', error);
      alert('Hubo un error al generar el PDF. Por favor, intente de nuevo.');
    }
  }
  
  function enviarPorCorreo() {
    alert('Enviar por Correo (pendiente de implementar)');
  }

  function enviarPorWhatsapp() {
    alert('Enviar por WhatsApp (pendiente de implementar)');
  }

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

  // --- Initial loads and event listeners ---
  document.addEventListener('DOMContentLoaded', async ()=>{
    await loadFilterCategories(); // Load categories first to get idCategoriaAccesorios
    await loadAndPopulateFilterSubcategories('filterSubcategory', filtroCategoria); // For products, initially empty category
    await loadWarehouses();
    await fetchProductsForSale();
    await fetchAccessories(); // Fetch accessories after idCategoriaAccesorios is set
    render();
    // calculateTotals(); // Initial calculation of totals - This line is removed as per the edit hint
    // Ensure initial delivery display is correct based on selected radio button in HTML
    const initialDeliveryRadio = document.querySelector('input[name="metodoEntrega"]:checked');
    if (initialDeliveryRadio) {
      seleccion.logistica.tipoEntrega = initialDeliveryRadio.value === 'sucursal' ? 'Entrega en Sucursal' : 'Entrega a Domicilio';
    } else {
      // Fallback if no radio button is checked (though one should always be in HTML)
      seleccion.logistica.tipoEntrega = 'Entrega a Domicilio';
    }
    console.log('DOMContentLoaded: seleccion.logistica.tipoEntrega before updateDeliveryDisplay:', seleccion.logistica.tipoEntrega);
    updateDeliveryDisplay(); // Call to set initial display

    const deliveryBranchRadio = document.getElementById('delivery-branch-radio');
    const deliverySiteRadio = document.getElementById('delivery-site-radio');
    const selectBranch = document.getElementById('select-branch');

    deliveryBranchRadio?.addEventListener('change', (e) => {
      if (e.target.checked) {
        seleccion.logistica.tipoEntrega = 'Entrega en Sucursal';
        seleccion.logistica.kilometers = 0;
        seleccion.logistica.zoneType = 'metropolitana';
        // calculateTotals(); // Recalculate totals as shipping cost might change - This line is removed as per the edit hint
        updateDeliveryDisplay(); // Update display based on new selection
        renderLogisticsSummary();
      }
    });

    deliverySiteRadio?.addEventListener('change', (e) => {
      if (e.target.checked) {
        seleccion.logistica.tipoEntrega = 'Entrega a Domicilio';
        // You might want to reset or keep previous values for kilometers/zoneType here
        // calculateTotals(); // Recalculate totals as shipping cost might change - This line is removed as per the edit hint
        updateDeliveryDisplay(); // Update display based on new selection
        renderLogisticsSummary();
      }
    });

    selectBranch?.addEventListener('change', (e) => {
      seleccion.logistica.sucursal = e.target.value;
      renderLogisticsSummary();
    });
  });
  // Filters event listeners (Step 1)
  document.getElementById('filterSearch')?.addEventListener('input', (e)=>{
    filtroBusquedaProducto = e.target.value;
    renderStepProductos();
  });

  document.getElementById('filterCategory')?.addEventListener('change', async (e)=>{
    filtroCategoria = e.target.value;
    await loadAndPopulateFilterSubcategories('filterSubcategory', filtroCategoria);
    renderStepProductos();
  });

  document.getElementById('filterSubcategory')?.addEventListener('change', (e) => {
    filtroSubcategoria = e.target.value;
    renderStepProductos();
  });

  document.getElementById('filterCondition')?.addEventListener('change', (e)=>{
    filtroCondicion = e.target.value;
    renderStepProductos();
  });

  document.getElementById('filterWarehouseSearch')?.addEventListener('input', (e) => {
    filtroBusquedaAlmacen = e.target.value;
    renderWarehouseFilter();
  });

  // Accessory filters event listeners (Step 2)
  document.getElementById('filterAccessorySearch')?.addEventListener('input', (e)=>{
    filtroBusquedaAccesorio = e.target.value;
    renderStepAccesorios();
  });

  document.getElementById('filterAccessorySubcategory')?.addEventListener('change', (e) => {
    filtroSubcategoriaAccesorio = e.target.value;
    renderStepAccesorios();
  });

  // Client Info event listeners (Step 3) - These are now handled in populateClientInfoInputs()

  // Logistics event listeners (Step 3)
  logisticsKilometersInput?.addEventListener('input', (e) => {
    seleccion.logistica.kilometers = parseFloat(e.target.value) || 0;
    // calculateTotals(); // Recalculate totals as shipping cost might change - This line is removed as per the edit hint
  });

  logisticsZoneTypeSelect?.addEventListener('change', (e) => {
    seleccion.logistica.zoneType = e.target.value;
    // calculateTotals(); // Recalculate totals as shipping cost might change - This line is removed as per the edit hint
  });

  openGoogleMapsBtn?.addEventListener('click', () => {
    const address = `${seleccion.logistica.deliveryStreet} ${seleccion.logistica.deliveryExtNum}, ${seleccion.logistica.deliveryColony}, ${seleccion.logistica.deliveryCity}, ${seleccion.logistica.deliveryState}, CP ${seleccion.logistica.deliveryZip}`;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(googleMapsUrl, '_blank');
  });

  calculateShippingCostBtn?.addEventListener('click', calculateTotals);

  function updateSummaryDisplay() {
    const totals = calculateTotals();
    const currencyFmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

    // Update elements in Step 2
    const step2SubtotalProductosSpan = document.getElementById('step2-subtotal-productos');
    if (step2SubtotalProductosSpan) step2SubtotalProductosSpan.textContent = currencyFmt.format(totals.subtotalProductos);

    const crAccTotalSpan = document.getElementById('cr-acc-total');
    if (crAccTotalSpan) crAccTotalSpan.textContent = currencyFmt.format(totals.subtotalAccesorios);

    const crAccTotalDetailSpan = document.getElementById('cr-acc-total-detail');
    if (crAccTotalDetailSpan) {
      crAccTotalDetailSpan.textContent = seleccion.accesorios.length > 0
        ? `${seleccion.accesorios.length} accesorios seleccionados`
        : 'Sin accesorios seleccionados';
    }

    const logisticsCalculatedCostSpan = document.getElementById('logistics-calculated-cost');
    if (logisticsCalculatedCostSpan) logisticsCalculatedCostSpan.textContent = currencyFmt.format(totals.shippingCost);

    // Update elements in Final Summary (Step 3)
    const tSubtotalSpan = document.getElementById('tSubtotal');
    if (tSubtotalSpan) tSubtotalSpan.textContent = currencyFmt.format(totals.totalBeforeDiscount - totals.shippingCost); // Subtotal before shipping

    const tEnvioSpan = document.getElementById('tEnvio');
    if (tEnvioSpan) tEnvioSpan.textContent = currencyFmt.format(totals.shippingCost);

    const discountAmountSpan = document.getElementById('discount-amount');
    if (discountAmountSpan) discountAmountSpan.textContent = currencyFmt.format(-totals.discountAmount);
    
    const tIvaSpan = document.getElementById('tIva');
    if (tIvaSpan) tIvaSpan.textContent = currencyFmt.format(totals.iva);

    const tTotalSpan = document.getElementById('tTotal');
    if (tTotalSpan) tTotalSpan.textContent = currencyFmt.format(totals.total);

    // Also update the logistics summary
    renderLogisticsSummary();
  }

  // New function to handle delivery display logic
  function updateDeliveryDisplay() {
    console.log('--- DEBUG: Inside updateDeliveryDisplay. seleccion.logistica.tipoEntrega:', seleccion.logistica.tipoEntrega);
    const deliveryBranchRadio = document.getElementById('delivery-branch-radio');
    const deliverySiteRadio = document.getElementById('delivery-site-radio');
    const branchSelectionDiv = document.getElementById('branch-selection');
    const siteDeliveryDetailsDiv = document.getElementById('site-delivery-details');

    if (!deliveryBranchRadio || !deliverySiteRadio || !branchSelectionDiv || !siteDeliveryDetailsDiv) {
      console.warn('One or more logistics elements not found in updateDeliveryDisplay. Skipping dynamic display logic.');
      return;
    }

    if (seleccion.logistica.tipoEntrega === 'Entrega en Sucursal') {
      deliveryBranchRadio.checked = true;
      deliverySiteRadio.checked = false;
      branchSelectionDiv.style.display = 'block';
      siteDeliveryDetailsDiv.style.display = 'none';
    } else {
      deliveryBranchRadio.checked = false;
      deliverySiteRadio.checked = true;
      branchSelectionDiv.style.display = 'none';
      siteDeliveryDetailsDiv.style.display = 'block';
    }
  }


  function updatePaginationControls() {
    // Busca los spans y botones de paginación
    const currentPageSpan = document.getElementById('currentPageSpan');
    const totalPagesSpan = document.getElementById('totalPagesSpan');
    if (!currentPageSpan || !totalPagesSpan) return;
    currentPageSpan.textContent = (currentProductPage + 1).toString();
    totalPagesSpan.textContent = totalProductPages.toString();

    // Habilita/deshabilita los botones según la página
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    if (prevBtn) prevBtn.disabled = currentProductPage === 0;
    if (nextBtn) nextBtn.disabled = currentProductPage >= totalProductPages - 1;
  }
})()
