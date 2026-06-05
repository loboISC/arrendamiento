const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    normalizarXmlString,
    extraerTotalesDesdeXml,
    extraerXmlDesdeRespuestaFacturama,
    resolverTotalesDesdeTimbrado,
    guardarXmlEnDisco
} = require('../../src/utils/facturacion/xmlUtils');

describe('xmlUtils timbrado', () => {
    const xmlEjemplo = '<?xml version="1.0"?><cfdi:Comprobante SubTotal="4000.00" Descuento="300.00" Total="4292.00" TotalImpuestosTrasladados="592.00" xmlns:cfdi="http://www.sat.gob.mx/cfd/4"><cfdi:Impuestos TotalImpuestosTrasladados="592.00"/></cfdi:Comprobante>';

    it('normaliza XML en base64', () => {
        const b64 = Buffer.from(xmlEjemplo, 'utf8').toString('base64');
        const out = normalizarXmlString(b64);
        expect(out.trim().startsWith('<')).toBe(true);
        expect(out).toContain('SubTotal="4000.00"');
    });

    it('extrae totales desde XML timbrado', () => {
        const totales = extraerTotalesDesdeXml(xmlEjemplo);
        expect(totales.subtotal).toBe(4000);
        expect(totales.descuento).toBe(300);
        expect(totales.total).toBe(4292);
        expect(totales.iva).toBe(592);
    });

    it('extrae XML desde respuesta Facturama con campo cfdi', () => {
        const xml = extraerXmlDesdeRespuestaFacturama({ cfdi: xmlEjemplo });
        expect(xml).toContain('Comprobante');
    });

    it('prioriza totales del XML sobre JSON de Facturama', () => {
        const res = resolverTotalesDesdeTimbrado({
            respuestaFacturama: { Subtotal: 4000, Discount: 0, Total: 4592 },
            xmlTimbrado: xmlEjemplo,
            totalesLocales: { subtotal: 4000, descuento: 300, iva: 592, total: 4292 }
        });
        expect(res.fuente).toBe('xml');
        expect(res.total).toBe(4292);
    });

    it('guarda XML en disco y rechaza contenido vacío', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xml-utils-'));
        const archivo = path.join(dir, 'test.xml');
        guardarXmlEnDisco(xmlEjemplo, archivo);
        const guardado = fs.readFileSync(archivo, 'utf8');
        expect(guardado.length).toBeGreaterThan(50);
        expect(() => guardarXmlEnDisco('', archivo)).toThrow(/vacío/i);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
