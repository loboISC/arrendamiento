const path = require('path');
const fs = require('fs');
// ENVIAR FACTURA POR EMAIL
exports.enviarFacturaPorEmail = async (req, res) => {
    try {
        const { uuid } = req.params;
        const { destinatario, mensaje } = req.body;

        // Buscar la factura en la base de datos
        const result = await db.query('SELECT pdf_path, xml_path FROM facturas WHERE uuid = $1', [uuid]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Factura no encontrada' });
        }
        const factura = result.rows[0];

        // Validar destinatario
        if (!destinatario || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destinatario)) {
            return res.status(400).json({ success: false, error: 'Correo destinatario inválido' });
        }

        // Adjuntar PDF y XML si existen
        const attachments = [];

        const getPortablePath = (storedPath) => {
            if (!storedPath) return null;

            // 1. Intentar como ruta absoluta (por compatibilidad)
            if (fs.existsSync(storedPath)) return storedPath;

            // 2. Intentar en la carpeta de almacenamiento configurada
            const fileName = path.basename(storedPath);
            const storageDir = process.env.PDF_STORAGE_DIR || path.join(__dirname, '../../pdfs');
            const localPath = path.join(storageDir, fileName);

            return fs.existsSync(localPath) ? localPath : null;
        };

        const pdfPath = getPortablePath(factura.pdf_path);
        const xmlPath = getPortablePath(factura.xml_path);

        const { asunto } = req.body;

        // Buscar configuración SMTP del usuario
        let smtpConfig = null;
        if (req.user && req.user.id_usuario) {
            const smtpResult = await db.query(
                'SELECT host, puerto, usa_ssl, usuario, contrasena, correo_from FROM configuracion_smtp WHERE creado_por = $1 ORDER BY fecha_actualizacion DESC LIMIT 1',
                [req.user.id_usuario] // Usamos req.user.id_usuario que es lo que inyecta authenticateToken
            );
            if (smtpResult.rows.length > 0) {
                smtpConfig = smtpResult.rows[0];
            }
        }

        // Enviar correo usando el servicio profesional y la config del usuario
        await emailService.enviarFactura(
            destinatario,
            asunto || `Factura ${uuid} - Andamios Torres`,
            mensaje,
            pdfPath,
            xmlPath,
            smtpConfig
        );

        res.json({ success: true, message: 'Factura enviada por correo electrónico exitosamente' });
    } catch (error) {
        console.error('Error enviando factura por email:', error);
        res.status(500).json({ success: false, error: 'Error interno al enviar el correo' });
    }
};
const axios = require('axios');
const db = require('../db/index');

// helper para front/facturacion que también usa formateo de montos
function formatMoney(amount) {
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount || 0));
}
const PDFService = require('../services/pdfService');
const { getFacturamaToken, buildCfdiJson, FACTURAMA_BASE_URL, cancelarFacturaFacturama } = require('../services/facturamaservice');
const emailService = require('../services/emailService');

const { decrypt } = require('../utils/encryption');
const xmlService = require('../services/xmlService');
const pdfService = new PDFService();

// TIMBRAR FACTURA
exports.timbrarFactura = async (req, res) => {
    try {
        console.log('[DEBUG ROOT] req.body keys:', Object.keys(req.body));
        console.log('[DEBUG ROOT] req.body.factura keys:', req.body.factura ? Object.keys(req.body.factura) : 'null');

        const { receptor, factura, conceptos, complementoPago } = req.body;
        const conceptosInput = Array.isArray(conceptos) ? conceptos : [];
        const observaciones = factura?.observaciones || '';
        const tipoComprobanteReq = String(factura?.tipo || 'I').toUpperCase();
        const esComplementoPago = tipoComprobanteReq === 'P';

        console.log('[DEBUG] Observaciones extraídas:', observaciones);
        console.log('[DEBUG] Conceptos recibidos (primero):', conceptos?.[0]);

        // Obtener configuración del emisor desde la tabla 'emisores'
        const emisorQuery = await db.query(
            'SELECT rfc, razon_social, regimen_fiscal, codigo_postal, csd_cer, csd_key, csd_password FROM emisores ORDER BY id_emisor DESC LIMIT 1'
        );

        if (emisorQuery.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Emisor no configurado.' });
        }

        // Mapear resultado para compatibilidad con código existente
        const emisorRaw = emisorQuery.rows[0];
        const emisorResult = {
            rows: [{
                rfc: emisorRaw.rfc,
                razon_social: emisorRaw.razon_social,
                regimen_fiscal: emisorRaw.regimen_fiscal,
                codigo_postal: emisorRaw.codigo_postal,
                csd_cer_path: emisorRaw.csd_cer,
                csd_key_path: emisorRaw.csd_key,
                csd_password_encrypted: emisorRaw.csd_password
            }]
        };

        // Funciones de ayuda para construcción de items
        const buildCleanItem = (concepto, cantidad, valorUnitario, importe, descuento, objetoImp, itemImpuestos, claveProdServ) => {
            const item = {
                ClaveProductoServicio: claveProdServ,
                Cantidad: cantidad,
                ClaveUnidad: concepto.claveUnidad,
                Unidad: concepto.unidad || 'Unidad de servicio',
                Descripcion: concepto.descripcion,
                ValorUnitario: valorUnitario,
                Importe: importe,
                Descuento: descuento,
                ObjetoImp: objetoImp
            };
            if (concepto.noIdentificacion && concepto.noIdentificacion.trim() !== '') {
                item.NoIdentificacion = concepto.noIdentificacion.trim();
            }
            if (itemImpuestos) {
                item.Impuestos = itemImpuestos;
            }
            return item;
        };

        const emisorConfig = emisorResult.rows[0];

        if (esComplementoPago) {
            const nombreRealCliente = receptor.nombre || 'CLIENTE DESCONOCIDO';
            if (receptor.rfc === 'XAXX010101000') {
                receptor.nombre = 'PUBLICO EN GENERAL';
                receptor.regimenFiscal = '616';
                receptor.usoCfdi = 'CP01';
                receptor.codigoPostal = emisorConfig.codigo_postal;
            } else {
                receptor.nombre = nombreRealCliente;
                receptor.usoCfdi = receptor.usoCfdi || 'CP01';
            }
            receptor.nombreParaPdf = nombreRealCliente;
        }

        // Limpiar espacios en los campos string de cada concepto ANTES de construir el JSON
        conceptosInput.forEach(concepto => {
            if (typeof concepto.descripcion === 'string') concepto.descripcion = concepto.descripcion.trim();
            // Asegurarse de que claveProductoServicio no sea null o undefined antes de trim
            if (typeof concepto.claveProductoServicio === 'string') concepto.claveProductoServicio = concepto.claveProductoServicio.trim();
            if (typeof concepto.claveUnidad === 'string') concepto.claveUnidad = concepto.claveUnidad.trim();
            if (typeof concepto.unidad === 'string') concepto.unidad = concepto.unidad.trim();
        });

        // --- FOLIO SAT (Primeros 8 caracteres del UUID) ---
        // Ya no generamos folios internos B-0001
        // El folio se determinará después de obtener la respuesta del SAT (facturamaData)

        // Mapear conceptos a los nombres de campo que espera Facturama
        const conceptosFacturama = conceptosInput.map(concepto => {
            const cantidad = Number(Number(concepto.cantidad || 0).toFixed(6));
            const valorUnitario = Number(Number(concepto.valorUnitario || 0).toFixed(6));
            const descuento = Number(Number(concepto.descuento || 0).toFixed(2));
            const importe = Number((cantidad * valorUnitario).toFixed(2));
            const baseImpuesto = Number((importe - descuento).toFixed(2));

            // Validar que claveProductoServicio no sea null, undefined o vacío
            if (!concepto.claveProductoServicio || concepto.claveProductoServicio.trim() === '') {
                throw new Error(`Clave de producto/servicio es requerida para el concepto: ${concepto.descripcion || 'Sin descripción'}`);
            }

            // Asegurar que la clave de producto/servicio sea un string válido
            const claveProdServ = concepto.claveProductoServicio.trim();
            if (!/^\d{8}$/.test(claveProdServ)) {
                throw new Error(`Clave de producto/servicio debe ser un código de 8 dígitos. Valor recibido: ${claveProdServ}`);
            }

            // Determinar el ObjetoImp del concepto. Por defecto '02' (Sí objeto de impuesto) si no se especifica.
            // '01': No objeto de impuesto
            // '02': Sí objeto de impuesto (Requiere sección Impuestos)
            // '03': Sí objeto de impuesto y no obligado al desglose
            let objetoImp = concepto.objetoImp || '02';

            // Guardar nombre original para el PDF (aunque el SAT use PUBLICO EN GENERAL)
            const nombreRealCliente = receptor.nombre || 'CLIENTE DESCONOCIDO';

            // Reglas CFDI 4.0 para Público en General (RFC genérico)
            if (receptor.rfc === 'XAXX010101000') {
                receptor.nombre = 'PUBLICO EN GENERAL';
                receptor.regimenFiscal = '616';
                receptor.usoCfdi = 'S01';
                receptor.codigoPostal = emisorConfig.codigo_postal;
            } else {
                receptor.nombre = nombreRealCliente;
                receptor.usoCfdi = receptor.usoCfdi || 'G03';
            }
            // Adjuntar nombre real para uso interno del PDF
            receptor.nombreParaPdf = nombreRealCliente;

            let itemImpuestos = undefined; // Por defecto, no incluir la sección Impuestos en el ítem

            // Solo incluir la sección Impuestos en el ítem si ObjetoImp es '01'
            // y si se han proporcionado datos de impuestos para el concepto.
            // Solo incluir la sección Impuestos en el ítem si ObjetoImp es '02' (Sí objeto de impuesto)
            // y si se han proporcionado datos de impuestos para el concepto.
            if (objetoImp === '02' && concepto.impuestos && concepto.impuestos.Traslados && concepto.impuestos.Traslados.length > 0) {
                itemImpuestos = {
                    Traslados: concepto.impuestos.Traslados.map(t => ({
                        // Asegurar que Base no sea null y use importe - descuento si es necesario
                        Base: Number(Number(t.Base || baseImpuesto).toFixed(2)),
                        Impuesto: t.Impuesto || '002', // Default a IVA
                        TipoFactor: t.TipoFactor || 'Tasa',
                        // Asegurar que TasaOCuota no sea null
                        TasaOCuota: t.TasaOCuota != null ? Number(t.TasaOCuota) : 0.16,
                        // Calcular Importe del impuesto si no se proporciona, usando la TasaOCuota real
                        Importe: Number(Number(t.Importe || (baseImpuesto * (t.TasaOCuota != null ? Number(t.TasaOCuota) : 0.16))).toFixed(2))
                    }))
                };
            } else if (objetoImp === '02' && (!concepto.impuestos || !concepto.impuestos.Traslados || concepto.impuestos.Traslados.length === 0)) {
                // Si ObjetoImp es '02' pero no hay impuestos definidos, esto es una inconsistencia.
                // Podrías lanzar un error o cambiar ObjetoImp a '01'
                console.warn(`Advertencia: Concepto con ObjetoImp '02' pero sin impuestos definidos. Cambiando a '01'. Concepto: ${concepto.descripcion}`);
                objetoImp = '01';
            }

            const item = buildCleanItem(concepto, cantidad, valorUnitario, importe, descuento, objetoImp, itemImpuestos, claveProdServ);

            // Log para debugging
            console.log('Concepto mapeado:', JSON.stringify(item, null, 2));

            return item;
        });

        // Calcular totales globales antes de construir el JSON para Facturama
        const subtotal = Number(conceptosFacturama.reduce((sum, c) => sum + c.Importe, 0).toFixed(2));
        const totalDescuento = Number(conceptosFacturama.reduce((sum, c) => sum + (c.Descuento || 0), 0).toFixed(2));
        const totalImpuestosTrasladados = Number(conceptosFacturama.reduce((sum, c) => {
            // Sumar solo los impuestos que están a nivel de ítem (si ObjetoImp es '02')
            if (c.Impuestos && c.Impuestos.Traslados && c.Impuestos.Traslados.length > 0) {
                return sum + c.Impuestos.Traslados.reduce((s, t) => s + t.Importe, 0);
            }
            return sum;
        }, 0).toFixed(2));
        const total = Number((subtotal - totalDescuento + totalImpuestosTrasladados).toFixed(2));

        console.log(`[DEBUG] Totales Finales: Subtotal=${subtotal}, Descuento=${totalDescuento}, IVA=${totalImpuestosTrasladados}, Total=${total}`);

        // --- CONSTRUCCIÓN Y SELLADO XML LOCAL (REQUERIDO POR EL USUARIO) ---
        let xmlSelladoString = '';
        let informacionGlobal = null;

        if (receptor.rfc === 'XAXX010101000') {
            informacionGlobal = {
                periodicidad: '01', // Diario
                meses: String(new Date().getMonth() + 1).padStart(2, '0'),
                año: String(new Date().getFullYear())
            };
        }

        const xmlData = {
            emisor: {
                rfc: emisorConfig.rfc,
                razonSocial: emisorConfig.razon_social,
                regimenFiscal: emisorConfig.regimen_fiscal
            },
            informacionGlobal: informacionGlobal,
            receptor: {
                rfc: receptor.rfc,
                nombre: receptor.nombre,
                codigoPostal: receptor.codigoPostal,
                regimenFiscal: receptor.regimenFiscal,
                usoCfdi: receptor.usoCfdi
            },
            conceptos: conceptosFacturama.map(c => ({
                claveProductoServicio: c.ClaveProductoServicio,
                noIdentificacion: c.NoIdentificacion,
                cantidad: c.Cantidad,
                claveUnidad: c.ClaveUnidad,
                unidad: c.Unidad,
                descripcion: c.Descripcion,
                valorUnitario: c.ValorUnitario,
                importe: c.Importe,
                objetoImp: c.ObjetoImp,
                impuestos: c.Impuestos
            })),
            totales: {
                subtotal: subtotal,
                descuento: totalDescuento,
                totalTraslados: totalImpuestosTrasladados,
                total: total
            },
            serie: 'A',
            folio: 'SAT', // Placeholder temporal
            lugarExpedicion: emisorConfig.codigo_postal
        };

        if (!esComplementoPago && emisorConfig.csd_cer_path && emisorConfig.csd_key_path && emisorConfig.csd_password_encrypted) {
            try {
                console.log('[XML] Iniciando construcción y sellado local...');
                const passDescrypted = decrypt(emisorConfig.csd_password_encrypted);

                // 1. Construir estructura
                let xmlNode = xmlService.buildCfdi40(xmlData);

                // 2. Sellar (Firma RSA-SHA256)
                xmlNode = await xmlService.sellarXml(
                    xmlNode,
                    emisorConfig.csd_cer_path,
                    emisorConfig.csd_key_path,
                    passDescrypted
                );

                // 3. Convertir a String
                xmlSelladoString = xmlService.nodeToString(xmlNode);
                console.log('[XML] XML Sellado Localmente generado con éxito.');

            } catch (xmlError) {
                console.error('[XML] Error en construcción/sellado local:', xmlError.message);
                // Continuamos con el flujo de Facturama si falla el sellado local por alguna razón
            }
        }

        const { timbrarXmlSellado } = require('../services/facturamaservice');

        // --- TIMBRADO FISCAL ---
        let timbradoExitoso = false;
        let facturamaData = null;

        if (xmlSelladoString) {
            try {
                console.log('[Facturama] Usando modalidad API-Lite para XML sellado localmente...');
                const response = await timbrarXmlSellado(xmlSelladoString, xmlData);
                facturamaData = response;
                timbradoExitoso = true;
                console.log('[Facturama] Timbrado exitoso via API-Lite. UUID:', facturamaData.Id);
            } catch (liteError) {
                console.error('[Facturama] Error en timbrado API-Lite:', liteError.message);
                throw new Error('Error al timbrar XML sellado: ' + liteError.message);
            }
        } else {
            // Fallback al flujo normal de JSON (opcional, dependiendo de si queremos forzar el sellado local)
            console.log('[Facturama] Cayendo a flujo de JSON (No se generó XML sellado local)');
            let cfdiJson;
            if (esComplementoPago) {
                const toNumber = (value, fallback = 0) => {
                    const parsed = Number(value);
                    return Number.isFinite(parsed) ? parsed : fallback;
                };

                const relatedDocument = complementoPago?.relatedDocument || {};
                const relatedUuid = String(relatedDocument.uuid || '').trim();
                if (!relatedUuid) {
                    throw new Error('Para CFDI de tipo P se requiere complementoPago.relatedDocument.uuid');
                }

                const paymentDate = complementoPago?.date || new Date().toISOString();
                const paymentCurrency = String(complementoPago?.currency || factura.moneda || 'MXN').trim().toUpperCase();
                const paymentForm = String(complementoPago?.paymentForm || factura.formaPago || '03').trim();
                const amountPaid = Number(toNumber(relatedDocument.amountPaid, complementoPago?.amount || 0).toFixed(2));
                const previousBalanceAmount = Number(toNumber(relatedDocument.previousBalanceAmount, amountPaid).toFixed(2));
                const impSaldoInsoluto = Number(toNumber(
                    relatedDocument.impSaldoInsoluto,
                    Math.max(previousBalanceAmount - amountPaid, 0)
                ).toFixed(2));
                const partialityNumber = Math.max(1, Math.trunc(toNumber(relatedDocument.partialityNumber, 1)));

                const relatedNode = {
                    Uuid: relatedUuid,
                    Serie: String(relatedDocument.serie || '').trim() || undefined,
                    Folio: String(relatedDocument.folio || '').trim() || undefined,
                    Currency: String(relatedDocument.currency || paymentCurrency).trim().toUpperCase(),
                    PaymentMethod: String(relatedDocument.paymentMethod || 'PPD').trim().toUpperCase(),
                    PartialityNumber: partialityNumber,
                    PreviousBalanceAmount: previousBalanceAmount,
                    AmountPaid: amountPaid,
                    ImpSaldoInsoluto: impSaldoInsoluto,
                    TaxObject: String(relatedDocument.taxObject || '01').trim()
                };

                if (!relatedNode.Serie) delete relatedNode.Serie;
                if (!relatedNode.Folio) delete relatedNode.Folio;

                const paymentsNode = {
                    Date: paymentDate,
                    PaymentForm: paymentForm,
                    Currency: paymentCurrency,
                    Amount: Number(toNumber(complementoPago?.amount, amountPaid).toFixed(2)),
                    RelatedDocuments: [relatedNode]
                };

                const exchangeRate = Number(toNumber(complementoPago?.exchangeRate, 1).toFixed(6));
                if (paymentCurrency !== 'MXN') {
                    paymentsNode.ExchangeRate = exchangeRate;
                }

                cfdiJson = {
                    NameId: '14',
                    CfdiType: 'P',
                    Serie: factura.serie || 'P',
                    Folio: factura.folio || '1',
                    ExpeditionPlace: emisorConfig.codigo_postal,
                    Receiver: {
                        Rfc: receptor.rfc,
                        Name: receptor.nombre,
                        FiscalRegime: receptor.regimenFiscal || '601',
                        TaxZipCode: receptor.codigoPostal,
                        CfdiUse: 'CP01'
                    },
                    Complemento: {
                        Payments: [paymentsNode]
                    }
                };

                cfdiJson.Complement = cfdiJson.Complemento;
            } else {
                if (receptor.rfc === 'XAXX010101000') {
                    receptor.regimenFiscal = '616';
                }
                cfdiJson = buildCfdiJson({
                    emisorConfig,
                    receptor,
                    conceptos: conceptosFacturama,
                    formaPago: factura.formaPago,
                    metodoPago: factura.metodoPago,
                    usoCfdi: receptor.usoCfdi,
                    informacionGlobal: informacionGlobal,
                    subtotal,
                    descuento: totalDescuento,
                    total,
                    totalImpuestosTrasladados,
                    tipoComprobante: tipoComprobanteReq,
                    cfdiType: tipoComprobanteReq
                });
            }

            const token = await getFacturamaToken();
            const response = await axios.post(
                `${FACTURAMA_BASE_URL}/3/cfdis`,
                cfdiJson,
                {
                    headers: {
                        'Authorization': `Basic ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            facturamaData = response.data;
            timbradoExitoso = true;
        }

        if (timbradoExitoso && facturamaData && facturamaData.Id) {
            // Calcular totales finales asegurando consistencia matemática
            const finalSubtotal = Number(facturamaData.Subtotal || facturamaData.SubTotal || subtotal);
            const finalDescuento = Number(facturamaData.Discount || facturamaData.Descuento || totalDescuento);

            // IVA: Intentar obtener de lo que regresó Facturama o usar nuestro cálculo local si no viene
            let finalIva = 0;
            if (facturamaData.Impuestos && (facturamaData.Impuestos.TotalImpuestosTrasladados !== undefined)) {
                finalIva = Number(facturamaData.Impuestos.TotalImpuestosTrasladados);
            } else if (facturamaData.TotalImpuestosTrasladados !== undefined) {
                finalIva = Number(facturamaData.TotalImpuestosTrasladados);
            } else {
                finalIva = Number(totalImpuestosTrasladados);
            }

            // Total: Confiar en Facturama pero validar contra cálculo local si hay discrepancia mayor a 1 centavo
            let finalTotal = Number(facturamaData.Total || total);
            const calculoLocal = Number((finalSubtotal - finalDescuento + finalIva).toFixed(2));

            if (Math.abs(finalTotal - calculoLocal) > 0.05) {
                console.warn(`[DEBUG] Discrepancia de totales: Facturama=${finalTotal} vs Local=${calculoLocal}. Usando cálculo local para el PDF.`);
                finalTotal = calculoLocal;
            }

            // Calcular peso total (asumiendo que los conceptos pueden traer peso unitario)
            const pesoTotal = conceptosInput.reduce((sum, c) => sum + ((parseFloat(c.peso) || 0) * (parseFloat(c.cantidad) || 0)), 0);

            const xmlTimbrado = String(facturamaData.Cfdi || '');
            const uuidDesdeXml =
                (xmlTimbrado.match(/\sUUID="([^"]+)"/i) || [])[1]
                || (xmlTimbrado.match(/\sUuid="([^"]+)"/i) || [])[1]
                || '';
            const uuidSat = uuidDesdeXml
                || facturamaData.Complement?.TaxStamp?.Uuid
                || facturamaData.Id
                || '';
            const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            if (!uuidRegex.test(String(uuidSat))) {
                throw new Error(`No se recibi� UUID fiscal v�lido del SAT para el timbrado (${uuidSat || 'sin valor'})`);
            }
            const prefijoFolio = tipoComprobanteReq === 'P' ? 'P' : (tipoComprobanteReq === 'E' ? 'NC' : 'B');
            const folioSat = `${prefijoFolio}-${uuidSat.substring(0, 8).toUpperCase()}`;
            const selloCfdiEmitido =
                (xmlTimbrado.match(/\sSello="([^"]+)"/i) || [])[1]
                || facturamaData.Sello
                || '';
            const noCertificadoEmisorEmitido =
                (xmlTimbrado.match(/\sNoCertificado="([^"]+)"/i) || [])[1]
                || facturamaData.NoCertificado
                || '';
            const selloSatEmitido =
                (xmlTimbrado.match(/SelloSAT="([^"]+)"/i) || [])[1]
                || facturamaData.Complement?.TaxStamp?.SatSign
                || facturamaData.SelloSAT
                || '';
            const noCertificadoSatEmitido =
                (xmlTimbrado.match(/NoCertificadoSAT="([^"]+)"/i) || [])[1]
                || facturamaData.Complement?.TaxStamp?.SatCertNumber
                || facturamaData.NoCertificadoSAT
                || '';
            const fechaTimbradoSat =
                (xmlTimbrado.match(/FechaTimbrado="([^"]+)"/i) || [])[1]
                || facturamaData.Complement?.TaxStamp?.Date
                || facturamaData.FechaTimbrado
                || new Date().toISOString();
            const cadenaOriginalSat =
                facturamaData.OriginalString
                || `||1.1|${uuidSat}|${fechaTimbradoSat}|${selloSatEmitido}|${noCertificadoSatEmitido}||`;

            // Preparar datos para el PDF
            const pdfData = {
                vendedor: req.user?.nombre || req.user?.username || 'SISTEMAS',
                peso_total: pesoTotal.toFixed(2),
                emisor: {
                    rfc: emisorConfig.rfc,
                    razon_social: emisorConfig.razon_social,
                    regimenFiscal: emisorConfig.regimen_fiscal,
                    codigoPostal: emisorConfig.codigo_postal
                },
                receptor: {
                    rfc: receptor.rfc,
                    nombre: receptor.nombreParaPdf || receptor.nombre,
                    regimenFiscal: receptor.regimenFiscal,
                    codigoPostal: receptor.codigoPostal,
                    usoCfdi: receptor.usoCfdi,
                    colonia: receptor.colonia || '',
                    municipio: receptor.municipio || '',
                    localidad: receptor.localidad || '',
                    estado: receptor.estado || '',
                    pais: receptor.pais || '',
                    direccion: receptor.direccion || ''
                },
                comprobante: {
                    tipo: factura.tipo || 'I',
                    serie: factura.serie || 'A',
                    moneda: factura.moneda || 'MXN',
                    tipoCambio: factura.tipoCambio || 1
                },
                conceptos: conceptosInput.map((concepto, idx) => {
                    const mapped = {
                        cantidad: concepto.cantidad,
                        claveProductoServicio: concepto.claveProductoServicio,
                        claveUnidad: concepto.claveUnidad,
                        unidad: concepto.unidad || 'H87',
                        descripcion: concepto.descripcion,
                        caracteristicas: concepto.caracteristicas || '',
                        valorUnitario: concepto.valorUnitario,
                        descuento: concepto.descuento || 0,
                        importe: (concepto.cantidad * concepto.valorUnitario) - (concepto.descuento || 0)
                    };
                    return mapped;
                }),
                totales: {
                    subtotal: finalSubtotal,
                    descuento: finalDescuento,
                    iva: finalIva,
                    total: finalTotal,
                    formaPago: factura.formaPago,
                    metodoPago: factura.metodoPago
                },
                cfdiInfo: {
                    uuid: uuidSat,
                    folio: folioSat,
                    fechaEmision: facturamaData.Date || new Date().toISOString(),
                    fechaTimbrado: fechaTimbradoSat,
                    selloDigital: selloCfdiEmitido || 'Sello no disponible',
                    noCertificadoEmisor: noCertificadoEmisorEmitido || 'No. Certificado no disponible',
                    selloSAT: selloSatEmitido || 'Sello SAT no disponible',
                    certificadoSAT: noCertificadoSatEmitido || 'Certificado SAT no disponible',
                    cadenaOriginal: cadenaOriginalSat,
                    rfcEmisor: emisorConfig.rfc,
                    rfcReceptor: receptor.rfc,
                    total: finalTotal
                },
                observaciones: observaciones || ''
            };

            // Generar PDF con el folio del SAT como nombre
            const nombreArchivo = `${folioSat}.pdf`;
            const rutaPDF = await pdfService.guardarPDF(pdfData, nombreArchivo);

            // Guardar XML en archivo (Respetando carpeta compartida)
            const nombreArchivoXml = `FACTURA-${uuidSat}.xml`;
            const storageDir = process.env.PDF_STORAGE_DIR || path.join(__dirname, '../../pdfs');
            const rutaXML = path.join(storageDir, nombreArchivoXml);

            if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
            fs.writeFileSync(rutaXML, facturamaData.Cfdi || '');

            // Guardar en base de datos
            const userId = req.user?.id_usuario || req.user?.id || null;

            const esMetodoPpd = String(factura.metodoPago || '').toUpperCase() === 'PPD';
            const estadoFactura = esComplementoPago ? 'Timbrada' : (esMetodoPpd ? 'Pendiente PPD' : 'Timbrada');
            const formaPagoFinal = esComplementoPago ? (factura.formaPago || '99') : (esMetodoPpd ? '99' : factura.formaPago);

            const insertFacturaRes = await db.query(
                `INSERT INTO facturas (
                    uuid, fecha_emision, fecha_timbrado, total, subtotal, total_descuento, total_iva,
                    forma_pago, metodo_pago, uso_cfdi, estado, xml_path, pdf_path,
                    sello_cfdi, sello_sat, no_certificado, no_certificado_sat, id_emisor, id_cliente,
                    id_usuario, folio
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                 RETURNING id_factura, folio, uuid, total, id_cliente, metodo_pago`,
                [
                    uuidSat,
                    new Date(),
                    new Date(fechaTimbradoSat),
                    finalTotal,
                    finalSubtotal,
                    finalDescuento,
                    finalIva,
                    formaPagoFinal,
                    factura.metodoPago,
                    receptor.usoCfdi,
                    estadoFactura,
                    nombreArchivoXml,
                    nombreArchivo,
                    selloCfdiEmitido || '',
                    selloSatEmitido || '',
                    noCertificadoEmisorEmitido || '',
                    noCertificadoSatEmitido || '',
                    1,
                    receptor.id_cliente || 1,
                    userId,
                    folioSat
                ]
            );

            const facturaInsertada = insertFacturaRes.rows[0];

            // Si es PPD, registrar el cargo en ledger para el módulo de abonos.
            if (!esComplementoPago && String(facturaInsertada?.metodo_pago || factura.metodoPago || '').toUpperCase() === 'PPD') {
                const saldoGlobalRes = await db.query(`
                    SELECT
                      COALESCE(SUM(CASE WHEN tipo_mov IN ('CARGO','COBRO_CREDITO','COBRO') THEN cargo ELSE 0 END),0) AS cargo,
                      COALESCE(SUM(CASE WHEN tipo_mov IN ('ABONO','PAGO','NC') THEN abono ELSE 0 END),0) AS abono
                    FROM customer_ledger
                    WHERE id_cliente = $1
                `, [receptor.id_cliente || 1]);
                const saldoAnteriorGlobal = Number(saldoGlobalRes.rows[0]?.cargo || 0) - Number(saldoGlobalRes.rows[0]?.abono || 0);
                const saldoResultanteGlobal = Number((saldoAnteriorGlobal + finalTotal).toFixed(2));

                await db.query(`
                    INSERT INTO customer_ledger
                    (id_cliente, fecha, tipo_mov, descripcion, referencia_tipo, referencia_id, cargo, abono, saldo_resultante, usuario_id)
                    VALUES ($1, CURRENT_TIMESTAMP, 'CARGO', $2, 'factura_ppd', $3, $4, 0, $5, $6)
                `, [
                    receptor.id_cliente || 1,
                    `Factura PPD ${folioSat} | UUID:${uuidSat}`,
                    facturaInsertada.id_factura,
                    finalTotal,
                    saldoResultanteGlobal,
                    userId
                ]);
            }

            res.json({
                success: true,
                message: 'Factura timbrada exitosamente',
                data: {
                    uuid: uuidSat, // Retornar el mismo que guardamos en DB
                    total: finalTotal,
                    estado: estadoFactura,
                    pdfPath: rutaPDF,
                    xml: facturamaData.Cfdi
                }
            });

        } else {
            // Si la respuesta de Facturama no contiene un Id, es un error
            throw new Error('Respuesta inválida de Facturama: No se recibió un ID de CFDI.');
        }

    } catch (error) {
        console.error('Error timbrando factura:', error);

        if (error.response) {
            console.error('Detalles del Error de Facturama:', error.response.data);
            // Intentar extraer un mensaje de error más específico de Facturama
            const modelState = error.response.data?.ModelState || {};
            const modelStateFlat = Object.entries(modelState)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' | ') : String(v)}`)
                .join(' ; ');
            const facturamaErrorMessage = error.response.data?.Message
                || error.response.data?.ExceptionMessage
                || 'La solicitud no es valida.';
            const detalle = modelStateFlat ? ` | Detalle: ${modelStateFlat}` : '';
            return res.status(400).json({
                success: false,
                error: `Error de Facturama: ${facturamaErrorMessage}${detalle}`
            });
        }

        res.status(500).json({
            success: false,
            error: `Error interno: ${error.message}`
        });
    }
};

// CANCELAR FACTURA
exports.cancelarFactura = async (req, res) => {
    try {
        const { uuid } = req.params;
        const { motivoCancelacion, motivo } = req.body;
        const finalMotivo = motivoCancelacion || motivo;

        if (!uuid || !finalMotivo) {
            return res.status(400).json({
                success: false,
                error: 'UUID y motivo de cancelación son requeridos'
            });
        }

        // Cancelar en Facturama usando el servicio robustecido
        await cancelarFacturaFacturama(uuid, finalMotivo);

        // Actualizar estado en base de datos
        await db.query(
            'UPDATE facturas SET estado = $1, motivo_cancelacion = $2 WHERE uuid = $3',
            ['Cancelada', finalMotivo, uuid]
        );

        res.json({
            success: true,
            message: 'Factura cancelada exitosamente',
            data: {
                uuid,
                status: 'Cancelada'
            }
        });

    } catch (error) {
        console.error('Error cancelando factura:', error);

        if (error.response) {
            return res.status(400).json({
                success: false,
                error: `Error de Facturama: ${error.response.data.Message || error.response.data}`
            });
        }

        res.status(500).json({
            success: false,
            error: `Error interno: ${error.message}`
        });
    }
};

// OBTENER FACTURA POR UUID
exports.getFacturaByUuid = async (req, res) => {
    try {
        const { uuid } = req.params;

        const result = await db.query(
            'SELECT * FROM facturas WHERE uuid = $1',
            [uuid]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Factura no encontrada'
            });
        }

        const factura = result.rows[0];

        res.json({
            success: true,
            data: factura
        });

    } catch (error) {
        console.error('Error obteniendo factura:', error);
        res.status(500).json({
            success: false,
            error: `Error interno: ${error.message}`
        });
    }
};

// OBTENER TODAS LAS FACTURAS
exports.getFacturas = async (req, res) => {
    try {
        const { search, estado, fecha_inicio, fecha_fin, id_cliente } = req.query;

        let query = `
            SELECT 
                f.uuid,
                f.fecha_emision,
                f.fecha_timbrado,
                f.total,
                f.subtotal,
                f.total_iva,
                f.forma_pago,
                f.metodo_pago,
                f.uso_cfdi,
                f.estado,
                f.pdf_path,
                f.xml_path,
                f.sello_cfdi,
                f.sello_sat,
                f.no_certificado,
                f.no_certificado_sat,
                f.folio,
                f.id_usuario,
                c.nombre as cliente_nombre,
                c.rfc as cliente_rfc,
                c.tipo as cliente_tipo,
                e.razon_social as emisor_nombre,
                e.rfc as emisor_rfc
            FROM facturas f
            LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
            LEFT JOIN emisores e ON f.id_emisor = e.id_emisor
            WHERE 1=1
        `;

        const queryParams = [];

        if (search) {
            queryParams.push(`%${search}%`);
            query += ` AND (f.folio ILIKE $${queryParams.length} OR c.nombre ILIKE $${queryParams.length} OR f.uuid::text ILIKE $${queryParams.length})`;
        }

        if (estado && estado !== 'Estado: Todos') {
            queryParams.push(estado);
            query += ` AND f.estado = $${queryParams.length}`;
        }

        if (fecha_inicio) {
            queryParams.push(fecha_inicio);
            query += ` AND f.fecha_emision >= $${queryParams.length}`;
        }

        if (fecha_fin) {
            queryParams.push(fecha_fin);
            query += ` AND f.fecha_emision <= $${queryParams.length}`;
        }

        if (id_cliente && id_cliente !== 'Cliente: Todos') {
            queryParams.push(id_cliente);
            query += ` AND f.id_cliente = $${queryParams.length}`;
        }

        query += ` ORDER BY f.fecha_emision DESC`;

        const result = await db.query(query, queryParams);

        // Construir WHERE para estadísticas basado en los mismos filtros que la tabla
        let statsWhere = " WHERE 1=1";
        const statsParams = [];

        if (search) {
            statsParams.push(`%${search}%`);
            statsWhere += ` AND (f.folio ILIKE $${statsParams.length} OR c.nombre ILIKE $${statsParams.length} OR f.uuid::text ILIKE $${statsParams.length})`;
        }
        if (estado && estado !== 'Estado: Todos') {
            statsParams.push(estado);
            statsWhere += ` AND f.estado = $${statsParams.length}`;
        }
        if (fecha_inicio) {
            statsParams.push(fecha_inicio);
            statsWhere += ` AND f.fecha_emision >= $${statsParams.length}`;
        }
        if (fecha_fin) {
            statsParams.push(fecha_fin);
            statsWhere += ` AND f.fecha_emision <= $${statsParams.length}`;
        }
        if (id_cliente && id_cliente !== 'Cliente: Todos') {
            statsParams.push(id_cliente);
            statsWhere += ` AND f.id_cliente = $${statsParams.length}`;
        }

        const statsResult = await db.query(`
            SELECT 
                -- Histórico
                COUNT(*) as total_facturas_hist,
                COUNT(CASE WHEN f.estado ILIKE 'Timbrad%' THEN 1 END) as facturas_timbradas_hist,
                COUNT(CASE WHEN f.estado ILIKE 'Cancelad%' THEN 1 END) as facturas_canceladas_hist,
                COUNT(CASE WHEN f.estado ILIKE 'Pendiente%' OR f.estado ILIKE 'Vencid%' THEN 1 END) as facturas_pendientes_hist,
                SUM(CASE WHEN f.estado ILIKE 'Timbrad%' THEN f.total ELSE 0 END) as total_ingresos_hist,
                SUM(CASE WHEN f.estado ILIKE 'Pendiente%' OR f.estado ILIKE 'Vencid%' THEN f.total ELSE 0 END) as por_cobrar_hist,
                SUM(CASE WHEN f.estado ILIKE 'Cancelad%' THEN f.total ELSE 0 END) as total_cancelado_hist,
                
                -- Este Mes
                COUNT(CASE WHEN date_trunc('month', f.fecha_emision) = date_trunc('month', CURRENT_DATE) THEN 1 END) as total_facturas_mes,
                SUM(CASE WHEN f.estado ILIKE 'Timbrad%' AND date_trunc('month', f.fecha_emision) = date_trunc('month', CURRENT_DATE) THEN f.total ELSE 0 END) as total_ingresos_mes,
                COUNT(CASE WHEN (f.estado ILIKE 'Pendiente%' OR f.estado ILIKE 'Vencid%') AND date_trunc('month', f.fecha_emision) = date_trunc('month', CURRENT_DATE) THEN 1 END) as facturas_pendientes_mes,
                SUM(CASE WHEN (f.estado ILIKE 'Pendiente%' OR f.estado ILIKE 'Vencid%') AND date_trunc('month', f.fecha_emision) = date_trunc('month', CURRENT_DATE) THEN f.total ELSE 0 END) as por_cobrar_mes,
                COUNT(CASE WHEN f.estado ILIKE 'Cancelad%' AND date_trunc('month', f.fecha_emision) = date_trunc('month', CURRENT_DATE) THEN 1 END) as facturas_canceladas_mes,
                SUM(CASE WHEN f.estado ILIKE 'Cancelad%' AND date_trunc('month', f.fecha_emision) = date_trunc('month', CURRENT_DATE) THEN f.total ELSE 0 END) as total_cancelado_mes,

                -- Este Año
                COUNT(CASE WHEN date_trunc('year', f.fecha_emision) = date_trunc('year', CURRENT_DATE) THEN 1 END) as total_facturas_anio,
                SUM(CASE WHEN f.estado ILIKE 'Timbrad%' AND date_trunc('year', f.fecha_emision) = date_trunc('year', CURRENT_DATE) THEN f.total ELSE 0 END) as total_ingresos_anio,
                COUNT(CASE WHEN (f.estado ILIKE 'Pendiente%' OR f.estado ILIKE 'Vencid%') AND date_trunc('year', f.fecha_emision) = date_trunc('year', CURRENT_DATE) THEN 1 END) as facturas_pendientes_anio,
                SUM(CASE WHEN (f.estado ILIKE 'Pendiente%' OR f.estado ILIKE 'Vencid%') AND date_trunc('year', f.fecha_emision) = date_trunc('year', CURRENT_DATE) THEN f.total ELSE 0 END) as por_cobrar_anio,
                COUNT(CASE WHEN f.estado ILIKE 'Cancelad%' AND date_trunc('year', f.fecha_emision) = date_trunc('year', CURRENT_DATE) THEN 1 END) as facturas_canceladas_anio,
                SUM(CASE WHEN f.estado ILIKE 'Cancelad%' AND date_trunc('year', f.fecha_emision) = date_trunc('year', CURRENT_DATE) THEN f.total ELSE 0 END) as total_cancelado_anio
            FROM facturas f
            LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
            ${statsWhere}
        `, statsParams);

        console.log('[DEBUG-BACKEND] Raw Stats Result:', statsResult.rows[0]);

        // Calcular evolución mensual (últimos 6 meses)
        const evolutionResult = await db.query(`
            SELECT 
                TO_CHAR(fecha_emision, 'Mon') as mes,
                EXTRACT(MONTH FROM fecha_emision) as mes_num,
                EXTRACT(YEAR FROM fecha_emision) as anio,
                SUM(CASE WHEN estado ILIKE 'Timbrad%' THEN total ELSE 0 END) as timbrado,
                SUM(CASE WHEN estado ILIKE 'Cancelad%' THEN total ELSE 0 END) as cancelado,
                SUM(total) as facturado
            FROM facturas
            WHERE fecha_emision >= CURRENT_DATE - INTERVAL '6 months'
            GROUP BY anio, mes_num, mes
            ORDER BY anio DESC, mes_num DESC
            LIMIT 6
        `);

        // Calcular distribución por estado
        const distributionResult = await db.query(`
            SELECT f.estado, COUNT(*) as cantidad
            FROM facturas f
            LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
            ${statsWhere}
            GROUP BY f.estado
        `, statsParams);
        const stats = statsResult.rows[0] || {};
        const estadisticas = {
            resumen: {
                historico: {
                    totalFacturas: parseInt(stats.total_facturas_hist || 0),
                    timbradas: parseInt(stats.facturas_timbradas_hist || 0),
                    canceladas: parseInt(stats.facturas_canceladas_hist || 0),
                    pendientes: parseInt(stats.facturas_pendientes_hist || 0),
                    totalIngresos: parseFloat(stats.total_ingresos_hist || 0),
                    porCobrar: parseFloat(stats.por_cobrar_hist || 0),
                    totalCancelado: parseFloat(stats.total_cancelado_hist || 0)
                },
                mes: {
                    totalFacturas: parseInt(stats.total_facturas_mes || 0),
                    pendientes: parseInt(stats.facturas_pendientes_mes || 0),
                    canceladas: parseInt(stats.facturas_canceladas_mes || 0),
                    totalIngresos: parseFloat(stats.total_ingresos_mes || 0),
                    porCobrar: parseFloat(stats.por_cobrar_mes || 0),
                    totalCancelado: parseFloat(stats.total_cancelado_mes || 0)
                },
                anio: {
                    totalFacturas: parseInt(stats.total_facturas_anio || 0),
                    pendientes: parseInt(stats.facturas_pendientes_anio || 0),
                    canceladas: parseInt(stats.facturas_canceladas_anio || 0),
                    totalIngresos: parseFloat(stats.total_ingresos_anio || 0),
                    porCobrar: parseFloat(stats.por_cobrar_anio || 0),
                    totalCancelado: parseFloat(stats.total_cancelado_anio || 0)
                }
            },
            evolucion: evolutionResult.rows.reverse(),
            distribucion: distributionResult.rows
        };

                // Formatear las facturas para el frontend
        const facturas = result.rows.map(factura => {
            const fechaEmision = new Date(factura.fecha_emision);
            const fechaVencimiento = new Date(factura.fecha_emision);
            fechaVencimiento.setDate(fechaVencimiento.getDate() + 30); // 30 d�as de plazo
            const estadoDb = String(factura.estado || '').toUpperCase();
            const esComplemento = String(factura.uso_cfdi || '').toUpperCase() === 'CP01'
                || String(factura.folio || '').toUpperCase().startsWith('P-');

            // Determinar estado de pago
            let estadoPago = 'Pagada';
            let montoPagado = factura.total;
            let fechaPago = factura.fecha_emision;

            if (estadoDb.startsWith('CANCELAD')) {
                estadoPago = 'Cancelada';
                montoPagado = 0;
                fechaPago = null;
            } else if (estadoDb.startsWith('PENDIENTE')) {
                estadoPago = 'Pendiente';
                montoPagado = 0;
                fechaPago = null;
            } else if (esComplemento && estadoDb.startsWith('TIMBRAD')) {
                estadoPago = 'Timbrada';
            } else if (new Date() > fechaVencimiento && factura.total > 0 && estadoDb.startsWith('TIMBRAD')) {
                estadoPago = 'Vencida';
                montoPagado = 0;
                fechaPago = null;
            } else if (estadoDb.startsWith('TIMBRAD') && factura.total > 0) {
                estadoPago = 'Pendiente';
                montoPagado = 0;
                fechaPago = null;
            }

            return {
                uuid: factura.uuid,
                folio: factura.folio || (factura.uuid ? `B-${factura.uuid.substring(0, 4)}` : 'S/F'),
                contrato: `CONT-${factura.uuid.substring(0, 8)}`,
                id_usuario: factura.id_usuario,
                uso_cfdi: factura.uso_cfdi || '',
                es_complemento_pago: esComplemento,
                cliente: {
                    nombre: factura.cliente_nombre || 'Cliente General',
                    rfc: factura.cliente_rfc || 'N/A',
                    tipo: factura.cliente_tipo || 'Empresa',
                    metodo: factura.forma_pago === '03' ? 'Transferencia' :
                        factura.forma_pago === '01' ? 'Efectivo' : 'Otros'
                },
                estado: estadoPago,
                estado_db: factura.estado, // <- EXPOSICI�N DEL ESTADO REAL DE BD PARA C�LCULOS KPI
                fechas: {
                    emision: fechaEmision.toISOString().split('T')[0],
                    vencimiento: fechaVencimiento.toISOString().split('T')[0]
                },
                metodo_pago: factura.metodo_pago || 'PUE',
                monto: factura.total,
                pagado: {
                    monto: montoPagado,
                    fecha: fechaPago ? new Date(fechaPago).toISOString().split('T')[0] : null,
                    porcentaje: factura.total > 0 ? (montoPagado / factura.total) * 100 : 0
                },
                emisor: {
                    nombre: factura.emisor_nombre || 'Emisor',
                    rfc: factura.emisor_rfc || 'N/A'
                },
                receptor: {
                    nombre: factura.cliente_nombre || 'Cliente',
                    rfc: factura.cliente_rfc || 'N/A'
                }
            };
        });
        res.json({
            success: true,
            data: {
                facturas,
                estadisticas
            }
        });

    } catch (error) {
        console.error('Error obteniendo facturas:', error);
        res.status(500).json({
            success: false,
            error: `Error interno: ${error.message}`
        });
    }
};

// DESCARGAR PDF DE FACTURA
exports.descargarPDF = async (req, res) => {
    try {
        const { uuid } = req.params;

        const result = await db.query(
            'SELECT pdf_path FROM facturas WHERE uuid = $1',
            [uuid]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Factura no encontrada'
            });
        }

        const factura = result.rows[0];

        // Lógica de portabilidad: si la ruta guardada no existe (ej. era de otra PC),
        // buscamos el nombre del archivo en nuestra carpeta de almacenamiento configurada
        let finalPath = factura.pdf_path;
        console.log('[PDF DEBUG] Initial path from DB:', finalPath);

        if (!finalPath || !fs.existsSync(finalPath)) {
            console.log('[PDF DEBUG] Path not found or empty, trying fallback...');
            const fileName = path.basename(factura.pdf_path || '');
            const storageDir = process.env.PDF_STORAGE_DIR || path.join(__dirname, '../../pdfs');
            const localPath = path.join(storageDir, fileName);
            console.log('[PDF DEBUG] Storage Dir:', storageDir);
            console.log('[PDF DEBUG] Attempting local path:', localPath);

            if (fs.existsSync(localPath)) {
                finalPath = localPath;
                console.log('[PDF DEBUG] Success! Found at:', finalPath);
            } else {
                console.log('[PDF DEBUG] Error: File not found anywhere.');
                return res.status(404).json({
                    success: false,
                    error: 'PDF no encontrado en el servidor'
                });
            }
        } else {
            console.log('[PDF DEBUG] Success! Original path exists.');
        }

        const isInline = String(req.query.inline) === 'true';

        if (isInline) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="factura.pdf"');
            return res.sendFile(path.resolve(finalPath));
        }

        res.download(path.resolve(finalPath), `FACTURA-${uuid}.pdf`);

    } catch (error) {
        console.error('Error descargando PDF:', error);
        res.status(500).json({
            success: false,
            error: `Error interno: ${error.message}`
        });
    }
};

// BUSCAR DOCUMENTO (COTIZACIÓN O EQUIPO PARA RENTA)
exports.searchDocumentByFolio = async (req, res) => {
    try {
        const { query } = req.params;
        console.log(`[searchDocumentByFolio] Buscando: ${query}`);
        // debug: mostrar filas de facturas coincidentes

        // 0. Intentar buscar factura existente por folio o UUID
        const searchQuery = `%${query}%`;
        try {
            const factRes = await db.query(
                `SELECT f.*, c.nombre as cliente_nombre, c.rfc as cliente_rfc
                 FROM facturas f
                 LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
                 WHERE f.folio ILIKE $1 OR f.uuid::text ILIKE $1
                 LIMIT 5`,
                [searchQuery]
            );
            console.log(`[searchDocumentByFolio] facturas encontrados: ${factRes.rows.length}`);
            if (factRes.rows.length > 0) {
                return res.json({ success: true, type: 'FACTURA', facturas: factRes.rows });
            }
        } catch (fErr) {
            console.log('Error buscando facturas:', fErr.message);
        }

        // 1. SI ES COTIZACIÓN DE VENTA (VEN-)
        if (query.toUpperCase().startsWith('VEN-')) {
            const result = await db.query(
                `SELECT c.id_cotizacion, c.numero_cotizacion, c.tipo, c.subtotal, c.total, c.costo_envio,
                        c.garantia_porcentaje, c.garantia_monto, c.configuracion_especial,
                        c.productos_seleccionados, c.id_cliente,
                        cl.nombre as cliente_nombre, cl.rfc as cliente_rfc, 
                        cl.email as cliente_email, cl.codigo_postal as cliente_cp,
                        cl.regimen_fiscal as cliente_regimen, cl.uso_cfdi as cliente_uso_cfdi,
                        cl.razon_social as cliente_razon_social, cl.colonia as cliente_colonia,
                        cl.ciudad as cliente_ciudad, cl.localidad as cliente_localidad,
                        cl.estado_direccion as cliente_estado, cl.pais as cliente_pais
                 FROM cotizaciones c
                 LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
                 WHERE c.numero_cotizacion = $1 AND c.tipo = 'VENTA'`,
                [query]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Cotización de venta no encontrada' });
            }

            const doc = result.rows[0];
            let productos = [];

            try {
                productos = typeof doc.productos_seleccionados === 'string'
                    ? JSON.parse(doc.productos_seleccionados)
                    : (doc.productos_seleccionados || []);
            } catch (e) {
                console.error('Error parseando productos:', e);
            }

            return res.json({
                success: true,
                type: 'VENTA',
                cliente: {
                    id: doc.id_cliente,
                    nombre: doc.cliente_nombre,
                    rfc: doc.cliente_rfc,
                    razon_social: doc.cliente_razon_social || doc.cliente_nombre,
                    regimen_fiscal: doc.cliente_regimen,
                    codigo_postal: doc.cliente_cp,
                    uso_cfdi: doc.cliente_uso_cfdi || 'G03',
                    colonia: doc.cliente_colonia,
                    municipio: doc.cliente_ciudad,
                    localidad: doc.cliente_localidad,
                    estado: doc.cliente_estado,
                    pais: doc.cliente_pais
                },
                cotizacion: doc, // Enviamos el objeto completo para que el frontend tenga acceso a descuentos, IVA, etc.
                conceptos: productos.map(p => ({
                    cantidad: p.cantidad || 1,
                    claveProductoServicio: p.clave_sat_productos || '01010101',
                    claveUnidad: 'H87', // Pieza por defecto para venta
                    descripcion: p.nombre || p.descripcion || 'Producto',
                    valorUnitario: p.precio_venta || p.precio || 0,
                    importe: (p.cantidad || 1) * (p.precio_venta || p.precio || 0)
                }))
            });
        }

        // 2. SI NO ES VEN-, BUSCAR EN PRODUCTOS (CASO RENTA / EQUIPO EJ: T-2)
        const prodResult = await db.query(
            `SELECT p.* FROM public.productos p 
             WHERE p.nombre_del_producto ILIKE $1 OR p.clave ILIKE $1 
             LIMIT 1`,
            [searchQuery]
        );
        console.log(`[searchDocumentByFolio] productos encontrados: ${prodResult.rows.length}`);
        if (prodResult.rows.length > 0) {
            const prod = prodResult.rows[0];
            return res.json({
                success: true,
                type: 'RENTA',
                cliente: null, // El usuario deberá seleccionar cliente o vendrá luego
                conceptos: [
                    {
                        cantidad: 1,
                        claveProductoServicio: '72141700', // Clave SAT Arrendamiento
                        claveUnidad: 'E48', // Unidad de servicio
                        descripcion: `Servicios de arrendamiento de equipo: ${prod.nombre_del_producto}`,
                        valorUnitario: prod.tarifa_renta || 0,
                        importe: prod.tarifa_renta || 0
                    }
                ]
            });
        }

        // 3. SI NO ES NADA DE LO ANTERIOR, BUSCAR DIRECTAMENTE EN CLIENTES (SOPORTE MULTIPLE PARA AUTOCOMPLETE)
        const clientResult = await db.query(
            `SELECT id_cliente, nombre, rfc, fact_rfc, razon_social, regimen_fiscal, codigo_postal, colonia, ciudad, localidad, estado_direccion, pais, uso_cfdi, domicilio, direccion, numero_ext 
             FROM clientes 
             WHERE nombre ILIKE $1 OR rfc ILIKE $1 OR fact_rfc ILIKE $1 OR razon_social ILIKE $1 OR numero_cliente ILIKE $1
             LIMIT 10`,
            [searchQuery]
        );
        console.log(`[searchDocumentByFolio] clientes encontrados: ${clientResult.rows.length}`);
        if (clientResult.rows.length > 0) {
            // Si hay un solo resultado y no es una búsqueda parcial (o el usuario presionó Buscar)
            // podríamos devolver el formato antiguo, pero para consistencia devolveremos lista si es necesario.
            // Para el frontend actual, si hay resultados, los devolvemos como una lista de clientes.

            return res.json({
                success: true,
                type: 'CLIENTE_LIST',
                clientes: clientResult.rows.map(cl => ({
                    id: cl.id_cliente,
                    nombre: cl.nombre,
                    rfc: cl.fact_rfc || cl.rfc,
                    razon_social: cl.razon_social || cl.nombre,
                    regimen_fiscal: cl.regimen_fiscal,
                    codigo_postal: cl.codigo_postal,
                    colonia: cl.colonia,
                    municipio: cl.ciudad,
                    localidad: cl.localidad,
                    estado: cl.estado_direccion,
                    pais: cl.pais,
                    uso_cfdi: cl.uso_cfdi || 'G03',
                    direccion: `${cl.domicilio || cl.direccion || ''} ${cl.numero_ext || ''}`.trim() || 'Dirección no disponible'
                }))
            });
        }

        res.status(404).json({ success: false, error: 'No se encontró cotización, equipo ni cliente relacionado' });

    } catch (error) {
        console.error('Error en searchDocumentByFolio:', error);
        res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
};

// --- BÚSQUEDA DE CONCEPTOS PARA MODAL (PHASE 4) ---
exports.searchConcepts = async (req, res) => {
    try {
        const { query } = req.params;
        const searchQuery = `%${query}%`;
        const results = [];

        // 1. Cotizaciones de Venta (Buscar por los últimos dígitos del folio o folio completo)
        const cotQuery = `
            SELECT id_cotizacion, numero_cotizacion, productos_seleccionados, subtotal, total, costo_envio,
                   garantia_porcentaje, garantia_monto, configuracion_especial
            FROM cotizaciones
            WHERE (numero_cotizacion ILIKE $1 OR numero_cotizacion LIKE '%' || $2)
              AND tipo = 'VENTA'
            LIMIT 5
        `;
        const cots = await db.query(cotQuery, [searchQuery, query]);

        // Enriquecer cada cotización con datos frescos de los productos (PHASE 5)
        for (let c of cots.rows) {
            let pSel = c.productos_seleccionados;
            if (typeof pSel === 'string') pSel = JSON.parse(pSel);

            if (pSel && Array.isArray(pSel)) {
                // Obtener IDs de productos para búsqueda masiva
                const productIds = pSel.filter(p => p.id_producto).map(p => p.id_producto);
                const prodInfoQuery = `
                        SELECT id_producto, clave_sat_productos, nombre_del_producto, precio_venta, clave, peso
                        FROM public.productos
                        WHERE id_producto = ANY($1)
                    `;
                const prodInfos = await db.query(prodInfoQuery, [productIds]);
                const prodMap = {};
                prodInfos.rows.forEach(pi => { prodMap[pi.id_producto] = pi; });

                // Mapear datos enriquecidos
                c.productos_seleccionados = pSel.map(p => {
                    const info = prodMap[p.id_producto];
                    const internalKey = info ? info.clave : (p.clave || '');
                    const productName = info ? info.nombre_del_producto : p.nombre;

                    const dbPeso = info ? Number(info.peso) : 0;
                    const jsonPeso = Number(p.peso) || 0;

                    return {
                        ...p,
                        clave_sat_productos: info ? info.clave_sat_productos : (p.clave_sat_productos || '01010101'),
                        nombre: internalKey ? `[${internalKey}] ${productName}` : productName,
                        precio_unitario: p.precio_unitario || (info ? info.precio_venta : (p.precio_venta || p.precio || 0)),
                        peso: dbPeso > 0 ? dbPeso : jsonPeso
                    };
                });
            }

            results.push({
                type: 'COTIZACION',
                id: c.id_cotizacion,
                title: `Cotización: ${c.numero_cotizacion}`,
                info: `Monto: $${c.total} | ${pSel ? pSel.length : 0} items`,
                data: c
            });
        }

        // 2. Servicios (Buscar por nombre)
        const servQuery = `
            SELECT id_servicio, nombre_servicio, clave_sat_servicios, precio_unitario, descripcion
            FROM public.servicios
            WHERE (nombre_servicio ILIKE $1 OR descripcion ILIKE $1)
              AND activo = true
            LIMIT 5
        `;
        const servs = await db.query(servQuery, [searchQuery]);
        servs.rows.forEach(s => {
            results.push({
                type: 'SERVICIO',
                id: s.id_servicio,
                title: s.nombre_servicio,
                info: `Precio Sugerido: $${s.precio_unitario}`,
                sat: s.clave_sat_servicios,
                unidad: 'E48',
                price: s.precio_unitario
            });
        });

        // 3. Productos / Renta (Torres, etc.)
        const prodQuery = `
            SELECT id_producto, nombre_del_producto, clave, tarifa_renta, precio_venta, id_categoria, clave_sat_productos, peso
            FROM public.productos
            WHERE (nombre_del_producto ILIKE $1 OR clave ILIKE $1)
            LIMIT 5
        `;
        const prods = await db.query(prodQuery, [searchQuery]);
        prods.rows.forEach(p => {
            const displayTitle = p.clave ? `[${p.clave}] ${p.nombre_del_producto}` : p.nombre_del_producto;
            results.push({
                type: 'PRODUCTO',
                id: p.id_producto,
                title: displayTitle,
                info: `Clave: ${p.clave} | Venta: $${p.precio_venta} | Renta: $${p.tarifa_renta}`,
                sat: p.clave_sat_productos || '01010101',
                unidad: 'H87', // Pieza por defecto
                price: p.precio_venta || p.tarifa_renta || 0,
                peso: p.peso || 0
            });
        });

        res.json({ success: true, results });
    } catch (error) {
        console.error('Error en searchConcepts:', error);
        res.status(500).json({ success: false, error: 'Error interno de búsqueda' });
    }
};

// ---------------------------------------------
// Notas de crédito: endpoints auxiliares
// ---------------------------------------------

exports.getEligibleCreditBalance = async (req, res) => {
    try {
        const { facturaId } = req.params;
        const fact = await db.query('SELECT total FROM facturas WHERE id_factura = $1', [facturaId]);
        if (fact.rows.length === 0) return res.status(404).json({ success: false, error: 'Factura origen no encontrada' });
        const total = parseFloat(fact.rows[0].total || 0);
        const pagos = await db.query("SELECT COALESCE(SUM(monto),0) as suma FROM pagos WHERE id_factura = $1 AND estado = 'APLICADO'", [facturaId]);
        const nc = await db.query("SELECT COALESCE(SUM(total),0) as suma FROM credit_notes WHERE id_factura_origen = $1 AND estado != $2", [facturaId, 'Cancelada']);
        const saldoElegible = total - parseFloat(pagos.rows[0].suma) - parseFloat(nc.rows[0].suma);
        res.json({ success: true, saldoElegible });
    } catch (error) {
        console.error('getEligibleCreditBalance error', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
};

exports.timbrarNotaCredito = async (req, res) => {
    // NOTE: el flujo es similar a timbrarFactura pero con ajustes para CFDI Egreso
    try {
        const { receptor, factura, conceptos, relatedCfdi, creditNote } = req.body;
        if (factura.tipo !== 'E') {
            return res.status(400).json({ success: false, error: 'Tipo de comprobante inválido' });
        }
        if (!creditNote || !creditNote.facturaOrigenId) {
            return res.status(400).json({ success: false, error: 'Factura origen es obligatoria para nota de crédito' });
        }
        // validar saldo elegible usando montos de conceptos
        const bal = await db.query('SELECT total, uuid FROM facturas WHERE id_factura=$1', [creditNote.facturaOrigenId]);
        if (bal.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Factura origen no encontrada' });
        }
        const totalOrig = parseFloat(bal.rows[0].total || 0);
        const pagos = await db.query("SELECT COALESCE(SUM(monto),0) as suma FROM pagos WHERE id_factura=$1 AND estado='APLICADO'", [creditNote.facturaOrigenId]);
        const ncprev = await db.query("SELECT COALESCE(SUM(total),0) as suma FROM credit_notes WHERE id_factura_origen=$1 AND estado != $2", [creditNote.facturaOrigenId, 'Cancelada']);
        const elegible = totalOrig - parseFloat(pagos.rows[0].suma) - parseFloat(ncprev.rows[0].suma);
        // calcular total de conceptos enviados
        const totalConceptos = conceptos ? conceptos.reduce((s, c) => s + ((parseFloat(c.cantidad) || 0) * (parseFloat(c.valorUnitario) || 0) - (parseFloat(c.descuento) || 0)), 0) : 0;
        if (totalConceptos > elegible + 0.01) {
            return res.status(400).json({ success: false, error: 'Monto de nota excede saldo elegible' });
        }

        // construimos timbrado real con Facturama (flujo JSON simplificado)
        // 1. obtener datos de emisor (igual que en timbrarFactura)
        const emisorQuery = await db.query(
            'SELECT rfc, razon_social, regimen_fiscal, codigo_postal, csd_cer, csd_key, csd_password FROM emisores ORDER BY id_emisor DESC LIMIT 1'
        );
        if (emisorQuery.rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Emisor no configurado.' });
        }
        const emisorRaw = emisorQuery.rows[0];
        const emisorConfig = {
            rfc: emisorRaw.rfc,
            razon_social: emisorRaw.razon_social,
            regimen_fiscal: emisorRaw.regimen_fiscal,
            codigo_postal: emisorRaw.codigo_postal,
            csd_cer_path: emisorRaw.csd_cer,
            csd_key_path: emisorRaw.csd_key,
            csd_password_encrypted: emisorRaw.csd_password
        };

        // 2. obtener uuid de factura origen para relacion (lo teníamos en 'bal' si lo guardamos arriba)
        const uuidOrig = bal.rows[0].uuid || null;

        // 3. mapear conceptos a formato Facturama
        const conceptosFacturama = conceptos.map(concepto => {
            const cantidad = Number(Number(concepto.cantidad || 0).toFixed(6));
            const valorUnitario = Number(Number(concepto.valorUnitario || 0).toFixed(6));
            const descuento = Number(Number(concepto.descuento || 0).toFixed(2));
            const importe = Number((cantidad * valorUnitario).toFixed(2));
            const baseImpuesto = Number((importe - descuento).toFixed(2));

            if (!concepto.claveProductoServicio || concepto.claveProductoServicio.trim() === '') {
                throw new Error(`Clave de producto/servicio es requerida para el concepto: ${concepto.descripcion || 'Sin descripción'}`);
            }

            let itemTaxes = [];
            if (concepto.impuestos && concepto.impuestos.traslados) {
                itemTaxes = concepto.impuestos.traslados.map(t => ({
                    Base: Number(t.base || 0).toFixed(2),
                    Impuesto: t.impuesto,
                    TipoFactor: t.tipoFactor,
                    TasaOCuota: Number(t.tasaOCuota || 0),
                    Importe: Number(t.importe || 0).toFixed(2)
                }));
            }

            return {
                ClaveProductoServicio: concepto.claveProductoServicio,
                Cantidad: cantidad,
                ClaveUnidad: concepto.claveUnidad,
                Unidad: concepto.unidad || 'Unidad de servicio',
                Descripcion: concepto.descripcion,
                ValorUnitario: valorUnitario,
                Importe: importe,
                Descuento: descuento,
                ObjetoImp: concepto.objetoImp || concepto.objetoImp || '02',
                ...(itemTaxes.length > 0 && { Impuestos: { Traslados: itemTaxes } })
            };
        });

        // 4. totales
        const subtotal = Number(conceptosFacturama.reduce((sum, c) => sum + c.Importe, 0).toFixed(2));
        const totalDescuento = Number(conceptosFacturama.reduce((sum, c) => sum + (c.Descuento || 0), 0).toFixed(2));
        const totalImpuestosTrasladados = Number(conceptosFacturama.reduce((sum, c) => {
            if (c.Impuestos && c.Impuestos.Traslados) {
                return sum + c.Impuestos.Traslados.reduce((s, t) => s + t.Importe, 0);
            }
            return sum;
        }, 0).toFixed(2));
        const finalTotalCalc = Number((subtotal - totalDescuento + totalImpuestosTrasladados).toFixed(2));

        // 5. construir JSON para Facturama
        if (receptor.rfc === 'XAXX010101000') {
            receptor.regimenFiscal = '616';
        }
        const cfdiJson = buildCfdiJson({
            emisorConfig,
            receptor,
            conceptos: conceptosFacturama,
            formaPago: factura.formaPago,
            metodoPago: factura.metodoPago,
            usoCfdi: receptor.usoCfdi,
            informacionGlobal: receptor.rfc === 'XAXX010101000' ? {
                periodicidad: '01', meses: String(new Date().getMonth() + 1).padStart(2, '0'), año: String(new Date().getFullYear())
            } : undefined,
            subtotal,
            descuento: totalDescuento,
            total: finalTotalCalc,
            totalImpuestosTrasladados,
            tipoComprobante: 'E',
            cfdiType: 'E',
            relatedCfdi: uuidOrig ? [{ Uuid: uuidOrig, RelationType: creditNote.tipoRelacion }] : undefined
        });

        const token = await getFacturamaToken();
        const response = await axios.post(
            `${FACTURAMA_BASE_URL}/3/cfdis`,
            cfdiJson,
            {
                headers: {
                    'Authorization': `Basic ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        const facturamaData = response.data;
        if (!facturamaData || !facturamaData.Id) {
            throw new Error('Respuesta inválida de Facturama para NC');
        }

        // usar los totales regresados pero validar igual que timbrarFactura
        const finalSubtotal = Number(facturamaData.Subtotal || facturamaData.SubTotal || subtotal);
        const finalDescuento = Number(facturamaData.Discount || facturamaData.Descuento || totalDescuento);
        let finalIva = 0;
        if (facturamaData.Impuestos && (facturamaData.Impuestos.TotalImpuestosTrasladados !== undefined)) {
            finalIva = Number(facturamaData.Impuestos.TotalImpuestosTrasladados);
        } else if (facturamaData.TotalImpuestosTrasladados !== undefined) {
            finalIva = Number(facturamaData.TotalImpuestosTrasladados);
        } else {
            finalIva = Number(totalImpuestosTrasladados);
        }
        let finalTotal = Number(facturamaData.Total || finalTotalCalc);
        const calculoLocal = Number((finalSubtotal - finalDescuento + finalIva).toFixed(2));
        if (Math.abs(finalTotal - calculoLocal) > 0.05) {
            finalTotal = calculoLocal;
        }

        // guardar xml en almacenamiento similar a factura
        const uuidSat = facturamaData.Complement?.TaxStamp?.Uuid || facturamaData.Id;
        const nombreArchivoXml = `NOTA_CREDITO-${uuidSat}.xml`;
        const storageDir = process.env.PDF_STORAGE_DIR || path.join(__dirname, '../../pdfs');
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
        fs.writeFileSync(path.join(storageDir, nombreArchivoXml), facturamaData.Cfdi || '');

        // 6. guardar en base de datos nota de crédito
        const insertRes = await db.query(
            `INSERT INTO credit_notes (uuid, serie, folio, id_cliente, id_factura_origen, subtotal, impuestos, total, motivo_sat, tipo_relacion, estado, created_by, stamped_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
            [
                uuidSat,
                factura.serie || null,
                uuidSat.substring(0, 10),
                receptor.id_cliente,
                creditNote.facturaOrigenId,
                finalSubtotal,
                finalIva,
                finalTotal,
                creditNote.motivoSat,
                creditNote.tipoRelacion,
                'Timbrada',
                req.user?.id_usuario || req.user?.id || null,
                req.user?.id_usuario || req.user?.id || null
            ]
        );
        const creditNoteRec = insertRes.rows[0];

        // 7. actualizar ledger y audit
        await db.query(
            `INSERT INTO customer_ledger (id_cliente, fecha, tipo_mov, referencia_tipo, referencia_id, abono, saldo_resultante, usuario_id)
             VALUES ($1, CURRENT_TIMESTAMP, 'NC', 'credit_note', $2, $3, $4, $5)`,
            [receptor.id_cliente, creditNoteRec.id, finalTotal, elegible - finalTotal, req.user?.id_usuario || req.user?.id || null]
        );
        await db.query(
            `INSERT INTO audit_financial_events (evento, tabla, registro_id, usuario_id, detalles)
             VALUES ($1, $2, $3, $4, $5)`,
            ['CREAR_NC', 'credit_notes', creditNoteRec.id, req.user?.id_usuario || req.user?.id || null, JSON.stringify({ facturaOrigen: creditNote.facturaOrigenId, total: finalTotal })]
        );

        res.json({ success: true, message: 'Nota de crédito timbrada correctamente', data: { uuid: uuidSat, total: finalTotal, xml: facturamaData.Cfdi } });
    } catch (error) {
        console.error('timbrarNotaCredito error', error);
        res.status(500).json({ success: false, error: 'Error interno al timbrar nota de crédito' });
    }
};

exports.getCreditNotes = async (req, res) => {
    try {
        const { cliente, estado } = req.query;
        let q = 'SELECT * FROM credit_notes WHERE 1=1';
        const params = [];
        if (cliente) { params.push(cliente); q += ` AND id_cliente = $${params.length}`; }
        if (estado) { params.push(estado); q += ` AND estado = $${params.length}`; }
        q += ' ORDER BY fecha_creacion DESC';
        const result = await db.query(q, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('getCreditNotes error', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
};

exports.getCreditNoteById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT * FROM credit_notes WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Nota no encontrada' });
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('getCreditNoteById error', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
};

exports.cancelarNotaCredito = async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        if (!motivo) return res.status(400).json({ success: false, error: 'Motivo de cancelación es requerido' });
        // TODO: Llamar a API de cancelación de CFDI
        await db.query('UPDATE credit_notes SET estado=$1, canceled_by=$2, fecha_cancelacion=CURRENT_TIMESTAMP WHERE id=$3', ['Cancelada', req.user?.id_usuario || req.user?.id || null, id]);
        // audit
        await db.query(`INSERT INTO audit_financial_events (evento, tabla, registro_id, usuario_id, detalles) VALUES ($1,$2,$3,$4,$5)`,
            ['CANCELAR_NC', 'credit_notes', id, req.user?.id_usuario || req.user?.id || null, JSON.stringify({ motivo })]
        );
        res.json({ success: true, message: 'Nota de crédito cancelada' });
    } catch (error) {
        console.error('cancelarNotaCredito error', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
};

exports.aprobarNotaCredito = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE credit_notes SET estado=$1, approved_by=$2, fecha_aprobacion=CURRENT_TIMESTAMP WHERE id=$3', ['Aprobada', req.user?.id_usuario || req.user?.id || null, id]);
        // audit
        await db.query(`INSERT INTO audit_financial_events (evento, tabla, registro_id, usuario_id) VALUES ($1,$2,$3,$4)`,
            ['APROBAR_NC', 'credit_notes', id, req.user?.id_usuario || req.user?.id || null]
        );
        res.json({ success: true, message: 'Nota de crédito aprobada' });
    } catch (error) {
        console.error('aprobarNotaCredito error', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
};
