// API URLs
const API_URL = 'http://localhost:3001/api';
const CLIENTES_URL = `${API_URL}/clientes`;
const COTIZACIONES_URL = `${API_URL}/cotizaciones`;
const CONTRATOS_URL = `${API_URL}/contratos`;

// Estado global del modal
const contratoModal = {
    clientes: [],
    cotizaciones: [],
    clienteSeleccionado: null,
    cotizacionSeleccionada: null,
    selectClienteAbierto: false,
    selectCotizacionAbierto: false
};

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

/**
 * Mostrar mensajes toast
 */
function showMessage(msg, type = 'success') {
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
    el.style.background = type === 'success' ? '#e6f9f0' : '#fdeaea';
    el.style.color = type === 'success' ? '#1abc9c' : '#f44336';
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 2500);
}

/**
 * Cargar clientes disponibles
 */
async function cargarClientesModal() {
    try {
        const response = await fetch(CLIENTES_URL, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Error al cargar clientes');

        contratoModal.clientes = await response.json();

        // Crear datalist para búsqueda
        crearDatalistClientes();

        console.log('Clientes cargados:', contratoModal.clientes);
    } catch (error) {
        console.error('Error cargando clientes:', error);
        showMessage('Error al cargar clientes', 'error');
    }
}

/**
 * Crear datalist para búsqueda de clientes
 */
function crearDatalistClientes() {
    let datalist = document.getElementById('clientes-list');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'clientes-list';
        document.body.appendChild(datalist);
    }

    datalist.innerHTML = '';
    contratoModal.clientes.forEach(cliente => {
        const option = document.createElement('option');
        option.value = `${cliente.id_cliente} - ${cliente.nombre}`;
        option.dataset.id = cliente.id_cliente;
        option.dataset.cliente = JSON.stringify(cliente);
        datalist.appendChild(option);
    });

    // Vincula el datalist al input
    const inputCliente = document.getElementById('contract-client');
    if (inputCliente) {
        inputCliente.setAttribute('list', 'clientes-list');
    }
}

/**
 * Cargar cotizaciones del cliente seleccionado
 */
async function cargarCotizacionesDelCliente(idCliente) {
    try {
        if (!idCliente) {
            crearDatalistCotizaciones([]);
            contratoModal.cotizaciones = [];
            limpiarDatosFormulario();
            return;
        }

        const response = await fetch(`${COTIZACIONES_URL}?id_cliente=${idCliente}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('Error al cargar cotizaciones');

        let cotizacionesRaw = await response.json();

        // Validar que la respuesta sea un array
        if (!Array.isArray(cotizacionesRaw)) {
            console.warn('Respuesta de cotizaciones no es un array:', cotizacionesRaw);
            contratoModal.cotizaciones = [];
            crearDatalistCotizaciones([]);
            return;
        }

        // Filtrar SOLO cotizaciones del cliente seleccionado
        contratoModal.cotizaciones = cotizacionesRaw.filter(cot => {
            return (cot.id_cliente == idCliente) ||
                (cot.id_cliente === idCliente) ||
                (String(cot.id_cliente) === String(idCliente));
        });

        // Crear datalist solo con cotizaciones filtradas
        crearDatalistCotizaciones(contratoModal.cotizaciones);

        console.log(`Cotizaciones del cliente ${idCliente}:`, contratoModal.cotizaciones.length);
    } catch (error) {
        console.error('Error cargando cotizaciones:', error);
        showMessage('Error al cargar cotizaciones', 'error');
    }
}

/**
 * Crear datalist para búsqueda de cotizaciones
 */
function crearDatalistCotizaciones(cotizaciones) {
    let datalist = document.getElementById('cotizaciones-list');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'cotizaciones-list';
        document.body.appendChild(datalist);
    }

    datalist.innerHTML = '';

    // Filtrar SOLO cotizaciones tipo RENTA
    const cotizacionesRenta = cotizaciones.filter(cot =>
        cot.tipo && String(cot.tipo).toUpperCase() === 'RENTA'
    );

    // Mostrar solo las cotizaciones de renta del cliente filtrado
    if (!cotizacionesRenta || cotizacionesRenta.length === 0) {
        const option = document.createElement('option');
        option.value = '(Sin cotizaciones de RENTA para este cliente)';
        option.disabled = true;
        datalist.appendChild(option);
    } else {
        cotizacionesRenta.forEach(cot => {
            const option = document.createElement('option');
            const folio = cot.numero_folio || cot.id_cotizacion || cot.id;
            const tipo = cot.tipo || 'N/A';
            const total = parseFloat(cot.total || 0).toFixed(2);
            // Agregar prefijo REN- al folio para mostrar en el datalist
            const folioConPrefijo = String(folio).startsWith('REN-') ? folio : `REN-${folio}`;
            option.value = `${folioConPrefijo} - ${tipo} - $${total}`;
            option.dataset.id = cot.id_cotizacion || cot.id;
            option.dataset.cotizacion = JSON.stringify(cot);
            datalist.appendChild(option);
        });
    }

    // Vincula el datalist al input
    const inputCotizacion = document.getElementById('contract-cotizacion');
    if (inputCotizacion) {
        inputCotizacion.setAttribute('list', 'cotizaciones-list');
        inputCotizacion.value = ''; // Limpiar valor anterior
    }
}

/**
 * Llenar formulario con datos de la cotización seleccionada
 * (Flujo unificado para ambos casos: desde rentas y desde contratos)
 */
function llenarDatosDesdeQuote(cotizacion) {
    if (!cotizacion) {
        limpiarDatosFormulario();
        return;
    }

    try {
        console.log('[llenarDatosDesdeQuote] Procesando cotización:', cotizacion);

        // Llenar datos principales del contrato
        document.getElementById('contract-type').value = cotizacion.tipo || 'RENTA';
        document.getElementById('contract-invoice').value = 'SI';


        // Llenar tabla de artículos - buscar en diferentes posibles nombres de campos
        let productos = [];

        // Parsear productos_seleccionados si es string JSON
        if (cotizacion.productos_seleccionados) {
            if (typeof cotizacion.productos_seleccionados === 'string') {
                try {
                    productos = JSON.parse(cotizacion.productos_seleccionados);
                    console.log('Productos parseados desde JSON string:', productos);
                } catch (e) {
                    console.error('Error parseando productos_seleccionados:', e);
                    productos = [];
                }
            } else if (Array.isArray(cotizacion.productos_seleccionados)) {
                productos = cotizacion.productos_seleccionados;
            }
        } else if (cotizacion.productos && Array.isArray(cotizacion.productos)) {
            productos = cotizacion.productos;
        } else if (cotizacion.items && Array.isArray(cotizacion.items)) {
            productos = cotizacion.items;
        } else if (cotizacion.detalles && Array.isArray(cotizacion.detalles)) {
            productos = cotizacion.detalles;
        }

        // Agregar accesorios si existen
        if (cotizacion.accesorios_seleccionados) {
            let accesorios = [];
            if (typeof cotizacion.accesorios_seleccionados === 'string') {
                try {
                    accesorios = JSON.parse(cotizacion.accesorios_seleccionados);
                    console.log('Accesorios parseados desde JSON string:', accesorios);
                } catch (e) {
                    console.error('Error parseando accesorios_seleccionados:', e);
                    accesorios = [];
                }
            } else if (Array.isArray(cotizacion.accesorios_seleccionados)) {
                accesorios = cotizacion.accesorios_seleccionados;
            }

            if (accesorios.length > 0) {
                console.log('Agregando accesorios:', accesorios);
                productos = [...productos, ...accesorios];
            }
        }

        if (productos.length > 0) {
            llenarTablaProductos(productos);
        } else {
            console.warn('No se encontraron productos en la cotización');
        }

        // Llenar fecha de contrato
        const fechaInicioInput = document.getElementById('contract-start-date');
        const fechaFinInput = document.getElementById('contract-end-date');

        if (fechaInicioInput) {
            fechaInicioInput.value = '';
        }
        if (fechaFinInput) {
            fechaFinInput.value = '';
        }

        if (cotizacion.fecha_inicio && fechaInicioInput) {
            fechaInicioInput.value = new Date(cotizacion.fecha_inicio).toISOString().split('T')[0];
        }

        if (cotizacion.fecha_fin && fechaFinInput) {
            fechaFinInput.value = new Date(cotizacion.fecha_fin).toISOString().split('T')[0];
        }

        // Usar valores DIRECTAMENTE de la cotización (base de datos)
        const subtotal = parseFloat(cotizacion.subtotal || 0);
        const impuesto = parseFloat(cotizacion.iva || 0);
        const descuento = parseFloat(cotizacion.descuento_monto || 0);
        const garantia = parseFloat(cotizacion.garantia_monto || 0);
        const total = parseFloat(cotizacion.total || 0);

        console.log('[llenarDatosDesdeQuote] Valores de BD:', {
            subtotal,
            impuesto,
            descuento,
            garantia,
            total
        });

        // Llenar totales en los inputs readonly
        setTimeout(() => {
            const readonlyInputs = document.querySelectorAll('input[readonly]');

            readonlyInputs.forEach((input) => {
                const label = input.closest('div')?.querySelector('label, .label, strong')?.textContent?.toLowerCase() || '';

                if (label.includes('subtotal') && !label.includes('descuento')) {
                    input.value = formatCurrency(subtotal);
                } else if (label.includes('impuesto') || label.includes('iva')) {
                    input.value = formatCurrency(impuesto);
                } else if (label.includes('descuento')) {
                    input.value = formatCurrency(descuento);
                } else if (label.includes('total') && !label.includes('subtotal')) {
                    input.value = formatCurrency(total);
                }
            });

            // Buscar campo de Importe Garantía (puede no ser readonly)
            const allInputs = Array.from(document.querySelectorAll('.guarantee-section input[type="text"]'));
            const garantiaInput = allInputs.find(input => {
                const container = input.closest('div') || input.parentElement;
                const labelText = container?.textContent?.toLowerCase() || '';
                return (labelText.includes('importe') && labelText.includes('garantía')) ||
                    (labelText.includes('importe') && labelText.includes('garantia'));
            });

            if (garantiaInput) {
                garantiaInput.value = formatCurrency(garantia);
                console.log(`  -> Asignado Importe Garantía: ${garantia}`);
            }
        }, 100);

        // Llenar datos de entrega/domicilio desde la cotización
        llenarDatosEntrega(cotizacion);

        // Guardar referencia de cotización
        contratoModal.cotizacionSeleccionada = cotizacion;
    } catch (error) {
        console.error('Error llenando datos:', error);
        showMessage('Error al procesar datos de cotización', 'error');
    }
}

/**
 * Llenar datos de entrega desde la cotización
 */
function llenarDatosEntrega(cotizacion) {
    try {
        console.log('Buscando datos de entrega en cotización...');

        // Primero intentar usar campos individuales de entrega
        let calle = cotizacion.entrega_calle ||
            cotizacion.domicilio_entrega_calle ||
            cotizacion.direccion_entrega_calle ||
            cotizacion.calle_entrega ||
            '';

        let noExterno = cotizacion.entrega_numero_ext ||
            cotizacion.domicilio_entrega_numero_ext ||
            cotizacion.numero_ext ||
            cotizacion.no_exterior ||
            '';

        let noInterno = cotizacion.entrega_numero_int ||
            cotizacion.domicilio_entrega_numero_int ||
            cotizacion.numero_int ||
            cotizacion.no_interior ||
            '';

        let colonia = cotizacion.entrega_colonia ||
            cotizacion.domicilio_entrega_colonia ||
            cotizacion.colonia_entrega ||
            cotizacion.colonia ||
            '';

        let cp = cotizacion.entrega_cp ||
            cotizacion.domicilio_entrega_cp ||
            cotizacion.codigo_postal_entrega ||
            cotizacion.cp ||
            '';

        let entreCalle = cotizacion.entrega_referencia ||
            cotizacion.domicilio_entrega_entre_calles ||
            cotizacion.entre_calles ||
            '';

        let pais = cotizacion.entrega_pais ||
            cotizacion.domicilio_entrega_pais ||
            cotizacion.pais_entrega ||
            cotizacion.pais ||
            'México';

        let estado = cotizacion.entrega_estado ||
            cotizacion.domicilio_entrega_estado ||
            cotizacion.estado_entrega ||
            cotizacion.estado ||
            '';

        let municipio = cotizacion.entrega_municipio ||
            cotizacion.domicilio_entrega_municipio ||
            cotizacion.municipio_entrega ||
            cotizacion.municipio ||
            cotizacion.localidad ||
            '';

        let notas = cotizacion.entrega_notas ||
            cotizacion.notas_entrega ||
            cotizacion.notas ||
            cotizacion.observaciones ||
            '';

        // Si no tiene campos individuales, intentar parsear direccion_entrega completa
        if (!calle && cotizacion.direccion_entrega) {
            console.log('Parseando dirección completa:', cotizacion.direccion_entrega);
            // Ejemplo: "RIO NAZAS, El Salado, Mexico, 56524"
            const partes = cotizacion.direccion_entrega.split(',').map(p => p.trim());

            if (partes.length >= 1) calle = partes[0];
            if (partes.length >= 2) colonia = partes[1];
            if (partes.length >= 3) estado = partes[2];
            if (partes.length >= 4) cp = partes[3];
        }

        // Autocompletar los campos de entrega
        const inputCalle = document.getElementById('calle');
        if (inputCalle && calle) {
            inputCalle.value = calle;
            console.log('Calle llenada:', calle);
        }

        const inputNoExt = document.getElementById('no-externo');
        if (inputNoExt && noExterno) {
            inputNoExt.value = noExterno;
            console.log('No. Externo llenado:', noExterno);
        }

        const inputNoInt = document.getElementById('no-interno');
        if (inputNoInt && noInterno) {
            inputNoInt.value = noInterno;
            console.log('No. Interno llenado:', noInterno);
        }

        const inputColonia = document.getElementById('colonia');
        if (inputColonia && colonia) {
            inputColonia.value = colonia;
            console.log('Colonia llenada:', colonia);
        }

        const inputCP = document.getElementById('cp');
        if (inputCP && cp) {
            inputCP.value = cp;
            console.log('C.P. llenado:', cp);
        }

        const inputEntreCalle = document.getElementById('entre-calles');
        if (inputEntreCalle && entreCalle) {
            inputEntreCalle.value = entreCalle;
            console.log('Entre calles llenado:', entreCalle);
        }

        const inputPais = document.getElementById('pais');
        if (inputPais && pais) {
            inputPais.value = pais;
            console.log('País llenado:', pais);
        }

        const inputEstado = document.getElementById('estado');
        if (inputEstado && estado) {
            inputEstado.value = estado;
            console.log('Estado llenado:', estado);
        }

        const inputMunicipio = document.getElementById('municipio');
        if (inputMunicipio && municipio) {
            inputMunicipio.value = municipio;
            console.log('Municipio llenado:', municipio);
        }

        const inputNotas = document.getElementById('delivery-notes');
        if (inputNotas && notas) {
            inputNotas.value = notas;
            console.log('Notas llenadas:', notas);
        }

        console.log('Datos de entrega procesados desde cotización');
    } catch (error) {
        console.error('Error llenando datos de entrega:', error);
    }
}

/**
 * Llenar tabla de productos desde cotización
 * Maneja tanto productos regulares como accesorios
 * Calcula garantía como: cantidad × precio_venta (o fallback 100x el precio de renta)
 * Estructura de columnas: Equipo | Cantidad | Precio Unitario | Días | Garantía | Subtotal
 */
async function llenarTablaProductos(productos) {
    const tbody = document.querySelector('.items-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    console.log('[llenarTablaProductos] Productos recibidos:', productos.length);

    // Calcular días por defecto (asumiendo 30 si no viene)
    const diasDefault = 30;

    for (const prod of productos) {
        const row = document.createElement('tr');

        // Extraer datos con nombres de campos alternativos (robustez ante diferentes formatos)
        const clave = (prod.clave ?? prod.codigo ?? prod.sku ?? prod.clave_producto ?? '') || '';
        const descripcion = prod.descripcion || prod.nombre || prod.articulo || '';
        const cantidad = prod.cantidad || prod.qty || 1;
        const precioRenta = parseFloat(prod.precio_unitario || prod.precio || prod.precio_unit || 0);

        // CALCULAR GARANTÍA: cantidad × precio de venta
        // El precio de venta debe venir del producto original, no del precio de renta
        let precioVenta = 0;

        // Intentar obtener precio de venta desde diferentes campos en orden de preferencia
        if (prod.precio_venta) {
            precioVenta = parseFloat(prod.precio_venta);
        } else if (prod.precio_unitario_venta) {
            precioVenta = parseFloat(prod.precio_unitario_venta);
        } else if (prod.garantia_unitaria) {
            // Si viene garantía unitaria, usarla directamente
            precioVenta = parseFloat(prod.garantia_unitaria);
        } else {
            // Fallback: usar precio de renta × factor (aproximación típica es 100-150x)
            precioVenta = precioRenta * 100;
        }

        const garantia = cantidad * precioVenta;
        const total = cantidad * precioRenta;

        console.log(`[Producto] Desc:${descripcion}, Cant:${cantidad}, PrecioRenta:${precioRenta}, PrecioVenta:${precioVenta}, Garantía:${garantia}, Total:${total}`);

        // Estructura: Equipo | Cantidad | Precio Unitario | Días | Garantía | Subtotal
        row.dataset.clave = clave;
        row.innerHTML = `
            <td>${descripcion}</td>
            <td>${cantidad}</td>
            <td>${formatCurrency(precioRenta)}</td>
            <td>${diasDefault}</td>
            <td>${formatCurrency(garantia)}</td>
            <td>${formatCurrency(total)}</td>
        `;
        tbody.appendChild(row);
    }

    console.log(`[llenarTablaProductos] Tabla llenada con ${productos.length} productos/accesorios`);
}

/**
 * Limpiar datos del formulario
 */
function limpiarDatosFormulario() {
    document.getElementById('contract-type').value = 'RENTA';
    document.getElementById('contract-invoice').value = 'SI';

    const startDateInput = document.getElementById('contract-start-date');
    if (startDateInput) startDateInput.value = '';
    const endDateInput = document.getElementById('contract-end-date');
    if (endDateInput) endDateInput.value = '';


    const tbody = document.querySelector('.items-table tbody');
    if (tbody) tbody.innerHTML = '';

    // Limpiar campos de totales (readonly)
    const readonlyInputs = document.querySelectorAll('input[readonly]');
    readonlyInputs.forEach(input => {
        input.value = '';
    });

    // Limpiar datos de entrega
    document.getElementById('calle').value = '';
    document.getElementById('no-externo').value = '';
    document.getElementById('no-interno').value = '';
    document.getElementById('colonia').value = '';
    document.getElementById('cp').value = '';
    document.getElementById('entre-calles').value = '';
    document.getElementById('pais').value = 'México';
    document.getElementById('estado').value = '';
    document.getElementById('municipio').value = '';
    document.getElementById('delivery-notes').value = '';
}

/**
 * Calcular y actualizar totales desde los datos de la tabla
 */
function calcularYActualizarTotales() {
    try {
        const tbody = document.querySelector('.items-table tbody');
        if (!tbody) return;

        const cot = contratoModal?.cotizacionSeleccionada || null;

        let subtotalRenta = 0;
        let importeGarantia = 0;

        // Si existe una cotización ligada, priorizar SIEMPRE los valores de BD
        if (cot) {
            subtotalRenta = parseFloat(cot.subtotal || 0);
            const impuestoCot = parseFloat(cot.iva || 0);
            const descuentoCot = parseFloat(cot.descuento_monto || cot.descuento || 0);
            const totalCot = parseFloat(cot.total || 0);
            const garantiaCot = parseFloat(cot.garantia_monto || 0);

            // Si garantía viene en la cotización, úsala como fuente de verdad
            if (!Number.isNaN(garantiaCot) && garantiaCot > 0) {
                importeGarantia = garantiaCot;
            }

            console.log('[calcularYActualizarTotales] Usando valores de cotización:', {
                subtotal: subtotalRenta,
                impuesto: impuestoCot,
                descuento: descuentoCot,
                garantia: importeGarantia,
                total: totalCot
            });

            // Actualizar campos readonly
            const readonlyInputs = document.querySelectorAll('input[readonly]');
            readonlyInputs.forEach((input) => {
                const label = input.closest('div')?.querySelector('label, .label, strong')?.textContent?.toLowerCase() || '';

                if (label.includes('subtotal') && !label.includes('descuento')) {
                    input.value = formatCurrency(subtotalRenta);
                } else if (label.includes('impuesto') || label.includes('iva')) {
                    input.value = formatCurrency(impuestoCot);
                } else if (label.includes('descuento')) {
                    input.value = formatCurrency(descuentoCot);
                } else if (label.includes('total') && !label.includes('subtotal')) {
                    input.value = formatCurrency(totalCot);
                }
            });

            // Campo de Importe Garantía (no-readonly)
            const allInputs = Array.from(document.querySelectorAll('.guarantee-section input[type="text"]'));
            const garantiaInput = allInputs.find(input => {
                const container = input.closest('div') || input.parentElement;
                const labelText = container?.textContent?.toLowerCase() || '';
                return (labelText.includes('importe') && labelText.includes('garantía')) ||
                    (labelText.includes('importe') && labelText.includes('garantia'));
            });

            if (garantiaInput) {
                garantiaInput.value = formatCurrency(importeGarantia);
            }

            return;
        }

        // Leer valores de la tabla
        tbody.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 6) {
                // Columna 5 = Garantía, Columna 6 = Total (renta)
                const garantia = parseFloat(cells[4].textContent.replace(/[^0-9.-]/g, '')) || 0;
                const totalRenta = parseFloat(cells[5].textContent.replace(/[^0-9.-]/g, '')) || 0;

                importeGarantia += garantia;
                subtotalRenta += totalRenta;
            }
        });

        // Calcular IVA (16% sobre subtotal de renta)
        const impuesto = subtotalRenta * 0.16;

        // Descuento (por ahora 0, se puede obtener de la cotización si existe)
        const descuento = 0;

        // Total final
        const total = subtotalRenta + impuesto - descuento;

        console.log('[calcularYActualizarTotales] Subtotal:', subtotalRenta, 'IVA:', impuesto, 'Garantía:', importeGarantia, 'Total:', total);

        // Actualizar campos readonly
        const readonlyInputs = document.querySelectorAll('input[readonly]');

        // Buscar e identificar cada campo por su posición o contenido cercano
        readonlyInputs.forEach((input, index) => {
            const label = input.closest('div')?.querySelector('label, .label, strong')?.textContent?.toLowerCase() || '';

            if (label.includes('subtotal') || index === 0) {
                input.value = formatCurrency(subtotalRenta);
            } else if (label.includes('impuesto') || label.includes('iva') || index === 1) {
                input.value = formatCurrency(impuesto);
            } else if (label.includes('garantía') || label.includes('garantia') || index === 2) {
                input.value = formatCurrency(importeGarantia);
            } else if (label.includes('total') && !label.includes('subtotal')) {
                input.value = formatCurrency(total);
            }
        });

        // Buscar campo de Importe Garantía (puede no ser readonly)
        const allInputs = Array.from(document.querySelectorAll('.guarantee-section input[type="text"]'));
        const garantiaInput = allInputs.find(input => {
            const container = input.closest('div') || input.parentElement;
            const labelText = container?.textContent?.toLowerCase() || '';
            return (labelText.includes('importe') && labelText.includes('garantía')) ||
                (labelText.includes('importe') && labelText.includes('garantia'));
        });

        if (garantiaInput) {
            garantiaInput.value = formatCurrency(importeGarantia);
            console.log(`  -> Asignado Importe Garantía (no-readonly): ${importeGarantia}`);
        }

        console.log('[calcularYActualizarTotales] Totales actualizados correctamente');
    } catch (error) {
        console.error('[calcularYActualizarTotales] Error:', error);
    }
}

/**
 * Formatear moneda
 */
function formatCurrency(value) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(value);
}

/**
 * Guardar nuevo contrato
 */
async function guardarContrato(event) {
    event.preventDefault();

    const numeroContrato = document.getElementById('contract-no').value?.trim();
    const valorCliente = document.getElementById('contract-client').value?.trim();
    const valorCotizacion = document.getElementById('contract-cotizacion').value?.trim();

    // Validar campos requeridos
    if (!numeroContrato) {
        showMessage('Debe ingresar número de contrato', 'error');
        return;
    }
    if (!valorCliente) {
        showMessage('Debe seleccionar un cliente', 'error');
        return;
    }
    if (!valorCotizacion) {
        showMessage('Debe seleccionar una cotización', 'error');
        return;
    }

    // Validar que el cliente existe
    if (!contratoModal.clienteSeleccionado) {
        showMessage('Cliente no encontrado. Selecciona un cliente válido', 'error');
        return;
    }

    // Validar que la cotización existe
    if (!contratoModal.cotizacionSeleccionada) {
        showMessage('Cotización no encontrada. Selecciona una cotización válida', 'error');
        return;
    }

    try {
        const cliente = contratoModal.clienteSeleccionado;
        const cotizacion = contratoModal.cotizacionSeleccionada;

        // Extraer items de la tabla
        // Estructura de columnas: Equipo | Cantidad | Precio Unitario | Días | Garantía | Subtotal
        const items = [];
        const tbody = document.querySelector('.items-table tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 6) {
                    items.push({
                        clave: row.dataset.clave || '',
                        descripcion: cells[0].textContent.trim(),
                        cantidad: parseInt(cells[1].textContent.trim()) || 1,
                        precio_unitario: parseFloat(cells[2].textContent.replace(/[^\d.-]/g, '')) || 0,
                        dias: parseInt(cells[3].textContent.trim()) || 30,
                        garantia: parseFloat(cells[4].textContent.replace(/[^\d.-]/g, '')) || 0,
                        total: parseFloat(cells[5].textContent.replace(/[^\d.-]/g, '')) || 0
                    });
                }
            });
        }

        // Extraer totales DIRECTAMENTE de la cotización
        const subtotal = parseFloat(cotizacion.subtotal || 0);
        const impuesto = parseFloat(cotizacion.iva || 0);
        const descuento = parseFloat(cotizacion.descuento_monto || cotizacion.descuento || 0);
        const total = parseFloat(cotizacion.total || 0);

        // Importe de garantía: si la cotización trae garantía (garantia_monto), usarla como fuente de verdad
        // (Evita desincronización entre UI/DB cuando la tabla calcula una garantía distinta)
        const garantiaDesdeCotizacion = parseFloat(cotizacion.garantia_monto || 0);
        let importeGarantia = 0;
        if (!Number.isNaN(garantiaDesdeCotizacion) && garantiaDesdeCotizacion > 0) {
            importeGarantia = garantiaDesdeCotizacion;
        } else {
            items.forEach(item => {
                importeGarantia += item.garantia;
            });
        }

        // Obtener fechas del formulario
        const fechaContrato = document.getElementById('contract-start-date').value || new Date().toISOString().split('T')[0];
        const fechaFin = document.getElementById('contract-end-date').value || '';

        const datosContrato = {
            numero_contrato: numeroContrato,
            id_cliente: cliente.id_cliente,
            id_cotizacion: cotizacion.id_cotizacion || cotizacion.id,
            tipo: document.getElementById('contract-type').value || 'RENTA',
            requiere_factura: document.getElementById('contract-invoice').value || 'SI',
            fecha_contrato: fechaContrato,
            fecha_inicio: fechaContrato,
            fecha_fin: fechaFin,
            responsable: cliente.nombre || '',
            estado: 'Activo',
            subtotal: subtotal,
            impuesto: impuesto,
            descuento: descuento,
            total: total,
            monto: total,
            tipo_garantia: 'PAGARE',
            importe_garantia: importeGarantia,
            monto_garantia: importeGarantia,
            calle: document.getElementById('calle').value || '',
            numero_externo: document.getElementById('no-externo').value || '',
            numero_interno: document.getElementById('no-interno').value || '',
            colonia: document.getElementById('colonia').value || '',
            codigo_postal: document.getElementById('cp').value || '',
            entre_calles: document.getElementById('entre-calles').value || '',
            pais: document.getElementById('pais').value || 'México',
            estado_entidad: document.getElementById('estado').value || 'México',
            municipio: document.getElementById('municipio').value || '',
            notas_domicilio: (document.getElementById('delivery-notes').value || '') +
                `\nPeriodo: ${fechaContrato} al ${fechaFin}`,
            contacto_obra: document.getElementById('contacto-obra')?.value || '',
            telefono_obra: document.getElementById('telefono-obra')?.value || '',
            celular_obra: document.getElementById('celular-obra')?.value || '',
            usuario_creacion: JSON.parse(localStorage.getItem('user') || '{}').nombre || 'Sistema',
            items: items
        };

        console.log('Datos a enviar:', datosContrato);

        const response = await fetch(CONTRATOS_URL, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(datosContrato)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Error al crear contrato');
        }

        const contrato = await response.json();
        const idContrato = contrato.contrato.id_contrato;

        showMessage('Contrato guardado. Generando PDFs...', 'success');

        // Generar y guardar PDFs
        await guardarPdfs(idContrato);

        showMessage('Contrato y PDFs guardados exitosamente', 'success');

        // Cerrar modal y recargar tabla
        document.getElementById('new-contract-modal').style.display = 'none';
        setTimeout(() => location.reload(), 1500);

    } catch (error) {
        console.error('Error guardando contrato:', error);
        showMessage(error.message || 'Error al guardar contrato', 'error');
    }
}

/**
 * Inicializar event listeners del modal
 */
function inicializarModalEventos() {
    const inputCliente = document.getElementById('contract-client');
    const inputCotizacion = document.getElementById('contract-cotizacion');
    const formContrato = document.getElementById('new-contract-form');

    // Evento cuando se escribe o selecciona cliente
    if (inputCliente) {
        inputCliente.addEventListener('change', function () {
            procesarCambioCliente(this.value);
        });

        inputCliente.addEventListener('blur', function () {
            // Al perder foco, buscar el cliente si no está exactamente
            procesarCambioCliente(this.value);
        });

        inputCliente.addEventListener('input', function () {
            // Búsqueda en tiempo real
            const valor = this.value.trim();

            if (!valor) {
                contratoModal.clienteSeleccionado = null;
                crearDatalistCotizaciones([]);
                contratoModal.cotizaciones = [];
                limpiarDatosFormulario();
                return;
            }

            // Si el valor viene en formato "ID - NOMBRE", extraer solo el ID
            let idBuscado = valor;
            if (valor.includes(' - ')) {
                idBuscado = valor.split(' - ')[0].trim();
            }

            // Buscar coincidencias mientras escribe
            let cliente = null;

            // Primero intenta coincidencia exacta de ID
            cliente = contratoModal.clientes.find(c =>
                String(c.id_cliente) === String(idBuscado)
            );

            // Si no encuentra por ID exacto, busca por nombre
            if (!cliente) {
                cliente = contratoModal.clientes.find(c =>
                    c.nombre.toLowerCase().includes(valor.toLowerCase())
                );
            }

            // Si no encuentra por nombre, busca si el valor está contenido en el ID
            if (!cliente) {
                cliente = contratoModal.clientes.find(c =>
                    String(c.id_cliente).includes(idBuscado)
                );
            }

            if (cliente) {
                contratoModal.clienteSeleccionado = cliente;
                cargarCotizacionesDelCliente(cliente.id_cliente);
            }
        });

        inputCliente.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault(); // Evitar el envío del formulario al presionar Enter
                procesarCambioCliente(this.value); // Procesa la búsqueda inmediatamente
            }
        });
    }

    // Evento cuando se escribe o selecciona cotización
    if (inputCotizacion) {
        inputCotizacion.addEventListener('change', function () {
            procesarCambioCotizacion(this.value);
        });

        inputCotizacion.addEventListener('blur', function () {
            procesarCambioCotizacion(this.value);
        });

        inputCotizacion.addEventListener('input', function () {
            // Búsqueda en tiempo real
            const valor = this.value.trim();

            if (!valor) {
                contratoModal.cotizacionSeleccionada = null;
                limpiarDatosFormulario();
                return;
            }

            // Buscar cotización mientras escribe (solo en las del cliente actual)
            let cotizacion = null;
            cotizacion = contratoModal.cotizaciones.find(c => {
                const folio = c.numero_folio || c.id;
                return String(folio).toLowerCase().includes(valor.toLowerCase()) ||
                    folio == valor ||
                    valor.includes(String(folio).split('-')[1]); // Buscar parte del folio
            });

            if (cotizacion) {
                contratoModal.cotizacionSeleccionada = cotizacion;
                llenarDatosDesdeQuote(cotizacion);
            }
        });

        inputCotizacion.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault(); // Evitar el envío del formulario al presionar Enter
                procesarCambioCotizacion(this.value); // Procesa la búsqueda inmediatamente
            }
        });
    }

    // Evento para guardar contrato
    const saveContractBtn = document.querySelector('button[form="new-contract-form"]');
    if (saveContractBtn) {
        saveContractBtn.addEventListener('click', guardarContrato);
    }
}

/**
 * Procesar cambio de cliente
 */
function procesarCambioCliente(valor) {
    const valorTrim = valor.trim();

    if (!valorTrim) {
        contratoModal.clienteSeleccionado = null;
        crearDatalistCotizaciones([]);
        contratoModal.cotizaciones = [];
        limpiarDatosFormulario();
        return;
    }

    // Si el valor viene en formato "ID - NOMBRE" (del datalist), extraer solo el ID
    let idBuscado = valorTrim;
    if (valorTrim.includes(' - ')) {
        idBuscado = valorTrim.split(' - ')[0].trim();
    }

    // Buscar cliente: primero por ID exacto, luego por nombre, luego por ID parcial
    let cliente = null;

    // 1. Buscar por ID exacto
    cliente = contratoModal.clientes.find(c =>
        String(c.id_cliente) === String(idBuscado)
    );

    // 2. Si no encuentra, buscar por nombre (en caso de que escriba nombre directamente)
    if (!cliente) {
        cliente = contratoModal.clientes.find(c =>
            c.nombre.toLowerCase().includes(valorTrim.toLowerCase())
        );
    }

    // 3. Si no encuentra, buscar por ID parcial
    if (!cliente) {
        cliente = contratoModal.clientes.find(c =>
            String(c.id_cliente).includes(idBuscado)
        );
    }

    if (cliente) {
        contratoModal.clienteSeleccionado = cliente;
        // Cargar SOLO cotizaciones de este cliente
        cargarCotizacionesDelCliente(cliente.id_cliente);
    } else {
        contratoModal.clienteSeleccionado = null;
        contratoModal.cotizaciones = [];
        crearDatalistCotizaciones([]);
        limpiarDatosFormulario();
    }
}

/**
 * Procesar cambio de cotización
 * Busca primero en el array local, y si no encuentra, busca en la API
 */
function procesarCambioCotizacion(valor) {
    const valorTrim = valor.trim();

    if (!valorTrim) {
        contratoModal.cotizacionSeleccionada = null;
        limpiarDatosFormulario();
        return;
    }

    // Si viene en formato "FOLIO - TIPO - $TOTAL", extraer el folio
    let folioBuscado = valorTrim;
    if (valorTrim.includes(' - ')) {
        folioBuscado = valorTrim.split(' - ')[0].trim();
    }

    // Normalizar folio: remover prefijo REN- si existe para la búsqueda interna
    const folioNormalizado = folioBuscado.replace(/^REN-/i, '').toLowerCase();

    // Filtrar solo cotizaciones de RENTA del cliente actual
    const cotizacionesRenta = contratoModal.cotizaciones.filter(c =>
        c.tipo && String(c.tipo).toUpperCase() === 'RENTA'
    );

    // Buscar solo en cotizaciones de renta del cliente
    let cotizacion = cotizacionesRenta.find(c => {
        const folio = c.numero_folio || c.id_cotizacion || c.id || '';
        const folioStr = String(folio).toLowerCase();
        const folioSinPrefijo = folioStr.replace(/^ren-/i, '');

        // Comparar de múltiples formas para máxima flexibilidad
        return folioStr === folioNormalizado ||
            folioSinPrefijo === folioNormalizado ||
            folioStr.includes(folioNormalizado) ||
            String(c.id_cotizacion) === String(folioBuscado) ||
            String(c.id) === String(folioBuscado);
    });

    if (cotizacion) {
        contratoModal.cotizacionSeleccionada = cotizacion;
        llenarDatosDesdeQuote(cotizacion);
    } else {
        // Si no encuentra en el array local, buscar en la API sin depender del cliente
        buscarCotizacionPorFolio(folioBuscado);
    }
}

/**
 * Buscar cotización en la API por folio
 * No depende del cliente seleccionado
 */
async function buscarCotizacionPorFolio(folio) {
    Swal.fire({
        title: 'Buscando cotización...',
        text: 'Por favor, espera mientras buscamos la cotización.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    try {
        // Buscar todas las cotizaciones que contengan el folio
        const response = await fetch(`${COTIZACIONES_URL}?search=${encodeURIComponent(folio)}`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al buscar la cotización',
                confirmButtonColor: '#1e40af'
            });
            contratoModal.cotizacionSeleccionada = null;
            limpiarDatosFormulario();
            return;
        }

        const cotizaciones = await response.json();

        // Filtrar solo RENTA
        const cotizacionesRenta = Array.isArray(cotizaciones)
            ? cotizaciones.filter(c => c.tipo && String(c.tipo).toUpperCase() === 'RENTA')
            : [];

        // Buscar coincidencia exacta o parcial del folio
        const folioLower = folio.toLowerCase().replace(/^REN-/i, '');
        let cotizacionEncontrada = null;

        for (const cot of cotizacionesRenta) {
            const cotFolio = (cot.numero_folio || cot.id_cotizacion || cot.id || '').toString().toLowerCase();
            const cotFolioSinPrefijo = cotFolio.replace(/^ren-/i, '');

            if (cotFolio === folio.toLowerCase() || cotFolioSinPrefijo === folioLower || cotFolio.includes(folioLower)) {
                cotizacionEncontrada = cot;
                break;
            }
        }

        if (cotizacionEncontrada) {
            Swal.close(); // Cerrar la alerta de 'buscando'
            contratoModal.cotizacionSeleccionada = cotizacionEncontrada;

            let nombreCliente = 'Cliente desconocido';

            // Si también encontramos el cliente, seleccionarlo
            if (cotizacionEncontrada.id_cliente) {
                const clienteEncontrado = contratoModal.clientes.find(c =>
                    String(c.id_cliente) === String(cotizacionEncontrada.id_cliente)
                );

                if (clienteEncontrado) {
                    contratoModal.clienteSeleccionado = clienteEncontrado;
                    nombreCliente = clienteEncontrado.nombre || 'Cliente desconocido';
                    const inputCliente = document.getElementById('contract-client');
                    if (inputCliente) {
                        inputCliente.value = `${clienteEncontrado.id_cliente} - ${clienteEncontrado.nombre}`;
                    }
                }
            }

            llenarDatosDesdeQuote(cotizacionEncontrada);

            // Mostrar alerta de éxito con SweetAlert
            Swal.fire({
                icon: 'success',
                title: '¡Cotización Encontrada!',
                html: `<p style="font-size: 16px;"><strong>Folio:</strong> ${folio}</p><p style="font-size: 16px;"><strong>Cliente:</strong> ${nombreCliente}</p>`,
                confirmButtonColor: '#10b981'
            });
        } else {
            Swal.close(); // Cerrar la alerta de 'buscando'
            contratoModal.cotizacionSeleccionada = null;
            limpiarDatosFormulario();

            // Mostrar alerta de no encontrada
            Swal.fire({
                icon: 'warning',
                title: 'Cotización No Encontrada',
                text: `No se encontró una cotización de RENTA con el folio "${folio}"`,
                confirmButtonColor: '#f59e0b'
            });
        }
    } catch (error) {
        Swal.close(); // Asegurarse de cerrar la alerta en caso de error
        console.error('Error buscando cotización por folio:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al buscar la cotización. Intenta de nuevo.',
            confirmButtonColor: '#1e40af'
        });
        contratoModal.cotizacionSeleccionada = null;
        limpiarDatosFormulario();
    }
}

/**
 * Inicializar el modal cuando se abre
 */
function inicializarModal() {
    const modal = document.getElementById('new-contract-modal');
    const btnNuevoContrato = document.querySelector('.btn-primary');

    // Manejador para cerrar modal
    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-contract-btn');

    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            modal.style.display = 'none';
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            modal.style.display = 'none';
        });
    }

    // Cerrar modal al hacer clic fuera
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Manejador para navegación entre pestañas
    const navLinks = document.querySelectorAll('.modal-nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            // Remover clase active de todos los links
            navLinks.forEach(l => l.classList.remove('active'));

            // Agregar clase active al link clickeado
            this.classList.add('active');

            // Ocultar todas las vistas
            const views = document.querySelectorAll('.modal-view');
            views.forEach(v => {
                v.classList.remove('active');
                v.classList.remove('active-view');
                v.style.display = ''; // Clear inline style
            });

            // Mostrar la vista seleccionada
            const targetId = this.getAttribute('data-target');
            console.log('Cambiando a pestaña:', targetId);
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.classList.add('active');
                targetView.classList.add('active-view');

                // Si es la vista previa, generar el PDF
                if (targetId === 'preview-view' && typeof abrirVistaPreviaPDF === 'function') {
                    console.log('Generando vista previa de PDF...');
                    abrirVistaPreviaPDF();
                } else if (targetId === 'nota-view' && typeof abrirVistaPreviaNota === 'function') {
                    // Si existe lógica para nota
                    abrirVistaPreviaNota();
                }
            } else {
                console.error('No se encontró la vista:', targetId);
            }

        });
    });

    if (btnNuevoContrato) {
        btnNuevoContrato.addEventListener('click', async function () {
            // Resetear número de contrato automático
            const nuevoNumero = await generarNumeroContrato();
            document.getElementById('contract-no').value = nuevoNumero;

            // Generar número de nota automático
            const nuevoNota = generarNumeroNota();
            document.getElementById('contract-no-nota').value = nuevoNota;

            // Limpiar selecciones previas
            document.getElementById('contract-client').value = '';
            document.getElementById('contract-cotizacion').value = '';
            limpiarDatosFormulario();

            // Cargar clientes si no están cargados
            if (contratoModal.clientes.length === 0) {
                cargarClientesModal();
            }

            // Mostrar la primera pestaña
            navLinks.forEach(l => l.classList.remove('active'));
            navLinks[0].classList.add('active');

            const views = document.querySelectorAll('.modal-view');
            views.forEach(v => v.classList.remove('active'));
            views[0].classList.add('active');

            modal.style.display = 'flex';
        });
    }
}

/**
 * Generar número de contrato automático consultando la BD
 * Formato: CT-YYYY-MM-NNNN (donde NNNN es consecutivo del mes)
 */
async function generarNumeroContrato() {
    try {
        const hoy = new Date();
        const año = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, '0');
        const mesAnio = `${año}-${mes}`;

        // Consultar la BD para obtener el siguiente número consecutivo
        const response = await fetch(`${CONTRATOS_URL}/siguiente-numero?mes=${mesAnio}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Error al obtener siguiente número de contrato');
        }

        const data = await response.json();
        const numeroConsecutivo = String(data.siguiente || 1).padStart(4, '0');

        return `CT-${año}-${mes}-${numeroConsecutivo}`;
    } catch (error) {
        console.error('Error generando número de contrato:', error);
        // Fallback: generar con número aleatorio
        const hoy = new Date();
        const año = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, '0');
        const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        return `CT-${año}-${mes}-${random}`;
    }
}

/**
 * Generar número de nota automático
 * Formato: YYYY-MM
 */
function generarNumeroNota() {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    return `${año}-${mes}`;
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function () {
    inicializarModal();
    cargarClientesModal(); // Cargar clientes siempre al iniciar
    inicializarModalEventos();

    // Escuchar cambios en los campos del formulario para actualizar vista previa
    const formInputs = document.querySelectorAll('#new-contract-form input, #new-contract-form select');
    formInputs.forEach(input => {
        input.addEventListener('change', actualizarVistaPrevia);
    });
});

/**
 * Actualizar vista previa del PDF con datos actuales
 */
function actualizarVistaPrevia() {
    const cliente = contratoModal.clienteSeleccionado;
    const cotizacion = contratoModal.cotizacionSeleccionada;

    if (!cliente || !cotizacion) return;

    try {
        // Esta función actualiza los datos del PDF preview si es necesario
        // Por ahora solo registramos que se llamó
        console.log('Vista previa actualizada para cliente:', cliente.nombre);
    } catch (error) {
        console.error('Error actualizando vista previa:', error);
    }
}

/**
 * Llenar campos de equipos específicos en el PDF
 */
function llenarEquiposPDF(productos) {
    const mapeoProductos = {
        'marcos': { selector: 'Marcos', cantidad: 0, monto: 0 },
        'crucetas': { selector: 'Crucetas', cantidad: 0, monto: 0 },
        'plataforma': { selector: 'Plataforma', cantidad: 0, monto: 0 },
        'bases': { selector: 'Bases', cantidad: 0, monto: 0 },
        'ruedas': { selector: 'Ruedas', cantidad: 0, monto: 0 },
        'coples': { selector: 'Coples', cantidad: 0, monto: 0 },
        'diagonal': { selector: 'S. Diagonal', cantidad: 0, monto: 0 },
        'barandal': { selector: 'Barandal', cantidad: 0, monto: 0 }
    };

    // Procesar productos y mapearlos
    productos.forEach(prod => {
        const nombre = (prod.descripcion || prod.nombre || '').toLowerCase();

        Object.keys(mapeoProductos).forEach(key => {
            if (nombre.includes(key)) {
                mapeoProductos[key].cantidad += prod.cantidad || 0;
                mapeoProductos[key].monto += (prod.cantidad || 0) * (prod.precio_unitario || 0);
            }
        });
    });

    // Asignar valores a los campos en el PDF
    const pdfContent = document.querySelector('.contract-page');
    if (pdfContent) {
        Object.values(mapeoProductos).forEach(item => {
            // Buscar y llenar cantidad
            const labelCant = pdfContent.textContent.includes(item.selector) ?
                pdfContent.querySelector(`[placeholder="Cant."]`) : null;

            if (labelCant) {
                labelCant.value = item.cantidad;
            }

            // Buscar y llenar monto
            const labelMonto = pdfContent.querySelector(`[placeholder="$ Monto"]`);
            if (labelMonto) {
                labelMonto.value = formatCurrency(item.monto);
            }
        });
    }
}

/**
 * Abrir vista previa del PDF con datos auto-completados
 */
async function abrirVistaPreviaPDF() {
    try {
        const cotizacion = contratoModal.cotizacionSeleccionada;

        if (!cotizacion) {
            showMessage('Selecciona una cotización primero', 'warning');
            return;
        }

        const inputCliente = document.getElementById('contract-client');
        // Limpiar el nombre para quitar el ID (ej: "531 - OMAR..." -> "OMAR...")
        const nombreLimpio = (inputCliente?.value || cotizacion.contacto_nombre || '').replace(/^\d+\s*-\s*/, '');

        // Obtener domicilio fiscal del cliente desde BD
        let domicilioCliente = '';
        const cliente = contratoModal.clienteSeleccionado;
        if (cliente && cliente.id_cliente) {
            try {
                const response = await fetch(`${API_URL}/clientes/${cliente.id_cliente}`, {
                    headers: getAuthHeaders()
                });
                if (response.ok) {
                    const clienteDB = await response.json();
                    if (clienteDB.direccion || clienteDB.colonia || clienteDB.municipio) {
                        const partes = [
                            clienteDB.direccion || '',
                            clienteDB.numero_externo || '',
                            clienteDB.numero_interno ? `Int. ${clienteDB.numero_interno}` : '',
                            clienteDB.colonia || '',
                            clienteDB.municipio || '',
                            clienteDB.estado_entidad || '',
                            clienteDB.codigo_postal ? `CP ${clienteDB.codigo_postal}` : ''
                        ].filter(p => p.trim());
                        domicilioCliente = partes.join(', ');
                    }
                }
            } catch (error) {
                console.error('Error obteniendo datos del cliente:', error);
            }
        }

        // Construir domicilio de obra desde campos del formulario
        const calle = document.getElementById('calle')?.value || '';
        const noExt = document.getElementById('no-externo')?.value || '';
        const noInt = document.getElementById('no-interno')?.value || '';
        const colonia = document.getElementById('colonia')?.value || '';
        const municipio = document.getElementById('municipio')?.value || '';
        const estado = document.getElementById('estado')?.value || '';
        const cp = document.getElementById('cp')?.value || '';

        console.log('[DEBUG] Valores de campos del formulario:', { calle, noExt, noInt, colonia, municipio, estado, cp });

        let domicilioObra = '';
        if (calle) {
            const partesObra = [
                calle,
                noExt,
                noInt ? `Int. ${noInt}` : '',
                colonia,
                municipio,
                estado,
                cp ? `CP ${cp}` : ''
            ].filter(p => p.trim());
            domicilioObra = partesObra.join(', ');
        }

        const datosPDF = {
            // Datos del arrendatario - Priorizar input manual
            nombreArrendatario: nombreLimpio,
            representado: '',
            domicilioArrendatario: domicilioCliente || domicilioObra,

            // Datos de la obra
            domicilioObra: domicilioObra,

            // AGREGAR ESTOS 3 CAMPOS:
            numeroContrato: document.getElementById('contract-no')?.value || cotizacion.numero_cotizacion || '',
            fechaInicio: (() => {
                const fechaInput = document.getElementById('contract-start-date')?.value;
                return fechaInput ? new Date(fechaInput).toLocaleDateString('es-MX') : '';
            })(),
            // Productos - extraer cantidades de la tabla
            productos: [],
            cantidadTotal: 0,

            // Fechas y montos
            diasRenta: cotizacion.dias_periodo || 0,
            fechaFin: (() => {
                const fechaInput = document.getElementById('contract-end-date')?.value;
                return fechaInput ? new Date(fechaInput).toLocaleDateString('es-MX') : '';
            })(),
            montoRenta: (() => {
                const totalInput = document.querySelector('.total-final input');
                return totalInput ? parseFloat(totalInput.value.replace(/[^0-9.-]/g, '')) : parseFloat(cotizacion.subtotal || 0);
            })(),
            montoGarantia: (() => {
                const garantiaInput = document.getElementById('contract-guarantee-amount');
                return garantiaInput ? parseFloat(garantiaInput.value.replace(/[^0-9.-]/g, '')) : parseFloat(cotizacion.garantia_monto || 0);
            })(),
            // Fecha de firma (hoy)
            fechaFirma: new Date().toLocaleDateString('es-MX', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            })
        };

        // Extraer productos de la tabla del modal (asegurar el scope)
        // Estructura de tabla: Equipo | Cantidad | Precio Unitario | Días | Garantía | Subtotal
        const modal = document.getElementById('new-contract-modal');
        const tbody = modal ? modal.querySelector('.items-table tbody') : document.querySelector('.items-table tbody');

        if (tbody) {
            tbody.querySelectorAll('tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 6) {
                    const descripcion = cells[0].textContent.trim();
                    const cantidad = parseInt(cells[1].textContent) || 0;
                    const precio = parseFloat(cells[2].textContent.replace(/[^0-9.-]/g, '')) || 0;
                    const garantia = parseFloat(cells[4].textContent.replace(/[^0-9.-]/g, '')) || 0;

                    datosPDF.productos.push({
                        descripcion,
                        cantidad,
                        precio,
                        precioVenta: garantia / cantidad // Precio de reposición
                    });

                    datosPDF.cantidadTotal += cantidad;
                }
            });
        }

        // Alias 'items' para compatibilidad si es necesario
        datosPDF.items = datosPDF.productos;

        // Guardar en sessionStorage
        console.log('[NUEVO CONTRATO] Datos a enviar al PDF:', datosPDF);
        console.log('[NUEVO CONTRATO] domicilioArrendatario:', datosPDF.domicilioArrendatario);
        console.log('[NUEVO CONTRATO] domicilioObra:', datosPDF.domicilioObra);
        sessionStorage.setItem('datosPDFContrato', JSON.stringify(datosPDF));

        // Abrir PDF en nueva ventana
        window.open('pdf_contrato.html', '_blank');

    } catch (error) {
        console.error('Error al abrir vista previa:', error);
        showMessage('Error al abrir vista previa del PDF', 'error');
    }
}

/**
 * Abrir vista previa de la Nota con datos auto-completados
 */
function abrirVistaPreviaNota() {
    try {
        const cotizacion = contratoModal.cotizacionSeleccionada;

        if (!cotizacion) {
            showMessage('Selecciona una cotización primero', 'warning');
            return;
        }

        // Preparar datos para la Nota (Priorizando inputs manuales)
        const clienteActual = contratoModal.clienteSeleccionado || {};
        const inputCliente = document.getElementById('contract-client');

        // Limpiar nombre removemos ID "123 - "
        const rawName = inputCliente?.value || cotizacion.contacto_nombre || clienteActual.nombre || '';
        const cleanName = rawName.replace(/^\d+\s*-\s*/, '');

        const datosNota = {
            numeroNota: document.getElementById('contract-no-nota')?.value || '',
            numeroContrato: document.getElementById('contract-no')?.value || '',
            nombreCliente: cleanName,
            direccion: document.getElementById('delivery-notes')?.value || cotizacion.direccion_entrega || clienteActual.direccion || '',
            // Objeto cliente completo para FACTURAR A
            cliente: {
                nombre: cleanName,
                rfc: clienteActual.rfc || '',
                direccion: clienteActual.direccion || '',
                numero_externo: clienteActual.numero_externo || '',
                colonia: clienteActual.colonia || '',
                telefono: clienteActual.telefono || '',
                email: clienteActual.email || ''
            },
            fechaEmision: new Date().toISOString(),
            tipo: cotizacion.tipo || 'RENTA',
            agente: (
                cotizacion.vendedor_nombre ||
                cotizacion.vendedor?.nombre ||
                cotizacion.agente ||
                cotizacion.responsable ||
                (function () { try { return JSON.parse(localStorage.getItem('user') || '{}').nombre || ''; } catch (_) { return ''; } })() ||
                'Equipo de Ventas'
            ),
            // Agregar datos completos de envío desde el formulario
            envio: {
                direccion: document.getElementById('calle')?.value || '',
                calle: document.getElementById('calle')?.value || '',
                numero: document.getElementById('no-externo')?.value || '',
                no_externo: document.getElementById('no-externo')?.value || '',
                noExterno: document.getElementById('no-externo')?.value || '',
                no_interno: document.getElementById('no-interno')?.value || '',
                colonia: document.getElementById('colonia')?.value || '',
                cp: document.getElementById('cp')?.value || '',
                entre_calles: document.getElementById('entre-calles')?.value || '',
                pais: document.getElementById('pais')?.value || '',
                estado: document.getElementById('estado')?.value || '',
                municipio: document.getElementById('municipio')?.value || '',
                ciudad: document.getElementById('municipio')?.value || '',
                contacto: document.getElementById('contacto-obra')?.value || '',
                nombre: document.getElementById('contacto-obra')?.value || '',
                telefono: document.getElementById('telefono-obra')?.value || '',
                celular: document.getElementById('celular-obra')?.value || '',
                referencia: document.getElementById('delivery-notes')?.value || '',
                metodo: 'delivery' // Por defecto entrega a domicilio
            },
            productos: [],
            subtotal: parseFloat(cotizacion.subtotal || 0),
            iva: parseFloat(cotizacion.iva || 0),
            total: parseFloat(cotizacion.total || 0)
        };

        // Extraer productos de la tabla
        // Estructura de tabla: Equipo | Cantidad | Precio Unitario | Días | Garantía | Subtotal
        const tbody = document.querySelector('.items-table tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 6) {
                    datosNota.productos.push({
                        cantidad: parseInt(cells[1].textContent) || 0,
                        descripcion: cells[0].textContent.trim(),
                        total: parseFloat(cells[5].textContent.replace(/[^0-9.-]/g, '')) || 0
                    });
                }
            });
        }

        // Debug: mostrar datos completos que se van a enviar
        console.log('[CONTRATOS] Datos completos de la nota que se enviarán:', datosNota);
        console.log('[CONTRATOS] Objeto envío:', datosNota.envio);

        // Guardar en storage (session + local) para handoff dentro de iframe
        const datosNotaStr = JSON.stringify(datosNota);
        try { sessionStorage.setItem('datosNotaContrato', datosNotaStr); } catch (_) { }
        try { localStorage.setItem('datosNotaContrato', datosNotaStr); } catch (_) { }

        // Mostrar Nota en el iframe de la modal (y fallback a nueva pestaña si no existe)
        const urlNota = `hoja_pedido2.html?ts=${Date.now()}`;
        const iframeNota = document.getElementById('note-preview-iframe');
        if (iframeNota) {
            iframeNota.src = urlNota;
        } else {
            window.open(urlNota, '_blank');
        }

        // Envío inicial al iframe cuando cargue (por si requiere hydratar antes del storage)
        setTimeout(() => {
            try {
                const frame = document.getElementById('note-preview-iframe');
                if (frame && frame.contentWindow) {
                    frame.contentWindow.postMessage({ type: 'HP_NOTA', datos: datosNota }, '*');
                }
            } catch (_) { }
        }, 500);

        // Activar sincronización en vivo una sola vez
        try { setupLiveNotaSync(); } catch (_) { }

    } catch (error) {
        console.error('Error al abrir vista previa de nota:', error);
        showMessage('Error al abrir vista previa de la nota', 'error');
    }
}

// --- Sincronización en vivo de Nota (dispatcher con debounce) ---
// notaLiveBound se elimina o se reinicia para permitir re-binding si el DOM cambia
function setupLiveNotaSync() {
    // Eliminamos el return temprano basado en variable global para soportar reapertura del modal
    // notaLiveBound = true;

    const debounce = (fn, ms = 300) => {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    };

    const recogerDatosNota = () => {
        const cot = contratoModal.cotizacionSeleccionada || {};
        const clienteActual = contratoModal.clienteSeleccionado || {};
        const inputCliente = document.getElementById('contract-client');
        console.log('[recogerDatosNota] Input Cliente:', inputCliente, 'Valor:', inputCliente?.value);
        console.log('[recogerDatosNota] Fallback Cliente:', clienteActual.nombre);

        // Limpiar nombre
        const rawName = inputCliente?.value || cot.contacto_nombre || clienteActual.nombre || '';
        const cleanName = rawName.replace(/^\d+\s*-\s*/, '');

        const datos = {
            numeroNota: document.getElementById('contract-no-nota')?.value || '',
            numeroContrato: document.getElementById('contract-no')?.value || '',
            nombreCliente: cleanName,
            direccion: document.getElementById('delivery-notes')?.value || cot.direccion_entrega || clienteActual.direccion || '',
            // Objeto cliente completo para FACTURAR A
            cliente: {
                nombre: cleanName,
                rfc: clienteActual.rfc || '',
                direccion: clienteActual.direccion || '',
                numero_externo: clienteActual.numero_externo || '',
                colonia: clienteActual.colonia || '',
                telefono: clienteActual.telefono || '',
                email: clienteActual.email || ''
            },
            fechaEmision: new Date().toISOString(),
            tipo: document.getElementById('contract-type')?.value || cot.tipo || 'RENTA',
            agente: (
                document.getElementById('contract-agent')?.value ||
                cot.vendedor_nombre || cot.vendedor?.nombre || cot.agente || cot.responsable ||
                (function () { try { return JSON.parse(localStorage.getItem('user') || '{}').nombre || ''; } catch (_) { return ''; } })() ||
                'Equipo de Ventas'
            ),
            // Agregar datos completos de envío desde el formulario
            envio: {
                direccion: document.getElementById('calle')?.value || '',
                calle: document.getElementById('calle')?.value || '',
                numero: document.getElementById('no-externo')?.value || '',
                no_externo: document.getElementById('no-externo')?.value || '',
                noExterno: document.getElementById('no-externo')?.value || '',
                no_interno: document.getElementById('no-interno')?.value || '',
                colonia: document.getElementById('colonia')?.value || '',
                cp: document.getElementById('cp')?.value || '',
                entre_calles: document.getElementById('entre-calles')?.value || '',
                pais: document.getElementById('pais')?.value || '',
                estado: document.getElementById('estado')?.value || '',
                municipio: document.getElementById('municipio')?.value || '',
                ciudad: document.getElementById('municipio')?.value || '',
                contacto: document.getElementById('contacto-obra')?.value || cot.contacto_nombre || '',
                nombre: document.getElementById('contacto-obra')?.value || cot.contacto_nombre || '',
                telefono: document.getElementById('telefono-obra')?.value || '',
                celular: document.getElementById('celular-obra')?.value || '',
                referencia: document.getElementById('delivery-notes')?.value || '',
                metodo: document.getElementById('metodo-entrega')?.value || 'domicilio',
                sucursal: document.getElementById('sucursal-entrega')?.value || '',
                sucursal_direccion: (function () {
                    const sel = document.getElementById('sucursal-entrega');
                    const dir = sel?.options[sel.selectedIndex]?.dataset?.direccion || '';
                    console.log('[recogerDatosNota] Sucursal seleccionada:', sel?.value, 'Dirección dataset:', dir);
                    return dir;
                })(),
                sucursal_nombre: (function () {
                    const sel = document.getElementById('sucursal-entrega');
                    return sel?.options[sel.selectedIndex]?.text || '';
                })()
            },
            productos: [],
            subtotal: parseFloat(cot.subtotal || 0),
            iva: parseFloat(cot.iva || 0),
            total: parseFloat(cot.total || 0)
        };

        // Extraer productos actuales de la tabla
        const tbody = document.querySelector('.items-table tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 6) {
                    datos.productos.push({
                        cantidad: parseInt(cells[1].textContent) || 0,
                        descripcion: cells[0].textContent.trim(),
                        total: parseFloat(cells[5].textContent.replace(/[^0-9.-]/g, '')) || 0
                    });
                }
            });
        }
        return datos;
    };

    const enviarHPNota = () => {
        try {
            const datos = recogerDatosNota();
            const s = JSON.stringify(datos);
            try { sessionStorage.setItem('datosNotaContrato', s); } catch (_) { }
            try { localStorage.setItem('datosNotaContrato', s); } catch (_) { }
            const frame = document.getElementById('note-preview-iframe');
            if (frame && frame.contentWindow) {
                frame.contentWindow.postMessage({ type: 'HP_NOTA', datos }, '*');
            }
        } catch (err) {
            console.warn('[LiveNota] No se pudo enviar actualización:', err);
        }
    };

    const onChange = debounce(enviarHPNota, 350);

    // Inputs relevantes
    const inputs = [
        '#contract-no-nota', '#contract-no', '#contract-type', '#delivery-notes',
        '#contract-client', // Agregado para detectar cambios en el cliente
        '#calle', '#no-externo', '#no-interno', '#colonia', '#cp', '#entre-calles',
        '#pais', '#estado', '#municipio',
        '#metodo-entrega', '#sucursal-entrega'
    ];
    inputs.forEach(sel => {
        const el = document.getElementById(sel.replace('#', ''));
        if (el && !el.dataset.liveBound) {
            el.dataset.liveBound = 'true';
            el.addEventListener('input', onChange);
            el.addEventListener('change', onChange);
        }
    });

    // Cambios en la tabla de items
    const tbody = document.querySelector('.items-table tbody');
    if (tbody) {
        tbody.addEventListener('input', onChange);
        tbody.addEventListener('change', onChange);
        try {
            const mo = new MutationObserver(onChange);
            mo.observe(tbody, { childList: true, subtree: true });
        } catch (_) { }
    }
}


/**
 * Guardar PDFs de contrato y nota
 */
async function guardarPdfs(idContrato) {
    try {
        // Obtener HTML del iframe de contrato
        const iframeContrato = document.getElementById('contract-preview-iframe');
        const iframNota = document.getElementById('note-preview-iframe');

        if (!iframeContrato || !iframNota) {
            console.warn('No se encontraron los iframes de vista previa');
            return;
        }

        // Obtener contenido HTML de los iframes
        let htmlContrato = '';
        let htmlNota = '';

        try {
            // Intentar obtener el contenido del iframe
            const docContrato = iframeContrato.contentDocument || iframeContrato.contentWindow.document;
            const docNota = iframNota.contentDocument || iframNota.contentWindow.document;

            if (docContrato) {
                htmlContrato = docContrato.documentElement.outerHTML;
            }
            if (docNota) {
                htmlNota = docNota.documentElement.outerHTML;
            }
        } catch (err) {
            console.warn('No se pudo acceder al contenido de los iframes:', err);
            // Intentar obtener desde el src del iframe
            if (iframeContrato.src && iframeContrato.src.startsWith('data:')) {
                htmlContrato = decodeURIComponent(iframeContrato.src.split(',')[1]);
            }
            if (iframNota.src && iframNota.src.startsWith('data:')) {
                htmlNota = decodeURIComponent(iframNota.src.split(',')[1]);
            }
        }

        if (!htmlContrato || !htmlNota) {
            console.warn('No se pudo obtener el HTML de los PDFs');
            return;
        }

        // Enviar PDFs al servidor
        const response = await fetch(`${API_URL}/pdf/ambos`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                id_contrato: idContrato,
                htmlContrato: htmlContrato,
                htmlNota: htmlNota
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Error guardando PDFs:', error);
            return;
        }

        const result = await response.json();
        console.log('PDFs guardados exitosamente:', result);

        return result;
    } catch (error) {
        console.error('Error en guardarPdfs:', error);
    }
}


// --- Lógica de Sucursales ---
let sucursalesDisponibles = [];

async function cargarSucursales() {
    try {
        const response = await fetch(`${API_URL}/productos/almacenes`, { headers: getAuthHeaders() });
        if (response.ok) {
            sucursalesDisponibles = await response.json();
            const selector = document.getElementById('sucursal-entrega');
            if (selector) {
                // Guardar valor actual si existe
                const val = selector.value;
                selector.innerHTML = '<option value="">Seleccione una sucursal...</option>';
                sucursalesDisponibles.forEach(sucursal => {
                    const opt = document.createElement('option');
                    opt.value = sucursal.id_almacen;
                    opt.textContent = sucursal.nombre_almacen;
                    // Aseguramos que la dirección esté disponible (preferimos direccion, luego ubicacion)
                    const direccion = sucursal.direccion || sucursal.ubicacion || 'Dirección no disponible';
                    opt.dataset.direccion = direccion;
                    console.log(`[CargarSucursales] Opción agregada: ${sucursal.nombre_almacen}, Dir: ${direccion}`);
                    selector.appendChild(opt);
                });
                if (val) selector.value = val;
            }
        }
    } catch (e) {
        console.error('Error cargando sucursales:', e);
    }
}

function setupSucursalHandlers() {
    const metodoSelector = document.getElementById('metodo-entrega');
    const sucursalContainer = document.getElementById('sucursal-selector-container');
    const addressContainer = document.getElementById('address-fields-container');

    if (metodoSelector) {
        metodoSelector.addEventListener('change', (e) => {
            const isSucursal = e.target.value === 'sucursal';
            if (sucursalContainer) sucursalContainer.style.display = isSucursal ? 'block' : 'none';
            if (addressContainer) addressContainer.style.display = isSucursal ? 'none' : 'block';

            // Si es sucursal, limpiar campos de dirección para evitar conflictos en la vista previa
            if (isSucursal) {
                const fieldsToClear = ['calle', 'no-externo', 'no-interno', 'colonia', 'cp', 'entre-calles', 'estado', 'municipio'];
                fieldsToClear.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.value = '';
                        el.dispatchEvent(new Event('input', { bubbles: true })); // Trigger change for preview
                    }
                });
            }
        });
        // Trigger inicial
        const isSucursal = metodoSelector.value === 'sucursal';
        if (sucursalContainer) sucursalContainer.style.display = isSucursal ? 'block' : 'none';
        if (addressContainer) addressContainer.style.display = isSucursal ? 'none' : 'block';
    }
}

// Inicialización cuando el script carga
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        cargarSucursales();
        setupSucursalHandlers();
    });
} else {
    cargarSucursales();
    setupSucursalHandlers();
}
