/**
 * ORQUESTADOR PRINCIPAL - LOGISTICA (Version Clean SPA + Historial Global)
 */
document.addEventListener('DOMContentLoaded', () => {
    LogisticaApp.init();
});

const LogisticaApp = (function() {
    
    let currentStep = 1;
    const totalSteps = 3;
    let wsUnsubscribe = null;
    let dashboardRefreshTimer = null;
    let dashboardPollingInterval = null;
    let calendarDate = new Date();
    let calendarEvents = [];
    let unidadesView = 'vehiculos';

    const DOM = {
        // KPIs
        kpiVehiculosActivos: document.getElementById('kpi-vehiculos-activos'),
        kpiMantenimientosProximos: document.getElementById('kpi-mantenimientos-proximos'),
        kpiDocumentosPorVencer: document.getElementById('kpi-documentos-por-vencer'),
        kpiChoferesDisponibles: document.getElementById('kpi-choferes-disponibles'),
        kpiPedidosEnRuta: document.getElementById('kpi-pedidos-en-ruta'),
        alertasCounter: document.getElementById('alerts-counter'),
        
        // Tablas
        tablaVehiculos: document.querySelector('#tabla-vehiculos tbody'),
        tablaMantenimientos: document.querySelector('#tabla-mantenimientos tbody'),
        tablaRuta: document.querySelector('#tabla-ruta tbody'),
        tablaPedidos: document.querySelector('#tabla-pedidos-pendientes tbody'),
        contenedorAlertas: document.getElementById('contenedor-alertas'),
        calendarGrid: document.getElementById('calendar-grid'),
        calendarTitle: document.getElementById('calendar-title'),
        btnCalendarPrev: document.getElementById('btn-calendar-prev'),
        btnCalendarNext: document.getElementById('btn-calendar-next'),
        unidadesSwitch: document.getElementById('unidades-switch'),
        unidadesPanelVehiculos: document.getElementById('unidades-panel-vehiculos'),
        unidadesPanelCalendario: document.getElementById('unidades-panel-calendario'),
        
        // Modales y Overlays
        overlayAlta: document.getElementById('overlay-alta'),
        overlayDetalles: document.getElementById('overlay-detalles'),
        overlayMantenimiento: document.getElementById('overlay-mantenimiento'),
        overlayReasignar: document.getElementById('overlay-reasignar'),
        
        // Formularios
        formAlta: document.getElementById('form-alta-completa'),
        formMantenimiento: document.getElementById('form-mantenimiento-rapido'),
        formAsignacion: document.getElementById('form-asignacion'),
        formReasignacion: document.getElementById('form-reasignacion'),
        
        // Botones y Selects
        btnAltaPro: document.getElementById('btn-alta-pro'),
        btnNext: document.getElementById('btn-next'),
        btnPrev: document.getElementById('btn-prev'),
        btnFinish: document.getElementById('btn-finish'),
        btnAutoAsignar: document.getElementById('btn-auto-asignar'),
        selVehiculo: document.getElementById('sel-vehiculo'),
        selChofer: document.getElementById('sel-chofer'),
        selVehiculoEdit: document.getElementById('edit-sel-vehiculo'),
        selChoferEdit: document.getElementById('edit-sel-chofer'),
        
        // Navegacion
        navTabs: document.querySelectorAll('.tab-btn'),
        sections: document.querySelectorAll('.content-section'),
        stepContents: document.querySelectorAll('.step-content'),
        stepTabs: document.querySelectorAll('.modal-tab-btn')
    };

    function bindEvents() {
        // 1. Navegacion (Solo para soporte legacy o debug, el control es por URL)
        DOM.navTabs.forEach(btn => {
            btn.addEventListener('click', () => activarSeccion(btn.dataset.sec));
        });

        // 2. Modales
        if (DOM.btnAltaPro) {
            DOM.btnAltaPro.addEventListener('click', () => {
                currentStep = 1;
                actualizarPasos();
                DOM.overlayAlta.style.display = 'flex';
            });
        }

        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                DOM.overlayAlta.style.display = 'none';
                DOM.overlayDetalles.style.display = 'none';
                DOM.overlayMantenimiento.style.display = 'none';
                DOM.overlayReasignar.style.display = 'none';
            });
        });

        // 3. Pasos de Alta
        if (DOM.btnNext) DOM.btnNext.addEventListener('click', () => { if (currentStep < totalSteps) { currentStep++; actualizarPasos(); } });
        if (DOM.btnPrev) DOM.btnPrev.addEventListener('click', () => { if (currentStep > 1) { currentStep--; actualizarPasos(); } });

        // 4. Submit: Alta Vehiculo
        if (DOM.formAlta) DOM.formAlta.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(DOM.formAlta);
            const data = Object.fromEntries(formData.entries());
            const docs = [
                { tipo: 'seguro', folio: data.doc_seguro_folio, fecha_fin: data.doc_seguro_fin },
                { tipo: 'verificacion', fecha_fin: data.doc_verif_fin },
                { tipo: 'placa', fecha_fin: data.doc_placas_fin }
            ].filter(d => d.fecha_fin);

            try {
                await LogisticaServicio.crearVehiculo({ ...data, documentos: docs });
                LogisticaNotificaciones.mostrarAlerta('Unidad registrada', 'success');
                DOM.overlayAlta.style.display = 'none';
                DOM.formAlta.reset();
                cargarDatos();
            } catch (err) { LogisticaNotificaciones.mostrarAlerta(err.message, 'error'); }
        });

        // 5. Submit: Mantenimiento
        if (DOM.formMantenimiento) DOM.formMantenimiento.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await LogisticaServicio.crearMantenimiento(Object.fromEntries(new FormData(DOM.formMantenimiento)));
                LogisticaNotificaciones.mostrarAlerta('Mantenimiento guardado', 'success');
                DOM.overlayMantenimiento.style.display = 'none';
                cargarDatos('mantenimiento'); // Recargar historial global
            } catch (err) { LogisticaNotificaciones.mostrarAlerta(err.message, 'error'); }
        });

        // 6. Asignacion Manual
        if (DOM.formAsignacion) DOM.formAsignacion.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await LogisticaServicio.crearAsignacion(Object.fromEntries(new FormData(DOM.formAsignacion)));
                LogisticaNotificaciones.mostrarAlerta('Ruta asignada', 'success');
                DOM.formAsignacion.reset();
                cargarDatos('dashboard');
            } catch (err) { LogisticaNotificaciones.mostrarAlerta(err.message, 'error'); }
        });

        // 7. Auto-Asignar
        if (DOM.btnAutoAsignar) DOM.btnAutoAsignar.addEventListener('click', async () => {
            try {
                await LogisticaServicio.asignacionAutomatica();
                LogisticaNotificaciones.mostrarAlerta('Algoritmo ejecutado', 'info');
                cargarDatos('dashboard');
            } catch (err) { LogisticaNotificaciones.mostrarAlerta(err.message, 'error'); }
        });

        // 8. Acciones Tabla
        if (DOM.tablaVehiculos) DOM.tablaVehiculos.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-action');
            if (!btn) return;
            const id = btn.dataset.id;
            if (btn.classList.contains('btn-view')) abrirDetalles(id);
            else if (btn.classList.contains('btn-tools')) abrirMantenimiento(id);
        });

        // 9. Submit: Reasignacion
        if (DOM.formReasignacion) {
            DOM.formReasignacion.addEventListener('submit', guardarReasignacion);
        }

        if (DOM.btnCalendarPrev) {
            DOM.btnCalendarPrev.addEventListener('click', () => {
                calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
                renderizarCalendario();
            });
        }

        if (DOM.btnCalendarNext) {
            DOM.btnCalendarNext.addEventListener('click', () => {
                calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
                renderizarCalendario();
            });
        }

        if (DOM.calendarGrid) {
            DOM.calendarGrid.addEventListener('click', (e) => {
                const dayCell = e.target.closest('.calendar-day.has-events');
                if (!dayCell) return;
                const dateIso = dayCell.dataset.date;
                if (!dateIso) return;
                abrirDetalleDia(dateIso);
            });
        }

        if (DOM.unidadesSwitch) {
            DOM.unidadesSwitch.addEventListener('click', (e) => {
                const btn = e.target.closest('.unidades-switch-btn');
                if (!btn) return;
                setUnidadesView(btn.dataset.view || 'vehiculos');
            });
        }
    }

    function activarSeccion(secId) {
        DOM.sections.forEach(s => s.classList.toggle('active', s.id === `sec-${secId}`));
        configurarPollingDashboard(secId);
        cargarDatos(secId);
    }

    async function cargarDatos(seccion = 'dashboard') {
        try {
            switch(seccion) {
                case 'dashboard':
                    const [dash, choferes, trackings] = await Promise.all([
                        LogisticaServicio.obtenerDashboard(),
                        LogisticaServicio.obtenerChoferes().catch(() => []),
                        LogisticaServicio.obtenerTrackingsActivos().catch(() => [])
                    ]);
                    renderizarKPIs(dash, choferes);
                    renderizarRuta(dash.asignaciones_activas || []);
                    renderizarAlertas(dash);
                    initMapaTracking(trackings);
                    break;
                case 'unidades':
                    const [vehiculos, dashUnidades, mantenimientos] = await Promise.all([
                        LogisticaServicio.obtenerVehiculos(),
                        LogisticaServicio.obtenerDashboard(),
                        LogisticaServicio.obtenerMantenimientosGlobales().catch(() => [])
                    ]);
                    renderizarVehiculos(vehiculos);
                    prepararEventosCalendario(dashUnidades, mantenimientos);
                    renderizarCalendario();
                    setUnidadesView(unidadesView);
                    break;
                case 'mantenimiento':
                    const historial = await LogisticaServicio.obtenerMantenimientosGlobales();
                    renderizarHistorialMantenimientos(historial);
                    break;
                case 'rutas':
                    const dashRutas = await LogisticaServicio.obtenerDashboard();
                    cargarOpcionesAsignacion();
                    renderizarPedidosPendientes(dashRutas.asignaciones_espera);
                    renderizarRecoleccionesPendientes(dashRutas.recolecciones_espera);
                    break;
                case 'gps':
                    await cargarDatos('dashboard');
                    break;
                case 'historial':
                    const datosHistorial = await LogisticaServicio.obtenerHistorial();
                    renderizarHistorialEntregas(datosHistorial);
                    break;
            }
        } catch (err) { 
            console.error('Error cargando seccion:', seccion, err); 
            LogisticaNotificaciones.mostrarAlerta(`Error al cargar ${seccion}: ${err.message}`, 'error');
        }
    }

    function setUnidadesView(view) {
        unidadesView = (view === 'calendario') ? 'calendario' : 'vehiculos';
        if (DOM.unidadesPanelVehiculos) {
            DOM.unidadesPanelVehiculos.style.display = unidadesView === 'vehiculos' ? '' : 'none';
        }
        if (DOM.unidadesPanelCalendario) {
            DOM.unidadesPanelCalendario.style.display = unidadesView === 'calendario' ? '' : 'none';
        }
        if (DOM.unidadesSwitch) {
            DOM.unidadesSwitch.querySelectorAll('.unidades-switch-btn').forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.view === unidadesView);
            });
        }
    }

    function configurarPollingDashboard(seccion) {
        if (dashboardPollingInterval) {
            clearInterval(dashboardPollingInterval);
            dashboardPollingInterval = null;
        }

        if (seccion === 'dashboard') {
            dashboardPollingInterval = setInterval(() => {
                cargarDatos('dashboard');
            }, 15000);
        }
    }

    function refrescoDashboardConDebounce(delayMs = 1200) {
        clearTimeout(dashboardRefreshTimer);
        dashboardRefreshTimer = setTimeout(() => {
            const dashboardVisible = document.getElementById('sec-dashboard')?.classList.contains('active');
            if (dashboardVisible) cargarDatos('dashboard');
        }, delayMs);
    }

    function prepararEventosCalendario(dash, mantenimientos = []) {
        const eventos = [];
        const docs = dash?.alertas_vencimiento || [];
        const entregas = dash?.asignaciones_espera || [];
        const recolecciones = dash?.recolecciones_espera || [];
        const licencias = dash?.licencias_por_vencer || [];

        entregas.forEach((ent) => {
            if (!ent?.fecha_compromiso) return;
            eventos.push({
                fecha: new Date(ent.fecha_compromiso),
                tipo: 'entrega',
                label: `${ent.numero_contrato || ent.pedido_id} - Entrega`
            });
        });

        recolecciones.forEach((rec) => {
            if (!rec?.fecha_compromiso) return;
            eventos.push({
                fecha: new Date(rec.fecha_compromiso),
                tipo: 'recoleccion',
                label: `${rec.numero_contrato || rec.pedido_id} - Recoleccion`
            });
        });

        docs.forEach((doc) => {
            if (!doc?.fecha_fin) return;
            const tipoDoc = String(doc.tipo || '').toLowerCase();
            if (!tipoDoc.includes('verif')) return;
            eventos.push({
                fecha: new Date(doc.fecha_fin),
                tipo: 'verificacion',
                label: `${doc.economico || 'Unidad'} - Verificacion`
            });
        });

        (mantenimientos || []).forEach((mant) => {
            if (!mant?.fecha) return;
            eventos.push({
                fecha: new Date(mant.fecha),
                tipo: 'mant',
                label: `${mant.economico || 'Unidad'} - ${mant.tipo || 'Mant.'}`
            });
        });

        licencias.forEach((lic) => {
            if (!lic?.fecha_vencimiento) return;
            eventos.push({
                fecha: new Date(lic.fecha_vencimiento),
                tipo: 'licencia',
                label: `${lic.chofer_nombre || lic.chofer_id || 'Chofer'} - Licencia`
            });
        });

        calendarEvents = eventos.filter(e => !isNaN(e.fecha.getTime()));
    }

    function renderizarCalendario() {
        if (!DOM.calendarGrid || !DOM.calendarTitle) return;

        const anio = calendarDate.getFullYear();
        const mes = calendarDate.getMonth();
        const primerDia = new Date(anio, mes, 1);
        const ultimoDia = new Date(anio, mes + 1, 0);
        const offset = primerDia.getDay();
        const diasMes = ultimoDia.getDate();

        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        DOM.calendarTitle.textContent = `${meses[mes]} ${anio}`;

        const hoy = new Date();
        const esMismoDia = (a, b) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

        const celdas = [];
        const diasPrevios = new Date(anio, mes, 0).getDate();
        for (let i = 0; i < offset; i++) {
            celdas.push({ day: diasPrevios - offset + i + 1, muted: true, date: new Date(anio, mes - 1, diasPrevios - offset + i + 1) });
        }
        for (let d = 1; d <= diasMes; d++) {
            celdas.push({ day: d, muted: false, date: new Date(anio, mes, d) });
        }
        const faltantes = 42 - celdas.length;
        for (let i = 1; i <= faltantes; i++) {
            celdas.push({ day: i, muted: true, date: new Date(anio, mes + 1, i) });
        }

        DOM.calendarGrid.innerHTML = celdas.map((celda) => {
            const eventosDelDia = calendarEvents.filter(ev => esMismoDia(ev.fecha, celda.date));
            const eventosPreview = eventosDelDia.slice(0, 3);
            const clsHoy = esMismoDia(celda.date, hoy) && !celda.muted ? 'today' : '';
            const clsMuted = celda.muted ? 'muted' : '';
            const clsEvents = eventosDelDia.length ? 'has-events' : '';
            return `
                <div class="calendar-day ${clsHoy} ${clsMuted} ${clsEvents}" data-date="${celda.date.toISOString()}">
                    <div class="calendar-day-number">${celda.day}</div>
                    ${eventosPreview.map(ev => `
                        <div class="calendar-event ${classEventoCalendario(ev.tipo)}">${ev.label}</div>
                    `).join('')}
                    ${eventosDelDia.length > 3 ? `<div class="calendar-event" style="background:#edf2f7; color:#4a5568;">+${eventosDelDia.length - 3} mas...</div>` : ''}
                </div>
            `;
        }).join('');
    }

    function classEventoCalendario(tipo) {
        switch (tipo) {
            case 'entrega': return 'event-entrega';
            case 'recoleccion': return 'event-recoleccion';
            case 'verificacion': return 'event-verificacion';
            case 'licencia': return 'event-licencia';
            case 'mant': return 'event-mant';
            default: return 'event-doc';
        }
    }

    function abrirDetalleDia(dateIso) {
        const target = new Date(dateIso);
        if (isNaN(target.getTime())) return;
        const eventosDelDia = calendarEvents.filter(ev =>
            ev.fecha.getDate() === target.getDate() &&
            ev.fecha.getMonth() === target.getMonth() &&
            ev.fecha.getFullYear() === target.getFullYear()
        );

        if (!eventosDelDia.length) return;

        const titulo = target.toLocaleDateString('es-MX', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        const html = eventosDelDia.map(ev => `
            <div style="display:flex; align-items:flex-start; gap:8px; margin-bottom:8px; text-align:left;">
                <span style="margin-top:3px; width:10px; height:10px; border-radius:50%; background:${colorEventoDetalle(ev.tipo)};"></span>
                <div>
                    <div style="font-weight:700; color:#1f2937;">${tituloEventoDetalle(ev.tipo)}</div>
                    <div style="color:#4b5563; font-size:0.92rem;">${ev.label}</div>
                </div>
            </div>
        `).join('');

        Swal.fire({
            title: `Eventos - ${titulo}`,
            html,
            confirmButtonText: 'Cerrar',
            width: 600
        });
    }

    function tituloEventoDetalle(tipo) {
        switch (tipo) {
            case 'entrega': return 'Entrega programada';
            case 'recoleccion': return 'Recoleccion programada';
            case 'verificacion': return 'Verificacion vehicular';
            case 'licencia': return 'Licencia por vencer';
            case 'mant': return 'Mantenimiento';
            default: return 'Evento';
        }
    }

    function colorEventoDetalle(tipo) {
        switch (tipo) {
            case 'entrega': return '#1d4ed8';
            case 'recoleccion': return '#0f8a5f';
            case 'verificacion': return '#b45309';
            case 'licencia': return '#be123c';
            case 'mant': return '#f59e0b';
            default: return '#64748b';
        }
    }

    function renderizarHistorialMantenimientos(lista) {
        DOM.tablaMantenimientos.innerHTML = lista.map(m => `
            <tr>
                <td>${new Date(m.fecha).toLocaleDateString()}</td>
                <td><strong>${m.economico}</strong> (${m.placa})</td>
                <td>${m.tipo.toUpperCase()}</td>
                <td>${m.descripcion}</td>
                <td>$${m.costo}</td>
                <td>${m.kilometraje} KM</td>
            </tr>
        `).join('') || '<tr><td colspan="6" style="text-align:center;">Sin registros de mantenimiento</td></tr>';
    }

    function renderizarHistorialEntregas(lista) {
        const tabla = document.querySelector('#tabla-historial tbody');
        if (!tabla) return;
        
        tabla.innerHTML = lista.map(a => {
            const esFallido = a.logistica_estado === 'fallido';
            const btnColor = esFallido ? '#c0392b' : '#3498db';
            const btnBg = esFallido ? '#fdeded' : '#eaf2f8';
            
            // Mostrar tipo_movimiento con badge diferenciado
            const tipoMovimiento = a.tipo_movimiento || 'ENTREGA';
            const estaRecoleccion = tipoMovimiento === 'RECOLECCION';
            const badgeOperacion = estaRecoleccion 
                ? '<span style="font-size:0.75rem; background:#fff3e0; color:#e67e22; border:1px solid #f0ad4e; padding:3px 7px; border-radius:6px; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><i class="fa fa-undo"></i> RECOLECCIÓN</span>'
                : '<span style="font-size:0.75rem; background:#e8f5e9; color:#27ae60; border:1px solid #4caf50; padding:3px 7px; border-radius:6px; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><i class="fa fa-check-circle"></i> ENTREGA</span>';
            
            return `
            <tr>
                <td>
                    <button onclick="window.verDetalleHistorial('${encodeURIComponent(JSON.stringify(a))}')" class="btn-action" style="padding:4px 8px; font-size:12px; border:1px solid ${btnColor}; background:${btnBg}; color:${btnColor}; cursor:pointer;">
                        <i class="fa ${esFallido ? 'fa-triangle-exclamation' : 'fa-eye'}"></i> <strong>${a.numero_contrato || a.pedido_id}</strong>
                    </button>
                    ${esFallido ? '<br><span style="font-size:0.65rem; color:#c0392b; font-weight:bold;">FALLIDO</span>' : ''}
                </td>
                <td>${badgeOperacion}</td>
                <td>${a.cliente || 'Contrato sin cliente'}</td>
                <td>${esFallido ? '<span style="color:#c0392b;">No entregado</span>' : (a.recibio_nombre || '<span style="color:#aaa;">No registrado</span>')}</td>
                <td><i class="fa fa-user" style="color:#666; font-size:12px;"></i> ${a.chofer || 'Desconocido'}</td>
                <td><i class="fa fa-truck" style="color:#666; font-size:12px;"></i> ${a.vehiculo || 'No asignada'}</td>
                <td>${new Date(a.fecha_entrega).toLocaleString('es-MX')}</td>
                <td>
                    ${a.evidencia_url 
                        ? `<a href="${a.evidencia_url}" target="_blank" class="btn-action" style="padding:4px 8px; font-size:12px; border:1px solid #1abc9c; background:#e6f9f0; text-decoration:none; color:#1abc9c;"><i class="fa fa-image"></i> Ver Foto</a>`
                        : (esFallido ? `<span style="color:#c0392b; font-size:12px; font-weight:bold;">Incidencia</span>` : `<span style="color:#888; font-size:12px;">Sin Foto</span>`)
                    }
                </td>
            </tr>`;
        }).join('') || '<tr><td colspan="8" style="text-align:center; padding:20px;">No hay historial de entregas.</td></tr>';
    }

    window.verDetalleHistorial = function(dataStr) {
        try {
            const data = JSON.parse(decodeURIComponent(dataStr));
            const isFallido = data.logistica_estado === 'fallido';
            
            Swal.fire({
                title: isFallido ? 'Detalles de la Incidencia' : 'Detalle de Entrega',
                html: `
                    <div style="text-align: left; font-size: 14px; line-height: 1.6; color:#333;">
                        <p><strong><i class="fa fa-file-contract" style="color:#3498db; width:20px;"></i> Pedido / Contrato:</strong> ${data.numero_contrato || data.pedido_id}</p>
                        <p><strong><i class="fa fa-user" style="color:#3498db; width:20px;"></i> Cliente:</strong> ${data.cliente || 'No especificado'}</p>
                        ${!isFallido ? `<p><strong><i class="fa fa-signature" style="color:#3498db; width:20px;"></i> Entregado a:</strong> ${data.recibio_nombre || 'No registrado'}</p>` : ''}
                        
                        <hr style="border: 1px solid #eee; margin:15px 0;">
                        <p><strong><i class="fa fa-truck" style="color:#e67e22; width:20px;"></i> Chofer:</strong> ${data.chofer || 'Desconocido'}</p>
                        <p><strong><i class="fa fa-car" style="color:#e67e22; width:20px;"></i> Vehiculo:</strong> ${data.vehiculo || 'N/A'}</p>
                        <p><strong><i class="fa fa-calendar" style="color:#e67e22; width:20px;"></i> Fecha del Viaje:</strong> ${new Date(data.fecha_entrega).toLocaleString('es-MX')}</p>
                        
                        ${isFallido ? `
                        <div style="margin-top:15px; padding:10px; background:#fdeded; border-left:4px solid #c0392b; border-radius:4px;">
                           <p style="color:#c0392b; margin:0; font-weight:bold;">MOTIVO DE FALLO / INCIDENCIA:</p>
                           <p style="color:#666; margin:5px 0 0 0; font-style:italic;">"${data.observaciones || 'No se especifico motivo'}"</p>
                        </div>
                        ` : ''}
                    </div>
                `,
                icon: isFallido ? 'warning' : 'info',
                confirmButtonText: 'Cerrar',
                confirmButtonColor: isFallido ? '#c0392b' : '#3498db'
            });
        } catch(e) { console.error('Error al abrir detalle:', e); }
    };

    async function cargarOpcionesAsignacion() {
        try {
            const [vehiculos, choferes] = await Promise.all([
                LogisticaServicio.obtenerVehiculos(),
                LogisticaServicio.obtenerChoferes()
            ]);
            DOM.selVehiculo.innerHTML = '<option value="">Unidad...</option>' + 
                vehiculos.filter(v => v.estatus === 'activo').map(v => `<option value="${v.id}">${v.economico}</option>`).join('');
            // rh_empleados usa 'id' como PK (VARCHAR)
            DOM.selChofer.innerHTML = '<option value="">Chofer...</option>' + 
                choferes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        } catch (err) { }
    }

    let leafletMap = null;
    let mapMarkers = [];

    function initMapaTracking(trackings) {
        const mapContainer = document.getElementById('mapa-logistica');
        if (!mapContainer) return;

        // Limpiar el estado o inicializar
        if (!leafletMap) {
            // Eliminar el contenido placeholder y aplicar el estilo necesario para Leaflet
            mapContainer.innerHTML = '';
            mapContainer.style.background = 'none';
            mapContainer.style.border = 'none';
            
            leafletMap = L.map('mapa-logistica');
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '(c) OpenStreetMap - Andamios Torres GPS'
            }).addTo(leafletMap);
        }

        // Limpiar marcadores viejos
        mapMarkers.forEach(m => leafletMap.removeLayer(m));
        mapMarkers = [];

        const activeRoutesContainer = document.getElementById('active-routes-container');
        if (activeRoutesContainer) activeRoutesContainer.innerHTML = '';

        if (!trackings || trackings.length === 0) {
            leafletMap.setView([19.4326, -99.1332], 10);
            const center = leafletMap.getCenter();
            const placeholder = L.popup()
                .setLatLng(center)
                .setContent('<div style="text-align:center;"><b>No hay rutas activas</b><br>Esperando que los choferes inicien ruta.</div>')
                .openOn(leafletMap);
            return;
        }

        const bounds = [];
        trackings.forEach(t => {
            const lat = parseFloat(t.latitud);
            const lng = parseFloat(t.longitud);
            if (isNaN(lat) || isNaN(lng)) return;

            const iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';
            const icon = L.icon({
                iconUrl: iconUrl,
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            const marker = L.marker([lat, lng], {icon: icon}).addTo(leafletMap);
            marker.bindPopup(`
                <b>Chofer en Ruta:</b> ${t.chofer_nombre || 'Desconocido'}<br>
                <b>Unidad:</b> ${t.economico || 'Unidad asignada'}<br>
                <b>Folio:</b> ${t.folio_referencia || t.numero_contrato || t.pedido_id}<br>
                <b>Ultima vez:</b> ${new Date(t.timestamp).toLocaleTimeString()}
            `);
            mapMarkers.push(marker);
            bounds.push([lat, lng]);

            if (activeRoutesContainer) {
                const btn = document.createElement('button');
                btn.className = 'btn-action';
                btn.style.cssText = 'background:var(--surface); color:var(--primary); border:1px solid var(--border); border-radius:30px; padding:6px 15px; font-size:0.85rem; box-shadow:0 2px 5px rgba(0,0,0,0.05); white-space:nowrap;';
                btn.innerHTML = `<i class="fa-solid fa-truck-fast"></i> ${t.chofer_nombre?.split(' ')[0] || 'Chofer'} (${t.economico || 'Unidad'})`;
                
                btn.onclick = () => {
                    leafletMap.setView([lat, lng], 16);
                    marker.openPopup();
                    
                    // Resaltar boton seleccionado
                    Array.from(activeRoutesContainer.children).forEach(c => {
                        c.style.background = 'var(--surface)';
                        c.style.color = 'var(--primary)';
                    });
                    btn.style.background = 'var(--primary)';
                    btn.style.color = '#fff';
                };
                activeRoutesContainer.appendChild(btn);
            }
        });

        if (bounds.length > 0) {
            leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }

        setTimeout(() => {
            try { leafletMap.invalidateSize(); } catch (_) {}
        }, 100);
    }

    async function abrirDetalles(id) {
        try {
            const v = await LogisticaServicio.obtenerVehiculo(id);
            document.getElementById('det-economico').textContent = v.economico;
            document.getElementById('det-placa').textContent = v.placa;
            document.getElementById('det-modelo').textContent = `${v.modelo} (${v.anio})`;
            const est = document.getElementById('det-estatus');
            est.textContent = v.estatus; est.className = `badge badge-${v.estatus}`;
            document.getElementById('det-km').textContent = v.kilometraje_inicial || 0;
            document.getElementById('det-documentos').innerHTML = v.documentos.map(d => `
                <div style="font-size:0.8rem;"><strong>${d.tipo.toUpperCase()}:</strong> ${new Date(d.fecha_fin).toLocaleDateString()}</div>
            `).join('') || '<p>Sin docs</p>';
            document.querySelector('#tabla-mantenimientos-unidad tbody').innerHTML = v.mantenimientos.map(m => `
                <tr><td>${new Date(m.fecha).toLocaleDateString()}</td><td>${m.tipo}</td><td>${m.descripcion}</td><td>$${m.costo}</td></tr>
            `).join('') || '<tr><td colspan="4">Sin historial</td></tr>';
            DOM.overlayDetalles.style.display = 'flex';
        } catch (err) { LogisticaNotificaciones.mostrarAlerta(err.message, 'error'); }
    }

    function abrirMantenimiento(id) {
        document.getElementById('mant-vehiculo-id').value = id;
        DOM.overlayMantenimiento.style.display = 'flex';
    }

    function actualizarPasos() {
        DOM.stepContents.forEach(c => c.classList.remove('active'));
        DOM.stepTabs.forEach(t => t.classList.remove('active'));
        document.getElementById(`step-${currentStep}`).classList.add('active');
        DOM.stepTabs[currentStep - 1].classList.add('active');
        DOM.btnPrev.style.display = currentStep === 1 ? 'none' : 'block';
        DOM.btnNext.style.display = currentStep === totalSteps ? 'none' : 'block';
        DOM.btnFinish.style.display = currentStep === totalSteps ? 'block' : 'none';
    }

    function renderizarKPIs(dash, choferes = []) {
        const activos = (dash.vehiculos || []).find(v => v.estatus === 'activo')?.total || 0;
        const mantenimientosPendientes = Number(dash.mantenimientos_pendientes || 0);
        const docsPorVencer = Number(dash.alertas_criticas || 0);
        const choferesDisponibles = Array.isArray(choferes) ? choferes.length : Number(dash.choferes_disponibles || 0);
        const pedidosEnRuta = Array.isArray(dash.asignaciones_activas) ? dash.asignaciones_activas.length : 0;

        if (DOM.kpiVehiculosActivos) DOM.kpiVehiculosActivos.textContent = activos;
        if (DOM.kpiMantenimientosProximos) DOM.kpiMantenimientosProximos.textContent = mantenimientosPendientes;
        if (DOM.kpiDocumentosPorVencer) DOM.kpiDocumentosPorVencer.textContent = docsPorVencer;
        if (DOM.kpiChoferesDisponibles) DOM.kpiChoferesDisponibles.textContent = choferesDisponibles;
        if (DOM.kpiPedidosEnRuta) DOM.kpiPedidosEnRuta.textContent = pedidosEnRuta;
    }

    function renderizarVehiculos(vehiculos) {
        DOM.tablaVehiculos.innerHTML = vehiculos.map(v => `
            <tr><td>${v.economico}</td><td><strong>${v.placa}</strong></td><td>${v.modelo}</td><td><span class="badge badge-${v.estatus}">${v.estatus}</span></td><td>${v.kilometraje_inicial || 0} KM</td>
            <td><button class="btn-action btn-view" data-id="${v.id}"><i class="fa-solid fa-eye"></i></button><button class="btn-action btn-tools" data-id="${v.id}" style="background:var(--warning); color:#fff;"><i class="fa-solid fa-tools"></i></button></td></tr>
        `).join('');
    }

    function renderizarAlertas(dash) {
        if (!DOM.contenedorAlertas) return;

        const alertas = [];
        const docs = dash.alertas_vencimiento || [];
        const retrasos = dash.retrasos_entregas || [];
        const mantenimientosPendientes = Number(dash.mantenimientos_pendientes || 0);

        docs.forEach(a => {
            alertas.push({
                titulo: `Seguro/documento por vencer: ${a.economico || 'Unidad'}`,
                detalle: `${String(a.tipo || 'documento').toUpperCase()} - vence ${new Date(a.fecha_fin).toLocaleDateString('es-MX')}`
            });
        });

        if (mantenimientosPendientes > 0) {
            alertas.push({
                titulo: `Mantenimientos pendientes: ${mantenimientosPendientes}`,
                detalle: 'Hay unidades en estatus de mantenimiento.'
            });
        }

        retrasos.forEach(r => {
            alertas.push({
                titulo: `Retraso en entrega: ${r.numero_contrato || r.folio_referencia || r.pedido_id || 'N/A'}`,
                detalle: `${r.chofer_nombre || 'Chofer'} - ${r.vehiculo_economico || 'Unidad'}`
            });
        });

        if (DOM.alertasCounter) DOM.alertasCounter.textContent = String(alertas.length);

        if (!alertas.length) {
            DOM.contenedorAlertas.innerHTML = '<p style="color:var(--text-muted); margin:0;">Sin alertas activas</p>';
            return;
        }

        DOM.contenedorAlertas.innerHTML = alertas.map(a => `
            <div class="alerta-item">
                <strong>${a.titulo}</strong>
                <small>${a.detalle}</small>
            </div>
        `).join('');
    }

    function renderizarRuta(asignaciones) {
        if (!asignaciones || asignaciones.length === 0) {
            DOM.tablaRuta.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No hay unidades en ruta</td></tr>';
            return;
        }

        DOM.tablaRuta.innerHTML = asignaciones.map(a => `
            <tr>
                <td><strong>${a.vehiculo_economico || a.economico || 'Unidad'}</strong></td>
                <td>${a.chofer_nombre || a.chofer || 'Asignado'}</td>
                <td>${new Date(a.fecha_asignacion).toLocaleDateString()}</td>
                <td><span class="badge badge-activo">${a.estado}</span></td>
                <td style="display:flex; gap:5px; justify-content:center;">
                    <button class="btn-action" onclick="editarAsignacionActual(${a.id})" title="Reasignar" style="background:var(--primary); color:#fff; padding:5px 10px;">
                        <i class="fa-solid fa-rotate"></i>
                    </button>
                    <button class="btn-action" style="background:#25D366; border-color:#25D366; color:white; padding:5px 10px;" onclick="enviarWhatsAppChofer(${a.id}, '${a.chofer_id}', '${a.folio_referencia || a.numero_contrato || a.pedido_id}', '${a.chofer_telefono || ''}')" title="Enviar WhatsApp">
                        <i class="fa-brands fa-whatsapp"></i>
                    </button>
                    <button class="btn-action" style="background:var(--accent); border-color:var(--accent); color:white; padding:5px 10px;" onclick="window.open('templates/pages/entrega_detalle.html?id=${a.id}', '_blank')" title="Ver Mapa">
                        <i class="fa-solid fa-map-location-dot"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function renderizarPedidosPendientes(lista) {
        if (!lista || lista.length === 0) {
            DOM.tablaPedidos.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No hay pedidos en espera</td></tr>';
            return;
        }

        DOM.tablaPedidos.innerHTML = lista.map(p => {
            const esVenta = p.tipo_referencia === 'COTIZACION_VENTA';
            const badge = esVenta
                ? `<span style="font-size:0.65rem; background:#fff3e0; color:#e67e22; border:1px solid #f0ad4e; padding:2px 7px; border-radius:10px; font-weight:700; margin-left:6px;">VENTA</span>`
                : `<span style="font-size:0.65rem; background:#e8f5e9; color:#27ae60; border:1px solid #a9dfbf; padding:2px 7px; border-radius:10px; font-weight:700; margin-left:6px;">CONTRATO</span>`;
            return `
            <tr>
                <td><strong>${p.numero_contrato || p.pedido_id}</strong>${badge}</td>
                <td>${p.cliente_nombre || 'Cliente no especificado'}</td>
                <td>${p.fecha_compromiso ? new Date(p.fecha_compromiso).toLocaleDateString() : '--'}</td>
                <td style="text-align:center;">
                    <button class="btn-action" onclick="usarPedidoWaitlist('${p.pedido_id}')">Usar</button>
                </td>
            </tr>`;
        }).join('');
    }

    function renderizarRecoleccionesPendientes(lista) {
        const tbody = document.querySelector('#tabla-recolecciones-pendientes tbody');
        if (!tbody) return;
        if (!lista || lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No hay recolecciones proximas</td></tr>';
            return;
        }

        tbody.innerHTML = lista.map(p => {
            const fechaFinStr = p.fecha_compromiso ? new Date(p.fecha_compromiso).toLocaleDateString() : '--';
            const esCritico = new Date(p.fecha_compromiso) <= new Date();
            const estiloFecha = esCritico ? 'color:var(--accent); font-weight:bold;' : '';

            return `
            <tr>
                <td><strong>${p.numero_contrato || p.pedido_id}</strong></td>
                <td>${p.cliente_nombre || 'Cliente no especificado'}</td>
                <td style="${estiloFecha}">${fechaFinStr}</td>
                <td style="text-align:center;">
                    <button class="btn-action" onclick="usarPedidoWaitlist('${p.pedido_id}', 'CONTRATO', 'RECOLECCION')" style="background:var(--accent); border-color:var(--accent); color:white;">Recolectar</button>
                </td>
            </tr>`;
        }).join('');
    }

    // Funciones globales para botones
    window.usarPedidoWaitlist = function(pedidoId, tipoRef = 'CONTRATO', tipoMov = 'ENTREGA') {
        const inputId = document.querySelector('input[name="pedido_id"]');
        const inputRef = document.querySelector('input[name="tipo_referencia"]');
        const inputMov = document.querySelector('input[name="tipo_movimiento"]');
        
        if (inputId) inputId.value = pedidoId;
        if (inputRef) inputRef.value = tipoRef;
        if (inputMov) inputMov.value = tipoMov;
        
        if (inputId) {
            inputId.focus();
            LogisticaNotificaciones.mostrarAlerta(`ID cargado para ${tipoMov.toLowerCase()}`, 'info', 1500);
        }
    };

    window.enviarWhatsAppChofer = function(asignacionId, choferId, folioReferencia, choferTelefono = '') {
        const urlSeguimiento = `${window.location.origin}/templates/pages/entrega_detalle.html?id=${asignacionId}`;
        const mensaje = encodeURIComponent(`Hola, se te ha asignado el pedido (Folio ${folioReferencia}). Puedes ver los detalles y el mapa aqui: ${urlSeguimiento}`);
        
        let urlWa = `https://wa.me/?text=${mensaje}`;
        if (choferTelefono && choferTelefono.trim() !== '') {
            // Limpia caracteres no numericos
            const numLimpio = choferTelefono.replace(/\D/g, '');
            // Asume codigo de pais 52 si tiene 10 digitos (Mexico)
            const numParseado = numLimpio.length === 10 ? `52${numLimpio}` : numLimpio;
            urlWa = `https://wa.me/${numParseado}?text=${mensaje}`;
        }
        
        window.open(urlWa, '_blank');
    };

    // --- Fin de funciones globales ---

    async function abrirReasignar(id) {
        try {
            document.getElementById('edit-asignacion-id').value = id;
            
            // Cargar datos actuales
            const response = await fetch(`/api/logistica/asignaciones/${id}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!response.ok) throw new Error('No se pudo obtener el detalle');
            const asignacion = await response.json();
            
            // Poblar selects
            const [vehiculos, choferes] = await Promise.all([
                LogisticaServicio.obtenerVehiculos(),
                LogisticaServicio.obtenerChoferes()
            ]);
            
            DOM.selVehiculoEdit.innerHTML = vehiculos
                .filter(v => v.estatus === 'activo' || v.id == asignacion.vehiculo_id)
                .map(v => `<option value="${v.id}" ${v.id == asignacion.vehiculo_id ? 'selected' : ''}>${v.economico} ${v.id == asignacion.vehiculo_id ? '(Actual)' : ''}</option>`)
                .join('');
                
            // rh_empleados usa 'id' (VARCHAR) como PK
            DOM.selChoferEdit.innerHTML = choferes
                .map(c => `<option value="${c.id}" ${c.id == asignacion.chofer_id ? 'selected' : ''}>${c.nombre} ${c.id == asignacion.chofer_id ? '(Actual)' : ''}</option>`)
                .join('');
                
            DOM.overlayReasignar.style.display = 'flex';
        } catch (err) {
            const errorMsg = err.error || err.message || 'Error desconocido';
            Swal.fire('Error', errorMsg, 'error');
        }
    }

    async function guardarReasignacion(e) {
        e.preventDefault();
        const id = document.getElementById('edit-asignacion-id').value;
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(`/api/logistica/asignaciones/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire({
                    title: 'Actualizado!',
                    text: 'La ruta ha sido reasignada con exito.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
                DOM.overlayReasignar.style.display = 'none';
                cargarDatos('dashboard');
            } else {
                throw new Error(result.error || 'Error al actualizar');
            }
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    }

    function inicializarSocketsTiempoReal() {
        if (!window.LogisticaWebSocket) {
            console.warn('[Logistica] Servicio WebSocket no disponible. Se mantiene polling.');
            return;
        }

        try {
            LogisticaWebSocket.connect();
            wsUnsubscribe = LogisticaWebSocket.onMessage(manejarEvento);
        } catch (error) {
            console.warn('[Logistica] No se pudo inicializar websocket:', error.message);
        }
    }

    function manejarEvento(data) {
        if (!data || !data.tipo) return;

        switch (data.tipo) {
            case 'ubicacion':
                actualizarMapa(data);
                break;
            case 'pedido_asignado':
                actualizarUIAsignacion(data);
                break;
            case 'vehiculo_llego':
                LogisticaNotificaciones.mostrarAlerta(data.mensaje || 'Vehiculo llego al destino', 'success');
                 refrescoDashboardConDebounce(700);
                break;
            case 'notificacion':
                mostrarNotificacion(data.mensaje);
                refrescoDashboardConDebounce(900);
                break;
            case 'ws_estado':
                if (data.estado === 'desconectado') {
                    console.warn('[Logistica][WS] desconectado, reintentando...');
                }
                break;
            default:
                break;
        }
    }

    function actualizarMapa() {
        const dashboardVisible = document.getElementById('sec-dashboard')?.classList.contains('active');
        if (!dashboardVisible) return;
        refrescoDashboardConDebounce(500);
    }

    function actualizarUIAsignacion(data) {
        LogisticaNotificaciones.mostrarAlerta(`Pedido asignado (Folio ${data.folio_referencia || data.numero_contrato || data.pedido_id || 'N/A'})`, 'info');
        refrescoDashboardConDebounce(700);
    }

    function mostrarNotificacion(mensaje) {
        if (!mensaje) return;
        LogisticaNotificaciones.mostrarAlerta(mensaje, 'warning');
    }

    function switchByUrl() {
        const params = new URLSearchParams(window.location.search);
        const section = params.get('section') || 'dashboard';
        activarSeccion(section);
    }

    return {
        init: () => {
            bindEvents();
            inicializarSocketsTiempoReal();
            switchByUrl();
        }
    };
})();

