const express = require('express');
const router = express.Router();
const rhController = require('../controllers/rhController');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Carpeta temporal para CSVs

// Rutas de Empleados
router.get('/empleados', rhController.getEmployees);
router.get('/empleados/siguiente-id', rhController.getSiguienteId);
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

// Vacaciones y Permisos
router.get('/vacaciones', rhController.getVacaciones);
router.get('/vacaciones/saldos', rhController.getSaldosVacaciones);
router.get('/vacaciones/:id/ajustes', rhController.getAjustesPorEmpleado);
router.post('/vacaciones/ajuste', rhController.saveAjusteVacacion);
router.post('/vacaciones', rhController.saveVacacion);
router.put('/vacaciones/:id/status', rhController.updateVacacionStatus);

const asistenciaController = require('../controllers/asistenciaController');

// Asistencia
router.get('/asistencia', asistenciaController.getAsistencias);
router.post('/asistencia/sync', asistenciaController.syncBiometric);
router.get('/asistencia/preview', asistenciaController.previewBiometric);
router.post('/asistencia/test', asistenciaController.testConnection);

// Horas Extras
router.get('/asistencia/extras/propuestas', asistenciaController.getPropuestasExtras);
router.post('/asistencia/extras/autorizar', asistenciaController.autorizarHorasExtra);
router.get('/asistencia/extras/historial', asistenciaController.getHistorialExtras);

// Importación y Exportación
router.post('/importar', upload.single('csv'), rhController.importarCSV);
router.get('/exportar', rhController.exportarCSV);

// Expediente Digital (Documentos)
router.get('/empleados/:id/documentos', rhController.getDocumentosByEmpleado);
router.post('/documentos/subir', upload.single('pdf'), rhController.uploadDocumento);
router.get('/documentos/ver/:id', rhController.verDocumento);

module.exports = router;
