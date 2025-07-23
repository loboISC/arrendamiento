const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Obtener todos los análisis
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM analisis ORDER BY fecha_generado DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear un análisis manualmente
router.post('/', auth, async (req, res) => {
  const { tipo, fecha_inicio, fecha_fin, id_equipo, id_cliente, id_contrato, resultado, generado_por, descripcion } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO analisis (tipo, fecha_inicio, fecha_fin, id_equipo, id_cliente, id_contrato, resultado, generado_por, descripcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tipo, fecha_inicio, fecha_fin, id_equipo, id_cliente, id_contrato, resultado, generado_por, descripcion]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generar análisis de utilización de equipo en un periodo
router.post('/generar', auth, async (req, res) => {
  const { id_equipo, fecha_inicio, fecha_fin } = req.body;
  if (!id_equipo || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'id_equipo, fecha_inicio y fecha_fin son requeridos' });
  }
  try {
    // 1. Consultar movimientos del equipo en el periodo
    const { rows: movimientos } = await db.query(
      `SELECT * FROM movimientos_inventario WHERE id_equipo = $1 AND fecha >= $2 AND fecha < $3`,
      [id_equipo, fecha_inicio, fecha_fin]
    );
    // 2. Procesar datos (ejemplo: contar entradas/salidas)
    const totalEntradas = movimientos.filter(m => m.tipo_movimiento === 'Entrada').length;
    const totalSalidas = movimientos.filter(m => m.tipo_movimiento === 'Salida').length;
    // 3. Guardar el análisis
    const { rows } = await db.query(
      `INSERT INTO analisis (tipo, fecha_inicio, fecha_fin, id_equipo, resultado, generado_por, descripcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        'Utilización',
        fecha_inicio,
        fecha_fin,
        id_equipo,
        JSON.stringify({ totalEntradas, totalSalidas }),
        req.user ? req.user.nombre : 'sistema',
        'Reporte de utilización generado automáticamente'
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
