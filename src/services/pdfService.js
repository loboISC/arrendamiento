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

            // 2. Generar QR Code y Base64 del Logo
            const logoPath = path.join(__dirname, '../../public/img/logo-demo.jpg');
            let logoBase64 = '';
            if (fs.existsSync(logoPath)) {
                const logoBuffer = fs.readFileSync(logoPath);
                logoBase64 = `data:image/jpeg;base64,${logoBuffer.toString('base64')}`;
            }

            const qrData = `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${facturaData.cfdiInfo.uuid}&re=${facturaData.emisor.rfc}&rr=${facturaData.receptor.rfc}&tt=${facturaData.totales.total}&fe=${facturaData.cfdiInfo.selloDigital.substring(facturaData.cfdiInfo.selloDigital.length - 8)}`;
            const qrBase64 = await QRCode.toDataURL(qrData);

            // 3. Poblar datos básicos
            const luxon = require('luxon');
            const fechaEmision = luxon.DateTime.fromISO(facturaData.cfdiInfo.fechaEmision).setLocale('es').toFormat('dd/MM/yyyy HH:mm:ss');
            const fechaVencimiento = luxon.DateTime.fromISO(facturaData.cfdiInfo.fechaEmision).plus({ days: 30 }).setLocale('es').toFormat('dd/MM/yyyy');

            // Función simple para cantidad en letra (idealmente usar una librería como numero-a-letras)
            const totalLetra = this.convertirTotalALetra(facturaData.totales.total);

            const replacements = {
                '{{logo_base64}}': logoBase64 || 'img/logo-demo.jpg',
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
                '{{receptor_nombre}}': facturaData.receptor.nombreParaPdf || facturaData.receptor.nombre,
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
                '{{vendedor}}': facturaData.vendedor || 'SISTEMAS',
                '{{peso_total}}': facturaData.peso_total || '0.00',
                '{{qr_base64}}': qrBase64,
                '{{sello_cfdi}}': facturaData.cfdiInfo.selloDigital,
                '{{sello_sat}}': facturaData.cfdiInfo.selloSAT,
                '{{cadena_original}}': facturaData.cfdiInfo.cadenaOriginal || `||1.1|${facturaData.cfdiInfo.uuid}|${facturaData.cfdiInfo.fechaTimbrado}|${facturaData.emisor.rfc}|${facturaData.cfdiInfo.selloDigital}|${facturaData.cfdiInfo.certificadoSAT}||`,
                '{{observaciones}}': facturaData.observaciones || ''
            };

            for (const [key, value] of Object.entries(replacements)) {
                html = html.split(key).join(value);
            }

            // 4. Construcción manual de páginas (Header y Footer por página)
            const ITEMS_PER_PAGE = 15;
            const totalPages = Math.ceil(facturaData.conceptos.length / ITEMS_PER_PAGE);
            let pagesHtml = '';

            for (let i = 0; i < totalPages; i++) {
                const start = i * ITEMS_PER_PAGE;
                const end = start + ITEMS_PER_PAGE;
                const chunk = facturaData.conceptos.slice(start, end);
                const isLastPage = i === totalPages - 1;

                // Construir filas de la tabla
                const rowsHtml = chunk.map(c => `
                    <tr>
                        <td>${c.claveProductoServicio || ''}</td>
                        <td class="text-center">${c.cantidad}</td>
                        <td>${c.claveUnidad || ''}${c.unidad ? `<br><small>${c.unidad}</small>` : ''}</td>
                        <td>${c.descripcion}</td>
                        <td class="text-right">$${Number(c.precio || c.valorUnitario).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td class="text-right">$${Number(c.importe).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                `).join('');

                // Construcción de la página
                // Usamos height fijo un poco menor para asegurar margen y evitar desbordes que creen paginas extra
                pagesHtml += `
                    <div class="page-container" style="position: relative; min-height: 92vh; padding: 0; display: flex; flex-direction: column;">
                        <!-- CONTENT WRAPPER (Top) -->
                        <div style="flex: 1;">
                            <!-- HEADER -->
                            <div class="header">
                                <div class="logo-container">
                                    <img src="${replacements['{{logo_base64}}']}" alt="Logo" class="logo">
                                </div>
                                <div class="emisor-info">
                                    <h1>ANDAMIOS Y PROYECTOS TORRES, SA DE CV</h1>
                                    <p><b>RFC:</b> ${replacements['{{emisor_rfc}}']}</p>
                                    <p>ORIENTE 174 No. 290 | Col. Moctezuma 2a Sección C.P. 15330</p>
                                    <p>Venustiano Carranza, CDMX, MÉXICO.</p>
                                    <p>Tels. (01) 55-55-71-71-05 55-26-46-00-24 Cel. 55-62-55-78-19</p>
                                    <p>eMail: ventas@andamiostorres.com</p>
                                    <p>Cuenta(s): Visite nuestro aviso de privacidad en www.andamiostorres.com</p>
                                </div>
                                <div class="folio-box">
                                    <div class="folio-title">Factura CFDI - Versión 4.0</div>
                                    <div class="folio-number">B-${replacements['{{folio}}']}</div>
                                    <div class="folio-details">
                                        <b>Folio Fiscal:</b><br>${replacements['{{uuid}}']}<br>
                                        <b>No. Certificado SAT:</b><br>${replacements['{{certificado_sat}}']}<br>
                                        <b>No. Certificado Emisor:</b><br>${replacements['{{certificado_emisor}}']}<br>
                                        <b>Fecha Certificación:</b><br>${replacements['{{fecha_timbrado}}']}
                                    </div>
                                </div>
                            </div>

                            <!-- RECEPTOR -->
                            <div class="receptor-card">
                                <div>
                                    <div class="section-title">RECEPTOR</div>
                                    <div style="margin-top: 5px;">
                                        <b>Nombre:</b> ${replacements['{{receptor_nombre}}']}<br>
                                        <b>R.F.C.:</b> ${replacements['{{receptor_rfc}}']}<br>
                                        <b>Domicilio:</b> ${replacements['{{receptor_direccion}}']}<br>
                                        <b>Régimen Fiscal:</b> ${replacements['{{receptor_regimen}}']}
                                    </div>
                                </div>
                                <div>
                                    <div class="section-title">DATOS DE FACTURA</div>
                                    <div style="margin-top: 5px;">
                                        <b>Uso CFDI:</b> ${replacements['{{uso_cfdi}}']}<br>
                                        <b>Moneda:</b> MXN<br>
                                        <b>Exportación:</b> 01
                                    </div>
                                </div>
                                <div>
                                    <div class="section-title" style="text-align: right;">FECHA DE EMISIÓN</div>
                                    <div class="text-right" style="font-size: 11px; font-weight: bold; margin-top: 5px;">
                                        ${replacements['{{fecha_emision}}']}
                                    </div>
                                </div>
                            </div>

                            <!-- TABLA -->
                            <table class="concepts-table">
                                <thead>
                                    <tr>
                                        <th style="width: 60px;">Clave ProdServ</th>
                                        <th style="width: 40px;" class="text-center">CANT</th>
                                        <th style="width: 50px;">Clave Unidad</th>
                                        <th>DESCRIPCIÓN</th>
                                        <th style="width: 80px;" class="text-right">P. UNIT.</th>
                                        <th style="width: 80px;" class="text-right">IMPORTE</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml}
                                </tbody>
                            </table>

                            <!-- OBSERVACIONES -->
                            ${facturaData.observaciones ? `
                            <div class="observaciones-section">
                                <h4>Observaciones:</h4>
                                <p>${facturaData.observaciones}</p>
                            </div>
                            ` : ''}

                            <!-- TOTALES (Solo última página, pero dentro del flujo principal) -->
                            ${isLastPage ? `
                            <div class="summary-grid">
                                <div class="pagare-container">
                                    <div class="pagare-box">
                                        <b>CANTIDAD CON LETRA:</b> (${replacements['{{total_letra}}']})<br><br>
                                        DEBO Y PAGARE INCONDICIONALMENTE A LA ORDEN DE ANDAMIOS Y PROYECTOS TORRES EN ESTA CIUDAD O EN CUALQUIER
                                        OTRA QUE SE ME REQUIERA EL DIA ${replacements['{{fecha_vencimiento}}']} LA CANTIDAD DE $${replacements['{{total}}']} (${replacements['{{total_letra}}']}) VALOR
                                        DE LAS MERCANCIAS O SERVICIOS RECIBIDOS A MI ENTERA CONFORMIDAD. ESTE PAGARE ES MERCANTIL Y ESTA REGIDO
                                        POR LA LEY GENERAL DE TITULOS Y OPERACIONES DE CREDITO EN SUS ARTICULOS 172 Y 173 PARTE FINAL POR NO SER
                                        PAGARE DOMICILIADO Y ARTICULOS CORRELATIVOS QUEDA CONVENIDO QUE EN CASO DE MORA, EL PRESENTE TITULO
                                        CAUSARA UN INTERES DEL 2.5% MENSUAL.
                                        <br><br>
                                        <div class="text-center" style="margin-top: 10px;">
                                            ________________________________________________<br>
                                            FIRMA
                                        </div>
                                    </div>
                                    <div style="margin-top: 10px; font-size: 8px;">
                                        <b>Vendedor:</b> ${replacements['{{vendedor}}']}<br>
                                        <b>Peso Total:</b> ${replacements['{{peso_total}}']} KG
                                    </div>
                                </div>
                                <div class="totals-box">
                                    <table class="totals-table">
                                        <tr>
                                            <td class="label">SUBTOTAL</td>
                                            <td class="text-right">$ ${replacements['{{subtotal}}']}</td>
                                        </tr>
                                        <tr>
                                            <td class="label">I.V.A. 16%</td>
                                            <td class="text-right">$ ${replacements['{{total_iva}}']}</td>
                                        </tr>
                                        <tr>
                                            <td class="label total-highlight">TOTAL</td>
                                            <td class="text-right total-highlight"><b>$ ${replacements['{{total}}']}</b></td>
                                        </tr>
                                    </table>
                                    <div style="margin-top: 10px; text-align: right; font-size: 8px;">
                                        <b>Forma de Pago:</b><br>${replacements['{{forma_pago}}']}<br>
                                        <b>Método de Pago:</b><br>${replacements['{{metodo_pago}}']}
                                    </div>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            }

            // Reemplazar el body del template con nuestras páginas
            const bodyStart = html.indexOf('<body>');
            const bodyEnd = html.indexOf('</body>');

            if (bodyStart !== -1 && bodyEnd !== -1) {
                // Mantenemos <body> y </body>, reemplazamos lo de adentro
                html = html.substring(0, bodyStart + 6) + pagesHtml + html.substring(bodyEnd);
            } else {
                // Fallback: Si no encuentra body simple, intentar con regex mas permisivo o simplemente append
                console.warn('No se encontró tag <body> simple, intentando regex...');
                html = html.replace(/<body[^>]*>([\s\S]*)<\/body>/i, `<body>${pagesHtml}</body>`);
            }

            // 5. Renderizar con Puppeteer
            browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();

            const publicPath = path.join(__dirname, '../../public');
            const fileBaseUrl = `file://${publicPath.replace(/\\/g, '/')}/`;
            const htmlWithBase = html.replace('<head>', `<head><base href="${fileBaseUrl}">`);

            // Validación de seguridad: Verificar que no queden marcadores críticos sin reemplazar
            if (htmlWithBase.includes('{{conceptos}}') || htmlWithBase.includes('{{#conceptos}}')) {
                throw new Error('Error al generar PDF: La plantilla no se procesó correctamente (marcadores encontrados).');
            }

            await page.setContent(htmlWithBase, { waitUntil: 'networkidle0' });

            // Crear footer HTML con los sellos digitales
            const footerTemplate = `
                <div style="font-size: 7px; padding: 5mm 10mm 0 10mm; width: 100%;">
                    <div style="display: grid; grid-template-columns: 90px 1fr; gap: 10px;">
                        <div style="text-align: center;">
                            <img src="${qrBase64}" style="width: 80px; height: 80px;" />
                        </div>
                        <div>
                            <div style="margin-bottom: 5px;">
                                <strong style="font-size: 8px;">Sello Digital del CFDI:</strong><br/>
                                <span style="font-family: 'Courier New'; font-size: 7.5px; font-weight: 600; word-break: break-all; color: #000;">${replacements['{{sello_cfdi}}']}</span>
                            </div>
                            <div style="margin-bottom: 5px;">
                                <strong style="font-size: 8px;">Sello SAT:</strong><br/>
                                <span style="font-family: 'Courier New'; font-size: 7.5px; font-weight: 600; word-break: break-all; color: #000;">${replacements['{{sello_sat}}']}</span>
                            </div>
                            <div style="margin-bottom: 3px;">
                                <strong style="font-size: 8px;">Cadena Original:</strong><br/>
                                <span style="font-family: 'Courier New'; font-size: 7.5px; font-weight: 600; word-break: break-all; color: #000;">${replacements['{{cadena_original}}']}</span>
                            </div>
                            <div style="text-align: right; font-size: 7px; color: #000; margin-top: 3px;">
                                Este documento es una representación impresa de un CFDI | Página <span class="pageNumber"></span> de <span class="totalPages"></span>
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
                margin: {
                    top: '10mm',
                    right: '10mm',
                    bottom: '45mm',
                    left: '10mm'
                }
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
