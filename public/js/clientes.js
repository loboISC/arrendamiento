// API URL para clientes
const CLIENTES_URL = 'http://localhost:3001/api/clientes';

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
    mostrarClientes(clientes);
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

  const gridContainer = document.createElement('div');
  gridContainer.className = 'clients-grid';

  clientes.forEach(cliente => {
    const card = document.createElement('div');
    card.className = 'client-card';
    card.setAttribute('data-id', String(cliente.id_cliente || ''));
    card.setAttribute('data-nombre', String(cliente.nombre || ''));
    card.setAttribute('data-empresa', String(cliente.empresa || ''));
    card.setAttribute('data-email', String(cliente.email || ''));
    card.setAttribute('data-telefono', String(cliente.telefono || ''));
    card.setAttribute('data-rfc', String(cliente.rfc || ''));
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

  clientesList.innerHTML = '';
  clientesList.appendChild(gridContainer);

  // Acciones estándar de edición/historial/eliminar
  try { configurarEventosClientes(); } catch {}

  // Modo selección: click comunica al padre
  if (isPickMode) {
    clientesList.querySelectorAll('.client-card').forEach(card => {
      const send = (ev) => {
        ev?.preventDefault?.(); ev?.stopPropagation?.();
        const payload = {
          id: card.getAttribute('data-id') || '',
          nombre: card.getAttribute('data-nombre') || '',
          empresa: card.getAttribute('data-empresa') || '',
          email: card.getAttribute('data-email') || '',
          telefono: card.getAttribute('data-telefono') || '',
          rfc: card.getAttribute('data-rfc') || ''
        };
        try { window.parent.postMessage({ type: 'select-client', payload }, '*'); } catch {}
      };
      card.addEventListener('click', send);
      card.querySelector('.select-client')?.addEventListener('click', send);
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
    mostrarClientes(clientes);
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
document.addEventListener('DOMContentLoaded', function() {
  // Cargar clientes al iniciar
  cargarClientes();
  
  // Configurar tabs del historial
  configurarTabsHistorial();
  
  // Event listener para búsqueda
  const inputBusqueda = document.getElementById('search-input');
  if (inputBusqueda) {
    let timeoutId;
    inputBusqueda.addEventListener('input', function() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        buscarClientes(this.value);
      }, 300);
    });
  }
  
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
      input.addEventListener('input', function() {
        formatearRFC(this);
      });
      
      input.addEventListener('blur', function() {
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
      input.addEventListener('input', function() {
        formatearCURP(this);
      });
    }
  });
  
  // Event listener para código postal
  const codigoPostalInput = document.getElementById('nc-codigo-postal');
  if (codigoPostalInput) {
    codigoPostalInput.addEventListener('input', function() {
      formatearCodigoPostal(this);
    });
  }
  
  // Event listener para auto-completar datos de facturación
  const rfcBasicoInput = document.getElementById('nc-rfc');
  if (rfcBasicoInput) {
    rfcBasicoInput.addEventListener('blur', function() {
      autoCompletarDatosFacturacion();
    });
  }
  
  // Event listener para sincronizar campos
  const razonSocialInput = document.getElementById('nc-razon-social');
  if (razonSocialInput) {
    razonSocialInput.addEventListener('blur', function() {
      sincronizarCampos();
    });
  }
  
  // Event listener para validar que régimen fiscal sea requerido con RFC de facturación
  const factRfcInput = document.getElementById('nc-fact-rfc');
  const regimenFiscalInput = document.getElementById('nc-regimen-fiscal');
  
  if (factRfcInput && regimenFiscalInput) {
    factRfcInput.addEventListener('blur', function() {
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
      input.addEventListener('input', function() {
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
    btn.addEventListener('click', function() {
      const idCliente = this.dataset.id;
      editarCliente(idCliente);
    });
  });

  // Event listeners para botones de ver historial
  document.querySelectorAll('.view-history').forEach(btn => {
    btn.addEventListener('click', function() {
      const idCliente = this.dataset.id;
      verHistorial(idCliente);
    });
  });

  // Event listeners para botones de eliminar
  document.querySelectorAll('.delete-client').forEach(btn => {
    btn.addEventListener('click', function() {
      const idCliente = this.dataset.id;
      eliminarCliente(idCliente);
    });
  });
}

// Función para ver historial del cliente
async function verHistorial(idCliente) {
  try {
    // Por ahora, obtener solo los datos básicos del cliente
    const headers = getAuthHeaders();
    const response = await fetch(`${CLIENTES_URL}/${idCliente}`, { headers });
    
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return;
      }
      throw new Error('Error al cargar datos del cliente');
    }
    
    const cliente = await response.json();
    mostrarModalHistorialCliente(cliente);
  } catch (error) {
    console.error('Error al cargar historial del cliente:', error);
    showMessage('Error al cargar historial del cliente', 'error');
  }
}

// Función para mostrar el modal de historial del cliente
function mostrarModalHistorialCliente(cliente) {
  const modal = document.getElementById('historial-cliente-modal');
  
  // Rellenar información del cliente
  document.getElementById('historial-cliente-nombre').textContent = cliente.nombre || 'Sin nombre';
  document.getElementById('historial-cliente-empresa').textContent = cliente.empresa || 'Sin empresa';
  document.getElementById('historial-cliente-tipo').textContent = cliente.tipo_cliente || 'Regular';
  document.getElementById('historial-cliente-estado').textContent = cliente.estado || 'Activo';
  
  // Por ahora, mostrar datos de ejemplo en las estadísticas
  document.getElementById('historial-total-contratos').textContent = '0';
  document.getElementById('historial-total-cotizaciones').textContent = '0';
  document.getElementById('historial-total-facturas').textContent = '0';
  document.getElementById('historial-valor-total').textContent = '$0';
  
  // Mostrar modal
  modal.classList.add('show');
}

// Función para configurar las tabs del historial
function configurarTabsHistorial() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', function() {
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
  btnCerrarHistorial.onclick = function() {
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
    const response = await fetch('http://localhost:3001/api/encuestas/estadisticas', { headers });
    
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
    
    const response = await fetch('http://localhost:3001/api/encuestas', {
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
  btnCerrarEncuesta.onclick = function() {
    document.getElementById('encuesta-satisfaccion-modal').classList.remove('show');
  };
}

// --- MODAL REUTILIZABLE PARA ALTA Y EDICIÓN DE CLIENTES ---

// Mostrar modal para editar cliente y rellenar campos
function mostrarModalEditarCliente(cliente) {
  console.log('Abriendo modal de edición para cliente:', cliente.nombre);
  const modal = document.getElementById('nuevo-cliente-modal');
  const form = document.getElementById('nuevo-cliente-form');
  
  if (!modal) {
    console.error('Modal nuevo-cliente-modal no encontrada');
    return;
  }
  
  // Cambia el título y el botón
  modal.querySelector('.modal-header h3').textContent = 'Editar Cliente';
  modal.querySelector('.modal-header .modal-subtitle').textContent = 'Modifica la información del cliente';
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
    setFieldValue('nc-fecha-evaluacion', cliente.fecha_evaluacion ? cliente.fecha_evaluacion.substring(0,10) : '');
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
  btnNuevoCliente.addEventListener('click', function() {
    const modal = document.getElementById('nuevo-cliente-modal');
    const form = document.getElementById('nuevo-cliente-form');
    modal.querySelector('.modal-header h3').textContent = 'Nuevo Cliente';
    modal.querySelector('.modal-header .modal-subtitle').textContent = 'Completa la información para crear un nuevo cliente';
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
  btnCerrarModal.onclick = function() {
    document.getElementById('nuevo-cliente-modal').classList.remove('show');
  };
}

// Enviar formulario (alta o edición)
document.getElementById('nuevo-cliente-form').onsubmit = async function(e) {
  e.preventDefault();
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
    nombre: document.getElementById('nc-nombre').value,
    rfc: document.getElementById('nc-rfc').value,
    curp: document.getElementById('nc-curp').value,
    telefono: document.getElementById('nc-telefono').value,
    celular: document.getElementById('nc-celular').value,
    email: document.getElementById('nc-email').value,
    comentario: document.getElementById('nc-comentario').value,
    numero_precio: getNumericValue('nc-numero-precio'),
    limite_credito: getFloatValue('nc-limite-credito'),
    dias_credito: getNumericValue('nc-dias-credito'),
    grupo_entero: getNumericValue('nc-grupo-entero'),
    
    // Datos de Facturación
    fact_rfc: document.getElementById('nc-fact-rfc').value,
    fact_iucr: document.getElementById('nc-fact-iucr').value,
    razon_social: document.getElementById('nc-razon-social').value,
    fact_curp: document.getElementById('nc-fact-curp').value,
    regimen_fiscal: document.getElementById('nc-regimen-fiscal').value,
    uso_cfdi: document.getElementById('nc-uso-cfdi').value,
    domicilio: document.getElementById('nc-domicilio').value,
    numero_ext: document.getElementById('nc-numero-ext').value,
    numero_int: document.getElementById('nc-numero-int').value,
    codigo_postal: document.getElementById('nc-codigo-postal').value,
    colonia: document.getElementById('nc-colonia').value,
    ciudad: document.getElementById('nc-ciudad').value,
    localidad: document.getElementById('nc-localidad').value,
    estado_direccion: document.getElementById('nc-estado').value,
    pais: document.getElementById('nc-pais').value,
    aplican_retenciones: document.getElementById('nc-aplican-retenciones').checked,
    desglosar_ieps: document.getElementById('nc-desglosar-ieps').checked,
    
    // Campos existentes (mantener compatibilidad)
    empresa: document.getElementById('nc-razon-social').value, // usar razón social como empresa
    telefono_alt: document.getElementById('nc-celular').value, // usar celular como teléfono alternativo
    direccion: document.getElementById('nc-domicilio').value, // usar domicilio como dirección
    segmento: document.getElementById('nc-segmento').value,
    estado: document.getElementById('nc-segmento').value, // mantener para compatibilidad
    contacto_principal: document.getElementById('nc-representante').value, // usar representante como contacto principal
    tipo_cliente: document.getElementById('nc-segmento').value, // usar segmento como tipo de cliente
    deuda_actual: getFloatValue('nc-deuda-actual'),
    terminos_pago: getNumericValue('nc-dias-credito'), // usar días crédito
    metodo_pago: document.getElementById('nc-metodo-pago').value,
    cal_general: getNumericValue('nc-cal-general'),
    cal_pago: getNumericValue('nc-cal-pago'),
    cal_comunicacion: getNumericValue('nc-cal-comunicacion'),
    cal_equipos: getNumericValue('nc-cal-equipos'),
    cal_satisfaccion: getNumericValue('nc-cal-satisfaccion'),
    fecha_evaluacion: document.getElementById('nc-fecha-evaluacion').value || null,
    notas_evaluacion: document.getElementById('nc-notas-evaluacion').value,
    notas_generales: document.getElementById('nc-notas-generales').value
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
    if (!response.ok) throw new Error('Error al guardar cliente');
    showMessage('Cliente guardado correctamente');
    document.getElementById('nuevo-cliente-modal').classList.remove('show');
    cargarClientes();
  } catch (err) {
    showMessage('Error al guardar cliente', 'error');
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