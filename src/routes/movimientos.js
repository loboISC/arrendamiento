const express = require('express');
const router = express.Router();
const movimientosController = require('../controllers/movimientos');
const auth = require('../middleware/auth');

router.get('/', auth, movimientosController.getAll);
router.post('/', movimientosController.create);
router.put('/:id', auth, movimientosController.update);
router.delete('/:id', auth, movimientosController.delete);

module.exports = router;

