const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  crearEncuesta,
  obtenerEncuestas,
  obtenerEncuestaPorId,
  guardarRespuesta,
  obtenerEstadisticasEncuestas,
  obtenerRespuestasEncuesta,
  actualizarEstadoEncuesta
} = require('../controllers/encuestas');

// Rutas protegidas (requieren autenticación)
router.post('/', authenticateToken, crearEncuesta);
router.get('/', authenticateToken, obtenerEncuestas);
router.get('/estadisticas', authenticateToken, obtenerEstadisticasEncuestas);
router.get('/:id', authenticateToken, obtenerEncuestaPorId);
router.get('/:id/respuestas', authenticateToken, obtenerRespuestasEncuesta);
router.put('/:id/estado', authenticateToken, actualizarEstadoEncuesta);

// Ruta pública para guardar respuestas (no requiere autenticación)
router.post('/:id/respuesta', guardarRespuesta);

module.exports = router;
