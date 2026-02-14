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
        const fs = require('fs');
        if (factura.pdf_path && fs.existsSync(factura.pdf_path)) {
            attachments.push({ filename: `FACTURA-${uuid}.pdf`, path: factura.pdf_path });
        }
        if (factura.xml_path && fs.existsSync(factura.xml_path)) {
            attachments.push({ filename: `FACTURA-${uuid}.xml`, path: factura.xml_path });
        }

        // Enviar correo
        await emailService.sendMail({
            to: destinatario,
            subject: `Factura ${uuid}`,
            text: mensaje || 'Adjunto encontrará su factura.',
            attachments
        });

        res.json({ success: true, message: 'Factura enviada por correo electrónico' });
    } catch (error) {
        console.error('Error enviando factura por email:', error);
        res.status(500).json({ success: false, error: 'Error interno al enviar el correo' });
    }
};
const axios = require('axios');
const db = require('../db/index');
const PDFService = require('../services/pdfService');
const { getFacturamaToken, buildCfdiJson, FACTURAMA_BASE_URL } = require('../services/facturamaservice');
const emailService = require('../services/emailService');

const { decrypt } = require('../utils/encryption');
const xmlService = require('../services/xmlService');
const path = require('path');
const fs = require('fs');

const pdfService = new PDFService();

// TIMBRAR FACTURA
exports.timbrarFactura = async (req, res) => {
    try {
        const { receptor, factura, conceptos } = req.body;

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
        const buildCleanItem = (concepto, cantidad, valorUnitario, importe, objetoImp, itemImpuestos, claveProdServ) => {
            const item = {
                ClaveProductoServicio: claveProdServ,
                Cantidad: cantidad,
                ClaveUnidad: concepto.claveUnidad,
                Unidad: concepto.unidad || 'Unidad de servicio',
                Descripcion: concepto.descripcion,
                ValorUnitario: valorUnitario,
                Importe: importe,
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

        // Limpiar espacios en los campos string de cada concepto ANTES de construir el JSON
        conceptos.forEach(concepto => {
            if (typeof concepto.descripcion === 'string') concepto.descripcion = concepto.descripcion.trim();
            // Asegurarse de que claveProductoServicio no sea null o undefined antes de trim
            if (typeof concepto.claveProductoServicio === 'string') concepto.claveProductoServicio = concepto.claveProductoServicio.trim();
            if (typeof concepto.claveUnidad === 'string') concepto.claveUnidad = concepto.claveUnidad.trim();
            if (typeof concepto.unidad === 'string') concepto.unidad = concepto.unidad.trim();
        });

        // Mapear conceptos a los nombres de campo que espera Facturama
        const conceptosFacturama = conceptos.map(concepto => {
            const cantidad = Number(concepto.cantidad) || 0;
            const valorUnitario = Number(concepto.valorUnitario) || 0;
            const importe = cantidad * valorUnitario;

            // Validar que claveProductoServicio no sea null, undefined o vacío
            if (!concepto.claveProductoServicio || concepto.claveProductoServicio.trim() === '') {
                throw new Error(`Clave de producto/servicio es requerida para el concepto: ${concepto.descripcion || 'Sin descripción'}`);
            }

            // Asegurar que la clave de producto/servicio sea un string válido
            const claveProdServ = concepto.claveProductoServicio.trim();
            if (!/^\d{8}$/.test(claveProdServ)) {
                throw new Error(`Clave de producto/servicio debe ser un código de 8 dígitos. Valor recibido: ${claveProdServ}`);
            }

            // Determinar el ObjetoImp del concepto. Por defecto '02' si no se especifica.
            // '01': Sí objeto de impuesto y obligado a desglose (requiere la sección Impuestos en el ítem)
            // '02': Sí objeto de impuesto y no obligado a desglose (NO requiere la sección Impuestos en el ítem)
            // '04': No objeto de impuesto (NO requiere la sección Impuestos en el ítem)
            let objetoImp = concepto.objetoImp || '02';

            let itemImpuestos = undefined; // Por defecto, no incluir la sección Impuestos en el ítem

            // Solo incluir la sección Impuestos en el ítem si ObjetoImp es '01'
            // y si se han proporcionado datos de impuestos para el concepto.
            if (objetoImp === '01' && concepto.impuestos && concepto.impuestos.Traslados && concepto.impuestos.Traslados.length > 0) {
                itemImpuestos = {
                    Traslados: concepto.impuestos.Traslados.map(t => ({
                        // Asegurar que Base no sea null y use importe si es necesario
                        Base: Number(t.Base) || importe,
                        Impuesto: t.Impuesto || '002', // Default a IVA
                        TipoFactor: t.TipoFactor || 'Tasa',
                        // Asegurar que TasaOCuota no sea null
                        TasaOCuota: t.TasaOCuota != null ? Number(t.TasaOCuota) : 0.16,
                        // Calcular Importe del impuesto si no se proporciona, usando la TasaOCuota real
                        Importe: Number(t.Importe) || (importe * (t.TasaOCuota != null ? Number(t.TasaOCuota) : 0.16))
                    }))
                };
            } else if (objetoImp === '01' && (!concepto.impuestos || !concepto.impuestos.Traslados || concepto.impuestos.Traslados.length === 0)) {
                // Si ObjetoImp es '01' pero no hay impuestos definidos, esto es una inconsistencia.
                // Podrías lanzar un error o cambiar ObjetoImp a '02' o '04'
                // Por ahora, lo cambiamos a '02' para evitar el error de validación de Facturama.
                console.warn(`Advertencia: Concepto con ObjetoImp '01' pero sin impuestos definidos. Cambiando a '02'. Concepto: ${concepto.descripcion}`);
                objetoImp = '02';
            }

            const item = buildCleanItem(concepto, cantidad, valorUnitario, importe, objetoImp, itemImpuestos, claveProdServ);

            // Log para debugging
            console.log('Concepto mapeado:', JSON.stringify(item, null, 2));

            return item;
        });

        // Calcular totales globales antes de construir el JSON para Facturama
        const subtotal = conceptosFacturama.reduce((sum, c) => sum + c.Importe, 0);
        const totalImpuestosTrasladados = conceptosFacturama.reduce((sum, c) => {
            // Sumar solo los impuestos que están a nivel de ítem (si ObjetoImp es '01')
            if (c.Impuestos && c.Impuestos.Traslados && c.Impuestos.Traslados.length > 0) {
                return sum + c.Impuestos.Traslados.reduce((s, t) => s + t.Importe, 0);
            }
            return sum;
        }, 0);
        const total = subtotal + totalImpuestosTrasladados;

        // --- CONSTRUCCIÓN Y SELLADO XML LOCAL (REQUERIDO POR EL USUARIO) ---
        let xmlSelladoString = '';
        if (emisorConfig.csd_cer_path && emisorConfig.csd_key_path && emisorConfig.csd_password_encrypted) {
            try {
                console.log('[XML] Iniciando construcción y sellado local...');
                const passDescrypted = decrypt(emisorConfig.csd_password_encrypted);

                // Preparar datos para xmlService
                const xmlData = {
                    emisor: {
                        rfc: emisorConfig.rfc,
                        razonSocial: emisorConfig.razon_social,
                        regimenFiscal: emisorConfig.regimen_fiscal
                    },
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
                        totalTraslados: totalImpuestosTrasladados,
                        total: total
                    },
                    serie: 'A',
                    folio: factura.folio || '1',
                    formaPago: factura.formaPago,
                    metodoPago: factura.metodoPago,
                    lugarExpedicion: emisorConfig.codigo_postal
                };

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
                // console.log(xmlSelladoString); // Descomentar para debug

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
                const response = await timbrarXmlSellado(xmlSelladoString);
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
                subtotal,
                total,
                totalImpuestosTrasladados
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
            facturamaData = response.data;
            timbradoExitoso = true;
        }

        if (timbradoExitoso && facturamaData && facturamaData.Id) {
            // Calcular totales (usar los totales del CFDI timbrado si están disponibles, si no, los calculados localmente)
            const finalSubtotal = facturamaData.SubTotal || subtotal;
            const finalIva = (facturamaData.Impuestos && facturamaData.Impuestos.TotalImpuestosTrasladados) || totalImpuestosTrasladados;
            const finalTotal = facturamaData.Total || total;

            // Preparar datos para el PDF
            const pdfData = {
                emisor: {
                    rfc: emisorConfig.rfc,
                    razonSocial: emisorConfig.razon_social,
                    regimenFiscal: emisorConfig.regimen_fiscal,
                    codigoPostal: emisorConfig.codigo_postal
                },
                receptor: {
                    rfc: receptor.rfc,
                    nombre: receptor.nombre,
                    regimenFiscal: receptor.regimenFiscal,
                    codigoPostal: receptor.codigoPostal,
                    usoCfdi: receptor.usoCfdi
                },
                conceptos: conceptos.map(concepto => ({
                    cantidad: concepto.cantidad,
                    claveProductoServicio: concepto.claveProductoServicio,
                    descripcion: concepto.descripcion,
                    valorUnitario: concepto.valorUnitario,
                    importe: concepto.cantidad * concepto.valorUnitario
                })),
                totales: {
                    subtotal: finalSubtotal,
                    iva: finalIva,
                    total: finalTotal,
                    formaPago: factura.formaPago,
                    metodoPago: factura.metodoPago
                },
                cfdiInfo: {
                    uuid: facturamaData.Complement?.TaxStamp?.Uuid || facturamaData.Id,
                    fechaEmision: facturamaData.Date || new Date().toISOString(),
                    fechaTimbrado: facturamaData.Complement?.TaxStamp?.Date || new Date().toISOString(),
                    // Si tenemos XML sellado localmente, extraemos de ahí el sello y certificado del emisor
                    selloDigital: xmlSelladoString ? (xmlSelladoString.match(/Sello="([^"]+)"/) || [])[1] : (facturaData.Sello || 'Sello no disponible'),
                    noCertificadoEmisor: xmlSelladoString ? (xmlSelladoString.match(/NoCertificado="([^"]+)"/) || [])[1] : (facturaData.NoCertificado || 'No. Certificado no disponible'),
                    // Datos del SAT vienen del complemento
                    selloSAT: facturamaData.Complement?.TaxStamp?.SatSign || 'Sello SAT no disponible',
                    certificadoSAT: facturamaData.Complement?.TaxStamp?.SatCertNumber || 'Certificado SAT no disponible',
                    cadenaOriginal: facturamaData.OriginalString || `||1.1|${facturamaData.Id}|${facturamaData.Complement?.TaxStamp?.Date}|${facturamaData.Complement?.TaxStamp?.SatSign}|${facturamaData.Complement?.TaxStamp?.SatCertNumber}||`,
                    rfcEmisor: emisorConfig.rfc,
                    rfcReceptor: receptor.rfc,
                    total: finalTotal
                }
            };

            // Generar PDF
            const nombreArchivo = `FACTURA-${facturamaResponse.data.Id}.pdf`;
            const rutaPDF = await pdfService.guardarPDF(pdfData, nombreArchivo);

            // Guardar XML en archivo
            const nombreArchivoXml = `FACTURA-${facturamaResponse.data.Id}.xml`;
            const rutaXML = path.join(__dirname, '../../pdfs', nombreArchivoXml);
            require('fs').writeFileSync(rutaXML, facturamaResponse.data.Cfdi || '');

            // Guardar en base de datos usando la estructura existente
            await db.query(
                `INSERT INTO facturas (
                    uuid, fecha_emision, fecha_timbrado, total, subtotal, total_iva,
                    forma_pago, metodo_pago, uso_cfdi, estado, xml_path, pdf_path,
                    sello_cfdi, sello_sat, no_certificado, no_certificado_sat, id_emisor, id_cliente
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
                [
                    facturamaResponse.data.Id,
                    new Date(), // Fecha de emisión local
                    facturamaResponse.data.FechaTimbrado ? new Date(facturamaResponse.data.FechaTimbrado) : new Date(), // Fecha de timbrado de Facturama
                    finalTotal,
                    finalSubtotal,
                    finalIva,
                    factura.formaPago,
                    factura.metodoPago,
                    receptor.usoCfdi,
                    'Timbrada',
                    rutaXML,
                    rutaPDF,
                    // Asegurarse de usar las propiedades correctas del response de Facturama
                    facturamaResponse.data.Sello || '', // Sello del CFDI
                    facturamaResponse.data.SelloSAT || '', // Sello del SAT
                    facturamaResponse.data.NoCertificado || '', // No. Certificado Emisor
                    facturamaResponse.data.NoCertificadoSAT || '', // No. Certificado SAT
                    1, // id_emisor (ahora existe en la base de datos)
                    1 // id_cliente (asumiendo que es 1 por defecto)
                ]
            );

            res.json({
                success: true,
                message: 'Factura timbrada exitosamente',
                data: {
                    uuid: facturamaResponse.data.Id,
                    total: finalTotal,
                    pdfPath: rutaPDF,
                    xml: facturamaResponse.data.Cfdi // El XML completo del CFDI timbrado
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
            const facturamaErrorMessage = error.response.data.Message ||
                error.response.data.ExceptionMessage ||
                JSON.stringify(error.response.data);
            return res.status(400).json({
                success: false,
                error: `Error de Facturama: ${facturamaErrorMessage}`
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
        const { uuid, motivoCancelacion } = req.body;

        if (!uuid || !motivoCancelacion) {
            return res.status(400).json({
                success: false,
                error: 'UUID y motivo de cancelación son requeridos'
            });
        }

        // Obtener token de Facturama
        const token = await getFacturamaToken();

        // Cancelar en Facturama
        const facturamaResponse = await axios.post(
            `${FACTURAMA_BASE_URL}/3/cfdis/${uuid}/Cancel`,
            {
                Motivo: motivoCancelacion
            },
            {
                headers: {
                    'Authorization': `Basic ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (facturamaResponse.data && facturamaResponse.data.Status === 'Canceled') {
            // Actualizar estado en base de datos
            await db.query(
                'UPDATE facturas SET estado = $1, motivo_cancelacion = $2 WHERE uuid = $3',
                ['Cancelada', motivoCancelacion, uuid]
            );

            res.json({
                success: true,
                message: 'Factura cancelada exitosamente',
                data: {
                    uuid,
                    status: 'Cancelada'
                }
            });
        } else {
            throw new Error('Error al cancelar en Facturama');
        }

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
        const result = await db.query(
            `SELECT 
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
                c.nombre as cliente_nombre,
                c.rfc as cliente_rfc,
                c.tipo as cliente_tipo,
                e.razon_social as emisor_nombre,
                e.rfc as emisor_rfc
            FROM facturas f
            LEFT JOIN clientes c ON f.id_cliente = c.id_cliente
            LEFT JOIN emisores e ON f.id_emisor = e.id_emisor
            ORDER BY f.fecha_emision DESC`
        );

        // Calcular estadísticas
        const statsResult = await db.query(`
            SELECT 
                COUNT(*) as total_facturas,
                COUNT(CASE WHEN estado = 'Timbrada' THEN 1 END) as facturas_timbradas,
                COUNT(CASE WHEN estado = 'Cancelada' THEN 1 END) as facturas_canceladas,
                SUM(CASE WHEN estado = 'Timbrada' THEN total ELSE 0 END) as total_ingresos,
                SUM(CASE WHEN estado = 'Timbrada' THEN total ELSE 0 END) as por_cobrar
            FROM facturas
        `);

        const stats = statsResult.rows[0] || {
            total_facturas: 0,
            facturas_timbradas: 0,
            facturas_canceladas: 0,
            total_ingresos: 0,
            por_cobrar: 0
        };

        // Formatear las facturas para el frontend
        const facturas = result.rows.map(factura => {
            const fechaEmision = new Date(factura.fecha_emision);
            const fechaVencimiento = new Date(factura.fecha_emision);
            fechaVencimiento.setDate(fechaVencimiento.getDate() + 30); // 30 días de plazo

            // Determinar estado de pago
            let estadoPago = 'Pagada';
            let montoPagado = factura.total;
            let fechaPago = factura.fecha_emision;

            if (new Date() > fechaVencimiento && factura.total > 0) {
                estadoPago = 'Vencida';
                montoPagado = 0;
                fechaPago = null;
            } else if (factura.estado === 'Timbrada' && factura.total > 0) {
                estadoPago = 'Pendiente';
                montoPagado = 0;
                fechaPago = null;
            }

            return {
                uuid: factura.uuid,
                folio: `FAC-${factura.uuid.substring(0, 8)}`,
                contrato: `CONT-${factura.uuid.substring(0, 8)}`,
                cliente: {
                    nombre: factura.cliente_nombre || 'Cliente General',
                    tipo: factura.cliente_tipo || 'Empresa',
                    metodo: factura.forma_pago === '03' ? 'Transferencia' :
                        factura.forma_pago === '01' ? 'Efectivo' : 'Otros'
                },
                estado: estadoPago,
                fechas: {
                    emision: fechaEmision.toISOString().split('T')[0],
                    vencimiento: fechaVencimiento.toISOString().split('T')[0]
                },
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
                estadisticas: {
                    facturasPendientes: stats.facturas_timbradas,
                    facturasVencidas: stats.facturas_canceladas,
                    ingresosMes: stats.total_ingresos || 0,
                    porCobrar: stats.por_cobrar || 0
                }
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
        const fs = require('fs');

        if (!factura.pdf_path || !fs.existsSync(factura.pdf_path)) {
            return res.status(404).json({
                success: false,
                error: 'PDF no encontrado'
            });
        }

        res.download(factura.pdf_path, `FACTURA-${uuid}.pdf`);

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

        // 1. SI ES COTIZACIÓN DE VENTA (VEN-)
        if (query.toUpperCase().startsWith('VEN-')) {
            const result = await db.query(
                `SELECT c.*, cl.nombre as cliente_nombre, cl.rfc as cliente_rfc, 
                        cl.email as cliente_email, cl.codigo_postal as cliente_cp,
                        cl.regimen_fiscal as cliente_regimen, cl.uso_cfdi as cliente_uso_cfdi,
                        cl.razon_social as cliente_razon_social
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
                    uso_cfdi: doc.cliente_uso_cfdi || 'G03'
                },
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
        const searchQuery = `%${query}%`;
        const prodResult = await db.query(
            `SELECT p.* FROM public.productos p 
             WHERE p.nombre_del_producto ILIKE $1 OR p.clave ILIKE $1 
             LIMIT 1`,
            [searchQuery]
        );

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
            `SELECT id_cliente, nombre, rfc, fact_rfc, razon_social, regimen_fiscal, codigo_postal, uso_cfdi, domicilio, direccion, numero_ext 
             FROM clientes 
             WHERE nombre ILIKE $1 OR rfc ILIKE $1 OR fact_rfc ILIKE $1 OR razon_social ILIKE $1 OR numero_cliente ILIKE $1
             LIMIT 10`,
            [searchQuery]
        );

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
            SELECT id_cotizacion, numero_cotizacion, productos_seleccionados, subtotal, total, costo_envio
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
                        SELECT id_producto, clave_sat_productos, nombre_del_producto, precio_venta, clave
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

                    return {
                        ...p,
                        clave_sat_productos: info ? info.clave_sat_productos : (p.clave_sat_productos || '01010101'),
                        nombre: internalKey ? `[${internalKey}] ${productName}` : productName,
                        precio_unitario: p.precio_unitario || (info ? info.precio_venta : (p.precio_venta || p.precio || 0))
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
            SELECT id_producto, nombre_del_producto, clave, tarifa_renta, precio_venta, id_categoria, clave_sat_productos
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
                price: p.precio_venta || p.tarifa_renta || 0
            });
        });

        res.json({ success: true, results });
    } catch (error) {
        console.error('Error en searchConcepts:', error);
        res.status(500).json({ success: false, error: 'Error interno de búsqueda' });
    }
};
