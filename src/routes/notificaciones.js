const express = require('express');
const router = express.Router();
const db = require('../db');

// Obtener todas las notificaciones
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM notificaciones ORDER BY fecha DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Crear una notificación
router.post('/', async (req, res) => {
  const { tipo, mensaje, id_usuario, id_equipo, id_contrato, prioridad } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO notificaciones (tipo, mensaje, id_usuario, id_equipo, id_contrato, prioridad)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tipo, mensaje, id_usuario, id_equipo, id_contrato, prioridad]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;



