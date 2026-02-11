const pool = require('../db/index');

// Obtener siguiente número de cotización secuencial
const getSiguienteNumero = async (req, res) => {
  try {
    const { tipo } = req.query; // 'RENTA' o 'VENTA'

    // Validar tipo
    const tipoUpper = (tipo || 'RENTA').toString().toUpperCase();
    if (!['RENTA', 'VENTA'].includes(tipoUpper)) {
      return res.status(400).json({ error: 'Tipo inválido. Debe ser RENTA o VENTA' });
    }

    // Determinar prefijo según el tipo
    const prefix = tipoUpper === 'VENTA' ? 'VEN' : 'REN';
    const year = new Date().getFullYear();

    // Obtener el último número de cotización del tipo y año especificado
    // Modificado: Flexible para leer folios de 4, 5 o 6 dígitos y continuar secuencia
    const result = await pool.query(
      `SELECT numero_cotizacion 
       FROM cotizaciones 
       WHERE tipo = $1 
         AND numero_cotizacion ~ $2
       ORDER BY id_cotizacion DESC 
       LIMIT 1`,
      [tipoUpper, `^${prefix}-${year}-[0-9]{1,8}$`]
    );

    let siguienteNumero;

    if (result.rows.length > 0) {
      // Extraer el número de la última cotización
      const ultimoNumero = result.rows[0].numero_cotizacion;
      const match = ultimoNumero.match(/(\d+)$/);

      if (match) {
        const numero = parseInt(match[1]) + 1;
        // Modificado: Usar 6 dígitos de padding para nuevo estándar
        siguienteNumero = `${prefix}-${year}-${String(numero).padStart(6, '0')}`;
      } else {
        siguienteNumero = `${prefix}-${year}-000001`;
      }
    } else {
      // Primera cotización de este tipo
      siguienteNumero = `${prefix}-${year}-000001`;
    }

    console.log(`[getSiguienteNumero] Tipo: ${tipoUpper}, Siguiente: ${siguienteNumero}`);

    res.json({
      numero_cotizacion: siguienteNumero,
      tipo: tipoUpper
    });

  } catch (error) {
    console.error('Error obteniendo siguiente número:', error);
    res.status(500).json({
      error: 'Error al generar número de cotización',
      detalle: error.message
    });
  }
};

// Obtener todas las cotizaciones o filtradas por cliente
const getCotizaciones = async (req, res) => {
  try {
    const { id_cliente } = req.query;

    let query = `SELECT c.*, cl.nombre as nombre_cliente, cl.email, 
                        uc.nombre as creado_por_nombre,
                        um.nombre as modificado_por_nombre
                 FROM cotizaciones c 
                 LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
                 LEFT JOIN usuarios uc ON c.creado_por = uc.id_usuario
                 LEFT JOIN usuarios um ON c.modificado_por = um.id_usuario`;
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
        cl.nombre as nombre_cliente,
        cl.rfc as cliente_rfc,
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
        cl.comentario as cliente_descripcion,
        uc.nombre as creado_por_nombre,
        um.nombre as modificado_por_nombre
      FROM cotizaciones c
      LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
      LEFT JOIN usuarios uc ON c.creado_por = uc.id_usuario
      LEFT JOIN usuarios um ON c.modificado_por = um.id_usuario
      WHERE c.id_cotizacion = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    const cotizacion = result.rows[0];

    // Enriquecer productos_seleccionados con precio_venta de la tabla productos
    if (cotizacion.productos_seleccionados) {
      try {
        let productos = cotizacion.productos_seleccionados;

        // Parsear si es string
        if (typeof productos === 'string') {
          productos = JSON.parse(productos);
        }

        // Para cada producto, traer el precio_venta de la tabla productos
        const productosEnriquecidos = await Promise.all(
          productos.map(async (prod) => {
            try {
              const prodResult = await pool.query(
                `SELECT precio_venta, tarifa_renta, nombre_del_producto
                 FROM public.productos
                 WHERE id_producto = $1`,
                [prod.id]
              );

              if (prodResult.rows.length > 0) {
                const precioVenta = parseFloat(prodResult.rows[0].precio_venta) || 0;
                const garantiaUnitaria = precioVenta * 0.75; // 75% del precio de venta
                const cantidad = prod.cantidad || 1;
                const garantiaTotal = garantiaUnitaria * cantidad;

                return {
                  ...prod,
                  precio_venta: precioVenta,
                  garantia_unitaria: Math.round(garantiaUnitaria * 100) / 100,
                  garantia_total: Math.round(garantiaTotal * 100) / 100
                };
              }
              return prod;
            } catch (err) {
              console.error(`Error enriqueciendo producto ${prod.id}:`, err);
              return prod;
            }
          })
        );

        cotizacion.productos_seleccionados = productosEnriquecidos;
      } catch (err) {
        console.error('Error al enriquecer productos_seleccionados:', err);
        // Si hay error, retornar cotización sin enriquecimiento
      }
    }

    res.json(cotizacion);
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
    precio_por_dia = 0,
    total = 0,

    // Datos de entrega
    requiere_entrega = false,
    direccion_entrega,
    tipo_envio = 'local',
    distancia_km = 0,
    detalle_calculo,

    // Campos de entrega detallados
    entrega_lote,
    fecha_entrega_solicitada,
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
    notificaciones_enviadas, // ✅ Para calendario
    recordatorios_programados, // ✅ Para calendario

    // Cálculos financieros adicionales
    iva = 0,
    garantia_monto = 0,
    garantia_porcentaje = 0,
    costo_adicional = 0,
    concepto_adicional = null,

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
    metodo_entrega,
    id_almacen_recoleccion,
    hora_inicio,
    hora_fin,
    entrega_contacto,
    entrega_telefono,

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

    // Obtener el ID del cliente (ahora es opcional)
    // Si viene id_cliente en el body, usarlo; si no, dejar como NULL
    let id_cliente = null;
    if (id_cliente_body !== undefined && id_cliente_body !== null && id_cliente_body !== '') {
      id_cliente = Number(id_cliente_body);
      if (isNaN(id_cliente)) id_cliente = null;
    }

    // Preparar datos de contacto (se guardarán independientemente de si hay cliente o no)
    const nombreCliente = contacto_nombre || nombre_cliente;
    const emailCliente = contacto_email || cliente_email;
    const telefonoCliente = contacto_telefono || cliente_telefono;

    console.log('[DEBUG createCotizacion] Body received id_cliente_body:', id_cliente_body);
    console.log('[DEBUG createCotizacion] Resolved id_cliente for DB:', id_cliente);
    console.log('[DEBUG createCotizacion] Contact Info:', { nombreCliente, emailCliente, telefonoCliente });



    // Generar número de cotización único (será igual al folio)
    let numero = numero_cotizacion;
    if (!numero) {
      // Determinar prefijo según el tipo de cotización
      const tipoUpper = (tipo || 'RENTA').toUpperCase();
      const prefix = tipoUpper === 'VENTA' ? 'VEN' : 'REN';

      // Obtener el siguiente número de folio
      // Modificado: Usar regex estricto para ignorar folios anómalos con timestamps (más de 8 dígitos)
      const folioResult = await pool.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(numero_folio FROM '${prefix}-[0-9]{4}-([0-9]{1,8})$') AS INTEGER)), 0) + 1 as next_number
         FROM cotizaciones 
         WHERE numero_folio ~ '^${prefix}-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-[0-9]{1,8}$'`
      );

      const nextNumber = folioResult.rows[0]?.next_number || 1;
      const year = new Date().getFullYear();
      numero = `${prefix}-${year}-${String(nextNumber).padStart(6, '0')}`;
      console.log(`Folio generado: ${numero} para tipo: ${tipo}`);
    }

    // Verificar que no exista el folio antes de insertar
    const checkFolio = await pool.query('SELECT 1 FROM cotizaciones WHERE numero_cotizacion = $1', [numero]);
    if (checkFolio.rows.length > 0) {
      console.warn(`[createCotizacion] Intento de usar folio duplicado: ${numero}`);
      return res.status(400).json({
        error: 'Folio Duplicado',
        message: `El folio "${numero}" ya existe en el sistema. Por favor, use otro número o genere uno nuevo.`,
        detalle: `El folio "${numero}" ya existe en el sistema. Por favor, use otro número o genere uno nuevo.`
      });
    }

    const result = await pool.query(
      `INSERT INTO cotizaciones (
        numero_cotizacion, id_cliente, tipo, fecha_cotizacion,
        id_almacen, nombre_almacen, ubicacion_almacen,
        dias_periodo, fecha_inicio, fecha_fin, periodo,
        subtotal, iva, costo_envio, total, requiere_entrega,
        direccion_entrega, tipo_envio, distancia_km, detalle_calculo,
        contacto_nombre, contacto_email, contacto_telefono, tipo_cliente,
        entrega_lote, hora_entrega_solicitada, fecha_entrega_solicitada,
        entrega_calle, entrega_numero_ext, entrega_numero_int, entrega_colonia,
        entrega_cp, entrega_municipio, entrega_estado, entrega_referencia,
        entrega_kilometros, tipo_zona, instrucciones_entrega,
        garantia_monto, garantia_porcentaje, costo_adicional, concepto_adicional,
        productos_seleccionados, notas_internas, configuracion_especial,
        condiciones, accesorios_seleccionados,
        notificaciones_enviadas, recordatorios_programados,
        moneda, tipo_cambio, estado, prioridad,
        descripcion, notas, creado_por, modificado_por,
        numero_folio, precio_unitario, cantidad_total, id_vendedor,
        metodo_pago, terminos_pago,
        es_clon, cotizacion_origen, clon_de_folio, motivo_cambio, 
        cambios_en_clon, sucursal_vendedor, supervisor_vendedor,
        metodo_entrega, id_almacen_recoleccion,
        hora_inicio, hora_fin, entrega_contacto, entrega_telefono
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
        $41, $42, $43, $44, $45, $46, $47, $48, $49, $50,
        $51, $52, $53, $54, $55, $56, $57, $58, $59, $60,
        $61, $62, $63, $64, $65, $66, $67, $68, $69, $70,
        $71, $72, $73, $74, $75, $76
      ) RETURNING *`,
      [
        numero,                                             // $1
        id_cliente,                                         // $2
        tipo,                                               // $3
        fecha_cotizacion || new Date().toISOString().split('T')[0], // $4
        id_almacen,                                         // $5
        nombre_almacen,                                     // $6
        ubicacion_almacen,                                  // $7
        dias_periodo || 1,                                  // $8
        fecha_inicio,                                       // $9
        fecha_fin,                                          // $10
        periodo || 'Día',                                   // $11
        subtotal,                                           // $12
        iva || 0,                                           // $13
        costo_envio,                                        // $14
        total,                                              // $15
        requiere_entrega,                                   // $16
        direccion_entrega,                                  // $17
        tipo_envio || 'local',                              // $18
        distancia_km || 0,                                  // $19
        JSON.stringify(detalle_calculo || {}),             // $20
        nombreCliente,                                      // $21
        emailCliente,                                       // $22
        telefonoCliente,                                    // $23
        tipo_cliente,                                       // $24
        entrega_lote,                                       // $25
        hora_entrega_solicitada,                            // $26
        fecha_entrega_solicitada || null,                   // $27
        entrega_calle,                                      // $28
        entrega_numero_ext,                                 // $29
        entrega_numero_int,                                 // $30
        entrega_colonia,                                    // $31
        entrega_cp,                                         // $32
        entrega_municipio,                                  // $33
        entrega_estado,                                     // $34
        entrega_referencia,                                 // $35
        entrega_kilometros || 0,                            // $36
        tipo_zona,                                          // $37
        null,                                               // $38 (instrucciones_entrega)
        garantia_monto || 0,                                // $39
        garantia_porcentaje || 0,                           // $40
        costo_adicional || 0,                               // $41
        concepto_adicional || null,                         // $42
        JSON.stringify(productos_seleccionados || equipos || []), // $43
        JSON.stringify(notas_internas || []),              // $44
        JSON.stringify(configuracion_especial || {}),      // $45
        condiciones || null,                                // $46
        accesorios_seleccionados || null,                   // $47
        JSON.stringify(notificaciones_enviadas || []),      // $48
        JSON.stringify(recordatorios_programados || []),    // $49
        moneda,                                             // $50
        tipo_cambio,                                        // $51
        estado,                                             // $52
        prioridad,                                          // $53
        descripcion_cliente || JSON.stringify(equipos || []), // $54
        notas || `Cotización generada el ${new Date().toLocaleString()}`, // $55
        creado_por,                                         // $56
        modificado_por,                                     // $57
        numero,                                             // $58 (numero_folio = numero_cotizacion)
        precio_unitario || 0,                               // $59
        cantidad_total || 0,                                // $60
        id_vendedor || creado_por,                          // $61
        metodo_pago || 'Transferencia',                     // $62
        terminos_pago || 'Anticipado',                      // $63
        es_clon,                                            // $64
        Number(cotizacion_origen) || null,                  // $65
        clon_de_folio,                                      // $66
        motivo_cambio || (es_clon ? 'Clonación de cotización' : 'Creación inicial'), // $67
        JSON.stringify(cambios_en_clon || {}),             // $68
        sucursal_vendedor,                                  // $69
        supervisor_vendedor,                                // $70
        metodo_entrega || null,                             // $71
        // Validar que id_almacen_recoleccion sea un número válido o NULL
        (id_almacen_recoleccion && !isNaN(id_almacen_recoleccion))
          ? Number(id_almacen_recoleccion)
          : null,                                           // $72
        hora_inicio || null,                                // $73
        hora_fin || null,                                   // $74
        entrega_contacto || null,                           // $75
        entrega_telefono || null                            // $76
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
      'id_almacen': 'id_almacen',
      'nombre_almacen': 'nombre_almacen',
      'ubicacion_almacen': 'ubicacion_almacen',
      'subtotal': 'subtotal',
      'iva': 'iva',
      'total': 'total',
      'garantia_monto': 'garantia_monto',
      'garantia_porcentaje': 'garantia_porcentaje',
      'costo_adicional': 'costo_adicional',
      'concepto_adicional': 'concepto_adicional',
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
      'fecha_entrega_solicitada': 'fecha_entrega_solicitada',
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
      'notificaciones_enviadas': 'notificaciones_enviadas', // ✅ Para calendario
      'recordatorios_programados': 'recordatorios_programados', // ✅ Para calendario
      'configuracion_especial': 'configuracion_especial',
      'precio_por_dia': 'precio_por_dia',
      'modificado_por': 'modificado_por',
      'motivo_cambio': 'motivo_cambio',
      'metodo_entrega': 'metodo_entrega', // ✅ Nuevo: domicilio o sucursal
      'id_almacen_recoleccion': 'id_almacen_recoleccion', // ✅ Nuevo: ID del almacén de recolección
      'hora_inicio': 'hora_inicio',
      'hora_fin': 'hora_fin',
      'entrega_contacto': 'entrega_contacto',
      'entrega_telefono': 'entrega_telefono'
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
  console.log('🔥🔥🔥 [CÓDIGO ACTUALIZADO] createCotizacionFromData ejecutándose con validaciones 🔥🔥🔥');
  // Determinar prefijo según tipo de cotización
  const tipo = data.tipo ? String(data.tipo).trim().toUpperCase() : 'RENTA';
  const prefijo = tipo === 'VENTA' ? 'VEN' : 'REN';
  const year = new Date().getFullYear();

  /* Generar nuevo número de cotización usando prefijo dinámico */
  /* Modificado: Aceptar solo 1-8 dígitos para ignorar timestamps erróneos */
  const folioPattern = `${prefijo}-\\d{4}-([0-9]{1,8})$`; // Regex para extraer número
  const wherePattern = `^${prefijo}-${year}-[0-9]{1,8}$`; // Regex para filtrar filas

  console.log('[CLONE-FOLIO] Patterns:', { folioPattern, wherePattern });

  const folioResult = await pool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(numero_folio FROM $1) AS BIGINT)), 0) + 1 AS next_number
     FROM cotizaciones
     WHERE numero_folio ~ $2
     AND LENGTH(SUBSTRING(numero_folio FROM $1)) <= 8`,
    [folioPattern, wherePattern]
  );

  console.log('[CLONE-FOLIO] Resultado query:', folioResult.rows[0]);

  const nextNumber = folioResult.rows[0]?.next_number || 1;
  const numero = `${prefijo}-${year}-${String(nextNumber).padStart(6, '0')}`;

  console.log('[CLONE-FOLIO] Siguiente número:', nextNumber);
  console.log('[CLONE-FOLIO] Folio generado:', numero);

  // DEBUG EXHAUSTIVO: Verificar TODOS los campos INTEGER
  console.log('🔍 [DEBUG] Verificando campos INTEGER:');
  console.log('  id_cliente:', data.id_cliente, '| tipo:', typeof data.id_cliente);
  console.log('  id_almacen:', data.id_almacen, '| tipo:', typeof data.id_almacen);
  console.log('  id_vendedor:', data.id_vendedor, '| tipo:', typeof data.id_vendedor);
  console.log('  creado_por:', data.creado_por, '| tipo:', typeof data.creado_por);
  console.log('  modificado_por:', data.modificado_por, '| tipo:', typeof data.modificado_por);
  console.log('  cotizacion_origen:', data.cotizacion_origen, '| tipo:', typeof data.cotizacion_origen);
  console.log('  supervisor_vendedor:', data.supervisor_vendedor, '| tipo:', typeof data.supervisor_vendedor);
  console.log('  id_almacen_recoleccion:', data.id_almacen_recoleccion, '| tipo:', typeof data.id_almacen_recoleccion);
  console.log('  userId:', userId, '| tipo:', typeof userId);

  const result = await pool.query(
    `INSERT INTO cotizaciones(
      numero_cotizacion, id_cliente, tipo, fecha_cotizacion,
      id_almacen, nombre_almacen, ubicacion_almacen,
      dias_periodo, fecha_inicio, fecha_fin, periodo,
      subtotal, iva, costo_envio, total, requiere_entrega,
      direccion_entrega, tipo_envio, distancia_km, detalle_calculo,
      contacto_nombre, contacto_email, contacto_telefono, tipo_cliente,
      entrega_lote, hora_entrega_solicitada, fecha_entrega_solicitada,
      entrega_calle, entrega_numero_ext, entrega_numero_int, entrega_colonia,
      entrega_cp, entrega_municipio, entrega_estado, entrega_referencia,
      entrega_kilometros, tipo_zona, instrucciones_entrega,
      garantia_monto, garantia_porcentaje, costo_adicional, concepto_adicional,
      productos_seleccionados, notas_internas, configuracion_especial,
      condiciones, accesorios_seleccionados,
      notificaciones_enviadas, recordatorios_programados,
      moneda, tipo_cambio, estado, prioridad,
      descripcion, notas, creado_por, modificado_por,
      numero_folio, precio_unitario, cantidad_total, id_vendedor,
      metodo_pago, terminos_pago,
      es_clon, cotizacion_origen, clon_de_folio, motivo_cambio,
      cambios_en_clon, sucursal_vendedor, supervisor_vendedor,
      metodo_entrega, id_almacen_recoleccion,
      hora_inicio, hora_fin, entrega_contacto, entrega_telefono
    ) VALUES(
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
      $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
      $41, $42, $43, $44, $45, $46, $47, $48, $49, $50,
      $51, $52, $53, $54, $55, $56, $57, $58, $59, $60,
      $61, $62, $63, $64, $65, $66, $67, $68, $69, $70,
      $71, $72, $73, $74, $75, $76
    ) RETURNING * `,
    [
      numero,                                             // $1
      // Validar id_cliente - debe ser número o NULL
      (data.id_cliente && !isNaN(data.id_cliente)) ? Number(data.id_cliente) : null, // $2
      data.tipo,                                          // $3
      data.fecha_cotizacion || new Date().toISOString().split('T')[0], // $4
      // Validar id_almacen - debe ser número o NULL
      (data.id_almacen && !isNaN(data.id_almacen)) ? Number(data.id_almacen) : null, // $5
      data.nombre_almacen,                                // $6
      data.ubicacion_almacen,                             // $7
      data.dias_periodo || 1,                             // $8
      data.fecha_inicio,                                  // $9
      data.fecha_fin,                                     // $10
      data.periodo || 'Día',                              // $11
      data.subtotal || 0,                                 // $12
      data.iva || 0,                                      // $13
      data.costo_envio || 0,                              // $14
      data.total || 0,                                    // $15
      data.requiere_entrega ?? true,                    // $16
      data.direccion_entrega,                             // $17
      data.tipo_envio || 'local',                         // $18
      data.distancia_km || 0,                             // $19
      JSON.stringify(data.detalle_calculo || {}),        // $20
      data.contacto_nombre,                               // $21
      data.contacto_email,                                // $22
      data.contacto_telefono,                             // $23
      data.tipo_cliente || 'Público en General',          // $24
      data.entrega_lote,                                  // $25
      data.hora_entrega_solicitada,                       // $26
      data.fecha_entrega_solicitada || null,              // $27
      data.entrega_calle,                                 // $28
      data.entrega_numero_ext,                            // $29
      data.entrega_numero_int,                            // $30
      data.entrega_colonia,                               // $31
      data.entrega_cp,                                    // $32
      data.entrega_municipio,                             // $33
      data.entrega_estado,                                // $34
      data.entrega_referencia,                            // $35
      data.entrega_kilometros || 0,                       // $36
      data.tipo_zona,                                     // $37
      null,                                               // $38 (instrucciones_entrega)
      data.garantia_monto || 0,                           // $39
      data.garantia_porcentaje || 0,                      // $40
      data.costo_adicional || 0,                          // $41
      data.concepto_adicional || null,                    // $42
      JSON.stringify(data.productos_seleccionados || []), // $43
      JSON.stringify(data.notas_internas || []),          // $44
      JSON.stringify(data.configuracion_especial || {}), // $45
      data.condiciones || null,                           // $46
      JSON.stringify(data.accesorios_seleccionados || []), // $47
      JSON.stringify(data.notificaciones_enviadas || []), // $48
      JSON.stringify(data.recordatorios_programados || []), // $49
      data.moneda || 'MXN',                               // $50
      data.tipo_cambio || 1,                              // $51
      data.estado || 'Borrador',                          // $52
      data.prioridad || 'Media',                          // $53
      data.descripcion || '',                             // $54
      data.notas || '',                                   // $55
      // Validar creado_por - debe ser número o NULL
      (userId || data.creado_por) && !isNaN(userId || data.creado_por)
        ? Number(userId || data.creado_por) : null,      // $56
      // Validar modificado_por - debe ser número o NULL
      (userId || data.modificado_por) && !isNaN(userId || data.modificado_por)
        ? Number(userId || data.modificado_por) : null,  // $57
      numero,                                             // $58
      data.precio_unitario || 0,                          // $59
      data.cantidad_total || 0,                           // $60
      // Validar id_vendedor - debe ser número o NULL
      (data.id_vendedor || userId) && !isNaN(data.id_vendedor || userId)
        ? Number(data.id_vendedor || userId) : null,     // $61
      data.metodo_pago || 'Transferencia',                // $62
      data.terminos_pago || 'Anticipado',                 // $63
      data.es_clon || false,                              // $64
      // Validar cotizacion_origen - debe ser número o NULL
      data.cotizacion_origen && !isNaN(data.cotizacion_origen)
        ? Number(data.cotizacion_origen) : null,         // $65
      data.clon_de_folio,                                 // $66
      data.motivo_cambio || 'Clonación',                  // $67
      JSON.stringify(data.cambios_en_clon || {}),        // $68
      data.sucursal_vendedor,                             // $69
      // Validar supervisor_vendedor - debe ser número o NULL
      data.supervisor_vendedor && !isNaN(data.supervisor_vendedor)
        ? Number(data.supervisor_vendedor) : null,       // $70
      data.metodo_entrega || null,                        // $71
      // Validar id_almacen_recoleccion - debe ser número o NULL
      data.id_almacen_recoleccion && !isNaN(data.id_almacen_recoleccion)
        ? Number(data.id_almacen_recoleccion) : null,    // $72
      data.hora_inicio || null,                           // $73
      data.hora_fin || null,                              // $74
      data.entrega_contacto || null,                      // $75
      data.entrega_telefono || null                       // $76
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
       WHERE id_cotizacion = $1 RETURNING * `,
      [id, ...valores, JSON.stringify(nuevoHistorial), userId]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error actualizando cotización:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Generar folio consecutivo para Nota de Venta
const generarFolioNota = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Verificar si la cotización ya tiene folio
    const cotizacionResult = await pool.query(
      'SELECT numero_nota, numero_cotizacion FROM cotizaciones WHERE id_cotizacion = $1',
      [id]
    );

    if (cotizacionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    const cotizacion = cotizacionResult.rows[0];

    // Si ya tiene folio, devolverlo
    if (cotizacion.numero_nota) {
      return res.json({ folio: cotizacion.numero_nota, es_nuevo: false });
    }

    // 2. Calcular siguiente folio del mes actual
    const hoy = new Date();
    const year = hoy.getFullYear();
    const month = String(hoy.getMonth() + 1).padStart(2, '0');
    const prefix = `${year} -${month} `; // Ej: 2026-02

    // Buscar el último folio del mes (formato YYYY-MM-NNNN)
    // Se busca en la tabla cotizaciones (columna numero_nota)
    const result = await pool.query(
      `SELECT numero_nota 
       FROM cotizaciones 
       WHERE numero_nota LIKE $1 
       ORDER BY numero_nota DESC 
       LIMIT 1`,
      [`${prefix} -% `]
    );

    let nextNum = 1;
    if (result.rows.length > 0) {
      const ultimoFolio = result.rows[0].numero_nota;
      const parts = ultimoFolio.split('-');
      if (parts.length === 3) {
        nextNum = parseInt(parts[2]) + 1;
      }
    }

    const nuevoFolio = `${prefix} -${String(nextNum).padStart(4, '0')} `; // Ej: 2026-02-0001

    // 3. Guardar el nuevo folio en la cotización
    await pool.query(
      'UPDATE cotizaciones SET numero_nota = $1 WHERE id_cotizacion = $2',
      [nuevoFolio, id]
    );

    console.log(`[generarFolioNota] Asignado folio ${nuevoFolio} a cotización ${id} `);

    res.json({ folio: nuevoFolio, es_nuevo: true });

  } catch (error) {
    console.error('Error generando folio de nota:', error);
    res.status(500).json({ error: 'Error interno al generar folio' });
  }
};

module.exports = {
  getSiguienteNumero,
  getCotizaciones,
  getCotizacion,
  createCotizacion,
  updateCotizacion,
  deleteCotizacion,
  convertirAContrato,
  getHistorialCotizacion,
  clonarCotizacion,
  updateCotizacionWithHistory,
  generarFolioNota
};