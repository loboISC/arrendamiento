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
            quotationData.id_vendedor = fullData.id_vendedor || fullData.id_usuario;
            quotationData.vendedor_nombre = fullData.vendedor_nombre || fullData.nombre_vendedor;
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

      // Asegurar que tenemos un ID de vendedor para la comparación posterior
      if (!quotationData.id_vendedor) {
        quotationData.id_vendedor = currentUser.id_usuario || currentUser.id;
      }

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
        option.value = vendedor.id_usuario; // Siempre usar id_usuario
        option.textContent = `${vendedor.nombre} (${vendedor.rol})`;
        vendorSelect.appendChild(option);
      });

      console.log('[CLONE-VENTA] Vendedores cargados:', vendedores.length);

      // Agregar validación de contraseña al cambiar vendedor
      setupVendorChangeValidationVenta(vendorSelect);
    } catch (error) {
      console.error('[CLONE-VENTA] Error cargando vendedores:', error);
    }
  };

  /**
   * Configurar validación de contraseña al cambiar vendedor
   */
  const setupVendorChangeValidationVenta = (vendorSelect) => {
    let vendorChangeApproved = false;
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const currentVendorId = cloneState.originalQuotation?.id_vendedor || currentUser.id_usuario || currentUser.id;

    vendorSelect.addEventListener('change', async (e) => {
      const newVendorId = String(e.target.value);
      const currentVId = String(currentVendorId);

      // Si no cambió, mantiene el actual, o ya fue aprobado, permitir
      if (!e.target.value || newVendorId === currentVId || vendorChangeApproved) {
        vendorChangeApproved = false; // Resetear para el próximo cambio
        return;
      }

      // Solicitar contraseña usando SweetAlert2
      const result = await Swal.fire({
        title: 'Cambio de Vendedor',
        html: `
          <p style="margin-bottom: 15px;">Para cambiar el vendedor de esta cotización, ingrese su contraseña:</p>
          <input type="password" id="swal-password" class="swal2-input" placeholder="Contraseña" style="margin: 0;">
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-check"></i> Validar',
        cancelButtonText: '<i class="fa-solid fa-xmark"></i> Cancelar',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#ef4444',
        focusConfirm: false,
        didOpen: () => {
          const container = Swal.getContainer();
          if (container) {
            container.style.setProperty('z-index', '10000010', 'important');
          }
          // Bajar temporalmente el modal de clonación para evitar solapamiento
          if (cloneModal) {
            cloneModal.style.setProperty('z-index', '10000', 'important');
            // Safe fallback: asegurar que se baje después de cualquier animación/reflow
            setTimeout(() => {
              if (cloneModal) cloneModal.style.setProperty('z-index', '10000', 'important');
            }, 50);
          }
        },
        willClose: () => {
          // Restaurar el modal de clonación
          if (cloneModal) {
            cloneModal.style.setProperty('z-index', '1000000', 'important');
            setTimeout(() => {
              if (cloneModal) cloneModal.style.setProperty('z-index', '1000000', 'important');
            }, 50);
          }
        },
        preConfirm: () => {
          const password = document.getElementById('swal-password').value;
          if (!password) {
            Swal.showValidationMessage('Por favor ingrese su contraseña');
            return false;
          }
          return password;
        }
      });

      if (result.isConfirmed && result.value) {
        // Validar contraseña
        const isValid = await validatePasswordVenta(result.value);

        if (isValid) {
          vendorChangeApproved = true;
          showNotificationVenta('Cambio de vendedor autorizado', 'success');
        } else {
          // Revertir selección
          e.target.value = '';
          showNotificationVenta('Contraseña incorrecta', 'error');
        }
      } else {
        // Canceló, revertir
        e.target.value = '';
      }
    });
  };

  /**
   * Validar contraseña del usuario actual
   */
  const validatePasswordVenta = async (password) => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        console.error('[CLONE-VENTA] Error validando contraseña:', response.status);
        return false;
      }

      const result = await response.json();
      return result.valid === true;
    } catch (error) {
      console.error('[CLONE-VENTA] Error validando contraseña:', error);
      return false;
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
        // --- RELOCALIZACIÓN PARA CAPAS (CRÍTICO) ---
        // Al igual que el script original, movemos el modal al body para que no quede atrapado
        // en el contexto de apilamiento de 'main'.
        if (clientModal.parentNode !== document.body) {
          document.body.appendChild(clientModal);
        }

        // Asegurar que el selector esté por encima de todo (incluyendo el modal de clonación que suele estar en 999999 !important)
        clientModal.style.setProperty('z-index', '10000005', 'important');

        // Bajar temporalmente el modal de clonación principal de forma agresiva
        if (cloneModal) {
          cloneModal.style.setProperty('z-index', '10000', 'important');
          // Redundancia con delay por si el navegador ignora el primer cambio por transiciones CSS
          setTimeout(() => {
            if (cloneModal) cloneModal.style.setProperty('z-index', '10000', 'important');
          }, 100);
        }

        // Replicar posicionamiento del script original para consistencia visual
        try {
          const dlg = clientModal.querySelector('.cr-modal__dialog');
          if (dlg) {
            dlg.style.top = '10px';
            dlg.style.left = '50%';
            dlg.style.transform = 'translateX(-50%)';
            dlg.style.position = 'fixed';
            dlg.style.zIndex = '10000006';
          }
        } catch (e) { console.warn('[CLONE-VENTA] No se pudo posicionar el diálogo:', e); }

        clientModal.hidden = false;
        clientModal.setAttribute('aria-hidden', 'false');

        // Marcar que estamos en modo clonación para filtros internos de eventos
        clientModal.setAttribute('data-clone-mode', 'true');
        sessionStorage.setItem('selecting-client-for-clone', 'true');

        // Función de limpieza común
        const cleanupLayering = () => {
          if (cloneModal) {
            cloneModal.style.setProperty('z-index', '1000000', 'important');
            setTimeout(() => {
              if (cloneModal) cloneModal.style.setProperty('z-index', '1000000', 'important');
            }, 50);
          }
          clientModal.removeAttribute('data-clone-mode');
          sessionStorage.removeItem('selecting-client-for-clone');
        };

        // Escuchar selección de cliente con captura para adelantarnos a cotizacion_venta.js
        const handleClientSelection = (event) => {
          try {
            const msg = event.data;
            if (!msg) return;

            // Tipos de mensaje que aceptamos (estándar y el especial de clonación que envía clientes.js)
            const acceptedTypes = ['select-client', 'cliente-seleccionado', 'CLIENT_SELECTED_FOR_CLONE'];
            if (!acceptedTypes.includes(msg.type)) return;

            console.log('[CLONE-VENTA] Mensaje de selección recibido:', msg.type, msg);

            // ¡IMPORTANTE! Detener propagación para que cotizacion_venta.js no abra su modal de detalles
            event.stopImmediatePropagation();
            if (event.cancelable) event.preventDefault();

            // Extraer datos (pueden venir en payload, data, o clientData dependiendo de quién envíe)
            const clientData = msg.clientData || msg.payload || msg.data;
            if (!clientData) {
              console.warn('[CLONE-VENTA] Mensaje de selección sin datos:', msg);
              return;
            }

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

            // Restaurar capas
            cleanupLayering();

            // Remover listener
            window.removeEventListener('message', handleClientSelection, true);

            console.log('[CLONE-VENTA] Nuevo cliente seleccionado:', clientData);
            showNotificationVenta('Cliente seleccionado correctamente', 'success');
          } catch (err) {
            console.error('[CLONE-VENTA] Error procesando selección de cliente:', err);
          }
        };

        window.addEventListener('message', handleClientSelection, true);

        // Si cierran el buscador sin elegir cliente (clic fuera, etc)
        const checkClosed = setInterval(() => {
          if (clientModal.hidden || clientModal.getAttribute('aria-hidden') === 'true') {
            cleanupLayering();
            window.removeEventListener('message', handleClientSelection, true);
            clearInterval(checkClosed);
          }
        }, 500);
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
    cloneBtn.addEventListener('click', async () => {
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

      // Obtener el siguiente folio que se generará (Para Venta)
      try {
        if (typeof window.getNextQuoteNumberVenta === 'function') {
          cloneState.nextFolio = await window.getNextQuoteNumberVenta();
        } else {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/cotizaciones/siguiente-numero?tipo=VENTA', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            cloneState.nextFolio = data.numero_cotizacion || data.numero_folio || data.siguiente_numero;
          }
        }
        console.log('[CLONE-VENTA] Siguiente folio a generar:', cloneState.nextFolio);
      } catch (error) {
        console.error('[CLONE-VENTA] Error obteniendo siguiente folio:', error);
        cloneState.nextFolio = 'VEN-XXXX-XXXX';
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

    // Mostrar el nuevo folio que se generará
    const newFolioEl = document.getElementById('confirm-new-folio');
    if (newFolioEl) {
      newFolioEl.textContent = cloneState.nextFolio || 'Se generará automáticamente';
      if (cloneState.nextFolio && cloneState.nextFolio !== 'VEN-XXXX-XXXX') {
        newFolioEl.style.fontWeight = 'bold';
        newFolioEl.style.color = '#10b981';
      }
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

        // Preparar datos para el backend (usando nombres de campos que espera el controlador)
        const cloneData = {
          id: cloneState.originalQuotation?.id_cotizacion || window.cotizacionEditandoId,
          nueva_fecha: cloneState.newDate,
          motivo_clonacion: cloneState.reason,
          nuevo_cliente_id: cloneState.newClient?.id_cliente || cloneState.newClient?.id || null,
          nuevo_vendedor_id: cloneState.newVendor || null,
          resetear_estado: cloneState.options.resetState,
          copiar_productos: cloneState.options.copyProducts,
          copiar_envio: cloneState.options.copyShipping
        };

        console.log('[CLONE-VENTA] Datos de clonación:', cloneData);

        // Llamar al backend
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/cotizaciones/${cloneData.id}/clonar`, {
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
        console.log('[CLONE-VENTA] Resultado completo del servidor:', result);

        // EXTRAER EL ID DEL CLON DE FORMA ESTRICTA
        // No usamos fallbacks a 'result' porque el servidor envía el clon dentro de 'clon'
        const originalId = String(cloneData.id);
        const clonedQuotation = result.clon;

        let clonedId = null;
        if (clonedQuotation) {
          clonedId = String(clonedQuotation.id_cotizacion || clonedQuotation.id);
        }

        console.log('[CLONE-VENTA] ID Original:', originalId, 'ID Clon detectado:', clonedId);

        // Si por alguna razón el ID detectado es el mismo que el original, ignorar y avisar
        if (clonedId === originalId) {
          console.warn('[CLONE-VENTA] El servidor devolvió el mismo ID original. Abortando redirección automática.');
          showNotificationVenta('La cotización se clonó, pero el sistema detectó el mismo ID original. Por favor, abre la nueva desde la lista.', 'warning');
          return;
        }

        const novoFolio = clonedQuotation ? (clonedQuotation.numero_folio || clonedQuotation.numero_cotizacion) : '';

        // Cerrar modales
        confirmModal.hidden = true;
        cloneModal.hidden = true;

        // Mostrar éxito
        showNotificationVenta(`Cotización clonada exitosamente: ${novoFolio || ''}`, 'success');

        // IMPORTANTE: Limpiar el caché de edición para forzar la carga de los datos nuevos del clon
        sessionStorage.removeItem('cotizacionParaEditar');

        // Sincronizar con el comportamiento de Rentas: Abrir nueva y cerrar actual
        setTimeout(() => {
          if (clonedId && clonedId !== 'undefined' && clonedId !== 'null') {
            const editUrl = `cotizacion_venta.html?edit=${clonedId}`;
            console.log('[CLONE-VENTA] Redirigiendo a nueva cotización:', editUrl);

            // Intentar abrir la nueva
            window.open(editUrl, '_blank');

            // Cerrar la actual (original)
            if (window.opener && !window.opener.closed) {
              window.close();
            } else {
              // Si no hay opener, redirigir la misma ventana
              window.location.href = editUrl;
            }
          } else {
            console.error('[CLONE-VENTA] No se encontró un ID de clon válido en la respuesta:', result);
            showNotificationVenta('Clonación exitosa, pero no se pudo redirigir automáticamente. Por favor busca el folio ' + (novoFolio || '') + ' en la lista.', 'info');
          }
        }, 1000);

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
