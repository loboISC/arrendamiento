
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

        // Esperar que fuentes e imágenes carguen para evitar artefactos
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        await waitForImages(elem);

        // Capturar TODO el documento con calidad razonable (evitar memory spikes)
        const scale = 2; // reducido desde 3
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

        // Mejor convertir coordenadas usando la relación entre el canvas y el elemento real
        const ratio = fullCanvas.width / Math.max(1, elem.scrollWidth);

        // Renderizar header y footer por separado para garantizar repetición exacta
        let headerHeightPx = 0;
        let headerTopCanvasPx = 0;
        let headerImgData = null;
        if (headerElement) {
            try {
                const headerCanvasInd = await html2canvas(headerElement, { scale, useCORS: true, backgroundColor: '#ffffff' });
                headerImgData = headerCanvasInd.toDataURL('image/png');
                headerHeightPx = headerCanvasInd.height;
                const hr = headerElement.getBoundingClientRect();
                const containerRect = elem.getBoundingClientRect();
                headerTopCanvasPx = Math.round((hr.top - containerRect.top) * ratio);
            } catch (e) {
                // fallback a medición por rect si html2canvas falla
                const hr = headerElement.getBoundingClientRect();
                const containerRect = elem.getBoundingClientRect();
                headerTopCanvasPx = Math.round((hr.top - containerRect.top) * ratio);
                headerHeightPx = Math.max(1, Math.round(hr.height * ratio));
            }
        }

        let footerHeightPx = 0;
        let footerTopCanvasPx = 0;
        let footerImgData = null;
        if (footerElement) {
            try {
                const footerCanvasInd = await html2canvas(footerElement, { scale, useCORS: true, backgroundColor: '#ffffff' });
                footerImgData = footerCanvasInd.toDataURL('image/png');
                footerHeightPx = footerCanvasInd.height;
                const fr = footerElement.getBoundingClientRect();
                const containerRect = elem.getBoundingClientRect();
                footerTopCanvasPx = Math.round((fr.top - containerRect.top) * ratio);
            } catch (e) {
                const fr = footerElement.getBoundingClientRect();
                const containerRect = elem.getBoundingClientRect();
                footerTopCanvasPx = Math.round((fr.top - containerRect.top) * ratio);
                footerHeightPx = Math.max(1, Math.round(fr.height * ratio));
            }
        }

        // Calcular límites de filas para evitar cortes a la mitad
        const rowBounds = Array.from(elem.querySelectorAll('.cr-table--summary tbody tr')).map(row => {
            const rect = row.getBoundingClientRect();
            const top = Math.round((rect.top - containerRect.top) * ratio);
            const bottom = Math.round((rect.bottom - containerRect.top) * ratio);
            return { top, bottom, height: bottom - top, dom: row };
        }).filter(bound => bound.bottom > bound.top).sort((a, b) => a.top - b.top);

        // Bloques que no deben partirse entre páginas (CONDICIONES, TOTALES, SELLER, etc.)
        const noSplitSelectors = ['.cr-conditions', '#cr-totals-paired-table', '.cr-summary-totals', '#seller-block', '.cr-summary-wrap'];
        const nonSplitBounds = Array.from(new Set(noSplitSelectors.map(s => Array.from(elem.querySelectorAll(s))).flat())).map(node => {
            const rect = node.getBoundingClientRect();
            const top = Math.round((rect.top - containerRect.top) * ratio);
            const bottom = Math.round((rect.bottom - containerRect.top) * ratio);
            return { top, bottom, height: bottom - top, dom: node };
        }).filter(b => b.bottom > b.top).sort((a, b) => a.top - b.top);

        // Convertir dimensiones a mm
        const imgWidth = pageWidth - (2 * margin);
        // mm por canvas-px (ancho en mm entre márgenes dividido entre canvas width)
        const mmPerCanvasPx = imgWidth / fullCanvas.width;

        // convertir alturas header/footer a mm
        const headerHeightMM = headerHeightPx * mmPerCanvasPx;
        const footerHeightMM = footerHeightPx * mmPerCanvasPx;

        // Canvas-equivalente de la altura de página
        const pageHeightCanvasPx = Math.round(pageHeight / mmPerCanvasPx);
        const marginCanvasPx = Math.round(margin / mmPerCanvasPx);

        // Espacio disponible para contenido en canvas-px
        const contentHeightCanvasPx = pageHeightCanvasPx - headerHeightPx - footerHeightPx - (2 * marginCanvasPx);
        const minContentSlicePx = Math.max(40, Math.round(12 / mmPerCanvasPx));
        const rowTolerancePx = Math.round(6 * ratio);
        let rowCursor = 0;

        // Calcular número de páginas (usando canvas px)
        const totalContentHeightCanvasPx = fullCanvas.height - headerHeightPx - footerHeightPx;
        const numPages = Math.max(1, Math.ceil(totalContentHeightCanvasPx / contentHeightCanvasPx));

        console.log(`Generando ${numPages} página(s)...`);

        // Generar cada página
        for (let pageNum = 0; pageNum < numPages; pageNum++) {
            if (pageNum > 0) {
                pdf.addPage();
            }

            // 1. Agregar el header en cada página (usar imagen renderizada del header si está disponible)
            if (headerHeightPx > 0) {
                if (headerImgData) {
                    pdf.addImage(headerImgData, 'PNG', margin, margin, imgWidth, headerHeightMM);
                } else {
                    const headerCanvas = document.createElement('canvas');
                    headerCanvas.width = fullCanvas.width;
                    headerCanvas.height = headerHeightPx;

                    const headerCtx = headerCanvas.getContext('2d');
                    headerCtx.drawImage(
                        fullCanvas,
                        0, headerTopCanvasPx, fullCanvas.width, headerHeightPx,
                        0, 0, fullCanvas.width, headerHeightPx
                    );

                    const headerImgFallback = headerCanvas.toDataURL('image/jpeg', 0.98);
                    pdf.addImage(headerImgFallback, 'JPEG', margin, margin, imgWidth, headerHeightMM);
                }
            }

            // 2. Agregar el contenido de esta página (entre header y footer)
                // posición en canvas del inicio del contenido (justo debajo del header visual)
                const contentTopCanvasPx = headerTopCanvasPx + headerHeightPx;
                const contentStartCanvasPx = contentTopCanvasPx + (pageNum * contentHeightCanvasPx);
            let contentHeight = Math.min(
                contentHeightCanvasPx,
                Math.max(0, fullCanvas.height - contentStartCanvasPx - footerHeightPx)
            );

            if (contentHeight > 0 && rowBounds.length) {
                // Avanzar cursor hasta la primera fila que esté después del inicio de la página
                while (rowCursor < rowBounds.length && rowBounds[rowCursor].bottom <= contentStartCanvasPx + rowTolerancePx) {
                    rowCursor++;
                }

                const candidateRow = rowBounds[rowCursor];
                if (candidateRow) {
                    const sliceEnd = contentStartCanvasPx + contentHeight;
                    const rowCrossesSlice = candidateRow.top < sliceEnd - rowTolerancePx && candidateRow.bottom > sliceEnd + rowTolerancePx;
                    const rowFitsPage = candidateRow.height < contentHeightCanvasPx - rowTolerancePx;
                    const spaceBeforeRow = candidateRow.top - contentStartCanvasPx;

                    if (rowCrossesSlice && rowFitsPage && spaceBeforeRow >= minContentSlicePx) {
                        contentHeight = spaceBeforeRow;
                    }
                }

                // Ajuste adicional: evitar partir bloques importantes (CONDICIONES / TOTALES / SELLER)
                if (nonSplitBounds.length && contentHeight > 0) {
                    const sliceStart = contentStartCanvasPx;
                    let sliceEnd = sliceStart + contentHeight;

                    for (const block of nonSplitBounds) {
                        const crosses = block.top < sliceEnd && block.bottom > sliceEnd; // bloque cruza el final de slice
                        if (crosses) {
                            const blockFullSize = block.bottom - sliceStart; // altura necesaria para incluir el bloque entero en la página
                            // Si podemos incluir el bloque completo en la página actual, amplía el slice para cubrirlo
                            if (block.bottom - sliceStart <= contentHeightCanvasPx) {
                                sliceEnd = block.bottom;
                                contentHeight = sliceEnd - sliceStart;
                                break;
                            } else {
                                // No cabe completo: mover el bloque a la siguiente página (recortar antes del bloque)
                                const newHeight = Math.max(0, block.top - sliceStart);
                                // Si el nuevoHeight es demasiado pequeño, marcamos contenido como 0 para forzar salto de página
                                if (newHeight < minContentSlicePx) {
                                    contentHeight = 0;
                                } else {
                                    contentHeight = newHeight;
                                }
                                break;
                            }
                        }
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
                    0, contentStartCanvasPx,
                    fullCanvas.width, contentHeight,
                    0, 0,
                    fullCanvas.width, contentHeight
                );

                const contentImgData = contentCanvas.toDataURL('image/jpeg', 0.98);
                const contentHeightMM = contentHeight * mmPerCanvasPx;

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
                if (footerImgData) {
                    pdf.addImage(footerImgData, 'PNG', margin, pageHeight - margin - footerHeightMM, imgWidth, footerHeightMM);
                } else {
                    const footerCanvas = document.createElement('canvas');
                    footerCanvas.width = fullCanvas.width;
                    footerCanvas.height = footerHeightPx;

                    const footerCtx = footerCanvas.getContext('2d');
                    footerCtx.drawImage(
                        fullCanvas,
                        0,
                        footerTopCanvasPx,
                        fullCanvas.width,
                        footerHeightPx,
                        0,
                        0,
                        fullCanvas.width,
                        footerHeightPx
                    );

                    const footerImgFallback = footerCanvas.toDataURL('image/jpeg', 0.98);
                    pdf.addImage(
                        footerImgFallback,
                        'JPEG',
                        margin,
                        pageHeight - margin - footerHeightMM,
                        imgWidth,
                        footerHeightMM
                    );
                }
            }
        }

// --- Helpers ---
async function waitForImages(rootElem, timeout = 10000) {
    const imgs = Array.from(rootElem.querySelectorAll('img'));
    const promises = imgs.map(img => {
        return new Promise(resolve => {
            if (img.complete && img.naturalWidth !== 0) return resolve();
            const onLoad = () => { cleanup(); resolve(); };
            const onError = () => { cleanup(); resolve(); };
            function cleanup() { img.removeEventListener('load', onLoad); img.removeEventListener('error', onError); }
            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);
            // fallback timeout
            setTimeout(() => { cleanup(); resolve(); }, timeout);
        });
    });
    await Promise.all(promises);
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
