// Solución simple para generar PDF que se ve exactamente como la vista previa
let __pdfRunning = false;

function generatePDF() {
    if (__pdfRunning) return;
    __pdfRunning = true;

    const elem = document.getElementById('pdf-template');
    if (!elem) {
        __pdfRunning = false;
        return;
    }

    // Preparar el documento para PDF
    try {
        document.body.classList.add('pdf-mode');
    } catch (_) { }

    const opt = {
        margin: [3, 3, 5, 3],
        filename: `reporte_cotizaciones_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: {
            scale: 3,
            useCORS: true,
            logging: false,
            letterRendering: true,
            allowTaint: false,
            backgroundColor: '#ffffff',
            scrollY: 0,
            scrollX: 0,
            windowWidth: elem.scrollWidth,
            windowHeight: elem.scrollHeight
        },
        pagebreak: {
            mode: ['avoid-all', 'css', 'legacy'],
            before: '.page-break-before',
            after: '.page-break-after',
            avoid: ['.avoid-break', 'header.print-header', '.header-content', '#client-block', '#observaciones-block']
        },
        jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
            compress: true
        }
    };

    const cleanup = () => {
        try {
            document.body.classList.remove('pdf-mode');
        } catch (_) { }
        __pdfRunning = false;
    };

    window.html2pdf()
        .set(opt)
        .from(elem)
        .save()
        .then(cleanup)
        .catch((err) => {
            console.error('Error generando PDF:', err);
            cleanup();
        });
}

function printReport() { window.print(); }
function generateTestPDF() { generatePDF(); }
function generatePDFWithPrint() { generatePDF(); }
