const express = require('express');
const router = express.Router();
const facturacionController = require('../controllers/facturacion');
const { authenticateToken } = require('../middleware/auth');
const roles = require('../middleware/roles');

// Obtener todas las facturas
router.get('/', authenticateToken, facturacionController.getFacturas);

// Timbrar nueva factura
router.post('/timbrar', authenticateToken, facturacionController.timbrarFactura);

// Cancelar factura
router.post('/:uuid/cancelar', facturacionController.cancelarFactura);

// Descargar PDF de factura
router.get('/:uuid/pdf', authenticateToken, facturacionController.descargarPDF);

// Obtener factura por UUID
router.get('/:uuid', facturacionController.getFacturaByUuid);

// Enviar factura por email
router.post('/:uuid/enviar-email', authenticateToken, facturacionController.enviarFacturaPorEmail);

// Buscar documento o equipo para timbrado
router.get('/search-document/:query', facturacionController.searchDocumentByFolio);

// Buscar conceptos (productos, servicios, cotizaciones) para modal
router.get('/search-concepts/:query', facturacionController.searchConcepts);

// --- Notas de crédito ---
// recuperar saldo elegible para nota de crédito
router.get('/eligible-credit-balance/:facturaId', authenticateToken, facturacionController.getEligibleCreditBalance);
// timbrado de nota de crédito (flujo separado)
router.post('/credit-notes/timbrar', authenticateToken, roles(['nc.create', 'Admin', 'Director General']), facturacionController.timbrarNotaCredito);
// listado y detalles de notas de crédito
router.get('/credit-notes', authenticateToken, facturacionController.getCreditNotes);
router.get('/credit-notes/:id', authenticateToken, facturacionController.getCreditNoteById);
// acciones sobre nota de crédito
router.post('/credit-notes/:id/cancelar', authenticateToken, roles(['nc.cancel', 'Admin']), facturacionController.cancelarNotaCredito);
router.post('/credit-notes/:id/aprobar', authenticateToken, roles(['nc.approve', 'Admin']), facturacionController.aprobarNotaCredito);

module.exports = router;

