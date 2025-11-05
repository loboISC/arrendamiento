const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Tasa de Utilización
router.get('/utilizacion', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT COUNT(*) FILTER (WHERE estado = 'Alquilado') AS en_uso, COUNT(*) AS total FROM equipos`);
    const en_uso = parseInt(rows[0].en_uso, 10);
    const total = parseInt(rows[0].total, 10);
    const porcentaje = total > 0 ? (en_uso * 100.0 / total) : 0;
    res.json({ en_uso, total, porcentaje });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ingresos por Día (últimos 30 días)
router.get('/ingresos-dia', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT fecha_emision::date AS dia, SUM(total) AS ingresos FROM facturas WHERE fecha_emision >= NOW() - INTERVAL '30 days' GROUP BY dia ORDER BY dia`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Satisfacción del Cliente (requiere tabla satisfaccion)
router.get('/satisfaccion', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT AVG(calificacion) AS promedio FROM satisfaccion WHERE fecha >= NOW() - INTERVAL '30 days'`);
    res.json({ promedio: parseFloat(rows[0].promedio) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Estados de Inventario
router.get('/estados-inventario', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT estado, COUNT(*) FROM equipos GROUP BY estado`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ingresos y Contratos por mes (últimos 12 meses)
router.get('/ingresos-contratos', authenticateToken, async (req, res) => {
  try {
    const ingresos = await db.query(`SELECT DATE_TRUNC('month', fecha_emision) AS mes, SUM(total) AS ingresos FROM facturas WHERE fecha_emision >= NOW() - INTERVAL '12 months' GROUP BY mes ORDER BY mes`);
    const contratos = await db.query(`SELECT DATE_TRUNC('month', fecha_inicio) AS mes, COUNT(*) AS contratos FROM contratos WHERE fecha_inicio >= NOW() - INTERVAL '12 months' GROUP BY mes ORDER BY mes`);
    res.json({ ingresos: ingresos.rows, contratos: contratos.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Segmentación de Clientes
router.get('/segmentacion-clientes', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT tipo, COUNT(*) FROM clientes GROUP BY tipo`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Utilización por Categoría
router.get('/utilizacion-categorias', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT categoria, COUNT(*) FILTER (WHERE estado = 'Alquilado') AS en_uso, COUNT(*) AS total FROM equipos GROUP BY categoria`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rentabilidad por Categoría (requiere campos ingresos/costos en productos o facturas)
router.get('/rentabilidad', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT categoria, SUM(ingresos) AS ingresos, SUM(costos) AS costos, (SUM(ingresos) - SUM(costos)) AS ganancia, ROUND((SUM(ingresos) - SUM(costos)) * 100.0 / NULLIF(SUM(ingresos),0), 1) AS margen FROM productos GROUP BY categoria`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tendencias de Mantenimiento
router.get('/tendencias-mantenimiento', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT DATE_TRUNC('month', fecha) AS mes, COUNT(*) AS mantenimientos FROM movimientos_inventario WHERE tipo_movimiento = 'Mantenimiento' GROUP BY mes ORDER BY mes`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Métricas Detalladas por Categoría (requiere campos en productos)
router.get('/metricas-categorias', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT categoria, SUM(ingresos) AS ingresos, SUM(costos) AS costos, (SUM(ingresos) - SUM(costos)) AS ganancia, ROUND((SUM(ingresos) - SUM(costos)) * 100.0 / NULLIF(SUM(ingresos),0), 1) AS margen FROM productos GROUP BY categoria`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 