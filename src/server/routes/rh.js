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
router.get('/config/deptos', rhController.getDeptos);
router.post('/config/deptos', rhController.saveDepto);
router.delete('/config/deptos/:id', rhController.deleteDepto);

router.get('/config/puestos', rhController.getPuestos);
router.post('/config/puestos', rhController.savePuesto);
router.delete('/config/puestos/:id', rhController.deletePuesto);

router.get('/config/turnos', rhController.getTurnos);
router.post('/config/turnos', rhController.saveTurno);
router.delete('/config/turnos/:id', rhController.deleteTurno);

router.get('/config/global', rhController.getConfigGlobal);
router.post('/config/global', rhController.updateConfigGlobal);
router.get('/config/auditoria', rhController.getAuditoria);

// Asistencia
router.get('/asistencia', rhController.getAsistencia);
router.post('/asistencia', rhController.saveAsistencia);

// Importación y Exportación
router.post('/importar', upload.single('csv'), rhController.importarCSV);
router.get('/exportar', rhController.exportarCSV);

module.exports = router;
