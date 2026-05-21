const RepositorioNotasCredito = require('../repositories/credit-notes.repository');
const ServicioCalculadoraImpuestos = require('./tax-calculator.service');
const ServicioValidadorSAT = require('./sat-validator.service');
const ServicioSaldoAcreditable = require('./balance.service');
const ProveedorFacturama = require('../../../../services/facturacion/providers/facturama.provider');
const ProveedorAPIFiscal = require('../../../../services/facturacion/providers/apifiscal.provider');
const PDFService = require('../../../../services/pdfService');

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

  async prepararFactura(invoiceId) {
    const saldoFactura = await this.saldo.obtenerSaldoFactura(invoiceId);
    if (!saldoFactura) return null;
    const conceptos = await this.repositorio.obtenerConceptosFactura(invoiceId);
    return { ...saldoFactura, conceptos };
  }

  async crearBorrador(payload, usuario) {
    const invoiceId = payload.invoice_id || payload.factura_id;
    const preparacion = await this.prepararFactura(invoiceId);
    if (!preparacion) {
      const error = new Error('Factura origen no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    const conceptosEntrada = Array.isArray(payload.items) ? payload.items : [];
    const totales = this.calculadora.calcularTotales(conceptosEntrada);
    const validacion = this.validadorSAT.validarBorrador({
      facturaOrigen: preparacion.factura,
      motivo: payload.reason,
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

    return this.repositorio.crearBorrador({
      invoice_id: preparacion.factura.invoice_id,
      customer_id: preparacion.factura.customer_id,
      invoice_uuid: preparacion.factura.uuid,
      folio: payload.folio || `NC-${Date.now()}`,
      relation_type: payload.relation_type || payload.tipo_relacion || '01',
      reason: payload.reason,
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
    });
  }

  construirPayloadTimbrado(nota) {
    const receptor = {
      Rfc: nota.customer_rfc,
      Name: nota.customer_name || nota.razon_social,
      CfdiUse: 'G02',
      FiscalRegime: nota.tax_regime,
      TaxZipCode: nota.postal_code
    };

    return {
      CfdiType: 'E',
      NameId: '1',
      ExpeditionPlace: process.env.FACTURAMA_EXPEDITION_PLACE || process.env.CODIGO_POSTAL_EMISOR || '00000',
      PaymentForm: '99',
      PaymentMethod: 'PUE',
      Receiver: receptor,
      Relations: [{
        Type: nota.relation_type || '01',
        Cfdis: (nota.relaciones || []).length > 0
          ? (nota.relaciones || []).map((relacion) => ({ Uuid: relacion.invoice_uuid }))
          : [{ Uuid: nota.invoice_uuid_origen }]
      }],
      Items: (nota.items || []).map((item) => ({
        ProductCode: item.sat_product_key || '01010101',
        IdentificationNumber: item.product_id ? String(item.product_id) : undefined,
        Description: item.description,
        Unit: item.sat_unit_key || 'ACT',
        UnitCode: item.sat_unit_key || 'ACT',
        UnitPrice: Number(item.unit_price || 0),
        Quantity: Number(item.quantity || 0),
        Subtotal: Number(Number(item.quantity || 0) * Number(item.unit_price || 0)).toFixed(2),
        Discount: Number(item.discount || 0),
        TaxObject: '02',
        Taxes: [{
          Name: 'IVA',
          Rate: 0.16,
          Total: Number(item.tax || 0),
          Base: Number(Number(item.total || 0) - Number(item.tax || 0)).toFixed(2),
          IsRetention: false
        }],
        Total: Number(item.total || 0)
      }))
    };
  }

  async timbrar(id, usuario) {
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

    await this.repositorio.actualizarEstado(id, 'TIMBRANDO');
    const proveedor = this.obtenerProveedor(nota.provider);
    const payloadTimbrado = this.construirPayloadTimbrado(nota);
    await this.repositorio.registrarLog(id, 'REQUEST_TIMBRADO', {
      request: payloadTimbrado,
      user_id: usuario?.id_usuario || usuario?.id || null
    });

    try {
      const respuesta = await proveedor.crearNotaCredito(payloadTimbrado);
      const uuid = respuesta.Complement?.TaxStamp?.Uuid || respuesta.Id || respuesta.uuid || null;
      await this.repositorio.registrarLog(id, 'RESPONSE_TIMBRADO', {
        response: respuesta,
        user_id: usuario?.id_usuario || usuario?.id || null
      });
      return this.repositorio.actualizarEstado(id, 'TIMBRADA', {
        sat_status: 'VIGENTE',
        uuid,
        stamped_at: new Date()
      });
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

  async generarPdfVistaPrevia(id) {
    const nota = await this.repositorio.obtenerPorId(id);
    if (!nota) {
      const error = new Error('Nota de credito no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    const facturaOrigen = await this.repositorio.obtenerFacturaPorId(nota.id_factura_origen);
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

    const dataParaPdf = {
      isPreview: true,
      emisor: {
        rfc: process.env.RFC_EMISOR || 'APT100310EC2',
        nombre: process.env.NOMBRE_EMISOR || 'ANDAMIOS Y PROYECTOS TORRES'
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
      cfdiInfo: {
        uuid: nota.uuid && !String(nota.uuid).startsWith('BORRADOR') ? nota.uuid : 'VISTA-PREVIA-NOTA-CREDITO',
        folio: nota.folio || `NC-${nota.id}`,
        fechaEmision: new Date().toISOString(),
        fechaTimbrado: 'PROCESO DE VISTA PREVIA',
        certificadoSAT: '00000000000000000000',
        noCertificadoEmisor: '00000000000000000000',
        selloDigital: 'VISTA_PREVIA_SIN_VALIDEZ',
        selloSAT: 'VISTA_PREVIA_SIN_VALIDEZ',
        cadenaOriginal: 'VISTA_PREVIA_SIN_VALIDEZ'
      },
      comprobante: {
        tipoComprobante: 'E',
        tipoComprobanteTexto: 'Egreso',
        tituloPdf: 'Nota de Credito CFDI',
        moneda: 'MXN',
        tipoCambio: 1
      },
      relacionados: {
        tipoRelacion: nota.relation_type || nota.tipo_relacion || '01',
        descripcionTipoRelacion: 'Nota de credito de los documentos relacionados',
        uuid: nota.invoice_uuid_origen || facturaOrigen?.uuid || 'PENDIENTE'
      },
      totales: {
        subtotal: Number(nota.subtotal || 0),
        descuento: 0,
        iva: Number(nota.tax || nota.impuestos || 0),
        total: Number(nota.total || 0),
        metodoPago: 'PUE',
        formaPago: '99'
      },
      conceptos,
      observaciones: `CFDI relacionado: ${facturaOrigen?.folio || ''} | UUID: ${facturaOrigen?.uuid || nota.invoice_uuid_origen || ''}`,
      factura: {
        notas_internas: `Motivo de egreso: ${nota.reason || nota.motivo_sat || 'NC'} | TipoRelacion: ${nota.relation_type || '01'}`,
        hayDescuentos: false
      }
    };

    return this.pdfService.generarPDFFactura(dataParaPdf);
  }
}

module.exports = ServicioNotasCredito;
