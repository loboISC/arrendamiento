const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { authenticateToken } = require('../middleware/auth');

// Rutas públicas
router.post('/login', authController.login);
router.get('/verify', authController.verifyToken);

// Rutas protegidas
router.get('/profile', authenticateToken, authController.getProfile);
router.post('/verify-password', authenticateToken, authController.verifyPassword);
router.post('/verify-admin-password', authenticateToken, authController.verifyAdminPassword);

module.exports = router;