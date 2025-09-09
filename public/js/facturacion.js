// public/js/facturacion.js
// Variables globales
let conceptos = [];
let contadorConceptos = 0;
let facturas = [];
let estadisticas = {};

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
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

        const response = await fetch('http://localhost:3001/api/auth/profile', {
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
        const response = await fetch('http://localhost:3001/api/facturas', {
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
        switch(factura.estado) {
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
        const response = await fetch(`http://localhost:3001/api/facturas/${uuid}/pdf`, {
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

// Variables para el modal de email
let facturaActual = null;

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
        const response = await fetch(`http://localhost:3001/api/facturas/${uuid}/pdf`, {
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
        const response = await fetch(`http://localhost:3001/api/facturas/${facturaActual}/enviar-email`, {
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
    closeBtn.onclick = function() {
        modal.style.display = 'none';
        resetForm();
    };
    
    // Cerrar modal haciendo clic fuera
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
            resetForm();
        }
    };
    
    // Cerrar modal con Escape
    document.addEventListener('keydown', function(e) {
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
    document.addEventListener('input', function(e) {
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
        const response = await fetch('http://localhost:3001/api/facturas/timbrar', {
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
                    const pdfResponse = await fetch(`http://localhost:3001/api/facturas/${result.data.uuid}/pdf`, {
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