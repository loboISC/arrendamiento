const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Obtener todas las notificaciones (limite 50 para rendimiento) con el nombre del usuario que realizó la acción
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT n.*, u.nombre AS usuario_nombre 
      FROM notificaciones n
      LEFT JOIN usuarios u ON n.id_usuario_accion = u.id_usuario
      ORDER BY n.fecha DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener el conteo de notificaciones sin leer
router.get('/sin-leer/count', authenticateToken, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT COUNT(*) AS count FROM notificaciones WHERE leida = false');
    res.json({ count: parseInt(rows[0].count, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marcar una notificación como leída
router.patch('/:id/leida', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      'UPDATE notificaciones SET leida = true WHERE id_notificacion = $1 RETURNING *',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Marcar todas las notificaciones como leídas
router.patch('/leer-todas', authenticateToken, async (req, res) => {
  try {
    await db.query('UPDATE notificaciones SET leida = true WHERE leida = false');
    res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear una notificación (para compatibilidad)
router.post('/', authenticateToken, async (req, res) => {
  const { tipo, mensaje, id_usuario, id_equipo, id_contrato, prioridad } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO notificaciones (tipo, mensaje, id_usuario, id_accesorio, id_contrato, prioridad, id_usuario_accion)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tipo, mensaje, id_usuario, id_equipo, id_contrato, prioridad, req.user?.id_usuario || req.user?.id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;



