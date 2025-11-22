
// ========== FUNCIÓN PARA GENERAR PDF CON HEADER REPETIDO ==========
async function generatePDF() {
    const elem = document.getElementById('pdf-template');
    if (!elem) {
        alert('No se encontró el elemento del reporte');
        return;
    }

    try {
        // Mostrar indicador de carga
        console.log('Generando PDF...');

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
            compress: true
        });

        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 4;

        // Capturar TODO el documento con alta calidad
        const scale = 3;
        const fullCanvas = await html2canvas(elem, {
            scale,
            useCORS: true,
            logging: false,
            letterRendering: true,
            backgroundColor: '#ffffff',
            windowWidth: elem.scrollWidth,
            windowHeight: elem.scrollHeight
        });

        const containerRect = elem.getBoundingClientRect();

        // Calcular altura del header (solo banner) y del footer
        const headerElement = elem.querySelector('header.print-header');
        const footerElement = elem.querySelector('.print-footer');

        let headerHeightPx = 0;
        if (headerElement) {
            headerHeightPx = headerElement.offsetHeight * scale;
        }

        let footerHeightPx = 0;
        if (footerElement) {
            footerHeightPx = footerElement.offsetHeight * scale;
        }

        // Calcular límites de filas para evitar cortes a la mitad
        const rowBounds = Array.from(elem.querySelectorAll('.cr-table--summary tbody tr')).map(row => {
            const rect = row.getBoundingClientRect();
            const top = (rect.top - containerRect.top) * scale;
            const bottom = (rect.bottom - containerRect.top) * scale;
            return { top, bottom, height: bottom - top };
        }).filter(bound => bound.bottom > bound.top).sort((a, b) => a.top - b.top);

        // Convertir dimensiones a mm
        const imgWidth = pageWidth - (2 * margin);
        const imgHeight = (fullCanvas.height * imgWidth) / fullCanvas.width;
        const headerHeightMM = (headerHeightPx * imgWidth) / fullCanvas.width;
        const footerHeightMM = (footerHeightPx * imgWidth) / fullCanvas.width;

        // Espacio disponible para contenido en cada página (entre header y footer)
        const contentHeightPerPage = pageHeight - headerHeightMM - footerHeightMM - (2 * margin);

        const pxPerMm = fullCanvas.height / imgHeight;
        const maxContentSlicePx = contentHeightPerPage * pxPerMm;
        const minContentSlicePx = Math.max(40, 12 * pxPerMm);
        const rowTolerancePx = 6;
        let rowCursor = 0;

        // Calcular número de páginas
        const totalContentHeightMM = imgHeight - headerHeightMM - footerHeightMM;
        const numPages = Math.max(1, Math.ceil(totalContentHeightMM / contentHeightPerPage));

        console.log(`Generando ${numPages} página(s)...`);

        // Generar cada página
        for (let pageNum = 0; pageNum < numPages; pageNum++) {
            if (pageNum > 0) {
                pdf.addPage();
            }

            // 1. Agregar el header en cada página
            const headerCanvas = document.createElement('canvas');
            headerCanvas.width = fullCanvas.width;
            headerCanvas.height = headerHeightPx;

            const headerCtx = headerCanvas.getContext('2d');
            headerCtx.drawImage(
                fullCanvas,
                0, 0, fullCanvas.width, headerHeightPx,
                0, 0, fullCanvas.width, headerHeightPx
            );

            const headerImgData = headerCanvas.toDataURL('image/jpeg', 0.98);
            pdf.addImage(headerImgData, 'JPEG', margin, margin, imgWidth, headerHeightMM);

            // 2. Agregar el contenido de esta página (entre header y footer)
            const contentStartY = headerHeightPx + (pageNum * maxContentSlicePx);
            let contentHeight = Math.min(
                maxContentSlicePx,
                fullCanvas.height - contentStartY - footerHeightPx
            );

            if (contentHeight > 0 && rowBounds.length) {
                // Avanzar cursor hasta la primera fila que esté después del inicio de la página
                while (rowCursor < rowBounds.length && rowBounds[rowCursor].bottom <= contentStartY + rowTolerancePx) {
                    rowCursor++;
                }

                const candidateRow = rowBounds[rowCursor];
                if (candidateRow) {
                    const sliceEnd = contentStartY + contentHeight;
                    const rowCrossesSlice = candidateRow.top < sliceEnd - rowTolerancePx && candidateRow.bottom > sliceEnd + rowTolerancePx;
                    const rowFitsPage = candidateRow.height < maxContentSlicePx - rowTolerancePx;
                    const spaceBeforeRow = candidateRow.top - contentStartY;

                    if (rowCrossesSlice && rowFitsPage && spaceBeforeRow >= minContentSlicePx) {
                        contentHeight = spaceBeforeRow;
                    }
                }
            }

            if (contentHeight > 0) {
                const contentCanvas = document.createElement('canvas');
                contentCanvas.width = fullCanvas.width;
                contentCanvas.height = contentHeight;

                const contentCtx = contentCanvas.getContext('2d');
                contentCtx.drawImage(
                    fullCanvas,
                    0, contentStartY,
                    fullCanvas.width, contentHeight,
                    0, 0,
                    fullCanvas.width, contentHeight
                );

                const contentImgData = contentCanvas.toDataURL('image/jpeg', 0.98);
                const contentHeightMM = (contentHeight * imgWidth) / fullCanvas.width;

                pdf.addImage(
                    contentImgData,
                    'JPEG',
                    margin,
                    margin + headerHeightMM,
                    imgWidth,
                    contentHeightMM
                );
            }

            // 3. Agregar el footer en cada página (si existe)
            if (footerHeightPx > 0) {
                const footerCanvas = document.createElement('canvas');
                footerCanvas.width = fullCanvas.width;
                footerCanvas.height = footerHeightPx;

                const footerCtx = footerCanvas.getContext('2d');
                footerCtx.drawImage(
                    fullCanvas,
                    0,
                    fullCanvas.height - footerHeightPx,
                    fullCanvas.width,
                    footerHeightPx,
                    0,
                    0,
                    fullCanvas.width,
                    footerHeightPx
                );

                const footerImgData = footerCanvas.toDataURL('image/jpeg', 0.98);
                pdf.addImage(
                    footerImgData,
                    'JPEG',
                    margin,
                    pageHeight - margin - footerHeightMM,
                    imgWidth,
                    footerHeightMM
                );
            }
        }

        // Guardar el PDF
        const filename = `reporte_cotizacion_${Date.now()}.pdf`;
        pdf.save(filename);
        console.log('PDF generado exitosamente:', filename);

    } catch (error) {
        console.error('Error al generar PDF:', error);
        alert('Error al generar el PDF. Por favor intenta de nuevo.');
    }
}

// Conectar el botón
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('download-pdf-btn');
    if (btn) {
        btn.addEventListener('click', generatePDF);
    }
});

// Exponer globalmente
window.generatePDF = generatePDF;
