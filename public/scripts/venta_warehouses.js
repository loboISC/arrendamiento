/* Funcionalidad de Almacenes para Cotización de Venta
   Adaptado desde cotizacion_renta.js */

// --- Warehouse Management for Venta ---
async function loadWarehousesFromAPI() {
  try {
    // Extraer almacenes únicos de los productos ya cargados
    if (window.state && window.state.products && window.state.products.length > 0) {
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
      
      const warehouses = Array.from(uniqueWarehouses.values());
      if (warehouses.length > 0) {
        console.log('[loadWarehousesFromAPI] Extracted warehouses from products:', warehouses);
        return warehouses;
      }
    }
    
    // Si no hay productos cargados o no tienen datos de almacén, usar fallback
    console.warn('[loadWarehousesFromAPI] No warehouse data in products, using fallback');
    return [
      { id_almacen: 1, nombre_almacen: 'BODEGA 68 CDMX', ubicacion: 'CDMX' },
      { id_almacen: 2, nombre_almacen: 'TEXCOCO', ubicacion: 'Estado de México' },
      { id_almacen: 3, nombre_almacen: 'MEXICALI', ubicacion: 'Baja California' }
    ];
  } catch (error) {
    console.error('[loadWarehousesFromAPI] Error loading warehouses:', error);
    // Fallback data
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

  // Set default current location
  currentLocationContainer.innerHTML = `
    <div class="cr-location-chip">
      <i class="fa-solid fa-location-dot"></i>
      <span>Selecciona un almacén</span>
    </div>
  `;

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

  console.log('[renderWarehouseList] Warehouses rendered, showing all products initially');
}

function selectWarehouse(warehouse) {
  if (!warehouse) return;
  
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
  // Update selected warehouse in state
  if (!warehouseId) {
    if (window.state) {
      window.state.selectedWarehouse = null;
    }
  } else {
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
