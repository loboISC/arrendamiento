const debounce = (fn, ms = 300) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

/**
 * Obtener headers con autenticación
 */
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

/**
 * Sistema de Notificaciones
 */
const notificacionesManager = {
    notificaciones: [],
    leidas: new Set(),

    agregar(contrato, tipo) {
        const id = `${contrato.id_contrato}-${tipo}-${Date.now()}`;
        const estadoInfo = calcularEstadoDinamico(contrato);

        const notif = {
            id,
            id_contrato: contrato.id_contrato,
            numero_contrato: contrato.numero_contrato,
            tipo,
            estado: estadoInfo.estado,
            estadoIcon: estadoInfo.icon,
            estadoColor: estadoInfo.color,
            bgColor: estadoInfo.bgColor,
            timestamp: new Date(),
            mensaje: this.generarMensaje(contrato, tipo, estadoInfo)
        };

        // Evitar duplicados en los últimos 5 minutos
        const hace5Min = new Date(Date.now() - 5 * 60 * 1000);
        const existe = this.notificaciones.some(n =>
            n.id_contrato === contrato.id_contrato &&
            n.tipo === tipo &&
            n.timestamp > hace5Min
        );

        if (!existe) {
            this.notificaciones.unshift(notif);
            if (this.notificaciones.length > 20) {
                this.notificaciones = this.notificaciones.slice(0, 20);
            }
            this.guardarLocal();
            this.actualizar();
        }
    },

    generarMensaje(contrato, tipo, estadoInfo) {
        const diasRestantes = Math.ceil((new Date(contrato.fecha_fin) - new Date()) / (1000 * 60 * 60 * 24));

        switch (tipo) {
            case 'estado-activo':
                return `Contrato ${contrato.numero_contrato} está Activo`;
            case 'estado-por-concluir':
                return `Contrato ${contrato.numero_contrato} está Por Concluir`;
            case 'estado-proximo-concluir':
                return `⚠️ Contrato ${contrato.numero_contrato} próximo a concluir (${diasRestantes} días)`;
            case 'estado-concluido':
                return `✓ Contrato ${contrato.numero_contrato} ha sido Concluido`;
            default:
                return `Actualización en contrato ${contrato.numero_contrato}`;
        }
    },

    limpiar() {
        this.notificaciones = [];
        this.leidas.clear();
        this.guardarLocal();
        this.actualizar();
    },

    guardarLocal() {
        try {
            localStorage.setItem('notificaciones_contratos', JSON.stringify({
                notificaciones: this.notificaciones,
                leidas: Array.from(this.leidas)
            }));
        } catch (e) {
            console.error('Error guardando notificaciones:', e);
        }
    },

    cargarLocal() {
        try {
            const data = JSON.parse(localStorage.getItem('notificaciones_contratos') || '{}');
            this.notificaciones = data.notificaciones || [];
            this.leidas = new Set(data.leidas || []);
        } catch (e) {
            console.error('Error cargando notificaciones:', e);
        }
    },

    actualizar() {
        this.actualizarBadge();
        this.renderizar();
    },

    actualizarBadge() {
        const badge = document.getElementById('notification-badge');
        const noLeidas = this.notificaciones.filter(n => !this.leidas.has(n.id)).length;
        if (badge) {
            badge.textContent = noLeidas;
            badge.style.display = noLeidas > 0 ? 'flex' : 'none';
        }
    },

    renderizar() {
        const body = document.getElementById('notificaciones-body');
        if (!body) return;

        if (this.notificaciones.length === 0) {
            body.innerHTML = `
                <div class="notificacion-vacia">
                    <i class="fa fa-check-circle"></i>
                    <p>No hay notificaciones pendientes</p>
                </div>
            `;
            return;
        }

        body.innerHTML = this.notificaciones.map(notif => `
            <div class="notificacion-item ${this.leidas.has(notif.id) ? '' : 'no-read'}" onclick="notificacionesManager.marcarLeida('${notif.id}')">
                <div class="notificacion-icon ${notif.tipo.replace('estado-', '')}">
                    <i class="fa ${notif.estadoIcon}"></i>
                </div>
                <div class="notificacion-content">
                    <p class="notificacion-title">${notif.numero_contrato}</p>
                    <p class="notificacion-message">${notif.mensaje}</p>
                    <p class="notificacion-time">${this.formatearTiempo(notif.timestamp)}</p>
                </div>
            </div>
        `).join('');
    },

    marcarLeida(id) {
        this.leidas.add(id);
        this.guardarLocal();
        this.actualizar();
    },

    formatearTiempo(timestamp) {
        const ahora = new Date();
        const tiempo = new Date(timestamp);
        const diff = Math.floor((ahora - tiempo) / 1000);

        if (diff < 60) return 'Hace un momento';
        if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
        return tiempo.toLocaleDateString('es-MX');
    }
};

/**
 * Toggle para mostrar/ocultar notificaciones
 */
function toggleNotifications(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('notificaciones-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

/**
 * Limpiar todas las notificaciones
 */
function limpiarNotificaciones() {
    if (confirm('¿Deseas limpiar todas las notificaciones?')) {
        notificacionesManager.limpiar();
    }
}

/**
 * Calcular estado dinámico basado en fechas
 * Retorna: {estado, color, icon}
 */
function calcularEstadoDinamico(contrato) {
    // Si tiene estado personalizado en BD, usarlo
    const estadoManual = (contrato.estado || '').toLowerCase();
    if (estadoManual.includes('prórroga')) {
        return {
            estado: 'Activo con prórroga',
            color: '#1d4ed8',
            bgColor: '#e0ebff',
            icon: 'fa-sync-alt'
        };
    }

    if (contrato.estado === 'Concluido') {
        return {
            estado: 'Concluido',
            color: '#d32f2f',
            bgColor: '#ffebee',
            icon: 'fa-check-circle'
        };
    }

    const hoy = new Date();
    const inicio = new Date(contrato.fecha_contrato);
    const fin = new Date(contrato.fecha_fin);

    // Si la fecha fin ya pasó
    if (hoy > fin) {
        return {
            estado: 'Concluido',
            color: '#d32f2f',
            bgColor: '#ffebee',
            icon: 'fa-check-circle'
        };
    }

    // Calcular progreso del contrato
    const duracionTotal = fin - inicio;
    const tiempoTranscurrido = hoy - inicio;
    const porcentajeProgreso = (tiempoTranscurrido / duracionTotal) * 100;

    // Si está a menos del 20% de progreso: ACTIVO (verde)
    if (porcentajeProgreso < 20) {
        return {
            estado: 'Activo',
            color: '#388e3c',
            bgColor: '#e8f5e9',
            icon: 'fa-play-circle'
        };
    }

    // Si está entre 20% y 80%: POR CONCLUIR (amarillo)
    if (porcentajeProgreso >= 20 && porcentajeProgreso < 80) {
        return {
            estado: 'Por Concluir',
            color: '#f57c00',
            bgColor: '#fff3e0',
            icon: 'fa-clock-o'
        };
    }

    // Si está a más del 80%: PRÓXIMO A CONCLUIR (naranja-rojo)
    return {
        estado: 'Próximo a Concluir',
        color: '#e64a19',
        bgColor: '#ffe0b2',
        icon: 'fa-exclamation-circle'
    };
}

// Estado global para filtros y notificaciones
let contratosGlobal = [];
let contratosAnteriorEstado = {};

/**
 * Cargar y mostrar lista de contratos
 */
async function cargarContratos() {
    try {
        const response = await fetch(CONTRATOS_URL, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Error al cargar contratos');
        }

        const nuevosContratos = await response.json();

        // Detectar cambios de estado para notificaciones
        nuevosContratos.forEach(contrato => {
            const estadoActual = calcularEstadoDinamico(contrato);
            const estadoAnterior = contratosAnteriorEstado[contrato.id_contrato];

            // Si es la primera carga o cambió el estado, agregar notificación
            if (!estadoAnterior || estadoAnterior.estado !== estadoActual.estado) {
                const tipo = `estado-${estadoActual.estado.toLowerCase().replace(/\s+/g, '-')}`;
                notificacionesManager.agregar(contrato, tipo);
            }

            // Guardar el estado actual para la próxima comparación
            contratosAnteriorEstado[contrato.id_contrato] = estadoActual;
        });

        contratosGlobal = nuevosContratos;
        aplicarFiltrosYBusqueda();

        // Actualizar calendario si existe
        actualizarCalendario();
    } catch (error) {
        console.error('Error cargando contratos:', error);
        mostrarMensaje('Error al cargar contratos', 'error');
    }
}

/**
 * Actualizar calendario con los contratos cargados
 */
function actualizarCalendario() {
    // Si el calendario está visible, actualizarlo
    const calendarSection = document.getElementById('calendar');
    if (calendarSection && calendarSection.classList.contains('active')) {
        // Llamar a showCalendar si existe en el scope global
        if (typeof showCalendar === 'function') {
            showCalendar();
        }
    }
}

/**
 * Aplicar filtros y búsqueda
 */
function aplicarFiltrosYBusqueda() {
    const busqueda = document.getElementById('search-contrato')?.value?.toLowerCase() || '';
    const filtroEstado = document.getElementById('filter-estado')?.value || '';
    const filtroCliente = document.getElementById('filter-cliente')?.value || '';
    const filtroFechaInicio = document.getElementById('filter-fecha-inicio')?.value || '';
    const filtroFechaFin = document.getElementById('filter-fecha-fin')?.value || '';

    let contratosFiltrados = contratosGlobal.filter(contrato => {
        // Búsqueda por número de contrato
        if (busqueda && !contrato.numero_contrato?.toLowerCase().includes(busqueda)) {
            return false;
        }

        // Filtro por estado
        if (filtroEstado && contrato.estado !== filtroEstado) {
            return false;
        }

        // Filtro por cliente
        if (filtroCliente && !contrato.nombre_cliente?.toLowerCase().includes(filtroCliente.toLowerCase())) {
            return false;
        }

        // Filtro por fecha inicio
        if (filtroFechaInicio) {
            const fechaContrato = new Date(contrato.fecha_contrato);
            const fechaFiltro = new Date(filtroFechaInicio);
            if (fechaContrato < fechaFiltro) {
                return false;
            }
        }

        // Filtro por fecha fin
        if (filtroFechaFin) {
            const fechaContrato = new Date(contrato.fecha_contrato);
            const fechaFiltro = new Date(filtroFechaFin);
            if (fechaContrato > fechaFiltro) {
                return false;
            }
        }

        return true;
    });

    mostrarContratosEnTabla(contratosFiltrados);
}

/**
 * Mostrar contratos en la tabla
 */
function mostrarContratosEnTabla(contratos) {
    const tbody = document.getElementById('contracts-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (contratos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No hay contratos registrados</td></tr>';
        return;
    }

    contratos.forEach(contrato => {
        const row = document.createElement('tr');

        // Contar cantidad de items
        const cantidadItems = contrato.items ? contrato.items.length : 0;

        // Formatear fechas
        const fechaInicioRaw = contrato.fecha_contrato || contrato.fecha_inicio;
        const fechaInicio = fechaInicioRaw ? new Date(fechaInicioRaw).toLocaleDateString('es-MX') : 'N/A';
        const fechaFin = contrato.fecha_fin ? new Date(contrato.fecha_fin).toLocaleDateString('es-MX') : 'N/A';

        // Calcular estado dinámico
        const estadoInfo = calcularEstadoDinamico(contrato);

        // Formatear monto
        const monto = parseFloat(contrato.total || 0).toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN'
        });

        // Crear label de fechas con información clara
        let labelFechas = `Inicio: ${fechaInicio}<br>`;
        if (fechaFin !== 'N/A') {
            labelFechas += `Fin: ${fechaFin}`;
        } else {
            labelFechas += `Fin: N/A`;
        }

        row.innerHTML = `
            <td>
                <strong>${contrato.numero_contrato || 'N/A'}</strong><br>
                <small style="color: #999;">${cantidadItems} ${cantidadItems === 1 ? 'tipo de equipo' : 'tipos de equipo'}</small>
            </td>
            <td>
                <strong>${contrato.nombre_cliente || 'N/A'}</strong><br>
                <small style="color: #999;">${contrato.responsable || 'N/A'}</small>
            </td>
            <td>
                <span class="status-dinamico" style="
                    background-color: ${estadoInfo.bgColor};
                    color: ${estadoInfo.color};
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.9rem;
                ">
                    <i class="fa ${estadoInfo.icon}"></i>${estadoInfo.estado}
                </span>
            </td>
            <td>
                ${labelFechas}
            </td>
            <td>
                ${contrato.usuario_creacion || 'N/A'}
            </td>
            <td style="text-align: right;"><strong>${monto}</strong></td>
            <td class="table-actions">
                <a href="#" class="btn-ver" data-id="${contrato.id_contrato}" title="Ver detalles">
                    <i class="fa fa-eye"></i> Ver
                </a>
                <a href="#" class="btn-editar" data-id="${contrato.id_contrato}" title="Editar contrato">
                    <i class="fa fa-edit"></i> Editar
                </a>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Agregar event listeners a los botones
    agregarEventListenersTabla();
}

/**
 * Agregar event listeners a los botones de la tabla
 */
function agregarEventListenersTabla() {
    // Botones Ver
    document.querySelectorAll('.btn-ver').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = btn.getAttribute('data-id');
            verContrato(id);
        });
    });

    // Botones Editar
    document.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const id = btn.getAttribute('data-id');
            editarContrato(id);
        });
    });
}

/**
 * Ver detalles del contrato
 */
async function verContrato(id) {
    try {
        const response = await fetch(`${CONTRATOS_URL}/${id}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Error al cargar contrato');
        }

        const contrato = await response.json();
        mostrarDetallesContrato(contrato);
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al cargar contrato', 'error');
    }
}

/**
 * Mostrar modal con detalles del contrato
 */
function mostrarDetallesContrato(contrato) {
    // Calcular estado dinámico
    const estadoInfo = calcularEstadoDinamico(contrato);

    const numeroCotizacion = contrato.numero_cotizacion || 'N/A';
    const garantiaDb = parseFloat((contrato.monto_garantia ?? contrato.importe_garantia) || 0);

    // Crear modal de detalles mejorada
    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-detalles-contrato';
    modal.id = 'contrato-detalle-modal';

    const itemsHtml = contrato.items && contrato.items.length > 0
        ? contrato.items.map(item => `
            <tr>
                <td>${(item.clave ?? item.codigo ?? item.sku ?? item.clave_producto ?? item.id_producto ?? item.id_equipo ?? '') || 'N/A'}</td>
                <td>${item.descripcion || 'N/A'}</td>
                <td style="text-align: center;">${item.cantidad || 0}</td>
                <td style="text-align: right;">$${parseFloat(item.precio_unitario || 0).toFixed(2)}</td>
                <td style="text-align: right;"><strong>$${parseFloat(item.total || 0).toFixed(2)}</strong></td>
            </tr>
        `).join('')
        : '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #999;">Sin items registrados</td></tr>';

    const monto = parseFloat(contrato.total || 0).toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN'
    });

    const fechaInicio = new Date(contrato.fecha_contrato || contrato.fecha_inicio);
    const fechaFin = new Date(contrato.fecha_fin);
    const diasRestantes = Math.ceil((fechaFin - new Date()) / (1000 * 60 * 60 * 24));

    modal.innerHTML = `
        <div class="modal-content modal-detalles-content">
            <div class="modal-header modal-detalles-header">
                <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
                    <div style="flex: 1;">
                        <h3 style="margin: 0; color: #003366;">${contrato.numero_contrato}</h3>
                        <p style="margin: 5px 0 0 0; font-size: 0.9rem; color: #666;">${contrato.nombre_cliente}</p>
                    </div>
                    <div style="text-align: right;">
                        <span class="estado-badge" style="background-color: ${estadoInfo.bgColor}; color: ${estadoInfo.color}; padding: 8px 16px; border-radius: 20px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px;">
                            <i class="fa ${estadoInfo.icon}"></i> ${estadoInfo.estado}
                        </span>
                    </div>
                </div>
                <button class="close-modal" onclick="this.closest('.modal-overlay').remove()" style="background: none; border: none; font-size: 28px; color: #999; cursor: pointer; padding: 0; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                    <i class="fa fa-times"></i>
                </button>
            </div>

            <div class="modal-body modal-detalles-body">
                <!-- Info General -->
                <div class="info-section">
                    <h4 style="margin-top: 0; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; color: #003366;">
                        <i class="fa fa-file-contract" style="margin-right: 10px; color: #2979ff;"></i>Información General
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                        <div>
                            <label style="color: #999; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Tipo de Contrato</label>
                            <p style="margin: 5px 0 0 0; color: #333; font-weight: 500;">${contrato.tipo || 'N/A'}</p>
                        </div>
                        <div>
                            <label style="color: #999; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Cotización Ligada</label>
                            <p style="margin: 5px 0 0 0; color: #333; font-weight: 500;">${numeroCotizacion}</p>
                        </div>
                        <div>
                            <label style="color: #999; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Responsable</label>
                            <p style="margin: 5px 0 0 0; color: #333; font-weight: 500;">${contrato.responsable || 'N/A'}</p>
                        </div>
                        <div>
                            <label style="color: #999; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Elaborado por</label>
                            <p style="margin: 5px 0 0 0; color: #333; font-weight: 500;">${contrato.usuario_creacion || 'N/A'}</p>
                        </div>
                        <div>
                            <label style="color: #999; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Facturación</label>
                            <p style="margin: 5px 0 0 0; color: #333; font-weight: 500;">${contrato.requiere_factura === 'SI' ? '✓ Sí' : 'No'}</p>
                        </div>
                        <div>
                            <label style="color: #999; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Tipo de Garantía</label>
                            <p style="margin: 5px 0 0 0; color: #333; font-weight: 500;">${contrato.tipo_garantia || 'N/A'}</p>
                        </div>
                        <div>
                            <label style="color: #999; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Importe Garantía</label>
                            <p style="margin: 5px 0 0 0; color: #ff9800; font-weight: 600; font-size: 1.1rem;">$${garantiaDb.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                            <label style="color: #999; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Días de Arrendamiento</label>
                            <p style="margin: 5px 0 0 0; color: #333; font-weight: 500;">${contrato.dias_renta || '--'}</p>
                        </div>
                        <div>
                            <label style="color: #999; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Horario de Entrega</label>
                            <p style="margin: 5px 0 0 0; color: #333; font-weight: 500;">
                                ${contrato.hora_inicio ? new Date(contrato.hora_inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''} 
                                ${contrato.hora_fin ? ' - ' + new Date(contrato.hora_fin).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Fechas y Montos -->
                <div class="info-section">
                    <h4 style="margin-top: 0; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; color: #003366;">
                        <i class="fa fa-calendar" style="margin-right: 10px; color: #2979ff;"></i>Fechas y Montos
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                            <div>
                                <label style="color: #999; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Inicio</label>
                                <p style="margin: 5px 0 0 0; color: #333; font-weight: 500;">${fechaInicio.toLocaleDateString('es-MX')}</p>
                            </div>
                            <div>
                                <label style="color: #999; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Fin</label>
                                <p style="margin: 5px 0 0 0; color: #333; font-weight: 500;">${fechaFin.toLocaleDateString('es-MX')}</p>
                            </div>
                        </div>
                        <div>
                            <label style="color: #999; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Días Restantes</label>
                            <p style="margin: 5px 0 0 0; color: ${diasRestantes < 0 ? '#d32f2f' : '#388e3c'}; font-weight: 600; font-size: 1.1rem;">
                                ${diasRestantes < 0 ? 'Concluido' : diasRestantes + ' días'}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Monto -->
                <div class="info-section" style="background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%); padding: 20px; border-radius: 8px;">
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; text-align: center;">
                        <div>
                            <label style="color: #666; font-size: 0.85rem; display: block; margin-bottom: 5px;">Subtotal</label>
                            <p style="margin: 0; font-size: 1.2rem; color: #388e3c; font-weight: 600;">$${parseFloat(contrato.subtotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                            <label style="color: #666; font-size: 0.85rem; display: block; margin-bottom: 5px;">Descuento</label>
                            <p style="margin: 0; font-size: 1.2rem; color: #ff9800; font-weight: 600;">-$${parseFloat(contrato.descuento || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div style="background-color: rgba(255, 152, 0, 0.1); padding: 12px; border-radius: 8px; border-left: 3px solid #ff9800;">
                            <label style="color: #ff9800; font-size: 0.85rem; display: block; margin-bottom: 5px; font-weight: 600;">GARANTÍA</label>
                            <p style="margin: 0; font-size: 1.2rem; color: #ff9800; font-weight: 600;">$${garantiaDb.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div style="border-left: 3px solid #4caf50; padding-left: 20px; background-color: rgba(76, 175, 80, 0.05); padding: 12px; border-radius: 8px;">
                            <label style="color: #003366; font-size: 0.85rem; display: block; margin-bottom: 5px; font-weight: 600;">TOTAL</label>
                            <p style="margin: 0; font-size: 1.3rem; color: #003366; font-weight: 700;">${monto}</p>
                        </div>
                    </div>
                </div>

                <!-- Items -->
                <div class="info-section">
                    <h4 style="margin-top: 0; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; color: #003366;">
                        <i class="fa fa-box" style="margin-right: 10px; color: #2979ff;"></i>Equipos / Artículos
                    </h4>
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background-color: #f8f9fa; border-bottom: 2px solid #e0e0e0;">
                                    <th style="padding: 12px; text-align: left; color: #333; font-weight: 600; font-size: 0.9rem;">Clave</th>
                                    <th style="padding: 12px; text-align: left; color: #333; font-weight: 600; font-size: 0.9rem;">Descripción</th>
                                    <th style="padding: 12px; text-align: center; color: #333; font-weight: 600; font-size: 0.9rem;">Cantidad</th>
                                    <th style="padding: 12px; text-align: right; color: #333; font-weight: 600; font-size: 0.9rem;">Precio Unitario</th>
                                    <th style="padding: 12px; text-align: right; color: #333; font-weight: 600; font-size: 0.9rem;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Domicilio -->
                <div class="info-section">
                    <h4 style="margin-top: 0; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; color: #003366;">
                        <i class="fa fa-map-marker" style="margin-right: 10px; color: #2979ff;"></i>Domicilio de Entrega
                    </h4>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 6px;">
                        <p style="margin: 0 0 10px 0; color: #333;">
                            <strong>${contrato.calle || 'N/A'} #${contrato.numero_externo || ''}</strong>
                            ${contrato.numero_interno ? ` Int. ${contrato.numero_interno}` : ''}
                        </p>
                        <p style="margin: 5px 0; color: #666; font-size: 0.95rem;">
                            ${contrato.colonia || ''} ${contrato.codigo_postal ? ', C.P. ' + contrato.codigo_postal : ''}
                        </p>
                        <p style="margin: 5px 0 0 0; color: #666; font-size: 0.95rem;">
                            ${contrato.municipio || ''}, ${contrato.estado_entidad || ''}
                        </p>
                    </div>
                    ${contrato.notas_domicilio ? `
                        <p style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e0e0e0; color: #666;">
                            <strong>Notas:</strong> ${contrato.notas_domicilio}
                        </p>
                    ` : ''}
                </div>
            </div>

            <div class="modal-footer modal-detalles-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()" style="display: flex; align-items: center; gap: 8px;">
                    <i class="fa fa-times-circle"></i> Cerrar
                </button>
                <button class="btn btn-primary" onclick="editarContrato(${contrato.id_contrato})" style="display: flex; align-items: center; gap: 8px;">
                    <i class="fa fa-edit"></i> Editar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function regenerarPdfsDesdeServidor(contrato) {
    if (!window.contractPreviewUtils) {
        throw new Error('Plantillas de contrato no disponibles');
    }

    const { buildContractHtmlFromData, buildNoteHtmlFromData } = window.contractPreviewUtils;
    const htmlContrato = buildContractHtmlFromData({
        ...contrato,
        domicilio_arrendatario: contrato.calle ? `${contrato.calle} ${contrato.numero_externo || ''}, ${contrato.colonia || ''}` : '',
        domicilio_obra: contrato.notas_domicilio || '',
        dias_renta: contrato.dias_renta || '',
        monto_inicial: contrato.total || contrato.subtotal,
        fecha_fin: contrato.fecha_fin
    });
    const htmlNota = buildNoteHtmlFromData(contrato);

    if (!htmlContrato || !htmlNota) {
        throw new Error('No se pudo construir el HTML del contrato');
    }

    const response = await fetch(`${API_URL}/pdf/ambos`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
            id_contrato: contrato.id_contrato,
            htmlContrato,
            htmlNota
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Error generando PDFs');
    }

    const result = await response.json();
    return {
        ...contrato,
        pdf_contrato: result?.contrato?.fileName || contrato.pdf_contrato,
        pdf_nota: result?.nota?.fileName || contrato.pdf_nota
    };
}

/**
 * Editar contrato
 */
async function editarContrato(id) {
    try {
        const response = await fetch(`${CONTRATOS_URL}/${id}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Error al cargar contrato');
        }

        const contrato = await response.json();
        mostrarModalEdicion(contrato);
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al cargar contrato', 'error');
    }
}

/**
 * Mostrar modal de edición
 */
function mostrarModalEdicion(contrato) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'contrato-edicion-modal';

    const renderPreviewPdf = (contratoData) => {
        if (!contratoData.pdf_contrato) {
            return '<p style="text-align: center; color: #999; padding: 40px;">No hay PDF disponible para este contrato</p>';
        }

        const fileName = contratoData.pdf_contrato;
        return `
            <div style="text-align: center; margin-bottom: 20px;">
                <p><strong>PDF del Contrato:</strong> ${fileName}</p>
                <a href="${API_URL}/pdf/descargar/${encodeURIComponent(fileName)}" target="_blank" class="btn btn-primary" style="display: inline-block; padding: 10px 20px; text-decoration: none; background: #1976d2; color: white; border-radius: 4px;">Descargar PDF</a>
            </div>
            <div style="text-align: center; padding: 40px;">
                <p style="margin-bottom: 20px; color: #666;">Haz clic en el botón para abrir el PDF en una nueva ventana.</p>
                <a href="${API_URL}/pdf/ver/${encodeURIComponent(fileName)}" target="_blank" class="btn btn-primary" style="display: inline-block; padding: 12px 24px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; text-decoration: none;">Abrir PDF en Nueva Ventana</a>
            </div>
        `;
    };

    const renderPreviewNota = (contratoData) => {
        if (!contratoData.pdf_nota) {
            return '<p style="text-align: center; color: #999; padding: 40px;">No hay nota disponible para este contrato</p>';
        }

        const fileName = contratoData.pdf_nota;
        return `
            <div style="text-align: center; margin-bottom: 20px;">
                <p><strong>PDF de la Nota:</strong> ${fileName}</p>
                <a href="${API_URL}/pdf/descargar/${encodeURIComponent(fileName)}" target="_blank" class="btn btn-primary" style="display: inline-block; padding: 10px 20px; text-decoration: none; background: #1976d2; color: white; border-radius: 4px;">Descargar Nota</a>
            </div>
            <div style="text-align: center; padding: 40px;">
                <p style="margin-bottom: 20px; color: #666;">Haz clic en el botón para abrir la nota en una nueva ventana.</p>
                <a href="${API_URL}/pdf/ver/${encodeURIComponent(fileName)}" target="_blank" class="btn btn-primary" style="display: inline-block; padding: 12px 24px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; text-decoration: none;">Abrir Nota en Nueva Ventana</a>
            </div>
        `;
    };

    const itemsHtml = contrato.items && contrato.items.length > 0
        ? contrato.items.map((item, idx) => `
            <tr>
                <td><input type="text" value="${item.clave || ''}" class="item-clave" style="width: 100%; padding: 5px;"></td>
                <td><input type="text" value="${item.descripcion || ''}" class="item-descripcion" style="width: 100%; padding: 5px;"></td>
                <td><input type="number" value="${item.cantidad || 0}" class="item-cantidad" style="width: 100%; padding: 5px;"></td>
                <td><input type="number" step="0.01" value="${item.precio_unitario || 0}" class="item-precio" style="width: 100%; padding: 5px;"></td>
                <td>
                    <input type="number" step="0.01" value="${item.total || 0}" class="item-total" readonly style="width: 100%; padding: 5px; background: #f5f5f5;">
                    <input type="hidden" class="item-garantia" value="${item.garantia || 0}">
                </td>
                <td><button class="btn-eliminar-item" data-idx="${idx}" style="padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Eliminar</button></td>
            </tr>
        `).join('')
        : '';

    // Crear tabs para edición y vistas previas
    const tabsHtml = `
        <div style="display: flex; gap: 10px; border-bottom: 2px solid #ddd; margin-bottom: 20px;">
            <button class="tab-btn active" data-tab="editar" style="padding: 10px 20px; background: none; border: none; cursor: pointer; font-weight: 600; border-bottom: 3px solid #1976d2; color: #1976d2;">Editar</button>
            <!-- Botones de acción directa para PDF -->
            <button type="button" id="btn-preview-pdf-edicion" style="padding: 10px 20px; background: none; border: none; cursor: pointer; font-weight: 600; color: #666;">
                <i class="fa fa-file-pdf"></i> PDF Contrato
            </button>
            <button type="button" id="btn-preview-nota-edicion" style="padding: 10px 20px; background: none; border: none; cursor: pointer; font-weight: 600; color: #666;">
                <i class="fa fa-file-text"></i> Nota de Pedido
            </button>
        </div>
    `;

    modal.innerHTML = `
        <style>
            .edit-modal-container {
                max-width: 1100px;
                max-height: 95vh;
                background: #f8fafc;
                border-radius: 16px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
            }
            .edit-card {
                background: white;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 24px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                border: 1px solid #e2e8f0;
            }
            .edit-card-title {
                font-size: 1.1em;
                font-weight: 700;
                color: #1e293b;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
                border-bottom: 1px solid #f1f5f9;
                padding-bottom: 12px;
            }
            .form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
            }
            .form-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .form-group label {
                font-size: 0.85em;
                font-weight: 600;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.025em;
            }
            .form-group input, .form-group select, .form-group textarea {
                padding: 10px 12px;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                font-size: 0.95em;
                color: #1e293b;
                transition: all 0.2s;
                background: white;
            }
            .form-group input:focus {
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                outline: none;
            }
            .form-group input[readonly] {
                background: #f1f5f9;
                color: #475569;
                cursor: not-allowed;
                border-color: #e2e8f0;
            }
            .edit-table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                margin-top: 10px;
            }
            .edit-table th {
                background: #f8fafc;
                padding: 12px 16px;
                text-align: left;
                font-size: 0.8em;
                font-weight: 700;
                color: #64748b;
                text-transform: uppercase;
                border-bottom: 2px solid #e2e8f0;
            }
            .edit-table td {
                padding: 12px 8px;
                border-bottom: 1px solid #f1f5f9;
            }
            .btn-premium {
                padding: 10px 20px;
                border-radius: 8px;
                font-weight: 600;
                transition: all 0.2s;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                border: none;
            }
            .btn-save { background: #2563eb; color: white; }
            .btn-save:hover { background: #1d4ed8; transform: translateY(-1px); }
            .btn-cancel { background: #f1f5f9; color: #475569; }
            .btn-cancel:hover { background: #e2e8f0; }
            
            .tab-nav {
                display: flex;
                gap: 4px;
                padding: 0 24px;
                background: #fff;
                border-bottom: 1px solid #e2e8f0;
            }
            .tab-nav-btn {
                padding: 14px 24px;
                font-weight: 600;
                color: #64748b;
                border: none;
                background: none;
                cursor: pointer;
                border-bottom: 3px solid transparent;
                transition: all 0.2s;
            }
            .tab-nav-btn.active {
                color: #2563eb;
                border-bottom-color: #2563eb;
            }
            .tab-nav-btn:hover:not(.active) {
                color: #1e293b;
                background: #f8fafc;
            }
        </style>

        <div class="modal-content edit-modal-container">
            <div class="modal-header" style="background: white; padding: 20px 24px; border-bottom: 1px solid #e2e8f0;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="background: #dbeafe; color: #1e40af; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                        <i class="fa fa-edit"></i>
                    </div>
                    <div>
                        <h3 style="margin: 0; font-size: 1.25em; color: #0f172a;">Editar Contrato</h3>
                        <p style="margin: 0; font-size: 0.85em; color: #64748b;">${contrato.numero_contrato} - Actualizado en tiempo real para la nota</p>
                    </div>
                </div>
                <span class="close-modal" onclick="this.closest('.modal-overlay').remove()" style="font-size: 28px; color: #94a3b8; cursor: pointer;">&times;</span>
            </div>

            <div class="tab-nav">
                <button class="tab-nav-btn active" data-tab="editar"><i class="fa fa-pencil-alt"></i> Datos del Contrato</button>
                <button type="button" id="btn-preview-pdf-edicion" class="tab-nav-btn"><i class="fa fa-file-pdf"></i> PDF Contrato</button>
                <button type="button" id="btn-preview-nota-edicion" class="tab-nav-btn"><i class="fa fa-file-invoice"></i> Vista Previa Nota</button>
            </div>

            <div class="modal-body" style="padding: 24px; overflow-y: auto; background: #f8fafc;">
                <div class="tab-content active" data-tab="editar">
                    <form id="form-editar-contrato">
                        <!-- Sección 1: Información Base -->
                        <div class="edit-card">
                            <div class="edit-card-title"><i class="fa fa-info-circle" style="color: #3b82f6;"></i> Información Principal</div>
                            <div class="form-grid" style="grid-template-columns: repeat(4, 1fr);">
                                <div class="form-group">
                                    <label>No. Contrato</label>
                                    <input type="text" id="edit-numero-contrato" value="${contrato.numero_contrato}" readonly>
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Cliente</label>
                                    <input type="text" id="edit-cliente" value="${contrato.nombre_cliente}" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Estado del Contrato</label>
                                    <select id="edit-estado">
                                        <option value="Activo" ${contrato.estado === 'Activo' ? 'selected' : ''}>Activo</option>
                                        <option value="Activo con prórroga" ${contrato.estado === 'Activo con prórroga' ? 'selected' : ''}>Activo con prórroga</option>
                                        <option value="Pendiente" ${contrato.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                                        <option value="Concluido" ${contrato.estado === 'Concluido' ? 'selected' : ''}>Concluido</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>Tipo</label>
                                    <input type="text" id="edit-tipo" value="${contrato.tipo || ''}" placeholder="Ej. RENTA">
                                </div>
                                <div class="form-group">
                                    <label>Fecha Inicio</label>
                                    <input type="date" id="edit-fecha-contrato" value="${contrato.fecha_contrato ? contrato.fecha_contrato.split('T')[0] : ''}">
                                </div>
                                <div class="form-group">
                                    <label>Fecha Fin</label>
                                    <input type="date" id="edit-fecha-fin" value="${contrato.fecha_fin ? contrato.fecha_fin.split('T')[0] : ''}">
                                </div>
                                <div class="form-group">
                                    <label>Días de Renta (Auto)</label>
                                    <input type="text" id="edit-dias-arrendamiento" value="${contrato.dias_renta || ''}" readonly>
                                </div>
                                <div class="form-group">
                                    <label>Hora Inicio</label>
                                    <input type="time" id="edit-hora-inicio" value="${contrato.hora_inicio ? new Date(contrato.hora_inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5) : ''}">
                                </div>
                                <div class="form-group">
                                    <label>Hora Fin</label>
                                    <input type="time" id="edit-hora-fin" value="${contrato.hora_fin ? new Date(contrato.hora_fin).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }).slice(0, 5) : ''}">
                                </div>
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Responsable</label>
                                    <input type="text" id="edit-responsable" value="${contrato.responsable || ''}">
                                </div>
                                <div class="form-group" style="grid-column: span 4; background: #eff6ff; border: 1px dashed #93c5fd; border-radius: 12px; padding: 16px; margin-top: 8px;">
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                                        <div>
                                            <label style="display: block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #1d4ed8;">Prórroga</label>
                                            <p style="margin: 4px 0 0; color: #1e293b; font-size: 0.9rem;">Extiende el contrato y recalcula montos automáticamente.</p>
                                        </div>
                                        <label style="display: flex; align-items: center; gap: 8px; font-weight: 600; color: #1e293b;">
                                            <input type="checkbox" id="toggle-prorroga" ${contrato.estado === 'Activo con prórroga' ? 'checked' : ''} style="width: 18px; height: 18px;">
                                            Activar prórroga
                                        </label>
                                    </div>
                                    <div id="prorroga-fields" style="display: ${contrato.estado === 'Activo con prórroga' ? 'block' : 'none'}; margin-top: 16px;">
                                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; align-items: end;">
                                            <div>
                                                <small style="display: block; color: #334155; font-weight: 600; margin-bottom: 4px;">Días contratados</small>
                                                <div id="prorroga-dias-originales" style="background: #fff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px; font-weight: 600; color: #1d4ed8; text-align: center;">--</div>
                                            </div>
                                            <div>
                                                <label for="prorroga-renta-dia" style="display: block; color: #0f172a; font-weight: 600; margin-bottom: 4px;">Renta por Día (Subtotal)</label>
                                                <input type="number" id="prorroga-renta-dia" min="0" step="0.01" value="${contrato.precio_por_dia || 0}" style="width: 100%; padding: 10px; border: 1px solid #bfdbfe; border-radius: 8px;">
                                            </div>
                                            <div>
                                                <label for="prorroga-dias-extra" style="display: block; color: #0f172a; font-weight: 600; margin-bottom: 4px;">Días de prórroga</label>
                                                <input type="number" id="prorroga-dias-extra" min="0" value="0" style="width: 100%; padding: 10px; border: 1px solid #bfdbfe; border-radius: 8px;">
                                            </div>
                                            <div>
                                                <small style="display: block; color: #334155; font-weight: 600; margin-bottom: 4px;">Total de días</small>
                                                <div id="prorroga-dias-totales" style="background: #fff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px; font-weight: 600; color: #1e293b; text-align: center;">--</div>
                                            </div>
                                            <div>
                                                <small style="display: block; color: #334155; font-weight: 600; margin-bottom: 4px;">Nueva fecha fin</small>
                                                <div id="prorroga-fecha-nueva" style="background: #fff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px; font-weight: 600; color: #1e293b; text-align: center;">--</div>
                                            </div>
                                        </div>
                                        <div style="margin-top: 16px; background: #1d4ed8; color: #fff; border-radius: 10px; padding: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
                                            <div>
                                                <small style="opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em;">Total original</small>
                                                <div id="prorroga-total-original" style="font-size: 1.1rem; font-weight: 700;">--</div>
                                            </div>
                                            <div>
                                                <small style="opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em;">Ajuste por prórroga</small>
                                                <div id="prorroga-total-ajuste" style="font-size: 1.1rem; font-weight: 700;">--</div>
                                            </div>
                                            <div>
                                                <small style="opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em;">Nuevo total</small>
                                                <div id="prorroga-total-nuevo" style="font-size: 1.1rem; font-weight: 700;">--</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Sección 2: Domicilio de Entrega -->
                        <div class="edit-card">
                            <div class="edit-card-title"><i class="fa fa-map-marker-alt" style="color: #ef4444;"></i> Ubicación y Contacto en Obra</div>
                            <div class="form-grid">
                                <div class="form-group" style="grid-column: span 2;">
                                    <label>Calle</label>
                                    <input type="text" id="edit-calle" value="${contrato.calle || ''}">
                                </div>
                                <div class="form-group">
                                    <label>No. Ext</label>
                                    <input type="text" id="edit-no-externo" value="${contrato.numero_externo || ''}">
                                </div>
                                <div class="form-group">
                                    <label>No. Int</label>
                                    <input type="text" id="edit-no-interno" value="${contrato.numero_interno || ''}">
                                </div>
                                <div class="form-group">
                                    <label>Colonia</label>
                                    <input type="text" id="edit-colonia" value="${contrato.colonia || ''}">
                                </div>
                                <div class="form-group">
                                    <label>CP</label>
                                    <input type="text" id="edit-cp" value="${contrato.codigo_postal || ''}">
                                </div>
                                <div class="form-group">
                                    <label>Municipio</label>
                                    <input type="text" id="edit-municipio" value="${contrato.municipio || ''}">
                                </div>
                                <div class="form-group">
                                    <label>Estado</label>
                                    <input type="text" id="edit-estado-entidad" value="${contrato.estado_entidad || ''}">
                                </div>
                                <div class="form-group">
                                    <label>Contacto Obra</label>
                                    <input type="text" id="edit-contacto-obra" value="${contrato.contacto_obra || ''}">
                                </div>
                                <div class="form-group">
                                    <label>Teléfono</label>
                                    <input type="text" id="edit-telefono-obra" value="${contrato.telefono_obra || ''}">
                                </div>
                                <div class="form-group">
                                    <label>Celular</label>
                                    <input type="text" id="edit-celular-obra" value="${contrato.celular_obra || ''}">
                                </div>
                                <div class="form-group">
                                    <label>País</label>
                                    <input type="text" id="edit-pais" value="${contrato.pais || ''}">
                                </div>
                            </div>
                        </div>

                        <!-- Sección 3: Productos -->
                        <div class="edit-card">
                            <div class="edit-card-title" style="justify-content: space-between;">
                                <span><i class="fa fa-boxes" style="color: #8b5cf6;"></i> Equipos / Items del Contrato</span>
                                <button type="button" class="btn-premium" id="btn-agregar-item-edicion" style="background: #f1f5f9; color: #1e293b; padding: 6px 14px; font-size: 0.85em; border: 1px solid #e2e8f0;">
                                    <i class="fa fa-plus"></i> Añadir Fila
                                </button>
                            </div>
                            <div style="overflow-x: auto;">
                                <table class="edit-table">
                                    <thead>
                                        <tr>
                                            <th>Clave</th>
                                            <th>Descripción</th>
                                            <th style="text-align: center; width: 100px;">Cant.</th>
                                            <th style="text-align: right; width: 130px;">Precio Unit.</th>
                                            <th style="text-align: right; width: 140px;">Importe</th>
                                            <th style="text-align: center; width: 60px;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="edit-items-tbody">
                                        ${itemsHtml}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Sección 4: Observaciones y Totales -->
                        <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px;">
                            <div class="edit-card" style="margin-bottom: 0;">
                                <div class="edit-card-title"><i class="fa fa-comment-alt" style="color: #64748b;"></i> Notas de Domicilio / Observaciones</div>
                                <textarea id="edit-notas" style="width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; height: 160px; line-height: 1.5; resize: none;">${contrato.notas_domicilio || ''}</textarea>
                            </div>
                            <div class="edit-card" style="margin-bottom: 0; background: #1e293b; color: white; border: none;">
                                <div class="edit-card-title" style="color: white; border-bottom-color: #334155;"><i class="fa fa-calculator" style="color: #38bdf8;"></i> Resumen Financiero</div>
                                <div style="display: flex; flex-direction: column; gap: 16px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <label style="color: #94a3b8; font-size: 0.9em;">Subtotal</label>
                                        <input type="number" step="0.01" id="edit-subtotal" value="${contrato.subtotal || 0}" style="text-align: right; width: 140px; background: transparent; border: 1px solid #475569; color: white;">
                                    </div>
                                    <div id="edit-prorrogas-container" style="display: none; justify-content: space-between; align-items: center; background: rgba(56, 189, 248, 0.1); padding: 10px; border-radius: 8px; margin: 4px 0;">
                                        <label style="color: #38bdf8; font-size: 0.9em; font-weight: 600;">+ Prórrogas (IVA inc.)</label>
                                        <input type="text" id="edit-prorrogas-monto" value="$0.00" readonly style="text-align: right; width: 140px; background: transparent; border: none; color: #38bdf8; font-weight: 700; font-size: 1.1em;">
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <label style="color: #94a3b8; font-size: 0.9em;">IVA (Impuesto)</label>
                                        <input type="number" step="0.01" id="edit-impuesto" value="${contrato.impuesto || 0}" style="text-align: right; width: 140px; background: transparent; border: 1px solid #475569; color: white;">
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <label style="color: #94a3b8; font-size: 0.9em;">Descuento</label>
                                        <input type="number" step="0.01" id="edit-descuento" value="${contrato.descuento || 0}" style="text-align: right; width: 140px; background: transparent; border: 1px solid #475569; color: white;">
                                    </div>
                                    <div style="margin-top: 10px; padding-top: 20px; border-top: 1px solid #334155; display: flex; justify-content: space-between; align-items: baseline;">
                                        <label style="font-weight: 700; font-size: 1.1em; color: #38bdf8;">TOTAL FINAL</label>
                                        <input type="number" step="0.01" id="edit-total" value="${contrato.total || 0}" readonly style="text-align: right; width: 160px; font-size: 1.4em; font-weight: 800; background: transparent; border: none; color: #38bdf8;">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <div style="margin-top: 24px; padding: 12px; background: #e0f2fe; border-radius: 8px; color: #0369a1; font-size: 0.9em; display: flex; align-items: center; gap: 10px;">
                    <i class="fa fa-lightbulb"></i>
                    <span>Tus cambios se reflejan automáticamente en la Nota mientras editas.</span>
                </div>
            </div>

            <div class="modal-footer" style="padding: 20px 24px; background: white; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px;">
                <button class="btn-premium btn-cancel" onclick="this.closest('.modal-overlay').remove()">Cerrar sin guardar</button>
                <button class="btn-premium btn-save" onclick="guardarEdicionContrato(${contrato.id_contrato})">
                    <i class="fa fa-save"></i> Guardar Cambios
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // Event listeners para botones de PDF
    const btnPdf = modal.querySelector('#btn-preview-pdf-edicion');
    if (btnPdf) {
        btnPdf.addEventListener('click', (e) => {
            e.preventDefault();
            abrirVistaPreviaPDFEdicion(contrato.id_contrato);
        });
    }

    const btnNota = modal.querySelector('#btn-preview-nota-edicion');
    if (btnNota) {
        btnNota.addEventListener('click', (e) => {
            e.preventDefault();
            abrirVistaPreviaNotaEdicion(contrato.id_contrato);
        });
    }

    // Event listeners para tabs
    modal.querySelectorAll('.tab-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = btn.getAttribute('data-tab');
            if (!tabName) return; // Permitir que botones de PDF/Nota manejen su propia lógica si no tienen data-tab

            e.preventDefault();
            // Remover clase active de todos los botones y contenidos
            modal.querySelectorAll('.tab-nav-btn').forEach(b => {
                b.classList.remove('active');
            });
            modal.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });

            // Agregar clase active al botón y contenido seleccionado
            btn.classList.add('active');
            const content = modal.querySelector(`.tab-content[data-tab="${tabName}"]`);
            if (content) {
                content.style.display = 'block';
                content.classList.add('active');
            }
        });
    });

    // Event listeners para eliminar items


    // Listener para Agregar Item
    const btnAgregar = modal.querySelector('#btn-agregar-item-edicion');
    if (btnAgregar) {
        btnAgregar.addEventListener('click', (e) => {
            e.preventDefault();
            agregarFilaItemEdicion();
        });
    }

    // Event listeners para cambios en inputs (cálculos en vivo)
    const form = modal.querySelector('#form-editar-contrato');
    if (form) {
        form.addEventListener('input', (e) => {
            if (e.target.classList.contains('item-cantidad') || e.target.classList.contains('item-precio') || e.target.classList.contains('item-total')) {
                calcularTotalesEdicion();
            }
            // Recalcular también si cambian descuentos o impuestos globales
            if (['edit-subtotal', 'edit-descuento', 'edit-impuesto'].includes(e.target.id)) {
                calcularTotalesEdicion(false); // false = no recalcular items, solo globales
            }
        });

        // Listener para cálculo automático de días
        const updateDias = () => {
            const fInicio = document.getElementById('edit-fecha-contrato')?.value;
            const fFin = document.getElementById('edit-fecha-fin')?.value;
            const diasInput = document.getElementById('edit-dias-arrendamiento');

            if (fInicio && fFin && diasInput) {
                const start = new Date(fInicio);
                const end = new Date(fFin);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    const diffTime = end - start;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    diasInput.value = diffDays > 0 ? diffDays : '';
                } else {
                    diasInput.value = '';
                }
            }
        };

        const dateStart = document.getElementById('edit-fecha-contrato');
        const dateEnd = document.getElementById('edit-fecha-fin');
        if (dateStart) dateStart.addEventListener('change', updateDias);
        if (dateEnd) dateEnd.addEventListener('change', updateDias);

        // Forzar primer cálculo de días e inicializar vista previa si existe
        setTimeout(updateDias, 100);

        // --- LÓGICA DE LIVE SYNC PARA NOTA EN EDICIÓN ---
        const enviarHPNotaEdicion = () => {
            const data = obtenerDatosEdicion(contrato.id_contrato);
            const iframe = document.querySelector('iframe[src*="hoja_pedido2.html"]');
            if (!iframe || !iframe.contentWindow) return;

            const nombreClienteLimpio = (data.nombre_cliente || '').replace(/^\d+\s*-\s*/, '');

            // Construir objeto datos para la nota (consistente con abrirVistaPreviaNotaEdicion)
            const hInicio = data.hora_inicio;
            const hFin = data.hora_fin;
            let rango = '';
            if (hInicio && hFin) rango = `${hInicio} A ${hFin}`;
            else if (hInicio) rango = hInicio;

            const datosNota = {
                id_contrato: contrato.id_contrato,
                numeroNota: `NOTA-${data.numero_contrato}`,
                numeroContrato: data.numero_contrato,
                nombreCliente: nombreClienteLimpio,
                direccion: data.notas_domicilio || '',
                tipo: data.tipo || 'RENTA',
                productos: data.items.map(item => ({
                    cantidad: item.cantidad,
                    descripcion: item.descripcion,
                    subtotal: item.total,
                    importe: item.total
                })),
                totales: {
                    subtotal: data.subtotal,
                    iva: data.impuesto,
                    total: data.total,
                    garantia: data.importe_garantia || 0
                },
                dias_arrendamiento: data.dias_renta || '',
                envio: {
                    horario_manual: rango,
                    metodo: 'delivery',
                    contacto: data.contacto_obra || data.responsable || '',
                    direccion: data.calle ? `${data.calle} ${data.numero_externo || ''}` : '',
                    calle: data.calle || '',
                    no_externo: data.numero_externo || '',
                    colonia: data.colonia || '',
                    municipio: data.municipio || '',
                    cp: data.codigo_postal || ''
                }
            };

            iframe.contentWindow.postMessage({
                type: 'HP_NOTA',
                datos: datosNota
            }, '*');
        };

        const onChangeEdicion = debounce(enviarHPNotaEdicion, 350);

        // Vincular inputs relevantes para Live Sync en Edición
        const inputsEdicion = [
            '#edit-fecha-contrato', '#edit-fecha-fin', '#edit-dias-arrendamiento',
            '#edit-hora-inicio', '#edit-hora-fin', '#edit-responsable',
            '#edit-subtotal', '#edit-descuento', '#edit-impuesto', '#edit-calle',
            '#edit-no-externo', '#edit-no-interno', '#edit-colonia', '#edit-cp',
            '#edit-municipio', '#edit-estado-entidad', '#edit-contacto-obra'
        ];

        inputsEdicion.forEach(sel => {
            const el = document.getElementById(sel.replace('#', ''));
            if (el) {
                el.addEventListener('input', onChangeEdicion);
                el.addEventListener('change', onChangeEdicion);
            }
        });
    }

    initProrrogaControls(modal, contrato);

    // Event listeners para eliminar items
    const tbody = modal.querySelector('#edit-items-tbody');
    if (tbody) {
        tbody.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-eliminar-item')) {
                e.preventDefault();
                e.target.closest('tr').remove();
                calcularTotalesEdicion();
            }
        });
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Obtener datos actuales del formulario de edición
 */
function obtenerDatosEdicion(idContratoOriginal) {
    const items = [];
    document.querySelectorAll('#edit-items-tbody tr').forEach(row => {
        items.push({
            clave: row.querySelector('.item-clave')?.value || '',
            descripcion: row.querySelector('.item-descripcion')?.value || '',
            cantidad: parseFloat(row.querySelector('.item-cantidad')?.value) || 0,
            precio_unitario: parseFloat(row.querySelector('.item-precio')?.value) || 0,
            total: parseFloat(row.querySelector('.item-total')?.value) || 0,
            garantia: parseFloat(row.querySelector('.item-garantia')?.value) || 0
        });
    });

    // Construir objeto contrato con valores actuales del DOM
    return {
        id_contrato: idContratoOriginal,
        numero_contrato: document.getElementById('edit-numero-contrato')?.value,
        nombre_cliente: document.getElementById('edit-cliente')?.value,
        tipo: document.getElementById('edit-tipo')?.value,
        estado: document.getElementById('edit-estado')?.value,
        fecha_contrato: document.getElementById('edit-fecha-contrato')?.value,
        fecha_fin: document.getElementById('edit-fecha-fin')?.value,
        responsable: document.getElementById('edit-responsable')?.value,
        subtotal: parseFloat(document.getElementById('edit-subtotal')?.value) || 0,
        impuesto: parseFloat(document.getElementById('edit-impuesto')?.value) || 0,
        descuento: parseFloat(document.getElementById('edit-descuento')?.value) || 0,
        total: parseFloat(document.getElementById('edit-total')?.value) || 0,

        // Domicilio
        calle: document.getElementById('edit-calle')?.value,
        numero_externo: document.getElementById('edit-no-externo')?.value,
        numero_interno: document.getElementById('edit-no-interno')?.value,
        colonia: document.getElementById('edit-colonia')?.value,
        codigo_postal: document.getElementById('edit-cp')?.value,
        municipio: document.getElementById('edit-municipio')?.value,
        estado_entidad: document.getElementById('edit-estado-entidad')?.value,
        pais: document.getElementById('edit-pais')?.value,
        contacto_obra: document.getElementById('edit-contacto-obra')?.value || '',
        telefono_obra: document.getElementById('edit-telefono-obra')?.value || '',
        celular_obra: document.getElementById('edit-celular-obra')?.value || '',
        notas_domicilio: document.getElementById('edit-notas')?.value || '',

        // Nuevos campos
        dias_renta: document.getElementById('edit-dias-arrendamiento')?.value || '',
        hora_inicio: document.getElementById('edit-hora-inicio')?.value || '',
        hora_fin: document.getElementById('edit-hora-fin')?.value || '',

        items: items
    };
}


function formatCurrencyMx(value) {
    const number = Number.parseFloat(value);
    if (!Number.isFinite(number)) {
        return '$0.00';
    }
    return number.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function formatDateMx(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return '';
    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-MX');
}

function addDaysToDate(dateStr, daysToAdd) {
    if (!dateStr) return '';
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return dateStr;
    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);
    if (Number.isNaN(date.getTime())) return dateStr;
    date.setDate(date.getDate() + daysToAdd);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function calcularDiasEntreFechas(fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) return 0;
    const start = new Date(fechaInicio);
    const end = new Date(fechaFin);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const diffTime = end - start;
    if (!(diffTime >= 0)) return 0;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function syncProrrogaBaseWithInputs() {
    const fields = document.getElementById('prorroga-fields');
    if (!fields) return;

    const subtotalInput = document.getElementById('edit-subtotal');
    const impuestoInput = document.getElementById('edit-impuesto');
    const totalInput = document.getElementById('edit-total');
    const diasInput = document.getElementById('edit-dias-arrendamiento');
    const fechaFinInput = document.getElementById('edit-fecha-fin');

    const baseSubtotal = Number.parseFloat(subtotalInput?.value || '0') || 0;
    const baseImpuesto = Number.parseFloat(impuestoInput?.value || '0') || 0;
    const baseTotal = Number.parseFloat(totalInput?.value || '0') || 0;
    const baseDias = Number.parseInt(diasInput?.value || '0', 10) || 0;

    fields.dataset.baseSubtotal = String(baseSubtotal);
    fields.dataset.baseImpuesto = String(baseImpuesto);
    fields.dataset.baseTotal = String(baseTotal);
    fields.dataset.baseDias = String(baseDias);
    if (fechaFinInput?.value) {
        fields.dataset.baseFechaFin = fechaFinInput.value;
    }

    fields.dataset.perDaySubtotal = baseDias > 0 ? String(baseSubtotal / baseDias) : '0';
    fields.dataset.perDayImpuesto = baseDias > 0 ? String(baseImpuesto / baseDias) : '0';
    fields.dataset.perDayTotal = baseDias > 0 ? String(baseTotal / baseDias) : '0';
}

function restaurarValoresProrroga() {
    const fields = document.getElementById('prorroga-fields');
    if (!fields) return;

    const baseSubtotal = Number.parseFloat(fields.dataset.baseSubtotal || '0') || 0;
    const baseImpuesto = Number.parseFloat(fields.dataset.baseImpuesto || '0') || 0;
    const baseTotal = Number.parseFloat(fields.dataset.baseTotal || '0') || 0;
    const baseDias = Number.parseInt(fields.dataset.baseDias || '0', 10) || 0;
    const baseFechaFin = fields.dataset.baseFechaFin || '';

    const subtotalInput = document.getElementById('edit-subtotal');
    const impuestoInput = document.getElementById('edit-impuesto');
    const totalInput = document.getElementById('edit-total');
    const diasInput = document.getElementById('edit-dias-arrendamiento');
    const fechaFinInput = document.getElementById('edit-fecha-fin');

    if (subtotalInput) subtotalInput.value = baseSubtotal.toFixed(2);
    if (impuestoInput) impuestoInput.value = baseImpuesto.toFixed(2);
    if (totalInput) totalInput.value = baseTotal.toFixed(2);
    if (diasInput) diasInput.value = baseDias > 0 ? baseDias : '';
    if (fechaFinInput && baseFechaFin) fechaFinInput.value = baseFechaFin;
}

function initProrrogaControls(modal, contrato) {
    const toggle = modal.querySelector('#toggle-prorroga');
    const fields = modal.querySelector('#prorroga-fields');
    const diasExtraInput = modal.querySelector('#prorroga-dias-extra');
    if (!toggle || !fields || !diasExtraInput) return;

    if (fields.dataset.initialized === 'true') {
        actualizarResumenProrroga();
        return;
    }

    const estadoSelect = modal.querySelector('#edit-estado');
    const subtotalInput = modal.querySelector('#edit-subtotal');
    const impuestoInput = modal.querySelector('#edit-impuesto');
    const totalInput = modal.querySelector('#edit-total');
    const diasInput = modal.querySelector('#edit-dias-arrendamiento');
    const fechaInicioInput = modal.querySelector('#edit-fecha-contrato');
    const fechaFinInput = modal.querySelector('#edit-fecha-fin');

    const baseSubtotal = Number.parseFloat(subtotalInput?.value || '0') || 0;
    const baseImpuesto = Number.parseFloat(impuestoInput?.value || '0') || 0;
    const baseTotal = Number.parseFloat(totalInput?.value || '0') || 0;

    let baseDias = Number.parseInt(diasInput?.value || '0', 10) || 0;
    if (!baseDias) {
        const startValue = fechaInicioInput?.value || contrato.fecha_contrato?.split('T')[0] || '';
        const endValue = fechaFinInput?.value || contrato.fecha_fin?.split('T')[0] || '';
        baseDias = calcularDiasEntreFechas(startValue, endValue);
        if (baseDias && diasInput) {
            diasInput.value = baseDias;
        }
    }

    fields.dataset.baseSubtotal = String(baseSubtotal);
    fields.dataset.baseImpuesto = String(baseImpuesto);
    fields.dataset.baseTotal = String(baseTotal);
    fields.dataset.baseDias = String(baseDias || 0);
    fields.dataset.baseFechaFin = fechaFinInput?.value || contrato.fecha_fin?.split('T')[0] || '';
    fields.dataset.perDaySubtotal = String(baseSubtotal / baseDias);
    fields.dataset.perDayImpuesto = String(baseImpuesto / baseDias);
    fields.dataset.perDayTotal = String(baseTotal / baseDias);
    fields.dataset.rentaPorDia = String(contrato.precio_por_dia || 0);

    const estadoActual = contrato.estado || estadoSelect?.value || 'Activo';
    const estadoOriginal = estadoActual === 'Activo con prórroga' ? 'Activo' : estadoActual;
    fields.dataset.originalEstado = estadoOriginal;

    const diasOriginalEl = modal.querySelector('#prorroga-dias-originales');
    const totalOriginalEl = modal.querySelector('#prorroga-total-original');
    if (diasOriginalEl) diasOriginalEl.textContent = baseDias > 0 ? baseDias : '--';
    if (totalOriginalEl) totalOriginalEl.textContent = formatCurrencyMx(baseTotal);

    diasExtraInput.value = Number.parseInt(diasExtraInput.value || '0', 10) >= 0 ? diasExtraInput.value : '0';

    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            fields.style.display = 'block';
            if (estadoSelect) {
                estadoSelect.value = 'Activo con prórroga';
            }
        } else {
            fields.style.display = 'none';
            if (estadoSelect) {
                estadoSelect.value = fields.dataset.originalEstado || 'Activo';
            }
            diasExtraInput.value = '0';
        }
        actualizarResumenProrroga();
    });

    diasExtraInput.addEventListener('input', () => {
        const value = Number.parseInt(diasExtraInput.value || '0', 10);
        if (Number.isNaN(value) || value < 0) {
            diasExtraInput.value = '0';
        }
        actualizarResumenProrroga();
    });

    const rentaDiaInput = modal.querySelector('#prorroga-renta-dia');
    if (rentaDiaInput) {
        rentaDiaInput.addEventListener('input', () => {
            const val = parseFloat(rentaDiaInput.value) || 0;
            fields.dataset.rentaPorDia = String(val);
            actualizarResumenProrroga();
        });
    }

    fields.dataset.initialized = 'true';
    if (toggle.checked) {
        actualizarResumenProrroga();
    } else {
        fields.style.display = 'none';
        actualizarResumenProrroga();
    }
}

function actualizarResumenProrroga() {
    const fields = document.getElementById('prorroga-fields');
    if (!fields) return;

    const toggle = document.getElementById('toggle-prorroga');
    const diasExtraInput = document.getElementById('prorroga-dias-extra');

    const diasOriginalEl = document.getElementById('prorroga-dias-originales');
    const diasTotalesEl = document.getElementById('prorroga-dias-totales');
    const fechaNuevaEl = document.getElementById('prorroga-fecha-nueva');
    const totalAjusteEl = document.getElementById('prorroga-total-ajuste');
    const totalNuevoEl = document.getElementById('prorroga-total-nuevo');
    const totalOriginalEl = document.getElementById('prorroga-total-original');

    const baseSubtotal = Number.parseFloat(fields.dataset.baseSubtotal || '0') || 0;
    const baseImpuesto = Number.parseFloat(fields.dataset.baseImpuesto || '0') || 0;
    const baseTotal = Number.parseFloat(fields.dataset.baseTotal || '0') || 0;
    const baseDias = Number.parseInt(fields.dataset.baseDias || '0', 10) || 0;
    const baseFechaFin = fields.dataset.baseFechaFin || '';

    if (diasOriginalEl) diasOriginalEl.textContent = baseDias > 0 ? baseDias : '--';
    if (totalOriginalEl) totalOriginalEl.textContent = formatCurrencyMx(baseTotal);

    const active = toggle ? toggle.checked : false;
    const diasExtra = active ? Math.max(0, Number.parseInt(diasExtraInput?.value || '0', 10) || 0) : 0;

    let nuevoSubtotal = baseSubtotal;
    let nuevoImpuesto = baseImpuesto;
    let nuevoTotal = baseTotal;
    let diasTotales = baseDias;
    let nuevaFechaFin = baseFechaFin;

    if (!active) {
        const previouslyExtended = Number.parseInt(fields.dataset.extraDias || '0', 10) > 0;
        if (previouslyExtended) {
            restaurarValoresProrroga();
        }

        syncProrrogaBaseWithInputs();

        const currentDias = Number.parseInt(document.getElementById('edit-dias-arrendamiento')?.value || '0', 10) || 0;
        const currentFechaFin = document.getElementById('edit-fecha-fin')?.value || fields.dataset.baseFechaFin || '';
        const currentTotal = Number.parseFloat(document.getElementById('edit-total')?.value || '0') || 0;

        campoActualizarDias(diasTotalesEl, currentDias);
        if (fechaNuevaEl) fechaNuevaEl.textContent = currentFechaFin ? formatDateMx(currentFechaFin) : '--';
        if (totalAjusteEl) totalAjusteEl.textContent = formatCurrencyMx(0);
        if (totalNuevoEl) totalNuevoEl.textContent = formatCurrencyMx(currentTotal);

        // Ocultar fila de prórrogas en resumen financiero si no está activo
        const prorrogasContainer = document.getElementById('edit-prorrogas-container');
        if (prorrogasContainer) prorrogasContainer.style.display = 'none';

        fields.dataset.extraDias = '0';
        return;
    }

    const perDaySubtotal = Number.parseFloat(fields.dataset.perDaySubtotal || '0') || (baseDias > 0 ? baseSubtotal / baseDias : 0);
    const perDayImpuesto = Number.parseFloat(fields.dataset.perDayImpuesto || '0') || (baseDias > 0 ? baseImpuesto / baseDias : 0);
    const perDayTotal = Number.parseFloat(fields.dataset.perDayTotal || '0') || (baseDias > 0 ? baseTotal / baseDias : 0);

    const rentaPorDiaInput = document.getElementById('prorroga-renta-dia');
    const rentaPorDia = parseFloat(rentaPorDiaInput?.value || fields.dataset.rentaPorDia || '0') || 0;

    if (baseDias > 0 && diasExtra > 0) {
        // Nueva lógica: ajuste = (renta_por_dia * dias_extra) * 1.16
        // Usar rentaPorDia si existe, fallback a promedio de subtotal si es 0
        const unitPrice = rentaPorDia > 0 ? rentaPorDia : (baseSubtotal / baseDias);

        const subtotalExtra = unitPrice * diasExtra;
        const impuestoExtra = subtotalExtra * 0.16;
        const totalExtra = subtotalExtra + impuestoExtra;

        nuevoSubtotal = baseSubtotal + subtotalExtra;
        nuevoImpuesto = baseImpuesto + impuestoExtra;
        nuevoTotal = baseTotal + totalExtra;
        diasTotales = baseDias + diasExtra;
        nuevaFechaFin = baseFechaFin ? addDaysToDate(baseFechaFin, diasExtra) : baseFechaFin;
    } else {
        diasTotales = baseDias + diasExtra;
        nuevaFechaFin = baseFechaFin ? addDaysToDate(baseFechaFin, diasExtra) : baseFechaFin;
    }

    const subtotalInput = document.getElementById('edit-subtotal');
    const impuestoInput = document.getElementById('edit-impuesto');
    const totalInput = document.getElementById('edit-total');
    const diasInput = document.getElementById('edit-dias-arrendamiento');
    const fechaFinInput = document.getElementById('edit-fecha-fin');

    if (subtotalInput) subtotalInput.value = nuevoSubtotal.toFixed(2);
    if (impuestoInput) impuestoInput.value = nuevoImpuesto.toFixed(2);
    if (totalInput) totalInput.value = nuevoTotal.toFixed(2);
    if (diasInput) diasInput.value = diasTotales > 0 ? diasTotales : '';
    if (fechaFinInput && nuevaFechaFin) fechaFinInput.value = nuevaFechaFin;

    campoActualizarDias(diasTotalesEl, diasTotales);
    if (fechaNuevaEl) fechaNuevaEl.textContent = nuevaFechaFin ? formatDateMx(nuevaFechaFin) : '--';

    const ajuste = nuevoTotal - baseTotal;
    if (totalAjusteEl) {
        if (ajuste === 0) {
            totalAjusteEl.textContent = formatCurrencyMx(0);
        } else {
            const sign = ajuste >= 0 ? '+' : '-';
            totalAjusteEl.textContent = `${sign}${formatCurrencyMx(Math.abs(ajuste))}`;
        }
    }
    if (totalNuevoEl) totalNuevoEl.textContent = formatCurrencyMx(nuevoTotal);

    // Actualizar fila de prórrogas en el resumen financiero (UI central)
    const prorrogasContainer = document.getElementById('edit-prorrogas-container');
    const prorrogasMontoInput = document.getElementById('edit-prorrogas-monto');
    if (prorrogasContainer && prorrogasMontoInput) {
        if (active) {
            prorrogasContainer.style.display = 'flex';
            prorrogasMontoInput.value = formatCurrencyMx(ajuste);
        } else {
            prorrogasContainer.style.display = 'none';
        }
    }

    // Actualizar estado del contrato si hay prórroga activa
    const estadoSelect = document.getElementById('edit-estado');
    if (estadoSelect) {
        if (active && diasExtra > 0) {
            estadoSelect.value = 'Activo con prórroga';
        } else {
            estadoSelect.value = fields.dataset.originalEstado || 'Activo';
        }
    }

    fields.dataset.extraDias = String(diasExtra);
}

function campoActualizarDias(element, dias) {
    if (!element) return;
    element.textContent = dias > 0 ? dias : '--';
}



/**
 * Abrir PDF de Contrato con los datos de edición
 */
async function abrirVistaPreviaPDFEdicion(idContrato) {
    const data = obtenerDatosEdicion(idContrato);

    // Obtener datos del cliente desde la BD para domicilio fiscal
    let domicilioCliente = '';
    try {
        const contratoActual = contratosGlobal.find(c => c.id_contrato === idContrato);
        if (contratoActual && contratoActual.id_cliente) {
            const response = await fetch(`${API_URL}/clientes/${contratoActual.id_cliente}`, {
                headers: getAuthHeaders()
            });
            if (response.ok) {
                const cliente = await response.json();
                // Construir domicilio del cliente (fiscal)
                if (cliente.direccion || cliente.colonia || cliente.municipio) {
                    const partes = [
                        cliente.direccion || '',
                        cliente.numero_externo ? cliente.numero_externo : '',
                        cliente.numero_interno ? `Int. ${cliente.numero_interno}` : '',
                        cliente.colonia ? cliente.colonia : '',
                        cliente.municipio ? cliente.municipio : '',
                        cliente.estado_entidad ? cliente.estado_entidad : '',
                        cliente.codigo_postal ? `CP ${cliente.codigo_postal}` : ''
                    ].filter(p => p.trim());
                    domicilioCliente = partes.join(', ');
                }
            }
        }
    } catch (error) {
        console.error('Error obteniendo datos del cliente:', error);
    }

    // Preparar objeto compatible con pdf_contrato.html
    const datosPDF = {
        id_contrato: idContrato,
        nombreArrendatario: (document.getElementById('edit-cliente')?.value || '').replace(/^\d+\s*-\s*/, ''),
        representado: (document.getElementById('edit-responsable')?.value || '').replace(/^\d+\s*-\s*/, ''),
        // Usar domicilio del cliente (fiscal) si está disponible, sino usar el de entrega
        domicilioArrendatario: domicilioCliente || (data.calle ?
            `${data.calle} ${data.numero_externo || ''} ${data.numero_interno ? 'Int. ' + data.numero_interno : ''}, ${data.colonia || ''}, ${data.municipio || ''}, ${data.estado_entidad || ''}, CP ${data.codigo_postal || ''}`
            : (data.notas_domicilio || '')),
        domicilioObra: data.calle ?
            `${data.calle} ${data.numero_externo || ''} ${data.numero_interno ? 'Int. ' + data.numero_interno : ''}, ${data.colonia || ''}, ${data.municipio || ''}, ${data.estado_entidad || ''}, CP ${data.codigo_postal || ''}`
            : (data.notas_domicilio || ''),
        numeroContrato: data.numero_contrato,
        fechaInicio: data.fecha_contrato ? new Date(data.fecha_contrato).toLocaleDateString('es-MX') : '',
        diasRenta: (Math.ceil((new Date(data.fecha_fin) - new Date(data.fecha_contrato)) / (1000 * 60 * 60 * 24)) + 1) || 0,
        fechaFin: data.fecha_fin ? new Date(data.fecha_fin).toLocaleDateString('es-MX') : '',
        // Subtotal (antes de IVA) - para el primer campo de la cláusula tercera
        subtotal: data.subtotal,
        // Total (subtotal + IVA) - para el segundo campo de la cláusula tercera
        total: data.total,
        montoGarantia: data.items.reduce((sum, item) => sum + (item.garantia || 0), 0),
        productos: data.items.map(item => ({
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            precio: item.precio_unitario,
            precioVenta: item.garantia > 0 && item.cantidad > 0 ? (item.garantia / item.cantidad) : 0 // Cálculo de precio de reposición 
        })),
        cantidadTotal: data.items.reduce((sum, item) => sum + item.cantidad, 0),
        fechaFirma: new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    };

    sessionStorage.setItem('datosPDFContrato', JSON.stringify(datosPDF));
    window.open('pdf_contrato.html', '_blank');
}

/**
 * Abrir Nota de Pedido con los datos de edición
 */
function abrirVistaPreviaNotaEdicion(idContrato) {
    const data = obtenerDatosEdicion(idContrato);
    const nombreClienteLimpio = (data.nombre_cliente || '').replace(/^\d+\s*-\s*/, '');

    const datosNota = {
        id_contrato: idContrato,
        numeroNota: `NOTA-${data.numero_contrato}`, // Generado al vuelo si no existe
        numeroContrato: data.numero_contrato,
        nombreCliente: nombreClienteLimpio,
        direccion: data.notas_domicilio || '', // Dirección principal (entrega)
        cliente: {
            nombre: nombreClienteLimpio,
            rfc: '', // No disponible en form simple
            direccion: data.calle ? `${data.calle} ${data.numero_externo || ''}` : '',
            numero_externo: data.numero_externo || '',
            numero_interno: data.numero_interno || '',
            colonia: data.colonia || '',
            cp: data.codigo_postal || '',
            municipio: data.municipio || '',
            telefono: data.telefono_obra || '' // Usar teléfono de obra como contacto principal si no hay otro paso
        },
        fechaEmision: new Date().toISOString(),
        tipo: data.tipo || 'RENTA',
        // hoja_pedido2.html espera 'productos'
        productos: data.items.map(item => ({
            cantidad: item.cantidad,
            descripcion: item.descripcion,
            subtotal: item.total,
            importe: item.total
        })),
        totales: {
            subtotal: data.subtotal,
            iva: data.impuesto,
            total: data.total,
            garantia: data.importe_garantia || 0
        },
        // Mismos datos para envío
        envio: {
            metodo: 'delivery',
            contacto: data.contacto_obra || data.responsable || '',
            telefono: data.telefono_obra || '',
            celular: data.celular_obra || '',
            direccion: data.calle ?
                `${data.calle} ${data.numero_externo || ''} ${data.numero_interno ? 'Int. ' + data.numero_interno : ''}, ${data.colonia || ''}, ${data.municipio || ''}, ${data.estado_entidad || ''}, CP ${data.codigo_postal || ''}`
                : '',
            calle: data.calle || '',
            no_externo: data.numero_externo || '',
            numero_externo: data.numero_externo || '',
            no_interno: data.numero_interno || '',
            colonia: data.colonia || '',
            municipio: data.municipio || '',
            estado: data.estado_entidad || '',
            cp: data.codigo_postal || '',
            pais: data.pais || '',
            referencias: data.notas_domicilio || ''
        },
        observaciones: data.notas_domicilio || '',
        vigencia: data.fecha_fin ? new Date(data.fecha_fin).toLocaleDateString('es-MX') : '',
        dias_arrendamiento: data.dias_renta || '', // Corregido: mapear desde la propiedad correcta (data.dias_renta)
        agente: (function () {
            const contratoActual = (window.contratosGlobal || []).find(c => c.id_contrato === idContrato);
            return contratoActual?.vendedor_nombre ||
                contratoActual?.usuario_nombre ||
                (function () { try { return JSON.parse(localStorage.getItem('user') || '{}').nombre || ''; } catch (_) { return ''; } })() ||
                'Equipo de Ventas';
        })()
    };

    // Actualizar horario en el objeto de envío usando datos ya capturados (edit-hora-inicio/fin)
    const hInicio = data.hora_inicio;
    const hFin = data.hora_fin;
    if (hInicio || hFin) {
        let rango = '';
        if (hInicio && hFin) rango = `${hInicio} A ${hFin}`;
        else if (hInicio) rango = hInicio;

        datosNota.envio.horario_manual = rango;
    }

    // Guardar para que hoja_pedido2.html lo lea
    // hoja_pedido2.html lee 'datosHojaPedido' o espera postMessage. Usaremos localStorage o SessionStorage si está adaptado.
    // Revisando hoja_pedido2.html, usa: const datosContrato = JSON.parse(sessionStorage.getItem('datosContratoNota'))
    sessionStorage.setItem('datosNotaContrato', JSON.stringify(datosNota));
    window.open('hoja_pedido2.html', '_blank');
}
function calcularTotalesEdicion(recalcularItems = true) {
    let subtotalAcumulado = 0;

    const rows = document.querySelectorAll('#edit-items-tbody tr');
    rows.forEach(row => {
        const cantidad = parseFloat(row.querySelector('.item-cantidad').value) || 0;
        const precio = parseFloat(row.querySelector('.item-precio').value) || 0;

        let totalItem = cantidad * precio;

        if (recalcularItems) {
            row.querySelector('.item-total').value = totalItem.toFixed(2);
        } else {
            totalItem = parseFloat(row.querySelector('.item-total').value) || 0;
        }

        subtotalAcumulado += totalItem;
    });

    // Actualizar Subtotal Global
    const inputSubtotal = document.getElementById('edit-subtotal');
    if (recalcularItems && inputSubtotal) {
        inputSubtotal.value = subtotalAcumulado.toFixed(2);
    } else if (inputSubtotal) {
        subtotalAcumulado = parseFloat(inputSubtotal.value) || 0;
    }

    // Calcular Impuestos y Descuentos
    const descuento = parseFloat(document.getElementById('edit-descuento').value) || 0;
    // Si queremos recalcular IVA automático (ej. 16%):
    // const iva = (subtotalAcumulado - descuento) * 0.16;
    // Pero respetaremos el input manual por si hay exenciones
    const iva = parseFloat(document.getElementById('edit-impuesto').value) || 0;

    const totalFinal = subtotalAcumulado - descuento + iva;

    document.getElementById('edit-total').value = totalFinal.toFixed(2);

    actualizarResumenProrroga();
}

/**
 * Agregar nueva fila de item en edición
 */
function agregarFilaItemEdicion() {
    const tbody = document.getElementById('edit-items-tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="item-clave" style="width: 100%; padding: 5px;" placeholder="Clave"></td>
        <td><input type="text" class="item-descripcion" style="width: 100%; padding: 5px;" placeholder="Descripción"></td>
        <td><input type="number" value="1" class="item-cantidad" style="width: 100%; padding: 5px;"></td>
        <td><input type="number" step="0.01" value="0.00" class="item-precio" style="width: 100%; padding: 5px;"></td>
        <td>
            <input type="number" step="0.01" value="0.00" class="item-total" readonly style="width: 100%; padding: 5px; background: #f5f5f5;">
            <input type="hidden" class="item-garantia" value="0">
        </td>
        <td><button class="btn-eliminar-item" style="padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Eliminar</button></td>
    `;
    tbody.appendChild(tr);
}

/**
 * Guardar edición del contrato
 */
async function guardarEdicionContrato(idContrato) {
    try {
        const contratoActual = contratosGlobal.find(c => c.id_contrato === idContrato) || {};
        const garantiaActual = parseFloat((contratoActual.monto_garantia ?? contratoActual.importe_garantia) || 0);

        const items = [];
        const tbody = document.getElementById('edit-items-tbody');

        if (tbody) {
            tbody.querySelectorAll('tr').forEach(row => {
                const clave = row.querySelector('.item-clave')?.value || '';
                const descripcion = row.querySelector('.item-descripcion')?.value || '';
                const cantidad = parseInt(row.querySelector('.item-cantidad')?.value) || 1;
                const precio_unitario = parseFloat(row.querySelector('.item-precio')?.value) || 0;
                const total = parseFloat(row.querySelector('.item-total')?.value) || 0;

                if (descripcion) {
                    items.push({
                        clave,
                        descripcion,
                        cantidad,
                        precio_unitario,
                        garantia: 0,
                        total
                    });
                }
            });
        }

        const datosActualizacion = {
            numero_contrato: document.getElementById('edit-numero-contrato').value,
            id_cliente: contratosGlobal.find(c => c.id_contrato === idContrato)?.id_cliente,
            tipo: document.getElementById('edit-tipo').value,
            requiere_factura: 'SI',
            fecha_contrato: document.getElementById('edit-fecha-contrato').value,
            fecha_inicio: document.getElementById('edit-fecha-contrato').value,
            fecha_fin: document.getElementById('edit-fecha-fin').value,
            id_cotizacion: contratosGlobal.find(c => c.id_contrato === idContrato)?.id_cotizacion,
            responsable: document.getElementById('edit-responsable').value,
            estado: document.getElementById('edit-estado').value,
            subtotal: parseFloat(document.getElementById('edit-subtotal').value) || 0,
            impuesto: parseFloat(document.getElementById('edit-impuesto').value) || 0,
            descuento: parseFloat(document.getElementById('edit-descuento').value) || 0,
            total: parseFloat(document.getElementById('edit-total').value) || 0,
            monto: parseFloat(document.getElementById('edit-total').value) || 0,
            tipo_garantia: 'PAGARE',
            importe_garantia: garantiaActual,
            monto_garantia: garantiaActual,
            calle: document.getElementById('edit-calle').value,
            numero_externo: document.getElementById('edit-no-externo').value,
            numero_interno: document.getElementById('edit-no-interno').value,
            colonia: document.getElementById('edit-colonia').value,
            codigo_postal: document.getElementById('edit-cp').value,
            entre_calles: '',
            pais: document.getElementById('edit-pais').value,
            contacto_obra: document.getElementById('edit-contacto-obra').value,
            telefono_obra: document.getElementById('edit-telefono-obra').value,
            celular_obra: document.getElementById('edit-celular-obra').value,
            estado_entidad: document.getElementById('edit-estado-entidad').value,
            municipio: document.getElementById('edit-municipio').value,
            notas_domicilio: document.getElementById('edit-notas').value,
            dias_renta: document.getElementById('edit-dias-arrendamiento')?.value || '',
            hora_inicio: (function () {
                const timeStr = document.getElementById('edit-hora-inicio')?.value;
                const dateStr = document.getElementById('edit-fecha-contrato')?.value;
                if (!timeStr || !dateStr) return null;
                return `${dateStr}T${timeStr}:00`;
            })(),
            hora_fin: (function () {
                const timeStr = document.getElementById('edit-hora-fin')?.value;
                const dateStr = document.getElementById('edit-fecha-contrato')?.value; // Asumimos misma fecha inicio o fin? Usualmente inicio
                if (!timeStr || !dateStr) return null;
                return `${dateStr}T${timeStr}:00`;
            })(),
            precio_por_dia: parseFloat(document.getElementById('prorroga-fields')?.dataset?.rentaPorDia || 0),
            items: items
        };

        const response = await fetch(`${CONTRATOS_URL}/${idContrato}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(datosActualizacion)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al actualizar contrato');
        }

        mostrarMensaje('Contrato actualizado exitosamente', 'success');
        document.getElementById('contrato-edicion-modal').remove();

        // Recargar lista
        setTimeout(() => cargarContratos(), 500);
    } catch (error) {
        console.error('Error guardando edición:', error);
        mostrarMensaje(error.message || 'Error al guardar cambios', 'error');
    }
}

/**
 * Mostrar mensajes
 */
function mostrarMensaje(msg, type = 'success') {
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
    el.style.background = type === 'success' ? '#e6f9f0' : type === 'error' ? '#fdeaea' : '#e3f2fd';
    el.style.color = type === 'success' ? '#1abc9c' : type === 'error' ? '#f44336' : '#1976d2';
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 2500);
}

// Cargar contratos cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    // Cargar notificaciones guardadas
    notificacionesManager.cargarLocal();
    notificacionesManager.actualizar();

    // Setup del icono de notificaciones
    const notificationIcon = document.getElementById('notification-toggle');
    if (notificationIcon) {
        notificationIcon.addEventListener('click', toggleNotifications);
    }

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notificaciones-dropdown');
        const icon = document.getElementById('notification-toggle');
        if (dropdown && icon && !dropdown.contains(e.target) && e.target !== icon && !icon.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    cargarContratos();

    // Event listeners para filtros y búsqueda
    const searchInput = document.getElementById('search-contrato');
    const filterEstado = document.getElementById('filter-estado');
    const filterCliente = document.getElementById('filter-cliente');
    const filterFechaInicio = document.getElementById('filter-fecha-inicio');
    const filterFechaFin = document.getElementById('filter-fecha-fin');
    const btnLimpiar = document.getElementById('btn-limpiar-filtros');

    if (searchInput) {
        searchInput.addEventListener('input', aplicarFiltrosYBusqueda);
    }
    if (filterEstado) {
        filterEstado.addEventListener('change', aplicarFiltrosYBusqueda);
    }
    if (filterCliente) {
        filterCliente.addEventListener('input', aplicarFiltrosYBusqueda);
    }
    if (filterFechaInicio) {
        filterFechaInicio.addEventListener('change', aplicarFiltrosYBusqueda);
    }
    if (filterFechaFin) {
        filterFechaFin.addEventListener('change', aplicarFiltrosYBusqueda);
    }
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', (e) => {
            e.preventDefault();
            // Limpiar todos los filtros
            if (searchInput) searchInput.value = '';
            if (filterEstado) filterEstado.value = '';
            if (filterCliente) filterCliente.value = '';
            if (filterFechaInicio) filterFechaInicio.value = '';
            if (filterFechaFin) filterFechaFin.value = '';

            // Aplicar filtros (que ahora mostrarán todos)
            aplicarFiltrosYBusqueda();
        });
    }

    // Recargar contratos cada 30 segundos
    setInterval(cargarContratos, 30000);
});
