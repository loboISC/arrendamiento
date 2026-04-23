const db = require('../config/database');
const { pool } = require('../config/database');
const logisticaController = require('./logistica');

/**
 * Obtener el siguiente número consecutivo de contrato para un mes
 * Formato: CT-YYYY-MM-NNNN
 * El número es secuencial para todo el año, no se reinicia cada mes
 */
exports.getSiguienteNumero = async (req, res) => {
  try {
    const { mes } = req.query; // formato: YYYY-MM

    if (!mes || !mes.match(/^\d{4}-\d{2}$/)) {
      return res.status(400).json({ error: 'Formato de mes inválido (debe ser YYYY-MM)' });
    }

    // Extraer el año del mes (ej: "2026" de "2026-02")
    const año = mes.substring(0, 4);

    // Contar cuántos contratos existen para TODO este año (secuencial anual)
    const result = await pool.query(
      `SELECT COUNT(*) as cantidad 
       FROM contratos 
       WHERE numero_contrato LIKE $1`,
      [`CT-${año}-%`]
    );

    const cantidad = parseInt(result.rows[0].cantidad || 0);
    const siguiente = cantidad + 1;

    res.json({ siguiente, mes });
  } catch (error) {
    console.error('Error al obtener siguiente número:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener el siguiente número consecutivo de nota para un mes
 * Formato: YYYY-MM-NNNN
 * El número es secuencial para todo el año, no se reinicia cada mes
 */
exports.getSiguienteNumeronota = async (req, res) => {
  try {
    const { mes } = req.query; // formato: YYYY-MM

    if (!mes || !mes.match(/^\d{4}-\d{2}$/)) {
      return res.status(400).json({ error: 'Formato de mes inválido (debe ser YYYY-MM)' });
    }

    // Extraer el año del mes (ej: "2026" de "2026-02")
    const año = mes.substring(0, 4);

    // Contar cuántas notas existen para TODO este año (secuencial anual)
    const result = await pool.query(
      `SELECT COUNT(*) as cantidad 
       FROM contratos 
       WHERE numero_nota LIKE $1`,
      [`${año}-%`]
    );

    const cantidad = parseInt(result.rows[0].cantidad || 0);
    const siguiente = cantidad + 1;

    res.json({ siguiente, mes });
  } catch (error) {
    console.error('Error al obtener siguiente número de nota:', error);
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

// Dashboard/KPIs de contratos (backend)
exports.getDashboardKpis = async (req, res) => {
  try {
    const periodo = ['dia', 'semana', 'mes'].includes((req.query.periodo || '').toLowerCase())
      ? req.query.periodo.toLowerCase()
      : 'mes';
    const fechaDesde = req.query.fecha_desde ? new Date(req.query.fecha_desde) : null;
    const fechaHasta = req.query.fecha_hasta ? new Date(req.query.fecha_hasta) : null;

    const { rows } = await db.query(
      `SELECT c.*, cl.nombre AS nombre_cliente
       FROM contratos c
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       ORDER BY c.id_contrato DESC`
    );

    const normalizeText = (value) => String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const safeDate = (value) => {
      if (!value) return null;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const safeNumber = (value) => {
      const n = Number(value ?? 0);
      return Number.isFinite(n) ? n : 0;
    };

    const today = startOfDay(new Date());
    const inDateRange = (contratoDate) => {
      if (!contratoDate) return false;
      const d = startOfDay(contratoDate);
      if (fechaDesde && !Number.isNaN(fechaDesde.getTime()) && d < startOfDay(fechaDesde)) return false;
      if (fechaHasta && !Number.isNaN(fechaHasta.getTime()) && d > startOfDay(fechaHasta)) return false;
      return true;
    };

    const getEstado = (contrato) => {
      const estadoRaw = normalizeText(contrato.estado);
      if (estadoRaw.includes('cancel')) return 'cancelado';
      if (estadoRaw.includes('conclu')) return 'concluido';

      const fin = safeDate(contrato.fecha_fin);
      if (fin && startOfDay(fin) < today) return 'concluido';
      if (estadoRaw.includes('activo')) return 'activo';
      if (estadoRaw.includes('pend') || estadoRaw.includes('por concluir')) return 'pendiente';
      return 'pendiente';
    };

    const getFechaBase = (contrato) => (
      safeDate(contrato.fecha_contrato) ||
      safeDate(contrato.fecha_inicio) ||
      safeDate(contrato.fecha_creacion) ||
      safeDate(contrato.created_at)
    );

    const getPeriodoKey = (date) => {
      if (!date) return null;
      if (periodo === 'dia') return date.toISOString().slice(0, 10);
      if (periodo === 'semana') {
        const day = date.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(date);
        monday.setDate(date.getDate() + diffToMonday);
        return monday.toISOString().slice(0, 10);
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };

    const formatPeriodoLabel = (key) => {
      if (!key) return 'N/A';
      if (periodo === 'dia') return key;
      if (periodo === 'semana') return `Sem ${key}`;
      const [year, month] = key.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      return d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
    };

    const contratos = rows.filter((c) => inDateRange(getFechaBase(c)));

    let contratosActivos = 0;
    let contratosConcluidos = 0;
    let contratosCancelados = 0;
    let contratosPorVencer = 0;
    let montoActivo = 0;

    let totalNoCancelados = 0;
    let contratosProrroga = 0;
    let sumaValorContratos = 0;
    let conteoValorContratos = 0;
    let carteraActivaMonto = 0;
    let carteraRiesgo30Monto = 0;

    const periodKeys = new Set();
    const activosByPeriodo = new Map();
    const concluidosByPeriodo = new Map();
    const totalByPeriodo = new Map();

    contratos.forEach((c) => {
      const estado = getEstado(c);
      const fechaBase = getFechaBase(c);
      const key = getPeriodoKey(fechaBase);
      const totalContrato = safeNumber(c.total ?? c.monto ?? 0);

      if (key) {
        periodKeys.add(key);
        totalByPeriodo.set(key, (totalByPeriodo.get(key) || 0) + 1);
      }

      if (estado === 'activo') {
        contratosActivos += 1;
        montoActivo += totalContrato;
        if (key) activosByPeriodo.set(key, (activosByPeriodo.get(key) || 0) + 1);
      } else if (estado === 'concluido') {
        contratosConcluidos += 1;
        if (key) concluidosByPeriodo.set(key, (concluidosByPeriodo.get(key) || 0) + 1);
      } else if (estado === 'cancelado') {
        contratosCancelados += 1;
      }

      if (estado !== 'cancelado') {
        totalNoCancelados += 1;
        sumaValorContratos += totalContrato;
        conteoValorContratos += 1;
      }

      const estadoRaw = normalizeText(c.estado);
      if (estadoRaw.includes('prorroga') || estadoRaw.includes('proroga') || estadoRaw.includes('renov')) {
        contratosProrroga += 1;
      }

      const fechaFin = safeDate(c.fecha_fin);
      if (fechaFin && estado !== 'concluido' && estado !== 'cancelado') {
        const finDay = startOfDay(fechaFin);
        const diasRestantes = Math.ceil((finDay - today) / (1000 * 60 * 60 * 24));
        if (diasRestantes >= 0 && diasRestantes <= 7) {
          contratosPorVencer += 1;
        }

        carteraActivaMonto += totalContrato;
        if (diasRestantes >= 0 && diasRestantes <= 30) {
          carteraRiesgo30Monto += totalContrato;
        }
      }
    });

    const sortedKeys = Array.from(periodKeys).sort();
    const labels = sortedKeys.map(formatPeriodoLabel);

    const tasaRenovacionProrroga = totalNoCancelados > 0 ? (contratosProrroga / totalNoCancelados) : 0;
    const valorPromedioContrato = conteoValorContratos > 0 ? (sumaValorContratos / conteoValorContratos) : 0;
    const riesgoPct = carteraActivaMonto > 0 ? (carteraRiesgo30Monto / carteraActivaMonto) : 0;

    res.json({
      success: true,
      data: {
        periodo,
        kpis: {
          contratosActivos,
          contratosConcluidos,
          contratosPorVencer,
          montoActivo,
          contratosCancelados,
          tasaRenovacionProrroga,
          valorPromedioContrato,
          riesgoVencimientoPorCartera: {
            porcentaje: riesgoPct,
            montoRiesgo: carteraRiesgo30Monto,
            montoCartera: carteraActivaMonto
          }
        },
        charts: {
          activosConcluidos: {
            labels,
            activos: sortedKeys.map((k) => activosByPeriodo.get(k) || 0),
            concluidos: sortedKeys.map((k) => concluidosByPeriodo.get(k) || 0)
          },
          contratosPeriodo: {
            labels,
            data: sortedKeys.map((k) => totalByPeriodo.get(k) || 0)
          }
        }
      }
    });
  } catch (err) {
    console.error('Error en getDashboardKpis contratos:', err);
    res.status(500).json({ success: false, error: err.message });
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

    const { rows: asignaciones } = await db.query(
      `SELECT id, estado, fecha_asignacion, fecha_fin, tipo_referencia, tipo_movimiento
       FROM logistica_asignaciones
       WHERE pedido_id::TEXT = $1::TEXT
         AND (UPPER(tipo_referencia) = 'CONTRATO' OR tipo_referencia IS NULL)
       ORDER BY
         CASE
           WHEN estado = 'en_ruta' THEN 1
           WHEN estado = 'en_espera' THEN 2
           WHEN estado = 'completado' THEN 3
           ELSE 4
         END,
         COALESCE(fecha_asignacion, fecha_fin, CURRENT_TIMESTAMP) DESC,
         id DESC
       LIMIT 1`,
      [id]
    );

    const asignacion = asignaciones[0] || null;
    const seguimiento = asignacion ? {
      asignacion_id: asignacion.id,
      estado: asignacion.estado,
      tipo_referencia: asignacion.tipo_referencia,
      tipo_movimiento: asignacion.tipo_movimiento,
      fecha_asignacion: asignacion.fecha_asignacion,
      fecha_fin: asignacion.fecha_fin,
      url: null
    } : null;

    res.json({
      ...contrato,
      items: items,
      seguimiento_cliente: seguimiento
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
      contacto_obra,
      telefono_obra,
      celular_obra,
      usuario_creacion,
      equipo,
      dias_renta,
      hora_inicio,
      hora_fin,
      precio_por_dia,
      metodo_entrega,
      items,
      tipo_logistica
    } = req.body;

    const fechaContratoFinal = fecha_contrato || fecha_inicio;
    const totalFinal = total ?? monto;
    const importeGarantiaFinal = importe_garantia ?? monto_garantia;

    // Resolver tipo_logistica: viene del body o se lee desde cotizaciones.tipo_zona
    let tipoLogisticaFinal = (tipo_logistica || '').toLowerCase();
    if (!tipoLogisticaFinal && id_cotizacion) {
      const cotRes = await client.query(
        'SELECT tipo_zona FROM cotizaciones WHERE id_cotizacion = $1', [id_cotizacion]
      );
      if (cotRes.rows.length > 0 && cotRes.rows[0].tipo_zona) {
        const tz = cotRes.rows[0].tipo_zona.toLowerCase();
        tipoLogisticaFinal = (tz.includes('foran') || tz.includes('forán')) ? 'foranea' : 'metropolitana';
      }
    }
    if (!tipoLogisticaFinal) tipoLogisticaFinal = 'metropolitana';
    console.log(`[Contratos] tipo_logistica resuelto: ${tipoLogisticaFinal}`);

    // Insertar contrato principal
    const { rows } = await client.query(
      `INSERT INTO contratos (
        numero_contrato, id_cliente, tipo, requiere_factura, fecha_contrato, fecha_fin, id_cotizacion,
        responsable, estado, subtotal, impuesto, descuento, total, tipo_garantia, importe_garantia,
        calle, numero_externo, numero_interno, colonia, codigo_postal, entre_calles,
        pais, estado_entidad, municipio, notas_domicilio, contacto_obra, telefono_obra, celular_obra, 
        usuario_creacion, equipo, dias_renta, hora_inicio, hora_fin, precio_por_dia, metodo_entrega,
        fecha_creacion, fecha_actualizacion, estado_logistica, tipo_logistica
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $36, $37
      ) RETURNING *`,
      [
        numero_contrato, id_cliente, tipo, requiere_factura, fechaContratoFinal, fecha_fin, id_cotizacion,
        responsable, estado || 'Activo', subtotal, impuesto, descuento, totalFinal, tipo_garantia, importeGarantiaFinal,
        calle, numero_externo, numero_interno, colonia, codigo_postal, entre_calles,
        pais || 'México', estado_entidad || 'México', municipio, notas_domicilio, contacto_obra, telefono_obra, celular_obra,
        usuario_creacion, equipo, dias_renta, hora_inicio, hora_fin, precio_por_dia || 0, metodo_entrega || 'Sucursal',
        metodo_entrega === 'domicilio' ? 'en_espera' : 'sucursal',
        tipoLogisticaFinal
      ]
    );

    const id_contrato = rows[0].id_contrato;

    // Insertar items del contrato si existen
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO contrato_items(id_contrato, clave, descripcion, cantidad, precio_unitario, garantia, total)
    VALUES($1, $2, $3, $4, $5, $6, $7)`,
          [id_contrato, item.clave, item.descripcion, item.cantidad, item.precio_unitario, item.garantia, item.total]
        );
      }
    }

    await client.query('COMMIT');

    let logisticaResult = null;
    // DISPARADOR LOGÍSTICO
    // Si el método de entrega es domicilio, intentamos asignar automáticamente
    if (metodo_entrega === 'domicilio') {
      try {
        logisticaResult = await logisticaController.procesarAsignacionAutomatica(
          id_contrato, 'CONTRATO', tipoLogisticaFinal
        );
        console.log(`[Logística] Disparador activado para contrato ${id_contrato}. Tipo: ${tipoLogisticaFinal}. Resultado:`, logisticaResult);
      } catch (logErr) {
        console.error(`[Logística] Error en disparador automático para contrato ${id_contrato}:`, logErr);
      }
    }

    res.status(201).json({ 
      message: 'Contrato guardado exitosamente', 
      contrato: rows[0],
      logistica: logisticaResult
    });
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
      contacto_obra,
      telefono_obra,
      celular_obra,
      equipo,
      dias_renta,
      hora_inicio,
      hora_fin,
      precio_por_dia,
      items,
      prorroga_detalle
    } = req.body;

    const fechaContratoFinal = fecha_contrato || fecha_inicio;
    const totalFinal = total ?? monto;
    const importeGarantiaFinal = importe_garantia ?? monto_garantia;

    // Actualizar contrato principal y manejar historial si es una prórroga
    let queryUpdate = `UPDATE contratos SET
        numero_contrato=$1, id_cliente=$2, tipo=$3, requiere_factura=$4, fecha_contrato=$5, fecha_fin=$6, id_cotizacion=$7,
        responsable=$8, estado=$9, subtotal=$10, impuesto=$11, descuento=$12, total=$13, tipo_garantia=$14, importe_garantia=$15,
        calle=$16, numero_externo=$17, numero_interno=$18, colonia=$19, codigo_postal=$20, entre_calles=$21,
        pais=$22, estado_entidad=$23, municipio=$24, notas_domicilio=$25, contacto_obra=$26, telefono_obra=$27, celular_obra=$28,
        equipo=$29, dias_renta=$30, hora_inicio=$31, hora_fin=$32, precio_por_dia=$33, fecha_actualizacion=CURRENT_TIMESTAMP`;

    const paramsUpdate = [
      numero_contrato, id_cliente, tipo, requiere_factura, fechaContratoFinal, fecha_fin, id_cotizacion,
      responsable, estado || 'Activo', subtotal, impuesto, descuento, totalFinal, tipo_garantia, importeGarantiaFinal,
      calle, numero_externo, numero_interno, colonia, codigo_postal, entre_calles,
      pais || 'México', estado_entidad || 'México', municipio, notas_domicilio, contacto_obra, telefono_obra, celular_obra,
      equipo, dias_renta, hora_inicio, hora_fin, precio_por_dia || 0
    ];

    if (prorroga_detalle) {
      queryUpdate += `, historial_prorrogas = COALESCE(historial_prorrogas, '[]'::jsonb) || $34::jsonb`;
      paramsUpdate.push(JSON.stringify(prorroga_detalle));
      paramsUpdate.push(id);
      queryUpdate += ` WHERE id_contrato=$35 RETURNING *`;
    } else {
      paramsUpdate.push(id);
      queryUpdate += ` WHERE id_contrato=$34 RETURNING *`;
    }

    const { rows } = await client.query(queryUpdate, paramsUpdate);

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
          `INSERT INTO contrato_items(id_contrato, clave, descripcion, cantidad, precio_unitario, garantia, total)
           VALUES($1, $2, $3, $4, $5, $6, $7)`,
          [id, item.clave, item.descripcion, item.cantidad, item.precio_unitario, item.garantia, item.total]
        );
      }
    }

    /* 
    // MECANISMO DE SEGURIDAD PARA LOGÍSTICA
    // Si meten prórroga pero Logística ya había creado el viaje de recolección, hay que abortarlo.
    if (prorroga_detalle) {
      const { rows: cancelados } = await client.query(`
        UPDATE logistica_asignaciones 
        SET estado = 'cancelado' 
        WHERE pedido_id::TEXT = $1::TEXT 
          AND (UPPER(tipo_referencia) = 'CONTRATO' OR tipo_referencia IS NULL)
          AND UPPER(TRIM(tipo_movimiento)) = 'RECOLECCION' 
          AND estado IN ('en_espera', 'en_ruta')
        RETURNING vehiculo_id
      `, [id]);
      
      for (const viaje of cancelados) {
         if (viaje.vehiculo_id) {
            await client.query("UPDATE vehiculos SET estatus = 'activo' WHERE id = $1", [viaje.vehiculo_id]);
         }
      }
    }
    */

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

// Actualizar solo el estado del contrato
exports.updateEstado = async (req, res) => {
  const { id } = req.params;
  const { estado, m_cancelado } = req.body;

  if (!estado) {
    return res.status(400).json({ error: 'El estado es requerido' });
  }

  try {
    let result;
    if (m_cancelado !== undefined) {
      result = await db.query(
        'UPDATE contratos SET estado = $1, "M_cancelado" = $2, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_contrato = $3 RETURNING *',
        [estado, m_cancelado, id]
      );
    } else {
      result = await db.query(
        'UPDATE contratos SET estado = $1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_contrato = $2 RETURNING *',
        [estado, id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    res.json({ message: 'Estado del contrato actualizado', contrato: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Elimina una prórroga del historial y revierte fechas/montos si es la última
 */
exports.deleteProrroga = async (req, res) => {
  const { id, id_historial } = req.params;
  console.log('[deleteProrroga] Iniciando eliminación:', { id, id_historial });
  let client;
  
  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    // 1. Obtener contrato actual
    const { rows } = await client.query('SELECT * FROM contratos WHERE id_contrato = $1', [id]);
    console.log('[deleteProrroga] Contrato encontrado:', rows.length > 0);
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }

    const contrato = rows[0];
    let historial = Array.isArray(contrato.historial_prorrogas) ? contrato.historial_prorrogas : [];
    
    if (historial.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El contrato no tiene prórrogas registradas' });
    }

    // 2. Identificar la prórroga a eliminar
    const indexAEliminar = historial.findIndex(h => {
        const hId = h.id_historial || h.id_prorroga;
        return String(hId) === String(id_historial);
    });
    if (indexAEliminar === -1) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'La prórroga especificada no existe en el historial' });
    }

    const esLaUltima = (indexAEliminar === historial.length - 1);
    const prorrogaAEliminar = historial[indexAEliminar];

    // 3. Filtrar historial
    const nuevoHistorial = historial.filter((_, idx) => idx !== indexAEliminar);

    // 4. Si es la última, revertir datos maestros del contrato
    if (esLaUltima) {
      console.log('[deleteProrroga] Revirtiendo datos a estado anterior:', {
        fecha: prorrogaAEliminar.fecha_fin_original,
        subtotal: prorrogaAEliminar.prev_subtotal,
        total: prorrogaAEliminar.prev_total
      });

      const nuevaFechaFin = prorrogaAEliminar.fecha_fin_original;
      const nuevoSubtotal = prorrogaAEliminar.prev_subtotal;
      const nuevoTotal = prorrogaAEliminar.prev_total;

      await client.query(`
        UPDATE contratos 
        SET fecha_fin = $1, 
            subtotal = $2, 
            total = $3, 
            historial_prorrogas = $4,
            estado = CASE 
                        WHEN $1 < CURRENT_DATE THEN 'Concluido' 
                        ELSE 'Activo con prórroga' 
                     END
        WHERE id_contrato = $5
      `, [nuevaFechaFin, nuevoSubtotal, nuevoTotal, JSON.stringify(nuevoHistorial), id]);
    } else {
      // Si no es la última, solo actualizamos el historial
      await client.query(`
        UPDATE contratos 
        SET historial_prorrogas = $1 
        WHERE id_contrato = $2
      `, [JSON.stringify(nuevoHistorial), id]);
    }

    console.log('[deleteProrroga] Eliminación completada con éxito');
    await client.query('COMMIT');
    res.json({ success: true, message: 'Prórroga eliminada correctamente' });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('Error eliminando prórroga:', error);
    res.status(500).json({ error: 'Error interno: ' + error.message });
  } finally {
    if (client) client.release();
  }
};
