const db = require('../db');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM contratos ORDER BY id_contrato');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const { id_cliente, responsable, estado, fecha_inicio, fecha_fin, monto, pagado, observaciones } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO contratos (id_cliente, responsable, estado, fecha_inicio, fecha_fin, monto, pagado, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id_cliente, responsable, estado, fecha_inicio, fecha_fin, monto, pagado, observaciones]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Actualizar contrato
exports.update = async (req, res) => {
  const { id } = req.params;
  const { id_cliente, responsable, estado, fecha_inicio, fecha_fin, monto, pagado, observaciones } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE contratos SET id_cliente=$1, responsable=$2, estado=$3, fecha_inicio=$4, fecha_fin=$5, monto=$6, pagado=$7, observaciones=$8 WHERE id_contrato=$9 RETURNING *`,
      [id_cliente, responsable, estado, fecha_inicio, fecha_fin, monto, pagado, observaciones, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Eliminar contrato
exports.delete = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await db.query('DELETE FROM contratos WHERE id_contrato=$1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json({ message: 'Contrato eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 