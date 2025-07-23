const db = require('../db');

exports.getAll = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM facturas ORDER BY id_factura');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const { id_contrato, serie, folio, estado, fecha_emision, fecha_vencimiento, monto, pagado, metodo_pago, cfdi, nota, fecha_pagado } = req.body;
  if (!id_contrato || !monto) {
    return res.status(400).json({ error: 'Contrato y monto son requeridos' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO facturas (id_contrato, serie, folio, estado, fecha_emision, fecha_vencimiento, monto, pagado, metodo_pago, cfdi, nota, fecha_pagado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [id_contrato, serie, folio, estado, fecha_emision, fecha_vencimiento, monto, pagado, metodo_pago, cfdi, nota, fecha_pagado]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { id_contrato, serie, folio, estado, fecha_emision, fecha_vencimiento, monto, pagado, metodo_pago, cfdi, nota, fecha_pagado } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE facturas SET id_contrato=$1, serie=$2, folio=$3, estado=$4, fecha_emision=$5, fecha_vencimiento=$6, monto=$7, pagado=$8, metodo_pago=$9, cfdi=$10, nota=$11, fecha_pagado=$12 WHERE id_factura=$13 RETURNING *`,
      [id_contrato, serie, folio, estado, fecha_emision, fecha_vencimiento, monto, pagado, metodo_pago, cfdi, nota, fecha_pagado, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await db.query('DELETE FROM facturas WHERE id_factura=$1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json({ message: 'Factura eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 