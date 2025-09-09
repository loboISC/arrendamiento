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

// Función para mostrar clientes en tarjetas
function mostrarClientes(clientes) {
  const clientesList = document.getElementById('clientes-list');
  if (!clientesList) return;

  if (clientes.length === 0) {
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

  // Crear el contenedor de la cuadrícula
  const gridContainer = document.createElement('div');
  gridContainer.className = 'clients-grid';

  // Generar HTML para cada cliente
  const html = clientes.map(cliente => `
    <div class="client-card">
      <div class="client-header">
        <div class="client-info">
          <div class="client-name">
            <i class="fas fa-user-circle"></i>
            ${cliente.nombre}
          </div>
          <div class="client-company">${cliente.empresa || 'Empresa no especificada'}</div>
          <div class="client-tags">
            <span class="client-tag type">${cliente.tipo_cliente || 'Regular'}</span>
            <span class="client-tag status">${cliente.estado || 'Activo'}</span>
          </div>
          <div class="client-rating">
            <i class="fas fa-star"></i>
            ${(cliente.cal_general || 4.5).toFixed(1)}
          </div>
        </div>
      </div>

      <div class="client-contact">
        <div class="contact-item">
          <i class="fas fa-envelope"></i>
          ${cliente.email || 'N/A'}
        </div>
        <div class="contact-item">
          <i class="fas fa-phone"></i>
          ${cliente.telefono || 'N/A'}
        </div>
        <div class="contact-item">
          <i class="fas fa-map-marker-alt"></i>
          ${cliente.ciudad || cliente.direccion || 'N/A'}
        </div>
        <div class="contact-item">
          <i class="fas fa-building"></i>
          ${cliente.rfc || 'N/A'}
        </div>
      </div>

      <div class="client-stats">
        <div class="stat-item">
          <div class="stat-value">${cliente.proyectos || cliente.total_cotizaciones || 0}</div>
          <div class="stat-label">Proyectos</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">$${formatMoney(cliente.valor_total || cliente.total_pagado || 0)}</div>
          <div class="stat-label">Valor Total</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${calcularAntiguedad(cliente.fecha_creacion)}</div>
          <div class="stat-label">Meses</div>
        </div>
      </div>

      <div class="client-actions">
        <button class="action-btn edit-client" data-id="${cliente.id_cliente}" title="Editar cliente">
          <i class="fas fa-edit"></i>
        </button>
        <button class="action-btn view-history" data-id="${cliente.id_cliente}" title="Ver historial">
          <i class="fas fa-history"></i>
        </button>
        <button class="action-btn delete-client" data-id="${cliente.id_cliente}" title="Eliminar cliente">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    </div>
  `).join('');

  gridContainer.innerHTML = html;
  clientesList.innerHTML = '';
  clientesList.appendChild(gridContainer);

  // Configurar event listeners para las acciones
  configurarEventosClientes();
}

// Función para formatear moneda
function formatMoney(amount) {
    return new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
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
    const response = await fetch(`${CLIENTES_URL}/buscar/${termino}`, { headers });
    
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
  const inputBusqueda = document.getElementById('buscar-cliente');
  if (inputBusqueda) {
    let timeoutId;
    inputBusqueda.addEventListener('input', function() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        buscarClientes(this.value);
      }, 300);
    });
  }
  
  // Event listener para botón de agregar cliente
  const btnAgregarCliente = document.getElementById('btn-agregar-cliente');
  if (btnAgregarCliente) {
    btnAgregarCliente.addEventListener('click', function() {
      // Aquí puedes agregar la lógica para abrir un modal de nuevo cliente
      showMessage('Función de agregar cliente en desarrollo', 'error');
    });
  }
});

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
  const modal = document.getElementById('nuevo-cliente-modal');
  const form = document.getElementById('nuevo-cliente-form');
  // Cambia el título y el botón
  modal.querySelector('.modal-header h3').textContent = 'Editar Cliente';
  modal.querySelector('.modal-header .modal-subtitle').textContent = 'Modifica la información del cliente';
  form.setAttribute('data-modo', 'edicion');
  form.setAttribute('data-id', cliente.id_cliente);
  // Rellenar campos
  document.getElementById('nc-nombre').value = cliente.nombre || '';
  document.getElementById('nc-empresa').value = cliente.empresa || '';
  document.getElementById('nc-telefono').value = cliente.telefono || '';
  document.getElementById('nc-telefono-alt').value = cliente.telefono_alt || '';
  document.getElementById('nc-contacto').value = cliente.contacto || '';
  document.getElementById('nc-email').value = cliente.email || '';
  document.getElementById('nc-sitio-web').value = cliente.sitio_web || '';
  document.getElementById('nc-nit').value = cliente.nit || '';
  document.getElementById('nc-direccion').value = cliente.direccion || '';
  document.getElementById('nc-segmento').value = cliente.segmento || 'Individual';
  document.getElementById('nc-estado').value = cliente.estado || 'Activo';
  document.getElementById('nc-limite-credito').value = cliente.limite_credito || 0;
  document.getElementById('nc-deuda-actual').value = cliente.deuda_actual || 0;
  document.getElementById('nc-terminos-pago').value = cliente.terminos_pago || 30;
  document.getElementById('nc-metodo-pago').value = cliente.metodo_pago || 'Transferencia';
  document.getElementById('nc-cal-general').value = cliente.cal_general || 5;
  document.getElementById('nc-cal-pago').value = cliente.cal_pago || 5;
  document.getElementById('nc-cal-comunicacion').value = cliente.cal_comunicacion || 5;
  document.getElementById('nc-cal-equipos').value = cliente.cal_equipos || 5;
  document.getElementById('nc-cal-satisfaccion').value = cliente.cal_satisfaccion || 5;
  document.getElementById('nc-fecha-evaluacion').value = cliente.fecha_evaluacion ? cliente.fecha_evaluacion.substring(0,10) : '';
  document.getElementById('nc-notas-evaluacion').value = cliente.notas_evaluacion || '';
  document.getElementById('nc-notas-generales').value = cliente.notas_generales || '';
  // Mostrar modal
  modal.classList.add('show');
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
  // Recolectar datos
  const data = {
    nombre: document.getElementById('nc-nombre').value,
    empresa: document.getElementById('nc-empresa').value,
    telefono: document.getElementById('nc-telefono').value,
    telefono_alt: document.getElementById('nc-telefono-alt').value,
    contacto: document.getElementById('nc-contacto').value,
    email: document.getElementById('nc-email').value,
    sitio_web: document.getElementById('nc-sitio-web').value,
    nit: document.getElementById('nc-nit').value,
    direccion: document.getElementById('nc-direccion').value,
    segmento: document.getElementById('nc-segmento').value,
    estado: document.getElementById('nc-estado').value,
    limite_credito: document.getElementById('nc-limite-credito').value,
    deuda_actual: document.getElementById('nc-deuda-actual').value,
    terminos_pago: document.getElementById('nc-terminos-pago').value,
    metodo_pago: document.getElementById('nc-metodo-pago').value,
    cal_general: document.getElementById('nc-cal-general').value,
    cal_pago: document.getElementById('nc-cal-pago').value,
    cal_comunicacion: document.getElementById('nc-cal-comunicacion').value,
    cal_equipos: document.getElementById('nc-cal-equipos').value,
    cal_satisfaccion: document.getElementById('nc-cal-satisfaccion').value,
    fecha_evaluacion: document.getElementById('nc-fecha-evaluacion').value,
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