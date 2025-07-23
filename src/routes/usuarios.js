const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios');

// Suponiendo que tienes un middleware de autenticación para rutas protegidas.
// Si no lo tienes, puedes quitar `authMiddleware` de las rutas de abajo.
const authMiddleware = (req, res, next) => next(); 

// --- Rutas Públicas (no requieren token) ---
router.post('/login', usuariosController.login);
router.post('/forgot-password', usuariosController.forgotPassword);
router.post('/reset-password/:token', usuariosController.resetPassword);

// --- Rutas Protegidas (requieren token) ---
router.get('/', authMiddleware, usuariosController.getAll);
router.post('/', authMiddleware, usuariosController.create);
router.put('/:id', authMiddleware, usuariosController.update);
router.delete('/:id', authMiddleware, usuariosController.delete);

module.exports = router;