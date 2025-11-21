/**
 * Renderizador de PDFs usando PDF.js
 * Este módulo maneja la visualización de PDFs en canvas
 */

// Configurar PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';

/**
 * Renderizar un PDF en un contenedor específico
 * @param {string} pdfUrl - URL del PDF a renderizar
 * @param {string} containerId - ID del contenedor donde se renderizará
 */
async function renderPDF(pdfUrl, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Contenedor ${containerId} no encontrado`);
        return;
    }

    // Limpiar contenedor
    container.innerHTML = '<div style="text-align: center; padding: 20px;">Cargando PDF...</div>';

    try {
        // Cargar el PDF
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        // Limpiar el mensaje de carga
        container.innerHTML = '';

        // Crear contenedor con scroll
        const pdfContainer = document.createElement('div');
        pdfContainer.style.cssText = 'width: 100%; height: 600px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; background: #525659;';
        container.appendChild(pdfContainer);

        // Renderizar todas las páginas
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);

            // Crear canvas para esta página
            const canvas = document.createElement('canvas');
            canvas.style.cssText = 'display: block; margin: 10px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';

            const context = canvas.getContext('2d');
            const viewport = page.getViewport({ scale: 1.5 });

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Renderizar la página
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            await page.render(renderContext).promise;
            pdfContainer.appendChild(canvas);
        }

        console.log(`PDF renderizado: ${pdf.numPages} páginas`);
    } catch (error) {
        console.error('Error al renderizar PDF:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #d32f2f;">
                <p><strong>Error al cargar el PDF</strong></p>
                <p>${error.message}</p>
                <a href="${pdfUrl.replace('/ver/', '/descargar/')}" target="_blank" style="color: #1976d2; text-decoration: underline;">Descargar PDF</a>
            </div>
        `;
    }
}

/**
 * Limpiar un contenedor de PDF
 * @param {string} containerId - ID del contenedor a limpiar
 */
function clearPDFContainer(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
}
