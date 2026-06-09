// public/js/facturacion.js
// Variables globales
let conceptos = [];
let contadorConceptos = 0;
let facturas = [];
let estadisticas = {};
let aplicaIvaFiscal = true; // Flag global para IVA en timbrado
let hayDescuentos = false; // Flag para mostrar/ocultar columna de descuentos

// Datos y estado para paginación del historial de facturas (lado cliente)
// Nota: esta implementación pagina en el navegador (trae todas las facturas filtradas y hace slice).
// A futuro, se puede migrar a paginación del lado servidor usando `page` y `limit` en el mismo endpoint.
let facturasCompletas = [];
let estadoPaginacionFacturas = {
    paginaActual: 1,
    tamanoPagina: 10,
    totalRegistros: 0,
    totalPaginas: 1
};

// Formatear números como dinero MXN
function formatearMoneda(amount) {
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount || 0));
}

function esUuidBorradorFactura(uuid) {
    return String(uuid || '').toUpperCase().startsWith('BORRADOR');
}

function mapearEstadoFacturaBadge(estadoRaw, metodoPago) {
    const estado = String(estadoRaw || 'BORRADOR').toUpperCase().trim();
    const metodo = String(metodoPago || 'PUE').toUpperCase();

    if (estado.includes('PENDIENTE') && metodo === 'PUE') {
        return { estadoClass: 'badge-pue', estadoTexto: 'APLICADA' };
    }
    if (estado.includes('PENDIENTE') && metodo === 'PPD') {
        return { estadoClass: 'badge-timbrado', estadoTexto: 'TIMBRADA' };
    }

    switch (estado) {
        case 'BORRADOR':
            return { estadoClass: 'badge-borrador', estadoTexto: 'BORRADOR' };
        case 'TIMBRANDO':
            return { estadoClass: 'badge-warning', estadoTexto: 'TIMBRANDO' };
        case 'TIMBRADA':
        case 'TIMBRADO':
            return { estadoClass: 'badge-timbrado', estadoTexto: 'TIMBRADA' };
        case 'ERROR':
            return { estadoClass: 'badge-danger', estadoTexto: 'ERROR' };
        case 'CANCELADA':
        case 'CANCELADO':
            return { estadoClass: 'badge-cancelado', estadoTexto: 'CANCELADA' };
        case 'APLICADA':
        case 'PAGADA':
            return { estadoClass: 'badge-pue', estadoTexto: 'APLICADA' };
        case 'PARCIAL':
            return { estadoClass: 'badge-pendiente', estadoTexto: 'PARCIAL' };
        case 'PENDIENTE':
        case 'PENDIENTE_PAGO':
        case 'PENDIENTE PPD':
            return { estadoClass: 'badge-timbrado', estadoTexto: 'TIMBRADA' };
        default:
            return { estadoClass: 'badge-borrador', estadoTexto: estado || 'BORRADOR' };
    }
}

// Escuchar evento F5 para recargar la página
document.addEventListener('keydown', function (e) {
    if (e.key === 'F5' || e.keyCode === 116) {
        e.preventDefault();
        location.reload();
    }
});

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    // Cargar datos del usuario
    cargarUsuario();

    // Cargar datos reales de facturas
    cargarFacturas();

    // Configurar eventos del modal
    configurarModal();

    // Configurar eventos del formulario
    configurarFormulario();

    // Cargar datos del emisor
    cargarDatosEmisor();

    // Configurar eventos de filtros
    configurarEventosFiltros();

    // Cargar clientes para el filtro
    cargarClientesFiltro();
});

// Utilidad Debounce para búsqueda en tiempo real
function crearDebounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Función para cargar datos del emisor
async function cargarDatosEmisor() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/configuracion-facturas/emisor', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                const emisor = result.data;
                const nombreEl = document.getElementById('emisor-nombre');
                const rfcEl = document.getElementById('emisor-rfc');
                const cpEl = document.getElementById('emisor-cp');
                const regimenEl = document.getElementById('emisor-regimen');

                if (nombreEl) nombreEl.value = emisor.razon_social || 'No configurado';
                if (rfcEl) rfcEl.value = emisor.rfc || 'XAXX010101000';
                if (cpEl) cpEl.value = emisor.codigo_postal || '';
                if (regimenEl) {
                    regimenEl.textContent = emisor.regimen_fiscal || '601';
                    regimenEl.title = emisor.regimen_fiscal; // Tooltip simple
                }
            }
        }
    } catch (error) {
        console.error('Error cargando datos del emisor:', error);
    }
}

// Función para abrir modal de editar cliente rápido
async function abrirModalEditarCliente() {
    const clienteId = document.getElementById('timb-cliente-id').value;
    if (!clienteId) {
        Swal.fire('Error', 'No hay un cliente seleccionado', 'warning');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        // Usar endpoint existente para obtener detalles completos
        const response = await fetch(`/api/clientes/${clienteId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const cliente = await response.json();

            // Llenar formulario
            document.getElementById('edit-cliente-id').value = clienteId;
            document.getElementById('edit-cliente-nombre').value = cliente.razon_social || cliente.nombre || '';
            document.getElementById('edit-cliente-rfc').value = cliente.fact_rfc || cliente.rfc || '';
            document.getElementById('edit-cliente-cp').value = cliente.codigo_postal || '';
            document.getElementById('edit-cliente-regimen').value = cliente.regimen_fiscal || '616';
            document.getElementById('edit-cliente-uso-cfdi').value = cliente.uso_cfdi || 'G03';
            document.getElementById('edit-cliente-email').value = cliente.email || '';

            // Mostrar modal
            document.getElementById('modal-editar-cliente-rapido').style.display = 'flex';
        } else {
            Swal.fire('Error', 'No se pudo cargar la información del cliente', 'error');
        }
    } catch (error) {
        console.error('Error cargando cliente para edición:', error);
        Swal.fire('Error', 'Ocurrió un error al cargar los datos', 'error');
    }
}

// Función para guardar cambios del cliente rápido
async function guardarClienteRapido() {
    const id = document.getElementById('edit-cliente-id').value;
    const razon_social = document.getElementById('edit-cliente-nombre').value.trim();
    const fact_rfc = document.getElementById('edit-cliente-rfc').value.trim();
    const codigo_postal = document.getElementById('edit-cliente-cp').value.trim();
    const regimen_fiscal = document.getElementById('edit-cliente-regimen').value;
    const uso_cfdi = document.getElementById('edit-cliente-uso-cfdi').value;
    const email = document.getElementById('edit-cliente-email').value.trim();

    if (!fact_rfc || !razon_social || !codigo_postal) {
        Swal.fire('Atención', 'RFC, Razón Social y Código Postal son obligatorios', 'warning');
        return;
    }

    try {
        Swal.fire({
            title: 'Guardando...',
            didOpen: () => { Swal.showLoading(); }
        });

        const token = localStorage.getItem('token');

        // Preparar payload. Nota: Usamos PUT a /api/clientes/:id que espera un objeto completo o parcial.
        // Aseguramos enviar campos clave para facturación.
        const payload = {
            fact_rfc,
            razon_social,
            codigo_postal,
            regimen_fiscal,
            uso_cfdi,
            email,
            // Campos de fallback o compatibilidad
            rfc: fact_rfc,
            nombre: razon_social,
            domicilio: codigo_postal // Simplificado
        };

        const response = await fetch(`/api/clientes/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        Swal.close();

        if (response.ok) {
            Swal.fire('Éxito', 'Datos del cliente actualizados', 'success');
            document.getElementById('modal-editar-cliente-rapido').style.display = 'none';

            // Actualizar vista previa en el dashboard
            document.getElementById('timb-cliente-nombre').textContent = razon_social;
            // Actualizar hiddens
            document.getElementById('timb-cliente-rfc').value = fact_rfc;
            document.getElementById('timb-cliente-cp').value = codigo_postal;
            document.getElementById('timb-cliente-regimen').value = regimen_fiscal;
            document.getElementById('timb-cliente-uso').value = uso_cfdi;

            // Si hay dirección visible, actualizarla (opcional)
            const dirEl = document.getElementById('timb-cliente-direccion');
            if (dirEl) dirEl.textContent = `CP: ${codigo_postal} | Regimen: ${regimen_fiscal}`;

        } else {
            Swal.fire('Error', result.error || 'No se pudieron actualizar los datos', 'error');
        }
    } catch (error) {
        console.error('Error guardando cliente rápido:', error);
        Swal.fire('Error', 'Ocurrió un error de conexión', 'error');
    }
}

// Función para cargar datos del usuario
async function cargarUsuario() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const usuario = await response.json();

            const nameEl = document.getElementById('user-name');
            const roleEl = document.getElementById('user-role');
            const emailEl = document.getElementById('user-email');
            const nameTopEl = document.getElementById('user-name-top');
            const roleTopEl = document.getElementById('user-role-top');

            if (nameEl) nameEl.textContent = usuario.nombre || 'Usuario';
            if (roleEl) roleEl.textContent = usuario.rol || 'Usuario';
            if (emailEl) emailEl.textContent = usuario.correo || '';
            if (nameTopEl) nameTopEl.textContent = usuario.nombre || 'Usuario';
            if (roleTopEl) roleTopEl.textContent = usuario.rol || 'Usuario';

            const avatarImg = document.getElementById('avatar-img');
            const avatarImgDropdown = document.getElementById('avatar-img-dropdown');

            if (usuario.foto) {
                if (avatarImg) avatarImg.src = usuario.foto;
                if (avatarImgDropdown) avatarImgDropdown.src = usuario.foto;
            }
        } else {
            console.warn('Perfil no válido, redirigiendo a login');
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Error cargando usuario:', error);
        // Solo redirigir si no es un error de renderizado (textContent)
        if (error instanceof TypeError && error.message.includes('fetch')) {
            window.location.href = 'login.html';
        }
    }
}

// Función para cargar facturas reales con filtros opcionales
async function cargarFacturas(filtros = {}) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('[DEBUG-FILTER] No hay token, redirigiendo...');
            window.location.href = 'login.html';
            return;
        }

        // Construir query string
        const params = new URLSearchParams();
        if (filtros.search) params.append('search', filtros.search);
        if (filtros.estado && filtros.estado !== 'Estado: Todos') params.append('estado', filtros.estado);
        if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
        if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
        if (filtros.id_cliente) params.append('id_cliente', filtros.id_cliente);

        const url = `/api/facturas${params.toString() ? '?' + params.toString() : ''}`;
        console.log('[DEBUG-FILTER] Fetching:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('[DEBUG-FILTER] Response Status:', response.status);

        if (response.ok) {
            const result = await response.json();
            console.log('[DEBUG-FILTER] Result data received:', result.data.facturas.length, 'items');

            // Guardar el arreglo completo y paginar en el frontend
            // Importante: si más adelante cambiamos a paginación server-side, aquí se consumirá `page/limit`.
            facturasCompletas = Array.isArray(result?.data?.facturas) ? result.data.facturas : [];
            estadisticas = result.data.estadisticas;

            // Reiniciar paginación al aplicar filtros/búsqueda
            inicializarPaginacionFacturas();

            if (facturasCompletas.length > 0) {
                console.log('>>> INSPECCIÓN DE FACTURA 0 PARA KPI <<<');
                console.log('- Objeto completo:', facturasCompletas[0]);
                console.log('- f.fechas.emision:', facturasCompletas[0].fechas?.emision);
                console.log('- f.fechas:', facturasCompletas[0].fechas);
                console.log('- f.estado:', facturasCompletas[0].estado);
            }

            // Renderizar tabla + pie + paginación con datos reales
            irAPaginaFacturas(1);

            // Actualizar estadísticas (ahora con facturas locales pobladas)
            actualizarEstadisticas();
        } else {
            const errorText = await response.text();
            console.error('[DEBUG-FILTER] Error response:', response.status, errorText);
            // Si es un error de autenticación, redirigir
            if (response.status === 401 || response.status === 403) {
                window.location.href = 'login.html';
            }
        }
    } catch (error) {
        console.error('[DEBUG-FILTER] Fetch error:', error);
    }
}

// Inicializa el estado de paginación con base en el arreglo completo
// Aquí calculamos el total de páginas en base al tamaño de página configurado.
function inicializarPaginacionFacturas() {
    // Nota: el tamaño de página se mantiene para dar una UX consistente
    estadoPaginacionFacturas.totalRegistros = facturasCompletas.length;
    estadoPaginacionFacturas.totalPaginas = Math.max(
        1,
        Math.ceil(estadoPaginacionFacturas.totalRegistros / estadoPaginacionFacturas.tamanoPagina)
    );
    estadoPaginacionFacturas.paginaActual = 1;
}

// Cambia de página, actualiza tabla, texto "Mostrando" y botones
// Esta es la función central de paginación del historial.
function irAPaginaFacturas(pagina) {
    const paginaNormalizada = Math.min(
        Math.max(1, Number(pagina) || 1),
        estadoPaginacionFacturas.totalPaginas
    );

    estadoPaginacionFacturas.paginaActual = paginaNormalizada;

    const inicio = (estadoPaginacionFacturas.paginaActual - 1) * estadoPaginacionFacturas.tamanoPagina;
    const fin = inicio + estadoPaginacionFacturas.tamanoPagina;

    // Alimentar la tabla con el slice de la página actual
    facturas = facturasCompletas.slice(inicio, fin);

    actualizarTablaFacturas();
    actualizarPieTablaFacturas();
    renderizarPaginacionFacturas();
}

// Actualiza el texto del pie de tabla: "Mostrando X-Y de Z facturas encontradas"
// Se apoya en el estado de paginación para determinar el rango visible.
function actualizarPieTablaFacturas() {
    const footer = obtenerFooterTablaFacturas();
    if (!footer) return;

    const span = footer.querySelector('span');
    if (!span) return;

    const total = estadoPaginacionFacturas.totalRegistros;
    if (total === 0) {
        span.textContent = 'Mostrando 0-0 de 0 facturas encontradas';
        return;
    }

    const inicio = (estadoPaginacionFacturas.paginaActual - 1) * estadoPaginacionFacturas.tamanoPagina + 1;
    const fin = Math.min(
        estadoPaginacionFacturas.paginaActual * estadoPaginacionFacturas.tamanoPagina,
        total
    );

    span.textContent = `Mostrando ${inicio}-${fin} de ${total} facturas encontradas`;
}

// Renderiza los botones de paginación (prev/next + números)
// Genera un conjunto acotado de páginas y añade "..." cuando aplica.
function renderizarPaginacionFacturas() {
    const footer = obtenerFooterTablaFacturas();
    if (!footer) return;

    const contenedor = footer.querySelector('.pagination');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    const totalPaginas = estadoPaginacionFacturas.totalPaginas;
    const paginaActual = estadoPaginacionFacturas.paginaActual;

    // Botón anterior
    contenedor.appendChild(crearBotonPaginacion({
        tipo: 'prev',
        deshabilitado: paginaActual <= 1,
        onClick: () => irAPaginaFacturas(paginaActual - 1)
    }));

    // Rango de páginas visible (máximo 7 botones numéricos incluyendo extremos)
    const rango = calcularRangoPaginas({ paginaActual, totalPaginas, maxBotones: 7 });

    // Primera página + puntos suspensivos si aplica
    if (rango.inicio > 1) {
        contenedor.appendChild(crearBotonPaginacion({
            tipo: 'numero',
            etiqueta: '1',
            activo: paginaActual === 1,
            onClick: () => irAPaginaFacturas(1)
        }));

        if (rango.inicio > 2) {
            contenedor.appendChild(crearBotonPaginacion({ tipo: 'puntos' }));
        }
    }

    // Páginas del rango
    for (let p = rango.inicio; p <= rango.fin; p++) {
        contenedor.appendChild(crearBotonPaginacion({
            tipo: 'numero',
            etiqueta: String(p),
            activo: p === paginaActual,
            onClick: () => irAPaginaFacturas(p)
        }));
    }

    // Última página + puntos suspensivos si aplica
    if (rango.fin < totalPaginas) {
        if (rango.fin < totalPaginas - 1) {
            contenedor.appendChild(crearBotonPaginacion({ tipo: 'puntos' }));
        }

        contenedor.appendChild(crearBotonPaginacion({
            tipo: 'numero',
            etiqueta: String(totalPaginas),
            activo: paginaActual === totalPaginas,
            onClick: () => irAPaginaFacturas(totalPaginas)
        }));
    }

    // Botón siguiente
    contenedor.appendChild(crearBotonPaginacion({
        tipo: 'next',
        deshabilitado: paginaActual >= totalPaginas,
        onClick: () => irAPaginaFacturas(paginaActual + 1)
    }));
}

// Obtiene el footer asociado a la tabla de facturas
// Intenta ubicar el footer dentro de la misma sección de la tabla.
function obtenerFooterTablaFacturas() {
    const tabla = document.querySelector('.facturas-table');
    const seccion = tabla ? tabla.closest('section') : null;
    return seccion ? seccion.querySelector('.table-footer') : document.querySelector('.table-footer');
}

// Calcula el rango de páginas a mostrar
// Mantiene un máximo de botones numéricos para evitar paginaciones demasiado largas.
function calcularRangoPaginas({ paginaActual, totalPaginas, maxBotones }) {
    const max = Math.max(3, Number(maxBotones) || 7);

    // Reservar espacio para extremos cuando hay puntos suspensivos
    const mitad = Math.floor(max / 2);
    let inicio = Math.max(1, paginaActual - mitad);
    let fin = Math.min(totalPaginas, inicio + max - 1);

    // Ajuste si llegamos al final
    inicio = Math.max(1, fin - max + 1);

    return { inicio, fin };
}

// Crea un botón de paginación según su tipo
// Tipos soportados: prev, next, numero, puntos.
function crearBotonPaginacion({ tipo, etiqueta, activo, deshabilitado, onClick }) {
    const btn = document.createElement('button');
    btn.className = 'page-btn';

    if (tipo === 'prev') {
        btn.innerHTML = '<i class="fa fa-chevron-left"></i>';
    } else if (tipo === 'next') {
        btn.innerHTML = '<i class="fa fa-chevron-right"></i>';
    } else if (tipo === 'puntos') {
        btn.textContent = '...';
        btn.disabled = true;
    } else {
        btn.textContent = etiqueta || '';
    }

    if (activo) btn.classList.add('active');
    if (deshabilitado) btn.disabled = true;

    if (typeof onClick === 'function' && !btn.disabled) {
        btn.addEventListener('click', onClick);
    }

    return btn;
}

// Configurar eventos de los filtros
function configurarEventosFiltros() {
    const searchInput = document.getElementById('search-facturas');
    const estadoSelect = document.getElementById('filter-estado');
    const fechaInicioInput = document.getElementById('filter-date-start');
    const fechaFinInput = document.getElementById('filter-date-end');
    const clienteSelect = document.getElementById('filter-cliente');

    const btnAplicar = document.querySelector('.filters-row .btn-primary');
    const btnLimpiar = document.querySelector('.filters-row .btn-secondary:first-of-type'); // El que tiene el icono eraser

    // Función para obtener valores actuales de filtros
    const getFiltros = () => {
        return {
            search: searchInput?.value.trim(),
            estado: estadoSelect?.value,
            fecha_inicio: fechaInicioInput?.value,
            fecha_fin: fechaFinInput?.value,
            id_cliente: clienteSelect?.value
        };
    };

    // Búsqueda en tiempo real con debounce
    if (searchInput) {
        searchInput.addEventListener('input', crearDebounce(() => {
            console.log('Buscando en tiempo real:', searchInput.value);
            cargarFacturas(getFiltros());
        }, 500));
    }

    // Botón Aplicar
    if (btnAplicar) {
        btnAplicar.addEventListener('click', () => {
            cargarFacturas(getFiltros());
        });
    }

    // Botón Limpiar
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (estadoSelect) estadoSelect.selectedIndex = 0;
            if (fechaInicioInput) fechaInicioInput.value = '';
            if (fechaFinInput) fechaFinInput.value = '';
            if (clienteSelect) clienteSelect.selectedIndex = 0;

            cargarFacturas({});
        });
    }

    // Filtros que disparan carga inmediata al cambiar (opcional, pero mejora UX)
    [estadoSelect, fechaInicioInput, fechaFinInput, clienteSelect].forEach(el => {
        if (el) {
            el.addEventListener('change', () => {
                cargarFacturas(getFiltros());
            });
        }
    });

    // Filtros específicos para las tarjetas de KPIs
    const filtrosMetricas = ['filtro-facturas', 'filtro-ingresos', 'filtro-pendientes', 'filtro-canceladas'];
    filtrosMetricas.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                calcularTodasLasMetricas();
            });
        }
    });
}

// Cargar clientes para el dropdown de filtros
async function cargarClientesFiltro() {
    const select = document.getElementById('filter-cliente');
    if (!select) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/clientes', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const clientes = await response.json();

            // Limpiar opciones excepto la primera
            select.innerHTML = '<option value="Cliente: Todos">Cliente: Todos</option>';

            clientes.forEach(c => {
                const option = document.createElement('option');
                option.value = c.id_cliente;
                option.textContent = c.razon_social || c.nombre || `Cliente #${c.id_cliente}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error cargando clientes para filtro:', error);
    }
}

// Función para actualizar estadísticas y gráficos
function actualizarEstadisticas() {
    if (!estadisticas || !estadisticas.resumen) return;

    // Calcular y renderizar todas las tarjetas numéricas basado en los selects locales
    calcularTodasLasMetricas();
    renderizarKpisFinancieros();

    // Renderizar gráficos con datos reales
    renderizarGraficosDashboard();
}

// Función para calcular dinámicamente el ingreso y contadores de todos los KPIs
function calcularTodasLasMetricas() {
    if (!estadisticas || !estadisticas.resumen) return;

    console.log('[DEBUG-METRICS] === RECALCULANDO METRICAS ===');
    if (facturas && facturas.length > 0) {
        console.log('[DEBUG-METRICS] Primer registro de factura:', facturas[0]);
    } else {
        console.log('[DEBUG-METRICS] No hay facturas cargadas localmente');
    }

    const res = estadisticas.resumen;
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    // Obtener valores de los filtros (por defecto historico)
    const pFacturas = document.getElementById('filtro-facturas')?.value || 'historico';
    const pIngresos = document.getElementById('filtro-ingresos')?.value || 'historico';
    const pPendientes = document.getElementById('filtro-pendientes')?.value || 'historico';
    const pCanceladas = document.getElementById('filtro-canceladas')?.value || 'historico';

    // Obtener las estructuras precalculadas
    const hist = res.historico || {};
    const mes = res.mes || {};
    const anio = res.anio || {};

    const sourceData = {
        'historico': hist,
        'mes': mes,
        'anio': anio
    };

    // Asignar los valores desde el source calculado del backend
    let totalFacturas = sourceData[pFacturas]?.totalFacturas || 0;

    let totalIngresos = sourceData[pIngresos]?.totalIngresos || 0;

    let pendientes = sourceData[pPendientes]?.pendientes || 0;
    let porCobrar = sourceData[pPendientes]?.porCobrar || 0;

    let canceladas = sourceData[pCanceladas]?.canceladas || 0;
    let totalCancelado = sourceData[pCanceladas]?.totalCancelado || 0;

    // Actualizar DOM
    const tfEl = document.getElementById('stat-total-facturas');
    if (tfEl) tfEl.textContent = totalFacturas.toLocaleString();

    const tiEl = document.getElementById('stat-total-ingresos');
    if (tiEl) tiEl.textContent = `$${Number(totalIngresos).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const ppEl = document.getElementById('stat-por-cobrar');
    if (ppEl) ppEl.textContent = pendientes.toLocaleString();

    const mcEl = document.getElementById('stat-monto-cobrar');
    if (mcEl) mcEl.textContent = `$${Number(porCobrar).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const cEl = document.getElementById('stat-canceladas');
    if (cEl) cEl.textContent = canceladas.toLocaleString();

    const mcaEl = document.getElementById('stat-monto-cancelado');
    if (mcaEl) mcaEl.textContent = `$${Number(totalCancelado).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

// Variables globales para los gráficos
let evolutionChart = null;
let distributionChart = null;
let netCollectionChart = null;
let agingSemaphoreChart = null;

function formatearMonedaMX(value) {
    return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderizarKpisFinancieros() {
    const kpis = estadisticas?.kpisFinancieros || {};
    const semaforo = kpis.semaforoCartera || {};

    const dsoEl = document.getElementById('stat-dso-real');
    if (dsoEl) dsoEl.textContent = Number(kpis.dsoDiasReal || 0).toFixed(1);

    const dsoBaseEl = document.getElementById('stat-dso-base');
    if (dsoBaseEl) dsoBaseEl.textContent = `Con base en ${Number(kpis.facturasConPagoCapturado || 0).toLocaleString()} facturas con pago`;

    const cobranzaNetaEl = document.getElementById('stat-cobranza-neta');
    if (cobranzaNetaEl) cobranzaNetaEl.textContent = formatearMonedaMX(kpis.cobranzaNeta || 0);

    const cobTimbradoEl = document.getElementById('stat-cobranza-timbrado');
    if (cobTimbradoEl) cobTimbradoEl.textContent = `Timbrado: ${formatearMonedaMX(kpis.totalTimbrado || 0)}`;

    const cobNcEl = document.getElementById('stat-cobranza-nc');
    if (cobNcEl) cobNcEl.textContent = `NC: ${formatearMonedaMX(kpis.totalNc || 0)}`;

    const cobCancelEl = document.getElementById('stat-cobranza-cancel');
    if (cobCancelEl) cobCancelEl.textContent = `Cancelado: ${formatearMonedaMX(kpis.totalCancelado || 0)}`;

    const riesgoEl = document.getElementById('stat-cartera-riesgo');
    if (riesgoEl) riesgoEl.textContent = formatearMonedaMX(semaforo.riesgoTotal || 0);

    const a1 = document.getElementById('stat-aging-1-30');
    if (a1) a1.textContent = `1-30: ${formatearMonedaMX(semaforo.bucket_1_30?.monto || 0)}`;
    const a2 = document.getElementById('stat-aging-31-60');
    if (a2) a2.textContent = `31-60: ${formatearMonedaMX(semaforo.bucket_31_60?.monto || 0)}`;
    const a3 = document.getElementById('stat-aging-61-90');
    if (a3) a3.textContent = `61-90: ${formatearMonedaMX(semaforo.bucket_61_90?.monto || 0)}`;
    const a4 = document.getElementById('stat-aging-90-plus');
    if (a4) a4.textContent = `90+: ${formatearMonedaMX(semaforo.bucket_90_plus?.monto || 0)}`;
}

function renderizarGraficosDashboard() {
    if (typeof Chart === 'undefined' || !estadisticas.evolucion) return;

    // 1. Gráfico de Evolución (Barras)
    const evolutionCtx = document.getElementById('evolutionChart');
    if (evolutionCtx) {
        const existingEvolution = Chart.getChart(evolutionCtx);
        if (existingEvolution) {
            try { existingEvolution.destroy(); } catch (e) { console.warn(e); }
        }
        if (evolutionChart && typeof evolutionChart.destroy === 'function') {
            try { evolutionChart.destroy(); } catch (e) {}
        }

        const labels = estadisticas.evolucion.map(e => e.mes);
        const dataFacturado = estadisticas.evolucion.map(e => Number(e.facturado));
        const dataTimbrado = estadisticas.evolucion.map(e => Number(e.timbrado));
        const dataCancelado = estadisticas.evolucion.map(e => Number(e.cancelado));

        evolutionChart = new Chart(evolutionCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Facturado',
                        data: dataFacturado,
                        backgroundColor: '#2979ff',
                        borderRadius: 8,
                        barThickness: 20
                    },
                    {
                        label: 'Timbrado',
                        data: dataTimbrado,
                        backgroundColor: '#00bcd4',
                        borderRadius: 8,
                        barThickness: 20
                    },
                    {
                        label: 'Cancelado',
                        data: dataCancelado,
                        backgroundColor: '#f44336',
                        borderRadius: 8,
                        barThickness: 20
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: { callback: value => '$' + value.toLocaleString() }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 2. Gráfico de Distribución (Dona)
    const distributionCtx = document.getElementById('distributionChart');
    if (distributionCtx) {
        const existingDistribution = Chart.getChart(distributionCtx);
        if (existingDistribution) {
            try { existingDistribution.destroy(); } catch (e) { console.warn(e); }
        }
        if (distributionChart && typeof distributionChart.destroy === 'function') {
            try { distributionChart.destroy(); } catch (e) {}
        }

        const distData = estadisticas.distribucion || [];
        const labels = distData.map(d => d.estado);
        const totals = distData.map(d => parseInt(d.cantidad));

        // Colores según estado
        const colorMap = {
            Timbrada: '#2979ff',
            Aplicada: '#2e7d32',
            Parcial: '#ff9800',
            Borrador: '#94a3b8',
            Cancelada: '#f44336',
            Error: '#f44336',
            Timbrando: '#f57f17'
        };
        const backgroundColors = labels.map(l => colorMap[l] || '#cbd5e1');

        distributionChart = new Chart(distributionCtx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: totals,
                    backgroundColor: backgroundColors,
                    hoverOffset: 15,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: { legend: { display: false } }
            }
        });

        // Actualizar el número central
        const totalLabel = document.querySelector('.total-value');
        if (totalLabel) totalLabel.textContent = estadisticas.resumen?.historico?.totalFacturas || facturas.length;
    }

    // 3. Cobranza neta por periodo
    const netCollectionCtx = document.getElementById('netCollectionChart');
    if (netCollectionCtx) {
        if (netCollectionChart) netCollectionChart.destroy();

        const serie = estadisticas.cobranzaNetaPeriodo || [];
        const labels = serie.map(s => s.periodo_label);
        const timbrado = serie.map(s => Number(s.timbrado || 0));
        const nc = serie.map(s => Number(s.nc || 0));
        const cancelado = serie.map(s => Number(s.cancelado || 0));
        const neto = serie.map(s => Number(s.cobranza_neta || 0));

        netCollectionChart = new Chart(netCollectionCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Timbrado',
                        data: timbrado,
                        backgroundColor: 'rgba(41, 121, 255, 0.75)',
                        borderRadius: 6
                    },
                    {
                        label: 'NC',
                        data: nc,
                        backgroundColor: 'rgba(255, 152, 0, 0.75)',
                        borderRadius: 6
                    },
                    {
                        label: 'Cancelado',
                        data: cancelado,
                        backgroundColor: 'rgba(244, 67, 54, 0.75)',
                        borderRadius: 6
                    },
                    {
                        type: 'line',
                        label: 'Cobranza Neta',
                        data: neto,
                        borderColor: '#0f766e',
                        backgroundColor: 'rgba(15, 118, 110, 0.15)',
                        pointBackgroundColor: '#0f766e',
                        borderWidth: 2,
                        tension: 0.35,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'top' } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: value => '$' + Number(value).toLocaleString('en-US') }
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // 4. Semaforo de cartera vencida
    const agingCtx = document.getElementById('agingSemaphoreChart');
    if (agingCtx) {
        if (agingSemaphoreChart) agingSemaphoreChart.destroy();

        const semaforo = estadisticas.kpisFinancieros?.semaforoCartera || {};
        const labels = ['1-30', '31-60', '61-90', '90+'];
        const dataMontos = [
            Number(semaforo.bucket_1_30?.monto || 0),
            Number(semaforo.bucket_31_60?.monto || 0),
            Number(semaforo.bucket_61_90?.monto || 0),
            Number(semaforo.bucket_90_plus?.monto || 0)
        ];

        agingSemaphoreChart = new Chart(agingCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Monto vencido',
                    data: dataMontos,
                    backgroundColor: ['#22c55e', '#eab308', '#fb923c', '#ef4444'],
                    borderRadius: 8
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: value => '$' + Number(value).toLocaleString('en-US') }
                    },
                    y: { grid: { display: false } }
                }
            }
        });
    }
}

// Función para formatear fecha a DD/MM/YYYY
function formatearFechaADDMMYYYY(fechaStr) {
    if (!fechaStr) return '-';
    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) return fechaStr;
    const day = String(fecha.getDate()).padStart(2, '0');
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const year = fecha.getFullYear();
    return `${day}/${month}/${year}`;
}

// Función para actualizar tabla de facturas
function actualizarTablaFacturas() {
    const tbody = document.querySelector('.facturas-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    facturas.forEach(factura => {
        const row = document.createElement('tr');
        if (factura.uuid) row.dataset.facturaUuid = factura.uuid;
        const esComplementoPago = Boolean(factura?.es_complemento_pago)
            || String(factura?.uso_cfdi || '').toUpperCase() === 'CP01'
            || String(factura?.folio || '').toUpperCase().startsWith('P-');

        const esBorrador = factura.estado === 'BORRADOR' || esUuidBorradorFactura(factura.uuid);
        const badgeEstado = mapearEstadoFacturaBadge(factura.estado, factura.metodo_pago);
        const estadoClass = badgeEstado.estadoClass;
        const estadoTexto = badgeEstado.estadoTexto;

        row.innerHTML = `
            <td>
                <div class="folio-number">${factura.folio || 'S/F'}</div>
                ${esComplementoPago ? `
                    <div style="margin-top:6px;">
                        <span class="badge badge-timbrado" style="font-size:0.72rem; padding:4px 8px;">COMPLEMENTO PAGO</span>
                    </div>
                ` : ''}
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: #888;">${factura.uuid ? factura.uuid.substring(0, 4) + '...' + factura.uuid.substring(factura.uuid.length - 4) : 'No timbrado'}</span>
                    ${factura.uuid ? `
                        <button type="button"
                            class="btn-copiar-uuid"
                            data-uuid="${factura.uuid}"
                            title="Copiar UUID"
                            aria-label="Copiar UUID"
                            style="background:none; border:none; padding:4px; color:#2979ff; cursor:pointer; font-size:0.9em;">
                            <i class="fa fa-copy"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="background: #2979ff; color: #fff; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85em;">
                        ${(factura.cliente?.nombre || 'C').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <strong style="display: block; color: #333;">${factura.cliente?.nombre || 'Cliente Desconocido'}</strong>
                        <small style="color: #888;">${factura.cliente?.rfc || 'RFC no disponible'}</small>
                    </div>
                </div>
            </td>
            <td>
                <span style="color: #555;">${formatearFechaADDMMYYYY(factura.fechas?.emision) || '-'}</span>
            </td>
            <td>
                <span class="badge badge-pue">${factura.metodo_pago || 'PUE'}</span>
            </td>
            <td>
                <span style="color: #555; font-size: 0.9em; font-weight: 500;">${factura.responsable_nombre || 'N/A'}</span>
            </td>
            <td>
                <span class="badge ${estadoClass}">${estadoTexto}</span>
            </td>
            <td>
                <strong style="color: #333;">$${Number(esComplementoPago ? factura.complemento_monto || 0 : factura.monto || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong><br>
                <small style="color: #888;">MXN${esComplementoPago ? ' (abono)' : ''}</small>
            </td>
            <td class="text-right">
                <div class="dropdown">
                    <button class="btn-icon" onclick="alternarMenuFactura(event, this)" style="background:none; border:none; color:#888; cursor:pointer; padding: 8px;">
                        <i class="fa fa-ellipsis-v"></i>
                    </button>
                    <div class="actions-menu">
                        ${esBorrador ? `
                        <a href="#" onclick="continuarBorradorFactura(${factura.id_factura}); return false;">
                            <i class="fa fa-pen" style="color: #2979ff;"></i> Continuar borrador
                        </a>
                        ` : `
                        <a href="#" onclick="verFactura('${factura.uuid}')">
                            <i class="fa fa-eye" style="color: #2979ff;"></i> Ver Detalle
                        </a>
                        <a href="#" onclick="descargarPDF('${factura.uuid}')">
                            <i class="fa fa-file-pdf" style="color: #f44336;"></i> Descargar PDF
                        </a>
                        <a href="#" onclick="cancelarFacturaWeb(event, '${factura.uuid}')" style="color: #d32f2f;">
                            <i class="fa fa-ban"></i> Cancelar Fiscal
                        </a>
                        `}
                    </div>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// Lógica para el toggle del menú
// Copia el UUID completo de una factura al portapapeles.
async function copiarUuidFactura(uuid, boton) {
    if (!uuid) return;

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(uuid);
        } else {
            const inputTemporal = document.createElement('textarea');
            inputTemporal.value = uuid;
            inputTemporal.setAttribute('readonly', '');
            inputTemporal.style.position = 'fixed';
            inputTemporal.style.left = '-9999px';
            document.body.appendChild(inputTemporal);
            inputTemporal.select();
            document.execCommand('copy');
            document.body.removeChild(inputTemporal);
        }

        if (boton) {
            const icono = boton.querySelector('i');
            const colorOriginal = boton.style.color;
            if (icono) icono.className = 'fa fa-check';
            boton.style.color = '#16a34a';
            setTimeout(() => {
                if (icono) icono.className = 'fa fa-copy';
                boton.style.color = colorOriginal || '#2979ff';
            }, 1200);
        }

        if (window.Swal) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'UUID copiado',
                showConfirmButton: false,
                timer: 1400
            });
        }
    } catch (error) {
        console.error('Error copiando UUID:', error);
        if (window.Swal) {
            Swal.fire('No se pudo copiar', 'Selecciona el UUID manualmente e intenta de nuevo.', 'error');
        }
    }
}

document.addEventListener('click', (event) => {
    const boton = event.target.closest('.btn-copiar-uuid');
    if (!boton) return;
    event.preventDefault();
    event.stopPropagation();
    copiarUuidFactura(boton.dataset.uuid, boton);
});

function alternarMenuFactura(event, btn) {
    event.stopPropagation();
    const dropdown = btn.closest('.dropdown');

    // Cerrar otros abiertos
    document.querySelectorAll('.dropdown.active').forEach(d => {
        if (d !== dropdown) d.classList.remove('active');
    });

    dropdown.classList.toggle('active');
}

// Cerrar menús al hacer clic fuera
document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown.active').forEach(d => d.classList.remove('active'));
});

// Función para descargar PDF
async function descargarPDF(uuid) {
    const token = localStorage.getItem('token');
    const url = `/api/facturas/${uuid}/pdf?token=${token}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `FACTURA-${uuid}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}


// --- Cancelación fiscal (modal SAT) ---
let cancelacionFacturaUuidActivo = null;
const REGEX_UUID_SAT = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function cancelarFacturaWeb(eventOrUuid, uuidMaybe) {
    let uuid;
    if (typeof eventOrUuid === 'string') {
        uuid = eventOrUuid;
    } else {
        if (eventOrUuid) {
            eventOrUuid.preventDefault();
            eventOrUuid.stopPropagation();
        }
        uuid = uuidMaybe;
    }
    if (!uuid) return;
    abrirModalCancelarFactura(uuid);
}

function abrirModalCancelarFactura(uuid) {
    cancelacionFacturaUuidActivo = uuid;
    const factura = facturas.find(f => f.uuid === uuid)
        || facturasCompletas.find(f => f.uuid === uuid)
        || {};

    const modal = document.getElementById('cancelar-factura-modal');
    const folioEl = document.getElementById('cancelar-factura-folio');
    const uuidEl = document.getElementById('cancelar-factura-uuid-display');
    const motivoEl = document.getElementById('cancelar-factura-motivo');
    const sustInput = document.getElementById('cancelar-factura-uuid-sustitucion');
    const apiError = document.getElementById('cancelar-factura-api-error');
    const acuseWrap = document.getElementById('cancelar-factura-acuse-wrap');

    if (!modal) return;

    if (folioEl) folioEl.textContent = factura.folio || 'S/F';
    if (uuidEl) uuidEl.textContent = uuid;
    if (motivoEl) motivoEl.value = '';
    if (sustInput) sustInput.value = '';
    if (apiError) {
        apiError.textContent = '';
        apiError.classList.remove('visible');
    }
    if (acuseWrap) acuseWrap.style.display = 'none';
    ocultarErrorUuidSustitucion();
    alternarCampoUuidSustitucionCancelacion('');

    modal.style.display = 'flex';
    document.querySelectorAll('.dropdown.active').forEach(d => d.classList.remove('active'));
}

function cerrarModalCancelarFactura() {
    const modal = document.getElementById('cancelar-factura-modal');
    if (modal) modal.style.display = 'none';
    cancelacionFacturaUuidActivo = null;
    const btn = document.getElementById('btn-confirmar-cancelar-factura');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-ban"></i> Cancelar factura';
    }
}

function alternarCampoUuidSustitucionCancelacion(motivo) {
    const wrap = document.getElementById('cancelar-factura-uuid-sust-wrap');
    const input = document.getElementById('cancelar-factura-uuid-sustitucion');
    if (!wrap || !input) return;

    if (motivo === '01') {
        wrap.style.display = 'block';
        input.required = true;
    } else {
        wrap.style.display = 'none';
        input.required = false;
        input.value = '';
        ocultarErrorUuidSustitucion();
    }
}

function mostrarErrorUuidSustitucion() {
    const err = document.getElementById('cancelar-factura-uuid-sust-error');
    if (err) err.classList.add('visible');
    const input = document.getElementById('cancelar-factura-uuid-sustitucion');
    if (input) input.style.borderColor = '#d32f2f';
}

function ocultarErrorUuidSustitucion() {
    const err = document.getElementById('cancelar-factura-uuid-sust-error');
    if (err) err.classList.remove('visible');
    const input = document.getElementById('cancelar-factura-uuid-sustitucion');
    if (input) input.style.borderColor = '#e3e8ef';
}

function mostrarErrorApiCancelacion(mensaje) {
    const apiError = document.getElementById('cancelar-factura-api-error');
    if (!apiError) return;
    apiError.textContent = mensaje || 'No se pudo cancelar la factura';
    apiError.classList.add('visible');
}

function interpretarEstadoRespuestaCancelacion(result) {
    const raw = (
        result?.data?.status
        || result?.data?.estado
        || result?.status
        || ''
    ).toString().toLowerCase();

    if (/cancel/.test(raw)) {
        return { badgeClass: 'badge-cancelado', texto: 'CANCELADO', ambiguo: false };
    }
    if (/proceso|pending|pendiente/.test(raw)) {
        return { badgeClass: 'badge-pendiente', texto: 'CANCELACIÓN EN PROCESO', ambiguo: false };
    }
    return { badgeClass: 'badge-warning', texto: 'VERIFICA EN SAT', ambiguo: true };
}

function actualizarBadgeFacturaEnHistorial(uuid, result) {
    const estado = interpretarEstadoRespuestaCancelacion(result);
    const row = document.querySelector(`tr[data-factura-uuid="${uuid}"]`);
    if (!row) return estado;

    const badge = row.querySelector('td .badge');
    if (badge) {
        badge.className = `badge ${estado.badgeClass}`;
        badge.textContent = estado.texto;
    }

    const facturaLocal = facturas.find(f => f.uuid === uuid);
    if (facturaLocal) {
        facturaLocal.estado = estado.texto === 'CANCELACIÓN EN PROCESO' ? 'PENDIENTE' : 'CANCELADA';
    }
    const facturaCompleta = facturasCompletas.find(f => f.uuid === uuid);
    if (facturaCompleta) {
        facturaCompleta.estado = facturaLocal?.estado || 'CANCELADA';
    }

    return estado;
}

function extraerUrlAcuseCancelacion(result) {
    return result?.data?.acuseUrl
        || result?.data?.acuse_url
        || result?.data?.acuse
        || result?.acuseUrl
        || null;
}

function validarFormularioCancelacionFactura() {
    const motivo = document.getElementById('cancelar-factura-motivo')?.value?.trim();
    const apiError = document.getElementById('cancelar-factura-api-error');
    if (apiError) {
        apiError.textContent = '';
        apiError.classList.remove('visible');
    }

    if (!motivo) {
        mostrarErrorApiCancelacion('Selecciona el motivo de cancelación.');
        return null;
    }

    let uuidSustitucion;
    if (motivo === '01') {
        uuidSustitucion = document.getElementById('cancelar-factura-uuid-sustitucion')?.value?.trim() || '';
        if (!uuidSustitucion) {
            mostrarErrorUuidSustitucion();
            mostrarErrorApiCancelacion('El UUID de factura sustitución es obligatorio para el motivo 01.');
            return null;
        }
        if (!REGEX_UUID_SAT.test(uuidSustitucion)) {
            mostrarErrorUuidSustitucion();
            return null;
        }
        ocultarErrorUuidSustitucion();
    } else {
        ocultarErrorUuidSustitucion();
    }

    return { motivo, uuidSustitucion };
}

async function enviarCancelacionFactura(event) {
    event.preventDefault();
    const uuid = cancelacionFacturaUuidActivo;
    if (!uuid) return;

    const datos = validarFormularioCancelacionFactura();
    if (!datos) return;

    const btn = document.getElementById('btn-confirmar-cancelar-factura');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Cancelando...';
    }

    try {
        const token = localStorage.getItem('token');
        const payload = { motivo: datos.motivo };
        if (datos.motivo === '01' && datos.uuidSustitucion) {
            payload.uuidSustitucion = datos.uuidSustitucion;
        }

        const response = await fetch(`/api/facturas/${uuid}/cancelar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            mostrarErrorApiCancelacion(result.error || result.message || 'No se pudo cancelar la factura');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa fa-ban"></i> Cancelar factura';
            }
            return;
        }

        cerrarModalCancelarFactura();
        const estadoUi = actualizarBadgeFacturaEnHistorial(uuid, result);

        const acuseUrl = extraerUrlAcuseCancelacion(result);
        let mensajeHtml = 'Factura cancelada. Obtén tu acuse de cancelación.';
        if (estadoUi.ambiguo) {
            mensajeHtml += '<br><small>Verifica el estatus en el SAT.</small>';
        }
        if (acuseUrl) {
            mensajeHtml += `<br><a href="${acuseUrl}" target="_blank" rel="noopener noreferrer" style="color:#2979ff;font-weight:600;">Descargar acuse de cancelación</a>`;
        }

        if (window.Swal) {
            Swal.fire({
                icon: 'success',
                title: estadoUi.texto === 'CANCELACIÓN EN PROCESO' ? 'Cancelación en proceso' : 'Factura cancelada',
                html: mensajeHtml,
                confirmButtonColor: '#2979ff'
            });
        }
    } catch (error) {
        console.error('Error en enviarCancelacionFactura:', error);
        mostrarErrorApiCancelacion('Ocurrió un error al procesar la cancelación.');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa fa-ban"></i> Cancelar factura';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const motivoSelect = document.getElementById('cancelar-factura-motivo');
    if (motivoSelect) {
        motivoSelect.addEventListener('change', (e) => {
            alternarCampoUuidSustitucionCancelacion(e.target.value);
        });
    }

    const sustInput = document.getElementById('cancelar-factura-uuid-sustitucion');
    if (sustInput) {
        sustInput.addEventListener('input', () => {
            if (REGEX_UUID_SAT.test(sustInput.value.trim())) {
                ocultarErrorUuidSustitucion();
            }
        });
    }

    const modal = document.getElementById('cancelar-factura-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) cerrarModalCancelarFactura();
        });
    }
});

// Función para ver factura
function verFactura(uuid) {
    // Abrir modal para enviar factura por email
    abrirModalEmail(uuid);
}

// Función para abrir modal de email
// Función para abrir modal de email
async function abrirModalEmail(uuid) {
    facturaActual = uuid;
    const modal = document.getElementById('email-modal');
    if (modal) modal.style.display = 'flex';

    cargarVistaPreviaPDF(uuid);

    // Cargar datos de la factura para el template
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/facturas/${uuid}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const res = await response.json();
            if (res.success) {
                const f = res.data;
                const emisorNombre = document.getElementById('timb-emisor-nombre')?.textContent || 'Andamios Torres';
                const clienteNombre = f.cliente_nombre || 'Cliente';
                const folio = f.folio || uuid.substring(0, 8);
                const total = parseFloat(f.total).toFixed(2);

                // Calcular vencimiento basado en dias_credito del cliente (fallback a 30)
                const diasCredito = parseInt(f.dias_credito || 30);
                const fechaEmision = new Date(f.fecha_emision);
                const fechaVencimiento = new Date(fechaEmision);
                fechaVencimiento.setDate(fechaVencimiento.getDate() + diasCredito);

                const vencimientoStr = fechaVencimiento.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
                const mesActual = fechaEmision.toLocaleDateString('es-MX', { month: 'long' });

                const esPPD = String(f.metodo_pago).toUpperCase() === 'PPD';

                let recordatorioPago = '';
                if (esPPD) {
                    recordatorioPago = `Le recordamos que la fecha límite de pago es el día ${vencimientoStr} (${diasCredito} días de crédito). Agradeceríamos que, una vez realizado el movimiento, nos enviara el comprobante de pago para nuestros registros.`;
                } else {
                    recordatorioPago = `Le informamos que esta factura ha sido liquidada en una sola exhibición. Adjuntamos el comprobante para sus registros y control interno.`;
                }

                const template = `Asunto: Factura ${folio} - ${emisorNombre} - ${mesActual}

Estimado/a ${clienteNombre}:

Espero que este mensaje le encuentre bien.

Adjunto a este correo encontrará la factura ${folio} por un monto de $${total}, correspondiente a los servicios de ${f.uso_cfdi || 'Servicios'} prestados recientemente.

${recordatorioPago}

Quedo a su entera disposición para cualquier duda o aclaración.

Atentamente,

Administración
${emisorNombre}`;

                const msgInput = document.getElementById('mensaje-email');
                if (msgInput) msgInput.value = template;

                const asuntoInput = document.getElementById('asunto-email');
                if (asuntoInput) asuntoInput.value = `Factura ${folio} - ${emisorNombre}`;

                // Pre-fill email if available in response (some endpoints return it)
                const emailInput = document.getElementById('email-cliente');
                if (emailInput && !emailInput.value && f.cliente_email) {
                    emailInput.value = f.cliente_email;
                }
            }
        }
    } catch (e) {
        console.error("Error cargando datos para template email:", e);
    }
}

// Función para cargar preview del PDF
async function cargarVistaPreviaPDF(uuid) {
    const token = localStorage.getItem('token');
    const url = `/api/facturas/${uuid}/pdf?inline=true&token=${token}&t=${Date.now()}`;
    const iframe = document.getElementById('pdf-preview');
    if (iframe) {
        iframe.src = url + '#toolbar=1&navpanes=0&view=FitH';
    }
}

// Función para enviar factura por email
async function enviarFacturaPorEmail() {
    const email = document.getElementById('email-cliente').value.trim();
    if (!email) {
        alert('Por favor ingresa el correo del cliente');
        return;
    }

    if (!facturaActual) {
        alert('Error: No se ha seleccionado una factura');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const mensaje = document.getElementById('mensaje-email').value;
        const asunto = document.getElementById('asunto-email').value;

        const response = await fetch(`/api/facturas/${facturaActual}/enviar-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                destinatario: email,
                mensaje: mensaje,
                asunto: asunto
            })
        });

        if (response.ok) {
            alert('Factura enviada exitosamente');
            cerrarModalEmail();
        } else {
            const error = await response.text();
            alert('Error enviando factura: ' + error);
        }
    } catch (error) {
        console.error('Error enviando factura:', error);
        alert('Error enviando factura');
    }
}

// Función para cerrar modal de email
function cerrarModalEmail() {
    document.getElementById('email-modal').style.display = 'none';
    document.getElementById('email-cliente').value = '';
    document.getElementById('asunto-email').value = 'Factura Electrónica - Andamios Torres';
    document.getElementById('mensaje-email').value = '';
    facturaActual = null;
}

// Configurar eventos del modal
function configurarModal() {
    const modal = document.getElementById('nueva-factura-modal');
    const closeBtn = document.getElementById('close-nueva-factura-modal');

    // Cerrar modal con X
    closeBtn.onclick = function () {
        modal.style.display = 'none';
        limpiarFormulario();
    };

    // Cerrar modal haciendo clic fuera
    modal.onclick = function (e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            limpiarFormulario();
        }
    };

    // Cerrar modal con Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            limpiarFormulario();
        }
    });
}

// Configurar eventos del formulario
function configurarFormulario() {
    const form = document.getElementById('formEmitirFactura');
    const agregarBtn = document.getElementById('agregarConcepto');

    if (agregarBtn) {
        agregarBtn.addEventListener('click', agregarConcepto);
    }

    if (form) {
        form.addEventListener('submit', enviarFactura);
    }

    // Eventos para cálculos automáticos en la tabla de conceptos del modal
    document.addEventListener('input', function (e) {
        if (e.target.matches('input[type="number"]')) {
            // Si el input está dentro del modal vieja escuela, usar actualizarTotales
            if (e.target.closest('#nueva-factura-modal')) {
                actualizarTotales();
            } else {
                actualizarTotalesTimbrado();
            }
        }
    });

    // Evento para abrir modal de pago desde el botón
    const btnPago = document.getElementById('btn-abrir-pago');
    if (btnPago) {
        btnPago.addEventListener('click', function () {
            console.log('Clic detectado en btn-abrir-pago');
            abrirModalPago();
        });
    } else {
        console.error('No se encontró el botón btn-abrir-pago');
    }

    // Toggle manual de IVA
    const checkboxIva = document.getElementById('timb-aplica-iva');
    if (checkboxIva) {
        // Inicializar variable global con el estado del checkbox
        aplicaIvaFiscal = checkboxIva.checked;
        checkboxIva.addEventListener('change', function () {
            aplicaIvaFiscal = this.checked;
            console.log('[DEBUG] IVA manual toggle:', aplicaIvaFiscal);
            actualizarTotalesTimbrado();
        });
    }
}

// Función para abrir modal
function abrirModalFactura() {
    document.getElementById('nueva-factura-modal').style.display = 'flex';
    // Agregar primer concepto automáticamente
    if (conceptos.length === 0) {
        agregarConcepto();
    }
}

// Función para agregar concepto
function agregarConcepto() {
    contadorConceptos++;
    const conceptoId = `concepto-${contadorConceptos}`;

    const conceptoHTML = `
        <div id="${conceptoId}" class="concepto-row" style="background:#f7f9fb;padding:16px;border-radius:8px;margin-bottom:12px;border:1px solid #e3e8ef;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <h5 style="margin:0;font-size:1rem;font-weight:600;color:#232323;">Concepto ${contadorConceptos}</h5>
                <button type="button" onclick="eliminarConcepto('${conceptoId}')" 
                        style="background:#ffebee;color:#f44336;border:none;border-radius:6px;padding:4px 8px;font-size:0.8rem;cursor:pointer;">
                    <i class="fa fa-trash"></i> Eliminar
                </button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">Clave Producto/Servicio</label>
                    <select class="clave-producto" required 
                            style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;">
                        <option value="">Selecciona...</option>
                        <option value="84111506">84111506 - Servicios de arrendamiento de andamios</option>
                        <option value="84111507">84111507 - Servicios de arrendamiento de escaleras</option>
                        <option value="84111508">84111508 - Servicios de arrendamiento de plataformas</option>
                        <option value="72141700">72141700 - Servicios de arrendamiento de equipos de construcción</option>
                    </select>
                </div>
                <div>
                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">No. Identificación</label>
                    <input type="text" class="no-identificacion" placeholder="Opcional"
                           style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;" />
                </div>
                <div>
                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">Cantidad</label>
                    <input type="number" class="cantidad" required min="1" step="1" value="1"
                           style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;" />
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">Clave Unidad</label>
                    <select class="clave-unidad" required 
                            style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;">
                        <option value="">Selecciona...</option>
                        <option value="E48">E48 - Unidad de servicio</option>
                        <option value="H87">H87 - Pieza</option>
                        <option value="DAY">DAY - Día</option>
                        <option value="MON">MON - Mes</option>
                    </select>
                </div>
                <div>
                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">Valor Unitario</label>
                    <input type="number" class="valor-unitario" required min="0" step="0.01" placeholder="0.00"
                           style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;" />
                </div>
                <div>
                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">Importe</label>
                    <input type="number" class="importe" readonly
                           style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;background:#f1f5f9;" />
                </div>
            </div>
            <div>
                <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">Descripción</label>
                <textarea class="descripcion" required placeholder="Descripción del concepto..."
                          style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;resize:vertical;min-height:60px;"></textarea>
            </div>
        </div>
    `;

    document.getElementById('conceptosContainer').insertAdjacentHTML('beforeend', conceptoHTML);

    // Configurar eventos para cálculos automáticos
    const conceptoDiv = document.getElementById(conceptoId);
    const cantidadInput = conceptoDiv.querySelector('.cantidad');
    const valorUnitarioInput = conceptoDiv.querySelector('.valor-unitario');
    const importeInput = conceptoDiv.querySelector('.importe');

    function calcularImporte() {
        const cantidad = parseFloat(cantidadInput.value) || 0;
        const valorUnitario = parseFloat(valorUnitarioInput.value) || 0;
        const importe = cantidad * valorUnitario;
        importeInput.value = importe.toFixed(2);
        actualizarTotales();
    }

    cantidadInput.addEventListener('input', calcularImporte);
    valorUnitarioInput.addEventListener('input', calcularImporte);

    conceptos.push(conceptoId);
}

// Función para eliminar concepto
function eliminarConcepto(conceptoId) {
    const conceptoDiv = document.getElementById(conceptoId);
    if (conceptoDiv) {
        conceptoDiv.remove();
        conceptos = conceptos.filter(id => id !== conceptoId);
        actualizarTotales();
    }
}

// Función para actualizar totales
function actualizarTotales() {
    let subtotal = 0;

    conceptos.forEach(conceptoId => {
        const conceptoDiv = document.getElementById(conceptoId);
        if (conceptoDiv) {
            const importeInput = conceptoDiv.querySelector('.importe');
            const importe = parseFloat(importeInput.value) || 0;
            subtotal += importe;
        }
    });

    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('iva').textContent = `$${iva.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
}

// Función para enviar factura
async function enviarFactura(e) {
    e.preventDefault();

    // Validar datos del receptor
    const receptorRfc = document.getElementById('receptorRfc').value.trim();
    const receptorNombre = document.getElementById('receptorNombre').value.trim();
    const receptorRegimenFiscal = document.getElementById('receptorRegimenFiscal').value;
    const receptorCp = document.getElementById('receptorCp').value.trim();
    const usoCfdi = document.getElementById('usoCfdi').value;
    const formaPago = document.getElementById('formaPago').value;
    const metodoPago = document.getElementById('metodoPago').value;

    if (!receptorRfc || !receptorNombre || !receptorRegimenFiscal || !receptorCp || !usoCfdi || !formaPago || !metodoPago) {
        mostrarMensaje('Por favor completa todos los campos del receptor', 'error');
        return;
    }

    // Validar que haya al menos un concepto
    if (conceptos.length === 0) {
        mostrarMensaje('Debes agregar al menos un concepto', 'error');
        return;
    }

    // Validar conceptos
    for (let conceptoId of conceptos) {
        const conceptoDiv = document.getElementById(conceptoId);
        if (conceptoDiv) {
            const claveProducto = conceptoDiv.querySelector('.clave-producto').value;
            const cantidad = conceptoDiv.querySelector('.cantidad').value;
            const claveUnidad = conceptoDiv.querySelector('.clave-unidad').value;
            const valorUnitario = conceptoDiv.querySelector('.valor-unitario').value;
            const descripcion = conceptoDiv.querySelector('.descripcion').value.trim();

            if (!claveProducto || !cantidad || !claveUnidad || !valorUnitario || !descripcion) {
                mostrarMensaje('Por favor completa todos los campos de los conceptos', 'error');
                return;
            }
        }
    }

    // Preparar datos de la factura
    const facturaData = {
        receptor: {
            rfc: receptorRfc,
            nombre: receptorNombre,
            regimenFiscal: receptorRegimenFiscal,
            codigoPostal: receptorCp,
            usoCfdi: usoCfdi
        },
        factura: {
            formaPago: formaPago,
            metodoPago: metodoPago
        },
        conceptos: conceptos.map(conceptoId => {
            const conceptoDiv = document.getElementById(conceptoId);
            return {
                claveProductoServicio: conceptoDiv.querySelector('.clave-producto').value,
                noIdentificacion: conceptoDiv.querySelector('.no-identificacion').value,
                cantidad: parseFloat(conceptoDiv.querySelector('.cantidad').value),
                claveUnidad: conceptoDiv.querySelector('.clave-unidad').value,
                valorUnitario: parseFloat(conceptoDiv.querySelector('.valor-unitario').value),
                descripcion: conceptoDiv.querySelector('.descripcion').value
            };
        })
    };

    // Regla de crédito: PPD siempre se emite con forma de pago 99 (Por definir).
    if (String(facturaData.factura.metodoPago || '').toUpperCase() === 'PPD') {
        facturaData.factura.formaPago = '99';
    }

    try {
        mostrarMensaje('Procesando factura...', 'info');

        const token = localStorage.getItem('token');
        const response = await fetch('/api/facturas/timbrar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(facturaData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            mostrarMensaje('Factura timbrada exitosamente. Descargando PDF...', 'success');

            // Descargar PDF automáticamente
            setTimeout(async () => {
                try {
                    const pdfResponse = await fetch(`/api/facturas/${result.data.uuid}/pdf`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (pdfResponse.ok) {
                        const blob = await pdfResponse.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `FACTURA-${result.data.uuid}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);

                        mostrarMensaje('PDF descargado exitosamente', 'success');
                    } else {
                        console.error('Error descargando PDF');
                        mostrarMensaje('Factura timbrada pero error al descargar PDF', 'error');
                    }
                } catch (pdfError) {
                    console.error('Error descargando PDF:', pdfError);
                    mostrarMensaje('Factura timbrada pero error al descargar PDF', 'error');
                }
            }, 1000);

            // Recargar datos de facturas
            await cargarFacturas();

            // Cerrar modal después de 3 segundos
            setTimeout(() => {
                document.getElementById('nueva-factura-modal').style.display = 'none';
                limpiarFormulario();
            }, 3000);
        } else {
            mostrarMensaje(result.error || 'Error al timbrar la factura', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error de conexión con el servidor', 'error');
    }
}

// Función para mostrar mensajes
function mostrarMensaje(mensaje, tipo) {
    const mensajeDiv = document.getElementById('mensajeFacturacion');
    mensajeDiv.textContent = mensaje;
    mensajeDiv.style.color = tipo === 'success' ? '#43a047' : tipo === 'error' ? '#f44336' : '#2979ff';
}

// Función para resetear formulario
function limpiarFormulario() {
    document.getElementById('formEmitirFactura').reset();
    conceptos = [];
    contadorConceptos = 0;
    document.getElementById('conceptosContainer').innerHTML = '';
    document.getElementById('subtotal').textContent = '$0.00';
    document.getElementById('iva').textContent = '$0.00';
    document.getElementById('total').textContent = '$0.00';
    document.getElementById('mensajeFacturacion').textContent = '';
}

// === FUNCIONES PARA LA SECCIÓN DE TIMBRADO ===

// Función para buscar documento o equipo
async function buscarDocumento() {
    const queryValue = document.getElementById('search-documento').value.trim();
    if (!queryValue) {
        Swal.fire('Error', 'Ingresa un folio, clave de equipo o nombre de cliente', 'error');
        return;
    }

    try {
        Swal.fire({
            title: 'Buscando...',
            didOpen: () => { Swal.showLoading(); }
        });

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/facturas/search-document/${queryValue}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        Swal.close();

        if (response.ok && result.success) {
            await renderizarDatosDocumento(result);
        } else {
            Swal.fire('No encontrado', result.error || 'No se encontró el documento o cliente', 'warning');
        }
    } catch (error) {
        console.error('Error en buscarDocumento:', error);
        Swal.fire('Error', 'Ocurrió un error al buscar el documento', 'error');
    }
}

// --- LÓGICA DE BÚSQUEDA EN TIEMPO REAL (PHASE 3) ---


const buscarclientefiscal = crearDebounce(async (valor) => {
    const resultsContainer = document.getElementById('search-results-timb');
    const valorTrim = valor.trim();

    if (valorTrim.length < 3) {
        resultsContainer.style.display = 'none';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/facturas/search-document/${encodeURIComponent(valorTrim)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Si es una cotización directa o equipo con éxito total, cerrar lista y renderizar
            if (result.type !== 'CLIENTE' && result.type !== 'RENTA') {
                // Para VEN o Claves exactas, tal vez no queremos autocompletado sino acción directa
                // Pero aquí seguiremos el flujo de autocompletado si el usuario lo pide
            }

            mostrarResultadosAutocomplete(result);
        } else {
            resultsContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Error en buscarclientefiscal:', error);
    }
}, 300);

function mostrarResultadosAutocomplete(data) {
    const container = document.getElementById('search-results-timb');
    container.innerHTML = '';

    // 1. Si es Cotización o Equipo (Resultado Directo)
    if (data.type === 'VENTA' || data.type === 'RENTA') {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        const title = data.type === 'VENTA' ? `Cotización: ${document.getElementById('search-documento').value}` : `Equipo: ${document.getElementById('search-documento').value}`;
        div.innerHTML = `
            <span class="client-title">${title}</span>
            <span class="client-info">Contiene conceptos y datos vinculados. Haz clic para cargar.</span>
        `;
        div.onclick = async () => {
            await renderizarDatosDocumento(data);
            container.style.display = 'none';
        };
        container.appendChild(div);
    }
    // 2. Si es una lista de Clientes (Búsqueda por Nombre/RFC/ID)
    else if (data.type === 'CLIENTE_LIST' && data.clientes && data.clientes.length > 0) {
        data.clientes.forEach(cl => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `
                <span class="client-title">${cl.razon_social || cl.nombre}</span>
                <span class="client-info">RFC: ${cl.rfc || 'N/A'} | CP: ${cl.codigo_postal || 'N/A'}</span>
            `;
            div.onclick = async () => {
                document.getElementById('search-documento').value = cl.razon_social || cl.nombre;
                // Envolvemos el cliente en el formato esperado por renderizarDatosDocumento
                await renderizarDatosDocumento({ success: true, type: 'CLIENTE', cliente: cl });
                container.style.display = 'none';
            };
            container.appendChild(div);
        });
    }

    container.style.display = container.innerHTML ? 'block' : 'none';
}

// Cerrar resultados al hacer clic fuera
document.addEventListener('click', (e) => {
    const container = document.getElementById('search-results-timb');
    if (container) {
        const input = document.getElementById('search-documento');
        if (e.target !== container && e.target !== input) {
            container.style.display = 'none';
        }
    }
});

// Función para renderizar los datos en la sección de timbrado (REDISEÑADO)
async function renderizarDatosDocumento(data) {
    console.log('[DEBUG] renderizarDatosDocumento recibida:', JSON.stringify(data, null, 2));
    console.log('[DEBUG] data.type:', data.type);
    console.log('[DEBUG] data.cliente:', data.cliente);
    console.log('[DEBUG] data.cotizacion:', data.cotizacion);
    console.log('[DEBUG] data.cotizacion.id_cliente:', data.cotizacion?.id_cliente);
    console.log('[DEBUG] data.cotizacion.cliente:', data.cotizacion?.cliente);

    // Manejar cotizaciones: si es VENTA y tiene cotización, buscar el cliente en múltiples ubicaciones
    let cliente = data.cliente;

    if (data.type === 'VENTA' && data.cotizacion && !cliente) {
        // Intentar obtener cliente desde múltiples fuentes posibles
        cliente = data.cotizacion.cliente
            || data.cotizacion.receptor
            || data.cotizacion.cliente_data
            || data.cotizacion.cliente_info
            || data.cliente_asociado
            || null;

        console.log('[DEBUG] Buscando cliente en cotización:', cliente);
        console.log('[DEBUG] ID Cliente en cotización:', data.cotizacion.id_cliente);
        console.log('[DEBUG] Numero Cotización:', data.cotizacion.numero_cotizacion);

        // Si no hay cliente en los datos de cotización, intentar obtener del API con el número de cotización
        if (!cliente && data.cotizacion.numero_cotizacion) {
            console.log('[DEBUG] No hay cliente en datos, intentando obtener desde API usando número de cotización');
            const clienteObtenido = await obtenerClienteDelContrato(data.cotizacion.numero_cotizacion);
            if (clienteObtenido) {
                cliente = clienteObtenido;
                console.log('[DEBUG] Cliente obtenido del API:', cliente);
            }
        }

        // Si aún no hay cliente pero hay id_cliente, cargar desde API con ID
        if (!cliente && data.cotizacion.id_cliente) {
            console.log('[DEBUG] No hay cliente en datos, cargando desde API con ID:', data.cotizacion.id_cliente);
            await cargarClienteDesdeID(data.cotizacion.id_cliente, data.cotizacion);
            cliente = { id: data.cotizacion.id_cliente };
        }

        // Si aún no hay cliente, mostrar validación con SweetAlert
        if (!cliente) {
            console.warn('[WARN] Cotización sin cliente asociado');
            Swal.fire({
                icon: 'warning',
                title: '⚠️ Sin Cliente Asignado',
                html: `
                    <div style="text-align: left; padding: 20px; background: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0 0 15px 0; color: #333;">
                            <strong>Esta cotización no tiene un cliente asignado.</strong>
                        </p>
                        <p style="margin: 0 0 15px 0; color: #666; font-size: 0.95rem;">
                            Para continuar, <strong>debes seleccionar un cliente</strong> usando el botón <strong>"Cambiar Cliente"</strong> que aparece en la sección de Cliente.
                        </p>
                        <ul style="margin: 10px 0; padding-left: 20px; color: #666; font-size: 0.9rem;">
                            <li>Haz clic en el botón <strong style="color: #2979ff;">Cambiar Cliente</strong></li>
                            <li>Busca y selecciona el cliente requerido</li>
                            <li>Los datos se cargarán automáticamente</li>
                        </ul>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#f59e0b',
                allowOutsideClick: false,
                didOpen: () => {
                    // Mostrar sección de cliente
                    document.getElementById('timb-cliente-nombre').textContent = '⚠️ Sin cliente asignado';
                    document.getElementById('timb-cliente-direccion').textContent = 'Selecciona un cliente para continuar';
                    document.getElementById('timb-cliente-nombre').style.color = '#f59e0b';
                }
            });
        } else if (cliente) {
            // Si tenemos cliente, rellenar los datos
            rellenarDatosCliente(cliente);
        } else if (data.type === 'CLIENTE' && cliente) {
            // Si es un cliente directo (no cotización)
            rellenarDatosCliente(cliente);
        } else if (!cliente) {
            // Si no hay cliente, limpiar los campos
            const nombreField = document.getElementById('timb-cliente-nombre');
            const direccionField = document.getElementById('timb-cliente-direccion');
            const btnEdit = document.getElementById('btn-editar-cliente-rapido');

            nombreField.textContent = 'Selecciona un cliente...';
            direccionField.textContent = '-';
            if (btnEdit) btnEdit.style.display = 'none';

            // Reset fields
            document.getElementById('timb-cliente-rfc').value = '';
            document.getElementById('timb-cliente-cp').value = '';
            document.getElementById('timb-cliente-regimen').value = '';
            document.getElementById('timb-cliente-uso').value = 'G03';
            document.getElementById('timb-cliente-colonia').value = '';
            document.getElementById('timb-cliente-localidad').value = '';
            document.getElementById('timb-cliente-municipio').value = '';
            document.getElementById('timb-cliente-estado').value = '';
            document.getElementById('timb-cliente-pais').value = '';
            const idElem = document.getElementById('timb-cliente-id');
            if (idElem) idElem.value = '';

            const rfcDisplay = document.getElementById('timb-cliente-rfc-display');
            const regimenDisplay = document.getElementById('timb-cliente-regimen-display');
            if (rfcDisplay) rfcDisplay.textContent = '-';
            if (regimenDisplay) regimenDisplay.textContent = '-';
        }
    }

    // Gestionar vinculación con cotizaciones (NUEVO)
    const cotIdElem = document.getElementById('timb-cotizacion-id');
    const cotNumElem = document.getElementById('timb-cotizacion-numero');

    if (data.type === 'VENTA' && data.cotizacion) {
        if (cotIdElem) cotIdElem.value = data.cotizacion.id_cotizacion || data.cotizacion.id || '';
        if (cotNumElem) cotNumElem.value = data.cotizacion.numero_cotizacion || data.cotizacion.numero || '';
        console.log('[DEBUG-VINCULO] Cotización vinculada:', data.cotizacion.numero_cotizacion || data.cotizacion.numero);
    } else {
        if (cotIdElem) cotIdElem.value = '';
        if (cotNumElem) cotNumElem.value = '';
    }

    // Set fecha emisión hoy
    document.getElementById('timb-fecha-emision').value = new Date().toLocaleDateString();

    // 2. Limpiar y llenar la tabla de conceptos
    const tbody = document.getElementById('products-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        if (data.type === 'VENTA' && data.cotizacion) {
            // Si no hay cliente pero hay id_cliente en la cotización, intentar cargar el cliente
            if (!cliente && (data.cotizacion.id_cliente || data.cotizacion.id_receptor)) {
                cargarClienteDesdeID(data.cotizacion.id_cliente || data.cotizacion.id_receptor, data.cotizacion);
            }
            // Unificamos el flujo: Todo lo que es VENTA usa la función centralizada
            cargarConceptosDesdeCotizacion(data.cotizacion, 'VENTA');
        } else {
            // Fallback para otros tipos (RENTA/Equipo o búsqueda directa)
            if (data.conceptos && data.conceptos.length > 0) {
                data.conceptos.forEach(concepto => {
                    agregarFilaConcepto(concepto);
                });
            }
            actualizarTotalesTimbrado();
        }
    }
}


// Función para rellenar datos del cliente en la UI
function rellenarDatosCliente(cliente) {
    if (!cliente) return;

    console.log('[RELLENAR-CLIENTE] Rellenando datos del cliente:', cliente);

    // 1. Llenar los campos visibles del cliente
    const nombreField = document.getElementById('timb-cliente-nombre');
    const direccionField = document.getElementById('timb-cliente-direccion');

    nombreField.textContent = cliente.razon_social || cliente.nombre || 'Cliente';
    direccionField.textContent = cliente.direccion || 'Dirección no disponible';
    nombreField.style.color = '#1e293b'; // Remover color de advertencia

    console.log('[RELLENAR-CLIENTE] Nombre rellenado:', nombreField.textContent);
    console.log('[RELLENAR-CLIENTE] Dirección rellenada:', direccionField.textContent);

    // 2. Llenar datos ocultos
    document.getElementById('timb-cliente-rfc').value = cliente.rfc || cliente.fact_rfc || '';
    document.getElementById('timb-cliente-cp').value = cliente.codigo_postal || cliente.cp || '';
    document.getElementById('timb-cliente-regimen').value = cliente.regimen_fiscal || '';
    document.getElementById('timb-cliente-uso').value = cliente.uso_cfdi || 'G03';
    document.getElementById('timb-cliente-colonia').value = cliente.colonia || '';
    document.getElementById('timb-cliente-localidad').value = cliente.localidad || '';
    document.getElementById('timb-cliente-municipio').value = cliente.municipio || '';
    document.getElementById('timb-cliente-estado').value = cliente.estado || '';
    document.getElementById('timb-cliente-pais').value = cliente.pais || '';
    document.getElementById('timb-cliente-id').value = cliente.id_cliente || cliente.id || '';

    // 3. Actualizar display de RFC y Régimen
    const rfcDisplay = document.getElementById('timb-cliente-rfc-display');
    const regimenDisplay = document.getElementById('timb-cliente-regimen-display');
    if (rfcDisplay) {
        rfcDisplay.textContent = cliente.rfc || cliente.fact_rfc || '-';
        console.log('[RELLENAR-CLIENTE] RFC Display:', rfcDisplay.textContent);
    }
    if (regimenDisplay) {
        regimenDisplay.textContent = cliente.regimen_fiscal || '-';
        console.log('[RELLENAR-CLIENTE] Régimen Display:', regimenDisplay.textContent);
    }

    // 4. Mostrar botón de editar
    const btnEdit = document.getElementById('btn-editar-cliente-rapido');
    if (btnEdit) {
        btnEdit.style.display = 'block';
        console.log('[RELLENAR-CLIENTE] Botón editar mostrado');
    }

    console.log('[SUCCESS] Cliente rellenado completamente');
}

async function obtenerClienteDelContrato(numeroCotizacion) {
    try {
        console.log('[OBTENER-CLIENTE] Buscando cliente para cotización:', numeroCotizacion);
        const token = localStorage.getItem('token');

        // Intentar buscar nuevamente por documento/folio para obtener datos completos con cliente
        const response = await fetch(`/api/facturas/search-document/${encodeURIComponent(numeroCotizacion)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('[OBTENER-CLIENTE] Respuesta HTTP:', response.status);

        if (response.ok) {
            const result = await response.json();
            console.log('[OBTENER-CLIENTE] Resultado completo:', result);

            if (result.success && result.cliente) {
                console.log('[OBTENER-CLIENTE] Cliente encontrado en respuesta:', result.cliente);
                return result.cliente;
            }
        } else {
            console.warn('[OBTENER-CLIENTE] Respuesta no OK. Status:', response.status);
        }
    } catch (error) {
        console.error('[ERROR] Error obteniendo cliente de cotización:', error);
    }

    return null;
}

async function cargarClienteDesdeID(clienteID, cotizacion) {
    try {
        console.log('[CARGAR-CLIENTE] Iniciando carga de cliente con ID:', clienteID);
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/clientes/${clienteID}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('[CARGAR-CLIENTE] Respuesta HTTP:', response.status);

        if (response.ok) {
            const cliente = await response.json();
            console.log('[CARGAR-CLIENTE] Cliente cargado desde API:', cliente);

            // Llenar los campos del cliente
            const nombreField = document.getElementById('timb-cliente-nombre');
            const direccionField = document.getElementById('timb-cliente-direccion');

            nombreField.textContent = cliente.razon_social || cliente.nombre || 'Cliente';
            direccionField.textContent = cliente.direccion || 'Dirección no disponible';

            console.log('[CARGAR-CLIENTE] Nombre rellenado:', nombreField.textContent);
            console.log('[CARGAR-CLIENTE] Dirección rellenada:', direccionField.textContent);

            // Llenar datos ocultos
            document.getElementById('timb-cliente-rfc').value = cliente.rfc || cliente.fact_rfc || '';
            document.getElementById('timb-cliente-cp').value = cliente.codigo_postal || cliente.cp || '';
            document.getElementById('timb-cliente-regimen').value = cliente.regimen_fiscal || '';
            document.getElementById('timb-cliente-uso').value = cliente.uso_cfdi || 'G03';
            document.getElementById('timb-cliente-colonia').value = cliente.colonia || '';
            document.getElementById('timb-cliente-localidad').value = cliente.localidad || '';
            document.getElementById('timb-cliente-municipio').value = cliente.municipio || '';
            document.getElementById('timb-cliente-estado').value = cliente.estado || '';
            document.getElementById('timb-cliente-pais').value = cliente.pais || '';
            document.getElementById('timb-cliente-id').value = cliente.id_cliente || cliente.id || clienteID;

            // Actualizar display
            const rfcDisplay = document.getElementById('timb-cliente-rfc-display');
            const regimenDisplay = document.getElementById('timb-cliente-regimen-display');
            if (rfcDisplay) {
                rfcDisplay.textContent = cliente.rfc || cliente.fact_rfc || '-';
                console.log('[CARGAR-CLIENTE] RFC Display:', rfcDisplay.textContent);
            }
            if (regimenDisplay) {
                regimenDisplay.textContent = cliente.regimen_fiscal || '-';
                console.log('[CARGAR-CLIENTE] Régimen Display:', regimenDisplay.textContent);
            }

            // Mostrar botón de editar
            const btnEdit = document.getElementById('btn-editar-cliente-rapido');
            if (btnEdit) {
                btnEdit.style.display = 'block';
                console.log('[CARGAR-CLIENTE] Botón editar mostrado');
            }

            console.log('[SUCCESS] Cliente autorrellenado desde API');
        } else {
            console.warn('[CARGAR-CLIENTE] Respuesta no OK. Status:', response.status);
            const errorData = await response.json().catch(() => ({}));
            console.warn('[CARGAR-CLIENTE] Error response:', errorData);
        }
    } catch (error) {
        console.error('[ERROR] Error cargando cliente desde API:', error);
    }
}

// Búsqueda en tiempo real dentro del modal CONCEPTOS (PHASE 4)
const buscarConceptosModal = crearDebounce(async (valor, container) => {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/facturas/search-concepts/${encodeURIComponent(valor)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (response.ok && data.success && data.results.length > 0) {
            renderizarResultadosModal(data.results, container);
        } else {
            container.style.display = 'none';
        }
    } catch (error) {
        console.error('Error buscando conceptos en modal:', error);
    }
}, 300);

function renderizarResultadosModal(results, container) {
    container.innerHTML = '';
    results.forEach(res => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <span class="client-title">${res.title}</span>
            <span class="client-info">${res.info}</span>
        `;
        div.onclick = async () => {
            if (res.type === 'COTIZACION') {
                container.style.display = 'none';
                Swal.close();
                // Primero renderizar los datos (que incluye cliente) luego cargar conceptos
                await renderizarDatosDocumento({
                    type: 'VENTA',
                    cotizacion: res.data,
                    cliente: res.data.cliente || null
                });
            } else {
                // Producto o Servicio: Llenar campos del modal
                document.getElementById('swal-input-desc').value = res.title;
                document.getElementById('swal-input-sat').value = res.sat || '01010101';
                document.getElementById('swal-input-unidad').value = res.unidad || 'H87';
                document.getElementById('swal-input-price').value = res.price || 0;
                // Guardar peso en atributo data para recuperarlo al agregar
                document.getElementById('swal-input-desc').dataset.peso = res.peso || 0;
                window.recalcSwal();
                container.style.display = 'none';
            }
        };
        container.appendChild(div);
    });
    container.style.display = 'block';
}

// Función para abrir el modal de agregar concepto (SweetAlert2 - Imagen 2)
function abrirModalAgregarConcepto() {
    Swal.fire({
        title: '<i class="fa fa-info-circle"></i> Detalle del Servicio ó Producto',
        width: '850px',
        customClass: {
            container: 'swal2-high-z'
        },
        html: `
            <div style="text-align:left; padding:15px; overflow-x: hidden;">
                <label style="font-size:0.9rem; color:#6b7280;">Descripción (Búsqueda en tiempo real):</label>
                <div style="position:relative;">
                    <input id="swal-input-desc" class="swal2-input" placeholder="Escribe para buscar o ingresar manualmente..." 
                        style="margin:10px 0; width:95%;" autocomplete="off">
                    <div id="swal-results-container" class="search-results-list" style="display: none; width:95%;"></div>
                </div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:20px;">
                    <div>
                        <label style="font-size:0.8rem;">Clave SAT:</label>
                        <input id="swal-input-sat" class="swal2-input" value="01010101" style="margin:5px 0;">
                    </div>
                    <div>
                        <label style="font-size:0.8rem;">Clave Unidad:</label>
                        <input id="swal-input-unidad" class="swal2-input" value="H87" style="margin:5px 0;">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:10px; margin-top:15px;">
                    <div>
                        <label style="font-size:0.8rem;">Cantidad:</label>
                        <input id="swal-input-cant" type="number" value="1" class="swal2-input" style="margin:5px 0;" oninput="recalcSwal()">
                    </div>
                    <div>
                        <label style="font-size:0.8rem; font-weight:700; color:#1e3a8a;">Precio con IVA:</label>
                        <input id="swal-input-price" type="number" value="0" class="swal2-input" style="margin:5px 0; border-color:#2979ff;" oninput="recalcSwal()">
                    </div>
                    <div>
                        <label style="font-size:0.8rem; color:#10b981;">Neto SAT (÷1.16):</label>
                        <input id="swal-input-neto" type="number" value="0" class="swal2-input" style="margin:5px 0; background:#f0fdf4; color:#065f46; font-weight:700;" readonly>
                    </div>
                    <div>
                        <label style="font-size:0.8rem;">Total:</label>
                        <input id="swal-input-total" type="number" value="0" class="swal2-input" style="margin:5px 0; background:#f1f5f9;" readonly>
                    </div>
                </div>

                <div style="margin-top:15px;">
                    <label style="font-size:0.9rem; color:#6b7280;">Características del Producto (Opcional):</label>
                    <textarea id="swal-input-caracteristicas" class="swal2-textarea" placeholder="Ingrese las características del producto que aparecerán en el PDF..." 
                        style="margin:10px 0; width:95%; min-height:80px; resize:vertical; font-size:0.9rem; padding:10px;"></textarea>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa fa-plus"></i> Agregar',
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#43a047',
        didOpen: () => {
            const descInput = document.getElementById('swal-input-desc');
            const resultsContainer = document.getElementById('swal-results-container');

            // Auto recalc script: precio ingresado = precio CON IVA
            window.recalcSwal = () => {
                const c = parseFloat(document.getElementById('swal-input-cant').value) || 0;
                const p = parseFloat(document.getElementById('swal-input-price').value) || 0;
                // Neto SAT = precio con IVA / 1.16
                const neto = p / 1.16;
                const total = parseFloat((c * neto).toFixed(2));
                document.getElementById('swal-input-neto').value = neto.toFixed(2);
                document.getElementById('swal-input-total').value = total.toFixed(2);
            };

            // Evento de búsqueda para el input del modal
            descInput.addEventListener('input', (e) => {
                const valor = e.target.value.trim();
                if (valor.length < 2) {
                    resultsContainer.style.display = 'none';
                    return;
                }
                buscarConceptosModal(valor, resultsContainer);
            });
        },
        preConfirm: () => {
            const desc = document.getElementById('swal-input-desc').value;
            const cant = document.getElementById('swal-input-cant').value;
            const price = document.getElementById('swal-input-price').value;
            // swal-input-desc-val ya no existe en el modal (el usuario ingresa precio con IVA directamente)
            const sat = document.getElementById('swal-input-sat').value;
            const unidad = document.getElementById('swal-input-unidad').value;

            if (!desc || !cant || !price) {
                Swal.showValidationMessage('Por favor completa los campos obligatorios');
                return false;
            }

            return {
                descripcion: desc,
                cantidad: parseFloat(cant),
                // valorUnitario guardado como NETO (precio con IVA / 1.16)
                valorUnitario: parseFloat((parseFloat(price) / 1.16).toFixed(2)),
                descuento: 0,
                claveProductoServicio: sat,
                claveUnidad: unidad,
                peso: parseFloat(document.getElementById('swal-input-desc').dataset.peso) || 0,
                caracteristicas: document.getElementById('swal-input-caracteristicas').value.trim()
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            agregarFilaConcepto(result.value);
            actualizarTotalesTimbrado();
        }
    });
}



// Función para mostrar/ocultar columna de descuentos
function mostrarOcultarColumnaDescuentos(mostrar) {
    hayDescuentos = mostrar;
    const tabla = document.querySelector('.timb-table');

    if (!tabla) return;

    // Ocultar/mostrar todos los inputs de descuento directamente por clase
    const descuentoInputs = tabla.querySelectorAll('.descuento');
    descuentoInputs.forEach(input => {
        input.parentElement.style.display = mostrar ? '' : 'none';
    });

    // Buscar la columna de descuento por posición en el header
    const headers = tabla.querySelectorAll('th');
    let indexDescuento = -1;
    headers.forEach((th, idx) => {
        if (th.textContent.includes('DESCUENTO')) {
            indexDescuento = idx;
        }
    });

    if (indexDescuento !== -1) {
        // Mostrar/ocultar header
        headers[indexDescuento].style.display = mostrar ? '' : 'none';
    }

    // Mostrar/ocultar fila de descuento en el resumen de totales
    const discountRow = document.getElementById('discount-row');
    if (discountRow) {
        discountRow.style.display = mostrar ? 'flex' : 'none';
    }
}

function cargarConceptosDesdeCotizacion(cot, tipo = 'VENTA') {
    try {
        const tbody = document.getElementById('products-tbody');
        if (tbody) tbody.innerHTML = ''; // Limpiar tabla antes de cargar
        console.log('[DEBUG] Cargando conceptos desde cotización:', cot.numero_cotizacion);

        let productos = cot.productos_seleccionados;
        if (typeof productos === 'string') productos = JSON.parse(productos);

        if (!productos || productos.length === 0) {
            Swal.fire('Atención', 'La cotización no tiene productos.', 'warning');
            return;
        }

        // ============================================
        // PARSEAR CONFIGURACIÓN ESPECIAL (IVA Y DESCUENTOS)
        // ============================================
        let config = {};
        try {
            if (typeof cot.configuracion_especial === 'string' && cot.configuracion_especial.trim() !== '') {
                config = JSON.parse(cot.configuracion_especial);
            } else if (typeof cot.configuracion_especial === 'object' && cot.configuracion_especial !== null) {
                config = cot.configuracion_especial;
            }
        } catch (e) {
            console.warn('[DEBUG] Error parseando configuracion_especial:', e);
        }

        // 1. Manejo de IVA
        aplicaIvaFiscal = config.aplica_iva !== 'no'; // Si no viene o es 'si', aplica IVA
        const checkboxIva = document.getElementById('timb-aplica-iva');
        if (checkboxIva) checkboxIva.checked = aplicaIvaFiscal;
        console.log('[DEBUG] Aplica IVA:', aplicaIvaFiscal);

        // =====================================================================
        // NORMALIZACIÓN A PRECIO NETO (sin IVA)
        // Las cotizaciones VENTA siempre almacenan precios CON IVA incluido.
        // Para facturar al SAT se necesita el precio NETO (sin IVA).
        // =====================================================================
        const necesitaNormalizarANeto = (tipo === 'VENTA');
        if (necesitaNormalizarANeto) {
            console.log('[DEBUG] Cotización VENTA: normalizando precios a base neta (÷1.16).');
        }

        // ============================================================
        // DESCUENTOS: Prioridad a itemDiscounts (por producto)
        // Si existe, cada producto tiene su propio descuento calculado.
        // Si no existe, se cae al global (garantia_porcentaje/monto).
        // ============================================================
        const itemDiscounts = config.itemDiscounts || null; // { 'prod:ID': montoDescBruto }
        const discountExclusions = new Set(config.discountExclusions || []);

        let pctDescuento = parseFloat(cot.garantia_porcentaje || 0);
        let montoDescuentoFijo = parseFloat(cot.garantia_monto || 0);

        console.log('[DEBUG] Porcentaje Descuento:', pctDescuento, '% | Monto Fijo:', montoDescuentoFijo, ' | Exclusiones:', discountExclusions.size,
            '| itemDiscounts disponibles:', !!itemDiscounts);

        // Si NO hay itemDiscounts y hay monto fijo, calculamos porcentaje efectivo global
        if (!itemDiscounts && montoDescuentoFijo > 0 && pctDescuento <= 0) {
            let subtotalElegible = 0;
            productos.forEach(p => {
                const prodId = p.id_producto || p.id;
                if (!discountExclusions.has(`prod:${prodId}`)) {
                    let val = parseFloat(p.precio_unitario || p.precio_venta || p.precio || 0);
                    if (necesitaNormalizarANeto) val = val / 1.16;
                    subtotalElegible += (val * parseFloat(p.cantidad || 1));
                }
            });
            if (subtotalElegible > 0) {
                pctDescuento = (montoDescuentoFijo / subtotalElegible) * 100;
                console.log('[DEBUG] Porcentaje efectivo calculado para monto fijo:', pctDescuento.toFixed(4), '%');
            }
        }

        // ============================================================
        // DETECTAR SI HAY DESCUENTOS Y MOSTRAR/OCULTAR COLUMNA
        // ============================================================
        // Verificar si itemDiscounts tiene valores reales > 0
        let tieneItemDiscounts = false;
        if (itemDiscounts !== null && typeof itemDiscounts === 'object') {
            tieneItemDiscounts = Object.values(itemDiscounts).some(val => parseFloat(val || 0) > 0);
        }
        const tieneDescuentos = tieneItemDiscounts || (pctDescuento > 0) || (montoDescuentoFijo > 0);
        console.log('[DEBUG] ¿Tiene descuentos?', tieneDescuentos, '(itemDiscounts:', tieneItemDiscounts, '| pct:', pctDescuento, '| monto:', montoDescuentoFijo, ')');
        hayDescuentos = tieneDescuentos;

        productos.forEach(p => {
            const prodId = p.id_producto || p.id;
            const key = `prod:${prodId}`;
            const estaExcluido = discountExclusions.has(key);

            let valorUnitario = parseFloat(p.precio_unitario || p.precio_venta || p.precio || 0);
            const cantidad = parseFloat(p.cantidad || 1);

            if (necesitaNormalizarANeto) {
                valorUnitario = parseFloat((valorUnitario / 1.16).toFixed(2));
            }

            let descuentoTotal = 0;

            if (itemDiscounts && itemDiscounts[key] !== undefined) {
                // itemDiscounts[key] es el PORCENTAJE de descuento para este item (e.g. 10 => 10%)
                const pctItem = Number(itemDiscounts[key] || 0);
                descuentoTotal = parseFloat((valorUnitario * cantidad * (pctItem / 100)).toFixed(2));
            } else if (!estaExcluido && pctDescuento > 0) {
                // Fallback: descuento global por porcentaje
                const descuentoUnitario = valorUnitario * (pctDescuento / 100);
                descuentoTotal = parseFloat((descuentoUnitario * cantidad).toFixed(2));
            }

            agregarFilaConcepto({
                cantidad: cantidad,
                claveProductoServicio: p.clave_sat_productos || '01010101',
                claveUnidad: p.clave_unidad || 'H87',
                descripcion: p.nombre || p.descripcion || 'Producto',
                valorUnitario: valorUnitario,
                descuento: descuentoTotal,
                importe: (cantidad * valorUnitario) - descuentoTotal,
                peso: p.peso || 0,
                caracteristicas: p.caracteristicas || p.nota || p.notas_tecnicas || ''
            });
        });

        // Si tiene costo de envío, agregarlo como un concepto
        if (parseFloat(cot.costo_envio) > 0) {
            agregarFilaConcepto({
                cantidad: 1,
                claveProductoServicio: '81141601', // Clave SAT Servicios de transporte de carga por carretera 
                claveUnidad: 'E48',
                descripcion: 'SERVICIO DE ENVÍO / LOGÍSTICA',
                valorUnitario: parseFloat(cot.costo_envio),
                importe: parseFloat(cot.costo_envio)
            });
        }

        // Ahora que todas las filas están agregadas, ocultamos/mostramos la columna de descuentos
        mostrarOcultarColumnaDescuentos(tieneDescuentos);

        actualizarTotalesTimbrado();
        Swal.fire('Éxito', `Se cargaron ${productos.length} conceptos${parseFloat(cot.costo_envio) > 0 ? ' + envío' : ''} desde ${cot.numero_cotizacion}`, 'success');
    } catch (e) {
        console.error('Error cargando conceptos de cotización:', e);
        Swal.fire('Error', 'No se pudieron procesar los conceptos de la cotización', 'error');
    }
}

// Función para agregar una fila a la tabla timbrado (REDISEÑADO)
function agregarFilaConcepto(c = {}) {
    const tbody = document.getElementById('products-tbody');
    const row = document.createElement('tr');

    row.innerHTML = `
        <td style="text-align:center;">
            <button class="btn-row-delete" onclick="this.closest('tr').remove(); actualizarTotalesTimbrado();">
                <i class="fa fa-times"></i>
            </button>
        </td>
        <td><input type="text" class="table-input-inline clave-sat" value="${c.claveProductoServicio || '01010101'}"></td>
        <td><input type="number" class="table-input-inline cantidad" value="${c.cantidad || 1}" oninput="actualizarTotalesTimbrado()"></td>
        <td><input type="text" class="table-input-inline clave-unidad" value="${c.claveUnidad || 'H87'}"></td>
        <td><input type="text" class="table-input-inline descripcion" value="${c.descripcion || ''}" style="width:100%"></td>
        <td><input type="number" class="table-input-inline p-unitario" value="${parseFloat(c.valorUnitario || 0).toFixed(2)}" step="0.01" oninput="actualizarTotalesTimbrado()"></td>
        <td><input type="number" class="table-input-inline descuento" value="${parseFloat(c.descuento || 0).toFixed(2)}" step="0.01" oninput="actualizarTotalesTimbrado()" style="font-weight:700; color:#dc2626;"></td>
        <td style="font-weight:700;"><span class="importe-fila">$${((c.cantidad || 1) * (c.valorUnitario || 0) - (c.descuento || 0)).toFixed(2)}</span></td>
        <input type="hidden" class="peso-unitario" value="${c.peso || 0}">
        <input type="hidden" class="caracteristicas" value="${(c.caracteristicas || '').replace(/"/g, '&quot;')}">
    `;

    tbody.appendChild(row);
}

// Función para actualizar los totales (REDISEÑADO)
function actualizarTotalesTimbrado() {
    const rows = document.querySelectorAll('#products-tbody tr');
    let subtotal = 0;
    let totalDescuento = 0;

    const fmt = (n) => Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    rows.forEach(row => {
        const cant = parseFloat(row.querySelector('.cantidad').value) || 0;
        const price = parseFloat(row.querySelector('.p-unitario').value) || 0;
        const desc = parseFloat(row.querySelector('.descuento').value) || 0;
        const importe = parseFloat(((cant * price) - desc).toFixed(2));

        const importeSpan = row.querySelector('.importe-fila');
        if (importeSpan) importeSpan.textContent = `$${fmt(importe)}`;

        subtotal += (cant * price);
        totalDescuento += desc;
    });

    subtotal = parseFloat(subtotal.toFixed(2));
    totalDescuento = parseFloat(totalDescuento.toFixed(2));
    const baseIva = parseFloat((subtotal - totalDescuento).toFixed(2));
    const iva = aplicaIvaFiscal ? parseFloat((baseIva * 0.16).toFixed(2)) : 0;
    const total = parseFloat((baseIva + iva).toFixed(2));

    // Actualizar etiqueta de IVA si es 0%
    const ivaLabel = document.querySelector('.total-row:nth-child(3) .label');
    if (ivaLabel) {
        ivaLabel.textContent = aplicaIvaFiscal ? 'iva (16%):' : 'iva (0%):';
    }

    document.getElementById('subtotal-amount').textContent = `$${fmt(subtotal)}`;
    document.getElementById('descuento-amount').textContent = `$${fmt(totalDescuento)}`;
    document.getElementById('iva-amount').textContent = `$${fmt(iva)}`;
    document.getElementById('total-amount').textContent = `$${fmt(total)}`;
}

// Función para abrir la ventana de pago interactiva
async function abrirModalPago() {
    try {
        const elTotal = document.getElementById('total-amount');
        const elReceptor = document.getElementById('timb-cliente-nombre');

        if (!elTotal || !elReceptor) {
            console.error('Error: No se encontró total-amount o timb-cliente-nombre en el DOM');
            Swal.fire('Error Interno', 'No se pudieron recuperar los elementos de totales en la interfaz.', 'error');
            return;
        }

        const totalPagar = elTotal.textContent;
        const totalNumeric = parseFloat(totalPagar.replace(/[$,]/g, '')) || 0;
        const receptorNombre = elReceptor.textContent;

        if (totalNumeric <= 0) {
            Swal.fire('Atención', 'Agregue conceptos para calcular el total antes de seleccionar la forma de pago.', 'warning');
            return;
        }

        const { value: pagoResult } = await Swal.fire({
            title: 'Factura CFDI',
            width: '600px',
            html: `
            <div style="text-align:center; padding:10px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="color: #6b7280; font-size: 0.9rem; margin-bottom: 5px;">Total a Pagar</div>
                <div style="font-size: 3rem; font-weight: 800; color: #1e3a8a; margin-bottom: 5px;">${totalPagar} <span style="font-size: 1.2rem;">🇲🇽</span></div>
                <div style="color: #6b7280; font-size: 0.85rem; margin-bottom: 20px;">$ ${totalNumeric.toFixed(2)} MXN</div>
                
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                
                <div class="pago-methods-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 25px;">
                    <div class="pago-method-item active" data-code="01" data-label="01 - Efectivo" style="cursor:pointer; padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px; transition: all 0.2s;">
                        <img src="assets/images/icono-efectivo.png" style="width: 32px; height: 32px; margin-bottom: 5px;"><br>
                        <span style="font-size: 0.75rem; font-weight: 600;">Efectivo</span>
                        <input type="text" value="${totalNumeric.toFixed(2)}" readonly style="width: 100%; border: 1px solid #d1d5db; border-radius: 4px; margin-top: 5px; text-align: center; font-size: 0.8rem; background: #fff;">
                    </div>
                    <div class="pago-method-item" data-code="CARD" data-label="Tarjeta" style="cursor:pointer; padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px; transition: all 0.2s;">
                        <img src="assets/images/icons8-tarjeta-94.png" style="width: 32px; height: 32px; margin-bottom: 5px;"><br>
                        <span style="font-size: 0.75rem; font-weight: 600;">Tarjeta</span>
                        <input type="text" value="0.00" readonly style="width: 100%; border: 1px solid #d1d5db; border-radius: 4px; margin-top: 5px; text-align: center; font-size: 0.8rem; background: #f9fafb;">
                    </div>
                    <div class="pago-method-item" data-code="08" data-label="08 - Vales de despensa" style="cursor:pointer; padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px; transition: all 0.2s;">
                        <img src="assets/images/icons8-vales-48.png" style="width: 32px; height: 32px; margin-bottom: 5px;"><br>
                        <span style="font-size: 0.75rem; font-weight: 600;">Vales</span>
                        <input type="text" value="0.00" readonly style="width: 100%; border: 1px solid #d1d5db; border-radius: 4px; margin-top: 5px; text-align: center; font-size: 0.8rem; background: #f9fafb;">
                    </div>
                    <div class="pago-method-item" data-code="02" data-label="02 - Cheque nominativo" style="cursor:pointer; padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px; transition: all 0.2s;">
                        <img src="assets/images/icons8-cheque-48.png" style="width: 32px; height: 32px; margin-bottom: 5px;"><br>
                        <span style="font-size: 0.75rem; font-weight: 600;">Cheque</span>
                        <input type="text" value="0.00" readonly style="width: 100%; border: 1px solid #d1d5db; border-radius: 4px; margin-top: 5px; text-align: center; font-size: 0.8rem; background: #f9fafb;">
                    </div>
                    <div class="pago-method-item" data-code="03" data-label="03 - Transferencia" style="cursor:pointer; padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px; transition: all 0.2s;">
                        <img src="assets/images/icons8-transferencia-de-dinero-en-línea-48.png" style="width: 32px; height: 32px; margin-bottom: 5px;"><br>
                        <span style="font-size: 0.75rem; font-weight: 600;">Transf...</span>
                        <input type="text" value="0.00" readonly style="width: 100%; border: 1px solid #d1d5db; border-radius: 4px; margin-top: 5px; text-align: center; font-size: 0.8rem; background: #f9fafb;">
                    </div>
                </div>

                <div id="pago-card-details" style="display:none; transition: all 0.3s; margin-bottom: 20px;">
                     <div style="display:flex; gap:10px; align-items:center;">
                        <div style="flex:1;">
                            <label style="display:block; text-align:left; font-size:0.75rem; font-weight:700; color:#4b5563; margin-bottom:4px;">Referencia:</label>
                            <input id="swal-pago-ref" class="swal2-input" placeholder="No. Autorización" style="margin:0; width:100%; height:38px; font-size:0.9rem;">
                        </div>
                        <div style="width:120px;">
                            <label style="display:block; text-align:left; font-size:0.75rem; font-weight:700; color:#4b5563; margin-bottom:4px;">Tipo:</label>
                            <select id="swal-pago-card-type" class="swal2-input" style="margin:0; width:100%; height:38px; font-size:0.9rem; padding: 0 5px;">
                                <option value="28">28 - T. Débito</option>
                                <option value="04">04 - T. Crédito</option>
                            </select>
                        </div>
                     </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e5e7eb;">
                    <div style="text-align:left;">
                        <div id="swal-pago-client-name" style="font-weight:700; color:#1e3a8a; font-size:0.85rem; text-transform:uppercase;">${receptorNombre}</div>
                        <div style="color: #ef4444; font-weight:700; font-size:0.9rem; margin-top:2px;">Total Pagar: <span style="font-size:1.1rem;">${totalPagar}</span></div>
                    </div>
                    <div style="text-align:right;">
                        <div style="color: #10b981; font-size: 0.8rem; font-weight:700;">Cambio</div>
                        <div style="font-size: 1.8rem; font-weight:800; color: #10b981;">$ 0.00 <span style="font-size: 0.8rem;">🇲🇽</span></div>
                    </div>
                </div>
            </div>
            <style>
                .pago-method-item.active {
                    border-color: #2979ff !important;
                    background: #f0f7ff !important;
                    box-shadow: 0 4px 10px rgba(41, 121, 255, 0.1);
                }
                .pago-method-item.active input {
                    background: #fff !important;
                    border-color: #2979ff !important;
                }
            </style>
        `,
            showCancelButton: true,
            cancelButtonText: 'Cancelar',
            confirmButtonText: '<i class="fa fa-check-circle"></i> Seleccionar',
            confirmButtonColor: '#0056b3',
            didOpen: () => {
                const items = document.querySelectorAll('.pago-method-item');
                const cardDetails = document.getElementById('pago-card-details');

                items.forEach(item => {
                    item.addEventListener('click', () => {
                        items.forEach(i => {
                            i.classList.remove('active');
                            i.querySelector('input').value = '0.00';
                            i.querySelector('input').style.background = '#f9fafb';
                        });
                        item.classList.add('active');
                        item.querySelector('input').value = totalNumeric.toFixed(2);
                        item.querySelector('input').style.background = '#fff';

                        if (item.dataset.code === 'CARD') {
                            cardDetails.style.display = 'block';
                        } else {
                            cardDetails.style.display = 'none';
                        }
                    });
                });
            },
            preConfirm: () => {
                const activeItem = document.querySelector('.pago-method-item.active');
                let code = activeItem.dataset.code;
                let label = activeItem.dataset.label;
                let ref = '';

                if (code === 'CARD') {
                    const select = document.getElementById('swal-pago-card-type');
                    code = select.value;
                    label = select.options[select.selectedIndex].text;
                    ref = document.getElementById('swal-pago-ref').value;
                }

                return { code, label, ref };
            }
        });

        if (pagoResult) {
            document.getElementById('timb-forma-pago').value = pagoResult.code;
            document.getElementById('selected-forma-pago-text').textContent = pagoResult.label;
            document.getElementById('timb-pago-referencia').value = pagoResult.ref;
        }
    } catch (err) {
        console.error('Error en abrirModalPago:', err);
        Swal.fire('Error', 'Ocurrió un error al abrir la ventana de pago: ' + err.message, 'error');
    }
}

// Función para procesar el timbrado (REDISEÑADO para SAT México)

/* === Notas de crédito helpers === */

// Alterna visibilidad de secciones y texto de botón según tipo de comprobante
function alternarModoComprobante() {
    const tipo = document.getElementById('timb-tipo-comprobante').value;
    const section = document.getElementById('credit-note-section');
    const btn = document.getElementById('btn-timbrar');
    const errEl = document.getElementById('nc-errors');
    if (tipo === 'E') {
        section.style.display = 'block';
        btn.innerHTML = 'EMITIR NOTA DE CRÉDITO <i class="fa fa-paper-plane"></i>';
        // si ya hay factura origen seleccionada recalcular saldo
        const origenId = document.getElementById('nc-factura-origen-id').value;
        if (origenId) calcularSaldoElegibleNC(origenId);
    } else if (tipo === 'P') {
        section.style.display = 'none';
        btn.innerHTML = 'TIMBRAR COMPLEMENTO DE PAGO <i class="fa fa-paper-plane"></i>';
        if (errEl) errEl.textContent = '';
    } else {
        section.style.display = 'none';
        btn.innerHTML = 'TIMBRAR FACTURA <i class="fa fa-paper-plane"></i>';
        if (errEl) errEl.textContent = '';
    }
}

// Buscar factura origen para NC y actualizar detalles
async function buscarFacturaOrigenNC() {
    const query = document.getElementById('nc-factura-origen').value.trim();
    if (!query) return;
    const token = localStorage.getItem('token');
    try {
        const resp = await fetch(`/api/facturas/search-document/${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await resp.json();
        console.log('[NC SEARCH] resp.ok=', resp.ok, 'status=', resp.status, 'json=', json);
        let fact = null;
        if (resp.ok && json.success) {
            if (json.type === 'FACTURA' && Array.isArray(json.facturas)) {
                fact = json.facturas[0];
            } else if (Array.isArray(json.data) && json.data.length) {
                fact = json.data.find(d => d.tipo && d.tipo.toUpperCase().includes('FACTURA')) || json.data[0];
            }
        }
        if (fact) {
            document.getElementById('nc-factura-origen-details').textContent = `${fact.folio || fact.uuid || ''} - ${formatearMoneda(fact.total)}`;
            document.getElementById('nc-factura-origen-id').value = fact.id_factura || fact.id;
            document.getElementById('nc-factura-origen-uuid').value = fact.uuid || '';
            calcularSaldoElegibleNC(fact.id_factura || fact.id);
        } else {
            document.getElementById('nc-factura-origen-details').textContent = 'No se encontró factura';
            document.getElementById('nc-factura-origen-id').value = '';
            document.getElementById('nc-saldo-elegible').textContent = '0.00';
        }
    } catch (e) {
        console.error('Error buscando factura origen:', e);
    }
}

// Consultar backend para calcular saldo elegible
async function calcularSaldoElegibleNC(facturaId) {
    if (!facturaId) return;
    const token = localStorage.getItem('token');
    try {
        const resp = await fetch(`/api/facturas/eligible-credit-balance/${facturaId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await resp.json();
        if (resp.ok && json.success) {
            document.getElementById('nc-saldo-elegible').textContent = Number(json.saldoElegible || 0).toFixed(2);
        }
    } catch (e) {
        console.error('Error calculando saldo elegible:', e);
    }
}

// Validaciones específicas antes de timbrar NC
function validarNotaCreditoAntesDeTimbrar(facturaData) {
    let msg = '';
    if (facturaData.factura.tipo === 'E') {
        if (!facturaData.creditNote || !facturaData.creditNote.facturaOrigenId) {
            msg = 'Factura origen es obligatoria para nota de crédito.';
        } else if (!facturaData.creditNote.motivoSat) {
            msg = 'Motivo SAT es obligatorio.';
        } else if (['04', '05'].includes(facturaData.creditNote.motivoSat) && (!facturaData.creditNote.observacion || facturaData.creditNote.observacion.length < 3)) {
            msg = 'Observación es obligatoria para el motivo seleccionado.';
        } else {
            // calcular total de conceptos
            const ncTotal = facturaData.conceptos ? facturaData.conceptos.reduce((s, c) => s + ((c.cantidad || 0) * (c.valorUnitario || 0) - (c.descuento || 0)), 0) : 0;
            if (parseFloat(facturaData.creditNote.saldoElegible || 0) < ncTotal) {
                msg = 'Monto de la nota excede el saldo elegible.';
            }
        }
        // verificación de cliente receptor igual factura origen (independiente)
        if (facturaData.receptor && facturaData.receptor.id_cliente
            && facturaData.receptor.id_cliente.toString() !== document.getElementById('nc-factura-origen-id').value) {
            msg = 'El cliente receptor debe coincidir con la factura origen.';
        }
    }
    return { passed: msg === '', message: msg };
}

document.addEventListener('DOMContentLoaded', () => {
    const tipoEl = document.getElementById('timb-tipo-comprobante');
    if (tipoEl) {
        tipoEl.addEventListener('change', alternarModoComprobante);
        alternarModoComprobante();
    }
    const buscarBtn = document.getElementById('nc-buscar-factura');
    const buscarInput = document.getElementById('nc-factura-origen');
    if (buscarBtn) buscarBtn.addEventListener('click', buscarFacturaOrigenNC);
    if (buscarInput) {
        // permitir Enter en el campo
        buscarInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                buscarFacturaOrigenNC();
            }
        });
    }
    const motivoEl = document.getElementById('nc-motivo-sat');
    const obsEl = document.getElementById('nc-observacion');
    if (motivoEl && obsEl) {
        motivoEl.addEventListener('change', () => {
            if (['04', '05'].includes(motivoEl.value)) {
                obsEl.setAttribute('required', 'required');
            } else {
                obsEl.removeAttribute('required');
            }
        });
    }
});

function cerrarVistaPrevia() {
    document.getElementById('vista-previa-modal').style.display = 'none';
    document.getElementById('preview-iframe').src = 'about:blank';
}

async function mostrarVistaPrevia() {
    const filas = document.querySelectorAll('#products-tbody tr');
    if (filas.length === 0) {
        Swal.fire('Error', 'Agrega al menos un concepto para visualizar la vista previa', 'warning');
        return;
    }

    const rfc = document.getElementById('timb-cliente-rfc')?.value || document.getElementById('modal-cliente-rfc')?.value;
    if (!rfc) {
        Swal.fire('Error', 'Selecciona un cliente válido', 'warning');
        return;
    }

    try {
        Swal.fire({
            title: 'Generando Vista Previa',
            text: 'Espere un momento...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        // Recolectar datos (similar a procesarTimbrado)
        const formaPago = document.getElementById('timb-forma-pago').value;
        const referencia = document.getElementById('timb-pago-referencia').value;
        let observaciones = document.getElementById('timb-observacion').value;
        if (referencia) observaciones = (observaciones ? observaciones + ' ' : '') + 'Ref: ' + referencia;

        let nombreReceptor = document.getElementById('timb-cliente-nombre')?.textContent;
        const modalInputNombre = document.getElementById('modal-cliente-nombre-input');
        if (modalInputNombre && modalInputNombre.value) nombreReceptor = modalInputNombre.value;

        const datosFactura = {
            receptor: {
                rfc: rfc.trim().toUpperCase(),
                nombre: nombreReceptor || 'RECEPTOR DESCONOCIDO',
                regimenFiscal: document.getElementById('timb-cliente-regimen')?.value || '616',
                codigoPostal: document.getElementById('timb-cliente-cp')?.value || '00000',
                usoCfdi: document.getElementById('timb-cliente-uso')?.value || 'G03',
                direccion: document.getElementById('timb-cliente-direccion')?.textContent || '-',
                colonia: document.getElementById('timb-cliente-colonia')?.value || '',
                localidad: document.getElementById('timb-cliente-localidad')?.value || '',
                municipio: document.getElementById('timb-cliente-municipio')?.value || '',
                estado: document.getElementById('timb-cliente-estado')?.value || '',
                pais: document.getElementById('timb-cliente-pais')?.value || ''
            },
            factura: {
                metodoPago: document.getElementById('timb-metodo-pago').value || 'PUE',
                formaPago: formaPago,
                observaciones: observaciones,
                notas_internas: document.getElementById('timb-notas-internas')?.value || '',
                moneda: document.getElementById('timb-moneda').value || 'MXN'
            },
            conceptos: Array.from(filas).map(fila => {
                return {
                    cantidad: parseFloat(fila.querySelector('.cantidad').value),
                    valorUnitario: parseFloat(fila.querySelector('.p-unitario').value),
                    descuento: parseFloat(fila.querySelector('.descuento').value) || 0,
                    descripcion: fila.querySelector('.descripcion').value,
                    claveProductoServicio: fila.querySelector('.clave-sat').value,
                    claveUnidad: fila.querySelector('.clave-unidad').value,
                    unidad: fila.querySelector('.unidad')?.value || 'Unidad'
                };
            }),
            aplicaIva: document.getElementById('timb-aplica-iva')?.checked !== false
        };

        const token = localStorage.getItem('token');
        const respuesta = await fetch('/api/facturas/vista-previa', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(datosFactura)
        });

        if (!respuesta.ok) throw new Error('Error al generar vista previa');

        const blob = await respuesta.blob();
        const url = URL.createObjectURL(blob);
        
        document.getElementById('preview-iframe').src = url;
        document.getElementById('vista-previa-modal').style.display = 'flex';
        
        Swal.close();

    } catch (error) {
        console.error('Error vista previa:', error);
        Swal.fire('Error', 'No se pudo generar la vista previa: ' + error.message, 'error');
    }
}

function obtenerDatosTimbradoForm() {
    const getVal = (idBase) => {
        let el = document.getElementById(`timb-cliente-${idBase}`);
        const modal = document.getElementById('nueva-factura-modal');
        const modalOpen = modal && modal.style.display !== 'none';
        if (modalOpen) {
            const modalEl = document.getElementById(`modal-cliente-${idBase}`);
            if (modalEl) el = modalEl;
        }
        if (!el && idBase === 'rfc') el = document.getElementById('timb-cliente-rfc') || document.getElementById('modal-cliente-rfc');
        if (!el && idBase === 'nombre') el = document.getElementById('timb-cliente-nombre');
        if (!el) return null;
        return el.tagName === 'INPUT' || el.tagName === 'SELECT' ? el.value : el.textContent;
    };

    const rfc = getVal('rfc');
    const formaPago = document.getElementById('timb-forma-pago')?.value;
    const ref = document.getElementById('timb-pago-referencia')?.value || '';
    let obs = document.getElementById('timb-observacion')?.value || '';
    if (ref) obs = (obs ? obs + ' ' : '') + 'Ref: ' + ref;

    let nombreReceptor = document.getElementById('timb-cliente-nombre')?.textContent;
    const modalInputNombre = document.getElementById('modal-cliente-nombre-input');
    const modal = document.getElementById('nueva-factura-modal');
    if (modal && modal.style.display !== 'none' && modalInputNombre?.value) {
        nombreReceptor = modalInputNombre.value;
    }

    const rows = document.querySelectorAll('#products-tbody tr');
    return {
        rfc,
        receptor: {
            id_cliente: getVal('id') || null,
            rfc: rfc ? rfc.trim().toUpperCase() : '',
            nombre: nombreReceptor || 'RECEPTOR DESCONOCIDO',
            regimenFiscal: getVal('regimen') || '616',
            codigoPostal: getVal('cp') || '00000',
            usoCfdi: getVal('uso') || 'G03',
            colonia: getVal('colonia') || '',
            localidad: getVal('localidad') || '',
            municipio: getVal('municipio') || '',
            estado: getVal('estado') || '',
            pais: getVal('pais') || '',
            direccion: document.getElementById('timb-cliente-direccion')?.textContent || '-'
        },
        factura: {
            tipo: document.getElementById('timb-tipo-comprobante')?.value,
            serie: document.getElementById('timb-serie')?.value,
            moneda: document.getElementById('timb-moneda')?.value,
            tipoCambio: parseFloat(document.getElementById('timb-tc')?.value) || 1,
            formaPago: formaPago,
            metodoPago: document.getElementById('timb-metodo-pago')?.value || 'PUE',
            observaciones: obs,
            notas_internas: document.getElementById('timb-notas-internas')?.value || '',
            cotizacion_id: document.getElementById('timb-cotizacion-id')?.value || null,
            cotizacion_numero: document.getElementById('timb-cotizacion-numero')?.value || null,
            hayDescuentos: hayDescuentos,
            id_factura_borrador: document.getElementById('timb-borrador-id')?.value || null
        },
        conceptos: Array.from(rows).map((row) => {
            const cantidad = parseFloat(row.querySelector('.cantidad').value);
            const valorUnitario = parseFloat(row.querySelector('.p-unitario').value);
            const descuento = parseFloat(row.querySelector('.descuento').value) || 0;
            const concepto = {
                claveProductoServicio: row.querySelector('.clave-sat').value,
                cantidad,
                claveUnidad: row.querySelector('.clave-unidad').value,
                descripcion: row.querySelector('.descripcion').value,
                valorUnitario,
                descuento,
                peso: parseFloat(row.querySelector('.peso-unitario')?.value || 0),
                caracteristicas: row.querySelector('.caracteristicas')?.value || '',
                objetoImp: aplicaIvaFiscal ? '02' : '01'
            };
            if (aplicaIvaFiscal) {
                const importe = (cantidad * valorUnitario) - descuento;
                concepto.impuestos = {
                    Traslados: [{
                        Base: Number(importe.toFixed(2)),
                        Impuesto: '002',
                        TipoFactor: 'Tasa',
                        TasaOCuota: 0.16,
                        Importe: Number((importe * 0.16).toFixed(2))
                    }]
                };
            }
            return concepto;
        }),
        aplicaIva: document.getElementById('timb-aplica-iva')?.checked !== false,
        CfdiRelacionados: typeof window.getFacturasRelacionadas === 'function' ? window.getFacturasRelacionadas() : null
    };
}

function aplicarPayloadBorradorEnFormulario(payload) {
    if (!payload) return;
    const { receptor, factura, conceptos, aplicaIva } = payload;

    if (receptor) {
        const setHidden = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };
        setHidden('timb-cliente-id', receptor.id_cliente);
        setHidden('timb-cliente-rfc', receptor.rfc);
        setHidden('timb-cliente-cp', receptor.codigoPostal);
        setHidden('timb-cliente-regimen', receptor.regimenFiscal);
        setHidden('timb-cliente-uso', receptor.usoCfdi);
        setHidden('timb-cliente-colonia', receptor.colonia);
        setHidden('timb-cliente-localidad', receptor.localidad);
        setHidden('timb-cliente-municipio', receptor.municipio);
        setHidden('timb-cliente-estado', receptor.estado);
        setHidden('timb-cliente-pais', receptor.pais);
        const nombreEl = document.getElementById('timb-cliente-nombre');
        if (nombreEl) nombreEl.textContent = receptor.nombre || 'Cliente';
        const dirEl = document.getElementById('timb-cliente-direccion');
        if (dirEl) dirEl.textContent = receptor.direccion || '-';
        if (typeof actualizarVistaCliente === 'function') actualizarVistaCliente();
    }

    if (factura) {
        const mapIds = {
            'timb-tipo-comprobante': factura.tipo,
            'timb-serie': factura.serie,
            'timb-moneda': factura.moneda,
            'timb-tc': factura.tipoCambio,
            'timb-metodo-pago': factura.metodoPago,
            'timb-forma-pago': factura.formaPago,
            'timb-observacion': factura.observaciones,
            'timb-notas-internas': factura.notas_internas,
            'timb-cotizacion-id': factura.cotizacion_id,
            'timb-cotizacion-numero': factura.cotizacion_numero
        };
        Object.entries(mapIds).forEach(([id, val]) => {
            const el = document.getElementById(id);
            if (el && val != null) el.value = val;
        });
    }

    if (typeof aplicaIva === 'boolean') {
        aplicaIvaFiscal = aplicaIva;
        const chk = document.getElementById('timb-aplica-iva');
        if (chk) chk.checked = aplicaIva;
    }

    const tbody = document.getElementById('products-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        (conceptos || []).forEach((c) => agregarFilaConcepto(c));
        actualizarTotalesTimbrado();
    }
}

async function cargarBorradoresTimbrado() {
    const contenedor = document.getElementById('timb-borradores-list');
    if (!contenedor) return;
    try {
        const token = localStorage.getItem('token');
        const resp = await fetch('/api/facturas/borradores', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const json = await resp.json();
        if (!resp.ok || !json.success) {
            contenedor.innerHTML = '<span style="color:#b45309;">No se pudieron cargar los borradores.</span>';
            return;
        }
        const lista = Array.isArray(json.data) ? json.data : [];
        if (!lista.length) {
            contenedor.innerHTML = '<span style="color:#a16207;">Sin borradores guardados.</span>';
            return;
        }
        contenedor.innerHTML = lista.map((b) => `
            <button type="button" class="timb-borrador-chip" data-id="${b.id_factura}"
                style="border:1px solid #fcd34d; background:#fff; border-radius:8px; padding:8px 12px; cursor:pointer; text-align:left;">
                <strong style="color:#92400e;">${b.folio || 'Borrador'}</strong>
                <span style="display:block; color:#78350f; font-size:0.8rem;">${b.cliente_nombre || 'Cliente'} · $${Number(b.total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            </button>
        `).join('');
        contenedor.querySelectorAll('.timb-borrador-chip').forEach((btn) => {
            btn.addEventListener('click', () => continuarBorradorFactura(btn.dataset.id));
        });
    } catch (e) {
        console.error('Error cargando borradores:', e);
        contenedor.innerHTML = '<span style="color:#b45309;">Error al cargar borradores.</span>';
    }
}

async function continuarBorradorFactura(idFactura) {
    if (!idFactura) return;
    try {
        const token = localStorage.getItem('token');
        const resp = await fetch(`/api/facturas/borrador/${idFactura}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const json = await resp.json();
        if (!resp.ok || !json.success) {
            throw new Error(json.error || 'No se pudo cargar el borrador');
        }
        document.querySelector('.tab-btn[data-section="timbrado"]')?.click();
        const borradorInput = document.getElementById('timb-borrador-id');
        if (borradorInput) borradorInput.value = String(json.data.id_factura);
        aplicarPayloadBorradorEnFormulario(json.data.payload);
        Swal.fire({ icon: 'info', title: 'Borrador cargado', text: 'Revisa los datos y timbra cuando estés listo.', timer: 2000, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

async function procesarGuardarBorrador() {
    const datos = obtenerDatosTimbradoForm();
    if (!datos.rfc) {
        Swal.fire('Error', 'Selecciona un cliente antes de guardar el borrador.', 'warning');
        return;
    }
    if (!datos.conceptos.length) {
        Swal.fire('Error', 'Agrega al menos un concepto al borrador.', 'warning');
        return;
    }

    const borradorId = document.getElementById('timb-borrador-id')?.value;
    const body = {
        receptor: datos.receptor,
        factura: datos.factura,
        conceptos: datos.conceptos,
        aplicaIva: datos.aplicaIva,
        CfdiRelacionados: datos.CfdiRelacionados
    };
    if (borradorId) body.id_factura = Number(borradorId);

    try {
        Swal.fire({ title: 'Guardando borrador...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const token = localStorage.getItem('token');
        const resp = await fetch('/api/facturas/borrador', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        const json = await resp.json();
        Swal.close();
        if (!resp.ok || !json.success) {
            throw new Error(json.error || 'No se pudo guardar el borrador');
        }
        const borradorInput = document.getElementById('timb-borrador-id');
        if (borradorInput) borradorInput.value = String(json.data.id_factura);
        await cargarBorradoresTimbrado();
        cargarFacturas();
        Swal.fire({ icon: 'success', title: 'Borrador guardado', timer: 1400, showConfirmButton: false });
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    }
}

async function procesarVistaPreviaPDF() {
    const datos = obtenerDatosTimbradoForm();
    if (!datos.rfc) {
        Swal.fire('Error', 'Selecciona un cliente antes de generar la vista previa.', 'warning');
        return;
    }
    if (!datos.conceptos.length) {
        Swal.fire('Error', 'Agrega al menos un concepto para generar la vista previa.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-vista-previa-pdf');
    const originalHtml = btn?.innerHTML;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'GENERANDO... <i class="fa fa-spinner fa-spin"></i>';
    }

    try {
        Swal.fire({ title: 'Generando vista previa...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const token = localStorage.getItem('token');
        const response = await fetch('/api/facturas/vista-previa', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                receptor: datos.receptor,
                factura: datos.factura,
                conceptos: datos.conceptos,
                aplicaIva: datos.aplicaIva,
                CfdiRelacionados: datos.CfdiRelacionados
            })
        });

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(errorPayload.error || 'No se pudo generar la vista previa.');
        }

        const blob = await response.blob();
        const pdfUrl = window.URL.createObjectURL(blob);
        const previewWindow = window.open(pdfUrl, '_blank');
        if (!previewWindow) {
            const a = document.createElement('a');
            a.href = pdfUrl;
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        setTimeout(() => window.URL.revokeObjectURL(pdfUrl), 60000);
        Swal.close();
    } catch (e) {
        Swal.fire('Error', e.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
}

window.procesarGuardarBorrador = procesarGuardarBorrador;
window.procesarVistaPreviaPDF = procesarVistaPreviaPDF;
window.cargarBorradoresTimbrado = cargarBorradoresTimbrado;
window.continuarBorradorFactura = continuarBorradorFactura;

async function procesarTimbrado() {
    const rows = document.querySelectorAll('#products-tbody tr');
    if (rows.length === 0) {
        Swal.fire('Error', 'Agrega al menos un concepto para facturar', 'error');
        return;
    }

    // Función auxiliar para obtener valor de campos que pueden estar en modal o sección principal
    const getVal = (idBase) => {
        // Intentar primero con el ID de la sección principal 'timb-...'
        let el = document.getElementById(`timb-cliente-${idBase}`);
        // Si no existe o si el modal está abierto y existe una versión modal del ID, preferir esa
        const modal = document.getElementById('nueva-factura-modal');
        const modalOpen = modal && modal.style.display !== 'none';

        if (modalOpen) {
            const modalEl = document.getElementById(`modal-cliente-${idBase}`);
            if (modalEl) el = modalEl;
        }

        // Casos especiales para campos que no siguen el patrón timb-cliente-...
        if (!el && idBase === 'rfc') el = document.getElementById('timb-cliente-rfc') || document.getElementById('modal-cliente-rfc');
        if (!el && idBase === 'nombre') el = document.getElementById('timb-cliente-nombre'); // El nombre en modal es un input, en main es textContent

        if (!el) return null;
        return el.tagName === 'INPUT' || el.tagName === 'SELECT' ? el.value : el.textContent;
    };

    const rfc = getVal('rfc');
    if (!rfc || rfc === 'N/A' || rfc.trim() === '') {
        Swal.fire('Error', 'El cliente no tiene un RFC válido para el timbrado.', 'error');
        return;
    }

    const formaPago = document.getElementById('timb-forma-pago').value;
    const ref = document.getElementById('timb-pago-referencia').value;
    let obs = document.getElementById('timb-observacion').value;
    console.log('[DEBUG FRONTEND] Valor de timb-observacion:', obs);
    if (ref) obs = (obs ? obs + ' ' : '') + 'Ref: ' + ref;

    // Obtener nombre (manejo especial porque principal es text y modal es input)
    let nombreReceptor = document.getElementById('timb-cliente-nombre')?.textContent;
    const modalInputNombre = document.getElementById('modal-cliente-nombre-input');
    const modal = document.getElementById('nueva-factura-modal');
    if (modal && modal.style.display !== 'none' && modalInputNombre && modalInputNombre.value) {
        nombreReceptor = modalInputNombre.value;
    }

    const facturaData = {
        receptor: {
            id_cliente: getVal('id') || null,
            rfc: rfc.trim().toUpperCase(),
            nombre: nombreReceptor || 'RECEPTOR DESCONOCIDO',
            regimenFiscal: getVal('regimen') || '616',
            codigoPostal: getVal('cp') || '00000',
            usoCfdi: getVal('uso') || 'G03',
            colonia: getVal('colonia') || '',
            localidad: getVal('localidad') || '',
            municipio: getVal('municipio') || '',
            estado: getVal('estado') || '',
            pais: getVal('pais') || '',
            direccion: document.getElementById('timb-cliente-direccion')?.textContent || '-'
        },
        factura: {
            tipo: document.getElementById('timb-tipo-comprobante').value,
            serie: document.getElementById('timb-serie').value,
            moneda: document.getElementById('timb-moneda').value,
            tipoCambio: parseFloat(document.getElementById('timb-tc').value) || 1,
            formaPago: formaPago,
            metodoPago: document.getElementById('timb-metodo-pago').value || 'PUE',
            observaciones: obs,
            notas_internas: document.getElementById('timb-notas-internas')?.value || '',
            cotizacion_id: document.getElementById('timb-cotizacion-id')?.value || null,
            cotizacion_numero: document.getElementById('timb-cotizacion-numero')?.value || null,
            hayDescuentos: hayDescuentos  // Pasar flag de descuentos al servidor
        },

        // DEBUG: Log para verificar notas_internas
        _debug_notas: (() => {
            const elem = document.getElementById('timb-notas-internas');
            console.log('🔍 DEBUG Frontend - timb-notas-internas:');
            console.log('   - Element:', elem);
            console.log('   - Value:', elem?.value);
            return elem?.value;
        })(),
        conceptos: Array.from(rows).map(row => {
            const cantidad = parseFloat(row.querySelector('.cantidad').value);
            const valorUnitario = parseFloat(row.querySelector('.p-unitario').value);
            const descuento = parseFloat(row.querySelector('.descuento').value) || 0;
            const importe = (cantidad * valorUnitario) - descuento;

            const concepto = {
                claveProductoServicio: row.querySelector('.clave-sat').value,
                cantidad: cantidad,
                claveUnidad: row.querySelector('.clave-unidad').value,
                descripcion: row.querySelector('.descripcion').value,
                valorUnitario: valorUnitario,
                descuento: descuento,
                peso: parseFloat(row.querySelector('.peso-unitario')?.value || 0),
                caracteristicas: row.querySelector('.caracteristicas')?.value || '',
                objetoImp: aplicaIvaFiscal ? '02' : '01'
            };

            if (aplicaIvaFiscal) {
                concepto.impuestos = {
                    Traslados: [
                        {
                            Base: Number(importe.toFixed(2)),
                            Impuesto: '002',
                            TipoFactor: 'Tasa',
                            TasaOCuota: 0.16,
                            Importe: Number((importe * 0.16).toFixed(2))
                        }
                    ]
                };
            }

            return concepto;
        })
    };

    const token = localStorage.getItem('token');

    // Regla de credito: en PPD la forma de pago debe enviarse como 99 (Por definir).
    if (String(facturaData.factura.metodoPago || '').toUpperCase() === 'PPD') {
        facturaData.factura.formaPago = '99';
        // Validar crédito activo antes de timbrar (solo si tenemos id_cliente).
        // Si ya tiene deuda/saldo vigente, no permitir otro PPD para evitar ciclos confusos.
        if (facturaData.receptor.id_cliente) {
            try {
                const resp2 = await fetch(`/api/clientes/credito/${facturaData.receptor.id_cliente}/detalle`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const json2 = await resp2.json();
                if (resp2.ok && json2.success) {
                    const deudaActiva = Number(json2.data.deuda || 0);
                    const hayCreditosAbiertos = Array.isArray(json2.data.creditos)
                        && json2.data.creditos.some(c => Number(c.saldo || 0) > 0.009);

                    if (deudaActiva > 0.009 || hayCreditosAbiertos) {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Cliente con crédito activo',
                            text: `El cliente ya tiene un crédito vigente por $${deudaActiva.toFixed(2)}. Para esta factura selecciona método de pago PUE o liquida primero el crédito actual.`,
                            confirmButtonText: 'Entendido'
                        });
                        return;
                    }
                }
            } catch (e) {
                console.warn('[FACTURACION] Error comprobando crédito activo:', e);
                // no bloquear, ya validamos en el servidor
            }
        }
    }

    const borradorIdActivo = document.getElementById('timb-borrador-id')?.value;
    if (borradorIdActivo) {
        facturaData.id_factura_borrador = Number(borradorIdActivo);
        facturaData.factura.id_factura_borrador = Number(borradorIdActivo);
    }

    // -> nota de crédito: anexar campos y validar
    if (facturaData.factura.tipo === 'E') {
        facturaData.relatedCfdi = {
            uuid: document.getElementById('nc-factura-origen-uuid')?.value || null,
            tipoRelacion: document.getElementById('nc-tipo-relacion').value
        };
        facturaData.creditNote = {
            motivoSat: document.getElementById('nc-motivo-sat').value,
            facturaOrigenId: document.getElementById('nc-factura-origen-id').value,
            saldoElegible: parseFloat(document.getElementById('nc-saldo-elegible').textContent) || 0,
            observacion: document.getElementById('nc-observacion').value.trim()
        };
        const validator = validarNotaCreditoAntesDeTimbrar(facturaData);
        const errEl = document.getElementById('nc-errors');
        if (!validator.passed) {
            if (errEl) errEl.textContent = validator.message;
            Swal.fire('Error', validator.message, 'error');
            return;
        } else {
            if (errEl) errEl.textContent = '';
        }
    }

    try {
        const confirmResult = await Swal.fire({
            title: '¿Confirmar Facturación?',
            text: `Se generará un CFDI oficial. Método: ${document.getElementById('selected-forma-pago-text').textContent}`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'SÍ, GENERAR CFDI',
            confirmButtonColor: '#2979ff'
        });

        if (!confirmResult.isConfirmed) return;

        console.log('[DEBUG FRONTEND] Enviando facturaData:', JSON.stringify(facturaData, null, 2));

        Swal.fire({ title: 'Procesando Timbrado...', didOpen: () => { Swal.showLoading(); } });

        const response = await fetch('/api/facturas/timbrar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(facturaData)
        });

        const res = await response.json();
        Swal.close();

        if (response.ok && res.success) {
            Swal.fire({
                icon: 'success',
                title: 'Factura Generada',
                text: 'El CFDI se ha timbrado correctamente.',
                timer: 1500,
                showConfirmButton: false
            });

            const borradorInput = document.getElementById('timb-borrador-id');
            if (borradorInput) borradorInput.value = '';
            if (typeof cargarBorradoresTimbrado === 'function') cargarBorradoresTimbrado();

            cargarFacturas(); // Recargar lista

            // Abrir modal de envío por correo (includes PDF preview)
            setTimeout(() => {
                if (typeof abrirModalEmail === 'function') {
                    // Pre-llenar correo si está disponible
                    const emailInput = document.getElementById('email-cliente');
                    // Intentar obtener email del cliente actual si tenemos el input de edición lleno
                    const emailEdit = document.getElementById('edit-cliente-email');
                    if (emailInput && emailEdit && emailEdit.value) {
                        emailInput.value = emailEdit.value;
                    }
                    abrirModalEmail(res.data.uuid);
                }
            }, 1000);

        } else {
            if (response.status === 400 && res?.code === 'CLIENTE_CON_CREDITO_ACTIVO') {
                Swal.fire({
                    icon: 'warning',
                    title: 'No se permite otro crédito',
                    text: res.error || 'El cliente ya tiene un crédito activo. Cambia el método de pago a PUE.',
                    confirmButtonText: 'Cambiar a PUE'
                });
                return;
            }
            Swal.fire('Error SAT', res.error || 'Ocurrió un error al procesar la factura', 'error');
        }
    } catch (error) {
        console.error('Error in procesarTimbrado:', error);
        Swal.fire('Error de Conexión', 'No se pudo comunicar con el servicio de timbrado', 'error');
    }
}

// Función para guardar cambios rápidos del cliente
async function guardarClienteRapido() {
    const id = document.getElementById('edit-cliente-id').value;
    if (!id) {
        Swal.fire('Error', 'No se ha identificado el cliente a editar', 'error');
        return;
    }

    try {
        Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });
        const token = localStorage.getItem('token');

        // 1. Obtener datos actuales del cliente para no borrar otros campos
        const getResponse = await fetch(`/api/clientes/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!getResponse.ok) throw new Error('Error al obtener datos actuales del cliente');
        const currentData = await getResponse.json();

        // 2. Preparar payload con datos actuales + cambios del modal
        const payload = {
            ...currentData, // Mantiene representante, telefono, curp, etc.
            nombre: document.getElementById('edit-cliente-nombre').value,
            rfc: document.getElementById('edit-cliente-rfc').value,
            razon_social: document.getElementById('edit-cliente-nombre').value, // Asumimos Razón Social = Nombre en este form simple
            fact_rfc: document.getElementById('edit-cliente-rfc').value,
            codigo_postal: document.getElementById('edit-cliente-cp').value,
            regimen_fiscal: document.getElementById('edit-cliente-regimen').value,
            uso_cfdi: document.getElementById('edit-cliente-uso-cfdi').value,
            email: document.getElementById('edit-cliente-email').value,
            // Asegurar que tipo_cliente y empresa se envíen si existen en currentData
            tipo_cliente: currentData.tipo || currentData.tipo_cliente || 'Corporativo',
            empresa: currentData.empresa || currentData.razon_social
        };

        // 3. Enviar actualización
        const response = await fetch(`/api/clientes/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            Swal.fire('Éxito', 'Cliente actualizado correctamente', 'success');
            document.getElementById('modal-editar-cliente-rapido').style.display = 'none';
            // Actualizar vista previa si es el cliente actual
            // Simular estructura que espera renderizarDatosDocumento
            // Nota: renderizarDatosDocumento espera { cliente: ... } o similar
            // Si currentData tiene la estructura de BD, payload tambien.
            // renderizarDatosDocumento usa: razon_social, rfc, codigo_postal, regimen_fiscal, uso_cfdi
            await renderizarDatosDocumento({
                success: true,
                cliente: {
                    ...payload,
                    id_cliente: id,
                    // Asegurar mapeo correcto para renderizarDatosDocumento
                    nombre: payload.nombre,
                    // direccion: payload.direccion || payload.domicilio // Si se necesitara
                }
            });
        } else {
            throw new Error(result.error || 'Error al actualizar');
        }

    } catch (error) {
        console.error('Error en guardarClienteRapido:', error);
        Swal.fire('Error', error.message, 'error');
    }
}

const TIMB_PILL_CLIENTE_BASE_STYLE = 'border-radius:20px;padding:4px 12px;font-size:0.8rem;cursor:pointer;border:1px solid #cbd5e1;background:#fff;color:#475569;';
const TIMB_PILL_CLIENTE_SELECTED_STYLE = 'border-radius:20px;padding:4px 12px;font-size:0.8rem;cursor:pointer;border:1px solid #2979ff;background:#2979ff;color:#fff;';

const CLIENTE_FRECUENTE_PRESETS = {
    xaxx: {
        rfc: 'XAXX010101000',
        nombre: '"PUBLICO EN GENERAL"',
        cp: '88730',
        regimen: '616',
        regimenLabel: 'Sin obligaciones fiscales',
        uso: 'S01'
    },
    xexx: {
        rfc: 'XEXX010101000',
        nombre: '"EXTRANJERO"',
        cp: '88730',
        regimen: '616',
        regimenLabel: 'Sin obligaciones fiscales',
        uso: 'S01'
    }
};

function obtenerCpEmisorTimbrado() {
    const cp = document.getElementById('emisor-cp')?.value?.trim();
    return cp || '00000';
}

function limpiarClienteFrecuente() {
    document.querySelectorAll('.timb-pill-cliente-frecuente').forEach((pill) => {
        pill.style.cssText = TIMB_PILL_CLIENTE_BASE_STYLE;
    });
}

function seleccionarPillClienteFrecuente(pillEl) {
    document.querySelectorAll('.timb-pill-cliente-frecuente').forEach((pill) => {
        pill.style.cssText = pill === pillEl ? TIMB_PILL_CLIENTE_SELECTED_STYLE : TIMB_PILL_CLIENTE_BASE_STYLE;
    });
}

function aplicarPresetClienteFrecuente(presetKey) {
    const preset = CLIENTE_FRECUENTE_PRESETS[presetKey];
    if (!preset) return;

    const nombreField = document.getElementById('timb-cliente-nombre');
    const direccionField = document.getElementById('timb-cliente-direccion');

    if (nombreField) {
        nombreField.textContent = preset.nombre;
        nombreField.style.color = '#1e293b';
    }
    if (direccionField) direccionField.textContent = '-';

    document.getElementById('timb-cliente-rfc').value = preset.rfc;
    document.getElementById('timb-cliente-cp').value = preset.cp;
    document.getElementById('timb-cliente-regimen').value = preset.regimen;
    document.getElementById('timb-cliente-uso').value = preset.uso;
    document.getElementById('timb-cliente-id').value = '';
    document.getElementById('timb-cliente-colonia').value = '';
    document.getElementById('timb-cliente-localidad').value = '';
    document.getElementById('timb-cliente-municipio').value = '';
    document.getElementById('timb-cliente-estado').value = '';
    document.getElementById('timb-cliente-pais').value = '';

    const rfcDisplay = document.getElementById('timb-cliente-rfc-display');
    const regimenDisplay = document.getElementById('timb-cliente-regimen-display');
    if (rfcDisplay) rfcDisplay.textContent = preset.rfc;
    if (regimenDisplay) regimenDisplay.textContent = preset.regimenLabel;
}

function seleccionarClienteFrecuente(presetKey, pillEl) {
    seleccionarPillClienteFrecuente(pillEl);
    if (presetKey === 'otro') return;
    aplicarPresetClienteFrecuente(presetKey);
}

// Función para abrir buscador de cliente (cambiar cliente en timbrado)
function abrirBuscadorCambiarCliente() {
    limpiarClienteFrecuente();
    // Crear HTML del modal con búsqueda en tiempo real
    const html = `
        <div style="text-align: left;">
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #232323;">Buscar Cliente:</label>
                <div style="display: flex; gap: 8px; position: relative;">
                    <input type="text" id="buscar-cliente-modal-input" placeholder="Escribe nombre, RFC o folio..." 
                        style="flex: 1; padding: 12px 16px; border-radius: 8px; border: 2px solid #e3e8ef; font-size: 1rem; transition: border-color 0.2s;" 
                        autocomplete="off" />
                </div>
                <div id="resultados-cliente-modal" style="max-height: 350px; overflow-y: auto; border: 1px solid #e3e8ef; border-radius: 8px; margin-top: 12px; display: none; background: white;">
                    <!-- Resultados aquí -->
                </div>
            </div>
        </div>
    `;

    Swal.fire({
        title: 'Cambiar Cliente',
        html: html,
        width: '650px',
        didOpen: () => {
            const inputBuscar = document.getElementById('buscar-cliente-modal-input');
            const container = document.getElementById('resultados-cliente-modal');

            // Focus en input
            inputBuscar.focus();

            // Crear función de búsqueda en tiempo real CON DEBOUNCE
            let debounceTimer;
            inputBuscar.addEventListener('input', (e) => {
                const valor = e.target.value;

                clearTimeout(debounceTimer);

                if (valor.trim().length < 2) {
                    container.style.display = 'none';
                    return;
                }

                // Debounce 300ms antes de buscar
                debounceTimer = setTimeout(async () => {
                    await buscarClientesModal(valor, container);
                }, 300);
            });

            // Permitir búsqueda al presionar Enter
            inputBuscar.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(debounceTimer);
                    buscarClientesModal(e.target.value, container);
                }
            });
        }
    });
}

// Función auxiliar para buscar clientes EN TIEMPO REAL (para el modal)
async function buscarClientesModal(valor, container) {
    const valorTrim = valor.trim();

    if (valorTrim.length < 2) {
        container.style.display = 'none';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/facturas/search-document/${encodeURIComponent(valorTrim)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        container.innerHTML = '';

        if (response.ok && result.success) {
            // 1. Si es una Cotización VENTA
            if (result.type === 'VENTA') {
                const div = document.createElement('div');
                div.style.cssText = `
                    padding: 14px 16px;
                    border-bottom: 1px solid #f1f5f9;
                    cursor: pointer;
                    transition: background 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                `;
                div.innerHTML = `
                    <div style="font-size: 1.2rem;">📄</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #232323;">Cotización: ${valorTrim}</div>
                        <div style="font-size: 0.85rem; color: #64748b;">
                            Cliente: ${result.cotizacion?.cliente_nombre || result.cliente?.nombre || 'Sin asignar'}
                        </div>
                    </div>
                `;
                div.onmouseover = () => div.style.background = '#f8fafc';
                div.onmouseout = () => div.style.background = 'transparent';
                div.onclick = async () => {
                    if (result.cliente) {
                        await renderizarDatosDocumento(result);
                    } else {
                        Swal.fire('Aviso', 'Esta cotización no tiene cliente asignado. Aquí debajo puedes elegir uno.', 'info');
                    }
                };
                container.appendChild(div);
            }

            // 2. Si es una lista de Clientes
            if (result.type === 'CLIENTE_LIST' && result.clientes && result.clientes.length > 0) {
                result.clientes.forEach(cl => {
                    const div = document.createElement('div');
                    div.style.cssText = `
                        padding: 14px 16px;
                        border-bottom: 1px solid #f1f5f9;
                        cursor: pointer;
                        transition: background 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    `;
                    div.innerHTML = `
                        <div style="font-size: 1.2rem;">👤</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #232323;">${cl.razon_social || cl.nombre}</div>
                            <div style="font-size: 0.85rem; color: #64748b;">RFC: ${cl.rfc || 'N/A'} | CP: ${cl.codigo_postal || 'N/A'}</div>
                        </div>
                    `;
                    div.onmouseover = () => div.style.background = '#f8fafc';
                    div.onmouseout = () => div.style.background = 'transparent';
                    div.onclick = async () => {
                        console.log('[MODAL-CLIENTE] Cliente seleccionado:', cl);
                        // Solo rellenar datos del cliente, sin perder la cotización actual
                        rellenarDatosCliente(cl);
                        // Guardar ID del cliente en el campo oculto
                        const idElem = document.getElementById('timb-cliente-id');
                        if (idElem) idElem.value = cl.id || cl.id_cliente || '';
                        console.log('[SUCCESS] Cliente cargado en factura. Mantiene conceptos existentes.');
                        Swal.close();
                    };
                    container.appendChild(div);
                });
            }
        }

        container.style.display = container.innerHTML ? 'block' : 'none';

        if (!container.innerHTML) {
            container.innerHTML = `<div style="padding: 14px 16px; color: #64748b; text-align: center;">No se encontraron resultados</div>`;
            container.style.display = 'block';
        }
    } catch (error) {
        console.error('[ERROR] Error en búsqueda de clientes modal:', error);
        container.innerHTML = `<div style="padding: 14px 16px; color: #dc2626; text-align: center;">Error al buscar clientes</div>`;
        container.style.display = 'block';
    }
}

// Función para actualizar el display del cliente en la sección flotante
function actualizarVistaCliente() {
    const nombre = document.getElementById('timb-cliente-nombre').textContent;
    const rfc = document.getElementById('timb-cliente-rfc').value;
    const regimen = document.getElementById('timb-cliente-regimen').value;

    document.getElementById('timb-cliente-rfc-display').textContent = rfc || '-';
    document.getElementById('timb-cliente-regimen-display').textContent = regimen || '-';
}

