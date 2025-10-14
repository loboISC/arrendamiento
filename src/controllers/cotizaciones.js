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

// Crear nueva cotización (versión actualizada para nueva estructura)
const createCotizacion = async (req, res) => {
  const {
    // Datos básicos
    tipo = 'RENTA',
    fecha_cotizacion,
    
    // Datos del cliente
    contacto_nombre,
    contacto_email,
    contacto_telefono,
    tipo_cliente = 'Público en General',
    descripcion: descripcion_cliente,
    
    // Datos del almacén
    id_almacen,
    nombre_almacen,
    ubicacion_almacen,
    
    // Productos y configuración
    productos_seleccionados,
    dias_periodo,
    fecha_inicio,
    fecha_fin,
    periodo,
    
    // Cálculos financieros
    subtotal = 0,
    costo_envio = 0,
    total = 0,
    
    // Datos de entrega
    requiere_entrega = false,
    direccion_entrega,
    tipo_envio = 'local',
    distancia_km = 0,
    detalle_calculo,
    
    // Notas y configuración
    notas_internas,
    configuracion_especial,
    
    // Cálculos financieros adicionales
    iva = 0,
    
    // Usuario
    creado_por,
    modificado_por,
    
    // Campos adicionales
    precio_unitario = 0,
    cantidad_total = 0,
    id_vendedor,
    metodo_pago = 'Transferencia',
    terminos_pago = 'Anticipado',
    
    // Moneda y estado
    moneda = 'MXN',
    tipo_cambio = 1.0000,
    estado = 'Borrador',
    prioridad = 'Media',
    
    // Campos heredados (compatibilidad)
    numero_cotizacion,
    nombre_cliente,
    cliente_telefono,
    cliente_email,
    cliente_direccion,
    cliente_tipo,
    notas,
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
    
    // 2) Si no viene id_cliente, intentar resolver por contacto_nombre o nombre_cliente
    const nombreCliente = contacto_nombre || nombre_cliente;
    const emailCliente = contacto_email || cliente_email;
    const telefonoCliente = contacto_telefono || cliente_telefono;
    
    if (!id_cliente && nombreCliente) {
      // Buscar cliente existente por nombre o email
      let clienteResult;
      if (emailCliente) {
        clienteResult = await pool.query(
          'SELECT id_cliente FROM clientes WHERE email = $1 OR nombre = $2 ORDER BY fecha_registro DESC LIMIT 1',
          [emailCliente, nombreCliente]
        );
      } else {
        clienteResult = await pool.query(
          'SELECT id_cliente FROM clientes WHERE nombre = $1 ORDER BY fecha_registro DESC LIMIT 1',
          [nombreCliente]
        );
      }
      
      id_cliente = clienteResult.rows.length > 0 ? clienteResult.rows[0].id_cliente : null;

      // Si no existe el cliente, crearlo con la información disponible
      if (!id_cliente && nombreCliente) {
        const nuevoCliente = await pool.query(
          `INSERT INTO clientes (nombre, tipo, contacto, email, telefono, direccion, nota)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_cliente`,
          [
            nombreCliente,
            (tipo_cliente === 'Empresa' ? 'EMPRESA' : 'PERSONA'),
            nombreCliente,
            emailCliente || null,
            telefonoCliente || null,
            cliente_direccion || null,
            descripcion_cliente || 'Creado automáticamente desde cotización'
          ]
        );
        id_cliente = nuevoCliente.rows[0].id_cliente;
        console.log('Cliente creado automáticamente:', id_cliente);
      }
    }
    
    // Generar número de cotización único (será igual al folio)
    let numero = numero_cotizacion;
    if (!numero) {
      // Obtener el siguiente número de folio
      const folioResult = await pool.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(numero_folio FROM 'REN-\\d{4}-(\\d+)') AS INTEGER)), 0) + 1 as next_number
         FROM cotizaciones 
         WHERE numero_folio LIKE 'REN-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%'`
      );
      
      const nextNumber = folioResult.rows[0]?.next_number || 1;
      const year = new Date().getFullYear();
      numero = `REN-${year}-${String(nextNumber).padStart(6, '0')}`;
    }
    
    // Verificar que no exista (aunque debería ser único por el query anterior)
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 5) {
      const chk = await pool.query('SELECT 1 FROM cotizaciones WHERE numero_cotizacion = $1', [numero]);
      exists = chk.rows.length > 0;
      if (exists) {
        // Fallback: generar timestamp único
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const H = String(now.getHours()).padStart(2, '0');
        const M = String(now.getMinutes()).padStart(2, '0');
        const S = String(now.getSeconds()).padStart(2, '0');
        const rnd = String(Math.floor(Math.random() * 900) + 100);
        numero = `REN-${y}-${m}${d}${H}${M}${S}${rnd}`;
      }
      attempts++;
    }
    
    const result = await pool.query(
      `INSERT INTO cotizaciones (
        numero_cotizacion, id_cliente, tipo, fecha_cotizacion,
        id_almacen, nombre_almacen, ubicacion_almacen,
        dias_periodo, fecha_inicio, fecha_fin, periodo,
        subtotal, iva, costo_envio, total, requiere_entrega,
        direccion_entrega, tipo_envio, distancia_km, detalle_calculo,
        contacto_nombre, contacto_email, contacto_telefono, tipo_cliente,
        productos_seleccionados, notas_internas, configuracion_especial,
        moneda, tipo_cambio, estado, prioridad,
        descripcion, notas, creado_por, modificado_por,
        numero_folio, precio_unitario, cantidad_total, id_vendedor,
        metodo_pago, terminos_pago
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41) RETURNING *`,
      [
        numero,                                                           // $1
        id_cliente,                                                       // $2
        tipo,                                                            // $3
        fecha_cotizacion || new Date().toISOString().split('T')[0],      // $4
        id_almacen,                                                      // $5
        nombre_almacen,                                                  // $6
        ubicacion_almacen,                                               // $7
        dias_periodo || 1,                                               // $8
        fecha_inicio,                                                    // $9
        fecha_fin,                                                       // $10
        periodo || 'Día',                                                // $11
        subtotal,                                                        // $12
        iva || 0,                                                        // $13
        costo_envio,                                                     // $14
        total,                                                           // $15
        requiere_entrega,                                                // $16
        direccion_entrega,                                               // $17
        tipo_envio || 'local',                                           // $18
        distancia_km || 0,                                               // $19
        JSON.stringify(detalle_calculo || {}),                          // $20
        nombreCliente,                                                   // $21
        emailCliente,                                                    // $22
        telefonoCliente,                                                 // $23
        tipo_cliente,                                                    // $24
        JSON.stringify(productos_seleccionados || equipos || []),       // $25
        JSON.stringify(notas_internas || []),                           // $26
        JSON.stringify(configuracion_especial || {}),                   // $27
        moneda,                                                          // $28
        tipo_cambio,                                                     // $29
        estado,                                                          // $30
        prioridad,                                                       // $31
        descripcion_cliente || JSON.stringify(equipos || []),           // $32
        notas || `Cotización generada el ${new Date().toLocaleString()}`, // $33
        creado_por,                                                      // $34
        modificado_por,                                                  // $35
        numero,                                                          // $36 (numero_folio = numero_cotizacion)
        precio_unitario || 0,                                            // $37
        cantidad_total || 0,                                             // $38
        id_vendedor || creado_por,                                       // $39
        metodo_pago || 'Transferencia',                                  // $40
        terminos_pago || 'Anticipado'                                    // $41
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