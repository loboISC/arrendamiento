const express = require('express');
const router = express.Router();
const equiposController = require('../controllers/equipos');

// Middleware de autenticación (placeholder, asume que todas las rutas de inventario están protegidas)
const authMiddleware = (req, res, next) => {
    // Aquí iría la lógica para verificar el token JWT.
    // Por ahora, solo dejamos pasar la solicitud.
    next();
};

router.post('/', authMiddleware, equiposController.create);
router.get('/', authMiddleware, equiposController.getAll);
router.get('/:id', authMiddleware, equiposController.getOne);
router.put('/:id', authMiddleware, equiposController.update);
router.delete('/:id', authMiddleware, equiposController.delete);

module.exports = router;
