const express = require('express');
const router = express.Router();
const { listarProductos, buscarProductos, crearProducto, obtenerProducto, actualizarProducto, eliminarProducto, exportarProductosSQL, exportarProductosPDF } = require('../controllers/productos');

// Rutas públicas
router.get('/', listarProductos);
router.get('/disponibles', listarProductos); // misma lista por ahora (puedes filtrar por stock si agregas columna)
router.get('/buscar', buscarProductos); // /api/productos/buscar?q=andamio
// Export primero, para no caer en :id
router.get('/export/sql/all', exportarProductosSQL);
router.get('/export/pdf/catalogo', exportarProductosPDF);
// Crear y CRUD por id
router.post('/', crearProducto);
router.get('/:id', obtenerProducto);
router.put('/:id', actualizarProducto);
router.delete('/:id', eliminarProducto);

module.exports = router;
