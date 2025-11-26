const pool = require('../db/index');

// Obtener todas las cotizaciones o filtradas por cliente
const getCotizaciones = async (req, res) => {
  try {
    const { id_cliente } = req.query;

    let query = `SELECT c.*, cl.nombre as nombre_cliente 
                 FROM cotizaciones c 
                 LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente`;
    let params = [];

    // Si se proporciona id_cliente, filtrar solo por ese cliente
    if (id_cliente) {
      query += ` WHERE c.id_cliente = $1`;
      params = [id_cliente];
    }

    query += ` ORDER BY c.fecha_creacion DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener cotizaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener una cotización específica con datos del cliente
const getCotizacion = async (req, res) => {
  const { id } = req.params;

  try {
    // Obtener cotización con datos del cliente mediante JOIN
    const result = await pool.query(
      `SELECT 
        c.*,
        cl.nombre as cliente_nombre,
        cl.email as cliente_email,
        cl.telefono as cliente_telefono,
        cl.celular as cliente_celular,
        cl.empresa as cliente_empresa,
        cl.representante as cliente_representante,
        cl.atencion_nombre as cliente_atencion,
        cl.direccion as cliente_direccion,
        cl.codigo_postal as cliente_cp,
        cl.estado_direccion as cliente_estado,
        cl.localidad as cliente_municipio,
        cl.pais as cliente_pais,
        cl.tipo as cliente_tipo_persona,
        cl.comentario as cliente_descripcion
      FROM cotizaciones c
      LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
      WHERE c.id_cotizacion = $1`,
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
    tipo_cotizacion,
    tipo: tipoRaw = tipo_cotizacion || 'RENTA',
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

    // Campos de entrega detallados
    entrega_lote,
    hora_entrega_solicitada,
    entrega_calle,
    entrega_numero_ext,
    entrega_numero_int,
    entrega_colonia,
    entrega_cp,
    entrega_municipio,
    entrega_estado,
    entrega_referencia,
    entrega_kilometros = 0,
    tipo_zona,

    // Notas y configuración
    notas_internas,
    configuracion_especial,
    condiciones, // ✅ Agregado
    accesorios_seleccionados, // ✅ Agregado

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

    // NUEVOS CAMPOS PARA CLONACIÓN E HISTORIAL
    es_clon = false,
    cotizacion_origen,
    clon_de_folio,
    motivo_cambio,
    cambios_en_clon,
    sucursal_vendedor,
    supervisor_vendedor,

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

    // Convertir tipo a mayúsculas para cumplir con el constraint de la BD
    const tipo = (tipoRaw || 'RENTA').toString().toUpperCase();
    console.log('Tipo convertido a mayúsculas:', tipo);

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
      // Determinar prefijo según el tipo de cotización
      const tipoUpper = (tipo || 'RENTA').toUpperCase();
      const prefix = tipoUpper === 'VENTA' ? 'VEN' : 'REN';

      // Obtener el siguiente número de folio
      const folioResult = await pool.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(numero_folio FROM '${prefix}-\\d{4}-(\\d+)') AS INTEGER)), 0) + 1 as next_number
         FROM cotizaciones 
         WHERE numero_folio LIKE '${prefix}-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-%'`
      );

      const nextNumber = folioResult.rows[0]?.next_number || 1;
      const year = new Date().getFullYear();
      numero = `${prefix}-${year}-${String(nextNumber).padStart(6, '0')}`;
      console.log(`Folio generado: ${numero} para tipo: ${tipo}`);
    }

    // Verificar que no exista (aunque debería ser único por el query anterior)
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 5) {
      const chk = await pool.query('SELECT 1 FROM cotizaciones WHERE numero_cotizacion = $1', [numero]);
      exists = chk.rows.length > 0;
      if (exists) {
        // Fallback: generar timestamp único
        const tipoUpper = (tipo || 'RENTA').toUpperCase();
        const prefix = tipoUpper === 'VENTA' ? 'VEN' : 'REN';
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const H = String(now.getHours()).padStart(2, '0');
        const M = String(now.getMinutes()).padStart(2, '0');
        const S = String(now.getSeconds()).padStart(2, '0');
        const rnd = String(Math.floor(Math.random() * 900) + 100);
        numero = `${prefix}-${y}-${m}${d}${H}${M}${S}${rnd}`;
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
        entrega_lote, hora_entrega_solicitada,
        entrega_calle, entrega_numero_ext, entrega_numero_int, entrega_colonia,
        entrega_cp, entrega_municipio, entrega_estado, entrega_referencia,
        entrega_kilometros, tipo_zona,
        productos_seleccionados, notas_internas, configuracion_especial,
        condiciones, accesorios_seleccionados,
        moneda, tipo_cambio, estado, prioridad,
        descripcion, notas, creado_por, modificado_por,
        numero_folio, precio_unitario, cantidad_total, id_vendedor,
        metodo_pago, terminos_pago,
        es_clon, cotizacion_origen, clon_de_folio, motivo_cambio, 
        cambios_en_clon, sucursal_vendedor, supervisor_vendedor
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62) RETURNING *`,
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
        entrega_lote,                                                    // $25
        hora_entrega_solicitada,                                         // $26
        entrega_calle,                                                   // $27
        entrega_numero_ext,                                              // $28
        entrega_numero_int,                                              // $29
        entrega_colonia,                                                 // $30
        entrega_cp,                                                      // $31
        entrega_municipio,                                               // $32
        entrega_estado,                                                  // $33
        entrega_referencia,                                              // $34
        entrega_kilometros || 0,                                         // $35
        tipo_zona,                                                       // $36
        JSON.stringify(productos_seleccionados || equipos || []),       // $37
        JSON.stringify(notas_internas || []),                           // $38
        JSON.stringify(configuracion_especial || {}),                   // $39
        condiciones || null,                                             // $40 ✅ Agregado
        accesorios_seleccionados || null,                                // $41 ✅ Agregado
        moneda,                                                          // $42
        tipo_cambio,                                                     // $43
        estado,                                                          // $44
        prioridad,                                                       // $45
        descripcion_cliente || JSON.stringify(equipos || []),           // $46
        notas || `Cotización generada el ${new Date().toLocaleString()}`, // $47
        creado_por,                                                      // $48
        modificado_por,                                                  // $49
        numero,                                                          // $50 (numero_folio = numero_cotizacion)
        precio_unitario || 0,                                            // $51
        cantidad_total || 0,                                             // $52
        id_vendedor || creado_por,                                       // $53
        metodo_pago || 'Transferencia',                                  // $54
        terminos_pago || 'Anticipado',                                   // $55
        es_clon,                                                         // $56
        cotizacion_origen,                                               // $57
        clon_de_folio,                                                   // $58
        motivo_cambio || (es_clon ? 'Clonación de cotización' : 'Creación inicial'), // $59
        JSON.stringify(cambios_en_clon || {}),                          // $60
        sucursal_vendedor,                                               // $61
        supervisor_vendedor                                              // $62
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
  const updateData = req.body;

  try {
    // Construir campos dinámicamente
    const campos = [];
    const valores = [];
    let paramIndex = 1;

    // Mapeo de campos permitidos
    const camposPermitidos = {
      'fecha_cotizacion': 'fecha_cotizacion',
      'periodo': 'periodo',
      'dias_periodo': 'dias_periodo',
      'fecha_inicio': 'fecha_inicio',
      'fecha_fin': 'fecha_fin',
      'subtotal': 'subtotal',
      'iva': 'iva',
      'total': 'total',
      'garantia_monto': 'garantia_monto',
      'garantia_porcentaje': 'garantia_porcentaje',
      'descuento_monto': 'descuento_monto',
      'descuento_porcentaje': 'descuento_porcentaje',
      'estado': 'estado',
      'notas': 'notas',
      'condiciones': 'condiciones', // ✅ Agregado
      'costo_envio': 'costo_envio',
      'direccion_entrega': 'direccion_entrega',
      'tipo_envio': 'tipo_envio',
      'distancia_km': 'distancia_km',
      'detalle_calculo': 'detalle_calculo',
      'requiere_entrega': 'requiere_entrega',
      'entrega_lote': 'entrega_lote',
      'hora_entrega_solicitada': 'hora_entrega_solicitada',
      'entrega_calle': 'entrega_calle',
      'entrega_numero_ext': 'entrega_numero_ext',
      'entrega_numero_int': 'entrega_numero_int',
      'entrega_colonia': 'entrega_colonia',
      'entrega_cp': 'entrega_cp',
      'entrega_municipio': 'entrega_municipio',
      'entrega_estado': 'entrega_estado',
      'entrega_referencia': 'entrega_referencia',
      'entrega_kilometros': 'entrega_kilometros',
      'tipo_zona': 'tipo_zona',
      'contacto_nombre': 'contacto_nombre',
      'contacto_telefono': 'contacto_telefono',
      'contacto_email': 'contacto_email',
      'productos_seleccionados': 'productos_seleccionados',
      'accesorios_seleccionados': 'accesorios_seleccionados', // ✅ Agregado
      'configuracion_especial': 'configuracion_especial',
      'modificado_por': 'modificado_por',
      'motivo_cambio': 'motivo_cambio'
    };

    // Agregar campos que están presentes en updateData
    for (const [key, dbField] of Object.entries(camposPermitidos)) {
      if (updateData.hasOwnProperty(key)) {
        let valor = updateData[key];

        // Convertir objetos/arrays a JSON string
        if (typeof valor === 'object' && valor !== null) {
          valor = JSON.stringify(valor);
        }

        campos.push(`${dbField} = $${paramIndex}`);
        valores.push(valor);
        paramIndex++;
      }
    }

    // Siempre actualizar fecha_modificacion
    campos.push('fecha_modificacion = CURRENT_TIMESTAMP');

    if (campos.length === 1) { // Solo fecha_modificacion
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    // Agregar ID al final
    valores.push(id);

    const query = `
      UPDATE cotizaciones 
      SET ${campos.join(', ')}
      WHERE id_cotizacion = $${paramIndex}
      RETURNING *
    `;

    console.log('[updateCotizacion] Query:', query);
    console.log('[updateCotizacion] Valores:', valores);

    const result = await pool.query(query, valores);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar cotización:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      detalle: error.message
    });
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

// Obtener historial de una cotización
const getHistorialCotizacion = async (req, res) => {
  const { id } = req.params;

  try {
    // Obtener historial desde el campo historial_cambios
    const result = await pool.query(
      `SELECT 
        c.id_cotizacion,
        c.numero_folio,
        c.historial_cambios,
        c.numero_revisiones,
        c.fecha_ultima_accion,
        c.usuario_ultima_accion,
        u.nombre as usuario_nombre,
        u.rol as usuario_rol
       FROM cotizaciones c
       LEFT JOIN usuarios u ON c.usuario_ultima_accion = u.id_usuario
       WHERE c.id_cotizacion = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    const cotizacion = result.rows[0];
    let historial = [];

    try {
      // Parsear historial JSON
      historial = JSON.parse(cotizacion.historial_cambios || '[]');

      // Enriquecer con información de usuarios
      for (let entry of historial) {
        if (entry.usuario) {
          const userResult = await pool.query(
            'SELECT nombre, rol FROM usuarios WHERE id_usuario = $1',
            [entry.usuario]
          );
          if (userResult.rows.length > 0) {
            entry.usuario_info = userResult.rows[0];
          }
        }
      }
    } catch (parseError) {
      console.error('Error parseando historial:', parseError);
      historial = [];
    }

    res.json({
      cotizacion_id: cotizacion.id_cotizacion,
      folio: cotizacion.numero_folio,
      total_revisiones: cotizacion.numero_revisiones || 0,
      ultima_modificacion: cotizacion.fecha_ultima_accion,
      historial: historial
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Clonar una cotización existente
const clonarCotizacion = async (req, res) => {
  const { id } = req.params;
  const {
    nueva_fecha,
    nuevo_cliente_id,
    nuevo_vendedor_id,
    motivo_clonacion,
    resetear_estado = true,
    copiar_productos = true,
    copiar_envio = false
  } = req.body;

  try {
    // Obtener cotización original
    const originalResult = await pool.query(
      'SELECT * FROM cotizaciones WHERE id_cotizacion = $1',
      [id]
    );

    if (originalResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cotización original no encontrada' });
    }

    const original = originalResult.rows[0];

    // Preparar datos del clon
    const clonData = {
      ...original,
      // Nuevos datos
      fecha_cotizacion: nueva_fecha || new Date().toISOString().split('T')[0],
      id_cliente: nuevo_cliente_id || original.id_cliente,
      id_vendedor: nuevo_vendedor_id || original.id_vendedor,

      // Campos de clonación
      es_clon: true,
      cotizacion_origen: original.id_cotizacion,
      clon_de_folio: original.numero_folio,
      motivo_cambio: motivo_clonacion || 'Clonación de cotización',

      // Estado y configuración
      estado: resetear_estado ? 'Clonación' : original.estado,
      productos_seleccionados: (() => {
        if (!copiar_productos) {
          return '[]';
        }
        let productos = original.productos_seleccionados;
        if (typeof productos === 'string') {
          try {
            productos = JSON.parse(productos);
          } catch (e) {
            console.error('Error al parsear productos_seleccionados, usando array vacío:', e);
            productos = [];
          }
        }
        return JSON.stringify(Array.isArray(productos) ? productos : []);
      })(),
      accesorios_seleccionados: (() => {
        if (!copiar_productos) {
          return '[]';
        }
        let accesorios = original.accesorios_seleccionados;
        if (typeof accesorios === 'string') {
          try {
            accesorios = JSON.parse(accesorios);
          } catch (e) {
            console.error('Error al parsear accesorios_seleccionados, usando array vacío:', e);
            accesorios = [];
          }
        }
        return JSON.stringify(Array.isArray(accesorios) ? accesorios : []);
      })(),
      pdf_generado: false,
      fecha_pdf: null,
      ruta_pdf: null,
      hash_pdf: null,
      aprobaciones: '[]',
      fecha_aprobacion: null,
      usuario_aprobo: null,
      historial_cambios: '[]',
      numero_revisiones: 0,

      // Datos de envío (opcional)
      ...(copiar_envio ? {
        requiere_entrega: original.requiere_entrega,
        tipo_envio: original.tipo_envio,
        direccion_entrega: original.direccion_entrega,
        costo_envio: original.costo_envio,
        distancia_km: original.distancia_km,
        detalle_calculo: (() => {
          if (!original.detalle_calculo) return null;
          if (typeof original.detalle_calculo === 'string') return original.detalle_calculo;
          try {
            return JSON.stringify(original.detalle_calculo);
          } catch (error) {
            console.warn('No se pudo serializar detalle_calculo al clonar, usando null:', error);
            return null;
          }
        })(),
        entrega_lote: original.entrega_lote,
        hora_entrega_solicitada: original.hora_entrega_solicitada,
        entrega_calle: original.entrega_calle,
        entrega_numero_ext: original.entrega_numero_ext,
        entrega_numero_int: original.entrega_numero_int,
        entrega_colonia: original.entrega_colonia,
        entrega_cp: original.entrega_cp,
        entrega_municipio: original.entrega_municipio,
        entrega_estado: original.entrega_estado,
        entrega_referencia: original.entrega_referencia,
        entrega_kilometros: original.entrega_kilometros,
        tipo_zona: original.tipo_zona
      } : {
        requiere_entrega: false,
        tipo_envio: 'local',
        direccion_entrega: null,
        costo_envio: 0,
        distancia_km: 0,
        detalle_calculo: null,
        entrega_lote: null,
        hora_entrega_solicitada: null,
        entrega_calle: null,
        entrega_numero_ext: null,
        entrega_numero_int: null,
        entrega_colonia: null,
        entrega_cp: null,
        entrega_municipio: null,
        entrega_estado: null,
        entrega_referencia: null,
        entrega_kilometros: 0,
        tipo_zona: null
      }),

      // Cambios realizados en el clon
      cambios_en_clon: JSON.stringify({
        fecha_cambiada: nueva_fecha !== original.fecha_cotizacion,
        cliente_cambiado: nuevo_cliente_id && nuevo_cliente_id !== original.id_cliente,
        vendedor_cambiado: nuevo_vendedor_id && nuevo_vendedor_id !== original.id_vendedor,
        productos_copiados: copiar_productos,
        envio_copiado: copiar_envio,
        estado_reseteado: resetear_estado
      })
    };

    // Crear el clon usando la función existente
    const clonResult = await createCotizacionFromData(clonData, req.user?.id);

    // Actualizar contador de clones en la cotización original
    await pool.query(
      'UPDATE cotizaciones SET numero_clones = COALESCE(numero_clones, 0) + 1 WHERE id_cotizacion = $1',
      [id]
    );

    res.status(201).json({
      message: 'Cotización clonada exitosamente',
      original_id: id,
      clon: clonResult
    });

  } catch (error) {
    console.error('Error clonando cotización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Función auxiliar para crear cotización desde datos existentes
const createCotizacionFromData = async (data, userId) => {
  // Determinar prefijo según tipo de cotización
  const tipo = data.tipo ? String(data.tipo).trim().toUpperCase() : 'RENTA';
  const prefijo = tipo === 'VENTA' ? 'VEN' : 'REN';
  const year = new Date().getFullYear();

  // Generar nuevo número de cotización usando prefijo dinámico
  const folioPattern = `${prefijo}-\\d{4}-(\\d+)`;
  const likePattern = `${prefijo}-${year}-%`;
  const folioResult = await pool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(numero_folio FROM $1) AS INTEGER)), 0) + 1 AS next_number
     FROM cotizaciones
     WHERE numero_folio LIKE $2`,
    [folioPattern, likePattern]
  );

  const nextNumber = folioResult.rows[0]?.next_number || 1;
  const numero = `${prefijo}-${year}-${String(nextNumber).padStart(6, '0')}`;

  const result = await pool.query(
    `INSERT INTO cotizaciones (
      numero_cotizacion, id_cliente, tipo, fecha_cotizacion,
      id_almacen, nombre_almacen, ubicacion_almacen,
      dias_periodo, fecha_inicio, fecha_fin, periodo,
      subtotal, iva, costo_envio, total, requiere_entrega,
      direccion_entrega, tipo_envio, distancia_km, detalle_calculo,
      contacto_nombre, contacto_email, contacto_telefono, tipo_cliente,
      entrega_lote, hora_entrega_solicitada,
      entrega_calle, entrega_numero_ext, entrega_numero_int, entrega_colonia,
      entrega_cp, entrega_municipio, entrega_estado, entrega_referencia,
      entrega_kilometros, tipo_zona,
      productos_seleccionados, notas_internas, configuracion_especial,
      condiciones, accesorios_seleccionados,
      moneda, tipo_cambio, estado, prioridad,
      descripcion, notas, creado_por, modificado_por,
      numero_folio, precio_unitario, cantidad_total, id_vendedor,
      metodo_pago, terminos_pago,
      es_clon, cotizacion_origen, clon_de_folio, motivo_cambio, 
      cambios_en_clon, sucursal_vendedor, supervisor_vendedor,
      historial_cambios, numero_revisiones
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64) RETURNING *`,
    [
      numero,                           // $1
      data.id_cliente,                  // $2
      data.tipo,                        // $3
      data.fecha_cotizacion,            // $4
      data.id_almacen,                  // $5
      data.nombre_almacen,              // $6
      data.ubicacion_almacen,           // $7
      data.dias_periodo,                // $8
      data.fecha_inicio,                // $9
      data.fecha_fin,                   // $10
      data.periodo,                     // $11
      data.subtotal,                    // $12
      data.iva,                         // $13
      data.costo_envio,                 // $14
      data.total,                       // $15
      data.requiere_entrega,            // $16
      data.direccion_entrega,           // $17
      data.tipo_envio,                  // $18
      data.distancia_km,                // $19
      data.detalle_calculo,             // $20
      data.contacto_nombre,             // $21
      data.contacto_email,              // $22
      data.contacto_telefono,           // $23
      data.tipo_cliente,                // $24
      data.entrega_lote || null,        // $25
      data.hora_entrega_solicitada || null, // $26
      data.entrega_calle || null,       // $27
      data.entrega_numero_ext || null,  // $28
      data.entrega_numero_int || null,  // $29
      data.entrega_colonia || null,     // $30
      data.entrega_cp || null,          // $31
      data.entrega_municipio || null,   // $32
      data.entrega_estado || null,      // $33
      data.entrega_referencia || null,  // $34
      data.entrega_kilometros ?? 0,     // $35
      data.tipo_zona || null,           // $36
      data.productos_seleccionados,     // $37
      data.notas_internas,              // $38
      data.configuracion_especial,      // $39
      data.condiciones || null,         // $40
      data.accesorios_seleccionados || null, // $41
      data.moneda,                      // $42
      data.tipo_cambio,                 // $43
      data.estado,                      // $44
      data.prioridad,                   // $45
      data.descripcion,                 // $46
      data.notas,                       // $47
      userId || data.creado_por,        // $48
      userId || data.modificado_por,    // $49
      numero,                           // $50
      data.precio_unitario,             // $51
      data.cantidad_total,              // $52
      data.id_vendedor,                 // $53
      data.metodo_pago,                 // $54
      data.terminos_pago,               // $55
      data.es_clon,                     // $56
      data.cotizacion_origen,           // $57
      data.clon_de_folio,               // $58
      data.motivo_cambio,               // $59
      data.cambios_en_clon,             // $60
      data.sucursal_vendedor,           // $61
      data.supervisor_vendedor,         // $62
      data.historial_cambios || '[]',   // $63
      data.numero_revisiones || 0       // $64
    ]
  );

  return result.rows[0];
};

// Actualizar cotización con tracking de cambios
const updateCotizacionWithHistory = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const userId = req.user?.id;

  try {
    // Obtener cotización actual
    const currentResult = await pool.query(
      'SELECT * FROM cotizaciones WHERE id_cotizacion = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    const current = currentResult.rows[0];

    // Detectar cambios significativos
    const cambios = {};
    const camposImportantes = ['estado', 'total', 'id_vendedor', 'id_cliente'];

    camposImportantes.forEach(campo => {
      if (updateData[campo] !== undefined && updateData[campo] !== current[campo]) {
        cambios[`${campo}_anterior`] = current[campo];
        cambios[`${campo}_nuevo`] = updateData[campo];
      }
    });

    // Construir historial entry si hay cambios
    let nuevoHistorial = [];
    try {
      nuevoHistorial = JSON.parse(current.historial_cambios || '[]');
    } catch (e) {
      nuevoHistorial = [];
    }

    if (Object.keys(cambios).length > 0) {
      const historialEntry = {
        fecha: new Date().toISOString(),
        usuario: userId,
        cambios: cambios,
        motivo: updateData.motivo_cambio || 'Modificación automática'
      };
      nuevoHistorial.push(historialEntry);
    }

    // Actualizar cotización
    const campos = Object.keys(updateData).filter(key => key !== 'motivo_cambio');
    const valores = campos.map(campo => updateData[campo]);
    const setClause = campos.map((campo, index) => `${campo} = $${index + 2}`).join(', ');

    const result = await pool.query(
      `UPDATE cotizaciones SET 
        ${setClause},
        historial_cambios = $${campos.length + 2},
        numero_revisiones = COALESCE(numero_revisiones, 0) + 1,
        fecha_ultima_accion = CURRENT_TIMESTAMP,
        usuario_ultima_accion = $${campos.length + 3},
        fecha_modificacion = CURRENT_TIMESTAMP
       WHERE id_cotizacion = $1 RETURNING *`,
      [id, ...valores, JSON.stringify(nuevoHistorial), userId]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error actualizando cotización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getCotizaciones,
  getCotizacion,
  createCotizacion,
  updateCotizacion,
  deleteCotizacion,
  convertirAContrato,
  getHistorialCotizacion,
  clonarCotizacion,
  updateCotizacionWithHistory
}; 