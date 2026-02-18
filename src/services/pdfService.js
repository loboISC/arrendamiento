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
            // 1. Cargar plantilla base
            let html = fs.readFileSync(this.templatePath, 'utf8');

            // 2. Generar QR Code y Logo
            const logoPath = path.join(__dirname, '../../public/img/logo-demo.jpg');
            let logoBase64 = '';
            if (fs.existsSync(logoPath)) {
                logoBase64 = `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString('base64')}`;
            }

            const qrData = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${facturaData.cfdiInfo.uuid}&re=${facturaData.emisor.rfc}&rr=${facturaData.receptor.rfc}&tt=${facturaData.totales.total}&fe=${facturaData.cfdiInfo.selloDigital.substring(facturaData.cfdiInfo.selloDigital.length - 8)}`;
            const qrBase64 = await QRCode.toDataURL(qrData);

            // 3. Preparar reemplazos comunes
            const luxon = require('luxon');
            const fechaEmision = luxon.DateTime.fromISO(facturaData.cfdiInfo.fechaEmision).setLocale('es').toFormat('dd/MM/yyyy HH:mm:ss');
            const fechaVencimiento = luxon.DateTime.fromISO(facturaData.cfdiInfo.fechaEmision).plus({ days: 30 }).setLocale('es').toFormat('dd/MM/yyyy');
            const totalLetra = this.convertirTotalALetra(facturaData.totales.total);

            const replacements = {
                '{{logo_base64}}': logoBase64 || 'img/logo-demo.jpg',
                '{{emisor_rfc}}': facturaData.emisor.rfc,
                '{{uuid}}': facturaData.cfdiInfo.uuid,
                '{{folio}}': facturaData.cfdiInfo.folio || facturaData.cfdiInfo.uuid.substring(0, 8).toUpperCase(),
                '{{fecha_emision}}': fechaEmision,
                '{{fecha_timbrado}}': facturaData.cfdiInfo.fechaTimbrado,
                '{{fecha_vencimiento}}': fechaVencimiento,
                '{{certificado_sat}}': facturaData.cfdiInfo.certificadoSAT,
                '{{certificado_emisor}}': facturaData.cfdiInfo.noCertificadoEmisor,
                '{{receptor_nombre}}': facturaData.receptor.nombreParaPdf || facturaData.receptor.nombre,
                '{{receptor_rfc}}': facturaData.receptor.rfc,
                '{{receptor_regimen}}': facturaData.receptor.regimenFiscal || '612',
                '{{receptor_cp}}': facturaData.receptor.codigoPostal,
                '{{receptor_direccion}}': facturaData.receptor.direccion || 'DOMICILIO CONOCIDO',
                '{{uso_cfdi}}': facturaData.receptor.usoCfdi,
                '{{metodo_pago}}': facturaData.totales.metodoPago === 'PUE' ? 'PUE - Pago en una sola exhibición' : 'PPD - Pago en parcialidades o diferido',
                '{{forma_pago}}': facturaData.totales.formaPago === '03' ? '03 - Transferencia electrónica de fondos' : (facturaData.totales.formaPago || '99 - Por definir'),
                '{{subtotal}}': Number(facturaData.totales.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                '{{total_iva}}': Number(facturaData.totales.iva).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                '{{total}}': Number(facturaData.totales.total).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                '{{total_letra}}': totalLetra,
                '{{vendedor}}': facturaData.vendedor || 'SISTEMAS',
                '{{peso_total}}': facturaData.peso_total || '0.00'
            };

            // 4. Construcción de Páginas
            const ITEMS_PER_PAGE = 15;
            const totalPages = Math.ceil(facturaData.conceptos.length / ITEMS_PER_PAGE);
            let pagesHtml = '';

            for (let i = 0; i < totalPages; i++) {
                const chunk = facturaData.conceptos.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE);
                const isLastPage = (i === totalPages - 1);

                const rowsHtml = chunk.map(c => `
                    <tr>
                        <td>${c.claveProductoServicio || ''}</td>
                        <td class="text-center">${c.cantidad}</td>
                        <td>${c.claveUnidad || ''}${c.unidad ? `<br><small>${c.unidad}</small>` : ''}</td>
                        <td>${c.descripcion}${c.caracteristicas ? `<br><small style="color: #666; font-size: 9px;">${c.caracteristicas}</small>` : ''}</td>
                        <td class="text-right">$${Number(c.precio || c.valorUnitario).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td class="text-right">$${Number(c.importe).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                `).join('');

                const observacionesHtml = isLastPage && facturaData.observaciones ? `
                    <div class="observaciones-section" style="margin-top: 8px; border: 1px solid #000; padding: 4px 8px; background: #fff; width: 100%;">
                        <h4 style="margin: 0 0 2px 0; font-size: 8.5px; font-weight: 800; border-bottom: 1px solid #000; padding-bottom: 2px; text-transform: uppercase;">NOTAS ADICIONALES:</h4>
                        <p style="margin: 0; font-size: 9px; line-height: 1.2; font-weight: 500; color: #000;">${facturaData.observaciones}</p>
                    </div>
                ` : '';

                pagesHtml += `
                    <div class="page-container" style="padding: 0; display: flex; flex-direction: column; overflow: hidden;">
                        <div style="flex: 1;">
                            <div class="header" style="margin-bottom: 10px;">
                                <div class="logo-container"><img src="${replacements['{{logo_base64}}']}" class="logo" style="max-height: 60px;"></div>
                                <div class="emisor-info" style="font-size: 8.5px;">
                                    <h1 style="font-size: 12px; margin-bottom: 2px;">ANDAMIOS Y PROYECTOS TORRES, SA DE CV</h1>
                                    <p><b>RFC:</b> ${replacements['{{emisor_rfc}}']}</p>
                                    <p>ORIENTE 174 No. 290 | Col. Moctezuma 2a Sección C.P. 15330</p>
                                    <p>Venustiano Carranza, CDMX, MÉXICO.</p>
                                    <p>Tels. (01) 55-55-71-71-05 55-26-46-00-24</p>
                                </div>
                                <div class="folio-box" style="padding-left: 10px; border-left: 2px solid #eee;">
                                    <div class="folio-title" style="font-size: 8px;">Factura CFDI - Versión 4.0</div>
                                    <div class="folio-number" style="font-size: 16px; color: #E3232C; font-weight: 800; margin: 2px 0;">${replacements['{{folio}}']}</div>
                                    <div class="folio-details" style="font-size: 7px;">
                                        <b>Folio Fiscal:</b><br/>${replacements['{{uuid}}']}<br/>
                                        <b>Certificado SAT:</b> ${replacements['{{certificado_sat}}']}
                                    </div>
                                </div>
                            </div>

                            <div class="receptor-card">
                                <div>
                                    <div class="section-title">RECEPTOR</div>
                                    <div style="margin-top: 5px; font-size: 10px;">
                                        <b>Nombre:</b> ${replacements['{{receptor_nombre}}']}<br/>
                                        <b>RFC:</b> ${replacements['{{receptor_rfc}}']}<br/>
                                        <b>Domicilio:</b> ${replacements['{{receptor_direccion}}']}
                                    </div>
                                </div>
                                <div>
                                    <div class="section-title">DATOS</div>
                                    <div style="margin-top: 5px;">
                                        <b>Uso:</b> ${replacements['{{uso_cfdi}}']}<br/>
                                        <b>Fecha:</b> ${replacements['{{fecha_emision}}']}
                                    </div>
                                </div>
                            </div>

                            <table class="concepts-table">
                                <thead>
                                    <tr>
                                        <th style="width: 60px;">Clave</th>
                                        <th style="width: 40px;" class="text-center">CANT</th>
                                        <th style="width: 50px;">Unidad</th>
                                        <th>DESCRIPCIÓN</th>
                                        <th style="width: 80px;" class="text-right">P. UNIT.</th>
                                        <th style="width: 80px;" class="text-right">IMPORTE</th>
                                    </tr>
                                </thead>
                                <tbody>${rowsHtml}</tbody>
                            </table>

                            ${observacionesHtml}
                        </div>
                    </div>
                `;
            }

            // 5. Inyectar en HTML y configurar Puppeteer
            const bodyStart = html.indexOf('<body>');
            const bodyEnd = html.indexOf('</body>');
            html = html.substring(0, bodyStart + 6) + pagesHtml + html.substring(bodyEnd);

            browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            const publicPath = path.join(__dirname, '../../public');
            const fileBaseUrl = `file://${publicPath.replace(/\\/g, '/')}/`;
            const htmlWithBase = html.replace('<head>', `<head><base href="${fileBaseUrl}">`);
            await page.setContent(htmlWithBase, { waitUntil: 'networkidle0' });

            // 6. Footer NATIVO de Puppeteer
            const footerTemplate = `
                <style>
                    .footer-native { font-family: 'Arial', sans-serif; width: 100%; padding: 0 10mm 5mm 10mm; background: white; border-top: 1.5px solid #000; }
                    .summary-grid { display: grid; grid-template-columns: 1fr 220px; gap: 15px; margin-bottom: 8px; margin-top: 5px; }
                    .pagare-box { font-size: 7.2px; text-align: justify; color: #000; padding: 6px; border: 1px solid #000; line-height: 1.2; }
                    .totals-table { width: 100%; border: 1px solid #000; border-collapse: collapse; }
                    .totals-table td { padding: 4px 8px; border: 1px solid #000; font-size: 10px; }
                    .totals-table .label { background: #f8fafc; font-weight: bold; width: 100px; text-align: right; }
                    .total-highlight { background: #f1f5f9; font-weight: bold; font-size: 13px !important; }
                    .stamps-grid { display: grid; grid-template-columns: 85px 1fr; gap: 15px; font-size: 7.5px; border-top: 1.5px solid #000; padding-top: 6px; }
                    .stamp-text { font-family: 'Courier New', monospace; word-break: break-all; font-weight: 600; display: block; margin-top: 2px; line-height: 1.1; }
                </style>
                <div class="footer-native">
                    <div class="summary-grid">
                        <div>
                            <div class="pagare-box">
                                <b>CANTIDAD CON LETRA:</b> (${replacements['{{total_letra}}']})<br/><br/>
                                DEBO Y PAGARE INCONDICIONALMENTE A LA ORDEN DE ANDAMIOS Y PROYECTOS TORRES EN ESTA CIUDAD O EN CUALQUIER OTRA QUE SE ME REQUIERA EL DIA ${replacements['{{fecha_vencimiento}}']} LA CANTIDAD DE $${replacements['{{total}}']} (${replacements['{{total_letra}}']}) VALOR DE LAS MERCANCIAS O SERVICIOS RECIBIDOS A MI ENTERA CONFORMIDAD...
                                <div style="text-align: center; margin-top: 10px;">________________________________________________<br/>FIRMA</div>
                            </div>
                            <div style="font-size: 8.5px; margin-top: 6px; font-weight: 700;">
                                <b>Vendedor:</b> ${replacements['{{vendedor}}']} | <b>Peso:</b> ${replacements['{{peso_total}}']} KG
                            </div>
                        </div>
                        <div>
                            <table class="totals-table">
                                <tr><td class="label">Subtotal</td><td style="text-align:right; font-weight: bold;">$ ${replacements['{{subtotal}}']}</td></tr>
                                <tr><td class="label">I.V.A. 16%</td><td style="text-align:right; font-weight: bold;">$ ${replacements['{{total_iva}}']}</td></tr>
                                <tr class="total-highlight"><td class="label">Total</td><td style="text-align:right;">$ ${replacements['{{total}}']}</td></tr>
                            </table>
                            <div style="text-align: right; font-size: 8.5px; margin-top: 6px; font-weight: 600;">
                                <b>Método:</b> ${replacements['{{metodo_pago}}']}<br/>
                                <b>Forma:</b> ${replacements['{{forma_pago}}']}
                            </div>
                        </div>
                    </div>
                    <div class="stamps-grid">
                        <div style="text-align: center;"><img src="${qrBase64}" style="width: 75px; height: 75px;" /></div>
                        <div>
                            <div style="margin-bottom: 4px;"><strong>Sello Digital del CFDI:</strong><span class="stamp-text">${facturaData.cfdiInfo.selloDigital}</span></div>
                            <div style="margin-bottom: 4px;"><strong>Sello SAT:</strong><span class="stamp-text">${facturaData.cfdiInfo.selloSAT}</span></div>
                            <div style="margin-bottom: 3px;"><strong>Cadena Original:</strong><span class="stamp-text">${facturaData.cfdiInfo.cadenaOriginal || `||1.1|${facturaData.cfdiInfo.uuid}|...`}</span></div>
                            <div style="text-align: right; font-size: 7px; margin-top: 3px; font-weight: bold;">
                                CFDI 4.0 | Página <span class="pageNumber"></span> de <span class="totalPages"></span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            const pdfBuffer = await page.pdf({
                format: 'Letter',
                printBackground: true,
                displayHeaderFooter: true,
                footerTemplate: footerTemplate,
                headerTemplate: '<div></div>',
                margin: { top: '10mm', right: '10mm', bottom: '60mm', left: '10mm' }
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
            if (n >= 100) { res += centenas[Math.floor(n / 100)] + ' '; n %= 100; }
            if (n >= 10 && n <= 19) { res += especiales[n - 10]; return res; }
            else if (n >= 20) { res += decenas[Math.floor(n / 10)] + (n % 10 !== 0 ? ' Y ' : ''); n %= 10; }
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
        if (intVal > 0 || texto === '') texto += aTexto(intVal);

        return `(${texto.trim()} PESOS ${decimal}/100 MN)`;
    }

    async guardarPDF(facturaData, nombreArchivo) {
        try {
            const pdfBuffer = await this.generarPDFFactura(facturaData);
            const rutaArchivo = path.join(__dirname, '../../pdfs', nombreArchivo);
            const dir = path.dirname(rutaArchivo);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(rutaArchivo, pdfBuffer);
            return rutaArchivo;
        } catch (error) {
            throw new Error(`Error guardando PDF: ${error.message}`);
        }
    }
}

module.exports = PDFService;
