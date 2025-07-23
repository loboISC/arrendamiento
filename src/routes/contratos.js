const express = require('express');
const router = express.Router();
const contratosController = require('../controllers/contratos');

router.get('/', contratosController.getAll);
router.post('/', contratosController.create);
router.put('/:id', contratosController.update);
router.delete('/:id', contratosController.delete);

module.exports = router;
