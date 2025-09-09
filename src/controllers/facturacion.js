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
const { getFacturamaToken, buildCfdiJson, FACTURAMA_BASE_URL } = require('../services/facturamaService');
const emailService = require('../services/emailService');

const pdfService = new PDFService();

// TIMBRAR FACTURA
exports.timbrarFactura = async (req, res) => {
    try {
        const { receptor, factura, conceptos } = req.body;

        // Al inicio de tu función timbrarFactura, agrega esto:
        const buildCleanItem = (concepto, cantidad, valorUnitario, importe, objetoImp, itemImpuestos, claveProdServ) => {
            const item = {
                ClaveProductoServicio: claveProdServ, // CAMBIAR DE ClaveProdServ A ClaveProductoServicio
                Cantidad: cantidad,
                ClaveUnidad: concepto.claveUnidad,
                Unidad: concepto.unidad || 'Unidad de servicio',
                Descripcion: concepto.descripcion,
                ValorUnitario: valorUnitario,
                Importe: importe,
                ObjetoImp: objetoImp
            };

            // Solo agregar NoIdentificacion si tiene un valor válido
            if (concepto.noIdentificacion && concepto.noIdentificacion.trim() !== '') {
                item.NoIdentificacion = concepto.noIdentificacion.trim();
            }

            // Solo agregar Impuestos si están definidos
            if (itemImpuestos) {
                item.Impuestos = itemImpuestos;
            }

            return item;
        };

        // Obtener configuración del emisor
        const emisorResult = await db.query(
            'SELECT rfc, razon_social, regimen_fiscal, codigo_postal FROM configuracion_facturacion ORDER BY fecha_actualizacion DESC LIMIT 1'
        );

        if (emisorResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No hay configuración del emisor. Configure los datos fiscales primero.'
            });
        }

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

        // Construir JSON para Facturama
        if (receptor.rfc === 'XAXX010101000') {
            receptor.regimenFiscal = '616'; // Forzar Sin obligaciones fiscales para RFC genérico
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

        // Obtener token de Facturama
        const token = await getFacturamaToken();

        // Enviar a Facturama para timbrado
        console.log('Enviando a Facturama:', `${FACTURAMA_BASE_URL}/3/cfdis`);
        console.log('JSON enviado:', JSON.stringify(cfdiJson, null, 2));
        
        const facturamaResponse = await axios.post(
            `${FACTURAMA_BASE_URL}/3/cfdis`,
            cfdiJson,
            {
                headers: {
                    'Authorization': `Basic ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('Respuesta de Facturama:', JSON.stringify(facturamaResponse.data, null, 2));
        
        if (facturamaResponse.data && facturamaResponse.data.Id) {
            // Calcular totales (usar los totales del CFDI timbrado si están disponibles, si no, los calculados localmente)
            const finalSubtotal = facturamaResponse.data.SubTotal || subtotal;
            const finalIva = (facturamaResponse.data.Impuestos && facturamaResponse.data.Impuestos.TotalImpuestosTrasladados) || totalImpuestosTrasladados;
            const finalTotal = facturamaResponse.data.Total || total;

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
                    uuid: facturamaResponse.data.Id,
                    fechaEmision: new Date().toISOString(),
                    fechaTimbrado: facturamaResponse.data.FechaTimbrado || new Date().toISOString(),
                    // Sellos digitales completos
                    selloDigital: facturamaResponse.data.Sello || 'Sello del CFDI no disponible',
                    selloSAT: facturamaResponse.data.SelloSAT || 'Sello del SAT no disponible',
                    certificadoSAT: facturamaResponse.data.NoCertificadoSAT || 'Certificado del SAT no disponible',
                    noCertificadoEmisor: facturamaResponse.data.NoCertificado || 'No. Certificado Emisor no disponible',
                    rfcEmisor: emisorConfig.rfc,
                    rfcReceptor: receptor.rfc,
                    total: finalTotal
                }
            };

            // Generar PDF
            const nombreArchivo = `FACTURA-${facturamaResponse.data.Id}.pdf`;
            const rutaPDF = await pdfService.guardarPDF(pdfData, nombreArchivo);

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
                    // Facturama devuelve el XML en la propiedad 'Cfdi'. Guardarlo.
                    facturamaResponse.data.Cfdi || '',
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
