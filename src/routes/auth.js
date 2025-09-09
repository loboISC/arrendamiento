const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { authenticateToken } = require('../middleware/auth');

// Rutas públicas
router.post('/login', authController.login);
router.get('/verify', authController.verifyToken);

// Rutas protegidas
router.get('/profile', authenticateToken, authController.getProfile);

module.exports = router; 