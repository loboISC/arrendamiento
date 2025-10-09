// Detectar si estamos en Electron y definir entorno
const isElectron = window && window.process && window.process.type;
const isDevelopment = isElectron || window.location.hostname === 'localhost';

// Mapeo de columnas del reporte (Header, keys internas, estilos)
const columnsMap = {
    'clave-imagen': { header: 'CLAVE / IMAGEN', key: ['clave', 'img'], classes: 'text-gray-900 font-medium' },
    'nombre-descripcion': { header: 'NOMBRE / DESCRIPCIÓN', key: ['name', 'description'], classes: 'text-gray-600' },
    almacenes: { header: 'Almacén', key: 'almacen', classes: 'text-gray-600' },
    pventa: { header: 'P. Venta', key: 'pVenta', classes: 'text-green-700 font-semibold text-right' },
    prenta: { header: 'P. Renta', key: 'pRenta', classes: 'text-blue-700 font-semibold text-right' },
};

// Definición de anchos fijos para la distribución
const columnWidths = {
    'clave-imagen': '18%',
    'nombre-descripcion': '37%',
    almacenes: '18%',
    pventa: '13%',
    prenta: '14%',
};

// Variable global para almacenar los datos de productos
let productData = [];

// Función para cargar los datos del inventario
async function cargarDatosInventario() {
    try {
        // URL base del servidor - ajustada para desarrollo local
        const baseUrl = isDevelopment || window.location.protocol === 'file:' 
            ? 'http://localhost:3001' 
            : window.location.origin;
        
        console.log('Intentando cargar productos desde:', `${baseUrl}/api/productos`);
        
        const response = await fetch(`${baseUrl}/api/productos`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar los productos: ' + response.statusText);
        }
        
        const data = await response.json();
        console.log('Productos cargados:', data);
        
        if (Array.isArray(data)) {
            // Transformar los datos al formato esperado por el reporte
            productData = data.map(p => ({
                clave: p.clave || '',
                name: p.nombre || '',
                description: p.descripcion || '',
                img: p.imagen || null,
                almacen: p.nombre_almacen || 'Sin asignar',
                pVenta: Number(p.precio_venta) || 0,
                pRenta: Number(p.tarifa_renta) || 0,
                estado: p.estado || 'Activo',
                condicion: p.condicion || 'Nuevo'
            }));
        } else {
            throw new Error('El formato de datos recibido no es válido');
        }
        
        console.log('Datos transformados:', productData);

        if (productData.length === 0) {
            console.warn('No se encontraron productos para mostrar');
            showModal('No se encontraron productos para mostrar', false);
        }

        // Actualizar la UI
        renderTable();
        
    } catch (error) {
        console.error('Error al cargar datos del inventario:', error);
        showModal('Error al cargar los datos del inventario: ' + error.message, true);
        
        // Cargar datos de ejemplo si estamos en modo desarrollo o si no se pudieron cargar los datos reales
        if (isDevelopment || window.location.hostname === 'localhost' || window.location.protocol === 'file:') {
            console.log('Cargando datos de ejemplo para desarrollo...');
            productData = [
                {
                    clave: 'AT-EST-120',
                    img: null,
                    name: 'Andamio Estándar de 1.2m x 1.2m',
                    description: 'Estructura modular reforzada, ideal para trabajos en altura media.',
                    almacen: 'Bodega Principal',
                    pVenta: 1500.00,
                    pRenta: 80.00
                },
                {
                    clave: 'AT-SEG-001',
                    img: null,
                    name: 'Arnés de Seguridad Industrial',
                    description: 'Arnés de cuerpo completo con 4 puntos de anclaje.',
                    almacen: 'Almacén Sur',
                    pVenta: 850.00,
                    pRenta: 45.00
                }
            ];
            console.log('Datos de ejemplo cargados');
            renderTable();
        }
    }
}

// Función para inicializar los controles del formulario
function initializeControls() {
    const filtersForm = document.getElementById('filters-form');
    
    // Inicializar checkboxes con sus estados predeterminados
    const defaultFilters = {
        'filter-clave': true,
        'filter-imagen': true,
        'filter-nombre': true,
        'filter-descripcion': true,
        'filter-almacenes': true,
        'filter-pventa': true,
        'filter-prenta': true
    };

    Object.entries(defaultFilters).forEach(([filterId, defaultValue]) => {
        const checkbox = filtersForm.elements[filterId];
        if (checkbox) {
            checkbox.checked = defaultValue;
            checkbox.addEventListener('change', renderTable);
        }
    });
}


// Sobrescribir la función de renderizado de tabla existente
function renderTable() {
    const tableHead = document.getElementById('products-table-head');
    const tableBody = document.getElementById('products-table-body');
    const emptyMessage = document.getElementById('empty-table-message');
    const form = document.getElementById('filters-form');
    
    // Obtener estado de los filtros
    const showClave = form.elements['filter-clave'].checked;
    const showImagen = form.elements['filter-imagen'].checked;
    const showClaveImagen = showClave || showImagen;
    const showNombre = form.elements['filter-nombre'].checked;
    const showDescripcion = form.elements['filter-descripcion'].checked;
    const showNombreDescripcion = showNombre || showDescripcion;

    // Configurar columnas activas
    let activeColumns = [];
    if (showClaveImagen) activeColumns.push('clave-imagen');
    if (showNombreDescripcion) activeColumns.push('nombre-descripcion');
    if (form.elements['filter-almacenes'].checked) activeColumns.push('almacenes');
    if (form.elements['filter-pventa'].checked) activeColumns.push('pventa');
    if (form.elements['filter-prenta'].checked) activeColumns.push('prenta');

    // Generar encabezado de tabla
    let headHtml = '<tr>';
    activeColumns.forEach(colKey => {
        const column = columnsMap[colKey];
        const width = columnWidths[colKey];
        headHtml += '<th class="text-left p-3 bg-secondary-light border-b border-gray-200 text-header-fix" ' +
                   'style="width: ' + width + '">' +
                   column.header +
                   '</th>';
    });
    headHtml += '</tr>';
    tableHead.innerHTML = headHtml;

    // Generar cuerpo de la tabla
    if (productData.length === 0) {
        emptyMessage.classList.remove('hidden');
        tableBody.innerHTML = '';
        return;
    }
    
    emptyMessage.classList.add('hidden');
    let bodyHtml = '';

    productData.forEach((product, rowIndex) => {
        const rowStyle = rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50';
        let rowContent = '';

        activeColumns.forEach(colKey => {
            const column = columnsMap[colKey];
            const cellClass = 'p-3 ' + column.classes;

            switch (colKey) {
                case 'clave-imagen':
                    let claveImagenContent = '';
                    if (showClave) {
                        claveImagenContent += '<div class="font-medium">' + product.clave + '</div>';
                    }
                    if (showImagen && product.img) {
                        claveImagenContent += '<div class="mt-1">' +
                            '<img src="' + product.img + '" ' +
                            'alt="Imagen ' + product.clave + '" ' +
                            'class="w-16 h-16 object-cover rounded">' +
                            '</div>';
                    }
                    rowContent += '<td class="' + cellClass + '">' + claveImagenContent + '</td>';
                    break;

                case 'nombre-descripcion':
                    let nombreDescContent = '';
                    if (showNombre) {
                        nombreDescContent += '<div class="font-semibold">' + product.name + '</div>';
                    }
                    if (showDescripcion && product.description) {
                        nombreDescContent += '<div class="text-sm text-gray-500 mt-1">' + 
                            product.description + '</div>';
                    }
                    rowContent += '<td class="' + cellClass + '">' + nombreDescContent + '</td>';
                    break;

                case 'almacenes':
                    rowContent += '<td class="' + cellClass + '">' + product.almacen + '</td>';
                    break;

                case 'pventa':
                    rowContent += '<td class="' + cellClass + ' nowrap-cell">$' + 
                        product.pVenta.toFixed(2) + '</td>';
                    break;

                case 'prenta':
                    rowContent += '<td class="' + cellClass + ' nowrap-cell">$' + 
                        product.pRenta.toFixed(2) + '</td>';
                    break;
            }
        });

        bodyHtml += '<tr class="' + rowStyle + '">' + rowContent + '</tr>';
    });

    tableBody.innerHTML = bodyHtml;
}

// Función para mostrar modal
function showModal(message, isError = false) {
    const modal = document.getElementById('modal-notification');
    const modalContent = document.getElementById('modal-content');
    if (!modal || !modalContent) {
        console.error('Elementos del modal no encontrados');
        return;
    }
    
    modalContent.innerHTML = `
        <div class="text-center">
            ${isError ? '<div class="text-red-600 mb-4 text-xl"><i class="fas fa-exclamation-circle"></i></div>' : ''}
            <p class="mb-4">${message}</p>
            ${!isError ? '<button onclick="closeModal()" class="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition">Aceptar</button>' : ''}
        </div>
    `;
    modal.classList.remove('hidden');
}

// Función para cerrar modal
function closeModal() {
    const modal = document.getElementById('modal-notification');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Función para inicializar la aplicación
async function inicializarAplicacion() {
    console.log('Inicializando reporte de inventario...');
    try {
        // Actualizar la fecha y hora
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/');
        const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        document.getElementById('current-date').textContent = dateStr;
        document.getElementById('creation-timestamp').textContent = `${dateStr} ${timeStr} hrs`;

        // Lógica para el salto de página
        const tableElement = document.getElementById('products-table');
        if (productData && productData.length > 10) { 
            tableElement.classList.add('html2pdf__page-break--after');
        } else {
            tableElement.classList.remove('html2pdf__page-break--after');
        }
        
        // Configurar el botón de descarga PDF
        const button = document.getElementById('download-pdf-btn');
        button.addEventListener('click', () => {
            const element = document.getElementById('pdf-template');

            showModal("Generando el PDF. Se abrirá en una nueva ventana para imprimir...", false);
            button.disabled = true;

            const options = {
                margin: [0, 0, 0, 0],
                filename: 'reporte_inventario_personalizado.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { 
                    scale: 2, 
                    logging: false, 
                    dpi: 192, 
                    letterRendering: true,
                    useCORS: true 
                },
                jsPDF: { 
                    unit: 'mm', 
                    format: 'a4', 
                    orientation: 'portrait' 
                },
                pagebreak: { mode: 'css' }
            };

            html2pdf().from(element).set(options).output('dataurlnewwindow').then(() => {
                closeModal();
                button.disabled = false;
            }).catch(error => {
                console.error("Error al generar el PDF:", error);
                showModal("Error: Falló la generación del PDF. Revisa la consola para más detalles.", true);
                button.disabled = false;
            });
        });



        await initializeControls();
        await cargarDatosInventario();
        console.log('Inicialización completada');
    } catch (error) {
        console.error('Error durante la inicialización:', error);
        showModal('Error al inicializar la aplicación: ' + error.message, true);
    }
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', inicializarAplicacion);
