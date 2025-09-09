const pool = require('../db/index');

// Obtener todas las cotizaciones
const getCotizaciones = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, cl.nombre as nombre_cliente 
       FROM cotizaciones c 
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente 
       ORDER BY c.fecha_creacion DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener cotizaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener una cotización específica
const getCotizacion = async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM cotizaciones WHERE id_cotizacion = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener cotización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear nueva cotización
const createCotizacion = async (req, res) => {
  const {
    numero_cotizacion,
    nombre_cliente,
    cliente_telefono,
    cliente_email,
    cliente_direccion,
    cliente_tipo,
    fecha_cotizacion,
    tipo,
    estado,
    prioridad,
    descripcion,
    notas,
    total,
    equipos,
    id_cliente: id_cliente_body
  } = req.body;
  
  try {
    console.log('Datos recibidos para crear cotización:', req.body);
    
    // Obtener el ID del cliente
    let id_cliente = null;
    // 1) Preferir id_cliente del body si viene informado
    if (id_cliente_body) {
      id_cliente = Number(id_cliente_body) || null;
    }
    // 2) Si no viene id_cliente, intentar resolver por nombre_cliente
    if (!id_cliente && nombre_cliente) {
      const clienteResult = await pool.query(
        'SELECT id_cliente FROM clientes WHERE nombre = $1 ORDER BY fecha_registro DESC LIMIT 1',
        [nombre_cliente]
      );
      id_cliente = clienteResult.rows.length > 0 ? clienteResult.rows[0].id_cliente : null;

      // Si no existe el cliente, crearlo rápidamente con la información disponible
      if (!id_cliente) {
        const nuevoCliente = await pool.query(
          `INSERT INTO clientes (nombre, tipo, contacto, email, telefono, direccion, nota)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_cliente` ,
          [
            nombre_cliente,
            (cliente_tipo || 'PERSONA'),
            nombre_cliente,
            cliente_email || null,
            cliente_telefono || null,
            cliente_direccion || null,
            'Creado automáticamente desde cotización'
          ]
        );
        id_cliente = nuevoCliente.rows[0].id_cliente;
      }
    }
    
    // Asegurar numero_cotizacion único
    let numero = numero_cotizacion;
    if (!numero) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const H = String(now.getHours()).padStart(2, '0');
      const M = String(now.getMinutes()).padStart(2, '0');
      const S = String(now.getSeconds()).padStart(2, '0');
      const rnd = String(Math.floor(Math.random() * 90) + 10); // 2 dígitos
      numero = `${y}${m}${d}${H}${M}${S}${rnd}`;
    }
    // Si viene un número o se generó, verificar colisión y regenerar si ya existe
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 5) {
      const chk = await pool.query('SELECT 1 FROM cotizaciones WHERE numero_cotizacion = $1', [numero]);
      exists = chk.rows.length > 0;
      if (exists) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const H = String(now.getHours()).padStart(2, '0');
        const M = String(now.getMinutes()).padStart(2, '0');
        const S = String(now.getSeconds()).padStart(2, '0');
        const rnd = String(Math.floor(Math.random() * 900) + 100); // 3 dígitos
        numero = `${y}${m}${d}${H}${M}${S}${rnd}`;
      }
      attempts++;
    }
    
    const result = await pool.query(
      `INSERT INTO cotizaciones (
        numero_cotizacion, id_cliente, tipo, fecha_cotizacion,
        descripcion, subtotal, total, estado, prioridad, notas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        numero,
        id_cliente,
        tipo || 'RENTA',
        fecha_cotizacion || new Date().toISOString().split('T')[0],
        descripcion || JSON.stringify(equipos || []),
        total || 0,
        total || 0,
        estado || 'Pendiente',
        prioridad || 'Media',
        notas || `Cotización generada el ${new Date().toLocaleString()}`
      ]
    );
    
    console.log('Cotización creada exitosamente:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear cotización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar cotización
const updateCotizacion = async (req, res) => {
  const { id } = req.params;
  const {
    folio,
    fecha,
    cliente_nombre,
    cliente_telefono,
    cliente_email,
    total,
    estado,
    equipos,
    observaciones
  } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE cotizaciones SET 
        numero_cotizacion = $1, fecha_cotizacion = $2, descripcion = $3,
        subtotal = $4, total = $5, estado = $6, notas = $7,
        fecha_modificacion = CURRENT_TIMESTAMP
       WHERE id_cotizacion = $8 RETURNING *`,
      [folio, fecha, JSON.stringify(equipos), total, total, estado, observaciones, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar cotización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Eliminar cotización
const deleteCotizacion = async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM cotizaciones WHERE id_cotizacion = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    
    res.json({ message: 'Cotización eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar cotización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Convertir cotización a contrato
const convertirAContrato = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Primero obtener la cotización
    const cotizacionResult = await pool.query(
      'SELECT * FROM cotizaciones WHERE id_cotizacion = $1',
      [id]
    );
    
    if (cotizacionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    
    const cotizacion = cotizacionResult.rows[0];
    
    // Aquí puedes agregar la lógica para crear el contrato
    // Por ahora solo actualizamos el estado
    const result = await pool.query(
      'UPDATE cotizaciones SET estado = $1 WHERE id_cotizacion = $2 RETURNING *',
      ['Convertida a Contrato', id]
    );
    
    res.json({
      message: 'Cotización convertida a contrato exitosamente',
      cotizacion: result.rows[0]
    });
  } catch (error) {
    console.error('Error al convertir cotización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getCotizaciones,
  getCotizacion,
  createCotizacion,
  updateCotizacion,
  deleteCotizacion,
  convertirAContrato
}; 