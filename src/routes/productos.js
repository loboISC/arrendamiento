const express = require('express');
const router = express.Router();
const { listarProductos, buscarProductos, crearProducto, obtenerProducto, actualizarProducto, eliminarProducto, exportarProductosSQL, exportarProductosPDF, exportarProductosExcel, listarCategorias, listarAlmacenes, listarSubcategorias } = require('../controllers/productos');

// Rutas públicas
router.get('/', listarProductos);
router.get('/disponibles', listarProductos); // misma lista por ahora (puedes filtrar por stock si agregas columna)
router.get('/buscar', buscarProductos); // /api/productos/buscar?q=andamio
router.get('/categorias', listarCategorias); // Nueva ruta para listar categorías
router.get('/almacenes', listarAlmacenes); // Nueva ruta para listar almacenes
router.get('/subcategorias', listarSubcategorias); // Nueva ruta para listar subcategorías
// Export primero, para no caer en :id
router.get('/export/sql/all', exportarProductosSQL);
router.get('/export/pdf/catalogo', exportarProductosPDF);
router.post('/export/excel', exportarProductosExcel);
// Crear y CRUD por id
router.post('/', crearProducto);
router.get('/:id', obtenerProducto);
router.put('/:id', actualizarProducto);
router.delete('/:id', eliminarProducto);

module.exports = router;
