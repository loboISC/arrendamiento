/**
 * CLONACIÓN DE COTIZACIONES - MÓDULO DE VENTA
 * Gestiona la clonación de cotizaciones existentes con validaciones
 */

const initCloneFunctionalityVenta = (() => {
  'use strict';

  console.log('[CLONE-VENTA] Inicializando funcionalidad de clonación');

  // ============================================================================
  // CONFIGURACIÓN Y SELECTORES DOM
  // ============================================================================

  const CONFIG = {
    API_BASE: '/api',
    MODAL_Z_INDEX: 1000000,
    CLIENT_SELECTOR_Z_INDEX: 10000005,
    NOTIFICATION_TIMEOUT_MS: 4000
  };

  const DOM_IDS = {
    // Modales
    cloneModal: 'cr-clone-modal',
    confirmModal: 'cr-clone-confirm-modal',
    // Botones
    selectClientBtn: 'cr-clone-select-client',
    keepClientBtn: 'cr-clone-keep-client',
    selectAllBtn: 'cr-clone-select-all',
    cloneBtn: 'cr-clone-btn',
    confirmProceedBtn: 'cr-clone-confirm-proceed',
    confirmCancelBtn: 'cr-clone-confirm-cancel-btn',
    // Campos
    newDateInput: 'cr-clone-new-date',
    reasonInput: 'cr-clone-reason',
    vendorSelect: 'cr-clone-vendor-select',
    // Checkboxes
    resetStateChk: 'cr-clone-reset-state',
    copyProductsChk: 'cr-clone-copy-products',
    copyShippingChk: 'cr-clone-copy-shipping',
    // Información de cliente
    currentClientEl: 'cr-clone-current-client',
    currentVendorEl: 'cr-clone-current-vendor',
    selectedClientDiv: 'cr-clone-selected-client',
    newClientName: 'cr-clone-new-client-name',
    // Información de cotización original
    originalFolio: 'confirm-original-folio',
    originalClient: 'confirm-original-client',
    originalTotal: 'confirm-original-total',
    // Nueva cotización
    newDate: 'confirm-new-date',
    newClient: 'confirm-new-client',
    newFolio: 'confirm-new-folio',
    optionsList: 'confirm-options-list',
    reasonContainer: 'confirm-reason-container',
    reasonText: 'confirm-reason-text'
  };

  // ============================================================================
  // ESTADO INTERNO
  // ============================================================================

  let cloneState = {
    originalQuotation: null,
    newClient: null,
    keepOriginalClient: true,
    newVendor: null,
    newDate: null,
    reason: '',
    nextFolio: null,
    options: {
      resetState: false,
      copyProducts: false,
      copyShipping: false
    }
  };

  // ============================================================================
  // UTILIDADES GENERALES
  // ============================================================================

  /**
   * Obtiene elemento por ID
   */
  function getElement(id) {
    return document.getElementById(id);
  }

  /**
   * Muestra notificación
   */
  function showNotification(message, type = 'success') {
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed; top: 20px; right: 20px; 
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white; padding: 12px 20px; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 10000;
      font-weight: 500; max-width: 400px; animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.parentNode?.removeChild(notification), 300);
    }, CONFIG.NOTIFICATION_TIMEOUT_MS);
  }

  /**
   * Valida contraseña del usuario
   */
  async function validatePassword(password) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${CONFIG.API_BASE}/auth/verify-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password })
      });
      const result = await response.json();
      return result.valid === true;
    } catch (error) {
      console.error('[validatePassword] Error:', error);
      return false;
    }
  }

  /**
   * Carga lista de vendedores desde API
   */
  async function loadVendors() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${CONFIG.API_BASE}/usuarios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error cargando vendedores');

      const usuarios = await response.json();
      const vendorSelect = getElement(DOM_IDS.vendorSelect);

      if (!vendorSelect) return;

      vendorSelect.innerHTML = '<option value="">Mantener vendedor actual</option>';

      const vendedores = usuarios.filter(u =>
        ['Rentas', 'Ventas', 'director general', 'Administrador'].includes(u.rol)
      );

      vendedores.forEach(vendedor => {
        const option = document.createElement('option');
        option.value = vendedor.id_usuario;
        option.textContent = `${vendedor.nombre} (${vendedor.rol})`;
        vendorSelect.appendChild(option);
      });

      console.log('[loadVendors] Cargados:', vendedores.length);
      setupVendorChangeValidation(vendorSelect);
    } catch (error) {
      console.error('[loadVendors] Error:', error);
    }
  }

  /**
   * Configura validación al cambiar vendedor
   */
  function setupVendorChangeValidation(vendorSelect) {
    let vendorChangeApproved = false;
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentVendorId = cloneState.originalQuotation?.id_vendedor || currentUser.id_usuario || currentUser.id;

    vendorSelect.addEventListener('change', async (e) => {
      const newVendorId = String(e.target.value);
      const currentVId = String(currentVendorId);

      if (!e.target.value || newVendorId === currentVId || vendorChangeApproved) {
        vendorChangeApproved = false;
        return;
      }

      const result = await Swal.fire({
        title: 'Cambio de Vendedor',
        html: `
          <p style="margin-bottom: 15px;">Para cambiar el vendedor, ingrese su contraseña:</p>
          <input type="password" id="swal-password" class="swal2-input" placeholder="Contraseña">
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-check"></i> Validar',
        cancelButtonText: '<i class="fa-solid fa-xmark"></i> Cancelar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#ef4444',
        preConfirm: () => {
          const password = document.getElementById('swal-password')?.value;
          if (!password) {
            Swal.showValidationMessage('Por favor ingrese su contraseña');
            return false;
          }
          return password;
        }
      });

      if (result.isConfirmed && result.value) {
        const isValid = await validatePassword(result.value);
        if (isValid) {
          vendorChangeApproved = true;
          showNotification('Cambio de vendedor autorizado', 'success');
        } else {
          e.target.value = '';
          showNotification('Contraseña incorrecta', 'error');
        }
      } else {
        e.target.value = '';
      }
    });
  }

  // ============================================================================
  // LLENADO DE MODALES
  // ============================================================================

  /**
   * Llena modal de clonación con datos actuales
   */
  async function fillCloneModal(externalQuotation = null) {
    try {
      console.log('[fillCloneModal] Llenando modal');

      let quotationData = {
        id_cotizacion: window.cotizacionEditandoId,
        numero_folio: getElement('v-quote-number')?.value || 'VEN-XXXX-XXXXXX',
        total: 0,
        fecha_creacion: getElement('v-quote-date')?.value || new Date().toISOString().split('T')[0]
      };

      if (externalQuotation) {
        quotationData = {
          ...quotationData,
          ...externalQuotation,
          id_cotizacion: externalQuotation.id_cotizacion || externalQuotation.id
        };
      } else {
        try {
          const totalElement = getElement('cr-grand-total') || getElement('cr-total');
          if (totalElement) {
            const totalText = totalElement.textContent.replace(/[^0-9.-]+/g, '');
            quotationData.total = parseFloat(totalText) || 0;
          }

          if (window.cotizacionEditandoId) {
            const token = localStorage.getItem('token');
            const response = await fetch(`${CONFIG.API_BASE}/cotizaciones/${window.cotizacionEditandoId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
              const fullData = await response.json();
              quotationData = { ...quotationData, ...fullData };
            }
          }
        } catch (error) {
          console.error('[fillCloneModal] Error consultando API:', error);
        }
      }

      cloneState.originalQuotation = quotationData;

      // Actualizar UI
      const folioEl = document.querySelector('[data-chip-folio]');
      if (folioEl) folioEl.textContent = quotationData.numero_folio || 'VEN-XXXX-XXXXXX';

      const totalEl = document.querySelector('[data-chip-total]');
      if (totalEl) {
        totalEl.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
          .format(quotationData.total || 0);
      }

      const fechaEl = document.querySelector('[data-chip-fecha-original]');
      if (fechaEl) {
        fechaEl.textContent = new Date(quotationData.fecha_creacion).toLocaleDateString('es-MX');
      }

      const clientName = quotationData.cliente_nombre || quotationData.contacto_nombre || 'No especificado';
      if (getElement(DOM_IDS.currentClientEl)) {
        getElement(DOM_IDS.currentClientEl).textContent = clientName;
      }

      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const vendorName = quotationData.vendedor_nombre || currentUser.nombre || 'No asignado';
      if (getElement(DOM_IDS.currentVendorEl)) {
        getElement(DOM_IDS.currentVendorEl).textContent = vendorName;
      }

      if (!quotationData.id_vendedor) {
        quotationData.id_vendedor = currentUser.id_usuario || currentUser.id;
      }

      if (getElement(DOM_IDS.newDateInput)) {
        getElement(DOM_IDS.newDateInput).value = new Date().toISOString().split('T')[0];
      }

      await loadVendors();

      const modal = getElement(DOM_IDS.cloneModal);
      if (modal) {
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
      }

      console.log('[fillCloneModal] Modal llenado correctamente');
    } catch (error) {
      console.error('[fillCloneModal] Error:', error);
      showNotification('Error al preparar la clonación', 'error');
    }
  }

  /**
   * Llena modal de confirmación
   */
  function fillConfirmationModal() {
    const quotation = cloneState.originalQuotation;

    if (getElement(DOM_IDS.originalFolio)) {
      getElement(DOM_IDS.originalFolio).textContent = quotation?.numero_folio || 'N/A';
    }

    if (getElement(DOM_IDS.originalClient)) {
      getElement(DOM_IDS.originalClient).textContent = getElement(DOM_IDS.currentClientEl)?.textContent || 'N/A';
    }

    if (getElement(DOM_IDS.originalTotal)) {
      getElement(DOM_IDS.originalTotal).textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
        .format(quotation?.total || 0);
    }

    if (getElement(DOM_IDS.newDate)) {
      getElement(DOM_IDS.newDate).textContent = new Date(cloneState.newDate).toLocaleDateString('es-MX');
    }

    if (getElement(DOM_IDS.newClient)) {
      const newClientName = cloneState.newClient
        ? (cloneState.newClient.nombre || cloneState.newClient.razon_social)
        : getElement(DOM_IDS.currentClientEl)?.textContent;
      getElement(DOM_IDS.newClient).textContent = newClientName || 'N/A';
    }

    if (getElement(DOM_IDS.newFolio)) {
      getElement(DOM_IDS.newFolio).textContent = cloneState.nextFolio || 'Se generará automáticamente';
      if (cloneState.nextFolio && cloneState.nextFolio !== 'VEN-XXXX-XXXX') {
        getElement(DOM_IDS.newFolio).style.fontWeight = 'bold';
        getElement(DOM_IDS.newFolio).style.color = '#10b981';
      }
    }

    if (getElement(DOM_IDS.optionsList)) {
      getElement(DOM_IDS.optionsList).innerHTML = '';

      if (cloneState.options.resetState) {
        const div = document.createElement('div');
        div.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i> Resetear estado';
        getElement(DOM_IDS.optionsList).appendChild(div);
      }

      if (cloneState.options.copyProducts) {
        const div = document.createElement('div');
        const count = window.state?.cart?.length || 0;
        div.innerHTML = `<i class="fa-solid fa-check" style="color: #10b981;"></i> Copiar ${count} productos`;
        getElement(DOM_IDS.optionsList).appendChild(div);
      }

      if (cloneState.options.copyShipping) {
        const div = document.createElement('div');
        div.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i> Copiar envío';
        getElement(DOM_IDS.optionsList).appendChild(div);
      }
    }

    if (getElement(DOM_IDS.reasonContainer) && getElement(DOM_IDS.reasonText)) {
      if (cloneState.reason) {
        getElement(DOM_IDS.reasonText).textContent = cloneState.reason;
        getElement(DOM_IDS.reasonContainer).style.display = 'block';
      }
    }
  }

  // ============================================================================
  // Process DE CLONACIÓN
  // ============================================================================

  /**
   * Ejecuta clonación en backend
   */
  async function executeCloning() {
    try {
      console.log('[executeCloning] Iniciando clonación');
      const proceedBtn = getElement(DOM_IDS.confirmProceedBtn);

      if (proceedBtn) {
        proceedBtn.disabled = true;
        proceedBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clonando...';
      }

      const cloneData = {
        id: cloneState.originalQuotation.id_cotizacion || window.cotizacionEditandoId,
        nueva_fecha: cloneState.newDate,
        motivo_clonacion: cloneState.reason,
        nuevo_cliente_id: cloneState.newClient?.id_cliente || cloneState.newClient?.id || null,
        nuevo_vendedor_id: cloneState.newVendor || null,
        resetear_estado: cloneState.options.resetState,
        copiar_productos: cloneState.options.copyProducts,
        copiar_envio: cloneState.options.copyShipping
      };

      const token = localStorage.getItem('token');
      const response = await fetch(`${CONFIG.API_BASE}/cotizaciones/${cloneData.id}/clonar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cloneData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al clonar');
      }

      const result = await response.json();
      const clonedQuotation = result.clon;
      const clonedId = clonedQuotation?.id_cotizacion || clonedQuotation?.id;
      const newFolio = clonedQuotation?.numero_folio || clonedQuotation?.numero_cotizacion || '';

      getElement(DOM_IDS.cloneModal).hidden = true;
      getElement(DOM_IDS.confirmModal).hidden = true;

      showNotification(`Clonada: ${newFolio}`, 'success');
      sessionStorage.removeItem('cotizacionParaEditar');

      setTimeout(() => {
        if (clonedId) {
          window.open(`cotizacion_venta.html?edit=${clonedId}`, '_blank');
          if (window.opener && !window.opener.closed) {
            window.close();
          } else {
            window.location.href = `cotizacion_venta.html?edit=${clonedId}`;
          }
        }
      }, 1000);

    } catch (error) {
      console.error('[executeCloning] Error:', error);
      showNotification(`Error: ${error.message}`, 'error');
      const proceedBtn = getElement(DOM_IDS.confirmProceedBtn);
      if (proceedBtn) {
        proceedBtn.disabled = false;
        proceedBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirmar Clonación';
      }
    }
  }

  // ============================================================================
  // EVENT LISTENERS BINDING
  // ============================================================================

  /**
   * Vincula todos los event listeners
   */
  function bindAllEvents() {
    // Botón seleccionar cliente
    const selectClientBtn = getElement(DOM_IDS.selectClientBtn);
    if (selectClientBtn) {
      selectClientBtn.addEventListener('click', () => {
        console.log('[selectClientBtn] Click');
        const clientModal = getElement('v-client-modal');
        if (clientModal) {
          if (clientModal.parentNode !== document.body) {
            document.body.appendChild(clientModal);
          }
          clientModal.style.setProperty('z-index', `${CONFIG.CLIENT_SELECTOR_Z_INDEX}`, 'important');
          getElement(DOM_IDS.cloneModal).style.setProperty('z-index', '10000', 'important');
          clientModal.hidden = false;
        }
      });
    }

    // Botón mantener cliente
    const keepClientBtn = getElement(DOM_IDS.keepClientBtn);
    if (keepClientBtn) {
      keepClientBtn.addEventListener('click', () => {
        cloneState.newClient = null;
        cloneState.keepOriginalClient = true;
        const selectedDiv = getElement(DOM_IDS.selectedClientDiv);
        if (selectedDiv) selectedDiv.style.display = 'none';
        showNotification('Se mantendrá el cliente original', 'success');
      });
    }

    // Botón clonar
    const cloneBtn = getElement(DOM_IDS.cloneBtn);
    if (cloneBtn) {
      cloneBtn.addEventListener('click', async () => {
        const reasonInput = getElement(DOM_IDS.reasonInput);
        if (!reasonInput?.value?.trim()) {
          showNotification('Por favor ingrese el motivo de clonación', 'error');
          reasonInput?.focus();
          return;
        }

        cloneState.newDate = getElement(DOM_IDS.newDateInput)?.value;
        cloneState.reason = reasonInput.value;
        cloneState.newVendor = getElement(DOM_IDS.vendorSelect)?.value || null;
        cloneState.options = {
          resetState: getElement(DOM_IDS.resetStateChk)?.checked || false,
          copyProducts: getElement(DOM_IDS.copyProductsChk)?.checked || false,
          copyShipping: getElement(DOM_IDS.copyShippingChk)?.checked || false
        };

        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${CONFIG.API_BASE}/cotizaciones/siguiente-numero?tipo=VENTA`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            cloneState.nextFolio = data.numero_cotizacion || data.siguiente_numero;
          }
        } catch (error) {
          console.error('[cloneBtn] Error obteniendo folio:', error);
          cloneState.nextFolio = 'VEN-XXXX-XXXX';
        }

        fillConfirmationModal();
        getElement(DOM_IDS.cloneModal).hidden = true;
        getElement(DOM_IDS.confirmModal).hidden = false;
        getElement(DOM_IDS.confirmModal).setAttribute('aria-hidden', 'false');
      });
    }

    // Botón confirmar clonación
    const proceedBtn = getElement(DOM_IDS.confirmProceedBtn);
    if (proceedBtn) {
      proceedBtn.addEventListener('click', executeCloning);
    }

    // Botón cancelar
    const cancelBtn = getElement(DOM_IDS.confirmCancelBtn);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        getElement(DOM_IDS.confirmModal).hidden = true;
        getElement(DOM_IDS.cloneModal).hidden = false;
      });
    }
  }

  // ============================================================================
  // EXPOSICIÓN GLOBAL
  // ============================================================================

  window.fillCloneModalWithCurrentQuotation = fillCloneModal;

  // ============================================================================
  // INICIALIZACIÓN
  // ============================================================================

  return () => {
    console.log('[initCloneFunctionalityVenta] Inicializando');
    bindAllEvents();
  };
})();

// Auto-inicializar
try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCloneFunctionalityVenta);
  } else {
    initCloneFunctionalityVenta();
  }
} catch (error) {
  console.error('[initCloneFunctionalityVenta] Error:', error);
}
