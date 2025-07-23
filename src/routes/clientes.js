const express = require('express');
const router = express.Router();
const db = require('../db');
const clientesController = require('../controllers/clientes');
const auth = require('../middleware/auth');

// Proteger todas las rutas excepto POST
router.get('/', auth, clientesController.getAll);
router.post('/', clientesController.create);
router.put('/:id', auth, clientesController.update);
router.delete('/:id', auth, clientesController.delete);

router.get('/protegido', auth, (req, res) => {
  res.json({ message: 'Acceso permitido', user: req.user });
});

module.exports = router; 