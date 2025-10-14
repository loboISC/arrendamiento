// Detectar si estamos en Electron y definir entorno
const isElectron = window && window.process && window.process.type;
const isDevelopment = isElectron || window.location.hostname === 'localhost';

// Mapeo de columnas del reporte (Header, keys internas, estilos)
const columnsMap = {
    'clave-imagen': { header: 'CLAVE / IMAGEN', key: ['clave', 'img'], classes: 'text-gray-900 font-medium' },
    'nombre-descripcion': { header: 'NOMBRE / DESCRIPCIÓN', key: ['name', 'description'], classes: 'text-gray-600' },
    almacenes: { header: 'Almacén', key: 'almacen', classes: 'text-gray-600' },
    pventa: { header: 'P. Venta', key: 'pVenta', classes: 'text-green-700 font-semibold text-right nowrap-cell' },
    prenta: { header: 'P. Renta', key: 'pRenta', classes: 'text-blue-700 font-semibold text-right nowrap-cell' },
};

// Definición de anchos fijos para la distribución
const columnWidths = {
    'clave-imagen': '18%',
    'nombre-descripcion': '32%',
    almacenes: '18%',
    pventa: '16%',
    prenta: '16%',
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
                            'style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">' +
                            '</div>';
                    }
                    rowContent += '<td class="' + cellClass + '">' + claveImagenContent + '</td>';
                    break;

                case 'nombre-descripcion':
                    let nombreDescContent = '';
                    if (showNombre) {
                        nombreDescContent += '<div class="font-semibold" style="font-size: 12px;">' + product.name + '</div>';
                    }
                    if (showDescripcion && product.description) {
                        nombreDescContent += '<div class="product-description mt-1">' + 
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

// Función optimizada para generar PDF usando html2canvas + jsPDF directamente
async function generatePDF() {
    const printButton = document.getElementById('download-pdf-btn');
    const pdfElement = document.getElementById('pdf-template');
    
    if (!pdfElement) {
        showModal("Error: No se encontró el elemento para generar el PDF", true);
        return;
    }

    try {
        showModal("Preparando documento...", false);
        printButton.disabled = true;

        // Esperar un momento para que el modal se muestre
        await new Promise(resolve => setTimeout(resolve, 200));

        const now = new Date();
        const dateStr = now.toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).replace(/\//g, '-');
        
        // Debug: verificar que el contenido esté presente
        const tableBody = pdfElement.querySelector('#products-table-body');
        const tableHead = pdfElement.querySelector('#products-table-head');
        console.log('Contenido de la tabla:', {
            hasTableBody: !!tableBody,
            hasTableHead: !!tableHead,
            bodyRows: tableBody ? tableBody.children.length : 0,
            headRows: tableHead ? tableHead.children.length : 0
        });
        
        // Si no hay contenido en la tabla, regenerarla
        if (!tableBody || tableBody.children.length === 0) {
            console.log('Regenerando tabla antes de generar PDF...');
            
            // Si no hay datos de productos, cargarlos
            if (productData.length === 0) {
                console.log('Cargando datos de productos...');
                await cargarDatosInventario();
            }
            
            renderTable();
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        showModal("Capturando imagen del documento...", false);
        
        // Asegurar que el elemento esté visible
        pdfElement.scrollIntoView({ behavior: 'instant', block: 'start' });
        await new Promise(resolve => setTimeout(resolve, 300));

        // Usar html2canvas directamente para mejor control
        const canvas = await html2canvas(pdfElement, {
            scale: 1.2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false,
            width: pdfElement.offsetWidth,
            height: pdfElement.offsetHeight,
            scrollX: 0,
            scrollY: 0,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            x: 0,
            y: 0
        });

        console.log('Canvas generado:', {
            width: canvas.width,
            height: canvas.height,
            dataURL: canvas.toDataURL('image/jpeg', 0.1).substring(0, 100) + '...'
        });

        // Verificar que el canvas no esté vacío
        if (canvas.width === 0 || canvas.height === 0) {
            throw new Error('El canvas generado está vacío');
        }

        showModal("Generando PDF...", false);

        // Crear PDF con jsPDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Calcular dimensiones para ajustar a A4 con márgenes
        const margin = 8; // Margen en mm
        const imgWidth = 210 - (margin * 2); // A4 width minus margins
        const pageHeight = 297 - (margin * 2); // A4 height minus margins
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Crear PDF con paginación inteligente
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        
        if (imgHeight <= pageHeight) {
            // Si cabe en una página, agregarlo directamente
            pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
        } else {
            // Si es más alto que una página, usar paginación inteligente con detección de filas
            await addImageWithSmartPagination(pdf, canvas, imgData, margin, imgWidth, imgHeight, pageHeight);
        }

        // Agregar numeración de páginas
        const totalPages = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(128);
            pdf.text(
                `Página ${i} de ${totalPages}`, 
                imgWidth - 30, 
                pageHeight - 5
            );
        }

        // Guardar el PDF
        pdf.save(`reporte_inventario_${dateStr}.pdf`);
        
        closeModal();
        showModal("PDF generado y descargado exitosamente", false);
        
    } catch (error) {
        console.error("Error al generar el PDF:", error);
        
        // Intentar método de respaldo con window.print()
        try {
            showModal("Intentando método alternativo...", false);
            await generatePDFWithPrint();
        } catch (fallbackError) {
            console.error("Error en método de respaldo:", fallbackError);
            showModal(`Error al generar el PDF: ${error.message}`, true);
        }
    } finally {
        printButton.disabled = false;
    }
}

// Función para paginación inteligente que evita cortar filas
async function addImageWithSmartPagination(pdf, canvas, imgData, margin, imgWidth, imgHeight, pageHeight) {
    const pdfElement = document.getElementById('pdf-template');
    const table = pdfElement.querySelector('#products-table');
    
    if (!table) {
        // Si no hay tabla, usar paginación simple
        let currentY = margin;
        let remainingHeight = imgHeight;
        let sourceY = 0;
        
        while (remainingHeight > 0) {
            const availableHeight = pageHeight - (currentY - margin);
            const sliceHeight = Math.min(availableHeight, remainingHeight);
            
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCanvas.width = canvas.width;
            tempCanvas.height = (sliceHeight / imgHeight) * canvas.height;
            
            tempCtx.drawImage(
                canvas,
                0, (sourceY / imgHeight) * canvas.height,
                canvas.width, tempCanvas.height,
                0, 0,
                canvas.width, tempCanvas.height
            );
            
            const tempImgData = tempCanvas.toDataURL('image/jpeg', 0.9);
            pdf.addImage(tempImgData, 'JPEG', margin, currentY, imgWidth, sliceHeight);
            
            remainingHeight -= sliceHeight;
            sourceY += sliceHeight;
            
            if (remainingHeight > 0) {
                pdf.addPage();
                currentY = margin;
            }
        }
        return;
    }

    // Calcular la altura aproximada del encabezado
    const header = pdfElement.querySelector('header');
    const headerRect = header ? header.getBoundingClientRect() : { height: 0 };
    const headerHeight = (headerRect.height / pdfElement.offsetHeight) * imgHeight;
    
    // Calcular cuántas filas caben por página (aproximadamente)
    const tableRows = table.querySelectorAll('tbody tr');
    if (tableRows.length === 0) {
        // Si no hay filas, usar paginación simple
        pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, Math.min(imgHeight, pageHeight));
        return;
    }
    
    // Estimar altura por fila
    const firstRowRect = tableRows[0].getBoundingClientRect();
    const rowHeight = (firstRowRect.height / pdfElement.offsetHeight) * imgHeight;
    
    // Calcular cuántas filas caben por página
    const availableHeightForRows = pageHeight - headerHeight - 20; // 20mm para márgenes y pie
    const rowsPerPage = Math.floor(availableHeightForRows / rowHeight);
    
    console.log('Paginación inteligente:', {
        totalRows: tableRows.length,
        rowHeight: rowHeight,
        rowsPerPage: rowsPerPage,
        headerHeight: headerHeight
    });
    
    // Dividir en páginas basado en filas completas
    let currentRow = 0;
    let currentY = margin;
    
    while (currentRow < tableRows.length) {
        const rowsInThisPage = Math.min(rowsPerPage, tableRows.length - currentRow);
        const pageContentHeight = headerHeight + (rowsInThisPage * rowHeight) + 10; // 10mm buffer
        
        // Calcular la posición Y de inicio y fin para esta página
        const startY = currentRow === 0 ? 0 : headerHeight + (currentRow * rowHeight);
        const endY = startY + pageContentHeight;
        
        // Crear canvas para esta página
        const pageCanvas = document.createElement('canvas');
        const pageCtx = pageCanvas.getContext('2d');
        
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min((pageContentHeight / imgHeight) * canvas.height, canvas.height - (startY / imgHeight) * canvas.height);
        
        // Dibujar la sección correspondiente
        pageCtx.drawImage(
            canvas,
            0, (startY / imgHeight) * canvas.height,
            canvas.width, pageCanvas.height,
            0, 0,
            canvas.width, pageCanvas.height
        );
        
        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.9);
        const pageImgHeight = (pageCanvas.height / canvas.height) * imgHeight;
        
        pdf.addImage(pageImgData, 'JPEG', margin, currentY, imgWidth, pageImgHeight);
        
        currentRow += rowsInThisPage;
        
        if (currentRow < tableRows.length) {
            pdf.addPage();
            currentY = margin;
        }
    }
}

// Función de respaldo usando window.print()
async function generatePDFWithPrint() {
    const pdfElement = document.getElementById('pdf-template');
    
    // Crear estilos específicos para impresión
    const printStyles = `
        <style>
            @media print {
                * { -webkit-print-color-adjust: exact !important; }
                body { margin: 0; padding: 0; }
                .document-container { 
                    width: 100% !important; 
                    margin: 0 !important; 
                    padding: 10mm !important;
                    box-shadow: none !important;
                }
                .products-table { width: 100% !important; }
                .products-table td, .products-table th { 
                    border: 1px solid #000 !important; 
                    padding: 4px !important;
                }
            }
        </style>
    `;
    
    // Crear ventana de impresión
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Reporte de Inventario</title>
                ${printStyles}
                <style>
                    body { font-family: Arial, sans-serif; }
                    .color-primary { color: #1D3768; }
                    .bg-secondary-light { background-color: #e6e9f1; }
                    .text-header-fix { font-size: 10px; line-height: 1.1; }
                </style>
            </head>
            <body>
                ${pdfElement.outerHTML}
            </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        setTimeout(() => {
            printWindow.close();
            closeModal();
            showModal("Documento enviado a impresión. Use 'Guardar como PDF' en el diálogo de impresión.", false);
        }, 1000);
    }, 500);
}

// Función de respaldo más simple para generar PDF
async function generatePDFSimple() {
    const pdfElement = document.getElementById('pdf-template');
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).replace(/\//g, '-');
    
    const opt = {
        filename: `reporte_inventario_${dateStr}.pdf`,
        margin: [10, 10, 10, 10],
        image: { type: 'jpeg', quality: 0.8 },
        html2canvas: {
            scale: 1,
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: '#ffffff'
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait'
        }
    };

    await html2pdf()
        .set(opt)
        .from(pdfElement)
        .save();
    
    closeModal();
    showModal("PDF generado con método alternativo", false);
}

// Función para imprimir (separada del PDF)
function printReport() {
    const element = document.getElementById('pdf-template');
    
    // Crear una nueva ventana para la impresión
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Reporte de Inventario - Impresión</title>');
    
    // Copiar todos los estilos
    document.querySelectorAll('link[rel=stylesheet], style').forEach(node => {
        printWindow.document.write(node.outerHTML);
    });
    
    printWindow.document.write('</head><body>');
    printWindow.document.write(element.outerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

// Función de prueba para generar PDF básico usando el nuevo método
async function generateTestPDF() {
    try {
        showModal("Generando PDF de prueba...", false);
        
        // Crear un elemento simple para probar
        const testElement = document.createElement('div');
        testElement.style.width = '794px'; // 210mm en pixels
        testElement.style.height = '1123px'; // 297mm en pixels
        testElement.style.backgroundColor = '#ffffff';
        testElement.style.padding = '20px';
        testElement.style.fontFamily = 'Arial, sans-serif';
        testElement.style.boxSizing = 'border-box';
        testElement.innerHTML = `
            <h1 style="color: #1D3768; text-align: center; margin-bottom: 20px; font-size: 24px;">Reporte de Inventario - PRUEBA</h1>
            <p style="margin-bottom: 10px; font-size: 14px;"><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
            <p style="margin-bottom: 10px; font-size: 14px;"><strong>Empresa:</strong> Andamios y Proyectos Torres S.A. de C.V.</p>
            <p style="margin-bottom: 20px; font-size: 14px;"><strong>Estado:</strong> PDF de prueba generado correctamente</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px;">
                <thead>
                    <tr style="background-color: #e6e9f1;">
                        <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Producto</th>
                        <th style="border: 1px solid #ccc; padding: 8px; text-align: left;">Precio</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="border: 1px solid #ccc; padding: 8px;">Andamio Estándar</td>
                        <td style="border: 1px solid #ccc; padding: 8px;">$1,500.00</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #ccc; padding: 8px;">Arnés de Seguridad</td>
                        <td style="border: 1px solid #ccc; padding: 8px;">$850.00</td>
                    </tr>
                </tbody>
            </table>
            
            <p style="margin-top: 30px; text-align: center; color: #666; font-size: 12px;">
                Este es un PDF de prueba para verificar que la generación funciona correctamente.
            </p>
        `;
        
        // Agregar temporalmente al DOM
        testElement.style.position = 'absolute';
        testElement.style.left = '-9999px';
        testElement.style.top = '0';
        document.body.appendChild(testElement);
        
        // Esperar a que se renderice
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Usar html2canvas directamente
        const canvas = await html2canvas(testElement, {
            scale: 2,
            useCORS: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            logging: false
        });

        // Crear PDF con jsPDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const imgWidth = 210;
        const pageHeight = 295;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

        const now = new Date();
        const dateStr = now.toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        }).replace(/\//g, '-');
        
        pdf.save(`reporte_inventario_prueba_${dateStr}.pdf`);
        
        // Limpiar
        document.body.removeChild(testElement);
        
        closeModal();
        showModal("PDF de prueba generado exitosamente", false);
        
    } catch (error) {
        console.error("Error en PDF de prueba:", error);
        showModal(`Error en PDF de prueba: ${error.message}`, true);
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

        // Lógica mejorada para el salto de página
        const tableElement = document.getElementById('products-table');
        const rowsPerPage = 10; // Reducimos el número de filas por página para mejor legibilidad
        
        // Remover clases anteriores de salto de página
        document.querySelectorAll('.page-break-after').forEach(el => {
            el.classList.remove('page-break-after');
        });
        
        // Aplicar saltos de página basados en el número de filas
        if (productData && productData.length > 0) {
            const rows = tableElement.querySelectorAll('tbody tr');
            rows.forEach((row, index) => {
                if ((index + 1) % rowsPerPage === 0 && index < rows.length - 1) {
                    row.classList.add('page-break-after');
                }
            });
        }
        
        // Configurar el botón de generar PDF
        const printButton = document.getElementById('download-pdf-btn');
        printButton.addEventListener('click', () => {
            generatePDF();
        });

        // Inicializar controles y cargar datos
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
