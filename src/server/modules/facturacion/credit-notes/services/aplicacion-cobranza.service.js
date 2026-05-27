/**
 * Servicio para aplicación automática de notas de crédito a cobranza.
 * Gestiona: APLICAR, SALDO_FAVOR, DEVOLUCION
 */
const fs = require('fs');
const path = require('path');
const emailService = require('../../../../services/emailService');

let PDFDocument;
try {
  PDFDocument = require('pdfkit');
} catch (_) {
  PDFDocument = null;
}

function calcularDiasHabilesDevolucion(monto) {
  return Number(monto) <= 10000 ? 5 : 8;
}

function sumarDiasHabiles(fechaInicio, dias) {
  const fecha = new Date(fechaInicio);
  let agregados = 0;
  while (agregados < dias) {
    fecha.setDate(fecha.getDate() + 1);
    const dia = fecha.getDay();
    if (dia !== 0 && dia !== 6) agregados += 1;
  }
  return fecha;
}

function formatearFechaMx(fecha) {
  return new Date(fecha).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(Number(valor) || 0);
}

class ServicioAplicacionCobranzaNC {
  constructor(repositorio) {
    this.repositorio = repositorio;
  }

  obtenerDirectorioDevoluciones() {
    const base = process.env.PDF_STORAGE_DIR || path.join(process.cwd(), 'public', 'pdfs');
    return path.join(base, 'devoluciones');
  }

  async obtenerConfigSmtp(usuarioId) {
    if (!usuarioId) return null;
    const db = require('../../../../config/database');
    const smtpResult = await db.query(
      'SELECT host, puerto, usa_ssl, usuario, contrasena, correo_from FROM configuracion_smtp WHERE creado_por = $1 ORDER BY fecha_actualizacion DESC LIMIT 1',
      [usuarioId]
    );
    return smtpResult.rows[0] || null;
  }

  async generarPdfVoucherDevolucion(datos) {
    if (!PDFDocument) {
      const error = new Error('Generación de PDF no disponible en el servidor.');
      error.statusCode = 501;
      throw error;
    }

    const dir = this.obtenerDirectorioDevoluciones();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const folioArchivo = `devolucion-${datos.folio || datos.creditNoteId}-${Date.now()}.pdf`;
    const rutaCompleta = path.join(dir, folioArchivo);

    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
      const stream = fs.createWriteStream(rutaCompleta);
      doc.pipe(stream);

      doc.fontSize(18).fillColor('#1e40af').text('Comprobante de Devolución', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor('#64748b').text('Andamios Torres S.A. de C.V.', { align: 'center' });
      doc.moveDown(1.5);

      doc.fontSize(11).fillColor('#0f172a');
      const filas = [
        ['Folio de devolución:', datos.folio || 'N/A'],
        ['Cliente:', datos.cliente || 'N/A'],
        ['RFC:', datos.rfc || 'N/A'],
        ['Monto a devolver:', formatearMoneda(datos.monto)],
        ['Fecha de solicitud:', formatearFechaMx(datos.fechaSolicitud)],
        ['Fecha estimada de pago:', formatearFechaMx(datos.fechaEstimada)],
        ['Plazo:', `${datos.diasHabiles} días hábiles`],
        ['Nota de crédito:', datos.ncRef || 'N/A'],
        ['Motivo:', datos.motivo || 'Devolución por nota de crédito'],
        ['Estado:', 'PENDIENTE']
      ];

      filas.forEach(([etiqueta, valor]) => {
        doc.font('Helvetica-Bold').text(etiqueta, { continued: true });
        doc.font('Helvetica').text(` ${valor}`);
      });

      doc.moveDown(1.5);
      doc.fontSize(9).fillColor('#64748b').text(
        'Este comprobante acredita la solicitud de devolución de efectivo derivada de la nota de crédito indicada. ' +
        'El pago se realizará en el plazo estimado conforme a las políticas internas de la empresa.',
        { align: 'justify' }
      );

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return {
      pdf_path: rutaCompleta,
      pdf_filename: folioArchivo
    };
  }

  /**
   * Aplicar automáticamente: reduce saldo pendiente de factura relacionada
   */
  async aplicarAutomaticamente(creditNoteId, usuarioId) {
    const nota = await this.repositorio.obtenerPorId(creditNoteId);
    if (!nota) {
      const error = new Error('Nota de crédito no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    const movimiento = {
      id_cliente: nota.customer_id,
      fecha: new Date(),
      tipo_mov: 'ABONO',
      descripcion: `Aplicación automática de NC ${nota.folio || nota.uuid || nota.id} sobre factura ${nota.id_factura_origen}`,
      referencia_tipo: 'credit_note',
      referencia_id: nota.id,
      abono: nota.total,
      usuario_id: usuarioId || null
    };

    await this.repositorio.registrarMovimientoCobranza(movimiento);

    await this.repositorio.actualizarEstado(creditNoteId, 'APLICADA', {
      sat_status: 'VIGENTE',
      aplicacion_tipo: 'AUTOMATICA'
    });

    return {
      tipo_aplicacion: 'AUTOMATICA',
      mensaje: `Nota de crédito aplicada automáticamente como abono. Saldo del cliente reducido en ${nota.total}`,
      movimiento_id: nota.id
    };
  }

  /**
   * Dejar como saldo a favor: incrementa limite_credito del cliente
   */
  async dejarComoSaldoFavor(creditNoteId, usuarioId) {
    const nota = await this.repositorio.obtenerPorId(creditNoteId);
    if (!nota) {
      const error = new Error('Nota de crédito no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    const nuevoLimite = await this.repositorio.incrementarLimiteCredito(nota.customer_id, nota.total);

    const movimiento = {
      id_cliente: nota.customer_id,
      fecha: new Date(),
      tipo_mov: 'SALDO_FAVOR',
      descripcion: `Saldo a favor por NC ${nota.folio || nota.uuid || nota.id}. Monto agregado al límite de crédito.`,
      referencia_tipo: 'credit_note',
      referencia_id: nota.id,
      abono: nota.total,
      usuario_id: usuarioId || null,
      notas: `Límite de crédito incrementado en ${nota.total}. Nuevo límite: ${nuevoLimite}.`
    };

    await this.repositorio.registrarMovimientoCobranza(movimiento);

    await this.repositorio.actualizarEstado(creditNoteId, 'PARCIAL', {
      sat_status: 'VIGENTE',
      aplicacion_tipo: 'SALDO_FAVOR'
    });

    return {
      tipo_aplicacion: 'SALDO_FAVOR',
      mensaje: `Se agregaron ${formatearMoneda(nota.total)} al límite de crédito del cliente. Nuevo límite: ${formatearMoneda(nuevoLimite)}.`,
      movimiento_id: nota.id,
      saldo_disponible: nota.total,
      nuevo_limite_credito: nuevoLimite
    };
  }

  /**
   * Generar devolución: voucher PDF, ledger y correo al destinatario
   */
  async generarDevolucion(creditNoteId, usuarioId, emailDestinatario) {
    const nota = await this.repositorio.obtenerPorId(creditNoteId);
    if (!nota) {
      const error = new Error('Nota de crédito no encontrada.');
      error.statusCode = 404;
      throw error;
    }

    const diasHabiles = calcularDiasHabilesDevolucion(nota.total);
    const fechaSolicitud = new Date();
    const fechaEstimada = sumarDiasHabiles(fechaSolicitud, diasHabiles);
    const folioDevolucion = `DEV-${String(nota.folio || nota.id).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 20)}-${Date.now().toString().slice(-6)}`;

    const pdfInfo = await this.generarPdfVoucherDevolucion({
      creditNoteId,
      folio: folioDevolucion,
      cliente: nota.customer_name || nota.razon_social || 'Cliente',
      rfc: nota.customer_rfc || '',
      monto: nota.total,
      fechaSolicitud,
      fechaEstimada,
      diasHabiles,
      ncRef: nota.folio || nota.uuid || nota.id,
      motivo: nota.reason || 'Devolución por nota de crédito'
    });

    const movimiento = {
      id_cliente: nota.customer_id,
      fecha: fechaSolicitud,
      tipo_mov: 'DEVOLUCION',
      descripcion: `Devolución de efectivo por NC ${nota.folio || nota.uuid || nota.id}. Folio: ${folioDevolucion}`,
      referencia_tipo: 'credit_note_devolucion',
      referencia_id: nota.id,
      abono: nota.total,
      usuario_id: usuarioId || null,
      estado_devolucion: 'PENDIENTE',
      notas: `Fecha estimada: ${formatearFechaMx(fechaEstimada)} (${diasHabiles} días hábiles). PDF: ${pdfInfo.pdf_filename}`
    };

    const movimientoId = await this.repositorio.registrarMovimientoCobranza(movimiento);

    await this.repositorio.actualizarEstado(creditNoteId, 'APLICADA', {
      sat_status: 'VIGENTE',
      aplicacion_tipo: 'DEVOLUCION',
      notas: `Devolución ${folioDevolucion}. Movimiento ID: ${movimientoId}`
    });

    let destinatario = String(emailDestinatario || '').trim();
    if (!destinatario) {
      destinatario = await this.repositorio.obtenerEmailCliente(nota.customer_id);
    }

    let emailEnviado = false;
    if (destinatario && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destinatario)) {
      try {
        const smtpConfig = await this.obtenerConfigSmtp(usuarioId);
        const contenidoHtml = `
          <p>Estimado cliente,</p>
          <p>Se ha registrado su solicitud de devolución derivada de la nota de crédito <strong>${nota.folio || nota.uuid || nota.id}</strong>.</p>
          <p><strong>Monto:</strong> ${formatearMoneda(nota.total)}<br>
          <strong>Fecha estimada de pago:</strong> ${formatearFechaMx(fechaEstimada)} (${diasHabiles} días hábiles)</p>
          <p>Adjunto encontrará el comprobante de devolución para su control.</p>
        `;
        await emailService.enviarComprobanteAbono(
          destinatario,
          `Comprobante de Devolución - ${folioDevolucion}`,
          contenidoHtml,
          pdfInfo.pdf_path,
          pdfInfo.pdf_filename,
          smtpConfig
        );
        emailEnviado = true;
      } catch (errEmail) {
        console.error('[AplicacionCobranzaNC] Error enviando comprobante de devolución:', errEmail.message);
      }
    }

    return {
      tipo_aplicacion: 'DEVOLUCION',
      mensaje: `Devolución generada. Pago estimado para ${formatearFechaMx(fechaEstimada)} (${diasHabiles} días hábiles).`,
      movimiento_id: movimientoId,
      estado: 'PENDIENTE',
      monto_devolucion: nota.total,
      folio_devolucion: folioDevolucion,
      fecha_estimada: fechaEstimada.toISOString(),
      dias_habiles: diasHabiles,
      pdf_path: pdfInfo.pdf_path,
      email_enviado: emailEnviado
    };
  }

  /**
   * Procesar aplicación según tipo seleccionado
   */
  async procesarAplicacion(creditNoteId, tipoAplicacion, usuarioId, emailDestinatario) {
    switch (String(tipoAplicacion).toUpperCase()) {
      case 'APLICAR':
      case 'AUTOMATICA':
        return this.aplicarAutomaticamente(creditNoteId, usuarioId);

      case 'SALDO_FAVOR':
        return this.dejarComoSaldoFavor(creditNoteId, usuarioId);

      case 'DEVOLUCION':
        return this.generarDevolucion(creditNoteId, usuarioId, emailDestinatario);

      default: {
        const error = new Error(`Tipo de aplicación inválido: ${tipoAplicacion}`);
        error.statusCode = 400;
        throw error;
      }
    }
  }
}

module.exports = ServicioAplicacionCobranzaNC;
