const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const htmlPath = path.join(root, 'public/templates/pages/facturacion.html');
const jsPath = path.join(root, 'public/scripts/facturacion/facturacion.js');

describe('facturacion PDF preview action', () => {
    it('renders a PDF preview button beside draft and timbrar actions', () => {
        const html = fs.readFileSync(htmlPath, 'utf8');

        expect(html).toContain('id="btn-vista-previa-pdf"');
        expect(html).toContain('onclick="procesarVistaPreviaPDF()"');
        expect(html).toContain('VISTA PREVIA PDF');
    });

    it('posts current timbrado form data to the preview endpoint and opens returned PDF', () => {
        const js = fs.readFileSync(jsPath, 'utf8');

        expect(js).toContain('async function procesarVistaPreviaPDF()');
        expect(js).toContain('obtenerDatosTimbradoForm()');
        expect(js).toContain("fetch('/api/facturas/vista-previa'");
        expect(js).toContain('window.open(pdfUrl,');
        expect(js).toContain('window.procesarVistaPreviaPDF = procesarVistaPreviaPDF;');
    });
});
