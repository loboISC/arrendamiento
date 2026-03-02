// API URL para clientes
const CLIENTES_URL = '/api/clientes';

let clientesFuente = [];
let currentView = 'grid'; // 'grid' | 'list'
let adminCreditAuthorized = false; // bandera para controlar autorización de crédito

// Deshabilita los campos de crédito y evaluación en el formulario
function disableCreditSection() {
  const ids = [
    'nc-limite-credito','nc-deuda-actual','nc-terminos-pago',
    'nc-dias-credito','nc-metodo-pago',
    'nc-cal-general','nc-cal-pago','nc-cal-comunicacion',
    'nc-cal-equipos','nc-cal-satisfaccion',
    'nc-fecha-evaluacion','nc-notas-evaluacion','nc-notas-generales'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.setAttribute('readonly', 'readonly');
      if (el.tagName === 'SELECT') el.setAttribute('disabled', 'disabled');
    }
  });
}

// Habilita los campos tras obtener autorización
function enableCreditSection() {
  const ids = [
    'nc-limite-credito','nc-deuda-actual','nc-terminos-pago',
    'nc-dias-credito','nc-metodo-pago',
    'nc-cal-general','nc-cal-pago','nc-cal-comunicacion',
    'nc-cal-equipos','nc-cal-satisfaccion',
    'nc-fecha-evaluacion','nc-notas-evaluacion','nc-notas-generales'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.removeAttribute('readonly');
      if (el.tagName === 'SELECT') el.removeAttribute('disabled');
    }
  });
}

// Solicita contraseña de administrador usando SweetAlert y verifica con API
async function solicitarPasswordAdminCredit() {
  const { value: password } = await Swal.fire({
    title: 'Autorización de Administrador',
    input: 'password',
    inputPlaceholder: 'Ingrese contraseña de administrador',
    showCancelButton: true,
    confirmButtonText: 'Verificar',
    cancelButtonText: 'Cancelar',
    inputAttributes: {
      autocapitalize: 'off',
      autocorrect: 'off'
    }
  });

  if (!password) return false;

  try {
    const res = await fetch('/api/auth/verify-admin-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      adminCreditAuthorized = true;
      enableCreditSection();
      showMessage('Autorización concedida', 'success');
      return true;
    } else {
      await Swal.fire('Error', 'Contraseña incorrecta', 'error');
      return false;
    }
  } catch (e) {
    console.error('Error verificando admin password:', e);
    await Swal.fire('Error', 'No se pudo verificar la contraseña', 'error');
    return false;
  }
}

// Reinicia bandera y bloquea seccion cuando se abre el modal
function prepararModalCredito() {
  console.log('prepararModalCredito: reset autorización y bloqueo');
  adminCreditAuthorized = false;
  disableCreditSection();
}

function normalizarTexto(value) {
  return String(value || '').trim().toLowerCase();
}

function obtenerRatingCliente(cliente) {
  const raw = (cliente && (cliente.cal_general ?? cliente.calificacion_general ?? cliente.rating ?? cliente.calificacion)) ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function leerFiltrosClientesDesdeUI() {
  const elTipo = document.getElementById('clientes-filter-tipo');
  const elEstado = document.getElementById('clientes-filter-estado');
  const elCiudad = document.getElementById('clientes-filter-ciudad');
  const elRating = document.getElementById('clientes-filter-rating');

  return {
    tipo: elTipo ? String(elTipo.value || '') : '',
    estado: elEstado ? String(elEstado.value || '') : '',
    ciudad: elCiudad ? String(elCiudad.value || '') : '',
    ratingMin: elRating && elRating.value !== '' ? Number(elRating.value) : null
  };
}

function actualizarContadorFiltrosClientes(filtrados, total) {
  const el = document.getElementById('clientes-filtros-contador');
  if (!el) return;
  const nFiltrados = Array.isArray(filtrados) ? filtrados.length : 0;
  const nTotal = Array.isArray(total) ? total.length : 0;
  el.textContent = `${nFiltrados} de ${nTotal} clientes`;
}

function aplicarFiltrosClientesYRender() {
  const filtros = leerFiltrosClientesDesdeUI();
  const tipoQ = normalizarTexto(filtros.tipo);
  const estadoQ = normalizarTexto(filtros.estado);
  const ciudadQ = normalizarTexto(filtros.ciudad);
  const ratingMin = filtros.ratingMin;

  const filtrados = (Array.isArray(clientesFuente) ? clientesFuente : []).filter(c => {
    if (tipoQ) {
      const tipoC = normalizarTexto(c?.tipo_cliente ?? c?.tipo ?? '');
      if (tipoC !== tipoQ) return false;
    }

    if (estadoQ) {
      const estadoC = normalizarTexto(c?.estado ?? '');
      if (estadoC !== estadoQ) return false;
    }

    if (ciudadQ) {
      const ciudadC = normalizarTexto(c?.ciudad ?? c?.estado_direccion ?? c?.direccion ?? '');
      if (!ciudadC.includes(ciudadQ)) return false;
    }

    if (ratingMin !== null && Number.isFinite(ratingMin)) {
      const rating = obtenerRatingCliente(c);
      if (rating < ratingMin) return false;
    }

    return true;
  });

  actualizarContadorFiltrosClientes(filtrados, clientesFuente);
  mostrarClientes(filtrados);
}

function setClientesFuenteYRender(clientes) {
  clientesFuente = Array.isArray(clientes) ? clientes : [];

  // Ordenar clientes por fecha de creación descendente (más recientes primero)
  clientesFuente.sort((a, b) => {
    const fechaA = new Date(a.fecha_creacion || a.fecha_registro || 0);
    const fechaB = new Date(b.fecha_creacion || b.fecha_registro || 0);
    return fechaB - fechaA; // Descendente: más reciente primero
  });

  aplicarFiltrosClientesYRender();
}

// Función para verificar autenticación
function checkAuth() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = 'login.html';
    return false;
  }
  return token;
}

// Función para obtener headers con autenticación
function getAuthHeaders() {
  const token = checkAuth();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Función para mostrar mensajes
function showMessage(msg, type = 'success') {
  let el = document.getElementById('msg-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'msg-toast';
    el.style.position = 'fixed';
    el.style.top = '32px';
    el.style.right = '32px';
    el.style.zIndex = '9999';
    el.style.padding = '16px 28px';
    el.style.borderRadius = '10px';
    el.style.fontSize = '1.1rem';
    el.style.fontWeight = '600';
    el.style.boxShadow = '0 2px 12px #2979ff22';
    el.style.transition = 'opacity 0.3s';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = type === 'success' ? '#e6f9f0' : '#fdeaea';
  el.style.color = type === 'success' ? '#1abc9c' : '#f44336';
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 2500);
}

// Función para cargar clientes
async function cargarClientes() {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(CLIENTES_URL, { headers });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Error al cargar clientes');
    }

    const clientes = await response.json();
    setClientesFuenteYRender(clientes);
  } catch (error) {
    console.error('Error al cargar clientes:', error);
    showMessage('Error al cargar clientes', 'error');
  }
}

function mostrarClientes(clientes) {
  const clientesList = document.getElementById('clientes-list');
  if (!clientesList) return;
  const isPickMode = new URLSearchParams(location.search).get('pick') === '1';

  if (!Array.isArray(clientes) || clientes.length === 0) {
    clientesList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-users"></i>
        <h3>No hay clientes registrados</h3>
        <p>Comienza agregando tu primer cliente</p>
        <button class="btn btn-primary" onclick="document.querySelector('.add-btn').click()">
          <i class="fas fa-plus"></i> Agregar Cliente
        </button>
      </div>
    `;
    return;
  }

  clientesList.innerHTML = '';

  if (currentView === 'list') {
    // === LIST VIEW (TABLE) ===
    const tableWrap = document.createElement('div');
    tableWrap.style.overflowX = 'auto'; // Ensure responsive scroll

    const table = document.createElement('table');
    table.className = 'clients-list-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width: 50px;">ID</th>
          <th>Cliente / Empresa</th>
          <th>Contacto</th>
          <th>Ubicación</th>
          <th>Detalles</th>
          <th style="text-align:center;">Estado</th>
          ${isPickMode ? '<th style="text-align:right;">Seleccionar</th>' : '<th style="text-align:right;">Acciones</th>'}
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    clientes.forEach(cliente => {
      const tr = document.createElement('tr');
      tr.className = 'client-row';
      if (isPickMode) { tr.style.cursor = 'pointer'; tr.title = 'Seleccionar cliente'; }

      // Data attributes for selection (copied from grid)
      const attrs = {
        'id': cliente.id_cliente,
        'nombre': cliente.nombre,
        'empresa': cliente.empresa,
        'email': cliente.email,
        'telefono': cliente.telefono,
        'rfc': cliente.rfc,
        'direccion': cliente.direccion,
        'ciudad': cliente.ciudad,
        'codigo-postal': cliente.codigo_postal,
        'estado': cliente.estado_direccion,
        'tipo-cliente': cliente.tipo_cliente,
        'limite-credito': cliente.limite_credito || '0',
        'dias-credito': cliente.dias_credito || '30',
        'deuda-actual': cliente.deuda_actual || '0',
        'metodo-pago': cliente.metodo_pago,
        'calificacion-general': cliente.calificacion_general || '5',
        'calificacion-pago': cliente.calificacion_pago || '5',
        'calificacion-comunicacion': cliente.calificacion_comunicacion || '5',
        'calificacion-equipos': cliente.calificacion_equipos || '5',
        'notas': cliente.notas_generales || cliente.comentario
      };

      Object.entries(attrs).forEach(([k, v]) => tr.setAttribute(`data-${k}`, String(v || '')));

      // Status Badge Logic
      const statusClass = (cliente.estado || 'Activo').toLowerCase() === 'activo' ? 'cl-status-active' : 'cl-status-inactive';

      // Type Badge Logic
      let typeClass = 'cl-badge-regular';
      const cType = (cliente.tipo_cliente || '').toLowerCase();
      if (cType.includes('corporativo') || cType.includes('grande')) typeClass = 'cl-badge-corp';
      if (cType.includes('premium')) typeClass = 'cl-badge-premium';

      tr.innerHTML = `
        <td style="font-weight: bold; color: #64748b;">
           #${cliente.id_cliente || '-'}
        </td>
        <td>
          <div style="display:flex;align-items:center;">
             <div class="cl-avatar-tiny" style="background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#94a3b8;"><i class="fas fa-user"></i></div>
             <div>
               <span class="cl-primary-text">${cliente.nombre || '-'}</span>
               <span class="cl-secondary-text">${cliente.empresa || 'Empresa no especificada'}</span>
             </div>
          </div>
        </td>
        <td>
           <i class="fas fa-envelope" style="color:#94a3b8;margin-right:4px;"></i> ${cliente.email || '-'}<br>
           <i class="fas fa-phone" style="color:#94a3b8;margin-right:4px;font-size:0.8em;"></i> <small>${cliente.telefono || '-'}</small>
        </td>
        <td>
           ${cliente.ciudad || '-'}<br>
           <small style="color:#64748b;">${cliente.estado_direccion || ''}</small>
        </td>
        <td>
           <span class="cl-badge ${typeClass}">${cliente.tipo_cliente || 'Regular'}</span>
           <div style="margin-top:4px;font-size:0.8em;color:#f59e0b;">
             <i class="fas fa-star"></i> ${(cliente.cal_general || 4.5).toFixed(1)}
           </div>
        </td>
        <td style="text-align:center;">
           <span class="cl-status-dot ${statusClass}"></span> ${cliente.estado || 'Activo'}
        </td>
        <td>
           <div class="cl-actions">
             ${isPickMode
          ? `<button class="action-btn select-client" title="Seleccionar"><i class="fas fa-user-check"></i></button>`
          : `
                 <button class="cl-btn-icon edit-client" data-id="${cliente.id_cliente}" title="Editar"><i class="fas fa-edit"></i></button>
                 <button class="cl-btn-icon history view-history" data-id="${cliente.id_cliente}" title="Historial"><i class="fas fa-history"></i></button>
                 <button class="cl-btn-icon delete-client" data-id="${cliente.id_cliente}" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
               `
        }
           </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tableWrap.appendChild(table);
    clientesList.appendChild(tableWrap);

  } else {
    // === GRID VIEW (CARDS) ===
    const gridContainer = document.createElement('div');
    gridContainer.className = 'clients-grid';

    clientes.forEach(cliente => {
      const card = document.createElement('div');
      card.className = 'client-card';
      // Mismos atributos de data
      card.setAttribute('data-id', String(cliente.id_cliente || ''));
      card.setAttribute('data-nombre', String(cliente.nombre || ''));
      card.setAttribute('data-empresa', String(cliente.empresa || ''));
      card.setAttribute('data-email', String(cliente.email || ''));
      card.setAttribute('data-telefono', String(cliente.telefono || ''));
      card.setAttribute('data-rfc', String(cliente.rfc || ''));
      card.setAttribute('data-direccion', String(cliente.direccion || ''));
      card.setAttribute('data-ciudad', String(cliente.ciudad || ''));
      card.setAttribute('data-codigo-postal', String(cliente.codigo_postal || ''));
      card.setAttribute('data-estado', String(cliente.estado_direccion || ''));
      card.setAttribute('data-tipo-cliente', String(cliente.tipo_cliente || ''));
      card.setAttribute('data-limite-credito', String(cliente.limite_credito || '0'));
      card.setAttribute('data-dias-credito', String(cliente.dias_credito || '30'));
      card.setAttribute('data-deuda-actual', String(cliente.deuda_actual || '0'));
      card.setAttribute('data-metodo-pago', String(cliente.metodo_pago || ''));
      card.setAttribute('data-calificacion-general', String(cliente.calificacion_general || '5'));
      card.setAttribute('data-calificacion-pago', String(cliente.calificacion_pago || '5'));
      card.setAttribute('data-calificacion-comunicacion', String(cliente.calificacion_comunicacion || '5'));
      card.setAttribute('data-calificacion-equipos', String(cliente.calificacion_equipos || '5'));
      card.setAttribute('data-notas', String(cliente.notas_generales || cliente.comentario || ''));

      if (isPickMode) { card.style.cursor = 'pointer'; card.title = 'Seleccionar cliente'; }

      card.innerHTML = `
        <div class="client-header">
          <div class="client-info">
            <div class="client-name"><i class="fas fa-user-circle"></i> ${cliente.nombre || ''}</div>
            <div class="client-company">${cliente.empresa || 'Empresa no especificada'}</div>
            <div class="client-tags">
              <span class="client-tag type">${cliente.tipo_cliente || 'Regular'}</span>
              <span class="client-tag status">${cliente.estado || 'Activo'}</span>
            </div>
            <div class="client-rating"><i class="fas fa-star"></i> ${(cliente.cal_general || 4.5).toFixed(1)}</div>
          </div>
        </div>
        <div class="client-contact">
          <div class="contact-item"><i class="fas fa-envelope"></i> ${cliente.email || 'N/A'}</div>
          <div class="contact-item"><i class="fas fa-phone"></i> ${cliente.telefono || 'N/A'}</div>
          <div class="contact-item"><i class="fas fa-map-marker-alt"></i> ${cliente.ciudad || cliente.direccion || 'N/A'}</div>
          <div class="contact-item"><i class="fas fa-building"></i> ${cliente.rfc || 'N/A'}</div>
        </div>
        <div class="client-stats">
          <div class="stat-item"><div class="stat-value">${cliente.proyectos || cliente.total_cotizaciones || 0}</div><div class="stat-label">Proyectos</div></div>
          <div class="stat-item"><div class="stat-value">$${formatMoney(cliente.valor_total || cliente.total_pagado || 0)}</div><div class="stat-label">Valor Total</div></div>
          <div class="stat-item"><div class="stat-value">${calcularAntiguedad(cliente.fecha_creacion)}</div><div class="stat-label">Meses</div></div>
        </div>
        <div class="client-actions">
          <button class="action-btn edit-client" data-id="${cliente.id_cliente}" title="Editar cliente"><i class="fas fa-edit"></i></button>
          <button class="action-btn view-history" data-id="${cliente.id_cliente}" title="Ver historial"><i class="fas fa-history"></i></button>
          <button class="action-btn delete-client" data-id="${cliente.id_cliente}" title="Eliminar cliente"><i class="fas fa-trash-alt"></i></button>
          ${isPickMode ? '<button class="action-btn select-client" title="Seleccionar"><i class="fas fa-user-check"></i></button>' : ''}
        </div>
      `;

      gridContainer.appendChild(card);
    });
    clientesList.appendChild(gridContainer);
  }

  // Acciones estándar (se enlazan igual ya sea botón en tabla o en tarjeta)
  try { configurarEventosClientes(); } catch { }

  // Modo selección: click comunica al padre
  if (isPickMode) {
    // Selector adaptativo: .client-card o .client-row
    const selector = currentView === 'list' ? '.client-row' : '.client-card';
    clientesList.querySelectorAll(selector).forEach(item => {
      const send = (ev) => {
        // Si clics en botones de acción (que no sean seleccionar), no disparar selección global si no se desea.
        // Pero en la tabla las acciones son botones explícitos.
        // Si clickeamos un botón de acción "editar", no deberíamos seleccionar el cliente.
        if (ev.target.closest('.edit-client') || ev.target.closest('.view-history') || ev.target.closest('.delete-client')) return;

        ev?.preventDefault?.(); ev?.stopPropagation?.();
        const payload = {
          id: item.getAttribute('data-id') || '',
          id_cliente: item.getAttribute('data-id') || '',
          nombre: item.getAttribute('data-nombre') || '',
          empresa: item.getAttribute('data-empresa') || '',
          email: item.getAttribute('data-email') || '',
          telefono: item.getAttribute('data-telefono') || '',
          rfc: item.getAttribute('data-rfc') || '',
          direccion: item.getAttribute('data-direccion') || '',
          ciudad: item.getAttribute('data-ciudad') || '',
          codigo_postal: item.getAttribute('data-codigo-postal') || '',
          estado_direccion: item.getAttribute('data-estado') || '',
          tipo_cliente: item.getAttribute('data-tipo-cliente') || '',
          limite_credito: item.getAttribute('data-limite-credito') || '0',
          dias_credito: item.getAttribute('data-dias-credito') || '30',
          deuda_actual: item.getAttribute('data-deuda-actual') || '0',
          metodo_pago: item.getAttribute('data-metodo-pago') || '',
          calificacion_general: item.getAttribute('data-calificacion-general') || '5',
          calificacion_pago: item.getAttribute('data-calificacion-pago') || '5',
          calificacion_comunicacion: item.getAttribute('data-calificacion-comunicacion') || '5',
          calificacion_equipos: item.getAttribute('data-calificacion-equipos') || '5',
          notas_generales: item.getAttribute('data-notas') || ''
        };

        const isCloneMode = window.parent?.document?.getElementById('v-client-modal')?.getAttribute('data-clone-mode') === 'true';

        if (isCloneMode) {
          try {
            window.parent.postMessage({
              type: 'CLIENT_SELECTED_FOR_CLONE',
              clientData: payload
            }, '*');
          } catch (e) { console.error('Error postMessage clone:', e); }
        } else {
          try { window.parent.postMessage({ type: 'select-client', payload }, '*'); } catch { }
        }
      };

      item.addEventListener('click', send);
      item.querySelector('.select-client')?.addEventListener('click', send);
    });
  }
}

// Formateo de moneda
function formatMoney(amount) {
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amount || 0));
}

// Función para calcular antigüedad en meses
function calcularAntiguedad(fechaString) {
  if (!fechaString) return 0;
  const fecha = new Date(fechaString);
  const hoy = new Date();
  const diferencia = hoy.getTime() - fecha.getTime();
  const meses = Math.floor(diferencia / (1000 * 60 * 60 * 24 * 30.44));
  return meses;
}

// Función para formatear fecha
function formatearFecha(fechaString) {
  if (!fechaString) return 'N/A';
  const fecha = new Date(fechaString);
  return fecha.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

// Función para buscar clientes
async function buscarClientes(termino) {
  if (!termino.trim()) {
    await cargarClientes();
    return;
  }

  try {
    const headers = getAuthHeaders();
    const response = await fetch(`${CLIENTES_URL}/search?q=${encodeURIComponent(termino)}`, { headers });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Error al buscar clientes');
    }

    const clientes = await response.json();
    setClientesFuenteYRender(clientes);
  } catch (error) {
    console.error('Error al buscar clientes:', error);
    showMessage('Error al buscar clientes', 'error');
  }
}

// Función para eliminar cliente
async function eliminarCliente(idCliente) {
  if (!confirm('¿Está seguro de que desea eliminar este cliente?')) {
    return;
  }

  try {
    const headers = getAuthHeaders();
    const response = await fetch(`${CLIENTES_URL}/${idCliente}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Error al eliminar cliente');
    }

    showMessage('Cliente eliminado exitosamente', 'success');
    await cargarClientes();
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    showMessage('Error al eliminar cliente', 'error');
  }
}

// Función para editar cliente
async function editarCliente(idCliente) {
  try {
    console.log('Editando cliente con ID:', idCliente);
    const headers = getAuthHeaders();
    console.log('Headers:', headers);
    const url = `${CLIENTES_URL}/${idCliente}`;
    console.log('URL de fetch:', url);

    const response = await fetch(url, { headers });
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return;
      }
      throw new Error(`Error ${response.status}: ${errorText}`);
    }

    const cliente = await response.json();
    console.log('Cliente obtenido:', cliente);
    mostrarModalEditarCliente(cliente);
  } catch (error) {
    console.error('Error al cargar cliente para edición:', error);
    showMessage(`Error al cargar datos del cliente: ${error.message}`, 'error');
  }
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
  // Cargar clientes al iniciar
  cargarClientes();

  // bloquear sección crédito por defecto
  disableCreditSection();
  adminCreditAuthorized = false;

  // Configurar tabs del historial
  configurarTabsHistorial();

  // Event listener para búsqueda
  const inputBusqueda = document.getElementById('search-input');
  if (inputBusqueda) {
    let timeoutId;
    inputBusqueda.addEventListener('input', function () {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        buscarClientes(this.value);
      }, 300);
    });
  }

  const elTipo = document.getElementById('clientes-filter-tipo');
  const elEstado = document.getElementById('clientes-filter-estado');
  const elCiudad = document.getElementById('clientes-filter-ciudad');
  const elRating = document.getElementById('clientes-filter-rating');
  const elLimpiar = document.getElementById('clientes-filtros-limpiar');

  const onFiltrosChange = () => aplicarFiltrosClientesYRender();

  elTipo?.addEventListener('change', onFiltrosChange);
  elEstado?.addEventListener('change', onFiltrosChange);
  elCiudad?.addEventListener('input', onFiltrosChange);
  elRating?.addEventListener('input', onFiltrosChange);
  elLimpiar?.addEventListener('click', (e) => {
    e.preventDefault();
    if (elTipo) elTipo.value = '';
    if (elEstado) elEstado.value = '';
    if (elCiudad) elCiudad.value = '';
    if (elRating) elRating.value = '';
    if (elRating) elRating.value = '';
    aplicarFiltrosClientesYRender();
  });

  // Toggle buttons
  const gridBtn = document.getElementById('cr-grid-btn');
  const listBtn = document.getElementById('cr-list-btn');

  const updateView = (view) => {
    currentView = view;
    gridBtn?.classList.toggle('is-active', view === 'grid');
    listBtn?.classList.toggle('is-active', view === 'list');
    aplicarFiltrosClientesYRender();
  };

  gridBtn?.addEventListener('click', () => updateView('grid'));
  listBtn?.addEventListener('click', () => updateView('list'));

  // botón autorización crédito
  const btnAuth = document.getElementById('authorize-credit-btn');
  if (btnAuth) {
    btnAuth.addEventListener('click', async () => {
      await solicitarPasswordAdminCredit();
    });
  }

  // prevenir edición de campos si no autorizado
  const creditFieldIds = [
    'nc-limite-credito','nc-deuda-actual','nc-terminos-pago',
    'nc-dias-credito','nc-metodo-pago',
    'nc-cal-general','nc-cal-pago','nc-cal-comunicacion',
    'nc-cal-equipos','nc-cal-satisfaccion',
    'nc-fecha-evaluacion','nc-notas-evaluacion','nc-notas-generales'
  ];
  creditFieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('focus', async (e) => {
        if (!adminCreditAuthorized) {
          e.preventDefault();
          const ok = await solicitarPasswordAdminCredit();
          if (!ok) el.blur();
        }
      });
    }
  });

  // Configurar event listeners para los campos del formulario
  configurarEventListenersFormulario();
});

// Función para configurar event listeners del formulario
function configurarEventListenersFormulario() {
  // Event listeners para formateo de RFC
  const rfcInputs = ['nc-rfc', 'nc-fact-rfc'];
  rfcInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', function () {
        formatearRFC(this);
      });

      input.addEventListener('blur', function () {
        if (this.value.length >= 12) {
          validarRFC(this.value, this);
        }
      });
    }
  });

  // Event listeners para formateo de CURP
  const curpInputs = ['nc-curp', 'nc-fact-curp'];
  curpInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', function () {
        formatearCURP(this);
      });
    }
  });

  // Event listener para código postal
  const codigoPostalInput = document.getElementById('nc-codigo-postal');
  if (codigoPostalInput) {
    codigoPostalInput.addEventListener('input', function () {
      formatearCodigoPostal(this);
    });
  }

  // Event listener para auto-completar datos de facturación
  const rfcBasicoInput = document.getElementById('nc-rfc');
  if (rfcBasicoInput) {
    rfcBasicoInput.addEventListener('blur', function () {
      autoCompletarDatosFacturacion();
    });
  }

  // Event listener para sincronizar campos
  const razonSocialInput = document.getElementById('nc-razon-social');
  if (razonSocialInput) {
    razonSocialInput.addEventListener('blur', function () {
      sincronizarCampos();
    });
  }

  // Event listener para validar que régimen fiscal sea requerido con RFC de facturación
  const factRfcInput = document.getElementById('nc-fact-rfc');
  const regimenFiscalInput = document.getElementById('nc-regimen-fiscal');

  if (factRfcInput && regimenFiscalInput) {
    factRfcInput.addEventListener('blur', function () {
      if (this.value && !regimenFiscalInput.value) {
        showMessage('Régimen fiscal es requerido cuando se proporciona RFC de facturación', 'error');
        regimenFiscalInput.focus();
      }
    });
  }

  // Event listener para números solamente en campos numéricos
  const numericInputs = ['nc-numero-precio', 'nc-limite-credito', 'nc-dias-credito', 'nc-grupo-entero'];
  numericInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', function () {
        // Permitir solo números
        this.value = this.value.replace(/[^0-9.]/g, '');
      });
    }
  });
}

// Función para configurar eventos de los clientes
function configurarEventosClientes() {
  // Event listeners para botones de editar
  document.querySelectorAll('.edit-client').forEach(btn => {
    btn.addEventListener('click', function () {
      const idCliente = this.dataset.id;
      editarCliente(idCliente);
    });
  });

  // Event listeners para botones de ver historial
  document.querySelectorAll('.view-history').forEach(btn => {
    btn.addEventListener('click', function () {
      const idCliente = this.dataset.id;
      verHistorial(idCliente);
    });
  });

  // Event listeners para botones de eliminar
  document.querySelectorAll('.delete-client').forEach(btn => {
    btn.addEventListener('click', function () {
      const idCliente = this.dataset.id;
      eliminarCliente(idCliente);
    });
  });
}

// Función para ver historial del cliente
async function verHistorial(idCliente) {
  try {
    // Obtener historial completo del cliente
    const headers = getAuthHeaders();
    const response = await fetch(`${CLIENTES_URL}/${idCliente}/historial`, { headers });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Error al cargar historial del cliente');
    }

    const historialCompleto = await response.json();
    mostrarModalHistorialCliente(historialCompleto);
  } catch (error) {
    console.error('Error al cargar historial del cliente:', error);
    showMessage('Error al cargar historial del cliente', 'error');
  }
}

// Función para mostrar el modal de historial del cliente
function mostrarModalHistorialCliente(historialData) {
  const modal = document.getElementById('historial-cliente-modal');
  const { cliente, estadisticas, cotizaciones, contratos, facturas, pagos, notas_credito, bonos, ledger } = historialData;

  // Rellenar información del cliente
  document.getElementById('historial-cliente-nombre').textContent = cliente.nombre || 'Sin nombre';
  document.getElementById('historial-cliente-empresa').textContent = cliente.empresa || cliente.razon_social || 'Sin empresa';
  document.getElementById('historial-cliente-tipo').textContent = cliente.tipo_cliente || 'Regular';
  document.getElementById('historial-cliente-estado').textContent = cliente.estado || 'Activo';

  // Calcular valor total: Contratos + Cotizaciones de VENTA
  const totalContratos = (contratos || []).reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);
  const totalCotizacionesVenta = (cotizaciones || [])
    .filter(c => (c.tipo_cotizacion || c.tipo || '').toUpperCase() === 'VENTA')
    .reduce((sum, c) => sum + (parseFloat(c.total) || 0), 0);

  const valorTotalGeneral = totalContratos + totalCotizacionesVenta;

  // Mostrar estadísticas reales
  document.getElementById('historial-total-contratos').textContent = estadisticas.total_contratos || '0';
  document.getElementById('historial-total-cotizaciones').textContent = estadisticas.total_cotizaciones || '0';
  document.getElementById('historial-total-facturas').textContent = estadisticas.total_facturas || '0';
  document.getElementById('historial-total-notas').textContent = estadisticas.total_notas_credito || '0';
  document.getElementById('historial-credito-disponible').textContent = formatCurrency(estadisticas.credito_disponible || 0);
  document.getElementById('historial-valor-total').textContent = formatCurrency(valorTotalGeneral);

  // Llenar contenido de las tabs
  llenarTabCotizaciones(cotizaciones, estadisticas);
  llenarTabContratos(contratos);
  llenarTabFacturas(facturas);
  llenarTabPagos(pagos);
  llenarTabNotasCredito(notas_credito || []);
  llenarTabBonos(bonos || []);
  llenarTabLedger(ledger || []);

  // configurar filtros ledger si están presentes
  const start = document.getElementById('ledger-start');
  const end = document.getElementById('ledger-end');
  const tipoFilter = document.getElementById('ledger-tipo');
  if (start || end || tipoFilter) {
      const reloadLedger = async () => {
          const fid = cliente.id_cliente;
          let url = `/api/clientes/${fid}/ledger?`;
          if (start && start.value) url += `start=${start.value}&`;
          if (end && end.value) url += `end=${end.value}&`;
          if (tipoFilter && tipoFilter.value) url += `tipo=${tipoFilter.value}&`;
          try {
              const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
              const json = await resp.json();
              if (resp.ok && json.success) {
              // nothing special
          }
              llenarTabLedger(json.data || []);
          } catch (e) { console.error('Error filtrando ledger:', e); }
      };
      start?.addEventListener('change', reloadLedger);
      end?.addEventListener('change', reloadLedger);
      tipoFilter?.addEventListener('change', reloadLedger);
  }

  // Mostrar modal
  modal.classList.add('show');
}

// Función para llenar la tab de cotizaciones con información de clones
function llenarTabCotizaciones(cotizaciones, estadisticas) {
  const tabContent = document.getElementById('tab-cotizaciones');
  const historialList = tabContent.querySelector('.historial-list');

  if (!cotizaciones || cotizaciones.length === 0) {
    historialList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-calculator"></i>
        <h4>No hay cotizaciones registradas</h4>
        <p>Este cliente aún no tiene cotizaciones asociadas</p>
      </div>
    `;
    return;
  }

  // Mostrar estadísticas de clonación
  const statsHtml = `
    <div class="cotizaciones-stats" style="margin-bottom: 20px; padding: 16px; background: #f8fafc; border-radius: 8px;">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; text-align: center;">
        <div>
          <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${estadisticas.total_cotizaciones}</div>
          <div style="font-size: 12px; color: #6b7280;">Total</div>
        </div>
        <div>
          <div style="font-size: 24px; font-weight: bold; color: #10b981;">${estadisticas.cotizaciones_originales}</div>
          <div style="font-size: 12px; color: #6b7280;">Originales</div>
        </div>
        <div>
          <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${estadisticas.cotizaciones_clonadas}</div>
          <div style="font-size: 12px; color: #6b7280;">Clonadas</div>
        </div>
        <div>
          <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${estadisticas.total_clones_generados}</div>
          <div style="font-size: 12px; color: #6b7280;">Clones Generados</div>
        </div>
      </div>
    </div>
  `;

  // Verificar si estamos en modo clonación
  const urlParams = new URLSearchParams(window.location.search);
  const isCloneFromUrl = urlParams.get('clone') === 'true';
  const isCloneMode = isCloneFromUrl ||
    (window.opener &&
      (window.opener.location.href.includes('cotizacion_renta.html') ||
        window.opener.document.querySelector('[data-clone-mode="true"]') ||
        sessionStorage.getItem('clone-mode') === 'true'));

  console.log('🔍 [CLONACIÓN] Detectando modo clonación:', {
    isCloneFromUrl,
    hasOpener: !!window.opener,
    isCloneMode
  });

  const cotizacionesHtml = cotizaciones.map(cot => {
    const tipoIcon = cot.es_clon ? 'fa-clone' : 'fa-file-alt';
    const tipoColor = cot.es_clon ? '#f59e0b' : '#10b981';
    const estadoColor = getEstadoColor(cot.estado);

    return `
      <div class="historial-item" style="border-left: 4px solid ${tipoColor};">
        <div class="historial-header">
          <div class="historial-icon" style="color: ${tipoColor};">
            <i class="fas ${tipoIcon}"></i>
          </div>
          <div class="historial-info">
            <h5>${cot.numero_folio || cot.numero_cotizacion}</h5>
            <p style="margin: 4px 0;">
              <span class="badge" style="background: ${estadoColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">
                ${cot.estado}
              </span>
              <span style="margin-left: 8px; color: #6b7280; font-size: 12px;">
                ${cot.tipo_cotizacion}
              </span>
            </p>
            ${cot.es_clon && cot.clon_de_folio ? `
              <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
                <i class="fas fa-arrow-right" style="margin-right: 4px;"></i>
                Clonada de: ${cot.clon_de_folio}
              </p>
            ` : ''}
            ${cot.total_clones_generados > 0 ? `
              <p style="margin: 4px 0; font-size: 12px; color: #8b5cf6;">
                <i class="fas fa-copy" style="margin-right: 4px;"></i>
                ${cot.total_clones_generados} clones generados
              </p>
            ` : ''}
          </div>
          <div class="historial-meta">
            <div class="historial-date">${formatDate(cot.fecha_creacion)}</div>
            <div class="historial-amount">${formatCurrency(cot.total || 0)}</div>
            ${cot.vendedor_nombre ? `<div style="font-size: 11px; color: #6b7280;">Por: ${cot.vendedor_nombre}</div>` : ''}
            ${isCloneMode ? `
              <button class="btn btn-primary btn-sm select-quotation-btn" 
                      data-quotation-id="${cot.id_cotizacion}"
                      data-quotation-folio="${cot.numero_folio || cot.numero_cotizacion}"
                      data-quotation-data='${JSON.stringify(cot)}'
                      style="margin-top: 8px; font-size: 11px; padding: 4px 8px;">
                <i class="fas fa-check"></i> Seleccionar
              </button>
            ` : ''}
          </div>
        </div>
        ${cot.motivo_cambio ? `
          <div style="margin-top: 8px; padding: 8px; background: #f1f5f9; border-radius: 4px; font-size: 12px;">
            <strong>Motivo:</strong> ${cot.motivo_cambio}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  historialList.innerHTML = statsHtml + cotizacionesHtml;

  // Agregar event listeners para botones de selección si estamos en modo clonación
  if (isCloneMode) {
    const selectButtons = historialList.querySelectorAll('.select-quotation-btn');
    selectButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        const quotationData = JSON.parse(this.dataset.quotationData);
        selectQuotationForCloning(quotationData);
      });
    });
  }
}

// Función para llenar la tab de contratos
function llenarTabContratos(contratos) {
  const tabContent = document.getElementById('tab-contratos');
  const historialList = tabContent.querySelector('.historial-list');

  if (!contratos || contratos.length === 0) {
    historialList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-file-contract"></i>
        <h4>No hay contratos registrados</h4>
        <p>Este cliente aún no tiene contratos asociados</p>
      </div>
    `;
    return;
  }

  const contratosHtml = contratos.map(contrato => `
    <div class="historial-item">
      <div class="historial-header">
        <div class="historial-icon">
          <i class="fas fa-file-contract"></i>
        </div>
        <div class="historial-info">
          <h5>${contrato.numero_contrato}</h5>
          <p>${contrato.descripcion || 'Contrato de servicios'}</p>
        </div>
        <div class="historial-meta">
          <div class="historial-date">${formatDate(contrato.fecha_creacion)}</div>
          <div class="historial-amount">${formatCurrency(contrato.total || 0)}</div>
        </div>
      </div>
    </div>
  `).join('');

  historialList.innerHTML = contratosHtml;
}

// Función para llenar la tab de facturas
function llenarTabFacturas(facturas) {
  const tabContent = document.getElementById('tab-facturas');
  const historialList = tabContent.querySelector('.historial-list');

  if (!facturas || facturas.length === 0) {
    historialList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-receipt"></i>
        <h4>No hay facturas registradas</h4>
        <p>Este cliente aún no tiene facturas asociadas</p>
      </div>
    `;
    return;
  }

  const facturasHtml = facturas.map(factura => `
    <div class="historial-item">
      <div class="historial-header">
        <div class="historial-icon">
          <i class="fas fa-receipt"></i>
        </div>
        <div class="historial-info">
          <h5>${factura.numero_factura}</h5>
          <p>Estado: ${factura.estado}</p>
          ${factura.saldo_pendiente > 0 ? `<p style="color: #ef4444;">Saldo pendiente: ${formatCurrency(factura.saldo_pendiente)}</p>` : ''}
        </div>
        <div class="historial-meta">
          <div class="historial-date">${formatDate(factura.fecha_creacion)}</div>
          <div class="historial-amount">${formatCurrency(factura.total || 0)}</div>
        </div>
      </div>
    </div>
  `).join('');

  historialList.innerHTML = facturasHtml;
}

// Función para llenar la tab de pagos
function llenarTabPagos(pagos) {
  const tabContent = document.getElementById('tab-pagos');
  const historialList = tabContent.querySelector('.historial-list');

  if (!pagos || pagos.length === 0) {
    historialList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-credit-card"></i>
        <h4>No hay pagos registrados</h4>
        <p>Este cliente aún no tiene pagos asociados</p>
      </div>
    `;
    return;
  }

  const pagosHtml = pagos.map(pago => `
    <div class="historial-item">
      <div class="historial-header">
        <div class="historial-icon">
          <i class="fas fa-credit-card"></i>
        </div>
        <div class="historial-info">
          <h5>Pago - ${pago.numero_factura || pago.numero_contrato}</h5>
          <p>Método: ${pago.metodo_pago || 'No especificado'}</p>
        </div>
        <div class="historial-meta">
          <div class="historial-date">${formatDate(pago.fecha_pago)}</div>
          <div class="historial-amount">${formatCurrency(pago.monto || 0)}</div>
        </div>
      </div>
    </div>
  `).join('');

  historialList.innerHTML = pagosHtml;
}

// Función para llenar la tab de notas de crédito
function llenarTabNotasCredito(notas) {
  const tabContent = document.getElementById('tab-notas');
  const historialList = tabContent.querySelector('.historial-list');
  if (!notas || notas.length === 0) {
    historialList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-file-invoice"></i>
        <h4>No hay notas de crédito registradas</h4>
        <p>Este cliente aún no tiene notas de crédito</p>
      </div>
    `;
    return;
  }
  const html = notas.map(nc => `
    <div class="historial-item">
      <div class="historial-header">
        <div class="historial-icon">
          <i class="fas fa-file-invoice"></i>
        </div>
        <div class="historial-info">
          <h5>NC ${nc.folio || nc.uuid}</h5>
          <p>Motivo: ${nc.motivo_sat}</p>
        </div>
        <div class="historial-meta">
          <div class="historial-date">${formatDate(nc.fecha_creacion)}</div>
          <div class="historial-amount">${formatCurrency(nc.total || 0)}</div>
        </div>
      </div>
    </div>
  `).join('');
  historialList.innerHTML = html;
}

// Función para llenar la tab de bonos
function llenarTabBonos(bonos) {
  const tabContent = document.getElementById('tab-bonos');
  const historialList = tabContent.querySelector('.historial-list');
  if (!bonos || bonos.length === 0) {
    historialList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-gift"></i>
        <h4>No hay bonos registrados</h4>
        <p>Este cliente aún no tiene bonos</p>
      </div>
    `;
    return;
  }
  const html = bonos.map(b => `
    <div class="historial-item">
      <div class="historial-header">
        <div class="historial-icon"><i class="fas fa-gift"></i></div>
        <div class="historial-info"><h5>Bonos ${b.id || ''}</h5><p>${b.descripcion || ''}</p></div>
        <div class="historial-meta"><div class="historial-date">${formatDate(b.fecha)}</div><div class="historial-amount">${formatCurrency(b.monto || 0)}</div></div>
      </div>
    </div>
  `).join('');
  historialList.innerHTML = html;
}

// Función para llenar la tab de ledger
function llenarTabLedger(entries) {
  const list = document.querySelector('.ledger-list');
  if (!entries || entries.length === 0) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-book"></i><h4>No hay movimientos financieros</h4></div>`;
    return;
  }
  let table = `<table class="ledger-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Cargo</th><th>Abono</th><th>Saldo</th><th>Referencia</th></tr></thead><tbody>`;
  entries.forEach(e => {
    table += `<tr><td>${formatDate(e.fecha)}</td><td>${e.tipo_mov}</td><td>${formatCurrency(e.cargo)}</td><td>${formatCurrency(e.abono)}</td><td>${formatCurrency(e.saldo_resultante)}</td><td>${e.referencia_tipo}:${e.referencia_id || ''}</td></tr>`;
  });
  table += `</tbody></table>`;
  list.innerHTML = table;
}

// Funciones auxiliares
function formatCurrency(amount) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount || 0);
}

function formatDate(dateString) {
  if (!dateString) return 'Sin fecha';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function getEstadoColor(estado) {
  const colores = {
    'Borrador': '#6b7280',
    'Enviada': '#3b82f6',
    'Aprobada': '#10b981',
    'Rechazada': '#ef4444',
    'Completada': '#8b5cf6'
  };
  return colores[estado] || '#6b7280';
}

// Función para configurar las tabs del historial
function configurarTabsHistorial() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', function () {
      const targetTab = this.dataset.tab;

      // Remover clase active de todos los botones y contenidos
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Agregar clase active al botón clickeado y su contenido
      this.classList.add('active');
      document.getElementById(`tab-${targetTab}`).classList.add('active');
    });
  });
}

// Cerrar modal de historial
const btnCerrarHistorial = document.getElementById('close-historial-modal');
if (btnCerrarHistorial) {
  btnCerrarHistorial.onclick = function () {
    document.getElementById('historial-cliente-modal').classList.remove('show');
  };
}

// --- FUNCIONES PARA ENCUESTA DE SATISFACCIÓN ---

// Función para mostrar modal de encuesta de satisfacción
function mostrarModalEncuestaSatisfaccion() {
  const modal = document.getElementById('encuesta-satisfaccion-modal');

  // Cargar estadísticas de la encuesta (simulado por ahora)
  cargarEstadisticasEncuesta();

  // Mostrar modal
  modal.classList.add('show');
}

// Función para cargar estadísticas de la encuesta
async function cargarEstadisticasEncuesta() {
  try {
    const headers = getAuthHeaders();
    const response = await fetch('/api/encuestas/estadisticas', { headers });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Error al cargar estadísticas de encuesta');
    }

    const result = await response.json();
    const stats = result.data;

    // Actualizar estadísticas en la modal
    document.getElementById('total-respuestas').textContent = stats.satisfaccion.total_respuestas || 0;
    document.getElementById('promedio-satisfaccion').textContent = (stats.satisfaccion.promedio_satisfaccion || 0).toFixed(1);
    document.getElementById('tasa-respuesta').textContent = `${stats.generales.tasa_respuesta || 0}%`;

    console.log('Estadísticas de encuestas cargadas:', stats);
  } catch (error) {
    console.error('Error al cargar estadísticas de encuesta:', error);
    // Mostrar datos por defecto en caso de error
    document.getElementById('total-respuestas').textContent = '0';
    document.getElementById('promedio-satisfaccion').textContent = '0.0';
    document.getElementById('tasa-respuesta').textContent = '0%';
  }
}

// Función para copiar URL al portapapeles
function copiarURL() {
  const urlInput = document.getElementById('encuesta-url');
  urlInput.select();
  urlInput.setSelectionRange(0, 99999); // Para móviles

  try {
    document.execCommand('copy');
    showMessage('URL copiada al portapapeles', 'success');
  } catch (err) {
    // Fallback para navegadores modernos
    navigator.clipboard.writeText(urlInput.value).then(() => {
      showMessage('URL copiada al portapapeles', 'success');
    }).catch(() => {
      showMessage('Error al copiar URL', 'error');
    });
  }
}

// Función para compartir por WhatsApp
function compartirWhatsApp() {
  const url = document.getElementById('encuesta-url').value;
  const mensaje = `Hola! Te invitamos a participar en nuestra encuesta de satisfacción. Tu opinión es muy importante para nosotros: ${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  window.open(whatsappUrl, '_blank');
}

// Función para compartir por correo electrónico
function compartirEmail() {
  const url = document.getElementById('encuesta-url').value;
  const asunto = 'Encuesta de Satisfacción - Andamios Torres';
  const cuerpo = `Estimado cliente,

Esperamos que se encuentre muy bien. En Andamios Torres valoramos mucho su opinión y nos gustaría conocer su experiencia con nuestros servicios.

Por favor, tome unos minutos para completar nuestra encuesta de satisfacción:

${url}

Su feedback nos ayuda a mejorar continuamente nuestros servicios.

¡Gracias por su tiempo!

Saludos cordiales,
Equipo Andamios Torres`;

  const mailtoUrl = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  window.location.href = mailtoUrl;
}

// Función para generar URL personalizada y crear encuesta
async function generarURLPersonalizada() {
  const clienteNombre = document.getElementById('cliente-nombre').value;
  const proyecto = document.getElementById('proyecto-relacionado').value;

  try {
    // Crear encuesta en el backend
    const headers = getAuthHeaders();
    const encuestaData = {
      id_cliente: null, // Se puede seleccionar de una lista
      id_proyecto: proyecto || null,
      email_cliente: null, // Se puede agregar un campo
      telefono_cliente: null,
      metodo_envio: 'link',
      notas: clienteNombre ? `Cliente: ${clienteNombre}` : null
    };

    const response = await fetch('/api/encuestas', {
      method: 'POST',
      headers,
      body: JSON.stringify(encuestaData)
    });

    if (!response.ok) {
      throw new Error('Error al crear encuesta');
    }

    const result = await response.json();
    const urlEncuesta = result.data.url_encuesta;

    // Actualizar la URL en la modal
    document.getElementById('encuesta-url').value = urlEncuesta;

    // Agregar parámetros adicionales si es necesario
    let urlFinal = urlEncuesta;
    if (clienteNombre) {
      urlFinal += (urlEncuesta.includes('?') ? '&' : '?') + `cliente=${encodeURIComponent(clienteNombre)}`;
    }

    document.getElementById('encuesta-url').value = urlFinal;
    showMessage('Encuesta creada y URL generada exitosamente', 'success');

    // Recargar estadísticas
    cargarEstadisticasEncuesta();

  } catch (error) {
    console.error('Error al crear encuesta:', error);

    // Fallback: generar URL simple
    let urlBase = 'https://tu-dominio.com/sastifaccion_clienteSG.html';
    let params = [];

    if (clienteNombre) {
      params.push(`cliente=${encodeURIComponent(clienteNombre)}`);
    }

    if (proyecto) {
      params.push(`proyecto=${encodeURIComponent(proyecto)}`);
    }

    if (params.length > 0) {
      urlBase += '?' + params.join('&');
    }

    document.getElementById('encuesta-url').value = urlBase;
    showMessage('URL personalizada generada (sin backend)', 'success');
  }
}

// Función para ver estadísticas detalladas
function verEstadisticas() {
  showMessage('Función de estadísticas detalladas en desarrollo', 'error');
  // Aquí podrías abrir otra modal con gráficos detallados
}

// Cerrar modal de encuesta
const btnCerrarEncuesta = document.getElementById('close-encuesta-modal');
if (btnCerrarEncuesta) {
  btnCerrarEncuesta.onclick = function () {
    document.getElementById('encuesta-satisfaccion-modal').classList.remove('show');
  };
}

// --- MODAL REUTILIZABLE PARA ALTA Y EDICIÓN DE CLIENTES ---

// Mostrar modal para editar cliente y rellenar campos
function mostrarModalEditarCliente(cliente) {
  console.log('Abriendo modal de edición para cliente:', cliente.nombre);
  prepararModalCredito();
  const modal = document.getElementById('nuevo-cliente-modal');
  const form = document.getElementById('nuevo-cliente-form');

  if (!modal) {
    console.error('Modal nuevo-cliente-modal no encontrada');
    return;
  }

  // Cambia el título y el botón
  const titleEl = modal.querySelector('.modal-title-main');
  const subtitleEl = modal.querySelector('.modal-subtitle-enhanced');

  if (titleEl) titleEl.textContent = 'Editar Cliente';
  if (subtitleEl) subtitleEl.textContent = 'Modifica la información del cliente';
  form.setAttribute('data-modo', 'edicion');
  form.setAttribute('data-id', cliente.id_cliente);
  // Rellenar campos - Datos Básicos (con manejo de errores)
  try {
    const setFieldValue = (id, value) => {
      const field = document.getElementById(id);
      if (field) {
        if (field.type === 'checkbox') {
          field.checked = value || false;
        } else {
          field.value = value || '';
        }
      } else {
        console.warn(`Campo no encontrado: ${id}`);
      }
    };

    setFieldValue('nc-numero-cliente', cliente.numero_cliente || cliente.id_cliente);
    setFieldValue('nc-clave', cliente.clave);
    setFieldValue('nc-notificar', cliente.notificar);
    setFieldValue('nc-representante', cliente.representante);
    setFieldValue('nc-nombre', cliente.nombre);
    setFieldValue('nc-rfc', cliente.rfc);
    setFieldValue('nc-curp', cliente.curp);
    setFieldValue('nc-telefono', cliente.telefono);
    setFieldValue('nc-celular', cliente.celular || cliente.telefono_alt);
    setFieldValue('nc-email', cliente.email);
    setFieldValue('nc-comentario', cliente.comentario || cliente.notas_generales);
    setFieldValue('nc-numero-precio', cliente.numero_precio || '1');
    setFieldValue('nc-limite-credito', cliente.limite_credito || 0);
    setFieldValue('nc-dias-credito', cliente.dias_credito || cliente.terminos_pago || 30);
    setFieldValue('nc-grupo-entero', cliente.grupo_entero || 0);

    // Rellenar campos - Datos de Facturación
    setFieldValue('nc-fact-rfc', cliente.fact_rfc || cliente.rfc);
    setFieldValue('nc-fact-iucr', cliente.fact_iucr);
    setFieldValue('nc-razon-social', cliente.razon_social || cliente.empresa);
    setFieldValue('nc-fact-curp', cliente.fact_curp || cliente.curp);
    setFieldValue('nc-regimen-fiscal', cliente.regimen_fiscal);
    setFieldValue('nc-uso-cfdi', cliente.uso_cfdi);
    setFieldValue('nc-domicilio', cliente.domicilio || cliente.direccion);
    setFieldValue('nc-numero-ext', cliente.numero_ext);
    setFieldValue('nc-numero-int', cliente.numero_int);
    setFieldValue('nc-codigo-postal', cliente.codigo_postal);
    setFieldValue('nc-colonia', cliente.colonia);
    setFieldValue('nc-ciudad', cliente.ciudad);
    setFieldValue('nc-localidad', cliente.localidad);
    setFieldValue('nc-estado', cliente.estado_direccion || cliente.estado);
    setFieldValue('nc-pais', cliente.pais || 'MÉXICO');
    setFieldValue('nc-aplican-retenciones', cliente.aplican_retenciones);
    setFieldValue('nc-desglosar-ieps', cliente.desglosar_ieps);

    // Rellenar campos existentes (mantener compatibilidad)
    setFieldValue('nc-segmento', cliente.segmento || 'Individual');
    setFieldValue('nc-deuda-actual', cliente.deuda_actual || 0);
    setFieldValue('nc-metodo-pago', cliente.metodo_pago || 'Transferencia');
    setFieldValue('nc-cal-general', cliente.cal_general || 5);
    setFieldValue('nc-cal-pago', cliente.cal_pago || 5);
    setFieldValue('nc-cal-comunicacion', cliente.cal_comunicacion || 5);
    setFieldValue('nc-cal-equipos', cliente.cal_equipos || 5);
    setFieldValue('nc-cal-satisfaccion', cliente.cal_satisfaccion || 5);
    setFieldValue('nc-fecha-evaluacion', cliente.fecha_evaluacion ? cliente.fecha_evaluacion.substring(0, 10) : '');
    setFieldValue('nc-notas-evaluacion', cliente.notas_evaluacion);
    setFieldValue('nc-notas-generales', cliente.notas_generales);

  } catch (error) {
    console.error('Error al llenar campos del formulario:', error);
  }

  // Mostrar modal
  console.log('Mostrando modal...');
  console.log('Modal antes de mostrar:', modal.style.display, modal.className);
  modal.classList.add('show');
  modal.style.display = 'flex'; // Forzar display
  console.log('Modal después de mostrar:', modal.style.display, modal.className);
}

// Al abrir para nuevo cliente, limpiar y poner modo alta
const btnNuevoCliente = document.querySelector('.add-btn');
if (btnNuevoCliente) {
  btnNuevoCliente.addEventListener('click', function () {
    prepararModalCredito();
    const modal = document.getElementById('nuevo-cliente-modal');
    const form = document.getElementById('nuevo-cliente-form');
    const titleEl = modal.querySelector('.modal-title-main');
    const subtitleEl = modal.querySelector('.modal-subtitle-enhanced');

    if (titleEl) titleEl.textContent = 'Nuevo Cliente';
    if (subtitleEl) subtitleEl.textContent = 'Completa la información para crear un nuevo cliente';

    form.removeAttribute('data-modo');
    form.removeAttribute('data-id');
    // Limpiar campos
    form.reset();
    // Establecer valores por defecto
    document.getElementById('nc-numero-precio').value = '1';
    document.getElementById('nc-dias-credito').value = '30';
    document.getElementById('nc-pais').value = 'MÉXICO';
    modal.classList.add('show');
  });
}

// Cerrar modal
const btnCerrarModal = document.getElementById('close-nuevo-cliente-modal');
if (btnCerrarModal) {
  btnCerrarModal.onclick = function () {
    document.getElementById('nuevo-cliente-modal').classList.remove('show');
  };
}

// Enviar formulario (alta o edición)
document.getElementById('nuevo-cliente-form').onsubmit = async function (e) {
  e.preventDefault();
  if (!adminCreditAuthorized) {
    const autorizado = await solicitarPasswordAdminCredit();
    if (!autorizado) {
      showMessage('Se requiere autorización para modificar créditos', 'error');
      return;
    }
  }
  const form = this;
  const modo = form.getAttribute('data-modo');
  const id = form.getAttribute('data-id');
  // Función auxiliar para convertir valores numéricos
  const getNumericValue = (elementId) => {
    const value = document.getElementById(elementId).value;
    return value === '' ? null : parseInt(value, 10);
  };

  const getFloatValue = (elementId) => {
    const value = document.getElementById(elementId).value;
    return value === '' ? null : parseFloat(value);
  };

  // Recolectar datos - Datos Básicos
  const data = {
    // Datos Básicos
    numero_cliente: document.getElementById('nc-numero-cliente').value,
    clave: document.getElementById('nc-clave').value,
    notificar: document.getElementById('nc-notificar').checked,
    representante: document.getElementById('nc-representante').value,
    atencion_nombre: document.getElementById('nc-atencion-nombre')?.value || '',
    nombre: document.getElementById('nc-nombre').value,
    rfc: document.getElementById('nc-rfc').value,
    curp: document.getElementById('nc-curp').value,
    telefono: document.getElementById('nc-telefono').value,
    celular: document.getElementById('nc-celular').value,
    telefono_alt: document.getElementById('nc-telefono-alt')?.value || '',
    email: document.getElementById('nc-email').value,
    direccion: document.getElementById('nc-direccion')?.value || '', // Physical address
    comentario: document.getElementById('nc-comentario').value,
    numero_precio: getNumericValue('nc-numero-precio'),
    grupo_entero: getNumericValue('nc-grupo-entero'),

    // Datos de Facturación
    fact_rfc: document.getElementById('nc-fact-rfc').value,
    fact_iucr: document.getElementById('nc-fact-iucr').value,
    razon_social: document.getElementById('nc-razon-social').value,
    fact_curp: document.getElementById('nc-fact-curp').value,
    regimen_fiscal: document.getElementById('nc-regimen-fiscal').value,
    uso_cfdi: document.getElementById('nc-uso-cfdi').value,
    domicilio: document.getElementById('nc-domicilio').value, // Fiscal address
    numero_ext: document.getElementById('nc-numero-ext').value,
    numero_int: document.getElementById('nc-numero-int').value,
    codigo_postal: document.getElementById('nc-codigo-postal').value,
    colonia: document.getElementById('nc-colonia').value,
    ciudad: document.getElementById('nc-ciudad').value,
    localidad: document.getElementById('nc-localidad').value,
    estado_direccion: document.getElementById('nc-estado-direccion').value,
    pais: document.getElementById('nc-pais').value,
    aplican_retenciones: document.getElementById('nc-aplican-retenciones').checked,
    desglosar_ieps: document.getElementById('nc-desglosar-ieps').checked,

    // Clasificación
    segmento: document.getElementById('nc-segmento').value,
    tipo_cliente: document.getElementById('nc-segmento').value,
    estado: document.getElementById('nc-estado').value,

    // Información Financiera
    limite_credito: getFloatValue('nc-limite-credito'),
    deuda_actual: getFloatValue('nc-deuda-actual'),
    terminos_pago: document.getElementById('nc-terminos-pago')?.value || '30',
    dias_credito: getNumericValue('nc-dias-credito') || 30,
    metodo_pago: document.getElementById('nc-metodo-pago').value,

    // Calificaciones
    cal_general: getNumericValue('nc-cal-general'),
    cal_pago: getNumericValue('nc-cal-pago'),
    cal_comunicacion: getNumericValue('nc-cal-comunicacion'),
    cal_equipos: getNumericValue('nc-cal-equipos'),
    cal_satisfaccion: getNumericValue('nc-cal-satisfaccion'),
    fecha_evaluacion: document.getElementById('nc-fecha-evaluacion').value || null,
    notas_evaluacion: document.getElementById('nc-notas-evaluacion').value,
    notas_generales: document.getElementById('nc-notas-generales').value,

    // Campos de compatibilidad
    empresa: document.getElementById('nc-razon-social').value,
    contacto: document.getElementById('nc-representante').value || document.getElementById('nc-nombre').value
  };
  try {
    const headers = getAuthHeaders();
    let response;
    if (modo === 'edicion' && id) {
      // Actualizar cliente
      response = await fetch(`${CLIENTES_URL}/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data)
      });
    } else {
      // Alta nuevo cliente
      response = await fetch(CLIENTES_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.details || `Error: ${response.status}`);
    }
    showMessage('Cliente guardado correctamente');
    document.getElementById('nuevo-cliente-modal').classList.remove('show');
    cargarClientes();
  } catch (err) {
    console.error('Error al guardar cliente:', err);
    showMessage(`Error al guardar cliente: ${err.message}`, 'error');
  }
};

// --- FUNCIONES PARA VALIDACIÓN RFC Y BÚSQUEDAS AVANZADAS ---

// Función para validar RFC en tiempo real
async function validarRFC(rfc, inputElement) {
  if (!rfc || rfc.length < 12) {
    return;
  }

  try {
    const headers = getAuthHeaders();
    const response = await fetch(`${CLIENTES_URL}/validate-rfc/${rfc}`, { headers });

    if (!response.ok) {
      throw new Error('Error al validar RFC');
    }

    const result = await response.json();

    // Limpiar clases anteriores
    inputElement.classList.remove('rfc-valid', 'rfc-invalid', 'rfc-exists');

    if (result.valid) {
      if (result.exists) {
        inputElement.classList.add('rfc-exists');
        inputElement.title = `RFC ya registrado: ${result.cliente.nombre}`;
        showMessage(`RFC ya registrado para: ${result.cliente.nombre}`, 'error');
      } else {
        inputElement.classList.add('rfc-valid');
        inputElement.title = 'RFC válido';
      }
    } else {
      inputElement.classList.add('rfc-invalid');
      inputElement.title = result.message;
      showMessage(result.message, 'error');
    }
  } catch (error) {
    console.error('Error al validar RFC:', error);
    inputElement.classList.add('rfc-invalid');
  }
}

// Función para buscar cliente por RFC
async function buscarClientePorRFC(rfc) {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(`${CLIENTES_URL}/rfc/${rfc}`, { headers });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Error al buscar cliente por RFC');
    }

    return await response.json();
  } catch (error) {
    console.error('Error al buscar cliente por RFC:', error);
    return null;
  }
}

// Función para auto-completar datos de facturación desde RFC básico
async function autoCompletarDatosFacturacion() {
  const rfcBasico = document.getElementById('nc-rfc').value;
  const rfcFacturacion = document.getElementById('nc-fact-rfc').value;

  if (rfcBasico && !rfcFacturacion) {
    document.getElementById('nc-fact-rfc').value = rfcBasico;
  }

  const curpBasico = document.getElementById('nc-curp').value;
  const curpFacturacion = document.getElementById('nc-fact-curp').value;

  if (curpBasico && !curpFacturacion) {
    document.getElementById('nc-fact-curp').value = curpBasico;
  }
}

// Función para sincronizar campos relacionados
function sincronizarCampos() {
  // Sincronizar teléfonos
  const telefono = document.getElementById('nc-telefono').value;
  const celular = document.getElementById('nc-celular').value;

  // Sincronizar direcciones
  const domicilio = document.getElementById('nc-domicilio').value;

  // Sincronizar razón social con empresa (si existe el campo)
  const razonSocial = document.getElementById('nc-razon-social').value;
  if (razonSocial && document.getElementById('nc-empresa')) {
    document.getElementById('nc-empresa').value = razonSocial;
  }
}

// Función para formatear RFC automáticamente
function formatearRFC(input) {
  let value = input.value.toUpperCase().replace(/[^A-ZÑ&0-9]/g, '');

  // Limitar longitud
  if (value.length > 13) {
    value = value.substring(0, 13);
  }

  input.value = value;

  // Validar en tiempo real si tiene longitud suficiente
  if (value.length >= 12) {
    validarRFC(value, input);
  }
}

// Función para formatear CURP automáticamente
function formatearCURP(input) {
  let value = input.value.toUpperCase().replace(/[^A-ZÑ0-9]/g, '');

  // Limitar longitud a 18 caracteres
  if (value.length > 18) {
    value = value.substring(0, 18);
  }

  input.value = value;
}

// Función para formatear código postal
function formatearCodigoPostal(input) {
  let value = input.value.replace(/[^0-9]/g, '');

  // Limitar a 5 dígitos
  if (value.length > 5) {
    value = value.substring(0, 5);
  }

  input.value = value;
}

// Función para seleccionar cotización para clonación
function selectQuotationForCloning(quotationData) {
  try {
    console.log('Seleccionando cotización para clonar:', quotationData);

    // Verificar que tenemos acceso a la ventana padre (cotización_renta.html)
    if (!window.opener) {
      console.error('No hay ventana padre disponible');
      showMessage('Error: No se puede comunicar con la ventana de cotización', 'error');
      return;
    }

    // Limpiar modo clonación
    sessionStorage.removeItem('clone-mode');

    // Enviar datos de la cotización seleccionada a la ventana padre
    console.log('Enviando mensaje a ventana padre...');
    window.opener.postMessage({
      type: 'QUOTATION_SELECTED_FOR_CLONING',
      quotationData: quotationData
    }, '*');

    // Cerrar el modal de historial
    const modal = document.getElementById('historial-cliente-modal');
    if (modal) {
      modal.classList.remove('show');
    }

    // Cerrar la ventana de clientes si fue abierta en popup
    if (window.opener && window.name === 'client-selection') {
      setTimeout(() => {
        window.close();
      }, 500);
    }

    showMessage('Cotización seleccionada para clonación', 'success');
  } catch (error) {
    console.error('Error seleccionando cotización:', error);
    showMessage('Error al seleccionar cotización', 'error');
  }
}

// --- FUNCIONES PARA MÓDULO DE ABONOS/CRÉDITOS ---

let clientesCreditoFuente = [];
let clienteCreditoSeleccionado = null;
const detalleCreditoCache = new Map();
const creditoSeleccionadoPorCliente = new Map();
const abonoSeleccionadoPorCliente = new Map();

function obtenerIdClienteCredito(cliente) {
  const raw = cliente?.id ?? cliente?.id_cliente ?? null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function obtenerClienteCreditoSeleccionado() {
  if (!clienteCreditoSeleccionado) return null;
  return clientesCreditoFuente.find(c => String(obtenerIdClienteCredito(c)) === String(clienteCreditoSeleccionado)) || null;
}

function actualizarEstadoBotonSaldo() {
  const btnSaldo = document.getElementById('abonos-btn-saldo');
  if (!btnSaldo) return;
  btnSaldo.disabled = !obtenerClienteCreditoSeleccionado();
}

function aplicarSeleccionVisualClientesCredito() {
  const filas = document.querySelectorAll('#abonos-table-body tr.abonos-cliente-row');
  filas.forEach((fila) => {
    const filaId = fila.getAttribute('data-cliente-id');
    fila.classList.toggle('is-selected', String(filaId) === String(clienteCreditoSeleccionado));
  });
}

function seleccionarClienteCredito(clienteId) {
  const existe = clientesCreditoFuente.some(c => String(obtenerIdClienteCredito(c)) === String(clienteId));
  clienteCreditoSeleccionado = existe ? String(clienteId) : null;
  aplicarSeleccionVisualClientesCredito();
  actualizarEstadoBotonSaldo();
}

function construirCreditosCliente(cliente) {
  if (Array.isArray(cliente?.creditos) && cliente.creditos.length > 0) {
    return cliente.creditos;
  }

  return [{
    doc: 'TIC',
    folio: cliente?.id || '',
    folioCfdi: '',
    rp: false,
    fecha: new Date().toLocaleDateString('es-MX'),
    vencimiento: '',
    credito: Number(cliente?.deuda || 0),
    abonos: 0,
    saldo: Number(cliente?.deuda || 0)
  }];
}

function construirAbonosCliente(cliente) {
  if (Array.isArray(cliente?.abonos)) return cliente.abonos;
  return [];
}

function construirNotasCreditoCliente(cliente) {
  if (Array.isArray(cliente?.notas_credito)) return cliente.notas_credito;
  return [];
}

function formatCurrency(value) {
  return `$${formatMoney(Number(value || 0))}`;
}

function obtenerFacturaOrigenDesdeCredito(credito) {
  const raw = credito?.id_factura ?? credito?.idFactura ?? null;
  const val = Number(raw);
  return Number.isInteger(val) && val > 0 ? val : null;
}

function renderRowsCreditos(creditos, facturaSeleccionada = null) {
  if (!creditos.length) {
    return '<tr><td colspan="9" class="saldo-empty-row">Sin creditos registrados</td></tr>';
  }
  return creditos.map((credito) => {
    const facturaId = obtenerFacturaOrigenDesdeCredito(credito);
    const saldo = Number(credito?.saldo || 0);
    const selectable = !!facturaId && saldo > 0;
    const selected = selectable && Number(facturaSeleccionada) === Number(facturaId);
    return `
    <tr class="saldo-credito-row ${selectable ? 'is-selectable' : ''} ${selected ? 'is-selected' : ''}" data-factura-id="${facturaId || ''}">
      <td>${escapeHtml(credito.doc || '')}</td>
      <td>${escapeHtml(credito.folio || '')}</td>
      <td>${escapeHtml(credito.folioCfdi || credito.folio_cfdi || '')}</td>
      <td class="saldo-rp-cell"><input type="checkbox" ${credito.rp ? 'checked' : ''} disabled></td>
      <td>${escapeHtml(credito.fecha || '')}</td>
      <td>${escapeHtml(credito.vencimiento || '')}</td>
      <td class="saldo-num">${formatCurrency(credito.credito || 0)}</td>
      <td class="saldo-num">${formatCurrency(credito.abonos || 0)}</td>
      <td class="saldo-num">${formatCurrency(credito.saldo || 0)}</td>
    </tr>
  `;
  }).join('');
}

function renderRowsAbonos(abonos, clienteId = null, abonoSeleccionado = null) {
  if (!abonos.length) {
    return '<tr><td colspan="6" class="saldo-empty-row">Sin abonos registrados</td></tr>';
  }
  return abonos.map((abono) => {
    const idAbono = Number(abono?.id || 0);
    const selected = Number.isInteger(idAbono) && idAbono > 0 && Number(abonoSeleccionado) === idAbono;
    const pdfPath = String(abono?.pdf_path || '');
    return `
    <tr class="saldo-abono-row ${selected ? 'is-selected' : ''}" data-abono-id="${idAbono || ''}" data-pdf-path="${escapeHtml(pdfPath)}" style="cursor:${idAbono > 0 ? 'pointer' : 'default'};">
      <td>${escapeHtml(abono.fecha || '')}</td>
      <td>${escapeHtml(abono.tp || '')}</td>
      <td>${escapeHtml(abono.multPago || abono.mult_pago || '')}</td>
      <td>${escapeHtml(abono.referencia || '')}</td>
      <td>${escapeHtml(abono.cfdi || '')}</td>
      <td class="saldo-num">${formatCurrency(abono.total || 0)}</td>
    </tr>
  `;
  }).join('');
}

function renderRowsNotasCredito(notas) {
  if (!notas.length) {
    return '<tr><td colspan="4" class="saldo-empty-row">Sin notas de credito registradas</td></tr>';
  }
  return notas.map((nota) => `
    <tr>
      <td>${escapeHtml(nota.fecha || '')}</td>
      <td>${escapeHtml(nota.folio || '')}</td>
      <td>${escapeHtml(nota.serie || '')}</td>
      <td class="saldo-num">${formatCurrency(nota.total || 0)}</td>
    </tr>
  `).join('');
}

function htmlModalSaldoCliente(cliente) {
  const creditos = construirCreditosCliente(cliente);
  const abonos = construirAbonosCliente(cliente);
  const notas = construirNotasCreditoCliente(cliente);
  const clienteId = obtenerIdClienteCredito(cliente);
  const facturaSeleccionada = creditoSeleccionadoPorCliente.get(String(clienteId)) || null;
  const abonoSeleccionado = abonoSeleccionadoPorCliente.get(String(clienteId)) || null;
  const totalCreditos = creditos.reduce((sum, item) => sum + Number(item.saldo || 0), 0);
  const totalAbonos = abonos.reduce((sum, item) => sum + Number(item.total || 0), 0);

  return `
    <div class="saldo-modal-wrap">
      <div class="saldo-toolbar">
        <button class="saldo-action-btn" data-action="abono"><i class="fas fa-plus-circle icon-green"></i><span>Abono (F3)</span></button>
        <button class="saldo-action-btn" data-action="mostrar"><i class="fas fa-eye icon-slate"></i><span>Mostrar (F4)</span></button>
        <button class="saldo-action-btn" data-action="actualizar"><i class="fas fa-sync-alt icon-blue"></i><span>Actualizar (F5)</span></button>
        <button class="saldo-action-btn" data-action="eliminar"><i class="fas fa-times-circle icon-red"></i><span>Eliminar (F6)</span></button>
        <button class="saldo-action-btn" data-action="pagare"><i class="fas fa-money-check-alt icon-slate"></i><span>Pagare (F7)</span></button>
        <button class="saldo-action-btn" data-action="multipago"><i class="fas fa-wallet icon-slate"></i><span>MultiPago (F8)</span></button>
        <button class="saldo-action-btn" data-action="recibo"><i class="fas fa-receipt icon-slate"></i><span>Recibo (Alt+R)</span></button>
      </div>

      <div class="saldo-form-row">
        <div class="saldo-field">
          <label for="saldo-buscar-credito">Buscar Credito</label>
          <input id="saldo-buscar-credito" type="text" autocomplete="off" />
        </div>
        <div class="saldo-field">
          <label>Cliente</label>
          <input type="text" value="${escapeHtml(cliente?.nombre || 'Sin nombre')}" readonly />
        </div>
        <div class="saldo-field">
          <label>Telefono</label>
          <input type="text" value="${escapeHtml(cliente?.telefono || '')}" readonly />
        </div>
        <div class="saldo-field">
          <label>Celular</label>
          <input type="text" value="${escapeHtml(cliente?.celular || '')}" readonly />
        </div>
      </div>

      <div class="saldo-table-section">
        <div class="saldo-title">Lista de Creditos</div>
        <table class="saldo-table" id="saldo-creditos-table">
          <thead>
            <tr>
              <th>Doc</th>
              <th>Folio</th>
              <th>Folio CFDI</th>
              <th>RP</th>
              <th>Fecha</th>
              <th>Vencimiento</th>
              <th>Credito</th>
              <th>Abonos</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>${renderRowsCreditos(creditos, facturaSeleccionada)}</tbody>
        </table>
        <div class="saldo-total">Total: ${formatCurrency(totalCreditos)}</div>
      </div>

      <div class="saldo-table-section">
        <div class="saldo-title">Lista de Abonos</div>
        <table class="saldo-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>TP</th>
              <th>Mult Pago</th>
              <th>Referencia</th>
              <th>CFDI</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${renderRowsAbonos(abonos, clienteId, abonoSeleccionado)}</tbody>
        </table>
        <div class="saldo-total">Total: ${formatCurrency(totalAbonos)}</div>
      </div>

      <div class="saldo-table-section">
        <div class="saldo-title">Lista de Notas de Credito</div>
        <table class="saldo-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Folio</th>
              <th>Serie</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${renderRowsNotasCredito(notas)}</tbody>
        </table>
      </div>
    </div>
  `;
}

function htmlModalAbonoCredito(cliente, creditoSeleccionado = null) {
  const saldoActual = Number(cliente?.deuda || 0);
  const folioSeleccionado = creditoSeleccionado?.folio || creditoSeleccionado?.folioCfdi || creditoSeleccionado?.folio_cfdi || 'N/D';
  const saldoSeleccionado = Number(creditoSeleccionado?.saldo || 0);

  return `
    <div class="abono-credito-modal">
      <div class="abono-header">
        <div class="abono-header-icon"><i class="fas fa-plus"></i></div>
        <div class="abono-header-title">Abono a Credito</div>
      </div>

      <div class="abono-row">
        <div class="abono-row-icon icon-danger"><i class="fas fa-arrow-down"></i></div>
        <div class="abono-field-wrap">
          <label for="abono-credito-saldo">Saldo</label>
          <div class="abono-inline">
            <input id="abono-credito-saldo" type="text" value="${saldoActual.toFixed(2)}" readonly>
            <div class="abono-currency-view"><span class="flag">🇲🇽</span><span>MXN</span></div>
          </div>
        </div>
      </div>

      <div class="abono-divider"></div>

      <div class="abono-selected-credit">
        Credito seleccionado: Folio ${escapeHtml(String(folioSeleccionado))} | Saldo ${formatCurrency(saldoSeleccionado)}
      </div>

      <div class="abono-row">
        <div class="abono-row-icon icon-slate"><i class="fas fa-file-invoice"></i></div>
        <div class="abono-field-wrap">
          <label for="abono-credito-forma-pago">Forma de Pago</label>
          <div class="abono-inline">
            <select id="abono-credito-forma-pago">
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Cheque">Cheque</option>
            </select>
            <div class="abono-inline-currency">
              <span class="abono-row-icon icon-gold"><i class="fas fa-coins"></i></span>
              <select id="abono-credito-moneda">
                <option value="MXN" selected>MXN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div id="abono-credito-tarjeta-wrap" class="abono-card-type-wrap" hidden>
            <label for="abono-credito-tipo-tarjeta">Tipo de Tarjeta</label>
            <select id="abono-credito-tipo-tarjeta">
              <option value="Credito">Credito</option>
              <option value="Debito">Debito</option>
            </select>
          </div>
        </div>
      </div>

      <div class="abono-row">
        <div class="abono-row-icon icon-green"><i class="fas fa-money-bill-wave"></i></div>
        <div class="abono-field-wrap">
          <label for="abono-credito-monto">Abono</label>
          <div class="abono-inline">
            <input id="abono-credito-monto" type="number" min="0" step="0.01" value="0">
            <label class="abono-check">
              <input id="abono-credito-saldar-total" type="checkbox">
              <span>Saldar Total</span>
            </label>
            <div class="abono-inline-total"><span class="flag">🇲🇽</span><span id="abono-credito-preview">0.00</span></div>
          </div>
        </div>
      </div>

      <div class="abono-row">
        <div class="abono-row-icon icon-slate"><i class="fas fa-eye"></i></div>
        <div class="abono-field-wrap">
          <label for="abono-credito-referencia">Referencia</label>
          <input id="abono-credito-referencia" type="text" placeholder="Referencia del movimiento">
        </div>
      </div>

      <button id="abono-credito-guardar" class="abono-save-btn" disabled>
        <i class="fas fa-save"></i>
        Guardar
      </button>
    </div>
  `;
}

function numeroEnteroALetrasES(n) {
  const unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  const convertir99 = (num) => {
    if (num < 10) return unidades[num];
    if (num < 20) return especiales[num - 10];
    if (num < 30) return num === 20 ? 'VEINTE' : `VEINTI${unidades[num - 20].toLowerCase()}`.toUpperCase();
    const d = Math.floor(num / 10);
    const u = num % 10;
    return u ? `${decenas[d]} Y ${unidades[u]}` : decenas[d];
  };

  const convertir999 = (num) => {
    if (num === 0) return '';
    if (num === 100) return 'CIEN';
    const c = Math.floor(num / 100);
    const r = num % 100;
    const base = centenas[c];
    return `${base}${base && r ? ' ' : ''}${convertir99(r)}`.trim();
  };

  if (n === 0) return 'CERO';
  if (n < 1000) return convertir999(n);

  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const milesTxt = miles === 1 ? 'MIL' : `${convertir999(miles)} MIL`;
  return `${milesTxt}${resto ? ` ${convertir999(resto)}` : ''}`.trim();
}

function monedaALetrasMXN(monto) {
  const valor = Number(monto || 0);
  const entero = Math.floor(valor);
  const centavos = Math.round((valor - entero) * 100);
  const letras = numeroEnteroALetrasES(entero);
  return `${letras} PESOS ${String(centavos).padStart(2, '0')}/100 MN`;
}

function htmlModalConfirmacionAbono(totalAbono) {
  const total = Number(totalAbono || 0);
  return `
    <div class="abono-confirm-modal">
      <div class="abono-confirm-icon"><i class="fas fa-hand-holding-dollar"></i></div>
      <div class="abono-confirm-title">Detalles del Abono</div>
      <div class="abono-confirm-divider"></div>

      <div class="abono-confirm-label pago-label">PAGO CON</div>
      <input id="abono-confirm-pago-con" class="abono-confirm-pago-input" type="number" min="${total.toFixed(2)}" step="0.01" value="${total.toFixed(2)}" />

      <div class="abono-confirm-label total-label">TOTAL DEL ABONO</div>
      <div class="abono-confirm-total">$ ${formatMoney(total)}</div>

      <div class="abono-confirm-divider"></div>

      <div class="abono-confirm-label cambio-label">CAMBIO</div>
      <div id="abono-confirm-cambio" class="abono-confirm-cambio">$ 0.00</div>
      <div id="abono-confirm-cambio-letras" class="abono-confirm-cambio-letras">(CERO PESOS 00/100 MN)</div>

      <button id="abono-confirm-aceptar" class="abono-confirm-btn">
        <i class="fas fa-check-square"></i>
        Aceptar
      </button>
    </div>
  `;
}

async function abrirConfirmacionAbono(totalAbono) {
  const total = Number(totalAbono || 0);

  return new Promise((resolve) => {
    Swal.fire({
      title: '',
      html: htmlModalConfirmacionAbono(total),
      width: 560,
      customClass: {
        popup: 'abono-confirm-popup'
      },
      showCloseButton: true,
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => {
        const inputPagoCon = document.getElementById('abono-confirm-pago-con');
        const cambioEl = document.getElementById('abono-confirm-cambio');
        const cambioLetrasEl = document.getElementById('abono-confirm-cambio-letras');
        const btnAceptar = document.getElementById('abono-confirm-aceptar');

        const actualizarCambio = () => {
          const pagoCon = Number(inputPagoCon?.value || 0);
          const cambio = pagoCon - total;
          const cambioPositivo = cambio > 0 ? cambio : 0;

          if (cambioEl) cambioEl.textContent = `$ ${formatMoney(cambioPositivo)}`;
          if (cambioLetrasEl) cambioLetrasEl.textContent = `(${monedaALetrasMXN(cambioPositivo)})`;
          if (btnAceptar) btnAceptar.disabled = pagoCon < total;
        };

        const confirmar = () => {
          const pagoCon = Number(inputPagoCon?.value || 0);
          if (pagoCon < total) return;
          const cambio = Math.max(0, pagoCon - total);
          resolve({ confirmed: true, pagoCon, cambio });
          Swal.close();
        };

        if (inputPagoCon) {
          inputPagoCon.addEventListener('input', actualizarCambio);
          inputPagoCon.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              confirmar();
            }
          });
          inputPagoCon.focus();
          inputPagoCon.select();
        }

        if (btnAceptar) {
          btnAceptar.addEventListener('click', confirmar);
        }

        actualizarCambio();
      },
      willClose: () => {
        resolve({ confirmed: false });
      }
    });
  });
}

async function obtenerDetalleCreditoCliente(clienteId) {
  const response = await fetch(`/api/clientes/credito/${clienteId}/detalle`, {
    headers: getAuthHeaders()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || 'No se pudo obtener el detalle de credito');
  }
  return data.data;
}

async function guardarAbonoCreditoEnServidor(payload) {
  console.log('[ABONO_DEBUG_FRONT] payload /api/clientes/credito/abonos =', payload);
  const response = await fetch('/api/clientes/credito/abonos', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || 'No se pudo guardar el abono');
  }
  return data.data;
}

function mapFormaPagoSat(formaPagoUi) {
  const forma = String(formaPagoUi || '').toLowerCase();
  const map = {
    Efectivo: '01',
    Tarjeta: '03',
    Transferencia: '03',
    Cheque: '02'
  };
  if (forma.includes('tarjeta')) return '03';
  return map[formaPagoUi] || '99';
}

async function emitirFacturaAbono(clienteId, monto, formaPagoUi, referencia, moneda, opciones = {}) {
  const clienteRes = await fetch(`/api/clientes/${clienteId}`, { headers: getAuthHeaders() });
  const cliente = await clienteRes.json().catch(() => ({}));
  if (!clienteRes.ok) {
    throw new Error('No se pudo cargar informacion fiscal del cliente');
  }

  const rfc = cliente.fact_rfc || cliente.rfc || 'XAXX010101000';
  const usoCfdi = cliente.fact_uso_cfdi || cliente.uso_cfdi || (rfc === 'XAXX010101000' ? 'S01' : 'G03');
  const regimenFiscal = cliente.fact_regimen_fiscal || cliente.regimen_fiscal || (rfc === 'XAXX010101000' ? '616' : '601');
  const codigoPostal = cliente.fact_codigo_postal || cliente.codigo_postal || '64000';
  const nombreFiscal = cliente.fact_razon_social || cliente.razon_social || cliente.nombre || 'PUBLICO EN GENERAL';
  const formaPagoSat = mapFormaPagoSat(formaPagoUi);

  const payload = {
    receptor: {
      id_cliente: clienteId,
      rfc,
      nombre: nombreFiscal,
      codigoPostal,
      regimenFiscal,
      usoCfdi: 'CP01'
    },
    factura: {
      formaPago: formaPagoSat,
      metodoPago: 'PPD',
      tipo: 'P',
      serie: 'P',
      moneda: moneda || 'MXN',
      observaciones: referencia || 'Abono a credito'
    },
    conceptos: [],
    complementoPago: {
      date: new Date().toISOString(),
      amount: Number(monto || 0),
      paymentForm: formaPagoSat,
      currency: moneda || 'MXN',
      relatedDocument: {
        uuid: opciones?.relatedUuid || '',
        serie: opciones?.relatedSerie || '',
        folio: opciones?.relatedFolio || '',
        currency: 'MXN',
        paymentMethod: opciones?.paymentMethod || 'PPD',
        partialityNumber: Number(opciones?.partialityNumber || 1),
        previousBalanceAmount: Number(opciones?.previousBalanceAmount || monto || 0),
        amountPaid: Number(opciones?.amountPaid || monto || 0),
        impSaldoInsoluto: Number(opciones?.impSaldoInsoluto || 0),
        taxObject: opciones?.taxObject || '01'
      }
    }
  };

  const response = await fetch('/api/facturas/timbrar', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || 'No se pudo timbrar la factura del abono');
  }
  return data?.data?.uuid || data?.uuid || null;
}

async function vincularFacturaMovimiento(ledgerId, uuid) {
  if (!ledgerId || !uuid) return;
  await fetch(`/api/clientes/credito/abonos/${ledgerId}/factura`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ uuid })
  });
}

async function abrirModalAbonoCredito() {
  const cliente = obtenerClienteCreditoSeleccionado();
  const clienteId = obtenerIdClienteCredito(cliente);
  if (!cliente) {
    Swal.fire('Seleccione un cliente', 'Debe seleccionar un cliente para registrar abonos.', 'info');
    return;
  }
  if (!clienteId) {
    Swal.fire('Cliente invalido', 'No se pudo identificar un id_cliente valido para el abono.', 'error');
    return;
  }

  const saldoActual = Number(cliente.deuda || 0);
  const detalleCliente = detalleCreditoCache.get(String(clienteId)) || null;
  const facturaSeleccionada = creditoSeleccionadoPorCliente.get(String(clienteId)) || null;
  const creditoSeleccionado = Array.isArray(detalleCliente?.creditos)
    ? detalleCliente.creditos.find((c) => Number(obtenerFacturaOrigenDesdeCredito(c)) === Number(facturaSeleccionada))
    : null;

  await Swal.fire({
    title: '',
    html: htmlModalAbonoCredito(cliente, creditoSeleccionado),
    width: 640,
    customClass: {
      popup: 'abono-credito-popup'
    },
    showCloseButton: true,
    showConfirmButton: false,
    allowOutsideClick: false,
    didOpen: () => {
      const inputSaldo = document.getElementById('abono-credito-saldo');
      const inputMonto = document.getElementById('abono-credito-monto');
      const chkSaldar = document.getElementById('abono-credito-saldar-total');
      const btnGuardar = document.getElementById('abono-credito-guardar');
      const preview = document.getElementById('abono-credito-preview');
      const inputRef = document.getElementById('abono-credito-referencia');
      const selectFormaPago = document.getElementById('abono-credito-forma-pago');
      const tarjetaWrap = document.getElementById('abono-credito-tarjeta-wrap');
      const selectTipoTarjeta = document.getElementById('abono-credito-tipo-tarjeta');

      const actualizarEstadoGuardar = () => {
        const monto = Number(inputMonto?.value || 0);
        const valido = Number.isFinite(monto) && monto > 0;
        if (btnGuardar) btnGuardar.disabled = !valido;
        if (preview) preview.textContent = formatMoney(monto > 0 ? monto : 0);
      };

      const actualizarTipoTarjeta = () => {
        const esTarjeta = (selectFormaPago?.value || '') === 'Tarjeta';
        if (tarjetaWrap) tarjetaWrap.hidden = !esTarjeta;
        if (esTarjeta && selectTipoTarjeta && !selectTipoTarjeta.value) {
          selectTipoTarjeta.value = 'Credito';
        }
      };

      if (chkSaldar) {
        chkSaldar.addEventListener('change', () => {
          if (!inputMonto || !inputSaldo) return;
          if (chkSaldar.checked) {
            inputMonto.value = String(Number(inputSaldo.value || 0).toFixed(2));
          }
          actualizarEstadoGuardar();
        });
      }

      if (inputMonto) {
        inputMonto.addEventListener('input', actualizarEstadoGuardar);
      }

      if (btnGuardar) {
        btnGuardar.addEventListener('click', async () => {
          const monto = Number(inputMonto?.value || 0);
          if (!(monto > 0)) return;

          const confirmacion = await abrirConfirmacionAbono(monto);
          if (!confirmacion?.confirmed) return;

          const moneda = document.getElementById('abono-credito-moneda')?.value || 'MXN';
          const formaPago = document.getElementById('abono-credito-forma-pago')?.value || 'Efectivo';
          const tipoTarjeta = (formaPago === 'Tarjeta')
            ? (document.getElementById('abono-credito-tipo-tarjeta')?.value || 'Credito')
            : null;
          const formaPagoDetalle = (formaPago === 'Tarjeta' && tipoTarjeta)
            ? `Tarjeta ${tipoTarjeta}`
            : formaPago;
          const referencia = (inputRef?.value || '').trim();
          btnGuardar.disabled = true;
          btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

          try {
            const facturaOrigen = Array.isArray(detalleCliente?.creditos)
              ? detalleCliente.creditos.find((c) => {
                  const factId = obtenerFacturaOrigenDesdeCredito(c);
                  return Number(c?.saldo || 0) > 0 && factId && Number(factId) === Number(facturaSeleccionada);
                })
              : null;

            if (!facturaOrigen) {
              Swal.fire('Seleccione un credito', 'Debe seleccionar en la tabla el credito al que desea aplicar el abono.', 'info');
              return;
            }

            const saveResult = await guardarAbonoCreditoEnServidor({
              id_cliente: clienteId,
              monto,
              forma_pago: formaPagoDetalle,
              tipo_tarjeta: tipoTarjeta,
              moneda,
              referencia,
              pago_con: confirmacion.pagoCon,
              cambio: confirmacion.cambio,
              factura_origen_id: obtenerFacturaOrigenDesdeCredito(facturaOrigen)
            });

            let uuidComplemento = null;
            let errorTimbradoComplemento = '';
            try {
              uuidComplemento = await emitirFacturaAbono(
                clienteId,
                monto,
                formaPago,
                referencia,
                moneda,
                {
                  relatedUuid: facturaOrigen?.folioCfdi || facturaOrigen?.folio_cfdi || '',
                  relatedSerie: '',
                  relatedFolio: facturaOrigen?.folio || '',
                  paymentMethod: 'PPD',
                  partialityNumber: 1,
                  previousBalanceAmount: Number(saveResult?.saldo_factura_antes || 0),
                  amountPaid: Number(monto || 0),
                  impSaldoInsoluto: Number(saveResult?.saldo_factura_despues || 0),
                  taxObject: '01'
                }
              );
            } catch (timbradoErr) {
              console.error('Error timbrando complemento de pago del abono:', timbradoErr);
              errorTimbradoComplemento = timbradoErr?.message || 'Error desconocido al timbrar complemento';
            }

            if (uuidComplemento && saveResult?.ledger_id) {
              try {
                await vincularFacturaMovimiento(saveResult.ledger_id, uuidComplemento);
              } catch (linkErr) {
                console.error('Error vinculando CFDI timbrado al abono:', linkErr);
              }
            }

            await cargarClientesCredito();
            seleccionarClienteCredito(null);
            
            // Mostrar comprobante de abono si se generó
            if (saveResult && saveResult.comprobante_pdf) {
              setTimeout(() => {
                mostrarComprobanteAbono({
                  comprobante_pdf: saveResult.comprobante_pdf,
                  cliente_nombre: detalleCliente.nombre || '',
                  monto: monto,
                  fecha: new Date().toLocaleDateString('es-MX'),
                  referencia: referencia,
                  folio: saveResult.ledger_id ? `ABONO-${saveResult.ledger_id}` : 'N/A'
                });
              }, 500);
            }
            
            showMessage(`Abono guardado por ${formatCurrency(monto)} (${moneda})`, 'success');
            if (errorTimbradoComplemento) {
              Swal.fire(
                'Complemento no timbrado',
                `El abono se guardó, pero el CFDI de pago no se timbró: ${errorTimbradoComplemento}`,
                'warning'
              );
            }
          } catch (saveErr) {
            console.error('Error guardando abono:', saveErr);
            showMessage(`No se pudo guardar el abono: ${saveErr.message}`, 'error');
          } finally {
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar';
          }
        });
      }

      if (selectFormaPago) {
        selectFormaPago.addEventListener('change', actualizarTipoTarjeta);
      }

      actualizarEstadoGuardar();
      actualizarTipoTarjeta();
      setTimeout(() => inputMonto?.focus(), 0);
    }
  });
}

function ejecutarAccionModalSaldo(action) {
  if (action === 'abono') {
    abrirModalAbonoCredito();
    return;
  }
  if (action === 'mostrar') {
    const rowSeleccionada = document.querySelector('.saldo-abono-row.is-selected');
    if (!rowSeleccionada) {
      Swal.fire('Seleccione un abono', 'Seleccione una fila en la lista de abonos para mostrar su comprobante.', 'info');
      return;
    }

    const pdfPath = String(rowSeleccionada.getAttribute('data-pdf-path') || '').trim();
    const abonoId = rowSeleccionada.getAttribute('data-abono-id') || '';
    if (!pdfPath) {
      Swal.fire('Sin comprobante', 'El abono seleccionado no tiene PDF asociado.', 'warning');
      return;
    }

    const cliente = obtenerClienteCreditoSeleccionado();
    const clienteId = obtenerIdClienteCredito(cliente);
    if (clienteId && abonoId) {
      abonoSeleccionadoPorCliente.set(String(clienteId), Number(abonoId));
    }

    Swal.close();
    setTimeout(() => {
      mostrarComprobanteAbono({
        comprobante_pdf: pdfPath,
        cliente_nombre: cliente?.nombre || '',
        folio: `ABONO-${abonoId || ''}`
      });
    }, 120);
    return;
  }

  const acciones = {
    abono: 'Abono (F3)',
    mostrar: 'Mostrar (F4)',
    actualizar: 'Actualizar (F5)',
    eliminar: 'Eliminar (F6)',
    pagare: 'Pagare (F7)',
    multipago: 'MultiPago (F8)',
    recibo: 'Recibo (Alt+R)'
  };

  const etiqueta = acciones[action] || action;
  Swal.showValidationMessage(`Accion: ${etiqueta}`);
  setTimeout(() => Swal.resetValidationMessage(), 900);
}

// Cargar clientes con crédito desde API
async function cargarClientesCredito() {
  try {
    const token = localStorage.getItem('token');
    console.log('🔗 Conectando a /api/clientes/credito/listado...');
    
    const response = await fetch('/api/clientes/credito/listado', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📡 Respuesta del servidor:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Datos recibidos:', data);
      const fuente = Array.isArray(data) ? data : (data.clientes || []);
      clientesCreditoFuente = fuente.map((item) => {
        const idRaw = item?.id ?? item?.id_cliente ?? null;
        const idNum = Number(idRaw);
        const idValido = Number.isInteger(idNum) && idNum > 0 ? idNum : null;
        return {
          ...item,
          id: idValido,
          id_cliente: idValido,
          deuda: Number(item?.deuda || 0),
          limite_credito: Number(item?.limite_credito || 0),
          creditoDisponible: Number(item?.creditoDisponible || 0)
        };
      }).filter((item) => Number.isInteger(item.id) && item.id > 0);
      console.log(`📊 Total de clientes con crédito cargados: ${clientesCreditoFuente.length}`);
      
      if (clientesCreditoFuente.length === 0) {
        console.warn('⚠️ No hay clientes con crédito en la base de datos');
      }
      
      renderizarClientesCredito(clientesCreditoFuente);
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Error del servidor:', response.status, errorData);
      showMessage(`Error: ${errorData.error || 'No se pudieron cargar los clientes'}`, 'error');
      mostrarClientesCreditoDemo();
    }
  } catch (error) {
    console.error('❌ Error en cargarClientesCredito:', error.message, error);
    showMessage('Error de conexión: ' + error.message, 'error');
    mostrarClientesCreditoDemo();
  }
}

// Renderizar tabla de clientes con crédito
function renderizarClientesCreditoLegacyOld(clientes) {
  const tbody = document.getElementById('abonos-table-body');
  if (!tbody) return;

  if (!Array.isArray(clientes) || clientes.length === 0) {
    tbody.innerHTML = '<tr style="background:#f5f5f5;"><td colspan="5" style="padding:20px; text-align:center; color:#999;"><i class="fas fa-inbox"></i> No hay clientes con crédito registrados</td></tr>';
    return;
  }

  tbody.innerHTML = clientes.map((cliente, index) => `
    <tr style="background:${index % 2 === 0 ? '#ffffff' : '#f9f9f9'}; border-bottom:1px solid #e0e0e0; cursor:pointer;" onclick="abrirClienteDetalle('${cliente.id}')">
      <td style="padding:12px; border-right:1px solid #f0f0f0; font-weight:600;">${cliente.id || 'N/A'}</td>
      <td style="padding:12px; border-right:1px solid #f0f0f0;">${cliente.nombre || 'Sin nombre'}</td>
      <td style="padding:12px; border-right:1px solid #f0f0f0;">${cliente.telefono || 'N/A'}</td>
      <td style="padding:12px; border-right:1px solid #f0f0f0;">${cliente.celular || 'N/A'}</td>
      <td style="padding:12px; text-align:right; font-weight:600; color:#d32f2f;">$${formatMoney(cliente.deuda || 0)}</td>
    </tr>
  `).join('');
}

// Mostrar datos de demo si falla la carga
function mostrarClientesCreditoDemo() {
  const demo = [
    { id: 3, nombre: 'SICAR Punto de Venta - Julio Hernández', telefono: '3173826696', celular: '3173826696', deuda: 791.46 },
    { id: 5, nombre: 'Construcciones López SA', telefono: '5559876543', celular: '5551234567', deuda: 2500.00 },
    { id: 7, nombre: 'Servicios Técnicos Regionales', telefono: '5556543210', celular: '5559876543', deuda: 1250.75 },
  ];
  clientesCreditoFuente = demo;
  renderizarClientesCredito(demo);
}

// Filtrar y reordenar clientes
function aplicarFiltrosAbonos() {
  const busqueda = (document.getElementById('abonos-search')?.value || '').toLowerCase();
  const ordenPor = document.getElementById('abonos-sort')?.value || 'cliente';
  const sentido = document.getElementById('abonos-orden')?.value || 'asc';
  const estado = document.getElementById('abonos-estado')?.value || '';

  let filtrados = clientesCreditoFuente.filter(c => {
    const coincideBusqueda = !busqueda || 
      (c.nombre || '').toLowerCase().includes(busqueda) ||
      (c.id || '').toString().includes(busqueda) ||
      (c.telefono || '').includes(busqueda);
    
    const coincideEstado = !estado || (c.estado || '').toLowerCase() === estado;
    
    return coincideBusqueda && coincideEstado;
  });

  // Ordenar
  filtrados.sort((a, b) => {
    let valA, valB;
    
    if (ordenPor === 'cliente') {
      valA = a.id || 0;
      valB = b.id || 0;
    } else if (ordenPor === 'nombre') {
      valA = (a.nombre || '').toLowerCase();
      valB = (b.nombre || '').toLowerCase();
    } else if (ordenPor === 'deuda') {
      valA = a.deuda || 0;
      valB = b.deuda || 0;
    }

    if (typeof valA === 'string') {
      return sentido === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      return sentido === 'asc' ? valA - valB : valB - valA;
    }
  });

  renderizarClientesCredito(filtrados);
}

// Recargar clientes con crédito
async function recargarClientesCredito() {
  console.log('🔄 Recargando clientes con crédito...');
  await cargarClientesCredito();
  showMessage('Datos recargados exitosamente', 'success');
}

// Ver saldo total de deuda
function verSaldoDeudaLegacyOld() {
  const totalDeuda = clientesCreditoFuente.reduce((sum, c) => sum + (c.deuda || 0), 0);
  const cantClientes = clientesCreditoFuente.length;
  
  Swal.fire({
    title: 'Resumen de Deuda',
    html: `
      <div style="text-align:left; font-size:14px;">
        <p><strong>Total de clientes con crédito:</strong> ${cantClientes}</p>
        <p><strong>Deuda total:</strong> <span style="color:#d32f2f; font-size:18px; font-weight:bold;">$${formatMoney(totalDeuda)}</span></p>
        <p style="color:#999; font-size:12px; margin-top:10px;">Datos al ${new Date().toLocaleDateString('es-MX')}</p>
      </div>
    `,
    icon: 'info',
    confirmButtonText: 'Cerrar',
    confirmButtonColor: '#0056b3'
  });
}

// Notificar clientes
function notificarClientes() {
  const cantClientes = clientesCreditoFuente.length;
  
  if (cantClientes === 0) {
    Swal.fire('Sin clientes', 'No hay clientes con crédito pendiente', 'info');
    return;
  }

  Swal.fire({
    title: 'Notificar Clientes',
    html: `
      <div style="text-align:left; font-size:14px;">
        <p>¿Desea enviar notificaciones de deuda a:</p>
        <p style="font-weight:bold; color:#0056b3;">${cantClientes} cliente(s)</p>
        <p style="color:#999; font-size:12px;">Se enviarán notificaciones por correo y/o SMS según configuración.</p>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Enviar Notificaciones',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#0056b3'
  }).then((result) => {
    if (result.isConfirmed) {
      console.log('📧 Notificaciones enviadas a', cantClientes, 'clientes');
      showMessage(`Notificaciones enviadas a ${cantClientes} cliente(s)`, 'success');
    }
  });
}

// Abrir detalle del cliente
function abrirClienteDetalle(clienteId) {
  console.log('👤 Abriendo detalle de cliente:', clienteId);
  verHistorial(clienteId);
}

// Configurar event listeners para tabs y filtros
// Override: renderizado con seleccion de fila para habilitar el boton Saldo
function renderizarClientesCredito(clientes) {
  const tbody = document.getElementById('abonos-table-body');
  if (!tbody) return;

  if (!Array.isArray(clientes) || clientes.length === 0) {
    clienteCreditoSeleccionado = null;
    actualizarEstadoBotonSaldo();
    tbody.innerHTML = '<tr style="background:#f5f5f5;"><td colspan="5" style="padding:20px; text-align:center; color:#999;"><i class="fas fa-inbox"></i> No hay clientes con credito registrados</td></tr>';
    return;
  }

  tbody.innerHTML = clientes.map((cliente, index) => {
    const idCliente = obtenerIdClienteCredito(cliente);
    return `
    <tr class="abonos-cliente-row ${String(idCliente) === String(clienteCreditoSeleccionado) ? 'is-selected' : ''}" data-cliente-id="${idCliente || ''}" style="background:${index % 2 === 0 ? '#ffffff' : '#f9f9f9'}; border-bottom:1px solid #e0e0e0; cursor:pointer;">
      <td style="padding:12px; border-right:1px solid #f0f0f0; font-weight:600;">${idCliente || 'N/A'}</td>
      <td style="padding:12px; border-right:1px solid #f0f0f0;">${cliente.nombre || 'Sin nombre'}</td>
      <td style="padding:12px; border-right:1px solid #f0f0f0;">${cliente.telefono || 'N/A'}</td>
      <td style="padding:12px; border-right:1px solid #f0f0f0;">${cliente.celular || 'N/A'}</td>
      <td style="padding:12px; text-align:right; font-weight:600; color:#d32f2f;">$${formatMoney(cliente.deuda || 0)}</td>
    </tr>
  `;
  }).join('');

  const filas = tbody.querySelectorAll('tr.abonos-cliente-row');
  filas.forEach((fila) => {
    fila.addEventListener('click', () => {
      const id = fila.getAttribute('data-cliente-id');
      seleccionarClienteCredito(id);
    });
    fila.addEventListener('dblclick', () => {
      const id = fila.getAttribute('data-cliente-id');
      abrirClienteDetalle(id);
    });
  });

  if (!clientes.some(c => String(obtenerIdClienteCredito(c)) === String(clienteCreditoSeleccionado))) {
    clienteCreditoSeleccionado = null;
  }
  aplicarSeleccionVisualClientesCredito();
  actualizarEstadoBotonSaldo();
}

// Override: modal avanzado de lista de creditos del cliente seleccionado
async function verSaldoDeuda() {
  const modalSaldoVisible = Swal.isVisible() && !!document.querySelector('.saldo-creditos-modal');
  if (modalSaldoVisible) {
    ejecutarAccionModalSaldo('multipago');
    return;
  }

  const cliente = obtenerClienteCreditoSeleccionado();
  const clienteId = obtenerIdClienteCredito(cliente);
  if (!cliente) {
    Swal.fire('Seleccione un cliente', 'Para abrir el saldo debe seleccionar una fila de la tabla.', 'info');
    return;
  }
  if (!clienteId) {
    Swal.fire('Cliente invalido', 'No se pudo identificar un id_cliente valido para consultar saldo.', 'error');
    return;
  }

  let clienteDetalle = cliente;
  try {
    const detalle = await obtenerDetalleCreditoCliente(clienteId);
    if (detalle) {
      clienteDetalle = { ...cliente, ...detalle };
      detalleCreditoCache.set(String(clienteId), clienteDetalle);
    }
  } catch (error) {
    console.warn('No se pudo cargar detalle de credito en linea:', error.message);
  }

  const creditosActivos = Array.isArray(clienteDetalle?.creditos)
    ? clienteDetalle.creditos.filter((c) => Number(c?.saldo || 0) > 0 && !!obtenerFacturaOrigenDesdeCredito(c))
    : [];
  const seleccionadoPrevio = Number(creditoSeleccionadoPorCliente.get(String(clienteId)) || 0);
  if (creditosActivos.length) {
    const sigueVigente = creditosActivos.some((c) => Number(obtenerFacturaOrigenDesdeCredito(c)) === seleccionadoPrevio);
    if (!sigueVigente) {
      creditoSeleccionadoPorCliente.set(String(clienteId), Number(obtenerFacturaOrigenDesdeCredito(creditosActivos[0])));
    }
  } else {
    creditoSeleccionadoPorCliente.delete(String(clienteId));
  }

  const abonosCliente = Array.isArray(clienteDetalle?.abonos) ? clienteDetalle.abonos : [];
  const abonoSeleccionadoPrevio = Number(abonoSeleccionadoPorCliente.get(String(clienteId)) || 0);
  if (abonosCliente.length) {
    const sigueAbonoSeleccionado = abonosCliente.some((a) => Number(a?.id || 0) === abonoSeleccionadoPrevio);
    if (!sigueAbonoSeleccionado) {
      const abonoConPdf = abonosCliente.find((a) => {
        const id = Number(a?.id || 0);
        const pdf = String(a?.pdf_path || '').trim();
        return Number.isInteger(id) && id > 0 && pdf.length > 0;
      });
      if (abonoConPdf) {
        abonoSeleccionadoPorCliente.set(String(clienteId), Number(abonoConPdf.id));
      } else {
        abonoSeleccionadoPorCliente.delete(String(clienteId));
      }
    }
  } else {
    abonoSeleccionadoPorCliente.delete(String(clienteId));
  }

  const keydownHandler = (event) => {
    const key = event.key;
    const altR = event.altKey && String(key).toLowerCase() === 'r';
    const mapa = {
      F3: 'abono',
      F4: 'mostrar',
      F5: 'actualizar',
      F6: 'eliminar',
      F7: 'pagare',
      F8: 'multipago'
    };

    if (altR) {
      event.preventDefault();
      ejecutarAccionModalSaldo('recibo');
      return;
    }

    if (mapa[key]) {
      event.preventDefault();
      ejecutarAccionModalSaldo(mapa[key]);
    }
  };

  Swal.fire({
    title: 'Lista de creditos del cliente',
    html: htmlModalSaldoCliente(clienteDetalle),
    width: '95%',
    customClass: {
      popup: 'saldo-creditos-modal'
    },
    showCloseButton: true,
    showConfirmButton: false,
    allowOutsideClick: false,
    didOpen: () => {
      const searchInput = document.getElementById('saldo-buscar-credito');
      if (searchInput) {
        searchInput.focus();
        searchInput.addEventListener('input', (event) => {
          const term = String(event.target.value || '').toLowerCase().trim();
          const rows = document.querySelectorAll('#saldo-creditos-table tbody tr');
          rows.forEach((row) => {
            const texto = row.textContent.toLowerCase();
            row.style.display = !term || texto.includes(term) ? '' : 'none';
          });
        });
      }

      document.querySelectorAll('.saldo-action-btn').forEach((btn) => {
        btn.addEventListener('click', () => ejecutarAccionModalSaldo(btn.dataset.action));
      });

      const marcarSeleccion = (facturaId) => {
        document.querySelectorAll('#saldo-creditos-table tbody tr.saldo-credito-row').forEach((row) => {
          row.classList.toggle('is-selected', String(row.getAttribute('data-factura-id')) === String(facturaId));
        });
      };

      document.querySelectorAll('#saldo-creditos-table tbody tr.saldo-credito-row.is-selectable').forEach((row) => {
        row.addEventListener('click', () => {
          const facturaId = Number(row.getAttribute('data-factura-id') || 0);
          if (!Number.isInteger(facturaId) || facturaId <= 0) return;
          creditoSeleccionadoPorCliente.set(String(clienteId), facturaId);
          marcarSeleccion(facturaId);
        });
      });

      const marcarAbonoSeleccion = (abonoId) => {
        document.querySelectorAll('tr.saldo-abono-row').forEach((row) => {
          row.classList.toggle('is-selected', String(row.getAttribute('data-abono-id')) === String(abonoId));
        });
      };

      document.querySelectorAll('tr.saldo-abono-row').forEach((row) => {
        row.addEventListener('click', () => {
          const abonoId = Number(row.getAttribute('data-abono-id') || 0);
          if (!Number.isInteger(abonoId) || abonoId <= 0) return;
          abonoSeleccionadoPorCliente.set(String(clienteId), abonoId);
          marcarAbonoSeleccion(abonoId);
        });
      });

      document.addEventListener('keydown', keydownHandler);
    },
    willClose: () => {
      document.removeEventListener('keydown', keydownHandler);
    }
  });
}

function configurarEventosAbonos() {
  // Cambiar entre tabs
  const tabBtns = document.querySelectorAll('.transacciones-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      
      // Desactivar todos los tabs y contenidos
      document.querySelectorAll('.transacciones-tab-btn').forEach(b => {
        b.style.color = '#777';
        b.style.borderBottomColor = 'transparent';
      });
      document.querySelectorAll('.transacciones-tab-content').forEach(c => {
        c.style.display = 'none';
      });

      // Activar tab seleccionado
      btn.style.color = '#0056b3';
      btn.style.borderBottomColor = '#0056b3';
      document.getElementById(`tab-${tab}-content`).style.display = 'block';

      // Cargar clientes si es Tab de Abonos
      if (tab === 'abonos') {
        cargarClientesCredito();
      }
    });
  });

  // Event listeners para búsqueda y filtros
  const searchInput = document.getElementById('abonos-search');
  if (searchInput) {
    searchInput.addEventListener('input', aplicarFiltrosAbonos);
  }

  const sortSelect = document.getElementById('abonos-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', aplicarFiltrosAbonos);
  }

  const ordenSelect = document.getElementById('abonos-orden');
  if (ordenSelect) {
    ordenSelect.addEventListener('change', aplicarFiltrosAbonos);
  }

  const estadoSelect = document.getElementById('abonos-estado');
  if (estadoSelect) {
    estadoSelect.addEventListener('change', aplicarFiltrosAbonos);
  }
}

// Atajos de teclado
document.addEventListener('keydown', (event) => {
  if (event.key === 'F5') {
    event.preventDefault();
    recargarClientesCredito();
  } else if (event.key === 'F8') {
    event.preventDefault();
    verSaldoDeuda();
  } else if (event.key === 'F11') {
    event.preventDefault();
    notificarClientes();
  }
});

// Inicializar eventos de abonos cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  configurarEventosAbonos();
  actualizarEstadoBotonSaldo();
});

// Hacer funciones disponibles globalmente
window.cargarClientes = cargarClientes;
window.buscarClientes = buscarClientes;
window.eliminarCliente = eliminarCliente;
window.editarCliente = editarCliente;
window.verHistorial = verHistorial;
window.configurarEventosClientes = configurarEventosClientes;
window.mostrarModalEncuestaSatisfaccion = mostrarModalEncuestaSatisfaccion;
window.copiarURL = copiarURL;
window.compartirWhatsApp = compartirWhatsApp;
window.compartirEmail = compartirEmail;
window.generarURLPersonalizada = generarURLPersonalizada;
window.verEstadisticas = verEstadisticas;
window.validarRFC = validarRFC;
window.buscarClientePorRFC = buscarClientePorRFC;
window.autoCompletarDatosFacturacion = autoCompletarDatosFacturacion;
window.sincronizarCampos = sincronizarCampos;
window.formatearRFC = formatearRFC;
window.formatearCURP = formatearCURP;
window.formatearCodigoPostal = formatearCodigoPostal;

window.disableCreditSection = disableCreditSection;
window.enableCreditSection = enableCreditSection;
window.prepararModalCredito = prepararModalCredito;

// Funciones de abonos
window.cargarClientesCredito = cargarClientesCredito;
window.recargarClientesCredito = recargarClientesCredito;
window.verSaldoDeuda = verSaldoDeuda;
window.notificarClientes = notificarClientes;
window.abrirClienteDetalle = abrirClienteDetalle;


// Auto-abrir historial si venimos desde clonación
document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const isCloneMode = urlParams.get('clone') === 'true';
  const clientId = urlParams.get('id');
  const action = urlParams.get('action');

  console.log('🔍 [CLONACIÓN] Parámetros URL:', { isCloneMode, clientId, action });

  if (isCloneMode && clientId && action === 'historial') {
    console.log('🔄 [CLONACIÓN] Auto-abriendo historial para cliente:', clientId);

    // Esperar un poco para que la página se cargue completamente
    setTimeout(() => {
      verHistorial(clientId);

      // Mostrar notificación
      showMessage('Modo clonación: Seleccione una cotización para clonar', 'info');
    }, 500);
  }
});

// ===============================================
// FUNCIONES PARA MODAL DE COMPROBANTE DE ABONO
// ===============================================

let comprobanteAbonoActual = {
  pdfPath: null,
  pdfName: null,
  clienteNombre: '',
  monto: 0,
  fecha: new Date().toLocaleDateString('es-MX'),
  referencia: '',
  folio: ''
};

function mostrarComprobanteAbono(datos) {
  console.log('[COMPROBANTE ABONO] Datos recibidos:', datos);
  
  // Guardar datos actuales del comprobante
  comprobanteAbonoActual = {
    pdfPath: datos.comprobante_pdf || datos.pdf_path,
    pdfName: datos.pdf_name || 'comprobante-abono.pdf',
    clienteNombre: datos.cliente_nombre || '',
    monto: datos.monto || 0,
    fecha: datos.fecha || new Date().toLocaleDateString('es-MX'),
    referencia: datos.referencia || '',
    folio: datos.folio || datos.comprobante || ''
  };

  // Rellenar información del comprobante
  document.getElementById('comp-folio').textContent = comprobanteAbonoActual.folio || '-';
  document.getElementById('comp-monto').textContent = formatMoney(comprobanteAbonoActual.monto);
  document.getElementById('comp-fecha').textContent = comprobanteAbonoActual.fecha;
  document.getElementById('comp-cliente').textContent = comprobanteAbonoActual.clienteNombre || '-';
  document.getElementById('comp-referencia').textContent = comprobanteAbonoActual.referencia || '-';

  // Cargar el PDF en el iframe
  if (comprobanteAbonoActual.pdfPath) {
    const iframePdfPreview = document.getElementById('abono-pdf-preview');
    
    // Construir URL del PDF usando el endpoint de /api/pdf/ver/
    const token = localStorage.getItem('token');
    const pdfFileName = comprobanteAbonoActual.pdfPath.includes('/') 
      ? comprobanteAbonoActual.pdfPath.split('/').pop() 
      : comprobanteAbonoActual.pdfPath;
    
    const pdfUrl = `/api/pdf/ver/${encodeURIComponent(pdfFileName)}?token=${token}`;
    
    iframePdfPreview.src = pdfUrl;
    console.log('[COMPROBANTE ABONO] Cargando PDF desde:', pdfUrl);
  }

  // Mostrar la modal
  document.getElementById('comprobante-abono-modal').style.display = 'flex';
}

function cerrarComprobanteAbono() {
  document.getElementById('comprobante-abono-modal').style.display = 'none';
}

async function enviarComprobanteAbonoPorEmail() {
  const email = document.getElementById('abono-email-cliente').value.trim();
  const asunto = document.getElementById('abono-asunto-email').value.trim();
  const mensaje = document.getElementById('abono-mensaje-email').value.trim();

  if (!email) {
    showMessage('Por favor ingrese un email', 'error');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showMessage('Por favor ingrese un email válido', 'error');
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/clientes/enviar-comprobante-abono', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        email,
        asunto: asunto || 'Comprobante de Abono',
        mensaje,
        pdf_path: comprobanteAbonoActual.pdfPath,
        pdf_name: comprobanteAbonoActual.pdfName,
        cliente_nombre: comprobanteAbonoActual.clienteNombre,
        monto: comprobanteAbonoActual.monto,
        folio: comprobanteAbonoActual.folio
      })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      showMessage('Comprobante enviado exitosamente al email', 'success');
      cerrarComprobanteAbono();
    } else {
      showMessage(result.error || 'Error al enviar el comprobante', 'error');
    }
  } catch (error) {
    console.error('[COMPROBANTE ABONO] Error enviando email:', error);
    showMessage('Error al enviar el comprobante: ' + error.message, 'error');
  }
}

function descargarComprobanteAbono() {
  if (!comprobanteAbonoActual.pdfPath) {
    showMessage('No hay comprobante disponible para descargar', 'error');
    return;
  }

  try {
    const token = localStorage.getItem('token');
    const pdfFileName = comprobanteAbonoActual.pdfPath.includes('/') 
      ? comprobanteAbonoActual.pdfPath.split('/').pop() 
      : comprobanteAbonoActual.pdfPath;
    
    const downloadUrl = `/api/pdf/descargar/${encodeURIComponent(pdfFileName)}?token=${token}`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = comprobanteAbonoActual.pdfName || 'comprobante-abono.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showMessage('Comprobante descargado exitosamente', 'success');
  } catch (error) {
    console.error('[COMPROBANTE ABONO] Error descargando PDF:', error);
    showMessage('Error al descargar el comprobante', 'error');
  }
}

// Exportar funciones globalmente
window.mostrarComprobanteAbono = mostrarComprobanteAbono;
window.cerrarComprobanteAbono = cerrarComprobanteAbono;
window.enviarComprobanteAbonoPorEmail = enviarComprobanteAbonoPorEmail;
window.descargarComprobanteAbono = descargarComprobanteAbono;
