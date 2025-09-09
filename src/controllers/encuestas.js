const pool = require('../config/database');

// Crear nueva encuesta de satisfacción
const crearEncuesta = async (req, res) => {
  try {
    const {
      id_cliente,
      id_proyecto,
      email_cliente,
      telefono_cliente,
      metodo_envio,
      notas,
      fecha_vencimiento
    } = req.body;

    // Generar URL única para la encuesta
    const url_encuesta = `https://tu-dominio.com/sastifaccion_clienteSG.html?encuesta=${Date.now()}_${id_cliente}`;
    
    const query = `
      INSERT INTO encuestas_satisfaccionSG 
      (id_cliente, id_proyecto, url_encuesta, email_cliente, telefono_cliente, 
       metodo_envio, notas, fecha_vencimiento, enviada_por)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      id_cliente,
      id_proyecto || null,
      url_encuesta,
      email_cliente,
      telefono_cliente,
      metodo_envio || 'link',
      notas,
      fecha_vencimiento || null,
      req.user.id // ID del usuario que envía la encuesta
    ];
    
    const result = await pool.query(query, values);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Encuesta creada exitosamente'
    });
  } catch (error) {
    console.error('Error al crear encuesta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener todas las encuestas
const obtenerEncuestas = async (req, res) => {
  try {
    const { estado, id_cliente, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        e.*,
        c.nombre as cliente_nombre,
        c.empresa as cliente_empresa,
        u.nombre as enviada_por_nombre
      FROM encuestas_satisfaccionSG e
      LEFT JOIN clientes c ON e.id_cliente = c.id_cliente
      LEFT JOIN usuarios u ON e.enviada_por = u.id_usuario
      WHERE 1=1
    `;
    
    const values = [];
    let paramCount = 0;
    
    if (estado) {
      paramCount++;
      query += ` AND e.estado = $${paramCount}`;
      values.push(estado);
    }
    
    if (id_cliente) {
      paramCount++;
      query += ` AND e.id_cliente = $${paramCount}`;
      values.push(id_cliente);
    }
    
    query += ` ORDER BY e.fecha_envio DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error al obtener encuestas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener encuesta por ID
const obtenerEncuestaPorId = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        e.*,
        c.nombre as cliente_nombre,
        c.empresa as cliente_empresa,
        c.email as cliente_email,
        c.telefono as cliente_telefono,
        u.nombre as enviada_por_nombre
      FROM encuestas_satisfaccionSG e
      LEFT JOIN clientes c ON e.id_cliente = c.id_cliente
      LEFT JOIN usuarios u ON e.enviada_por = u.id_usuario
      WHERE e.id_encuesta = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Encuesta no encontrada' });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener encuesta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Guardar respuesta de encuesta
const guardarRespuesta = async (req, res) => {
  try {
    const {
      id_encuesta,
      nombre_cliente,
      email_cliente,
      q1_atencion_ventas,
      q2_calidad_productos,
      q3_tiempo_entrega,
      q4_servicio_logistica,
      q5_experiencia_compra,
      sugerencias
    } = req.body;
    
    // Verificar que la encuesta existe y está activa
    const encuestaQuery = `
      SELECT * FROM encuestas_satisfaccionSG 
      WHERE id_encuesta = $1 AND estado = 'enviada'
    `;
    const encuestaResult = await pool.query(encuestaQuery, [id_encuesta]);
    
    if (encuestaResult.rows.length === 0) {
      return res.status(404).json({ error: 'Encuesta no encontrada o ya respondida' });
    }
    
    // Verificar si ya existe una respuesta para esta encuesta
    const respuestaExistente = await pool.query(
      'SELECT id_respuesta FROM respuestas_encuestaSG WHERE id_encuesta = $1',
      [id_encuesta]
    );
    
    if (respuestaExistente.rows.length > 0) {
      return res.status(400).json({ error: 'Esta encuesta ya ha sido respondida' });
    }
    
    // Insertar la respuesta
    const query = `
      INSERT INTO respuestas_encuestaSG 
      (id_encuesta, nombre_cliente, email_cliente, q1_atencion_ventas, 
       q2_calidad_productos, q3_tiempo_entrega, q4_servicio_logistica, 
       q5_experiencia_compra, sugerencias, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const values = [
      id_encuesta,
      nombre_cliente,
      email_cliente,
      q1_atencion_ventas,
      q2_calidad_productos,
      q3_tiempo_entrega,
      q4_servicio_logistica,
      q5_experiencia_compra,
      sugerencias,
      req.ip,
      req.get('User-Agent')
    ];
    
    const result = await pool.query(query, values);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Respuesta guardada exitosamente'
    });
  } catch (error) {
    console.error('Error al guardar respuesta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener estadísticas de encuestas
const obtenerEstadisticasEncuestas = async (req, res) => {
  try {
    // Estadísticas generales
    const statsQuery = `
      SELECT 
        COUNT(*) as total_encuestas,
        COUNT(CASE WHEN estado = 'enviada' THEN 1 END) as encuestas_enviadas,
        COUNT(CASE WHEN estado = 'respondida' THEN 1 END) as encuestas_respondidas,
        COUNT(CASE WHEN estado = 'vencida' THEN 1 END) as encuestas_vencidas,
        ROUND(
          (COUNT(CASE WHEN estado = 'respondida' THEN 1 END)::DECIMAL / 
           NULLIF(COUNT(*), 0)) * 100, 2
        ) as tasa_respuesta
      FROM encuestas_satisfaccionSG
    `;
    
    const statsResult = await pool.query(statsQuery);
    
    // Promedio de satisfacción
    const satisfaccionQuery = `
      SELECT 
        AVG(puntuacion_total) as promedio_satisfaccion,
        COUNT(*) as total_respuestas,
        COUNT(CASE WHEN puntuacion_total >= 3.5 THEN 1 END) as respuestas_positivas,
        COUNT(CASE WHEN puntuacion_total < 2.5 THEN 1 END) as respuestas_negativas
      FROM respuestas_encuestaSG
    `;
    
    const satisfaccionResult = await pool.query(satisfaccionQuery);
    
    // Distribución por preguntas
    const distribucionQuery = `
      SELECT 
        'Atención Ventas' as pregunta,
        COUNT(CASE WHEN q1_atencion_ventas = 'muy-satisfecho' THEN 1 END) as muy_satisfecho,
        COUNT(CASE WHEN q1_atencion_ventas = 'satisfecho' THEN 1 END) as satisfecho,
        COUNT(CASE WHEN q1_atencion_ventas = 'no-satisfecho' THEN 1 END) as no_satisfecho,
        COUNT(CASE WHEN q1_atencion_ventas = 'molesto' THEN 1 END) as molesto
      FROM respuestas_encuestaSG
      WHERE q1_atencion_ventas IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'Calidad Productos' as pregunta,
        COUNT(CASE WHEN q2_calidad_productos = 'muy-satisfecho' THEN 1 END) as muy_satisfecho,
        COUNT(CASE WHEN q2_calidad_productos = 'satisfecho' THEN 1 END) as satisfecho,
        COUNT(CASE WHEN q2_calidad_productos = 'no-satisfecho' THEN 1 END) as no_satisfecho,
        COUNT(CASE WHEN q2_calidad_productos = 'molesto' THEN 1 END) as molesto
      FROM respuestas_encuestaSG
      WHERE q2_calidad_productos IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'Tiempo Entrega' as pregunta,
        COUNT(CASE WHEN q3_tiempo_entrega = 'muy-satisfecho' THEN 1 END) as muy_satisfecho,
        COUNT(CASE WHEN q3_tiempo_entrega = 'satisfecho' THEN 1 END) as satisfecho,
        COUNT(CASE WHEN q3_tiempo_entrega = 'no-satisfecho' THEN 1 END) as no_satisfecho,
        COUNT(CASE WHEN q3_tiempo_entrega = 'molesto' THEN 1 END) as molesto
      FROM respuestas_encuestaSG
      WHERE q3_tiempo_entrega IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'Servicio Logística' as pregunta,
        COUNT(CASE WHEN q4_servicio_logistica = 'muy-satisfecho' THEN 1 END) as muy_satisfecho,
        COUNT(CASE WHEN q4_servicio_logistica = 'satisfecho' THEN 1 END) as satisfecho,
        COUNT(CASE WHEN q4_servicio_logistica = 'no-satisfecho' THEN 1 END) as no_satisfecho,
        COUNT(CASE WHEN q4_servicio_logistica = 'molesto' THEN 1 END) as molesto
      FROM respuestas_encuestaSG
      WHERE q4_servicio_logistica IS NOT NULL
      
      UNION ALL
      
      SELECT 
        'Experiencia Compra' as pregunta,
        COUNT(CASE WHEN q5_experiencia_compra = 'muy-satisfecho' THEN 1 END) as muy_satisfecho,
        COUNT(CASE WHEN q5_experiencia_compra = 'satisfecho' THEN 1 END) as satisfecho,
        COUNT(CASE WHEN q5_experiencia_compra = 'no-satisfecho' THEN 1 END) as no_satisfecho,
        COUNT(CASE WHEN q5_experiencia_compra = 'molesto' THEN 1 END) as molesto
      FROM respuestas_encuestaSG
      WHERE q5_experiencia_compra IS NOT NULL
    `;
    
    const distribucionResult = await pool.query(distribucionQuery);
    
    // Encuestas por mes (últimos 12 meses)
    const mensualQuery = `
      SELECT 
        DATE_TRUNC('month', fecha_envio) as mes,
        COUNT(*) as encuestas_enviadas,
        COUNT(CASE WHEN estado = 'respondida' THEN 1 END) as encuestas_respondidas
      FROM encuestas_satisfaccionSG
      WHERE fecha_envio >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', fecha_envio)
      ORDER BY mes DESC
    `;
    
    const mensualResult = await pool.query(mensualQuery);
    
    const estadisticas = {
      generales: statsResult.rows[0],
      satisfaccion: satisfaccionResult.rows[0],
      distribucion: distribucionResult.rows,
      mensual: mensualResult.rows
    };
    
    res.json({
      success: true,
      data: estadisticas
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener respuestas de una encuesta específica
const obtenerRespuestasEncuesta = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        r.*,
        e.url_encuesta,
        c.nombre as cliente_nombre,
        c.empresa as cliente_empresa
      FROM respuestas_encuestaSG r
      JOIN encuestas_satisfaccionSG e ON r.id_encuesta = e.id_encuesta
      LEFT JOIN clientes c ON e.id_cliente = c.id_cliente
      WHERE r.id_encuesta = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error al obtener respuestas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Actualizar estado de encuesta
const actualizarEstadoEncuesta = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    
    const query = `
      UPDATE encuestas_satisfaccionSG 
      SET estado = $1, fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id_encuesta = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [estado, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Encuesta no encontrada' });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Estado actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  crearEncuesta,
  obtenerEncuestas,
  obtenerEncuestaPorId,
  guardarRespuesta,
  obtenerEstadisticasEncuestas,
  obtenerRespuestasEncuesta,
  actualizarEstadoEncuesta
};
