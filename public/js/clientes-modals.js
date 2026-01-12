// Módulo para manejar modales de clientes

// Función para mostrar modal de editar cliente (modal separada - DEPRECATED)
function mostrarModalEditarClienteOld(cliente) {
    const modal = document.getElementById('editar-cliente-modal');
    if (!modal) {
        crearModalEditarCliente();
        setTimeout(() => mostrarModalEditarCliente(cliente), 100);
        return;
    }

    // Llenar formulario con datos del cliente
    document.getElementById('edit-nombre').value = cliente.nombre || '';
    document.getElementById('edit-empresa').value = cliente.empresa || '';
    document.getElementById('edit-tipo-cliente').value = cliente.tipo_cliente || 'Individual';
    document.getElementById('edit-email').value = cliente.email || '';
    document.getElementById('edit-telefono').value = cliente.telefono || '';
    document.getElementById('edit-ciudad').value = cliente.ciudad || '';
    document.getElementById('edit-direccion').value = cliente.direccion || '';
    document.getElementById('edit-rfc').value = cliente.rfc || '';
    document.getElementById('edit-estado').value = cliente.estado || 'Activo';
    document.getElementById('edit-contacto-principal').value = cliente.contacto_principal || '';
    document.getElementById('edit-notas').value = cliente.notas_evaluacion || '';

    // Calificaciones
    document.getElementById('edit-cal-general').value = cliente.cal_general || 5;
    document.getElementById('edit-cal-pago').value = cliente.cal_pago || 5;
    document.getElementById('edit-cal-comunicacion').value = cliente.cal_comunicacion || 5;
    document.getElementById('edit-cal-equipos').value = cliente.cal_equipos || 5;
    document.getElementById('edit-cal-satisfaccion').value = cliente.cal_satisfaccion || 5;

    // Guardar ID del cliente para actualización
    modal.dataset.clienteId = cliente.id_cliente;

    modal.style.display = 'flex';
}

// Función para crear el modal de editar cliente
function crearModalEditarCliente() {
    const modalHTML = `
        <div id="editar-cliente-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Editar Cliente</h2>
                    <button class="close" onclick="cerrarModalEditar()">&times;</button>
                </div>
                <form id="form-editar-cliente" onsubmit="guardarCambiosCliente(event)">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-nombre">Nombre *</label>
                            <input type="text" id="edit-nombre">
                        </div>
                        <div class="form-group">
                            <label for="edit-empresa">Empresa</label>
                            <input type="text" id="edit-empresa">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-tipo-cliente">Tipo de Cliente</label>
                            <select id="edit-tipo-cliente">
                                <option value="Individual">Individual</option>
                                <option value="Corporativo">Corporativo</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="edit-estado">Estado</label>
                            <select id="edit-estado">
                                <option value="Activo">Activo</option>
                                <option value="Inactivo">Inactivo</option>
                                <option value="Prospecto">Prospecto</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-email">Email *</label>
                            <input type="email" id="edit-email">
                        </div>
                        <div class="form-group">
                            <label for="edit-telefono">Teléfono</label>
                            <input type="tel" id="edit-telefono">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-ciudad">Ciudad</label>
                            <input type="text" id="edit-ciudad">
                        </div>
                        <div class="form-group">
                            <label for="edit-rfc">RFC</label>
                            <input type="text" id="edit-rfc">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-direccion">Dirección</label>
                        <textarea id="edit-direccion" rows="2"></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-contacto-principal">Contacto Principal</label>
                        <input type="text" id="edit-contacto-principal">
                    </div>
                    
                    <h3>Calificaciones</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-cal-general">Calificación General</label>
                            <select id="edit-cal-general">
                                <option value="1">1 - Muy Malo</option>
                                <option value="2">2 - Malo</option>
                                <option value="3">3 - Regular</option>
                                <option value="4">4 - Bueno</option>
                                <option value="5">5 - Excelente</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="edit-cal-pago">Puntualidad de Pago</label>
                            <select id="edit-cal-pago">
                                <option value="1">1 - Muy Malo</option>
                                <option value="2">2 - Malo</option>
                                <option value="3">3 - Regular</option>
                                <option value="4">4 - Bueno</option>
                                <option value="5">5 - Excelente</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="edit-cal-comunicacion">Comunicación</label>
                            <select id="edit-cal-comunicacion">
                                <option value="1">1 - Muy Malo</option>
                                <option value="2">2 - Malo</option>
                                <option value="3">3 - Regular</option>
                                <option value="4">4 - Bueno</option>
                                <option value="5">5 - Excelente</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="edit-cal-equipos">Cuidado de Equipos</label>
                            <select id="edit-cal-equipos">
                                <option value="1">1 - Muy Malo</option>
                                <option value="2">2 - Malo</option>
                                <option value="3">3 - Regular</option>
                                <option value="4">4 - Bueno</option>
                                <option value="5">5 - Excelente</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-cal-satisfaccion">Satisfacción General</label>
                        <select id="edit-cal-satisfaccion">
                            <option value="1">1 - Muy Malo</option>
                            <option value="2">2 - Malo</option>
                            <option value="3">3 - Regular</option>
                            <option value="4">4 - Bueno</option>
                            <option value="5">5 - Excelente</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-notas">Notas de Evaluación</label>
                        <textarea id="edit-notas" rows="3"></textarea>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="cerrarModalEditar()">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Función para guardar cambios del cliente
async function guardarCambiosCliente(event) {
    event.preventDefault();

    const modal = document.getElementById('editar-cliente-modal');
    const clienteId = modal.dataset.clienteId;

    const clienteData = {
        nombre: document.getElementById('edit-nombre').value,
        empresa: document.getElementById('edit-empresa').value,
        tipo_cliente: document.getElementById('edit-tipo-cliente').value,
        email: document.getElementById('edit-email').value,
        telefono: document.getElementById('edit-telefono').value,
        ciudad: document.getElementById('edit-ciudad').value,
        direccion: document.getElementById('edit-direccion').value,
        rfc: document.getElementById('edit-rfc').value,
        estado: document.getElementById('edit-estado').value,
        contacto_principal: document.getElementById('edit-contacto-principal').value,
        notas_evaluacion: document.getElementById('edit-notas').value,
        cal_general: parseInt(document.getElementById('edit-cal-general').value),
        cal_pago: parseInt(document.getElementById('edit-cal-pago').value),
        cal_comunicacion: parseInt(document.getElementById('edit-cal-comunicacion').value),
        cal_equipos: parseInt(document.getElementById('edit-cal-equipos').value),
        cal_satisfaccion: parseInt(document.getElementById('edit-cal-satisfaccion').value)
    };

    try {
        const headers = getAuthHeaders();
        const response = await fetch(`http://localhost:3001/api/clientes/${clienteId}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(clienteData)
        });

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return;
            }
            const error = await response.json();
            throw new Error(error.error || 'Error al actualizar cliente');
        }

        showMessage('Cliente actualizado exitosamente', 'success');
        cerrarModalEditar();
        cargarClientes(); // Recargar la lista

    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        showMessage(`Error al actualizar cliente: ${error.message}`, 'error');
    }
}

// Función para cerrar modal de editar
function cerrarModalEditar() {
    const modal = document.getElementById('editar-cliente-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Función para mostrar modal de historial
function mostrarModalHistorialCliente(historial) {
    const modal = document.getElementById('historial-cliente-modal');
    if (!modal) {
        crearModalHistorialCliente();
        setTimeout(() => mostrarModalHistorialCliente(historial), 100);
        return;
    }

    const cliente = historial.cliente;
    const estadisticas = historial.estadisticas;

    // Actualizar contenido del modal
    document.getElementById('historial-cliente-nombre').textContent = cliente.nombre;
    document.getElementById('historial-cliente-empresa').textContent = cliente.empresa || 'N/A';
    document.getElementById('historial-proyectos-completados').textContent = estadisticas.proyectos_completados;
    document.getElementById('historial-valor-total').textContent = `$${(estadisticas.valor_total_proyectos || 0).toLocaleString('es-MX')}`;
    document.getElementById('historial-calificacion').textContent = (estadisticas.calificacion_promedio || 0).toFixed(1);

    // Mostrar cambios
    const cambiosContainer = document.getElementById('historial-cambios');
    cambiosContainer.innerHTML = historial.cambios.map(cambio => `
        <div class="historial-item">
            <div class="historial-fecha">${formatearFecha(cambio.fecha)}</div>
            <div class="historial-accion">${cambio.accion}</div>
            <div class="historial-detalles">${cambio.detalles}</div>
            <div class="historial-usuario">por ${cambio.usuario}</div>
        </div>
    `).join('');

    // Mostrar interacciones
    const interaccionesContainer = document.getElementById('historial-interacciones');
    interaccionesContainer.innerHTML = historial.interacciones.map(interaccion => `
        <div class="historial-item">
            <div class="historial-fecha">${formatearFecha(interaccion.fecha)}</div>
            <div class="historial-tipo">${interaccion.tipo}</div>
            <div class="historial-descripcion">${interaccion.descripcion}</div>
            <div class="historial-usuario">por ${interaccion.usuario}</div>
        </div>
    `).join('');

    modal.style.display = 'flex';
}

// Función para crear modal de historial
function crearModalHistorialCliente() {
    const modalHTML = `
        <div id="historial-cliente-modal" class="modal">
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h2>Historial del Cliente</h2>
                    <button class="close" onclick="cerrarModalHistorial()">&times;</button>
                </div>
                
                <div class="historial-resumen">
                    <div class="historial-info">
                        <h3 id="historial-cliente-nombre"></h3>
                        <p id="historial-cliente-empresa"></p>
                    </div>
                    <div class="historial-stats">
                        <div class="stat-item">
                            <span class="stat-value" id="historial-proyectos-completados">0</span>
                            <span class="stat-label">Proyectos</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value" id="historial-valor-total">$0</span>
                            <span class="stat-label">Valor Total</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value" id="historial-calificacion">0.0</span>
                            <span class="stat-label">Calificación</span>
                        </div>
                    </div>
                </div>
                
                <div class="historial-tabs">
                    <button class="tab-btn active" onclick="mostrarTabHistorial('cambios')">Cambios</button>
                    <button class="tab-btn" onclick="mostrarTabHistorial('interacciones')">Interacciones</button>
                </div>
                
                <div id="tab-cambios" class="tab-content active">
                    <h4>Historial de Cambios</h4>
                    <div id="historial-cambios" class="historial-lista"></div>
                </div>
                
                <div id="tab-interacciones" class="tab-content">
                    <h4>Interacciones Recientes</h4>
                    <div id="historial-interacciones" class="historial-lista"></div>
                </div>
                
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="cerrarModalHistorial()">Cerrar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Función para mostrar tabs del historial
function mostrarTabHistorial(tab) {
    // Actualizar botones
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[onclick="mostrarTabHistorial('${tab}')"]`).classList.add('active');

    // Mostrar contenido
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
}

// Función para cerrar modal de historial
function cerrarModalHistorial() {
    const modal = document.getElementById('historial-cliente-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Hacer funciones disponibles globalmente
window.mostrarModalEditarClienteOld = mostrarModalEditarClienteOld;
window.mostrarModalHistorialCliente = mostrarModalHistorialCliente;
window.guardarCambiosCliente = guardarCambiosCliente;
window.cerrarModalEditar = cerrarModalEditar;
window.cerrarModalHistorial = cerrarModalHistorial;
window.mostrarTabHistorial = mostrarTabHistorial;
