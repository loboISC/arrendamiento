const express = require('express');
const router = express.Router();
const movimientosController = require('../controllers/movimientos');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, movimientosController.getAll);
router.post('/', movimientosController.create);
router.put('/:id', authenticateToken, movimientosController.update);
router.delete('/:id', authenticateToken, movimientosController.delete);

module.exports = router;

