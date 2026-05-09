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
    let historialEntregasGlobal = [];
    let estadoPaginacionHistorial = {
        paginaActual: 1,
        elementosPorPagina: 10,
        totalElementos: 0,
        totalPaginas: 0
    };

    const DOM = {
        // KPIs
        kpiVehiculosActivos: document.getElementById('kpi-vehiculos-activos'),
        kpiMantenimientosProximos: document.getElementById('kpi-mantenimientos-proximos'),
        kpiDocumentosPorVencer: document.getElementById('kpi-documentos-por-vencer'),
        kpiChoferesDisponibles: document.getElementById('kpi-choferes-disponibles'),
        kpiPedidosEnRuta: document.getElementById('kpi-pedidos-en-ruta'),
        alertasCounter: document.getElementById('alerts-counter'),
        
        // Analitica KPIs
        anaKpiExito: document.getElementById('ana-kpi-exito'),
        anaKpiTiempo: document.getElementById('ana-kpi-tiempo'),
        anaKpiFlota: document.getElementById('ana-kpi-flota'),
        anaKpiIncidencias: document.getElementById('ana-kpi-incidencias'),
        
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
        stepTabs: document.querySelectorAll('.modal-tab-btn'),

        // Filtros Historial
        historialSearchQuery: document.getElementById('historial-search-query'),
        historialSearchFecha: document.getElementById('historial-search-fecha'),
        historialSearchChofer: document.getElementById('historial-search-chofer'),
        btnBuscarHistorial: document.getElementById('btn-buscar-historial'),
        btnLimpiarHistorial: document.getElementById('btn-limpiar-historial')
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

        // 10. Filtros de Historial
        if (DOM.btnBuscarHistorial) {
            DOM.btnBuscarHistorial.addEventListener('click', () => {
                cargarDatos('historial');
            });
        }

        if (DOM.btnLimpiarHistorial) {
            DOM.btnLimpiarHistorial.addEventListener('click', () => {
                if (DOM.historialSearchQuery) DOM.historialSearchQuery.value = '';
                if (DOM.historialSearchFecha) DOM.historialSearchFecha.value = '';
                if (DOM.historialSearchChofer) DOM.historialSearchChofer.value = '';
                cargarDatos('historial');
            });
        }

        // Ejecutar búsqueda al presionar Enter en cualquier campo de los filtros
        [DOM.historialSearchQuery, DOM.historialSearchFecha, DOM.historialSearchChofer].forEach(input => {
            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        cargarDatos('historial');
                    }
                });
            }
        });
    }

    function activarSeccion(secId) {
        DOM.sections.forEach(s => s.classList.toggle('active', s.id === `sec-${secId}`));
        configurarPollingDashboard(secId);
        cargarDatos(secId);
    }

    async function cargarDatos(seccion = 'dashboard') {
        try {
            switch(seccion) {
                case 'analitica':
                    const datosAna = await LogisticaServicio.obtenerAnalitica();
                    renderizarAnalitica(datosAna);
                    break;
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
                    estadoPaginacionHistorial.paginaActual = 1;
                    const filtros = {
                        search: DOM.historialSearchQuery?.value || '',
                        fecha: DOM.historialSearchFecha?.value || '',
                        chofer: DOM.historialSearchChofer?.value || ''
                    };
                    const datosHistorial = await LogisticaServicio.obtenerHistorial(filtros);
                    renderizarHistorialEntregas(datosHistorial);
                    
                    // Cargar choferes en el filtro si no están cargados
                    if (DOM.historialSearchChofer && DOM.historialSearchChofer.options.length <= 1) {
                        const choferesH = await LogisticaServicio.obtenerChoferes().catch(() => []);
                        DOM.historialSearchChofer.innerHTML = '<option value="">Todos los Choferes</option>' + 
                            choferesH.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
                    }
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
        
        historialEntregasGlobal = lista;
        estadoPaginacionHistorial.totalElementos = historialEntregasGlobal.length;
        estadoPaginacionHistorial.totalPaginas = Math.ceil(estadoPaginacionHistorial.totalElementos / estadoPaginacionHistorial.elementosPorPagina);
        
        if (estadoPaginacionHistorial.totalPaginas > 0 && estadoPaginacionHistorial.paginaActual > estadoPaginacionHistorial.totalPaginas) {
            estadoPaginacionHistorial.paginaActual = 1;
        }

        const inicio = (estadoPaginacionHistorial.paginaActual - 1) * estadoPaginacionHistorial.elementosPorPagina;
        const fin = inicio + estadoPaginacionHistorial.elementosPorPagina;
        const listaPagina = historialEntregasGlobal.slice(inicio, fin);

        tabla.innerHTML = listaPagina.map(a => {
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

        actualizarPieTablaHistorial();
        renderizarPaginacionHistorial();
    }

    window.irAPaginaHistorial = function(pagina) {
        if (pagina >= 1 && pagina <= estadoPaginacionHistorial.totalPaginas) {
            estadoPaginacionHistorial.paginaActual = pagina;
            renderizarHistorialEntregas(historialEntregasGlobal);
        }
    };

    function actualizarPieTablaHistorial() {
        const spanInfo = document.getElementById('historial-mostrando-info');
        if (!spanInfo) return;
        
        if (estadoPaginacionHistorial.totalElementos === 0) {
            spanInfo.textContent = 'Mostrando 0-0 de 0 entregas encontradas';
            return;
        }
        
        const inicio = ((estadoPaginacionHistorial.paginaActual - 1) * estadoPaginacionHistorial.elementosPorPagina) + 1;
        const fin = Math.min(estadoPaginacionHistorial.paginaActual * estadoPaginacionHistorial.elementosPorPagina, estadoPaginacionHistorial.totalElementos);
        
        spanInfo.textContent = `Mostrando ${inicio}-${fin} de ${estadoPaginacionHistorial.totalElementos} entregas encontradas`;
    }

    function renderizarPaginacionHistorial() {
        const pagContainer = document.getElementById('historial-pagination');
        if (!pagContainer) return;
        
        pagContainer.innerHTML = '';
        if (estadoPaginacionHistorial.totalPaginas <= 1) return;
        
        const pagActual = estadoPaginacionHistorial.paginaActual;
        const totalPags = estadoPaginacionHistorial.totalPaginas;
        const rangoVisible = 2; // páginas a cada lado de la actual
        
        // Botón Anterior
        const btnPrev = document.createElement('button');
        btnPrev.className = 'page-btn';
        btnPrev.innerHTML = '<i class="fa fa-chevron-left"></i>';
        if (pagActual === 1) btnPrev.setAttribute('disabled', 'true');
        else btnPrev.onclick = () => window.irAPaginaHistorial(pagActual - 1);
        pagContainer.appendChild(btnPrev);
        
        // Lógica de páginas numéricas
        for (let i = 1; i <= totalPags; i++) {
            if (i === 1 || i === totalPags || (i >= pagActual - rangoVisible && i <= pagActual + rangoVisible)) {
                const btn = document.createElement('button');
                btn.className = `page-btn ${i === pagActual ? 'active' : ''}`;
                btn.textContent = i;
                btn.onclick = () => window.irAPaginaHistorial(i);
                pagContainer.appendChild(btn);
            } else if (i === pagActual - rangoVisible - 1 || i === pagActual + rangoVisible + 1) {
                const span = document.createElement('button');
                span.className = 'page-btn';
                span.setAttribute('disabled', 'true');
                span.textContent = '...';
                pagContainer.appendChild(span);
            }
        }
        
        // Botón Siguiente
        const btnNext = document.createElement('button');
        btnNext.className = 'page-btn';
        btnNext.innerHTML = '<i class="fa fa-chevron-right"></i>';
        if (pagActual === totalPags) btnNext.setAttribute('disabled', 'true');
        else btnNext.onclick = () => window.irAPaginaHistorial(pagActual + 1);
        pagContainer.appendChild(btnNext);
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
                <div style="font-family: inherit; font-size: 13px;">
                    <b style="color:var(--primary);">Chofer en Ruta:</b> ${t.chofer_nombre || 'Desconocido'}<br>
                    <b>Unidad:</b> ${t.economico || 'Unidad asignada'}<br>
                    <b>Folio:</b> ${t.folio_referencia || t.numero_contrato || t.pedido_id}<br>
                    <hr style="margin: 8px 0; border: 0; border-top: 1px solid #eee;">
                    <button class="btn-action" style="width:100%; background:#2563eb; color:#fff; border:none; border-radius:4px; padding:6px; cursor:pointer;" onclick="window.visualizarRutaOptima(${t.asignacion_id || t.id})">
                        <i class="fa-solid fa-route"></i> Ver Ruta Inteligente
                    </button>
                    <p style="margin: 5px 0 0 0; font-size: 10px; color: #999; text-align: center;">Última vez: ${new Date(t.timestamp).toLocaleTimeString()}</p>
                </div>
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
            DOM.tablaRuta.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No hay unidades en ruta</td></tr>';
            return;
        }

        DOM.tablaRuta.innerHTML = asignaciones.map(a => `
            <tr>
                <td><strong>${a.vehiculo_economico || a.economico || 'Unidad'}</strong></td>
                <td>${a.chofer_nombre || a.chofer || 'Asignado'}</td>
                <td>
                    <div style="font-size:0.75rem; color:var(--muted); margin-bottom:2px;">CONTRATO/VENTA</div>
                    <strong style="font-size:0.95rem;">${a.numero_contrato || a.folio_referencia || a.pedido_id || 'N/A'}</strong>
                </td>
                <td>${new Date(a.fecha_asignacion).toLocaleDateString()}</td>
                <td><span class="badge badge-activo">${a.estado}</span></td>
                <td style="display:flex; gap:5px; justify-content:center;">
                    <button class="btn-action" style="background:var(--primary); color:#fff; padding:5px 10px;" onclick="window.verUrlsAsignacion(${a.id})" title="Ver Seguimiento">
                        <i class="fa-solid fa-link"></i>
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
            const tipoLabel = esVenta ? 'VENTA' : 'CONTRATO';
            return `
            <tr>
                <td>
                    <div style="font-size:0.75rem; color:var(--muted); margin-bottom:3px; font-weight:600;">${tipoLabel}</div>
                    <strong style="font-size:1rem; display:block; line-height:1.3;">${p.numero_contrato || p.pedido_id}</strong>
                    ${p.numero_contrato && p.pedido_id ? `<small style="color:var(--muted); font-size:0.8rem;">ID: ${p.pedido_id}</small>` : ''}
                </td>
                <td>${p.cliente_nombre || 'Cliente no especificado'}</td>
                <td>${p.fecha_compromiso ? new Date(p.fecha_compromiso).toLocaleDateString() : '--'}</td>
                <td style="text-align:center; display:flex; gap:5px; justify-content:center;">
                    <button class="btn-action" onclick="usarPedidoWaitlist('${p.pedido_id}', '${p.tipo_referencia}')" title="Usar para nueva asignación">Usar</button>
                    <button class="btn-action" style="background:#f39c12; color:#fff;" onclick="window.editarDetallePedido('${p.pedido_id}', '${p.tipo_referencia}')" title="Corregir datos (Incidencia)">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    ${p.id_asignacion ? `
                        <button class="btn-action" style="background:var(--primary); color:#fff; padding:5px 10px;" onclick="window.verUrlsAsignacion(${p.id_asignacion})" title="Ver Seguimiento">
                            <i class="fa-solid fa-link"></i>
                        </button>
                    ` : ''}
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
                <td>
                    <div style="font-size:0.75rem; color:var(--muted); margin-bottom:3px; font-weight:600;">CONTRATO</div>
                    <strong style="font-size:1rem; display:block; line-height:1.3;">${p.numero_contrato || p.pedido_id}</strong>
                    ${p.numero_contrato && p.pedido_id ? `<small style="color:var(--muted); font-size:0.8rem;">ID: ${p.pedido_id}</small>` : ''}
                </td>
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

    window.enviarWhatsAppChofer = async function(asignacionId, choferId, folioReferencia, choferTelefono = '') {
        try {
            // Obtener URLs reales del backend
            const urls = await LogisticaServicio.obtenerUrlsAsignacion(asignacionId);
            const urlSeguimiento = urls.chofer.prod; // Usar producción por defecto para WhatsApp

            const mensaje = encodeURIComponent(`Hola, se te ha asignado el pedido (Folio ${folioReferencia}). Puedes ver los detalles y el mapa aqui: ${urlSeguimiento}`);
            
            let urlWa = `https://wa.me/?text=${mensaje}`;
            if (choferTelefono && choferTelefono.trim() !== '') {
                const numLimpio = choferTelefono.replace(/\D/g, '');
                const numParseado = numLimpio.length === 10 ? `52${numLimpio}` : numLimpio;
                urlWa = `https://wa.me/${numParseado}?text=${mensaje}`;
            }
            
            window.open(urlWa, '_blank');
        } catch (error) {
            console.error('Error al enviar WhatsApp:', error);
            // Fallback en caso de error: abrir con URL básica
            const urlSeguimiento = `${window.location.origin}/templates/pages/entrega_detalle.html?id=${asignacionId}`;
            const mensaje = encodeURIComponent(`Hola, se te ha asignado el pedido (Folio ${folioReferencia}). Ver aqui: ${urlSeguimiento}`);
            window.open(`https://wa.me/?text=${mensaje}`, '_blank');
        }
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

    // --- Gestión de URLs de Seguimiento (RF5) ---
    window.verUrlsAsignacion = async function(asignacionId) {
        try {
            Swal.fire({
                title: 'Generando enlaces...',
                text: 'Espere un momento por favor',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            const urls = await LogisticaServicio.obtenerUrlsAsignacion(asignacionId);
            
            Swal.fire({
                title: '<i class="fa-solid fa-link"></i> Enlaces de Seguimiento',
                html: `
                    <div style="text-align:left; font-size:14px; color:#444;">
                        <p style="margin-bottom:8px; font-weight:700;">Para el Chofer (Acceso a Detalle):</p>
                        <div style="display:flex; gap:5px; margin-bottom:15px;">
                            <input type="text" id="url-chofer" value="${urls.chofer.prod}" readonly style="flex:1; padding:8px; border:1px solid #ddd; border-radius:4px; font-size:12px; background:#f9f9f9;">
                            <button onclick="copiarAlPortapapeles('url-chofer')" class="btn-action" style="padding:0 12px; background:var(--primary); color:#fff;"><i class="fa-solid fa-copy"></i></button>
                        </div>
                        
                        <p style="margin-bottom:8px; font-weight:700;">Para el Cliente (Seguimiento Público):</p>
                        <div style="display:flex; gap:5px; margin-bottom:15px;">
                            <input type="text" id="url-cliente" value="${urls.cliente.prod}" readonly style="flex:1; padding:8px; border:1px solid #ddd; border-radius:4px; font-size:12px; background:#f9f9f9;">
                            <button onclick="copiarAlPortapapeles('url-cliente')" class="btn-action" style="padding:0 12px; background:var(--primary); color:#fff;"><i class="fa-solid fa-copy"></i></button>
                        </div>

                        <div style="background:#f1f5f9; padding:10px; border-radius:6px; margin-top:10px;">
                            <p style="font-size:11px; color:#64748b; margin:0;">
                                <i class="fa-solid fa-info-circle"></i> Los enlaces de <strong>Producción</strong> son para uso real del cliente y chofer.
                            </p>
                            <details style="margin-top:8px;">
                                <summary style="font-size:11px; cursor:pointer; color:var(--primary); font-weight:600;">Ver enlaces de Desarrollo (Ngrok)</summary>
                                <div style="margin-top:8px; border-top:1px dashed #cbd5e1; padding-top:8px;">
                                    <small style="display:block; margin-bottom:4px;"><strong>Chofer:</strong> ${urls.chofer.ngrok}</small>
                                    <small style="display:block;"><strong>Cliente:</strong> ${urls.cliente.ngrok}</small>
                                </div>
                            </details>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: 'var(--primary)',
                width: '500px'
            });
        } catch (error) {
            console.error('Error al generar URLs:', error);
            Swal.fire('Error', 'No se pudieron generar los enlaces: ' + error.message, 'error');
        }
    };

    window.copiarAlPortapapeles = function(id) {
        const input = document.getElementById(id);
        if (!input) return;
        
        input.select();
        input.setSelectionRange(0, 99999); // Para moviles
        
        try {
            navigator.clipboard.writeText(input.value);
            LogisticaNotificaciones.mostrarAlerta('Enlace copiado al portapapeles', 'success', 1500);
        } catch (err) {
            // Fallback para navegadores viejos
            document.execCommand('copy');
            LogisticaNotificaciones.mostrarAlerta('Copiado', 'success', 1000);
        }
    };

    // --- Gestión de Incidencias / Corrección de Datos (RF5) ---
    window.editarDetallePedido = async function(id, tipo) {
        try {
            Swal.fire({ title: 'Cargando datos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            const pedido = await LogisticaServicio.obtenerDetallePedido(id, tipo);
            const entregaCalle = pedido.entrega_calle || '';
            const entregaNumExt = pedido.entrega_numero_ext || '';
            const entregaColonia = pedido.entrega_colonia || '';
            const entregaMunicipio = pedido.entrega_municipio || '';
            const entregaCp = pedido.entrega_cp || '';
            
            Swal.fire({
                title: `<i class="fa-solid fa-pencil"></i> Corregir Datos - ${pedido.folio || id}`,
                html: `
                    <div style="text-align:left; font-size:13px;">
                        <p style="margin-bottom:12px; color:#666;">Corrija los datos para habilitar el cálculo de ruta óptima.</p>
                        
                        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                            <b style="color:var(--primary); display:block; margin-bottom:8px;"><i class="fa-solid fa-location-dot"></i> Datos del Domicilio</b>
                            
                            ${tipo === 'CONTRATO' ? `
                                <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px; margin-bottom:8px;">
                                    <div>
                                        <label style="display:block; font-weight:700; font-size:11px;">CALLE:</label>
                                        <input type="text" id="edit-calle" value="${pedido.calle || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                                    </div>
                                    <div>
                                        <label style="display:block; font-weight:700; font-size:11px;">N. EXT:</label>
                                        <input type="text" id="edit-num-ext" value="${pedido.numero_externo || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                                    </div>
                                </div>
                                <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:10px; margin-bottom:8px;">
                                    <div>
                                        <label style="display:block; font-weight:700; font-size:11px;">COLONIA:</label>
                                        <input type="text" id="edit-colonia" list="edit-colonia-list" value="${pedido.colonia || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                                    </div>
                                    <div>
                                        <label style="display:block; font-weight:700; font-size:11px;">C.P.:</label>
                                        <input type="text" id="edit-cp" value="${pedido.codigo_postal || ''}" placeholder="56410" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                                        <div id="edit-cp-status" style="margin-top:6px;font-size:12px;color:#4b5563;"></div>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label style="display:block; font-weight:700; font-size:11px;">MUNICIPIO / ALCALDÍA:</label>
                                    <input type="text" id="edit-municipio" value="${pedido.municipio || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                                </div>
                            ` : `
                                <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px; margin-bottom:8px;">
                                    <div>
                                        <label style="display:block; font-weight:700; font-size:11px;">CALLE:</label>
                                        <input type="text" id="edit-calle" value="${pedido.entrega_calle || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                                    </div>
                                    <div>
                                        <label style="display:block; font-weight:700; font-size:11px;">N. EXT:</label>
                                        <input type="text" id="edit-num-ext" value="${pedido.entrega_numero_ext || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                                    </div>
                                </div>
                                <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:10px; margin-bottom:8px;">
                                    <div>
                                        <label style="display:block; font-weight:700; font-size:11px;">COLONIA:</label>
                                        <input type="text" id="edit-colonia" list="edit-colonia-list" value="${pedido.entrega_colonia || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                                    </div>
                                    <div>
                                        <label style="display:block; font-weight:700; font-size:11px;">C.P.:</label>
                                        <input type="text" id="edit-cp" value="${pedido.entrega_cp || ''}" placeholder="56410" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                                        <div id="edit-cp-status" style="margin-top:6px;font-size:12px;color:#4b5563;"></div>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label style="display:block; font-weight:700; font-size:11px;">MUNICIPIO / ALCALDÍA:</label>
                                    <input type="text" id="edit-municipio" value="${pedido.entrega_municipio || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                                </div>
                                <div class="form-group" style="margin-top:12px;">
                                    <label style="display:block; font-weight:700; font-size:11px;">DIRECCIÓN COMPLETA (opcional):</label>
                                    <textarea id="edit-direccion" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; height:60px; font-family:inherit;">${pedido.direccion_entrega || ''}</textarea>
                                </div>
                            `}
                        </div>

                        <div style="background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px;">
                            <b style="color:var(--primary); display:block; margin-bottom:8px;"><i class="fa-solid fa-user"></i> Contacto en Obra</b>
                            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                                <div>
                                    <label style="display:block; font-weight:700; font-size:11px;">NOMBRE:</label>
                                    <input type="text" id="edit-contacto" value="${pedido.contacto_nombre || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                                </div>
                                <div>
                                    <label style="display:block; font-weight:700; font-size:11px;">TELÉFONO:</label>
                                    <input type="text" id="edit-telefono" value="${pedido.contacto_telefono || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                                </div>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                            <div>
                                <label style="display:block; font-weight:700; font-size:11px;">LATITUD:</label>
                                <input type="number" step="any" id="edit-latitud" value="${pedido.latitud || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px; background:#f0f9ff;">
                            </div>
                            <div>
                                <label style="display:block; font-weight:700; font-size:11px;">LONGITUD:</label>
                                <input type="number" step="any" id="edit-longitud" value="${pedido.longitud || ''}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px; background:#f0f9ff;">
                            </div>
                        </div>

                        <button type="button" id="btn-geocoder" style="width:100%; padding:10px; background:var(--primary); color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                            <i class="fa-solid fa-magnifying-glass-location"></i> Buscar Coordenadas por CP / Dirección
                        </button>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'Guardar y Recalcular',
                cancelButtonText: 'Cancelar',
                didOpen: () => {
                    const btn = document.getElementById('btn-geocoder');

                const editColonia = document.getElementById('edit-colonia');
                const editCp = document.getElementById('edit-cp');
                const editCpStatus = document.getElementById('edit-cp-status');

                async function autofillColoniaFromCP(value) {
                    if (!value || !/^\d{5}$/.test(value)) {
                        if (editCpStatus) editCpStatus.textContent = '';
                        return;
                    }
                    if (editCpStatus) editCpStatus.textContent = 'Buscando colonias por CP...';
                    try {
                        const colonias = new Set();
                        let municipio = '';
                        let estado = '';

                        const copomexKey = window.COPOMEX_API_KEY || window.copomexToken || null;
                        if (copomexKey) {
                            try {
                                const cRes = await fetch(`https://api.copomex.com/query/info_cp/${encodeURIComponent(value)}?type=simplified&token=${encodeURIComponent(copomexKey)}`);
                                if (cRes.ok) {
                                    const cj = await cRes.json();
                                    const info = cj?.response || cj?.['response'] || {};
                                    estado = info?.estado || estado;
                                    municipio = info?.municipio || info?.municipio_nombre || municipio;
                                    const asents = Array.isArray(info?.asentamiento) ? info.asentamiento : Array.isArray(info?.asentamientos) ? info.asentamientos : [];
                                    for (const item of asents) {
                                        if (item) colonias.add(item);
                                    }
                                }
                            } catch { }
                        }

                        if (!municipio || colonias.size === 0) {
                            try {
                                const zRes = await fetch(`https://api.zippopotam.us/mx/${encodeURIComponent(value)}`);
                                if (zRes.ok) {
                                    const z = await zRes.json();
                                    const place = Array.isArray(z.places) && z.places[0];
                                    if (place) {
                                        municipio = municipio || place['place name'] || '';
                                        estado = estado || place['state'] || '';
                                    }
                                }
                            } catch { }
                        }

                        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&country=Mexico&postalcode=${encodeURIComponent(value)}&limit=10`, {
                            headers: { 'Accept': 'application/json' }
                        });
                        if (response.ok) {
                            const data = await response.json();
                            for (const item of Array.isArray(data) ? data : []) {
                                const addr = item?.address || {};
                                const colonia = addr.suburb || addr.neighbourhood || addr.quarter || addr.hamlet || addr.locality || '';
                                if (colonia) colonias.add(colonia);
                                if (!municipio) municipio = addr.city || addr.town || addr.village || addr.municipality || addr.county || municipio;
                                if (!estado) estado = addr.state || estado;
                            }
                        }

                        if (editColonia && colonias.size) {
                            let dl = document.getElementById('edit-colonia-list');
                            if (!dl) {
                                dl = document.createElement('datalist');
                                dl.id = 'edit-colonia-list';
                                editColonia.parentElement?.appendChild(dl);
                            }
                            dl.innerHTML = Array.from(colonias).map(v => `<option value="${v}"></option>`).join('');
                            if (!editColonia.value) editColonia.value = Array.from(colonias)[0] || '';
                        }
                        if (municipio && !document.getElementById('edit-municipio').value) {
                            document.getElementById('edit-municipio').value = municipio;
                        }

                        if (editCpStatus) {
                            if (colonias.size) {
                                editCpStatus.textContent = `Colonias encontradas: ${colonias.size}`;
                            } else if (editColonia && editColonia.value?.trim()) {
                                editCpStatus.textContent = 'CP válido; colonia actual conservada.';
                            } else if (municipio || estado) {
                                const parts = [];
                                if (municipio) parts.push(municipio);
                                if (estado) parts.push(estado);
                                editCpStatus.textContent = `CP válido, ${parts.join(', ')}`;
                            } else {
                                editCpStatus.textContent = 'CP válido, pero no se encontraron colonias';
                            }
                        }
                    } catch (error) {
                        if (editCpStatus) editCpStatus.textContent = 'No se pudo buscar colonias por CP';
                    }
                }

                if (editCp && !editCp.dataset.bound) {
                    editCp.dataset.bound = 'true';
                    editCp.addEventListener('input', () => autofillColoniaFromCP(editCp.value.trim()));
                    editCp.addEventListener('blur', () => autofillColoniaFromCP(editCp.value.trim()));
                }

                btn.onclick = async () => {
                    let calle = '', num = '', col = '', mun = '', cp = '', fullQuery = '';

                    if (tipo === 'CONTRATO') {
                        calle = document.getElementById('edit-calle').value;
                        num = document.getElementById('edit-num-ext').value;
                        col = document.getElementById('edit-colonia').value;
                        mun = document.getElementById('edit-municipio').value;
                        cp = document.getElementById('edit-cp').value;
                        fullQuery = `${calle} ${num}, ${col}, ${mun} ${cp}`.trim();
                    } else {
                        calle = document.getElementById('edit-calle').value || entregaCalle;
                        num = document.getElementById('edit-num-ext').value || entregaNumExt;
                        col = document.getElementById('edit-colonia').value || entregaColonia;
                        mun = document.getElementById('edit-municipio').value || entregaMunicipio;
                        cp = document.getElementById('edit-cp').value || entregaCp;
                        fullQuery = document.getElementById('edit-direccion').value || `${calle} ${num}, ${col}, ${mun} ${cp}`.trim();
                    }

                        if (!fullQuery && !cp) return Swal.showValidationMessage('Escriba una dirección o Código Postal');
                        
                        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';
                        btn.disabled = true;

                        try {
                            // La consulta de coordenadas se hace en backend para usar User-Agent y reglas de Nominatim.
                            const respuesta = await LogisticaServicio.geocodificarDireccion({
                                tipo,
                                direccion_entrega: fullQuery,
                                calle,
                                numero_externo: num,
                                colonia: col,
                                municipio: mun,
                                codigo_postal: cp
                            });

                            document.getElementById('edit-latitud').value = respuesta.latitud || '';
                            document.getElementById('edit-longitud').value = respuesta.longitud || '';
                            Swal.resetValidationMessage();

                            if (respuesta.latitud && respuesta.longitud) {
                                btn.innerHTML = '<i class="fa-solid fa-check"></i> Ubicacion encontrada';
                                btn.style.backgroundColor = '#10b981';
                            } else {
                                btn.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Sin coordenadas exactas';
                                btn.style.backgroundColor = '#f97316';
                                Swal.showValidationMessage(respuesta.advertencia || 'No se pudieron obtener coordenadas exactas. Podrá continuar sin ellas.');
                            }
                            
                            setTimeout(() => {
                                btn.innerHTML = '<i class="fa-solid fa-magnifying-glass-location"></i> Buscar Coordenadas por CP / Direccion';
                                btn.style.backgroundColor = 'var(--primary)';
                                btn.disabled = false;
                            }, 2000);
                            return;
                        } catch (err) {
                            console.error('[Geocoder] Error:', err);
                            document.getElementById('edit-latitud').value = '';
                            document.getElementById('edit-longitud').value = '';
                            Swal.showValidationMessage('No se pudo conectar al servicio de mapas. Podrá continuar sin coordenadas.');
                            btn.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> Sin conexion';
                            btn.style.backgroundColor = '#f97316';
                            setTimeout(() => {
                                btn.innerHTML = '<i class="fa-solid fa-magnifying-glass-location"></i> Buscar Coordenadas por CP / Direccion';
                                btn.style.backgroundColor = 'var(--primary)';
                                btn.disabled = false;
                            }, 2000);
                            return;
                        }
                    };
                },
                preConfirm: () => {
                    const latitud = document.getElementById('edit-latitud').value;
                    const longitud = document.getElementById('edit-longitud').value;
                    
                    // Las coordenadas son opcionales, se permite continuar sin ellas (se asignarán null en BD)
                    
                    const result = {
                        tipo,
                        contacto_nombre: document.getElementById('edit-contacto').value,
                        contacto_telefono: document.getElementById('edit-telefono').value,
                        latitud: latitud ? parseFloat(latitud) : null,
                        longitud: longitud ? parseFloat(longitud) : null
                    };

                    if (tipo === 'CONTRATO') {
                        result.calle = document.getElementById('edit-calle').value;
                        result.numero_externo = document.getElementById('edit-num-ext').value;
                        result.colonia = document.getElementById('edit-colonia').value;
                        result.municipio = document.getElementById('edit-municipio').value;
                        result.codigo_postal = document.getElementById('edit-cp').value;
                        result.direccion_entrega = `${result.calle} ${result.numero_externo}, ${result.colonia}, ${result.municipio}`.trim();
                    } else {
                        result.direccion_entrega = document.getElementById('edit-direccion').value || `${document.getElementById('edit-calle').value || entregaCalle} ${document.getElementById('edit-num-ext').value || entregaNumExt}, ${document.getElementById('edit-colonia').value || entregaColonia}, ${document.getElementById('edit-municipio').value || entregaMunicipio}`.trim();
                        result.calle = document.getElementById('edit-calle').value || entregaCalle;
                        result.numero_externo = document.getElementById('edit-num-ext').value || entregaNumExt;
                        result.colonia = document.getElementById('edit-colonia').value || entregaColonia;
                        result.municipio = document.getElementById('edit-municipio').value || entregaMunicipio;
                        result.codigo_postal = document.getElementById('edit-cp').value || entregaCp;
                    }

                    return result;
                }
            }).then(async (result) => {
                if (result.isConfirmed) {
                    Swal.fire({ title: 'Actualizando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                    
                    await LogisticaServicio.actualizarDetallePedido(id, { ...result.value, tipo });
                    
                    Swal.fire('Éxito', 'La información ha sido actualizada. Ya puede reasignar el pedido.', 'success');
                    cargarDatos('rutas'); // Recargar lista de espera
                }
            });

        } catch (error) {
            console.error('Error al editar pedido:', error);
            Swal.fire('Error', 'No se pudieron cargar los datos: ' + error.message, 'error');
        }
    };

    function switchByUrl() {
        const params = new URLSearchParams(window.location.search);
        const section = params.get('section') || 'dashboard';
        activarSeccion(section);
    }

    // --- Inteligencia Logística: Visualización de Rutas (RF5) ---
    let currentRouteLayer = null;
    let destinationMarker = null;

    window.visualizarRutaOptima = async function(asignacionId) {
        try {
            if (!leafletMap) return;

            // Limpiar rutas previas
            if (currentRouteLayer) leafletMap.removeLayer(currentRouteLayer);
            if (destinationMarker) leafletMap.removeLayer(destinationMarker);

            Swal.fire({ 
                title: 'Calculando Ruta Óptima...', 
                text: 'Consultando red vial',
                allowOutsideClick: false, 
                didOpen: () => Swal.showLoading() 
            });

            const data = await LogisticaServicio.obtenerRutaInteligente(asignacionId);
            
            // Posiciones
            const startLat = parseFloat(data.posicion_actual.lat);
            const startLng = parseFloat(data.posicion_actual.lng);
            const endLat = parseFloat(data.destino.lat);
            const endLng = parseFloat(data.destino.lng);

            // Intentar obtener la ruta exacta que sigue las calles mediante OSRM (desde el cliente)
            let latlngs = [];
            let distanceKm = 0;
            let etaMinutos = 0;
            let rutaFuente = 'OSRM';

            try {
                const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
                const osrmRes = await fetch(osrmUrl);
                
                if (osrmRes.ok) {
                    const osrmData = await osrmRes.json();
                    if (osrmData.routes && osrmData.routes.length > 0) {
                        const route = osrmData.routes[0];
                        distanceKm = (route.distance / 1000).toFixed(2);
                        const durationMin = Math.round(route.duration / 60);
                        etaMinutos = durationMin + Math.round(durationMin * 0.15); // +15% tráfico
                        
                        // OSRM devuelve [lng, lat], leaflet requiere [lat, lng]
                        latlngs = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    }
                }
            } catch (err) {
                console.error("OSRM Frontend Fetch Failed:", err);
            }

            // Fallback si OSRM falla: usar los datos que regresó el backend
            if (latlngs.length === 0) {
                rutaFuente = 'Backend Fallback';
                const ruta = data.optimizacion;
                if (!ruta || !ruta.camino || ruta.camino.length === 0) {
                    throw new Error('No se encontró ruta válida.');
                }
                latlngs = ruta.camino.map(nodo => [parseFloat(nodo.latitud), parseFloat(nodo.longitud)]);
                latlngs.unshift([startLat, startLng]);
                latlngs.push([endLat, endLng]);
                distanceKm = ruta.distanciaTotal ? ruta.distanciaTotal.toFixed(2) : 'N/A';
                etaMinutos = ruta.eta_minutos || 'N/A';
            }

            // 1. Dibujar la polilínea (Línea sólida bonita, no punteada)
            // Formatear ETA para mostrar la llegada estimada del chofer en la modal.
            const etaNumero = Number(etaMinutos);
            const etaTexto = Number.isFinite(etaNumero) && etaNumero > 0 ? `${Math.round(etaNumero)} min` : 'N/A';
            const horaLlegadaTexto = Number.isFinite(etaNumero) && etaNumero > 0
                ? new Date(Date.now() + etaNumero * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'N/A';

            currentRouteLayer = L.polyline(latlngs, {
                color: '#2563eb', // Azul vibrante
                weight: 5,
                opacity: 0.9,
                lineJoin: 'round',
                lineCap: 'round',
                className: 'ruta-animada' // Opcional, para animaciones CSS
            }).addTo(leafletMap);

            // 2. Marcar Punto B (Destino)
            const iconB = L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            destinationMarker = L.marker([endLat, endLng], { icon: iconB }).addTo(leafletMap);
            destinationMarker.bindPopup(`<b>Punto B: Destino Final</b><br>${data.destino.direccion}`).openPopup();

            // Ajustar vista para ver la ruta completa
            leafletMap.fitBounds(currentRouteLayer.getBounds(), { padding: [60, 60] });

            // 3. Mostrar Modal con Pesos
            Swal.fire({
                title: '<i class="fa-solid fa-route" style="color:#2563eb;"></i> Análisis de Ruta Óptima',
                html: `
                    <div style="text-align: left; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px;">
                        <p style="margin: 5px 0;"><strong>Origen (A):</strong> Posición del Vehículo</p>
                        <p style="margin: 5px 0;"><strong>Destino (B):</strong> ${data.destino.direccion}</p>
                        <p style="margin: 5px 0;"><strong>ETA chofer:</strong> ${etaTexto} | Llegada aprox. ${horaLlegadaTexto}</p>
                        <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 10px 0;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: center;">
                            <div style="background:#fff; padding:10px; border-radius:6px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                                <span style="font-size: 0.75rem; color: #64748b; display: block; text-transform: uppercase;">Distancia</span>
                                <span style="font-size: 1.1rem; font-weight: 700; color: #1e3a8a;">${distanceKm} km</span>
                            </div>
                            <div style="background:#fff; padding:10px; border-radius:6px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                                <span style="font-size: 0.75rem; color: #64748b; display: block; text-transform: uppercase;">Tiempo Est.</span>
                                <span style="font-size: 1.1rem; font-weight: 700; color: #3b82f6;">${etaTexto}</span>
                                <span style="font-size: 0.72rem; color: #64748b; display:block; margin-top:4px;">Llegada aprox. ${horaLlegadaTexto}</span>
                            </div>
                        </div>
                        <p style="font-size: 0.7rem; color: #94a3b8; margin-top: 12px; font-style: italic;">Algoritmo Dijkstra aplicado sobre red vial de Andamios Torres.</p>
                    </div>
                `,
                confirmButtonText: 'Cerrar Análisis',
                confirmButtonColor: '#1e3a8a'
            });

        } catch (error) {
            console.error('Error al visualizar ruta:', error);
            Swal.fire('Error Logístico', error.message, 'error');
        }
    };

    // --- Funciones de Analítica (AmCharts 5) ---
    let charts = {};

    async function renderizarAnalitica(datos) {
        // 1. Actualizar KPIs de Analítica
        if (DOM.anaKpiExito) {
            const comp = parseInt(datos.tasaExito.find(t => t.estado === 'completado')?.total || 0);
            const fall = parseInt(datos.tasaExito.find(t => t.estado === 'fallido')?.total || 0);
            const total = comp + fall;
            const tasa = total > 0 ? ((comp / total) * 100).toFixed(1) : 0;
            DOM.anaKpiExito.textContent = `${tasa}%`;
        }
        if (DOM.anaKpiTiempo) DOM.anaKpiTiempo.textContent = `${datos.tiempoPromedio}h`;
        if (DOM.anaKpiIncidencias) {
            const incMes = datos.motivosIncidencias.reduce((acc, curr) => acc + parseInt(curr.total), 0);
            DOM.anaKpiIncidencias.textContent = incMes;
        }
        if (DOM.anaKpiFlota) DOM.anaKpiFlota.textContent = `${datos.eficienciaFlota}%`;

        // 2. Inicializar Gráficas
        am5.ready(() => {
            initChartVolumen(datos.volumenMensual);
            initChartEstatus(datos.estatusDistribucion);
            initChartIncidencias(datos.motivosIncidencias);
            initChartClientes(datos.topClientes);
        });
    }

    function initChartVolumen(data) {
        const rootId = "chart-volumen";
        if (charts[rootId]) charts[rootId].dispose();
        
        const root = am5.Root.new(rootId);
        charts[rootId] = root;
        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push(am5xy.XYChart.new(root, {
            panX: false, panY: false, wheelX: "panX", wheelY: "zoomX", layout: root.verticalLayout
        }));

        const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: "mes",
            renderer: am5xy.AxisRendererX.new(root, {}),
            tooltip: am5.Tooltip.new(root, {})
        }));
        xAxis.data.setAll(data);

        const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {})
        }));

        function createSeries(name, field) {
            const series = chart.series.push(am5xy.ColumnSeries.new(root, {
                name: name,
                xAxis: xAxis,
                yAxis: yAxis,
                valueYField: field,
                categoryXField: "mes",
                tooltip: am5.Tooltip.new(root, { labelText: "{name}: {valueY}" })
            }));
            series.data.setAll(processedData);
        }

        // Procesar datos para tener series por tipo_movimiento
        const processedData = [];
        const meses = [...new Set(data.map(d => d.mes))];
        meses.forEach(m => {
            const row = { mes: m };
            data.filter(d => d.mes === m).forEach(d => {
                row[d.tipo_movimiento] = parseInt(d.total);
            });
            processedData.push(row);
        });

        xAxis.data.setAll(processedData);
        createSeries("Entregas", "ENTREGA");
        createSeries("Recolecciones", "RECOLECCION");
        
        chart.set("cursor", am5xy.XYCursor.new(root, {}));
        const legend = chart.children.push(am5.Legend.new(root, { centerX: am5.p50, x: am5.p50 }));
        legend.data.setAll(chart.series.values);
    }

    function initChartEstatus(data) {
        const rootId = "chart-estatus";
        if (charts[rootId]) charts[rootId].dispose();
        
        const root = am5.Root.new(rootId);
        charts[rootId] = root;
        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push(am5percent.PieChart.new(root, {
            layout: root.verticalLayout,
            innerRadius: am5.percent(50)
        }));

        const series = chart.series.push(am5percent.PieSeries.new(root, {
            valueField: "total",
            categoryField: "estado",
            alignLabels: false
        }));

        series.data.setAll(data.map(d => ({ ...d, total: parseInt(d.total) })));
        series.labels.template.set("forceHidden", true);
        series.ticks.template.set("forceHidden", true);

        const legend = chart.children.push(am5.Legend.new(root, {
            centerX: am5.p50, x: am5.p50, marginTop: 15, marginBottom: 15
        }));
        legend.data.setAll(series.dataItems);
    }

    function initChartIncidencias(data) {
        const rootId = "chart-incidencias";
        if (charts[rootId]) charts[rootId].dispose();
        
        const root = am5.Root.new(rootId);
        charts[rootId] = root;
        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push(am5xy.XYChart.new(root, {
            panX: false, panY: false, layout: root.verticalLayout
        }));

        const yAxis = chart.yAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: "motivo",
            renderer: am5xy.AxisRendererY.new(root, { inversed: true, cellStartLocation: 0.1, cellEndLocation: 0.9 })
        }));
        yAxis.data.setAll(data);

        const xAxis = chart.xAxes.push(am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererX.new(root, { strokeOpacity: 0.1 })
        }));

        const series = chart.series.push(am5xy.ColumnSeries.new(root, {
            name: "Incidencias",
            xAxis: xAxis,
            yAxis: yAxis,
            valueXField: "total",
            categoryYField: "motivo",
            tooltip: am5.Tooltip.new(root, { labelText: "{valueX}" })
        }));

        series.columns.template.setAll({ cornerRadiusTR: 5, cornerRadiusBR: 5, strokeOpacity: 0 });
        series.data.setAll(data.map(d => ({ ...d, total: parseInt(d.total) })));
    }

    function initChartClientes(data) {
        const rootId = "chart-clientes";
        if (charts[rootId]) charts[rootId].dispose();
        
        const root = am5.Root.new(rootId);
        charts[rootId] = root;
        root.setThemes([am5themes_Animated.new(root)]);

        const chart = root.container.children.push(am5xy.XYChart.new(root, {
            panX: false, panY: false, layout: root.verticalLayout
        }));

        const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: "cliente",
            renderer: am5xy.AxisRendererX.new(root, { 
                minGridDistance: 30,
                cellStartLocation: 0.1,
                cellEndLocation: 0.9
            })
        }));
        
        // Rotar etiquetas para que no se amontonen
        xAxis.get("renderer").labels.template.setAll({
            rotation: -45,
            centerY: am5.p50,
            centerX: am5.p100,
            paddingRight: 15,
            fontSize: "0.75rem"
        });

        xAxis.data.setAll(data);

        const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {})
        }));

        const series = chart.series.push(am5xy.ColumnSeries.new(root, {
            xAxis: xAxis,
            yAxis: yAxis,
            valueYField: "total",
            categoryXField: "cliente",
            tooltip: am5.Tooltip.new(root, { labelText: "{valueY}" })
        }));

        series.data.setAll(data.map(d => ({ ...d, total: parseInt(d.total) })));
    }

    return {
        init: () => {
            bindEvents();
            inicializarSocketsTiempoReal();
            switchByUrl();
        }
    };
})();
