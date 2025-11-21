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

// Estado global para filtros
let contratosGlobal = [];

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

        contratosGlobal = await response.json();
        aplicarFiltrosYBusqueda();
    } catch (error) {
        console.error('Error cargando contratos:', error);
        mostrarMensaje('Error al cargar contratos', 'error');
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No hay contratos registrados</td></tr>';
        return;
    }

    contratos.forEach(contrato => {
        const row = document.createElement('tr');

        // Contar cantidad de items
        const cantidadItems = contrato.items ? contrato.items.length : 0;

        // Formatear fechas
        const fechaInicio = contrato.fecha_contrato ? new Date(contrato.fecha_contrato).toLocaleDateString('es-MX') : 'N/A';
        const fechaFin = contrato.fecha_fin ? new Date(contrato.fecha_fin).toLocaleDateString('es-MX') : 'N/A';

        // Determinar clase de estado
        let statusClass = 'active';
        if (contrato.estado === 'Pendiente') statusClass = 'pending';
        if (contrato.estado === 'Concluido') statusClass = 'concluded';

        // Formatear monto
        const monto = parseFloat(contrato.total || 0).toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN'
        });

        row.innerHTML = `
            <td>
                <strong>${contrato.numero_contrato || 'N/A'}</strong><br>
                <small>${cantidadItems} ${cantidadItems === 1 ? 'tipo de equipo' : 'tipos de equipo'}</small>
            </td>
            <td>
                <strong>${contrato.nombre_cliente || 'N/A'}</strong><br>
                <small>${contrato.responsable || 'N/A'}</small>
            </td>
            <td><span class="status ${statusClass}">${contrato.estado || 'Activo'}</span></td>
            <td>
                Inicio: ${fechaInicio}<br>
                Fin: ${fechaFin}
            </td>
            <td>${monto}</td>
            <td class="table-actions">
                <a href="#" class="btn-ver" data-id="${contrato.id_contrato}">Ver</a>
                <a href="#" class="btn-editar" data-id="${contrato.id_contrato}">Editar</a>
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
    // Crear modal de detalles
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'contrato-detalle-modal';

    const itemsHtml = contrato.items && contrato.items.length > 0
        ? contrato.items.map(item => `
            <tr>
                <td>${item.clave || 'N/A'}</td>
                <td>${item.descripcion || 'N/A'}</td>
                <td>${item.cantidad || 0}</td>
                <td>$${parseFloat(item.precio_unitario || 0).toFixed(2)}</td>
                <td>$${parseFloat(item.total || 0).toFixed(2)}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="5" style="text-align: center;">Sin items</td></tr>';

    const monto = parseFloat(contrato.total || 0).toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN'
    });

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h3>Detalles del Contrato: ${contrato.numero_contrato}</h3>
                <span class="close-modal" onclick="this.closest('.modal-overlay').remove()">&times;</span>
            </div>
            <div class="modal-body">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div>
                        <p><strong>Número:</strong> ${contrato.numero_contrato}</p>
                        <p><strong>Cliente:</strong> ${contrato.nombre_cliente}</p>
                        <p><strong>Responsable:</strong> ${contrato.responsable}</p>
                        <p><strong>Estado:</strong> ${contrato.estado}</p>
                    </div>
                    <div>
                        <p><strong>Fecha Contrato:</strong> ${new Date(contrato.fecha_contrato).toLocaleDateString('es-MX')}</p>
                        <p><strong>Tipo:</strong> ${contrato.tipo}</p>
                        <p><strong>Total:</strong> ${monto}</p>
                        <p><strong>Factura:</strong> ${contrato.requiere_factura}</p>
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
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>

                <h4>Domicilio de Entrega</h4>
                <p>${contrato.calle} #${contrato.numero_externo}, ${contrato.colonia}, ${contrato.municipio}, ${contrato.estado_entidad} ${contrato.codigo_postal}</p>
                <p><strong>Notas:</strong> ${contrato.notas_domicilio || 'N/A'}</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cerrar</button>
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

    const itemsHtml = contrato.items && contrato.items.length > 0
        ? contrato.items.map((item, idx) => `
            <tr>
                <td><input type="text" value="${item.clave || ''}" class="item-clave" style="width: 100%; padding: 5px;"></td>
                <td><input type="text" value="${item.descripcion || ''}" class="item-descripcion" style="width: 100%; padding: 5px;"></td>
                <td><input type="number" value="${item.cantidad || 0}" class="item-cantidad" style="width: 100%; padding: 5px;"></td>
                <td><input type="number" step="0.01" value="${item.precio_unitario || 0}" class="item-precio" style="width: 100%; padding: 5px;"></td>
                <td><input type="number" step="0.01" value="${item.total || 0}" class="item-total" readonly style="width: 100%; padding: 5px; background: #f5f5f5;"></td>
                <td><button class="btn-eliminar-item" data-idx="${idx}" style="padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Eliminar</button></td>
            </tr>
        `).join('')
        : '';

    // Crear tabs para edición y vistas previas
    const tabsHtml = `
        <div style="display: flex; gap: 10px; border-bottom: 2px solid #ddd; margin-bottom: 20px;">
            <button class="tab-btn active" data-tab="editar" style="padding: 10px 20px; background: none; border: none; cursor: pointer; font-weight: 600; border-bottom: 3px solid #1976d2; color: #1976d2;">Editar</button>
            <button class="tab-btn" data-tab="preview-pdf" style="padding: 10px 20px; background: none; border: none; cursor: pointer; font-weight: 600; border-bottom: 3px solid transparent; color: #666;">Vista Previa PDF</button>
            <button class="tab-btn" data-tab="preview-nota" style="padding: 10px 20px; background: none; border: none; cursor: pointer; font-weight: 600; border-bottom: 3px solid transparent; color: #666;">Vista Previa Nota</button>
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

                    <div style="margin-bottom: 20px;">
                        <label>Notas de Domicilio:</label>
                        <textarea id="edit-notas" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; height: 80px;">${contrato.notas_domicilio || ''}</textarea>
                    </div>
                </form>
                </div>

                <!-- Tab: Vista Previa PDF -->
                <div class="tab-content" data-tab="preview-pdf" style="display: none;">
                    ${contrato.pdf_contrato ? `
                        <div style="text-align: center; margin-bottom: 20px;">
                            <p><strong>PDF del Contrato:</strong> ${contrato.pdf_contrato}</p>
                            <a href="${API_URL}/pdf/descargar/${encodeURIComponent(contrato.pdf_contrato)}" target="_blank" class="btn btn-primary" style="display: inline-block; padding: 10px 20px; text-decoration: none; background: #1976d2; color: white; border-radius: 4px;">Descargar PDF</a>
                        </div>
                        <div style="text-align: center; padding: 40px;">
                            <p style="margin-bottom: 20px; color: #666;">Haz clic en el botón para abrir el PDF en una nueva ventana.</p>
                            <a href="${API_URL}/pdf/ver/${encodeURIComponent(contrato.pdf_contrato)}" target="_blank" class="btn btn-primary" style="display: inline-block; padding: 12px 24px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; text-decoration: none;">Abrir PDF en Nueva Ventana</a>
                        </div>
                    ` : `
                        <p style="text-align: center; color: #999; padding: 40px;">No hay PDF disponible para este contrato</p>
                    `}
                </div>

                <!-- Tab: Vista Previa Nota -->
                <div class="tab-content" data-tab="preview-nota" style="display: none;">
                    ${contrato.pdf_nota ? `
                        <div style="text-align: center; margin-bottom: 20px;">
                            <p><strong>PDF de la Nota:</strong> ${contrato.pdf_nota}</p>
                            <a href="${API_URL}/pdf/descargar/${encodeURIComponent(contrato.pdf_nota)}" target="_blank" class="btn btn-primary" style="display: inline-block; padding: 10px 20px; text-decoration: none; background: #1976d2; color: white; border-radius: 4px;">Descargar Nota</a>
                        </div>
                        <div style="text-align: center; padding: 40px;">
                            <p style="margin-bottom: 20px; color: #666;">Haz clic en el botón para abrir la nota en una nueva ventana.</p>
                            <a href="${API_URL}/pdf/ver/${encodeURIComponent(contrato.pdf_nota)}" target="_blank" class="btn btn-primary" style="display: inline-block; padding: 12px 24px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; text-decoration: none;">Abrir Nota en Nueva Ventana</a>
                        </div>
                    ` : `
                        <p style="text-align: center; color: #999; padding: 40px;">No hay nota disponible para este contrato</p>
                    `}
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

                // Los PDFs se cargan automáticamente con los iframes
            }
        });
    });

    // Event listeners para eliminar items
    modal.querySelectorAll('.btn-eliminar-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const idx = btn.getAttribute('data-idx');
            const row = btn.closest('tr');
            row.remove();
        });
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Guardar edición del contrato
 */
async function guardarEdicionContrato(idContrato) {
    try {
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
            id_cotizacion: contratosGlobal.find(c => c.id_contrato === idContrato)?.id_cotizacion,
            responsable: document.getElementById('edit-responsable').value,
            estado: document.getElementById('edit-estado').value,
            subtotal: parseFloat(document.getElementById('edit-subtotal').value) || 0,
            impuesto: parseFloat(document.getElementById('edit-impuesto').value) || 0,
            descuento: parseFloat(document.getElementById('edit-descuento').value) || 0,
            total: parseFloat(document.getElementById('edit-total').value) || 0,
            tipo_garantia: 'PAGARE',
            importe_garantia: 0,
            calle: document.getElementById('edit-calle').value,
            numero_externo: document.getElementById('edit-no-externo').value,
            numero_interno: document.getElementById('edit-no-interno').value,
            colonia: document.getElementById('edit-colonia').value,
            codigo_postal: document.getElementById('edit-cp').value,
            entre_calles: '',
            pais: document.getElementById('edit-pais').value,
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
