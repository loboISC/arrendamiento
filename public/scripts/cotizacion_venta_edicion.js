// Funcionalidad de edición para cotizaciones de venta
// Este archivo maneja la carga y edición de cotizaciones existentes

(function() {
  'use strict';

  // Función para detectar modo edición desde URL
  window.detectarModoEdicionVenta = function() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const editId = urlParams.get('edit');
      
      if (editId) {
        console.log('[detectarModoEdicionVenta] Modo edición detectado, ID:', editId);
        window.modoEdicion = true;
        window.cotizacionEditandoId = editId;
        
        // Cargar datos desde sessionStorage
        const cotizacionData = sessionStorage.getItem('cotizacionParaEditar');
        if (cotizacionData) {
          try {
            const cotizacion = JSON.parse(cotizacionData);
            console.log('[detectarModoEdicionVenta] Datos de cotización encontrados:', cotizacion);
            
            // Cargar datos en el formulario
            setTimeout(() => {
              cargarDatosEnFormularioVenta(cotizacion);
              actualizarTituloEdicionVenta(cotizacion);
            }, 1000); // Aumentado a 1000ms para asegurar que los accesorios estén cargados
            
          } catch (e) {
            console.error('[detectarModoEdicionVenta] Error parsing cotización data:', e);
          }
        } else {
          console.warn('[detectarModoEdicionVenta] No se encontraron datos en sessionStorage');
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

      setTimeout(() => {
        try {
          if (typeof window.updateDeliverySummary === 'function') {
            window.updateDeliverySummary();
          }
          if (typeof window.showSummaryCards === 'function') {
            window.showSummaryCards();
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
  window.cargarDatosEnFormularioVenta = function(cotizacion = {}) {
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

      setInputValue('cr-delivery-street', cotizacion.entrega_calle);
      setInputValue('cr-delivery-ext', cotizacion.entrega_numero_ext);
      setInputValue('cr-delivery-int', cotizacion.entrega_numero_int);
      setInputValue('cr-delivery-colony', cotizacion.entrega_colonia);
      setInputValue('cr-delivery-city', cotizacion.entrega_municipio);
      setInputValue('cr-delivery-state', cotizacion.entrega_estado);
      setInputValue('cr-delivery-zip', cotizacion.entrega_cp);
      setInputValue('cr-delivery-lote', cotizacion.entrega_lote);
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
          const productId = producto.id_producto;
          const cantidad = parseInt(producto.cantidad, 10) || 1;

          const existingProduct = state.products.find(p => String(p.id) === String(productId));
          const warehouseId = producto.id_almacen || cotizacion.id_almacen || null;
          const warehouseName = producto.nombre_almacen || producto.almacen || cotizacion.almacen_nombre || cotizacion.nombre_almacen || state.selectedWarehouse?.nombre_almacen || null;
          const warehouseLocation = producto.ubicacion || producto.ubicacion_almacen || cotizacion.ubicacion_almacen || null;

          if (!existingProduct) {
            const priceValue = parseFloat(producto.precio_unitario) || 0;
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
              stock: producto.stock != null ? Number(producto.stock) : 999
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

        console.log('[cargarDatosEnFormularioVenta] Carrito actualizado:', state.cart);

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

            if (!stateRef.accessories || stateRef.accessories.length === 0) {
              if (intentos < maxIntentos) {
                console.log('[cargarDatosEnFormularioVenta] ⏳ Catálogo no disponible, reintentando en 300ms...');
                setTimeout(() => cargarAccesorios(intentos + 1, maxIntentos), 300);
              } else {
                console.error('[cargarDatosEnFormularioVenta] ❌ Catálogo de accesorios no disponible después de múltiples intentos');
              }
              return;
            }

            stateRef.accSelected = new Set();
            stateRef.accQty = {};

            accesorios.forEach(accesorio => {
              const accSku = accesorio.sku;
              const accId = accesorio.id_producto;
              const cantidad = parseInt(accesorio.cantidad, 10) || 1;

              const catalogEntry = stateRef.accessories.find(a => {
                if (accSku && a.sku) {
                  return String(a.sku).toLowerCase() === String(accSku).toLowerCase();
                }
                return String(a.id) === String(accId);
              });

              if (catalogEntry) {
                const key = typeof window.accKey === 'function' ? window.accKey(catalogEntry) : catalogEntry.id;
                stateRef.accSelected.add(key);
                stateRef.accQty[key] = cantidad;
              } else {
                console.warn(`[cargarDatosEnFormularioVenta] ⚠️ Accesorio no encontrado en catálogo: ${accesorio.nombre} (SKU: ${accSku}, ID: ${accId})`);
              }
            });

            console.log('[cargarDatosEnFormularioVenta] 🔧 Accesorios cargados:', {
              selected: Array.from(stateRef.accSelected),
              quantities: stateRef.accQty
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
  window.actualizarTituloEdicionVenta = function(cotizacion) {
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
        btnGenerar.addEventListener('click', async function(e) {
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
  window.actualizarCotizacionVenta = async function() {
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
      const response = await fetch(`http://localhost:3001/api/cotizaciones/${window.cotizacionEditandoId}`, {
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
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[cotizacion_venta_edicion.js] Inicializando...');
    detectarModoEdicionVenta();
  });

})();
