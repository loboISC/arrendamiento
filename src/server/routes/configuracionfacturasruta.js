// src/routes/configuracionfacturasruta.js
const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadCSD');
const configuracionFacturasController = require('../controllers/configuracionfacturascontrolador'); // <--- asegúrate que el nombre y ruta coincidan exactamente


// Obtener configuración actual
router.get('/emisor', configuracionFacturasController.getConfiguracion);

// Guardar/actualizar configuración del emisor (sin archivos)
router.post('/emisor', configuracionFacturasController.saveConfiguracion);

// Guardar/actualizar configuración con archivos CSD
router.post('/csd-upload', upload.fields([
  { name: 'csd_cer', maxCount: 1 },
  { name: 'csd_key', maxCount: 1 }
]), configuracionFacturasController.saveConfiguracion);

// Ruta alternativa para CSD (mantener compatibilidad)
router.post('/', upload.fields([
  { name: 'csd_cer', maxCount: 1 },
  { name: 'csd_key', maxCount: 1 }
]), configuracionFacturasController.saveConfiguracion);

// Probar CSD
router.post('/probar-csd', upload.fields([
  { name: 'csd_cer', maxCount: 1 },
  { name: 'csd_key', maxCount: 1 }
]), configuracionFacturasController.probarCSD);

module.exports = router;

