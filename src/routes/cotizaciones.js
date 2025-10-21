const express = require('express');
const router = express.Router();
const cotizacionesController = require('../controllers/cotizaciones');
const { authenticateToken } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);

// Obtener todas las cotizaciones
router.get('/', cotizacionesController.getCotizaciones);

// Obtener una cotización específica
router.get('/:id', cotizacionesController.getCotizacion);

// Crear nueva cotización
router.post('/', cotizacionesController.createCotizacion);

// Actualizar cotización
router.put('/:id', cotizacionesController.updateCotizacion);

// Eliminar cotización
router.delete('/:id', cotizacionesController.deleteCotizacion);

// Convertir cotización a contrato
router.post('/:id/convertir-contrato', cotizacionesController.convertirAContrato);

// NUEVAS RUTAS PARA FUNCIONALIDADES EXTENDIDAS

// Obtener historial de una cotización
router.get('/:id/historial', cotizacionesController.getHistorialCotizacion);

// Clonar una cotización existente
router.post('/:id/clonar', cotizacionesController.clonarCotizacion);

// Actualizar cotización con tracking de cambios
router.put('/:id/with-history', cotizacionesController.updateCotizacionWithHistory);

module.exports = router; 