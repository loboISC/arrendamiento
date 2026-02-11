const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { authenticateToken } = require('../middleware/auth');

// Middleware de autenticación global para estas rutas
router.use(authenticateToken);

// Rutas de respaldos
router.get('/respaldos', backupController.listBackups);
router.post('/respaldos', backupController.createBackup);
router.post('/respaldos/subir', backupController.upload.single('backup'), backupController.uploadBackup);
router.post('/respaldos/restaurar', backupController.restoreBackup);
router.get('/respaldos/descargar/:id', backupController.downloadBackup);

module.exports = router;
