const express = require('express');
const router = express.Router();
const { 
  getAllClientes, 
  createCliente, 
  getClienteById, 
  updateCliente, 
  deleteCliente, 
  searchClientes,
  getClienteByRFC,
  validateRFC,
  getClientesStats,
  getClienteHistorial,
  getClienteLedger,
  getClientesConCredito,
  getDetalleCreditoCliente,
  registrarAbonoCredito,
  vincularFacturaAbono
} = require('../controllers/clientes');
const { authenticateToken } = require('../middleware/auth');
const roles = require('../middleware/roles');

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// Obtener todos los clientes
router.get('/', getAllClientes);

// Crear nuevo cliente
router.post('/', createCliente);

// Buscar clientes (debe ir antes de /:id)
router.get('/search', searchClientes);

// Obtener clientes con crédito (debe ir antes de /:id)
router.get('/credito/listado', getClientesConCredito);
router.get('/credito/:id/detalle', getDetalleCreditoCliente);
router.post('/credito/abonos', registrarAbonoCredito);
router.patch('/credito/abonos/:ledgerId/factura', vincularFacturaAbono);

// Buscar cliente por RFC (debe ir antes de /:id)
router.get('/rfc/:rfc', getClienteByRFC);

// Validar RFC (debe ir antes de /:id)
router.get('/validate-rfc/:rfc', validateRFC);

// Obtener estadísticas de clientes (debe ir antes de /:id)
router.get('/stats', getClientesStats);

// Obtener historial del cliente (debe ir antes de /:id)
router.get('/:id/historial', getClienteHistorial);

// Ledger financiero del cliente (paginado/filtros)
router.get('/:id/ledger', roles(['nc.audit.view','Admin']), getClienteLedger);

// Obtener cliente por ID
router.get('/:id', getClienteById);

// Actualizar cliente
router.put('/:id', updateCliente);

// Eliminar cliente
router.delete('/:id', deleteCliente);

module.exports = router; 
