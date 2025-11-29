/**
 * ========== GENERADOR DE PDF CON PUPPETEER ==========
 * 
 * Ventajas sobre html2canvas + jsPDF:
 * ✅ Texto real seleccionable y buscable
 * ✅ Fidelidad 100% al CSS (flexbox, grid, etc.)
 * ✅ Fuentes renderizadas correctamente
 * ✅ Archivos más pequeños (vectorial vs imagen)
 * ✅ Calidad perfecta a cualquier zoom
 * ✅ Soporte completo de @media print
 */

/**
 * Genera PDF usando Puppeteer en el servidor
 * Mantiene la estética exacta del template para hoja tamaño carta
 */
async function generatePDF() {
    const btn = document.getElementById('download-pdf-btn');
    const originalText = btn ? btn.innerHTML : '';
    
    try {
        // Mostrar indicador de carga
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span style="font-size:1.2rem;">⏳</span> <span>Generando PDF...</span>';
        }
        console.log('[PDF] Iniciando generación con Puppeteer...');

        // Obtener el contenedor del documento
        const docContainer = document.getElementById('pdf-template');
        if (!docContainer) {
            throw new Error('No se encontró el contenedor del documento');
        }

        // Clonar el documento para prepararlo
        const clone = docContainer.cloneNode(true);

        const originalHeader = docContainer.querySelector('header.print-header');
        const originalFooter = docContainer.querySelector('footer.print-footer');
        const headerHeight = originalHeader ? originalHeader.offsetHeight : 0;
        const footerHeight = originalFooter ? originalFooter.offsetHeight : 0;

        // Remover elementos que no deben aparecer en el PDF
        const elementsToRemove = ['#filters-panel', '#preview-title', '.no-print'];
        elementsToRemove.forEach(selector => {
            const el = clone.querySelector(selector);
            if (el) el.remove();
        });
        
        // Ocultar toolbar de controles
        const toolbar = clone.querySelector('.cr-toolbar');
        if (toolbar) toolbar.style.display = 'none';

        // Recopilar todos los estilos de la página
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(el => el.outerHTML)
            .join('\n');

        // Obtener folio para nombre del archivo
        const folioEl = document.getElementById('quote-number');
        const folio = folioEl ? folioEl.textContent.trim() : '';
        const fileName = folio && folio !== '—' 
            ? `cotizacion_${folio.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`
            : `cotizacion_${Date.now()}.pdf`;

        // Construir HTML completo para Puppeteer
        const origin = (window.location && window.location.origin) ? window.location.origin : '';
        const normalizedOrigin = origin ? (origin.endsWith('/') ? origin : `${origin}/`) : '';

        const dynamicTop = headerHeight ? (headerHeight + 16) : 120;
        const dynamicBottom = footerHeight ? (footerHeight + 20) : 120;

        const fullHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cotización PDF</title>
    ${normalizedOrigin ? `<base href="${normalizedOrigin}">` : ''}
    <script src="https://cdn.tailwindcss.com"><\/script>
    ${styles}
    <style id="pdf-dynamic-spacing">
        :root {
            --pdf-margin-top: ${dynamicTop}px;
            --pdf-margin-bottom: ${dynamicBottom}px;
        }
        @media print {
            .print-body {
                padding-bottom: 24px !important;
            }
        }
    </style>
    <style>
        /* === ESTILOS PARA PDF === */
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 0;
            background: white;
            font-family: 'Arial', 'Helvetica', sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body * { font-family: 'Arial', 'Helvetica', sans-serif !important; }

        /* Ocultar elementos de UI */
        #filters-panel, #preview-title, .cr-toolbar, .no-print { display: none !important; }
        
        /* Contenedor principal */
        .document-viewer {
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
        }
        .document-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 4mm 5mm !important;
            box-shadow: none !important;
            border: none !important;
        }
        
        /* Evitar cortes de página en elementos importantes */
        .avoid-break,
        .cr-table--summary tbody tr,
        .cr-summary-totals,
        #seller-block,
        #client-block,
        #observaciones-block,
        .header-content {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        
        /* Imágenes */
        img { max-width: 100% !important; }
        .cr-table--summary td img {
            width: 40px !important;
            height: 40px !important;
            object-fit: cover !important;
        }
        
        /* Tabla de productos */
        .cr-table--summary {
            width: 100% !important;
            border-collapse: collapse !important;
        }
        .cr-table--summary th {
            background: linear-gradient(180deg, #fbfcff 0%, #eef2fb 100%) !important;
            -webkit-print-color-adjust: exact !important;
        }
        .cr-table--summary td, .cr-table--summary th {
            padding: 5px 6px !important;
            font-size: 11px !important;
            border: 1px solid #dee2e6 !important;
        }
        
        /* Totales */
        .cr-totals-paired {
            width: 360px !important;
            margin-left: auto !important;
        }
        .cr-totals-paired td {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
        }
        
        /* Garantía destacada */
        #cr-fin-deposit {
            background: #fff8b3 !important;
            -webkit-print-color-adjust: exact !important;
        }
        
        /* Header */
        .soft-border {
            border: 1px solid #e5e7eb !important;
            border-radius: 6px !important;
        }
        .qp-row {
            background: #f3f4f6 !important;
            -webkit-print-color-adjust: exact !important;
        }
        
        @page {
            size: letter;
            margin: 8mm 6mm;
        }
    </style>
</head>
<body>
    <div class="document-viewer">
        ${clone.outerHTML}
    </div>
</body>
</html>`;

        // Enviar al servidor
        console.log('[PDF] Enviando HTML al servidor...');
        const response = await fetch('/api/pdf/generar/cotizacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                htmlContent: fullHtml,
                fileName: fileName,
                download: true
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error del servidor: ${response.status}`);
        }

        // Descargar el PDF
        console.log('[PDF] Descargando archivo...');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        console.log('[PDF] ✅ Generado exitosamente:', fileName);

    } catch (error) {
        console.error('[PDF] ❌ Error:', error);
        alert('Error al generar el PDF: ' + error.message);
    } finally {
        // Restaurar botón
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// Conectar el botón al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('download-pdf-btn');
    if (btn) {
        btn.addEventListener('click', generatePDF);
    }
});

// Exponer globalmente
window.generatePDF = generatePDF;
