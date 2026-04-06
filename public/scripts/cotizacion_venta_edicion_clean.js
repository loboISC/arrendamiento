/**
 * EDICIÓN DE COTIZACIONES - MÓDULO DE VENTA
 * Carga y edición de cotizaciones existentes desde URL ?edit=id
 */

(function () {
  'use strict';

  // ============================================================================
  // CONFIGURACIÓN
  // ============================================================================

  const CONFIG = {
    API_BASE: '/api',
    DEBOUNCE_MS: 120,
    CATALOG_WAIT_MS: 15000,
    LOAD_DELAY_MS: 500
  };

  const DOM_IDS = {
    contactName: 'cr-contact-name',
    contactEmail: 'cr-contact-email',
    contactPhone: 'cr-contact-phone',
    contactMobile: 'cr-contact-mobile',
    contactCompany: 'cr-contact-company',
    contactZip: 'cr-contact-zip',
    contactState: 'cr-contact-state',
    contactMunicipio: 'cr-contact-municipio',
    extraClientId: 'v-extra',
    deliveryBranchRadio: 'delivery-branch-radio',
    deliveryHomeRadio: 'delivery-home-radio',
    branchCard: 'cr-branch-card',
    homeWrap: 'cr-home-delivery-wrap',
    branchSelect: 'cr-branch-select',
    branchPickupDate: 'cr-branch-pickup-date',
    branchPickupTime: 'cr-branch-pickup-time',
    deliveryStreet: 'cr-delivery-street',
    deliveryExt: 'cr-delivery-ext',
    deliveryInt: 'cr-delivery-int',
    deliveryColony: 'cr-delivery-colony',
    deliveryCity: 'cr-delivery-city',
    deliveryState: 'cr-delivery-state',
    deliveryZip: 'cr-delivery-zip',
    deliveryLote: 'cr-delivery-lote',
    deliveryDate: 'cr-delivery-date',
    deliveryContact: 'cr-delivery-contact',
    deliveryPhone: 'cr-delivery-phone',
    deliveryDistance: 'cr-delivery-distance',
    deliveryZone: 'cr-zone-type',
    deliveryCost: 'cr-delivery-cost',
    deliveryCostDisplay: 'cr-delivery-cost-display',
    quoteNumber: 'v-quote-number',
    quoteDate: 'v-quote-date',
    cartCount: 'cr-cart-count',
    cartCountWrap: 'cr-cart-count-wrap'
  };

  // ============================================================================
  // UTILIDADES
  // ============================================================================

  /**
   * Debounce para funciones
   */
  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      try { if (t) clearTimeout(t); } catch (_) { }
      t = setTimeout(() => {
        try { fn.apply(this, args); } catch (_) { }
      }, wait);
    };
  }

  /**
   * Obtiene elemento por ID
   */
  function getElement(id) {
    return document.getElementById(id);
  }

  /**
   * Establece valor de input
   */
  function setInputValue(id, value) {
    const el = getElement(id);
    if (el && value !== null && value !== undefined) {
      el.value = value;
    }
  }

  /**
   * Asegura estructura de estado
   */
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
    }

    const st = window.state;
    if (!(st.accSelected instanceof Set)) {
      st.accSelected = new Set(Array.isArray(st.accSelected) ? st.accSelected : []);
    }
    if (typeof st.accQty !== 'object'  || st.accQty === null) {
      st.accQty = {};
    }
    if (!Array.isArray(st.cart)) st.cart = [];
    if (!Array.isArray(st.products)) st.products = [];
    if (!Array.isArray(st.accessories)) st.accessories = [];

    return st;
  }

  // ============================================================================
  // RECALCULAR CAMBIOS
  // ============================================================================

  /**
   * Ejecuta recálculo en modo edición
   */
  function runVentaEditRecalc(reason = 'manual') {
    try {
      if (!window.modoEdicion) return;

      const st = ensureVentaStateStructure();
      const fromDOM = {
        nombre: getElement(DOM_IDS.contactName)?.value?.trim(),
        name: getElement(DOM_IDS.contactName)?.value?.trim(),
        email: getElement(DOM_IDS.contactEmail)?.value?.trim(),
        telefono: getElement(DOM_IDS.contactPhone)?.value?.trim(),
        celular: getElement(DOM_IDS.contactMobile)?.value?.trim(),
        empresa: getElement(DOM_IDS.contactCompany)?.value?.trim(),
        cp: getElement(DOM_IDS.contactZip)?.value?.trim(),
        estado: getElement(DOM_IDS.contactState)?.value?.trim(),
        municipio: getElement(DOM_IDS.contactMunicipio)?.value?.trim()
      };

      const idCliente = getElement(DOM_IDS.extraClientId)?.value;
      if (idCliente) fromDOM.id_cliente = idCliente;

      const normalized = Object.fromEntries(
        Object.entries(fromDOM).filter(([, v]) => v !== undefined && v !== '')
      );

      if (Object.keys(normalized).length) {
        window.selectedClient = { ...(window.selectedClient || {}), ...normalized };
        st.client = { ...(st.client || {}), ...normalized };
        st.cliente = { ...(st.cliente || {}), ...normalized };
      }

      // Llamar funciones globales si existen
      const callFn = (name) => {
        try {
          const fn = window[name];
          if (typeof fn === 'function') fn();
        } catch (_) { }
      };

      callFn('renderCart');
      callFn('renderSummaryVenta');
      callFn('renderFocusedListVenta');
      callFn('renderAccessoriesSummary');
      callFn('recalcTotalVenta');
      callFn('updateGrandTotal');
      callFn('populateFinancialSummaryVenta');
      callFn('updateAllTotals');
      callFn('buildActiveQuoteSnapshotVenta');

      console.log('[runVentaEditRecalc] Recálculo completado:', reason);
    } catch (error) {
      console.error('[runVentaEditRecalc] Error:', error);
    }
  }

  const scheduleVentaEditRecalc = debounce(() => runVentaEditRecalc('debounced'), CONFIG.DEBOUNCE_MS);

  // ============================================================================
  // CARGA DE DATOS
  // ============================================================================

  /**
   * Espera a que el catálogo esté disponible
   */
  function waitForCatalogAndRecalc(maxWaitMs = CONFIG.CATALOG_WAIT_MS) {
    const start = Date.now();
    const timer = setInterval(() => {
      try {
        const st = window.state;
        const hasProducts = Array.isArray(st?.products) && st.products.length > 0;
        const hasAccessories = Array.isArray(st?.accessories) && st.accessories.length > 0;

        if (hasProducts && hasAccessories) {
          clearInterval(timer);
          updateProductsFromCatalog(st);
          reloadAccessoriesFromQuotation();
          runVentaEditRecalc('catalog-ready');
          return;
        }

        if (Date.now() - start > maxWaitMs) {
          clearInterval(timer);
          runVentaEditRecalc('catalog-timeout');
        }
      } catch (_) { }
    }, 250);
  }

  /**
   * Actualiza pesos e imágenes desde catálogo
   */
  function updateProductsFromCatalog(st) {
    try {
      if (!st.products) return;

      const dataBySkuMap = new Map();
      st.products.forEach(p => {
        if (p.sku) {
          const key = String(p.sku).toLowerCase();
          const existing = dataBySkuMap.get(key);
          if (!existing || p.peso_kg > 0 || (p.image && p.image !== 'img/default.jpg')) {
            dataBySkuMap.set(key, {
              peso_kg: p.peso_kg || existing?.peso_kg || 0,
              image: (p.image && p.image !== 'img/default.jpg') ? p.image : (existing?.image || 'img/default.jpg')
            });
          }
        }
      });

      st.products.forEach(p => {
        if (p.sku) {
          const data = dataBySkuMap.get(String(p.sku).toLowerCase());
          if (data) {
            if ((!p.peso_kg || p.peso_kg === 0) && data.peso_kg > 0) p.peso_kg = data.peso_kg;
            if ((!p.image || p.image === 'img/default.jpg') && data.image && data.image !== 'img/default.jpg') {
              p.image = data.image;
            }
          }
        }
      });

      if (st.accessories) {
        st.accessories.forEach(a => {
          if (a.sku) {
            const data = dataBySkuMap.get(String(a.sku).toLowerCase());
            if (data) {
              if ((!a.peso_kg || a.peso_kg === 0) && data.peso_kg > 0) a.peso_kg = data.peso_kg;
              if ((!a.image || a.image === 'img/default.jpg') && data.image && data.image !== 'img/default.jpg') {
                a.image = data.image;
              }
            }
          }
        });
      }

      console.log('[updateProductsFromCatalog] Actualización completada');
    } catch (_) { }
  }

  /**
   * Recarga accesorios desde cotización
   */
  function reloadAccessoriesFromQuotation() {
    try {
      const cotizacionData = sessionStorage.getItem('cotizacionParaEditar');
      if (!cotizacionData) return;

      const cotizacion = JSON.parse(cotizacionData);
      const accesorios = typeof cotizacion.accesorios_seleccionados === 'string'
        ? JSON.parse(cotizacion.accesorios_seleccionados)
        : cotizacion.accesorios_seleccionados;

      if (!Array.isArray(accesorios) || accesorios.length === 0) return;

      const st = ensureVentaStateStructure();
      if (!st.accessories) st.accessories = [];

      st.accSelected = new Set();
      st.accQty = {};

      accesorios.forEach(accesorio => {
        const accSku = accesorio.sku || '';
        const accId = accesorio.id_producto || accesorio.id || accSku;
        const cantidad = parseInt(accesorio.cantidad, 10) || 1;
        const subtotal = parseFloat(accesorio.subtotal || 0);
        const precioUnit = cantidad > 0 ? subtotal / cantidad : subtotal;

        let catalogEntry = st.accessories.find(a => {
          if (accSku && a.sku) {
            return String(a.sku).toLowerCase() === String(accSku).toLowerCase();
          }
          if (accId) {
            return String(a.id) === String(accId) || String(a.id_accesorio) === String(accId);
          }
          return false;
        });

        let imagenFinal = accesorio.imagen || accesorio.image || '';
        let pesoFinal = Number(accesorio.peso_kg || accesorio.peso || 0);

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
            peso_kg: pesoFinal
          };
          st.accessories.push(catalogEntry);
        }

        const key = typeof window.accKey === 'function' ? window.accKey(catalogEntry) : catalogEntry.id;
        st.accSelected.add(key);
        st.accQty[key] = cantidad;
      });

      if (typeof window.renderAccessoriesSummary === 'function') {
        setTimeout(() => {
          window.renderAccessoriesSummary();
          window.updateAccessorySelectionStyles?.();
          window.recalcTotalVenta?.();
        }, 300);
      }

      console.log('[reloadAccessoriesFromQuotation] Accesorios recargados');
    } catch (e) {
      console.error('[reloadAccessoriesFromQuotation] Error:', e);
    }
  }

  // ============================================================================
  // SINCRONIZACIÓN DE ENTREGAS
  // ============================================================================

  /**
   * Sincroniza estado de entrega desde cotización
   */
  function syncShippingStateFromQuotation(cotizacion) {
    try {
      const state = ensureVentaStateStructure();
      state.cart = [];

      const contact = {
        name: cotizacion.cliente_nombre || getElement(DOM_IDS.contactName)?.value?.trim() || '',
        phone: cotizacion.cliente_telefono || getElement(DOM_IDS.contactPhone)?.value?.trim() || '',
        email: cotizacion.cliente_email || getElement(DOM_IDS.contactEmail)?.value?.trim() || '',
        company: cotizacion.cliente_empresa || getElement(DOM_IDS.contactCompany)?.value?.trim() || '',
        mobile: cotizacion.cliente_celular || getElement(DOM_IDS.contactMobile)?.value?.trim() || '',
        zip: cotizacion.cliente_cp || getElement(DOM_IDS.contactZip)?.value?.trim() || '',
        state: cotizacion.cliente_estado || getElement(DOM_IDS.contactState)?.value?.trim() || '',
        country: 'México'
      };

      const hasBranchInfo = !!(
        (cotizacion.entrega_sucursal?.trim?.()) ||
        (cotizacion.entrega_direccion?.trim?.()) ||
        cotizacion.id_almacen_recoleccion
      );
      const hasHomeAddress = !!(
        cotizacion.entrega_calle ||
        cotizacion.entrega_colonia ||
        cotizacion.entrega_cp
      );

      let effectiveMethod = 'home';
      if (cotizacion.metodo_entrega) {
        effectiveMethod = cotizacion.metodo_entrega === 'sucursal' ? 'branch' : 'home';
      } else if (hasBranchInfo && !hasHomeAddress) {
        effectiveMethod = 'branch';
      }

      let shippingInfo;
      if (effectiveMethod === 'branch') {
        shippingInfo = {
          method: 'branch',
          branch: {
            name: cotizacion.entrega_sucursal || '',
            address: cotizacion.entrega_direccion || '',
            city: cotizacion.entrega_ciudad || '',
            state: cotizacion.entrega_estado || '',
            zip: cotizacion.entrega_cp || '',
            id: cotizacion.id_almacen_recoleccion || null
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
            phone: cotizacion.entrega_telefono || '',
            reference: cotizacion.entrega_referencia || ''
          },
          contact
        };
        state.selectedBranch = null;
      }

      state.shippingInfo = shippingInfo;

      // Rehidratar costo
      try {
        const costoRaw = (
          cotizacion?.costo_envio ??
          cotizacion?.costoEnvio ??
          cotizacion?.envio?.costo ??
          cotizacion?.shipping_cost ??
          null
        );
        const costo = (costoRaw == null || costoRaw === '') ? null : (Number(parseFloat(costoRaw)) || 0);
        if (costo != null) {
          const costEl = getElement(DOM_IDS.deliveryCost);
          if (costEl) costEl.value = String(costo);
          const displayEl = getElement(DOM_IDS.deliveryCostDisplay);
          if (displayEl) {
            displayEl.textContent = new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
              maximumFractionDigits: 2
            }).format(costo);
          }
          try { state.deliveryExtra = costo; } catch (_) { }
        }
      } catch (error) {
        console.warn('[syncShippingStateFromQuotation] Error rehidratando costo:', error);
      }

      setTimeout(() => {
        try {
          if (typeof window.updateDeliverySummary === 'function') window.updateDeliverySummary();
          if (typeof window.showSummaryCards === 'function') window.showSummaryCards();
          if (typeof window.updateAllTotals === 'function') window.updateAllTotals();
          if (typeof window.updateGrandTotal === 'function') window.updateGrandTotal();
        } catch (_) { }
      }, 150);

      console.log('[syncShippingStateFromQuotation] Sincronización completada');
    } catch (error) {
      console.error('[syncShippingStateFromQuotation] Error:', error);
    }
  }

  // ============================================================================
  // CARGUE DE FORMULARIO
  // ============================================================================

  /**
   * Carga datos de cotización en el formulario
   */
  window.cargarDatosEnFormularioVenta = function (cotizacion = {}) {
    try {
      console.log('[cargarDatosEnFormularioVenta] Cargando datos');

      const state = ensureVentaStateStructure();

      // Información de cliente
      if (cotizacion.id_cliente) {
        const clientLabel = getElement('v-client-label');
        const clientHidden = getElement(DOM_IDS.extraClientId);

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
          empresa: cotizacion.cliente_empresa || cotizacion.contacto_empresa
        };
        localStorage.setItem('cr_selected_client', JSON.stringify(clientData));
        window.selectedClient = { ...(window.selectedClient || {}), ...clientData };
        state.client = { ...(state.client || {}), ...clientData };
        state.cliente = { ...(state.cliente || {}), ...clientData };
      }

      // Información de contacto
      setInputValue(DOM_IDS.contactName, cotizacion.cliente_nombre || cotizacion.contacto_nombre);
      setInputValue(DOM_IDS.contactPhone, cotizacion.cliente_telefono || cotizacion.contacto_telefono);
      setInputValue(DOM_IDS.contactEmail, cotizacion.cliente_email || cotizacion.contacto_email);
      setInputValue(DOM_IDS.contactCompany, cotizacion.cliente_empresa || cotizacion.contacto_empresa);
      setInputValue(DOM_IDS.contactMobile, cotizacion.cliente_celular || cotizacion.contacto_celular);
      setInputValue(DOM_IDS.contactZip, cotizacion.cliente_cp || cotizacion.contacto_cp);
      setInputValue(DOM_IDS.contactState, cotizacion.cliente_estado || cotizacion.contacto_estado);
      setInputValue(DOM_IDS.contactMunicipio, cotizacion.cliente_municipio || cotizacion.contacto_municipio);

      // Folio
      if (cotizacion.numero_cotizacion || cotizacion.numero_folio) {
        const folio = cotizacion.numero_cotizacion || cotizacion.numero_folio;
        setInputValue(DOM_IDS.quoteNumber, folio);
        if (typeof window.loadQuoteNumberInEditMode === 'function') {
          window.loadQuoteNumberInEditMode(folio);
        }
      }

      // Método de entrega
      const isSucursal = cotizacion.tipo_envio === 'sucursal' ||
        cotizacion.tipo_envio === 'recoleccion' ||
        (cotizacion.id_almacen || cotizacion.nombre_almacen) ||
        (cotizacion.fecha_entrega_solicitada && cotizacion.hora_entrega_solicitada && !cotizacion.entrega_calle);

      const branchRadio = getElement(DOM_IDS.deliveryBranchRadio);
      const homeRadio = getElement(DOM_IDS.deliveryHomeRadio);

      if (isSucursal && branchRadio) {
        branchRadio.checked = true;
        if (homeRadio) homeRadio.checked = false;

        if (getElement(DOM_IDS.branchCard)) getElement(DOM_IDS.branchCard).style.display = 'block';
        if (getElement(DOM_IDS.homeWrap)) getElement(DOM_IDS.homeWrap).style.display = '';

        // Populate branch select
        const branchSelect = getElement(DOM_IDS.branchSelect);
        if (branchSelect) {
          const populateAndSelect = async () => {
            let warehouses = window.state?.warehouses;
            if (!warehouses || warehouses.length === 0) {
              if (typeof window.loadWarehousesFromAPI === 'function') {
                warehouses = await window.loadWarehousesFromAPI();
                if (window.state) window.state.warehouses = warehouses;
              }
            }

            if (branchSelect.options.length <= 1 && warehouses?.length > 0) {
              branchSelect.innerHTML = '<option value="">Selecciona una sucursal</option>';
              warehouses.forEach(w => {
                const opt = document.createElement('option');
                opt.value = w.id_almacen;
                opt.textContent = `${w.nombre_almacen} — ${w.ubicacion || ''}`;
                if (cotizacion.id_almacen && String(w.id_almacen) === String(cotizacion.id_almacen)) {
                  opt.selected = true;
                }
                branchSelect.appendChild(opt);
              });
            }
          };

          populateAndSelect();
          setTimeout(populateAndSelect, 1500);
        }

        if (cotizacion.fecha_entrega_solicitada) {
          const fecha = cotizacion.fecha_entrega_solicitada.split('T')[0];
          setInputValue(DOM_IDS.branchPickupDate, fecha);
        }
        if (cotizacion.hora_entrega_solicitada) {
          setInputValue(DOM_IDS.branchPickupTime, cotizacion.hora_entrega_solicitada);
        }
      } else if (homeRadio) {
        homeRadio.checked = true;
        if (branchRadio) branchRadio.checked = false;
        if (getElement(DOM_IDS.homeWrap)) getElement(DOM_IDS.homeWrap).style.display = 'block';
        if (getElement(DOM_IDS.branchCard)) getElement(DOM_IDS.branchCard).style.display = 'none';
      }

      // Información de entrega
      setInputValue(DOM_IDS.deliveryStreet, cotizacion.entrega_calle);
      setInputValue(DOM_IDS.deliveryExt, cotizacion.entrega_numero_ext);
      setInputValue(DOM_IDS.deliveryInt, cotizacion.entrega_numero_int);
      setInputValue(DOM_IDS.deliveryColony, cotizacion.entrega_colonia);
      setInputValue(DOM_IDS.deliveryCity, cotizacion.entrega_municipio);
      setInputValue(DOM_IDS.deliveryState, cotizacion.entrega_estado);
      setInputValue(DOM_IDS.deliveryZip, cotizacion.entrega_cp);
      setInputValue(DOM_IDS.deliveryLote, cotizacion.entrega_lote);
      setInputValue(DOM_IDS.deliveryContact, cotizacion.entrega_contacto);
      setInputValue(DOM_IDS.deliveryPhone, cotizacion.entrega_telefono);
      setInputValue(DOM_IDS.deliveryDistance, cotizacion.entrega_kilometros);

      syncShippingStateFromQuotation(cotizacion);

      // Productos
      try {
        let productos = Array.isArray(cotizacion.productos) ? cotizacion.productos :
          (typeof cotizacion.productos === 'string' ? JSON.parse(cotizacion.productos) : []);

        if (!productos.length) {
          productos = Array.isArray(cotizacion.productos_seleccionados) ? cotizacion.productos_seleccionados :
            (typeof cotizacion.productos_seleccionados === 'string' ? JSON.parse(cotizacion.productos_seleccionados) : []);
        }

        productos.forEach(producto => {
          const productId = producto.id_producto || producto.id;
          const cantidad = parseInt(producto.cantidad, 10) || 1;

          const existingProduct = state.products.find(p => String(p.id) === String(productId));
          if (!existingProduct) {
            let priceValue = parseFloat(producto.precio_unitario) || 0;
            if (!priceValue && producto.subtotal && cantidad > 0) {
              priceValue = parseFloat(producto.subtotal) / cantidad;
            }
            if (!priceValue) {
              priceValue = parseFloat(producto.precio_venta || producto.precio || 0);
            }

            state.products.push({
              id: productId,
              name: producto.nombre,
              nombre: producto.nombre,
              sku: producto.sku,
              price: { diario: priceValue, venta: priceValue },
              precio: priceValue,
              image: producto.imagen || producto.image || 'img/default.jpg',
              stock: producto.stock != null ? Number(producto.stock) : 999,
              peso_kg: Number(producto.peso_kg ?? producto.peso ?? 0) || 0
            });
          }

          const cartItem = state.cart.find(ci => String(ci.id) === String(productId));
          if (cartItem) {
            cartItem.qty += cantidad;
          } else {
            state.cart.push({ id: productId, qty: cantidad });
          }
        });

        if (typeof window.renderCart === 'function') window.renderCart();
        if (typeof window.recalcTotalVenta === 'function') window.recalcTotalVenta();

        const count = state.cart.reduce((acc, item) => acc + (item.qty || 0), 0);
        if (getElement(DOM_IDS.cartCount)) getElement(DOM_IDS.cartCount).textContent = String(count);
        if (getElement(DOM_IDS.cartCountWrap)) {
          getElement(DOM_IDS.cartCountWrap).classList.toggle('is-empty', count === 0);
        }
      } catch (productError) {
        console.error('[cargarDatosEnFormularioVenta] Error cargando productos:', productError);
      }

      // Accesorios  
      if (cotizacion.accesorios_seleccionados) {
        const cargarAccesorios = () => {
          try {
            const accesorios = typeof cotizacion.accesorios_seleccionados === 'string'
              ? JSON.parse(cotizacion.accesorios_seleccionados)
              : cotizacion.accesorios_seleccionados;

            if (!Array.isArray(accesorios) || accesorios.length === 0) return;

            const stateRef = ensureVentaStateStructure();
            if (!stateRef.accessories) stateRef.accessories = [];

            stateRef.accSelected = new Set();
            stateRef.accQty = {};

            accesorios.forEach(accesorio => {
              const accSku = accesorio.sku || '';
              const accId = accesorio.id_producto || accesorio.id || accSku;
              const cantidad = parseInt(accesorio.cantidad, 10) || 1;
              const subtotal = parseFloat(accesorio.subtotal || 0);
              const precioUnit = cantidad > 0 ? subtotal / cantidad : subtotal;

              let catalogEntry = stateRef.accessories.find(a => {
                if (accSku && a.sku) {
                  return String(a.sku).toLowerCase() === String(accSku).toLowerCase();
                }
                if (accId) {
                  return String(a.id) === String(accId);
                }
                return false;
              });

              let imagenFinal = accesorio.imagen || accesorio.image || '';
              let pesoFinal = Number(accesorio.peso_kg || accesorio.peso || 0);

              if (!catalogEntry) {
                catalogEntry = {
                  id: accId,
                  sku: accSku,
                  name: accesorio.nombre || `Accesorio ${accSku}`,
                  price: precioUnit,
                  image: imagenFinal || 'img/default.jpg',
                  stock: 999,
                  subcat: 'accesorios',
                  peso_kg: pesoFinal
                };
                stateRef.accessories.push(catalogEntry);
              }

              const key = typeof window.accKey === 'function' ? window.accKey(catalogEntry) : catalogEntry.id;
              stateRef.accSelected.add(key);
              stateRef.accQty[key] = cantidad;
            });

            if (typeof window.renderAccessoriesSummary === 'function') {
              setTimeout(() => { window.renderAccessoriesSummary(); }, 300);
            }
          } catch (e) {
            console.error('[cargarAccesorios] Error:', e);
          }
        };

        cargarAccesorios();
      }

      // Configuraciones especiales
      try {
        let config = typeof cotizacion.configuracion_especial === 'string'
          ? JSON.parse(cotizacion.configuracion_especial)
          : cotizacion.configuracion_especial;

        const ivaSelect = getElement('cr-apply-iva');
        if (ivaSelect && config?.aplica_iva) {
          ivaSelect.value = config.aplica_iva;
          ivaSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (cotizacion.garantia_porcentaje > 0) {
          const discountSelect = getElement('cr-summary-apply-discount');
          const discountInput = getElement('cr-summary-discount-percent-input');
          if (discountSelect) discountSelect.value = 'si';
          if (discountInput) discountInput.value = cotizacion.garantia_porcentaje;
          try {
            discountSelect?.dispatchEvent(new Event('change', { bubbles: true }));
            discountInput?.dispatchEvent(new Event('input', { bubbles: true }));
          } catch (_) { }
        }

        if (config?.itemDiscounts) {
          state.itemDiscounts = config.itemDiscounts;
          if (typeof window.populateQuoteSummaryVenta === 'function') {
            window.populateQuoteSummaryVenta();
          }
        }
      } catch (err) {
        console.warn('[cargarDatosEnFormularioVenta] Error en configuración:', err);
      }

      console.log('[cargarDatosEnFormularioVenta] Datos cargados exitosamente');
    } catch (error) {
      console.error('[cargarDatosEnFormularioVenta] Error:', error);
    }
  };

  /**
   * Actualiza título en modo edición
   */
  window.actualizarTituloEdicionVenta = function (cotizacion) {
    try {
      const titulo = document.querySelector('.cr-title');
      if (titulo) {
        titulo.innerHTML = `<i class="fa-solid fa-edit"></i> Editando: ${cotizacion.numero_cotizacion}`;
        titulo.style.color = '#f39c12';
      }

      const btnGenerar = document.querySelector('button[onclick="completeShippingStep()"]');
      if (btnGenerar) {
        btnGenerar.innerHTML = `
          <i class="fa-solid fa-sync-alt"></i>
          <span>Actualizar Cotización</span>
          <i class="fa-solid fa-arrow-right cr-btn-arrow"></i>
        `;
        btnGenerar.removeAttribute('onclick');
        btnGenerar.addEventListener('click', async (e) => {
          e.preventDefault();
          if (window.actualizarCotizacionVenta) {
            try { await window.actualizarCotizacionVenta(); } catch (error) {
              console.error('[Botón Actualizar] Error:', error);
            }
          }
        });
        btnGenerar.style.background = 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)';
      }

      console.log('[actualizarTituloEdicionVenta] Título actualizado');
    } catch (error) {
      console.error('[actualizarTituloEdicionVenta] Error:', error);
    }
  };

  /**
   * Detecta modo edición y carga datos
   */
  window.detectarModoEdicionVenta = async function () {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const editId = urlParams.get('edit');

      if (!editId) {
        window.modoEdicion = false;
        return;
      }

      console.log('[detectarModoEdicionVenta] Modo edición detectado, ID:', editId);
      window.modoEdicion = true;
      window.cotizacionEditandoId = editId;

      let cotizacion = null;

      // Intenta cargar desde sessionStorage
      const cotizacionData = sessionStorage.getItem('cotizacionParaEditar');
      if (cotizacionData) {
        try {
          const tempCot = JSON.parse(cotizacionData);
          if (String(tempCot.id_cotizacion || tempCot.id) === String(editId)) {
            cotizacion = tempCot;
          }
        } catch (_) { }
      }

      // Carga datos frescos desde API
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${CONFIG.API_BASE}/cotizaciones/${editId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const apiData = await response.json();
          cotizacion = { ...(cotizacion || {}), ...apiData };
          sessionStorage.setItem('cotizacionParaEditar', JSON.stringify(cotizacion));
        }
      } catch (apiError) {
        console.error('[detectarModoEdicionVenta] Error API:', apiError);
      }

      if (cotizacion) {
        setTimeout(() => {
          window.cargarDatosEnFormularioVenta(cotizacion);
          window.actualizarTituloEdicionVenta(cotizacion);
          try { bindEditRealtimeSync(); } catch (_) { }
          try { runVentaEditRecalc('after-load'); } catch (_) { }
          try { waitForCatalogAndRecalc(); } catch (_) { }
        }, CONFIG.LOAD_DELAY_MS);
      }
    } catch (error) {
      console.error('[detectarModoEdicionVenta] Error:', error);
    }
  };

  /**
   * Vincula sincronización en tiempo real
   */
  function bindEditRealtimeSync() {
    if (window.__ventaEditRealtimeBound) return;
    window.__ventaEditRealtimeBound = true;

    const shouldSync = (el) => {
      if (!window.modoEdicion || !el) return false;
      const id = (el.id || '').toLowerCase();
      const name = (el.name || '').toLowerCase();
      return id.includes('cr-summary') || id.includes('cr-apply') || id.includes('delivery') ||
        id.includes('cr-zone') || name.includes('cr-category') ||
        (el.classList && (el.classList.contains('cr-qty-input') || el.classList.contains('cr-input')));
    };

    document.addEventListener('input', (ev) => {
      if (shouldSync(ev.target)) scheduleVentaEditRecalc();
    }, true);

    document.addEventListener('change', (ev) => {
      if (shouldSync(ev.target)) scheduleVentaEditRecalc();
    }, true);

    console.log('[bindEditRealtimeSync] Sincronización en tiempo real vinculada');
  }

  // Inicializar
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[cotizacion_venta_edicion.js] Inicializando');
    window.detectarModoEdicionVenta();
  });

})();
