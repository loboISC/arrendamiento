// UI y comportamiento extraído de clientes.html
(function () {
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
            const response = await fetch('/api/clientes/stats', { headers });

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

        // Mostrar sugerencias de clientes
        if (stats.sugerencias && stats.sugerencias.length > 0) {
            mostrarSugerenciasClientes(stats.sugerencias);
        }
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
                switch (index) {
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

        // Usar las métricas correctas de encuestas de satisfacción
        const data = [
            parseFloat(satisfaccion.calificacion_atencion_ventas || 0),
            parseFloat(satisfaccion.calificacion_calidad_productos || 0),
            parseFloat(satisfaccion.calificacion_tiempo_entrega || 0),
            parseFloat(satisfaccion.calificacion_logistica || 0),
            parseFloat(satisfaccion.calificacion_experiencia_compra || 0)
        ];

        charts.satisfaction = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: [
                    'Atención & Asesoramiento',
                    'Calidad de Productos',
                    'Tiempo de Entrega',
                    'Servicio de Logística',
                    'Experiencia de Compra'
                ],
                datasets: [{
                    label: 'Calificación Promedio (0-4)',
                    data: data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: '#667eea',
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 4,
                        ticks: {
                            stepSize: 1,
                            callback: function (value) {
                                const labels = ['', 'Molesto', 'No Satisfecho', 'Satisfecho', 'Muy Satisfecho'];
                                return labels[value] || value;
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = parseFloat(context.parsed.r).toFixed(2);
                                const labels = ['', 'Molesto', 'No Satisfecho', 'Satisfecho', 'Muy Satisfecho'];
                                let label = labels[Math.round(context.parsed.r)] || '';
                                return `${context.dataset.label}: ${value}/4 ${label ? '(' + label + ')' : ''}`;
                            }
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
                            callback: function (value) {
                                return '$' + value.toLocaleString('es-MX');
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return context.dataset.label + ': $' + context.parsed.x.toLocaleString('es-MX');
                            }
                        }
                    }
                }
            }
        });
    }

    // Función para mostrar sugerencias de clientes
    function mostrarSugerenciasClientes(sugerencias) {
        // Buscar o crear el contenedor de sugerencias en el dashboard
        let contenedorSugerencias = document.getElementById('sugerencias-container');

        if (!contenedorSugerencias) {
            // Si no existe, crearlo y agregarlo después de los charts
            const chartsGrid = document.querySelector('.charts-grid');
            if (!chartsGrid) return;

            contenedorSugerencias = document.createElement('div');
            contenedorSugerencias.id = 'sugerencias-container';
            contenedorSugerencias.style.gridColumn = '1 / -1';
            contenedorSugerencias.style.marginTop = '18px';
            chartsGrid.parentNode.insertBefore(contenedorSugerencias, chartsGrid.nextSibling);
        }

        // Crear HTML de sugerencias
        let html = `
        <div class="client-card">
            <div class="header-row">
                <div>
                    <h3>Sugerencias y Comentarios de Clientes</h3>
                    <p class="header-desc">Feedback reciente de encuestas de satisfacción</p>
                </div>
            </div>
            <div class="sugerencias-grid">
    `;

        sugerencias.forEach((sugerencia, index) => {
            const nombreCliente = sugerencia.nombre_cliente || 'Cliente sin nombre';
            const puntuacion = sugerencia.puntuacion_total ? parseFloat(sugerencia.puntuacion_total).toFixed(2) : 'N/A';
            const sugerenciaText = sugerencia.sugerencias || 'Sin comentarios';
            const fecha = sugerencia.fecha_respuesta ? new Date(sugerencia.fecha_respuesta).toLocaleDateString('es-MX') : 'Fecha no disponible';
            const truncated = sugerenciaText.length > 150 ? sugerenciaText.substring(0, 150) + '...' : sugerenciaText;

            // Color del score
            let colorScore = '#ff6b6b'; // rojo
            if (puntuacion >= 3) colorScore = '#51cf66'; // verde
            else if (puntuacion >= 2.5) colorScore = '#ffd93d'; // amarillo

            html += `
            <div class="sugerencia-card">
                <div class="sugerencia-header">
                    <div>
                        <div class="sugerencia-cliente">${nombreCliente}</div>
                        <div class="sugerencia-fecha">${fecha}</div>
                    </div>
                    <div class="sugerencia-score" style="background-color: ${colorScore};">${puntuacion}/4.0</div>
                </div>
                <div class="sugerencia-texto">
                    "${truncated}"
                </div>
            </div>
        `;
        });

        html += `
            </div>
        </div>
    `;

        contenedorSugerencias.innerHTML = html;
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
                'Director General': ['dashboard.html', 'inventario.html', 'contratos.html', 'clientes.html', 'facturacion.html', 'mantenimiento.html', 'logistica.html', 'proyectos.html', 'calidad.html', 'analisis.html', 'notificaciones.html', 'configuracion.html', 'ventas.html'],
                'Ingeniero en Sistemas': ['dashboard.html', 'inventario.html', 'contratos.html', 'clientes.html', 'facturacion.html', 'mantenimiento.html', 'logistica.html', 'proyectos.html', 'calidad.html', 'analisis.html', 'notificaciones.html', 'configuracion.html', 'ventas.html'],
                'Ingeniero en Calidad': ['calidad.html', 'analisis.html', 'dashboard.html'],
                'Ingeniero en Proyectos': ['proyectos.html', 'analisis.html', 'notificaciones.html', 'logistica.html'],
                'Ventas': ['dashboard.html', 'ventas.html', 'clientes.html', 'notificaciones.html', 'contratos.html', 'facturacion.html', 'logistica.html', 'inventario.html'],
                'Rentas': ['dashboard.html', 'ventas.html', 'clientes.html', 'notificaciones.html', 'contratos.html', 'facturacion.html', 'logistica.html', 'inventario.html'],
                'Recepción': ['dashboard.html', 'ventas.html', 'clientes.html', 'notificaciones.html', 'contratos.html', 'facturacion.html', 'logistica.html', 'inventario.html'],
                'Contabilidad': ['dashboard.html', 'analisis.html', 'clientes.html', 'notificaciones.html', 'contratos.html', 'facturacion.html', 'logistica.html', 'inventario.html']
            };
            if (permisos[role]) document.querySelectorAll('.sidebar a').forEach(link => { const href = link.getAttribute('href'); if (!permisos[role].includes(href)) link.style.display = 'none'; });
        }

        // Notificaciones reales
        const notifList = document.getElementById('notif-list');
        const notifBell = document.getElementById('notif-bell');
        const notifDot = document.querySelector('.notif-dot');
        const notifDropdown = document.getElementById('notif-dropdown');

        // Modal Tab Switching Logic
        function initModalTabs() {
            const tabBtns = document.querySelectorAll('.modal-tab-btn-enhanced');
            const tabContents = document.querySelectorAll('.modal-tab-content');
            const tabIndicator = document.querySelector('.tab-indicator');

            // Set initial indicator position
            if (tabBtns.length > 0 && tabIndicator) {
                const firstTab = tabBtns[0];
                tabIndicator.style.width = `${firstTab.offsetWidth}px`;
                tabIndicator.style.left = `${firstTab.offsetLeft}px`;
            }

            tabBtns.forEach((btn, index) => {
                btn.addEventListener('click', () => {
                    const tabId = btn.dataset.tab;

                    // Update active button
                    tabBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Animate indicator
                    if (tabIndicator) {
                        tabIndicator.style.width = `${btn.offsetWidth}px`;
                        tabIndicator.style.left = `${btn.offsetLeft}px`;
                    }

                    // Update active content
                    tabContents.forEach(content => {
                        if (content.id === `tab-${tabId}`) {
                            content.classList.add('active');
                        } else {
                            content.classList.remove('active');
                        }
                    });
                });
            });

            // Update indicator on window resize
            window.addEventListener('resize', () => {
                const activeTab = document.querySelector('.modal-tab-btn-enhanced.active');
                if (activeTab && tabIndicator) {
                    tabIndicator.style.width = `${activeTab.offsetWidth}px`;
                    tabIndicator.style.left = `${activeTab.offsetLeft}px`;
                }
            });
        }

        // Reset Modal Tabs to First Tab
        function resetModalTabs() {
            const firstTabBtn = document.querySelector('.modal-tab-btn-enhanced[data-tab="datos-ine"]');
            if (firstTabBtn) firstTabBtn.click();
        }

        initModalTabs();

        async function cargarNotificaciones() {
            if (!notifList) return;
            try {
                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                };
                const response = await fetch('/api/notificaciones', { headers });

                if (!response.ok) {
                    console.warn('Endpoint notificaciones no disponible o error auth');
                    return;
                }

                const notifs = await response.json();
                const ultimasNotifs = notifs.slice(0, 5); // Mostrar ultimas 5

                if (ultimasNotifs.length === 0) {
                    notifList.innerHTML = '<div style="padding:15px;text-align:center;color:#666;font-size:0.9rem">No hay notificaciones nuevas</div>';
                    if (notifDot) notifDot.style.display = 'none';
                    return;
                }

                if (notifDot) notifDot.style.display = 'block';

                const mapIcon = {
                    'NUEVO_CLIENTE': 'fa-user-plus',
                    'CLIENTE_ACTUALIZADO': 'fa-user-pen',
                    'CLIENTE_ELIMINADO': 'fa-user-xmark',
                    'ENCUESTA_RESPONDIDA': 'fa-star',
                    'STOCK_BAJO': 'fa-cube',
                    'MANTENIMIENTO': 'fa-screwdriver-wrench'
                };

                const mapColor = {
                    'NUEVO_CLIENTE': '#2ecc71', // verde
                    'CLIENTE_ACTUALIZADO': '#3498db', // azul
                    'CLIENTE_ELIMINADO': '#e74c3c', // rojo
                    'ENCUESTA_RESPONDIDA': '#f1c40f', // amarillo
                    'STOCK_BAJO': '#e67e22',
                    'MANTENIMIENTO': '#95a5a6'
                };

                notifList.innerHTML = ultimasNotifs.map(n => {
                    const icon = mapIcon[n.tipo] || 'fa-bell';
                    const color = mapColor[n.tipo] || '#2979ff';
                    const date = new Date(n.fecha_creacion || n.fecha); // Ajustar según nombre columna DB
                    const now = new Date();
                    const diffMs = now - date;
                    const diffMins = Math.floor(diffMs / 60000);
                    let timeStr = 'Hace un momento';
                    if (diffMins > 60) {
                        const diffHours = Math.floor(diffMins / 60);
                        if (diffHours > 24) timeStr = `Hace ${Math.floor(diffHours / 24)} días`;
                        else timeStr = `Hace ${diffHours}h`;
                    } else if (diffMins > 0) {
                        timeStr = `Hace ${diffMins}m`;
                    } else if (isNaN(diffMins)) {
                        timeStr = '';
                    }

                    return `
            <div style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid #f0f0f0;">
              <span style="background:${color}22;color:${color};border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:0.9rem;"><i class="fa ${icon}"></i></span>
              <div style="flex:1;">
                <div style="font-size:0.9rem;font-weight:600;color:#333;margin-bottom:2px;">${n.mensaje}</div>
                <div style="color:#999;font-size:0.8rem;">${timeStr}</div>
              </div>
            </div>
          `;
                }).join('');

            } catch (err) {
                console.error('Error cargando notificaciones:', err);
                notifList.innerHTML = '<div style="padding:15px; color:#999; text-align:center">Sin notificaciones</div>';
            }
        }

        // Dropdown campana
        if (notifBell && notifDropdown) {
            notifBell.addEventListener('click', (e) => {
                e.stopPropagation();
                // Posicionar relativo al padre
                notifDropdown.style.top = '48px';
                notifDropdown.style.right = '0';

                const isHidden = notifDropdown.style.display === 'none' || notifDropdown.style.display === '';
                notifDropdown.style.display = isHidden ? 'block' : 'none';

                if (isHidden) {
                    cargarNotificaciones(); // Cargar al abrir
                }
            });
            notifDropdown.addEventListener('click', e => e.stopPropagation());
            document.body.addEventListener('click', () => { notifDropdown.style.display = 'none'; });

            // Cargar inicial
            cargarNotificaciones();
        }

        // Dropdown usuario: ELIMINADO de aquí para evitar conflicto con auth.js
        // auth.js ya maneja el evento onclick de avatar-img.


        document.getElementById('logout-btn')?.addEventListener('click', (e) => { e.preventDefault(); window.location.href = 'login.html'; });

        // Nuevo cliente modal
        const nuevoClienteModal = document.getElementById('nuevo-cliente-modal');
        document.querySelector('.add-btn')?.addEventListener('click', () => { if (nuevoClienteModal) { nuevoClienteModal.style.display = 'flex'; limpiarFormularioCliente(); } });
        document.getElementById('close-nuevo-cliente-modal')?.addEventListener('click', () => { if (nuevoClienteModal) nuevoClienteModal.style.display = 'none'; });

    });

    // Funciones auxiliares exportadas a clientes-ui
    function limpiarFormularioCliente() {
        const el = id => document.getElementById(id);

        // Reset all inputs and textareas in the form
        const form = document.getElementById('nuevo-cliente-form');
        if (form) form.reset();

        // Generate a new sequential client number for display (optional/read-only)
        const fecha = new Date();
        const year = fecha.getFullYear();
        const month = String(fecha.getMonth() + 1).padStart(2, '0');
        const day = String(fecha.getDate()).padStart(2, '0');
        const secuencial = String((window.clientes && window.clientes.length) ? window.clientes.length + 1 : 1).padStart(3, '0');
        const clienteIdDisplay = `CLI-${year}${month}${day}-${secuencial}`;

        if (el('nc-numero-cliente')) el('nc-numero-cliente').value = clienteIdDisplay;

        // Ensure we are on the first tab
        if (typeof resetModalTabs === 'function') resetModalTabs();

        window.editClienteIndex = null;
    }

    window.limpiarFormularioCliente = limpiarFormularioCliente;
})();
