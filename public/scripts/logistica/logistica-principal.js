/**
 * ORQUESTADOR PRINCIPAL - LOGÍSTICA (Versión Clean SPA + Historial Global)
 */
document.addEventListener('DOMContentLoaded', () => {
    LogisticaApp.init();
});

const LogisticaApp = (function() {
    
    let currentStep = 1;
    const totalSteps = 3;

    const DOM = {
        // KPIs
        kpiTotal: document.getElementById('kpi-total'),
        kpiActivos: document.getElementById('kpi-activos'),
        kpiAlertas: document.getElementById('kpi-alertas'),
        
        // Tablas
        tablaVehiculos: document.querySelector('#tabla-vehiculos tbody'),
        tablaMantenimientos: document.querySelector('#tabla-mantenimientos tbody'),
        tablaRuta: document.querySelector('#tabla-ruta tbody'),
        tablaPedidos: document.querySelector('#tabla-pedidos-pendientes tbody'),
        contenedorAlertas: document.getElementById('contenedor-alertas'),
        
        // Modales y Overlays
        overlayAlta: document.getElementById('overlay-alta'),
        overlayDetalles: document.getElementById('overlay-detalles'),
        overlayMantenimiento: document.getElementById('overlay-mantenimiento'),
        
        // Formularios
        formAlta: document.getElementById('form-alta-completa'),
        formMantenimiento: document.getElementById('form-mantenimiento-rapido'),
        formAsignacion: document.getElementById('form-asignacion'),
        
        // Botones y Selects
        btnAltaPro: document.getElementById('btn-alta-pro'),
        btnNext: document.getElementById('btn-next'),
        btnPrev: document.getElementById('btn-prev'),
        btnFinish: document.getElementById('btn-finish'),
        btnAutoAsignar: document.getElementById('btn-auto-asignar'),
        selVehiculo: document.getElementById('sel-vehiculo'),
        selChofer: document.getElementById('sel-chofer'),
        
        // Navegación
        navTabs: document.querySelectorAll('.tab-btn'),
        sections: document.querySelectorAll('.content-section'),
        stepContents: document.querySelectorAll('.step-content'),
        stepTabs: document.querySelectorAll('.modal-tab-btn')
    };

    function bindEvents() {
        // 1. Navegación (Solo para soporte legacy o debug, el control es por URL)
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
            });
        });

        // 3. Pasos de Alta
        DOM.btnNext.addEventListener('click', () => { if (currentStep < totalSteps) { currentStep++; actualizarPasos(); } });
        DOM.btnPrev.addEventListener('click', () => { if (currentStep > 1) { currentStep--; actualizarPasos(); } });

        // 4. Submit: Alta Vehículo
        DOM.formAlta.addEventListener('submit', async (e) => {
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
        DOM.formMantenimiento.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await LogisticaServicio.crearMantenimiento(Object.fromEntries(new FormData(DOM.formMantenimiento)));
                LogisticaNotificaciones.mostrarAlerta('Mantenimiento guardado', 'success');
                DOM.overlayMantenimiento.style.display = 'none';
                cargarDatos('mantenimiento'); // Recargar historial global
            } catch (err) { LogisticaNotificaciones.mostrarAlerta(err.message, 'error'); }
        });

        // 6. Asignación Manual
        DOM.formAsignacion.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await LogisticaServicio.crearAsignacion(Object.fromEntries(new FormData(DOM.formAsignacion)));
                LogisticaNotificaciones.mostrarAlerta('Ruta asignada', 'success');
                DOM.formAsignacion.reset();
                cargarDatos('dashboard');
            } catch (err) { LogisticaNotificaciones.mostrarAlerta(err.message, 'error'); }
        });

        // 7. Auto-Asignar
        DOM.btnAutoAsignar.addEventListener('click', async () => {
            try {
                await LogisticaServicio.asignacionAutomatica();
                LogisticaNotificaciones.mostrarAlerta('Algoritmo ejecutado', 'info');
                cargarDatos('dashboard');
            } catch (err) { LogisticaNotificaciones.mostrarAlerta(err.message, 'error'); }
        });

        // 8. Acciones Tabla
        DOM.tablaVehiculos.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-action');
            if (!btn) return;
            const id = btn.dataset.id;
            if (btn.classList.contains('btn-view')) abrirDetalles(id);
            else if (btn.classList.contains('btn-tools')) abrirMantenimiento(id);
        });
    }

    function activarSeccion(secId) {
        DOM.sections.forEach(s => s.classList.toggle('active', s.id === `sec-${secId}`));
        cargarDatos(secId);
    }

    async function cargarDatos(seccion = 'dashboard') {
        try {
            switch(seccion) {
                case 'dashboard':
                    const dash = await LogisticaServicio.obtenerDashboard();
                    renderizarKPIs(dash);
                    renderizarRuta(dash.asignaciones_activas);
                    renderizarAlertas(dash.alertas_vencimiento);
                    break;
                case 'unidades':
                    const vehiculos = await LogisticaServicio.obtenerVehiculos();
                    renderizarVehiculos(vehiculos);
                    break;
                case 'mantenimiento':
                    const historial = await LogisticaServicio.obtenerMantenimientosGlobales();
                    renderizarHistorialMantenimientos(historial);
                    break;
                case 'rutas':
                    cargarOpcionesAsignacion();
                    // Mock pedidos
                    DOM.tablaPedidos.innerHTML = '<tr><td>RD-4521</td><td>Andamios del Bajio</td><td>2024-03-30</td><td><button class="btn-action">Usar</button></td></tr>';
                    break;
            }
        } catch (err) { console.error('Error cargando seccion:', seccion, err); }
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

    async function cargarOpcionesAsignacion() {
        try {
            const [vehiculos, choferes] = await Promise.all([
                LogisticaServicio.obtenerVehiculos(),
                LogisticaServicio.obtenerChoferes()
            ]);
            DOM.selVehiculo.innerHTML = '<option value="">Unidad...</option>' + 
                vehiculos.filter(v => v.estatus === 'activo').map(v => `<option value="${v.id}">${v.economico}</option>`).join('');
            DOM.selChofer.innerHTML = '<option value="">Chofer...</option>' + 
                choferes.map(c => `<option value="${c.id_usuario}">${c.nombre}</option>`).join('');
        } catch (err) { }
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

    function renderizarKPIs(dash) {
        let total = 0, activos = 0;
        if (dash.vehiculos) dash.vehiculos.forEach(v => { total += parseInt(v.total); if (v.estatus === 'activo') activos = v.total; });
        DOM.kpiTotal.textContent = total; DOM.kpiActivos.textContent = activos; DOM.kpiAlertas.textContent = dash.alertas_criticas || 0;
    }

    function renderizarVehiculos(vehiculos) {
        DOM.tablaVehiculos.innerHTML = vehiculos.map(v => `
            <tr><td>${v.economico}</td><td><strong>${v.placa}</strong></td><td>${v.modelo}</td><td><span class="badge badge-${v.estatus}">${v.estatus}</span></td><td>${v.kilometraje_inicial || 0} KM</td>
            <td><button class="btn-action btn-view" data-id="${v.id}"><i class="fa-solid fa-eye"></i></button><button class="btn-action btn-tools" data-id="${v.id}" style="background:var(--warning); color:#fff;"><i class="fa-solid fa-tools"></i></button></td></tr>
        `).join('');
    }

    function renderizarAlertas(alertas) {
        if (!alertas || !alertas.length) { DOM.contenedorAlertas.innerHTML = '<p>Sin alertas</p>'; return; }
        DOM.contenedorAlertas.innerHTML = alertas.map(a => `<div class="alerta-item" style="border-left:4px solid var(--accent); padding:5px; margin-bottom:5px; background:rgba(0,0,0,0.02); font-size:0.8rem;"><strong>${a.tipo.toUpperCase()}</strong>: ${a.economico}</div>`).join('');
    }

    function renderizarRuta(asignaciones) {
        if (!asignaciones) return;
        DOM.tablaRuta.innerHTML = asignaciones.map(a => `<tr><td>${a.economico}</td><td>${a.chofer}</td><td>${new Date(a.fecha_asignacion).toLocaleDateString()}</td><td><span class="badge badge-activo">${a.estado}</span></td></tr>`).join('');
    }

    function switchByUrl() {
        const params = new URLSearchParams(window.location.search);
        const section = params.get('section') || 'dashboard';
        activarSeccion(section);
    }

    return {
        init: () => {
            bindEvents();
            switchByUrl();
        }
    };
})();
