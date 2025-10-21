/* Funcionalidad de Almacenes para Cotización de Venta
   Utiliza el endpoint dedicado de almacenes */

// --- Warehouse Management for Venta ---
async function loadWarehousesFromAPI() {
  try {
    console.log('[loadWarehousesFromAPI] Cargando almacenes...');
    
    // Usar la configuración centralizada de la API con la ruta correcta
    const warehouses = await window.API_CONFIG.get('productos/almacenes');
    
    if (warehouses && warehouses.length > 0) {
      console.log('[loadWarehousesFromAPI] Almacenes cargados correctamente:', warehouses);
      console.log('[loadWarehousesFromAPI] Ruta utilizada:', window.API_CONFIG.getApiUrl('productos/almacenes'));
      return warehouses.map(warehouse => {
        console.log('Datos del almacén crudos:', warehouse);
        // Debug: Mostrar todas las propiedades del almacén
        console.log('Todas las propiedades del almacén:', Object.keys(warehouse));
        
        // Obtener la ubicación de diferentes posibles propiedades
        const ubicacion = warehouse.ubicacion || 
                         warehouse.ciudad || 
                         warehouse.nombre_ciudad ||
                         (warehouse.direccion ? `Ubicación: ${warehouse.direccion}`.substring(0, 30) : null) ||
                         'Sin ubicación';
        
        return {
          id_almacen: warehouse.id_almacen,
          nombre_almacen: warehouse.nombre_almacen || 'Almacén sin nombre',
          ubicacion: ubicacion,
          direccion: warehouse.direccion || 'Dirección no disponible',
          telefono: warehouse.telefono || 'Sin teléfono',
          activo: warehouse.activo ?? 1
        };
      });
    }
    
    console.warn('[loadWarehousesFromAPI] No se encontraron almacenes en la API');
    
    // Intentar extraer de productos como fallback
    if (window.state?.products?.length > 0) {
      console.log('[loadWarehousesFromAPI] Intentando extraer almacenes de productos...');
      const uniqueWarehouses = new Map();
      
      window.state.products.forEach(product => {
        if (product.id_almacen && product.nombre_almacen) {
          uniqueWarehouses.set(product.id_almacen, {
            id_almacen: product.id_almacen,
            nombre_almacen: product.nombre_almacen,
            ubicacion: product.ubicacion || 'Sin ubicación'
          });
        }
      });
      
      const warehousesFromProducts = Array.from(uniqueWarehouses.values());
      if (warehousesFromProducts.length > 0) {
        console.log('[loadWarehousesFromAPI] Almacenes extraídos de productos:', warehousesFromProducts);
        return warehousesFromProducts;
      }
    }
    
    // Si todo falla, usar datos de respaldo
    console.warn('[loadWarehousesFromAPI] Usando datos de respaldo para almacenes');
    return [
      { id_almacen: 1, nombre_almacen: 'BODEGA 68 CDMX', ubicacion: 'CDMX' },
      { id_almacen: 2, nombre_almacen: 'TEXCOCO', ubicacion: 'Estado de México' },
      { id_almacen: 3, nombre_almacen: 'MEXICALI', ubicacion: 'Baja California' }
    ];
    
  } catch (error) {
    console.error('[loadWarehousesFromAPI] Error al cargar almacenes:', error);
    
    // Intentar extraer de productos como último recurso
    if (window.state?.products?.length > 0) {
      console.warn('[loadWarehousesFromAPI] Intentando extraer almacenes de productos después de error...');
      const uniqueWarehouses = new Map();
      
      window.state.products.forEach(product => {
        if (product.id_almacen && product.nombre_almacen) {
          uniqueWarehouses.set(product.id_almacen, {
            id_almacen: product.id_almacen,
            nombre_almacen: product.nombre_almacen,
            ubicacion: product.ubicacion || 'Sin ubicación'
          });
        }
      });
      
      const warehousesFromProducts = Array.from(uniqueWarehouses.values());
      if (warehousesFromProducts.length > 0) {
        return warehousesFromProducts;
      }
    }
    
    // Si todo falla, devolver datos de respaldo
    return [
      { id_almacen: 1, nombre_almacen: 'BODEGA 68 CDMX', ubicacion: 'CDMX' },
      { id_almacen: 2, nombre_almacen: 'TEXCOCO', ubicacion: 'Estado de México' },
      { id_almacen: 3, nombre_almacen: 'MEXICALI', ubicacion: 'Baja California' }
    ];
  }
}

function renderWarehouseList(warehouses) {
  const popularContainer = document.querySelector('.cr-popular');
  const currentLocationContainer = document.querySelector('.cr-location-current');
  
  if (!popularContainer || !currentLocationContainer) {
    console.warn('[renderWarehouseList] Required containers not found');
    return;
  }

  // Clear existing content
  popularContainer.innerHTML = '';
  currentLocationContainer.innerHTML = '';

  // Add 'TODOS' option
  const allChip = document.createElement('div');
  allChip.className = 'cr-chip cr-chip--warehouse cr-chip--selected';
  allChip.setAttribute('data-warehouse-id', 'all');
  allChip.innerHTML = `
    <i class="fa-solid fa-warehouse"></i>
    <div class="cr-chip__content">
      <div class="cr-chip__title">TODOS LOS ALMACENES</div>
      <div class="cr-chip__subtitle">Ver todos los productos</div>
    </div>
  `;
  
  allChip.addEventListener('click', () => {
    selectAllWarehouses();
  });
  
  popularContainer.appendChild(allChip);

  // Render warehouse chips
  warehouses.forEach(warehouse => {
    const chip = document.createElement('div');
    chip.className = 'cr-chip cr-chip--warehouse';
    chip.setAttribute('data-warehouse-id', warehouse.id_almacen);
    chip.innerHTML = `
      <i class="fa-solid fa-warehouse"></i>
      <div class="cr-chip__content">
        <div class="cr-chip__title">${warehouse.nombre_almacen}</div>
        <div class="cr-chip__subtitle">${warehouse.ubicacion || 'Sin ubicación'}</div>
      </div>
    `;
    
    chip.addEventListener('click', () => {
      selectWarehouse(warehouse);
    });
    
    popularContainer.appendChild(chip);
  });

  // Set default selection to 'TODOS'
  selectAllWarehouses();
  
  console.log('[renderWarehouseList] Warehouses rendered with TODOS as default');
}

// New function to handle 'TODOS' selection
function selectAllWarehouses() {
  // Update UI
  document.querySelectorAll('.cr-chip--warehouse').forEach(chip => {
    chip.classList.remove('cr-chip--selected');
  });
  
  const allChip = document.querySelector('[data-warehouse-id="all"]');
  if (allChip) {
    allChip.classList.add('cr-chip--selected');
  }
  
  // Update current location display
  const currentLocationContainer = document.querySelector('.cr-location-current');
  if (currentLocationContainer) {
    currentLocationContainer.innerHTML = `
      <div class="cr-location-chip cr-location-chip--selected">
        <i class="fa-solid fa-warehouse"></i>
        <span>TODOS LOS ALMACENES</span>
        <small>Mostrando todos los productos</small>
      </div>
    `;
  }
  
  // Clear warehouse filter to show all products
  if (window.state) {
    window.state.selectedWarehouse = null;
  }
  
  // Apply filters (which will show all products since selectedWarehouse is null)
  if (window.filterProducts) {
    window.filterProducts();
  }
  
  console.log('[selectAllWarehouses] Showing products from all warehouses');
}

function selectWarehouse(warehouse) {
  if (!warehouse) return;
  
  // If 'TODOS' was clicked, handle it with the dedicated function
  if (warehouse === 'all' || warehouse.id_almacen === 'all') {
    selectAllWarehouses();
    return;
  }
  
  // Update state
  if (window.state) {
    window.state.selectedWarehouse = warehouse;
  }
  
  // Update UI - highlight selected warehouse
  document.querySelectorAll('.cr-chip--warehouse').forEach(chip => {
    chip.classList.remove('cr-chip--selected');
  });
  
  const selectedChip = document.querySelector(`[data-warehouse-id="${warehouse.id_almacen}"]`);
  if (selectedChip) {
    selectedChip.classList.add('cr-chip--selected');
  }
  
  // Update current location display
  const currentLocationContainer = document.querySelector('.cr-location-current');
  if (currentLocationContainer) {
    currentLocationContainer.innerHTML = `
      <div class="cr-location-chip cr-location-chip--selected">
        <i class="fa-solid fa-warehouse"></i>
        <span>${warehouse.nombre_almacen}</span>
        <small>${warehouse.ubicacion || ''}</small>
      </div>
    `;
  }
  
  // Filter products by warehouse
  filterProductsByWarehouse(warehouse.id_almacen);
  
  console.log('[selectWarehouse] Selected warehouse:', warehouse);
}

function filterProductsByWarehouse(warehouseId) {
  // If warehouseId is 'all' or not provided, clear the warehouse filter
  if (!warehouseId || warehouseId === 'all') {
    if (window.state) {
      window.state.selectedWarehouse = null;
    }
  } else {
    // Find the warehouse in the list or create a minimal representation
    const warehouse = window.state?.warehouses?.find(w => w.id_almacen === warehouseId);
    if (window.state) {
      window.state.selectedWarehouse = warehouse || { id_almacen: warehouseId };
    }
  }
  
  // Use existing filterProducts function to apply all filters including warehouse
  if (window.filterProducts) {
    window.filterProducts();
  } else {
    console.warn('[filterProductsByWarehouse] filterProducts function not found');
  }
}

// Function to initialize warehouses for venta
async function initializeWarehousesVenta() {
  try {
    const warehouses = await loadWarehousesFromAPI();
    if (window.state) {
      window.state.warehouses = warehouses;
    }
    renderWarehouseList(warehouses);
    try {
      document.dispatchEvent(new CustomEvent('warehouses:ready', { detail: { warehouses } }));
      console.log('[initializeWarehousesVenta] warehouses:ready dispatched with', warehouses.length, 'items');
    } catch (e) { console.warn('[initializeWarehousesVenta] dispatch event failed', e); }
  } catch (error) {
    console.error('[initializeWarehousesVenta] Error loading warehouses:', error);
  }
}

// Export functions for global access
window.loadWarehousesFromAPI = loadWarehousesFromAPI;
window.renderWarehouseList = renderWarehouseList;
window.selectWarehouse = selectWarehouse;
window.filterProductsByWarehouse = filterProductsByWarehouse;
window.initializeWarehousesVenta = initializeWarehousesVenta;
