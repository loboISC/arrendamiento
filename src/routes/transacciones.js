const express = require('express');
const router = express.Router();

// El frontend (public/js/transacciones.js) espera un arreglo [] y hace .map
router.get('/', (req, res) => {
  res.json([]);
});

// Búsqueda: también devolver arreglo []
router.get('/buscar', (req, res) => {
  res.json([]);
});

module.exports = router;
