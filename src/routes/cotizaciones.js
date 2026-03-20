const express = require('express');
const router = express.Router();
const cotizacionesController = require('../controllers/cotizaciones');
const { authenticateToken } = require('../middleware/auth');

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateToken);

// Obtener siguiente número de cotización (debe ir ANTES de '/:id' para evitar conflictos)
router.get('/siguiente-numero', cotizacionesController.getSiguienteNumero);

// Obtener todas las cotizaciones
router.get('/', cotizacionesController.getCotizaciones);

// KPIs de ventas (calculados en backend)
router.get('/ventas-kpis', cotizacionesController.getVentasKPIs);

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

// Ruta para generar folio de nota
router.post('/:id/generar-folio-nota', cotizacionesController.generarFolioNota);

// Aplicar crédito del cliente a una cotización
router.post('/:id/aplicar-credito', cotizacionesController.aplicarCreditoCotizacion);

module.exports = router;
