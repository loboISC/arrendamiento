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
              <button class="action-btn manage-docs" data-id="${cliente.id}" data-nombre="${cliente.nombre}" title="Gestionar documentos" style="color: #2979ff;">
                  <i class="fas fa-folder-open"></i>
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

        // Documents buttons
        document.querySelectorAll('.manage-docs').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const clientId = e.currentTarget.dataset.id;
                const clientNombre = e.currentTarget.dataset.nombre;
                openDocumentosModal(clientId, clientNombre);
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
                        const totalIngresos = parseFloat(resumen.ingresos_totales || 0);
                        const mContratos = parseFloat(resumen.monto_contratos || 0);
                        const mFacturas = parseFloat(resumen.monto_facturas || 0);
                        const cContratos = resumen.total_contratos_global || 0;
                        const cFacturas = resumen.total_facturas_global || 0;

                        value.innerHTML = `
                          <div style="display: flex; flex-direction: column; gap: 2px; text-align: right;">
                            <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">
                              <span style="font-size: 0.95rem; color: #2563eb; font-weight: 700;">$${formatMoney(mContratos)}</span>
                              <span style="font-size: 0.6rem; opacity: 0.7; text-transform: uppercase;">Contratos (${cContratos})</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">
                              <span style="font-size: 0.95rem; color: #0891b2; font-weight: 700;">$${formatMoney(mFacturas)}</span>
                              <span style="font-size: 0.6rem; opacity: 0.7; text-transform: uppercase;">Facturas (${cFacturas})</span>
                            </div>
                            <div style="border-top: 1px solid #e2e8f0; margin-top: 2px; padding-top: 2px; display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">
                              <span style="font-size: 1.1rem; font-weight: 800; color: #6b21a8;">$${formatMoney(totalIngresos)}</span>
                              <span style="font-size: 0.65rem; font-weight: 700; text-transform: uppercase;">Total</span>
                            </div>
                          </div>
                        `;
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
                    backgroundColor: [
                        'rgba(37, 99, 235, 0.8)',   // Azul premium
                        'rgba(8, 145, 178, 0.8)',   // Cian premium
                        'rgba(79, 70, 229, 0.8)',   // Indigo premium
                        'rgba(124, 58, 237, 0.8)',  // Violeta premium
                        'rgba(147, 51, 234, 0.8)',  // Púrpura premium
                        'rgba(192, 38, 211, 0.8)',  // Fucsia premium
                        'rgba(219, 39, 119, 0.8)'   // Rosa premium
                    ],
                    borderColor: [
                        '#2563eb', '#0891b2', '#4f46e5', '#7c3aed', '#9333ea', '#c026d1', '#db2777'
                    ],
                    borderWidth: 1,
                    borderRadius: 4
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
        // Funcion para pintar texto de usuario sin interpretar HTML.
        const escaparHtml = (valor) => String(valor ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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
            const limiteCaracteres = 145;
            const requiereVerMas = sugerenciaText.length > limiteCaracteres;
            const textoCorto = requiereVerMas ? sugerenciaText.substring(0, limiteCaracteres).trim() : sugerenciaText;

            // Color del score
            let colorScore = '#ff6b6b'; // rojo
            if (puntuacion >= 3) colorScore = '#51cf66'; // verde
            else if (puntuacion >= 2.5) colorScore = '#ffd93d'; // amarillo

            html += `
            <div class="sugerencia-card">
                <div class="sugerencia-header">
                    <div>
                        <div class="sugerencia-cliente">${escaparHtml(nombreCliente)}</div>
                        <div class="sugerencia-fecha">${escaparHtml(fecha)}</div>
                    </div>
                    <div class="sugerencia-score" style="background-color: ${colorScore};">${puntuacion}/4.0</div>
                </div>
                <div class="sugerencia-texto" data-texto-corto="${escaparHtml(textoCorto)}" data-texto-completo="${escaparHtml(sugerenciaText)}">
                    "${escaparHtml(textoCorto)}${requiereVerMas ? '...' : ''}"
                </div>
                ${requiereVerMas ? '<button type="button" class="sugerencia-ver-mas" data-expanded="false">ver mas</button>' : ''}
            </div>
        `;
        });

        html += `
            </div>
        </div>
    `;

        contenedorSugerencias.innerHTML = html;

        // Activar el boton para expandir o contraer opiniones largas.
        contenedorSugerencias.querySelectorAll('.sugerencia-ver-mas').forEach((boton) => {
            boton.addEventListener('click', () => {
                const tarjeta = boton.closest('.sugerencia-card');
                const texto = tarjeta?.querySelector('.sugerencia-texto');
                if (!texto) return;

                const estaExpandido = boton.getAttribute('data-expanded') === 'true';
                const textoCorto = texto.getAttribute('data-texto-corto') || '';
                const textoCompleto = texto.getAttribute('data-texto-completo') || '';

                texto.textContent = estaExpandido ? `"${textoCorto}..."` : `"${textoCompleto}"`;
                boton.textContent = estaExpandido ? 'ver mas' : 'ver menos';
                boton.setAttribute('data-expanded', String(!estaExpandido));
                tarjeta.classList.toggle('is-expanded', !estaExpandido);
            });
        });
    }


    // Dashboard analytics v2 (backend-driven)
    async function cargarEstadisticasDashboard() {
        try {
            const headers = getAuthHeaders();
            const periodo = document.getElementById('clientes-chart-periodo')?.value || 'mes';
            const response = await fetch(`/api/clientes/stats?periodo=${encodeURIComponent(periodo)}`, { headers });

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
            if (stats && stats.resumen) {
                actualizarDashboard(stats);
            } else {
                throw new Error('Datos de estadisticas incompletos');
            }
        } catch (error) {
            console.error('Error al cargar estadisticas v2:', error);
            showMessage(`Error al cargar estadisticas: ${error.message}`, 'error');
            mostrarDatosEjemplo();
        }
    }

    function actualizarTarjetasResumen(resumen) {
        const formatCurrency = (val) => {
            const n = Number(val || 0);
            return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
        };

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        setText('kpi-total-clientes', Number(resumen.total_clientes || 0).toLocaleString('es-MX'));
        setText('kpi-clientes-activos', Number(resumen.clientes_activos || 0).toLocaleString('es-MX'));
        setText('kpi-calificacion-promedio', Number(resumen.calificacion_promedio || 0).toFixed(1));

        const ingresosEl = document.getElementById('summary-ingresos-totales');
        if (ingresosEl) {
            const totalIngresos = Number(resumen.ingresos_totales || 0);
            const mContratos = Number(resumen.monto_contratos || 0);
            const mFacturas = Number(resumen.monto_facturas || 0);
            const cContratos = Number(resumen.total_contratos_global || 0);
            const cFacturas = Number(resumen.total_facturas_global || 0);

            ingresosEl.innerHTML = `
              <div style="display:flex; flex-direction:column; gap:2px; text-align:right;">
                <div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px;">
                  <span style="font-size:0.95rem; color:#2563eb; font-weight:700;">$${Number(mContratos).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span style="font-size:0.6rem; opacity:0.7; text-transform:uppercase;">CONTRATOS (${cContratos})</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px;">
                  <span style="font-size:0.95rem; color:#0891b2; font-weight:700;">$${Number(mFacturas).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span style="font-size:0.6rem; opacity:0.7; text-transform:uppercase;">FACTURAS (${cFacturas})</span>
                </div>
                <div style="border-top:1px solid #e2e8f0; margin-top:2px; padding-top:2px; display:flex; justify-content:space-between; align-items:baseline; gap:10px;">
                  <span style="font-size:1.1rem; font-weight:800; color:#6b21a8;">$${Number(totalIngresos).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span style="font-size:0.65rem; font-weight:700; text-transform:uppercase;">TOTAL</span>
                </div>
              </div>
            `;
        }
    }

    function actualizarGraficos(stats) {
        Object.keys(charts).forEach(key => {
            if (charts[key] && typeof charts[key].destroy === 'function') {
                try { charts[key].destroy(); } catch (_) { }
            }
            delete charts[key];
        });

        ['clientesDistribucionChart', 'ingresosMensualesChart', 'satisfaccionChart', 'serviciosChart'].forEach(id => {
            const canvas = document.getElementById(id);
            if (!canvas || typeof Chart === 'undefined') return;
            const existing = Chart.getChart(canvas);
            if (existing) existing.destroy();
        });

        actualizarGraficoLtvTop(stats.top_ltv || stats.top_clientes || []);
        actualizarGraficoCohortes(stats.cohortes || []);
        actualizarGraficoSatisfaccion(stats.satisfaccion || {});
        actualizarGraficoTopClientes(stats.top_clientes || []);
    }

    function actualizarGraficoLtvTop(topLtv) {
        const ctx = document.getElementById('clientesDistribucionChart');
        if (!ctx) return;

        const labels = topLtv.map(c => c.nombre || c.empresa || `Cliente ${c.id_cliente || ''}`);
        const data = topLtv.map(c => Number(c.ltv_estimado ?? c.valor_total ?? 0));

        charts.ltvTop = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'LTV estimado ($)',
                    data,
                    backgroundColor: 'rgba(37, 99, 235, 0.78)',
                    borderColor: 'rgba(37, 99, 235, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: (v) => '$' + Number(v).toLocaleString('es-MX') }
                    }
                }
            }
        });
    }

    function actualizarGraficoCohortes(cohortes) {
        const ctx = document.getElementById('ingresosMensualesChart');
        if (!ctx) return;

        const labels = cohortes.map(c => c.periodo);
        const data = cohortes.map(c => Number(c.clientes_nuevos || 0));

        charts.cohortes = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Clientes nuevos',
                    data,
                    borderColor: 'rgba(16, 185, 129, 1)',
                    backgroundColor: 'rgba(16, 185, 129, 0.16)',
                    pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                    tension: 0.35,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    }

    function actualizarGraficoSatisfaccion(satisfaccion) {
        const ctx = document.getElementById('satisfaccionChart');
        if (!ctx) return;

        const data = [
            Number(satisfaccion.calificacion_atencion_ventas || 0),
            Number(satisfaccion.calificacion_calidad_productos || 0),
            Number(satisfaccion.calificacion_tiempo_entrega || 0),
            Number(satisfaccion.calificacion_logistica || 0),
            Number(satisfaccion.calificacion_experiencia_compra || 0)
        ];

        charts.satisfaction = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: [
                    'Atencion y Asesoramiento',
                    'Calidad de Productos',
                    'Tiempo de Entrega',
                    'Servicio de Logistica',
                    'Experiencia de Compra'
                ],
                datasets: [{
                    label: 'Calificacion Promedio (0-4)',
                    data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 4,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    function actualizarGraficoTopClientes(topClientes) {
        const ctx = document.getElementById('serviciosChart');
        if (!ctx) return;

        const labels = topClientes.map(c => c.nombre || c.empresa || `Cliente ${c.id_cliente || ''}`);
        const data = topClientes.map(c => Number(c.valor_total || 0));

        charts.topClients = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Valor Total ($)',
                    data,
                    backgroundColor: 'rgba(59, 130, 246, 0.75)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: (v) => '$' + Number(v).toLocaleString('es-MX') }
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

        const periodoSelect = document.getElementById('clientes-chart-periodo');
        if (periodoSelect) {
            periodoSelect.addEventListener('change', () => {
                cargarEstadisticasDashboard();
            });
        }

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

        // Antes de limpiar, bloquear sección de crédito si la función está disponible
        if (typeof disableCreditSection === 'function') {
            disableCreditSection();
            adminCreditAuthorized = false;
        }
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

    // =============================================
    // GESTION DE DOCUMENTOS DE CLIENTES
    // =============================================

    function getAuthHeaders() {
        const token = localStorage.getItem('token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            pdf: 'fa-file-pdf',
            doc: 'fa-file-word', docx: 'fa-file-word',
            xls: 'fa-file-excel', xlsx: 'fa-file-excel',
            jpg: 'fa-file-image', jpeg: 'fa-file-image', png: 'fa-file-image',
            zip: 'fa-file-archive', rar: 'fa-file-archive'
        };
        return icons[ext] || 'fa-file';
    }

    function crearModalDocumentos() {
        const modalHTML = `
            <div id="documentos-modal" class="modal" style="z-index: 9999;">
              <div class="modal-content" style="max-width: 750px; padding: 0; overflow: hidden; display: flex; flex-direction: column; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                <div class="modal-header" style="padding: 20px 24px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                      <h3 id="documentos-modal-title" style="margin: 0; color: #1e293b; font-size: 1.25rem; font-weight: 600;">Documentos del Cliente</h3>
                      <p class="modal-subtitle" style="margin: 4px 0 0 0; font-size: 0.85rem; color: #64748b;">Gestionar archivos y comprobantes</p>
                  </div>
                  <button type="button" class="close" onclick="cerrarModalDocumentos()" style="font-size: 1.5rem; color: #64748b; background: none; border: none; cursor: pointer; padding: 4px;">&times;</button>
                </div>

                <div style="padding: 24px; background: #f8fafc; max-height: 70vh; overflow-y: auto;">
                  <div class="form-section" style="padding: 20px; margin-bottom: 24px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <h4 style="margin: 0 0 15px 0; color: #334155; font-size: 1rem;"><i class="fas fa-cloud-upload-alt text-primary" style="margin-right: 8px;"></i> Subir Nuevo Documento</h4>
                    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                      <select id="documento-tipo" style="padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: white; color: #334155; flex: 1; min-width: 200px; outline: none;">
                        <option value="Constancia de Situacion Fiscal">Constancia de Situación Fiscal</option>
                        <option value="INE">Identificación (INE)</option>
                        <option value="Comprobante de Domicilio">Comprobante de Domicilio</option>
                        <option value="Pago o Ticket">Pago o Ticket</option>
                        <option value="Contrato">Contrato</option>
                        <option value="Otro">Otro</option>
                      </select>
                      
                      <input type="hidden" id="documento-cliente-id">
                      
                      <label for="documento-upload-input" style="flex: 2; min-width: 200px; padding: 10px 15px; border: 1px dashed #94a3b8; border-radius: 6px; background: #f1f5f9; cursor: pointer; display: flex; align-items: center; color: #475569; transition: all 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        <i class="fas fa-file-upload" style="margin-right: 10px; color: #3b82f6;"></i> 
                        <span id="file-name-display" style="overflow: hidden; text-overflow: ellipsis;">Seleccionar archivo...</span>
                      </label>
                      <input type="file" id="documento-upload-input" style="display: none;">
                      
                      <button id="btn-upload-documento" class="btn-primary" style="padding: 10px 24px; border-radius: 6px; display: flex; align-items: center; gap: 8px; font-weight: 500;">
                        <i class="fas fa-upload"></i> Subir
                      </button>
                    </div>
                  </div>

                  <div class="form-section" style="padding: 20px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <h4 style="margin: 0 0 15px 0; color: #334155; font-size: 1rem;"><i class="fas fa-folder-open" style="color: #f59e0b; margin-right: 8px;"></i> Archivos Actuales</h4>
                    <div class="table-container" style="max-height: 250px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                      <table class="data-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                        <thead style="background: #f1f5f9; text-align: left; position: sticky; top: 0; z-index: 1;">
                          <tr>
                            <th style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; width: 50%;">Nombre del Archivo</th>
                            <th style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; width: 15%;">Tamaño</th>
                            <th style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; width: 15%;">Fecha</th>
                            <th style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; text-align: center; width: 20%;">Acciones</th>
                          </tr>
                        </thead>
                        <tbody id="documentos-list-body">
                          <!-- Archivos dinámicos -->
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div class="modal-footer" style="padding: 16px 24px; background: #fff; border-top: 1px solid #e2e8f0; text-align: right; border-radius: 0 0 12px 12px;">
                  <button type="button" class="btn-secondary" onclick="cerrarModalDocumentos()" style="padding: 8px 20px; border-radius: 6px; font-weight: 500;">Cerrar</button>
                </div>
              </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Actualizar el nombre del archivo seleccionado visualmente
        const fileInput = document.getElementById('documento-upload-input');
        const fileNameDisplay = document.getElementById('file-name-display');
        if (fileInput && fileNameDisplay) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files.length > 0) {
                    fileNameDisplay.textContent = e.target.files[0].name;
                    fileNameDisplay.style.color = '#0f172a';
                } else {
                    fileNameDisplay.textContent = 'Seleccionar archivo...';
                    fileNameDisplay.style.color = '';
                }
            });
        }

        // Volver a vincular el botón de subir
        const btnUpload = document.getElementById('btn-upload-documento');
        if (btnUpload) {
            btnUpload.addEventListener('click', async () => {
                const clientId = document.getElementById('documento-cliente-id')?.value;
                const fileInput = document.getElementById('documento-upload-input');
                if (!clientId || !fileInput?.files?.length) {
                    alert('Selecciona un archivo primero');
                    return;
                }

                const tipoInput = document.getElementById('documento-tipo');
                const tipo = tipoInput ? tipoInput.value : 'Otro';

                const formData = new FormData();
                formData.append('documento', fileInput.files[0]);
                formData.append('tipo', tipo);

                btnUpload.disabled = true;
                btnUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';

                try {
                    const authHeaders = getAuthHeaders();
                    delete authHeaders['Content-Type']; 

                    const res = await fetch(`/api/clientes/${clientId}/documentos/upload`, {
                        method: 'POST',
                        headers: authHeaders,
                        body: formData
                    });
                    const data = await res.json();
                    if (data.success) {
                        fileInput.value = '';
                        await cargarDocumentosCliente(clientId);
                    } else {
                        alert('Error: ' + data.error);
                    }
                } catch (err) {
                    alert('Error al subir el archivo');
                } finally {
                    btnUpload.disabled = false;
                    btnUpload.innerHTML = '<i class="fas fa-upload"></i> Subir';
                }
            });
        }
    }

    async function openDocumentosModal(clientId, clientNombre) {
        let modal = document.getElementById('documentos-modal');
        if (!modal) {
            crearModalDocumentos();
            modal = document.getElementById('documentos-modal');
        }

        const title = document.getElementById('documentos-modal-title');
        const hiddenId = document.getElementById('documento-cliente-id');

        if (title) title.textContent = `Documentos: ${clientNombre}`;
        if (hiddenId) hiddenId.value = clientId;

        // Limpiar input de archivo
        const fileInput = document.getElementById('documento-upload-input');
        if (fileInput) fileInput.value = '';

        modal.style.display = 'flex';
        modal.offsetHeight; // reflow
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
        document.body.style.overflow = 'hidden';

        await cargarDocumentosCliente(clientId);
    }
    
    window.cerrarModalDocumentos = function() {
        const modal = document.getElementById('documentos-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.style.display = 'none';
                document.body.style.overflow = '';
            }, 300);
        }
    };

    window.openDocumentosModal = openDocumentosModal;

    async function cargarDocumentosCliente(clientId) {
        const tbody = document.getElementById('documentos-list-body');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>`;

        try {
            const res = await fetch(`/api/clientes/${clientId}/documentos`, { headers: getAuthHeaders() });
            const data = await res.json();

            if (!data.success || data.data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;"><i class="fas fa-folder-open" style="font-size:2rem;"></i><br>Sin documentos aún</td></tr>`;
                return;
            }

            tbody.innerHTML = data.data.map(file => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: middle;" title="${file.filename}">
                        <i class="fas ${getFileIcon(file.filename)}" style="margin-right: 8px; color: #2979ff;"></i>
                        ${file.filename}
                    </td>
                    <td style="padding: 10px 12px; color: #64748b; font-size: 0.88rem; vertical-align: middle;">${formatFileSize(file.size)}</td>
                    <td style="padding: 10px 12px; color: #64748b; font-size: 0.88rem; vertical-align: middle;">${new Date(file.createdAt).toLocaleDateString('es-MX')}</td>
                    <td style="padding: 10px 12px; text-align: center; vertical-align: middle;">
                        <button onclick="previsualizarDocumentoCliente(${clientId}, '${file.filename.replace(/'/g, "\\'")}')"
                                style="background: none; border: none; margin-right: 6px; color: #3b82f6; cursor: pointer; padding: 4px;"
                                title="Vista Previa">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="descargarDocumentoCliente(${clientId}, '${file.filename.replace(/'/g, "\\'")}')"
                                style="background: none; border: none; margin-right: 6px; color: #10b981; cursor: pointer; padding: 4px;"
                                title="Descargar">
                            <i class="fas fa-download"></i>
                        </button>
                        <button onclick="eliminarDocumentoCliente(${clientId}, '${file.filename.replace(/'/g, "\\'")}')"
                                style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;"
                                title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#ef4444;">Error al cargar documentos</td></tr>`;
        }
    }

    window.eliminarDocumentoCliente = async function(clientId, filename) {
        if (!confirm(`¿Eliminar "${filename}"?`)) return;
        try {
            const res = await fetch(`/api/clientes/${clientId}/documentos/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const data = await res.json();
            if (data.success) {
                await cargarDocumentosCliente(clientId);
            } else {
                alert('Error al eliminar: ' + data.error);
            }
        } catch (err) {
            alert('Error al eliminar el documento');
        }
    };

    window.previsualizarDocumentoCliente = async function (clientId, filename) {
        try {
            const res = await fetch(`/api/clientes/${clientId}/documentos/download/${encodeURIComponent(filename)}`, {
                method: 'GET',
                headers: getAuthHeaders()
            });
            
            if (!res.ok) {
                alert('Error al obtener el documento para vista previa.');
                return;
            }
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            
            // Crear el modal de vista previa si no existe
            let previewModal = document.getElementById('preview-documento-modal');
            if (!previewModal) {
                const previewHTML = `
                    <div id="preview-documento-modal" class="modal" style="z-index: 10000;">
                        <div class="modal-content" style="width: 90%; height: 90vh; max-width: 1200px; display: flex; flex-direction: column; padding: 20px;">
                            <div class="modal-header" style="flex-shrink: 0; padding-bottom: 10px;">
                                <h3 id="preview-modal-title" style="margin: 0; display: flex; align-items: center; gap: 10px;">
                                    <i class="fas fa-file-alt text-primary"></i> Vista Previa
                                </h3>
                                <button type="button" class="close" id="close-preview-modal" style="font-size: 1.5rem;">&times;</button>
                            </div>
                            <div id="preview-container" style="flex-grow: 1; margin-top: 15px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #f8fafc; display: flex; justify-content: center; align-items: center;">
                                <!-- El visor se inyecta aquí -->
                            </div>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', previewHTML);
                previewModal = document.getElementById('preview-documento-modal');
                
                document.getElementById('close-preview-modal').addEventListener('click', () => {
                    previewModal.classList.remove('show');
                    setTimeout(() => {
                        previewModal.style.display = 'none';
                        const container = document.getElementById('preview-container');
                        if (container.dataset.objectUrl) {
                            window.URL.revokeObjectURL(container.dataset.objectUrl);
                            container.dataset.objectUrl = '';
                        }
                        container.innerHTML = ''; // Limpiar RAM
                    }, 300);
                });
            }

            document.getElementById('preview-modal-title').innerHTML = `<i class="fas fa-file-alt text-primary"></i> ${filename}`;
            const container = document.getElementById('preview-container');
            container.dataset.objectUrl = url;
            
            const fileExt = filename.split('.').pop().toLowerCase();
            
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
                container.innerHTML = `<img src="${url}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
            } else if (fileExt === 'pdf') {
                container.innerHTML = `<iframe src="${url}#toolbar=0" style="width: 100%; height: 100%; border: none;"></iframe>`;
            } else {
                container.innerHTML = `
                    <div style="text-align: center; color: #64748b;">
                        <i class="fas fa-file-alt" style="font-size: 4rem; margin-bottom: 15px;"></i>
                        <p>Vista previa no disponible para este tipo de archivo.</p>
                        <p>Por favor, usa el botón de descarga.</p>
                    </div>`;
            }

            previewModal.style.display = 'flex';
            previewModal.offsetHeight; // reflow
            requestAnimationFrame(() => {
                previewModal.classList.add('show');
            });

        } catch (err) {
            alert('Error al abrir la vista previa');
            console.error(err);
        }
    };

    window.descargarDocumentoCliente = async function (clientId, filename) {
        try {
            const res = await fetch(`/api/clientes/${clientId}/documentos/download/${encodeURIComponent(filename)}`, {
                method: 'GET',
                headers: getAuthHeaders()
            });
            
            if (!res.ok) {
                const isJson = res.headers.get('content-type')?.includes('application/json');
                if (isJson) {
                    const data = await res.json();
                    alert('Error al descargar: ' + (data.error || 'Desconocido'));
                } else {
                    alert('Error al descargar el documento. Código: ' + res.status);
                }
                return;
            }
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            alert('Error al descargar el documento');
        }
    };
})();

