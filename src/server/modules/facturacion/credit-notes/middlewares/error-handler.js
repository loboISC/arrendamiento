/**
 * Manejador de errores del modulo fiscal.
 */
function manejadorErroresNotasCredito(error, req, res, next) {
  if (res.headersSent) return next(error);
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Error interno en notas de credito.',
    detalles: error.detalles || undefined
  });
}

module.exports = manejadorErroresNotasCredito;
