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
            option.value = `${folio} - ${tipo} - $${total}`;
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
 */
function llenarDatosDesdeQuote(cotizacion) {
    if (!cotizacion) {
        limpiarDatosFormulario();
        return;
    }

    try {
        console.log('Llenando datos desde cotización:', cotizacion);
        
        // Llenar datos principales del contrato
        document.getElementById('contract-type').value = cotizacion.tipo || 'RENTA';
        document.getElementById('contract-invoice').value = 'SI';
        document.getElementById('contract-date').valueAsDate = new Date();

        // Llenar tabla de artículos - buscar en diferentes posibles nombres de campos
        let productos = [];
        if (cotizacion.productos_seleccionados && Array.isArray(cotizacion.productos_seleccionados)) {
            productos = cotizacion.productos_seleccionados;
        } else if (cotizacion.productos && Array.isArray(cotizacion.productos)) {
            productos = cotizacion.productos;
        } else if (cotizacion.items && Array.isArray(cotizacion.items)) {
            productos = cotizacion.items;
        } else if (cotizacion.detalles && Array.isArray(cotizacion.detalles)) {
            productos = cotizacion.detalles;
        }

        if (productos.length > 0) {
            llenarTablaProductos(productos);
        } else {
            console.warn('No se encontraron productos en la cotización');
        }

        // Llenar fecha de cotización si existe
        if (cotizacion.fecha_cotizacion || cotizacion.fecha_creacion) {
            const fechaInput = document.getElementById('contract-date');
            if (fechaInput) {
                const fecha = new Date(cotizacion.fecha_cotizacion || cotizacion.fecha_creacion);
                fechaInput.valueAsDate = fecha;
            }
        }

        // Llenar totales - buscar los inputs por su contenedor
        const subtotalInput = Array.from(document.querySelectorAll('input[readonly]')).find(inp => 
            inp.value && parseFloat(inp.value.replace(/,/g, '')) > 2000
        );
        
        if (subtotalInput) {
            subtotalInput.value = formatCurrency(cotizacion.subtotal || 0);
        }

        // Buscar y llenar IVA
        const ivaInputs = Array.from(document.querySelectorAll('input[readonly]'));
        if (ivaInputs.length >= 2) {
            ivaInputs[1].value = formatCurrency(cotizacion.iva || 0);
        }

        // Buscar y llenar Descuento
        if (ivaInputs.length >= 3) {
            ivaInputs[2].value = formatCurrency(cotizacion.descuento || 0);
        }

        // Buscar y llenar Total
        if (ivaInputs.length >= 4) {
            const total = (parseFloat(cotizacion.subtotal || 0) + parseFloat(cotizacion.iva || 0) - parseFloat(cotizacion.descuento || 0));
            ivaInputs[3].value = formatCurrency(total);
        }

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
 */
function llenarTablaProductos(productos) {
    const tbody = document.querySelector('.items-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    productos.forEach(prod => {
        const row = document.createElement('tr');
        
        // Extraer datos con nombres de campos alternativos
        const clave = prod.clave || prod.codigo || prod.id_producto || prod.id || '';
        const descripcion = prod.descripcion || prod.nombre || prod.articulo || '';
        const cantidad = prod.cantidad || prod.qty || 1;
        const precio = parseFloat(prod.precio_unitario || prod.precio || prod.precio_unit || 0);
        const garantia = parseFloat(prod.garantia || prod.garantia_valor || 0);
        const total = cantidad * precio;
        
        row.innerHTML = `
            <td>${clave}</td>
            <td>${descripcion}</td>
            <td>${cantidad}</td>
            <td>${formatCurrency(precio)}</td>
            <td>${formatCurrency(garantia)}</td>
            <td>${formatCurrency(total)}</td>
        `;
        tbody.appendChild(row);
    });
    
    console.log(`Tabla llenada con ${productos.length} productos`);
}

/**
 * Limpiar datos del formulario
 */
function limpiarDatosFormulario() {
    document.getElementById('contract-type').value = 'RENTA';
    document.getElementById('contract-invoice').value = 'SI';
    document.getElementById('contract-date').valueAsDate = new Date();
    
    const tbody = document.querySelector('.items-table tbody');
    if (tbody) tbody.innerHTML = '';
    
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

        const datosContrato = {
            numero_contrato: numeroContrato,
            id_cliente: cliente.id_cliente,
            id_cotizacion: cotizacion.id_cotizacion || cotizacion.id,
            tipo: document.getElementById('contract-type').value,
            fecha_inicio: document.getElementById('contract-date').value,
            fecha_fin: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
            subtotal: cotizacion.subtotal || 0,
            iva: cotizacion.iva || 0,
            descuento: cotizacion.descuento || 0,
            total: (parseFloat(cotizacion.subtotal || 0) + parseFloat(cotizacion.iva || 0) - parseFloat(cotizacion.descuento || 0)),
            estado: 'Vigente',
            creado_por: JSON.parse(localStorage.getItem('user') || '{}').id || 1
        };

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
        showMessage('Contrato creado exitosamente', 'success');
        
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
        inputCliente.addEventListener('change', function() {
            procesarCambioCliente(this.value);
        });

        inputCliente.addEventListener('blur', function() {
            // Al perder foco, buscar el cliente si no está exactamente
            procesarCambioCliente(this.value);
        });

        inputCliente.addEventListener('input', function() {
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
    }

    // Evento cuando se escribe o selecciona cotización
    if (inputCotizacion) {
        inputCotizacion.addEventListener('change', function() {
            procesarCambioCotizacion(this.value);
        });

        inputCotizacion.addEventListener('blur', function() {
            procesarCambioCotizacion(this.value);
        });

        inputCotizacion.addEventListener('input', function() {
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
    }

    // Evento para guardar contrato
    if (formContrato) {
        formContrato.addEventListener('submit', guardarContrato);
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

    // Filtrar solo cotizaciones de RENTA del cliente actual
    const cotizacionesRenta = contratoModal.cotizaciones.filter(c => 
        c.tipo && String(c.tipo).toUpperCase() === 'RENTA'
    );

    // Buscar solo en cotizaciones de renta del cliente
    let cotizacion = cotizacionesRenta.find(c => {
        const folio = c.numero_folio || c.id_cotizacion || c.id || '';
        const folioStr = String(folio).toLowerCase();
        const folioBuscadoLower = folioBuscado.toLowerCase();
        
        return folioStr === folioBuscadoLower || 
               folioStr.includes(folioBuscadoLower) ||
               String(c.id_cotizacion) === String(folioBuscado) ||
               String(c.id) === String(folioBuscado);
    });
    
    if (cotizacion) {
        contratoModal.cotizacionSeleccionada = cotizacion;
        llenarDatosDesdeQuote(cotizacion);
    } else {
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
        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });
    }
    
    // Cerrar modal al hacer clic fuera
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Manejador para navegación entre pestañas
    const navLinks = document.querySelectorAll('.modal-nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remover clase active de todos los links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Agregar clase active al link clickeado
            this.classList.add('active');
            
            // Ocultar todas las vistas
            const views = document.querySelectorAll('.modal-view');
            views.forEach(v => v.classList.remove('active'));
            
            // Mostrar la vista seleccionada
            const targetId = this.getAttribute('data-target');
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.classList.add('active');
            }
        });
    });

    if (btnNuevoContrato) {
        btnNuevoContrato.addEventListener('click', function() {
            // Resetear número de contrato automático
            const nuevoNumero = generarNumeroContrato();
            document.getElementById('contract-no').value = nuevoNumero;
            
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
 * Generar número de contrato automático
 */
function generarNumeroContrato() {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `CT-${año}${mes}-${random}`;
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
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
