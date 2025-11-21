
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
        const fullCanvas = await html2canvas(elem, {
            scale: 3,
            useCORS: true,
            logging: false,
            letterRendering: true,
            backgroundColor: '#ffffff',
            windowWidth: elem.scrollWidth,
            windowHeight: elem.scrollHeight
        });

        // Calcular la altura del header completo (hasta observaciones)
        const headerElement = elem.querySelector('header.print-header');
        const observacionesBlock = elem.querySelector('#observaciones-block');

        let headerHeightPx = 0;
        if (headerElement && observacionesBlock) {
            const headerRect = headerElement.getBoundingClientRect();
            const obsRect = observacionesBlock.getBoundingClientRect();
            // Altura desde el inicio del header hasta el final de observaciones
            headerHeightPx = (obsRect.bottom - headerRect.top) * 3; // multiplicar por scale
        } else {
            // Fallback: usar solo el header
            headerHeightPx = headerElement ? headerElement.offsetHeight * 3 : 300;
        }

        // Convertir dimensiones a mm
        const imgWidth = pageWidth - (2 * margin);
        const imgHeight = (fullCanvas.height * imgWidth) / fullCanvas.width;
        const headerHeightMM = (headerHeightPx * imgWidth) / fullCanvas.width;

        // Espacio disponible para contenido en cada página
        const contentHeightPerPage = pageHeight - headerHeightMM - (2 * margin);

        // Calcular número de páginas
        const totalContentHeightMM = imgHeight - headerHeightMM;
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

            // 2. Agregar el contenido de esta página
            const contentStartY = headerHeightPx + (pageNum * contentHeightPerPage * (fullCanvas.height / imgHeight));
            const contentHeight = Math.min(
                contentHeightPerPage * (fullCanvas.height / imgHeight),
                fullCanvas.height - contentStartY
            );

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
