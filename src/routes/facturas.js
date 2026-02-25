const express = require('express');
const router = express.Router();
const facturacionController = require('../controllers/facturacion');
const { authenticateToken } = require('../middleware/auth');

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
router.post('/:uuid/enviar-email', facturacionController.enviarFacturaPorEmail);

// Buscar documento o equipo para timbrado
router.get('/search-document/:query', facturacionController.searchDocumentByFolio);

// Buscar conceptos (productos, servicios, cotizaciones) para modal
router.get('/search-concepts/:query', facturacionController.searchConcepts);

module.exports = router;

