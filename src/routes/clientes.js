const express = require('express');
const router = express.Router();
const { 
  getAllClientes, 
  createCliente, 
  getClienteById, 
  updateCliente, 
  deleteCliente, 
  searchClientes,
  getClientesStats,
  getClienteHistorial
} = require('../controllers/clientes');
const { authenticateToken } = require('../middleware/auth');

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// Obtener todos los clientes
router.get('/', getAllClientes);

// Crear nuevo cliente
router.post('/', createCliente);

// Buscar clientes (debe ir antes de /:id)
router.get('/search', searchClientes);

// Obtener estadísticas de clientes (debe ir antes de /:id)
router.get('/stats', getClientesStats);

// Obtener historial del cliente (debe ir antes de /:id)
router.get('/:id/historial', getClienteHistorial);

// Obtener cliente por ID
router.get('/:id', getClienteById);

// Actualizar cliente
router.put('/:id', updateCliente);

// Eliminar cliente
router.delete('/:id', deleteCliente);

module.exports = router; 