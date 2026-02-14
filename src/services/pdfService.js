const puppeteer = require('puppeteer');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

class PDFService {
    constructor() {
        this.templatePath = path.join(__dirname, '../../public/cfdi_template.html');
    }

    async generarPDFFactura(facturaData) {
        let browser = null;
        try {
            // 1. Cargar plantilla
            let html = fs.readFileSync(this.templatePath, 'utf8');

            // 2. Generar QR Code
            const qrData = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${facturaData.cfdiInfo.uuid}&re=${facturaData.emisor.rfc}&rr=${facturaData.receptor.rfc}&tt=${facturaData.totales.total}&fe=${facturaData.cfdiInfo.selloDigital.substring(facturaData.cfdiInfo.selloDigital.length - 8)}`;
            const qrBase64 = await QRCode.toDataURL(qrData);

            // 3. Poblar datos básicos
            const luxon = require('luxon');
            const fechaEmision = luxon.DateTime.fromISO(facturaData.cfdiInfo.fechaEmision).setLocale('es').toFormat('dd/MM/yyyy HH:mm:ss');
            const fechaVencimiento = luxon.DateTime.fromISO(facturaData.cfdiInfo.fechaEmision).plus({ days: 30 }).setLocale('es').toFormat('dd/MM/yyyy');

            // Función simple para cantidad en letra (idealmente usar una librería como numero-a-letras)
            const totalLetra = this.convertirTotalALetra(facturaData.totales.total);

            const replacements = {
                '{{emisor_rfc}}': facturaData.emisor.rfc,
                '{{emisor_regimen}}': facturaData.emisor.regimenFiscal,
                '{{emisor_cp}}': facturaData.emisor.codigoPostal,
                '{{uuid}}': facturaData.cfdiInfo.uuid,
                '{{folio}}': facturaData.cfdiInfo.uuid.substring(0, 8).toUpperCase(),
                '{{fecha_emision}}': fechaEmision,
                '{{fecha_timbrado}}': facturaData.cfdiInfo.fechaTimbrado,
                '{{fecha_vencimiento}}': fechaVencimiento,
                '{{certificado_sat}}': facturaData.cfdiInfo.certificadoSAT,
                '{{certificado_emisor}}': facturaData.cfdiInfo.noCertificadoEmisor,
                '{{receptor_nombre}}': facturaData.receptor.nombre,
                '{{receptor_rfc}}': facturaData.receptor.rfc,
                '{{receptor_regimen}}': facturaData.receptor.regimenFiscal || '612',
                '{{receptor_cp}}': facturaData.receptor.codigoPostal,
                '{{receptor_direccion}}': facturaData.receptor.direccion || 'DOMICILIO CONOCIDO',
                '{{uso_cfdi}}': facturaData.receptor.usoCfdi,
                '{{metodo_pago}}': facturaData.totales.metodoPago === 'PUE' ? 'PUE - Pago en una sola exhibición' : 'PPD - Pago en parcialidades o diferido',
                '{{forma_pago}}': facturaData.totales.formaPago === '03' ? '03 - Transferencia electrónica de fondos' : (facturaData.totales.formaPago || '99 - Por definir'),
                '{{subtotal}}': Number(facturaData.totales.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                '{{total_iva}}': Number(facturaData.totales.iva).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                '{{total}}': Number(facturaData.totales.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                '{{total_letra}}': totalLetra,
                '{{peso_total}}': facturaData.peso_total || '0.00',
                '{{qr_base64}}': qrBase64,
                '{{sello_cfdi}}': facturaData.cfdiInfo.selloDigital,
                '{{sello_sat}}': facturaData.cfdiInfo.selloSAT,
                '{{cadena_original}}': facturaData.cfdiInfo.cadenaOriginal || `||1.1|${facturaData.cfdiInfo.uuid}|${facturaData.cfdiInfo.fechaTimbrado}|${facturaData.emisor.rfc}|${facturaData.cfdiInfo.selloDigital}|${facturaData.cfdiInfo.certificadoSAT}||`
            };

            for (const [key, value] of Object.entries(replacements)) {
                html = html.split(key).join(value);
            }

            // 4. Poblar conceptos (bucle simple)
            const conceptosHtml = facturaData.conceptos.map(c => `
                <tr>
                    <td class="text-center">${c.cantidad}</td>
                    <td class="text-center">${c.claveProductoServicio}</td>
                    <td>${c.descripcion}</td>
                    <td class="text-right">$${Number(c.valorUnitario).toFixed(2)}</td>
                    <td class="text-right">$${Number(c.importe).toFixed(2)}</td>
                </tr>
            `).join('');
            html = html.replace('{{#conceptos}}', '').replace('{{/conceptos}}', '').replace(/<tr>\s*<td class="text-center">\{\{cantidad\}\}<\/td>[\s\S]*?<\/tr>/, conceptosHtml);

            // 5. Renderizar con Puppeteer
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();

            // Inyectar base64 del logo si es necesario, o usar path absoluto
            const publicPath = path.join(__dirname, '../../public');
            const fileBaseUrl = `file://${publicPath.replace(/\\/g, '/')}/`;
            const htmlWithBase = html.replace('<head>', `<head><base href="${fileBaseUrl}">`);

            await page.setContent(htmlWithBase, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'Letter',
                printBackground: true,
                margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
            });

            await browser.close();
            return pdfBuffer;

        } catch (error) {
            if (browser) await browser.close();
            throw error;
        }
    }

    convertirTotalALetra(total) {
        const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
        const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
        const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETENCIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

        const aTexto = (n) => {
            if (n === 0) return 'CERO';
            if (n === 100) return 'CIEN';
            let res = '';
            if (n >= 100) {
                res += centenas[Math.floor(n / 100)] + ' ';
                n %= 100;
            }
            if (n >= 10 && n <= 19) {
                res += especiales[n - 10];
                return res;
            } else if (n >= 20) {
                res += decenas[Math.floor(n / 10)] + (n % 10 !== 0 ? ' Y ' : '');
                n %= 10;
            }
            if (n > 0) res += unidades[n];
            return res;
        };

        const [entero, decimal] = Number(total).toFixed(2).split('.');
        let intVal = parseInt(entero);
        let texto = '';

        if (intVal >= 1000000) {
            const millones = Math.floor(intVal / 1000000);
            texto += (millones === 1 ? 'UN MILLON' : aTexto(millones) + ' MILLONES') + ' ';
            intVal %= 1000000;
        }
        if (intVal >= 1000) {
            const miles = Math.floor(intVal / 1000);
            texto += (miles === 1 ? 'MIL' : aTexto(miles) + ' MIL') + ' ';
            intVal %= 1000;
        }
        if (intVal > 0 || texto === '') {
            texto += aTexto(intVal);
        }

        return `(${texto.trim()} PESOS ${decimal}/100 MN)`;
    }

    async guardarPDF(facturaData, nombreArchivo) {
        try {
            const pdfBuffer = await this.generarPDFFactura(facturaData);
            const rutaArchivo = path.join(__dirname, '../../pdfs', nombreArchivo);

            const dir = path.dirname(rutaArchivo);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(rutaArchivo, pdfBuffer);
            return rutaArchivo;
        } catch (error) {
            throw new Error(`Error guardando PDF: ${error.message}`);
        }
    }
}

module.exports = PDFService;
