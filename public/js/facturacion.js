// public/js/facturacion.js
// Variables globales
let conceptos = [];
let contadorConceptos = 0;
let facturas = [];
let estadisticas = {};
let aplicaIvaFiscal = true; // Flag global para IVA en timbrado

// Formatear números como dinero MXN
function formatMoney(amount) {
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount || 0));
}

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
function debounce(func, wait) {
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

            facturas = result.data.facturas;
            estadisticas = result.data.estadisticas;

            if (facturas.length > 0) {
                console.log('>>> INSPECCIÓN DE FACTURA 0 PARA KPI <<<');
                console.log('- Objeto completo:', facturas[0]);
                console.log('- f.fecha:', facturas[0].fecha);
                console.log('- f.fecha_emision:', facturas[0].fecha_emision);
                console.log('- f.fechas:', facturas[0].fechas);
                console.log('- f.estado:', facturas[0].estado);
            }

            // Actualizar estadísticas
            actualizarEstadisticas();

            // Actualizar tabla de facturas
            actualizarTablaFacturas();
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
        searchInput.addEventListener('input', debounce(() => {
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

function renderizarGraficosDashboard() {
    if (typeof Chart === 'undefined' || !estadisticas.evolucion) return;

    // 1. Gráfico de Evolución (Barras)
    const evolutionCtx = document.getElementById('evolutionChart');
    if (evolutionCtx) {
        if (evolutionChart) evolutionChart.destroy();

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
        if (distributionChart) distributionChart.destroy();

        const distData = estadisticas.distribucion || [];
        const labels = distData.map(d => d.estado);
        const totals = distData.map(d => parseInt(d.cantidad));

        // Colores según estado
        const colorMap = {
            'Timbrada': '#2979ff',
            'Timbrado': '#2979ff',
            'Pendiente': '#ff9800',
            'Pendiente PPD': '#ff9800',
            'Cancelada': '#f44336',
            'Cancelado': '#f44336',
            'Borrador': '#94a3b8'
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
}

// Función para actualizar tabla de facturas
function actualizarTablaFacturas() {
    const tbody = document.querySelector('.facturas-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    facturas.forEach(factura => {
        const row = document.createElement('tr');

        // Determinar clase de estado y texto según imagen
        let estadoClass = '';
        let estadoTexto = factura.estado || 'BORRADOR';

        switch (estadoTexto.toUpperCase()) {
            case 'TIMBRADA':
            case 'TIMBRADO':
                estadoClass = 'badge-timbrado';
                estadoTexto = 'TIMBRADO';
                break;
            case 'PENDIENTE':
            case 'PENDIENTE PPD':
                estadoClass = 'badge-pendiente';
                estadoTexto = 'PENDIENTE PPD';
                break;
            case 'CANCELADA':
            case 'CANCELADO':
                estadoClass = 'badge-cancelado';
                estadoTexto = 'CANCELADO';
                break;
            default:
                estadoClass = 'badge-borrador';
                estadoTexto = 'BORRADOR';
        }

        row.innerHTML = `
            <td class="text-center"><input type="checkbox"></td>
            <td>
                <span class="badge ${estadoClass}">${estadoTexto}</span>
            </td>
            <td>
                <div class="folio-number">${factura.folio || 'S/F'}</div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="color: #888;">${factura.uuid ? factura.uuid.substring(0, 4) + '...' + factura.uuid.substring(factura.uuid.length - 4) : 'No timbrado'}</span>
                    ${factura.uuid ? `<i class="fa fa-copy" style="color: #2979ff; cursor: pointer; font-size: 0.9em;" title="Copiar UUID"></i>` : ''}
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
                <span style="color: #555;">${factura.fechas?.emision || '-'}</span>
            </td>
            <td>
                <span class="badge badge-pue">${factura.metodo_pago || 'PUE'}</span>
            </td>
            <td>
                <strong style="color: #333;">$${Number(factura.monto || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong><br>
                <small style="color: #888;">MXN</small>
            </td>
            <td class="text-right">
                <div class="dropdown">
                    <button class="btn-icon" onclick="toggleFacturaMenu(event, this)" style="background:none; border:none; color:#888; cursor:pointer; padding: 8px;">
                        <i class="fa fa-ellipsis-v"></i>
                    </button>
                    <div class="actions-menu">
                        <a href="#" onclick="verFactura('${factura.uuid}')">
                            <i class="fa fa-eye" style="color: #2979ff;"></i> Ver Detalle
                        </a>
                        <a href="#" onclick="descargarPDF('${factura.uuid}')">
                            <i class="fa fa-file-pdf" style="color: #f44336;"></i> Descargar PDF
                        </a>
                        <a href="#" onclick="cancelarFacturaWeb('${factura.uuid}')" style="color: #d32f2f;">
                            <i class="fa fa-ban"></i> Cancelar Fiscal
                        </a>
                    </div>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// Lógica para el toggle del menú
function toggleFacturaMenu(event, btn) {
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


// Función para cancelar factura
async function cancelarFacturaWeb(uuid) {
    try {
        const { value: motivo } = await Swal.fire({
            title: '¿Estás seguro de cancelar esta factura?',
            text: "Esta acción es irreversible ante el SAT.",
            icon: 'warning',
            input: 'select',
            inputOptions: {
                '01': '01 - Comprobante emitido con errores con relación',
                '02': '02 - Comprobante emitido con errores sin relación',
                '03': '03 - No se llevó a cabo la operación',
                '04': '04 - Operación nominativa relacionada en una factura global'
            },
            inputPlaceholder: 'Selecciona el motivo de cancelación',
            showCancelButton: true,
            confirmButtonColor: '#f44336',
            cancelButtonColor: '#2979ff',
            confirmButtonText: 'Sí, cancelar factura',
            cancelButtonText: 'No, regresar',
            inputValidator: (value) => {
                if (!value) {
                    return 'Debes seleccionar un motivo de cancelación';
                }
            }
        });

        if (motivo) {
            Swal.fire({
                title: 'Cancelando...',
                text: 'Comunicándose con Facturama y el SAT',
                didOpen: () => { Swal.showLoading(); }
            });

            const token = localStorage.getItem('token');
            const response = await fetch(`/api/facturas/${uuid}/cancelar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ motivo: motivo })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                Swal.fire('¡Cancelada!', 'La factura ha sido cancelada fiscalmente.', 'success');
                cargarFacturas(); // Recargar tabla
            } else {
                Swal.fire('Error', result.error || 'No se pudo cancelar la factura', 'error');
            }
        }
    } catch (error) {
        console.error('Error en cancelarFacturaWeb:', error);
        Swal.fire('Error', 'Ocurrió un error al procesar la cancelación', 'error');
    }
}

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

    cargarPDFPreview(uuid);

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
                const emisorNombre = document.getElementById('timb-emisor-nombre')?.textContent || 'SAPT';
                const clienteNombre = f.cliente_nombre || 'Cliente';
                const folio = f.folio || uuid.substring(0, 8);
                const total = parseFloat(f.total).toFixed(2);

                // Calcular vencimiento (ej. 30 días o fecha de emisión)
                const fechaEmision = new Date(f.fecha_emision);
                const fechaVencimiento = new Date(fechaEmision);
                fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);
                const vencimientoStr = fechaVencimiento.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
                const mesActual = fechaEmision.toLocaleDateString('es-MX', { month: 'long' });

                const template = `Asunto: Factura ${folio} - ${emisorNombre} - ${mesActual}

Estimado/a ${clienteNombre}:

Espero que este mensaje le encuentre bien.

Adjunto a este correo encontrará la factura ${folio} por un monto de $${total}, correspondiente a los servicios de ${f.uso_cfdi || 'Servicios'} prestados recientemente.

Le recordamos que la fecha límite de pago es el día ${vencimientoStr}. Agradeceríamos que, una vez realizado el movimiento, nos enviara el comprobante de pago para nuestros registros.

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
async function cargarPDFPreview(uuid) {
    const token = localStorage.getItem('token');
    const url = `/api/facturas/${uuid}/pdf?inline=true&token=${token}`;
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

        const response = await fetch(`/api/facturas/${facturaActual}/enviar-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                destinatario: email,
                mensaje: mensaje
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
    document.getElementById('asunto-email').value = 'Factura Electrónica - ScaffoldPro';
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
        resetForm();
    };

    // Cerrar modal haciendo clic fuera
    modal.onclick = function (e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            resetForm();
        }
    };

    // Cerrar modal con Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            resetForm();
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
                resetForm();
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
function resetForm() {
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
            renderDocumentData(result);
        } else {
            Swal.fire('No encontrado', result.error || 'No se encontró el documento o cliente', 'warning');
        }
    } catch (error) {
        console.error('Error en buscarDocumento:', error);
        Swal.fire('Error', 'Ocurrió un error al buscar el documento', 'error');
    }
}

// --- LÓGICA DE BÚSQUEDA EN TIEMPO REAL (PHASE 3) ---
let debounceTimer;
function debounce(func, delay) {
    return (...args) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

const buscarclientefiscal = debounce(async (valor) => {
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
        div.onclick = () => {
            renderDocumentData(data);
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
            div.onclick = () => {
                document.getElementById('search-documento').value = cl.razon_social || cl.nombre;
                // Envolvemos el cliente en el formato esperado por renderDocumentData
                renderDocumentData({ success: true, type: 'CLIENTE', cliente: cl });
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
    const input = document.getElementById('search-documento');
    if (e.target !== container && e.target !== input) {
        container.style.display = 'none';
    }
});

// Función para renderizar los datos en la sección de timbrado (REDISEÑADO)
function renderDocumentData(data) {
    const cliente = data.cliente;

    // 1. Limpiar y llenar campos del encabezado
    document.getElementById('timb-cliente-nombre').textContent = cliente ? (cliente.razon_social || cliente.nombre) : 'Equipo Detectado';
    document.getElementById('timb-cliente-direccion').textContent = cliente ? (cliente.direccion || 'Dirección no disponible') : '-';

    // Mostrar/Ocultar botón de editar cliente
    const btnEdit = document.getElementById('btn-editar-cliente-rapido');
    if (btnEdit) btnEdit.style.display = cliente ? 'block' : 'none';

    // Guardar datos ocultos para el timbrado
    if (cliente) {
        document.getElementById('timb-cliente-rfc').value = cliente.rfc || '';
        document.getElementById('timb-cliente-cp').value = cliente.codigo_postal || cliente.cp || '';
        document.getElementById('timb-cliente-regimen').value = cliente.regimen_fiscal || '';
        document.getElementById('timb-cliente-uso').value = cliente.uso_cfdi || 'G03';
        document.getElementById('timb-cliente-colonia').value = cliente.colonia || '';
        document.getElementById('timb-cliente-localidad').value = cliente.localidad || '';
        document.getElementById('timb-cliente-municipio').value = cliente.municipio || '';
        document.getElementById('timb-cliente-estado').value = cliente.estado || '';
        document.getElementById('timb-cliente-pais').value = cliente.pais || '';
        const idElem = document.getElementById('timb-cliente-id');
        if (idElem) idElem.value = cliente.id_cliente || cliente.id || '';
    } else {
        // Reset fields if no client
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
    }

    // Set fecha emisión hoy
    document.getElementById('timb-fecha-emision').value = new Date().toLocaleDateString();

    // 2. Limpiar y llenar la tabla de conceptos
    const tbody = document.getElementById('products-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        if (data.type === 'VENTA' && data.cotizacion) {
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

// Búsqueda en tiempo real dentro del modal CONCEPTOS (PHASE 4)
const buscarConceptosModal = debounce(async (valor, container) => {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/facturas/search-concepts/${encodeURIComponent(valor)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (response.ok && data.success && data.results.length > 0) {
            renderResultadosModal(data.results, container);
        } else {
            container.style.display = 'none';
        }
    } catch (error) {
        console.error('Error buscando conceptos en modal:', error);
    }
}, 300);

function renderResultadosModal(results, container) {
    container.innerHTML = '';
    results.forEach(res => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <span class="client-title">${res.title}</span>
            <span class="client-info">${res.info}</span>
        `;
        div.onclick = () => {
            if (res.type === 'COTIZACION') {
                container.style.display = 'none';
                Swal.close();
                cargarConceptosDesdeCotizacion(res.data, res.tipo || 'VENTA');
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
                        <img src="https://img.icons8.com/color/48/money-bag-mexican-pesos.png" style="width: 32px; height: 32px; margin-bottom: 5px;"><br>
                        <span style="font-size: 0.75rem; font-weight: 600;">Efectivo</span>
                        <input type="text" value="${totalNumeric.toFixed(2)}" readonly style="width: 100%; border: 1px solid #d1d5db; border-radius: 4px; margin-top: 5px; text-align: center; font-size: 0.8rem; background: #fff;">
                    </div>
                    <div class="pago-method-item" data-code="CARD" data-label="Tarjeta" style="cursor:pointer; padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px; transition: all 0.2s;">
                        <img src="https://img.icons8.com/color/48/credit-card.png" style="width: 32px; height: 32px; margin-bottom: 5px;"><br>
                        <span style="font-size: 0.75rem; font-weight: 600;">Tarjeta</span>
                        <input type="text" value="0.00" readonly style="width: 100%; border: 1px solid #d1d5db; border-radius: 4px; margin-top: 5px; text-align: center; font-size: 0.8rem; background: #f9fafb;">
                    </div>
                    <div class="pago-method-item" data-code="08" data-label="08 - Vales de despensa" style="cursor:pointer; padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px; transition: all 0.2s;">
                        <img src="https://img.icons8.com/color/48/voucher.png" style="width: 32px; height: 32px; margin-bottom: 5px;"><br>
                        <span style="font-size: 0.75rem; font-weight: 600;">Vales</span>
                        <input type="text" value="0.00" readonly style="width: 100%; border: 1px solid #d1d5db; border-radius: 4px; margin-top: 5px; text-align: center; font-size: 0.8rem; background: #f9fafb;">
                    </div>
                    <div class="pago-method-item" data-code="02" data-label="02 - Cheque nominativo" style="cursor:pointer; padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px; transition: all 0.2s;">
                        <img src="https://img.icons8.com/color/48/bank-card.png" style="width: 32px; height: 32px; margin-bottom: 5px;"><br>
                        <span style="font-size: 0.75rem; font-weight: 600;">Cheque</span>
                        <input type="text" value="0.00" readonly style="width: 100%; border: 1px solid #d1d5db; border-radius: 4px; margin-top: 5px; text-align: center; font-size: 0.8rem; background: #f9fafb;">
                    </div>
                    <div class="pago-method-item" data-code="03" data-label="03 - Transferencia" style="cursor:pointer; padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px; transition: all 0.2s;">
                        <img src="https://img.icons8.com/color/48/money-transfer.png" style="width: 32px; height: 32px; margin-bottom: 5px;"><br>
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
function toggleComprobanteMode() {
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
         document.getElementById('nc-factura-origen-details').textContent = `${fact.folio || fact.uuid || ''} - ${formatMoney(fact.total)}`;
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
       } else if (['04','05'].includes(facturaData.creditNote.motivoSat) && (!facturaData.creditNote.observacion || facturaData.creditNote.observacion.length < 3)) {
           msg = 'Observación es obligatoria para el motivo seleccionado.';
       } else {
           // calcular total de conceptos
           const ncTotal = facturaData.conceptos ? facturaData.conceptos.reduce((s,c)=>s + ((c.cantidad||0)*(c.valorUnitario||0) - (c.descuento||0)),0) : 0;
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
       tipoEl.addEventListener('change', toggleComprobanteMode);
       toggleComprobanteMode();
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
           if (['04','05'].includes(motivoEl.value)) {
               obsEl.setAttribute('required', 'required');
           } else {
               obsEl.removeAttribute('required');
           }
       });
   }
});

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
            observaciones: obs
        },
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

        const token = localStorage.getItem('token');
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
            // Simular estructura que espera renderDocumentData
            // Nota: renderDocumentData espera { cliente: ... } o similar
            // Si currentData tiene la estructura de BD, payload tambien.
            // renderDocumentData usa: razon_social, rfc, codigo_postal, regimen_fiscal, uso_cfdi
            renderDocumentData({
                success: true,
                cliente: {
                    ...payload,
                    id_cliente: id,
                    // Asegurar mapeo correcto para renderDocumentData
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
