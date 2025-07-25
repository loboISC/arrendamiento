const express = require('express');
const router = express.Router();
const facturacionController = require('../controllers/facturacion');

// Timbrar nueva factura
router.post('/timbrar', facturacionController.timbrarFactura);

// Cancelar factura
router.post('/cancelar', facturacionController.cancelarFactura);

// Obtener factura por UUID
router.get('/:uuid', facturacionController.getFacturaByUuid);

module.exports = router;

