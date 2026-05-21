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
    const { tipo_aplicacion } = req.body;
    if (!tipo_aplicacion) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tipo de aplicación requerido: APLICAR, SALDO_FAVOR o DEVOLUCION' 
      });
    }
    
    const resultado = await servicioAplicacion.procesarAplicacion(
      req.params.id,
      tipo_aplicacion,
      req.user?.id_usuario || req.user?.id || null
    );
    
    res.json({ success: true, data: resultado });
  } catch (error) {
    responderError(res, error);
  }
};

exports.obtenerPdf = async (req, res) => {
  try {
    const pdfBuffer = await servicio.generarPdfVistaPrevia(req.params.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=nota-credito-${req.params.id}.pdf`,
      'Content-Length': pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (error) {
    responderError(res, error);
  }
};

exports.obtenerXml = async (req, res) => {
  res.status(501).json({ success: false, error: 'Descarga XML de nota de credito pendiente de conectar con almacenamiento final.' });
};
