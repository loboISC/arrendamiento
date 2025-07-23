const db = require('../db');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM movimientos_inventario ORDER BY fecha DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const { id_equipo, id_componente, tipo_movimiento, cantidad, usuario, descripcion, estado_anterior, estado_nuevo, ubicacion_anterior, ubicacion_nueva } = req.body;
  if (!id_equipo || !tipo_movimiento) {
    return res.status(400).json({ error: 'Equipo y tipo de movimiento son requeridos' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO movimientos_inventario (id_equipo, id_componente, tipo_movimiento, cantidad, usuario, descripcion, estado_anterior, estado_nuevo, ubicacion_anterior, ubicacion_nueva)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id_equipo, id_componente, tipo_movimiento, cantidad, usuario, descripcion, estado_anterior, estado_nuevo, ubicacion_anterior, ubicacion_nueva]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { id_equipo, id_componente, tipo_movimiento, cantidad, usuario, descripcion, estado_anterior, estado_nuevo, ubicacion_anterior, ubicacion_nueva } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE movimientos_inventario SET id_equipo=$1, id_componente=$2, tipo_movimiento=$3, cantidad=$4, usuario=$5, descripcion=$6, estado_anterior=$7, estado_nuevo=$8, ubicacion_anterior=$9, ubicacion_nueva=$10 WHERE id_movimiento=$11 RETURNING *`,
      [id_equipo, id_componente, tipo_movimiento, cantidad, usuario, descripcion, estado_anterior, estado_nuevo, ubicacion_anterior, ubicacion_nueva, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await db.query('DELETE FROM movimientos_inventario WHERE id_movimiento=$1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json({ message: 'Movimiento eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 