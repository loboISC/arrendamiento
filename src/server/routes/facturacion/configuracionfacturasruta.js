// src/routes/facturacion/configuracionfacturasruta.js
const express = require('express');
const router = express.Router();
const upload = require('../../middleware/uploadCSD');
const configuracionFacturasController = require('../../controllers/facturacion/configuracionfacturascontrolador'); // <--- asegúrate que el nombre y ruta coincidan exactamente


// Obtener configuración actual
router.get('/emisor', configuracionFacturasController.obtenerConfiguracion);

// Guardar/actualizar configuración del emisor (sin archivos)
router.post('/emisor', configuracionFacturasController.guardarConfiguracion);

// Guardar/actualizar configuración con archivos CSD
router.post('/csd-upload', upload.fields([
  { name: 'csd_cer', maxCount: 1 },
  { name: 'csd_key', maxCount: 1 }
]), configuracionFacturasController.guardarConfiguracion);

// Ruta alternativa para CSD (mantener compatibilidad)
router.post('/', upload.fields([
  { name: 'csd_cer', maxCount: 1 },
  { name: 'csd_key', maxCount: 1 }
]), configuracionFacturasController.guardarConfiguracion);

// Probar CSD
router.post('/probar-csd', upload.fields([
  { name: 'csd_cer', maxCount: 1 },
  { name: 'csd_key', maxCount: 1 }
]), configuracionFacturasController.probarCSD);

module.exports = router;

