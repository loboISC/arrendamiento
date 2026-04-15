const express = require('express');
const router = express.Router();
const logisticaController = require('../controllers/logistica');
const { authenticateToken } = require('../middleware/auth');

// Rutas de Vehiculos
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
router.get('/historial', authenticateToken, logisticaController.obtenerHistorialEntregas);
router.post('/asignaciones', authenticateToken, logisticaController.crearAsignacion);
router.post('/asignaciones/automatica', authenticateToken, logisticaController.asignacionAutomatica);
router.get('/asignaciones/:id', authenticateToken, logisticaController.obtenerAsignacionDetalle);
router.get('/asignaciones/:asignacionId/seguimiento', authenticateToken, logisticaController.obtenerSeguimiento);
router.put('/asignaciones/:id', authenticateToken, logisticaController.actualizarAsignacion);
router.post('/asignaciones/:id/completar', authenticateToken, logisticaController.completarAsignacionEvidencia);
router.post('/asignaciones/:id/fallido', authenticateToken, logisticaController.marcarAsignacionFallida);
router.post('/asignaciones/:id/iniciar-ruta', authenticateToken, logisticaController.iniciarRuta);
router.post('/asignaciones/:id/generar-qr', authenticateToken, logisticaController.generarTokenQRPublico);

// Rutas Push Notifications
router.get('/push/vapid-public-key', authenticateToken, logisticaController.obtenerVapidPublicKey);
router.post('/push/suscripciones', authenticateToken, logisticaController.guardarSuscripcionPush);
router.delete('/push/suscripciones', authenticateToken, logisticaController.desactivarSuscripcionPush);

// Rutas de Seguimiento Publico (sin autenticacion)
router.get('/seguimiento-publico', logisticaController.obtenerSeguimientoPublico);

// Rutas de Tracking
router.post('/tracking', authenticateToken, logisticaController.registrarTracking);
router.get('/tracking/activos', authenticateToken, logisticaController.obtenerTrackingsActivos);

// Dashboard
router.get('/dashboard', authenticateToken, logisticaController.obtenerDashboardLogistica);

module.exports = router;
