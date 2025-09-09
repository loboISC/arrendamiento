const express = require('express');
const router = express.Router();
const entregasController = require('../controllers/entregas');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, entregasController.getAll);
router.post('/', entregasController.create);
router.put('/:id', authenticateToken, entregasController.update);
router.delete('/:id', authenticateToken, entregasController.delete);

module.exports = router;

