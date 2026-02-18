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
                '{{vendedor}}': facturaData.vendedor || 'Irving Arellano',
                '{{peso_total}}': facturaData.peso_total || '0.00'
            };

            // 4. Construcción de Páginas (MÁXIMO 10 PRODUCTOS)
            const ITEMS_PER_PAGE = 10;
            const totalPages = Math.ceil(facturaData.conceptos.length / ITEMS_PER_PAGE);
            let pagesHtml = '';

            for (let i = 0; i < totalPages; i++) {
                const chunk = facturaData.conceptos.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE);
                const isFirstPage = (i === 0);
                const isLastPage = (i === totalPages - 1);

                const rowsHtml = chunk.map(c => `
                    <tr>
                        <td style="font-size: 10px; padding: 4px;">${c.claveProductoServicio || ''}</td>
                        <td class="text-center" style="font-size: 10px; padding: 4px;">${c.cantidad}</td>
                        <td style="font-size: 9px; padding: 4px;">${c.claveUnidad || ''}${c.unidad ? `<br><small>${c.unidad}</small>` : ''}</td>
                        <td style="font-size: 10px; padding: 4px;">${c.descripcion}${c.caracteristicas ? `<br><small style="color: #666; font-size: 9px;">${c.caracteristicas}</small>` : ''}</td>
                        <td class="text-right" style="font-size: 10px; padding: 4px;">$${Number(c.precio || c.valorUnitario).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td class="text-right" style="font-size: 10px; padding: 4px;">$${Number(c.importe).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                `).join('');

                // Resumen (Pagaré y Totales) SOLO en la última página
                const summaryHtml = isLastPage ? `
                    <div style="margin-top: 15px;">
                        <div style="display: grid; grid-template-columns: 1fr 240px; gap: 20px;">
                            <div>
                                <div style="font-size: 7.2px; text-align: justify; border: 1px solid #000; padding: 8px; line-height: 1.25;">
                                    <b>CANTIDAD CON LETRA:</b> (${replacements['{{total_letra}}']})<br/><br/>
                                    DEBO Y PAGARE INCONDICIONALMENTE A LA ORDEN DE ANDAMIOS Y PROYECTOS TORRES EN ESTA CIUDAD O EN CUALQUIER OTRA QUE SE ME REQUIERA EL DIA ${replacements['{{fecha_vencimiento}}']} LA CANTIDAD DE $${replacements['{{total}}']} (${replacements['{{total_letra}}']}) VALOR DE LAS MERCANCIAS O SERVICIOS RECIBIDOS A MI ENTERA CONFORMIDAD...
                                    <div style="text-align: center; margin-top: 12px;">________________________________________________<br/>FIRMA</div>
                                </div>
                                <div style="font-size: 9px; margin-top: 6px; font-weight: 700;">
                                    <b>Vendedor:</b> ${replacements['{{vendedor}}']} | <b>Peso:</b> ${replacements['{{peso_total}}']} KG
                                </div>
                            </div>
                            <div>
                                <table style="width: 100%; border: 1.5px solid #000; border-collapse: collapse;">
                                    <tr><td style="padding: 5px 10px; border: 1px solid #000; font-size: 11px; font-weight: bold; background: #f8fafc; text-align: right;">Subtotal</td><td style="text-align:right; font-weight: bold; padding: 5px 10px; font-size: 11px;">$ ${replacements['{{subtotal}}']}</td></tr>
                                    <tr><td style="padding: 5px 10px; border: 1px solid #000; font-size: 11px; font-weight: bold; background: #f8fafc; text-align: right;">I.V.A. 16%</td><td style="text-align:right; font-weight: bold; padding: 5px 10px; font-size: 11px;">$ ${replacements['{{total_iva}}']}</td></tr>
                                    <tr style="background: #f1f5f9;"><td style="padding: 5px 10px; border: 1px solid #000; font-size: 13px; font-weight: bold; text-align: right;">Total</td><td style="text-align:right; font-weight: bold; padding: 5px 10px; font-size: 13px;">$ ${replacements['{{total}}']}</td></tr>
                                </table>
                                <div style="text-align: right; font-size: 9.5px; margin-top: 6px; font-weight: 600;">
                                    <b>Método:</b> ${replacements['{{metodo_pago}}']}<br/>
                                    <b>Forma:</b> ${replacements['{{forma_pago}}']}
                                </div>
                            </div>
                        </div>
                    </div>
                ` : '';

                const observacionesHtml = isLastPage && facturaData.observaciones ? `
                    <div style="margin-top: 10px; padding: 5px 0;">
                        <span style="font-size: 9px; font-weight: 800; text-transform: uppercase;">NOTAS ADICIONALES:</span>
                        <p style="margin: 3px 0 0 0; font-size: 10px; line-height: 1.2; font-weight: 500; color: #000;">${facturaData.observaciones}</p>
                    </div>
                ` : '';

                const receptorHtml = isFirstPage ? `
                    <div class="receptor-card" style="margin-bottom: 10px;">
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
                ` : '';

                pagesHtml += `
                    <div class="page-container" style="padding: 0; display: flex; flex-direction: column;">
                        <div style="flex: 1;">
                            ${receptorHtml}

                            <table class="concepts-table">
                                <thead>
                                    <tr>
                                        <th style="width: 70px;">Clave</th>
                                        <th style="width: 45px;" class="text-center">CANT</th>
                                        <th style="width: 55px;">Unidad</th>
                                        <th>DESCRIPCIÓN</th>
                                        <th style="width: 85px;" class="text-right">P. UNIT.</th>
                                        <th style="width: 85px;" class="text-right">IMPORTE</th>
                                    </tr>
                                </thead>
                                <tbody>${rowsHtml}</tbody>
                            </table>

                            ${observacionesHtml}
                            ${summaryHtml}
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

            // 6. Header NATIVO de Puppeteer
            const headerTemplate = `
                <style>
                    .header-container {
                        font-family: 'Arial', sans-serif;
                        width: 90%;
                        margin: 0 auto;
                        padding: 10px 15px;
                        border: 1.2px solid #cbd5e1;
                        border-radius: 10px;
                        display: flex;
                        align-items: center;
                        background: #fff;
                        position: relative;
                        top: 5mm;
                    }
                    .logo-col { width: 110px; text-align: left; }
                    .info-col { flex: 1; padding: 0 15px; font-size: 8.2px; color: #334155; line-height: 1.4; }
                    .folio-col { width: 190px; padding-left: 15px; border-left: 1.5px solid #e2e8f0; text-align: right; }
                    .logo-header { max-width: 95px; max-height: 60px; }
                    .empresa-title { font-size: 11.5px; font-weight: 800; color: #0f172a; margin-bottom: 3px; }
                    .folio-label { font-size: 8px; color: #64748b; font-weight: 800; text-transform: uppercase; }
                    .folio-val { font-size: 19px; color: #dc2626; font-weight: 900; margin: 2px 0; }
                    .folio-uuid { font-size: 7.2px; color: #475569; font-weight: 600; line-height: 1.2; }
                </style>
                <div class="header-container">
                    <div class="logo-col"><img src="${replacements['{{logo_base64}}']}" class="logo-header"></div>
                    <div class="info-col">
                        <div class="empresa-title">ANDAMIOS Y PROYECTOS TORRES, SA DE CV</div>
                        <div><b>RFC:</b> ${replacements['{{emisor_rfc}}']}</div>
                        <div>ORIENTE 174 No. 290 | Col. Moctezuma 2a Sección C.P. 15330</div>
                        <div>Venustiano Carranza, CDMX, MÉXICO.</div>
                        <div>Tels. (01) 55-55-71-71-05 55-26-46-00-24 Cel. 55-62-55-78-19</div>
                        <div>eMail: ventas@andamiostorres.com | www.andamiostorres.com</div>
                    </div>
                    <div class="folio-col">
                        <div class="folio-label">Factura CFDI - Versión 4.0</div>
                        <div class="folio-val">${replacements['{{folio}}']}</div>
                        <div class="folio-uuid">
                            <b>Folio Fiscal:</b><br/>${replacements['{{uuid}}']}<br/>
                            <b>Certificado SAT:</b> ${replacements['{{certificado_sat}}']}<br/>
                            <b>Certificado Emisor:</b> ${replacements['{{certificado_emisor}}']}
                        </div>
                    </div>
                </div>
            `;

            // 7. Footer NATIVO de Puppeteer (Sellos y Paginación)
            const footerTemplate = `
                <style>
                    .footer-native { font-family: 'Arial', sans-serif; width: 100%; padding: 0 10mm 5mm 10mm; background: white; border-top: 1.5px solid #000; }
                    .stamps-grid { display: grid; grid-template-columns: 85px 1fr; gap: 15px; font-size: 7.1px; padding-top: 8px; }
                    .stamp-text { font-family: 'Courier New', monospace; word-break: break-all; font-weight: 600; display: block; margin-top: 1px; line-height: 1.1; color: #000; }
                    .page-info { text-align: right; font-size: 8px; margin-top: 5px; font-weight: bold; }
                </style>
                <div class="footer-native">
                    <div class="stamps-grid">
                        <div style="text-align: center;"><img src="${qrBase64}" style="width: 75px; height: 75px;" /></div>
                        <div>
                            <div style="margin-bottom: 4px;"><strong>Sello Digital del CFDI:</strong><span class="stamp-text">${facturaData.cfdiInfo.selloDigital}</span></div>
                            <div style="margin-bottom: 4px;"><strong>Sello SAT:</strong><span class="stamp-text">${facturaData.cfdiInfo.selloSAT}</span></div>
                            <div style="margin-bottom: 3px;"><strong>Cadena Original:</strong><span class="stamp-text">${facturaData.cfdiInfo.cadenaOriginal}</span></div>
                            <div class="page-info">
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
                headerTemplate: headerTemplate,
                footerTemplate: footerTemplate,
                margin: { top: '55mm', right: '10mm', bottom: '65mm', left: '10mm' }
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
