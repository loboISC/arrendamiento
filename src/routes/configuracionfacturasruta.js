// src/routes/configuracionfacturasruta.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadCSD');
const configuracionController = require('../controllers/configuracionFacturacionController');

// Obtener configuración actual
router.get('/', configuracionController.getConfiguracion);

// Guardar/actualizar configuración
router.post('/', upload.fields([
  { name: 'csd_cer', maxCount: 1 },
  { name: 'csd_key', maxCount: 1 }
]), configuracionController.saveConfiguracion);

// Probar CSD
router.post('/probar-csd', upload.fields([
  { name: 'csd_cer', maxCount: 1 },
  { name: 'csd_key', maxCount: 1 }
]), configuracionController.probarCSD);

module.exports = router;