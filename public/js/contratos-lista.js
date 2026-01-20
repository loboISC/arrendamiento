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
                            <label style="color: #ff9800; font-size: 0.85rem; text-transform: uppercase; font-weight: 600;">Importe Garantía</label>
                            <p style="margin: 5px 0 0 0; color: #ff9800; font-weight: 600; font-size: 1.1rem;">$${garantiaDb.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
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
        <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>Editar Contrato: ${contrato.numero_contrato}</h3>
                <span class="close-modal" onclick="this.closest('.modal-overlay').remove()">&times;</span>
            </div>
            <div class="modal-body">
                ${tabsHtml}
                
                <!-- Tab: Editar -->
                <div class="tab-content active" data-tab="editar">
                <form id="form-editar-contrato">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <label>Número de Contrato:</label>
                            <input type="text" id="edit-numero-contrato" value="${contrato.numero_contrato}" readonly style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f5f5f5;">
                        </div>
                        <div>
                            <label>Cliente:</label>
                            <input type="text" id="edit-cliente" value="${contrato.nombre_cliente}" readonly style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f5f5f5;">
                        </div>
                        <div>
                            <label>Tipo:</label>
                            <input type="text" id="edit-tipo" value="${contrato.tipo || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Estado:</label>
                            <select id="edit-estado" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                <option value="Activo" ${contrato.estado === 'Activo' ? 'selected' : ''}>Activo</option>
                                <option value="Pendiente" ${contrato.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                                <option value="Concluido" ${contrato.estado === 'Concluido' ? 'selected' : ''}>Concluido</option>
                            </select>
                        </div>
                        <div>
                            <label>Fecha Contrato:</label>
                            <input type="date" id="edit-fecha-contrato" value="${contrato.fecha_contrato ? contrato.fecha_contrato.split('T')[0] : ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Fecha Fin:</label>
                            <input type="date" id="edit-fecha-fin" value="${contrato.fecha_fin ? contrato.fecha_fin.split('T')[0] : ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Responsable:</label>
                            <input type="text" id="edit-responsable" value="${contrato.responsable || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Subtotal:</label>
                            <input type="number" step="0.01" id="edit-subtotal" value="${contrato.subtotal || 0}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Impuesto (IVA):</label>
                            <input type="number" step="0.01" id="edit-impuesto" value="${contrato.impuesto || 0}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Descuento:</label>
                            <input type="number" step="0.01" id="edit-descuento" value="${contrato.descuento || 0}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Total:</label>
                            <input type="number" step="0.01" id="edit-total" value="${contrato.total || 0}" readonly style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f5f5f5;">
                        </div>
                    </div>

                    <h4>Domicilio de Entrega</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <label>Calle:</label>
                            <input type="text" id="edit-calle" value="${contrato.calle || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>No. Externo:</label>
                            <input type="text" id="edit-no-externo" value="${contrato.numero_externo || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>No. Interno:</label>
                            <input type="text" id="edit-no-interno" value="${contrato.numero_interno || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Colonia:</label>
                            <input type="text" id="edit-colonia" value="${contrato.colonia || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Código Postal:</label>
                            <input type="text" id="edit-cp" value="${contrato.codigo_postal || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Municipio:</label>
                            <input type="text" id="edit-municipio" value="${contrato.municipio || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Estado:</label>
                            <input type="text" id="edit-estado-entidad" value="${contrato.estado_entidad || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>País:</label>
                            <input type="text" id="edit-pais" value="${contrato.pais || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <!-- Nuevos campos de contacto de entrega -->
                        <div>
                            <label>Contacto en Obra:</label>
                            <input type="text" id="edit-contacto-obra" value="${contrato.contacto_obra || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Teléfono:</label>
                            <input type="text" id="edit-telefono-obra" value="${contrato.telefono_obra || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <div>
                            <label>Celular:</label>
                            <input type="text" id="edit-celular-obra" value="${contrato.celular_obra || ''}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                    </div>

                    <h4>Items del Contrato</h4>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="background-color: #f5f5f5;">
                                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Clave</th>
                                <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Descripción</th>
                                <th style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">Cantidad</th>
                                <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">Precio</th>
                                <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">Total</th>
                                <th style="padding: 10px; text-align: center; border-bottom: 1px solid #ddd;">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="edit-items-tbody">
                            ${itemsHtml}
                        </tbody>
                    </table>
                    
                    <button type="button" class="btn btn-secondary" id="btn-agregar-item-edicion" style="margin-bottom: 20px;">
                        <i class="fa fa-plus"></i> Agregar Item
                    </button>

                    <div style="margin-bottom: 20px;">
                        <label>Notas de Domicilio:</label>
                        <textarea id="edit-notas" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; height: 80px;">${contrato.notas_domicilio || ''}</textarea>
                    </div>
                </form>
                </div>

                <!-- Espacio reservado para mensajes o info adicional -->
                <div style="margin-top: 10px; color: #666; font-size: 0.9em; text-align: center;">
                    <i class="fa fa-info-circle"></i> Usa los botones de arriba para ver el PDF o Nota con los cambios actuales.
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
                <button class="btn btn-primary" onclick="guardarEdicionContrato(${contrato.id_contrato})">Guardar Cambios</button>
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
    modal.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = btn.getAttribute('data-tab');

            // Remover clase active de todos los botones y contenidos
            modal.querySelectorAll('.tab-btn').forEach(b => {
                b.style.borderBottom = '3px solid transparent';
                b.style.color = '#666';
            });
            modal.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });

            // Agregar clase active al botón y contenido seleccionado
            btn.style.borderBottom = '3px solid #1976d2';
            btn.style.color = '#1976d2';
            const content = modal.querySelector(`.tab-content[data-tab="${tabName}"]`);
            if (content) {
                content.style.display = 'block';
                content.classList.add('active');
                if (tabName === 'preview-pdf' || tabName === 'preview-nota') {
                    ensurePdfsActualizados();
                }
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
    }

    // Event listeners para eliminar items (delegado)
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

        items: items
    };
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
        diasRenta: Math.ceil((new Date(data.fecha_fin) - new Date(data.fecha_contrato)) / (1000 * 60 * 60 * 24)) || 0,
        fechaFin: data.fecha_fin ? new Date(data.fecha_fin).toLocaleDateString('es-MX') : '',
        montoRenta: data.subtotal, // Usar subtotal como renta base
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
        agente: (function () {
            const contratoActual = (window.contratosGlobal || []).find(c => c.id_contrato === idContrato);
            return contratoActual?.vendedor_nombre ||
                contratoActual?.usuario_nombre ||
                (function () { try { return JSON.parse(localStorage.getItem('user') || '{}').nombre || ''; } catch (_) { return ''; } })() ||
                'Equipo de Ventas';
        })()
    };

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
