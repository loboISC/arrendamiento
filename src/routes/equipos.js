const express = require('express');
const router = express.Router();
const equiposController = require('../controllers/equipos');
const { authenticateToken } = require('../middleware/auth');
const pool = require('../db'); // Assuming pool is defined here or imported elsewhere

// Rutas públicas (sin autenticación) - para búsqueda
router.get('/buscar/:clave', equiposController.buscarPorClave);
router.get('/disponibles/stock', equiposController.getProductosDisponibles);
// Accesorios de renta
router.get('/renta', equiposController.getAccesoriosRenta);

// Ruta para obtener imagen de un producto
router.get('/imagen/:clave', async (req, res) => {
  try {
    const { clave } = req.params;
    
    // Buscar el producto en la base de datos
    const query = 'SELECT imagen FROM equipos WHERE clave = $1';
    const result = await pool.query(query, [clave]);
    
    if (result.rows.length > 0 && result.rows[0].imagen) {
      // Si hay imagen en la base de datos, servirla
      const imagenBuffer = result.rows[0].imagen;
      res.set('Content-Type', 'image/jpeg');
      res.send(imagenBuffer);
    } else {
      // Si no hay imagen, servir una imagen placeholder
      res.status(404).json({ message: 'Imagen no encontrada' });
    }
  } catch (error) {
    console.error('Error al obtener imagen del producto:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// Permitir creación pública de accesorios desde UI de productos/accesorios
router.post('/', equiposController.createEquipo);

// Rutas protegidas (con autenticación) - para administración
router.use(authenticateToken);
router.get('/', equiposController.getAllEquipos);
router.get('/:id', equiposController.getEquipoById);
router.put('/:id', equiposController.updateEquipo);
router.delete('/:id', equiposController.deleteEquipo);

module.exports = router;
