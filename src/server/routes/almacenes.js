const express = require('express');
const router = express.Router();
const { getAlmacenes } = require('../controllers/almacenesController');

// Middleware de autenticación (temporalmente deshabilitado para pruebas)
// const authenticate = require('../middleware/auth');

// Obtener todos los almacenes
router.get('/', /* authenticate, */ getAlmacenes);

module.exports = router;
