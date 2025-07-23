const express = require('express');
const router = express.Router();
const facturasController = require('../controllers/facturas');
const auth = require('../middleware/auth');

router.get('/', auth, facturasController.getAll);
router.post('/', facturasController.create);
router.put('/:id', auth, facturasController.update);
router.delete('/:id', auth, facturasController.delete);

module.exports = router;

