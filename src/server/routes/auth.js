const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const otpController = require('../controllers/otp');
const usuariosController = require('../controllers/usuarios');
const { authenticateToken } = require('../middleware/auth');

// Rutas públicas
router.post('/login', authController.login);
router.get('/verify', authController.verifyToken);

// OTP 2FA (públicas — se llaman con userId tras validar credenciales)
router.post('/send-otp', otpController.sendOtp);
router.post('/verify-otp', otpController.verifyOtp);

// Recuperación de Contraseña (públicas)
router.post('/forgot-password', usuariosController.forgotPassword);
router.post('/reset-password/:token', usuariosController.resetPassword);

// Rutas protegidas
router.get('/profile', authenticateToken, authController.getProfile);
router.post('/verify-password', authenticateToken, authController.verifyPassword);
router.post('/verify-admin-password', authenticateToken, authController.verifyAdminPassword);

// 2FA por usuario (protegidas)
router.get('/2fa/:id', authenticateToken, otpController.getDosFaCtores);
router.put('/2fa/:id', authenticateToken, otpController.setDosFaCtores);

module.exports = router;