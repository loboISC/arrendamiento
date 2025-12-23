// Módulo para manejar métricas de satisfacción de clientes

// Función para cargar métricas de satisfacción
async function cargarMetricasSatisfaccion() {
    try {
        const headers = getAuthHeaders();
        const response = await fetch('http://localhost:3001/api/clientes/stats', { headers });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }
            throw new Error('Error al cargar métricas de satisfacción');
        }
        
        const stats = await response.json();
        mostrarMetricasSatisfaccion(stats.satisfaccion);
        await cargarTablaEncuestasSatisfaccion();
        
    } catch (error) {
        console.error('Error al cargar métricas de satisfacción:', error);
        showMessage('Error al cargar métricas de satisfacción', 'error');
    }
}

// Función para mostrar las métricas de satisfacción
function mostrarMetricasSatisfaccion(satisfaccion) {
    const satisfaccionArea = document.getElementById('satisfaccion-area');
    if (!satisfaccionArea) return;

    const toNumberSafe = (value, fallback = 0) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };

    satisfaccion = satisfaccion && typeof satisfaccion === 'object' ? satisfaccion : {};
    
    const satisfechos = parseInt(satisfaccion.clientes_satisfechos || 0);
    const insatisfechos = parseInt(satisfaccion.clientes_insatisfechos || 0);
    const total = satisfechos + insatisfechos;

    const porcentajeSatisfaccion = total > 0 ? ((satisfechos / total) * 100) : 0;

    const calGeneral = toNumberSafe(satisfaccion.calificacion_general, 0);
    const calPago = toNumberSafe(satisfaccion.calificacion_pago, 0);
    const calComunicacion = toNumberSafe(satisfaccion.calificacion_comunicacion, 0);
    const calEquipos = toNumberSafe(satisfaccion.calificacion_equipos, 0);
    const calSatisfaccion = toNumberSafe(satisfaccion.calificacion_satisfaccion, 0);
    
    satisfaccionArea.innerHTML = `
        <div class="satisfaction-overview">
            <div class="satisfaction-summary">
                <div class="satisfaction-card">
                    <div class="satisfaction-icon">
                        <i class="fas fa-smile" style="color: #2ecc71;"></i>
                    </div>
                    <div class="satisfaction-info">
                        <h3>${satisfechos}</h3>
                        <p>Clientes Satisfechos</p>
                        <span class="satisfaction-percentage">${porcentajeSatisfaccion.toFixed(1)}%</span>
                    </div>
                </div>
                
                <div class="satisfaction-card">
                    <div class="satisfaction-icon">
                        <i class="fas fa-frown" style="color: #e74c3c;"></i>
                    </div>
                    <div class="satisfaction-info">
                        <h3>${insatisfechos}</h3>
                        <p>Clientes Insatisfechos</p>
                        <span class="satisfaction-percentage">${(100 - porcentajeSatisfaccion).toFixed(1)}%</span>
                    </div>
                </div>
                
                <div class="satisfaction-card">
                    <div class="satisfaction-icon">
                        <i class="fas fa-star" style="color: #f39c12;"></i>
                    </div>
                    <div class="satisfaction-info">
                        <h3>${calGeneral.toFixed(1)}</h3>
                        <p>Calificación Promedio</p>
                        <span class="satisfaction-percentage">de 5.0</span>
                    </div>
                </div>
            </div>
            
            <div class="satisfaction-metrics">
                <h3>Métricas Detalladas de Satisfacción</h3>
                <div class="metrics-grid">
                    <div class="metric-item">
                        <div class="metric-label">Calificación General</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${calGeneral * 20}%"></div>
                        </div>
                        <div class="metric-value">${calGeneral.toFixed(1)}/5</div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-label">Puntualidad de Pago</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${calPago * 20}%"></div>
                        </div>
                        <div class="metric-value">${calPago.toFixed(1)}/5</div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-label">Comunicación</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${calComunicacion * 20}%"></div>
                        </div>
                        <div class="metric-value">${calComunicacion.toFixed(1)}/5</div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-label">Calidad de Equipos</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${calEquipos * 20}%"></div>
                        </div>
                        <div class="metric-value">${calEquipos.toFixed(1)}/5</div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-label">Satisfacción General</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${calSatisfaccion * 20}%"></div>
                        </div>
                        <div class="metric-value">${calSatisfaccion.toFixed(1)}/5</div>
                    </div>
                </div>
            </div>
            
            <div class="satisfaction-actions">
                <button class="btn btn-primary" onclick="generarReporteSatisfaccion()">
                    <i class="fas fa-file-pdf"></i> Generar Reporte
                </button>
                <button class="btn btn-secondary" onclick="enviarEncuestaSatisfaccion()">
                    <i class="fas fa-paper-plane"></i> Enviar Encuesta
                </button>
            </div>
        </div>
        <div class="client-card" style="margin-top:18px;">
            <div class="header-row">
                <div>
                    <h3>Envío de encuestas</h3>
                    <p class="header-desc">Contratos y ventas (VEN-*) con acciones para enviar o copiar URL</p>
                </div>
                <div class="header-actions">
                    <button class="export-btn" id="btn-refresh-encuestas">
                        <i class="fas fa-sync"></i> Actualizar
                    </button>
                </div>
            </div>
            <div id="satisfaccion-encuestas-table" style="overflow:auto;"></div>
        </div>
    `;

    const btnRefresh = document.getElementById('btn-refresh-encuestas');
    btnRefresh?.addEventListener('click', (e) => {
        e.preventDefault();
        cargarTablaEncuestasSatisfaccion();
    });
}

function notify(msg, type = 'success') {
    try {
        if (typeof showMessage === 'function') {
            showMessage(msg, type === 'success' ? 'success' : 'error');
            return;
        }
    } catch (_) {}
    alert(msg);
}

function parseOrigenFromNotas(notas) {
    const raw = String(notas || '');
    const tipo = /origen_tipo\s*=\s*([^;\s]+)/i.exec(raw)?.[1] || null;
    const id = /origen_id\s*=\s*([^;\s]+)/i.exec(raw)?.[1] || null;
    return { tipo, id };
}

function getOperacionLabel(op) {
    if (!op) return '';
    if (op.tipo === 'venta') {
        return op.numero_folio || op.numero_cotizacion || op.numero || `ID ${op.id}`;
    }
    return op.numero_contrato || op.numero || `ID ${op.id}`;
}

async function fetchJson(url, headers) {
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Error ${res.status}`);
    }
    return res.json();
}

async function cargarTablaEncuestasSatisfaccion() {
    const cont = document.getElementById('satisfaccion-encuestas-table');
    if (!cont) return;

    cont.innerHTML = '<div style="padding:14px;color:#64748b;">Cargando encuestas...</div>';

    const headers = getAuthHeaders();

    try {
        const [contratos, cotizaciones, encuestasResp] = await Promise.all([
            fetchJson('http://localhost:3001/api/contratos', headers),
            fetchJson('http://localhost:3001/api/cotizaciones', headers),
            fetchJson('http://localhost:3001/api/encuestas?limit=500&offset=0', headers)
        ]);

        const ventas = (Array.isArray(cotizaciones) ? cotizaciones : []).filter(c => {
            const folio = String(c?.numero_folio || c?.numero_cotizacion || c?.numero_folio_venta || '').toUpperCase();
            return folio.startsWith('VEN-');
        });

        const encuestas = Array.isArray(encuestasResp?.data) ? encuestasResp.data : [];
        const encuestasByOrigen = new Map();
        for (const e of encuestas) {
            const { tipo, id } = parseOrigenFromNotas(e?.notas);
            if (tipo && id) {
                encuestasByOrigen.set(`${tipo}:${id}`, e);
            }
        }

        const operaciones = [];
        (Array.isArray(contratos) ? contratos : []).forEach(ct => {
            operaciones.push({
                tipo: 'contrato',
                id: ct.id_contrato,
                cliente_nombre: ct.nombre_cliente || ct.cliente_nombre || '',
                cliente_email: ct.email || ct.cliente_email || '',
                ref: ct,
                label: getOperacionLabel({ tipo: 'contrato', id: ct.id_contrato, numero_contrato: ct.numero_contrato })
            });
        });
        ventas.forEach(v => {
            operaciones.push({
                tipo: 'venta',
                id: v.id_cotizacion,
                cliente_nombre: v.nombre_cliente || v.cliente_nombre || '',
                cliente_email: v.email || v.cliente_email || '',
                ref: v,
                label: getOperacionLabel({ tipo: 'venta', id: v.id_cotizacion, numero_folio: v.numero_folio || v.numero_cotizacion })
            });
        });

        // Orden: más recientes primero
        operaciones.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

        const rowsHtml = operaciones.map(op => {
            const enc = encuestasByOrigen.get(`${op.tipo}:${op.id}`) || null;
            const estado = enc?.estado || 'sin_encuesta';
            const fechaEnvio = enc?.fecha_envio ? new Date(enc.fecha_envio).toLocaleString('es-MX') : '';
            const url = enc?.url_encuesta || '';

            const acciones = (() => {
                if (!enc) {
                    return `
                        <button class="export-btn" data-action="crear" data-tipo="${op.tipo}" data-id="${op.id}">
                            <i class="fas fa-plus"></i> Crear
                        </button>
                    `;
                }
                const canSend = ['pendiente', 'enviada'].includes(String(enc.estado || '').toLowerCase());
                const sendLabel = enc?.estado === 'enviada' ? 'Reenviar' : 'Enviar';
                return `
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="export-btn" data-action="copiar" data-url="${encodeURIComponent(url)}">
                            <i class="fas fa-copy"></i> Copiar URL
                        </button>
                        <button class="export-btn" data-action="enviar" data-encuesta="${enc.id_encuesta}" ${canSend ? '' : 'disabled'}>
                            <i class="fas fa-paper-plane"></i> ${sendLabel}
                        </button>
                    </div>
                `;
            })();

            return `
                <tr>
                    <td>${op.tipo === 'venta' ? 'Venta' : 'Contrato'}</td>
                    <td>${op.label || op.id}</td>
                    <td>${op.cliente_nombre || ''}</td>
                    <td><span class="client-tag status">${estado}</span></td>
                    <td>${fechaEnvio}</td>
                    <td>${acciones}</td>
                </tr>
            `;
        }).join('');

        cont.innerHTML = `
            <table class="transactions-table" style="min-width:900px;">
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Referencia</th>
                        <th>Cliente</th>
                        <th>Estado</th>
                        <th>Enviada</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml || ''}
                </tbody>
            </table>
        `;

        cont.querySelectorAll('button[data-action="copiar"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const url = decodeURIComponent(btn.getAttribute('data-url') || '');
                if (!url) return;
                try {
                    await navigator.clipboard.writeText(url);
                    notify('URL copiada al portapapeles', 'success');
                } catch (_) {
                    prompt('Copia la URL:', url);
                }
            });
        });

        cont.querySelectorAll('button[data-action="crear"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const tipo = btn.getAttribute('data-tipo');
                const id = btn.getAttribute('data-id');
                if (!tipo || !id) return;
                try {
                    btn.disabled = true;
                    const res = await fetch('http://localhost:3001/api/encuestas/desde-origen', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ origen_tipo: tipo, origen_id: Number(id), metodo_envio: 'link' })
                    });
                    if (!res.ok) {
                        const text = await res.text().catch(() => '');
                        throw new Error(text || `Error ${res.status}`);
                    }
                    notify('Encuesta creada', 'success');
                    await cargarTablaEncuestasSatisfaccion();
                } catch (err) {
                    console.error(err);
                    notify('No se pudo crear la encuesta', 'error');
                } finally {
                    btn.disabled = false;
                }
            });
        });

        cont.querySelectorAll('button[data-action="enviar"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const idEncuesta = btn.getAttribute('data-encuesta');
                if (!idEncuesta) return;
                try {
                    btn.disabled = true;
                    const res = await fetch(`http://localhost:3001/api/encuestas/${encodeURIComponent(idEncuesta)}/enviar-email`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({})
                    });
                    if (!res.ok) {
                        const text = await res.text().catch(() => '');
                        throw new Error(text || `Error ${res.status}`);
                    }
                    notify('Encuesta enviada por correo', 'success');
                    await cargarTablaEncuestasSatisfaccion();
                } catch (err) {
                    console.error(err);
                    notify('No se pudo enviar la encuesta', 'error');
                } finally {
                    btn.disabled = false;
                }
            });
        });

    } catch (error) {
        console.error('Error cargando tabla de encuestas:', error);
        cont.innerHTML = '<div style="padding:14px;color:#ef4444;">Error al cargar encuestas</div>';
    }
}

// Función para generar reporte de satisfacción
function generarReporteSatisfaccion() {
    showMessage('Función de reporte en desarrollo', 'error');
    // TODO: Implementar generación de reporte PDF
}

// Función para enviar encuesta de satisfacción
function enviarEncuestaSatisfaccion() {
    // Abrir la modal de encuesta de satisfacción
    if (typeof mostrarModalEncuestaSatisfaccion === 'function') {
        mostrarModalEncuestaSatisfaccion();
    } else {
        // Fallback: mostrar mensaje y intentar cargar la función
        console.log('Función mostrarModalEncuestaSatisfaccion no encontrada, intentando cargar...');
        setTimeout(() => {
            if (typeof mostrarModalEncuestaSatisfaccion === 'function') {
                mostrarModalEncuestaSatisfaccion();
            } else {
                showMessage('Modal de encuesta no disponible. Recarga la página.', 'error');
            }
        }, 1000);
    }
}

// Hacer funciones disponibles globalmente
window.cargarMetricasSatisfaccion = cargarMetricasSatisfaccion;
window.generarReporteSatisfaccion = generarReporteSatisfaccion;
window.enviarEncuestaSatisfaccion = enviarEncuestaSatisfaccion;
