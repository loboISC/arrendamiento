// ============================================
// DASHBOARD DE RENTAS - LÓGICA PRINCIPAL
// ============================================

// Variables globales
let calendar = null;
let eventosCalendario = [];
let currentUser = null;
let allRentas = [];
let allInventario = [];
let dashboardData = {
    kpis: {},
    charts: {},
    tables: {},
    alertas: []
};

// ============================================
// OBTENER DATOS DEL BACKEND
// ============================================

// Obtener usuario logueado
function getCurrentUser() {
    const userStr = localStorage.getItem('currentUser');  // ← CAMBIO AQUÍ
    if (userStr) {
        try {
            return JSON.parse(userStr);
        } catch (e) {
            console.error('Error parsing user:', e);
            return null;
        }
    }
    return null;
}
// Obtener rentas del backend (solo tipo RENTA)
async function fetchRentas() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3001/api/cotizaciones', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error fetching rentas');

        const data = await response.json();
        // Filtrar solo rentas (tipo RENTA)
        return Array.isArray(data) ? data.filter(c => c.tipo === 'RENTA') : [];
    } catch (error) {
        console.error('Error fetching rentas:', error);
        return [];
    }
}

// Obtener inventario del backend
async function fetchInventario() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3001/api/inventario', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            console.warn('API de inventario no disponible, usando datos de ejemplo');
            return generarInventarioEjemplo();
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('Error fetching inventario, usando datos de ejemplo:', error);
        return generarInventarioEjemplo();
    }
}

// Generar inventario de ejemplo si no hay API
function generarInventarioEjemplo() {
    return [
        { id: 1, nombre: 'Andamio Básico', categoria: 'Andamios', total: 50, rentados: 35, disponibles: 12, en_reparacion: 3, veces_rentado: 120 },
        { id: 2, nombre: 'Andamio Profesional', categoria: 'Andamios', total: 30, rentados: 22, disponibles: 6, en_reparacion: 2, veces_rentado: 85 },
        { id: 3, nombre: 'Escalera de Acceso', categoria: 'Escaleras', total: 40, rentados: 28, disponibles: 10, en_reparacion: 2, veces_rentado: 95 },
        { id: 4, nombre: 'Plataforma de Trabajo', categoria: 'Plataformas', total: 25, rentados: 18, disponibles: 5, en_reparacion: 2, veces_rentado: 72 },
        { id: 5, nombre: 'Barandal de Seguridad', categoria: 'Accesorios', total: 60, rentados: 45, disponibles: 12, en_reparacion: 3, veces_rentado: 150 }
    ];
}

// ============================================
// CÁLCULO DE KPIs
// ============================================

function calcularKPIs(rentas, inventario) {
    console.log('📊 Calculando KPIs de rentas...');
    console.log('Rentas:', rentas.length);
    console.log('Inventario:', inventario.length);

    // Calcular totales de inventario
    const totalInventario = inventario.reduce((sum, item) => sum + item.total, 0);
    const totalRentados = inventario.reduce((sum, item) => sum + item.rentados, 0);
    const totalDisponibles = inventario.reduce((sum, item) => sum + item.disponibles, 0);
    const totalEnReparacion = inventario.reduce((sum, item) => sum + item.en_reparacion, 0);

    // KPI 1: Andamios rentados actualmente
    const rentasActivas = rentas.filter(r => r.estado === 'Aprobada' || r.estado === 'Activa');
    const andamiosRentados = totalRentados;

    // KPI 2: Andamios disponibles
    const andamiosDisponibles = totalDisponibles;

    // KPI 3: Nivel de utilización
    const nivelUtilizacion = totalInventario > 0
        ? ((totalRentados / totalInventario) * 100).toFixed(1) + '%'
        : '0%';

    // KPI 4: Ingresos por renta (mes actual)
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    const ingresosMes = rentas
        .filter(r => {
            const fecha = new Date(r.fecha_cotizacion);
            return fecha.getMonth() === mesActual &&
                fecha.getFullYear() === añoActual &&
                (r.estado === 'Aprobada' || r.estado === 'Activa');
        })
        .reduce((sum, r) => sum + parseFloat(r.total || 0), 0);

    // KPI 5: Proyección de ingresos futuros
    const proyeccionIngresos = rentasActivas
        .reduce((sum, r) => {
            const diasRestantes = calcularDiasRestantes(r);
            if (diasRestantes > 0) {
                // Calcular ingreso pendiente basado en días restantes
                const montoDiario = parseFloat(r.total || 0) / 30; // Asumiendo renta mensual
                return sum + (montoDiario * diasRestantes);
            }
            return sum;
        }, 0);

    // KPI 6: Rentas en atraso
    const rentasAtraso = rentas.filter(r => {
        const dias = calcularDiasRestantes(r);
        return dias < 0 && (r.estado === 'Aprobada' || r.estado === 'Activa');
    }).length;

    // KPI 7: Rentas por vencer en ≤3 días
    const rentasPorVencer = rentas.filter(r => {
        const dias = calcularDiasRestantes(r);
        return dias >= 0 && dias <= 3 && (r.estado === 'Aprobada' || r.estado === 'Activa');
    }).length;

    // KPI 8: Rotación del inventario
    const rotacionPromedio = inventario.length > 0
        ? (inventario.reduce((sum, item) => sum + (item.veces_rentado || 0), 0) / inventario.length).toFixed(1)
        : '0';

    return {
        andamiosRentados,
        andamiosDisponibles,
        nivelUtilizacion,
        ingresosMes,
        proyeccionIngresos,
        rentasAtraso,
        rentasPorVencer,
        rotacionInventario: rotacionPromedio
    };
}

// Calcular días restantes de una renta
function calcularDiasRestantes(renta) {
    if (!renta.fecha_fin && !renta.fecha_entrega_solicitada) return 0;

    const hoy = new Date();
    const fechaFin = new Date(renta.fecha_fin || renta.fecha_entrega_solicitada);
    const diff = fechaFin - hoy;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ============================================
// ACTUALIZACIÓN DE UI
// ============================================

function actualizarKPIs(kpis) {
    console.log('📈 Actualizando KPIs en UI:', kpis);

    const formatMoney = (val) => {
        return '$' + parseFloat(val).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    // Actualizar cada KPI
    updateKPI('andamios-rentados', kpis.andamiosRentados);
    updateKPI('andamios-disponibles', kpis.andamiosDisponibles);
    updateKPI('nivel-utilizacion', kpis.nivelUtilizacion);
    updateKPI('ingresos-mes', formatMoney(kpis.ingresosMes));
    updateKPI('proyeccion-ingresos', formatMoney(kpis.proyeccionIngresos));
    updateKPI('rentas-atraso', kpis.rentasAtraso);
    updateKPI('por-vencer', kpis.rentasPorVencer);
    updateKPI('rotacion-inventario', kpis.rotacionInventario + 'x');
}

function updateKPI(kpiId, newValue) {
    const kpiCard = document.querySelector(`[data-kpi="${kpiId}"]`);
    if (kpiCard) {
        const valueElement = kpiCard.querySelector('.kpi-value');
        if (valueElement) {
            valueElement.textContent = newValue;
        }
    }
}

// ============================================
// GENERACIÓN DE ALERTAS
// ============================================

function generateAlerts(rentas, inventario) {
    const alertas = [];
    const ahora = new Date();

    // 1. Rentas vencidas
    const rentasVencidas = rentas.filter(r => {
        const dias = calcularDiasRestantes(r);
        return dias < 0 && (r.estado === 'Aprobada' || r.estado === 'Activa');
    });

    if (rentasVencidas.length > 0) {
        alertas.push({
            titulo: 'Rentas vencidas',
            descripcion: `${rentasVencidas.length} rentas han superado su fecha de entrega`,
            tipo: 'critical',
            icono: 'fa-exclamation-circle'
        });
    }

    // 2. Andamios sin retorno > 15 días
    const sinRetorno = rentasVencidas.filter(r => {
        const dias = Math.abs(calcularDiasRestantes(r));
        return dias > 15;
    });

    if (sinRetorno.length > 0) {
        alertas.push({
            titulo: 'Andamios sin retorno',
            descripcion: `${sinRetorno.length} rentas llevan más de 15 días de atraso`,
            tipo: 'critical',
            icono: 'fa-truck-ramp-box'
        });
    }

    // 3. Categorías con disponibilidad <20%
    const categoriasBajas = inventario.filter(item => {
        const disponibilidad = (item.disponibles / item.total) * 100;
        return disponibilidad < 20;
    });

    if (categoriasBajas.length > 0) {
        alertas.push({
            titulo: 'Disponibilidad baja',
            descripcion: `${categoriasBajas.length} categorías tienen menos del 20% de disponibilidad`,
            tipo: 'warning',
            icono: 'fa-boxes-stacked'
        });
    }

    // 4. Rentas por vencer en ≤3 días
    const porVencer = rentas.filter(r => {
        const dias = calcularDiasRestantes(r);
        return dias >= 0 && dias <= 3 && (r.estado === 'Aprobada' || r.estado === 'Activa');
    });

    if (porVencer.length > 0) {
        alertas.push({
            titulo: 'Rentas próximas a vencer',
            descripcion: `${porVencer.length} rentas vencen en los próximos 3 días`,
            tipo: 'warning',
            icono: 'fa-clock'
        });
    }

    // Renderizar alertas
    const alertsContainer = document.getElementById('alertsContainer');
    const notificationBadge = document.querySelector('.notification-badge');

    // Actualizar badge
    if (notificationBadge) {
        const totalAlerts = alertas.length;
        notificationBadge.textContent = totalAlerts;
        if (totalAlerts > 0) {
            notificationBadge.style.display = 'flex'; // Usar flex para centrar texto si tiene CSS de badge
        } else {
            notificationBadge.style.display = 'none';
        }
    }

    if (!alertsContainer) return;

    if (alertas.length === 0) {
        alertsContainer.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 20px;">✅ No hay alertas en este momento</p>';
        return;
    }

    alertsContainer.innerHTML = alertas.map(alert => `
    <div class="alert-item alert-${alert.tipo}">
      <div class="alert-icon">
        <i class="fa ${alert.icono || 'fa-exclamation-circle'}"></i>
      </div>
      <div class="alert-content">
        <div class="alert-title">${alert.titulo}</div>
        <div class="alert-description">${alert.descripcion}</div>
      </div>
    </div>
  `).join('');
}

// Event Listener para la campana
document.addEventListener('DOMContentLoaded', () => {
    const notificationIcon = document.querySelector('.notification-icon');
    if (notificationIcon) {
        notificationIcon.style.cursor = 'pointer';
        notificationIcon.addEventListener('click', () => {
            const alertsSection = document.getElementById('alertsContainer');
            if (alertsSection) {
                // Scroll suave hacia la sección de alertas
                alertsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Efecto visual temporal para resaltar
                alertsSection.parentElement.style.transition = 'background-color 0.5s';
                const originalBg = alertsSection.parentElement.style.backgroundColor;
                alertsSection.parentElement.style.backgroundColor = '#fff3e0'; // Color suave de alerta
                setTimeout(() => {
                    alertsSection.parentElement.style.backgroundColor = originalBg;
                }, 1000);
            }
        });
    }
});

// ============================================
// CARGA PRINCIPAL DEL DASHBOARD
// ============================================

async function cargarDashboard() {
    console.log('🚀 Iniciando carga del dashboard de rentas...');

    // Mostrar indicador de carga
    const kpiCards = document.querySelectorAll('.kpi-value');
    kpiCards.forEach(card => card.textContent = '...');

    try {
        // 1. Cargar datos del backend en paralelo
        const [rentas, inventario] = await Promise.all([
            fetchRentas(),
            fetchInventario()
        ]);

        console.log('✅ Datos cargados:', { rentas: rentas.length, inventario: inventario.length });

        allRentas = rentas;
        allInventario = inventario;

        // 2. Calcular KPIs
        console.log('📊 Calculando KPIs...');
        const kpis = calcularKPIs(rentas, inventario);
        actualizarKPIs(kpis);

        // 3. Generar alertas
        console.log('🚨 Generando alertas...');
        generateAlerts(rentas, inventario);

        // 4. Crear gráficas
        crearTodasLasGraficas(rentas, inventario);

        // 5. Procesar eventos del calendario
        procesarEventosCalendario(rentas);

        console.log('✅ Dashboard de rentas cargado exitosamente');
    } catch (error) {
        console.error('❌ Error al cargar dashboard:', error);
        alert('Error al cargar el dashboard. Por favor, recarga la página.');
    }
}

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================

function goBack() {
    window.history.back();
}

function goToCotizaciones() {
    if (currentUser) {
        sessionStorage.setItem('vendedorActual', JSON.stringify(currentUser));
    }

    if (allRentas.length > 0) {
        sessionStorage.setItem('cotizacionesRentas', JSON.stringify(allRentas));
    }

    window.location.href = 'cotizaciones-lista.html?tipo=RENTA&from=rentas.html';
}

// Llenar campos del usuario logueado
function populateUserFields() {
    currentUser = getCurrentUser();

    if (!currentUser) {
        console.warn('No hay usuario logueado');
        return;
    }

    const avatar = document.querySelector('.avatar');
    if (avatar && currentUser.foto) {
        avatar.src = currentUser.foto;
    }

    console.log('Usuario logueado:', currentUser.nombre || currentUser.email);
}

// ============================================
// EVENT LISTENERS
// ============================================

// Navegación de tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const tab = this.getAttribute('data-tab');

        // Remover active de todos
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Mostrar/ocultar secciones
        if (tab === 'calendario') {
            document.getElementById('calendarioSection').style.display = 'block';
            document.querySelectorAll('.band:not(#calendarioSection)').forEach(b => b.style.display = 'none');

            // Inicializar calendario si no existe
            if (!calendar) {
                inicializarCalendario();
            }

            // Refrescar calendario cuando se muestra
            if (calendar) {
                setTimeout(() => calendar.updateSize(), 100);
            }
        } else {
            document.getElementById('calendarioSection').style.display = 'none';
            document.querySelectorAll('.band:not(#calendarioSection)').forEach(b => b.style.display = 'block');
        }
    });
});

// Búsqueda global
document.querySelector('.global-search')?.addEventListener('input', function (e) {
    console.log('Búsqueda:', e.target.value);
    // TODO: Implementar lógica de búsqueda
});

// ============================================
// GRÁFICAS
// ============================================

let charts = {};

// Gráfica 1: Disponibilidad por Categoría (Barra Apilada)
function crearGraficaDisponibilidad(inventario) {
    const ctx = document.getElementById('chartDisponibilidad');
    if (!ctx) return;

    // Destruir gráfica anterior si existe
    if (charts.disponibilidad) {
        charts.disponibilidad.destroy();
    }

    const labels = inventario.map(item => item.nombre);
    const disponibles = inventario.map(item => item.disponibles);
    const rentados = inventario.map(item => item.rentados);
    const enReparacion = inventario.map(item => item.en_reparacion);

    charts.disponibilidad = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Disponible',
                    data: disponibles,
                    backgroundColor: '#4caf50',
                    borderColor: '#4caf50',
                    borderWidth: 1
                },
                {
                    label: 'Rentado',
                    data: rentados,
                    backgroundColor: '#2979ff',
                    borderColor: '#2979ff',
                    borderWidth: 1
                },
                {
                    label: 'En reparación',
                    data: enReparacion,
                    backgroundColor: '#ff9800',
                    borderColor: '#ff9800',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            },
            plugins: {
                legend: { position: 'top' },
                title: { display: false }
            }
        }
    });
}

// Gráfica 2: Ingresos por Renta (Línea)
function crearGraficaIngresos(rentas) {
    const ctx = document.getElementById('chartIngresos');
    if (!ctx) return;

    if (charts.ingresos) {
        charts.ingresos.destroy();
    }

    // Agrupar ingresos por mes
    const ingresosPorMes = {};
    const hoy = new Date();
    const añoActual = hoy.getFullYear();

    // Inicializar últimos 12 meses
    for (let i = 11; i >= 0; i--) {
        const fecha = new Date(añoActual, hoy.getMonth() - i, 1);
        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        ingresosPorMes[key] = 0;
    }

    // Sumar ingresos
    rentas.forEach(r => {
        if (r.estado === 'Aprobada' || r.estado === 'Activa') {
            const fecha = new Date(r.fecha_cotizacion);
            const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
            if (ingresosPorMes.hasOwnProperty(key)) {
                ingresosPorMes[key] += parseFloat(r.total || 0);
            }
        }
    });

    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const labels = Object.keys(ingresosPorMes).map(key => {
        const [año, mes] = key.split('-');
        return meses[parseInt(mes) - 1];
    });
    const data = Object.values(ingresosPorMes);

    charts.ingresos = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ingresos 2025',
                data: data,
                borderColor: '#2979ff',
                backgroundColor: 'rgba(41, 121, 255, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

// Gráfica 3: Razones de Atraso (Donut)
function crearGraficaAtrasos() {
    const ctx = document.getElementById('chartAtrasos');
    if (!ctx) return;

    if (charts.atrasos) {
        charts.atrasos.destroy();
    }

    // Datos de ejemplo (en producción vendrían de la base de datos)
    const razones = {
        'Cliente no entregó': 12,
        'Daños en equipo': 5,
        'Pago pendiente': 8,
        'Problemas de transporte': 3
    };

    charts.atrasos = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(razones),
            datasets: [{
                data: Object.values(razones),
                backgroundColor: [
                    '#f44336',
                    '#ff9800',
                    '#ffc107',
                    '#9c27b0'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

// Gráfica 4: Top 10 Productos Rentados (Barra Horizontal)
function crearGraficaTopProductos(inventario) {
    const ctx = document.getElementById('chartTopProductos');
    if (!ctx) return;

    if (charts.topProductos) {
        charts.topProductos.destroy();
    }

    // Ordenar por veces rentado
    const sorted = [...inventario].sort((a, b) => (b.veces_rentado || 0) - (a.veces_rentado || 0)).slice(0, 10);

    charts.topProductos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(item => item.nombre),
            datasets: [{
                label: 'Veces rentado',
                data: sorted.map(item => item.veces_rentado || 0),
                backgroundColor: '#2979ff',
                borderColor: '#2979ff',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// Función para crear todas las gráficas
function crearTodasLasGraficas(rentas, inventario) {
    console.log('📊 Creando gráficas...');
    crearGraficaDisponibilidad(inventario);
    crearGraficaIngresos(rentas);
    crearGraficaAtrasos();
    crearGraficaTopProductos(inventario);
    console.log('✅ Gráficas creadas');
}

// ============================================
// CALENDARIO
// ============================================

// Inicializar calendario
function inicializarCalendario() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    console.log('📅 Inicializando calendario...');

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        buttonText: {
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día'
        },
        events: eventosCalendario,
        eventClick: function (info) {
            mostrarDetalleEvento(info.event);
        },
        height: 'auto'
    });

    calendar.render();
    console.log('✅ Calendario inicializado');
}

// Procesar eventos del calendario
function procesarEventosCalendario(rentas) {
    console.log('📅 Procesando eventos del calendario...');
    eventosCalendario = [];

    rentas.forEach(renta => {
        if (renta.estado !== 'Aprobada' && renta.estado !== 'Activa') return;

        const diasRestantes = calcularDiasRestantes(renta);

        // Evento 1: Inicio de renta
        if (renta.fecha_cotizacion) {
            eventosCalendario.push({
                id: `inicio-${renta.id_cotizacion}`,
                title: `🟢 Inicio: ${renta.nombre_cliente || 'Cliente'}`,
                start: renta.fecha_cotizacion,
                backgroundColor: '#4caf50',
                borderColor: '#4caf50',
                extendedProps: {
                    tipo: 'inicio',
                    renta: renta
                }
            });
        }

        // Evento 2: Vencimiento de renta (con código de colores)
        if (renta.fecha_fin || renta.fecha_entrega_solicitada) {
            let color = '#4caf50'; // Verde por defecto
            let icono = '🟢';

            if (diasRestantes < 0) {
                color = '#f44336'; // Rojo - Atrasada
                icono = '🔴';
            } else if (diasRestantes <= 3) {
                color = '#ffc107'; // Amarillo - Por vencer
                icono = '🟡';
            }

            eventosCalendario.push({
                id: `vencimiento-${renta.id_cotizacion}`,
                title: `${icono} Vence: ${renta.nombre_cliente || 'Cliente'}`,
                start: renta.fecha_fin || renta.fecha_entrega_solicitada,
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    tipo: 'vencimiento',
                    renta: renta,
                    diasRestantes: diasRestantes
                }
            });
        }
    });

    // Actualizar calendario si ya está inicializado
    if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(eventosCalendario);
    }

    console.log(`✅ ${eventosCalendario.length} eventos procesados`);
}

// Mostrar detalle del evento en modal
function mostrarDetalleEvento(event) {
    const modal = document.getElementById('eventoModal');
    const titulo = document.getElementById('eventoTitulo');
    const detalles = document.getElementById('eventoDetalles');

    if (!modal || !titulo || !detalles) return;

    const props = event.extendedProps;
    const renta = props.renta;

    titulo.textContent = event.title;

    let html = `
        <div class="evento-detalle-item">
            <strong>Tipo:</strong> ${props.tipo === 'inicio' ? 'Inicio de renta' : 'Vencimiento de renta'}
        </div>
        <div class="evento-detalle-item">
            <strong>Cliente:</strong> ${renta.nombre_cliente || 'N/A'}
        </div>
        <div class="evento-detalle-item">
            <strong>Folio:</strong> ${renta.numero_cotizacion || renta.id_cotizacion}
        </div>
        <div class="evento-detalle-item">
            <strong>Monto:</strong> $${parseFloat(renta.total || 0).toLocaleString('es-MX')}
        </div>
        <div class="evento-detalle-item">
            <strong>Estado:</strong> ${renta.estado || 'N/A'}
        </div>
    `;

    if (props.tipo === 'vencimiento') {
        const diasRestantes = props.diasRestantes;
        let estadoTexto = '';
        let estadoClase = '';

        if (diasRestantes < 0) {
            estadoTexto = `⚠️ ATRASADA - ${Math.abs(diasRestantes)} días de atraso`;
            estadoClase = 'alerta-entrega';
        } else if (diasRestantes <= 3) {
            estadoTexto = `⏰ Vence en ${diasRestantes} día(s)`;
            estadoClase = 'alerta-entrega';
        } else {
            estadoTexto = `✅ ${diasRestantes} días restantes`;
        }

        html += `<div class="${estadoClase}">${estadoTexto}</div>`;
    }

    detalles.innerHTML = html;
    modal.style.display = 'flex';
}

// Cerrar modal
function cerrarModalEvento() {
    const modal = document.getElementById('eventoModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Event listener para cerrar modal
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('modal-close')) {
        cerrarModalEvento();
    }
    if (e.target.classList.contains('modal-evento')) {
        cerrarModalEvento();
    }
});
// ============================================
// SISTEMA DE ALERTAS EN CAMPANA
// ============================================

function generarAlertasRecordatorios(rentas) {
    const alertas = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    rentas.forEach(renta => {
        if (renta.estado !== 'Aprobada' && renta.estado !== 'Activa') return;

        const diasRestantes = calcularDiasRestantes(renta);

        // Alerta: Renta vencida
        if (diasRestantes < 0) {
            alertas.push({
                tipo: 'vencida',
                titulo: 'Renta vencida',
                mensaje: `${renta.nombre_cliente || 'Cliente'} - ${Math.abs(diasRestantes)} días de atraso`,
                urgencia: 'alta',
                icono: 'fa-exclamation-circle',
                color: '#f44336'
            });
        }
        // Alerta: Renta por vencer en ≤3 días
        else if (diasRestantes >= 0 && diasRestantes <= 3) {
            alertas.push({
                tipo: 'por-vencer',
                titulo: 'Renta por vencer',
                mensaje: `${renta.nombre_cliente || 'Cliente'} - Vence en ${diasRestantes} día(s)`,
                urgencia: 'media',
                icono: 'fa-clock',
                color: '#ff9800'
            });
        }
    });

    return alertas;
}

function actualizarNotificacionesCampana() {
    const alertasRecordatorios = generarAlertasRecordatorios(allRentas);
    const campanaIcon = document.querySelector('.notification-icon');

    if (!campanaIcon) return;

    // Agregar badge con número de alertas
    let badge = campanaIcon.querySelector('.notification-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notification-badge';
        campanaIcon.appendChild(badge);
    }

    const totalAlertas = alertasRecordatorios.length;
    badge.textContent = totalAlertas;
    badge.style.display = totalAlertas > 0 ? 'flex' : 'none';

    // Crear dropdown de notificaciones
    let dropdown = document.getElementById('notificaciones-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'notificaciones-dropdown';
        dropdown.className = 'notificaciones-dropdown';
        campanaIcon.parentElement.appendChild(dropdown);
    }

    // Toggle dropdown al hacer click
    campanaIcon.onclick = function (e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    };

    // Cerrar al hacer click fuera
    document.addEventListener('click', function () {
        dropdown.classList.remove('show');
    });

    // Generar contenido del dropdown
    if (totalAlertas === 0) {
        dropdown.innerHTML = `
      <div class="notificaciones-header">
        <h3>Notificaciones</h3>
      </div>
      <div class="notificaciones-body">
        <div class="notificacion-vacia">
          <i class="fa fa-check-circle"></i>
          <p>No hay notificaciones pendientes</p>
        </div>
      </div>
    `;
    } else {
        let notificacionesHTML = `
      <div class="notificaciones-header">
        <h3>Notificaciones</h3>
        <span class="notificaciones-count">${totalAlertas}</span>
      </div>
      <div class="notificaciones-body">
    `;

        alertasRecordatorios.forEach(alerta => {
            notificacionesHTML += `
        <div class="notificacion-item ${alerta.urgencia}">
          <div class="notificacion-icon" style="color: ${alerta.color}">
            <i class="fa ${alerta.icono}"></i>
          </div>
          <div class="notificacion-content">
            <div class="notificacion-titulo">${alerta.titulo}</div>
            <div class="notificacion-mensaje">${alerta.mensaje}</div>
          </div>
        </div>
      `;
        });

        notificacionesHTML += `
      </div>
    `;

        dropdown.innerHTML = notificacionesHTML;
    }
}

// ============================================
// INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('🎯 Dashboard de Rentas inicializado');
    populateUserFields();
    cargarDashboard();
    actualizarNotificacionesCampana();
});
