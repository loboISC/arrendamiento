jest.mock('qrcode', () => ({
    toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,qr-test'))
}));

const mockSetViewport = jest.fn(() => Promise.resolve());
const mockSetContent = jest.fn(() => Promise.resolve());
const mockPdf = jest.fn(() => Promise.resolve(Buffer.from('%PDF-test')));
const mockClose = jest.fn(() => Promise.resolve());
const mockNewPage = jest.fn(() => Promise.resolve({
    setViewport: mockSetViewport,
    setContent: mockSetContent,
    pdf: mockPdf
}));

jest.mock('puppeteer', () => ({
    launch: jest.fn(() => Promise.resolve({ newPage: mockNewPage, close: mockClose }))
}));

const PDFService = require('../../src/server/services/pdfService');

const facturaBase = {
    isPreview: false,
    emisor: { rfc: 'APT100310EC2' },
    receptor: {
        nombre: 'CLIENTE DE PRUEBA',
        rfc: 'XAXX010101000',
        regimenFiscal: '601',
        codigoPostal: '01234',
        colonia: 'CENTRO',
        municipio: 'CDMX',
        estado: 'CDMX',
        pais: 'MEXICO',
        direccion: 'CALLE 1',
        usoCfdi: 'G03'
    },
    comprobante: {
        tipoComprobanteTexto: 'I-Ingreso',
        moneda: 'MXN',
        tipoCambio: 1
    },
    cfdiInfo: {
        uuid: '04e411c4-b7aa-4341-91e2-da80a20de557',
        folio: 'A-123',
        fechaEmision: '2026-05-29T13:28:47',
        fechaTimbrado: '2026-05-29T13:28:47',
        certificadoSAT: '30001000000500003456',
        noCertificadoEmisor: '30001000000500003416',
        selloDigital: 'SELLODIGITAL12345678',
        selloSAT: 'SELLOSAT',
        cadenaOriginal: 'CADENA ORIGINAL'
    },
    totales: {
        subtotal: 560.34,
        iva: 89.65,
        total: 649.99,
        metodoPago: 'PUE',
        formaPago: '03'
    },
    factura: { hayDescuentos: false },
    conceptos: [
        {
            claveProductoServicio: '72141700',
            cantidad: 1,
            claveUnidad: 'E48',
            unidad: 'SERVICIO',
            descripcion: 'RENTA DE ANDAMIOS',
            precio: 560.34,
            importe: 560.34
        }
    ]
};

describe('PDFService CFDI layout', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('reserva suficiente espacio para que el header nativo no tape receptor y conceptos', async () => {
        const service = new PDFService();

        await service.generarPDFFactura(facturaBase);

        expect(mockPdf).toHaveBeenCalledTimes(1);
        expect(mockPdf.mock.calls[0][0].margin).toEqual({ top: '58mm', right: '0', bottom: '55mm', left: '0' });
        expect(mockPdf.mock.calls[0][0]).not.toHaveProperty('preferCSSPageSize');
    });

    it('no inyecta @page margin 0 porque invade header y footer nativos', async () => {
        const service = new PDFService();

        await service.generarPDFFactura(facturaBase);

        const html = mockSetContent.mock.calls[0][0];
        expect(html).toContain('Datos del Receptor');
        expect(html).toContain('RENTA DE ANDAMIOS');
        expect(html).toContain('CANTIDAD CON LETRA');
        expect(html).not.toContain('((');
        expect(html).not.toContain('@page { size: Letter; margin: 0; }');
    });

    it('manda totales a otra pagina cuando facturas relacionadas consumen espacio', async () => {
        const service = new PDFService();
        const facturaConRelacionados = {
            ...facturaBase,
            relacionados: { tipoRelacion: '01', foliosFiscales: ['c72456ab-aa77-43a8-85c4-bd6b5ea6a727'] },
            conceptos: Array.from({ length: 4 }, (_, i) => ({
                ...facturaBase.conceptos[0],
                descripcion: `RENTA DE ANDAMIOS ${i + 1}`
            }))
        };

        await service.generarPDFFactura(facturaConRelacionados);

        const html = mockSetContent.mock.calls[0][0];
        const relatedIndex = html.indexOf('Información de pago y documento relacionado');
        const totalsIndex = html.indexOf('CANTIDAD CON LETRA');
        expect(relatedIndex).toBeGreaterThan(-1);
        expect(totalsIndex).toBeGreaterThan(relatedIndex);
        expect(html).toContain('page-break-after: always;');
    });
});
