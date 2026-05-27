const ServicioNotasCredito = require('../services/credit-notes.service');
const ServicioAplicacionCobranzaNC = require('../services/aplicacion-cobranza.service');
const RepositorioNotasCredito = require('../repositories/credit-notes.repository');

const servicio = new ServicioNotasCredito();
const repositorio = new RepositorioNotasCredito();
const servicioAplicacion = new ServicioAplicacionCobranzaNC(repositorio);

function responderError(res, error) {
  const codigo = error.statusCode || 500;
  res.status(codigo).json({
    success: false,
    error: error.message || 'Error interno del modulo de notas de credito.',
    detalles: error.detalles || undefined
  });
}

exports.buscarFacturas = async (req, res) => {
  try {
    const data = await servicio.buscarFacturas(req.query);
    res.json({ success: true, data });
  } catch (error) {
    responderError(res, error);
  }
};

exports.listar = async (req, res) => {
  try {
    const data = await servicio.listar(req.query);
    res.json({ success: true, data });
  } catch (error) {
    responderError(res, error);
  }
};

exports.obtenerPorId = async (req, res) => {
  try {
    const data = await servicio.obtenerPorId(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Nota de credito no encontrada.' });
    res.json({ success: true, data });
  } catch (error) {
    responderError(res, error);
  }
};

exports.crear = async (req, res) => {
  try {
    const data = await servicio.crearBorrador(req.body, req.user);
    res.status(201).json({ success: true, data });
  } catch (error) {
    responderError(res, error);
  }
};

exports.timbrar = async (req, res) => {
  try {
    const data = await servicio.timbrar(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (error) {
    responderError(res, error);
  }
};

exports.cancelar = async (req, res) => {
  try {
    const data = await servicio.cancelar(req.params.id, req.body?.motivo, req.user);
    res.json({ success: true, data });
  } catch (error) {
    responderError(res, error);
  }
};

exports.aplicar = async (req, res) => {
  try {
    const data = await servicio.aplicar(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (error) {
    responderError(res, error);
  }
};

exports.aplicarConTipo = async (req, res) => {
  try {
    const { tipo_aplicacion, email_destinatario } = req.body;
    if (!tipo_aplicacion) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tipo de aplicación requerido: APLICAR, SALDO_FAVOR o DEVOLUCION' 
      });
    }
    
    const resultado = await servicioAplicacion.procesarAplicacion(
      req.params.id,
      tipo_aplicacion,
      req.user?.id_usuario || req.user?.id || null,
      email_destinatario
    );
    
    res.json({ success: true, data: resultado });
  } catch (error) {
    responderError(res, error);
  }
};

exports.obtenerPdf = async (req, res) => {
  try {
    const forzarPreview = String(req.query.preview || '').toLowerCase() === 'true';
    const descarga = String(req.query.download || '').toLowerCase() === 'true';
    const { buffer: pdfBuffer, nombreArchivo } = await servicio.obtenerPdf(req.params.id, { forzarPreview });
    const buffer = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer || []);

    if (!buffer.length || buffer.subarray(0, 4).toString() !== '%PDF') {
      console.error('[NotasCredito] PDF invalido o vacio', {
        creditNoteId: req.params.id,
        bytes: buffer.length,
        preview: buffer.subarray(0, 48).toString('utf8')
      });
      return res.status(502).json({
        success: false,
        error: 'No se pudo generar un PDF valido para esta nota de credito.',
        detalles: `bytes=${buffer.length}, cabecera=${buffer.subarray(0, 16).toString('utf8')}`
      });
    }

    const disposition = descarga ? 'attachment' : 'inline';

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${nombreArchivo}"`,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.send(buffer);
  } catch (error) {
    console.error('[NotasCredito] obtenerPdf', {
      creditNoteId: req.params.id,
      statusCode: error.statusCode,
      message: error.message,
      detalles: error.detalles
    });
    const codigo = error.statusCode || 500;
    const esErrorPdf = codigo === 502
      || /pdf/i.test(String(error.message || ''));
    if (esErrorPdf) {
      return res.status(502).json({
        success: false,
        error: error.message || 'No se pudo generar el PDF de la nota de credito.',
        detalles: error.detalles || error.cause?.message || undefined
      });
    }
    responderError(res, error);
  }
};

exports.obtenerXml = async (req, res) => {
  try {
    const { contenido, nombreArchivo } = await servicio.obtenerXml(req.params.id);
    res.set({
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Content-Length': Buffer.byteLength(contenido, 'utf8'),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.send(contenido);
  } catch (error) {
    console.error('[NotasCredito] obtenerXml', {
      creditNoteId: req.params.id,
      statusCode: error.statusCode,
      message: error.message
    });
    responderError(res, error);
  }
};

exports.enviarEmail = async (req, res) => {
  try {
    const { destinatario, mensaje, asunto, motivo } = req.body || {};
    if (!destinatario || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(destinatario).trim())) {
      return res.status(400).json({ success: false, error: 'Correo destinatario inválido.' });
    }

    const data = await servicio.enviarPorEmail(
      req.params.id,
      {
        destinatario: String(destinatario).trim(),
        mensaje,
        asunto,
        motivo
      },
      req.user
    );
    res.json({ success: true, data, message: 'Nota de crédito enviada por correo electrónico.' });
  } catch (error) {
    responderError(res, error);
  }
};
