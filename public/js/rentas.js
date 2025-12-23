// ============================================
// DASHBOARD DE RENTAS - LÓGICA PRINCIPAL
// ============================================

// Variables globales
let calendar = null;
let eventosCalendario = [];
let currentUser = null;
let allRentas = [];
let allInventario = [];
let allUsuarios = [];
let allAlmacenes = [];
let dashboardData = {
    kpis: {},
    charts: {},
    tables: {},
    alertas: []
};
let almacenesIndex = { bySlug: {}, byId: {}, list: [] };

const PRODUCT_TYPE_OPTIONS = [
    { value: 'marco_cruceta', label: 'Marco y Cruceta' },
    { value: 'multidireccional', label: 'Multidireccional' },
    { value: 'accesorios', label: 'Accesorios' }
];

const SEGMENTACION_OPTIONS = [
    'Individual',
    'Pequeña Empresa',
    'Mediana Empresa',
    'Gran Empresa',
    'Gobierno',
    'Sin clasificar'
];

function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function parseDateSafe(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getEstadoRentaContrato(c) {
    const estadoRaw = normalizeText(c?.estado);
    const hoy = startOfDay(new Date());
    const fin = parseDateSafe(c?.fecha_fin);
    const finDay = fin ? startOfDay(fin) : null;

    if (estadoRaw.includes('conclu')) return 'concluido';
    if (finDay && finDay < hoy) return 'atraso';
    if (!finDay) return 'pendiente';
    return 'activa';
}

function getFechaInicioContrato(c) {
    return parseDateSafe(c?.fecha_inicio || c?.fecha_contrato || c?.fecha_creacion);
}

function getFechaFinContrato(c) {
    return parseDateSafe(c?.fecha_fin);
}

function getClasificacionCliente(contrato) {
    return contrato?.tipo_cliente
        || contrato?.segmento
        || contrato?.cliente_tipo
        || contrato?.cliente_segmento
        || contrato?.clasificacion_cliente
        || contrato?.cliente?.tipo
        || contrato?.cliente?.tipo_cliente
        || contrato?.cliente?.segmento
        || '';
}

function getProductTypeFromItem(item = {}) {
    const pieces = [
        item.tipo,
        item.categoria,
        item.subcategoria,
        item.nombre_categoria,
        item.nombre,
        item.descripcion,
        item.clave
    ].filter(Boolean);

    const text = normalizeText(pieces.join(' '));
    if (!text) return null;

    if (text.includes('marco') || text.includes('cruceta') || text.includes('andamio marco')) {
        return 'marco_cruceta';
    }

    if (text.includes('multi') || text.includes('ros') || text.includes('multidireccional')) {
        return 'multidireccional';
    }

    if (
        text.includes('accesor') ||
        text.includes('barandal') ||
        text.includes('escalera') ||
        text.includes('plataforma') ||
        text.includes('rueda') ||
        text.includes('perno') ||
        text.includes('tornillo') ||
        text.includes('nivel')
    ) {
        return 'accesorios';
    }

    return null;
}

function annotateRentasWithProductTypes(rentas) {
    (rentas || []).forEach(r => {
        const types = new Set();
        (Array.isArray(r.items) ? r.items : []).forEach(item => {
            const type = getProductTypeFromItem(item);
            if (type) types.add(type);
        });
        r._productTypes = Array.from(types);
    });
}

function buildAlmacenesIndex(almacenes = []) {
    const index = { bySlug: {}, byId: {}, list: [] };

    (almacenes || []).forEach(a => {
        const labelRaw = (a.nombre_almacen || a.nombre || a.alias || '').trim();
        const label = labelRaw || (a.ubicacion ? a.ubicacion.trim() : '') || `Almacén ${a.id_almacen || ''}`.trim() || 'Almacén';
        const slugBase = normalizeText(label) || normalizeText(a.ubicacion) || (a.id_almacen ? String(a.id_almacen) : '');
        const slug = slugBase || normalizeText(label) || 'almacen';
        const entry = { ...a, label, slug };

        index.list.push(entry);
        if (slug) {
            index.bySlug[slug] = entry;
        }
        if (a.id_almacen != null) {
            index.byId[String(a.id_almacen)] = entry;
        }
    });

    return index;
}

function getSucursalMetadata(contrato, almacenesIdx = almacenesIndex) {
    if (!almacenesIdx) {
        almacenesIdx = { bySlug: {}, byId: {}, list: [] };
    }

    const idKey = contrato?.id_almacen != null ? String(contrato.id_almacen) : '';
    let entry = idKey ? almacenesIdx.byId[idKey] : null;

    const rawName =
        contrato?.nombre_almacen ||
        contrato?.almacen_nombre ||
        contrato?.sucursal ||
        contrato?.ubicacion_almacen ||
        contrato?.entrega_municipio ||
        contrato?.municipio ||
        '';
    const slug = normalizeText(rawName);

    if (!entry && slug && almacenesIdx.bySlug[slug]) {
        entry = almacenesIdx.bySlug[slug];
    }

    let label = entry ? entry.label : (rawName || '').trim();
    let finalSlug = entry ? entry.slug : slug;

    if (!label) label = 'Sin asignar';
    if (!finalSlug) finalSlug = normalizeText(label) || 'sin-asignar';

    return { label, slug: finalSlug };
}

function prepareRentasMetadata(rentas = [], usuarios = [], almacenesIdx = almacenesIndex) {
    const usuariosByName = {};
    const usuariosById = {};

    (usuarios || []).forEach(u => {
        const id = String(u.id_usuario ?? u.id ?? '').trim();
        if (id) usuariosById[id] = u;
        const nameSlug = normalizeText(u.nombre || u.correo || '');
        if (nameSlug) usuariosByName[nameSlug] = u;
    });

    (rentas || []).forEach(r => {
        const clienteNombre = r.nombre_cliente || r.cliente_nombre || (r.cliente && r.cliente.nombre) || '';
        r._clienteNombre = clienteNombre;
        r._clienteSlug = normalizeText(clienteNombre);

        const vendedorMeta = getVendedorMetadata(r);
        let vendedorId = vendedorMeta.id;
        if (!vendedorId && vendedorMeta.nombre && usuariosByName[vendedorMeta.nombre]) {
            vendedorId = String(usuariosByName[vendedorMeta.nombre].id_usuario);
        }
        r._vendedorId = vendedorId || '';
        r._vendedorNombreNormalized = vendedorMeta.nombre;
        r._vendedorDisplay =
            r.usuario_nombre ||
            r.vendedor_nombre ||
            r.responsable ||
            (vendedorMeta.nombre && usuariosByName[vendedorMeta.nombre]?.nombre) ||
            '';

        const clasificacionRaw = getClasificacionCliente(r) || '';
        const clasificacion = clasificacionRaw ? clasificacionRaw : 'Sin clasificar';
        r._clasificacion = clasificacion;
        r._clasificacionSlug = normalizeText(clasificacion);

        const sucursalMeta = getSucursalMetadata(r, almacenesIdx);
        r._sucursalLabel = sucursalMeta.label;
        r._sucursalSlug = sucursalMeta.slug;

        if (!Array.isArray(r._productTypes)) {
            r._productTypes = [];
        }
    });
}

function getFilterValue(id, { normalize = false } = {}) {
    const el = document.getElementById(id);
    if (!el) return '';
    const value = el.value || '';
    return normalize ? normalizeText(value) : value;
}

function updateSelectOptions(select, placeholderText, options = []) {
    if (!select) return;
    const currentValue = select.value;
    const placeholder = placeholderText || select.options?.[0]?.textContent || 'Seleccione';
    let html = `<option value="">${placeholder}</option>`;

    options.forEach(opt => {
        if (!opt || opt.value == null || opt.label == null) return;
        html += `<option value="${opt.value}">${opt.label}</option>`;
    });

    select.innerHTML = html;
    const hasCurrent = options.some(opt => String(opt.value) === String(currentValue));
    if (hasCurrent) {
        select.value = currentValue;
    }
}

function getVendedorMetadata(contrato) {
    return {
        id: String(
            contrato?.id_vendedor ??
            contrato?.id_usuario ??
            contrato?.usuario_id ??
            contrato?.creado_por ??
            contrato?.usuario_creacion ??
            ''
        ).trim(),
        nombre: normalizeText(
            contrato?.usuario_nombre ||
            contrato?.vendedor_nombre ||
            contrato?.responsable ||
            contrato?.usuario_creacion ||
            ''
        )
    };
}

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
// Obtener rentas del backend (contratos tipo RENTA)
async function fetchRentas() {
    try {
        if (!window.API_CONFIG) {
            throw new Error('API_CONFIG no disponible');
        }

        const data = await window.API_CONFIG.get('contratos');

        const normalizeText = (value) => {
            return String(value ?? '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .toLowerCase();
        };

        return Array.isArray(data)
            ? data.filter(c => normalizeText(c.tipo) === 'renta')
            : [];
    } catch (error) {
        console.error('Error fetching rentas:', error);
        return [];
    }
}

// Obtener inventario del backend
async function fetchInventario() {
    try {
        if (!window.API_CONFIG) {
            throw new Error('API_CONFIG no disponible');
        }

        const data = await window.API_CONFIG.get('inventario');
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('Error fetching inventario, usando datos de ejemplo:', error);
        return generarInventarioEjemplo();
    }
}

async function fetchUsuarios() {
    try {
        if (!window.API_CONFIG) {
            throw new Error('API_CONFIG no disponible');
        }
        const data = await window.API_CONFIG.get('usuarios');
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('Error fetching usuarios:', error);
        return [];
    }
}

async function fetchAlmacenes() {
    try {
        if (!window.API_CONFIG) {
            throw new Error('API_CONFIG no disponible');
        }
        const data = await window.API_CONFIG.get('almacenes');
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.warn('Error fetching almacenes:', error);
        return [];
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

    // Rentas activas = contratos en curso (no concluidos) con fecha_fin >= hoy
    const rentasActivas = Array.isArray(rentas) ? rentas.filter(r => getEstadoRentaContrato(r) === 'activa') : [];

    let itemsRentadosReales = 0;
    rentasActivas.forEach(r => {
        const items = Array.isArray(r.items) ? r.items : [];
        items.forEach(p => {
            itemsRentadosReales += parseFloat(p.cantidad || 1);
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

    // KPI 4: Ingresos por renta (mes actual) - basado en fecha de contrato
    const hoy = new Date();
    const mesActual = hoy.getMonth();
    const añoActual = hoy.getFullYear();

    const ingresosMes = (Array.isArray(rentas) ? rentas : [])
        .filter(r => {
            const fecha = getFechaInicioContrato(r);
            if (!fecha) return false;
            const estado = getEstadoRentaContrato(r);
            return fecha.getMonth() === mesActual &&
                fecha.getFullYear() === añoActual &&
                (estado === 'activa' || estado === 'concluido');
        })
        .reduce((sum, r) => sum + parseFloat(r.total || r.monto || 0), 0);

    // KPI 5: Proyección de ingresos futuros (aprox) para rentas activas
    const proyeccionIngresos = rentasActivas
        .reduce((sum, r) => {
            const diasRestantes = calcularDiasRestantes(r);
            if (diasRestantes > 0) {
                const total = parseFloat(r.total || r.monto || 0);
                const montoDiario = total / 30;
                return sum + (montoDiario * diasRestantes);
            }
            return sum;
        }, 0);

    // KPI 6: Rentas en atraso (fecha_fin vencida y NO marcado como concluido)
    const rentasAtraso = (Array.isArray(rentas) ? rentas : []).filter(r => getEstadoRentaContrato(r) === 'atraso').length;

    // KPI 7: Rentas por vencer en ≤3 días (no concluidas)
    const rentasPorVencer = (Array.isArray(rentas) ? rentas : []).filter(r => {
        const estado = getEstadoRentaContrato(r);
        if (estado === 'concluido') return false;
        const dias = calcularDiasRestantes(r);
        return dias >= 0 && dias <= 3;
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
    const fechaFin = getFechaFinContrato(renta);
    if (!fechaFin) return 0;

    const hoy = new Date();
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
        return dias < 0 && getEstadoRentaContrato(r) === 'atraso';
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
        const estado = getEstadoRentaContrato(r);
        if (estado === 'concluido') return false;
        return dias >= 0 && dias <= 3;
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
        const [rentas, inventario, usuarios, almacenes] = await Promise.all([
            fetchRentas(),
            fetchInventario(),
            fetchUsuarios(),
            fetchAlmacenes()
        ]);

        console.log('✅ Datos cargados:', { rentas: rentas.length, inventario: inventario.length });

        annotateRentasWithProductTypes(rentas);
        almacenesIndex = buildAlmacenesIndex(almacenes);
        prepareRentasMetadata(rentas, usuarios, almacenesIndex);

        allRentas = rentas;
        allInventario = inventario;
        allUsuarios = usuarios;
        allAlmacenes = almacenes;

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

    // Sumar ingresos desde contratos (activa o concluido)
    (rentas || []).forEach(r => {
        const estado = getEstadoRentaContrato(r);
        if (estado !== 'activa' && estado !== 'concluido') return;

        const fecha = getFechaInicioContrato(r);
        if (!fecha) return;

        const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
        if (Object.prototype.hasOwnProperty.call(ingresosPorMes, key)) {
            ingresosPorMes[key] += parseFloat(r.total || r.monto || 0);
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
                label: 'Ingresos',
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
function crearGraficaTopProductos(rentas) {
    const ctx = document.getElementById('chartTopProductos');
    if (!ctx) return;

    if (charts.topProductos) {
        charts.topProductos.destroy();
    }

    const productosMap = {};

    (rentas || []).forEach(r => {
        const estado = getEstadoRentaContrato(r);
        if (estado !== 'activa' && estado !== 'concluido') return;

        const items = Array.isArray(r.items) ? r.items : [];
        items.forEach(it => {
            const nombre = it.descripcion || it.nombre || it.clave || 'Producto';
            const cantidad = parseFloat(it.cantidad || 1);
            const total = parseFloat(it.total || 0);

            if (!productosMap[nombre]) {
                productosMap[nombre] = { nombre, cantidad: 0, ingreso: 0 };
            }

            productosMap[nombre].cantidad += Number.isFinite(cantidad) ? cantidad : 0;
            productosMap[nombre].ingreso += Number.isFinite(total) ? total : 0;
        });
    });

    const sorted = Object.values(productosMap)
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10);

    charts.topProductos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(item => item.nombre),
            datasets: [{
                label: 'Unidades rentadas',
                data: sorted.map(item => item.cantidad || 0),
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
    crearGraficaTopProductos(rentas);
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
        const estado = getEstadoRentaContrato(renta);
        if (estado === 'concluido') return;

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
        const fechaInicio = getFechaInicioContrato(renta);
        const fechaFin = getFechaFinContrato(renta);

        if (fechaInicio) {
            eventosCalendario.push({
                id: `inicio-${renta.id_contrato}`,
                title: `🟢 Inicio: ${renta.nombre_cliente || 'Cliente'}${notifIcons}`,
                start: fechaInicio,
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
        if (fechaFin) {
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
                id: `fin-${renta.id_contrato}`,
                title: `${icono} Fin: ${renta.nombre_cliente || 'Cliente'}${notifIcons}`,
                start: fechaFin,
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
    const id = renta.id_contrato || renta.id;

    // Intentar obtener detalles completos del backend
    try {
        console.log(`📡 Obteniendo detalles completos para contrato ${id}...`);
        if (!window.API_CONFIG) {
            throw new Error('API_CONFIG no disponible');
        }
        const fullData = await window.API_CONFIG.get(`contratos/${id}`);

        renta = { ...renta, ...fullData };
        console.log('✅ Detalles completos cargados:', renta);
    } catch (e) {
        console.error('❌ Error fetching full details:', e);
    }

    const productos = Array.isArray(renta.items) ? renta.items : [];

    // 2. Mapear datos de Cliente
    const clienteNombre = renta.nombre_cliente || renta.cliente_nombre || 'N/A';
    const clienteTel = renta.telefono || renta.contacto_telefono || 'N/A';
    const clienteEmail = renta.email || renta.contacto_email || 'N/A';

    // 3. Mapear datos de Logística
    // tipo_envio puede ser 'envio' (Domicilio) o 'recoleccion' (Sucursal)
    const tipoEnvio = (renta.tipo_envio || renta.metodo_entrega || '').toLowerCase();
    const esDomicilio = tipoEnvio.includes('envio') || tipoEnvio.includes('domicilio') || (!tipoEnvio && (renta.calle || renta.colonia));
    const esSucursal = tipoEnvio.includes('recolec') || tipoEnvio.includes('sucursal');
    const metodoEntrega = esDomicilio ? 'A Domicilio' : (esSucursal ? 'Recolección en Sucursal' : 'No Especificado');

    // Construir dirección completa
    const direccionParts = [
        renta.calle,
        renta.numero_externo ? `#${renta.numero_externo}` : '',
        renta.colonia,
        renta.municipio,
        renta.estado_entidad,
        renta.codigo_postal ? `CP ${renta.codigo_postal}` : ''
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

    const estadoContrato = getEstadoRentaContrato(renta);
    if (estadoContrato === 'atraso') {
        statusClass = 'status-late';
        statusText = `Atrasada (${Math.abs(diasRestantes)} días)`;
        statusIcon = 'fa-exclamation-triangle';
    } else if (diasRestantes <= 3) {
        statusClass = 'status-pending';
        statusText = `Por vencer (${diasRestantes} días)`;
        statusIcon = 'fa-clock';
    }

    // Construir HTML del modal
    const html = `
        <div class="modal-header">
            <div class="modal-title-group">
                <div class="modal-title-main">
                    <i class="fa ${props.tipo === 'inicio' ? 'fa-calendar-plus' : 'fa-calendar-check'}" style="color: ${props.tipo === 'inicio' ? '#2e7d32' : '#c62828'}"></i>
                    ${props.tipo === 'inicio' ? 'Inicio de Renta' : 'Vencimiento de Renta'}
                </div>
                <div class="modal-subtitle">Contrato: ${renta.numero_contrato || renta.id_contrato || 'S/N'}</div>
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
                            <button class="btn-wa-mini" onclick="enviarMensajeWhatsapp('${clienteTel}', 'Confirmación de Renta', '${renta.numero_contrato || renta.id_contrato}')" title="Enviar WhatsApp" style="margin-left: 8px; background: #25d366; color: white; border: none; padding: 2px 6px; border-radius: 4px; cursor: pointer;">
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
                        <div class="info-value"><strong>${formatDate(renta.fecha_inicio || renta.fecha_contrato)}</strong></div>
                    </div>
                    <div class="info-row">
                        <div class="info-label">Fin:</div>
                        <div class="info-value"><strong>${formatDate(renta.fecha_fin)}</strong></div>
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
                        <button class="btn-wa-mini" onclick="enviarMensajeWhatsapp('${clienteTel}', 'Confirmación de Logística', '${renta.numero_contrato || renta.id_contrato}')" title="Confirmar Entrega por WhatsApp" style="background: #25d366; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">
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
                            <button class="btn-wa-mini" onclick="registrarRespuestaVenta('${renta.id_contrato || renta.id}', 'confirmado')" style="background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; flex: 1; transition: all 0.2s;">
                                <i class="fa fa-check-circle"></i> Confirma
                            </button>
                            <button class="btn-wa-mini" onclick="registrarRespuestaVenta('${renta.id_contrato || renta.id}', 'nota')" style="background: #fdf2f2; color: #c62828; border: 1px solid #ffcdd2; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; flex: 1; transition: all 0.2s;">
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
        const nombre = p.descripcion || p.nombre || p.clave || 'Producto';
        const cantidad = p.cantidad || 1;
        const precio = p.precio_unitario || 0;
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
                <div class="total-amount">${formatMoney(renta.total || renta.monto || 0)}</div>
            </div>
            <button class="btn-modal-action" style="background-color: #607d8b; color: white;" onclick="mostrarHistorialNotificaciones()">
                <i class="fa fa-history"></i> Historial
            </button>
            <button class="btn-modal-action btn-view-details" onclick="window.location.href='contratos.html'">
                <i class="fa fa-external-link-alt"></i> Ir a Contratos
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
                <div class="modal-subtitle">Contrato: ${renta.numero_contrato || renta.id_contrato || renta.id || 'S/N'}</div>
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
        const nombreCliente = r.nombre_cliente || r.cliente_nombre || (r.cliente && r.cliente.nombre) || 'Cliente Desconocido';
        const ciudad = r.municipio || r.entrega_municipio || 'N/A';
        const estado = getEstadoRentaContrato(r);
        const total = parseFloat(r.total || r.monto || 0);

        const clasificacionLabel = r._clasificacion || getClasificacionCliente(r) || 'Sin clasificar';
        const clasificacionSlug = r._clasificacionSlug || normalizeText(clasificacionLabel);

        if (!clientesMap[nombreCliente]) {
            clientesMap[nombreCliente] = {
                nombre: nombreCliente,
                totalComprado: 0, // Solo aprobadas/activas/cerradas
                totalCotizado: 0, // Todas
                frecuencia: 0,
                ciudad: ciudad,
                clasificacion: 'Sin clasificar',
                _clasificacionCounts: {}
            };
        }

        clientesMap[nombreCliente].totalCotizado += total;
        clientesMap[nombreCliente].frecuencia++;

        if (clasificacionSlug) {
            const counts = clientesMap[nombreCliente]._clasificacionCounts;
            const current = counts[clasificacionSlug] || { label: clasificacionLabel, count: 0 };
            counts[clasificacionSlug] = { label: current.label || clasificacionLabel, count: current.count + 1 };
        }

        if (estado === 'activa' || estado === 'concluido') {
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

    // Determinar clasificación real (tipo_cliente/segmento) por cliente, con mayoría simple
    topClientes.forEach(c => {
        const entries = Object.entries(c._clasificacionCounts || {});
        if (!entries.length) {
            c.clasificacion = 'Sin clasificar';
            return;
        }

        entries.sort((a, b) => {
            const aLabel = (a[1]?.label || '').trim();
            const bLabel = (b[1]?.label || '').trim();
            const aIsUnclassified = normalizeText(aLabel) === 'sin clasificar';
            const bIsUnclassified = normalizeText(bLabel) === 'sin clasificar';

            const countDiff = (b[1]?.count || 0) - (a[1]?.count || 0);
            if (countDiff !== 0) return countDiff;
            if (aIsUnclassified !== bIsUnclassified) return aIsUnclassified ? 1 : -1;
            return aLabel.localeCompare(bLabel, 'es');
        });

        c.clasificacion = (entries[0][1]?.label || 'Sin clasificar').trim() || 'Sin clasificar';
    });

    // 2. Productos más rentados
    const productosMap = {};
    rentas.forEach(r => {
        const estado = getEstadoRentaContrato(r);
        if (estado !== 'activa' && estado !== 'concluido') return;

        const items = Array.isArray(r.items) ? r.items : [];
        items.forEach(p => {
            const nombre = p.descripcion || p.nombre || p.clave || 'Producto';
            const cantidad = parseFloat(p.cantidad || 1);
            const total = parseFloat(p.total || 0) || (parseFloat(p.precio_unitario || 0) * cantidad);

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
            tableProductos.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888; padding: 20px;">No hay datos de productos rentados</td></tr>';
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

function popularFiltros(rentas = []) {
    const selectSucursal = document.getElementById('filter-sucursal');
    const selectVendedor = document.getElementById('filter-vendedor');
    const selectCliente = document.getElementById('filter-cliente');
    const selectProducto = document.getElementById('filter-producto');
    const selectClasificacion = document.getElementById('filter-clasificacion');

    // Sucursales → usar índice de almacenes, fallback a rentas
    const sucursalOptions = [];
    const seenSucursales = new Set();
    const sucursalSource = (almacenesIndex?.list?.length ? almacenesIndex.list : rentas.map(r => ({
        slug: r._sucursalSlug || normalizeText(r.sucursal || r.nombre_almacen || ''),
        label: r._sucursalLabel || r.sucursal || r.nombre_almacen || 'Sin asignar'
    })));

    sucursalSource.forEach(entry => {
        if (!entry) return;
        const slug = entry.slug || normalizeText(entry.label || '');
        const label = entry.label || 'Sin asignar';
        if (!slug || seenSucursales.has(slug)) return;
        seenSucursales.add(slug);
        sucursalOptions.push({ value: slug, label });
    });
    sucursalOptions.sort((a, b) => a.label.localeCompare(b.label, 'es'));
    updateSelectOptions(selectSucursal, 'Sucursal', sucursalOptions);

    // Vendedores → usuarios del sistema, fallback a responsables de rentas
    const vendedorOptions = [];
    const seenVendedores = new Set();

    (allUsuarios || []).forEach(usuario => {
        const id = String(usuario.id_usuario ?? usuario.id ?? '').trim();
        if (!id || seenVendedores.has(id)) return;
        seenVendedores.add(id);
        const labelBase = usuario.nombre || usuario.correo || `Usuario ${id}`;
        const label = usuario.rol ? `${labelBase} (${usuario.rol})` : labelBase;
        vendedorOptions.push({ value: id, label });
    });

    if (!vendedorOptions.length) {
        (rentas || []).forEach(r => {
            const value = r._vendedorId || r._vendedorNombreNormalized;
            const label = r._vendedorDisplay || r.responsable || 'Sin asignar';
            if (!value || seenVendedores.has(value)) return;
            seenVendedores.add(value);
            vendedorOptions.push({ value, label });
        });
    }
    vendedorOptions.sort((a, b) => a.label.localeCompare(b.label, 'es'));
    updateSelectOptions(selectVendedor, 'Vendedor', vendedorOptions);

    // Clientes → únicos por slug
    const clienteMap = new Map();
    (rentas || []).forEach(r => {
        const slug = r._clienteSlug;
        const label = r._clienteNombre || 'Cliente';
        if (!slug || clienteMap.has(slug)) return;
        clienteMap.set(slug, label);
    });
    const clienteOptions = Array.from(clienteMap.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es'));
    updateSelectOptions(selectCliente, 'Cliente', clienteOptions);

    // Productos → categorías disponibles
    const availableProductTypes = new Set();
    (rentas || []).forEach(r => {
        (r._productTypes || []).forEach(t => availableProductTypes.add(t));
    });
    const productOptions = PRODUCT_TYPE_OPTIONS
        .filter(opt => availableProductTypes.size === 0 || availableProductTypes.has(opt.value));
    updateSelectOptions(selectProducto, 'Tipo de producto', productOptions);

    // Clasificación de cliente
    const clasifMap = new Map();

    SEGMENTACION_OPTIONS.forEach(label => {
        const slug = normalizeText(label);
        if (!slug || clasifMap.has(slug)) return;
        clasifMap.set(slug, label);
    });

    (rentas || []).forEach(r => {
        const slug = r._clasificacionSlug;
        const label = r._clasificacion || 'Sin clasificar';
        if (!slug || clasifMap.has(slug)) return;
        clasifMap.set(slug, label);
    });
    const clasifOptions = Array.from(clasifMap.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, 'es'));
    updateSelectOptions(selectClasificacion, 'Clasificación de cliente', clasifOptions);
}

function aplicarFiltros() {
    console.log('🔍 Aplicando filtros...');
    // Leer valores normalizados
    const sucursalFilter = getFilterValue('filter-sucursal', { normalize: true });
    const fechaDesdeValue = getFilterValue('filter-fecha-desde');
    const fechaHastaValue = getFilterValue('filter-fecha-hasta');
    const vendedorFilterRaw = getFilterValue('filter-vendedor');
    const clienteFilter = getFilterValue('filter-cliente');
    const estadoFilterRaw = getFilterValue('filter-estado', { normalize: true });
    const productoFilter = getFilterValue('filter-producto');
    const clasificacionFilter = getFilterValue('filter-clasificacion', { normalize: true });

    const fechaDesde = fechaDesdeValue ? parseDateSafe(fechaDesdeValue) : null;
    const fechaHasta = fechaHastaValue ? parseDateSafe(fechaHastaValue) : null;
    if (fechaDesde) fechaDesde.setHours(0, 0, 0, 0);
    if (fechaHasta) fechaHasta.setHours(23, 59, 59, 999);

    // Filtrar allRentas
    const rentasFiltradas = allRentas.filter(r => {
        let pass = true;
        const inicioContrato = getFechaInicioContrato(r);

        // Filtro Fechas
        if (fechaDesde && pass) {
            if (!inicioContrato || startOfDay(inicioContrato) < fechaDesde) pass = false;
        }
        if (fechaHasta && pass) {
            if (!inicioContrato || inicioContrato > fechaHasta) pass = false;
        }

        // Filtro Sucursal
        if (sucursalFilter && pass) {
            const rSlug = r._sucursalSlug || normalizeText(r.sucursal || r.nombre_almacen || '');
            if (rSlug !== sucursalFilter) pass = false;
        }

        // Filtro Vendedor
        if (vendedorFilterRaw && pass) {
            const normalizedFilter = normalizeText(vendedorFilterRaw);
            const idMatch = r._vendedorId && String(r._vendedorId) === vendedorFilterRaw;
            const slugMatch = r._vendedorNombreNormalized && r._vendedorNombreNormalized === normalizedFilter;
            if (!idMatch && !slugMatch) pass = false;
        }

        // Filtro Cliente
        if (clienteFilter && pass) {
            const normalizedFilter = normalizeText(clienteFilter);
            const rClienteSlug = r._clienteSlug || normalizeText(r._clienteNombre || '');
            if (!rClienteSlug || rClienteSlug !== normalizedFilter) pass = false;
        }

        // Filtro Estado
        if (estadoFilterRaw && pass) {
            const estadoCalc = getEstadoRentaContrato(r);
            const normalizedFilter = estadoFilterRaw === 'concluida' ? 'concluido' : estadoFilterRaw;
            if (estadoCalc !== normalizedFilter) pass = false;
        }

        // Filtro Producto
        if (productoFilter && pass) {
            if (!Array.isArray(r._productTypes) || !r._productTypes.includes(productoFilter)) pass = false;
        }

        // Filtro Clasificación
        if (clasificacionFilter && pass) {
            if (!r._clasificacionSlug || r._clasificacionSlug !== clasificacionFilter) pass = false;
        }

        return pass;
    });

    console.log(`✅ Filtrado: ${rentasFiltradas.length} de ${allRentas.length} rentas.`);

    // Recalcular todo
    const kpis = calcularKPIs(rentasFiltradas, allInventario);
    actualizarKPIs(kpis);
    calcularEstadisticas(rentasFiltradas);

    // Actualizar gráfica Top Productos para reflejar filtros
    if (typeof crearGraficaTopProductos === 'function') {
        crearGraficaTopProductos(rentasFiltradas);
    }

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
    const cliente = renta.nombre_cliente || renta.cliente_nombre || 'estimado cliente';
    const fecha = renta.fecha_fin;
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

    // 1. Persistir en el Servidor vía PUT (contratos)
    try {
        if (!window.API_CONFIG) {
            throw new Error('API_CONFIG no disponible');
        }

        // Leer contrato completo para evitar sobreescribir columnas con undefined en PUT
        const contratoFull = await window.API_CONFIG.get(`contratos/${id}`);

        const nuevaNota = `[${new Date().toLocaleString('es-MX')}] ${mensajeHistorial}`;
        const notasActualizadas = contratoFull.notas_domicilio
            ? `${contratoFull.notas_domicilio}\n${nuevaNota}`
            : nuevaNota;

        const payloadActualizacion = {
            ...contratoFull,
            notas_domicilio: notasActualizadas,
            items: Array.isArray(contratoFull.items) ? contratoFull.items : (Array.isArray(renta.items) ? renta.items : [])
        };

        await window.API_CONFIG.put(`contratos/${id}`, payloadActualizacion);

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
            const index = allRentas.findIndex(r => (r.id_contrato || r.id) == id);
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
