// public/js/facturacion.js
// Variables globales
let conceptos = [];
let contadorConceptos = 0;
let facturas = [];
let estadisticas = {};

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    // Cargar datos del usuario
    cargarUsuario();

    // Cargar datos reales de facturas
    cargarFacturas();

    // Configurar eventos del modal
    configurarModal();

    // Configurar eventos del formulario
    configurarFormulario();
});

// Función para cargar datos del usuario
async function cargarUsuario() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const usuario = await response.json();
            document.getElementById('user-name').textContent = usuario.nombre || 'Usuario';
            document.getElementById('user-role').textContent = usuario.rol || 'Usuario';
            document.getElementById('user-email').textContent = usuario.correo || '';
            if (usuario.foto) {
                document.getElementById('avatar-img').src = usuario.foto;
                document.getElementById('avatar-img-dropdown').src = usuario.foto;
            }
        } else {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error('Error cargando usuario:', error);
        window.location.href = 'login.html';
    }
}

// Función para cargar facturas reales
async function cargarFacturas() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/facturas', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            facturas = result.data.facturas;
            estadisticas = result.data.estadisticas;

            // Actualizar estadísticas
            actualizarEstadisticas();

            // Actualizar tabla de facturas
            actualizarTablaFacturas();
        } else {
            console.error('Error cargando facturas');
        }
    } catch (error) {
        console.error('Error cargando facturas:', error);
    }
}

// Función para actualizar estadísticas
function actualizarEstadisticas() {
    // Actualizar tarjetas de resumen
    const facturasPendientes = document.querySelector('.summary-card:nth-child(1) .value');
    const facturasVencidas = document.querySelector('.summary-card:nth-child(2) .value');
    const ingresosMes = document.querySelector('.summary-card:nth-child(3) .value');
    const porCobrar = document.querySelector('.summary-card:nth-child(4) .value');

    if (facturasPendientes) facturasPendientes.textContent = estadisticas.facturasPendientes || 0;
    if (facturasVencidas) facturasVencidas.textContent = estadisticas.facturasVencidas || 0;
    if (ingresosMes) ingresosMes.textContent = `$${Number(estadisticas.ingresosMes || 0).toLocaleString()}`;
    if (porCobrar) porCobrar.textContent = `$${Number(estadisticas.porCobrar || 0).toLocaleString()}`;
}

// Función para actualizar tabla de facturas
function actualizarTablaFacturas() {
    const tbody = document.querySelector('.facturas-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    facturas.forEach(factura => {
        const row = document.createElement('tr');

        // Determinar clase de estado
        let estadoClass = '';
        let estadoIcon = '';
        switch (factura.estado) {
            case 'Pagada':
                estadoClass = 'paid';
                estadoIcon = 'fa-check-circle';
                break;
            case 'Pendiente':
                estadoClass = 'pending';
                estadoIcon = 'fa-clock';
                break;
            case 'Vencida':
                estadoClass = 'expired';
                estadoIcon = 'fa-exclamation-triangle';
                break;
        }

        row.innerHTML = `
            <td>
                <i class="fa fa-file-invoice" style="color:#2979ff"></i> ${factura.folio}<br>
                <span style="color:#888;font-size:0.95em;">${factura.contrato}</span>
            </td>
            <td>
                <b>${factura.cliente.nombre}</b><br>
                <span style="color:#888;font-size:0.95em;">Método: ${factura.cliente.metodo}</span>
            </td>
            <td>
                <span class="badge ${estadoClass}">
                    <i class="fa ${estadoIcon}"></i> ${factura.estado}
                </span>
            </td>
            <td>
                <i class="fa fa-calendar"></i> Emisión: ${factura.fechas.emision}<br>
                <i class="fa fa-clock"></i> Vence: ${factura.fechas.vencimiento}
            </td>
            <td>$${Number(factura.monto).toLocaleString()}</td>
            <td>
                $${Number(factura.pagado.monto).toLocaleString()} 
                <span class="progress-bar">
                    <span class="progress" style="width:${factura.pagado.porcentaje}%"></span>
                </span><br>
                ${factura.pagado.fecha ? `<span style="color:#888;font-size:0.95em;">Pagado: ${factura.pagado.fecha}</span>` : ''}
            </td>
            <td class="actions">
                <a href="#" onclick="descargarPDF('${factura.uuid}')" title="Descargar PDF">
                    <i class="fa fa-download"></i>
                </a>
                <a href="#" onclick="verFactura('${factura.uuid}')" style="color:#43a047" title="Ver factura">
                    <i class="fa fa-paper-plane"></i> Ver
                </a>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// Función para descargar PDF
async function descargarPDF(uuid) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/facturas/${uuid}/pdf`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `FACTURA-${uuid}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            console.error('Error descargando PDF');
        }
    } catch (error) {
        console.error('Error descargando PDF:', error);
    }
}

// Función para ver factura
function verFactura(uuid) {
    // Abrir modal para enviar factura por email
    abrirModalEmail(uuid);
}

// Función para abrir modal de email
function abrirModalEmail(uuid) {
    facturaActual = uuid;
    document.getElementById('email-modal').style.display = 'flex';
    cargarPDFPreview(uuid);
}

// Función para cargar preview del PDF
async function cargarPDFPreview(uuid) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/facturas/${uuid}/pdf`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            document.getElementById('pdf-preview').src = url;
        } else {
            console.error('Error cargando PDF para preview');
        }
    } catch (error) {
        console.error('Error cargando PDF para preview:', error);
    }
}

// Función para enviar factura por email
async function enviarFacturaPorEmail() {
    const email = document.getElementById('email-cliente').value.trim();
    if (!email) {
        alert('Por favor ingresa el correo del cliente');
        return;
    }

    if (!facturaActual) {
        alert('Error: No se ha seleccionado una factura');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/facturas/${facturaActual}/enviar-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ email: email })
        });

        if (response.ok) {
            alert('Factura enviada exitosamente');
            cerrarModalEmail();
        } else {
            const error = await response.text();
            alert('Error enviando factura: ' + error);
        }
    } catch (error) {
        console.error('Error enviando factura:', error);
        alert('Error enviando factura');
    }
}

// Función para cerrar modal de email
function cerrarModalEmail() {
    document.getElementById('email-modal').style.display = 'none';
    document.getElementById('email-cliente').value = '';
    document.getElementById('asunto-email').value = 'Factura Electrónica - ScaffoldPro';
    document.getElementById('mensaje-email').value = '';
    facturaActual = null;
}

// Configurar eventos del modal
function configurarModal() {
    const modal = document.getElementById('nueva-factura-modal');
    const closeBtn = document.getElementById('close-nueva-factura-modal');

    // Cerrar modal con X
    closeBtn.onclick = function () {
        modal.style.display = 'none';
        resetForm();
    };

    // Cerrar modal haciendo clic fuera
    modal.onclick = function (e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            resetForm();
        }
    };

    // Cerrar modal con Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            resetForm();
        }
    });
}

// Configurar eventos del formulario
function configurarFormulario() {
    const form = document.getElementById('formEmitirFactura');
    const agregarBtn = document.getElementById('agregarConcepto');

    // Evento para agregar concepto
    agregarBtn.onclick = agregarConcepto;

    // Evento para enviar formulario
    form.onsubmit = enviarFactura;

    // Eventos para cálculos automáticos
    document.addEventListener('input', function (e) {
        if (e.target.matches('input[type="number"]')) {
            actualizarTotales();
        }
    });
}

// Función para abrir modal
function abrirModalFactura() {
    document.getElementById('nueva-factura-modal').style.display = 'flex';
    // Agregar primer concepto automáticamente
    if (conceptos.length === 0) {
        agregarConcepto();
    }
}

// Función para agregar concepto
function agregarConcepto() {
    contadorConceptos++;
    const conceptoId = `concepto-${contadorConceptos}`;

    const conceptoHTML = `
        <div id="${conceptoId}" class="concepto-row" style="background:#f7f9fb;padding:16px;border-radius:8px;margin-bottom:12px;border:1px solid #e3e8ef;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <h5 style="margin:0;font-size:1rem;font-weight:600;color:#232323;">Concepto ${contadorConceptos}</h5>
                <button type="button" onclick="eliminarConcepto('${conceptoId}')" 
                        style="background:#ffebee;color:#f44336;border:none;border-radius:6px;padding:4px 8px;font-size:0.8rem;cursor:pointer;">
                    <i class="fa fa-trash"></i> Eliminar
                </button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">Clave Producto/Servicio</label>
                    <select class="clave-producto" required 
                            style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;">
                        <option value="">Selecciona...</option>
                        <option value="84111506">84111506 - Servicios de arrendamiento de andamios</option>
                        <option value="84111507">84111507 - Servicios de arrendamiento de escaleras</option>
                        <option value="84111508">84111508 - Servicios de arrendamiento de plataformas</option>
                        <option value="72141700">72141700 - Servicios de arrendamiento de equipos de construcción</option>
                    </select>
                </div>
                <div>
                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">No. Identificación</label>
                    <input type="text" class="no-identificacion" placeholder="Opcional"
                           style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;" />
                </div>
                <div>
                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">Cantidad</label>
                    <input type="number" class="cantidad" required min="1" step="1" value="1"
                           style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;" />
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">Clave Unidad</label>
                    <select class="clave-unidad" required 
                            style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;">
                        <option value="">Selecciona...</option>
                        <option value="E48">E48 - Unidad de servicio</option>
                        <option value="H87">H87 - Pieza</option>
                        <option value="DAY">DAY - Día</option>
                        <option value="MON">MON - Mes</option>
                    </select>
                </div>
                <div>
                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">Valor Unitario</label>
                    <input type="number" class="valor-unitario" required min="0" step="0.01" placeholder="0.00"
                           style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;" />
                </div>
                <div>
                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">Importe</label>
                    <input type="number" class="importe" readonly
                           style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;background:#f1f5f9;" />
                </div>
            </div>
            <div>
                <label style="display:block;margin-bottom:4px;font-weight:600;color:#232323;font-size:0.9rem;">Descripción</label>
                <textarea class="descripcion" required placeholder="Descripción del concepto..."
                          style="width:100%;padding:8px 10px;border-radius:6px;border:1px solid #e3e8ef;font-size:0.9rem;resize:vertical;min-height:60px;"></textarea>
            </div>
        </div>
    `;

    document.getElementById('conceptosContainer').insertAdjacentHTML('beforeend', conceptoHTML);

    // Configurar eventos para cálculos automáticos
    const conceptoDiv = document.getElementById(conceptoId);
    const cantidadInput = conceptoDiv.querySelector('.cantidad');
    const valorUnitarioInput = conceptoDiv.querySelector('.valor-unitario');
    const importeInput = conceptoDiv.querySelector('.importe');

    function calcularImporte() {
        const cantidad = parseFloat(cantidadInput.value) || 0;
        const valorUnitario = parseFloat(valorUnitarioInput.value) || 0;
        const importe = cantidad * valorUnitario;
        importeInput.value = importe.toFixed(2);
        actualizarTotales();
    }

    cantidadInput.addEventListener('input', calcularImporte);
    valorUnitarioInput.addEventListener('input', calcularImporte);

    conceptos.push(conceptoId);
}

// Función para eliminar concepto
function eliminarConcepto(conceptoId) {
    const conceptoDiv = document.getElementById(conceptoId);
    if (conceptoDiv) {
        conceptoDiv.remove();
        conceptos = conceptos.filter(id => id !== conceptoId);
        actualizarTotales();
    }
}

// Función para actualizar totales
function actualizarTotales() {
    let subtotal = 0;

    conceptos.forEach(conceptoId => {
        const conceptoDiv = document.getElementById(conceptoId);
        if (conceptoDiv) {
            const importeInput = conceptoDiv.querySelector('.importe');
            const importe = parseFloat(importeInput.value) || 0;
            subtotal += importe;
        }
    });

    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    document.getElementById('subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('iva').textContent = `$${iva.toFixed(2)}`;
    document.getElementById('total').textContent = `$${total.toFixed(2)}`;
}

// Función para enviar factura
async function enviarFactura(e) {
    e.preventDefault();

    // Validar datos del receptor
    const receptorRfc = document.getElementById('receptorRfc').value.trim();
    const receptorNombre = document.getElementById('receptorNombre').value.trim();
    const receptorRegimenFiscal = document.getElementById('receptorRegimenFiscal').value;
    const receptorCp = document.getElementById('receptorCp').value.trim();
    const usoCfdi = document.getElementById('usoCfdi').value;
    const formaPago = document.getElementById('formaPago').value;
    const metodoPago = document.getElementById('metodoPago').value;

    if (!receptorRfc || !receptorNombre || !receptorRegimenFiscal || !receptorCp || !usoCfdi || !formaPago || !metodoPago) {
        mostrarMensaje('Por favor completa todos los campos del receptor', 'error');
        return;
    }

    // Validar que haya al menos un concepto
    if (conceptos.length === 0) {
        mostrarMensaje('Debes agregar al menos un concepto', 'error');
        return;
    }

    // Validar conceptos
    for (let conceptoId of conceptos) {
        const conceptoDiv = document.getElementById(conceptoId);
        if (conceptoDiv) {
            const claveProducto = conceptoDiv.querySelector('.clave-producto').value;
            const cantidad = conceptoDiv.querySelector('.cantidad').value;
            const claveUnidad = conceptoDiv.querySelector('.clave-unidad').value;
            const valorUnitario = conceptoDiv.querySelector('.valor-unitario').value;
            const descripcion = conceptoDiv.querySelector('.descripcion').value.trim();

            if (!claveProducto || !cantidad || !claveUnidad || !valorUnitario || !descripcion) {
                mostrarMensaje('Por favor completa todos los campos de los conceptos', 'error');
                return;
            }
        }
    }

    // Preparar datos de la factura
    const facturaData = {
        receptor: {
            rfc: receptorRfc,
            nombre: receptorNombre,
            regimenFiscal: receptorRegimenFiscal,
            codigoPostal: receptorCp,
            usoCfdi: usoCfdi
        },
        factura: {
            formaPago: formaPago,
            metodoPago: metodoPago
        },
        conceptos: conceptos.map(conceptoId => {
            const conceptoDiv = document.getElementById(conceptoId);
            return {
                claveProductoServicio: conceptoDiv.querySelector('.clave-producto').value,
                noIdentificacion: conceptoDiv.querySelector('.no-identificacion').value,
                cantidad: parseFloat(conceptoDiv.querySelector('.cantidad').value),
                claveUnidad: conceptoDiv.querySelector('.clave-unidad').value,
                valorUnitario: parseFloat(conceptoDiv.querySelector('.valor-unitario').value),
                descripcion: conceptoDiv.querySelector('.descripcion').value
            };
        })
    };

    try {
        mostrarMensaje('Procesando factura...', 'info');

        const token = localStorage.getItem('token');
        const response = await fetch('/api/facturas/timbrar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(facturaData)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            mostrarMensaje('Factura timbrada exitosamente. Descargando PDF...', 'success');

            // Descargar PDF automáticamente
            setTimeout(async () => {
                try {
                    const pdfResponse = await fetch(`/api/facturas/${result.data.uuid}/pdf`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (pdfResponse.ok) {
                        const blob = await pdfResponse.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `FACTURA-${result.data.uuid}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);

                        mostrarMensaje('PDF descargado exitosamente', 'success');
                    } else {
                        console.error('Error descargando PDF');
                        mostrarMensaje('Factura timbrada pero error al descargar PDF', 'error');
                    }
                } catch (pdfError) {
                    console.error('Error descargando PDF:', pdfError);
                    mostrarMensaje('Factura timbrada pero error al descargar PDF', 'error');
                }
            }, 1000);

            // Recargar datos de facturas
            await cargarFacturas();

            // Cerrar modal después de 3 segundos
            setTimeout(() => {
                document.getElementById('nueva-factura-modal').style.display = 'none';
                resetForm();
            }, 3000);
        } else {
            mostrarMensaje(result.error || 'Error al timbrar la factura', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error de conexión con el servidor', 'error');
    }
}

// Función para mostrar mensajes
function mostrarMensaje(mensaje, tipo) {
    const mensajeDiv = document.getElementById('mensajeFacturacion');
    mensajeDiv.textContent = mensaje;
    mensajeDiv.style.color = tipo === 'success' ? '#43a047' : tipo === 'error' ? '#f44336' : '#2979ff';
}

// Función para resetear formulario
function resetForm() {
    document.getElementById('formEmitirFactura').reset();
    conceptos = [];
    contadorConceptos = 0;
    document.getElementById('conceptosContainer').innerHTML = '';
    document.getElementById('subtotal').textContent = '$0.00';
    document.getElementById('iva').textContent = '$0.00';
    document.getElementById('total').textContent = '$0.00';
    document.getElementById('mensajeFacturacion').textContent = '';
}

// === FUNCIONES PARA LA SECCIÓN DE TIMBRADO ===

// Función para buscar documento o equipo
async function buscarDocumento() {
    const queryValue = document.getElementById('search-documento').value.trim();
    if (!queryValue) {
        Swal.fire('Error', 'Ingresa un folio, clave de equipo o nombre de cliente', 'error');
        return;
    }

    try {
        Swal.fire({
            title: 'Buscando...',
            didOpen: () => { Swal.showLoading(); }
        });

        const token = localStorage.getItem('token');
        const response = await fetch(`/api/facturas/search-document/${queryValue}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();
        Swal.close();

        if (response.ok && result.success) {
            renderDocumentData(result);
        } else {
            Swal.fire('No encontrado', result.error || 'No se encontró el documento o cliente', 'warning');
        }
    } catch (error) {
        console.error('Error en buscarDocumento:', error);
        Swal.fire('Error', 'Ocurrió un error al buscar el documento', 'error');
    }
}

// --- LÓGICA DE BÚSQUEDA EN TIEMPO REAL (PHASE 3) ---
let debounceTimer;
function debounce(func, delay) {
    return (...args) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
}

const buscarclientefiscal = debounce(async (valor) => {
    const resultsContainer = document.getElementById('search-results-timb');
    const valorTrim = valor.trim();

    if (valorTrim.length < 3) {
        resultsContainer.style.display = 'none';
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/facturas/search-document/${encodeURIComponent(valorTrim)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // Si es una cotización directa o equipo con éxito total, cerrar lista y renderizar
            if (result.type !== 'CLIENTE' && result.type !== 'RENTA') {
                // Para VEN o Claves exactas, tal vez no queremos autocompletado sino acción directa
                // Pero aquí seguiremos el flujo de autocompletado si el usuario lo pide
            }

            mostrarResultadosAutocomplete(result);
        } else {
            resultsContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Error en buscarclientefiscal:', error);
    }
}, 300);

function mostrarResultadosAutocomplete(data) {
    const container = document.getElementById('search-results-timb');
    container.innerHTML = '';

    // 1. Si es Cotización o Equipo (Resultado Directo)
    if (data.type === 'VENTA' || data.type === 'RENTA') {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        const title = data.type === 'VENTA' ? `Cotización: ${document.getElementById('search-documento').value}` : `Equipo: ${document.getElementById('search-documento').value}`;
        div.innerHTML = `
            <span class="client-title">${title}</span>
            <span class="client-info">Contiene conceptos y datos vinculados. Haz clic para cargar.</span>
        `;
        div.onclick = () => {
            renderDocumentData(data);
            container.style.display = 'none';
        };
        container.appendChild(div);
    }
    // 2. Si es una lista de Clientes (Búsqueda por Nombre/RFC/ID)
    else if (data.type === 'CLIENTE_LIST' && data.clientes && data.clientes.length > 0) {
        data.clientes.forEach(cl => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `
                <span class="client-title">${cl.razon_social || cl.nombre}</span>
                <span class="client-info">RFC: ${cl.rfc || 'N/A'} | CP: ${cl.codigo_postal || 'N/A'}</span>
            `;
            div.onclick = () => {
                document.getElementById('search-documento').value = cl.razon_social || cl.nombre;
                // Envolvemos el cliente en el formato esperado por renderDocumentData
                renderDocumentData({ success: true, type: 'CLIENTE', cliente: cl });
                container.style.display = 'none';
            };
            container.appendChild(div);
        });
    }

    container.style.display = container.innerHTML ? 'block' : 'none';
}

// Cerrar resultados al hacer clic fuera
document.addEventListener('click', (e) => {
    const container = document.getElementById('search-results-timb');
    const input = document.getElementById('search-documento');
    if (e.target !== container && e.target !== input) {
        container.style.display = 'none';
    }
});

// Función para renderizar los datos en la sección de timbrado (REDISEÑADO)
function renderDocumentData(data) {
    const cliente = data.cliente;

    // 1. Limpiar y llenar campos del encabezado
    document.getElementById('timb-cliente-nombre').textContent = cliente ? (cliente.razon_social || cliente.nombre) : 'Equipo Detectado';
    document.getElementById('timb-cliente-direccion').textContent = cliente ? (cliente.direccion || 'Dirección no disponible') : '-';

    // Guardar datos ocultos para el timbrado
    if (cliente) {
        document.getElementById('timb-cliente-rfc').value = cliente.rfc || '';
        document.getElementById('timb-cliente-cp').value = cliente.codigo_postal || cliente.cp || '';
        document.getElementById('timb-cliente-regimen').value = cliente.regimen_fiscal || '';
        document.getElementById('timb-cliente-uso').value = cliente.uso_cfdi || 'G03';
    } else {
        // Reset fields if no client
        document.getElementById('timb-cliente-rfc').value = '';
        document.getElementById('timb-cliente-cp').value = '';
        document.getElementById('timb-cliente-regimen').value = '';
        document.getElementById('timb-cliente-uso').value = 'G03';
    }

    // Set fecha emisión hoy
    document.getElementById('timb-fecha-emision').value = new Date().toLocaleDateString();

    // 2. Limpiar y llenar la tabla de conceptos
    const tbody = document.getElementById('products-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        if (data.conceptos && data.conceptos.length > 0) {
            data.conceptos.forEach(concepto => {
                agregarFilaConcepto(concepto);
            });
        }
        actualizarTotalesTimbrado();
    }
}

// Función para abrir el modal de agregar concepto (SweetAlert2 - Imagen 2)
function abrirModalAgregarConcepto() {
    Swal.fire({
        title: '<i class="fa fa-info-circle"></i> Detalle del Servicio ó Producto',
        html: `
            <div style="text-align:left; padding:10px;">
                <label style="font-size:0.9rem; color:#6b7280;">Descripción (Búsqueda en tiempo real):</label>
                <div style="position:relative;">
                    <input id="swal-input-desc" class="swal2-input" placeholder="Escribe para buscar o ingresar manualmente..." 
                        style="margin:10px 0; width:95%;" autocomplete="off">
                    <div id="swal-results-container" class="search-results-list" style="display: none; width:95%;"></div>
                </div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:20px;">
                    <div>
                        <label style="font-size:0.8rem;">Clave SAT:</label>
                        <input id="swal-input-sat" class="swal2-input" value="01010101" style="margin:5px 0;">
                    </div>
                    <div>
                        <label style="font-size:0.8rem;">Clave Unidad:</label>
                        <input id="swal-input-unidad" class="swal2-input" value="H87" style="margin:5px 0;">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-top:15px;">
                    <div>
                        <label style="font-size:0.8rem;">Cantidad:</label>
                        <input id="swal-input-cant" type="number" value="1" class="swal2-input" style="margin:5px 0;" oninput="recalcSwal()">
                    </div>
                    <div>
                        <label style="font-size:0.8rem;">P.Unitario:</label>
                        <input id="swal-input-price" type="number" value="0" class="swal2-input" style="margin:5px 0;" oninput="recalcSwal()">
                    </div>
                    <div>
                        <label style="font-size:0.8rem;">Total:</label>
                        <input id="swal-input-total" type="number" value="0" class="swal2-input" style="margin:5px 0; background:#f1f5f9;" readonly>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa fa-plus"></i> Agregar',
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#43a047',
        didOpen: () => {
            const descInput = document.getElementById('swal-input-desc');
            const resultsContainer = document.getElementById('swal-results-container');

            // Auto recalc script
            window.recalcSwal = () => {
                const c = parseFloat(document.getElementById('swal-input-cant').value) || 0;
                const p = parseFloat(document.getElementById('swal-input-price').value) || 0;
                document.getElementById('swal-input-total').value = (c * p).toFixed(2);
            };

            // Evento de búsqueda para el input del modal
            descInput.addEventListener('input', (e) => {
                const valor = e.target.value.trim();
                if (valor.length < 2) {
                    resultsContainer.style.display = 'none';
                    return;
                }
                buscarConceptosModal(valor, resultsContainer);
            });
        },
        preConfirm: () => {
            const desc = document.getElementById('swal-input-desc').value;
            const cant = document.getElementById('swal-input-cant').value;
            const price = document.getElementById('swal-input-price').value;
            const sat = document.getElementById('swal-input-sat').value;
            const unidad = document.getElementById('swal-input-unidad').value;

            if (!desc || !cant || !price) {
                Swal.showValidationMessage('Por favor completa los campos obligatorios');
                return false;
            }

            return {
                descripcion: desc,
                cantidad: parseFloat(cant),
                valorUnitario: parseFloat(price),
                claveProductoServicio: sat,
                claveUnidad: unidad
            };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            agregarFilaConcepto(result.value);
            actualizarTotalesTimbrado();
        }
    });
}

// Búsqueda en tiempo real dentro del modal CONCEPTOS (PHASE 4)
const buscarConceptosModal = debounce(async (valor, container) => {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/facturas/search-concepts/${encodeURIComponent(valor)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (response.ok && data.success && data.results.length > 0) {
            renderResultadosModal(data.results, container);
        } else {
            container.style.display = 'none';
        }
    } catch (error) {
        console.error('Error buscando conceptos en modal:', error);
    }
}, 300);

function renderResultadosModal(results, container) {
    container.innerHTML = '';
    results.forEach(res => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <span class="client-title">${res.title}</span>
            <span class="client-info">${res.info}</span>
        `;
        div.onclick = () => {
            if (res.type === 'COTIZACION') {
                container.style.display = 'none';
                Swal.close();
                cargarConceptosDesdeCotizacion(res.data);
            } else {
                // Producto o Servicio: Llenar campos del modal
                document.getElementById('swal-input-desc').value = res.title;
                document.getElementById('swal-input-sat').value = res.sat || '01010101';
                document.getElementById('swal-input-unidad').value = res.unidad || 'H87';
                document.getElementById('swal-input-price').value = res.price || 0;
                window.recalcSwal();
                container.style.display = 'none';
            }
        };
        container.appendChild(div);
    });
    container.style.display = 'block';
}

function cargarConceptosDesdeCotizacion(cot) {
    try {
        let productos = cot.productos_seleccionados;
        if (typeof productos === 'string') productos = JSON.parse(productos);

        if (!productos || productos.length === 0) {
            Swal.fire('Atención', 'La cotización no tiene productos.', 'warning');
            return;
        }

        productos.forEach(p => {
            agregarFilaConcepto({
                cantidad: p.cantidad || 1,
                claveProductoServicio: p.clave_sat_productos || '01010101',
                claveUnidad: p.clave_unidad || 'H87',
                descripcion: p.nombre || p.descripcion || 'Producto',
                valorUnitario: p.precio_unitario || p.precio_venta || p.precio || 0,
                importe: (p.cantidad || 1) * (p.precio_unitario || p.precio_venta || p.precio || 0)
            });
        });
        // Si tiene costo de envío, agregarlo como un concepto
        if (parseFloat(cot.costo_envio) > 0) {
            agregarFilaConcepto({
                cantidad: 1,
                claveProductoServicio: '81141601', // Clave SAT Servicios de transporte de carga por carretera 
                claveUnidad: 'E48',
                descripcion: 'SERVICIO DE ENVÍO / LOGÍSTICA',
                valorUnitario: parseFloat(cot.costo_envio),
                importe: parseFloat(cot.costo_envio)
            });
        }

        actualizarTotalesTimbrado();
        Swal.fire('Éxito', `Se cargaron ${productos.length} conceptos${parseFloat(cot.costo_envio) > 0 ? ' + envío' : ''} desde ${cot.numero_cotizacion}`, 'success');
    } catch (e) {
        console.error('Error cargando conceptos de cotización:', e);
        Swal.fire('Error', 'No se pudieron procesar los conceptos de la cotización', 'error');
    }
}

// Función para agregar una fila a la tabla timbrado (REDISEÑADO)
function agregarFilaConcepto(c = {}) {
    const tbody = document.getElementById('products-tbody');
    const row = document.createElement('tr');

    row.innerHTML = `
        <td style="text-align:center;">
            <button class="btn-row-delete" onclick="this.closest('tr').remove(); actualizarTotalesTimbrado();">
                <i class="fa fa-times"></i>
            </button>
        </td>
        <td><input type="text" class="table-input-inline clave-sat" value="${c.claveProductoServicio || '01010101'}"></td>
        <td><input type="number" class="table-input-inline cantidad" value="${c.cantidad || 1}" oninput="actualizarTotalesTimbrado()"></td>
        <td><input type="text" class="table-input-inline clave-unidad" value="${c.claveUnidad || 'H87'}"></td>
        <td><input type="text" class="table-input-inline descripcion" value="${c.descripcion || ''}" style="width:100%"></td>
        <td><input type="number" class="table-input-inline p-unitario" value="${c.valorUnitario || 0}" step="0.01" oninput="actualizarTotalesTimbrado()"></td>
        <td style="font-weight:700;"><span class="importe-fila">$${((c.cantidad || 1) * (c.valorUnitario || 0)).toFixed(2)}</span></td>
    `;

    tbody.appendChild(row);
}

// Función para actualizar los totales (REDISEÑADO)
function actualizarTotalesTimbrado() {
    const rows = document.querySelectorAll('#products-tbody tr');
    let subtotal = 0;

    rows.forEach(row => {
        const cant = parseFloat(row.querySelector('.cantidad').value) || 0;
        const price = parseFloat(row.querySelector('.p-unitario').value) || 0;
        const importe = cant * price;

        const importeSpan = row.querySelector('.importe-fila');
        if (importeSpan) importeSpan.textContent = `$${importe.toFixed(2)}`;
        subtotal += importe;
    });

    const iva = subtotal * 0.16;
    const total = subtotal + iva;

    document.getElementById('subtotal-amount').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('iva-amount').textContent = `$${iva.toFixed(2)}`;
    document.getElementById('total-amount').textContent = `$${total.toFixed(2)}`;
}

// Función para procesar el timbrado (REDISEÑADO para SAT México)
async function procesarTimbrado() {
    const rows = document.querySelectorAll('#products-tbody tr');
    if (rows.length === 0) {
        Swal.fire('Error', 'Agrega al menos un concepto para facturar', 'error');
        return;
    }

    const rfc = document.getElementById('timb-cliente-rfc').value;
    if (!rfc || rfc === 'N/A') {
        Swal.fire('Error', 'El cliente no tiene un RFC válido para el timbrado.', 'error');
        return;
    }

    const facturaData = {
        receptor: {
            rfc: rfc,
            nombre: document.getElementById('timb-cliente-nombre').textContent,
            regimenFiscal: document.getElementById('timb-cliente-regimen').value,
            codigoPostal: document.getElementById('timb-cliente-cp').value,
            usoCfdi: document.getElementById('timb-cliente-uso').value,
            direccion: document.getElementById('timb-cliente-direccion').textContent
        },
        factura: {
            tipo: document.getElementById('timb-tipo-comprobante').value,
            serie: document.getElementById('timb-serie').value,
            moneda: document.getElementById('timb-moneda').value,
            tipoCambio: parseFloat(document.getElementById('timb-tc').value) || 1,
            formaPago: document.getElementById('timb-forma-pago').value,
            metodoPago: 'PUE', // Por defecto Pago en una sola exhibición
            observaciones: document.getElementById('timb-observacion').value
        },
        conceptos: Array.from(rows).map(row => ({
            claveProductoServicio: row.querySelector('.clave-sat').value,
            cantidad: parseFloat(row.querySelector('.cantidad').value),
            claveUnidad: row.querySelector('.clave-unidad').value,
            descripcion: row.querySelector('.descripcion').value,
            valorUnitario: parseFloat(row.querySelector('.p-unitario').value)
        }))
    };

    try {
        const confirmResult = await Swal.fire({
            title: '¿Confirmar Facturación?',
            text: "Se generará un CFDI oficial ante el SAT. ¿Deseas continuar?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'SÍ, GENERAR CFDI',
            confirmButtonColor: '#2979ff'
        });

        if (!confirmResult.isConfirmed) return;

        Swal.fire({ title: 'Procesando Timbrado...', didOpen: () => { Swal.showLoading(); } });

        const token = localStorage.getItem('token');
        const response = await fetch('/api/facturas/timbrar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(facturaData)
        });

        const res = await response.json();
        Swal.close();

        if (response.ok && res.success) {
            Swal.fire('Factura Generada', 'El CFDI se ha timbrado y enviado correctamente.', 'success');
            cargarFacturas(); // Recargar lista
            // Resetear sección opcionalmente
        } else {
            Swal.fire('Error SAT', res.error || 'Ocurrió un error al procesar la factura', 'error');
        }
    } catch (error) {
        console.error('Error in procesarTimbrado:', error);
        Swal.fire('Error de Conexión', 'No se pudo comunicar con el servicio de timbrado', 'error');
    }
}
