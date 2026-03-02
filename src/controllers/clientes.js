// Usar el pool correcto desde src/db/index.js
const { pool } = require('../db');
const PDFService = require('../services/pdfService');
const pdfService = new PDFService();

// Obtener todos los clientes
// Función auxiliar para calcular estado
const calcularEstadoCliente = (cliente, lastActivity) => {
  // 1. Prioridad: Lista Negra manual
  if (cliente.estado === 'Lista Negra') return 'Lista Negra';

  // 2. Si no hay actividad, usar el estado manual o 'Inactivo' por defecto
  if (!lastActivity) {
    // Si tiene fecha de creación antigua y no hay actividad, es inactivo
    const diasDesdeCreacion = (new Date() - new Date(cliente.fecha_creacion)) / (1000 * 60 * 60 * 24);
    if (diasDesdeCreacion > 365) return 'Inactivo';
    return cliente.estado || 'Inactivo';
  }

  const diffTime = Math.abs(new Date() - new Date(lastActivity));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // 3. Reglas de negocio
  // Activo: < 60 días
  if (diffDays <= 60) return 'Activo';

  // Regular: 2 meses (60 días) a 1 año (365 días)
  if (diffDays <= 365) return 'Regular';

  // Inactivo: > 1 año
  return 'Inactivo';
};

// Obtener todos los clientes con cálculo dinámico de estado
const getAllClientes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.*,
        COUNT(DISTINCT cot.id_cotizacion) as total_cotizaciones,
        COUNT(DISTINCT con.id_contrato) as total_contratos,
        COUNT(DISTINCT f.id_factura) as total_facturas,
        SUM(CASE WHEN f.estado = 'PAGADA' THEN f.total ELSE 0 END) as total_pagado,
        -- Obtener fechas de última actividad
        MAX(cot.fecha_creacion) as ultima_cotizacion,
        MAX(con.fecha_creacion) as ultimo_contrato,
        MAX(f.fecha_creacion) as ultima_factura
      FROM clientes c
      LEFT JOIN cotizaciones cot ON c.id_cliente = cot.id_cliente
      LEFT JOIN contratos con ON c.id_cliente = con.id_cliente
      LEFT JOIN facturas f ON c.id_cliente = f.id_cliente
      GROUP BY c.id_cliente
      ORDER BY c.nombre
    `);

    // Procesar estados
    const clientes = result.rows.map(cliente => {
      // Determinar la fecha de última actividad más reciente
      const fechas = [
        cliente.ultima_cotizacion,
        cliente.ultimo_contrato,
        cliente.ultima_factura
      ].filter(d => d).map(d => new Date(d));

      let lastActivity = null;
      if (fechas.length > 0) {
        lastActivity = new Date(Math.max(...fechas));
      }

      const nuevoEstado = calcularEstadoCliente(cliente, lastActivity);

      return {
        ...cliente,
        estado: nuevoEstado, // Sobrescribir estado (o mantener manual si es Lista Negra)
        estado_calculado: nuevoEstado, // Campo extra informativo
        ultima_actividad: lastActivity
      };
    });

    res.json(clientes);
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

    // Helper para sanitizar strings (convertir '' a null)
    const sanitizeString = (val) => (val && val.trim() !== '' ? val.trim() : null);

    // Validaciones básicas
    // if (!nombre || !email) {
    //   return res.status(400).json({ error: 'Nombre y email son requeridos' });
    // }

    // Validaciones adicionales
    // if (fact_rfc && !regimen_fiscal) {
    //   return res.status(400).json({ error: 'Régimen fiscal es requerido cuando se proporciona RFC de facturación' });
    // }

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
      numero_cliente, clave, notificar || false, representante, nombre, sanitizeString(rfc), curp, telefono, celular,
      sanitizeString(email), comentario, numero_precio || 1, limite_credito || 0, dias_credito || 30, grupo_entero || 0,
      sanitizeString(fact_rfc), fact_iucr, razon_social, fact_curp, regimen_fiscal, uso_cfdi,
      domicilio, numero_ext, numero_int, codigo_postal, colonia, ciudad, localidad,
      estado_direccion, pais || 'MÉXICO', aplican_retenciones || false, desglosar_ieps || false,
      empresa || razon_social, tipo_cliente || 'Individual', direccion || domicilio, estado || 'Activo',
      contacto_principal || representante, segmento || 'Individual', deuda_actual || 0,
      terminos_pago, metodo_pago || 'Transferencia', cal_general, cal_pago, cal_comunicacion,
      cal_equipos, cal_satisfaccion, fecha_evaluacion, notas_evaluacion, notas_generales
    ]);

    // Notificación
    // TODO: Implementar sistema de notificaciones
    // await crearNotificacionInterna(
    //   'NUEVO_CLIENTE',
    //   `Se ha registrado un nuevo cliente: ${nombre} (${empresa || razon_social || 'Individual'})`,
    //   'Media'
    // );

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
    // if (!nombre || !email) {
    //   return res.status(400).json({ error: 'Nombre y email son requeridos' });
    // }

    // Validaciones adicionales
    // if (fact_rfc && !regimen_fiscal) {
    //   return res.status(400).json({ error: 'Régimen fiscal es requerido cuando se proporciona RFC de facturación' });
    // }

    // Sanitizar campos numéricos - convertir cadenas vacías a null
    const sanitizeNumeric = (value) => {
      if (value === '' || value === undefined || value === null) return null;
      const num = Number(value);
      return isNaN(num) ? null : num;
    };

    // Helper para sanitizar strings (convertir '' a null)
    const sanitizeString = (val) => (val && val.trim() !== '' ? val.trim() : null);

    const result = await pool.query(`
      UPDATE clientes SET 
        numero_cliente = $1, clave = $2, notificar = $3, representante = $4, nombre = $5,
        rfc = $6, curp = $7, telefono = $8, celular = $9, email = $10, comentario = $11,
        numero_precio = $12, limite_credito = $13, dias_credito = $14, grupo_entero = $15,
        fact_rfc = $16, fact_iucr = $17, razon_social = $18, fact_curp = $19, regimen_fiscal = $20,
        uso_cfdi = $21, domicilio = $22, numero_ext = $23, numero_int = $24, codigo_postal = $25,
        colonia = $26, ciudad = $27, localidad = $28, estado_direccion = $29, pais = $30,
        aplican_retenciones = $31, desglosar_ieps = $32, empresa = COALESCE($33, empresa), tipo = COALESCE($34, tipo),
        direccion = $35, estado = $36, contacto = $37, segmento = $38, deuda_actual = $39,
        terminos_pago = $40, metodo_pago = $41, cal_general = $42, cal_pago = $43,
        cal_comunicacion = $44, cal_equipos = $45, cal_satisfaccion = $46, fecha_evaluacion = $47,
        notas_evaluacion = $48, notas_generales = $49
      WHERE id_cliente = $50 RETURNING *
    `, [
      numero_cliente, clave, notificar, representante, nombre, sanitizeString(rfc), curp, telefono, celular,
      sanitizeString(email), comentario, sanitizeNumeric(numero_precio), sanitizeNumeric(limite_credito),
      sanitizeNumeric(dias_credito), sanitizeNumeric(grupo_entero),
      sanitizeString(fact_rfc), fact_iucr, razon_social, fact_curp, regimen_fiscal, uso_cfdi,
      domicilio, numero_ext, numero_int, codigo_postal, colonia, ciudad, localidad,
      estado_direccion, pais, aplican_retenciones, desglosar_ieps,
      empresa || razon_social, tipo_cliente, direccion || domicilio, estado, contacto_principal,
      segmento, sanitizeNumeric(deuda_actual), sanitizeNumeric(terminos_pago), metodo_pago,
      sanitizeNumeric(cal_general), sanitizeNumeric(cal_pago),
      sanitizeNumeric(cal_comunicacion), sanitizeNumeric(cal_equipos), sanitizeNumeric(cal_satisfaccion),
      fecha_evaluacion || null, notas_evaluacion, notas_generales, id
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
        COUNT(DISTINCT f.id_factura) as total_facturas,
        -- Obtener fechas de última actividad
        MAX(cot.fecha_creacion) as ultima_cotizacion,
        MAX(con.fecha_creacion) as ultimo_contrato,
        MAX(f.fecha_creacion) as ultima_factura
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

    // Procesar estados (misma lógica que getAllClientes)
    const clientes = result.rows.map(cliente => {
      const fechas = [
        cliente.ultima_cotizacion,
        cliente.ultimo_contrato,
        cliente.ultima_factura
      ].filter(d => d).map(d => new Date(d));

      let lastActivity = null;
      if (fechas.length > 0) {
        lastActivity = new Date(Math.max(...fechas));
      }

      // Assuming calcularEstadoCliente is defined elsewhere or imported
      const nuevoEstado = calcularEstadoCliente(cliente, lastActivity);

      return {
        ...cliente,
        estado: nuevoEstado,
        estado_calculado: nuevoEstado,
        ultima_actividad: lastActivity
      };
    });

    res.json(clientes);
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
        SUM(COALESCE(valor_total, 0)) as ingresos_totales,
        (SELECT COUNT(*) FROM credit_notes) as total_notas_credito,
        (SELECT COALESCE(SUM(total),0) FROM credit_notes) as monto_notas_credito
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

    // Métricas de satisfacción (de la tabla respuestas_encuestaSG)
    // Convertir valores de texto a números (molesto=1, no-satisfecho=2, satisfecho=3, muy-satisfecho=4)
    const satisfaccionResult = await pool.query(`
      SELECT 
        -- Calcular promedio de cada pregunta usando CASE WHEN para convertir texto a número
        AVG(CASE 
          WHEN q1_atencion_ventas = 'molesto' THEN 1
          WHEN q1_atencion_ventas = 'no-satisfecho' THEN 2
          WHEN q1_atencion_ventas = 'satisfecho' THEN 3
          WHEN q1_atencion_ventas = 'muy-satisfecho' THEN 4
          ELSE NULL END) as calificacion_atencion_ventas,
        
        AVG(CASE 
          WHEN q2_calidad_productos = 'molesto' THEN 1
          WHEN q2_calidad_productos = 'no-satisfecho' THEN 2
          WHEN q2_calidad_productos = 'satisfecho' THEN 3
          WHEN q2_calidad_productos = 'muy-satisfecho' THEN 4
          ELSE NULL END) as calificacion_calidad_productos,
        
        AVG(CASE 
          WHEN q3_tiempo_entrega = 'molesto' THEN 1
          WHEN q3_tiempo_entrega = 'no-satisfecho' THEN 2
          WHEN q3_tiempo_entrega = 'satisfecho' THEN 3
          WHEN q3_tiempo_entrega = 'muy-satisfecho' THEN 4
          ELSE NULL END) as calificacion_tiempo_entrega,
        
        AVG(CASE 
          WHEN q4_servicio_logistica = 'molesto' THEN 1
          WHEN q4_servicio_logistica = 'no-satisfecho' THEN 2
          WHEN q4_servicio_logistica = 'satisfecho' THEN 3
          WHEN q4_servicio_logistica = 'muy-satisfecho' THEN 4
          ELSE NULL END) as calificacion_logistica,
        
        AVG(CASE 
          WHEN q5_experiencia_compra = 'molesto' THEN 1
          WHEN q5_experiencia_compra = 'no-satisfecho' THEN 2
          WHEN q5_experiencia_compra = 'satisfecho' THEN 3
          WHEN q5_experiencia_compra = 'muy-satisfecho' THEN 4
          ELSE NULL END) as calificacion_experiencia_compra,
        
        -- Contar clientes satisfechos (promedio >= 3) e insatisfechos (promedio < 2.5)
        COUNT(CASE WHEN puntuacion_total >= 3 THEN 1 END) as clientes_satisfechos,
        COUNT(CASE WHEN puntuacion_total < 2.5 THEN 1 END) as clientes_insatisfechos
      FROM respuestas_encuestaSG
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

    // Obtener sugerencias de clientes (de encuestas de satisfacción)
    const sugerenciasResult = await pool.query(`
      SELECT 
        res.id_respuesta,
        res.nombre_cliente,
        res.email_cliente,
        res.sugerencias,
        res.puntuacion_total,
        res.fecha_respuesta
      FROM respuestas_encuestaSG res
      WHERE res.sugerencias IS NOT NULL AND res.sugerencias != ''
      ORDER BY res.fecha_respuesta DESC
      LIMIT 10
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
      },
      sugerencias: sugerenciasResult.rows
    };

    res.json(stats);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener historial completo del cliente con cotizaciones y clones
const getClienteHistorial = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener datos básicos del cliente
    const clienteResult = await pool.query('SELECT * FROM clientes WHERE id_cliente = $1', [id]);

    if (clienteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const cliente = clienteResult.rows[0];

    // Obtener cotizaciones del cliente con información de clones
    const cotizacionesResult = await pool.query(`
      SELECT 
        c.*,
        u.nombre as vendedor_nombre,
        CASE 
          WHEN c.es_clon = true THEN 'Clonada'
          ELSE 'Original'
        END as tipo_cotizacion,
        c.clon_de_folio,
        c.motivo_cambio,
        (SELECT COUNT(*) FROM cotizaciones WHERE cotizacion_origen = c.id_cotizacion) as total_clones_generados
      FROM cotizaciones c
      LEFT JOIN usuarios u ON c.id_vendedor = u.id_usuario
      WHERE c.id_cliente = $1
      ORDER BY c.fecha_creacion DESC
    `, [id]);

    // Obtener contratos del cliente (si la tabla existe)
    let contratosResult = { rows: [] };
    try {
      contratosResult = await pool.query(`
        SELECT con.*
        FROM contratos con
        WHERE con.id_cliente = $1
        ORDER BY con.fecha_creacion DESC
      `, [id]);
    } catch (error) {
      console.log('Tabla contratos no existe o error en consulta:', error.message);
    }

    // Obtener facturas del cliente (si la tabla existe)
    let facturasResult = { rows: [] };
    try {
      facturasResult = await pool.query(`
        SELECT 
          f.*,
          COALESCE(SUM(p.monto), 0) as total_pagado,
          f.total - COALESCE(SUM(p.monto), 0) as saldo_pendiente
        FROM facturas f
        LEFT JOIN pagos p ON f.id_factura = p.id_factura AND p.estado = 'APLICADO'
        WHERE f.id_cliente = $1
        GROUP BY f.id_factura
        ORDER BY f.fecha_creacion DESC
      `, [id]);
    } catch (error) {
      console.log('Tabla facturas no existe o error en consulta:', error.message);
    }

    // Obtener pagos del cliente (si las tablas existen)
    let pagosResult = { rows: [] };
    try {
      pagosResult = await pool.query(`
        SELECT 
          p.*, 
          f.numero_factura,
          f.total as monto_factura
        FROM pagos p
        LEFT JOIN facturas f ON p.id_factura = f.id_factura
        WHERE f.id_cliente = $1
        ORDER BY p.fecha_pago DESC
      `, [id]);
    } catch (error) {
      console.log('Tabla pagos no existe o error en consulta:', error.message);
    }

    // Obtener notas de crédito del cliente
    let creditNotesResult = { rows: [] };
    try {
      creditNotesResult = await pool.query(`
        SELECT * FROM credit_notes WHERE id_cliente = $1 ORDER BY fecha_creacion DESC
      `, [id]);
    } catch (error) {
      console.log('Tabla credit_notes no existe o error en consulta:', error.message);
    }

    // Obtener ledger financiero del cliente
    let ledgerResult = { rows: [] };
    try {
      ledgerResult = await pool.query(`
        SELECT * FROM customer_ledger WHERE id_cliente = $1 ORDER BY fecha DESC
      `, [id]);
    } catch (error) {
      console.log('Tabla customer_ledger no existe o error en consulta:', error.message);
    }

    // Calcular estadísticas detalladas
    const cotizaciones = cotizacionesResult.rows;
    const contratos = contratosResult.rows;
    const facturas = facturasResult.rows;
    const pagos = pagosResult.rows;
    const creditNotes = creditNotesResult.rows;
    const ledger = ledgerResult.rows;

    // Estadísticas de cotizaciones
    const cotizacionesOriginales = cotizaciones.filter(c => !c.es_clon);
    const cotizacionesClonadas = cotizaciones.filter(c => c.es_clon);
    const totalClonesGenerados = cotizaciones.reduce((sum, c) => sum + parseInt(c.total_clones_generados || 0), 0);

    // Estadísticas financieras
    const totalFacturado = facturas.reduce((sum, f) => sum + parseFloat(f.total || 0), 0);
    const totalPagado = facturas.reduce((sum, f) => sum + parseFloat(f.total_pagado || 0), 0);
    const totalNC = creditNotes.reduce((sum, n) => sum + parseFloat(n.total || 0), 0);
    const saldoPendiente = totalFacturado - totalPagado - totalNC;

    const estadisticas = {
      // Cotizaciones
      total_cotizaciones: cotizaciones.length,
      cotizaciones_originales: cotizacionesOriginales.length,
      cotizaciones_clonadas: cotizacionesClonadas.length,
      total_clones_generados: totalClonesGenerados,
      cotizaciones_por_estado: {
        borrador: cotizaciones.filter(c => c.estado === 'Borrador').length,
        enviada: cotizaciones.filter(c => c.estado === 'Enviada').length,
        aprobada: cotizaciones.filter(c => c.estado === 'Aprobada').length,
        rechazada: cotizaciones.filter(c => c.estado === 'Rechazada').length
      },

      // Contratos
      total_contratos: contratos.length,
      contratos_activos: contratos.filter(c => c.estado === 'ACTIVO').length,

      // Facturas
      total_facturas: facturas.length,
      facturas_pagadas: facturas.filter(f => f.estado === 'PAGADA').length,
      facturas_pendientes: facturas.filter(f => f.estado === 'PENDIENTE').length,

      // Financiero
      total_facturado: totalFacturado,
      total_pagado: totalPagado,
      saldo_pendiente: saldoPendiente,

      // Notas de crédito
      total_notas_credito: creditNotes.length,
      total_nc_monto: creditNotes.reduce((sum, nc) => sum + parseFloat(nc.total || 0), 0),

      // Crédito disponible (simple cálculo)
      credito_disponible: (cliente.limite_credito || 0) - saldoPendiente,

      // Actividad
      ultima_cotizacion: cotizaciones[0]?.fecha_creacion || null,
      ultimo_contrato: contratos[0]?.fecha_creacion || null,
      ultimo_pago: pagos[0]?.fecha_pago || null
    };

    const historial = {
      cliente,
      cotizaciones,
      contratos,
      facturas,
      pagos,
      estadisticas,
      notas_credito: creditNotes,
      ledger: ledger
    };

    res.json(historial);
  } catch (error) {
    console.error('Error al obtener historial del cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener ledger financiero de un cliente con filtros simples
const getClienteLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { tipo, start, end, page = 1, limit = 50 } = req.query;
    let query = 'SELECT * FROM customer_ledger WHERE id_cliente = $1';
    const params = [id];
    if (tipo) { params.push(tipo); query += ` AND tipo_mov = $${params.length}`; }
    if (start) { params.push(start); query += ` AND fecha >= $${params.length}`; }
    if (end) { params.push(end); query += ` AND fecha <= $${params.length}`; }
    query += ' ORDER BY fecha DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error al obtener ledger del cliente:', error);
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

// Obtener clientes con crédito pendiente
const getClientesConCredito = async (req, res) => {
  try {
    // Primero traemos todos los clientes con límite de crédito
    const clientesResult = await pool.query(`
      SELECT 
        id_cliente,
        nombre,
        telefono,
        celular,
        limite_credito,
        dias_credito,
        tipo_cliente,
        estado
      FROM clientes
      WHERE limite_credito > 0
      ORDER BY nombre ASC
    `);

    console.log(`📌 Clientes con límite de crédito encontrados: ${clientesResult.rows.length}`);

    // Si no hay clientes con crédito, retornar vacío
    if (!clientesResult.rows || clientesResult.rows.length === 0) {
      return res.json([]);
    }

    // Para cada cliente, calcular su deuda
    const clientes = await Promise.all(
      clientesResult.rows.map(async (cliente) => {
        try {
          // Obtener deuda del customer_ledger si existe
          // Busca CARGO (débito) y ABONO (crédito)
          // También busca COBRO_CREDITO como cargo
          const deudaResult = await pool.query(`
            SELECT 
              COALESCE(SUM(CASE 
                WHEN tipo_mov IN ('CARGO', 'COBRO_CREDITO', 'COBRO') THEN cargo 
                ELSE 0 
              END), 0) as total_cargo,
              COALESCE(SUM(CASE 
                WHEN tipo_mov IN ('ABONO', 'PAGO') THEN abono 
                ELSE 0 
              END), 0) as total_abono
            FROM customer_ledger
            WHERE id_cliente = $1
          `, [cliente.id_cliente]);

          let deuda = 0;
          if (deudaResult.rows && deudaResult.rows[0]) {
            const { total_cargo, total_abono } = deudaResult.rows[0];
            deuda = parseFloat(total_cargo || 0) - parseFloat(total_abono || 0);
          }

          // Solo incluir si tiene deuda O si es cliente nuevo con crédito disponible
          const creditoDisponible = parseFloat(cliente.limite_credito || 0) - deuda;

          return {
            id: cliente.id_cliente,
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            celular: cliente.celular,
            limite_credito: parseFloat(cliente.limite_credito || 0),
            dias_credito: cliente.dias_credito || 0,
            deuda: deuda,
            creditoDisponible: creditoDisponible,
            estado: deuda > 0 ? 'activo' : 'pagado',
            tipo_cliente: cliente.tipo_cliente,
            cliente_estado: cliente.estado
          };
        } catch (err) {
          console.error('Error calculando deuda para cliente', cliente.id_cliente, err);
          // Retornar cliente sin deuda en caso de error
          return {
            id: cliente.id_cliente,
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            celular: cliente.celular,
            limite_credito: parseFloat(cliente.limite_credito || 0),
            dias_credito: cliente.dias_credito || 0,
            deuda: 0,
            creditoDisponible: parseFloat(cliente.limite_credito || 0),
            estado: 'activo'
          };
        }
      })
    );

    // Filtrar clientes que al menos tengan crédito disponible o deuda
    const clientesFiltrados = clientes
      .filter(c => c.creditoDisponible >= 0 || c.deuda > 0)
      .sort((a, b) => b.deuda - a.deuda);

    console.log(`✅ Clientes con crédito cargados: ${clientesFiltrados.length}`);
    if (clientesFiltrados.length > 0) {
      console.log('   Resumen:', clientesFiltrados.slice(0, 3).map(c => 
        `${c.nombre}: $${c.deuda.toFixed(2)} deuda, $${c.creditoDisponible.toFixed(2)} disponible`
      ).join('; '));
    }
    
    res.json(clientesFiltrados);

  } catch (error) {
    console.error('❌ Error al obtener clientes con crédito:', error);
    res.status(500).json({ 
      error: 'Error al obtener clientes con crédito', 
      details: error.message,
      type: error.code 
    });
  }
};

const calcularDeudaCliente = async (clienteId) => {
  const deudaResult = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo_mov IN ('CARGO', 'COBRO_CREDITO', 'COBRO') THEN cargo ELSE 0 END), 0) AS total_cargo,
      COALESCE(SUM(CASE WHEN tipo_mov IN ('ABONO', 'PAGO', 'NC') THEN abono ELSE 0 END), 0) AS total_abono
    FROM customer_ledger
    WHERE id_cliente = $1
  `, [clienteId]);

  const row = deudaResult.rows[0] || {};
  const totalCargo = parseFloat(row.total_cargo || 0);
  const totalAbono = parseFloat(row.total_abono || 0);
  return Number((totalCargo - totalAbono).toFixed(2));
};

const getDetalleCreditoCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const clienteId = Number(id);
    if (!Number.isFinite(clienteId) || clienteId <= 0) {
      return res.status(400).json({ success: false, error: 'id de cliente invalido' });
    }

    const clienteResult = await pool.query(`
      SELECT id_cliente, nombre, telefono, celular
      FROM clientes
      WHERE id_cliente = $1
      LIMIT 1
    `, [clienteId]);

    if (!clienteResult.rows.length) {
      return res.status(404).json({ success: false, error: 'cliente no encontrado' });
    }

    const ledgerResult = await pool.query(`
      SELECT id, fecha, tipo_mov, descripcion, referencia_tipo, referencia_id, cargo, abono
      FROM customer_ledger
      WHERE id_cliente = $1
      ORDER BY fecha DESC
      LIMIT 500
    `, [clienteId]);

    const rows = ledgerResult.rows || [];
    const creditosMap = new Map();
    rows.forEach((r) => {
      const tipo = String(r.tipo_mov || '').toUpperCase();
      const refTipo = String(r.referencia_tipo || '').toLowerCase();
      const refId = Number(r.referencia_id || 0) || 0;
      const key = refId > 0 ? `F-${refId}` : `M-${r.id}`;
      if (!creditosMap.has(key)) {
        creditosMap.set(key, {
          key,
          id_factura: refId > 0 ? refId : null,
          fecha: r.fecha ? new Date(r.fecha).toLocaleDateString('es-MX') : '',
          credito: 0,
          abonos: 0,
          saldo: 0,
          folioCfdi: (String(r.descripcion || '').match(/CFDI:([A-Z0-9-]+)/i) || [])[1] || '',
          folio: refId > 0 ? refId : r.id
        });
      }

      const item = creditosMap.get(key);
      if (['CARGO', 'COBRO_CREDITO', 'COBRO'].includes(tipo)) {
        item.credito += Number(r.cargo || 0);
      }
      if (['ABONO', 'PAGO', 'NC'].includes(tipo)) {
        item.abonos += Number(r.abono || 0);
      }
      item.saldo = Number((item.credito - item.abonos).toFixed(2));

      if (refTipo.includes('factura') && refId > 0) {
        item.id_factura = refId;
      }
    });

    const facturaIds = Array.from(creditosMap.values())
      .map(c => c.id_factura)
      .filter(v => Number.isFinite(Number(v)));

    const facturasInfo = new Map();
    if (facturaIds.length > 0) {
      const factRes = await pool.query(
        `SELECT id_factura, folio, uuid, fecha_emision
         FROM facturas
         WHERE id_factura = ANY($1::int[])`,
        [facturaIds]
      );
      factRes.rows.forEach((f) => facturasInfo.set(Number(f.id_factura), f));
    }

    const creditos = Array.from(creditosMap.values())
      .filter(c => c.credito > 0 || c.saldo > 0)
      .map((c) => {
        const fact = c.id_factura ? facturasInfo.get(Number(c.id_factura)) : null;
        return {
          doc: 'FAC',
          folio: fact?.folio || c.folio,
          folioCfdi: fact?.uuid || c.folioCfdi || '',
          rp: false,
          fecha: fact?.fecha_emision ? new Date(fact.fecha_emision).toLocaleDateString('es-MX') : c.fecha,
          vencimiento: '',
          credito: Number(c.credito || 0),
          abonos: Number(c.abonos || 0),
          saldo: Number(c.saldo || 0),
          id_factura: c.id_factura
        };
      });

    const abonos = rows
      .filter(r => ['ABONO', 'PAGO'].includes(String(r.tipo_mov || '').toUpperCase()))
      .map((r) => ({
        id: r.id,
        fecha: r.fecha ? new Date(r.fecha).toLocaleDateString('es-MX') : '',
        tp: r.referencia_tipo || 'ABONO',
        multPago: '',
        referencia: r.descripcion || '',
        cfdi: (String(r.descripcion || '').match(/CFDI:([A-Z0-9-]+)/i) || [])[1]
          || (String(r.referencia_tipo || '').toLowerCase().includes('factura') ? (r.referencia_id || '') : ''),
        total: Number(r.abono || 0),
        facturaOrigenId: Number(r.referencia_id || 0) || null
      }));

    const notas_credito = rows
      .filter(r => String(r.tipo_mov || '').toUpperCase() === 'NC')
      .map((r) => ({
        fecha: r.fecha ? new Date(r.fecha).toLocaleDateString('es-MX') : '',
        folio: r.referencia_id || r.id,
        serie: 'NC',
        total: Number(r.abono || 0)
      }));

    const deuda = await calcularDeudaCliente(clienteId);

    return res.json({
      success: true,
      data: {
        id: clienteResult.rows[0].id_cliente,
        nombre: clienteResult.rows[0].nombre,
        telefono: clienteResult.rows[0].telefono,
        celular: clienteResult.rows[0].celular,
        deuda,
        creditos,
        abonos,
        notas_credito
      }
    });
  } catch (error) {
    console.error('Error al obtener detalle de credito:', error);
    return res.status(500).json({ success: false, error: 'error interno al obtener detalle de credito' });
  }
};

const registrarAbonoCredito = async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('[ABONO_DEBUG] registrarAbonoCredito req.body =', req.body);
    const {
      id_cliente,
      monto,
      forma_pago,
      tipo_tarjeta,
      moneda,
      referencia,
      pago_con,
      cambio,
      factura_origen_id
    } = req.body || {};

    const clienteId = Number(id_cliente);
    const montoAbono = Number(monto || 0);
    console.log('[ABONO_DEBUG] valores normalizados =', {
      id_cliente_raw: id_cliente,
      id_cliente_num: clienteId,
      id_cliente_type: typeof id_cliente,
      monto_raw: monto,
      monto_num: montoAbono,
      monto_type: typeof monto,
      factura_origen_id_raw: factura_origen_id,
      factura_origen_id_type: typeof factura_origen_id
    });
    if (!Number.isInteger(clienteId) || clienteId <= 0) {
      return res.status(400).json({ success: false, error: 'id_cliente invalido (debe ser entero positivo)' });
    }
    if (!Number.isFinite(montoAbono) || montoAbono <= 0) {
      return res.status(400).json({ success: false, error: 'monto invalido' });
    }

    const clienteResult = await client.query(`
      SELECT
        id_cliente,
        nombre,
        limite_credito,
        rfc,
        fact_rfc,
        codigo_postal,
        regimen_fiscal,
        uso_cfdi,
        domicilio,
        colonia,
        localidad,
        ciudad,
        estado_direccion,
        pais
      FROM clientes
      WHERE id_cliente = $1
      LIMIT 1
    `, [clienteId]);
    if (!clienteResult.rows.length) {
      return res.status(404).json({ success: false, error: 'cliente no encontrado' });
    }

    await client.query('BEGIN');
    const deudaAntes = await calcularDeudaCliente(clienteId);
    const facturaOrigenId = Number(factura_origen_id || 0);
    console.log('[ABONO_DEBUG] ids para proceso =', {
      clienteId,
      clienteId_type: typeof clienteId,
      facturaOrigenId,
      facturaOrigenId_type: typeof facturaOrigenId
    });
    if (!Number.isFinite(facturaOrigenId) || facturaOrigenId < 0 || !Number.isInteger(facturaOrigenId)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'factura_origen_id invalido (debe ser entero)' });
    }
    let facturaOrigen = null;

    if (facturaOrigenId > 0) {
      const factRes = await client.query(
        `SELECT
           id_factura,
           folio,
           uuid,
           total,
           sello_cfdi,
           sello_sat,
           no_certificado,
           no_certificado_sat
         FROM facturas
         WHERE id_factura = $1 AND id_cliente = $2
         LIMIT 1`,
        [facturaOrigenId, clienteId]
      );
      if (!factRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'factura origen no valida para este cliente' });
      }
      facturaOrigen = factRes.rows[0];

      const saldoFacturaRes = await client.query(`
        SELECT
          COALESCE(SUM(CASE WHEN tipo_mov IN ('CARGO','COBRO_CREDITO','COBRO') THEN cargo ELSE 0 END),0) AS cargo,
          COALESCE(SUM(CASE WHEN tipo_mov IN ('ABONO','PAGO','NC') THEN abono ELSE 0 END),0) AS abono
        FROM customer_ledger
        WHERE id_cliente = $1 AND referencia_id = $2
      `, [clienteId, facturaOrigenId]);
      console.log('[ABONO_DEBUG] query saldoFacturaRes params =', {
        p1_clienteId: clienteId,
        p1_type: typeof clienteId,
        p2_facturaOrigenId: facturaOrigenId,
        p2_type: typeof facturaOrigenId
      });

      const saldoFactura = Number(saldoFacturaRes.rows[0]?.cargo || 0) - Number(saldoFacturaRes.rows[0]?.abono || 0);
      if (montoAbono > saldoFactura) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'el abono excede el saldo pendiente de la factura origen' });
      }
    }

    const tipoTarjetaNormalizado = String(tipo_tarjeta || '').trim();
    const formaPagoNormalizada = String(forma_pago || '').trim();
    const formaPagoConDetalle = (
      formaPagoNormalizada.toLowerCase() === 'tarjeta' && tipoTarjetaNormalizado
    )
      ? `Tarjeta ${tipoTarjetaNormalizado}`
      : formaPagoNormalizada;

    const saldoResultante = Number(Math.max(0, deudaAntes - montoAbono).toFixed(2));
    const referenciaTexto = [
      referencia || '',
      formaPagoConDetalle ? `FP:${formaPagoConDetalle}` : '',
      moneda ? `MON:${moneda}` : '',
      Number.isFinite(Number(pago_con)) ? `PAGO_CON:${Number(pago_con).toFixed(2)}` : '',
      Number.isFinite(Number(cambio)) ? `CAMBIO:${Number(cambio).toFixed(2)}` : ''
    ].filter(Boolean).join(' | ');

    const ledgerInsert = await client.query(`
      INSERT INTO customer_ledger
      (id_cliente, fecha, tipo_mov, descripcion, referencia_tipo, referencia_id, cargo, abono, saldo_resultante, usuario_id)
      VALUES ($1, CURRENT_TIMESTAMP, 'ABONO', $2, $3, $4, 0, $5, $6, $7)
      RETURNING id, fecha, tipo_mov, descripcion, referencia_tipo, referencia_id, cargo, abono, saldo_resultante
    `, [
      clienteId,
      referenciaTexto || 'Abono a credito',
      facturaOrigenId > 0 ? 'factura_abono' : 'abono_credito',
      facturaOrigenId > 0 ? facturaOrigenId : Math.floor(Date.now() / 1000),
      montoAbono,
      saldoResultante,
      req.user?.id_usuario || req.user?.id || null
    ]);
    console.log('[ABONO_DEBUG] ledgerInsert OK =', {
      ledger_id: ledgerInsert.rows?.[0]?.id,
      referencia_id: ledgerInsert.rows?.[0]?.referencia_id,
      clienteId
    });

    let saldoFacturaAnterior = null;
    let saldoFacturaRestante = null;
    let pdfAbono = null;
    if (facturaOrigenId > 0) {
      const saldoFacturaRes2 = await client.query(`
        SELECT
          COALESCE(SUM(CASE WHEN tipo_mov IN ('CARGO','COBRO_CREDITO','COBRO') THEN cargo ELSE 0 END),0) AS cargo,
          COALESCE(SUM(CASE WHEN tipo_mov IN ('ABONO','PAGO','NC') THEN abono ELSE 0 END),0) AS abono
        FROM customer_ledger
        WHERE id_cliente = $1 AND referencia_id = $2
      `, [clienteId, facturaOrigenId]);
      console.log('[ABONO_DEBUG] query saldoFacturaRes2 params =', {
        p1_clienteId: clienteId,
        p1_type: typeof clienteId,
        p2_facturaOrigenId: facturaOrigenId,
        p2_type: typeof facturaOrigenId
      });

      const cargoF = Number(saldoFacturaRes2.rows[0]?.cargo || 0);
      const abonoF = Number(saldoFacturaRes2.rows[0]?.abono || 0);
      saldoFacturaRestante = Number((cargoF - abonoF).toFixed(2));
      saldoFacturaAnterior = Number((saldoFacturaRestante + montoAbono).toFixed(2));

      await client.query(
        `UPDATE facturas
         SET estado = CASE WHEN $2::NUMERIC <= 0 THEN 'Pagada' ELSE 'Pendiente PPD' END
         WHERE id_factura = $1`,
        [facturaOrigenId, saldoFacturaRestante]
      );

      const comprobante = `ABONO-${facturaOrigen?.folio || facturaOrigenId}-${ledgerInsert.rows[0].id}`;
      const pdfName = `${comprobante}.pdf`;
      pdfAbono = await pdfService.guardarPDFAbonoCredito({
        clienteNombre: clienteResult.rows[0].nombre,
        clienteRfc: clienteResult.rows[0].fact_rfc || clienteResult.rows[0].rfc || 'XAXX010101000',
        clienteCodigoPostal: clienteResult.rows[0].codigo_postal || '',
        clienteDireccion: clienteResult.rows[0].domicilio || '',
        clienteColonia: clienteResult.rows[0].colonia || '',
        clienteLocalidad: clienteResult.rows[0].localidad || '',
        clienteMunicipio: clienteResult.rows[0].ciudad || '',
        clienteEstado: clienteResult.rows[0].estado_direccion || '',
        clientePais: clienteResult.rows[0].pais || 'MEXICO',
        clienteRegimenFiscal: clienteResult.rows[0].regimen_fiscal || '603',
        usoCfdi: clienteResult.rows[0].uso_cfdi || 'CP01',
        facturaFolio: facturaOrigen?.folio || facturaOrigenId,
        facturaUuid: facturaOrigen?.uuid || '',
        uuid: facturaOrigen?.uuid || '',
        folio: comprobante,
        selloDigital: facturaOrigen?.sello_cfdi || '',
        selloSAT: facturaOrigen?.sello_sat || '',
        noCertificadoEmisor: facturaOrigen?.no_certificado || '',
        certificadoSAT: facturaOrigen?.no_certificado_sat || '',
        fecha: new Date().toLocaleString('es-MX'),
        fechaIso: new Date().toISOString(),
        comprobante,
        saldoAnterior: saldoFacturaAnterior,
        abono: montoAbono,
        saldoRestante: saldoFacturaRestante,
        formaPago: formaPagoConDetalle || '',
        referencia: referencia || ''
      }, pdfName);

      await client.query(
        `UPDATE customer_ledger
         SET descripcion = TRIM(COALESCE(descripcion, '') || ' | PDF:' || $1)
         WHERE id = $2`,
        [pdfAbono, ledgerInsert.rows[0].id]
      );
    }

    try {
      await client.query(`
        INSERT INTO audit_financial_events (evento, tabla, registro_id, usuario_id, detalles)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        'ABONO_CREDITO',
        'customer_ledger',
        ledgerInsert.rows[0].id,
        req.user?.id_usuario || req.user?.id || null,
        JSON.stringify({
          id_cliente: clienteId,
          monto: montoAbono,
          saldo_antes: deudaAntes,
          saldo_despues: saldoResultante
        })
      ]);
    } catch (auditErr) {
      console.warn('No se pudo registrar audit_financial_events:', auditErr.message);
    }

    await client.query('COMMIT');
    return res.json({
      success: true,
      message: 'abono registrado',
      data: {
        ledger_id: ledgerInsert.rows[0].id,
        saldo_antes: deudaAntes,
        saldo_despues: saldoResultante,
        saldo_factura_antes: saldoFacturaAnterior,
        saldo_factura_despues: saldoFacturaRestante,
        comprobante_pdf: pdfAbono,
        movimiento: ledgerInsert.rows[0]
      }
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('Error registrando abono de credito:', error);
    console.error('[ABONO_DEBUG] catch contexto =', {
      body: req.body,
      user_id: req.user?.id_usuario || req.user?.id || null
    });
    return res.status(500).json({ success: false, error: 'error interno al registrar abono' });
  } finally {
    client.release();
  }
};

const vincularFacturaAbono = async (req, res) => {
  try {
    const { ledgerId } = req.params;
    const { uuid } = req.body || {};
    const id = Number(ledgerId);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ledgerId invalido' });
    }
    if (!uuid || typeof uuid !== 'string') {
      return res.status(400).json({ success: false, error: 'uuid requerido' });
    }

    const updateResult = await pool.query(`
      UPDATE customer_ledger
      SET referencia_tipo = 'factura_abono',
          descripcion = TRIM(COALESCE(descripcion, '') || ' | CFDI:' || $1)
      WHERE id = $2
      RETURNING id, referencia_tipo, referencia_id, descripcion
    `, [uuid, id]);

    if (!updateResult.rows.length) {
      return res.status(404).json({ success: false, error: 'movimiento no encontrado' });
    }

    return res.json({ success: true, data: updateResult.rows[0] });
  } catch (error) {
    console.error('Error vinculando factura al abono:', error);
    return res.status(500).json({ success: false, error: 'error interno al vincular factura' });
  }
};

// Enviar comprobante de abono por email
const enviarComprobanteAbonoPorEmail = async (req, res) => {
  try {
    const { email, asunto, mensaje, pdf_path, pdf_name, cliente_nombre, monto, folio } = req.body;

    // Validar email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Email inválido' });
    }

    if (!pdf_path) {
      return res.status(400).json({ success: false, error: 'Ruta del PDF no especificada' });
    }

    // Importar servicio de email y path
    const emailService = require('../services/emailService');
    const path = require('path');

    // Construir ruta completa del PDF - pdf_path es solo el nombre del archivo
    // Los PDFs de abono se guardan en public/pdfs
    const rutaPDFCompleta = path.join(process.cwd(), 'public/pdfs', pdf_path);

    // Construir contenido del email
    const contenidoEmail = `
      <h3>Comprobante de Pago</h3>
      <p>Estimado cliente,</p>
      <p>Le adjuntamos el comprobante de su abono realizado:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f0f0f0;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Cliente:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${cliente_nombre}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Monto:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">$${Number(monto || 0).toFixed(2)} MXN</td>
        </tr>
        <tr style="background: #f0f0f0;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Comprobante:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${folio}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Fecha:</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${new Date().toLocaleDateString('es-MX')}</td>
        </tr>
      </table>
      ${mensaje ? `<p>${mensaje}</p>` : ''}
      <p>Agradecemos su pago.</p>
    `;

    // Enviar correo
    const result = await emailService.enviarComprobanteAbono(
      email,
      asunto || 'Comprobante de Abono',
      contenidoEmail,
      rutaPDFCompleta,
      pdf_name || 'comprobante-abono.pdf'
    );

    return res.json({
      success: true,
      message: 'Comprobante enviado por correo exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error enviando comprobante por email:', error);
    return res.status(500).json({ success: false, error: 'Error al enviar el comprobante por email: ' + error.message });
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
  getClienteHistorial,
  getClienteLedger,
  getClientesConCredito,
  getDetalleCreditoCliente,
  registrarAbonoCredito,
  vincularFacturaAbono,
  enviarComprobanteAbonoPorEmail
}; 
