const db = require('../config/database');

/**
 * CONTROLADOR DE LOGÍSTICA (Versión RF1 Reforzada)
 * Maneja la lógica de vehículos, pólizas, placas, verificaciones y mantenimientos.
 */

// --- GESTIÓN DE VEHÍCULOS Y DOCUMENTOS (COMPUESTO) ---

exports.obtenerVehiculos = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehiculos ORDER BY economico');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener vehículos: ' + error.message });
  }
};

exports.obtenerVehiculoPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows: vehiculo } = await db.query('SELECT * FROM vehiculos WHERE id = $1', [id]);
    if (!vehiculo.length) return res.status(404).json({ error: 'Unidad no encontrada' });

    const { rows: documentos } = await db.query('SELECT * FROM documentos_vehiculo WHERE vehiculo_id = $1', [id]);
    const { rows: mantenimientos } = await db.query('SELECT * FROM mantenimientos WHERE vehiculo_id = $1 ORDER BY fecha DESC LIMIT 10', [id]);

    res.json({
      ...vehiculo[0],
      documentos,
      mantenimientos
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener detalle: ' + error.message });
  }
};

exports.crearVehiculo = async (req, res) => {
  const { economico, placa, marca, modelo, anio, tipo_vehiculo, capacidad_carga, kilometraje_inicial, documentos } = req.body;
  
  try {
    await db.query('BEGIN');

    // 1. Insertar Vehículo
    const { rows: vehiculo } = await db.query(
      `INSERT INTO vehiculos (economico, placa, marca, modelo, anio, tipo_vehiculo, capacidad_carga, kilometraje_inicial, estatus)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activo') RETURNING *`,
      [economico, placa, marca, modelo, anio, tipo_vehiculo, capacidad_carga, kilometraje_inicial]
    );

    const vehiculoId = vehiculo[0].id;

    // 2. Insertar Documentos si vienen en la petición (Seguro, Placa, Verificación)
    if (documentos && Array.isArray(documentos)) {
      for (const doc of documentos) {
        await db.query(
          `INSERT INTO documentos_vehiculo (vehiculo_id, tipo, folio, fecha_inicio, fecha_fin, estatus)
           VALUES ($1, $2, $3, $4, $5, 'vigente')`,
          [vehiculoId, doc.tipo, doc.folio, doc.fecha_inicio, doc.fecha_fin]
        );
      }
    }

    await db.query('COMMIT');
    res.status(201).json(vehiculo[0]);
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Error al crear unidad completa: ' + error.message });
  }
};

// --- GESTIÓN DE DOCUMENTOS (RF1) ---

exports.obtenerDocumentosVencidos = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT d.*, v.economico, v.placa 
       FROM documentos_vehiculo d
       JOIN vehiculos v ON d.vehiculo_id = v.id
       WHERE d.fecha_fin <= CURRENT_DATE + INTERVAL '30 days'
       ORDER BY d.fecha_fin ASC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener vigencias: ' + error.message });
  }
};

exports.agregarDocumento = async (req, res) => {
  const { vehiculo_id, tipo, folio, fecha_inicio, fecha_fin } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO documentos_vehiculo (vehiculo_id, tipo, folio, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [vehiculo_id, tipo, folio, fecha_inicio, fecha_fin]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar documento: ' + error.message });
  }
};

// --- GESTIÓN DE MANTENIMIENTOS ---

exports.obtenerMantenimientos = async (req, res) => {
  const { vehiculo_id } = req.params;
  try {
    const { rows } = await db.query(
      'SELECT * FROM mantenimientos WHERE vehiculo_id = $1 ORDER BY fecha DESC',
      [vehiculo_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mantenimientos' });
  }
};

exports.obtenerTodosMantenimientos = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT m.*, v.economico, v.placa 
       FROM mantenimientos m 
       JOIN vehiculos v ON m.vehiculo_id = v.id 
       ORDER BY m.fecha DESC LIMIT 100`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial global: ' + error.message });
  }
};

exports.crearMantenimiento = async (req, res) => {
  const { vehiculo_id, tipo, descripcion, costo, fecha, kilometraje, nuevo_estatus } = req.body;
  try {
    await db.query('BEGIN');
    const { rows } = await db.query(
      `INSERT INTO mantenimientos (vehiculo_id, tipo, descripcion, costo, fecha, kilometraje)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [vehiculo_id, tipo, descripcion, costo, fecha, kilometraje]
    );
    
    if (nuevo_estatus) {
      await db.query('UPDATE vehiculos SET estatus = $1 WHERE id = $2', [nuevo_estatus, vehiculo_id]);
    }

    await db.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar mantenimiento: ' + error.message });
  }
};

// --- CHOFERES Y ASIGNACIONES ---

exports.obtenerChoferesDisponibles = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id_usuario, nombre 
       FROM usuarios 
       WHERE (rol = 'Chofer' OR rol = 'Ingeniero en Sistemas') 
       AND estado = 'Activo'`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener choferes: ' + error.message });
  }
};

exports.crearAsignacion = async (req, res) => {
  const { vehiculo_id, chofer_id, pedido_id, tipo_referencia } = req.body;
  try {
    await db.query('BEGIN');
    const { rows } = await db.query(
      `INSERT INTO logistica_asignaciones (vehiculo_id, chofer_id, pedido_id, tipo_referencia, estado)
       VALUES ($1, $2, $3, $4, 'en_ruta') RETURNING *`,
      [vehiculo_id, chofer_id, pedido_id, tipo_referencia]
    );
    await db.query("UPDATE vehiculos SET estatus = 'ocupado' WHERE id = $1", [vehiculo_id]);
    await db.query('COMMIT');
    res.json(rows[0]);
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Error en asignación' });
  }
};

// --- DASHBOARD ---

exports.obtenerDashboardLogistica = async (req, res) => {
  try {
    const resumen = {};
    const { rows: counts } = await db.query('SELECT estatus, COUNT(*) as total FROM vehiculos GROUP BY estatus');
    resumen.vehiculos = counts;

    const { rows: alerts } = await db.query(
      `SELECT d.tipo, v.economico, d.fecha_fin 
       FROM documentos_vehiculo d 
       JOIN vehiculos v ON d.vehiculo_id = v.id 
       WHERE d.fecha_fin <= CURRENT_DATE + INTERVAL '15 days'`
    );
    resumen.alertas_vencimiento = alerts;
    resumen.alertas_criticas = alerts.length;

    const { rows: routes } = await db.query(
      `SELECT a.*, v.economico, u.nombre as chofer 
       FROM logistica_asignaciones a 
       JOIN vehiculos v ON a.vehiculo_id = v.id 
       JOIN usuarios u ON a.chofer_id = u.id_usuario 
       WHERE a.estado = 'en_ruta'`
    );
    resumen.asignaciones_activas = routes;

    res.json(resumen);
  } catch (error) {
    res.status(500).json({ error: 'Error en dashboard: ' + error.message });
  }
};

// Helper para procesar asignación automática (se usa desde el controlador o desde contratos)
const procesarAsignacionAutomatica = async (pedido_id, tipo_referencia = 'CONTRATO') => {
  try {
    // 1. Buscar vehículo disponible (estatus = 'activo' en tabla vehiculos)
    const { rows: vehiculos } = await db.query(
      "SELECT id FROM vehiculos WHERE estatus = 'activo' ORDER BY id ASC LIMIT 1"
    );

    if (vehiculos.length === 0) {
      // Registrar en espera si no hay unidades
      await db.query(
        "INSERT INTO logistica_asignaciones (pedido_id, tipo_referencia, estado) VALUES ($1, $2, 'en_espera')",
        [pedido_id, tipo_referencia]
      );
      return { success: true, estado: 'en_espera' };
    }

    const vehiculo_id = vehiculos[0].id;

    // 2. Buscar chofer disponible (rol 'Chofer' o 'Ingeniero en Sistemas')
    // Nota: Filtramos choferes que no tengan asignaciones activas ('en_ruta')
    const { rows: choferes } = await db.query(
      `SELECT id_usuario FROM usuarios 
       WHERE (rol = 'Chofer' OR rol = 'Ingeniero en Sistemas') 
       AND estado = 'Activo' 
       AND id_usuario NOT IN (SELECT chofer_id FROM logistica_asignaciones WHERE estado = 'en_ruta' AND chofer_id IS NOT NULL)
       LIMIT 1`
    );

    if (choferes.length === 0) {
      await db.query(
        "INSERT INTO logistica_asignaciones (pedido_id, tipo_referencia, vehiculo_id, estado) VALUES ($1, $2, $3, 'en_espera')",
        [pedido_id, tipo_referencia, vehiculo_id]
      );
      return { success: true, estado: 'en_espera' };
    }

    const chofer_id = choferes[0].id_usuario;

    // 2.1 Obtener etiquetas descriptivas para el mensaje
    const { rows: vInfo } = await db.query("SELECT economico FROM vehiculos WHERE id = $1", [vehiculo_id]);
    const { rows: cInfo } = await db.query("SELECT nombre FROM usuarios WHERE id_usuario = $1", [chofer_id]);

    // 3. Crear asignación activa
    const { rows: asignacion } = await db.query(
      `INSERT INTO logistica_asignaciones (vehiculo_id, chofer_id, pedido_id, tipo_referencia, estado, fecha_asignacion) 
       VALUES ($1, $2, $3, $4, 'en_ruta', CURRENT_TIMESTAMP) RETURNING id`,
      [vehiculo_id, chofer_id, pedido_id, tipo_referencia]
    );

    // 4. Actualizar estado del vehículo a 'ocupado'
    await db.query("UPDATE vehiculos SET estatus = 'ocupado' WHERE id = $1", [vehiculo_id]);

    return { 
      success: true, 
      estado: 'en_ruta', 
      id_asignacion: asignacion[0].id,
      vehiculo_id,
      chofer_id,
      vehiculo_nombre: vInfo[0]?.economico || 'Unidad',
      chofer_nombre: cInfo[0]?.nombre || 'Asignado'
    };
  } catch (error) {
    console.error('Error en procesarAsignacionAutomatica:', error);
    throw error;
  }
};

exports.asignacionAutomatica = async (req, res) => {
  const { pedido_id, tipo_referencia } = req.body;
  try {
    const result = await procesarAsignacionAutomatica(pedido_id, tipo_referencia || 'CONTRATO');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error en asignación automática: ' + error.message });
  }
};

exports.procesarAsignacionAutomatica = procesarAsignacionAutomatica;

exports.registrarTracking = async (req, res) => {
  const { asignacion_id, latitud, longitud, velocidad } = req.body;
  try {
    const { rows } = await db.query(
      `INSERT INTO logistica_tracking (asignacion_id, latitud, longitud, velocidad, timestamp)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *`,
      [asignacion_id, latitud, longitud, velocidad]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar tracking: ' + error.message });
  }
};

exports.obtenerAsignacionDetalle = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      `SELECT a.*, v.economico, v.placa, u.nombre as chofer,
       c.numero_contrato, cl.nombre as cliente, cl.direccion as cliente_direccion,
       c.calle, c.numero_externo, c.colonia, c.municipio, c.estado_entidad, c.codigo_postal
       FROM logistica_asignaciones a
       LEFT JOIN vehiculos v ON a.vehiculo_id = v.id
       LEFT JOIN usuarios u ON a.chofer_id = u.id_usuario
       LEFT JOIN contratos c ON a.pedido_id = c.id_contrato AND a.tipo_referencia = 'CONTRATO'
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       WHERE a.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener detalle: ' + error.message });
  }
};
