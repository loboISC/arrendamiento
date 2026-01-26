// Funcionalidad de edición para cotizaciones de venta
// Este archivo maneja la carga y edición de cotizaciones existentes

(function () {
  'use strict';

  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      try { if (t) clearTimeout(t); } catch (_) { }
      t = setTimeout(() => {
        try { fn.apply(this, args); } catch (_) { }
      }, wait);
    };
  }

  function runVentaEditRecalc(reason) {
    try {
      if (!window.modoEdicion) return;

      try {
        const st = ensureVentaStateStructure();
        const fromDOM = {
          nombre: document.getElementById('cr-contact-name')?.value?.trim() || undefined,
          name: document.getElementById('cr-contact-name')?.value?.trim() || undefined,
          email: document.getElementById('cr-contact-email')?.value?.trim() || undefined,
          telefono: document.getElementById('cr-contact-phone')?.value?.trim() || undefined,
          celular: document.getElementById('cr-contact-mobile')?.value?.trim() || undefined,
          empresa: document.getElementById('cr-contact-company')?.value?.trim() || undefined,
          cp: document.getElementById('cr-contact-zip')?.value?.trim() || undefined,
          estado: document.getElementById('cr-contact-state')?.value?.trim() || undefined,
          municipio: document.getElementById('cr-contact-municipio')?.value?.trim() || undefined
        };
        const idCliente = document.getElementById('v-extra')?.value || undefined;
        if (idCliente) fromDOM.id_cliente = idCliente;
        const normalized = Object.fromEntries(Object.entries(fromDOM).filter(([, v]) => v !== undefined && v !== ''));
        if (Object.keys(normalized).length) {
          window.selectedClient = { ...(window.selectedClient || {}), ...normalized };
          st.client = { ...(st.client || {}), ...normalized };
          st.cliente = { ...(st.cliente || {}), ...normalized };
        }
      } catch (_) { }

      const doCall = (name) => {
        try {
          const fn = window[name];
          if (typeof fn === 'function') fn();
        } catch (_) { }
      };
      doCall('renderCart');
      doCall('renderSummaryVenta');
      doCall('renderFocusedListVenta');
      doCall('renderAccessoriesSummary');
      doCall('recalcTotalVenta');
      doCall('updateGrandTotal');
      doCall('populateFinancialSummaryVenta');
      doCall('updateAllTotals');
      doCall('buildActiveQuoteSnapshotVenta');
    } catch (error) {
      console.warn('[runVentaEditRecalc] Error:', error);
    }
  }

  const scheduleVentaEditRecalc = debounce(() => runVentaEditRecalc('debounced'), 120);

  function waitForCatalogAndRecalc(maxWaitMs = 15000) {
    try {
      if (!window.modoEdicion) return;
      const start = Date.now();
      const timer = setInterval(() => {
        try {
          const st = window.state;
          const okProducts = Array.isArray(st?.products) && st.products.length > 0;
          const okAccessories = Array.isArray(st?.accessories) && st.accessories.length > 0;
          if (okProducts && okAccessories) {
            clearInterval(timer);
            // Actualizar pesos e imágenes de productos desde el catálogo de la API
            actualizarDatosDesdeCarrito(st);
            // Recargar accesorios de la cotización ahora que el catálogo está disponible
            recargarAccesoriosDeCotizacion();
            runVentaEditRecalc('catalog-ready');
            return;
          }
          if (Date.now() - start > maxWaitMs) {
            clearInterval(timer);
            runVentaEditRecalc('catalog-timeout');
          }
        } catch (_) { }
      }, 250);
    } catch (_) { }
  }

  // Función para actualizar pesos e imágenes desde el catálogo de la API
  function actualizarDatosDesdeCarrito(st) {
    try {
      if (!st.products) return;
      
      // Crear mapas de peso e imagen por SKU desde productos del catálogo (los que tienen datos reales)
      const datosPorSku = new Map();
      st.products.forEach(p => {
        if (p.sku) {
          const skuKey = String(p.sku).toLowerCase();
          const existing = datosPorSku.get(skuKey);
          // Solo guardar si tiene peso o imagen válidos, o si no existe entrada previa
          if (!existing || p.peso_kg > 0 || (p.image && p.image !== 'img/default.jpg')) {
            datosPorSku.set(skuKey, {
              peso_kg: p.peso_kg || existing?.peso_kg || 0,
              image: (p.image && p.image !== 'img/default.jpg') ? p.image : (existing?.image || 'img/default.jpg')
            });
          }
        }
      });
      
      // Actualizar productos sin peso o imagen
      st.products.forEach(p => {
        if (p.sku) {
          const datos = datosPorSku.get(String(p.sku).toLowerCase());
          if (datos) {
            if ((!p.peso_kg || p.peso_kg === 0) && datos.peso_kg > 0) {
              p.peso_kg = datos.peso_kg;
            }
            if ((!p.image || p.image === 'img/default.jpg') && datos.image && datos.image !== 'img/default.jpg') {
              p.image = datos.image;
            }
          }
        }
      });
      
      // También actualizar accesorios desde el catálogo de productos
      if (st.accessories) {
        st.accessories.forEach(a => {
          if (a.sku) {
            const datos = datosPorSku.get(String(a.sku).toLowerCase());
            if (datos) {
              if ((!a.peso_kg || a.peso_kg === 0) && datos.peso_kg > 0) {
                a.peso_kg = datos.peso_kg;
              }
              if ((!a.image || a.image === 'img/default.jpg') && datos.image && datos.image !== 'img/default.jpg') {
                a.image = datos.image;
              }
            }
          }
        });
      }
    } catch (_) { }
  }

  // Función para recargar accesorios de la cotización cuando el catálogo esté listo
  function recargarAccesoriosDeCotizacion() {
    try {
      const cotizacionData = sessionStorage.getItem('cotizacionParaEditar');
      if (!cotizacionData) return;
      
      const cotizacion = JSON.parse(cotizacionData);
      if (!cotizacion.accesorios_seleccionados) return;
      
      const accesorios = typeof cotizacion.accesorios_seleccionados === 'string'
        ? JSON.parse(cotizacion.accesorios_seleccionados)
        : cotizacion.accesorios_seleccionados;
      
      if (!Array.isArray(accesorios) || accesorios.length === 0) return;
      
      const st = window.state;
      if (!st) return;
      
      // Asegurar que existe el array de accesorios
      if (!st.accessories) st.accessories = [];
      
      // Limpiar selección actual
      st.accSelected = st.accSelected instanceof Set ? st.accSelected : new Set();
      st.accQty = st.accQty || {};
      
      
      accesorios.forEach(accesorio => {
        const accSku = accesorio.sku || '';
        const accId = accesorio.id_producto || accesorio.id || accSku;
        const cantidad = parseInt(accesorio.cantidad, 10) || 1;
        const subtotal = parseFloat(accesorio.subtotal || 0);
        const precioUnit = cantidad > 0 ? subtotal / cantidad : subtotal;
        
        // Buscar en catálogo existente
        let catalogEntry = st.accessories.find(a => {
          if (accSku && a.sku) {
            return String(a.sku).toLowerCase() === String(accSku).toLowerCase();
          }
          if (accId) {
            return String(a.id) === String(accId) || String(a.id_accesorio) === String(accId);
          }
          return false;
        });
        
        // Buscar imagen y peso en productos si no están en la cotización
        let imagenFinal = accesorio.imagen || accesorio.image || '';
        let pesoFinal = Number(accesorio.peso_kg || accesorio.peso || 0);
        
        if ((!imagenFinal || !pesoFinal) && st.products) {
          const prodMatch = st.products.find(p => 
            String(p.sku).toLowerCase() === String(accSku).toLowerCase() ||
            String(p.id) === String(accId)
          );
          if (prodMatch) {
            if (!imagenFinal) imagenFinal = prodMatch.image || prodMatch.imagen || '';
            if (!pesoFinal) pesoFinal = Number(prodMatch.peso_kg || prodMatch.peso || 0);
          }
        }
        
        // Si no existe en catálogo, agregarlo
        if (!catalogEntry) {
          catalogEntry = {
            id: accId,
            sku: accSku,
            name: accesorio.nombre || accesorio.descripcion || `Accesorio ${accSku}`,
            price: precioUnit,
            image: imagenFinal || 'img/default.jpg',
            stock: 999,
            subcat: 'accesorios',
            brand: '',
            desc: accesorio.descripcion || '',
            quality: '',
            peso_kg: pesoFinal
          };
          st.accessories.push(catalogEntry);
        }
        
        const key = typeof window.accKey === 'function' ? window.accKey(catalogEntry) : catalogEntry.id;
        st.accSelected.add(key);
        st.accQty[key] = cantidad;
      });
      
      
      // Actualizar UI
      if (typeof window.renderAccessoriesSummary === 'function') {
        window.renderAccessoriesSummary();
      }
      if (typeof window.updateAccessorySelectionStyles === 'function') {
        window.updateAccessorySelectionStyles();
      }
      if (typeof window.recalcTotalVenta === 'function') {
        window.recalcTotalVenta();
      }
    } catch (e) {
      console.error('[recargarAccesoriosDeCotizacion] Error:', e);
    }
  }

  function bindVentaEditRealtimeSync() {
    try {
      if (window.__ventaEditRealtimeBound) return;
      window.__ventaEditRealtimeBound = true;

      // Autocálculo de envío al editar KM / zona (el botón queda como opción manual)
      try {
        const kmEl = document.getElementById('cr-delivery-distance');
        const zoneEl = document.getElementById('cr-zone-type');
        const calcBtn = document.getElementById('calculate-shipping-cost-btn');
        const triggerShippingAuto = () => {
          try {
            if (!window.modoEdicion) return;
            const rbBranch = document.getElementById('delivery-branch-radio');
            if (rbBranch && rbBranch.checked) return;
            if (kmEl) {
              try { kmEl.dispatchEvent(new Event('input', { bubbles: true })); } catch {};
              try { kmEl.dispatchEvent(new Event('change', { bubbles: true })); } catch {};
            }
            runVentaEditRecalc('shipping:auto');
          } catch (_) { }
        };
        const debouncedTriggerShippingAuto = debounce(triggerShippingAuto, 250);

        if (kmEl && !kmEl.__ventaAutoShipBound) {
          kmEl.addEventListener('input', debouncedTriggerShippingAuto);
          kmEl.addEventListener('change', triggerShippingAuto);
          kmEl.__ventaAutoShipBound = true;
        }
        if (zoneEl && !zoneEl.__ventaAutoShipBound) {
          zoneEl.addEventListener('change', triggerShippingAuto);
          zoneEl.__ventaAutoShipBound = true;
        }
      } catch (_) { }

      const shouldSync = (el) => {
        try {
          if (!window.modoEdicion) return false;
          if (!el) return false;
          const id = (el.id || '').toLowerCase();
          const name = (el.name || '').toLowerCase();
          if (
            id.includes('cr-summary-discount') ||
            id.includes('cr-summary-apply-discount') ||
            id.includes('cr-summary-apply-iva') ||
            id.includes('cr-apply-iva') ||
            id.includes('cr-delivery') ||
            id.includes('delivery-') ||
            id.includes('cr-zone-type')
          ) return true;
          if (name.includes('cr-category')) return true;
          if (el.classList && (el.classList.contains('cr-qty-input') || el.classList.contains('cr-input'))) {
            return true;
          }
        } catch (_) { }
        return false;
      };

      document.addEventListener('input', (ev) => {
        const el = ev.target;
        if (shouldSync(el)) scheduleVentaEditRecalc();
      }, true);

      document.addEventListener('change', (ev) => {
        const el = ev.target;
        if (shouldSync(el)) scheduleVentaEditRecalc();
      }, true);

      document.addEventListener('click', (ev) => {
        const btn = ev.target && ev.target.closest ? ev.target.closest('button,[data-action]') : null;
        if (!btn) return;
        if (!window.modoEdicion) return;
        scheduleVentaEditRecalc();
      }, true);
    } catch (error) {
      console.warn('[bindVentaEditRealtimeSync] Error:', error);
    }
  }

  // Función para detectar modo edición desde URL y cargar datos frescos
  window.detectarModoEdicionVenta = async function () {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const editId = urlParams.get('edit');

      if (editId) {
        console.log('[detectarModoEdicionVenta] Modo edición detectado, ID:', editId);
        window.modoEdicion = true;
        window.cotizacionEditandoId = editId;

        let cotizacion = null;

        // 1. Intentar cargar desde sessionStorage para carga "instantánea"
        const cotizacionData = sessionStorage.getItem('cotizacionParaEditar');
        if (cotizacionData) {
          try {
            const tempCot = JSON.parse(cotizacionData);
            // Solo usar si el ID coincide con la URL
            if (String(tempCot.id_cotizacion || tempCot.id) === String(editId)) {
              cotizacion = tempCot;
              console.log('[detectarModoEdicionVenta] Usando datos temporales de sessionStorage');
            } else {
              console.log('[detectarModoEdicionVenta] Datos en sessionStorage pertenecen a otra cotización, ignorando.');
            }
          } catch (e) {
            console.error('[detectarModoEdicionVenta] Error parsing cotización data:', e);
          }
        }

        // 2. FORZAR descarga de datos frescos desde la API para evitar datos obsoletos (especialmente tras clonar)
        try {
          console.log('[detectarModoEdicionVenta] Descargando datos ACTUALIZADOS desde la API...');
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/cotizaciones/${editId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.ok) {
            const apiData = await response.json();
            console.log('[detectarModoEdicionVenta] Datos frescos recibidos:', apiData);

            // Combinar (API tiene prioridad)
            cotizacion = { ...(cotizacion || {}), ...apiData };

            // Sincronizar sessionStorage para futuras recargas
            sessionStorage.setItem('cotizacionParaEditar', JSON.stringify(cotizacion));
          } else {
            console.warn('[detectarModoEdicionVenta] No se pudo obtener la cotización de la API');
          }
        } catch (apiError) {
          console.error('[detectarModoEdicionVenta] Error al consultar la API:', apiError);
        }

        if (cotizacion) {
          // Cargar datos en el formulario
          setTimeout(() => {
            window.cargarDatosEnFormularioVenta(cotizacion);
            window.actualizarTituloEdicionVenta(cotizacion);
            try { bindVentaEditRealtimeSync(); } catch (_) { }
            try { runVentaEditRecalc('after-load'); } catch (_) { }
            try { waitForCatalogAndRecalc(); } catch (_) { }
          }, 500); // 500ms suele ser suficiente tras el fetch anterior
        } else {
          console.error('[detectarModoEdicionVenta] No se pudo obtener ninguna información de la cotización');
          // No alertar aquí para evitar ruido, pero la interfaz se verá vacía
        }
      } else {
        window.modoEdicion = false;
        window.cotizacionEditandoId = null;
      }
    } catch (error) {
      console.error('[detectarModoEdicionVenta] Error:', error);
    }
  };

  function ensureVentaStateStructure() {
    if (!window.state) {
      window.state = {
        products: [],
        cart: [],
        accessories: [],
        accSelected: new Set(),
        accQty: {},
        shippingInfo: null,
        selectedBranch: null
      };
      console.warn('[ensureVentaStateStructure] Se creó un estado mínimo para edición.');
    }

    const st = window.state;
    if (!(st.accSelected instanceof Set)) {
      st.accSelected = new Set(Array.isArray(st.accSelected) ? st.accSelected : []);
    }
    if (typeof st.accQty !== 'object' || st.accQty === null) {
      st.accQty = {};
    }
    if (!Array.isArray(st.cart)) st.cart = [];
    if (!Array.isArray(st.products)) st.products = [];
    if (!Array.isArray(st.accessories)) st.accessories = [];
    return st;
  }

  function syncShippingStateFromCotizacion(cotizacion) {
    try {
      const state = ensureVentaStateStructure();
      // Limpiamos el carrito para reconstruirlo a partir de la cotización
      state.cart = Array.isArray(state.cart) ? [] : [];
      // Limpiar carrito previo para evitar duplicados al reabrir la edición
      if (Array.isArray(state.cart)) {
        state.cart.length = 0;
      } else {
        state.cart = [];
      }

      const contact = {
        name: cotizacion.cliente_nombre || cotizacion.contacto_nombre || document.getElementById('cr-contact-name')?.value?.trim() || '',
        phone: cotizacion.cliente_telefono || cotizacion.contacto_telefono || document.getElementById('cr-contact-phone')?.value?.trim() || '',
        email: cotizacion.cliente_email || cotizacion.contacto_email || document.getElementById('cr-contact-email')?.value?.trim() || '',
        company: cotizacion.cliente_empresa || cotizacion.contacto_empresa || document.getElementById('cr-contact-company')?.value?.trim() || '',
        mobile: cotizacion.cliente_celular || cotizacion.contacto_celular || document.getElementById('cr-contact-mobile')?.value?.trim() || '',
        zip: cotizacion.cliente_cp || cotizacion.contacto_cp || document.getElementById('cr-contact-zip')?.value?.trim() || '',
        state: cotizacion.cliente_estado || cotizacion.contacto_estado || document.getElementById('cr-contact-state')?.value?.trim() || '',
        country: document.getElementById('cr-contact-country')?.value?.trim() || 'México'
      };

      const hasBranchInfo = Boolean((cotizacion.entrega_sucursal && cotizacion.entrega_sucursal.trim()) || (cotizacion.entrega_direccion && cotizacion.entrega_direccion.trim()));
      const hasHomeAddress = Boolean(cotizacion.entrega_calle || cotizacion.entrega_colonia || cotizacion.entrega_cp);

      let shippingInfo;
      if (hasBranchInfo && !hasHomeAddress) {
        shippingInfo = {
          method: 'branch',
          branch: {
            name: cotizacion.entrega_sucursal || '',
            address: cotizacion.entrega_direccion || '',
            city: cotizacion.entrega_ciudad || '',
            state: cotizacion.entrega_estado || '',
            zip: cotizacion.entrega_cp || ''
          },
          address: null,
          contact
        };
        state.selectedBranch = shippingInfo.branch;
      } else {
        shippingInfo = {
          method: 'home',
          branch: null,
          address: {
            street: cotizacion.entrega_calle || '',
            ext: cotizacion.entrega_numero_ext || '',
            int: cotizacion.entrega_numero_int || '',
            colony: cotizacion.entrega_colonia || '',
            zip: cotizacion.entrega_cp || '',
            city: cotizacion.entrega_municipio || '',
            state: cotizacion.entrega_estado || '',
            lote: cotizacion.entrega_lote || '',
            time: cotizacion.hora_entrega_solicitada || '',
            distance: cotizacion.entrega_kilometros || '',
            reference: cotizacion.entrega_referencia || ''
          },
          contact
        };
        state.selectedBranch = null;
      }

      state.shippingInfo = shippingInfo;

      // Rehidratar costo de envío desde la cotización (no desde KM)
      try {
        const costoRaw = (
          cotizacion?.costo_envio ??
          cotizacion?.costoEnvio ??
          cotizacion?.envio?.costo ??
          cotizacion?.shipping?.costo ??
          cotizacion?.shipping_cost ??
          cotizacion?.costo_de_envio ??
          null
        );
        const costo = (costoRaw == null || costoRaw === '') ? null : (Number(parseFloat(costoRaw)) || 0);
        if (costo != null) {
          const hiddenCostEl = document.getElementById('cr-delivery-cost');
          if (hiddenCostEl) hiddenCostEl.value = String(costo);
          const displayEl = document.getElementById('cr-delivery-cost-display');
          if (displayEl) {
            displayEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(costo);
          }
          // Mantener el estado sincronizado si la app lo usa
          try {
            state.deliveryExtra = costo;
          } catch (_) { }
          try {
            state.shippingInfo = state.shippingInfo || {};
            state.shippingInfo.deliveryCost = costo;
          } catch (_) { }
        }
      } catch (error) {
        console.warn('[syncShippingStateFromCotizacion] No se pudo rehidratar costo_envio:', error);
      }

      setTimeout(() => {
        try {
          if (typeof window.updateDeliverySummary === 'function') {
            window.updateDeliverySummary();
          }
          if (typeof window.showSummaryCards === 'function') {
            window.showSummaryCards();
          }
          if (typeof window.updateAllTotals === 'function') {
            window.updateAllTotals();
          }
          if (typeof window.updateGrandTotal === 'function') {
            window.updateGrandTotal();
          }
        } catch (error) {
          console.warn('[syncShippingStateFromCotizacion] Error al actualizar resumen de entrega:', error);
        }
      }, 150);
    } catch (error) {
      console.error('[syncShippingStateFromCotizacion] Error:', error);
    }
  }

  // Función para cargar datos de cotización en el formulario de venta
  window.cargarDatosEnFormularioVenta = function (cotizacion = {}) {
    try {
      console.log('[cargarDatosEnFormularioVenta] Cargando datos:', cotizacion);

      const setInputValue = (id, value) => {
        const element = document.getElementById(id);
        if (element && value !== null && value !== undefined) {
          element.value = value;
        }
      };

      const state = ensureVentaStateStructure();

      if (cotizacion.id_cliente) {
        const clientLabel = document.getElementById('v-client-label');
        const clientHidden = document.getElementById('v-extra');

        if (clientLabel) {
          clientLabel.textContent = cotizacion.cliente_nombre || cotizacion.contacto_nombre || 'Cliente';
        }
        if (clientHidden) {
          clientHidden.value = cotizacion.id_cliente;
        }

        const clientData = {
          id_cliente: cotizacion.id_cliente,
          nombre: cotizacion.cliente_nombre || cotizacion.contacto_nombre,
          email: cotizacion.cliente_email || cotizacion.contacto_email,
          telefono: cotizacion.cliente_telefono || cotizacion.contacto_telefono,
          empresa: cotizacion.cliente_empresa || cotizacion.contacto_empresa,
          tipo_cliente: cotizacion.tipo_cliente
        };
        localStorage.setItem('cr_selected_client', JSON.stringify(clientData));

        try {
          window.selectedClient = { ...(window.selectedClient || {}), ...clientData };
          state.client = { ...(state.client || {}), ...clientData };
          state.cliente = { ...(state.cliente || {}), ...clientData };
        } catch (_) { }
      }

      setInputValue('cr-contact-name', cotizacion.cliente_nombre || cotizacion.contacto_nombre);
      setInputValue('cr-contact-phone', cotizacion.cliente_telefono || cotizacion.contacto_telefono);
      setInputValue('cr-contact-email', cotizacion.cliente_email || cotizacion.contacto_email);
      setInputValue('cr-contact-attn', cotizacion.cliente_atencion || cotizacion.contacto_atencion);
      setInputValue('cr-contact-company', cotizacion.cliente_empresa || cotizacion.contacto_empresa);
      setInputValue('cr-contact-mobile', cotizacion.cliente_celular || cotizacion.contacto_celular);
      setInputValue('cr-contact-zip', cotizacion.cliente_cp || cotizacion.contacto_cp);
      setInputValue('cr-contact-country', cotizacion.cliente_pais || 'México');
      setInputValue('cr-contact-state', cotizacion.cliente_estado || cotizacion.contacto_estado);
      setInputValue('cr-contact-municipio', cotizacion.cliente_municipio || cotizacion.contacto_municipio);
      setInputValue('cr-contact-notes', cotizacion.cliente_descripcion || cotizacion.contacto_notas);



      // ===== Foliado Original ======
      // Cargar folio original en el input si existe
      if (cotizacion.numero_cotizacion || cotizacion.numero_folio) {
        const folio = cotizacion.numero_cotizacion || cotizacion.numero_folio;
        setInputValue('v-quote-number', folio);
        console.log('[cargarDatosEnFormularioVenta] Folio original cargado:', folio);

        // Si existe la función de carga específica, usarla también por seguridad
        if (typeof window.loadQuoteNumberInEditMode === 'function') {
          window.loadQuoteNumberInEditMode(folio);
        }
      }

      // ===== Detección de método de entrega y update de UI =====
      const deliveryBranchRadio = document.getElementById('delivery-branch-radio');
      const deliveryHomeRadio = document.getElementById('delivery-home-radio');
      const homeWrap = document.getElementById('cr-home-delivery-wrap');
      const homeCard = document.getElementById('cr-home-delivery-card'); // Nuevo ID
      const costCard = document.getElementById('cr-shipping-cost-card'); // Nuevo ID
      const branchCard = document.getElementById('cr-branch-card');
      const branchSelect = document.getElementById('cr-branch-select');
      const pickupDate = document.getElementById('cr-branch-pickup-date');
      const pickupTime = document.getElementById('cr-branch-pickup-time');

      // Determinar si es sucursal basado en datos
      const isSucursal = cotizacion.tipo_envio === 'sucursal' ||
        cotizacion.tipo_envio === 'recoleccion' ||
        (cotizacion.id_almacen || cotizacion.nombre_almacen) ||
        (cotizacion.fecha_entrega_solicitada && cotizacion.hora_entrega_solicitada && !cotizacion.entrega_calle);

      console.log('[cargarDatosEnFormularioVenta] Método de entrega detectado:', isSucursal ? 'SUCURSAL' : 'DOMICILIO');

      if (isSucursal && deliveryBranchRadio) {
        deliveryBranchRadio.checked = true;
        if (deliveryHomeRadio) deliveryHomeRadio.checked = false;

        // Mostrar UI Sucursal
        if (branchCard) {
          branchCard.style.display = 'block';
          branchCard.hidden = false;
        }
        // NO ocultar el wrapper completo porque contiene el resumen
        // Ocultar solo las tarjetas específicas de envío a domicilio
        if (homeWrap) {
          homeWrap.style.display = 'block'; // Asegurar que el contenedor principal sea visible
          homeWrap.hidden = false;
        }
        if (homeCard) homeCard.style.display = 'none';
        if (costCard) costCard.style.display = 'none';

        // Poblar selector de sucursales si es necesario
        if (branchSelect) {
          const populateAndSelect = async () => {
            try {
              console.log(`[populateAndSelect] Iniciando. ID objetivo: ${cotizacion.id_almacen}`);

              // 1. Asegurar que tenemos almacenes
              let warehouses = window.state?.warehouses;
              if (!warehouses || warehouses.length === 0) {
                console.log('[populateAndSelect] No hay almacenes en estado, intentando cargar...');
                if (typeof window.loadWarehousesFromAPI === 'function') {
                  warehouses = await window.loadWarehousesFromAPI();
                  if (window.state) window.state.warehouses = warehouses;
                } else {
                  console.error('[populateAndSelect] window.loadWarehousesFromAPI no está disponible');
                }
              }

              // 2. Poblar el select si tiene 1 o menos opciones
              if (branchSelect.options.length <= 1 && warehouses && warehouses.length > 0) {
                console.log(`[populateAndSelect] Poblando select con ${warehouses.length} almacenes.`);

                branchSelect.innerHTML = '<option value="">Selecciona una sucursal</option>';
                warehouses.forEach(w => {
                  const opt = document.createElement('option');
                  opt.value = w.id_almacen;
                  opt.textContent = `${w.nombre_almacen} — ${w.ubicacion || 'Dirección no disponible'}`;
                  // Add data attributes to match cotizacion_renta.js
                  opt.setAttribute('data-branch-id', w.id_almacen);
                  opt.setAttribute('data-branch-name', w.nombre_almacen);
                  opt.setAttribute('data-branch-address', w.ubicacion || '');

                  // Pre-seleccionar si coincide
                  if (cotizacion.id_almacen && String(w.id_almacen) === String(cotizacion.id_almacen)) {
                    opt.selected = true;
                  }
                  branchSelect.appendChild(opt);
                });
              }

              // 3. FORCE SELECTION LOOP
              // Intentar seleccionar múltiples veces para vencer condiciones de carrera
              const targetId = String(cotizacion.id_almacen);
              let attempts = 0;
              const maxAttempts = 5;

              const forceSelect = () => {
                if (!cotizacion.id_almacen) return;

                let found = false;
                Array.from(branchSelect.options).forEach((opt, idx) => {
                  if (String(opt.value) === targetId) {
                    // Forzar si no está seleccionado visualmente
                    if (!opt.selected || branchSelect.selectedIndex !== idx || branchSelect.value !== targetId) {
                      console.log(`[forceSelect] Corrigiendo selección (Intento ${attempts + 1}): ${targetId}`);
                      opt.selected = true;
                      branchSelect.value = targetId; // Also set value explicitly
                      branchSelect.selectedIndex = idx;
                      // Trigger change para UI externa
                      branchSelect.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    found = true;
                  } else {
                    opt.selected = false;
                  }
                });

                // Validar visualmente
                const branchNameDisplay = document.getElementById('cr-branch-name');
                const branchSummary = document.getElementById('cr-branch-summary');
                if (found && branchSelect.selectedIndex > 0) {
                  const txt = branchSelect.options[branchSelect.selectedIndex].text;
                  // Actualizar solo si hay diferencia
                  if (branchNameDisplay && branchNameDisplay.textContent !== txt) {
                    console.log('[forceSelect] Actualizando UI de resumen visual');
                    branchNameDisplay.textContent = txt;
                    if (branchSummary) branchSummary.hidden = false;
                  }
                }

                attempts++;
                if (attempts < maxAttempts) {
                  setTimeout(forceSelect, 500); // Reintentar cada 500ms
                }
              };

              forceSelect();

            } catch (error) {
              console.error('[populateAndSelect] Error:', error);
            }
          };

          populateAndSelect();
          // Reintento para condiciones de carrera
          setTimeout(populateAndSelect, 1500);
        }

        // Llenar fechas de recogida
        if (cotizacion.fecha_entrega_solicitada) {
          const fecha = cotizacion.fecha_entrega_solicitada.split('T')[0];
          if (pickupDate) pickupDate.value = fecha;
        }
        if (cotizacion.hora_entrega_solicitada && pickupTime) {
          pickupTime.value = cotizacion.hora_entrega_solicitada;
        }

      } else if (deliveryHomeRadio) {
        deliveryHomeRadio.checked = true;
        if (deliveryBranchRadio) deliveryBranchRadio.checked = false;

        // Mostrar UI Domicilio
        if (homeWrap) {
          homeWrap.style.display = 'block';
          homeWrap.hidden = false;
        }
        if (homeCard) homeCard.style.display = 'block'; // Restaurar visibilidad
        if (costCard) costCard.style.display = 'block'; // Restaurar visibilidad

        if (branchCard) {
          branchCard.style.display = 'none';
          branchCard.hidden = true;
        }
      }

      // Asegurar que el resumen de cotización se actualice con accesorios
      setTimeout(() => {
        if (typeof window.populateQuoteSummaryVenta === 'function') {
          console.log('[cargarDatosEnFormularioVenta] Forzando actualización de resumen para incluir accesorios...');
          window.populateQuoteSummaryVenta();
          window.populateFinancialSummaryVenta?.();
        }
      }, 1500); // Dar tiempo a que carguen los accesorios (que tienen su propio timeout)

      setInputValue('cr-delivery-street', cotizacion.entrega_calle);
      setInputValue('cr-delivery-ext', cotizacion.entrega_numero_ext);
      setInputValue('cr-delivery-int', cotizacion.entrega_numero_int);
      setInputValue('cr-delivery-colony', cotizacion.entrega_colonia);
      setInputValue('cr-delivery-city', cotizacion.entrega_municipio);
      setInputValue('cr-delivery-state', cotizacion.entrega_estado);
      setInputValue('cr-delivery-zip', cotizacion.entrega_cp);
      setInputValue('cr-delivery-lote', cotizacion.entrega_lote);

      // La fecha "cr-delivery-date" es generalmente para Envío a Domicilio, 
      // pero si es sucursal ya llenamos el pickupDate arriba.
      // Aún así, llenamos los campos generales por si el usuario cambia de opinión.
      if (cotizacion.fecha_entrega_solicitada) {
        const fechaEntrega = cotizacion.fecha_entrega_solicitada.split('T')[0];
        setInputValue('cr-delivery-date', fechaEntrega);
      }
      setInputValue('cr-delivery-time', cotizacion.hora_entrega_solicitada);
      setInputValue('cr-delivery-reference', cotizacion.entrega_referencia);
      setInputValue('cr-delivery-distance', cotizacion.entrega_kilometros);

      syncShippingStateFromCotizacion(cotizacion);

      try {
        let productos = [];
        const parseProductos = (raw) => {
          if (!raw) return [];
          if (Array.isArray(raw)) return raw;
          if (typeof raw === 'string' && raw.trim().length) {
            try {
              return JSON.parse(raw);
            } catch (parseError) {
              console.error('[cargarDatosEnFormularioVenta] Error parseando productos:', parseError);
            }
          }
          return [];
        };

        productos = parseProductos(cotizacion.productos);

        if (!productos.length) {
          productos = parseProductos(cotizacion.productos_seleccionados);
        }

        productos.forEach(producto => {
          const productId = producto.id_producto || producto.id;
          const cantidad = parseInt(producto.cantidad, 10) || 1;

          const existingProduct = state.products.find(p => String(p.id) === String(productId));
          const warehouseId = producto.id_almacen || cotizacion.id_almacen || null;
          const warehouseName = producto.nombre_almacen || producto.almacen || cotizacion.almacen_nombre || cotizacion.nombre_almacen || state.selectedWarehouse?.nombre_almacen || null;
          const warehouseLocation = producto.ubicacion || producto.ubicacion_almacen || cotizacion.ubicacion_almacen || null;

          if (!existingProduct) {
            // Calcular precio unitario: usar precio_unitario si existe, sino calcular desde subtotal/cantidad
            let priceValue = parseFloat(producto.precio_unitario) || 0;
            if (!priceValue && producto.subtotal && cantidad > 0) {
              priceValue = parseFloat(producto.subtotal) / cantidad;
            }
            // Fallback a precio_venta o precio
            if (!priceValue) {
              priceValue = parseFloat(producto.precio_venta || producto.precio || 0);
            }
            state.products.push({
              id: productId,
              name: producto.nombre,
              nombre: producto.nombre,
              sku: producto.sku,
              id_almacen: warehouseId,
              nombre_almacen: warehouseName,
              almacen: warehouseName,
              ubicacion_almacen: warehouseLocation,
              price: {
                diario: priceValue,
                venta: priceValue
              },
              precio: priceValue,
              precio_venta: priceValue,
              image: producto.imagen || producto.image || 'img/default.jpg',
              stock: producto.stock != null ? Number(producto.stock) : 999,
              peso_kg: Number(producto.peso_kg ?? producto.peso ?? 0) || 0
            });
          } else {
            if (!existingProduct.nombre_almacen && warehouseName) {
              existingProduct.nombre_almacen = warehouseName;
            }
            if (!existingProduct.almacen && warehouseName) {
              existingProduct.almacen = warehouseName;
            }
            if (!existingProduct.id_almacen && warehouseId) {
              existingProduct.id_almacen = warehouseId;
            }
            if (!existingProduct.ubicacion_almacen && warehouseLocation) {
              existingProduct.ubicacion_almacen = warehouseLocation;
            }
          }

          const cartItem = state.cart.find(ci => String(ci.id) === String(productId));
          if (cartItem) {
            cartItem.qty += cantidad;
          } else {
            state.cart.push({ id: productId, qty: cantidad });
          }
        });


        if (typeof window.renderCart === 'function') window.renderCart();
        if (typeof window.renderSummaryVenta === 'function') window.renderSummaryVenta();
        if (typeof window.renderFocusedListVenta === 'function') window.renderFocusedListVenta();
        if (typeof window.recalcTotalVenta === 'function') window.recalcTotalVenta();

        const count = state.cart.reduce((acc, item) => acc + (item.qty || 0), 0);
        const cntEl = document.getElementById('cr-cart-count');
        if (cntEl) cntEl.textContent = String(count);
        const wrap = document.getElementById('cr-cart-count-wrap');
        if (wrap) wrap.classList.toggle('is-empty', count === 0);
      } catch (productError) {
        console.error('[cargarDatosEnFormularioVenta] Error cargando productos:', productError);
      }

      if (cotizacion.accesorios_seleccionados) {
        const cargarAccesorios = (intentos = 0, maxIntentos = 10) => {
          try {
            const accesorios = typeof cotizacion.accesorios_seleccionados === 'string'
              ? JSON.parse(cotizacion.accesorios_seleccionados)
              : cotizacion.accesorios_seleccionados;


            if (!Array.isArray(accesorios) || accesorios.length === 0) {
              return;
            }

            const stateRef = ensureVentaStateStructure();


            // Si no hay catálogo de accesorios, crearlo desde los datos de la cotización
            if (!stateRef.accessories || stateRef.accessories.length === 0) {
              stateRef.accessories = [];
            }

            stateRef.accSelected = new Set();
            stateRef.accQty = {};

            accesorios.forEach(accesorio => {
              const accSku = accesorio.sku || '';
              const accId = accesorio.id_producto || accesorio.id || accSku;
              const cantidad = parseInt(accesorio.cantidad, 10) || 1;
              const subtotal = parseFloat(accesorio.subtotal || 0);
              const precioUnit = cantidad > 0 ? subtotal / cantidad : subtotal;

              // Buscar en catálogo existente
              let catalogEntry = stateRef.accessories.find(a => {
                if (accSku && a.sku) {
                  return String(a.sku).toLowerCase() === String(accSku).toLowerCase();
                }
                if (accId) {
                  return String(a.id) === String(accId) || String(a.id_accesorio) === String(accId);
                }
                return false;
              });

              // Si no existe en catálogo, agregarlo con datos de la cotización
              // Usar imagen y peso de la cotización si existen, sino buscar en productos del state
              let imagenFinal = accesorio.imagen || accesorio.image || '';
              let pesoFinal = Number(accesorio.peso_kg || accesorio.peso || 0);
              
              // Si no hay imagen/peso, buscar en state.products por SKU
              if ((!imagenFinal || !pesoFinal) && window.state?.products) {
                const prodMatch = window.state.products.find(p => 
                  String(p.sku).toLowerCase() === String(accSku).toLowerCase() ||
                  String(p.id) === String(accId)
                );
                if (prodMatch) {
                  if (!imagenFinal) imagenFinal = prodMatch.image || prodMatch.imagen || '';
                  if (!pesoFinal) pesoFinal = Number(prodMatch.peso_kg || prodMatch.peso || 0);
                }
              }
              
              if (!catalogEntry) {
                catalogEntry = {
                  id: accId,
                  sku: accSku,
                  name: accesorio.nombre || accesorio.descripcion || `Accesorio ${accSku}`,
                  price: precioUnit,
                  image: imagenFinal || 'img/default.jpg',
                  stock: 999,
                  subcat: 'accesorios',
                  brand: '',
                  desc: accesorio.descripcion || '',
                  quality: '',
                  peso_kg: pesoFinal
                };
                stateRef.accessories.push(catalogEntry);
              }

              const key = typeof window.accKey === 'function' ? window.accKey(catalogEntry) : catalogEntry.id;
              stateRef.accSelected.add(key);
              stateRef.accQty[key] = cantidad;
            });


            if (typeof window.renderAccessoriesSummary === 'function') {
              setTimeout(() => {
                window.renderAccessoriesSummary();
                window.updateAccessorySelectionStyles?.();
                window.recalcTotalVenta?.();
              }, 300);
            }
          } catch (accessoryError) {
            console.error('[cargarDatosEnFormularioVenta] Error cargando accesorios:', accessoryError);
          }
        };

        cargarAccesorios();
      }

      setInputValue('cr-start-date', cotizacion.fecha_inicio?.split('T')[0]);
      setInputValue('cr-end-date', cotizacion.fecha_fin?.split('T')[0]);


      setInputValue('cr-observations', cotizacion.notas);
      setInputValue('cr-summary-conditions', cotizacion.condiciones);

      console.log('[cargarDatosEnFormularioVenta] Datos cargados exitosamente');
    } catch (error) {
      console.error('[cargarDatosEnFormularioVenta] Error:', error);
    }
  };

  // Función para actualizar el título en modo edición
  window.actualizarTituloEdicionVenta = function (cotizacion) {
    try {
      // 1. Cambiar el título principal
      const titulo = document.querySelector('.cr-title');
      if (titulo) {
        titulo.innerHTML = `<i class="fa-solid fa-edit"></i> Editando Cotización: ${cotizacion.numero_cotizacion}`;
        titulo.style.color = '#f39c12'; // Color naranja para indicar edición
        console.log('[actualizarTituloEdicionVenta] Título actualizado');
      }

      // 2. Cambiar el botón "Generar Cotización" por "Actualizar Cotización"
      const btnGenerar = document.querySelector('button[onclick="completeShippingStep()"]');
      if (btnGenerar) {
        btnGenerar.innerHTML = `
          <i class="fa-solid fa-sync-alt"></i>
          <span>Actualizar Cotización</span>
          <i class="fa-solid fa-arrow-right cr-btn-arrow"></i>
        `;

        // Cambiar el onclick para que llame a la función de actualización
        btnGenerar.removeAttribute('onclick');
        btnGenerar.addEventListener('click', async function (e) {
          e.preventDefault();
          console.log('[Botón Actualizar] Click detectado');

          if (window.actualizarCotizacionVenta) {
            try {
              await window.actualizarCotizacionVenta();
            } catch (error) {
              console.error('[Botón Actualizar] Error:', error);
            }
          } else {
            console.error('[Botón Actualizar] Función actualizarCotizacionVenta no disponible');
            alert('Error: Función de actualización no disponible');
          }
        });

        // Cambiar color del botón para indicar edición
        btnGenerar.style.background = 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)';

        console.log('[actualizarTituloEdicionVenta] Botón actualizado');
      }

      // 3. Cambiar texto del botón de guardar en el menú lateral (si existe)
      const btnGuardar = document.querySelector('[data-action="guardar"]');
      if (btnGuardar) {
        btnGuardar.innerHTML = '<i class="fa-solid fa-save"></i> Actualizar Cotización';
      }

      // 4. Agregar badge de "MODO EDICIÓN" visible
      const header = document.querySelector('.cr-header');
      if (header && !document.getElementById('modo-edicion-badge')) {
        const badge = document.createElement('div');
        badge.id = 'modo-edicion-badge';
        badge.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #f39c12;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 14px;
          z-index: 9999;
          box-shadow: 0 4px 12px rgba(243, 156, 18, 0.4);
          animation: pulse 2s infinite;
        `;
        badge.innerHTML = `<i class="fa-solid fa-edit"></i> MODO EDICIÓN: ${cotizacion.numero_cotizacion}`;
        document.body.appendChild(badge);

        // Agregar animación de pulso
        if (!document.getElementById('pulse-animation-style')) {
          const style = document.createElement('style');
          style.id = 'pulse-animation-style';
          style.textContent = `
            @keyframes pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.05); }
            }
          `;
          document.head.appendChild(style);
        }
      }

    } catch (error) {
      console.error('[actualizarTituloEdicionVenta] Error:', error);
    }
  };

  // Función para actualizar cotización existente
  window.actualizarCotizacionVenta = async function () {
    try {
      if (!window.cotizacionEditandoId) {
        throw new Error('No hay cotización en edición');
      }

      console.log('[actualizarCotizacionVenta] Actualizando cotización ID:', window.cotizacionEditandoId);

      // Recopilar datos actuales
      const quotationData = window.collectQuotationData();
      if (!quotationData) {
        throw new Error('No se pudieron recopilar los datos de la cotización');
      }

      // Agregar ID de cotización y cambiar estado a Aprobada
      quotationData.id_cotizacion = window.cotizacionEditandoId;
      quotationData.estado = 'Actualizado';

      // Enviar actualización al backend
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/cotizaciones/${window.cotizacionEditandoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(quotationData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al actualizar la cotización');
      }

      const result = await response.json();
      console.log('[actualizarCotizacionVenta] Cotización actualizada:', result);

      // Mostrar notificación de éxito
      if (window.showNotification) {
        window.showNotification(`✅ Cotización ${result.numero_cotizacion} actualizada exitosamente`, 'success');
      } else {
        alert(`Cotización ${result.numero_cotizacion} actualizada exitosamente`);
      }

      return result;

    } catch (error) {
      console.error('[actualizarCotizacionVenta] Error:', error);
      if (window.showNotification) {
        window.showNotification('Error al actualizar la cotización: ' + error.message, 'error');
      } else {
        alert('Error al actualizar la cotización: ' + error.message);
      }
      throw error;
    }
  };

  // Inicializar al cargar la página
  document.addEventListener('DOMContentLoaded', function () {
    console.log('[cotizacion_venta_edicion.js] Inicializando...');
    detectarModoEdicionVenta();
  });

})();
