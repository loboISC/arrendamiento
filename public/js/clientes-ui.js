// UI y comportamiento extraído de clientes.html
(function() {
  'use strict';
  
  // Funciones de utilidad
  function normalizarRol(rol) {
    if (!rol) return '';
    const map = {
      'ventas': 'Ventas',
      'rentas': 'Rentas',
      'recepcion': 'Recepción',
      'director general': 'Director General',
      'ingeniero en sistemas': 'Ingeniero en Sistemas',
      'ingeniera de proyectos': 'Ingeniero en Proyectos',
      'sistema de gestion de calidad': 'Ingeniero en Calidad',
      'auxiliar contable': 'Contabilidad'
    };
    return map[rol.trim().toLowerCase()] || rol;
  }

  function getUserRole() {
    const user = localStorage.getItem('user');
    if (!user) return null;
    try { return normalizarRol(JSON.parse(user).rol); } catch { return null; }
  }

  // Notificaciones demo
  const previewNotifs = [
    { icon: 'fa-cube', color: '#ffc107', text: 'Stock bajo: Andamios estándar (15 unidades restantes)', time: 'Hace 2h' },
    { icon: 'fa-calendar', color: '#f44336', text: 'Contrato #2024-156 vence mañana', time: 'Hace 4h' },
    { icon: 'fa-screwdriver-wrench', color: '#2979ff', text: 'Equipo #AND-4521 requiere mantenimiento urgente', time: 'Hace 6h' }
  ];

  // Funciones de renderizado de clientes
  function formatMoney(amount) {
      return new Intl.NumberFormat('es-MX', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
      }).format(amount);
  }

  function renderClientCard(cliente) {
      const tipoPerfil = cliente.tipo || 'Regular';
      const status = cliente.status || 'Activo';
      const rating = cliente.rating || 4.5;
      
      return `
      <div class="client-card">
          <div class="client-header">
              <div class="client-info">
                  <div class="client-name">
                      <i class="fas fa-user-circle"></i>
                      ${cliente.nombre}
                  </div>
                  <div class="client-company">${cliente.empresa || 'Empresa no especificada'}</div>
                  <div class="client-tags">
                      <span class="client-tag type">${tipoPerfil}</span>
                      <span class="client-tag status">${status}</span>
                  </div>
                  <div class="client-rating">
                      <i class="fas fa-star"></i>
                      ${rating.toFixed(1)}
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
                  ${cliente.ubicacion || 'N/A'}
              </div>
              <div class="contact-item">
                  <i class="fas fa-building"></i>
                  ${cliente.rfc || 'N/A'}
              </div>
          </div>

          <div class="client-stats">
              <div class="stat-item">
                  <div class="stat-value">${cliente.proyectos || 0}</div>
                  <div class="stat-label">Proyectos</div>
              </div>
              <div class="stat-item">
                  <div class="stat-value">$${formatMoney(cliente.valor || 0)}</div>
                  <div class="stat-label">Valor Total</div>
              </div>
              <div class="stat-item">
                  <div class="stat-value">${cliente.antigüedad || 0}</div>
                  <div class="stat-label">Meses</div>
              </div>
          </div>

          <div class="client-actions">
              <button class="action-btn edit-client" data-id="${cliente.id}" title="Editar cliente">
                  <i class="fas fa-edit"></i>
              </button>
              <button class="action-btn view-history" data-id="${cliente.id}" title="Ver historial">
                  <i class="fas fa-history"></i>
              </button>
              <button class="action-btn delete-client" data-id="${cliente.id}" title="Eliminar cliente">
                  <i class="fas fa-trash-alt"></i>
              </button>
          </div>
      </div>
      `;
  }

  // Función para renderizar la lista de clientes
  function renderClientesList(clientes) {
      const container = document.getElementById('clientes-list');
      if (!container) return;

      // Crear el contenedor de la cuadrícula
      const gridContainer = document.createElement('div');
      gridContainer.className = 'clients-grid';

      // Renderizar cada cliente
      clientes.forEach(cliente => {
          gridContainer.innerHTML += renderClientCard(cliente);
      });

      // Limpiar el contenedor y agregar la cuadrícula
      container.innerHTML = '';
      container.appendChild(gridContainer);

      // Agregar event listeners para las acciones
      setupClientActions();
  }

  function setupClientActions() {
      // Edit buttons
      document.querySelectorAll('.edit-client').forEach(btn => {
          btn.addEventListener('click', (e) => {
              const clientId = e.currentTarget.dataset.id;
              openEditModal(clientId);
          });
      });

      // View history buttons
      document.querySelectorAll('.view-history').forEach(btn => {
          btn.addEventListener('click', (e) => {
              const clientId = e.currentTarget.dataset.id;
              openHistoryModal(clientId);
          });
      });

      // Delete buttons
      document.querySelectorAll('.delete-client').forEach(btn => {
          btn.addEventListener('click', (e) => {
              const clientId = e.currentTarget.dataset.id;
              if (confirm('¿Estás seguro de que deseas eliminar este cliente?')) {
                  deleteClient(clientId);
              }
          });
      });
  }

  // Función para cambiar entre secciones con animación
function cambiarSeccion(seccionId) {
  const secciones = document.querySelectorAll('section[id$="-area"]');
  const tabs = document.querySelectorAll('.tab');
  
  // Actualizar tabs
  tabs.forEach(tab => {
    if (tab.dataset.section === seccionId) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Animar secciones
  secciones.forEach(seccion => {
    if (seccion.id.startsWith(seccionId)) {
      seccion.style.display = 'block';
      setTimeout(() => {
        seccion.style.opacity = '1';
        seccion.style.transform = 'translateX(0)';
        
        // Cargar datos específicos según la sección
        if (seccionId === 'dashboard') {
          cargarEstadisticasDashboard();
        } else if (seccionId === 'satisfaccion') {
          cargarMetricasSatisfaccion();
        }
      }, 50);
    } else {
      seccion.style.opacity = '0';
      seccion.style.transform = 'translateX(20px)';
      setTimeout(() => {
        seccion.style.display = 'none';
      }, 300);
    }
  });
}

// Variables globales para los gráficos
let charts = {};

// Función para cargar estadísticas del dashboard
async function cargarEstadisticasDashboard() {
    try {
        const headers = getAuthHeaders();
        console.log('Cargando estadísticas del dashboard...');
        const response = await fetch('http://localhost:3001/api/clientes/stats', { headers });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const stats = await response.json();
        console.log('Estadísticas recibidas:', stats);
        console.log('Resumen específico:', stats.resumen);
        
        if (stats && stats.resumen) {
            actualizarDashboard(stats);
        } else {
            console.warn('Datos de estadísticas incompletos:', stats);
            showMessage('Datos de estadísticas incompletos', 'error');
        }
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        showMessage(`Error al cargar estadísticas: ${error.message}`, 'error');
        
        // Mostrar datos de ejemplo si falla la conexión
        mostrarDatosEjemplo();
    }
}

// Función para mostrar datos de ejemplo si falla la conexión
function mostrarDatosEjemplo() {
    const statsEjemplo = {
        resumen: {
            total_clientes: 0,
            clientes_activos: 0,
            ingresos_totales: 0,
            calificacion_promedio: 0
        },
        tipos: [],
        ciudades: [],
        satisfaccion: {
            calificacion_general: 0,
            calificacion_pago: 0,
            calificacion_comunicacion: 0,
            calificacion_equipos: 0,
            calificacion_satisfaccion: 0
        },
        top_clientes: []
    };
    
    actualizarDashboard(statsEjemplo);
}

// Función para actualizar el dashboard con datos reales
function actualizarDashboard(stats) {
    // Actualizar tarjetas de resumen
    actualizarTarjetasResumen(stats.resumen);
    
    // Actualizar gráficos
    actualizarGraficos(stats);
}

// Función para actualizar las tarjetas de resumen
function actualizarTarjetasResumen(resumen) {
    console.log('Actualizando tarjetas con datos:', resumen);
    console.log('Valores específicos:', {
        total_clientes: resumen.total_clientes,
        clientes_activos: resumen.clientes_activos,
        ingresos_totales: resumen.ingresos_totales,
        calificacion_promedio: resumen.calificacion_promedio
    });
    
    // Buscar todas las tarjetas y actualizar por posición
    const cards = document.querySelectorAll('.summary-card');
    console.log('Tarjetas encontradas:', cards.length);
    
    cards.forEach((card, index) => {
        const value = card.querySelector('.info .value');
        console.log(`Tarjeta ${index}:`, card.querySelector('.info .label')?.textContent, value);
        
        if (value) {
            switch(index) {
                case 0: // Total Clientes
                    value.textContent = resumen.total_clientes || 0;
                    break;
                case 1: // Clientes Activos
                    value.textContent = resumen.clientes_activos || 0;
                    break;
                case 2: // Calificación Promedio
                    const calificacion = parseFloat(resumen.calificacion_promedio || 0);
                    value.textContent = calificacion.toFixed(1);
                    break;
                case 3: // Ingresos Totales
                    const ingresos = parseFloat(resumen.ingresos_totales || 0);
                    value.textContent = `$${ingresos.toLocaleString('es-MX')}`;
                    break;
            }
        }
    });
}

// Función para actualizar todos los gráficos
function actualizarGraficos(stats) {
    // Destruir gráficos existentes de manera más segura
    Object.keys(charts).forEach(key => {
        if (charts[key] && typeof charts[key].destroy === 'function') {
            try {
                charts[key].destroy();
            } catch (e) {
                console.warn('Error al destruir gráfico:', e);
            }
        }
        delete charts[key];
    });
    
    // Limpiar cualquier instancia de Chart.js en los canvas
    ['clientesDistribucionChart', 'ingresosMensualesChart', 'satisfaccionChart', 'serviciosChart'].forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                existingChart.destroy();
            }
        }
    });
    
    // Gráfico de distribución por tipo de cliente
    actualizarGraficoDistribucion(stats.tipos);
    
    // Gráfico de distribución por ciudades
    actualizarGraficoCiudades(stats.ciudades);
    
    // Gráfico de satisfacción
    actualizarGraficoSatisfaccion(stats.satisfaccion);
    
    // Gráfico de top clientes
    actualizarGraficoTopClientes(stats.top_clientes);
}

// Gráfico de distribución de tipos de cliente
function actualizarGraficoDistribucion(tipos) {
    const ctx = document.getElementById('clientesDistribucionChart');
    if (!ctx) return;
    
    const labels = tipos.map(t => t.tipo_cliente || 'Sin especificar');
    const data = tipos.map(t => parseInt(t.cantidad));
    const colors = ['#3498db', '#e74c3c', '#f39c12', '#2ecc71', '#9b59b6'];
    
    charts.distribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Gráfico de distribución por ciudades
function actualizarGraficoCiudades(ciudades) {
    const ctx = document.getElementById('ingresosMensualesChart');
    if (!ctx) return;
    
    const labels = ciudades.slice(0, 6).map(c => c.ciudad);
    const data = ciudades.slice(0, 6).map(c => parseInt(c.cantidad));
    
    charts.cities = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Clientes por Ciudad',
                data: data,
                backgroundColor: '#2ecc71',
                borderColor: '#27ae60',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Gráfico de satisfacción
function actualizarGraficoSatisfaccion(satisfaccion) {
    const ctx = document.getElementById('satisfaccionChart');
    if (!ctx) return;
    
    const data = [
        parseFloat(satisfaccion.calificacion_general || 0),
        parseFloat(satisfaccion.calificacion_pago || 0),
        parseFloat(satisfaccion.calificacion_comunicacion || 0),
        parseFloat(satisfaccion.calificacion_equipos || 0),
        parseFloat(satisfaccion.calificacion_satisfaccion || 0)
    ];
    
    charts.satisfaction = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['General', 'Pago', 'Comunicación', 'Equipos', 'Satisfacción'],
            datasets: [{
                label: 'Calificación Promedio',
                data: data,
                borderColor: '#f39c12',
                backgroundColor: 'rgba(243, 156, 18, 0.2)',
                pointBackgroundColor: '#f39c12'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 5,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Gráfico de top clientes
function actualizarGraficoTopClientes(topClientes) {
    const ctx = document.getElementById('serviciosChart');
    if (!ctx) return;
    
    const labels = topClientes.map(c => c.nombre);
    const data = topClientes.map(c => parseFloat(c.valor_total || 0));
    
    charts.topClients = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valor Total ($)',
                data: data,
                backgroundColor: ['#3498db', '#e74c3c', '#f39c12', '#2ecc71', '#9b59b6']
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toLocaleString('es-MX');
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.parsed.x.toLocaleString('es-MX');
                        }
                    }
                }
            }
        }
    });
}

// Función para inicializar los gráficos del dashboard
function initCharts() {
    // Cargar estadísticas reales
    cargarEstadisticasDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar gráficas
  initCharts();
  
  // Inicializar navegación
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      if (!tab.classList.contains('active')) {
        cambiarSeccion(tab.dataset.section);
      }
    });
  });

  // Mostrar sección inicial
  cambiarSeccion('dashboard');
    // Permisos de menú según rol
    const role = getUserRole();
    if (role) {
      const permisos = {
        'Director General': ['dashboard.html','inventario.html','contratos.html','clientes.html','facturacion.html','mantenimiento.html','logistica.html','proyectos.html','calidad.html','analisis.html','notificaciones.html','configuracion.html','ventas.html'],
        'Ingeniero en Sistemas': ['dashboard.html','inventario.html','contratos.html','clientes.html','facturacion.html','mantenimiento.html','logistica.html','proyectos.html','calidad.html','analisis.html','notificaciones.html','configuracion.html','ventas.html'],
        'Ingeniero en Calidad': ['calidad.html','analisis.html','dashboard.html'],
        'Ingeniero en Proyectos': ['proyectos.html','analisis.html','notificaciones.html','logistica.html'],
        'Ventas': ['dashboard.html','ventas.html','clientes.html','notificaciones.html','contratos.html','facturacion.html','logistica.html','inventario.html'],
        'Rentas': ['dashboard.html','ventas.html','clientes.html','notificaciones.html','contratos.html','facturacion.html','logistica.html','inventario.html'],
        'Recepción': ['dashboard.html','ventas.html','clientes.html','notificaciones.html','contratos.html','facturacion.html','logistica.html','inventario.html'],
        'Contabilidad': ['dashboard.html','analisis.html','clientes.html','notificaciones.html','contratos.html','facturacion.html','logistica.html','inventario.html']
      };
      if (permisos[role]) document.querySelectorAll('.sidebar a').forEach(link => { const href = link.getAttribute('href'); if (!permisos[role].includes(href)) link.style.display = 'none'; });
    }

    // Notificaciones
    const notifList = document.getElementById('notif-list');
    if (notifList) {
      notifList.innerHTML = previewNotifs.map(n => `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 18px;">
          <span style="background:${n.color}22;color:${n.color};border-radius:8px;padding:7px 9px 7px 9px;font-size:1.1rem;"><i class="fa ${n.icon}"></i></span>
          <div style="flex:1;">
            <div style="font-size:0.99rem;font-weight:600;">${n.text}</div>
            <div style="color:#888;font-size:0.93rem;">${n.time}</div>
          </div>
        </div>
      `).join('');
    }

    // Dropdown campana
    const notifBell = document.querySelector('.topbar-right > span');
    const notifDropdown = document.getElementById('notif-dropdown');
    if (notifBell && notifDropdown) {
      notifBell.addEventListener('click', (e) => { e.stopPropagation(); const rect = notifBell.getBoundingClientRect(); notifDropdown.style.top = rect.bottom + 'px'; notifDropdown.style.right = (window.innerWidth - rect.right) + 'px'; notifDropdown.style.display = notifDropdown.style.display === 'block' ? 'none' : 'block'; });
      notifDropdown.addEventListener('click', e => e.stopPropagation());
      document.body.addEventListener('click', () => { notifDropdown.style.display = 'none'; });
    }

    // Dropdown usuario
    const avatarImg = document.getElementById('avatar-img');
    const userDropdown = document.getElementById('user-dropdown');
    if (avatarImg && userDropdown) {
      avatarImg.addEventListener('click', (e) => { e.stopPropagation(); userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block'; userDropdown.style.right = '0'; });
      userDropdown.addEventListener('click', e => e.stopPropagation());
      document.body.addEventListener('click', () => { userDropdown.style.display = 'none'; });
    }

    document.getElementById('logout-btn')?.addEventListener('click', (e) => { e.preventDefault(); window.location.href = 'login.html'; });

    // Nuevo cliente modal
    const nuevoClienteModal = document.getElementById('nuevo-cliente-modal');
    document.querySelector('.add-btn')?.addEventListener('click', () => { if (nuevoClienteModal) { nuevoClienteModal.style.display = 'flex'; limpiarFormularioCliente(); } });
    document.getElementById('close-nuevo-cliente-modal')?.addEventListener('click', () => { if (nuevoClienteModal) nuevoClienteModal.style.display = 'none'; });

  });

  // Funciones auxiliares exportadas a clientes-ui
  function limpiarFormularioCliente() {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    const secuencial = String((window.clientes && window.clientes.length) ? window.clientes.length + 1 : 1).padStart(3, '0');
    const clienteId = `CLI-${year}${month}${day}-${secuencial}`;
    const el = id => document.getElementById(id);
    if (el('nc-id')) el('nc-id').value = clienteId;
    if (el('nc-nombre')) el('nc-nombre').value = '';
    if (el('nc-tipo')) el('nc-tipo').value = 'Empresa';
    if (el('nc-contacto')) el('nc-contacto').value = '';
    if (el('nc-email')) el('nc-email').value = '';
    if (el('nc-telefono')) el('nc-telefono').value = '';
    if (el('nc-direccion')) el('nc-direccion').value = '';
    if (el('nc-rating')) el('nc-rating').value = '1';
    if (el('nc-nota')) el('nc-nota').value = '';
    window.editClienteIndex = null;
  }

  window.limpiarFormularioCliente = limpiarFormularioCliente;
})();
