const express = require('express');
const router = express.Router();
const contratosController = require('../controllers/contratos');

router.get('/siguiente-numero', contratosController.getSiguienteNumero);
router.get('/siguiente-numero-nota', contratosController.getSiguienteNumeronota);
router.get('/', contratosController.getAll);
router.get('/:id', contratosController.getById);
router.post('/', contratosController.create);
router.put('/:id', contratosController.update);
router.delete('/:id', contratosController.delete);

module.exports = router;
