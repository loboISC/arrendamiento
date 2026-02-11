// Módulo para manejar métricas de satisfacción de clientes

// Función para cargar métricas de satisfacción
async function cargarMetricasSatisfaccion() {
    try {
        const headers = getAuthHeaders();
        const response = await fetch('/api/clientes/stats', { headers });
        
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

    const calAtencionVentas = toNumberSafe(satisfaccion.calificacion_atencion_ventas, 0);
    const calCalidadProductos = toNumberSafe(satisfaccion.calificacion_calidad_productos, 0);
    const calTiempoEntrega = toNumberSafe(satisfaccion.calificacion_tiempo_entrega, 0);
    const calLogistica = toNumberSafe(satisfaccion.calificacion_logistica, 0);
    const calExperienciaCompra = toNumberSafe(satisfaccion.calificacion_experiencia_compra, 0);
    
    // Calcular promedio general
    const promedio = (calAtencionVentas + calCalidadProductos + calTiempoEntrega + calLogistica + calExperienciaCompra) / 5;
    
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
                        <h3>${promedio.toFixed(1)}</h3>
                        <p>Calificación Promedio</p>
                        <span class="satisfaction-percentage">de 5.0</span>
                    </div>
                </div>
            </div>
            
            <div class="satisfaction-metrics">
                <h3>Métricas Detalladas de Satisfacción</h3>
                <div class="metrics-grid">
                    <div class="metric-item">
                        <div class="metric-label">Atención, Asesoramiento y Apoyo (Ventas)</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${calAtencionVentas * 20}%"></div>
                        </div>
                        <div class="metric-value">${calAtencionVentas.toFixed(1)}/5</div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-label">Calidad de Andamios y/o Productos</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${calCalidadProductos * 20}%"></div>
                        </div>
                        <div class="metric-value">${calCalidadProductos.toFixed(1)}/5</div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-label">Tiempo de Entrega</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${calTiempoEntrega * 20}%"></div>
                        </div>
                        <div class="metric-value">${calTiempoEntrega.toFixed(1)}/5</div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-label">Servicio de Logística</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${calLogistica * 20}%"></div>
                        </div>
                        <div class="metric-value">${calLogistica.toFixed(1)}/5</div>
                    </div>
                    
                    <div class="metric-item">
                        <div class="metric-label">Experiencia de Compra/Renta</div>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${calExperienciaCompra * 20}%"></div>
                        </div>
                        <div class="metric-value">${calExperienciaCompra.toFixed(1)}/5</div>
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
            <div class="form-group" style="margin:0 0 15px 0;">
                <label for="filtro-encuestas">Buscar encuestas</label>
                <input type="text" id="filtro-encuestas" class="searchbar" placeholder="Buscar por referencia, cliente o estado..." style="width:100%;" />
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
            fetchJson('/api/contratos', headers),
            fetchJson('/api/cotizaciones', headers),
            fetchJson('/api/encuestas?limit=500&offset=0', headers)
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

            // Debug: loguear los datos de la operación
            console.log(`📊 Operación ${op.tipo}:${op.id}`, {
                cliente_nombre: op.cliente_nombre,
                cliente_email: op.cliente_email,
                ref_email: op.ref?.email,
                ref_cliente_email: op.ref?.cliente_email,
                enc_email: enc?.email_cliente,
                todos_los_campos: op
            });
            
            // Email final a usar
            const emailFinal = op.cliente_email || op.ref?.email || op.ref?.cliente_email || enc?.email_cliente || 'sin-email@example.com';
            console.log(`✉️ Email final para ${op.tipo}:${op.id} = "${emailFinal}"`);

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
                        <button class="export-btn" data-action="enviar" data-encuesta="${enc.id_encuesta}" data-email="${emailFinal}" data-cliente="${op.cliente_nombre}" ${canSend ? '' : 'disabled'}>
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
                    const res = await fetch('/api/encuestas/desde-origen', {
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

        // Agregar funcionalidad de filtro
        const filtroInput = document.getElementById('filtro-encuestas');
        if (filtroInput) {
            filtroInput.addEventListener('input', (e) => {
                const filtro = e.target.value.toLowerCase().trim();
                const tabla = cont.querySelector('table tbody');
                if (!tabla) return;

                const filas = tabla.querySelectorAll('tr');
                filas.forEach(fila => {
                    const texto = fila.textContent.toLowerCase();
                    fila.style.display = filtro === '' || texto.includes(filtro) ? '' : 'none';
                });
            });
        }

        cont.querySelectorAll('button[data-action="enviar"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                console.log('\n' + '='.repeat(60));
                console.log('🔵 EVENTO CLICK EN BOTÓN ENVIAR - INICIO');
                console.log('='.repeat(60));
                
                e.preventDefault();
                const idEncuesta = btn.getAttribute('data-encuesta');
                let emailDestino = btn.getAttribute('data-email') || 'sin-email@example.com';
                const clienteNombre = btn.getAttribute('data-cliente') || 'Cliente';
                
                // Debug: loguear el email capturado
                console.log(`📧 Email capturado: ${emailDestino}`);
                console.log(`👤 Cliente: ${clienteNombre}`);
                console.log(`📋 ID Encuesta: ${idEncuesta}`);
                
                if (!idEncuesta) {
                    console.error('❌ FALTA ID DE ENCUESTA');
                    return;
                }
                
                console.log('✅ ID Encuesta válido, continuando...');
                
                // Mostrar modal de confirmación con SweetAlert2
                const confirmacion = await Swal.fire({
                    title: '¿Enviar Encuesta?',
                    html: `
                        <div style="text-align: left; font-size: 14px;">
                            <p><strong>Destinatario:</strong> ${clienteNombre}</p>
                            <p><strong>Correo:</strong></p>
                            <input type="email" id="email-input" value="${emailDestino}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;" placeholder="Ingrese el correo electrónico">
                            <p style="color: #666; margin-top: 12px; font-size: 12px;">Se enviará la encuesta de satisfacción a este correo electrónico.</p>
                        </div>
                    `,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, enviar',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#3b82f6',
                    cancelButtonColor: '#ef4444',
                    didOpen: () => {
                        const emailInput = document.getElementById('email-input');
                        if (emailInput) {
                            emailInput.focus();
                            emailInput.select();
                        }
                    }
                });
                
                if (!confirmacion.isConfirmed) return;
                
                // Obtener el email modificado si el usuario lo cambió
                const emailInputFinal = document.getElementById('email-input');
                if (emailInputFinal) {
                    emailDestino = emailInputFinal.value;
                }
                
                // Validar email
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailDestino)) {
                    await Swal.fire({
                        title: '❌ Email Inválido',
                        html: `
                            <div style="text-align: left; font-size: 14px;">
                                <p>El correo electrónico no tiene un formato válido:</p>
                                <p style="color: #ef4444;"><code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">${emailDestino}</code></p>
                            </div>
                        `,
                        icon: 'error',
                        confirmButtonColor: '#ef4444',
                        confirmButtonText: 'Aceptar'
                    });
                    return;
                }
                
                try {
                    console.log('\n📝 Iniciando modal de confirmación...');
                    btn.disabled = true;
                    
                    // Mostrar loading SIN esperar (porque no tiene botón de cierre)
                    console.log('⏳ Mostrando modal "Enviando..."');
                    Swal.fire({
                        title: 'Enviando...',
                        html: 'Por favor espera mientras se envía la encuesta.<br><small style="color: #999;">Esto puede tomar unos segundos...</small>',
                        icon: 'info',
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        didOpen: () => Swal.showLoading()
                    });
                    
                    console.log('\n✅ Modal "Enviando..." mostrado, continuando sin esperar...');
                    
                    // DEBUGGING: Verificar que getAuthHeaders existe
                    console.log('🔍 Verificando función getAuthHeaders...');
                    if (typeof getAuthHeaders !== 'function') {
                        console.error('❌ getAuthHeaders NO es una función');
                        throw new Error('getAuthHeaders no está disponible');
                    }
                    console.log('✅ getAuthHeaders es una función válida');
                    
                    console.log('\n🔌 Preparando fetch...');
                    // Obtener headers aquí nuevamente
                    console.log('📞 Llamando getAuthHeaders()...');
                    let headers;
                    try {
                        headers = getAuthHeaders();
                        console.log('✅ getAuthHeaders() ejecutado correctamente');
                        console.log('🔐 Headers obtenidos:', headers);
                    } catch (headerErr) {
                        console.error('❌ Error en getAuthHeaders():', headerErr.message);
                        throw headerErr;
                    }
                    
                    console.log(`📤 Enviando correo a: ${emailDestino}`);
                    console.log(`📬 ID Encuesta: ${idEncuesta}`);
                    
                    const fetchUrl = `/api/encuestas/${encodeURIComponent(idEncuesta)}/enviar-email`;
                    const fetchBody = JSON.stringify({ email: emailDestino });
                    
                    console.log(`🌐 URL: ${fetchUrl}`);
                    console.log(`📨 Body: ${fetchBody}`);
                    console.log('\n📡 EJECUTANDO FETCH...');
                    
                    // Crear controller para timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => {
                        console.error('⏱️ TIMEOUT: La solicitud tardó más de 30 segundos');
                        controller.abort();
                    }, 30000);
                    
                    console.log('🚀 fetch() iniciado');
                    const res = await fetch(fetchUrl, {
                        method: 'POST',
                        headers,
                        body: fetchBody,
                        signal: controller.signal
                    });
                    console.log('🎉 fetch() completado, respuesta recibida');
                    
                    clearTimeout(timeoutId);
                    
                    console.log(`\n✅ RESPUESTA RECIBIDA: ${res.status} ${res.statusText}`);
                    
                    if (!res.ok) {
                        let errorText = '';
                        try {
                            const errorData = await res.json();
                            errorText = errorData.error || JSON.stringify(errorData);
                        } catch {
                            errorText = await res.text();
                        }
                        console.error(`❌ Error del servidor: ${errorText}`);
                        throw new Error(errorText || `Error ${res.status}`);
                    }
                    
                    const data = await res.json();
                    console.log(`✅ Respuesta exitosa:`, data);
                    
                    // Cerrar el modal de cargando y mostrar éxito
                    Swal.close();
                    await Swal.fire({
                        title: '¡Enviado Correctamente!',
                        html: `
                            <div style="text-align: left; font-size: 14px;">
                                <p>La encuesta ha sido enviada exitosamente a:</p>
                                <p><strong>${clienteNombre}</strong></p>
                                <p style="color: #666;"><code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">${emailDestino}</code></p>
                            </div>
                        `,
                        icon: 'success',
                        confirmButtonColor: '#10b981',
                        confirmButtonText: 'Aceptar'
                    });
                    
                    await cargarTablaEncuestasSatisfaccion();
                    
                } catch (err) {
                    console.error('\n' + '='.repeat(60));
                    console.error('❌ ERROR AL ENVIAR ENCUESTA');
                    console.error('='.repeat(60));
                    console.error('Nombre:', err.name);
                    console.error('Mensaje:', err.message);
                    console.error('Stack:', err.stack);
                    console.error('='.repeat(60));
                    
                    // Verificar si es timeout
                    const isTimeout = err.name === 'AbortError';
                    const isNetworkError = err instanceof TypeError && err.message.includes('fetch');
                    
                    let errorMsg = err.message;
                    if (isTimeout) {
                        errorMsg = 'Tiempo de espera agotado (>30 segundos). Verifica que el servidor esté activo.';
                    } else if (isNetworkError) {
                        errorMsg = 'Error de conexión. Verifica que el servidor esté corriendo en window.location.origin';
                    }
                    
                    // Error - cerrar modal de cargando primero
                    Swal.close();
                    
                    await Swal.fire({
                        title: '⚠️ Problema al Enviar',
                        html: `
                            <div style="text-align: left; font-size: 14px;">
                                <p>Hubo un problema al enviar la encuesta a:</p>
                                <p><strong>${clienteNombre}</strong></p>
                                <p style="color: #666;"><code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">${emailDestino}</code></p>
                                <p style="color: #ef4444; margin-top: 12px;"><strong>Error:</strong> ${errorMsg}</p>
                                <p style="color: #666; margin-top: 8px; font-size: 12px;">Abre la consola (F12) para más detalles.</p>
                            </div>
                        `,
                        icon: 'error',
                        confirmButtonColor: '#ef4444',
                        confirmButtonText: 'Aceptar'
                    });
                    
                } finally {
                    console.log('✅ Finalizando evento click');
                    console.log('='.repeat(60) + '\n');
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
