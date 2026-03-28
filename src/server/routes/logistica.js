const express = require('express');
const router = express.Router();
const logisticaController = require('../controllers/logistica');
const { authenticateToken } = require('../middleware/auth');

// Rutas de Vehículos
router.get('/vehiculos', authenticateToken, logisticaController.obtenerVehiculos);
router.get('/vehiculos/:id', authenticateToken, logisticaController.obtenerVehiculoPorId);
router.post('/vehiculos', authenticateToken, logisticaController.crearVehiculo);

// Rutas de Documentos
router.get('/documentos/vencidos', authenticateToken, logisticaController.obtenerDocumentosVencidos);
router.post('/documentos', authenticateToken, logisticaController.agregarDocumento);

// Rutas de Mantenimientos
router.get('/historial-mantenimientos', authenticateToken, logisticaController.obtenerTodosMantenimientos);
router.get('/mantenimientos/:vehiculo_id', authenticateToken, logisticaController.obtenerMantenimientos);
router.post('/mantenimientos', authenticateToken, logisticaController.crearMantenimiento);

// Rutas de Choferes
router.get('/choferes/disponibles', authenticateToken, logisticaController.obtenerChoferesDisponibles);

// Rutas de Asignaciones
router.post('/asignaciones', authenticateToken, logisticaController.crearAsignacion);
router.post('/asignaciones/automatica', authenticateToken, logisticaController.asignacionAutomatica);
router.get('/asignaciones/:id', authenticateToken, logisticaController.obtenerAsignacionDetalle);

// Rutas de Tracking
router.post('/tracking', authenticateToken, logisticaController.registrarTracking);

// Dashboard Dashboard
router.get('/dashboard', authenticateToken, logisticaController.obtenerDashboardLogistica);

module.exports = router;
