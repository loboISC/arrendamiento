const express = require('express');
const controlador = require('../controllers/credit-notes.controller');
const { authenticateToken } = require('../../../../middleware/auth');
const { validarSolicitudNotaCredito } = require('../middlewares/sat-validation');

const router = express.Router();

router.get('/invoices/search', authenticateToken, controlador.buscarFacturas);
router.get('/credit-notes', authenticateToken, controlador.listar);
router.get('/credit-notes/:id', authenticateToken, controlador.obtenerPorId);
router.post('/credit-notes', authenticateToken, validarSolicitudNotaCredito, controlador.crear);
router.post('/credit-notes/:id/stamp', authenticateToken, controlador.timbrar);
router.post('/credit-notes/:id/cancel', authenticateToken, controlador.cancelar);
router.post('/credit-notes/:id/apply', authenticateToken, controlador.aplicar);
router.post('/credit-notes/:id/apply-type', authenticateToken, controlador.aplicarConTipo);
router.get('/credit-notes/:id/pdf', authenticateToken, controlador.obtenerPdf);
router.get('/credit-notes/:id/xml', authenticateToken, controlador.obtenerXml);

module.exports = router;
