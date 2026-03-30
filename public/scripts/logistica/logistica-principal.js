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
                DOM.overlayReasignar.style.display = 'none';
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

        // 9. Submit: Reasignación
        if (DOM.formReasignacion) {
            DOM.formReasignacion.addEventListener('submit', guardarReasignacion);
        }
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
                    const dashRutas = await LogisticaServicio.obtenerDashboard();
                    cargarOpcionesAsignacion();
                    renderizarPedidosPendientes(dashRutas.asignaciones_espera);
                    break;
                case 'gps':
                    const trackings = await LogisticaServicio.obtenerTrackingsActivos();
                    initMapaTracking(trackings);
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
        
        tabla.innerHTML = lista.map(a => `
            <tr>
                <td>
                    <button onclick="window.verDetalleHistorial('${encodeURIComponent(JSON.stringify(a))}')" class="btn-action" style="padding:4px 8px; font-size:12px; border:1px solid #3498db; background:#eaf2f8; color:#2980b9; cursor:pointer;">
                        <i class="fa fa-eye"></i> <strong>${a.numero_contrato || a.pedido_id}</strong>
                    </button>
                </td>
                <td>${a.cliente || 'Contrato sin cliente'}</td>
                <td>${a.recibio_nombre || '<span style="color:#aaa;">No registrado</span>'}</td>
                <td><i class="fa fa-user" style="color:#666; font-size:12px;"></i> ${a.chofer || 'Desconocido'}</td>
                <td><i class="fa fa-truck" style="color:#666; font-size:12px;"></i> ${a.vehiculo || 'No asignada'}</td>
                <td>${new Date(a.fecha_entrega).toLocaleString('es-MX')}</td>
                <td>
                    ${a.evidencia_url 
                        ? `<a href="${a.evidencia_url}" target="_blank" class="btn-action" style="padding:4px 8px; font-size:12px; border:1px solid #1abc9c; background:#e6f9f0; text-decoration:none; color:#1abc9c;"><i class="fa fa-image"></i> Ver Foto</a>`
                        : `<span style="color:#888; font-size:12px;">Sin Foto</span>`
                    }
                </td>
            </tr>
        `).join('') || '<tr><td colspan="7" style="text-align:center; padding:20px;">No hay historial de entregas.</td></tr>';
    }

    window.verDetalleHistorial = function(dataStr) {
        try {
            const data = JSON.parse(decodeURIComponent(dataStr));
            Swal.fire({
                title: 'Detalle de Entrega',
                html: `
                    <div style="text-align: left; font-size: 14px; line-height: 1.6; color:#333;">
                        <p><strong><i class="fa fa-file-contract" style="color:#3498db; width:20px;"></i> Pedido / Contrato:</strong> ${data.numero_contrato || data.pedido_id}</p>
                        <p><strong><i class="fa fa-user" style="color:#3498db; width:20px;"></i> Cliente:</strong> ${data.cliente || 'No especificado'}</p>
                        <p><strong><i class="fa fa-signature" style="color:#3498db; width:20px;"></i> Entregado a:</strong> ${data.recibio_nombre || 'No registrado'}</p>
                        <hr style="border: 1px solid #eee; margin:15px 0;">
                        <p><strong><i class="fa fa-truck" style="color:#e67e22; width:20px;"></i> Chofer que entregó:</strong> ${data.chofer || 'Desconocido'}</p>
                        <p><strong><i class="fa fa-car" style="color:#e67e22; width:20px;"></i> Vehículo:</strong> ${data.vehiculo || 'N/A'}</p>
                        <p><strong><i class="fa fa-calendar-check" style="color:#e67e22; width:20px;"></i> Fecha de Entrega:</strong> ${new Date(data.fecha_entrega).toLocaleString('es-MX')}</p>
                    </div>
                `,
                icon: 'info',
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#3498db'
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
            DOM.selChofer.innerHTML = '<option value="">Chofer...</option>' + 
                choferes.map(c => `<option value="${c.id_usuario}">${c.nombre}</option>`).join('');
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
                attribution: '© OpenStreetMap - Andamios Torres GPS'
            }).addTo(leafletMap);
        }

        // Limpiar marcadores viejos
        mapMarkers.forEach(m => leafletMap.removeLayer(m));
        mapMarkers = [];

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
                <b>Contrato:</b> ${t.pedido_id}<br>
                <b>Última vez:</b> ${new Date(t.timestamp).toLocaleTimeString()}
            `);
            mapMarkers.push(marker);
            bounds.push([lat, lng]);
        });

        if (bounds.length > 0) {
            leafletMap.fitBounds(bounds, { padding: [50, 50] });
        }
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
                    <button class="btn-action" style="background:#25D366; border-color:#25D366; color:white; padding:5px 10px;" onclick="enviarWhatsAppChofer(${a.id}, ${a.chofer_id}, '${a.pedido_id}')" title="Enviar WhatsApp">
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

        DOM.tablaPedidos.innerHTML = lista.map(p => `
            <tr>
                <td><strong>${p.numero_contrato || p.pedido_id}</strong></td>
                <td>${p.cliente_nombre || 'Cliente no especificado'}</td>
                <td>${p.fecha_compromiso ? new Date(p.fecha_compromiso).toLocaleDateString() : '--'}</td>
                <td style="text-align:center;">
                    <button class="btn-action" onclick="usarPedidoWaitlist('${p.pedido_id}')">Usar</button>
                </td>
            </tr>
        `).join('');
    }

    // Funciones globales para botones
    window.usarPedidoWaitlist = function(pedidoId) {
        const input = document.querySelector('input[name="pedido_id"]');
        if (input) {
            input.value = pedidoId;
            input.focus();
            LogisticaNotificaciones.mostrarAlerta('ID de pedido cargado', 'info', 1500);
        }
    };

    window.enviarWhatsAppChofer = function(asignacionId, choferId, pedidoId) {
        const urlSeguimiento = `${window.location.origin}/templates/pages/entrega_detalle.html?id=${asignacionId}`;
        const mensaje = encodeURIComponent(`Hola, se te ha asignado el pedido (Contrato #${pedidoId}). Puedes ver los detalles y el mapa aquí: ${urlSeguimiento}`);
        window.open(`https://wa.me/?text=${mensaje}`, '_blank');
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
                
            DOM.selChoferEdit.innerHTML = choferes
                .map(c => `<option value="${c.id_usuario}" ${c.id_usuario == asignacion.chofer_id ? 'selected' : ''}>${c.nombre} ${c.id_usuario == asignacion.chofer_id ? '(Actual)' : ''}</option>`)
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
                    title: '¡Actualizado!',
                    text: 'La ruta ha sido reasignada con éxito.',
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
