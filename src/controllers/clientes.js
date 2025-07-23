const db = require('../db');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM clientes ORDER BY id_cliente');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const { nombre, tipo, contacto, email, telefono, direccion, nota } = req.body;
  if (!nombre || !tipo) {
    return res.status(400).json({ error: 'Nombre y tipo son requeridos' });
  }
  try {
    const { rows } = await db.query(
      'INSERT INTO clientes (nombre, tipo, contacto, email, telefono, direccion, nota) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [nombre, tipo, contacto, email, telefono, direccion, nota]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo, contacto, email, telefono, direccion, nota } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE clientes SET nombre=$1, tipo=$2, contacto=$3, email=$4, telefono=$5, direccion=$6, nota=$7 WHERE id_cliente=$8 RETURNING *',
      [nombre, tipo, contacto, email, telefono, direccion, nota, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await db.query('DELETE FROM clientes WHERE id_cliente=$1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ message: 'Cliente eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 