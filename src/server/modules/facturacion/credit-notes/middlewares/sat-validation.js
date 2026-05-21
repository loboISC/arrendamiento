/**
 * Middleware ligero para validar campos minimos antes de entrar al servicio fiscal.
 */
function validarSolicitudNotaCredito(req, res, next) {
  const errores = [];
  if (!req.body.invoice_id && !req.body.factura_id) errores.push('invoice_id es obligatorio.');
  if (!req.body.reason) errores.push('reason es obligatorio.');
  if (!Array.isArray(req.body.items) || req.body.items.length === 0) errores.push('items debe incluir conceptos.');

  if (errores.length > 0) {
    return res.status(400).json({ success: false, error: errores.join(' ') });
  }
  next();
}

module.exports = { validarSolicitudNotaCredito };
