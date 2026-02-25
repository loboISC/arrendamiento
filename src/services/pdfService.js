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
                '{{receptor_colonia}}': facturaData.receptor.colonia || '--',
                '{{receptor_localidad}}': facturaData.receptor.localidad || '--',
                '{{receptor_municipio}}': facturaData.receptor.municipio || '--',
                '{{receptor_estado}}': facturaData.receptor.estado || '--',
                '{{receptor_pais}}': facturaData.receptor.pais || '--',
                '{{receptor_direccion}}': facturaData.receptor.direccion || 'DOMICILIO CONOCIDO',
                '{{uso_cfdi}}': facturaData.receptor.usoCfdi,
                '{{tipo_comprobante}}': 'Factura',
                '{{exportacion}}': '01 - No aplica',
                '{{moneda}}': facturaData.comprobante?.moneda || 'MXN',
                '{{tipo_cambio}}': facturaData.comprobante?.tipoCambio ? Number(facturaData.comprobante.tipoCambio).toFixed(4) : '1.0000',
                '{{metodo_pago}}': facturaData.totales.metodoPago === 'PUE' ? 'PUE - Pago en una sola exhibición' : 'PPD - Pago en parcialidades o diferido',
                '{{forma_pago}}': facturaData.totales.formaPago === '03' ? '03 - Transferencia electrónica de fondos' : (facturaData.totales.formaPago || '99 - Por definir'),
                '{{subtotal}}': Number(facturaData.totales.subtotal).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                '{{descuento}}': Number(facturaData.totales.descuento || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                '{{total_iva}}': Number(facturaData.totales.iva).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                '{{total}}': Number(facturaData.totales.total).toLocaleString('en-US', { minimumFractionDigits: 2 }),
                '{{total_letra}}': totalLetra,
                '{{vendedor}}': facturaData.vendedor || 'Irving Arellano',
                '{{peso_total}}': facturaData.peso_total || '0.00'
            };

            // 4. Construcción de Páginas Inteligente
            const conceptos = [...facturaData.conceptos];
            let pagesHtml = '';
            let currentPageIndex = 0;

            while (conceptos.length > 0) {
                const isFirstPage = (currentPageIndex === 0);

                // Determinar cuántos ítems caben en esta página
                // P1 con receptor: ~8 ítems (si no son los últimos) o ~5-6 (si son los últimos)
                // Páginas medias: 10 ítems
                // Última página: depende de si hay espacio para totales
                let itemsThisPage = 10;
                if (isFirstPage) {
                    itemsThisPage = (conceptos.length <= 8) ? conceptos.length : 10;
                }

                // Extraer ítems para esta página
                const chunk = conceptos.splice(0, itemsThisPage);
                const isLastChunk = (conceptos.length === 0);

                // Renderizar filas de la tabla
                const rowsHtml = chunk.map(c => {
                    const unidadDisplay = (c.unidad && c.unidad !== c.claveUnidad)
                        ? `${c.claveUnidad}<br/><small style="color: #666;">${c.unidad}</small>`
                        : (c.unidad || c.claveUnidad || '');

                    return `
                    <tr>
                        <td style="font-size: 9px; padding: 5px; border: 1px solid #000;">${c.claveProductoServicio || ''}</td>
                        <td class="text-center" style="font-size: 10px; padding: 5px; border: 1px solid #000;">${c.cantidad}</td>
                        <td style="font-size: 9px; padding: 5px; border: 1px solid #000;">${unidadDisplay}</td>
                        <td style="font-size: 9.5px; padding: 5px; border: 1px solid #000; line-height: 1.2;">
                            ${c.descripcion}
                            ${c.caracteristicas ? `<br/><span style="color: #475569; font-size: 8px; font-weight: 500;">${c.caracteristicas}</span>` : ''}
                        </td>
                        <td class="text-right" style="font-size: 10px; padding: 5px; border: 1px solid #000;">$ ${Number(c.precio || c.valorUnitario).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td class="text-right" style="font-size: 10px; padding: 5px; border: 1px solid #000; color: #dc2626;">$ ${Number(c.descuento || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td class="text-right" style="font-size: 10px; padding: 5px; border: 1px solid #000; font-weight: 700;">$ ${Number(c.importe).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                `}).join('');

                // Bloque de cierre (Observaciones + Totales)
                // REGLA: Si es el último chunk y hay más de 6 items en la página activa, 
                // mejor mover los totales a una página limpia para evitar cortes.
                let closureHtml = '';
                let forceNewPageForTotals = false;

                if (isLastChunk) {
                    const closureContent = `
                        ${facturaData.observaciones ? `
                            <div style="margin-top: 10px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc;">
                                <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #1e3a8a;">OBSERVACIONES:</span>
                                <p style="margin: 4px 0 0 0; font-size: 10px; line-height: 1.3; font-weight: 500; color: #000;">${facturaData.observaciones}</p>
                            </div>
                        ` : ''}
                        <div style="margin-top: 10px;">
                            <div style="display: grid; grid-template-columns: 1fr 230px; gap: 15px;">
                                <div>
                                    <div style="font-size: 9px; text-align: justify; border: 1px solid #000; padding: 8px; line-height: 1.3;">
                                        <b style="font-size: 10px;">CANTIDAD CON LETRA:</b> (${replacements['{{total_letra}}']})<br/><br/>
                                        DEBO Y PAGARE INCONDICIONALMENTE A LA ORDEN DE ANDAMIOS Y PROYECTOS TORRES EN ESTA CIUDAD O EN CUALQUIER OTRA QUE SE ME REQUIERA EL DIA ${replacements['{{fecha_vencimiento}}']} LA CANTIDAD DE $${replacements['{{total}}']} (${replacements['{{total_letra}}']}) VALOR DE LAS MERCANCIAS O SERVICIOS RECIBIDOS A MI ENTERA CONFORMIDAD...
                                        <div style="text-align: center; margin-top: 10px; font-size: 10px;">________________________________________________<br/>FIRMA</div>
                                    </div>
                                    <div style="font-size: 10px; margin-top: 5px; font-weight: 700;">
                                        <b>Vendedor:</b> ${replacements['{{vendedor}}']} | <b>Peso:</b> ${replacements['{{peso_total}}']} KG
                                    </div>
                                </div>
                                <div>
                                    <table style="width: 100%; border: 1.2px solid #000; border-collapse: collapse;">
                                        <tr><td style="padding: 3px 8px; border: 1px solid #000; font-size: 10px; font-weight: bold; background: #f8fafc; text-align: right;">Subtotal</td><td style="text-align:right; font-weight: bold; padding: 3px 8px; font-size: 10px;">$ ${replacements['{{subtotal}}']}</td></tr>
                                        <tr><td style="padding: 3px 8px; border: 1px solid #000; font-size: 10px; font-weight: bold; background: #f8fafc; text-align: right; color: #dc2626;">Descuento</td><td style="text-align:right; font-weight: bold; padding: 3px 8px; font-size: 10px; color: #dc2626;">$ ${replacements['{{descuento}}']}</td></tr>
                                        <tr><td style="padding: 3px 8px; border: 1px solid #000; font-size: 10px; font-weight: bold; background: #f8fafc; text-align: right;">I.V.A. 16%</td><td style="text-align:right; font-weight: bold; padding: 3px 8px; font-size: 10px;">$ ${replacements['{{total_iva}}']}</td></tr>
                                        <tr style="background: #f1f5f9;"><td style="padding: 3px 8px; border: 1px solid #000; font-size: 11px; font-weight: bold; text-align: right;">Total</td><td style="text-align:right; font-weight: bold; padding: 3px 8px; font-size: 11px;">$ ${replacements['{{total}}']}</td></tr>
                                    </table>
                                </div>
                            </div>
                        </div>
                    `;

                    // Si es la primera página y hay más de 6 ítems + receptor + totales, no va a caber.
                    // O si no es la primera pero hay más de 7 ítems + totales.
                    if ((isFirstPage && chunk.length > 6) || (!isFirstPage && chunk.length > 8)) {
                        forceNewPageForTotals = true;
                    } else {
                        closureHtml = closureContent;
                    }
                }

                // Cabecera Receptor (SOLO P1)
                const receptorHtml = isFirstPage ? `
                    <div class="receptor-simple-v3" style="margin-top: 5px; margin-bottom: 12px; width: 100%; font-family: 'Arial', sans-serif;">
                        <div style="border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 8px;">
                            <span style="font-weight: 800; font-size: 10px; color: #000; text-transform: uppercase;">Datos del Receptor</span>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 220px; gap: 8px 15px;">
                            <div>
                                <span style="font-size: 7.5px; color: #666; font-weight: bold; display: block;">NOMBRE / RAZÓN SOCIAL</span>
                                <span style="font-weight: 700; font-size: 10.5px; color: #000;">${replacements['{{receptor_nombre}}']}</span>
                            </div>
                            <div>
                                <span style="font-size: 7.5px; color: #666; font-weight: bold; display: block;">RFC</span>
                                <span style="font-weight: 700; font-size: 10.5px; color: #000;">${replacements['{{receptor_rfc}}']}</span>
                            </div>
                            <div style="text-align: right; border-left: 1px solid #e2e8f0; padding-left: 10px;">
                                <span style="font-size: 7.5px; color: #666; font-weight: bold; display: block;">MÉTODO DE PAGO</span>
                                <span style="font-weight: 700; font-size: 9.5px; color: #000;">${replacements['{{metodo_pago}}']}</span>
                                <span style="font-size: 7.5px; color: #666; font-weight: bold; display: block; margin-top: 3px;">FORMA DE PAGO</span>
                                <span style="font-weight: 700; font-size: 9.5px; color: #000;">${replacements['{{forma_pago}}']}</span>
                            </div>
                            <div>
                                <span style="font-size: 7.5px; color: #666; font-weight: bold; display: block;">RÉGIMEN FISCAL</span>
                                <span style="font-size: 9.5px; color: #000;">${replacements['{{receptor_regimen}}']}</span>
                            </div>
                            <div>
                                <span style="font-size: 7.5px; color: #666; font-weight: bold; display: block;">USO CFDI</span>
                                <span style="font-size: 9.5px; color: #000;">${replacements['{{uso_cfdi}}']}</span>
                            </div>
                            <div style="grid-column: span 3; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 4px; border-top: 1px dashed #e2e8f0; padding-top: 4px;">
                                <div>
                                    <span style="font-size: 7.5px; color: #666; font-weight: bold; display: block;">CALLE Y NÚMERO</span>
                                    <span style="font-size: 9px; color: #333;">${replacements['{{receptor_direccion}}']}</span>
                                </div>
                                <div>
                                    <span style="font-size: 7.5px; color: #666; font-weight: bold; display: block;">COLONIA / C.P.</span>
                                    <span style="font-size: 9px; color: #333;">${replacements['{{receptor_colonia}}']} - ${replacements['{{receptor_cp}}']}</span>
                                </div>
                                <div>
                                    <span style="font-size: 7.5px; color: #666; font-weight: bold; display: block;">MUNICIPIO / ESTADO</span>
                                    <span style="font-size: 9px; color: #333;">${replacements['{{receptor_municipio}}']}, ${replacements['{{receptor_estado}}']}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : '<div style="height: 10px;"></div>';

                pagesHtml += `
                    <div class="page-container" style="padding: 0 10mm; display: flex; flex-direction: column; page-break-after: always; width: 100%; box-sizing: border-box;">
                        <div style="flex: 1;">
                            ${receptorHtml}
                            <table class="concepts-table" style="width: 100%; border-collapse: collapse; margin-top: 5px;">
                                <thead>
                                    <tr style="background: #f1f5f9;">
                                        <th style="width: 70px; border: 1px solid #000; padding: 5px; font-size: 9px;">CLAVE</th>
                                        <th style="width: 35px; border: 1px solid #000; padding: 5px; font-size: 9px;" class="text-center">CANT</th>
                                        <th style="width: 50px; border: 1px solid #000; padding: 5px; font-size: 9px;">UNIDAD</th>
                                        <th style="border: 1px solid #000; padding: 5px; font-size: 9px;">DESCRIPCIÓN</th>
                                        <th style="width: 70px; border: 1px solid #000; padding: 5px; font-size: 9px;" class="text-right">P. UNIT.</th>
                                        <th style="width: 70px; border: 1px solid #000; padding: 5px; font-size: 9px;" class="text-right">DESCUENTO</th>
                                        <th style="width: 70px; border: 1px solid #000; padding: 5px; font-size: 9px;" class="text-right">IMPORTE</th>
                                    </tr>
                                </thead>
                                <tbody>${rowsHtml}</tbody>
                            </table>
                            ${closureHtml}
                        </div>
                    </div>
                `;

                // Si forzamos página nueva para totales, agregarla
                if (forceNewPageForTotals) {
                    pagesHtml += `
                        <div class="page-container" style="padding: 0 10mm; display: flex; flex-direction: column; page-break-after: always; width: 100%; box-sizing: border-box;">
                            <div style="flex: 1;">
                                <div style="height: 20px;"></div>
                                ${facturaData.observaciones ? `
                                    <div style="margin-top: 10px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc;">
                                        <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #1e3a8a;">OBSERVACIONES:</span>
                                        <p style="margin: 4px 0 0 0; font-size: 10px; line-height: 1.3; font-weight: 500; color: #000;">${facturaData.observaciones}</p>
                                    </div>
                                ` : ''}
                                <div style="margin-top: 15px;">
                                    <div style="display: grid; grid-template-columns: 1fr 230px; gap: 15px;">
                                        <div>
                                            <div style="font-size: 9px; text-align: justify; border: 1px solid #000; padding: 8px; line-height: 1.3;">
                                                <b style="font-size: 10px;">CANTIDAD CON LETRA:</b> (${replacements['{{total_letra}}']})<br/><br/>
                                                DEBO Y PAGARE INCONDICIONALMENTE A LA ORDEN DE ANDAMIOS Y PROYECTOS TORRES EN ESTA CIUDAD O EN CUALQUIER OTRA QUE SE ME REQUIERA EL DIA ${replacements['{{fecha_vencimiento}}']} LA CANTIDAD DE $${replacements['{{total}}']} (${replacements['{{total_letra}}']}) VALOR DE LAS MERCANCIAS O SERVICIOS RECIBIDOS A MI ENTERA CONFORMIDAD...
                                                <div style="text-align: center; margin-top: 10px; font-size: 10px;">________________________________________________<br/>FIRMA</div>
                                            </div>
                                            <div style="font-size: 10px; margin-top: 5px; font-weight: 700;">
                                                <b>Vendedor:</b> ${replacements['{{vendedor}}']} | <b>Peso:</b> ${replacements['{{peso_total}}']} KG
                                            </div>
                                        </div>
                                        <div>
                                            <table style="width: 100%; border: 1.2px solid #000; border-collapse: collapse;">
                                                <tr><td style="padding: 3px 8px; border: 1px solid #000; font-size: 10px; font-weight: bold; background: #f8fafc; text-align: right;">Subtotal</td><td style="text-align:right; font-weight: bold; padding: 3px 8px; font-size: 10px;">$ ${replacements['{{subtotal}}']}</td></tr>
                                                <tr><td style="padding: 3px 8px; border: 1px solid #000; font-size: 10px; font-weight: bold; background: #f8fafc; text-align: right; color: #dc2626;">Descuento</td><td style="text-align:right; font-weight: bold; padding: 3px 8px; font-size: 10px; color: #dc2626;">$ ${replacements['{{descuento}}']}</td></tr>
                                                <tr><td style="padding: 3px 8px; border: 1px solid #000; font-size: 10px; font-weight: bold; background: #f8fafc; text-align: right;">I.V.A. 16%</td><td style="text-align:right; font-weight: bold; padding: 3px 8px; font-size: 10px;">$ ${replacements['{{total_iva}}']}</td></tr>
                                                <tr style="background: #f1f5f9;"><td style="padding: 3px 8px; border: 1px solid #000; font-size: 11px; font-weight: bold; text-align: right;">Total</td><td style="text-align:right; font-weight: bold; padding: 3px 8px; font-size: 11px;">$ ${replacements['{{total}}']}</td></tr>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }

                currentPageIndex++;
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
                        width: calc(100% - 20mm);
                        margin: 0 10mm;
                        padding: 6px 0;
                        border-bottom: 2px solid #1e3a8a;
                        display: flex;
                        align-items: center;
                        background: #fff;
                        position: relative;
                        top: 0;
                    }
                    .logo-col { width: 120px; text-align: left; display: flex; align-items: center; }
                    .info-col { flex: 1; padding: 0 12px; font-size: 10px; color: #000; line-height: 1.35; border-right: 1.5px solid #e2e8f0; }
                    .folio-col { width: 200px; padding-left: 12px; text-align: right; }
                    .logo-header { width: 110px; height: auto; }
                    .empresa-title { font-size: 13px; font-weight: 800; color: #000; margin-bottom: 2px; }
                    .folio-label { font-size: 9px; color: #000; font-weight: 600; text-transform: uppercase; }
                    .folio-val { font-size: 19px; color: #dc2626; font-weight: 900; margin: 0; }
                    .folio-uuid-box { font-size: 8.5px; color: #000; line-height: 1.2; }
                    .label-muted { color: #555; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block; margin-top: 2px; }
                </style>
                <div class="header-container">
                    <div class="logo-col"><img src="${replacements['{{logo_base64}}']}" class="logo-header"></div>
                    <div class="info-col">
                        <div class="empresa-title">ANDAMIOS Y PROYECTOS TORRES</div>
                        <div style="font-weight: 800; font-size: 11px; margin-bottom: 2px;">${replacements['{{emisor_rfc}}']}</div>
                        <div>ORIENTE 174 290-</div>
                        <div>COL: MOCTEZUMA 2A SECCION C.P.: 15330</div>
                        <div>VENUSTIANO CARRANZA, CDMX, MÉXICO</div>
                        <div>TEL: 55 5571-7105 / 55 2643-0024 CEL: 55 62 55 78 19 <br>EMAIL: ventas@andamiostorres.com</div>
                        <div style="font-size: 9px; margin-top: 2px;">CUENTA(S): VISITE NUESTRA AVISO DE PRIVACIDAD EN: <br> www.andamiostorres.com</div>
                    </div>
                    <div class="folio-col">
                        <div class="folio-label">Factura CFDI - Versión 4.0</div>
                        <div class="folio-val">${replacements['{{folio}}']}</div>
                        <div class="folio-uuid-box">
                            <span class="label-muted">Tipo de Comprobante:</span>
                            <div style="font-weight: bold;">${replacements['{{tipo_comprobante}}']}</div>
                            <span class="label-muted">Folio Fiscal:</span>
                            <div style="font-weight: bold;">${replacements['{{uuid}}']}</div>
                            <span class="label-muted">No. Certificado SAT:</span>
                            <div>${replacements['{{certificado_sat}}']}</div>
                            <span class="label-muted">No. Certificado:</span>
                            <div>${replacements['{{certificado_emisor}}']}</div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 2px;">
                                <div>
                                    <span class="label-muted">Moneda:</span>
                                    <div style="font-weight: bold;">${replacements['{{moneda}}']}</div>
                                </div>
                                <div>
                                    <span class="label-muted">T.C.:</span>
                                    <div style="font-weight: bold;">${replacements['{{tipo_cambio}}']}</div>
                                </div>
                            </div>
                            <span class="label-muted">Exportación:</span>
                            <div>${replacements['{{exportacion}}']}</div>
                            <span class="label-muted">Fecha Certificación:</span>
                            <div>${facturaData.cfdiInfo.fechaTimbrado}</div>
                        </div>
                    </div>
                </div>
            `;

            // 7. Footer NATIVO de Puppeteer (Sellos y Paginación)
            const footerTemplate = `
                <style>
                    .footer-native { font-family: 'Arial', sans-serif; width: calc(100% - 20mm); margin: 0 10mm; padding: 5px 0 5mm 0; background: white; border-top: 2px solid #1e3a8a; }
                    .footer-header { display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; padding: 5px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 6px; color: #1e3a8a; }
                    .stamps-grid { display: grid; grid-template-columns: 110px 1fr; gap: 15px; }
                    .stamp-text { font-family: 'Courier New', monospace; word-break: break-all; font-weight: 700; display: block; margin-top: 2px; line-height: 1.25; color: #000; font-size: 9.5px; }
                    .page-info { text-align: right; font-size: 10px; margin-top: 6px; font-weight: bold; color: #333; }
                    .label-sello { font-weight: 900; font-size: 10.5px; margin-bottom: 2px; display: block; color: #1e3a8a; }
                </style>
                <div class="footer-native">
                    <div class="footer-header">
                        <div></div>
                        <div style="font-weight: 800;">Este documento es una representación impresa de un CFDI</div>
                    </div>
                    <div class="stamps-grid">
                        <div style="text-align: center;"><img src="${qrBase64}" style="width: 100px; height: 100px;" /></div>
                        <div>
                            <div style="margin-bottom: 5px;"><span class="label-sello">Sello Digital del CFDI</span><span class="stamp-text">${facturaData.cfdiInfo.selloDigital}</span></div>
                            <div style="margin-bottom: 5px;"><span class="label-sello">Sello SAT</span><span class="stamp-text">${facturaData.cfdiInfo.selloSAT}</span></div>
                            <div style="margin-bottom: 4px;"><span class="label-sello">Cadena Original del Complemento de Certificación Digital del SAT</span><span class="stamp-text">${facturaData.cfdiInfo.cadenaOriginal}</span></div>
                            <div class="page-info">
                                Página <span class="pageNumber"></span> de <span class="totalPages"></span>
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
                margin: { top: '58mm', right: '0', bottom: '55mm', left: '0' }
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

            // Determinar la carpeta de almacenamiento (Configurable vía .env para red compartida o NAS)
            const storageDir = process.env.PDF_STORAGE_DIR || path.join(__dirname, '../../pdfs');

            const rutaArchivo = path.join(storageDir, nombreArchivo);
            const dir = path.dirname(rutaArchivo);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(rutaArchivo, pdfBuffer);
            // Retornar solo el nombre del archivo para que la BD sea portátil
            return nombreArchivo;
        } catch (error) {
            throw new Error(`Error guardando PDF: ${error.message}`);
        }
    }
}

module.exports = PDFService;
