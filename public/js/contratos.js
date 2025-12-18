document.addEventListener('DOMContentLoaded', function () {
    // Function to update user profile UI
    const updateUserProfile = (user) => {
        if (!user) return;

        const avatar = document.getElementById('user-avatar');
        const dropdownUsername = document.getElementById('dropdown-username');
        const dropdownUserRole = document.getElementById('dropdown-user-role');

        if (user.nombre) {
            dropdownUsername.textContent = user.nombre;
        }
        if (user.rol) {
            dropdownUserRole.textContent = user.rol;
        }
        if (user.foto) {
            avatar.src = user.foto;
        } else if (user.nombre) {
            // Fallback to initials if no photo
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const context = canvas.getContext('2d');
            context.fillStyle = '#003366'; // brand-blue
            context.fillRect(0, 0, 100, 100);
            context.fillStyle = 'white';
            context.font = 'bold 40px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            const initials = user.nombre.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
            context.fillText(initials, 50, 50);
            avatar.src = canvas.toDataURL();
        }
    };

    // Cargar datos del usuario de forma robusta llamando a la función de auth.js
    if (window.auth && typeof window.auth.cargarUsuario === 'function') {
        window.auth.cargarUsuario().then(user => {
            if (user) {
                updateUserProfile(user);
            } else {
                // Si falla la carga desde el servidor, intentar desde localStorage como respaldo
                try {
                    const savedUser = localStorage.getItem('currentUser');
                    if (savedUser) {
                        updateUserProfile(JSON.parse(savedUser));
                    }
                } catch (e) {
                    console.error('Error loading user from localStorage', e);
                }
            }
        });
    }

    // Toggle dropdown visibility
    const avatar = document.getElementById('user-avatar');
    const dropdown = document.getElementById('user-dropdown');
    avatar.addEventListener('click', () => {
        dropdown.classList.toggle('show');
    });

    // Hide dropdown if clicking outside
    window.addEventListener('click', (e) => {
        if (!avatar.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // Modal functionality
    const newContractBtn = document.querySelector('.btn-primary'); // Assuming this is the 'NUEVO CONTRATO' button
    const modal = document.getElementById('new-contract-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelContractBtn = document.getElementById('cancel-contract-btn');

    newContractBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    const closeModal = () => {
        modal.style.display = 'none';
    };

    closeModalBtn.addEventListener('click', closeModal);
    cancelContractBtn.addEventListener('click', closeModal);

    // Handle modal navigation - MOVED TO contratos-modal.js
    /*
    const modalNavLinks = document.querySelectorAll('.modal-nav-link');
    const modalViews = document.querySelectorAll('.modal-view');

    modalNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.dataset.target;

            modalViews.forEach(view => {
                view.classList.remove('active');
                if (view.id === targetId) {
                    view.classList.add('active');
                }
            });

            modalNavLinks.forEach(navLink => {
                navLink.classList.remove('active');
            });
            link.classList.add('active');

            if (targetId === 'preview-view') {
                // Llamar a la función de auto-fill del PDF
                if (typeof abrirVistaPreviaPDF === 'function') {
                    abrirVistaPreviaPDF();
                }
            } else if (targetId === 'nota-view') {
                // Llamar a la función de auto-fill de la Nota
                if (typeof abrirVistaPreviaNota === 'function') {
                    abrirVistaPreviaNota();
                }
            }
        });
    });
    */

    // Close modal if clicking on the overlay
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.auth && typeof window.auth.cerrarSesion === 'function') {
            window.auth.cerrarSesion();
        }
    });

    const tabs = document.querySelectorAll('.nav-tab');
    const sections = document.querySelectorAll('.content-section');

    let calendar = null;
    let contractTemplate = '';
    let noteTemplate = '';
    let logoDataUrl = '';

    // --- LÓGICA DE FIRMA DIGITAL ---
    const canvas = document.getElementById('signature-pad');
    const clearBtn = document.querySelector('button[onclick="clearSignature()"]'); // Select by onclick attribute as backup or add id

    // Sobreescribir la función global para el botón
    window.clearSignature = () => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        document.getElementById('signature-data').value = '';
    };

    if (canvas) {
        const ctx = canvas.getContext('2d');
        let writingMode = false;

        const getCursorPosition = (event) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = event.touches ? event.touches[0].clientX : event.clientX;
            const clientY = event.touches ? event.touches[0].clientY : event.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };

        const startPosition = (event) => {
            writingMode = true;
            ctx.beginPath();
            const { x, y } = getCursorPosition(event);
            ctx.moveTo(x, y);
            event.preventDefault(); // Prevent scrolling
        };

        const endPosition = () => {
            writingMode = false;
            if (canvas) document.getElementById('signature-data').value = canvas.toDataURL();
        };

        const draw = (event) => {
            if (!writingMode) return;
            const { x, y } = getCursorPosition(event);
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineTo(x, y);
            ctx.stroke();
            event.preventDefault();
        };

        canvas.addEventListener('mousedown', startPosition);
        canvas.addEventListener('mouseup', endPosition);
        canvas.addEventListener('mousemove', draw);

        canvas.addEventListener('touchstart', startPosition, { passive: false });
        canvas.addEventListener('touchend', endPosition);
        canvas.addEventListener('touchmove', draw, { passive: false });
    }

    // --- PRE-LLENADO DESDE COTIZACIÓN ---
    const params = new URLSearchParams(window.location.search);
    if (params.has('cotizacion')) {
        const cotizacionId = params.get('cotizacion');
        const clienteNombre = params.get('cliente');

        // Abrir modal automáticamente
        const modal = document.getElementById('new-contract-modal');
        if (modal) modal.style.display = 'flex';

        // Llenar campos básicos iniciales
        if (cotizacionId) {
            const cotInput = document.getElementById('contract-cotizacion');
            if (cotInput) cotInput.value = cotizacionId;
            const contractNo = document.getElementById('contract-no');
            if (contractNo) contractNo.value = `CONT-${new Date().getFullYear()}-${cotizacionId.toString().padStart(4, '0')}`;
        }
        if (clienteNombre) {
            const cliInput = document.getElementById('contract-client');
            if (cliInput) cliInput.value = decodeURIComponent(clienteNombre);
        }

        // Obtener detalles completos de la cotización para llenar productos y totales
        const fetchCotizacionDetails = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const response = await fetch(`http://localhost:3001/api/cotizaciones/${cotizacionId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) throw new Error('Error al obtener cotización');

                const data = await response.json();
                console.log('📦 Datos de cotización recibidos:', data);

                // 1. Llenar Fechas
                if (data.fecha_inicio) document.getElementById('contract-start-date').value = data.fecha_inicio.split('T')[0];
                if (data.fecha_fin) document.getElementById('contract-end-date').value = data.fecha_fin.split('T')[0];

                const daysBetween = (d1, d2) => {
                    if (!d1 || !d2) return 0;
                    const date1 = new Date(d1);
                    const date2 = new Date(d2);
                    if (isNaN(date1) || isNaN(date2)) return 0;
                    const diff = Math.abs(date2 - date1);
                    return Math.ceil(diff / (1000 * 60 * 60 * 24));
                };

                let diasCalculados = daysBetween(data.fecha_inicio, data.fecha_fin);
                if (diasCalculados === 0 && data.dias_renta) diasCalculados = parseInt(data.dias_renta);
                if (diasCalculados === 0) diasCalculados = 30; // Fallback final

                // 2. Llenar Productos Y ACCESORIOS
                const tbody = document.getElementById('items-tbody');
                if (tbody) {
                    tbody.innerHTML = ''; // Limpiar filas de ejemplo

                    let productos = [];
                    // Parseo robusto de productos
                    try {
                        if (Array.isArray(data.productos_seleccionados) && data.productos_seleccionados.length > 0) {
                            productos = data.productos_seleccionados;
                        } else if (typeof data.productos === 'string') {
                            productos = JSON.parse(data.productos);
                        } else if (Array.isArray(data.productos)) {
                            productos = data.productos;
                        } else if (data.products) {
                            productos = typeof data.products === 'string' ? JSON.parse(data.products) : data.products;
                        }
                    } catch (e) { console.error('Error parsing prod', e); }

                    // Agregar accesorios si existen
                    let accesorios = [];
                    try {
                        if (data.accesorios_seleccionados) {
                            if (typeof data.accesorios_seleccionados === 'string') {
                                accesorios = JSON.parse(data.accesorios_seleccionados);
                            } else if (Array.isArray(data.accesorios_seleccionados)) {
                                accesorios = data.accesorios_seleccionados;
                            }
                        }
                        if (accesorios.length > 0) {
                            console.log('[contratos.js] Accesorios encontrados:', accesorios.length);
                            productos = [...productos, ...accesorios];
                        }
                    } catch (e) { console.error('Error parsing accesorios', e); }

                    let subtotalAcumulado = 0;

                    productos.forEach(p => {
                        const cantidad = parseFloat(p.cantidad || p.qty || 1);
                        const precio = parseFloat(p.precio_unitario || p.precio || p.price || 0);
                        const dias = diasCalculados;

                        // CALCULAR GARANTÍA: cantidad × precio de venta
                        let precioVenta = 0;
                        if (p.precio_venta) {
                            precioVenta = parseFloat(p.precio_venta);
                        } else if (p.precio_unitario_venta) {
                            precioVenta = parseFloat(p.precio_unitario_venta);
                        } else if (p.garantia_unitaria) {
                            precioVenta = parseFloat(p.garantia_unitaria);
                        } else {
                            precioVenta = precio * 100; // Fallback
                        }

                        const garantia = cantidad * precioVenta;
                        const subtotalItem = cantidad * precio;

                        const row = document.createElement('tr');
                        // Estructura: Equipo | Cantidad | Precio Unitario | Días | Garantía | Subtotal
                        row.innerHTML = `
                            <td>${p.descripcion || p.nombre || p.clave || 'Producto'}</td>
                            <td>${cantidad}</td>
                            <td>${precio.toFixed(2)}</td>
                            <td>${dias}</td>
                            <td>${garantia.toFixed(2)}</td>
                            <td>${subtotalItem.toFixed(2)}</td>
                        `;
                        tbody.appendChild(row);
                        subtotalAcumulado += subtotalItem;
                    });

                    // 3. Llenar Totales Generales
                    const totalInputs = document.querySelectorAll('.totals-section input');
                    if (totalInputs.length >= 4) {
                        // [Subtotal, Impuesto, Descuento, Total]
                        const subtotal = parseFloat(data.subtotal) || subtotalAcumulado;
                        const iva = parseFloat(data.iva) || parseFloat(data.impuesto) || (subtotal * 0.16);
                        const descuento = parseFloat(data.descuento_monto) || parseFloat(data.descuento) || 0;
                        const total = parseFloat(data.total) || (subtotal + iva - descuento);

                        console.log('[Totales] Subtotal:', subtotal, 'IVA:', iva, 'Descuento:', descuento, 'Total:', total);

                        totalInputs[0].value = subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 });
                        totalInputs[1].value = iva.toLocaleString('es-MX', { minimumFractionDigits: 2 });
                        totalInputs[2].value = descuento.toLocaleString('es-MX', { minimumFractionDigits: 2 });
                        totalInputs[3].value = total.toLocaleString('es-MX', { minimumFractionDigits: 2 });
                    }
                }

                // 4. Llenar Dirección de Entrega y Datos Globales
                if (typeof llenarDatosEntrega === 'function') {
                    llenarDatosEntrega(data);
                } else {
                    // Fallback si la función no existe
                    document.getElementById('calle').value = data.entrega_calle || data.calle || '';
                    document.getElementById('no-externo').value = data.entrega_numero_ext || data.numero_ext || '';
                    document.getElementById('colonia').value = data.entrega_colonia || data.colonia || '';
                    document.getElementById('municipio').value = data.entrega_municipio || data.municipio || '';
                    document.getElementById('estado').value = data.entrega_estado || data.estado || '';
                    document.getElementById('cp').value = data.entrega_cp || data.cp || '';
                }

                // 5. Llenar Folio y Garantía
                if (data.numero_cotizacion) {
                    const cotInput = document.getElementById('contract-cotizacion');
                    if (cotInput) cotInput.value = data.numero_cotizacion;
                }

                const garantiaType = document.getElementById('contract-guarantee-type');
                if (garantiaType) garantiaType.value = data.tipo_garantia || data.garantia_tipo || 'PAGARE';

                const garantiaAmount = document.getElementById('contract-guarantee-amount');
                if (garantiaAmount) {
                    // Priorizar el campo 'garantia_monto' que viene de la BD
                    const montoDb = parseFloat(data.garantia_monto);

                    let garantiaVal;
                    if (!isNaN(montoDb) && montoDb > 0) {
                        garantiaVal = montoDb;
                    } else {
                        // Si no hay garantía específica, usar importe_garantia (legacy) o fallback al Total
                        garantiaVal = data.importe_garantia || data.garantia || data.total || 0;
                    }

                    garantiaAmount.value = parseFloat(garantiaVal).toLocaleString('es-MX', { minimumFractionDigits: 2 });
                }

                // 6. Actualizar Estado Global de Modal (Crucial para PDF y Guardado)
                if (typeof contratoModal !== 'undefined') {
                    // Construir dirección de entrega completa si no viene pre-formateada
                    let direccionEntregaFull = data.direccion_entrega;
                    if (!direccionEntregaFull) {
                        const partesDireccion = [
                            data.entrega_calle || data.calle,
                            (data.entrega_numero_ext || data.numero_ext) ? `Ext. ${data.entrega_numero_ext || data.numero_ext}` : '',
                            (data.entrega_colonia || data.colonia) ? `Col. ${data.entrega_colonia || data.colonia}` : '',
                            data.entrega_municipio || data.municipio,
                            data.entrega_estado || data.estado,
                            (data.entrega_cp || data.cp) ? `CP ${data.entrega_cp || data.cp}` : ''
                        ].filter(Boolean);
                        direccionEntregaFull = partesDireccion.join(', ');
                    }

                    contratoModal.cotizacionSeleccionada = {
                        ...data,
                        direccion_entrega: direccionEntregaFull // Asegurar que este campo exista
                    };

                    contratoModal.clienteSeleccionado = {
                        id_cliente: data.id_cliente,
                        nombre: data.nombre_cliente || data.cliente || '',
                        representante: data.representante || '',
                        direccion_entrega: direccionEntregaFull
                    };
                    console.log('Estado del modal actualizado desde URL:', contratoModal);
                }

            } catch (err) {
                console.error('Error fetch detail:', err);
            }
        };

        fetchCotizacionDetails();
    }

    const formatCurrency = (value) => {
        const num = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
        if (!Number.isFinite(num)) return '$0.00';
        return num.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    };

    const formatDateParts = (value) => {
        if (!value) {
            return { day: '--', month: '--', year: '----', full: '--/--/----' };
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return { day: '--', month: '--', year: '----', full: value };
        }
        return {
            day: String(date.getDate()).padStart(2, '0'),
            month: date.toLocaleString('es-MX', { month: 'long' }).toUpperCase(),
            year: String(date.getFullYear()),
            full: date.toLocaleString('es-MX', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
        };
    };

    const getApiBaseUrl = () => {
        if (window.API_BASE_URL) return window.API_BASE_URL;
        const origin = window.location.origin;
        if (!origin || origin === 'null' || origin === 'file://' || origin.startsWith('file:')) {
            return 'http://localhost:3001';
        }
        return origin.replace(/\/$/, '');
    };

    const API_BASE_URL = getApiBaseUrl();
    const PREVIEW_ENDPOINT = `${API_BASE_URL}/api/preview`;

    const getPreviewHeaders = () => {
        const baseHeaders = window.auth?.getAuthHeaders ? window.auth.getAuthHeaders() : {};
        return {
            'Content-Type': 'application/json',
            ...baseHeaders,
        };
    };

    const loadPreviewIntoIframe = async (iframe, htmlString) => {
        if (!iframe || !htmlString) return;

        const requestId = Date.now().toString();
        iframe.dataset.previewRequestId = requestId;

        try {
            const response = await fetch(PREVIEW_ENDPOINT, {
                method: 'POST',
                headers: getPreviewHeaders(),
                body: JSON.stringify({ html: htmlString })
            });

            if (!response.ok) {
                throw new Error('No se pudo generar la vista previa');
            }

            const { url, id } = await response.json();
            const previewPath = url || (id ? `/api/preview/${id}` : '');

            if (iframe.dataset.previewRequestId !== requestId) {
                return;
            }

            if (!previewPath) {
                throw new Error('Respuesta inválida al generar vista previa');
            }

            if (previewPath.startsWith('http')) {
                iframe.src = previewPath;
            } else {
                const normalizedPath = previewPath.startsWith('/') ? previewPath : `/${previewPath}`;
                iframe.src = `${API_BASE_URL}${normalizedPath}`;
            }
        } catch (error) {
            console.error('Error actualizando vista previa:', error);
            iframe.src = 'about:blank';
        }
    };

    // Load the contract template using the preload script for reliability in Electron
    if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
        window.electronAPI.readFile('pdf_contrato.html')
            .then(html => {
                contractTemplate = html;
                window.contractTemplateContent = html;

                // If user is currently on preview tab, refresh it immediately
                const previewSection = document.getElementById('preview-view');
                if (previewSection && previewSection.classList.contains('active')) {
                    updatePreview();
                }
            })
            .catch(error => {
                console.error('Error reading contract template:', error);
            });
    }

    if (window.electronAPI && typeof window.electronAPI.readFile === 'function') {
        window.electronAPI.readFile('hoja_pedido.html')
            .then(html => {
                noteTemplate = html;
                window.noteTemplateContent = html;

                const noteSection = document.getElementById('nota-view');
                if (noteSection && noteSection.classList.contains('active')) {
                    updateNotePreview();
                }
            })
            .catch(error => {
                console.error('Error reading note template:', error);
            });
    }

    if (window.electronAPI && typeof window.electronAPI.readFileDataUrl === 'function') {
        window.electronAPI.readFileDataUrl('img/logo-demo.jpg')
            .then(dataUrl => {
                logoDataUrl = dataUrl;

                const previewSection = document.getElementById('preview-view');
                if (previewSection && previewSection.classList.contains('active')) {
                    updatePreview();
                }

                const noteSection = document.getElementById('nota-view');
                if (noteSection && noteSection.classList.contains('active')) {
                    updateNotePreview();
                }
            })
            .catch(error => {
                console.error('Error reading logo asset:', error);
            });
    }

    const updatePreview = () => {
        if (!contractTemplate) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(contractTemplate, 'text/html');

        // Ensure relative assets resolve correctly inside the iframe
        const baseHref = new URL('./', window.location.href).href;
        let baseEl = doc.querySelector('base');
        if (!baseEl) {
            baseEl = doc.createElement('base');
            doc.head.insertBefore(baseEl, doc.head.firstChild);
        }
        baseEl.setAttribute('href', baseHref);

        // --- Populate data from form into the template ---
        const contractNoValue = document.getElementById('contract-no').value;
        const contractNoEl = doc.querySelector('.text-red-600');
        if (contractNoEl) {
            contractNoEl.textContent = contractNoValue;
        }

        const clientNameValue = document.getElementById('contract-client').value;
        const clientNameInput = doc.querySelector('input[placeholder="Nombre completo o Razón Social"]');
        if (clientNameInput) {
            clientNameInput.value = clientNameValue;
            clientNameInput.setAttribute('value', clientNameValue);
        }

        const deliveryAddressInput = doc.querySelector('input[placeholder="Domicilio de la Obra"]');
        if (deliveryAddressInput) {
            const calle = document.getElementById('calle').value;
            const noExterno = document.getElementById('no-externo').value;
            const colonia = document.getElementById('colonia').value;
            const direccion = `${calle} #${noExterno}, ${colonia}`;
            deliveryAddressInput.value = direccion;
            deliveryAddressInput.setAttribute('value', direccion);
        }

        if (logoDataUrl) {
            const logoImg = doc.querySelector('img[src="img/logo-demo.jpg"]');
            if (logoImg) {
                logoImg.setAttribute('src', logoDataUrl);
            }
        }

        const iframe = document.getElementById('contract-preview-iframe');
        const htmlString = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
        loadPreviewIntoIframe(iframe, htmlString);
    };

    const buildContractHtmlFromData = (data = {}) => {
        const safe = (val, fallback = '') => (val !== undefined && val !== null) ? val : fallback;
        const currency = (val) => formatCurrency(val);
        const date = (val) => formatDateParts(val);

        const fechaContrato = date(data.fecha_contrato);
        const fechaFin = date(data.fecha_fin);

        // Prepare items for the grid
        const items = data.items || [];
        const getItem = (name) => {
            const item = items.find(i => i.descripcion && i.descripcion.toLowerCase().includes(name.toLowerCase()));
            return item ? item.cantidad : '';
        };

        // Helper for empty inputs style
        const inputStyle = "border: none; border-bottom: 1px solid #333; padding: 0; width: auto; min-width: 50px; display: inline-block; background: transparent; font-weight: 500; text-align: center; line-height: 1;";

        return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrato de Arrendamiento - ANDAMIOS TORRES®</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'brand-blue': '#003366',
                        'brand-yellow': '#FFCC00',
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    },
                }
            }
        }
    </script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        body {
            font-family: 'Inter', sans-serif;
            background-color: white;
            color: #000;
        }

        .contract-page {
            width: 100%;
            max-width: 100%;
            padding: 0;
            margin: 0 auto;
            background: white;
            font-size: 9pt; /* Increased from 0.65rem for better readability */
            line-height: 1.3;
        }

        .form-field {
            border: none;
            border-bottom: 1px solid #000;
            padding: 0 4px;
            display: inline-block;
            background: transparent;
            font-weight: 600;
            text-align: center;
            line-height: 1;
            min-width: 30px;
        }

        .clause-heading {
            font-weight: bold;
            margin-right: 4px;
        }

        .clause-paragraph {
            margin-bottom: 6px;
            text-align: justify;
            text-justify: inter-word;
        }

        .signature-block {
            display: flex;
            justify-content: space-around;
            margin-top: 2rem;
            page-break-inside: avoid;
        }

        .signature-item {
            width: 40%;
            text-align: center;
        }

        .signature-line-bottom {
            border-top: 1px solid #000;
            margin-top: 4px;
            padding-top: 4px;
        }
        
        /* Print overrides */
        @media print {
            body { margin: 0; padding: 0; }
            .contract-page { width: 100%; max-width: none; padding: 0; margin: 0; }
        }
    </style>
</head>
<body>
    <div class="contract-page" id="contract-content">

        <!-- Header -->
        <div class="flex justify-between items-start mb-4 pb-2 border-b-2 border-gray-800">
            <div class="flex items-center space-x-4 w-full">
                <!-- Logo -->
                <div class="h-12 w-24 flex items-center justify-center flex-shrink-0">
                    ${logoDataUrl ? `<img src="${logoDataUrl}" alt="logo" style="max-height: 100%; max-width: 100%; object-fit: contain;">` : '<span class="text-xs italic text-gray-400">LOGO</span>'}
                </div>

                <!-- Info -->
                <div class="flex-grow pl-4">
                    <div class="flex justify-between items-start">
                        <div class="flex flex-col">
                            <h1 class="text-xl font-extrabold text-brand-blue leading-none tracking-tight">ANDAMIOS TORRES S.A de C.V</h1>
                        </div>
                        <div class="text-right flex flex-col items-end">
                            <p class="text-lg font-extrabold text-red-600 leading-none">${safe(data.numero_contrato, '----')}</p>
                            <p class="text-xs font-bold text-gray-800 tracking-widest uppercase mt-1">CONTRATO</p>
                        </div>
                    </div>

                    <div class="text-[9px] mt-2 text-gray-800 leading-tight text-left">
                        <p class="font-bold">ANDAMIOS Y PROYECTOS TORRES, S.A. DE C.V.</p>
                        <p>ORIENTE 174 N° 290 COLONIA MOCTEZUMA 2 SECC. C.P. 15530 CDMX</p>
                        <p>TELS: 55-5571-7105 / 55-2643-0024 &nbsp;|&nbsp; RFC: APT100310EC2</p>
                        <p>E-mail: <span class="text-blue-800 font-medium">ventas@andamiostorres.com</span> &nbsp;|&nbsp; Web: <span class="text-blue-800 font-medium">www.andamiostorres.com</span></p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Title -->
        <p class="mb-3 text-justify">
            Contrato de Arrendamiento de andamios Tubulares, que celebran por una parte <strong>ANDAMIOS Y PROYECTOS TORRES S.A. DE C.V.</strong> (a quien en adelante se le denominará EL ARRENDADOR) y quien tiene su domicilio en Oriente 174 #290 Col. Moctezuma 2da. Secc. CDMX y por la otra parte con el carácter de:
        </p>

        <!-- Client Data -->
        <div class="mb-4 space-y-2">
            <div class="flex items-end w-full">
                <span class="font-bold whitespace-nowrap mr-2">ARRENDATARIO:</span>
                <div class="form-field flex-grow text-left font-bold uppercase" style="border-bottom: 1px solid #000;">${safe(data.nombre_cliente)}</div>
            </div>
            
            <div class="flex items-end w-full">
                <span class="whitespace-nowrap mr-2">por su propio derecho o representando a:</span>
                <div class="form-field flex-grow text-left" style="border-bottom: 1px solid #000;">${safe(data.representante || data.responsable)}</div>
            </div>

            <div class="flex items-end w-full">
                <span class="whitespace-nowrap mr-2">quien tiene poder suficiente para obligarse a los términos de este contrato y quien tiene su domicilio en:</span>
            </div>
            <div class="w-full">
                 <div class="form-field w-full text-left" style="border-bottom: 1px solid #000;">${safe(data.domicilio_arrendatario)}</div>
            </div>
        </div>

        <!-- Clauses -->
        <div class="space-y-2">

            <!-- Primera -->
            <p class="clause-paragraph">
                <span class="clause-heading">Primera.-</span>
                EL <strong>ARRENDADOR</strong> da en arrendamiento y EL ARRENDATARIO recibe a su entera satisfacción la cantidad de
                <span class="form-field w-12 text-center font-bold">${items.length}</span>
                tubulares, bajo las siguientes:
            </p>

            <!-- Items Grid -->
            <div class="grid grid-cols-4 gap-x-4 gap-y-2 mb-3 pl-2 text-xs font-medium">
                <div class="flex items-center"><span class="w-16">Marcos:</span><span class="form-field flex-grow text-center">${getItem('Marco')}</span></div>
                <div class="flex items-center"><span class="w-16">Crucetas:</span><span class="form-field flex-grow text-center">${getItem('Cruceta')}</span></div>
                <div class="flex items-center"><span class="w-16">Plataforma:</span><span class="form-field flex-grow text-center">${getItem('Plataforma')}</span></div>
                <div class="flex items-center"><span class="w-16">Bases:</span><span class="form-field flex-grow text-center">${getItem('Base')}</span></div>
                <div class="flex items-center"><span class="w-16">Ruedas:</span><span class="form-field flex-grow text-center">${getItem('Rueda')}</span></div>
                <div class="flex items-center"><span class="w-16">Coples:</span><span class="form-field flex-grow text-center">${getItem('Cople')}</span></div>
                <div class="flex items-center"><span class="w-16">S. Diagonal:</span><span class="form-field flex-grow text-center">${getItem('Diagonal')}</span></div>
                <div class="flex items-center"><span class="w-16">Barandal:</span><span class="form-field flex-grow text-center">${getItem('Barandal')}</span></div>
            </div>

            <!-- Segunda -->
            <p class="clause-paragraph">
                <span class="clause-heading">Segunda.-</span>
                EL ARRENDATARIO declara que el equipo materia de este contrato será utilizado exclusivamente en la obra o edificio ubicado en el domicilio:
                <div class="form-field w-full text-left mt-1 mb-1" style="border-bottom: 1px solid #000;">${safe(data.domicilio_obra || data.domicilio_arrendatario)}</div>
                <span class="italic text-xs block">El equipo no podrá ser utilizado en ningún otro lugar sin la previa autorización por escrito del ARRENDADOR.</span>
            </p>

            <!-- Tercera -->
            <p class="clause-paragraph">
                <span class="clause-heading">Tercera.-</span>
                Ambas partes convienen que el término del contrato de arrendamiento es de
                <span class="form-field w-12 text-center font-bold">${safe(data.dias_renta)}</span>
                días naturales y concluirá el
                <span class="form-field w-32 text-center font-bold">${fechaFin.full}</span>
                así mismo a la Firma del presente contrato EL ARRENDATARIO pagará la cantidad de
                <span class="form-field w-24 text-center font-bold">${currency(data.monto_inicial)}</span>
                más IVA.
            </p>

            <!-- Cuarta -->
            <p class="clause-paragraph">
                <span class="clause-heading">Cuarta.-</span>
                EL ARRENDATARIO firma al tiempo de celebración del presente contrato un pagaré o cheque bancario a la orden de Andamios y Proyectos Torres S.A de C.V la cantidad de
                <span class="form-field w-24 text-center font-bold">${currency(data.importe_garantia)}</span>
                como garantía, este documento sólo podrá hacerse efectivo por el arrendador si el arrendatario perdiere el equipo o en su caso causara daños o desperfectos al equipo.
            </p>

            <!-- Standard Clauses (Quinta - Duodecima) -->
            <p class="clause-paragraph"><span class="clause-heading">Quinta.-</span> EL ARRENDATARIO se compromete a pagar la renta por adelantado en el domicilio del arrendador.</p>
            
            <p class="clause-paragraph"><span class="clause-heading">Sexta.-</span> EL ARRENDADOR tendrá derecho a dar por terminado el presente contrato en cualquier tiempo por incumplimiento.</p>
            
            <p class="clause-paragraph"><span class="clause-heading">Séptima.-</span> EL ARRENDADOR entrega el equipo en el domicilio de la obra, pero no se obliga a instalarlo.</p>
            
            <p class="clause-paragraph"><span class="clause-heading">Octava.-</span> EL ARRENDATARIO no podrá subarrendar sin consentimiento por escrito.</p>
            
            <p class="clause-paragraph"><span class="clause-heading">Novena.-</span> EL ARRENDATARIO recibe el equipo en perfecto estado y se obliga a devolverlo igual.</p>
            
            <p class="clause-paragraph"><span class="clause-heading">Décima.-</span> EL ARRENDATARIO pagará íntegra y puntualmente la renta sin retenciones.</p>
            
            <p class="clause-paragraph"><span class="clause-heading">Décima primera.-</span> EL ARRENDADOR no será responsable de accidentes o daños por el uso del equipo.</p>
            
            <p class="clause-paragraph"><span class="clause-heading">Décima segunda.-</span> EL ARRENDATARIO gestionará licencias y permisos necesarios.</p>
            
            <!-- Decima Tercera (Costs) -->
            <p class="clause-paragraph">
                <span class="clause-heading">Décima tercera.-</span>
                En caso de perdida, daños, robo, destrucción parcial o total, el arrendatario pagará:
            </p>
            <div class="grid grid-cols-4 gap-x-4 gap-y-1 mb-2 pl-2 text-xs text-gray-600">
                <div class="flex items-center"><span class="w-16">Marcos:</span><span class="form-field flex-grow text-center border-gray-300"></span></div>
                <div class="flex items-center"><span class="w-16">Crucetas:</span><span class="form-field flex-grow text-center border-gray-300"></span></div>
                <div class="flex items-center"><span class="w-16">Plataforma:</span><span class="form-field flex-grow text-center border-gray-300"></span></div>
                <div class="flex items-center"><span class="w-16">Bases:</span><span class="form-field flex-grow text-center border-gray-300"></span></div>
                <div class="flex items-center"><span class="w-16">Ruedas:</span><span class="form-field flex-grow text-center border-gray-300"></span></div>
                <div class="flex items-center"><span class="w-16">Coples:</span><span class="form-field flex-grow text-center border-gray-300"></span></div>
                <div class="flex items-center"><span class="w-16">S. Diagonal:</span><span class="form-field flex-grow text-center border-gray-300"></span></div>
                <div class="flex items-center"><span class="w-16">Barandal:</span><span class="form-field flex-grow text-center border-gray-300"></span></div>
            </div>

            <p class="clause-paragraph"><span class="clause-heading">Décima cuarta.-</span> Rentas pagaderas aún en casos fortuitos o fuerza mayor.</p>
            <p class="clause-paragraph"><span class="clause-heading">Décima quinta.-</span> Aviso de devolución: equipo debe estar desarmado.</p>
            <p class="clause-paragraph"><span class="clause-heading">Décima sexta.-</span> Jurisdicción: Tribunales de la Ciudad de México.</p>
        </div>

        <!-- Signatures -->
        <div class="mt-8 pt-4 border-t-2 border-gray-200">
            <p class="mb-8 text-center">
                El presente contrato se firma por duplicado a los
                <span class="form-field w-10 text-center font-bold">${fechaContrato.day}</span>
                días del mes de
                <span class="form-field w-32 text-center font-bold">${fechaContrato.month}</span>
                de
                <span class="form-field w-16 text-center font-bold">${fechaContrato.year}</span>
                en la Ciudad de México.
            </p>

            <div class="signature-block">
                <div class="signature-item">
                    <div class="h-16 border-b border-black mb-2"></div>
                    <span class="font-bold block">EL ARRENDATARIO</span>
                    <span class="text-xs block text-gray-500">(Firma y Nombre)</span>
                </div>
                <div class="signature-item">
                    <div class="h-16 border-b border-black mb-2"></div>
                    <span class="font-bold block">EL ARRENDADOR</span>
                    <span class="text-xs block text-gray-500">ANDAMIOS TORRES S.A. DE C.V.</span>
                </div>
            </div>
        </div>

    </div>
</body>
</html>`;
    };

    const buildNoteHtmlFromData = (data = {}) => {
        const template = window.noteTemplateContent || noteTemplate;
        if (!template) return '';

        const parser = new DOMParser();
        const doc = parser.parseFromString(template, 'text/html');

        const safeText = (selector, value, fallback = '--') => {
            const el = doc.querySelector(selector);
            if (el) {
                el.textContent = value || value === 0 ? value : fallback;
            }
        };

        const safeMultiline = (selector, lines, fallback = '--') => {
            const el = doc.querySelector(selector);
            if (el) {
                const content = (Array.isArray(lines) ? lines : [lines])
                    .map(v => (v ?? '').toString().trim())
                    .filter(Boolean);
                el.textContent = content.length ? content.join('\n') : fallback;
            }
        };

        const dateParts = formatDateParts(data.fecha_contrato);
        safeText('#print-folio', data.numero_contrato || '--');
        safeText('#print-contrato', data.numero_contrato || '--');
        safeText('#print-dia', dateParts.day);
        safeText('#print-mes', dateParts.month);
        safeText('#print-ano', dateParts.year);
        safeText('#print-emision', dateParts.full);
        safeText('#print-condiciones', data.tipo || '--');
        safeText('#print-notas', data.notas_domicilio || data.notas || '--');

        safeText('#print-agente', data.responsable || 'Equipo de Ventas');
        safeText('#print-envio-metodo', data.metodo_envio || 'Entrega a domicilio');
        safeText('#print-envio-sucursal', data.sucursal || 'Sucursal Principal');
        safeText('#print-envio-fecha', dateParts.full);

        const direccionLinea = (contratoDireccion = {}) => {
            const partes = [
                contratoDireccion.calle,
                contratoDireccion.numero_externo ? `#${contratoDireccion.numero_externo}` : '',
                contratoDireccion.colonia,
                contratoDireccion.municipio,
                contratoDireccion.estado_entidad,
                contratoDireccion.codigo_postal ? `C.P. ${contratoDireccion.codigo_postal}` : ''
            ].filter(Boolean);
            return partes.join(', ');
        };

        const direccionBase = direccionLinea(data);
        safeMultiline('#print-facturar-a', [data.nombre_cliente, direccionBase]);
        safeMultiline('#print-remitir-a', [data.nombre_cliente, direccionBase, data.notas_domicilio]);

        const tbody = doc.querySelector('#print-productos');
        let subtotal = 0;
        if (tbody) {
            const rows = (data.items || []).map(item => {
                const cantidad = item.cantidad || item.quantity || 0;
                const descripcion = item.descripcion || item.description || '--';
                const total = Number(item.total || item.monto || 0);
                subtotal += total;
                return `
                    <tr>
                        <td class="quantity">${cantidad}</td>
                        <td>${descripcion}</td>
                        <td class="amount">${formatCurrency(total)}</td>
                    </tr>
                `;
            });

            tbody.innerHTML = rows.length
                ? rows.join('')
                : '<tr class="empty-row"><td colspan="3">Sin registros disponibles.</td></tr>';
        }

        const subtotalMonto = Number(data.subtotal ?? subtotal);
        const impuestoMonto = Number(data.impuesto ?? subtotalMonto * 0.16);
        const totalMonto = Number(data.total ?? (subtotalMonto + impuestoMonto));

        safeText('#print-subtotal', formatCurrency(subtotalMonto));
        safeText('#print-iva', formatCurrency(impuestoMonto));
        safeText('#print-envio-total', formatCurrency(0));
        safeText('#print-total', formatCurrency(totalMonto));

        return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
    };

    window.contractPreviewUtils = {
        buildContractHtmlFromData,
        buildNoteHtmlFromData
    };

    const updateNotePreview = () => {
        if (!noteTemplate) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(noteTemplate, 'text/html');

        const baseHref = new URL('./', window.location.href).href;
        let baseEl = doc.querySelector('base');
        if (!baseEl) {
            baseEl = doc.createElement('base');
            doc.head.insertBefore(baseEl, doc.head.firstChild);
        }
        baseEl.setAttribute('href', baseHref);

        doc.querySelectorAll('script').forEach(script => script.remove());

        if (logoDataUrl) {
            doc.querySelectorAll('img[src="img/logo-demo.jpg"]').forEach(img => {
                img.setAttribute('src', logoDataUrl);
            });
        }

        const getValue = (selector, fallback = '') => {
            const el = document.querySelector(selector);
            return el ? el.value || el.textContent || fallback : fallback;
        };

        const safeText = (selector, value, fallback = '--') => {
            const el = doc.querySelector(selector);
            if (el) {
                el.textContent = value || value === 0 ? value : fallback;
            }
        };

        const safeMultiline = (selector, lines, fallback = '--') => {
            const el = doc.querySelector(selector);
            if (el) {
                const content = (Array.isArray(lines) ? lines : [lines])
                    .map(v => (v ?? '').toString().trim())
                    .filter(Boolean);
                el.textContent = content.length ? content.join('\n') : fallback;
            }
        };

        const contractNumber = getValue('#contract-no');
        const contractClient = getValue('#contract-client');
        const contractDate = getValue('#contract-date');
        const condiciones = getValue('#contract-type');
        const notasEntrega = getValue('#delivery-notes');

        const calle = getValue('#calle');
        const noExterno = getValue('#no-externo');
        const noInterno = getValue('#no-interno');
        const colonia = getValue('#colonia');
        const cp = getValue('#cp');
        const estado = getValue('#estado');
        const municipio = getValue('#municipio');

        const direccionEntrega = [calle, `No. Ext: ${noExterno}`, noInterno ? `No. Int: ${noInterno}` : '', colonia]
            .filter(Boolean)
            .join(', ');

        const facturarLines = [contractClient, colonia, `${municipio}, ${estado}`, `C.P. ${cp}`];
        const remitirLines = [contractClient, direccionEntrega, `${municipio}, ${estado}`, `C.P. ${cp}`];

        const dateParts = formatDateParts(contractDate);
        safeText('#print-folio', contractNumber || '--');
        safeText('#print-contrato', contractNumber || '--');
        safeText('#print-dia', dateParts.day);
        safeText('#print-mes', dateParts.month);
        safeText('#print-ano', dateParts.year);
        safeText('#print-emision', dateParts.full);
        safeText('#print-condiciones', condiciones || '--');
        safeText('#print-notas', notasEntrega || '--');

        const agente = document.getElementById('dropdown-username')?.textContent?.trim();
        safeText('#print-agente', agente || 'Equipo de Ventas');
        safeText('#print-envio-metodo', 'Entrega a domicilio');
        safeText('#print-envio-sucursal', 'Sucursal Principal');
        safeText('#print-envio-fecha', dateParts.full);
        safeText('#print-envio-distancia', '--');

        safeMultiline('#print-facturar-a', facturarLines);
        safeMultiline('#print-remitir-a', remitirLines);

        const itemsRows = Array.from(document.querySelectorAll('.items-table tbody tr'));
        const tbody = doc.querySelector('#print-productos');
        const productRows = [];
        let subtotal = 0;

        itemsRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 6) return;

            const quantity = cells[2].textContent.trim();
            const description = cells[1].textContent.trim();
            const amountRaw = cells[5].textContent.trim();
            const amountNumber = Number(amountRaw.replace(/[^0-9.-]/g, '')) || 0;
            subtotal += amountNumber;

            productRows.push(`
                <tr>
                    <td class="quantity">${quantity || '-'}</td>
                    <td>${description || '-'}</td>
                    <td class="amount">${formatCurrency(amountNumber)}</td>
                </tr>
            `);
        });

        if (tbody) {
            tbody.innerHTML = productRows.length
                ? productRows.join('')
                : '<tr class="empty-row"><td colspan="3">Sin registros disponibles.</td></tr>';
        }

        const iva = subtotal * 0.16;
        const total = subtotal + iva;

        safeText('#print-subtotal', formatCurrency(subtotal));
        safeText('#print-iva', formatCurrency(iva));
        safeText('#print-envio-total', formatCurrency(0));
        safeText('#print-total', formatCurrency(total));

        const iframe = document.getElementById('note-preview-iframe');
        if (!iframe) return;

        const htmlString = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
        loadPreviewIntoIframe(iframe, htmlString);
    };

    const showCalendar = () => {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;

        console.log('📅 Inicializando calendario de contratos...');

        // Construir eventos desde contratosGlobal si está disponible
        let eventosCalendario = [];
        
        if (typeof contratosGlobal !== 'undefined' && Array.isArray(contratosGlobal)) {
            contratosGlobal.forEach(contrato => {
                if (!contrato.fecha_contrato) return;

                // Determinar color según estado
                let backgroundColor = '#1abc9c'; // Activo - verde/azul
                let borderColor = '#16a085';
                
                if (contrato.estado === 'Pendiente') {
                    backgroundColor = '#ffc107'; // Amarillo
                    borderColor = '#e0a800';
                } else if (contrato.estado === 'Concluido') {
                    backgroundColor = '#6c757d'; // Gris
                    borderColor = '#5a6268';
                }

                // Evento 1: Inicio de Contrato
                eventosCalendario.push({
                    id: `inicio-${contrato.id_contrato}`,
                    title: `🟢 Inicio: ${contrato.nombre_cliente || 'Cliente'}`,
                    start: contrato.fecha_contrato,
                    backgroundColor: backgroundColor,
                    borderColor: borderColor,
                    extendedProps: {
                        tipo: 'inicio',
                        contrato: contrato,
                        description: `Contrato: ${contrato.numero_contrato}\nCliente: ${contrato.nombre_cliente}\nMonto: $${parseFloat(contrato.total || 0).toLocaleString()}`
                    }
                });

                // Evento 2: Fin/Entrega de Contrato
                if (contrato.fecha_fin) {
                    eventosCalendario.push({
                        id: `fin-${contrato.id_contrato}`,
                        title: `🔴 Fin: ${contrato.nombre_cliente || 'Cliente'}`,
                        start: contrato.fecha_fin,
                        backgroundColor: '#e74c3c', // Rojo
                        borderColor: '#c0392b',
                        extendedProps: {
                            tipo: 'fin',
                            contrato: contrato,
                            description: `Entrega prevista de: ${contrato.numero_contrato}`
                        }
                    });
                }
            });
        }

        if (!calendar) {
            calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                locale: 'es',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,listWeek'
                },
                buttonText: {
                    today: 'Hoy',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Día',
                    list: 'Lista'
                },
                allDayText: 'Todo el día',
                noEventsText: 'Sin eventos',
                events: eventosCalendario,
                eventClick: function (info) {
                    console.log('📌 Evento clickeado:', info.event.title);
                    mostrarDetalleContratoEvento(info.event);
                },
                eventDidMount: function (info) {
                    if (info.event.extendedProps.description) {
                        info.el.setAttribute('title', info.event.extendedProps.description);
                    }
                },
                height: 'auto',
                contentHeight: 'auto'
            });
            calendar.render();
        } else {
            // Si el calendario ya existe, actualizar los eventos
            calendar.removeAllEvents();
            eventosCalendario.forEach(event => {
                calendar.addEvent(event);
            });
        }

        // Actualizar tamaño después de transición
        setTimeout(() => {
            if (calendar) {
                calendar.updateSize();
            }
        }, 50);

        console.log('✅ Calendario de contratos inicializado con', eventosCalendario.length, 'eventos');
    };

    // Función para mostrar detalles del evento en modal
    window.mostrarDetalleContratoEvento = function (event) {
        console.log('🔍 Abriendo modal de evento:', event);
        const contrato = event.extendedProps.contrato;
        if (!contrato) {
            console.error('❌ No hay datos de contrato en el evento');
            return;
        }

        const modal = document.getElementById('contratoEventoModal');
        const titulo = document.getElementById('contratoEventoTitulo');
        const detalles = document.getElementById('contratoEventoDetalles');
        const btnVer = document.getElementById('btn-ver-contrato');

        if (!modal) {
            console.error('❌ No se encontró el elemento modal');
            return;
        }

        const isStart = event.extendedProps.isStart;
        const eventType = isStart ? 'Inicio' : 'Fin';
        const iconoEvento = isStart ? '<i class="fa fa-play-circle"></i>' : '<i class="fa fa-stop-circle"></i>';

        titulo.innerHTML = `${iconoEvento} ${eventType} de Contrato`;

        const estadoClass = contrato.estado === 'Activo' ? 'status-active' : 
                           contrato.estado === 'Pendiente' ? 'status-pending' : 
                           'status-concluded';
        
        const estadoIcon = contrato.estado === 'Activo' ? '<i class="fa fa-check-circle"></i>' :
                          contrato.estado === 'Pendiente' ? '<i class="fa fa-clock-o"></i>' :
                          '<i class="fa fa-check-double"></i>';

        const fechaInicio = contrato.fecha_contrato ? new Date(contrato.fecha_contrato).toLocaleDateString('es-MX', {year: 'numeric', month: 'long', day: 'numeric'}) : 'N/A';
        const fechaFin = contrato.fecha_fin ? new Date(contrato.fecha_fin).toLocaleDateString('es-MX', {year: 'numeric', month: 'long', day: 'numeric'}) : 'N/A';

        detalles.innerHTML = `
            <div class="evento-info-grid">
                <!-- Fila 1: Contrato y Estado -->
                <div class="info-item">
                    <div class="info-icon"><i class="fa fa-file-contract"></i></div>
                    <div class="info-content">
                        <label>Número de Contrato</label>
                        <p class="info-value">${contrato.numero_contrato}</p>
                    </div>
                </div>
                
                <div class="info-item">
                    <div class="info-icon estado-icon">${estadoIcon}</div>
                    <div class="info-content">
                        <label>Estado</label>
                        <p class="info-value"><span class="status ${estadoClass}">${contrato.estado}</span></p>
                    </div>
                </div>

                <!-- Fila 2: Cliente y Monto -->
                <div class="info-item">
                    <div class="info-icon"><i class="fa fa-user"></i></div>
                    <div class="info-content">
                        <label>Cliente</label>
                        <p class="info-value">${contrato.nombre_cliente || 'N/A'}</p>
                    </div>
                </div>

                <div class="info-item">
                    <div class="info-icon monto-icon"><i class="fa fa-dollar"></i></div>
                    <div class="info-content">
                        <label>Monto Total</label>
                        <p class="info-value monto-value">$${parseFloat(contrato.total || 0).toLocaleString('es-MX', {minimumFractionDigits: 2})}</p>
                    </div>
                </div>

                <!-- Fila 3: Fechas -->
                <div class="info-item">
                    <div class="info-icon"><i class="fa fa-calendar-check-o"></i></div>
                    <div class="info-content">
                        <label>Fecha Inicio</label>
                        <p class="info-value">${fechaInicio}</p>
                    </div>
                </div>

                <div class="info-item">
                    <div class="info-icon"><i class="fa fa-calendar-times-o"></i></div>
                    <div class="info-content">
                        <label>Fecha Fin</label>
                        <p class="info-value">${fechaFin}</p>
                    </div>
                </div>

                <!-- Fila 4: Dirección (ancho completo) -->
                <div class="info-item full-width">
                    <div class="info-icon"><i class="fa fa-map-marker"></i></div>
                    <div class="info-content">
                        <label>Domicilio de Entrega</label>
                        <p class="info-value">
                            ${contrato.calle || ''} #${contrato.numero_externo || ''}<br>
                            ${contrato.colonia || ''}, ${contrato.municipio || ''}<br>
                            ${contrato.estado_entidad || ''} ${contrato.codigo_postal || ''}
                        </p>
                    </div>
                </div>

                <!-- Fila 5: Notas (ancho completo) -->
                <div class="info-item full-width">
                    <div class="info-icon"><i class="fa fa-sticky-note-o"></i></div>
                    <div class="info-content">
                        <label>Notas</label>
                        <p class="info-value">${contrato.notas_domicilio || 'Sin notas adicionales'}</p>
                    </div>
                </div>
            </div>
        `;

        // Configurar botón ver contrato
        btnVer.onclick = () => {
            // Aquí podrías abrir un modal de edición o mostrar detalles completos
            console.log('Ver contrato:', contrato.id_contrato);
            alert('Función "Ver Contrato" en desarrollo. ID: ' + contrato.id_contrato);
        };

        if (modal) {
            console.log('✅ Modal encontrado, estableciendo display a flex');
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'flex-start';
            console.log('✅ Modal estilos aplicados:', modal.style.display, modal.style.justifyContent);
        } else {
            console.error('❌ Modal no encontrado en DOM');
        }
    };

    // Función para cerrar modal de evento
    window.cerrarModalContratoEvento = function () {
        const modal = document.getElementById('contratoEventoModal');
        if (modal) {
            modal.style.display = 'none';
        }
    };

    // Function to switch tabs
    const switchTab = (targetId) => {
        sections.forEach(section => {
            if (section.id === targetId) {
                section.classList.add('active');
                if (targetId === 'calendar') {
                    setTimeout(() => {
                        showCalendar();
                    }, 100);
                } else if (targetId === 'preview-view') {
                    updatePreview();
                }
            } else {
                section.classList.remove('active');
            }
        });

        tabs.forEach(tab => {
            if (tab.dataset.target === targetId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    };

    // Event listeners for tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.target;
            switchTab(targetId);
        });
    });

    // Initialize dashboard charts
    const initDashboard = () => {
        // Chart 1: Activos y Concluidos (Stacked Bar)
        const stackedBarCtx = document.getElementById('stackedBarChart').getContext('2d');
        new Chart(stackedBarCtx, {
            type: 'bar',
            data: {
                labels: ['Elemento 1', 'Elemento 2', 'Elemento 3', 'Elemento 4'],
                datasets: [
                    { label: 'Serie 1', data: [10, 12, 15, 20], backgroundColor: 'rgba(173, 216, 230, 1)' },
                    { label: 'Serie 2', data: [5, 8, 11, 6], backgroundColor: 'rgba(70, 130, 180, 1)' },
                    { label: 'Serie 3', data: [5, 2, 10, 18], backgroundColor: 'rgba(0, 51, 102, 1)' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });

        // Chart 2: Contratos por Mes (Line)
        const lineChartCtx = document.getElementById('lineChart').getContext('2d');
        new Chart(lineChartCtx, {
            type: 'line',
            data: {
                labels: ['Elemento 1', 'Elemento 2', 'Elemento 3', 'Elemento 4', 'Elemento 5'],
                datasets: [
                    { label: 'Serie 1', data: [12, 4, 29, 15, 40], borderColor: 'rgba(70, 130, 180, 1)', tension: 0.1, fill: false },
                    { label: 'Serie 2', data: [18, 38, 25, 20, 42], borderColor: 'rgba(0, 51, 102, 1)', tension: 0.1, fill: false },
                    { label: 'Serie 3', data: [0, 15, 10, 30, 50], borderColor: 'rgba(173, 216, 230, 1)', tension: 0.1, fill: false }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    };

    // Cerrar modal del evento al hacer clic fuera
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('contratoEventoModal');
        if (modal && e.target === modal) {
            cerrarModalContratoEvento();
        }
    });

    // Set initial tab and load dashboard
    switchTab('dashboard');
    initDashboard();
    
    // Load contracts for calendar
    if (typeof cargarContratos === 'function') {
        cargarContratos();
    }
});
