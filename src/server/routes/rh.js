const express = require('express');
const router = express.Router();
const rhController = require('../controllers/rhController');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Carpeta temporal para CSVs

// Rutas de Empleados
router.get('/empleados', rhController.getEmployees);
router.get('/empleados/:id', rhController.getEmployeeById);
router.post('/empleados', rhController.saveEmployee);

// Catálogos y Configuración
router.get('/config', rhController.getConfig);

// Asistencia
router.get('/asistencia', rhController.getAsistencia);
router.post('/asistencia', rhController.saveAsistencia);

// Importación y Exportación
router.post('/importar', upload.single('csv'), rhController.importarCSV);
router.get('/exportar', rhController.exportarCSV);

module.exports = router;
