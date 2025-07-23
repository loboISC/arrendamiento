const db = require('../db');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM entregas ORDER BY id_entrega');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const { id_contrato, fecha, hora, estado, ubicacion, equipos, id_flota, observaciones } = req.body;
  if (!id_contrato || !fecha) {
    return res.status(400).json({ error: 'Contrato y fecha son requeridos' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO entregas (id_contrato, fecha, hora, estado, ubicacion, equipos, id_flota, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id_contrato, fecha, hora, estado, ubicacion, equipos, id_flota, observaciones]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { id_contrato, fecha, hora, estado, ubicacion, equipos, id_flota, observaciones } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE entregas SET id_contrato=$1, fecha=$2, hora=$3, estado=$4, ubicacion=$5, equipos=$6, id_flota=$7, observaciones=$8 WHERE id_entrega=$9 RETURNING *`,
      [id_contrato, fecha, hora, estado, ubicacion, equipos, id_flota, observaciones, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Entrega no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await db.query('DELETE FROM entregas WHERE id_entrega=$1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Entrega no encontrada' });
    res.json({ message: 'Entrega eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 