// ============================================================================
// FUNCIONALIDAD DE CLONACIÓN DE COTIZACIONES DE VENTA
// Este código debe agregarse al final de cotizacion_venta.js
// ============================================================================

/**
 * Inicializar funcionalidad de clonación para cotizaciones de venta
 */
const initCloneFunctionalityVenta = () => {
  console.log('[CLONE-VENTA] Inicializando funcionalidad de clonación');

  // Elementos del DOM
  const cloneModal = document.getElementById('cr-clone-modal');
  const confirmModal = document.getElementById('cr-clone-confirm-modal');
  const selectClientBtn = document.getElementById('cr-clone-select-client');
  const keepClientBtn = document.getElementById('cr-clone-keep-client');
  const selectAllBtn = document.getElementById('cr-clone-select-all');
  const cloneBtn = document.getElementById('cr-clone-btn');
  const confirmProceedBtn = document.getElementById('cr-clone-confirm-proceed');
  const confirmCancelBtn = document.getElementById('cr-clone-confirm-cancel-btn');
  const newDateInput = document.getElementById('cr-clone-new-date');

  // Estado de la clonación
  let cloneState = {
    originalQuotation: null,
    newClient: null,
    keepOriginalClient: true,
    newVendor: null,
    newDate: null,
    reason: '',
    options: {
      resetState: true,
      copyProducts: true,
      copyShipping: false
    }
  };

  /**
   * Llenar modal con datos de cotización actual
   */
  window.fillCloneModalWithCurrentQuotation = async () => {
    try {
      console.log('[CLONE-VENTA] Llenando modal con cotización actual');

      // Obtener datos básicos de la interfaz
      const quotationData = {
        id_cotizacion: window.cotizacionEditandoId,
        numero_folio: document.getElementById('v-quote-number')?.value || 'VEN-XXXX-XXXXXX',
        total: 0,
        fecha_creacion: document.getElementById('v-quote-date')?.value || new Date().toISOString().split('T')[0]
      };

      // Calcular total desde el DOM
      const totalElement = document.getElementById('cr-grand-total') || document.getElementById('cr-total');
      if (totalElement) {
        const totalText = totalElement.textContent.replace(/[^0-9.-]+/g, '');
        quotationData.total = parseFloat(totalText) || 0;
      }

      // Si hay un ID de cotización en edición, cargar datos completos
      if (window.cotizacionEditandoId) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/cotizaciones/${window.cotizacionEditandoId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
            const fullData = await response.json();
            quotationData.id_cotizacion = fullData.id_cotizacion;
            quotationData.numero_folio = fullData.numero_folio || fullData.numero_cotizacion;
            quotationData.fecha_creacion = fullData.fecha_creacion || fullData.fecha_cotizacion;
            quotationData.id_vendedor = fullData.id_vendedor;
            quotationData.vendedor_nombre = fullData.vendedor_nombre;
            quotationData.total = fullData.total || quotationData.total;
          }
        } catch (error) {
          console.error('[CLONE-VENTA] Error cargando datos completos:', error);
        }
      }

      cloneState.originalQuotation = quotationData;

      // Llenar información básica
      const folioEl = document.querySelector('[data-chip-folio]');
      if (folioEl) {
        folioEl.textContent = quotationData.numero_folio || 'VEN-XXXX-XXXXXX';
      }
      
      const totalEl = document.querySelector('[data-chip-total]');
      if (totalEl) {
        totalEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
          .format(quotationData.total || 0);
      }
      
      const fechaEl = document.querySelector('[data-chip-fecha-original]');
      if (fechaEl) {
        const fecha = quotationData.fecha_creacion || new Date();
        fechaEl.textContent = new Date(fecha).toLocaleDateString('es-MX');
      }

      // Cliente actual
      const clientLabel = document.getElementById('v-client-label');
      const clientName = clientLabel?.textContent || 'No especificado';
      const currentClientEl = document.getElementById('cr-clone-current-client');
      if (currentClientEl) {
        currentClientEl.textContent = clientName;
      }

      // Vendedor actual
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const vendorName = quotationData.vendedor_nombre || currentUser.nombre || 'No asignado';
      const currentVendorEl = document.getElementById('cr-clone-current-vendor');
      if (currentVendorEl) {
        currentVendorEl.textContent = vendorName;
      }

      // Establecer fecha actual por defecto
      if (newDateInput) {
        newDateInput.value = new Date().toISOString().split('T')[0];
      }

      // Cargar vendedores
      await loadVendorsVenta();

      // Abrir modal
      cloneModal.hidden = false;
      cloneModal.setAttribute('aria-hidden', 'false');

      console.log('[CLONE-VENTA] Modal llenado exitosamente');
    } catch (error) {
      console.error('[CLONE-VENTA] Error llenando modal:', error);
      showNotificationVenta('Error al preparar la clonación', 'error');
    }
  };

  /**
   * Cargar lista de vendedores
   */
  const loadVendorsVenta = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/usuarios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error cargando vendedores');

      const usuarios = await response.json();
      const vendorSelect = document.getElementById('cr-clone-vendor-select');
      
      if (!vendorSelect) return;

      // Limpiar opciones existentes excepto la primera
      vendorSelect.innerHTML = '<option value="">Mantener vendedor actual</option>';

      // Filtrar solo vendedores relevantes
      const vendedores = usuarios.filter(u => 
        ['Rentas', 'Ventas', 'director general', 'Administrador'].includes(u.rol)
      );

      vendedores.forEach(vendedor => {
        const option = document.createElement('option');
        option.value = vendedor.id_usuario || vendedor.id;
        option.textContent = `${vendedor.nombre} (${vendedor.rol})`;
        vendorSelect.appendChild(option);
      });

      console.log('[CLONE-VENTA] Vendedores cargados:', vendedores.length);
    } catch (error) {
      console.error('[CLONE-VENTA] Error cargando vendedores:', error);
    }
  };

  /**
   * Manejar selección de nuevo cliente
   */
  if (selectClientBtn) {
    selectClientBtn.addEventListener('click', () => {
      console.log('[CLONE-VENTA] Abriendo selector de clientes');
      
      // Abrir modal de selección de clientes
      const clientModal = document.getElementById('v-client-modal');
      if (clientModal) {
        clientModal.hidden = false;
        clientModal.setAttribute('aria-hidden', 'false');
        
        // Marcar que estamos en modo clonación
        clientModal.setAttribute('data-clone-mode', 'true');
        
        // Escuchar selección de cliente
        window.addEventListener('message', function handleClientSelection(event) {
          if (event.data && event.data.type === 'CLIENT_SELECTED_FOR_CLONE') {
            const clientData = event.data.clientData;
            
            // Guardar nuevo cliente
            cloneState.newClient = clientData;
            cloneState.keepOriginalClient = false;
            
            // Mostrar cliente seleccionado
            const selectedClientDiv = document.getElementById('cr-clone-selected-client');
            const clientNameSpan = document.getElementById('cr-clone-new-client-name');
            
            if (selectedClientDiv && clientNameSpan) {
              clientNameSpan.textContent = clientData.nombre || clientData.razon_social || 'Cliente seleccionado';
              selectedClientDiv.style.display = 'block';
            }
            
            // Cerrar modal de clientes
            clientModal.hidden = true;
            clientModal.setAttribute('aria-hidden', 'true');
            clientModal.removeAttribute('data-clone-mode');
            
            // Remover listener
            window.removeEventListener('message', handleClientSelection);
            
            console.log('[CLONE-VENTA] Nuevo cliente seleccionado:', clientData);
          }
        });
      }
    });
  }

  /**
   * Manejar mantener cliente actual
   */
  if (keepClientBtn) {
    keepClientBtn.addEventListener('click', () => {
      cloneState.newClient = null;
      cloneState.keepOriginalClient = true;
      
      // Ocultar div de nuevo cliente
      const selectedClientDiv = document.getElementById('cr-clone-selected-client');
      if (selectedClientDiv) {
        selectedClientDiv.style.display = 'none';
      }
      
      console.log('[CLONE-VENTA] Manteniendo cliente original');
      showNotificationVenta('Se mantendrá el cliente original', 'success');
    });
  }

  /**
   * Manejar seleccionar todo
   */
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.cr-clone-checkbox');
      const allChecked = Array.from(checkboxes).every(cb => cb.checked);
      
      checkboxes.forEach(cb => {
        cb.checked = !allChecked;
      });
      
      selectAllBtn.innerHTML = allChecked 
        ? '<i class="fa-solid fa-check-double"></i> Seleccionar Todo'
        : '<i class="fa-solid fa-xmark"></i> Deseleccionar Todo';
    });
  }

  /**
   * Manejar botón de clonar (abrir modal de confirmación)
   */
  if (cloneBtn) {
    cloneBtn.addEventListener('click', () => {
      console.log('[CLONE-VENTA] Preparando confirmación');

      // Recopilar datos del formulario
      cloneState.newDate = newDateInput?.value || new Date().toISOString().split('T')[0];
      cloneState.reason = document.getElementById('cr-clone-reason')?.value || '';
      cloneState.newVendor = document.getElementById('cr-clone-vendor-select')?.value || null;
      
      // Recopilar opciones
      cloneState.options = {
        resetState: document.getElementById('cr-clone-reset-state')?.checked || false,
        copyProducts: document.getElementById('cr-clone-copy-products')?.checked || false,
        copyShipping: document.getElementById('cr-clone-copy-shipping')?.checked || false
      };

      // Validar
      if (!cloneState.reason.trim()) {
        showNotificationVenta('Por favor ingrese el motivo de clonación', 'error');
        document.getElementById('cr-clone-reason')?.focus();
        return;
      }

      // Llenar modal de confirmación
      fillConfirmationModalVenta();

      // Cerrar modal de configuración y abrir confirmación
      cloneModal.hidden = true;
      confirmModal.hidden = false;
      confirmModal.setAttribute('aria-hidden', 'false');
    });
  }

  /**
   * Llenar modal de confirmación
   */
  const fillConfirmationModalVenta = () => {
    // Cotización original
    const originalFolioEl = document.getElementById('confirm-original-folio');
    if (originalFolioEl) {
      originalFolioEl.textContent = cloneState.originalQuotation?.numero_folio || 'N/A';
    }
    
    const originalClientEl = document.getElementById('confirm-original-client');
    if (originalClientEl) {
      originalClientEl.textContent = document.getElementById('cr-clone-current-client')?.textContent || 'N/A';
    }
    
    const originalTotalEl = document.getElementById('confirm-original-total');
    if (originalTotalEl) {
      originalTotalEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
        .format(cloneState.originalQuotation?.total || 0);
    }

    // Nueva cotización
    const newDateEl = document.getElementById('confirm-new-date');
    if (newDateEl) {
      newDateEl.textContent = new Date(cloneState.newDate).toLocaleDateString('es-MX');
    }
    
    const newClientEl = document.getElementById('confirm-new-client');
    if (newClientEl) {
      const newClientName = cloneState.newClient 
        ? (cloneState.newClient.nombre || cloneState.newClient.razon_social)
        : document.getElementById('cr-clone-current-client')?.textContent;
      newClientEl.textContent = newClientName || 'N/A';
    }
    
    const newStatusEl = document.getElementById('confirm-new-status');
    if (newStatusEl) {
      newStatusEl.textContent = 'Clonación';
    }

    // Opciones de clonación
    const optionsList = document.getElementById('confirm-options-list');
    if (optionsList) {
      optionsList.innerHTML = '';

      if (cloneState.options.resetState) {
        const div = document.createElement('div');
        div.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i> Resetear estado a "Borrador"';
        optionsList.appendChild(div);
      }

      if (cloneState.options.copyProducts) {
        const div = document.createElement('div');
        // Obtener cantidad de productos del carrito de venta
        const cartCount = window.state?.cart?.length || 0;
        div.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> Copiar productos seleccionados (${cartCount} productos)`;
        optionsList.appendChild(div);
      }

      if (cloneState.options.copyShipping) {
        const div = document.createElement('div');
        div.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i> Copiar configuración de envío';
        optionsList.appendChild(div);
      }
    }
    
    // Mostrar motivo
    const reasonContainer = document.getElementById('confirm-reason-container');
    const reasonText = document.getElementById('confirm-reason-text');
    if (reasonContainer && reasonText && cloneState.reason) {
      reasonText.textContent = cloneState.reason;
      reasonContainer.style.display = 'block';
    }
  };

  /**
   * Manejar confirmación de clonación
   */
  if (confirmProceedBtn) {
    confirmProceedBtn.addEventListener('click', async () => {
      try {
        console.log('[CLONE-VENTA] Iniciando proceso de clonación');
        
        // Deshabilitar botón
        confirmProceedBtn.disabled = true;
        confirmProceedBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clonando...';

        // Preparar datos para el backend
        const cloneData = {
          id_cotizacion_origen: cloneState.originalQuotation?.id_cotizacion || window.cotizacionEditandoId,
          fecha_cotizacion: cloneState.newDate,
          motivo_cambio: cloneState.reason,
          id_cliente: cloneState.newClient?.id_cliente || cloneState.newClient?.id || null,
          id_vendedor: cloneState.newVendor || null,
          resetear_estado: cloneState.options.resetState,
          copiar_productos: cloneState.options.copyProducts,
          copiar_envio: cloneState.options.copyShipping,
          es_clon: true,
          estado: 'Clonación'
        };

        console.log('[CLONE-VENTA] Datos de clonación:', cloneData);

        // Llamar al backend
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/cotizaciones/${cloneData.id_cotizacion_origen}/clonar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(cloneData)
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Error al clonar cotización');
        }

        const result = await response.json();
        console.log('[CLONE-VENTA] Cotización clonada exitosamente:', result);

        // Cerrar modales
        confirmModal.hidden = true;
        cloneModal.hidden = true;

        // Mostrar éxito
        showNotificationVenta(`Cotización clonada exitosamente: ${result.numero_folio}`, 'success');

        // Redirigir a la nueva cotización después de 2 segundos
        setTimeout(() => {
          window.location.href = `cotizacion_venta.html?edit=${result.id_cotizacion}`;
        }, 2000);

      } catch (error) {
        console.error('[CLONE-VENTA] Error en clonación:', error);
        showNotificationVenta(error.message || 'Error al clonar cotización', 'error');
        
        // Rehabilitar botón
        confirmProceedBtn.disabled = false;
        confirmProceedBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Clonación';
      }
    });
  }

  /**
   * Manejar cancelación
   */
  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', () => {
      confirmModal.hidden = true;
      cloneModal.hidden = false;
    });
  }

  // Cerrar modal de confirmación con X
  const confirmCloseBtn = document.getElementById('cr-clone-confirm-cancel');
  if (confirmCloseBtn) {
    confirmCloseBtn.addEventListener('click', () => {
      confirmModal.hidden = true;
      cloneModal.hidden = false;
    });
  }

  /**
   * Función auxiliar para mostrar notificaciones
   */
  const showNotificationVenta = (message, type = 'success') => {
    // Reutilizar función existente si está disponible
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }

    // Fallback: crear notificación simple
    const notification = document.createElement('div');
    notification.className = `cr-notification cr-notification--${type}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-weight: 500;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 4000);
  };

  console.log('[CLONE-VENTA] Funcionalidad de clonación inicializada');
};

// Inicializar al cargar
try {
  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCloneFunctionalityVenta);
  } else {
    initCloneFunctionalityVenta();
  }
} catch (error) {
  console.error('[CLONE-VENTA] Error inicializando clonación:', error);
}
