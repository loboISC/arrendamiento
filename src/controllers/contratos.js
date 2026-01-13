const db = require('../db');
const { pool } = require('../db');

/**
 * Obtener el siguiente número consecutivo de contrato para un mes
 * Formato: CT-YYYY-MM-NNNN
 */
exports.getSiguienteNumero = async (req, res) => {
  try {
    const { mes } = req.query; // formato: YYYY-MM
    
    if (!mes || !mes.match(/^\d{4}-\d{2}$/)) {
      return res.status(400).json({ error: 'Formato de mes inválido (debe ser YYYY-MM)' });
    }

    // Contar cuántos contratos existen para este mes
    const result = await pool.query(
      `SELECT COUNT(*) as cantidad 
       FROM contratos 
       WHERE numero_contrato LIKE $1`,
      [`CT-${mes}-%`]
    );

    const cantidad = parseInt(result.rows[0].cantidad || 0);
    const siguiente = cantidad + 1;

    res.json({ siguiente, mes });
  } catch (error) {
    console.error('Error al obtener siguiente número:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const { rows: contratos } = await db.query(
      `SELECT c.*, cl.nombre as nombre_cliente, cl.contacto, cl.email, co.numero_cotizacion
       FROM contratos c
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       LEFT JOIN cotizaciones co ON c.id_cotizacion = co.id_cotizacion
       ORDER BY c.id_contrato DESC`
    );

    // Obtener items para cada contrato
    const contratosConItems = await Promise.all(
      contratos.map(async (contrato) => {
        const { rows: items } = await db.query(
          'SELECT * FROM contrato_items WHERE id_contrato = $1 ORDER BY id_contrato_item',
          [contrato.id_contrato]
        );
        return {
          ...contrato,
          items: items
        };
      })
    );

    res.json(contratosConItems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Obtener contrato por ID con sus items
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: contratos } = await db.query(
      `SELECT c.*, cl.nombre as nombre_cliente, cl.contacto, co.numero_cotizacion
       FROM contratos c
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       LEFT JOIN cotizaciones co ON c.id_cotizacion = co.id_cotizacion
       WHERE c.id_contrato = $1`,
      [id]
    );

    if (contratos.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const contrato = contratos[0];

    // Obtener items del contrato
    const { rows: items } = await db.query(
      'SELECT * FROM contrato_items WHERE id_contrato = $1 ORDER BY id_contrato_item',
      [id]
    );

    res.json({
      ...contrato,
      items: items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const {
      numero_contrato,
      id_cliente,
      tipo,
      requiere_factura,
      fecha_contrato,
      fecha_inicio,
      fecha_fin,
      id_cotizacion,
      responsable,
      estado,
      subtotal,
      impuesto,
      descuento,
      total,
      monto,
      tipo_garantia,
      importe_garantia,
      monto_garantia,
      calle,
      numero_externo,
      numero_interno,
      colonia,
      codigo_postal,
      entre_calles,
      pais,
      estado_entidad,
      municipio,
      notas_domicilio,
      usuario_creacion,
      items
    } = req.body;

    const fechaContratoFinal = fecha_contrato || fecha_inicio;
    const totalFinal = total ?? monto;
    const importeGarantiaFinal = importe_garantia ?? monto_garantia;

    // Insertar contrato principal
    const { rows } = await client.query(
      `INSERT INTO contratos (
        numero_contrato, id_cliente, tipo, requiere_factura, fecha_contrato, fecha_fin, id_cotizacion,
        responsable, estado, subtotal, impuesto, descuento, total, tipo_garantia, importe_garantia,
        calle, numero_externo, numero_interno, colonia, codigo_postal, entre_calles,
        pais, estado_entidad, municipio, notas_domicilio, usuario_creacion, fecha_creacion, fecha_actualizacion
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *`,
      [
        numero_contrato, id_cliente, tipo, requiere_factura, fechaContratoFinal, fecha_fin, id_cotizacion,
        responsable, estado || 'Activo', subtotal, impuesto, descuento, totalFinal, tipo_garantia, importeGarantiaFinal,
        calle, numero_externo, numero_interno, colonia, codigo_postal, entre_calles,
        pais || 'México', estado_entidad || 'México', municipio, notas_domicilio, usuario_creacion
      ]
    );

    const id_contrato = rows[0].id_contrato;

    // Insertar items del contrato si existen
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO contrato_items (id_contrato, clave, descripcion, cantidad, precio_unitario, garantia, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id_contrato, item.clave, item.descripcion, item.cantidad, item.precio_unitario, item.garantia, item.total]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Contrato guardado exitosamente', contrato: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// Actualizar contrato
exports.update = async (req, res) => {
  const client = await db.pool.connect();
  const { id } = req.params;

  try {
    await client.query('BEGIN');

    const {
      numero_contrato,
      id_cliente,
      tipo,
      requiere_factura,
      fecha_contrato,
      fecha_inicio,
      fecha_fin,
      id_cotizacion,
      responsable,
      estado,
      subtotal,
      impuesto,
      descuento,
      total,
      monto,
      tipo_garantia,
      importe_garantia,
      monto_garantia,
      calle,
      numero_externo,
      numero_interno,
      colonia,
      codigo_postal,
      entre_calles,
      pais,
      estado_entidad,
      municipio,
      notas_domicilio,
      items
    } = req.body;

    const fechaContratoFinal = fecha_contrato || fecha_inicio;
    const totalFinal = total ?? monto;
    const importeGarantiaFinal = importe_garantia ?? monto_garantia;

    // Actualizar contrato principal
    const { rows } = await client.query(
      `UPDATE contratos SET
        numero_contrato=$1, id_cliente=$2, tipo=$3, requiere_factura=$4, fecha_contrato=$5, fecha_fin=$6, id_cotizacion=$7,
        responsable=$8, estado=$9, subtotal=$10, impuesto=$11, descuento=$12, total=$13, tipo_garantia=$14, importe_garantia=$15,
        calle=$16, numero_externo=$17, numero_interno=$18, colonia=$19, codigo_postal=$20, entre_calles=$21,
        pais=$22, estado_entidad=$23, municipio=$24, notas_domicilio=$25, fecha_actualizacion=CURRENT_TIMESTAMP
       WHERE id_contrato=$26 RETURNING *`,
      [
        numero_contrato, id_cliente, tipo, requiere_factura, fechaContratoFinal, fecha_fin, id_cotizacion,
        responsable, estado || 'Activo', subtotal, impuesto, descuento, totalFinal, tipo_garantia, importeGarantiaFinal,
        calle, numero_externo, numero_interno, colonia, codigo_postal, entre_calles,
        pais || 'México', estado_entidad || 'México', municipio, notas_domicilio, id
      ]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    // Eliminar items anteriores
    await client.query('DELETE FROM contrato_items WHERE id_contrato = $1', [id]);

    // Insertar nuevos items si existen
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO contrato_items (id_contrato, clave, descripcion, cantidad, precio_unitario, garantia, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, item.clave, item.descripcion, item.cantidad, item.precio_unitario, item.garantia, item.total]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Contrato actualizado exitosamente', contrato: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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