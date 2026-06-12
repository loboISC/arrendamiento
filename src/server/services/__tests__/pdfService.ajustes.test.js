/**
 * Tests para los 3 ajustes del PDF de factura.
 * TDD: Escribir primero, implementar después.
 *
 * Ajuste 1 — Observaciones (#timb-notas-internas) aparecen en el PDF sobre datos del receptor.
 * Ajuste 2 — Encabezado: C.P. 15530, email facturas@andamiostorres.com, Aviso de Privacidad azul.
 * Ajuste 3 — Régimen Fiscal y Uso CFDI muestran código + descripción SAT.
 */

'use strict';

const PDFService = require('../pdfService');
const pdfService = new PDFService();

// ──────────────────────────────────────────────
// Mocks mínimos para evitar Puppeteer/QR en tests
// ──────────────────────────────────────────────
jest.mock('puppeteer', () => ({
    launch: jest.fn(() => ({
        newPage: jest.fn(() => ({
            setViewport: jest.fn(),
            setContent: jest.fn(),
            pdf: jest.fn().mockResolvedValue(Buffer.from('PDF')),
            close: jest.fn()
        })),
        close: jest.fn()
    }))
}));

jest.mock('qrcode', () => ({
    toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,TEST')
}));

jest.mock('fs', () => ({
    readFileSync: jest.fn(() => '<html><head></head><body></body></html>'),
    existsSync: jest.fn(() => false),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
}));

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function buildFacturaData(overrides = {}) {
    return {
        isPreview: true,
        emisor: { rfc: 'APT100310EC2' },
        receptor: {
            rfc: 'XAXX010101000',
            nombre: 'PUBLICO EN GENERAL',
            regimenFiscal: '612',
            codigoPostal: '06600',
            usoCfdi: 'G03',
            colonia: 'Col',
            localidad: '',
            municipio: 'CDMX',
            estado: 'CDMX',
            pais: 'MEXICO',
            direccion: 'Calle 1'
        },
        cfdiInfo: {
            uuid: '00000000-0000-0000-0000-000000000000',
            folio: 'PREV',
            fechaEmision: new Date().toISOString(),
            fechaTimbrado: 'PENDIENTE',
            certificadoSAT: '0000',
            noCertificadoEmisor: '0000',
            selloDigital: 'ABCDEFGH',
            selloSAT: 'ABCDEFGH',
            cadenaOriginal: '||1.1||'
        },
        factura: { hayDescuentos: false },
        comprobante: {
            tipoComprobante: 'I',
            tipoComprobanteTexto: 'Factura',
            moneda: 'MXN',
            tipoCambio: 1
        },
        totales: {
            subtotal: 100,
            descuento: 0,
            iva: 16,
            total: 116,
            formaPago: '03',
            metodoPago: 'PUE'
        },
        conceptos: [{
            claveProductoServicio: '78101800',
            cantidad: 1,
            claveUnidad: 'E48',
            unidad: 'Servicio',
            descripcion: 'Servicio de prueba',
            valorUnitario: 100,
            precio: 100,
            importe: 100,
            descuento: 0,
            caracteristicas: ''
        }],
        relacionados: null,
        observaciones: '',
        ...overrides
    };
}

// ──────────────────────────────────────────────
// AJUSTE 1 — Observaciones en el PDF
// ──────────────────────────────────────────────
describe('Ajuste 1 — Observaciones sobre datos del receptor', () => {
    it('debe incluir observaciones en el HTML si el campo no está vacío', async () => {
        const data = buildFacturaData({ observaciones: 'Nota de prueba para el cliente' });
        const htmlCaptures = [];

        // Capturar el HTML que se pasa a setContent
        const mockPage = {
            setViewport: jest.fn(),
            setContent: jest.fn((html) => { htmlCaptures.push(html); return Promise.resolve(); }),
            pdf: jest.fn().mockResolvedValue(Buffer.from('PDF'))
        };
        const mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
            close: jest.fn()
        };
        require('puppeteer').launch.mockResolvedValue(mockBrowser);

        await pdfService.generarPDFFactura(data);

        const html = htmlCaptures[0] || '';
        expect(html).toContain('Nota de prueba para el cliente');
    });

    it('NO debe incluir bloque de observaciones si el campo está vacío', async () => {
        const data = buildFacturaData({ observaciones: '' });
        const htmlCaptures = [];

        const mockPage = {
            setViewport: jest.fn(),
            setContent: jest.fn((html) => { htmlCaptures.push(html); return Promise.resolve(); }),
            pdf: jest.fn().mockResolvedValue(Buffer.from('PDF'))
        };
        const mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
            close: jest.fn()
        };
        require('puppeteer').launch.mockResolvedValue(mockBrowser);

        await pdfService.generarPDFFactura(data);

        const html = htmlCaptures[0] || '';
        // El marcador de sección observaciones no debe aparecer cuando está vacío
        expect(html).not.toContain('OBSERVACIONES');
    });

    it('debe colocar observaciones ANTES de los datos del receptor', async () => {
        const data = buildFacturaData({ observaciones: 'Mi observación especial' });
        const htmlCaptures = [];

        const mockPage = {
            setViewport: jest.fn(),
            setContent: jest.fn((html) => { htmlCaptures.push(html); return Promise.resolve(); }),
            pdf: jest.fn().mockResolvedValue(Buffer.from('PDF'))
        };
        const mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
            close: jest.fn()
        };
        require('puppeteer').launch.mockResolvedValue(mockBrowser);

        await pdfService.generarPDFFactura(data);

        const html = htmlCaptures[0] || '';
        const posObs = html.indexOf('Mi observación especial');
        const posReceptor = html.indexOf('receptor-simple-v3');

        expect(posObs).toBeGreaterThan(-1);
        expect(posReceptor).toBeGreaterThan(-1);
        expect(posObs).toBeLessThan(posReceptor);
    });
});

// ──────────────────────────────────────────────
// AJUSTE 2 — Encabezado del PDF
// ──────────────────────────────────────────────
describe('Ajuste 2 — Encabezado: C.P., email y color Aviso de Privacidad', () => {
    async function captureHeader(data) {
        const data2 = data || buildFacturaData();
        let capturedHeader = '';
        const mockPage = {
            setViewport: jest.fn(),
            setContent: jest.fn().mockResolvedValue(),
            pdf: jest.fn(async (opts) => {
                capturedHeader = opts.headerTemplate || '';
                return Buffer.from('PDF');
            })
        };
        const mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
            close: jest.fn()
        };
        require('puppeteer').launch.mockResolvedValue(mockBrowser);
        await pdfService.generarPDFFactura(data2);
        return capturedHeader;
    }

    it('debe mostrar C.P. 15530 en el encabezado', async () => {
        const header = await captureHeader();
        expect(header).toContain('15530');
    });

    it('NO debe mostrar C.P. 15330 en el encabezado (valor antiguo)', async () => {
        const header = await captureHeader();
        expect(header).not.toContain('15330');
    });

    it('debe mostrar facturas@andamiostorres.com en el encabezado', async () => {
        const header = await captureHeader();
        expect(header).toContain('facturas@andamiostorres.com');
    });

    it('NO debe mostrar ventas@andamiostorres.com en el encabezado', async () => {
        const header = await captureHeader();
        expect(header).not.toContain('ventas@andamiostorres.com');
    });

    it('debe usar color #1D4ED8 para el texto del Aviso de Privacidad', async () => {
        const header = await captureHeader();
        expect(header.toLowerCase()).toContain('#1d4ed8');
    });
});

// ──────────────────────────────────────────────
// AJUSTE 3 — Catálogos SAT: código + descripción
// ──────────────────────────────────────────────
describe('Ajuste 3 — Régimen Fiscal y Uso CFDI con descripción SAT', () => {
    async function captureBodyHtml(overrides = {}) {
        const data = buildFacturaData(overrides);
        const htmlCaptures = [];
        const mockPage = {
            setViewport: jest.fn(),
            setContent: jest.fn((html) => { htmlCaptures.push(html); return Promise.resolve(); }),
            pdf: jest.fn().mockResolvedValue(Buffer.from('PDF'))
        };
        const mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
            close: jest.fn()
        };
        require('puppeteer').launch.mockResolvedValue(mockBrowser);
        await pdfService.generarPDFFactura(data);
        return htmlCaptures[0] || '';
    }

    it('debe mostrar descripción del Régimen Fiscal 612', async () => {
        const html = await captureBodyHtml({ receptor: { ...buildFacturaData().receptor, regimenFiscal: '612' } });
        expect(html).toContain('612');
        // Debe contener la descripción del catálogo
        expect(html).toMatch(/612\s*[—\-]\s*Personas Físicas con Actividades Empresariales/i);
    });

    it('debe mostrar descripción del Uso CFDI G03', async () => {
        const html = await captureBodyHtml({ receptor: { ...buildFacturaData().receptor, usoCfdi: 'G03' } });
        expect(html).toContain('G03');
        expect(html).toMatch(/G03\s*[—\-]\s*Gastos en general/i);
    });

    it('debe mostrar descripción del Régimen Fiscal 601', async () => {
        const html = await captureBodyHtml({ receptor: { ...buildFacturaData().receptor, regimenFiscal: '601' } });
        expect(html).toMatch(/601\s*[—\-]\s*General de Ley Personas Morales/i);
    });
});

// ──────────────────────────────────────────────
// TASK 2 — "Clave Prod." prefix in description cell
// ──────────────────────────────────────────────
describe('Task 2 — Prefijo "Clave Prod." en columna de descripción', () => {
    async function captureBodyWithConceptos(conceptos) {
        const data = buildFacturaData({ conceptos });
        const htmlCaptures = [];
        const mockPage = {
            setViewport: jest.fn(),
            setContent: jest.fn((html) => { htmlCaptures.push(html); return Promise.resolve(); }),
            pdf: jest.fn().mockResolvedValue(Buffer.from('PDF'))
        };
        const mockBrowser = {
            newPage: jest.fn().mockResolvedValue(mockPage),
            close: jest.fn()
        };
        require('puppeteer').launch.mockResolvedValue(mockBrowser);
        await pdfService.generarPDFFactura(data);
        return htmlCaptures[0] || '';
    }

    it('debe anteponer "Clave Prod. [noIdentificacion]" a la descripción cuando el campo está presente', async () => {
        const html = await captureBodyWithConceptos([{
            claveProductoServicio: '78101800',
            noIdentificacion: '115',
            cantidad: 1,
            claveUnidad: 'E48',
            unidad: 'Servicio',
            descripcion: 'MARCO 200',
            valorUnitario: 100,
            precio: 100,
            importe: 100,
            descuento: 0,
            caracteristicas: ''
        }]);
        expect(html).toMatch(/Clave Prod\. 115/);
        expect(html).toContain('MARCO 200');
    });

    it('el prefijo debe aparecer ANTES de la descripción en el mismo <td>', async () => {
        const html = await captureBodyWithConceptos([{
            claveProductoServicio: '78101800',
            noIdentificacion: '138',
            cantidad: 2,
            claveUnidad: 'E48',
            unidad: 'Pieza',
            descripcion: 'POSTE TIPO A',
            valorUnitario: 50,
            precio: 50,
            importe: 100,
            descuento: 0,
            caracteristicas: ''
        }]);
        const posClave = html.indexOf('Clave Prod. 138');
        const posDesc = html.indexOf('POSTE TIPO A');
        expect(posClave).toBeGreaterThan(-1);
        expect(posDesc).toBeGreaterThan(-1);
        expect(posClave).toBeLessThan(posDesc);
    });

    it('NO debe mostrar "Clave Prod." cuando noIdentificacion está vacío o ausente', async () => {
        const html = await captureBodyWithConceptos([{
            claveProductoServicio: '78101800',
            noIdentificacion: '',
            cantidad: 1,
            claveUnidad: 'E48',
            unidad: 'Servicio',
            descripcion: 'SERVICIO SIN CLAVE',
            valorUnitario: 200,
            precio: 200,
            importe: 200,
            descuento: 0,
            caracteristicas: ''
        }]);
        expect(html).not.toMatch(/Clave Prod\./);
    });

    it('debe renderizar múltiples conceptos cada uno con su propia clave', async () => {
        const html = await captureBodyWithConceptos([
            {
                claveProductoServicio: '78101800', noIdentificacion: '10',
                cantidad: 1, claveUnidad: 'E48', unidad: 'Pza',
                descripcion: 'ITEM A', valorUnitario: 100, precio: 100,
                importe: 100, descuento: 0, caracteristicas: ''
            },
            {
                claveProductoServicio: '78101800', noIdentificacion: '20',
                cantidad: 1, claveUnidad: 'E48', unidad: 'Pza',
                descripcion: 'ITEM B', valorUnitario: 200, precio: 200,
                importe: 200, descuento: 0, caracteristicas: ''
            }
        ]);
        expect(html).toMatch(/Clave Prod\. 10/);
        expect(html).toMatch(/Clave Prod\. 20/);
    });
});
