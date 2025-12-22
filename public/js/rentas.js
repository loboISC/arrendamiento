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
    console.log('Rentas:', rentas ? rentas.length : 0);
    console.log('Inventario:', inventario ? inventario.length : 0);

    if (!Array.isArray(inventario)) {
        console.warn('Inventario no es un array:', inventario);
        inventario = [];
    }

    // Helper para sumar seguro
    const sumProp = (arr, prop) => arr.reduce((sum, item) => {
        const val = parseFloat(item[prop]);
        return sum + (isNaN(val) ? 0 : val);
    }, 0);

    // Calcular totales de inventario con validación
    const totalInventario = sumProp(inventario, 'total');
    const totalRentados = sumProp(inventario, 'rentados');
    const totalDisponibles = sumProp(inventario, 'disponibles');
    const totalEnReparacion = sumProp(inventario, 'en_reparacion');

    // Helper para determinar si cuenta como contrato activo/válido
    const esContratoValido = (st) => ['Activa', 'Contrato', 'Convertida a Contrato', 'En Renta', 'Entregado'].includes(st);

    // KPI 1: Andamios rentados actualmente (Calculado desde las rentas activas)
    const rentasActivas = Array.isArray(rentas) ? rentas.filter(r => esContratoValido(r.estado)) : [];

    let itemsRentadosReales = 0;
    rentasActivas.forEach(r => {
        let prods = [];
        try {
            if (Array.isArray(r.productos_seleccionados)) {
                prods = r.productos_seleccionados;
            } else if (typeof r.productos === 'string') {
                prods = JSON.parse(r.productos);
            } else if (Array.isArray(r.productos)) {
                prods = r.productos;
            } else if (r.products) {
                prods = typeof r.products === 'string' ? JSON.parse(r.products) : r.products;
            }
        } catch (e) { prods = []; }

        prods.forEach(p => {
            // Sumar cantidad de cada producto
            itemsRentadosReales += parseFloat(p.cantidad || p.qty || 1);
        });
    });

    const andamiosRentados = itemsRentadosReales;

    // KPI 2: Andamios disponibles (Total Inventario - Rentados Reales)
    // Si itemsRentadosReales supera totalInventario (por sobreventa o datos desactualizados), mostrar 0
    const andamiosDisponibles = Math.max(0, totalInventario - andamiosRentados);

    // KPI 3: Nivel de utilización
    const nivelUtilizacion = totalInventario > 0
        ? ((andamiosRentados / totalInventario) * 100).toFixed(1) + '%'
        : '0%';

    // KPI 4: Ingresos por renta (mes actual)
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    const ingresosMes = (Array.isArray(rentas) ? rentas : [])
        .filter(r => {
            if (!r.fecha_cotizacion) return false;
            const fecha = new Date(r.fecha_cotizacion);
            return fecha.getMonth() === mesActual &&
                fecha.getFullYear() === añoActual &&
                esContratoValido(r.estado);
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
    const rentasAtraso = (Array.isArray(rentas) ? rentas : []).filter(r => {
        const dias = calcularDiasRestantes(r);
        return dias < 0 && (r.estado === 'Aprobada' || r.estado === 'Activa');
    }).length;

    // KPI 7: Rentas por vencer en ≤3 días
    const rentasPorVencer = (Array.isArray(rentas) ? rentas : []).filter(r => {
        const dias = calcularDiasRestantes(r);
        return dias >= 0 && dias <= 3 && (r.estado === 'Aprobada' || r.estado === 'Activa');
    }).length;

    // KPI 8: Rotación del inventario
    const rotacionPromedio = inventario.length > 0
        ? (sumProp(inventario, 'veces_rentado') / inventario.length).toFixed(1)
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

        // 6. Calcular estadísticas y llenar filtros
        console.log('📊 Generando estadísticas y filtros...');
        calcularEstadisticas(rentas);
        popularFiltros(rentas);

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
        eventDidMount: function (info) {
            if (info.event.extendedProps.description) {
                info.el.setAttribute('title', info.event.extendedProps.description);
            }
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
        if (renta.estado !== 'Aprobada' && renta.estado !== 'Activa' && renta.estado !== 'Actualizada') return;

        const diasRestantes = calcularDiasRestantes(renta);

        // Determinar iconos de notificación y tooltip para el título
        let notifIcons = '';
        let description = '';

        if (renta.notificaciones_enviadas && renta.notificaciones_enviadas.length > 0) {
            notifIcons += ' 📧';
            description += 'Notificaciones enviadas:\n' + renta.notificaciones_enviadas.map(n => `- ${n.titulo}`).join('\n') + '\n';
        }
        if (renta.recordatorios_programados && renta.recordatorios_programados.length > 0) {
            notifIcons += ' ⏰';
            description += 'Próximos recordatorios:\n' + renta.recordatorios_programados.map(r => `- ${r.titulo}`).join('\n');
        }

        // Evento 1: Inicio de renta
        if (renta.fecha_cotizacion) {
            eventosCalendario.push({
                id: `inicio-${renta.id_cotizacion}`,
                title: `🟢 Inicio: ${renta.nombre_cliente || 'Cliente'}${notifIcons}`,
                start: renta.fecha_cotizacion,
                backgroundColor: '#4caf50',
                borderColor: '#4caf50',
                extendedProps: {
                    tipo: 'inicio',
                    renta: renta,
                    description: description.trim()
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
                id: `fin-${renta.id_cotizacion}`,
                title: `${icono} Fin: ${renta.nombre_cliente || 'Cliente'}${notifIcons}`,
                start: renta.fecha_fin || renta.fecha_entrega_solicitada,
                backgroundColor: color,
                borderColor: color,
                extendedProps: {
                    tipo: 'vencimiento',
                    renta: renta,
                    diasRestantes: diasRestantes,
                    description: description.trim()
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



let currentRenta = null;

// Mostrar detalle del evento en modal
async function mostrarDetalleEvento(event) {
    const modal = document.getElementById('eventoModal');
    const modalContent = modal.querySelector('.modal-evento-content');

    if (!modal || !modalContent) return;

    // Mostrar estado de carga
    modalContent.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; height: 300px;">
            <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #2979ff; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
            <p style="margin-top: 20px; color: #666; font-weight: 500;">Cargando detalles de la renta...</p>
        </div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;

    // Abrir modal inmediatamente con loader
    modal.classList.remove('show');
    modal.style.display = 'flex';
    void modal.offsetWidth; // Force reflow
    modal.classList.add('show');

    const props = event.extendedProps;
    let renta = props.renta;
    const id = renta.id_cotizacion || renta.id;

    // Intentar obtener detalles completos del backend
    try {
        console.log(`📡 Obteniendo detalles completos para cotización ${id}...`);
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:3001/api/cotizaciones/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const fullData = await response.json();
            // Fusionar datos: priorizar los nuevos, mantener los viejos si faltan
            renta = { ...renta, ...fullData };
            console.log('✅ Detalles completos cargados:', renta);
        } else {
            console.warn('⚠️ No se pudieron cargar detalles completos, usando datos locales.');
        }
    } catch (e) {
        console.error('❌ Error fetching full details:', e);
    }

    // 1. Obtener lista de productos correcta
    let productos = [];
    try {
        if (Array.isArray(renta.productos_seleccionados) && renta.productos_seleccionados.length > 0) {
            productos = renta.productos_seleccionados;
        } else if (typeof renta.productos === 'string') {
            productos = JSON.parse(renta.productos);
        } else if (Array.isArray(renta.productos)) {
            productos = renta.productos;
        } else if (renta.products) {
            productos = typeof renta.products === 'string' ? JSON.parse(renta.products) : renta.products;
        }
    } catch (e) {
        console.error('Error parsing productos:', e);
        productos = [];
    }

    // 1.1 Incorporar accesorios
    try {
        let accesorios = [];
        if (renta.accesorios_seleccionados) {
            if (typeof renta.accesorios_seleccionados === 'string') {
                accesorios = JSON.parse(renta.accesorios_seleccionados);
            } else if (Array.isArray(renta.accesorios_seleccionados)) {
                accesorios = renta.accesorios_seleccionados;
            }
        }

        if (accesorios.length > 0) {
            console.log('📦 Agregando accesorios al modal:', accesorios.length);
            // Fusionar con productos
            productos = [...productos, ...accesorios];
        }
    } catch (e) {
        console.error('Error procesando accesorios:', e);
    }

    // 2. Mapear datos de Cliente
    const clienteNombre = renta.cliente_nombre || renta.nombre_cliente || renta.contacto_nombre || 'N/A';
    const clienteTel = renta.cliente_telefono || renta.telefono || renta.contacto_telefono || 'N/A';
    const clienteEmail = renta.cliente_email || renta.email || renta.contacto_email || 'N/A';

    // 3. Mapear datos de Logística
    // tipo_envio puede ser 'envio' (Domicilio) o 'recoleccion' (Sucursal)
    const tipoEnvio = (renta.tipo_envio || renta.metodo_entrega || '').toLowerCase();
    const esDomicilio = tipoEnvio.includes('envio') || tipoEnvio.includes('domicilio');
    const esSucursal = tipoEnvio.includes('recolec') || tipoEnvio.includes('sucursal');
    const metodoEntrega = esDomicilio ? 'A Domicilio' : (esSucursal ? 'Recolección en Sucursal' : 'No Especificado');

    // Construir dirección completa
    const direccionParts = [
        renta.entrega_calle,
        renta.entrega_numero_ext ? `#${renta.entrega_numero_ext}` : '',
        renta.entrega_colonia,
        renta.entrega_municipio,
        renta.entrega_estado,
        renta.entrega_cp ? `CP ${renta.entrega_cp}` : ''
    ].filter(Boolean);

    const direccionCompleta = direccionParts.length > 0
        ? direccionParts.join(', ')
        : (renta.direccion_entrega || renta.direccion || 'N/A');

    const horaEntrega = renta.hora_entrega_solicitada || 'No especificada';

    // 4. Formatear fechas
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('es-MX', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatMoney = (amount) => {
        return '$' + parseFloat(amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Determinar estado y color
    const diasRestantes = props.diasRestantes !== undefined ? props.diasRestantes : calcularDiasRestantes(renta);
    let statusClass = 'status-active';
    let statusText = 'Activa';
    let statusIcon = 'fa-check-circle';

    if (renta.estado === 'Aprobada' || renta.estado === 'Activa' || renta.estado === 'Actualizada') {
        if (diasRestantes < 0) {
            statusClass = 'status-late';
            statusText = `Atrasada (${Math.abs(diasRestantes)} días)`;
            statusIcon = 'fa-exclamation-triangle';
        } else if (diasRestantes <= 3) {
            statusClass = 'status-pending';
            statusText = `Por vencer (${diasRestantes} días)`;
            statusIcon = 'fa-clock';
        }
    }

    // Construir HTML del modal
    const html = `
        <div class="modal-header">
            <div class="modal-title-group">
                <div class="modal-title-main">
                    <i class="fa ${props.tipo === 'inicio' ? 'fa-calendar-plus' : 'fa-calendar-check'}" style="color: ${props.tipo === 'inicio' ? '#2e7d32' : '#c62828'}"></i>
                    ${props.tipo === 'inicio' ? 'Inicio de Renta' : 'Vencimiento de Renta'}
                </div>
                <div class="modal-subtitle">Folio: ${renta.numero_cotizacion || renta.id_cotizacion || 'S/N'}</div>
            </div>
            <div class="modal-close" onclick="cerrarModalEvento()">&times;</div>
        </div>

        <div class="modal-body" style="max-height: 70vh; overflow-y: auto; padding: 20px;">
            <div class="info-grid">
                <!-- Tarjeta Cliente -->
                <div class="info-card">
                    <div class="info-card-header">
                        <i class="fa fa-user"></i> Información del Cliente
                    </div>
                    <div class="info-row">
                        <div class="info-label">Nombre:</div>
                        <div class="info-value">${clienteNombre}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Teléfono:</div>
                        <div class="info-value">
                            ${clienteTel}
                            <button class="btn-wa-mini" onclick="enviarMensajeWhatsapp('${clienteTel}', 'Confirmación de Renta', '${renta.numero_cotizacion || renta.id_cotizacion}')" title="Enviar WhatsApp" style="margin-left: 8px; background: #25d366; color: white; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer;">
                                <i class="fab fa-whatsapp"></i>
                            </button>
                        </div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Email:</div>
                        <div class="info-value">${clienteEmail}</div>
                    </div>
                </div>

                <!-- Tarjeta Fechas y Estado -->
                 <div class="info-card">
                    <div class="info-card-header">
                        <i class="fa fa-calendar-alt"></i> Fechas y Estado
                    </div>
                    <div class="info-row">
                        <div class="info-label">Inicio:</div>
                        <div class="info-value"><strong>${formatDate(renta.fecha_inicio || renta.fecha_cotizacion)}</strong></div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Fin:</div>
                        <div class="info-value"><strong>${formatDate(renta.fecha_fin || renta.fecha_entrega_solicitada)}</strong></div>
                    </div>
                     <div class="info-row">
                        <div class="info-label">Estado:</div>
                        <div class="info-value"><span class="status-pill ${statusClass}"><i class="fa ${statusIcon}"></i> ${statusText}</span></div>
                    </div>
                </div>

                <!-- Tarjeta Entrega -->
                <div class="info-card">
                    <div class="info-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                        <span><i class="fa fa-truck"></i> Logística</span>
                        <button class="btn-wa-mini" onclick="enviarMensajeWhatsapp('${clienteTel}', 'Confirmación de Logística', '${renta.numero_cotizacion || renta.id_cotizacion}')" title="Confirmar Entrega por WhatsApp" style="background: #25d366; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">
                            <i class="fab fa-whatsapp"></i> Confirmar
                        </button>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Método:</div>
                        <div class="info-value">${metodoEntrega}</div>
                    </div>
                    ${esDomicilio ? `
                    <div class="info-row">
                        <div class="info-label">Dirección:</div>
                        <div class="info-value" style="font-size: 0.85rem;">${direccionCompleta}</div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Hora:</div>
                        <div class="info-value">${horaEntrega}</div>
                    </div>
                    ` : ''}
                    ${esSucursal ? `
                    <div class="info-row">
                        <div class="info-label">Sucursal:</div>
                        <div class="info-value">${renta.sucursal || renta.nombre_almacen || 'Central'}</div>
                    </div>
                     <div class="info-row">
                        <div class="info-label">Hora:</div>
                        <div class="info-value">${horaEntrega}</div>
                    </div>
                    ` : ''}
                    
                    <!-- Registro de Respuesta -->
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #ddd; display: flex; flex-direction: column; gap: 8px;">
                        <div style="font-size: 0.75rem; color: #666; font-weight: 600; display: flex; align-items: center; gap: 5px;">
                            <i class="fa fa-comment-dots"></i> REGISTRO DE RESPUESTA:
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button class="btn-wa-mini" onclick="registrarRespuestaVenta('${renta.id_cotizacion || renta.id}', 'confirmado')" style="background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; flex: 1; transition: all 0.2s;">
                                <i class="fa fa-check-circle"></i> Confirma
                            </button>
                            <button class="btn-wa-mini" onclick="registrarRespuestaVenta('${renta.id_cotizacion || renta.id}', 'nota')" style="background: #fdf2f2; color: #c62828; border: 1px solid #ffcdd2; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; flex: 1; transition: all 0.2s;">
                                <i class="fa fa-sticky-note"></i> Registrar Nota
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Sección de Productos (Ahora dentro de la grid) -->
                <div class="info-card" style="grid-column: span 1; display: flex; flex-direction: column;">
                    <div class="info-card-header">
                        <i class="fa fa-box-open"></i> Productos Rentados (${productos.length})
                    </div>
                    <div class="products-table-container" style="border: 1px solid #eee; border-radius: 8px; flex-grow: 1;">
                        <table class="products-table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Cant.</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${productos.length > 0 ? productos.map(p => {
        const nombre = p.nombre || p.concepto || p.name || 'Producto';
        const cantidad = p.cantidad || p.qty || 1;
        const precio = p.precio_unitario || p.price || 0;
        return `
                                    <tr>
                                        <td>
                                            <div style="font-weight:600; color:#333; font-size: 0.85rem;">${nombre}</div>
                                        </td>
                                        <td style="font-size: 0.85rem;">${cantidad}</td>
                                        <td style="font-size: 0.85rem;">${formatMoney(cantidad * precio)}</td>
                                    </tr>
                                `;
    }).join('') : '<tr><td colspan="3" style="text-align: center; color: #999; padding: 20px;">No hay productos</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="modal-footer">
            <div class="total-display">
                <div class="total-label">Total de la Renta</div>
                <div class="total-amount">${formatMoney(renta.total || 0)}</div>
            </div>
            <button class="btn-modal-action" style="background-color: #607d8b; color: white;" onclick="mostrarHistorialNotificaciones()">
                <i class="fa fa-history"></i> Historial
            </button>
            <button class="btn-modal-action btn-view-details" onclick="window.location.href='cotizacion_renta.html?edit=${renta.id_cotizacion || renta.id}'">
                <i class="fa fa-external-link-alt"></i> Ver Completa
            </button>
            <button class="btn-modal-action btn-convert-contract" style="background-color: #4a148c; color: white;" onclick="window.location.href='contratos.html?cotizacion=${renta.id_cotizacion || renta.id}&cliente=${encodeURIComponent(clienteNombre)}&total=${renta.total || 0}'">
                <i class="fa fa-file-signature"></i> Convertir a Contrato
            </button>
            <button class="btn-modal-action btn-close-main" onclick="cerrarModalEvento()">
                Cerrar
            </button>
        </div>
    `;

    // Actualizar variable global
    currentRenta = renta;

    modalContent.innerHTML = html;
}

// Mostrar Historial y Notificaciones en vista aparte
function mostrarHistorialNotificaciones() {
    // Usar variable global si no se pasa argumento
    const renta = currentRenta;

    if (!renta) {
        console.error("No hay renta seleccionada para mostrar historial");
        return;
    }

    const modalContent = document.querySelector('.modal-evento-content');
    if (!modalContent) return;

    // Guardar referencia para "Volver"
    // Usamos el mismo objeto global

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('es-MX', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Preparar datos combinados de notificaciones
    const notificaciones = [
        ...(renta.notificaciones_enviadas || []).map(n => ({ ...n, _tipo: 'enviada', _fecha: n.fecha || n.fecha_envio })),
        ...(renta.recordatorios_programados || []).map(r => ({ ...r, _tipo: 'programada', _fecha: r.fecha }))
    ].sort((a, b) => new Date(b._fecha) - new Date(a._fecha));

    const html = `
        <div class="modal-header">
            <div class="modal-title-group">
                <div class="modal-title-main">
                    <i class="fa fa-history" style="color: #607d8b;"></i> Historial y Notificaciones
                </div>
                <div class="modal-subtitle">Folio: ${renta.id_cotizacion || renta.id}</div>
            </div>
            <div class="modal-close" onclick="cerrarModalEvento()">&times;</div>
        </div>

        <div class="modal-body" style="max-height: 70vh; overflow-y: auto; padding: 20px;">
            
            <div style="margin-bottom: 25px;">
                <h3 style="font-size: 1.1rem; color: #333; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                    <i class="fa fa-clipboard-list" style="margin-right: 8px; color: #2196f3;"></i> Historial de Cambios
                </h3>
                <div id="historial-container"></div>
                <div id="historial-pagination" style="display: flex; justify-content: center; gap: 10px; margin-top: 10px;"></div>
            </div>

            <div>
                <h3 style="font-size: 1.1rem; color: #333; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 8px;">
                    <i class="fa fa-bell" style="margin-right: 8px; color: #ff9800;"></i> Notificaciones
                </h3>
                <div id="notificaciones-container"></div>
                <div id="notificaciones-pagination" style="display: flex; justify-content: center; gap: 10px; margin-top: 10px;"></div>
            </div>

        </div>

         <div class="modal-footer">
             <button class="btn-modal-action" style="background-color: #78909c; color: white;" onclick="mostrarDetalleEvento({extendedProps: {renta: currentRenta, tipo: currentRenta.tipo_evento || 'vencimiento'}})">
                <i class="fa fa-arrow-left"></i> Volver a Detalles
            </button>
            <button class="btn-modal-action btn-close-main" onclick="cerrarModalEvento()">
                Cerrar
            </button>
        </div>
    `;

    modalContent.innerHTML = html;

    // Inicializar paginación
    initPagination('historial', renta.historial_cambios || [], formatDate);
    initPagination('notificaciones', notificaciones, formatDate);
}

function initPagination(type, data, dateFmt) {
    const pageSize = 5;
    let currentPage = 1;
    const container = document.getElementById(`${type}-container`);
    const paginationContainer = document.getElementById(`${type}-pagination`);

    function render() {
        if (!data || data.length === 0) {
            container.innerHTML = '<div style="color:#999; font-style:italic; padding: 10px;">No hay registros</div>';
            paginationContainer.innerHTML = '';
            return;
        }

        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageItems = data.slice(start, end);
        const totalPages = Math.ceil(data.length / pageSize);

        let itemsHtml = '';

        if (type === 'historial') {
            itemsHtml = pageItems.map(c => `
                <div style="background: #f8f9fa; border-radius: 6px; padding: 10px; margin-bottom: 8px; border-left: 3px solid #
2196f3;">
                    <div style="font-weight: 600; color: #555; font-size: 0.9rem;">${dateFmt(c.fecha)}</div>
                    <div style="color: #666; font-size: 0.85rem; margin-top: 2px;">${c.motivo || 'Actualización'}</div>
                </div>
            `).join('');
        } else {
            itemsHtml = pageItems.map(n => `
                <div style="background: #fff8e1; border-radius: 6px; padding: 10px; margin-bottom: 8px; border-left: 3px solid ${n._tipo === 'enviada' ? '#4caf50' : '#ff9800'}; display: flex; align-items: start; gap: 10px;">
                    <div style="margin-top: 2px;">
                        <i class="fa ${n._tipo === 'enviada' ? 'fa-check-double' : 'fa-clock'}" style="color: ${n._tipo === 'enviada' ? '#4caf50' : '#ff9800'};"></i>
                    </div>
                    <div>
                        <div style="font-weight: 500; color: #444; font-size: 0.9rem;">${n.titulo}</div>
                        <div style="color: #888; font-size: 0.8rem;">${dateFmt(n._fecha)}</div>
                        <div style="font-size: 0.75rem; color: #999; margin-top: 2px;">${n._tipo === 'enviada' ? 'Enviada' : 'Programada'}</div>
                    </div>
                </div>
            `).join('');
        }

        container.innerHTML = itemsHtml;

        // Botones de paginación
        if (totalPages > 1) {
            paginationContainer.innerHTML = `
                <button ${currentPage === 1 ? 'disabled' : ''} class="pagination-btn" onclick="document.dispatchEvent(new CustomEvent('paginate-${type}', {detail: -1}))" style="border: 1px solid #ddd; background: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; ${currentPage === 1 ? 'opacity: 0.5' : ''}">
                    <i class="fa fa-chevron-left"></i>
                </button>
                <span style="font-size: 0.9rem; align-self: center; color: #666;">Pág ${currentPage} de ${totalPages}</span>
                <button ${currentPage === totalPages ? 'disabled' : ''} class="pagination-btn" onclick="document.dispatchEvent(new CustomEvent('paginate-${type}', {detail: 1}))" style="border: 1px solid #ddd; background: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; ${currentPage === totalPages ? 'opacity: 0.5' : ''}">
                    <i class="fa fa-chevron-right"></i>
                </button>
            `;
        } else {
            paginationContainer.innerHTML = '';
        }
    }

    // Escuchar eventos de paginación
    document.addEventListener(`paginate-${type}`, (e) => {
        const delta = e.detail;
        const totalPages = Math.ceil(data.length / pageSize);
        const newPage = currentPage + delta;
        if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
            render();
        }
    });

    render();
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
        if (renta.estado !== 'Aprobada' && renta.estado !== 'Activa' && renta.estado !== 'Actualizada') return;

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

        // ACTIVIDAD: Notificaciones enviadas (últimas 24h o todas si queremos log)
        if (renta.notificaciones_enviadas && renta.notificaciones_enviadas.length > 0) {
            renta.notificaciones_enviadas.forEach(n => {
                alertas.push({
                    tipo: 'info',
                    titulo: 'Notificación enviada',
                    mensaje: `${n.titulo} - ${renta.nombre_cliente || 'Cliente'}`,
                    urgencia: 'baja',
                    icono: 'fa-check-double',
                    color: '#4caf50'
                });
            });
        }

        // ACTIVIDAD: Recordatorios programados
        if (renta.recordatorios_programados && renta.recordatorios_programados.length > 0) {
            renta.recordatorios_programados.forEach(r => {
                alertas.push({
                    tipo: 'info',
                    titulo: 'Recordatorio programado',
                    mensaje: `${r.titulo} - ${renta.nombre_cliente || 'Cliente'}`,
                    urgencia: 'baja',
                    icono: 'fa-clock',
                    color: '#ff9800'
                });
            });
        }

        // ACTIVIDAD: Validaciones de entrega (Historial)
        if (renta.historial_cambios && renta.historial_cambios.length > 0) {
            renta.historial_cambios.forEach(h => {
                if (h && h.cambio && (h.cambio.includes('validada') || h.cambio.includes('Nota WhatsApp'))) {
                    alertas.push({
                        tipo: 'success',
                        titulo: 'Validación Registrada',
                        mensaje: `${h.cambio} - ${renta.nombre_cliente || 'Cliente'}`,
                        urgencia: 'baja',
                        icono: 'fa-user-check',
                        color: '#2e7d32'
                    });
                }
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
// ESTADÍSTICAS Y FILTROS
// ============================================

function calcularEstadisticas(rentas) {
    if (!rentas || rentas.length === 0) {
        renderTablas([], []);
        return;
    }

    // 1. Top 10 Clientes
    const clientesMap = {};
    rentas.forEach(r => {
        // Normalizar nombre de cliente
        const nombreCliente = r.cliente_nombre || r.nombre_cliente || (r.cliente && r.cliente.nombre) || 'Cliente Desconocido';
        const ciudad = r.entrega_municipio || r.municipio || 'N/A';
        const status = r.estado;
        const total = parseFloat(r.total || 0);

        if (!clientesMap[nombreCliente]) {
            clientesMap[nombreCliente] = {
                nombre: nombreCliente,
                totalComprado: 0, // Solo aprobadas/activas/cerradas
                totalCotizado: 0, // Todas
                frecuencia: 0,
                ciudad: ciudad,
                clasificacion: 'Regular' // Lógica simple por ahora
            };
        }

        clientesMap[nombreCliente].totalCotizado += total;
        clientesMap[nombreCliente].frecuencia++;

        if (['Aprobada', 'Activa', 'Completada', 'Cerrada', 'Convertida a Contrato'].includes(status)) {
            clientesMap[nombreCliente].totalComprado += total;
        }

        // Actualizar ciudad si es N/A y ahora tenemos dato
        if (clientesMap[nombreCliente].ciudad === 'N/A' && ciudad !== 'N/A') {
            clientesMap[nombreCliente].ciudad = ciudad;
        }
    });

    const topClientes = Object.values(clientesMap)
        .sort((a, b) => b.totalComprado - a.totalComprado) // Ordenar por total comprado
        .slice(0, 10);

    // Calcular clasificación basada en compra
    topClientes.forEach(c => {
        if (c.totalComprado > 50000) c.clasificacion = 'VIP';
        else if (c.totalComprado > 20000) c.clasificacion = 'Frecuente';
        else c.clasificacion = 'Regular';
    });

    // 2. Productos más vendidos
    const productosMap = {};
    rentas.forEach(r => {
        // Para productos más vendidos, consideramos lo que realmente se ha movido (aprobadas/activas)
        if (!['Aprobada', 'Activa', 'Completada', 'Convertida a Contrato'].includes(r.estado)) return;

        let productos = [];
        try {
            if (Array.isArray(r.productos_seleccionados) && r.productos_seleccionados.length > 0) {
                productos = r.productos_seleccionados;
            } else if (typeof r.productos === 'string') {
                productos = JSON.parse(r.productos);
            } else if (Array.isArray(r.productos)) {
                productos = r.productos;
            } else if (r.products) {
                productos = typeof r.products === 'string' ? JSON.parse(r.products) : r.products;
            }
        } catch (e) { productos = []; }

        productos.forEach(p => {
            const nombre = p.nombre || p.concepto || p.name || 'Producto';
            const cantidad = parseFloat(p.cantidad || p.qty || 1);
            const precio = parseFloat(p.precio_unitario || p.price || 0);
            const total = (precio * cantidad);

            if (!productosMap[nombre]) {
                productosMap[nombre] = {
                    producto: nombre,
                    unidadesVendidas: 0,
                    ingresoTotal: 0,
                    margenPromedio: 'N/A'
                };
            }
            productosMap[nombre].unidadesVendidas += cantidad;
            productosMap[nombre].ingresoTotal += total;
        });
    });

    const topProductos = Object.values(productosMap)
        .sort((a, b) => b.unidadesVendidas - a.unidadesVendidas)
        .slice(0, 10);

    renderTablas(topClientes, topProductos);
}

function renderTablas(clientes, productos) {
    const tableClientes = document.getElementById('tableTopClientes');
    const tableProductos = document.getElementById('tableProductosMasVendidos');

    const formatMoney = (amount) => '$' + parseFloat(amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Render Clientes
    if (tableClientes) {
        if (!clientes || clientes.length === 0) {
            tableClientes.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #888; padding: 20px;">No hay datos disponibles con los filtros actuales</td></tr>';
        } else {
            tableClientes.innerHTML = clientes.map(c => `
                <tr>
                    <td><div style="font-weight: 500;">${c.nombre}</div></td>
                    <td><span style="color: #2e7d32; font-weight: 600;">${formatMoney(c.totalComprado)}</span></td>
                    <td>${formatMoney(c.totalCotizado)}</td>
                    <td>${c.frecuencia}</td>
                    <td>${c.ciudad}</td>
                    <td><span class="status-pill ${c.clasificacion === 'VIP' ? 'status-active' : 'status-pending'}" style="font-size: 0.75rem;">${c.clasificacion}</span></td>
                </tr>
            `).join('');
        }
    }

    // Render Productos
    if (tableProductos) {
        if (!productos || productos.length === 0) {
            tableProductos.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888; padding: 20px;">No hay datos de productos vendidos</td></tr>';
        } else {
            tableProductos.innerHTML = productos.map(p => `
                <tr>
                    <td><div style="font-weight: 500;">${p.producto}</div></td>
                    <td>${p.unidadesVendidas}</td>
                    <td><span style="color: #2e7d32; font-weight: 600;">${formatMoney(p.ingresoTotal)}</span></td>
                    <td>${p.margenPromedio}</td>
                </tr>
            `).join('');
        }
    }
}

function popularFiltros(rentas) {
    const vendedores = new Set();
    const clientes = new Set();

    rentas.forEach(r => {
        // Vendedor
        const nombreVendedor = r.usuario_nombre || r.vendedor_nombre || (r.vendedor && r.vendedor.nombre);
        if (nombreVendedor) vendedores.add(nombreVendedor);

        // Cliente
        const nombreCliente = r.cliente_nombre || r.nombre_cliente || (r.cliente && r.cliente.nombre);
        if (nombreCliente) clientes.add(nombreCliente);
    });

    const selectVendedor = document.getElementById('filter-vendedor');
    const selectCliente = document.getElementById('filter-cliente');

    // Helper para mantener selección actual al actualizar (si aplica)
    const updateSelect = (select, items) => {
        if (!select) return;
        const currentVal = select.value;
        const defaultText = select.options[0].text;
        select.innerHTML = `<option value="">${defaultText}</option>` +
            Array.from(items).sort().map(item => `<option value="${item}">${item}</option>`).join('');
        if (currentVal && Array.from(items).includes(currentVal)) select.value = currentVal;
    };

    updateSelect(selectVendedor, vendedores);
    updateSelect(selectCliente, clientes);

    // Aquí se podrían popular productos si fuera necesario
}

function aplicarFiltros() {
    console.log('🔍 Aplicando filtros...');
    // Leer valores
    const sucursal = document.getElementById('filter-sucursal')?.value.toLowerCase();
    const fechaDesde = document.getElementById('filter-fecha-desde')?.value;
    const fechaHasta = document.getElementById('filter-fecha-hasta')?.value;
    const vendedor = document.getElementById('filter-vendedor')?.value.toLowerCase();
    const cliente = document.getElementById('filter-cliente')?.value.toLowerCase();
    const estado = document.getElementById('filter-estado')?.value.toLowerCase();
    const productoFilter = document.getElementById('filter-producto')?.value.toLowerCase();
    const clasificacionFilter = document.getElementById('filter-clasificacion')?.value.toLowerCase();

    // Filtrar allRentas
    const rentasFiltradas = allRentas.filter(r => {
        let pass = true;

        // Filtro Fechas
        if (fechaDesde && pass) {
            const fDesde = new Date(fechaDesde);
            const fRenta = new Date(r.fecha_cotizacion);
            if (fRenta < fDesde) pass = false;
        }
        if (fechaHasta && pass) {
            const fHasta = new Date(fechaHasta);
            fHasta.setHours(23, 59, 59);
            const fRenta = new Date(r.fecha_cotizacion);
            if (fRenta > fHasta) pass = false;
        }

        // Filtro Sucursal
        if (sucursal && pass) {
            const rSucursal = (r.sucursal || r.nombre_almacen || '').toLowerCase();
            if (!rSucursal.includes(sucursal)) pass = false;
        }

        // Filtro Vendedor
        if (vendedor && pass) {
            const rVendedor = (r.usuario_nombre || r.vendedor_nombre || (r.vendedor && r.vendedor.nombre) || '').toLowerCase();
            if (!rVendedor.includes(vendedor)) pass = false;
        }

        // Filtro Cliente
        if (cliente && pass) {
            const rCliente = (r.cliente_nombre || r.nombre_cliente || (r.cliente && r.cliente.nombre) || '').toLowerCase();
            if (!rCliente.includes(cliente)) pass = false;
        }

        // Filtro Estado
        if (estado && pass) {
            if ((r.estado || '').toLowerCase() !== estado) pass = false;
        }

        // Filtro Producto (básico por nombre en JSON string)
        if (productoFilter && pass) {
            const prodStr = JSON.stringify(r.productos_seleccionados || r.productos || '').toLowerCase();
            if (!prodStr.includes(productoFilter)) pass = false;
        }

        return pass;
    });

    console.log(`✅ Filtrado: ${rentasFiltradas.length} de ${allRentas.length} rentas.`);

    // Recalcular todo
    const kpis = calcularKPIs(rentasFiltradas, allInventario);
    actualizarKPIs(kpis);
    calcularEstadisticas(rentasFiltradas);

    // Actualizar calendario si existe
    if (typeof procesarEventosCalendario === 'function') {
        procesarEventosCalendario(rentasFiltradas);
    }
}

function limpiarFiltros() {
    const inputs = document.querySelectorAll('.filter-select, .filter-date');
    inputs.forEach(i => i.value = '');
    aplicarFiltros();
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

// Enviar mensaje de WhatsApp
function enviarMensajeWhatsapp(telefono, tipo, folio) {
    if (!telefono || telefono === 'N/A') {
        Swal.fire('Error', 'No hay un número de teléfono válido para este cliente', 'error');
        return;
    }

    // Normalizar teléfono
    let num = telefono.replace(/\D/g, '');
    if (num.length === 10) num = '52' + num;

    const renta = currentRenta;
    const cliente = renta.cliente_nombre || renta.nombre_cliente || 'estimado cliente';
    const fecha = renta.fecha_fin || renta.fecha_entrega_solicitada;
    const fechaFmt = fecha ? new Date(fecha).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) : 'la fecha acordada';

    let mensaje = '';
    if (tipo === 'Confirmación de Renta') {
        mensaje = `Hola ${cliente}, le contactamos de Andamios Torres para confirmar los detalles de su renta con folio *${folio}*. Quedamos a sus órdenes.`;
    } else if (tipo === 'Confirmación de Logística') {
        mensaje = `Hola ${cliente}, le confirmamos que la logística programada para su renta *${folio}* está agendada para el día *${fechaFmt}*. ¿Podría confirmarnos si hay alguien para recibir/entregar el equipo?`;
    } else {
        mensaje = `Hola ${cliente}, le contactamos por su renta con folio *${folio}*.`;
    }

    const url = `https://wa.me/${num}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');

    console.log(`Log: WhatsApp enviado a ${num} para folio ${folio}`);
}

// Registrar Respuesta de Venta (Manual)
async function registrarRespuestaVenta(id, respuesta) {
    const renta = currentRenta;
    if (!renta) return;

    let mensajeHistorial = '';
    let alertTitle = '';

    if (respuesta === 'confirmado') {
        mensajeHistorial = "✅ Entrega validada y confirmada por cliente vía WhatsApp.";
        alertTitle = "Entrega Confirmada";
    } else {
        const { value: text } = await Swal.fire({
            title: 'Registrar Nota de Cliente',
            input: 'textarea',
            inputPlaceholder: 'Escribe la respuesta o nota del cliente...',
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar'
        });

        if (!text) return;
        mensajeHistorial = `📝 Nota WhatsApp: ${text}`;
        alertTitle = "Nota Registrada";
    }

    // 1. Persistir en el Servidor vía PUT
    try {
        const token = localStorage.getItem('token');
        // Preparamos los datos a actualizar en la cotización
        // Agregamos la nota al historial y también al campo de "notas" general para visibilidad clara
        const nuevaNota = `[${new Date().toLocaleDateString()}] ${mensajeHistorial}`;
        const notasActualizadas = renta.notas ? `${renta.notas}\n${nuevaNota}` : nuevaNota;

        // Actualizamos el objeto local antes de enviar
        if (!renta.historial_cambios) renta.historial_cambios = [];
        renta.historial_cambios.unshift({
            fecha: new Date().toISOString(),
            usuario: 'Sistema (WhatsApp)',
            cambio: mensajeHistorial
        });

        const payloadActualizacion = {
            ...renta,
            notas: notasActualizadas,
            historial_cambios: JSON.stringify(renta.historial_cambios) // El backend suele esperar string para JSON en SQL
        };

        const response = await fetch(`http://localhost:3001/api/cotizaciones/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payloadActualizacion)
        });

        if (!response.ok) throw new Error('Error al persistir en servidor');

        // 2. Mostrar alerta de éxito
        Swal.fire({
            icon: 'success',
            title: alertTitle,
            text: 'La respuesta ha sido registrada permanentemente.',
            timer: 2000,
            showConfirmButton: false
        });

        // 3. Actualizar estado global
        if (typeof allRentas !== 'undefined') {
            const index = allRentas.findIndex(r => (r.id_cotizacion || r.id) == id);
            if (index !== -1) {
                allRentas[index] = renta;
            }
        }

        // Actualizar notificaciones
        actualizarNotificacionesCampana();

    } catch (error) {
        console.error('Error al registrar respuesta:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de Conexión',
            text: 'No se pudo guardar en el servidor, pero el cambio se reflejará temporalmente en esta sesión.'
        });
    }
}
