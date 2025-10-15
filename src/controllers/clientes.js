// Usar el pool correcto desde src/db/index.js
const { pool } = require('../db');

// Obtener todos los clientes
const getAllClientes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.*,
        COUNT(DISTINCT cot.id_cotizacion) as total_cotizaciones,
        COUNT(DISTINCT con.id_contrato) as total_contratos,
        COUNT(DISTINCT f.id_factura) as total_facturas,
        SUM(CASE WHEN f.estado = 'PAGADA' THEN f.total ELSE 0 END) as total_pagado
      FROM clientes c
      LEFT JOIN cotizaciones cot ON c.id_cliente = cot.id_cliente
      LEFT JOIN contratos con ON c.id_cliente = con.id_cliente
      LEFT JOIN facturas f ON c.id_cliente = f.id_cliente
      GROUP BY c.id_cliente
      ORDER BY c.nombre
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener cliente por ID (solo datos básicos para edición)
const getClienteById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Obteniendo cliente con ID:', id);
    
    // Primero verificar la estructura de la tabla
    const tableInfo = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'clientes' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('Columnas de la tabla clientes:', tableInfo.rows.map(r => r.column_name));
    
    // Intentar con id_cliente primero, luego con id
    let clienteResult;
    try {
      clienteResult = await pool.query('SELECT * FROM clientes WHERE id_cliente = $1', [id]);
    } catch (error) {
      console.log('Error con id_cliente, intentando con id:', error.message);
      clienteResult = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
    }
    
    if (clienteResult.rows.length === 0) {
      console.log('Cliente no encontrado con ID:', id);
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    const cliente = clienteResult.rows[0];
    console.log('Cliente encontrado:', cliente.nombre || cliente.empresa || 'Sin nombre');
    console.log('Datos del cliente:', Object.keys(cliente));
    
    res.json(cliente);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
};

// Obtener cliente por ID con historial completo
const getClienteByIdCompleto = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener datos básicos del cliente
    const clienteResult = await pool.query('SELECT * FROM clientes WHERE id_cliente = $1', [id]);
    
    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    const cliente = clienteResult.rows[0];
    
    // Obtener cotizaciones del cliente
    const cotizacionesResult = await pool.query(`
      SELECT 
        c.*,
        COUNT(ce.id_cotizacion_equipo) as total_equipos
      FROM cotizaciones c
      LEFT JOIN cotizacion_equipos ce ON c.id_cotizacion = ce.id_cotizacion
      WHERE c.id_cliente = $1
      GROUP BY c.id_cotizacion
      ORDER BY c.fecha_creacion DESC
    `, [id]);
    
    // Obtener contratos del cliente
    const contratosResult = await pool.query(`
      SELECT 
        con.*,
        COUNT(cp.id_contrato_producto) + COUNT(ca.id_contrato_accesorio) as total_items
      FROM contratos con
      LEFT JOIN contrato_producto cp ON con.id_contrato = cp.id_contrato
      LEFT JOIN contrato_accesorios ca ON con.id_contrato = ca.id_contrato
      WHERE con.id_cliente = $1
      GROUP BY con.id_contrato
      ORDER BY con.fecha_creacion DESC
    `, [id]);
    
    // Obtener facturas del cliente
    const facturasResult = await pool.query(`
      SELECT 
        f.*,
        COUNT(fc.id_factura_concepto) as total_conceptos,
        COALESCE(SUM(p.monto), 0) as total_pagado
      FROM facturas f
      LEFT JOIN factura_conceptos fc ON f.id_factura = fc.id_factura
      LEFT JOIN pagos p ON f.id_factura = p.id_factura AND p.estado = 'APLICADO'
      WHERE f.id_cliente = $1
      GROUP BY f.id_factura
      ORDER BY f.fecha_creacion DESC
    `, [id]);
    
    // Obtener pagos del cliente
    const pagosResult = await pool.query(`
      SELECT p.*, f.numero_factura, con.numero_contrato
      FROM pagos p
      LEFT JOIN facturas f ON p.id_factura = f.id_factura
      LEFT JOIN contratos con ON p.id_contrato = con.id_contrato
      WHERE f.id_cliente = $1 OR con.id_cliente = $1
      ORDER BY p.fecha_pago DESC
    `, [id]);
    
    // Calcular estadísticas
    const estadisticas = {
      total_cotizaciones: cotizacionesResult.rows.length,
      cotizaciones_activas: cotizacionesResult.rows.filter(c => c.estado === 'Enviada' || c.estado === 'Revisada').length,
      total_contratos: contratosResult.rows.length,
      contratos_activos: contratosResult.rows.filter(c => c.estado === 'ACTIVO').length,
      total_facturas: facturasResult.rows.length,
      facturas_pagadas: facturasResult.rows.filter(f => f.estado === 'PAGADA').length,
      total_facturado: facturasResult.rows.reduce((sum, f) => sum + parseFloat(f.total || 0), 0),
      total_pagado: facturasResult.rows.reduce((sum, f) => sum + parseFloat(f.total_pagado || 0), 0),
      saldo_pendiente: 0
    };
    
    estadisticas.saldo_pendiente = estadisticas.total_facturado - estadisticas.total_pagado;
    
    const clienteCompleto = {
      ...cliente,
      cotizaciones: cotizacionesResult.rows,
      contratos: contratosResult.rows,
      facturas: facturasResult.rows,
      pagos: pagosResult.rows,
      estadisticas
    };
    
    res.json(clienteCompleto);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Crear nuevo cliente
const createCliente = async (req, res) => {
  try {
    const {
      // Datos Básicos
      numero_cliente,
      clave,
      notificar,
      representante,
      nombre,
      rfc,
      curp,
      telefono,
      celular,
      email,
      comentario,
      numero_precio,
      limite_credito,
      dias_credito,
      grupo_entero,
      
      // Datos de Facturación
      fact_rfc,
      fact_iucr,
      razon_social,
      fact_curp,
      regimen_fiscal,
      uso_cfdi,
      domicilio,
      numero_ext,
      numero_int,
      codigo_postal,
      colonia,
      ciudad,
      localidad,
      estado_direccion,
      pais,
      aplican_retenciones,
      desglosar_ieps,
      
      // Campos existentes (compatibilidad)
      empresa,
      tipo_cliente,
      direccion,
      estado,
      contacto_principal,
      notas_evaluacion,
      segmento,
      deuda_actual,
      terminos_pago,
      metodo_pago,
      cal_general,
      cal_pago,
      cal_comunicacion,
      cal_equipos,
      cal_satisfaccion,
      fecha_evaluacion,
      notas_generales
    } = req.body;

    // Validaciones básicas
    if (!nombre || !email) {
      return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }

    // Validaciones adicionales
    if (fact_rfc && !regimen_fiscal) {
      return res.status(400).json({ error: 'Régimen fiscal es requerido cuando se proporciona RFC de facturación' });
    }

    const result = await pool.query(`
      INSERT INTO clientes (
        numero_cliente, clave, notificar, representante, nombre, rfc, curp, telefono, celular,
        email, comentario, numero_precio, limite_credito, dias_credito, grupo_entero,
        fact_rfc, fact_iucr, razon_social, fact_curp, regimen_fiscal, uso_cfdi,
        domicilio, numero_ext, numero_int, codigo_postal, colonia, ciudad, localidad,
        estado_direccion, pais, aplican_retenciones, desglosar_ieps,
        empresa, tipo, direccion, estado, contacto, segmento, deuda_actual,
        terminos_pago, metodo_pago, cal_general, cal_pago, cal_comunicacion,
        cal_equipos, cal_satisfaccion, fecha_evaluacion, notas_evaluacion, notas_generales
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41,
        $42, $43, $44, $45, $46, $47, $48, $49
      ) RETURNING *
    `, [
      numero_cliente, clave, notificar || false, representante, nombre, rfc, curp, telefono, celular,
      email, comentario, numero_precio || 1, limite_credito || 0, dias_credito || 30, grupo_entero || 0,
      fact_rfc, fact_iucr, razon_social, fact_curp, regimen_fiscal, uso_cfdi,
      domicilio, numero_ext, numero_int, codigo_postal, colonia, ciudad, localidad,
      estado_direccion, pais || 'MÉXICO', aplican_retenciones || false, desglosar_ieps || false,
      empresa || razon_social, tipo_cliente || 'Individual', direccion || domicilio, estado || 'Activo', 
      contacto_principal, segmento || 'Individual', deuda_actual || 0,
      terminos_pago, metodo_pago || 'Transferencia', cal_general, cal_pago, cal_comunicacion,
      cal_equipos, cal_satisfaccion, fecha_evaluacion, notas_evaluacion, notas_generales
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear cliente:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'El email ya está registrado' });
    } else {
      res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }
  }
};

// Actualizar cliente
const updateCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      // Datos Básicos
      numero_cliente,
      clave,
      notificar,
      representante,
      nombre,
      rfc,
      curp,
      telefono,
      celular,
      email,
      comentario,
      numero_precio,
      limite_credito,
      dias_credito,
      grupo_entero,
      
      // Datos de Facturación
      fact_rfc,
      fact_iucr,
      razon_social,
      fact_curp,
      regimen_fiscal,
      uso_cfdi,
      domicilio,
      numero_ext,
      numero_int,
      codigo_postal,
      colonia,
      ciudad,
      localidad,
      estado_direccion,
      pais,
      aplican_retenciones,
      desglosar_ieps,
      
      // Campos existentes (compatibilidad)
      empresa,
      tipo_cliente,
      direccion,
      estado,
      contacto_principal,
      notas_evaluacion,
      segmento,
      deuda_actual,
      terminos_pago,
      metodo_pago,
      cal_general,
      cal_pago,
      cal_comunicacion,
      cal_equipos,
      cal_satisfaccion,
      fecha_evaluacion,
      notas_generales
    } = req.body;

    // Validaciones básicas
    if (!nombre || !email) {
      return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }

    // Validaciones adicionales
    if (fact_rfc && !regimen_fiscal) {
      return res.status(400).json({ error: 'Régimen fiscal es requerido cuando se proporciona RFC de facturación' });
    }

    const result = await pool.query(`
      UPDATE clientes SET 
        numero_cliente = $1, clave = $2, notificar = $3, representante = $4, nombre = $5,
        rfc = $6, curp = $7, telefono = $8, celular = $9, email = $10, comentario = $11,
        numero_precio = $12, limite_credito = $13, dias_credito = $14, grupo_entero = $15,
        fact_rfc = $16, fact_iucr = $17, razon_social = $18, fact_curp = $19, regimen_fiscal = $20,
        uso_cfdi = $21, domicilio = $22, numero_ext = $23, numero_int = $24, codigo_postal = $25,
        colonia = $26, ciudad = $27, localidad = $28, estado_direccion = $29, pais = $30,
        aplican_retenciones = $31, desglosar_ieps = $32, empresa = $33, tipo_cliente = $34,
        direccion = $35, estado = $36, contacto = $37, segmento = $38, deuda_actual = $39,
        terminos_pago = $40, metodo_pago = $41, cal_general = $42, cal_pago = $43,
        cal_comunicacion = $44, cal_equipos = $45, cal_satisfaccion = $46, fecha_evaluacion = $47,
        notas_evaluacion = $48, notas_generales = $49
      WHERE id_cliente = $50 RETURNING *
    `, [
      numero_cliente, clave, notificar, representante, nombre, rfc, curp, telefono, celular,
      email, comentario, numero_precio, limite_credito, dias_credito, grupo_entero,
      fact_rfc, fact_iucr, razon_social, fact_curp, regimen_fiscal, uso_cfdi,
      domicilio, numero_ext, numero_int, codigo_postal, colonia, ciudad, localidad,
      estado_direccion, pais, aplican_retenciones, desglosar_ieps,
      empresa || razon_social, tipo_cliente, direccion || domicilio, estado, contacto_principal,
      segmento, deuda_actual, terminos_pago, metodo_pago, cal_general, cal_pago,
      cal_comunicacion, cal_equipos, cal_satisfaccion, fecha_evaluacion,
      notas_evaluacion, notas_generales, id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'El email ya está registrado por otro cliente' });
    } else {
      res.status(500).json({ error: 'Error interno del servidor', details: error.message });
    }
  }
};

// Eliminar cliente
const deleteCliente = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si el cliente tiene cotizaciones, contratos o facturas
    const checkResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM cotizaciones WHERE id_cliente = $1) as cotizaciones,
        (SELECT COUNT(*) FROM contratos WHERE id_cliente = $1) as contratos,
        (SELECT COUNT(*) FROM facturas WHERE id_cliente = $1) as facturas
    `, [id]);
    
    const { cotizaciones, contratos, facturas } = checkResult.rows[0];
    
    if (parseInt(cotizaciones) > 0 || parseInt(contratos) > 0 || parseInt(facturas) > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar el cliente porque tiene registros asociados',
        detalles: {
          cotizaciones: parseInt(cotizaciones),
          contratos: parseInt(contratos),
          facturas: parseInt(facturas)
        }
      });
    }
    
    const result = await pool.query('DELETE FROM clientes WHERE id_cliente = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json({ message: 'Cliente eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Buscar clientes
const searchClientes = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }
    
    const result = await pool.query(`
      SELECT 
        c.*,
        COUNT(DISTINCT cot.id_cotizacion) as total_cotizaciones,
        COUNT(DISTINCT con.id_contrato) as total_contratos,
        COUNT(DISTINCT f.id_factura) as total_facturas
      FROM clientes c
      LEFT JOIN cotizaciones cot ON c.id_cliente = cot.id_cliente
      LEFT JOIN contratos con ON c.id_cliente = con.id_cliente
      LEFT JOIN facturas f ON c.id_cliente = f.id_cliente
      WHERE 
        c.nombre ILIKE $1 OR 
        c.email ILIKE $1 OR 
        c.telefono ILIKE $1 OR 
        c.celular ILIKE $1 OR
        c.rfc ILIKE $1 OR
        c.fact_rfc ILIKE $1 OR
        c.razon_social ILIKE $1 OR
        c.numero_cliente ILIKE $1 OR
        c.clave ILIKE $1 OR
        c.empresa ILIKE $1
      GROUP BY c.id_cliente
      ORDER BY c.nombre
      LIMIT 20
    `, [`%${q}%`]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al buscar clientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener estadísticas de clientes
const getClientesStats = async (req, res) => {
  try {
    // Estadísticas básicas de clientes
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_clientes,
        COUNT(CASE WHEN estado = 'Activo' THEN 1 END) as clientes_activos,
        COUNT(CASE WHEN tipo_cliente = 'Corporativo' THEN 1 END) as empresas,
        COUNT(CASE WHEN tipo_cliente = 'Individual' THEN 1 END) as personas,
        COUNT(CASE WHEN fecha_creacion >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as nuevos_ultimo_mes,
        AVG(CASE WHEN cal_general IS NOT NULL THEN cal_general END) as calificacion_promedio,
        SUM(COALESCE(valor_total, 0)) as ingresos_totales
      FROM clientes
    `);
    
    // Distribución por ciudad
    const ciudadesResult = await pool.query(`
      SELECT 
        ciudad,
        COUNT(*) as cantidad
      FROM clientes
      WHERE ciudad IS NOT NULL
      GROUP BY ciudad
      ORDER BY cantidad DESC
      LIMIT 10
    `);
    
    // Distribución por tipo de cliente
    const tiposResult = await pool.query(`
      SELECT 
        tipo_cliente,
        COUNT(*) as cantidad
      FROM clientes
      WHERE tipo_cliente IS NOT NULL
      GROUP BY tipo_cliente
    `);
    
    // Clientes con mejor calificación
    const topClientesResult = await pool.query(`
      SELECT 
        nombre,
        empresa,
        cal_general,
        valor_total,
        proyectos
      FROM clientes
      WHERE cal_general IS NOT NULL
      ORDER BY cal_general DESC, valor_total DESC
      LIMIT 5
    `);
    
    // Métricas de satisfacción (de la tabla clientes)
    const satisfaccionResult = await pool.query(`
      SELECT 
        AVG(CASE WHEN cal_general IS NOT NULL THEN cal_general END) as calificacion_general,
        AVG(CASE WHEN cal_pago IS NOT NULL THEN cal_pago END) as calificacion_pago,
        AVG(CASE WHEN cal_comunicacion IS NOT NULL THEN cal_comunicacion END) as calificacion_comunicacion,
        AVG(CASE WHEN cal_equipos IS NOT NULL THEN cal_equipos END) as calificacion_equipos,
        AVG(CASE WHEN cal_satisfaccion IS NOT NULL THEN cal_satisfaccion END) as calificacion_satisfaccion,
        COUNT(CASE WHEN cal_general >= 4 THEN 1 END) as clientes_satisfechos,
        COUNT(CASE WHEN cal_general < 3 THEN 1 END) as clientes_insatisfechos
      FROM clientes
      WHERE cal_general IS NOT NULL
    `);
    
    // Estadísticas de encuestas de satisfacción
    const encuestasResult = await pool.query(`
      SELECT 
        COUNT(*) as total_encuestas,
        COUNT(CASE WHEN estado = 'respondida' THEN 1 END) as encuestas_respondidas,
        ROUND(
          (COUNT(CASE WHEN estado = 'respondida' THEN 1 END)::DECIMAL / 
           NULLIF(COUNT(*), 0)) * 100, 2
        ) as tasa_respuesta_encuestas
      FROM encuestas_satisfaccionSG
    `);
    
    // Promedio de satisfacción de encuestas
    const promedioEncuestasResult = await pool.query(`
      SELECT 
        AVG(puntuacion_total) as promedio_encuestas,
        COUNT(*) as total_respuestas_encuestas
      FROM respuestas_encuestaSG
    `);
    
    const stats = {
      resumen: statsResult.rows[0],
      ciudades: ciudadesResult.rows,
      tipos: tiposResult.rows,
      top_clientes: topClientesResult.rows,
      satisfaccion: satisfaccionResult.rows[0],
      encuestas: {
        ...encuestasResult.rows[0],
        ...promedioEncuestasResult.rows[0]
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener historial completo del cliente
const getClienteHistorial = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener datos básicos del cliente
    const clienteResult = await pool.query('SELECT * FROM clientes WHERE id_cliente = $1', [id]);
    
    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    const cliente = clienteResult.rows[0];
    
    // Obtener historial de cambios (simulado - puedes implementar una tabla de auditoría)
    const historialCambios = [
      {
        fecha: cliente.fecha_creacion,
        accion: 'Cliente creado',
        detalles: `Cliente ${cliente.nombre} registrado en el sistema`,
        usuario: 'Sistema'
      },
      {
        fecha: cliente.fecha_actualizacion || cliente.fecha_creacion,
        accion: 'Última actualización',
        detalles: 'Información del cliente actualizada',
        usuario: 'Usuario'
      }
    ];
    
    // Obtener proyectos/cotizaciones relacionadas (simulado)
    const proyectos = [
      {
        id: 1,
        nombre: `Proyecto para ${cliente.nombre}`,
        fecha: cliente.fecha_creacion,
        estado: 'Completado',
        valor: cliente.valor_total || 0
      }
    ];
    
    // Obtener interacciones recientes
    const interacciones = [
      {
        fecha: new Date(),
        tipo: 'Llamada',
        descripcion: 'Seguimiento de proyecto',
        usuario: 'Ventas'
      },
      {
        fecha: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        tipo: 'Email',
        descripcion: 'Envío de cotización',
        usuario: 'Ventas'
      }
    ];
    
    const historial = {
      cliente,
      cambios: historialCambios,
      proyectos,
      interacciones,
      estadisticas: {
        proyectos_completados: proyectos.filter(p => p.estado === 'Completado').length,
        valor_total_proyectos: proyectos.reduce((sum, p) => sum + p.valor, 0),
        ultima_interaccion: interacciones[0]?.fecha,
        calificacion_promedio: cliente.cal_general || 0
      }
    };
    
    res.json(historial);
  } catch (error) {
    console.error('Error al obtener historial del cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Buscar cliente por RFC (para facturación)
const getClienteByRFC = async (req, res) => {
  try {
    const { rfc } = req.params;
    
    if (!rfc) {
      return res.status(400).json({ error: 'RFC es requerido' });
    }
    
    const result = await pool.query(`
      SELECT * FROM clientes 
      WHERE rfc = $1 OR fact_rfc = $1
      ORDER BY fecha_creacion DESC
      LIMIT 1
    `, [rfc.toUpperCase()]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado con ese RFC' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al buscar cliente por RFC:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Validar RFC del SAT
const validateRFC = async (req, res) => {
  try {
    const { rfc } = req.params;
    
    // Validación básica de formato RFC
    const rfcRegex = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
    
    if (!rfcRegex.test(rfc.toUpperCase())) {
      return res.json({ 
        valid: false, 
        message: 'Formato de RFC inválido' 
      });
    }
    
    // Verificar si ya existe en la base de datos
    const existingResult = await pool.query(`
      SELECT id_cliente, nombre, razon_social 
      FROM clientes 
      WHERE rfc = $1 OR fact_rfc = $1
    `, [rfc.toUpperCase()]);
    
    if (existingResult.rows.length > 0) {
      return res.json({
        valid: true,
        exists: true,
        cliente: existingResult.rows[0],
        message: 'RFC ya registrado en el sistema'
      });
    }
    
    res.json({
      valid: true,
      exists: false,
      message: 'RFC válido y disponible'
    });
  } catch (error) {
    console.error('Error al validar RFC:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getAllClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
  searchClientes,
  getClienteByRFC,
  validateRFC,
  getClientesStats,
  getClienteHistorial
}; 