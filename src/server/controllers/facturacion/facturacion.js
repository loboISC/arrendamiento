const path = require('path');
const fs = require('fs');
const axios = require('axios');
const db = require('../../config/database');
const {
    normalizarXmlString,
    extraerDatosSatDesdeXml,
    extraerXmlDesdeRespuestaFacturama,
    resolverTotalesDesdeTimbrado,
    guardarXmlEnDisco
} = require('../../../utils/facturacion/xmlUtils');
const { desencriptar } = require('../../../utils/facturacion/encryption');
const PDFService = require('../../services/pdfService');
const {
    obtenerTokenFacturama,
    resolverLugarExpedicionValido,
    resolverSerieValidaParaLugarExpedicion,
    construirCfdiJson,
    FACTURAMA_BASE_URL,
    cancelarFacturaFacturama,
    timbrarXmlSellado,
    obtenerXmlTimbradoPorId
} = require('../../services/facturacion/facturamaservice');
const emailService = require('../../services/emailService');
const xmlService = require('../../services/facturacion/xmlService');
const { crearNotificacion } = require('../../services/facturacionNotifService');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_PDF_STORAGE_DIR = path.join(PROJECT_ROOT, 'public', 'pdfs');
const LEGACY_PDF_STORAGE_DIR = path.join(PROJECT_ROOT, 'pdfs');

const pdfService = new PDFService();

// Estados fiscales canonicos para evitar guardar variantes en la base de datos.
const ESTADOS_FACTURA = {
    BORRADOR: 'BORRADOR',
    TIMBRANDO: 'TIMBRANDO',
    TIMBRADA: 'TIMBRADA',
    ERROR: 'ERROR',
    CANCELADA: 'CANCELADA',
    APLICADA: 'APLICADA',
    PARCIAL: 'PARCIAL'
};

function resolverEstadoFacturaTimbrada({ esComplementoPago, esMetodoPpd }) {
    if (esComplementoPago) return ESTADOS_FACTURA.APLICADA;
    if (esMetodoPpd) return ESTADOS_FACTURA.TIMBRADA;
    return ESTADOS_FACTURA.APLICADA;
}

function esUuidBorrador(uuid) {
    return String(uuid || '').toUpperCase().startsWith('BORRADOR');
}

function calcularTotalesDesdeConceptos(conceptos = [], aplicaIva = true) {
    const lista = Array.isArray(conceptos) ? conceptos : [];
    let subtotal = 0;
    let descuento = 0;
    let iva = 0;
    lista.forEach((c) => {
        const cantidad = Number(c.cantidad || 1);
        const valorUnitario = Number(c.valorUnitario || 0);
        const desc = Number(c.descuento || 0);
        const importe = Number((cantidad * valorUnitario - desc).toFixed(2));
        subtotal += importe;
        descuento += desc;
        if (aplicaIva && (c.objetoImp === '02' || c.impuestos)) {
            iva += Number((importe * 0.16).toFixed(2));
        }
    });
    subtotal = Number(subtotal.toFixed(2));
    descuento = Number(descuento.toFixed(2));
    iva = Number(iva.toFixed(2));
    const total = Number((subtotal + iva).toFixed(2));
    return { subtotal, descuento, iva, total };
}

function normalizarEstadoCanonico({ estadoDb, metodoPago, esComplemento, compMonto, total }) {
    const estado = String(estadoDb || '').toUpperCase().trim();
    const metodo = String(metodoPago || 'PUE').toUpperCase();
    const pagado = Number(compMonto || 0);
    const totalFactura = Number(total || 0);

    if (!estado || estado.startsWith('BORRADOR')) return ESTADOS_FACTURA.BORRADOR;
    if (estado.startsWith('CANCELAD')) return ESTADOS_FACTURA.CANCELADA;
    if (estado.startsWith('TIMBRANDO')) return ESTADOS_FACTURA.TIMBRANDO;
    if (estado.startsWith('ERROR')) return ESTADOS_FACTURA.ERROR;
    if (estado.startsWith('APLICAD')) return ESTADOS_FACTURA.APLICADA;
    if (estado.startsWith('PARCIAL')) return ESTADOS_FACTURA.PARCIAL;

    if (esComplemento) return ESTADOS_FACTURA.APLICADA;

    // Legacy: "Pendiente PPD" guardado en PUE por bug antiguo de timbrado
    if (estado.includes('PENDIENTE') && metodo === 'PUE') {
        return ESTADOS_FACTURA.APLICADA;
    }
    if (estado.includes('PENDIENTE') && metodo === 'PPD') {
        if (pagado <= 0.009) return ESTADOS_FACTURA.TIMBRADA;
        if (pagado >= totalFactura - 0.01) return ESTADOS_FACTURA.APLICADA;
        return ESTADOS_FACTURA.PARCIAL;
    }

    if (estado.startsWith('TIMBRAD') || estado === 'EMITIDA' || estado === 'EMITIDO' || estado === 'FACTURADA') {
        if (metodo === 'PUE') return ESTADOS_FACTURA.APLICADA;
        if (pagado <= 0.009) return ESTADOS_FACTURA.TIMBRADA;
        if (pagado >= totalFactura - 0.01) return ESTADOS_FACTURA.APLICADA;
        return ESTADOS_FACTURA.PARCIAL;
    }

    if (metodo === 'PUE') return ESTADOS_FACTURA.APLICADA;
    if (pagado <= 0.009) return ESTADOS_FACTURA.TIMBRADA;
    if (pagado >= totalFactura - 0.01) return ESTADOS_FACTURA.APLICADA;
    return ESTADOS_FACTURA.PARCIAL;
}

function etiquetaDistribucionEstado(estadoCanonico) {
    const mapa = {
        BORRADOR: 'Borrador',
        TIMBRANDO: 'Timbrando',
        TIMBRADA: 'Timbrada',
        ERROR: 'Error',
        CANCELADA: 'Cancelada',
        APLICADA: 'Aplicada',
        PARCIAL: 'Parcial'
    };
    return mapa[estadoCanonico] || estadoCanonico;
}

// helper para front/facturacion que también usa formateo de montos
function formatearMoneda(amount) {
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount || 0));
}

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

            const fileName = path.basename(storedPath);
            const candidateDirs = [
                process.env.PDF_STORAGE_DIR,
                DEFAULT_PDF_STORAGE_DIR,
                LEGACY_PDF_STORAGE_DIR
            ].filter(Boolean);

            for (const storageDir of candidateDirs) {
                const localPath = path.join(storageDir, fileName);
                if (fs.existsSync(localPath)) return localPath;
            }

            return null;
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

// TIMBRAR FACTURA
exports.timbrarFactura = async (req, res) => {
    try {
        console.log('[DEBUG ROOT] req.body keys:', Object.keys(req.body));
        console.log('[DEBUG ROOT] req.body.factura keys:', req.body.factura ? Object.keys(req.body.factura) : 'null');

        const { receptor, factura, conceptos, complementoPago, CfdiRelacionados } = req.body;
        const idFacturaBorrador = Number(req.body.id_factura_borrador || factura?.id_factura_borrador || 0) || null;
        const relacionadosInput = CfdiRelacionados || factura?.CfdiRelacionados || null;
        const cotizacionId = factura?.cotizacion_id || null;
        const cotizacionNumero = factura?.cotizacion_numero || null;

        const conceptosInput = Array.isArray(conceptos) ? conceptos : [];
        const observaciones = factura?.observaciones || '';
        const notasInternas = String(factura?.notas_internas || '');
        const tipoComprobanteReq = String(factura?.tipo || 'I').toUpperCase();
        const esComplementoPago = tipoComprobanteReq === 'P';

        console.log('[DEBUG] Observaciones extraídas:', observaciones);
        if (esComplementoPago) {
            console.log('[DEBUG] CFDI tipo P (complemento de pago): conceptos no aplican. complementoPago.amount=', complementoPago?.amount, 'relatedUuid=', complementoPago?.relatedDocument?.uuid || '(vacío)');
        } else {
            console.log('[DEBUG] Conceptos recibidos (primero):', conceptos?.[0]);
        }

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

        if (!esComplementoPago) {
            console.log(`[DEBUG] Totales Finales: Subtotal=${subtotal}, Descuento=${totalDescuento}, IVA=${totalImpuestosTrasladados}, Total=${total}`);
        }

        // Validación de negocio: no otorgar un nuevo PPD si el cliente ya tiene
        // un crédito activo (saldo/deuda pendiente en ledger).
        const esMetodoPpd = String(factura.metodoPago || '').toUpperCase() === 'PPD';
        if (!esComplementoPago && esMetodoPpd && receptor.id_cliente) {
            try {
                const saldoRes = await db.query(
                    `
                    SELECT
                      COALESCE(SUM(CASE WHEN tipo_mov IN ('CARGO','COBRO_CREDITO','COBRO') THEN cargo ELSE 0 END),0) -
                      COALESCE(SUM(CASE WHEN tipo_mov IN ('ABONO','PAGO','NC') THEN abono ELSE 0 END),0) AS saldo
                    FROM customer_ledger
                    WHERE id_cliente = $1
                    `,
                    [receptor.id_cliente]
                );
                const deudaActiva = Number(saldoRes.rows[0]?.saldo || 0);
                console.log('[VALIDACION_CREDITO_ACTIVO] Cliente %s | deuda=%s | metodo=%s', receptor.id_cliente, deudaActiva.toFixed(2), factura.metodoPago);

                if (deudaActiva > 0.009) {
                    return res.status(400).json({
                        success: false,
                        error: `No se puede generar otra factura a crédito (PPD): el cliente ya tiene un crédito activo por ${deudaActiva.toFixed(2)}. Factura este CFDI como PUE o liquida el crédito vigente primero.`,
                        code: 'CLIENTE_CON_CREDITO_ACTIVO',
                        details: {
                            id_cliente: receptor.id_cliente,
                            deuda_activa: Number(deudaActiva.toFixed(2))
                        }
                    });
                }
            } catch (credError) {
                console.warn('[VALIDACION_CREDITO_ACTIVO] error consultando deuda activa:', credError.message);
                // en caso de fallo de BD no bloqueamos el timbrado; solo logueamos
            }
        }

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
            cfdiRelacionados: relacionadosInput ? {
                tipoRelacion: relacionadosInput.tipoRelacion,
                foliosFiscales: relacionadosInput.foliosFiscales || (relacionadosInput.uuid ? [relacionadosInput.uuid] : [])
            } : null,
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
                descuento: c.Descuento || 0,
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
            formaPago: factura.formaPago,
            metodoPago: factura.metodoPago,
            lugarExpedicion: emisorConfig.codigo_postal
        };

        if (!esComplementoPago && emisorConfig.csd_cer_path && emisorConfig.csd_key_path && emisorConfig.csd_password_encrypted) {
            try {
                console.log('[XML] Iniciando construcción y sellado local...');
                const passDescrypted = desencriptar(emisorConfig.csd_password_encrypted);

                // 1. Construir estructura
                let xmlNode = xmlService.construirCfdi40(xmlData);

                // 2. Sellar (Firma RSA-SHA256)
                xmlNode = await xmlService.sellarXml(
                    xmlNode,
                    emisorConfig.csd_cer_path,
                    emisorConfig.csd_key_path,
                    passDescrypted
                );

                // 3. Convertir a String
                xmlSelladoString = xmlService.nodoAString(xmlNode);
                console.log('[XML] XML Sellado Localmente generado con éxito.');

            } catch (xmlError) {
                console.error('[XML] Error en construcción/sellado local:', xmlError.message);
                // Continuamos con el flujo de Facturama si falla el sellado local por alguna razón
            }
        }

        const { timbrarXmlSellado } = require('../../services/facturacion/facturamaservice');

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
            console.log('[Facturama] Cayendo a flujo de JSON (No se generó XML sellado local' + (esComplementoPago ? '; CFDI tipo P usa complemento Facturama' : '') + ')');
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

                const expeditionPlacePreferido = String(factura.expeditionPlace || emisorConfig.codigo_postal || '').trim();
                const expeditionPlaceValido = await resolverLugarExpedicionValido(expeditionPlacePreferido);
                if (!expeditionPlaceValido) {
                    throw new Error('No se pudo resolver un ExpeditionPlace valido en Facturama. Revise Lugares de expedicion en Perfil Fiscal.');
                }
                if (expeditionPlaceValido !== expeditionPlacePreferido) {
                    console.warn('[Facturama] ExpeditionPlace ajustado automaticamente de ' + expeditionPlacePreferido + ' a ' + expeditionPlaceValido);
                }

                const seriePreferidaRaw = String(factura.serie || '').trim();
                const seriePreferida = (seriePreferidaRaw.toUpperCase() === 'P' ? 'A' : (seriePreferidaRaw || 'A'));
                const serieValida = await resolverSerieValidaParaLugarExpedicion(expeditionPlaceValido, seriePreferida);
                if (serieValida && serieValida !== seriePreferida) {
                    console.warn('[Facturama] Serie ajustada automaticamente de ' + seriePreferida + ' a ' + serieValida + ' para sucursal ' + expeditionPlaceValido);
                }

                cfdiJson = {
                    NameId: '14',
                    CfdiType: 'P',
                    ExpeditionPlace: expeditionPlaceValido,
                    Folio: (factura.folio || '1'),
                    ...(serieValida ? { Serie: serieValida } : {}),
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
                cfdiJson = construirCfdiJson({
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
                    cfdiType: tipoComprobanteReq,
                    relatedCfdi: relacionadosInput ? (relacionadosInput.foliosFiscales || [relacionadosInput.uuid]).filter(Boolean).map(uuid => ({
                        Uuid: uuid,
                        RelationshipType: relacionadosInput.tipoRelacion
                    })) : undefined
                });
            }

            const token = await obtenerTokenFacturama();
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

        console.log('[DEBUG] Facturama response keys: ' + (facturamaData ? JSON.stringify(Object.keys(facturamaData)) : 'null'));

        if (timbradoExitoso && facturamaData && facturamaData.Id) {
            // Calcular peso total (asumiendo que los conceptos pueden traer peso unitario)
            const pesoTotal = conceptosInput.reduce((sum, c) => sum + ((parseFloat(c.peso) || 0) * (parseFloat(c.cantidad) || 0)), 0);

            let xmlTimbrado = extraerXmlDesdeRespuestaFacturama(facturamaData);
            if (!xmlTimbrado && facturamaData.Id) {
                try {
                    xmlTimbrado = await obtenerXmlTimbradoPorId(facturamaData.Id);
                    if (xmlTimbrado) {
                        facturamaData.Cfdi = xmlTimbrado;
                        facturamaData.Xml = xmlTimbrado;
                    }
                } catch (xmlFetchErr) {
                    console.warn('[TIMBRAR] No se pudo descargar XML timbrado:', xmlFetchErr.message);
                }
            }
            if (!xmlTimbrado && xmlSelladoString) {
                console.warn('[TIMBRAR] Sin XML timbrado en respuesta; usando XML sellado local como respaldo.');
                xmlTimbrado = xmlSelladoString;
            }

            const totalesResueltos = resolverTotalesDesdeTimbrado({
                respuestaFacturama: facturamaData,
                xmlTimbrado,
                totalesLocales: {
                    subtotal,
                    descuento: totalDescuento,
                    iva: totalImpuestosTrasladados,
                    total
                }
            });
            const finalSubtotal = totalesResueltos.subtotal;
            const finalDescuento = totalesResueltos.descuento;
            const finalIva = totalesResueltos.iva;
            const finalTotal = totalesResueltos.total;

            const calculoLocal = Number((subtotal - totalDescuento + totalImpuestosTrasladados).toFixed(2));
            if (Math.abs(finalTotal - calculoLocal) > 0.05) {
                console.warn(
                    `[DEBUG] Totales timbrado (${totalesResueltos.fuente}): ${finalTotal} vs cálculo UI: ${calculoLocal}. PDF/BD usan timbrado.`
                );
            }

            const xmlTimbradoRaw = facturamaData.Cfdi || facturamaData.Xml || xmlTimbrado;
            // también parsear con helper para obtener sitio de datos SAT
            const satData = extraerDatosSatDesdeXml(xmlTimbradoRaw);

            //const uuidDesdeXml = // removed, now satData.uuid is used
            (xmlTimbrado.match(/\sUUID="([^"]+)"/i) || [])[1]
                || (xmlTimbrado.match(/\sUuid="([^"]+)"/i) || [])[1]
                || '';
            const uuidSat = satData.uuid
                || facturamaData.Complement?.TaxStamp?.Uuid
                || facturamaData.Id
                || '';
            const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
            if (!uuidRegex.test(String(uuidSat))) {
                throw new Error(`No se recibi� UUID fiscal v�lido del SAT para el timbrado (${uuidSat || 'sin valor'})`);
            }
            const prefijoFolio = tipoComprobanteReq === 'P' ? 'P' : (tipoComprobanteReq === 'E' ? 'NC' : 'B');
            const folioSat = `${prefijoFolio}-${uuidSat.substring(0, 8).toUpperCase()}`;
            console.log('[TIMBRAR] respuesta Facturama keys:', Object.keys(facturamaData || {}));
            if (facturamaData.Complement) {
                console.log('[TIMBRAR] Complement.keys:', Object.keys(facturamaData.Complement));
                if (facturamaData.Complement.TaxStamp) {
                    console.log('[TIMBRAR] TaxStamp.keys:', Object.keys(facturamaData.Complement.TaxStamp));
                }
            }

            // Extracción mejorada del Sello Digital
            // Buscar CfdiSign (API-Lite de Facturama) o Sign (otras API)
            let selloCfdiEmitido = satData.selloDigital ||
                (xmlTimbrado.match(/Sello\s*=\s*"([^"]{50,})/i) || [])[1] ||
                facturamaData.Complement?.TaxStamp?.CfdiSign ||
                facturamaData.Complement?.TaxStamp?.Sign ||
                facturamaData.Sello ||
                '';
            console.log(`[TIMBRAR] selloCfdiEmitido: ${selloCfdiEmitido ? 'OK (' + selloCfdiEmitido.length + ' chars)' : 'FALTA'}`);
            let noCertificadoEmisorEmitido = satData.noCertificadoEmisor ||
                facturamaData.CertNumber ||
                (xmlTimbrado.match(/NoCertificado\s*=\s*"([^"]+)"/i) || [])[1] ||
                facturamaData.NoCertificado ||
                '';
            console.log(`[TIMBRAR] noCertificadoEmisor: ${noCertificadoEmisorEmitido || 'FALTA'}`);
            let selloSatEmitido = satData.selloSAT ||
                (xmlTimbrado.match(/SelloSAT\s*=\s*"([^"]{50,})/i) || [])[1] ||
                facturamaData.Complement?.TaxStamp?.SatSign ||
                '';
            console.log(`[TIMBRAR] selloSatEmitido: ${selloSatEmitido ? 'OK (' + selloSatEmitido.length + ' chars)' : 'FALTA'}`);
            let noCertificadoSatEmitido = satData.noCertificadoSAT ||
                (xmlTimbrado.match(/NoCertificadoSAT\s*=\s*"([^"]+)"/i) || [])[1] ||
                facturamaData.Complement?.TaxStamp?.SatCertNumber ||
                facturamaData.NoCertificadoSAT ||
                '';
            console.log(`[TIMBRAR] noCertificadoSAT: ${noCertificadoSatEmitido || 'FALTA'}`);
            const fechaTimbradoSat =
                (xmlTimbrado.match(/FechaTimbrado="([^"]+)"/i) || [])[1]
                || facturamaData.Complement?.TaxStamp?.Date
                || facturamaData.FechaTimbrado
                || new Date().toISOString();
            const cadenaOriginalSat =
                facturamaData.OriginalString
                || (xmlTimbrado.match(/OriginalString="([^\"]+)"/i) || [])[1]
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
                factura: {
                    ...factura,
                    hayDescuentos: finalDescuento > 0
                },
                comprobante: {
                    tipo: factura.tipo || 'I',
                    serie: factura.serie || 'A',
                    moneda: factura.moneda || 'MXN',
                    tipoCambio: factura.tipoCambio || 1
                },
                conceptos: conceptosInput.map((concepto) => {
                    const cantidad = Number(concepto.cantidad || 0);
                    const valorUnitario = Number(concepto.valorUnitario || 0);
                    const descuento = Number(concepto.descuento || 0);
                    const importeBruto = Number((cantidad * valorUnitario).toFixed(2));
                    return {
                        cantidad,
                        claveProductoServicio: concepto.claveProductoServicio,
                        claveUnidad: concepto.claveUnidad,
                        unidad: concepto.unidad || 'H87',
                        descripcion: concepto.descripcion,
                        caracteristicas: concepto.caracteristicas || '',
                        valorUnitario,
                        precio: valorUnitario,
                        descuento,
                        importe: Number((importeBruto - descuento).toFixed(2))
                    };
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
                relacionados: relacionadosInput ? {
                    tipoRelacion: relacionadosInput.tipoRelacion,
                    uuid: relacionadosInput.foliosFiscales || relacionadosInput.uuid
                } : null,
                observaciones: notasInternas || observaciones || ''
            };

            // Generar PDF con el folio del SAT como nombre
            const nombreArchivo = `${folioSat}.pdf`;
            let rutaPDF;
            if (esComplementoPago) {
                const relatedDocument = complementoPago?.relatedDocument || {};
                const montoPago = Number(complementoPago?.amount || relatedDocument.amountPaid || finalTotal || 0);
                const formaPagoSat = String(factura.formaPago || '99');
                const formaPagoMap = {
                    '01': 'Efectivo',
                    '02': 'Cheque nominativo',
                    '03': 'Transferencia electronica de fondos',
                    '04': 'Tarjeta de credito',
                    '28': 'Tarjeta de debito',
                    '99': 'Por definir'
                };
                const serieFolioRelacionado = [String(relatedDocument.serie || '').trim(), String(relatedDocument.folio || '').trim()]
                    .filter(Boolean)
                    .join('-') || String(relatedDocument.folio || '').trim() || '-';

                const abonoPdfData = {
                    clienteNombre: receptor.nombreParaPdf || receptor.nombre || '',
                    clienteRfc: receptor.rfc || 'XAXX010101000',
                    clienteCodigoPostal: receptor.codigoPostal || '',
                    clienteDireccion: receptor.direccion || '',
                    clienteColonia: receptor.colonia || '',
                    clienteLocalidad: receptor.localidad || '',
                    clienteMunicipio: receptor.municipio || '',
                    clienteEstado: receptor.estado || '',
                    clientePais: receptor.pais || 'MEXICO',
                    clienteRegimenFiscal: receptor.regimenFiscal || '601',
                    usoCfdi: receptor.usoCfdi || 'CP01',
                    facturaFolio: serieFolioRelacionado,
                    facturaUuid: String(relatedDocument.uuid || ''),
                    uuid: uuidSat,
                    folio: folioSat,
                    selloDigital: selloCfdiEmitido || '',
                    selloSAT: selloSatEmitido || '',
                    noCertificadoEmisor: noCertificadoEmisorEmitido || '',
                    certificadoSAT: noCertificadoSatEmitido || '',
                    cadenaOriginal: cadenaOriginalSat || '',
                    fechaIso: fechaTimbradoSat,
                    saldoAnterior: Number(relatedDocument.previousBalanceAmount || 0),
                    abono: montoPago,
                    saldoRestante: Number(relatedDocument.impSaldoInsoluto || 0),
                    formaPagoSat,
                    formaPago: formaPagoMap[formaPagoSat] || 'Transferencia electronica de fondos',
                    moneda: String(complementoPago?.currency || factura.moneda || 'MXN').toUpperCase(),
                    numeroParcialidad: Number(relatedDocument.partialityNumber || 1),
                    tipoCambio: Number(complementoPago?.exchangeRate || 1)
                };

                // usar el helper que ya respeta PDF_STORAGE_DIR y la plantilla de abonos
                rutaPDF = await pdfService.guardarPDFAbonoCredito(abonoPdfData, nombreArchivo);
            } else {
                rutaPDF = await pdfService.guardarPDF(pdfData, nombreArchivo);
            }

            // Guardar XML en archivo (Respetando carpeta compartida)
            const nombreArchivoXml = `FACTURA-${uuidSat}.xml`;
            const storageDir = process.env.PDF_STORAGE_DIR || DEFAULT_PDF_STORAGE_DIR;
            const rutaXML = path.join(storageDir, nombreArchivoXml);

            const xmlParaGuardar = extraerXmlDesdeRespuestaFacturama(facturamaData) || xmlTimbrado;
            if (!xmlParaGuardar || !xmlParaGuardar.trim().startsWith('<')) {
                throw new Error('No se obtuvo XML timbrado válido para guardar en disco.');
            }
            guardarXmlEnDisco(xmlParaGuardar, rutaXML);

            // Guardar en base de datos
            const userId = req.user?.id_usuario || req.user?.id || null;

            // utilizar la variable previamente calculada para no redeclarar
            // (se definió antes de construir el XML y puede reusarse aquí)
            const estadoFactura = resolverEstadoFacturaTimbrada({ esComplementoPago, esMetodoPpd });
            const formaPagoFinal = esComplementoPago ? (factura.formaPago || '99') : (esMetodoPpd ? '99' : factura.formaPago);
            const usoCfdiSat = String(receptor.usoCfdi || '').toUpperCase();
            const usoCfdiDb = (esComplementoPago && usoCfdiSat === 'CP01') ? 'P01' : usoCfdiSat;

            // UUID relacionado: primer folio fiscal de cfdiRelacionados, o uuid simple
            const uuidRelacionadoFinal = relacionadosInput
                ? (Array.isArray(relacionadosInput.foliosFiscales) && relacionadosInput.foliosFiscales[0])
                    || relacionadosInput.uuid
                    || null
                : null;
            const tipoRelacionFinal = relacionadosInput?.tipoRelacion || null;

            const valoresFactura = [
                uuidSat,
                new Date(),
                new Date(fechaTimbradoSat),
                esComplementoPago ? Number(complementoPago?.amount || finalTotal || 0) : finalTotal,
                finalSubtotal,
                finalDescuento,
                finalIva,
                formaPagoFinal,
                factura.metodoPago,
                usoCfdiDb,
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
                folioSat,
                uuidRelacionadoFinal,
                tipoRelacionFinal,
                notasInternas
            ];

            let insertFacturaRes;
            if (idFacturaBorrador) {
                const borradorCheck = await db.query(
                    `SELECT id_factura FROM facturas WHERE id_factura = $1 AND UPPER(COALESCE(estado,'')) = 'BORRADOR'`,
                    [idFacturaBorrador]
                );
                if (borradorCheck.rows.length > 0) {
                    insertFacturaRes = await db.query(
                        `UPDATE facturas SET
                            uuid = $1, fecha_emision = $2, fecha_timbrado = $3, total = $4, subtotal = $5,
                            total_descuento = $6, total_iva = $7, forma_pago = $8, metodo_pago = $9, uso_cfdi = $10,
                            estado = $11, xml_path = $12, pdf_path = $13, sello_cfdi = $14, sello_sat = $15,
                            no_certificado = $16, no_certificado_sat = $17, id_emisor = $18, id_cliente = $19,
                            id_usuario = $20, folio = $21, nota = NULL,
                            uuid_relacionado = $23, tipo_relacion = $24, notas_internas = $25
                         WHERE id_factura = $22
                         RETURNING id_factura, folio, uuid, total, id_cliente, metodo_pago`,
                        [...valoresFactura, idFacturaBorrador]
                    );
                }
            }
            if (!insertFacturaRes) {
                insertFacturaRes = await db.query(
                    `INSERT INTO facturas (
                        uuid, fecha_emision, fecha_timbrado, total, subtotal, total_descuento, total_iva,
                        forma_pago, metodo_pago, uso_cfdi, estado, xml_path, pdf_path,
                        sello_cfdi, sello_sat, no_certificado, no_certificado_sat, id_emisor, id_cliente,
                        id_usuario, folio, uuid_relacionado, tipo_relacion, notas_internas
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
                     RETURNING id_factura, folio, uuid, total, id_cliente, metodo_pago`,
                    valoresFactura
                );
            }

            const facturaInsertada = insertFacturaRes.rows[0];

            // --- VINCULACIÓN Y ACTUALIZACIÓN DE COTIZACIÓN (NUEVO) ---
            if (cotizacionId && !esComplementoPago) {
                try {
                    console.log(`[VINCULO] Intentando actualizar cotización ${cotizacionId} (${cotizacionNumero}) a 'Facturada'`);
                    await db.query(
                        `UPDATE cotizaciones 
                         SET estado = 'Facturada' 
                         WHERE id_cotizacion = $1 AND estado IN ('Enviada', 'Aprobada', 'Borrador')`,
                        [cotizacionId]
                    );
                    console.log(`[VINCULO] Cotización ${cotizacionNumero} actualizada correctamente.`);
                } catch (cotErr) {
                    console.error('[VINCULO] Error al actualizar estado de cotización:', cotErr.message);
                    // No bloqueamos el flujo principal si esto falla
                }
            }

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

            // Si es Complemento de Pago, registrar el ABONO en ledger vinculado a la factura PPD origen.
            if (esComplementoPago) {
                try {
                    const relDoc = complementoPago?.relatedDocument || {};
                    const uuidPpdOrigen = String(relDoc.uuid || '').trim();
                    const montoPagado = Number(complementoPago?.amount || relDoc.amountPaid || finalTotal || 0);

                    // Obtener id_factura de la factura PPD relacionada (si existe en nuestra BD)
                    let facturaPpdId = null;
                    if (uuidPpdOrigen) {
                        const resPpd = await db.query(
                            'SELECT id_factura FROM facturas WHERE uuid = $1 LIMIT 1',
                            [uuidPpdOrigen]
                        );
                        if (resPpd.rows.length > 0) {
                            facturaPpdId = resPpd.rows[0].id_factura;
                        }
                    }

                    // Calcular saldo global actualizado del cliente
                    const saldoGlobalComp = await db.query(`
                        SELECT
                          COALESCE(SUM(CASE WHEN tipo_mov IN ('CARGO','COBRO_CREDITO','COBRO') THEN cargo ELSE 0 END),0) AS cargo,
                          COALESCE(SUM(CASE WHEN tipo_mov IN ('ABONO','PAGO','NC') THEN abono ELSE 0 END),0) AS abono
                        FROM customer_ledger
                        WHERE id_cliente = $1
                    `, [receptor.id_cliente || 1]);
                    const saldoAntesAbono = Number(saldoGlobalComp.rows[0]?.cargo || 0) - Number(saldoGlobalComp.rows[0]?.abono || 0);
                    const saldoDespuesAbono = Number((saldoAntesAbono - montoPagado).toFixed(2));

                    const descripcionAbono = `ABONO Complemento ${folioSat} | UUID:${uuidSat} | PDF:${nombreArchivo}`;

                    await db.query(`
                        INSERT INTO customer_ledger
                        (id_cliente, fecha, tipo_mov, descripcion, referencia_tipo, referencia_id, cargo, abono, saldo_resultante, usuario_id, metadata_json)
                        VALUES ($1, CURRENT_TIMESTAMP, 'ABONO', $2, 'complemento_pago', $3, 0, $4, $5, $6, $7)
                    `, [
                        receptor.id_cliente || 1,
                        descripcionAbono,
                        facturaPpdId || facturaInsertada.id_factura,
                        montoPagado,
                        saldoDespuesAbono,
                        userId,
                        JSON.stringify({
                            uuid_complemento: uuidSat,
                            folio_complemento: folioSat,
                            uuid_factura_ppd: uuidPpdOrigen,
                            id_factura_ppd: facturaPpdId,
                            monto: montoPagado,
                            pdf_path: nombreArchivo
                        })
                    ]);
                    console.log(`[LEDGER] Abono complemento pago registrado: ${montoPagado} para cliente ${receptor.id_cliente}`);
                } catch (ledgerErr) {
                    console.error('[LEDGER] Error registrando abono complemento en ledger:', ledgerErr.message);
                    // No bloqueamos la respuesta si solo falla el ledger
                }
            }

            // Registrar notificación de éxito
            crearNotificacion({
                tipo: esComplementoPago ? 'COMPLEMENTO_TIMBRADO' : 'FACTURA_TIMBRADA',
                mensaje: `${esComplementoPago ? 'Complemento de pago' : 'Factura'} timbrada exitosamente con folio/UUID: ${uuidSat.substring(0, 8)}. Cliente: ${receptor.nombre}. Total: $${finalTotal}`,
                modulo: 'facturacion',
                referencia_tipo: esComplementoPago ? 'complemento_pago' : 'factura',
                referencia_id: uuidSat,
                id_usuario_accion: req.user?.id_usuario || req.user?.id || null,
                metadata: {
                    folio: uuidSat.substring(0, 8),
                    uuid: uuidSat,
                    total: finalTotal,
                    cliente: receptor.nombre,
                    rfc: receptor.rfc,
                    tipo: tipoComprobanteReq
                }
            }).catch(err => console.error('[DEBUG] Error al crear notificación:', err));

            res.json({
                success: true,
                message: 'Factura timbrada exitosamente',
                data: {
                    uuid: uuidSat, // Retornar el mismo que guardamos en DB
                    total: finalTotal,
                    estado: estadoFactura,
                    pdfPath: rutaPDF,
                    xml: facturamaData.Cfdi || facturamaData.Xml
                }
            });

        } else {
            // Si la respuesta de Facturama no contiene un Id, es un error
            throw new Error('Respuesta inválida de Facturama: No se recibió un ID de CFDI.');
        }

    } catch (error) {
        console.error('Error timbrando factura:', error);

        const receptor = req.body?.receptor;
        const idFacturaBorrador = Number(req.body?.id_factura_borrador || req.body?.factura?.id_factura_borrador || 0) || null;

        let errorMessage = error.message;
        let errorDetails = {};

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
            errorMessage = `Error de Facturama: ${facturamaErrorMessage}${detalle}`;
            errorDetails = error.response.data || {};
            
            // Registrar notificación de error
            crearNotificacion({
                tipo: 'ERROR_TIMBRADO',
                mensaje: `Error al timbrar factura/complemento para cliente ${receptor?.nombre || 'Desconocido'}: ${errorMessage.substring(0, 200)}`,
                modulo: 'facturacion',
                referencia_tipo: 'factura',
                referencia_id: idFacturaBorrador,
                id_usuario_accion: req.user?.id_usuario || req.user?.id || null,
                metadata: {
                    error: errorMessage,
                    detalles: errorDetails,
                    cliente: receptor?.nombre,
                    rfc: receptor?.rfc
                }
            }).catch(err => console.error('[DEBUG] Error al crear notificación de error:', err));

            return res.status(400).json({
                success: false,
                error: `Error de Facturama: ${facturamaErrorMessage}${detalle}`
            });
        }

        // Registrar notificación de error
        crearNotificacion({
            tipo: 'ERROR_TIMBRADO',
            mensaje: `Error al timbrar factura/complemento para cliente ${receptor?.nombre || 'Desconocido'}: ${errorMessage.substring(0, 200)}`,
            modulo: 'facturacion',
            referencia_tipo: 'factura',
            referencia_id: idFacturaBorrador,
            id_usuario_accion: req.user?.id_usuario || req.user?.id || null,
            metadata: {
                error: errorMessage,
                cliente: receptor?.nombre,
                rfc: receptor?.rfc
            }
        }).catch(err => console.error('[DEBUG] Error al crear notificación de error:', err));

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
        const { motivoCancelacion, motivo, uuidSustitucion } = req.body;
        const finalMotivo = motivoCancelacion || motivo;

        if (!uuid || !finalMotivo) {
            return res.status(400).json({
                success: false,
                error: 'UUID y motivo de cancelación son requeridos'
            });
        }

        if (esUuidBorrador(uuid)) {
            return res.status(400).json({
                success: false,
                error: 'Los borradores no se cancelan en el SAT. Elimínalos o continúa el timbrado.'
            });
        }

        // Cancelar en Facturama usando el servicio robustecido
        await cancelarFacturaFacturama(uuid, finalMotivo);

        // Actualizar estado en base de datos.
        // Motivo '01' = sustituida por otra: guardamos uuid_relacionado con la factura sustituta.
        const uuidSust = (finalMotivo === '01' && uuidSustitucion) ? String(uuidSustitucion).trim() : null;
        await db.query(
            `UPDATE facturas
             SET estado = $1, motivo_cancelacion = $2
               ${uuidSust ? ', uuid_relacionado = $4, tipo_relacion = $5' : ''}
             WHERE uuid = $3`,
            uuidSust
                ? [ESTADOS_FACTURA.CANCELADA, finalMotivo, uuid, uuidSust, '01']
                : [ESTADOS_FACTURA.CANCELADA, finalMotivo, uuid]
        );

        // Registrar notificación de éxito
        crearNotificacion({
            tipo: 'FACTURA_CANCELADA',
            mensaje: `Factura cancelada exitosamente con folio/UUID: ${uuid.substring(0, 8)}. Motivo: ${finalMotivo}`,
            modulo: 'facturacion',
            referencia_tipo: 'factura',
            referencia_id: uuid,
            id_usuario_accion: req.user?.id_usuario || req.user?.id || null,
            metadata: {
                uuid,
                motivo: finalMotivo,
                uuid_sustitucion: uuidSust
            }
        }).catch(err => console.error('[DEBUG] Error al crear notificación:', err));

        res.json({
            success: true,
            message: 'Factura cancelada exitosamente',
            data: {
                uuid,
                status: ESTADOS_FACTURA.CANCELADA
            }
        });

    } catch (error) {
        console.error('Error cancelando factura:', error);
        
        let errorMessage = error.message;
        if (error.response) {
            errorMessage = error.response.data.Message || error.response.data;
            
            // Registrar notificación de error
            crearNotificacion({
                tipo: 'ERROR_TIMBRADO',
                mensaje: `Error al cancelar factura con UUID ${uuid.substring(0, 8)}: ${String(errorMessage).substring(0, 200)}`,
                modulo: 'facturacion',
                referencia_tipo: 'factura',
                referencia_id: uuid,
                id_usuario_accion: req.user?.id_usuario || req.user?.id || null,
                metadata: {
                    uuid,
                    error: errorMessage
                }
            }).catch(err => console.error('[DEBUG] Error al crear notificación de error:', err));

            return res.status(400).json({
                success: false,
                error: `Error de Facturama: ${errorMessage}`
            });
        }

        // Registrar notificación de error
        crearNotificacion({
            tipo: 'ERROR_TIMBRADO',
            mensaje: `Error al cancelar factura con UUID ${uuid.substring(0, 8)}: ${String(errorMessage).substring(0, 200)}`,
            modulo: 'facturacion',
            referencia_tipo: 'factura',
            referencia_id: uuid,
            id_usuario_accion: req.user?.id_usuario || req.user?.id || null,
            metadata: {
                uuid,
                error: errorMessage
            }
        }).catch(err => console.error('[DEBUG] Error al crear notificación de error:', err));

        res.status(500).json({
            success: false,
            error: `Error interno: ${error.message}`
        });
    }
};

// VISTA PREVIA DE FACTURA (SIN TIMBRAR)
exports.vistaPreviaFactura = async (req, res) => {
    try {
        console.log('[DEBUG] Generando vista previa...');
        const { receptor, factura, conceptos, CfdiRelacionados } = req.body;
        const relacionadosInput = CfdiRelacionados || factura?.CfdiRelacionados || null;
        const conceptosInput = Array.isArray(conceptos) ? conceptos : [];
        const observaciones = factura?.observaciones || '';
        const notasInternas = String(factura?.notas_internas || '');
        
        // Obtener configuración del emisor
        const emisorQuery = await db.query(
            'SELECT rfc, razon_social, regimen_fiscal, codigo_postal FROM emisores ORDER BY id_emisor DESC LIMIT 1'
        );
        const emisorConfig = emisorQuery.rows[0] || {};

        // Calcular totales para la vista previa
        let subtotal = 0;
        let totalDescuento = 0;
        let totalIva = 0;

        const conceptosProcesados = conceptosInput.map(c => {
            const cant = Number(c.cantidad || 0);
            const pu = Number(c.valorUnitario || 0);
            const desc = Number(c.descuento || 0);
            const imp = Number((cant * pu).toFixed(2));
            
            subtotal += imp;
            totalDescuento += desc;
            
            // IVA 16% por defecto si aplica en la vista previa
            const aplicaIva = req.body.aplicaIva !== false;
            const iva = aplicaIva ? Number(((imp - desc) * 0.16).toFixed(2)) : 0;
            totalIva += iva;

            return {
                claveProductoServicio: c.claveProductoServicio,
                noIdentificacion: c.noIdentificacion,
                cantidad: cant,
                claveUnidad: c.claveUnidad,
                unidad: c.unidad || 'Unidad',
                descripcion: c.descripcion,
                valorUnitario: pu,
                importe: imp,
                descuento: desc
            };
        });

        const total = Number((subtotal - totalDescuento + totalIva).toFixed(2));

        const dataParaPdf = {
            isPreview: true,
            emisor: {
                rfc: emisorConfig.rfc || 'APT100310EC2',
                nombre: emisorConfig.razon_social || 'ANDAMIOS Y PROYECTOS TORRES'
            },
            receptor: {
                rfc: receptor.rfc,
                nombre: receptor.nombre,
                regimenFiscal: receptor.regimenFiscal,
                codigoPostal: receptor.codigoPostal,
                usoCfdi: receptor.usoCfdi,
                direccion: receptor.direccion || 'DOMICILIO CONOCIDO',
                colonia: receptor.colonia || '',
                municipio: receptor.municipio || '',
                estado: receptor.estado || ''
            },
            cfdiInfo: {
                uuid: 'VISTA-PREVIA-PENDIENTE',
                folio: 'PREVIEW',
                fechaEmision: new Date().toISOString(),
                fechaTimbrado: 'PROCESO DE VISTA PREVIA',
                certificadoSAT: '00000000000000000000',
                noCertificadoEmisor: '00000000000000000000',
                selloDigital: 'VISTA_PREVIA_SIN_VALIDEZ',
                selloSAT: 'VISTA_PREVIA_SIN_VALIDEZ',
                cadenaOriginal: 'VISTA_PREVIA_SIN_VALIDEZ'
            },
            totales: {
                subtotal: subtotal,
                descuento: totalDescuento,
                iva: totalIva,
                total: total,
                metodoPago: factura.metodoPago || 'PUE',
                formaPago: factura.formaPago || '03'
            },
            conceptos: conceptosProcesados,
            relacionados: relacionadosInput ? {
                tipoRelacion: relacionadosInput.tipoRelacion,
                uuid: relacionadosInput.foliosFiscales || relacionadosInput.uuid
            } : null,
            observaciones: notasInternas || observaciones || '',
            factura: {
                hayDescuentos: totalDescuento > 0
            }
        };

        const pdfBuffer = await pdfService.generarPDFFactura(dataParaPdf);
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename=vista-previa.pdf',
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error en vista previa:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// OBTENER FACTURA POR UUID
exports.obtenerFacturaPorUuid = async (req, res) => {
    try {
        const { uuid } = req.params;

        const result = await db.query(
            `SELECT f.*, c.dias_credito,
                    CASE WHEN c.rfc = 'XAXX010101000' THEN 'PUBLICO EN GENERAL' ELSE c.nombre END as cliente_nombre,
                    c.rfc as cliente_rfc
             FROM facturas f 
             LEFT JOIN clientes c ON f.id_cliente = c.id_cliente 
             WHERE f.uuid = $1`,
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

// GUARDAR / ACTUALIZAR BORRADOR DE FACTURA
exports.guardarBorradorFactura = async (req, res) => {
    try {
        const { receptor, factura, conceptos, CfdiRelacionados, aplicaIva } = req.body;
        const idBorrador = Number(req.body.id_factura || factura?.id_factura_borrador || 0) || null;
        const userId = req.user?.id_usuario || req.user?.id || null;

        if (!receptor?.id_cliente && !receptor?.rfc) {
            return res.status(400).json({ success: false, error: 'Selecciona un cliente para guardar el borrador.' });
        }
        if (!Array.isArray(conceptos) || conceptos.length === 0) {
            return res.status(400).json({ success: false, error: 'Agrega al menos un concepto al borrador.' });
        }

        const totales = calcularTotalesDesdeConceptos(conceptos, aplicaIva !== false);
        const payloadBorrador = {
            version: 1,
            receptor,
            factura,
            conceptos,
            CfdiRelacionados: CfdiRelacionados || factura?.CfdiRelacionados || null,
            aplicaIva: aplicaIva !== false
        };

        let idCliente = receptor.id_cliente || null;
        if (!idCliente && receptor.rfc) {
            const clRes = await db.query(
                'SELECT id_cliente FROM clientes WHERE UPPER(rfc) = UPPER($1) LIMIT 1',
                [receptor.rfc]
            );
            idCliente = clRes.rows[0]?.id_cliente || 1;
        }

        const metodoPago = String(factura?.metodoPago || 'PUE').toUpperCase();
        const formaPago = metodoPago === 'PPD' ? '99' : String(factura?.formaPago || '03');
        const usoCfdi = String(receptor.usoCfdi || 'G03').toUpperCase();

        if (idBorrador) {
            const upd = await db.query(
                `UPDATE facturas SET
                    id_cliente = $1, subtotal = $2, total_descuento = $3, total_iva = $4, total = $5,
                    forma_pago = $6, metodo_pago = $7, uso_cfdi = $8, estado = $9, nota = $10,
                    id_usuario = COALESCE($11, id_usuario), fecha_emision = CURRENT_TIMESTAMP
                 WHERE id_factura = $12 AND UPPER(COALESCE(estado,'')) = 'BORRADOR'
                 RETURNING id_factura, folio, uuid`,
                [
                    idCliente,
                    totales.subtotal,
                    totales.descuento,
                    totales.iva,
                    totales.total,
                    formaPago,
                    metodoPago,
                    usoCfdi,
                    ESTADOS_FACTURA.BORRADOR,
                    JSON.stringify(payloadBorrador),
                    userId,
                    idBorrador
                ]
            );
            if (!upd.rows.length) {
                return res.status(404).json({ success: false, error: 'Borrador no encontrado o ya fue timbrado.' });
            }
            return res.json({ success: true, data: upd.rows[0] });
        }

        const uuidBorrador = `BORRADOR-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const ins = await db.query(
            `INSERT INTO facturas (
                uuid, fecha_emision, subtotal, total_descuento, total_iva, total,
                forma_pago, metodo_pago, uso_cfdi, estado, nota, id_emisor, id_cliente, id_usuario, folio
            ) VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11, $12, $13)
             RETURNING id_factura, folio, uuid`,
            [
                uuidBorrador,
                totales.subtotal,
                totales.descuento,
                totales.iva,
                totales.total,
                formaPago,
                metodoPago,
                usoCfdi,
                ESTADOS_FACTURA.BORRADOR,
                JSON.stringify(payloadBorrador),
                idCliente,
                userId,
                `B-${Date.now().toString().slice(-6)}`
            ]
        );
        return res.json({ success: true, data: ins.rows[0] });
    } catch (error) {
        console.error('Error guardando borrador de factura:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

exports.listarBorradoresFactura = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT f.id_factura, f.folio, f.uuid, f.total, f.metodo_pago, f.fecha_emision,
                    f.id_cliente, f.id_usuario,
                    CASE WHEN c.rfc = 'XAXX010101000' THEN 'PUBLICO EN GENERAL' ELSE c.nombre END AS cliente_nombre,
                    u.nombre AS responsable_nombre
             FROM facturas f
             LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
             LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
             WHERE UPPER(COALESCE(f.estado,'')) = 'BORRADOR'
             ORDER BY f.fecha_emision DESC
             LIMIT 50`
        );
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error listando borradores:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

exports.obtenerBorradorFactura = async (req, res) => {
    try {
        const idFactura = Number(req.params.id_factura);
        if (!Number.isFinite(idFactura)) {
            return res.status(400).json({ success: false, error: 'ID de borrador inválido.' });
        }
        const result = await db.query(
            `SELECT f.*, CASE WHEN c.rfc = 'XAXX010101000' THEN 'PUBLICO EN GENERAL' ELSE c.nombre END AS cliente_nombre
             FROM facturas f
             LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
             WHERE f.id_factura = $1 AND UPPER(COALESCE(f.estado,'')) = 'BORRADOR'`,
            [idFactura]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Borrador no encontrado.' });
        }
        const row = result.rows[0];
        let payload = null;
        try {
            payload = row.nota ? JSON.parse(row.nota) : null;
        } catch (e) {
            payload = null;
        }
        return res.json({
            success: true,
            data: {
                id_factura: row.id_factura,
                folio: row.folio,
                uuid: row.uuid,
                cliente_nombre: row.cliente_nombre,
                total: row.total,
                metodo_pago: row.metodo_pago,
                payload
            }
        });
    } catch (error) {
        console.error('Error obteniendo borrador:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// OBTENER TODAS LAS FACTURAS
exports.obtenerFacturas = async (req, res) => {
    try {
        const { search, estado, fecha_inicio, fecha_fin, id_cliente } = req.query;

        let query = `
            SELECT 
                f.id_factura,
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
                f.notas_internas,
                CASE WHEN c.rfc = 'XAXX010101000' THEN 'PUBLICO EN GENERAL' ELSE c.nombre END as cliente_nombre,
                c.rfc as cliente_rfc,
                c.tipo as cliente_tipo,
                c.dias_credito,
                e.razon_social as emisor_nombre,
                e.rfc as emisor_rfc,
                u.nombre AS responsable_nombre
            FROM facturas f
            LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
            LEFT JOIN emisores e ON f.id_emisor = e.id_emisor
            LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
            WHERE 1=1
        `;

        const queryParams = [];

        if (search) {
            queryParams.push(`%${search}%`);
            query += ` AND (f.folio ILIKE $${queryParams.length} OR (CASE WHEN c.rfc = 'XAXX010101000' THEN 'PUBLICO EN GENERAL' ELSE c.nombre END) ILIKE $${queryParams.length} OR f.uuid::text ILIKE $${queryParams.length})`;
        }

        if (estado && estado !== 'Estado: Todos') {
            queryParams.push(estado);
            query += ` AND UPPER(TRIM(f.estado)) = UPPER(TRIM($${queryParams.length}))`;
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

        // Si recuperamos facturas, consultamos customer_ledger para obtener
        // los montos reales asociados a cualquier "complemento de pago".
        // Primero buscamos el monto desde el campo `total` de la propia factura para complementos.
        // Adicionalmente consultamos ledger por si hay abonos explícitos registrados.
        const facturaIds = result.rows.map(r => r.id_factura).filter(id => Number.isFinite(id));

        // Mapa: id_factura_complemento -> monto pagado
        // Para complementos (folio P-*), el total viene directo de la tabla facturas.
        // Para facturas PPD, buscamos los abonos en customer_ledger donde referencia_id apunta
        // al id_factura PPD origen (tipo 'complemento_pago') OR al propio id (tipo 'factura%').
        let complementoMap = new Map();
        if (facturaIds.length) {
            // Abonos de complementos de pago: referencia_tipo = 'complemento_pago'
            // (el referencia_id apunta a la factura PPD ORIGEN, no al complemento mismo)
            // Para mostrar el monto del complemento en su propia fila usamos total de la tabla facturas directamente.
            // También capturamos pagos manuales con otros referencia_tipo.
            const compRes = await db.query(
                `SELECT referencia_id, SUM(abono) AS total_comp
                 FROM customer_ledger
                 WHERE referencia_id = ANY($1::int[])
                   AND tipo_mov IN ('ABONO','PAGO','NC')
                   AND (referencia_tipo ILIKE 'factura%'
                        OR referencia_tipo ILIKE '%complemento%'
                        OR referencia_tipo = 'complemento_pago')
                 GROUP BY referencia_id`,
                [facturaIds]
            );
            compRes.rows.forEach(r => {
                complementoMap.set(Number(r.referencia_id), parseFloat(r.total_comp || 0));
            });
        }

        // Construir WHERE para estadísticas basado en los mismos filtros que la tabla
        let statsWhere = " WHERE 1=1";
        const statsParams = [];

        if (search) {
            statsParams.push(`%${search}%`);
            statsWhere += ` AND (f.folio ILIKE $${statsParams.length} OR (CASE WHEN c.rfc = 'XAXX010101000' THEN 'PUBLICO EN GENERAL' ELSE c.nombre END) ILIKE $${statsParams.length} OR f.uuid::text ILIKE $${statsParams.length})`;
        }
        if (estado && estado !== 'Estado: Todos') {
            statsParams.push(estado);
            statsWhere += ` AND UPPER(TRIM(f.estado)) = UPPER(TRIM($${statsParams.length}))`;
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
            SELECT f.estado, f.metodo_pago, COUNT(*) as cantidad
            FROM facturas f
            LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
            ${statsWhere}
            GROUP BY f.estado, f.metodo_pago
        `, statsParams);

        // Filtros para notas de credito relacionados (evitar romper por search/estado de factura)
        let ncWhere = ' WHERE 1=1';
        const ncParams = [];
        if (fecha_inicio) {
            ncParams.push(fecha_inicio);
            ncWhere += ` AND cn.created_at >= $${ncParams.length}`;
        }
        if (fecha_fin) {
            ncParams.push(fecha_fin);
            ncWhere += ` AND cn.created_at <= $${ncParams.length}`;
        }
        if (id_cliente && id_cliente !== 'Cliente: Todos') {
            ncParams.push(id_cliente);
            ncWhere += ` AND cn.customer_id = $${ncParams.length}`;
        }
        if (search) {
            ncParams.push(`%${search}%`);
            ncWhere += ` AND (COALESCE(cn.folio,'') ILIKE $${ncParams.length} OR COALESCE(cn.uuid,'') ILIKE $${ncParams.length})`;
        }
        const ncWhereSerie = ncWhere.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + statsParams.length}`);

        // KPI: Cobranza neta = facturado timbrado - NC - cancelaciones
        const ncTotalResult = await db.query(`
            SELECT COALESCE(SUM(cn.total), 0) AS total_nc
            FROM credit_notes cn
            ${ncWhere}
              AND COALESCE(cn.status, '') NOT ILIKE 'Cancelad%'
        `, ncParams);

        // KPI: DSO real con pagos capturados en ledger
        const dsoResult = await db.query(`
            WITH pagos AS (
              SELECT
                referencia_id AS id_factura,
                MIN(fecha::date) AS fecha_primer_pago,
                SUM(COALESCE(abono, 0)) AS total_pagado
              FROM customer_ledger
              WHERE tipo_mov IN ('ABONO', 'PAGO')
                AND (
                  referencia_tipo ILIKE 'factura%'
                  OR referencia_tipo ILIKE '%complemento%'
                  OR referencia_tipo = 'complemento_pago'
                )
              GROUP BY referencia_id
            ),
            base AS (
              SELECT
                f.id_factura,
                f.fecha_emision::date AS fecha_emision,
                COALESCE(f.total, 0) AS total_factura,
                p.fecha_primer_pago,
                COALESCE(p.total_pagado, 0) AS total_pagado
              FROM facturas f
              LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
              LEFT JOIN pagos p ON p.id_factura = f.id_factura
              ${statsWhere}
                AND f.estado ILIKE 'Timbrad%'
            )
            SELECT
              COALESCE(AVG((fecha_primer_pago - fecha_emision)) FILTER (
                WHERE fecha_primer_pago IS NOT NULL AND total_pagado > 0
              ), 0) AS dso_dias_real,
              COUNT(*) FILTER (WHERE fecha_primer_pago IS NOT NULL AND total_pagado > 0) AS facturas_con_pago_capturado
            FROM base
        `, statsParams);

        // Semaforo de cartera vencida por antiguedad (monto pendiente por bucket)
        const agingResult = await db.query(`
            WITH pagos AS (
              SELECT
                referencia_id AS id_factura,
                SUM(COALESCE(abono, 0)) AS total_pagado
              FROM customer_ledger
              WHERE tipo_mov IN ('ABONO', 'PAGO')
                AND (
                  referencia_tipo ILIKE 'factura%'
                  OR referencia_tipo ILIKE '%complemento%'
                  OR referencia_tipo = 'complemento_pago'
                )
              GROUP BY referencia_id
            ),
            nc AS (
              SELECT
                id_factura_origen AS id_factura,
                SUM(COALESCE(total, 0)) AS total_nc
              FROM credit_notes
              WHERE COALESCE(status, '') NOT ILIKE 'Cancelad%'
              GROUP BY id_factura_origen
            ),
            base AS (
              SELECT
                f.id_factura,
                f.fecha_emision::date AS fecha_emision,
                (f.fecha_emision::date + (COALESCE(c.dias_credito, 30) || ' days')::interval)::date AS fecha_vencimiento,
                GREATEST(
                  COALESCE(f.total, 0) - COALESCE(p.total_pagado, 0) - COALESCE(n.total_nc, 0),
                  0
                ) AS saldo_pendiente,
                (CURRENT_DATE - ((f.fecha_emision::date + (COALESCE(c.dias_credito, 30) || ' days')::interval)::date))::int AS dias_vencido
              FROM facturas f
              LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
              LEFT JOIN pagos p ON p.id_factura = f.id_factura
              LEFT JOIN nc n ON n.id_factura = f.id_factura
              ${statsWhere}
                AND (
                  f.estado ILIKE 'Pendiente%'
                  OR f.estado ILIKE 'Vencid%'
                  OR f.estado ILIKE 'Timbrad%'
                )
            )
            SELECT
              CASE
                WHEN dias_vencido BETWEEN 1 AND 30 THEN '1-30'
                WHEN dias_vencido BETWEEN 31 AND 60 THEN '31-60'
                WHEN dias_vencido BETWEEN 61 AND 90 THEN '61-90'
                WHEN dias_vencido > 90 THEN '90+'
                ELSE 'vigente'
              END AS bucket,
              COUNT(*)::int AS cantidad,
              COALESCE(SUM(saldo_pendiente), 0) AS monto
            FROM base
            WHERE saldo_pendiente > 0
            GROUP BY bucket
        `, statsParams);

        // Serie mensual de cobranza neta (6 meses)
        const cobranzaSerieResult = await db.query(`
            WITH fact AS (
              SELECT
                date_trunc('month', f.fecha_emision) AS periodo,
                SUM(CASE WHEN f.estado ILIKE 'Timbrad%' THEN COALESCE(f.total, 0) ELSE 0 END) AS timbrado,
                SUM(CASE WHEN f.estado ILIKE 'Cancelad%' THEN COALESCE(f.total, 0) ELSE 0 END) AS cancelado
              FROM facturas f
              LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
              ${statsWhere}
              GROUP BY 1
            ),
            nc AS (
              SELECT
                date_trunc('month', cn.created_at) AS periodo,
                SUM(COALESCE(cn.total, 0)) AS nc
              FROM credit_notes cn
              ${ncWhereSerie}
                AND COALESCE(cn.status, '') NOT ILIKE 'Cancelad%'
              GROUP BY 1
            ),
            unioned AS (
              SELECT
                COALESCE(f.periodo, n.periodo) AS periodo,
                COALESCE(f.timbrado, 0) AS timbrado,
                COALESCE(f.cancelado, 0) AS cancelado,
                COALESCE(n.nc, 0) AS nc
              FROM fact f
              FULL OUTER JOIN nc n ON n.periodo = f.periodo
            )
            SELECT
              to_char(periodo, 'Mon YYYY') AS periodo_label,
              to_char(periodo, 'YYYY-MM') AS periodo_sort,
              timbrado,
              nc,
              cancelado,
              (timbrado - nc - cancelado) AS cobranza_neta
            FROM unioned
            ORDER BY periodo_sort DESC
            LIMIT 6
        `, [...statsParams, ...ncParams]);
        const stats = statsResult.rows[0] || {};
        const totalTimbrado = parseFloat(stats.total_ingresos_hist || 0);
        const totalCancelado = parseFloat(stats.total_cancelado_hist || 0);
        const totalNc = parseFloat(ncTotalResult.rows[0]?.total_nc || 0);
        const cobranzaNeta = totalTimbrado - totalNc - totalCancelado;

        const dsoDiasReal = parseFloat(dsoResult.rows[0]?.dso_dias_real || 0);
        const facturasConPagoCapturado = parseInt(dsoResult.rows[0]?.facturas_con_pago_capturado || 0, 10);

        const agingBuckets = {
            '1-30': { cantidad: 0, monto: 0 },
            '31-60': { cantidad: 0, monto: 0 },
            '61-90': { cantidad: 0, monto: 0 },
            '90+': { cantidad: 0, monto: 0 }
        };
        (agingResult.rows || []).forEach(r => {
            if (agingBuckets[r.bucket]) {
                agingBuckets[r.bucket] = {
                    cantidad: parseInt(r.cantidad || 0, 10),
                    monto: parseFloat(r.monto || 0)
                };
            }
        });

        const riesgoTotal = agingBuckets['1-30'].monto + agingBuckets['31-60'].monto + agingBuckets['61-90'].monto + agingBuckets['90+'].monto;

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
            distribucion: (() => {
                const acumulado = {};
                (distributionResult.rows || []).forEach((row) => {
                    const canonico = normalizarEstadoCanonico({
                        estadoDb: row.estado,
                        metodoPago: row.metodo_pago,
                        esComplemento: false,
                        compMonto: 0,
                        total: 0
                    });
                    const etiqueta = etiquetaDistribucionEstado(canonico);
                    acumulado[etiqueta] = (acumulado[etiqueta] || 0) + parseInt(row.cantidad || 0, 10);
                });
                return Object.entries(acumulado).map(([estado, cantidad]) => ({ estado, cantidad }));
            })(),
            kpisFinancieros: {
                dsoDiasReal,
                facturasConPagoCapturado,
                cobranzaNeta,
                totalTimbrado,
                totalNc,
                totalCancelado,
                semaforoCartera: {
                    bucket_1_30: agingBuckets['1-30'],
                    bucket_31_60: agingBuckets['31-60'],
                    bucket_61_90: agingBuckets['61-90'],
                    bucket_90_plus: agingBuckets['90+'],
                    riesgoTotal
                }
            },
            cobranzaNetaPeriodo: (cobranzaSerieResult.rows || []).reverse()
        };

        // Formatear las facturas para el frontend
        const facturas = result.rows.map(factura => {
            const fechaEmision = new Date(factura.fecha_emision);
            const fechaVencimiento = new Date(factura.fecha_emision);
            const diasCredito = parseInt(factura.dias_credito || 30);
            fechaVencimiento.setDate(fechaVencimiento.getDate() + diasCredito);
            const estadoDb = String(factura.estado || '').toUpperCase();
            const usoCfdiHist = String(factura.uso_cfdi || '').toUpperCase();
            const esComplemento = usoCfdiHist === 'CP01' || usoCfdiHist === 'P01'
                || String(factura.folio || '').toUpperCase().startsWith('P-');

            // Para complementos de pago, el monto correcto está directamente en factura.total
            // (se guarda en BD al timbrar con el monto real del pago).
            // Para facturas PPD normales, compMonto almacena los abonos manuales registrados en ledger.
            const compMonto = esComplemento
                ? Number(factura.total || 0)  // el total del complemento YA es el monto pagado
                : (complementoMap.get(factura.id_factura) || 0);

            const estadoPago = normalizarEstadoCanonico({
                estadoDb: factura.estado,
                metodoPago: factura.metodo_pago,
                esComplemento,
                compMonto,
                total: factura.total
            });

            let montoPagado = factura.total;
            let fechaPago = factura.fecha_emision;
            if (estadoPago === ESTADOS_FACTURA.CANCELADA || estadoPago === ESTADOS_FACTURA.BORRADOR
                || estadoPago === ESTADOS_FACTURA.TIMBRANDO || estadoPago === ESTADOS_FACTURA.ERROR) {
                montoPagado = 0;
                fechaPago = null;
            } else if (estadoPago === ESTADOS_FACTURA.TIMBRADA) {
                montoPagado = 0;
                fechaPago = null;
            } else if (estadoPago === ESTADOS_FACTURA.PARCIAL) {
                montoPagado = compMonto;
            } else if (estadoPago === ESTADOS_FACTURA.APLICADA && esComplemento) {
                montoPagado = compMonto;
            }

            return {
                id_factura: factura.id_factura,
                uuid: factura.uuid,
                folio: factura.folio || (factura.uuid ? `B-${factura.uuid.substring(0, 4)}` : 'S/F'),
                contrato: `CONT-${factura.uuid.substring(0, 8)}`,
                id_usuario: factura.id_usuario,
                responsable_nombre: factura.responsable_nombre || 'N/A',
                uso_cfdi: factura.uso_cfdi || '',
                es_complemento_pago: esComplemento,
                notasInternas: factura.notas_internas || '',
                cliente: {
                    nombre: factura.cliente_nombre || 'Cliente General',
                    rfc: factura.cliente_rfc || 'N/A',
                    tipo: factura.cliente_tipo || 'Empresa',
                    metodo: factura.forma_pago === '03' ? 'Transferencia' :
                        factura.forma_pago === '01' ? 'Efectivo' : 'Otros'
                },
                estado: estadoPago,
                estado_db: factura.estado, // <- EXPOSICIÓN DEL ESTADO REAL DE BD PARA CÁLCULOS KPI
                fechas: {
                    emision: fechaEmision.toISOString().split('T')[0],
                    vencimiento: fechaVencimiento.toISOString().split('T')[0]
                },
                metodo_pago: factura.metodo_pago || 'PUE',
                // para complementos usamos el monto acumulado desde ledger; de lo contrario
                // mostramos el total de la factura normal
                monto: esComplemento ? compMonto : factura.total,
                complemento_monto: compMonto,
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
            const storageDir = process.env.PDF_STORAGE_DIR || DEFAULT_PDF_STORAGE_DIR;
            let localPath = path.join(storageDir, fileName);
            console.log('[PDF DEBUG] Primary storageDir:', storageDir);
            console.log('[PDF DEBUG] Attempting local path:', localPath);

            if (fs.existsSync(localPath)) {
                finalPath = localPath;
                console.log('[PDF DEBUG] Success! Found at primary:', finalPath);
            } else {
                // intentar fallback alternativo igual que en pdf controller
                const altDir = LEGACY_PDF_STORAGE_DIR;
                const altPath = path.join(altDir, fileName);
                console.log('[PDF DEBUG] Primary not found, trying altDir:', altDir);
                console.log('[PDF DEBUG] Attempting alt path:', altPath);
                if (fs.existsSync(altPath)) {
                    finalPath = altPath;
                    console.log('[PDF DEBUG] Success! Found at fallback:', finalPath);
                } else {
                    console.log('[PDF DEBUG] Error: File not found anywhere.');
                    return res.status(404).json({
                        success: false,
                        error: 'PDF no encontrado en el servidor'
                    });
                }
            }
        } else {
            console.log('[PDF DEBUG] Success! Original path exists.');
        }

        const isInline = String(req.query.inline) === 'true';

        // evitar caches problemáticos en el navegador
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

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
exports.buscarDocumentoPorFolio = async (req, res) => {
    try {
        const { query } = req.params;
        console.log(`[searchDocumentByFolio] Buscando: ${query}`);
        // debug: mostrar filas de facturas coincidentes

        // 0. Intentar buscar factura existente por folio o UUID
        const searchQuery = `%${query}%`;
        try {
            const factRes = await db.query(
                `SELECT f.*, CASE WHEN c.rfc = 'XAXX010101000' THEN 'PUBLICO EN GENERAL' ELSE c.nombre END as cliente_nombre, c.rfc as cliente_rfc
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
exports.buscarConceptos = async (req, res) => {
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
                        peso: dbPeso > 0 ? dbPeso : jsonPeso,
                        clave: internalKey || p.clave || ''
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
                peso: p.peso || 0,
                clave: p.clave || ''
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

exports.obtenerSaldoElegibleCredito = async (req, res) => {
    try {
        const { facturaId } = req.params;
        const fact = await db.query('SELECT total FROM facturas WHERE id_factura = $1', [facturaId]);
        if (fact.rows.length === 0) return res.status(404).json({ success: false, error: 'Factura origen no encontrada' });
        const total = parseFloat(fact.rows[0].total || 0);
        const pagos = await db.query("SELECT COALESCE(SUM(monto),0) as suma FROM pagos WHERE id_factura = $1 AND estado = 'APLICADO'", [facturaId]);
        const nc = await db.query("SELECT COALESCE(SUM(total),0) as suma FROM credit_notes WHERE id_factura_origen = $1 AND UPPER(COALESCE(estado,'')) != $2", [facturaId, 'CANCELADA']);
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
        const ncprev = await db.query("SELECT COALESCE(SUM(total),0) as suma FROM credit_notes WHERE id_factura_origen=$1 AND UPPER(COALESCE(estado,'')) != $2", [creditNote.facturaOrigenId, 'CANCELADA']);
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
        const cfdiJson = construirCfdiJson({
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

        const token = await obtenerTokenFacturama();
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
        const nombreArchivoPdf = `NOTA_CREDITO-${uuidSat}.pdf`;
        const storageDir = process.env.PDF_STORAGE_DIR || DEFAULT_PDF_STORAGE_DIR;
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
        
        const rutaXmlCompleta = path.join(storageDir, nombreArchivoXml);
        fs.writeFileSync(rutaXmlCompleta, facturamaData.Cfdi || '');
        
        // 6. Generar PDF desde el CFDI timbrado usando puppeteer
        let rutaPdfCompleta = null;
        try {
            // Preparar datos para renderizado HTML del PDF
            const pdfData = {
                cfdiInfo: {
                    uuid: uuidSat,
                    folio: uuidSat.substring(0, 10),
                    fechaEmision: facturamaData.Fecha || new Date().toISOString(),
                    fechaTimbrado: new Date().toISOString(),
                    certificadoSAT: facturamaData.Complement?.TaxStamp?.CertificadoSAT || 'PENDIENTE',
                    noCertificadoEmisor: facturamaData.NoCertificado || 'PENDIENTE',
                    selloDigital: facturamaData.Complement?.TaxStamp?.Sello || ''
                },
                isCreditNote: true,
                isPreview: false,
                emisor: {
                    rfc: emisorConfig.rfc,
                    razon_social: emisorConfig.razon_social,
                    regimen_fiscal: emisorConfig.regimen_fiscal,
                    codigo_postal: emisorConfig.codigo_postal
                },
                receptor: {
                    nombre: receptor.razonSocial || receptor.nombre,
                    nombreParaPdf: receptor.razonSocial || receptor.nombre,
                    rfc: receptor.rfc,
                    regimenFiscal: receptor.regimenFiscal,
                    codigoPostal: receptor.codigoPostal,
                    colonia: receptor.colonia,
                    localidad: receptor.localidad,
                    municipio: receptor.municipio,
                    estado: receptor.estado,
                    pais: receptor.pais,
                    direccion: receptor.direccion,
                    usoCfdi: receptor.usoCfdi
                },
                comprobante: {
                    tipoComprobante: 'E',
                    tipoComprobanteTexto: 'Nota de Crédito',
                    moneda: 'MXN',
                    tipoCambio: '1.0000'
                },
                conceptos: conceptosFacturama,
                totales: {
                    subtotal: finalSubtotal,
                    descuento: finalDescuento,
                    iva: finalIva,
                    total: finalTotal,
                    metodoPago: factura.metodoPago,
                    formaPago: factura.formaPago
                },
                relacionados: {
                    uuid: uuidOrig,
                    tipoRelacion: creditNote.tipoRelacion
                },
                factura: {
                    hayDescuentos: finalDescuento > 0
                }
            };
            
            // Generar PDF
            const pdfBuffer = await pdfService.generarPDFFactura(pdfData);
            rutaPdfCompleta = path.join(storageDir, nombreArchivoPdf);
            fs.writeFileSync(rutaPdfCompleta, pdfBuffer);
            console.log('[timbrarNotaCredito] PDF generado exitosamente:', rutaPdfCompleta);
        } catch (pdfError) {
            console.warn('[timbrarNotaCredito] Advertencia al generar PDF (continuando sin PDF):', pdfError.message);
            // No fallar si el PDF falla, continuar con XML
        }

        // 7. guardar en base de datos nota de crédito
        // invoice_id: UUID de la factura origen para trazabilidad directa
        // Columnas reales del esquema: tax, reason, relation_type, status (no impuestos/motivo_sat/tipo_relacion/estado)
        const insertRes = await db.query(
            `INSERT INTO credit_notes
                (uuid, folio, customer_id, id_factura_origen, invoice_id,
                 subtotal, tax, total, reason, relation_type, status,
                 created_by, stamped_by, pdf_path, xml_path)
             VALUES ($1,$2,$3,$4,$5::uuid,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
             RETURNING *`,
            [
                uuidSat,
                uuidSat.substring(0, 10),
                receptor.id_cliente,
                creditNote.facturaOrigenId,
                uuidOrig || null,                       // invoice_id = UUID de la factura origen
                finalSubtotal,
                finalIva,
                finalTotal,
                creditNote.motivoSat || creditNote.razon || 'Nota de crédito',
                creditNote.tipoRelacion || '01',
                'TIMBRADA',
                req.user?.id_usuario || req.user?.id || null,
                req.user?.id_usuario || req.user?.id || null,
                nombreArchivoPdf,
                nombreArchivoXml
            ]
        );
        const creditNoteRec = insertRes.rows[0];

        // También registrar en tabla de relaciones (credit_note_relations) para trazabilidad completa
        if (uuidOrig) {
            try {
                await db.query(
                    `INSERT INTO credit_note_relations (credit_note_id, invoice_uuid, relation_type)
                     VALUES ($1, $2, $3)`,
                    [creditNoteRec.id, uuidOrig, creditNote.tipoRelacion || '01']
                );
            } catch (relErr) {
                console.warn('[NC] No se pudo insertar en credit_note_relations:', relErr.message);
            }
        }

        // 8. actualizar ledger y audit
        await db.query(
            `INSERT INTO customer_ledger (id_cliente, fecha, tipo_mov, referencia_tipo, referencia_id, abono, saldo_resultante, usuario_id, metadata_json)
             VALUES ($1, CURRENT_TIMESTAMP, 'NC', 'credit_note', $2, $3, $4, $5, $6)`,
            [
                receptor.id_cliente, 
                creditNote.facturaOrigenId, 
                finalTotal, 
                elegible - finalTotal, 
                req.user?.id_usuario || req.user?.id || null,
                JSON.stringify({ credit_note_id: creditNoteRec.id })
            ]
        );
        await db.query(
            `INSERT INTO audit_financial_events (evento, tabla, registro_id, usuario_id, detalles)
             VALUES ($1, $2, $3, $4, $5)`,
            ['CREAR_NC', 'credit_notes', null, req.user?.id_usuario || req.user?.id || null, JSON.stringify({ facturaOrigen: creditNote.facturaOrigenId, total: finalTotal, credit_note_id: creditNoteRec.id })]
        );

        // Registrar notificación de éxito
        crearNotificacion({
            tipo: 'NC_TIMBRADA',
            mensaje: `Nota de crédito timbrada exitosamente con folio/UUID: ${uuidSat.substring(0, 8)}. Cliente: ${receptor.nombre}. Total: $${finalTotal}`,
            modulo: 'notas_credito',
            referencia_tipo: 'nota_credito',
            referencia_id: uuidSat,
            id_usuario_accion: req.user?.id_usuario || req.user?.id || null,
            metadata: {
                folio: uuidSat.substring(0, 8),
                uuid: uuidSat,
                total: finalTotal,
                cliente: receptor.nombre,
                rfc: receptor.rfc,
                motivo: creditNote.motivoSat || creditNote.razon
            }
        }).catch(err => console.error('[DEBUG] Error al crear notificación:', err));

        res.json({ 
            success: true, 
            message: 'Nota de crédito timbrada correctamente', 
            data: { 
                uuid: uuidSat, 
                total: finalTotal, 
                xml: facturamaData.Cfdi || facturamaData.Xml,
                pdfPath: nombreArchivoPdf,
                xmlPath: nombreArchivoXml,
                motivo: creditNote.motivoSat
            } 
        });
    } catch (error) {
        console.error('timbrarNotaCredito error', error);
        
        let errorMessage = error.message;
        if (error.response) {
            errorMessage = `Error de Facturama: ${error.response.data.Message || error.response.data}`;
        }
        
        // Registrar notificación de error
        crearNotificacion({
            tipo: 'ERROR_TIMBRADO',
            mensaje: `Error al timbrar nota de crédito para cliente ${receptor?.nombre || 'Desconocido'}: ${errorMessage.substring(0, 200)}`,
            modulo: 'notas_credito',
            referencia_tipo: 'nota_credito',
            referencia_id: creditNote?.facturaOrigenId,
            id_usuario_accion: req.user?.id_usuario || req.user?.id || null,
            metadata: {
                error: errorMessage,
                cliente: receptor?.nombre,
                rfc: receptor?.rfc
            }
        }).catch(err => console.error('[DEBUG] Error al crear notificación de error:', err));

        res.status(500).json({ success: false, error: 'Error interno al timbrar nota de crédito' });
    }
};

exports.obtenerNotasCredito = async (req, res) => {
    try {
        const { cliente, estado } = req.query;
        let q = 'SELECT * FROM credit_notes WHERE 1=1';
        const params = [];
        if (cliente) { params.push(cliente); q += ` AND customer_id = $${params.length}`; }
        if (estado) { params.push(estado.toUpperCase()); q += ` AND UPPER(status) = $${params.length}`; }
        q += ' ORDER BY created_at DESC';
        const result = await db.query(q, params);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('getCreditNotes error', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
};

exports.obtenerNotaCreditoPorId = async (req, res) => {
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
        const userId = req.user?.id_usuario || req.user?.id || null;
        await db.query(
            'UPDATE credit_notes SET status=$1, updated_by=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3',
            ['CANCELADA', userId, id]
        );
        // audit
        await db.query(`INSERT INTO audit_financial_events (evento, tabla, registro_id, usuario_id, detalles) VALUES ($1,$2,$3,$4,$5)`,
            ['CANCELAR_NC', 'credit_notes', null, userId, JSON.stringify({ motivo, credit_note_id: id })]
        );

        // Obtener el UUID o datos de la NC para la notificación
        let ncUuid = '';
        try {
            const ncQuery = await db.query('SELECT uuid FROM credit_notes WHERE id = $1', [id]);
            ncUuid = ncQuery.rows[0]?.uuid || '';
        } catch (_) {}

        // Registrar notificación de éxito
        crearNotificacion({
            tipo: 'NC_CANCELADA',
            mensaje: `Nota de crédito cancelada exitosamente con ID: ${id}. Motivo: ${motivo}`,
            modulo: 'notas_credito',
            referencia_tipo: 'nota_credito',
            referencia_id: ncUuid || id,
            id_usuario_accion: req.user?.id_usuario || req.user?.id || null,
            metadata: {
                id,
                uuid: ncUuid,
                motivo
            }
        }).catch(err => console.error('[DEBUG] Error al crear notificación:', err));

        res.json({ success: true, message: 'Nota de crédito cancelada' });
    } catch (error) {
        console.error('cancelarNotaCredito error', error);
        
        let errorMessage = error.message;
        if (error.response) {
            errorMessage = error.response.data.Message || error.response.data;
        }

        // Registrar notificación de error
        crearNotificacion({
            tipo: 'ERROR_TIMBRADO',
            mensaje: `Error al cancelar nota de crédito con ID ${id}: ${String(errorMessage).substring(0, 200)}`,
            modulo: 'notas_credito',
            referencia_tipo: 'nota_credito',
            referencia_id: id,
            id_usuario_accion: req.user?.id_usuario || req.user?.id || null,
            metadata: {
                id,
                error: errorMessage
            }
        }).catch(err => console.error('[DEBUG] Error al crear notificación de error:', err));

        res.status(500).json({ success: false, error: 'Error interno' });
    }
};

exports.aprobarNotaCredito = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id_usuario || req.user?.id || null;
        await db.query(
            'UPDATE credit_notes SET status=$1, updated_by=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3',
            ['APLICADA', userId, id]
        );
        // audit
        await db.query(`INSERT INTO audit_financial_events (evento, tabla, registro_id, usuario_id, detalles) VALUES ($1,$2,$3,$4,$5)`,
            ['APROBAR_NC', 'credit_notes', null, userId, JSON.stringify({ credit_note_id: id })]
        );
        res.json({ success: true, message: 'Nota de crédito aprobada' });
    } catch (error) {
        console.error('aprobarNotaCredito error', error);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
};
