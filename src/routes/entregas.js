const express = require('express');
const router = express.Router();
const entregasController = require('../controllers/entregas');
const auth = require('../middleware/auth');

router.get('/', auth, entregasController.getAll);
router.post('/', entregasController.create);
router.put('/:id', auth, entregasController.update);
router.delete('/:id', auth, entregasController.delete);

module.exports = router;

