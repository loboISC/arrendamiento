// ============================================
// DASHBOARD DE VENTAS - LÓGICA PRINCIPAL
// ============================================

// Variables globales
let calendar = null;
let eventosCalendario = [];
let currentUser = null;
let allCotizaciones = [];
let allClientes = [];
let backendVentasKpis = null;
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
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
  } catch (e) {
    console.error('Error al obtener usuario:', e);
  }
  return null;
}

// Obtener cotizaciones del backend (solo tipo VENTA)
async function fetchCotizaciones() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/cotizaciones', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Error al cargar cotizaciones');

    const data = await response.json();
    // Filtrar solo cotizaciones tipo VENTA
    allCotizaciones = data.filter(c => c.tipo === 'VENTA');
    console.log('✅ Cotizaciones VENTA cargadas:', allCotizaciones.length);
    return allCotizaciones;
  } catch (error) {
    console.error('❌ Error al cargar cotizaciones:', error);
    return [];
  }
}

// Escuchar evento F5 para recargar la página
document.addEventListener('keydown', function (e) {
    if (e.key === 'F5' || e.keyCode === 116) {
        e.preventDefault();
        location.reload();
    }
});

//
// Obtener clientes del backend
async function fetchClientes() {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/clientes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Error al cargar clientes');

    allClientes = await response.json();
    console.log('✅ Clientes cargados:', allClientes.length);
    return allClientes;
  } catch (error) {
    console.error('❌ Error al cargar clientes:', error);
    return [];
  }
}

// ============================================
// CÁLCULO DE KPIs
// ============================================

function calcularKPIs(cotizaciones, clientes) {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioSemana = new Date(ahora);
  inicioSemana.setDate(ahora.getDate() - ahora.getDay());
  const hace30Dias = new Date(ahora);
  hace30Dias.setDate(ahora.getDate() - 30);

  // Total de clientes
  const totalClientes = clientes.length;

  // Clientes activos (con cotizaciones en últimos 30 días)
  const clientesActivos = new Set(
    cotizaciones
      .filter(c => new Date(c.fecha_cotizacion) >= hace30Dias)
      .map(c => c.id_cliente)
  ).size;

  // Ingresos del mes actual (solo cotizaciones aprobadas/pagadas)
  const cotizacionesMes = cotizaciones.filter(c => {
    const fecha = new Date(c.fecha_cotizacion);
    return fecha >= inicioMes &&
      (c.estado === 'Aprobada' || c.estado === 'Pagada' || c.estado === 'Facturada' || c.estado === 'Convertida a Contrato');
  });

  const ingresosMes = cotizacionesMes.reduce((sum, c) => sum + parseFloat(c.total || 0), 0);

  // Ticket promedio
  const ticketPromedio = cotizacionesMes.length > 0
    ? ingresosMes / cotizacionesMes.length
    : 0;

  // Cotizaciones activas (no canceladas ni rechazadas)
  const cotizacionesActivas = cotizaciones.filter(c =>
    c.estado !== 'Cancelada' && c.estado !== 'Rechazada'
  ).length;

  // Cotizaciones aprobadas hoy
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const cotizacionesHoy = cotizaciones.filter(c => {
    if (!c.fecha_aprobacion) return false;
    const fechaAprobacion = new Date(c.fecha_aprobacion);
    fechaAprobacion.setHours(0, 0, 0, 0);
    return fechaAprobacion.getTime() === hoy.getTime();
  }).length;

  // Cotizaciones aprobadas esta semana
  const cotizacionesSemana = cotizaciones.filter(c => {
    if (!c.fecha_aprobacion) return false;
    return new Date(c.fecha_aprobacion) >= inicioSemana;
  }).length;

  // Margen bruto (simplificado - subtotal vs total)
  const margenBruto = cotizacionesMes.length > 0
    ? ((ingresosMes - cotizacionesMes.reduce((sum, c) => sum + parseFloat(c.subtotal || 0), 0)) / ingresosMes * 100)
    : 0;

  return {
    totalClientes,
    clientesActivos,
    ingresosMes,
    ticketPromedio,
    cotizacionesActivas,
    cotizacionesHoy,
    cotizacionesSemana,
    margenBruto: Math.max(0, margenBruto) // Evitar negativos
  };
}

// ============================================
// PROCESAMIENTO DE DATOS PARA GRÁFICAS
// ============================================

function esCotizacionDeCierre(cot) {
  return cot.estado === 'Aprobada' || cot.estado === 'Pagada' || cot.estado === 'Facturada' || cot.estado === 'Convertida a Contrato';
}

function obtenerGranularidadGraficas() {
  return document.getElementById('chart-periodo')?.value || 'mes';
}

function obtenerClavePeriodo(fecha, granularidad) {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;

  if (granularidad === 'dia') {
    return d.toISOString().slice(0, 10);
  }

  if (granularidad === 'semana') {
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    return monday.toISOString().slice(0, 10);
  }

  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}`;
}

function formatearEtiquetaPeriodo(clave, granularidad) {
  if (!clave) return 'N/A';
  if (granularidad === 'dia') return clave;
  if (granularidad === 'semana') return `Sem ${clave}`;

  const [year, month] = clave.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
}

function obtenerItemsCotizacion(cot) {
  const items = [];
  if (Array.isArray(cot.productos_seleccionados)) items.push(...cot.productos_seleccionados);
  if (Array.isArray(cot.accesorios_seleccionados)) items.push(...cot.accesorios_seleccionados);
  return items;
}

function procesarVentasPorPeriodo(cotizaciones, granularidad) {
  const map = new Map();
  (cotizaciones || []).forEach(cot => {
    if (!esCotizacionDeCierre(cot)) return;
    const clave = obtenerClavePeriodo(cot.fecha_cotizacion, granularidad);
    if (!clave) return;
    map.set(clave, (map.get(clave) || 0) + parseFloat(cot.total || 0));
  });

  const claves = Array.from(map.keys()).sort();
  return {
    labels: claves.map(k => formatearEtiquetaPeriodo(k, granularidad)),
    data: claves.map(k => map.get(k))
  };
}

function procesarVentasPorProductoPeriodo(cotizaciones, granularidad) {
  const totalProducto = new Map();
  const periodos = new Set();
  const serieProductoPeriodo = new Map();

  (cotizaciones || []).forEach(cot => {
    if (!esCotizacionDeCierre(cot)) return;
    const periodo = obtenerClavePeriodo(cot.fecha_cotizacion, granularidad);
    if (!periodo) return;
    periodos.add(periodo);

    const items = obtenerItemsCotizacion(cot);
    items.forEach(item => {
      const nombre = item.nombre || 'Sin nombre';
      const subtotal = parseFloat(item.subtotal || 0);
      totalProducto.set(nombre, (totalProducto.get(nombre) || 0) + subtotal);

      const key = `${nombre}__${periodo}`;
      serieProductoPeriodo.set(key, (serieProductoPeriodo.get(key) || 0) + subtotal);
    });
  });

  const topProductos = Array.from(totalProducto.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([nombre]) => nombre);

  const periodosOrdenados = Array.from(periodos).sort();
  const colores = ['#2979ff', '#1abc9c', '#ff9800', '#e91e63', '#9c27b0', '#00bcd4'];

  const datasets = topProductos.map((producto, idx) => ({
    label: producto,
    data: periodosOrdenados.map(p => serieProductoPeriodo.get(`${producto}__${p}`) || 0),
    backgroundColor: colores[idx % colores.length],
    borderRadius: 6
  }));

  return {
    labels: periodosOrdenados.map(k => formatearEtiquetaPeriodo(k, granularidad)),
    datasets
  };
}

function procesarEmbudoPorPeriodo(cotizaciones, granularidad) {
  const estadosObjetivo = ['Borrador', 'Enviada', 'Aprobada', 'Facturada', 'Convertida a Contrato', 'Rechazada', 'Cancelada'];
  const periodos = new Set();
  const estadoPeriodo = new Map();

  (cotizaciones || []).forEach(cot => {
    const periodo = obtenerClavePeriodo(cot.fecha_cotizacion, granularidad);
    if (!periodo) return;
    periodos.add(periodo);
    const estado = estadosObjetivo.includes(cot.estado) ? cot.estado : 'Borrador';
    const key = `${estado}__${periodo}`;
    estadoPeriodo.set(key, (estadoPeriodo.get(key) || 0) + 1);
  });

  const periodosOrdenados = Array.from(periodos).sort();
  const colores = {
    'Borrador': '#cbd5e1',
    'Enviada': '#ff9800',
    'Aprobada': '#1abc9c',
    'Facturada': '#4caf50',
    'Convertida a Contrato': '#2e7d32',
    'Rechazada': '#f44336',
    'Cancelada': '#9e9e9e'
  };

  const datasets = estadosObjetivo.map(estado => ({
    label: estado,
    data: periodosOrdenados.map(p => estadoPeriodo.get(`${estado}__${p}`) || 0),
    backgroundColor: colores[estado],
    borderRadius: 4
  }));

  return {
    labels: periodosOrdenados.map(k => formatearEtiquetaPeriodo(k, granularidad)),
    datasets
  };
}

// ============================================
// ACTUALIZACIÓN DE UI
// ============================================

function actualizarKPIs(kpis) {
  const formatMoney = (val) => new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val);

  if (typeof kpis.totalClientes === 'number') {
    updateKPI('total-clientes', kpis.totalClientes.toLocaleString());
  }
  if (typeof kpis.clientesActivos === 'number') {
    updateKPI('clientes-activos', kpis.clientesActivos.toLocaleString());
  }
  if (typeof kpis.ingresosMes === 'number') {
    updateKPI('ingresos-mes', formatMoney(kpis.ingresosMes));
  }
  if (typeof kpis.ticketPromedio === 'number') {
    updateKPI('ticket-promedio', formatMoney(kpis.ticketPromedio));
  }
  if (typeof kpis.cotizacionesActivas === 'number') {
    updateKPI('cotizaciones-activas', kpis.cotizacionesActivas.toLocaleString());
  }
  if (typeof kpis.cotizacionesHoy === 'number' && typeof kpis.cotizacionesSemana === 'number') {
    updateKPI('cotizaciones-aprobadas', `${kpis.cotizacionesHoy} / ${kpis.cotizacionesSemana}`);
  }
  if (typeof kpis.margenBruto === 'number') {
    updateKPI('margen-bruto', kpis.margenBruto.toFixed(1) + '%');
  }

  if (typeof kpis.tasaConversionFacturada === 'number') {
    updateKPI('tasa-conversion-facturada', (kpis.tasaConversionFacturada * 100).toFixed(1) + '%');
  }
  if (typeof kpis.tasaConversionAprobada === 'number') {
    updateKPI('tasa-conversion-aprobada', (kpis.tasaConversionAprobada * 100).toFixed(1) + '%');
  }
  if (typeof kpis.tiempoPromedioCierreDias === 'number') {
    updateKPI('tiempo-promedio-cierre', kpis.tiempoPromedioCierreDias.toFixed(1) + ' dias');
  }
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
// INICIALIZACIÓN DE GRÁFICAS CON CHART.JS
// ============================================

let charts = {};

function initCharts(datosGraficas) {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js no est� disponible');
    return;
  }

  Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  Chart.defaults.color = '#6b7280';

  const ctxProductos = document.getElementById('chartProductos')?.getContext('2d');
  if (ctxProductos) {
    charts.productos = new Chart(ctxProductos, {
      type: 'bar',
      data: {
        labels: datosGraficas.productos.labels,
        datasets: datosGraficas.productos.datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (value) => '$' + Number(value).toLocaleString('es-MX') }
          }
        }
      }
    });
  }

  const ctxMeses = document.getElementById('chartMeses')?.getContext('2d');
  if (ctxMeses) {
    charts.meses = new Chart(ctxMeses, {
      type: 'line',
      data: {
        labels: datosGraficas.meses.labels,
        datasets: [{
          label: 'Ventas',
          data: datosGraficas.meses.data,
          borderColor: '#2979ff',
          backgroundColor: 'rgba(41, 121, 255, 0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (value) => '$' + Number(value).toLocaleString('es-MX') }
          }
        }
      }
    });
  }

  const ctxEmbudo = document.getElementById('chartEmbudo')?.getContext('2d');
  if (ctxEmbudo) {
    charts.embudo = new Chart(ctxEmbudo, {
      type: 'bar',
      data: {
        labels: datosGraficas.embudo.labels,
        datasets: datosGraficas.embudo.datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' } },
        scales: {
          x: { stacked: true },
          y: { beginAtZero: true, stacked: true }
        }
      }
    });
  }
}

// ============================================
// POBLACIÓN DE TABLAS
// ============================================

// ============================================
// KPIS DE VENTAS VALIDADOS EN BACKEND
// ============================================

function getCurrentVentasFilters() {
  return {
    fecha_desde: document.getElementById('filter-fecha-desde')?.value || '',
    fecha_hasta: document.getElementById('filter-fecha-hasta')?.value || '',
    id_vendedor: document.getElementById('filter-vendedor')?.value || '',
    id_cliente: document.getElementById('filter-cliente')?.value || '',
    estado: document.getElementById('filter-estado')?.value || '',
    clasificacion: document.getElementById('filter-clasificacion')?.value || '',
    producto: document.getElementById('filter-producto')?.value || ''
  };
}

async function fetchVentasKpisBackend(filters = {}) {
  try {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        params.append(k, String(v));
      }
    });

    const response = await fetch(`/api/cotizaciones/ventas-kpis?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('No se pudieron cargar KPIs backend de ventas');
    const result = await response.json();
    if (!result?.success || !result?.data) throw new Error('Respuesta de KPIs backend invalida');
    return result.data;
  } catch (error) {
    console.error('Error al obtener KPIs backend de ventas:', error);
    return null;
  }
}

async function actualizarVentasKpisBackend(filters = {}) {
  const data = await fetchVentasKpisBackend(filters);
  if (!data) return;

  backendVentasKpis = data;
  updateKPI(
    'tasa-conversion-facturada',
    typeof data.tasaConversionFacturada === 'number'
      ? (data.tasaConversionFacturada * 100).toFixed(1) + '%'
      : '0.0%'
  );
  updateKPI(
    'tasa-conversion-aprobada',
    typeof data.tasaConversionAprobada === 'number'
      ? (data.tasaConversionAprobada * 100).toFixed(1) + '%'
      : '0.0%'
  );
  updateKPI(
    'tiempo-promedio-cierre',
    typeof data.tiempoPromedioCierreDias === 'number'
      ? data.tiempoPromedioCierreDias.toFixed(1) + ' dias'
      : '0.0 dias'
  );

}

function populateTables(cotizaciones, clientes) {
  // Top 10 Clientes
  const clientesConVentas = new Map();

  // Crear un mapa de clientes por ID para búsqueda rápida
  const clientesMap = new Map();
  clientes.forEach(c => {
    clientesMap.set(c.id_cliente, c);
  });

  cotizaciones.forEach(cot => {
    const idCliente = cot.id_cliente;
    const total = parseFloat(cot.total || 0);

    if (!clientesConVentas.has(idCliente)) {
      // Buscar el cliente en el array de clientes
      const clienteData = clientesMap.get(idCliente);

      clientesConVentas.set(idCliente, {
        nombre: clienteData?.nombre || cot.cliente_nombre || cot.nombre_cliente || 'Cliente #' + idCliente,
        totalComprado: 0,
        totalCotizado: 0,
        frecuencia: 0,
        ciudad: clienteData?.municipio || clienteData?.ciudad || cot.cliente_municipio || 'N/A',
        clasificacion: clienteData?.tipo_cliente || cot.tipo_cliente || 'N/A'
      });
    }

    const cliente = clientesConVentas.get(idCliente);
    cliente.totalCotizado += total;
    cliente.frecuencia += 1;

    if (cot.estado === 'Aprobada' || cot.estado === 'Pagada' || cot.estado === 'Facturada' || cot.estado === 'Convertida a Contrato') {
      cliente.totalComprado += total;
    }
  });

  const topClientes = Array.from(clientesConVentas.values())
    .sort((a, b) => b.totalComprado - a.totalComprado)
    .slice(0, 10);

  const tableTop = document.getElementById('tableTopClientes');
  if (tableTop) {
    tableTop.innerHTML = topClientes.map(item => `
      <tr>
        <td><strong>${item.nombre}</strong></td>
        <td>$${item.totalComprado.toLocaleString()}</td>
        <td>$${item.totalCotizado.toLocaleString()}</td>
        <td>${item.frecuencia}</td>
        <td>${item.ciudad}</td>
        <td><span class="badge badge-${item.clasificacion.toLowerCase().replace(/\s+/g, '-')}">${item.clasificacion}</span></td>
      </tr>
    `).join('');
  }

  // Productos Más Vendidos
  const productosVendidos = new Map();

  cotizaciones.forEach(cot => {
    const procesarItems = (items) => {
      if (!items || !Array.isArray(items)) return;

      items.forEach(item => {
        const nombre = item.nombre || 'Sin nombre';
        const cantidad = parseInt(item.cantidad || 0);
        const subtotal = parseFloat(item.subtotal || 0);

        if (!productosVendidos.has(nombre)) {
          productosVendidos.set(nombre, {
            producto: nombre,
            unidades: 0,
            ingreso: 0
          });
        }

        const prod = productosVendidos.get(nombre);
        prod.unidades += cantidad;
        prod.ingreso += subtotal;
      });
    };

    procesarItems(cot.productos_seleccionados);
    procesarItems(cot.accesorios_seleccionados);
  });

  const topProductos = Array.from(productosVendidos.values())
    .sort((a, b) => b.ingreso - a.ingreso)
    .slice(0, 10);

  const tableProductos = document.getElementById('tableProductosMasVendidos');
  if (tableProductos) {
    tableProductos.innerHTML = topProductos.map(item => `
      <tr>
        <td><strong>${item.producto}</strong></td>
        <td>${item.unidades}</td>
        <td>$${item.ingreso.toLocaleString()}</td>
        <td>N/A</td>
      </tr>
    `).join('');
  }
}

// ============================================
// GENERACIÓN DE ALERTAS
// ============================================

function generateAlerts(cotizaciones) {
  const alertas = [];
  const ahora = new Date();
  // ============================================
  // 1. COTIZACIONES SIN RESPUESTA (>7 días)
  // ============================================
  const sinRespuesta = cotizaciones.filter(c => {
    const fechaCot = new Date(c.fecha_cotizacion);
    const diasTranscurridos = (ahora - fechaCot) / (1000 * 60 * 60 * 24);
    return diasTranscurridos > 7 && c.estado === 'Enviada';
  });
  if (sinRespuesta.length > 0) {
    alertas.push({
      titulo: 'Cotizaciones sin respuesta',
      descripcion: `${sinRespuesta.length} cotizaciones sin respuesta después de 7 días`,
      tipo: 'warning',
      icono: 'fa-clock'
    });
  }
  // ============================================
  // 2. VENTAS POR DEBAJO DE PROYECCIÓN
  // ============================================
  const mesActual = ahora.getMonth();
  const añoActual = ahora.getFullYear();

  const ventasMesActual = cotizaciones.filter(c => {
    const fecha = new Date(c.fecha_cotizacion);
    return fecha.getMonth() === mesActual &&
      fecha.getFullYear() === añoActual &&
      (c.estado === 'Aprobada' || c.estado === 'Facturada' || c.estado === 'Convertida a Contrato');
  }).reduce((sum, c) => sum + parseFloat(c.total || 0), 0);
  const mesAnterior = mesActual === 0 ? 11 : mesActual - 1;
  const añoAnterior = mesActual === 0 ? añoActual - 1 : añoActual;

  const ventasMesAnterior = cotizaciones.filter(c => {
    const fecha = new Date(c.fecha_cotizacion);
    return fecha.getMonth() === mesAnterior &&
      fecha.getFullYear() === añoAnterior &&
      (c.estado === 'Aprobada' || c.estado === 'Facturada' || c.estado === 'Convertida a Contrato');
  }).reduce((sum, c) => sum + parseFloat(c.total || 0), 0);
  if (ventasMesAnterior > 0 && ventasMesActual < ventasMesAnterior * 0.85) {
    const porcentaje = ((ventasMesAnterior - ventasMesActual) / ventasMesAnterior * 100).toFixed(0);
    alertas.push({
      titulo: 'Ventas por debajo de proyección',
      descripcion: `Ventas del mes ${porcentaje}% por debajo del mes anterior`,
      tipo: 'critical',
      icono: 'fa-arrow-down'
    });
  }
  // ============================================
  // 3. CLIENTES INACTIVOS (sin cotizaciones en 30 días)
  // ============================================
  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);
  const clientesConCotizacionesRecientes = new Set();
  cotizaciones.forEach(c => {
    const fechaCot = new Date(c.fecha_cotizacion);
    if (fechaCot >= hace30Dias) {
      clientesConCotizacionesRecientes.add(c.id_cliente);
    }
  });
  const clientesUnicos = new Set(cotizaciones.map(c => c.id_cliente));
  const clientesInactivos = clientesUnicos.size - clientesConCotizacionesRecientes.size;
  if (clientesInactivos > 5) {
    alertas.push({
      titulo: 'Clientes inactivos',
      descripcion: `${clientesInactivos} clientes sin actividad en los últimos 30 días`,
      tipo: 'warning',
      icono: 'fa-user-times'
    });
  }
  // ============================================
  // 4. COTIZACIONES PRÓXIMAS A VENCER (vigencia < 3 días)
  // ============================================
  const proximasVencer = cotizaciones.filter(c => {
    if (c.estado !== 'Enviada' && c.estado !== 'Borrador') return false;

    const fechaCot = new Date(c.fecha_cotizacion);
    const vigenciaDias = 15; // Asumiendo 15 días de vigencia
    const fechaVencimiento = new Date(fechaCot);
    fechaVencimiento.setDate(fechaVencimiento.getDate() + vigenciaDias);

    const diasRestantes = (fechaVencimiento - ahora) / (1000 * 60 * 60 * 24);
    return diasRestantes > 0 && diasRestantes < 3;
  });
  if (proximasVencer.length > 0) {
    alertas.push({
      titulo: 'Cotizaciones próximas a vencer',
      descripcion: `${proximasVencer.length} cotizaciones vencen en menos de 3 días`,
      tipo: 'warning',
      icono: 'fa-calendar-times'
    });
  }
  // ============================================
  // 5. BAJA TASA DE CONVERSIÓN (<30%)
  // ============================================
  const totalCotizaciones = cotizaciones.length;
  const cotizacionesAprobadas = cotizaciones.filter(c =>
    c.estado === 'Aprobada' || c.estado === 'Facturada' || c.estado === 'Convertida a Contrato'
  ).length;
  const tasaConversion = totalCotizaciones > 0
    ? (cotizacionesAprobadas / totalCotizaciones) * 100
    : 0;
  if (totalCotizaciones >= 10 && tasaConversion < 30) {
    alertas.push({
      titulo: 'Baja tasa de conversión',
      descripcion: `Solo ${tasaConversion.toFixed(1)}% de cotizaciones se convierten en ventas`,
      tipo: 'critical',
      icono: 'fa-chart-line'
    });
  }
  // ============================================
  // RENDERIZAR ALERTAS
  // ============================================
  const alertsContainer = document.getElementById('alertsContainer');
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

// ============================================
// CARGA PRINCIPAL DEL DASHBOARD
// ============================================

async function cargarDashboard() {
  console.log('🚀 Iniciando carga del dashboard...');

  // Mostrar indicador de carga
  const kpiCards = document.querySelectorAll('.kpi-value');
  kpiCards.forEach(card => card.textContent = '...');

  try {
    // 1. Cargar datos del backend en paralelo
    const [cotizaciones, clientes] = await Promise.all([
      fetchCotizaciones(),
      fetchClientes()
    ]);

    if (cotizaciones.length === 0) {
      console.warn('⚠️ No hay cotizaciones de venta disponibles');
      kpiCards.forEach(card => card.textContent = '0');
      return;
    }

    // 2. Calcular KPIs
    console.log('📊 Calculando KPIs...');
    const kpis = calcularKPIs(cotizaciones, clientes);
    actualizarKPIs(kpis);

    // 3. Procesar datos para gráficas
    console.log('📈 Procesando datos para gráficas...');
    const granularidad = obtenerGranularidadGraficas();
    const datosGraficas = {
      productos: procesarVentasPorProductoPeriodo(cotizaciones, granularidad),
      meses: procesarVentasPorPeriodo(cotizaciones, granularidad),
      embudo: procesarEmbudoPorPeriodo(cotizaciones, granularidad)
    };

    // 4. Inicializar gráficas
    initCharts(datosGraficas);

    // 5. Poblar tablas
    console.log('📋 Poblando tablas...');
    populateTables(cotizaciones, clientes);

    // 6. Generar alertas
    console.log('🚨 Generando alertas...');
    generateAlerts(cotizaciones);
    await actualizarVentasKpisBackend(getCurrentVentasFilters());

    console.log('✅ Dashboard cargado exitosamente');
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

  if (allCotizaciones.length > 0) {
    sessionStorage.setItem('cotizacionesVentas', JSON.stringify(allCotizaciones));
  }

  window.location.href = 'cotizaciones-lista.html?tipo=VENTA';
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

// Navegación de pestañas
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
// CALENDARIO DE VENTAS
// ============================================

// Inicializar calendario
function inicializarCalendario() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) {
    console.warn('[inicializarCalendario] Elemento #calendar no encontrado');
    return;
  }
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'es',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listWeek'
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      list: 'Lista'
    },
    noEventsText: 'No hay eventos para mostrar',
    dayMaxEvents: 3,
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    },
    events: eventosCalendario,
    eventClick: function (info) {
      mostrarDetallesEvento(info.event);
    },
    eventDidMount: function (info) {
      // Agregar tooltip
      info.el.title = info.event.extendedProps.descripcion || info.event.title;
    }
  });
  calendar.render();
  console.log('[inicializarCalendario] Calendario inicializado');
}
// Procesar eventos del calendario desde cotizaciones
function procesarEventosCalendario(cotizaciones) {
  console.log('[procesarEventosCalendario] Procesando eventos de', cotizaciones.length, 'cotizaciones');
  eventosCalendario = [];

  cotizaciones.forEach(cotizacion => {
    try {
      // EVENTO 1: COTIZACIÓN en la fecha que se realizó
      if (cotizacion.fecha_cotizacion) {
        const fechaCotizacion = new Date(cotizacion.fecha_cotizacion);

        // Determinar color según estado
        let colorEstado = '#2979ff'; // Azul por defecto
        if (cotizacion.estado === 'Aprobada' || cotizacion.estado === 'Convertida a Contrato') {
          colorEstado = '#4caf50'; // Verde - Aprobada
        } else if (cotizacion.estado === 'Rechazada') {
          colorEstado = '#f44336'; // Rojo - Rechazada
        } else if (cotizacion.estado === 'Enviada') {
          colorEstado = '#ff9800'; // Naranja - Enviada
        }

        const numeroDisplay = cotizacion.numero || cotizacion.numero_cotizacion || cotizacion.numero_folio || `#${cotizacion.id_cotizacion}`;
        eventosCalendario.push({
          id: `cot-${cotizacion.id_cotizacion}`,
          title: `📋 Cotización ${numeroDisplay} - ${cotizacion.contacto_nombre || cotizacion.cliente_nombre || 'Cliente'}`,
          start: fechaCotizacion.toISOString().split('T')[0],
          backgroundColor: colorEstado,
          borderColor: colorEstado,
          extendedProps: {
            tipo: 'cotizacion',
            cotizacion: cotizacion,
            id_cotizacion: cotizacion.id_cotizacion,
            cliente: cotizacion.contacto_nombre || cotizacion.cliente_nombre || 'Sin nombre',
            estado: cotizacion.estado,
            descripcion: `Cotización realizada el ${fechaCotizacion.toLocaleDateString('es-MX')}`
          }
        });
      }

      // EVENTO 2: ENTREGA en la fecha solicitada
      let fechaEntrega;

      if (cotizacion.fecha_entrega_solicitada) {
        fechaEntrega = new Date(cotizacion.fecha_entrega_solicitada);
      } else if (cotizacion.fecha_cotizacion && cotizacion.dias_periodo) {
        // Usar fecha de cotización + días del periodo
        fechaEntrega = new Date(cotizacion.fecha_cotizacion);
        const diasPeriodo = parseInt(cotizacion.dias_periodo || 1);
        fechaEntrega.setDate(fechaEntrega.getDate() + diasPeriodo);
      }

      if (fechaEntrega) {
        const hoy = new Date();
        const diasRestantes = Math.ceil((fechaEntrega - hoy) / (1000 * 60 * 60 * 24));

        // Determinar color según urgencia
        let colorUrgencia;
        if (diasRestantes <= 3) {
          colorUrgencia = '#f44336'; // Rojo - Urgente (≤3 días)
        } else if (diasRestantes <= 7) {
          colorUrgencia = '#ff9800'; // Naranja - Próximo (4-7 días)
        } else {
          colorUrgencia = '#ffc107'; // Amarillo - Programado (>7 días)
        }

        const numeroDisplay = cotizacion.numero || cotizacion.numero_cotizacion || cotizacion.numero_folio || `#${cotizacion.id_cotizacion}`;
        eventosCalendario.push({
          id: `entrega-${cotizacion.id_cotizacion}`,
          title: `🚚 Entrega ${numeroDisplay} - ${cotizacion.contacto_nombre || cotizacion.cliente_nombre || 'Cliente'}`,
          start: fechaEntrega.toISOString().split('T')[0],
          backgroundColor: colorUrgencia,
          borderColor: colorUrgencia,
          extendedProps: {
            tipo: 'entrega',
            cotizacion: cotizacion,
            id_cotizacion: cotizacion.id_cotizacion,
            cliente: cotizacion.contacto_nombre || cotizacion.cliente_nombre || 'Sin nombre',
            diasRestantes: diasRestantes,
            estado: cotizacion.estado,
            descripcion: `Entrega programada para ${fechaEntrega.toLocaleDateString('es-MX')}`
          }
        });
      }
    } catch (error) {
      console.error('[procesarEventosCalendario] Error procesando cotización:', cotizacion.numero_cotizacion, error);
    }
  });

  console.log('[procesarEventosCalendario] Total eventos creados:', eventosCalendario.length);
  // Actualizar calendario si ya está inicializado
  if (calendar) {
    calendar.removeAllEvents();
    calendar.addEventSource(eventosCalendario);
    calendar.refetchEvents();
  }
}
// Mostrar detalles del evento en modal
async function mostrarDetallesEvento(event) {
  const modal = document.getElementById('eventoModal');
  const titulo = document.getElementById('eventoTitulo');
  const detalles = document.getElementById('eventoDetalles');

  if (!modal || !titulo || !detalles) return;

  const props = event.extendedProps;
  const fecha = new Date(event.start);

  console.log('[mostrarDetallesEvento] Props:', props);
  console.log('[mostrarDetallesEvento] Tipo de evento:', props.tipo);

  // Determinar si es un evento de cotización directa o de notificación/recordatorio
  let cotizacion;

  if (props.tipo === 'cotizacion' && props.cotizacion && typeof props.cotizacion === 'object') {
    // Caso 1: Evento de cotización generada - props.cotizacion ya es el objeto completo
    cotizacion = props.cotizacion;
    console.log('[mostrarDetallesEvento] Usando cotización del evento directo');
  } else if (props.id_cotizacion) {
    // Caso 2: Evento de notificación/recordatorio - buscar por id_cotizacion
    cotizacion = allCotizaciones.find(c => Number(c.id_cotizacion) === Number(props.id_cotizacion));
    console.log('[mostrarDetallesEvento] Buscando cotización por ID:', props.id_cotizacion);
  }

  console.log('[mostrarDetallesEvento] Cotización encontrada:', !!cotizacion);
  console.log('[mostrarDetallesEvento] Cliente:', cotizacion?.contacto_nombre || cotizacion?.nombre_cliente);

  titulo.textContent = event.title;

  // Usar datos de cotización encontrada PRIMERO, luego props como fallback
  let numeroCotizacion;
  if (cotizacion) {
    numeroCotizacion = cotizacion.numero || cotizacion.numero_cotizacion || cotizacion.numero_folio || `#${cotizacion.id_cotizacion}`;
  } else if (typeof props.cotizacion === 'object' && props.cotizacion !== null) {
    numeroCotizacion = props.cotizacion.numero || props.cotizacion.numero_cotizacion || props.cotizacion.numero_folio || `#${props.id_cotizacion}`;
  } else {
    numeroCotizacion = props.cotizacion || `#${props.id_cotizacion}`;
  }

  // Priorizar datos de cotización encontrada
  const nombreCliente = cotizacion?.contacto_nombre ||
    cotizacion?.cliente_nombre ||
    cotizacion?.nombre_cliente ||
    (props.cliente !== 'Sin nombre' ? props.cliente : null) ||
    'Cliente no especificado';

  const descripcionEvento = props.descripcion ||
    props.mensaje ||
    cotizacion?.notas ||
    'Sin descripción';

  console.log('[mostrarDetallesEvento] Datos extraídos:', {
    numeroCotizacion,
    nombreCliente,
    descripcionEvento,
    cotizacionEncontrada: !!cotizacion
  });

  let detallesHTML = `
    <div class="evento-detalle-item">
      <strong>Tipo:</strong> ${props.tipo === 'cotizacion' ? '📋 Cotización' : (props.tipo === 'notificacion' ? '� Notificación' : '⏰ Recordatorio')}
    </div>
    <div class="evento-detalle-item">
      <strong>Cotización:</strong> ${numeroCotizacion}
    </div>
    <div class="evento-detalle-item">
      <strong>Cliente:</strong> ${nombreCliente}
    </div>
    <div class="evento-detalle-item">
      <strong>Fecha:</strong> ${fecha.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}
    </div>
  `;

  // Agregar detalles de entrega si existen
  if (cotizacion) {
    if (props.estado) {
      detallesHTML += `
        <div class="evento-detalle-item">
          <strong>Estado:</strong> <span class="badge badge-${props.estado.toLowerCase()}">${props.estado}</span>
        </div>
      `;
    }

    if (cotizacion.requiere_entrega) {
      detallesHTML += `
        <div class="evento-detalle-item evento-entrega">
          <strong>🚚 Detalles de Entrega:</strong>
        </div>
      `;

      if (cotizacion.hora_entrega_solicitada) {
        detallesHTML += `
          <div class="evento-detalle-item">
            <strong>Hora de entrega:</strong> ${cotizacion.hora_entrega_solicitada}
          </div>
        `;
      }

      if (cotizacion.direccion_entrega) {
        detallesHTML += `
          <div class="evento-detalle-item">
            <strong>Dirección:</strong> ${cotizacion.direccion_entrega}
          </div>
        `;
      }

      if (cotizacion.tipo_envio) {
        detallesHTML += `
          <div class="evento-detalle-item">
            <strong>Tipo de envío:</strong> ${cotizacion.tipo_envio === 'domicilio' ? '🏠 Domicilio' : '🏢 Recolección'}
          </div>
        `;
      }

      if (cotizacion.costo_envio && parseFloat(cotizacion.costo_envio) > 0) {
        detallesHTML += `
          <div class="evento-detalle-item">
            <strong>Costo de envío:</strong> $${parseFloat(cotizacion.costo_envio).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </div>
        `;
      }

      if (cotizacion.entrega_referencia) {
        detallesHTML += `
          <div class="evento-detalle-item">
            <strong>Referencia:</strong> ${cotizacion.entrega_referencia}
          </div>
        `;
      }
    }

    // Total de la cotización
    if (cotizacion.total) {
      detallesHTML += `
        <div class="evento-detalle-item evento-total">
          <strong>Total:</strong> <span style="font-size: 18px; color: #4CAF50;">$${parseFloat(cotizacion.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
        </div>
      `;
    }
  }

  if (props.prioridad) {
    detallesHTML += `
      <div class="evento-detalle-item">
        <strong>Prioridad:</strong> <span class="badge badge-${props.prioridad}">${props.prioridad}</span>
      </div>
    `;
  }

  detallesHTML += `
    <div class="evento-detalle-item">
      <strong>Descripción:</strong> ${descripcionEvento}
    </div>
    <div class="evento-detalle-actions">
      <button onclick="window.location.href='cotizacion_venta.html?edit=${props.id_cotizacion}'" class="btn-primary">
        <i class="fa fa-edit"></i> Ver Cotización
      </button>
    </div>
  `;

  detalles.innerHTML = detallesHTML;
  modal.style.display = 'flex';
}
// Cerrar modal
document.addEventListener('DOMContentLoaded', function () {
  const modal = document.getElementById('eventoModal');
  const closeBtn = document.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.onclick = function () {
      modal.style.display = 'none';
    };
  }
  if (modal) {
    window.onclick = function (event) {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    };
  }
});
// Generar alertas de recordatorios próximos
function generarAlertasRecordatorios(cotizaciones) {
  const ahora = new Date();
  const en24Horas = new Date(ahora.getTime() + (24 * 60 * 60 * 1000));
  const alertas = [];
  cotizaciones.forEach(cotizacion => {
    try {
      let recordatorios = [];
      if (cotizacion.recordatorios_programados) {
        if (typeof cotizacion.recordatorios_programados === 'string') {
          recordatorios = JSON.parse(cotizacion.recordatorios_programados);
        } else if (Array.isArray(cotizacion.recordatorios_programados)) {
          recordatorios = cotizacion.recordatorios_programados;
        }
      }
      recordatorios.forEach(record => {
        if (record.completado) return;
        const fechaRecord = new Date(record.fecha);

        // Alertas para recordatorios en las próximas 24 horas
        if (fechaRecord >= ahora && fechaRecord <= en24Horas) {
          alertas.push({
            tipo: 'recordatorio_proximo',
            severidad: 'warning',
            titulo: `⏰ Recordatorio Próximo`,
            mensaje: `${record.mensaje} - Cotización: ${cotizacion.numero_cotizacion}`,
            fecha: fechaRecord,
            cotizacion: cotizacion.numero_cotizacion,
            id_cotizacion: cotizacion.id_cotizacion
          });
        }
        // Alertas para recordatorios vencidos
        if (fechaRecord < ahora) {
          alertas.push({
            tipo: 'recordatorio_vencido',
            severidad: 'danger',
            titulo: `🚨 Recordatorio Vencido`,
            mensaje: `${record.mensaje} - Cotización: ${cotizacion.numero_cotizacion}`,
            fecha: fechaRecord,
            cotizacion: cotizacion.numero_cotizacion,
            id_cotizacion: cotizacion.id_cotizacion
          });
        }
      });
    } catch (error) {
      console.error('[generarAlertasRecordatorios] Error:', error);
    }
  });
  return alertas;
}

// ============================================
// Navegación entre Pestañas
// ============================================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const tab = this.getAttribute('data-tab');

    // Ocultar todas las secciones
    document.querySelectorAll('.band').forEach(band => {
      band.style.display = 'none';
    });

    // Mostrar sección correspondiente
    if (tab === 'dashboard') {
      document.querySelectorAll('.band:not(.band-calendario)').forEach(band => {
        band.style.display = 'block';
      });
    } else if (tab === 'calendario') {
      document.getElementById('calendarioSection').style.display = 'block';
      if (calendar) calendar.render(); // Re-renderizar al mostrar
    }

    // Actualizar tab activo
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});
// ============================================
// FUNCIONES AUXILIARES PARA LOS ESTADOS DE LA COTIZACION
// ============================================
function getColorEstado(estado) {
  const colores = {
    'Borrador': '#cbd5e1',
    'Enviada': '#ff9800',
    'Aprobada': '#1abc9c',
    'Convertida a Contrato': '#4caf50',
    'Rechazada': '#f44336',
    'Cancelada': '#9e9e9e'
  };
  return colores[estado] || '#2979ff';
}

// ============================================
// FUNCIONES DE FILTRADO
// ============================================

// Poblar selectores de filtros con datos reales
function poblarFiltros(cotizaciones, clientes) {
  // Poblar vendedores (únicos de las cotizaciones)
  const vendedoresSet = new Set();
  cotizaciones.forEach(c => {
    if (c.id_vendedor || c.vendedor_nombre) {
      vendedoresSet.add(JSON.stringify({
        id: c.id_vendedor,
        nombre: c.vendedor_nombre || 'Vendedor ' + c.id_vendedor
      }));
    }
  });

  const selectVendedor = document.getElementById('filter-vendedor');
  if (selectVendedor) {
    Array.from(vendedoresSet).forEach(vendedorStr => {
      const vendedor = JSON.parse(vendedorStr);
      const option = document.createElement('option');
      option.value = vendedor.id;
      option.textContent = vendedor.nombre;
      selectVendedor.appendChild(option);
    });
  }


  // Poblar clientes
  const selectCliente = document.getElementById('filter-cliente');
  if (selectCliente && clientes.length > 0) {
    clientes.slice(0, 50).forEach(cliente => { // Limitar a 50 para rendimiento
      const option = document.createElement('option');
      option.value = cliente.id_cliente;
      option.textContent = cliente.nombre || 'Cliente ' + cliente.id_cliente;
      selectCliente.appendChild(option);
    });
  }

  // Poblar productos (únicos de productos_seleccionados)
  const productosSet = new Set();
  cotizaciones.forEach(c => {
    if (c.productos_seleccionados && Array.isArray(c.productos_seleccionados)) {
      c.productos_seleccionados.forEach(p => productosSet.add(p.nombre));
    }
    if (c.accesorios_seleccionados && Array.isArray(c.accesorios_seleccionados)) {
      c.accesorios_seleccionados.forEach(a => productosSet.add(a.nombre));
    }
  });

  const selectProducto = document.getElementById('filter-producto');
  if (selectProducto) {
    Array.from(productosSet).sort().forEach(producto => {
      const option = document.createElement('option');
      option.value = producto;
      option.textContent = producto;
      selectProducto.appendChild(option);
    });
  }

  // Poblar clasificaciones (únicos de tipo_cliente)
  const clasificacionesSet = new Set();
  clientes.forEach(c => {
    if (c.tipo_cliente) clasificacionesSet.add(c.tipo_cliente);
  });

  const selectClasificacion = document.getElementById('filter-clasificacion');
  if (selectClasificacion) {
    Array.from(clasificacionesSet).sort().forEach(clasificacion => {
      const option = document.createElement('option');
      option.value = clasificacion;
      option.textContent = clasificacion;
      selectClasificacion.appendChild(option);
    });
  }

  console.log('✅ Filtros poblados correctamente');
}

// Aplicar filtros a las cotizaciones
function aplicarFiltros() {
  console.log('🔍 Aplicando filtros...');

  // Obtener valores de los filtros
  const sucursal = document.getElementById('filter-sucursal')?.value || '';
  const fechaDesde = document.getElementById('filter-fecha-desde')?.value || '';
  const fechaHasta = document.getElementById('filter-fecha-hasta')?.value || '';
  const vendedor = document.getElementById('filter-vendedor')?.value || '';
  const cliente = document.getElementById('filter-cliente')?.value || '';
  const producto = document.getElementById('filter-producto')?.value || '';
  const clasificacion = document.getElementById('filter-clasificacion')?.value || '';
  const estado = document.getElementById('filter-estado')?.value || '';

  // Filtrar cotizaciones
  let cotizacionesFiltradas = [...allCotizaciones];

  // Filtro por fecha
  if (fechaDesde) {
    const fechaDesdeObj = new Date(fechaDesde);
    cotizacionesFiltradas = cotizacionesFiltradas.filter(c => {
      const fechaCot = new Date(c.fecha_cotizacion);
      return fechaCot >= fechaDesdeObj;
    });
  }

  if (fechaHasta) {
    const fechaHastaObj = new Date(fechaHasta);
    fechaHastaObj.setHours(23, 59, 59, 999); // Incluir todo el día
    cotizacionesFiltradas = cotizacionesFiltradas.filter(c => {
      const fechaCot = new Date(c.fecha_cotizacion);
      return fechaCot <= fechaHastaObj;
    });
  }

  // Filtro por vendedor
  if (vendedor) {
    cotizacionesFiltradas = cotizacionesFiltradas.filter(c =>
      c.id_vendedor == vendedor
    );
  }

  // Filtro por cliente
  if (cliente) {
    cotizacionesFiltradas = cotizacionesFiltradas.filter(c =>
      c.id_cliente == cliente
    );
  }

  // Filtro por producto
  if (producto) {
    cotizacionesFiltradas = cotizacionesFiltradas.filter(c => {
      const tieneProducto = c.productos_seleccionados?.some(p => p.nombre === producto);
      const tieneAccesorio = c.accesorios_seleccionados?.some(a => a.nombre === producto);
      return tieneProducto || tieneAccesorio;
    });
  }

  // Filtro por clasificación de cliente
  if (clasificacion) {
    cotizacionesFiltradas = cotizacionesFiltradas.filter(c =>
      c.tipo_cliente === clasificacion
    );
  }

  // Filtro por estado
  if (estado) {
    cotizacionesFiltradas = cotizacionesFiltradas.filter(c =>
      c.estado === estado
    );
  }

  console.log(`📊 Filtros aplicados: ${allCotizaciones.length} → ${cotizacionesFiltradas.length} cotizaciones`);

  // Recalcular dashboard con datos filtrados
  recalcularDashboard(cotizacionesFiltradas);
  actualizarVentasKpisBackend(getCurrentVentasFilters());
}

// Limpiar todos los filtros
function limpiarFiltros() {
  console.log('🧹 Limpiando filtros...');

  // Resetear todos los selectores e inputs
  document.getElementById('filter-sucursal').value = '';
  document.getElementById('filter-fecha-desde').value = '';
  document.getElementById('filter-fecha-hasta').value = '';
  document.getElementById('filter-vendedor').value = '';
  document.getElementById('filter-cliente').value = '';
  document.getElementById('filter-producto').value = '';
  document.getElementById('filter-clasificacion').value = '';
  document.getElementById('filter-estado').value = '';

  // Recalcular dashboard con todos los datos
  recalcularDashboard(allCotizaciones);
  actualizarVentasKpisBackend(getCurrentVentasFilters());
}

// Recalcular dashboard con cotizaciones filtradas
function recalcularDashboard(cotizaciones) {
  console.log('🔄 Recalculando dashboard con', cotizaciones.length, 'cotizaciones...');

  // 1. Recalcular KPIs
  const kpis = calcularKPIs(cotizaciones, allClientes);
  actualizarKPIs(kpis);

  // 2. Recalcular datos para gráficas
  const granularidad = obtenerGranularidadGraficas();
  const datosGraficas = {
    productos: procesarVentasPorProductoPeriodo(cotizaciones, granularidad),
    meses: procesarVentasPorPeriodo(cotizaciones, granularidad),
    embudo: procesarEmbudoPorPeriodo(cotizaciones, granularidad)
  };

  // 3. Actualizar gráficas
  actualizarGraficas(datosGraficas);

  // 4. Actualizar tablas
  populateTables(cotizaciones, allClientes);

  // 5. Actualizar alertas
  generateAlerts(cotizaciones);

  // 6. Actualizar calendario
  procesarEventosCalendario(cotizaciones);

  console.log('✅ Dashboard recalculado');
}

// Actualizar gráficas existentes con nuevos datos
function actualizarGraficas(datosGraficas) {
  if (charts.productos) {
    charts.productos.data.labels = datosGraficas.productos.labels;
    charts.productos.data.datasets = datosGraficas.productos.datasets;
    charts.productos.update();
  }

  if (charts.meses) {
    charts.meses.data.labels = datosGraficas.meses.labels;
    charts.meses.data.datasets[0].data = datosGraficas.meses.data;
    charts.meses.update();
  }

  if (charts.embudo) {
    charts.embudo.data.labels = datosGraficas.embudo.labels;
    charts.embudo.data.datasets = datosGraficas.embudo.datasets;
    charts.embudo.update();
  }
}

// ============================================
// SISTEMA DE ALERTAS EN CAMPANA
// ============================================

function actualizarNotificacionesCampana() {
  const alertasRecordatorios = generarAlertasRecordatorios(allCotizaciones);
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
        <h3>Notificaciones (${totalAlertas})</h3>
      </div>
      <div class="notificaciones-body">
    `;

    alertasRecordatorios.forEach(alerta => {
      const iconoSeveridad = alerta.severidad === 'danger' ? '🚨' : '⏰';
      const claseSeveridad = alerta.severidad === 'danger' ? 'notificacion-danger' : 'notificacion-warning';

      notificacionesHTML += `
        <div class="notificacion-item ${claseSeveridad}" onclick="window.location.href='cotizacion_venta.html?edit=${alerta.id_cotizacion}'">
          <div class="notificacion-icon">${iconoSeveridad}</div>
          <div class="notificacion-content">
            <div class="notificacion-titulo">${alerta.titulo}</div>
            <div class="notificacion-mensaje">${alerta.mensaje}</div>
            <div class="notificacion-fecha">${new Date(alerta.fecha).toLocaleString('es-MX')}</div>
          </div>
        </div>
      `;
    });

    notificacionesHTML += `
      </div>
      <div class="notificaciones-footer">
        <button onclick="document.querySelector('.tab-btn[data-tab=calendario]').click()" class="btn-ver-calendario">
          <i class="fa fa-calendar"></i> Ver Calendario
        </button>
      </div>
    `;

    dropdown.innerHTML = notificacionesHTML;
  }
}


// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', async function () {
  console.log('🎯 Inicializando Dashboard de Ventas...');

  populateUserFields();
  await cargarDashboard();
  // Inicializar calendario
  inicializarCalendario();
  procesarEventosCalendario(allCotizaciones);
  // Actualizar notificaciones de campana
  actualizarNotificacionesCampana();
  // Generar alertas de recordatorios
  const alertasRecordatorios = generarAlertasRecordatorios(allCotizaciones);

  // Procesar eventos del calendario
  if (allCotizaciones.length > 0) {
    procesarEventosCalendario(allCotizaciones);
  }

  // Poblar filtros después de cargar datos
  if (allCotizaciones.length > 0) {
    poblarFiltros(allCotizaciones, allClientes);
  }

  const chartPeriodo = document.getElementById('chart-periodo');
  if (chartPeriodo) {
    chartPeriodo.addEventListener('change', () => {
      aplicarFiltros();
    });
  }
  console.log('✨ Dashboard inicializado correctamente');
});
