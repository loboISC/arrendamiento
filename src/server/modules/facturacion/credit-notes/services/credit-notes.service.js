const RepositorioNotasCredito = require('../repositories/credit-notes.repository');
const ServicioCalculadoraImpuestos = require('./tax-calculator.service');
const ServicioValidadorSAT = require('./sat-validator.service');
const ServicioSaldoAcreditable = require('./balance.service');
const ProveedorFacturama = require('../../../../services/facturacion/providers/facturama.provider');
const ProveedorAPIFiscal = require('../../../../services/facturacion/providers/apifiscal.provider');
const PDFService = require('../../../../services/pdfService');
const emailService = require('../../../../services/emailService');
const fs = require('fs');
const path = require('path');
const {
  extraerDatosSatDesdeXml,
  extraerTotalesDesdeXml,
  normalizarXmlString
} = require('../../../../../utils/facturacion/xmlUtils');
const {
  descripcionTipoRelacion,
  formaPagoTexto
} = require('../../../../../utils/facturacion/satCatalogos');

/**
 * Servicio principal de notas de credito.
 * Orquesta reglas fiscales, saldo acreditable, proveedor CFDI y persistencia.
 */
class ServicioNotasCredito {
  constructor() {
    this.repositorio = new RepositorioNotasCredito();
    this.calculadora = new ServicioCalculadoraImpuestos();
    this.validadorSAT = new ServicioValidadorSAT();
    this.saldo = new ServicioSaldoAcreditable(this.repositorio);
    this.pdfService = new PDFService();
  }

  /**
   * Determina la carpeta física donde se deben persistir los PDFs.
   * Respeta PDF_STORAGE_DIR y, por compatibilidad, cae a public/pdfs.
   */
  obtenerDirectorioAlmacenPdf() {
    // pdfService expone publicDir apuntando a /public
    const publicDir = this.pdfService.publicDir || path.join(this.pdfService.projectRoot || path.resolve(__dirname, '../../../../../..'), 'public');
    return process.env.PDF_STORAGE_DIR || path.join(publicDir, 'pdfs');
  }

  /**
   * Guarda un buffer de PDF en disco usando el mismo esquema de almacenamiento
   * que las facturas normales. No modifica el flujo principal: si falla,
   * devuelve null y deja que la operación original continúe.
   *
   * @param {Buffer} buffer Buffer con el contenido del PDF
   * @param {string} nombreArchivo Nombre de archivo portátil para la BD
   * @returns {string|null} nombreArchivo si se guardó correctamente, null si falló
   */
  guardarPdfEnDiscoDeFormaSegura(buffer, nombreArchivo) {
    try {
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error('Buffer PDF vacío o inválido.');
      }

      const storageDir = this.obtenerDirectorioAlmacenPdf();
      const rutaArchivo = path.join(storageDir, nombreArchivo);
      const dir = path.dirname(rutaArchivo);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(rutaArchivo, buffer);
      return nombreArchivo;
    } catch (error) {
      console.error('[NotasCredito] Error al persistir PDF en almacenamiento:', {
        nombreArchivo,
        mensaje: error.message
      });
      return null;
    }
  }

  /**
   * Guarda el contenido XML de un CFDI en disco de forma segura.
   * @param {string} xmlContent Contenido XML como string
   * @param {string} nombreArchivo Nombre de archivo (p.ej. UUID.xml)
   * @returns {string|null} nombreArchivo si tuvo éxito, null si falló
   */
  guardarXmlEnDiscoDeFormaSegura(xmlContent, nombreArchivo) {
    try {
      if (!xmlContent || typeof xmlContent !== 'string' || xmlContent.trim().length === 0) {
        throw new Error('Contenido XML vacío o inválido.');
      }

      const storageDir = this.obtenerDirectorioAlmacenPdf();
      const rutaArchivo = path.join(storageDir, nombreArchivo);
      const dir = path.dirname(rutaArchivo);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(rutaArchivo, xmlContent, 'utf8');
      return nombreArchivo;
    } catch (error) {
      console.error('[NotasCredito] Error al persistir XML en almacenamiento:', {
        nombreArchivo,
        mensaje: error.message
      });
      return null;
    }
  }

  obtenerProveedor(nombreProveedor = 'facturama') {
    if (String(nombreProveedor).toLowerCase() === 'apifiscal') return new ProveedorAPIFiscal();
    return new ProveedorFacturama();
  }

  async buscarFacturas(filtros) {
    return this.repositorio.buscarFacturas(filtros);
  }

  async listar(filtros) {
    return this.repositorio.listar(filtros);
  }

  async obtenerPorId(id) {
    return this.repositorio.obtenerPorId(id);
  }

  resolverIvaFactura(factura) {
    const totalFactura = Number(factura?.total || 0);
    const subtotalFactura = Number(factura?.subtotal || 0);
    let ivaFactura = Number(factura?.tax ?? factura?.total_iva ?? 0);
    if (ivaFactura <= 0 && totalFactura > subtotalFactura + 0.02) {
      ivaFactura = Number((totalFactura - subtotalFactura).toFixed(2));
    }
    return { subtotalFactura, ivaFactura, totalFactura };
  }

  enriquecerConceptosDesdeFactura(conceptos, factura) {
    const { subtotalFactura, ivaFactura } = this.resolverIvaFactura(factura);
    const tasaFactura = subtotalFactura > 0
      ? Number((ivaFactura / subtotalFactura).toFixed(6))
      : 0.16;

    return conceptos.map((concepto) => {
      const item = { ...concepto };
      if (item.tasa_iva == null || item.tasa_iva === '') {
        item.tasa_iva = tasaFactura;
      }

      const cantidad = Number(item.cantidad || 1);
      const precio = Number(item.precio_unitario || 0);
      const desc = Number(item.descuento || 0);
      const descPct = Number(item.descuento_porcentaje || 0);
      const bruto = cantidad * precio;
      const base = Math.max(bruto - desc - bruto * (descPct / 100), 0);

      if (
        (item.iva_manual == null || item.iva_manual === '')
        && subtotalFactura > 0
        && Math.abs(base - subtotalFactura) < 0.02
        && ivaFactura > 0
      ) {
        item.iva_manual = ivaFactura;
      }

      return item;
    });
  }

  async prepararFactura(invoiceId) {
    const saldoFactura = await this.saldo.obtenerSaldoFactura(invoiceId);
    if (!saldoFactura) return null;
    const conceptos = await this.repositorio.obtenerConceptosFactura(invoiceId);
    return { ...saldoFactura, conceptos };
  }

  async crearBorrador(payload, usuario) {
    const id = payload.id || payload.credit_note_id;
    const invoiceId = payload.invoice_id || payload.factura_id;
    const preparacion = await this.prepararFactura(invoiceId);
    if (!preparacion) {
      const error = new Error('Factura origen no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    let conceptosEntrada = Array.isArray(payload.items) ? payload.items : [];
    if (conceptosEntrada.length === 0) {
      conceptosEntrada = await this.repositorio.obtenerConceptosFactura(invoiceId);
    }
    conceptosEntrada = this.enriquecerConceptosDesdeFactura(conceptosEntrada, preparacion.factura);
    const totales = this.calculadora.calcularTotales(conceptosEntrada);

    const totalesUi = payload.totales_ui || payload.totales;
    if (totalesUi && Number(totalesUi.total) > 0) {
      const subtotalUi = Number(totalesUi.subtotal ?? totales.subtotal);
      const ivaUi = Number(totalesUi.iva ?? totalesUi.tax ?? totales.iva);
      const totalUi = Number(totalesUi.total ?? totales.total);
      if (Math.abs(totales.total - totalUi) <= 0.02) {
        totales.subtotal = this.calculadora.redondear(subtotalUi);
        totales.iva = this.calculadora.redondear(ivaUi);
        totales.total = this.calculadora.redondear(totalUi);
      }
    }
    const validacion = this.validadorSAT.validarBorrador({
      facturaOrigen: preparacion.factura,
      motivo: payload.reason,
      relationType: payload.relation_type || payload.tipo_relacion || '01',
      tipoComprobante: payload.tipo_comprobante || 'E',
      conceptos: totales.conceptos,
      totales,
      saldoDisponible: preparacion.saldoDisponible
    });

    if (!validacion.valido) {
      const error = new Error(validacion.errores.join(' '));
      error.statusCode = 400;
      error.detalles = validacion;
      throw error;
    }

    const metodoPago = String(payload.metodo_pago || preparacion.factura.metodo_pago || 'PUE').toUpperCase();
    const formaPago = metodoPago === 'PPD'
      ? '99'
      : String(payload.forma_pago || preparacion.factura.forma_pago || '03').padStart(2, '0');

    const tipoComprobante = String(payload.tipo_comprobante || 'E').toUpperCase() === 'I' ? 'I' : 'E';

    const datosBorrador = {
      invoice_id: preparacion.factura.invoice_id,
      customer_id: preparacion.factura.customer_id,
      invoice_uuid: preparacion.factura.uuid,
      folio: payload.folio || `NC-${Date.now()}`,
      relation_type: payload.relation_type || payload.tipo_relacion || '01',
      reason: payload.reason,
      tipo_comprobante: tipoComprobante,
      forma_pago: formaPago,
      metodo_pago: metodoPago,
      subtotal: totales.subtotal,
      tax: totales.iva,
      total: totales.total,
      balance_applied: 0,
      status: 'BORRADOR',
      sat_status: 'PENDIENTE',
      provider: payload.provider || 'facturama',
      branch_id: payload.branch_id || usuario?.branch_id || null,
      user_id: usuario?.id_usuario || usuario?.id || null,
      items: totales.conceptos
    };

    if (id) {
      const existente = await this.repositorio.obtenerPorId(id);
      if (!existente) {
        const error = new Error('Borrador no encontrado.');
        error.statusCode = 404;
        throw error;
      }
      if (existente.status !== 'BORRADOR') {
        const error = new Error('No se puede modificar una nota de crédito timbrada.');
        error.statusCode = 400;
        throw error;
      }
      return this.repositorio.actualizarBorrador(id, datosBorrador);
    }

    return this.repositorio.crearBorrador(datosBorrador);
  }

  asegurarImpuestosNota(nota) {
    const items = (nota.items || []).map((item) => {
      const linea = this.calculadora.calcularLineaFacturama(item);
      return {
        ...item,
        quantity: linea.cantidad,
        unit_price: linea.precioUnitario,
        discount: linea.descuento,
        subtotal: linea.base,
        tax: linea.iva,
        iva: linea.iva,
        total: linea.total,
        tasa_iva: linea.tasaIva
      };
    });

    const subtotal = this.calculadora.redondear(items.reduce((suma, item) => suma + Number(item.subtotal || 0), 0));
    const tax = this.calculadora.redondear(items.reduce((suma, item) => suma + Number(item.tax || 0), 0));
    const total = this.calculadora.redondear(items.reduce((suma, item) => suma + Number(item.total || 0), 0));

    return { ...nota, subtotal, tax, total, items };
  }

  resolverConfigEmisor(emisorDb) {
    const emisor = emisorDb || {};
    return {
      rfc: emisor.rfc || process.env.RFC_EMISOR || 'APT100310EC2',
      razon_social: emisor.razon_social || process.env.NOMBRE_EMISOR || 'ANDAMIOS Y PROYECTOS TORRES',
      regimen_fiscal: emisor.regimen_fiscal || process.env.REGIMEN_FISCAL_EMISOR || process.env.REGIMEN_EMISOR || '601',
      codigo_postal: emisor.codigo_postal
        || process.env.FACTURAMA_EXPEDITION_PLACE
        || process.env.CODIGO_POSTAL_EMISOR
        || '00000'
    };
  }

  construirRelacionesFacturama(nota) {
    const cfdis = ((nota.relaciones || []).length > 0
      ? (nota.relaciones || []).map((relacion) => relacion.invoice_uuid)
      : [nota.invoice_uuid_origen])
      .map((uuid) => String(uuid || '').trim())
      .filter(Boolean)
      .map((Uuid) => ({ Uuid }));

    if (cfdis.length === 0) return null;

    return {
      Type: String(nota.relation_type || '01').padStart(2, '0'),
      Cfdis: cfdis
    };
  }

  construirPayloadTimbrado(nota, emisorConfig) {
    const emisor = this.resolverConfigEmisor(emisorConfig);
    const rfcReceptor = String(nota.customer_rfc || '').trim().toUpperCase();
    const esPublicoGeneral = rfcReceptor === 'XAXX010101000';
    const receptor = {
      Rfc: rfcReceptor || nota.customer_rfc,
      Name: esPublicoGeneral ? 'PUBLICO EN GENERAL' : (nota.customer_name || nota.razon_social),
      CfdiUse: esPublicoGeneral ? 'S01' : 'G02',
      FiscalRegime: esPublicoGeneral ? '616' : nota.tax_regime,
      TaxZipCode: esPublicoGeneral ? emisor.codigo_postal : nota.postal_code
    };

    const metodoPago = String(nota.metodo_pago || 'PUE').toUpperCase();
    const formaPago = metodoPago === 'PPD'
      ? '99'
      : String(nota.forma_pago || '99').padStart(2, '0');

    const tipoComprobante = String(nota.tipo_comprobante || 'E').toUpperCase() === 'I' ? 'I' : 'E';
    const folio = String(nota.folio || nota.id || '1').trim();
    const relations = this.construirRelacionesFacturama(nota);

    const payload = {
      CfdiType: tipoComprobante,
      NameId: '1',
      Folio: folio,
      ExpeditionPlace: emisor.codigo_postal,
      PaymentForm: formaPago,
      PaymentMethod: metodoPago,
      Issuer: {
        Rfc: emisor.rfc,
        Name: emisor.razon_social,
        FiscalRegime: String(emisor.regimen_fiscal || '601')
      },
      Receiver: receptor,
      Items: (nota.items || []).map((item) => {
        const linea = this.calculadora.calcularLineaFacturama(item);
        const traslado = this.calculadora.calcularTrasladoIva(linea.base, linea.tasaIva);

        return {
          ProductCode: item.sat_product_key || '01010101',
          IdentificationNumber: item.product_id ? String(item.product_id) : undefined,
          Description: item.description || item.descripcion,
          Unit: item.sat_unit_key || 'ACT',
          UnitCode: item.sat_unit_key || 'ACT',
          UnitPrice: linea.precioUnitario,
          Quantity: linea.cantidad,
          Subtotal: linea.subtotalBruto,
          Discount: linea.descuento,
          TaxObject: '02',
          Taxes: [traslado],
          Total: linea.total
        };
      })
    };

    if (relations) {
      payload.Relations = relations;
    }

    return payload;
  }

  async timbrar(id, usuario) {
    const usuarioId = usuario?.id_usuario || usuario?.id || null;
    const nota = await this.repositorio.obtenerPorId(id);
    if (!nota) {
      const error = new Error('Nota de credito no encontrada.');
      error.statusCode = 404;
      throw error;
    }
    if (!['BORRADOR', 'ERROR'].includes(nota.status)) {
      const error = new Error('Solo se pueden timbrar notas en BORRADOR o ERROR.');
      error.statusCode = 409;
      throw error;
    }

    await this.repositorio.actualizarEstado(id, 'TIMBRANDO', { updated_by: usuarioId });
    const proveedor = this.obtenerProveedor(nota.provider || 'facturama');
    const notaConImpuestos = this.asegurarImpuestosNota(nota);
    const emisorConfig = await this.repositorio.obtenerConfigEmisor();
    const payloadTimbrado = this.construirPayloadTimbrado(notaConImpuestos, emisorConfig);
    await this.repositorio.registrarLog(id, 'REQUEST_TIMBRADO', {
      request: payloadTimbrado,
      user_id: usuario?.id_usuario || usuario?.id || null
    });

    try {
      const respuesta = await proveedor.crearNotaCredito(payloadTimbrado);
      const datosTimbrado = this.extraerDatosTimbradoDesdeRespuesta(respuesta);
      const uuid = datosTimbrado?.uuidSat
        || respuesta.Complement?.TaxStamp?.Uuid
        || respuesta.Id
        || respuesta.uuid
        || nota.uuid
        || null;
      await this.repositorio.registrarLog(id, 'RESPONSE_TIMBRADO', {
        response: respuesta,
        user_id: usuario?.id_usuario || usuario?.id || null
      });

      // Intentar generar y persistir el PDF timbrado en el mismo esquema que facturas.
      // El nombre de archivo usa el folio fiscal devuelto por el PAC cuando esté disponible.
      let pdfPath = null;
      let xmlPath = null;
      const folioPdf = (datosTimbrado?.folio || nota.folio || uuid || id || '').toString().trim();

      // Guardar PDF
      try {
        if (folioPdf) {
          const nombreArchivoPdf = `${folioPdf}.pdf`;
          const dataParaPdf = await this.construirDataParaPdf(
            { ...notaConImpuestos, uuid, folio: datosTimbrado?.folio || nota.folio || nota.id },
            {
              isPreview: false,
              datosTimbrado
            }
          );
          const bufferPdf = await this.pdfService.generarPDFFactura(dataParaPdf);
          const bufferNormalizado = this.normalizarBufferPdf(bufferPdf);
          if (bufferNormalizado) {
            const nombreGuardado = this.guardarPdfEnDiscoDeFormaSegura(bufferNormalizado, nombreArchivoPdf);
            if (nombreGuardado) {
              pdfPath = nombreGuardado;
            }
          }
        }
      } catch (errorAlmacenarPdf) {
        console.error('[NotasCredito] Timbrado correcto, pero fallo al guardar PDF en disco:', {
          id,
          mensaje: errorAlmacenarPdf.message
        });
      }

      // Guardar XML desde el proveedor
      try {
        const ids = await this.obtenerIdsProveedorCfdi({ ...nota, uuid });
        for (const cfdiId of ids) {
          try {
            const xmlContent = await proveedor.obtenerXML(cfdiId);
            if (xmlContent && typeof xmlContent === 'string' && xmlContent.trim().startsWith('<')) {
              const nombreArchivoXml = `${folioPdf || cfdiId}.xml`;
              const nombreGuardado = this.guardarXmlEnDiscoDeFormaSegura(xmlContent, nombreArchivoXml);
              if (nombreGuardado) {
                xmlPath = nombreGuardado;
                break;
              }
            }
          } catch (errXmlId) {
            console.warn('[NotasCredito] No se pudo descargar XML para ID:', cfdiId, errXmlId.mensaje || errXmlId.message || errXmlId);
          }
        }
      } catch (errorAlmacenarXml) {
        console.error('[NotasCredito] Timbrado correcto, pero fallo al guardar XML en disco:', {
          id,
          mensaje: errorAlmacenarXml.message
        });
      }

      const notaTimbrada = await this.repositorio.actualizarEstado(id, 'TIMBRADA', {
        sat_status: 'VIGENTE',
        uuid,
        stamped_at: new Date(),
        stamped_by: usuarioId,
        updated_by: usuarioId,
        pdf_path: pdfPath || nota.pdf_path || null,
        xml_path: xmlPath || nota.xml_path || null
      });

      try {
        if (notaConImpuestos.id_factura_origen) {
          await this.repositorio.eliminarOtrosBorradores(notaConImpuestos.id_factura_origen, id);
        }
      } catch (errEliminar) {
        console.warn('[NotasCredito] No se pudieron eliminar borradores obsoletos:', errEliminar.message);
      }

      return notaTimbrada;
    } catch (errorProveedor) {
      await this.repositorio.registrarLog(id, 'ERROR_TIMBRADO', {
        error: errorProveedor,
        user_id: usuario?.id_usuario || usuario?.id || null
      });
      await this.repositorio.actualizarEstado(id, 'ERROR', { sat_status: 'ERROR' });
      const error = new Error(errorProveedor.mensaje || errorProveedor.message || 'Error al timbrar nota de credito.');
      error.statusCode = 502;
      error.detalles = errorProveedor;
      throw error;
    }
  }

  async cancelar(id, motivo, usuario) {
    const nota = await this.repositorio.obtenerPorId(id);
    if (!nota) {
      const error = new Error('Nota de credito no encontrada.');
      error.statusCode = 404;
      throw error;
    }
    if (!motivo) {
      const error = new Error('El motivo de cancelacion es obligatorio.');
      error.statusCode = 400;
      throw error;
    }

    const proveedor = this.obtenerProveedor(nota.provider);
    if (nota.uuid) await proveedor.cancelarFactura(nota.uuid, motivo);
    await this.repositorio.registrarLog(id, 'CANCELACION', {
      request: { motivo },
      user_id: usuario?.id_usuario || usuario?.id || null
    });
    return this.repositorio.actualizarEstado(id, 'CANCELADA', { sat_status: 'CANCELADA' });
  }

  async aplicar(id, usuario) {
    const nota = await this.repositorio.obtenerPorId(id);
    if (!nota) {
      const error = new Error('Nota de credito no encontrada.');
      error.statusCode = 404;
      throw error;
    }
    if (!['TIMBRADA', 'PARCIAL'].includes(nota.status)) {
      const error = new Error('Solo se pueden aplicar notas timbradas.');
      error.statusCode = 409;
      throw error;
    }
    return this.repositorio.aplicarSaldo(id, usuario?.id_usuario || usuario?.id || null);
  }

  notaTieneCfdiTimbrado(nota) {
    if (!nota) return false;
    const status = String(nota.status || '').toUpperCase();
    const uuid = String(nota.uuid || '').trim();
    const estadosTimbrados = ['TIMBRADA', 'APLICADA', 'PARCIAL', 'CANCELADA'];
    const uuidValido = uuid.length > 0
      && !uuid.startsWith('BORRADOR')
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
    return estadosTimbrados.includes(status) && uuidValido;
  }

  normalizarRespuestaTimbrado(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.response && typeof raw.response === 'object') return raw.response;
    return raw;
  }

  extraerTotalesDesdeRespuesta(respuesta = {}) {
    const xmlTimbrado = normalizarXmlString(respuesta.Cfdi || respuesta.cfdi || '');
    const totalesXml = extraerTotalesDesdeXml(xmlTimbrado);

    const subtotalJson = Number(respuesta.Subtotal || respuesta.SubTotal || 0);
    const totalJson = Number(respuesta.Total || 0);
    let ivaJson = 0;
    const taxes = respuesta.Taxes || respuesta.Impuestos || [];
    if (Array.isArray(taxes)) {
      ivaJson = taxes
        .filter((t) => !t.IsRetention && !t.isRetention)
        .reduce((sum, t) => sum + Number(t.Total || t.Importe || 0), 0);
    }

    return {
      subtotal: totalesXml.subtotal || subtotalJson || 0,
      descuento: totalesXml.descuento || Number(respuesta.Discount || respuesta.Descuento || 0),
      iva: totalesXml.iva || ivaJson || 0,
      total: totalesXml.total || totalJson || 0
    };
  }

  resolverTotalesParaPdf(nota, datosTimbrado = null) {
    const totalesSistema = {
      subtotal: Number(nota.subtotal || 0),
      descuento: 0,
      iva: Number(nota.tax ?? nota.impuestos ?? 0),
      total: Number(nota.total || 0)
    };
    const totalesTimbrado = datosTimbrado?.totales || {};
    const usarSistema = (valorSistema, valorTimbrado) => {
      if (Number.isFinite(valorSistema) && valorSistema > 0) return valorSistema;
      return Number(valorTimbrado || 0);
    };

    const subtotal = usarSistema(totalesSistema.subtotal, totalesTimbrado.subtotal);
    const iva = usarSistema(totalesSistema.iva, totalesTimbrado.iva);
    const total = usarSistema(totalesSistema.total, totalesTimbrado.total);
    const descuento = Number(totalesTimbrado.descuento || totalesSistema.descuento || 0);

    return { subtotal, descuento, iva, total };
  }

  extraerDatosTimbradoDesdeRespuesta(respuesta = {}) {
    const payload = this.normalizarRespuestaTimbrado(respuesta) || {};
    const taxStamp = payload.Complement?.TaxStamp || {};
    const xmlTimbrado = normalizarXmlString(payload.Cfdi || payload.cfdi || '');
    const satXml = extraerDatosSatDesdeXml(xmlTimbrado);

    const uuidSat = taxStamp.Uuid || satXml.uuid || payload.uuid || payload.Id || null;
    const fechaTimbradoSat = taxStamp.Date || satXml.fechaTimbrado || payload.FechaTimbrado || null;
    const selloCfdi = taxStamp.CfdiSign || taxStamp.Sign || satXml.selloDigital || payload.Sello || '';
    const selloSat = taxStamp.SatSign || satXml.selloSAT || '';
    const noCertificadoEmisor = payload.CertNumber || payload.NoCertificado || satXml.noCertificadoEmisor || '';
    const noCertificadoSat = taxStamp.SatCertNumber || payload.NoCertificadoSAT || satXml.noCertificadoSAT || '';
    const cadenaOriginal = payload.OriginalString || satXml.cadenaOriginal
      || (uuidSat && fechaTimbradoSat
        ? `||1.1|${uuidSat}|${fechaTimbradoSat}|${selloSat}|${noCertificadoSat}||`
        : '');

    return {
      facturamaId: payload.Id || null,
      uuidSat,
      folio: payload.Folio || payload.folio || null,
      fechaEmision: payload.Date || payload.Fecha || new Date().toISOString(),
      fechaTimbrado: fechaTimbradoSat || new Date().toISOString(),
      selloDigital: selloCfdi || 'Sello no disponible',
      selloSAT: selloSat || 'Sello SAT no disponible',
      noCertificadoEmisor: noCertificadoEmisor || 'No. Certificado no disponible',
      certificadoSAT: noCertificadoSat || 'Certificado SAT no disponible',
      cadenaOriginal: cadenaOriginal || 'Cadena original no disponible',
      totales: this.extraerTotalesDesdeRespuesta(payload)
    };
  }

  async obtenerIdsProveedorCfdi(nota) {
    const ids = [];
    
    const respuestaTimbrado = await this.repositorio.obtenerRespuestaTimbrado(nota.id);
    if (respuestaTimbrado) {
      const datos = this.extraerDatosTimbradoDesdeRespuesta(respuestaTimbrado);
      if (datos.facturamaId && !ids.includes(String(datos.facturamaId))) {
        ids.push(String(datos.facturamaId));
      }
      if (datos.uuidSat && !ids.includes(String(datos.uuidSat))) {
        ids.push(String(datos.uuidSat));
      }
    }

    const uuid = String(nota.uuid || '').trim();
    if (uuid && !uuid.startsWith('BORRADOR') && !ids.includes(uuid)) {
      ids.push(uuid);
    }

    return [...new Set(ids.filter(Boolean))];
  }

  esBufferPdfValido(buffer) {
    if (buffer == null) return false;
    const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    return bytes.length >= 4 && bytes.subarray(0, 4).toString() === '%PDF';
  }

  normalizarBufferPdf(pdf) {
    if (pdf == null) return null;
    const buffer = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
    return this.esBufferPdfValido(buffer) ? buffer : null;
  }

  async descargarPdfProveedor(nota) {
    const proveedor = this.obtenerProveedor(nota.provider || 'facturama');
    const ids = await this.obtenerIdsProveedorCfdi(nota);
    let ultimoError = null;

    for (const cfdiId of ids) {
      try {
        const pdf = await proveedor.obtenerPDF(cfdiId);
        const buffer = this.normalizarBufferPdf(pdf);
        if (buffer) return buffer;
        ultimoError = new Error(`PDF invalido para CFDI ${cfdiId}`);
      } catch (error) {
        ultimoError = error;
      }
    }

    if (ultimoError) throw ultimoError;
    const error = new Error('No se pudo obtener el PDF timbrado desde el proveedor CFDI.');
    error.statusCode = 502;
    throw error;
  }

  async construirDataParaPdf(nota, opciones = {}) {
    const esPreview = opciones.isPreview !== false;
    const datosTimbrado = opciones.datosTimbrado || null;
    const facturaOrigen = await this.repositorio.obtenerFacturaPorId(nota.id_factura_origen);
    const emisorConfig = await this.repositorio.obtenerConfigEmisor();
    const metodoPagoOrigen = String(nota.metodo_pago || facturaOrigen?.metodo_pago || 'PUE').toUpperCase();
    const formaPagoOrigen = metodoPagoOrigen === 'PPD'
      ? '99'
      : String(nota.forma_pago || facturaOrigen?.forma_pago || '99').padStart(2, '0');
    const tipoRelacion = nota.relation_type || nota.tipo_relacion || '01';
    const tipoComprobante = String(nota.tipo_comprobante || 'E').toUpperCase() === 'I' ? 'I' : 'E';
    const uuidRelacionado = nota.invoice_uuid_origen || facturaOrigen?.uuid || 'PENDIENTE';

    const conceptos = (nota.items || []).map((item) => {
      const cantidad = Number(item.quantity || item.cantidad || 0);
      const valorUnitario = Number(item.unit_price || item.precio_unitario || 0);
      const descuento = Number(item.discount || item.descuento || 0);
      const importe = Number((cantidad * valorUnitario).toFixed(2));

      return {
        claveProductoServicio: item.sat_product_key || '01010101',
        cantidad,
        claveUnidad: item.sat_unit_key || 'ACT',
        unidad: item.sat_unit_key || 'ACT',
        descripcion: item.description || item.descripcion || 'Nota de credito',
        valorUnitario,
        precio: valorUnitario,
        importe,
        descuento
      };
    });

    const cfdiInfo = esPreview
      ? {
        uuid: 'VISTA-PREVIA-NOTA-CREDITO',
        folio: nota.folio || `NC-${nota.id}`,
        fechaEmision: new Date().toISOString(),
        fechaTimbrado: 'PROCESO DE VISTA PREVIA',
        certificadoSAT: '00000000000000000000',
        noCertificadoEmisor: '00000000000000000000',
        selloDigital: 'VISTA_PREVIA_SIN_VALIDEZ',
        selloSAT: 'VISTA_PREVIA_SIN_VALIDEZ',
        cadenaOriginal: 'VISTA_PREVIA_SIN_VALIDEZ'
      }
      : {
        uuid: datosTimbrado?.uuidSat || nota.uuid,
        folio: datosTimbrado?.folio || nota.folio || `NC-${nota.id}`,
        fechaEmision: datosTimbrado?.fechaEmision || nota.stamped_at || new Date().toISOString(),
        fechaTimbrado: datosTimbrado?.fechaTimbrado || nota.stamped_at || new Date().toISOString(),
        certificadoSAT: datosTimbrado?.certificadoSAT || 'Certificado SAT no disponible',
        noCertificadoEmisor: datosTimbrado?.noCertificadoEmisor || 'No. Certificado no disponible',
        selloDigital: datosTimbrado?.selloDigital || 'Sello no disponible',
        selloSAT: datosTimbrado?.selloSAT || 'Sello SAT no disponible',
        cadenaOriginal: datosTimbrado?.cadenaOriginal || 'Cadena original no disponible'
      };

    return {
      isPreview: esPreview,
      isCreditNote: tipoComprobante === 'E',
      emisor: {
        rfc: emisorConfig?.rfc || process.env.RFC_EMISOR || 'APT100310EC2',
        nombre: emisorConfig?.razon_social || process.env.NOMBRE_EMISOR || 'ANDAMIOS Y PROYECTOS TORRES'
      },
      receptor: {
        rfc: nota.customer_rfc || 'XAXX010101000',
        nombre: nota.customer_name || nota.razon_social || 'CLIENTE',
        regimenFiscal: nota.tax_regime || '601',
        codigoPostal: nota.postal_code || '00000',
        usoCfdi: 'G02',
        direccion: 'DOMICILIO CONOCIDO',
        colonia: '',
        municipio: '',
        estado: ''
      },
      cfdiInfo,
      comprobante: {
        tipoComprobante,
        tipoComprobanteTexto: tipoComprobante === 'I' ? 'Ingreso' : 'Egreso',
        tituloPdf: tipoComprobante === 'I' ? 'Nota de Debito CFDI' : 'Nota de Credito CFDI',
        moneda: facturaOrigen?.moneda || 'MXN',
        tipoCambio: 1
      },
      relacionados: {
        tipoRelacion,
        descripcionTipoRelacion: descripcionTipoRelacion(tipoRelacion),
        uuid: uuidRelacionado,
        folioOrigen: facturaOrigen?.folio || ''
      },
      totales: {
        ...this.resolverTotalesParaPdf(nota, datosTimbrado),
        metodoPago: metodoPagoOrigen,
        formaPago: formaPagoOrigen
      },
      conceptos,
      factura: {
        hayDescuentos: false
      }
    };
  }

  async generarPdfTimbradoLocal(id) {
    const nota = await this.repositorio.obtenerPorId(id);
    if (!nota) {
      const error = new Error('Nota de credito no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    const respuestaTimbrado = await this.repositorio.obtenerRespuestaTimbrado(id);
    const datosTimbrado = respuestaTimbrado
      ? this.extraerDatosTimbradoDesdeRespuesta(respuestaTimbrado)
      : {
        uuidSat: nota.uuid,
        folio: nota.folio,
        fechaEmision: nota.stamped_at || new Date().toISOString(),
        fechaTimbrado: nota.stamped_at || new Date().toISOString(),
        selloDigital: 'Sello no disponible',
        selloSAT: 'Sello SAT no disponible',
        noCertificadoEmisor: 'No. Certificado no disponible',
        certificadoSAT: 'Certificado SAT no disponible',
        cadenaOriginal: 'Cadena original no disponible',
        totales: this.resolverTotalesParaPdf(nota, null)
      };

    const dataParaPdf = await this.construirDataParaPdf(nota, {
      isPreview: false,
      datosTimbrado
    });

    let ultimoError = null;
    try {
      const generado = await this.pdfService.generarPDFFactura(dataParaPdf);
      const buffer = this.normalizarBufferPdf(generado);
      if (buffer) return buffer;
      ultimoError = new Error(
        `PDF local invalido (tipo=${generado?.constructor?.name || typeof generado}, bytes=${generado?.length || 0})`
      );
    } catch (error) {
      ultimoError = error;
      console.error('[NotasCredito] Error generando PDF local timbrado:', {
        creditNoteId: id,
        message: error.message
      });
    }

    try {
      const bufferProveedor = await this.descargarPdfProveedor(nota);
      if (bufferProveedor) return bufferProveedor;
    } catch (error) {
      console.warn('[NotasCredito] Fallback PDF proveedor CFDI fallo:', error.message);
      if (!ultimoError) ultimoError = error;
    }

    const error = new Error('No se pudo generar el PDF local de la nota de credito.');
    error.statusCode = 502;
    error.detalles = ultimoError?.message || 'PDF vacio o corrupto';
    throw error;
  }

  async obtenerPdf(id, opciones = {}) {
    const nota = await this.repositorio.obtenerPorId(id);
    if (!nota) {
      const error = new Error('Nota de credito no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    const forzarPreview = opciones.forzarPreview === true;
    const esTimbrada = this.notaTieneCfdiTimbrado(nota);
    const uuidArchivo = String(nota.uuid || id).replace(/[^a-zA-Z0-9-]/g, '');

    if (!forzarPreview && esTimbrada) {
      const buffer = await this.generarPdfTimbradoLocal(id);
      return {
        buffer,
        esTimbrado: true,
        nombreArchivo: `nota-credito-${uuidArchivo}.pdf`
      };
    }

    const buffer = await this.generarPdfVistaPrevia(id);
    return {
      buffer,
      esTimbrado: false,
      nombreArchivo: `nota-credito-previa-${id}.pdf`
    };
  }

  /**
   * Descarga el XML timbrado de la nota de crédito.
   * Primero intenta desde disco (xml_path), luego desde el proveedor CFDI.
   * @param {string} id ID de la nota de crédito
   * @returns {Promise<{contenido: string, nombreArchivo: string}>}
   */
  async obtenerXml(id) {
    const nota = await this.repositorio.obtenerPorId(id);
    if (!nota) {
      const error = new Error('Nota de credito no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    if (!this.notaTieneCfdiTimbrado(nota)) {
      const error = new Error('La nota de crédito aún no ha sido timbrada.');
      error.statusCode = 409;
      throw error;
    }

    const uuidArchivo = String(nota.uuid || id).replace(/[^a-zA-Z0-9-]/g, '');
    const nombreArchivo = `nota-credito-${uuidArchivo}.xml`;

    // Intentar desde disco primero
    if (nota.xml_path) {
      try {
        const storageDir = this.obtenerDirectorioAlmacenPdf();
        const rutaCompleta = path.join(storageDir, nota.xml_path);
        if (fs.existsSync(rutaCompleta)) {
          const contenido = fs.readFileSync(rutaCompleta, 'utf8');
          if (contenido && contenido.trim().startsWith('<')) {
            return { contenido, nombreArchivo };
          }
        }
      } catch (errDisco) {
        console.warn('[NotasCredito] XML en disco no legible, intentando proveedor:', errDisco.message);
      }
    }

    // Fallback: descargar desde el proveedor CFDI
    const proveedor = this.obtenerProveedor(nota.provider || 'facturama');
    const ids = await this.obtenerIdsProveedorCfdi(nota);
    let ultimoError = null;

    for (const cfdiId of ids) {
      try {
        const xmlContent = await proveedor.obtenerXML(cfdiId);
        if (xmlContent && typeof xmlContent === 'string' && xmlContent.trim().startsWith('<')) {
          // Persistir en disco para próximas peticiones
          const nombreXmlDisco = nota.xml_path || `${uuidArchivo}.xml`;
          const guardado = this.guardarXmlEnDiscoDeFormaSegura(xmlContent, nombreXmlDisco);
          if (guardado && !nota.xml_path) {
            await this.repositorio.actualizarEstado(id, nota.status, { xml_path: guardado });
          }
          return { contenido: xmlContent, nombreArchivo };
        }
        ultimoError = new Error(`XML inválido para CFDI ${cfdiId}`);
      } catch (err) {
        ultimoError = err;
        console.warn('[NotasCredito] No se pudo obtener XML para ID:', cfdiId, err.mensaje || err.message || err);
      }
    }

    const error = new Error(
      ultimoError?.mensaje || ultimoError?.message || 'No se pudo obtener el XML timbrado desde el proveedor CFDI.'
    );
    error.statusCode = 502;
    throw error;
  }

  async generarPdfVistaPrevia(id) {
    const nota = await this.repositorio.obtenerPorId(id);
    if (!nota) {
      const error = new Error('Nota de credito no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    const dataParaPdf = await this.construirDataParaPdf(nota, { isPreview: true });
    try {
      const generado = await this.pdfService.generarPDFFactura(dataParaPdf);
      const buffer = this.normalizarBufferPdf(generado);
      if (buffer) return buffer;
    } catch (error) {
      console.error('[NotasCredito] Error generando vista previa PDF:', {
        creditNoteId: id,
        message: error.message
      });
      const err = new Error('No se pudo generar la vista previa PDF.');
      err.statusCode = 502;
      err.detalles = error.message;
      throw err;
    }

    const error = new Error('No se pudo generar la vista previa PDF.');
    error.statusCode = 502;
    error.detalles = 'PDF vacio o corrupto';
    throw error;
  }

  /**
   * Envía una nota de crédito por correo electrónico
   * @param {string} id ID de la nota de crédito
   * @param {Object} opciones { destinatario, mensaje, asunto, motivo }
   * @param {Object} usuario Usuario que realiza la acción
   * @returns {Promise<Object>}
   */
  async enviarPorEmail(id, opciones, usuario) {
    const { destinatario, mensaje, asunto, motivo } = opciones || {};

    // Validar input
    if (!destinatario || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(destinatario).trim())) {
      const error = new Error('Correo destinatario inválido.');
      error.statusCode = 400;
      throw error;
    }

    // Obtener la nota de crédito
    const nota = await this.repositorio.obtenerPorId(id);
    if (!nota) {
      const error = new Error('Nota de crédito no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    // Validar que esté timbrada
    if (nota.status !== 'TIMBRADA' && nota.status !== 'APLICADA' && nota.status !== 'PARCIAL') {
      const error = new Error('Solo se pueden enviar notas timbradas por correo electrónico.');
      error.statusCode = 400;
      throw error;
    }

    try {
      // Obtener rutas de PDF y XML
      let pdfPath = null;
      let xmlPath = null;

      if (nota.pdf_path) {
        const dirAlmacen = this.obtenerDirectorioAlmacenPdf();
        pdfPath = path.join(dirAlmacen, nota.pdf_path);
        if (!fs.existsSync(pdfPath)) {
          console.warn('[NotasCredito] PDF no encontrado en:', pdfPath);
          pdfPath = null;
        }
      }

      // Si el PDF no está o no existe, intentar generarlo bajo demanda
      if (!pdfPath) {
        try {
          const bufferPdf = await this.generarPdfTimbradoLocal(id);
          const uuidArchivo = String(nota.uuid || id).replace(/[^a-zA-Z0-9-]/g, '');
          const nombreArchivoPdf = `nota-credito-${uuidArchivo}.pdf`;
          const guardado = this.guardarPdfEnDiscoDeFormaSegura(bufferPdf, nombreArchivoPdf);
          if (guardado) {
            pdfPath = path.join(this.obtenerDirectorioAlmacenPdf(), guardado);
            // Si no tenía pdf_path guardado en DB, guardarlo
            if (!nota.pdf_path) {
              await this.repositorio.actualizarEstado(id, nota.status, { pdf_path: guardado });
            }
          }
        } catch (errPdf) {
          console.error('[NotasCredito] Error generando PDF bajo demanda para email:', errPdf.message);
        }
      }

      if (nota.xml_path) {
        const dirAlmacen = this.obtenerDirectorioAlmacenPdf();
        xmlPath = path.join(dirAlmacen, nota.xml_path);
        if (!fs.existsSync(xmlPath)) {
          console.warn('[NotasCredito] XML no encontrado en:', xmlPath);
          xmlPath = null;
        }
      }

      // Si el XML no está o no existe, intentar recuperarlo bajo demanda
      if (!xmlPath) {
        try {
          const { contenido } = await this.obtenerXml(id);
          if (contenido) {
            const uuidArchivo = String(nota.uuid || id).replace(/[^a-zA-Z0-9-]/g, '');
            const nombreArchivoXml = `nota-credito-${uuidArchivo}.xml`;
            const guardado = this.guardarXmlEnDiscoDeFormaSegura(contenido, nombreArchivoXml);
            if (guardado) {
              xmlPath = path.join(this.obtenerDirectorioAlmacenPdf(), guardado);
              // Si no tenía xml_path guardado en DB, guardarlo
              if (!nota.xml_path) {
                await this.repositorio.actualizarEstado(id, nota.status, { xml_path: guardado });
              }
            }
          }
        } catch (errXml) {
          console.error('[NotasCredito] Error recuperando XML bajo demanda para email:', errXml.message);
        }
      }

      // El PDF es obligatorio para enviar por correo electrónico
      if (!pdfPath || !fs.existsSync(pdfPath)) {
        const error = new Error('No se pudo generar o encontrar el archivo PDF para adjuntar al correo.');
        error.statusCode = 404;
        throw error;
      }

      // Construir asunto si no se proporciona
      const asuntoFinal = asunto || `Nota de Crédito CFDI - ${nota.uuid?.substring(0, 8).toUpperCase() || 'NC'}`;

      // Construir mensaje si no se proporciona
      let mensajeFinal = mensaje;
      if (!mensaje) {
        const tiposMotivo = {
          'DEVOLUCION': 'Adjunto encontrarás el comprobante fiscal de la devolución registrada conforme a tu factura.',
          'DESCUENTO': 'Adjunto encontrarás el comprobante fiscal del descuento aplicado. Por favor revísalo y guárdalo para tus registros fiscales.',
          'BONIFICACION': 'Adjunto encontrarás el comprobante fiscal de la bonificación registrada. Agradecemos tu preferencia.',
          'AJUSTE_ADMINISTRATIVO': 'Adjunto encontrarás el comprobante fiscal del ajuste administrativo realizado.',
          'CORRECCION_PARCIAL': 'Adjunto encontrarás el comprobante fiscal de la corrección parcial registrada.'
        };
        mensajeFinal = tiposMotivo[nota.reason || 'DESCUENTO'] || 
                       'Adjunto encontrarás el comprobante fiscal de nota de crédito registrado correctamente.';
      }

      // Obtener configuración SMTP del usuario si existe
      let smtpConfig = null;
      if (usuario && usuario.id_usuario) {
        const db = require('../../../../config/database');
        const smtpResult = await db.query(
          'SELECT host, puerto, usa_ssl, usuario, contrasena, correo_from FROM configuracion_smtp WHERE creado_por = $1 ORDER BY fecha_actualizacion DESC LIMIT 1',
          [usuario.id_usuario]
        );
        if (smtpResult.rows.length > 0) {
          smtpConfig = smtpResult.rows[0];
        }
      }

      // Enviar correo
      const resultado = await emailService.enviarFactura(
        destinatario,
        asuntoFinal,
        mensajeFinal,
        pdfPath,
        xmlPath,
        smtpConfig
      );

      // Registrar en auditoría
      const db = require('../../../../config/database');
      await db.query(
        `INSERT INTO audit_financial_events (evento, tabla, registro_id, usuario_id, detalles)
         VALUES ($1, $2, $3, $4, $5)`,
        ['ENVIAR_EMAIL_NC', 'credit_notes', null, usuario?.id_usuario || usuario?.id || null, 
         JSON.stringify({ destinatario, uuid: nota.uuid, credit_note_id: id })]
      );

      return {
        success: true,
        messageId: resultado.messageId,
        message: 'Nota de crédito enviada por correo electrónico.'
      };
    } catch (error) {
      console.error('[NotasCredito] Error enviando email:', error);
      if (!error.statusCode) {
        error.statusCode = 500;
      }
      throw error;
    }
  }
}

module.exports = ServicioNotasCredito;
