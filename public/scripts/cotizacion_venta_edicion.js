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

  // Función para cargar datos de cotización en el formulario de venta
  window.cargarDatosEnFormularioVenta = function(cotizacion) {
    try {
      console.log('[cargarDatosEnFormularioVenta] Cargando datos:', cotizacion);
      
      // Helper function para establecer valores de forma segura
      const setInputValue = (id, value) => {
        const element = document.getElementById(id);
        if (element && value !== null && value !== undefined) {
          element.value = value;
        }
      };
      
      // 1. Cargar datos del cliente
      if (cotizacion.id_cliente) {
        const clientLabel = document.getElementById('v-client-label');
        const clientHidden = document.getElementById('v-extra');
        
        if (clientLabel) {
          clientLabel.textContent = cotizacion.cliente_nombre || cotizacion.contacto_nombre || 'Cliente';
        }
        if (clientHidden) {
          clientHidden.value = cotizacion.id_cliente;
        }
        
        // Guardar en localStorage
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
      
      // 2. Cargar datos de contacto
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
      
      // 3. Cargar datos de entrega
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
      
      // 4. Cargar productos
      if (cotizacion.productos_seleccionados) {
        try {
          const productos = typeof cotizacion.productos_seleccionados === 'string' 
            ? JSON.parse(cotizacion.productos_seleccionados)
            : cotizacion.productos_seleccionados;
          
          console.log('[cargarDatosEnFormularioVenta] Productos a cargar:', productos);
          
          // Acceder al state global
          const state = window.state;
          if (!state) {
            console.error('[cargarDatosEnFormularioVenta] No se encontró window.state');
            return;
          }
          
          // Limpiar carrito actual
          state.cart = [];
          
          // Agregar productos al carrito
          if (Array.isArray(productos)) {
            productos.forEach(producto => {
              const productId = producto.id_producto;
              const cantidad = parseInt(producto.cantidad) || 1;
              
              // Verificar si el producto existe en state.products
              const existeEnProducts = state.products.find(p => p.id === productId);
              
              if (!existeEnProducts) {
                // Si no existe, agregarlo temporalmente a state.products
                console.log('[cargarDatosEnFormularioVenta] Agregando producto temporal:', producto);
                state.products.push({
                  id: productId,
                  nombre: producto.nombre,
                  sku: producto.sku,
                  precio: parseFloat(producto.precio_unitario),
                  precio_venta: parseFloat(producto.precio_unitario),
                  stock: 999 // Stock temporal
                });
              }
              
              // Agregar al carrito con la cantidad correcta
              for (let i = 0; i < cantidad; i++) {
                const found = state.cart.find(ci => ci.id === productId);
                if (found) {
                  found.qty += 1;
                } else {
                  state.cart.push({ id: productId, qty: 1 });
                }
              }
            });
          }
          
          // Actualizar UI del carrito
          console.log('[cargarDatosEnFormularioVenta] Carrito actualizado:', state.cart);
          
          // Llamar a las funciones de renderizado si existen
          if (window.renderCart) {
            window.renderCart();
          }
          if (window.renderSummaryVenta) {
            window.renderSummaryVenta();
          }
          if (window.renderFocusedListVenta) {
            window.renderFocusedListVenta();
          }
          if (window.recalcTotalVenta) {
            window.recalcTotalVenta();
          }
          
          // Actualizar contador del carrito
          const count = state.cart.reduce((a,b)=>a+b.qty,0);
          const cntEl = document.getElementById('cr-cart-count');
          if (cntEl) cntEl.textContent = String(count);
          const wrap = document.getElementById('cr-cart-count-wrap');
          if (wrap) wrap.classList.toggle('is-empty', count===0);
          
        } catch (e) {
          console.error('[cargarDatosEnFormularioVenta] Error cargando productos:', e);
        }
      }
      
      // 5. Cargar accesorios (con estrategia de reintentos)
      if (cotizacion.accesorios_seleccionados) {
        const cargarAccesorios = (intentos = 0, maxIntentos = 10) => {
          try {
            const accesorios = typeof cotizacion.accesorios_seleccionados === 'string' 
              ? JSON.parse(cotizacion.accesorios_seleccionados)
              : cotizacion.accesorios_seleccionados;
            
            console.log(`[cargarDatosEnFormularioVenta] 🔧 Intento ${intentos + 1}/${maxIntentos} - Accesorios a cargar:`, accesorios.length);
            
            // Acceder al state global
            const state = window.state;
            
            // Debug: verificar estado del catálogo de accesorios
            console.log('[cargarDatosEnFormularioVenta] 🔍 Estado del catálogo:', {
              stateExists: !!state,
              accessoriesExists: !!state?.accessories,
              accessoriesLength: state?.accessories?.length || 0,
              accessoriesLoaded: state?.accessories?.length > 0
            });
            
            // Si el catálogo no está cargado, reintentar
            if (!state?.accessories || state.accessories.length === 0) {
              if (intentos < maxIntentos) {
                console.log(`[cargarDatosEnFormularioVenta] ⏳ Catálogo no disponible, reintentando en 300ms...`);
                setTimeout(() => cargarAccesorios(intentos + 1, maxIntentos), 300);
                return;
              } else {
                console.error('[cargarDatosEnFormularioVenta] ❌ Catálogo de accesorios no disponible después de múltiples intentos');
                return;
              }
            }
            
            if (state && Array.isArray(accesorios) && accesorios.length > 0) {
            // Limpiar accesorios actuales
            state.accSelected = new Set();
            state.accQty = {};
            
            // Agregar accesorios al state
            accesorios.forEach(accesorio => {
              const accSku = accesorio.sku;
              const accId = accesorio.id_producto;
              const cantidad = parseInt(accesorio.cantidad) || 1;
              
              // Buscar el accesorio en state.accessories por SKU o ID
              const existeEnAccessories = state.accessories?.find(a => {
                // Comparar por SKU primero (más confiable)
                if (accSku && a.sku) {
                  return String(a.sku).toLowerCase() === String(accSku).toLowerCase();
                }
                // Fallback: comparar por ID
                return String(a.id) === String(accId);
              });
              
              if (existeEnAccessories) {
                // Usar accKey para generar la clave correcta
                const key = window.accKey ? window.accKey(existeEnAccessories) : existeEnAccessories.id;
                state.accSelected.add(key);
                state.accQty[key] = cantidad;
                console.log(`[cargarDatosEnFormularioVenta] ✅ Accesorio agregado: ${accesorio.nombre} (SKU: ${accSku}) x${cantidad} (key: ${key})`);
              } else {
                console.warn(`[cargarDatosEnFormularioVenta] ⚠️ Accesorio no encontrado en catálogo: ${accesorio.nombre} (SKU: ${accSku}, ID: ${accId})`);
              }
            });
            
            console.log('[cargarDatosEnFormularioVenta] 🔧 Accesorios cargados:', {
              selected: Array.from(state.accSelected),
              quantities: state.accQty
            });
            
            // Actualizar UI de accesorios
            if (window.renderAccessoriesSummary) {
              setTimeout(() => {
                window.renderAccessoriesSummary();
                window.updateAccessorySelectionStyles?.();
                window.recalcTotalVenta?.();
                console.log('[cargarDatosEnFormularioVenta] 🎨 UI de accesorios actualizada');
              }, 800);
            }
            }
            
          } catch (e) {
            console.error('[cargarDatosEnFormularioVenta] Error cargando accesorios:', e);
          }
        };
        
        // Iniciar carga de accesorios
        cargarAccesorios();
      }
      
      // 6. Cargar fechas
      setInputValue('cr-start-date', cotizacion.fecha_inicio?.split('T')[0]);
      setInputValue('cr-end-date', cotizacion.fecha_fin?.split('T')[0]);
      
      // 7. Cargar observaciones y condiciones
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
      quotationData.estado = 'Aprobada'; // ✅ Cambiar estado a Aprobada al actualizar
      
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
