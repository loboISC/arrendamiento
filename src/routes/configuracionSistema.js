const express = require('express');
const router = express.Router();
const configController = require('../controllers/configuracionSistema');
const { authenticateToken } = require('../middleware/auth');

// Middleware de autenticación global para estas rutas
router.use(authenticateToken);

// Rutas de configuración general
router.get('/', configController.getConfig);
router.put('/', configController.updateConfig);

module.exports = router;
