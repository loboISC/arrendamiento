const db = require('../config/database');
const EmailService = require('../services/emailService');
const PDFServiceClass = require('../services/pdfService');
const pdfService = new PDFServiceClass();
const path = require('path');
const fs = require('fs');
const { broadcastEvent } = require('../socketGateway');
let ultimoAvisoDocsPorVencer = 0;

/**
 * CONTROLADOR DE LOGISTICA (Version RF1 Reforzada)
 * Maneja la logica de vehiculos, polizas, placas, verificaciones y mantenimientos.
 */

// --- GESTION DE VEHICULOS Y DOCUMENTOS (COMPUESTO) ---

exports.obtenerVehiculos = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM vehiculos ORDER BY economico');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener vehiculos: ' + error.message });
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

    // 1. Insertar Vehiculo
    const { rows: vehiculo } = await db.query(
      `INSERT INTO vehiculos (economico, placa, marca, modelo, anio, tipo_vehiculo, capacidad_carga, kilometraje_inicial, estatus)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activo') RETURNING *`,
      [economico, placa, marca, modelo, anio, tipo_vehiculo, capacidad_carga, kilometraje_inicial]
    );

    const vehiculoId = vehiculo[0].id;

    // 2. Insertar documentos si vienen en la peticion (Seguro, Placa, Verificacion)
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

// --- GESTION DE DOCUMENTOS (RF1) ---

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

// --- GESTION DE MANTENIMIENTOS ---

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

// ============================================================================
// FUNCIÓN AUXILIAR: Registrar evento de seguimiento
// Se llamará cada vez que cambia el estado de una asignación
// ============================================================================
async function registrarEventoSeguimiento(asignacionId, estado, descripcion, ubicacion = null, metadata = null) {
  try {
    const { rows } = await db.query(
      `INSERT INTO seguimiento_eventos (asignacion_id, estado, descripcion, ubicacion, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING id, created_at`,
      [asignacionId, estado, descripcion, ubicacion, metadata ? JSON.stringify(metadata) : null]
    );
    console.log(`[SEGUIMIENTO] Evento registrado - Asignación: ${asignacionId}, Estado: ${estado}`);
    return rows[0];
  } catch (error) {
    console.error(`[ERROR] Error registrando evento de seguimiento:`, error);
    // No lanzar error, solo loguear. El evento de seguimiento es secundario.
    return null;
  }
}

exports.obtenerChoferesDisponibles = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT e.id, 
              (e.nombre || ' ' || COALESCE(e.apellidos, '')) AS nombre,
              e.correo_empresa AS email,
              e.celular_empresa
       FROM rh_empleados e
       JOIN rh_puestos p ON e.puesto_id = p.id
       WHERE LOWER(p.nombre) LIKE '%chofer%'
         AND e.estado = 'Activo'
       ORDER BY e.nombre ASC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener choferes: ' + error.message });
  }
};

exports.crearAsignacion = async (req, res) => {
  const { vehiculo_id, chofer_id, pedido_id, tipo_referencia, tipo_movimiento } = req.body;
  const movimientoFinal = tipo_movimiento ? tipo_movimiento.toUpperCase() : 'ENTREGA';
  const client = await db.pool.connect();
  
  console.log('[DEBUG] crearAsignacion recibido:', { vehiculo_id, chofer_id, pedido_id, tipo_referencia, movimientoFinal });
  
  // VALIDACION CRITICA: pedido_id no puede ser NULL
  if (!pedido_id || pedido_id.toString().trim() === '') {
    await client.release();
    console.error('[ERROR] crearAsignacion: pedido_id es NULL o vacío');
    return res.status(400).json({ error: 'pedido_id es requerido y no puede estar vacío' });
  }
  
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO logistica_asignaciones (vehiculo_id, chofer_id, pedido_id, tipo_referencia, estado, tipo_movimiento)
       VALUES ($1, $2, $3, $4, 'en_ruta', $5) RETURNING *`,
      [vehiculo_id, chofer_id, pedido_id, tipo_referencia, movimientoFinal]
    );

    // 4. Actualizar estado del vehiculo a ocupado
    await client.query("UPDATE vehiculos SET estatus = 'ocupado' WHERE id = $1", [vehiculo_id]);

    // 4.5. Limpiar de "Pedidos en Espera" o actualizar Contratos
    if (movimientoFinal === 'RECOLECCION') {
       if (tipo_referencia === 'CONTRATO') {
          await client.query("UPDATE contratos SET estado_logistica = 'en_recoleccion' WHERE id_contrato = $1", [pedido_id]);
       }
    } else {
       if (tipo_referencia === 'CONTRATO') {
          await client.query("UPDATE contratos SET estado_logistica = 'asignado' WHERE id_contrato = $1", [pedido_id]);
       } else {
          // Para ventas u otros, la lista de espera genero un registro temporal y se borra al crear el real
          await client.query("DELETE FROM logistica_asignaciones WHERE pedido_id = $1 AND estado = 'en_espera'", [pedido_id]);
       }
    }

    await client.query('COMMIT');
    
    console.log('[DEBUG] crearAsignacion exitosa. ID guardado:', rows[0].id, 'pedido_id guardado:', rows[0].pedido_id);
    
    // Notificacion adicional por email (manual)
    if (rows && rows.length > 0) {
      notificarChoferPorEmail(chofer_id, rows[0].id, pedido_id);
      broadcastEvent({
        tipo: 'pedido_asignado',
        asignacion_id: rows[0].id,
        pedido_id,
        chofer_id,
        vehiculo_id
      });

      // ========== REGISTRAR EVENTO DE SEGUIMIENTO ==========
      const tipoMovimiento = rows[0].tipo_movimiento || 'ENTREGA';
      const estadoDescripcion = tipoMovimiento === 'RECOLECCION' 
        ? 'Equipos en bodega, listos para recolección en sitio'
        : 'Equipos verificados y listos para entrega en obra';
      
      await registrarEventoSeguimiento(
        rows[0].id,
        'en_preparacion',
        estadoDescripcion,
        'Bodega Andamios Torres',
        { 
          tipo_operacion: tipoMovimiento,
          vehiculo_economico: rows[0].vehiculo_id,
          chofer_id: rows[0].chofer_id
        }
      );
    }

    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en crearAsignacion:', error);
    res.status(500).json({ error: 'Error en asignacion: ' + error.message });
  } finally {
    client.release();
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

    const ahora = Date.now();
    if (alerts.length > 0 && ahora - ultimoAvisoDocsPorVencer > 60000) {
      ultimoAvisoDocsPorVencer = ahora;
      broadcastEvent({
        tipo: 'notificacion',
        mensaje: `Hay ${alerts.length} documento(s) por vencer en logistica`
      });
    }

    const { rows: routes } = await db.query(
      `SELECT a.*, v.economico as vehiculo_economico,
              (e.nombre || ' ' || COALESCE(e.apellidos,'')) AS chofer_nombre,
              e.celular_empresa AS chofer_telefono,
              COALESCE(c.numero_contrato, cot.numero_cotizacion) AS folio_referencia
       FROM logistica_asignaciones a
       LEFT JOIN vehiculos v ON a.vehiculo_id = v.id
       LEFT JOIN rh_empleados e ON a.chofer_id = e.id
       LEFT JOIN contratos c ON a.pedido_id::TEXT = c.id_contrato::TEXT
         AND (a.tipo_referencia = 'CONTRATO' OR a.tipo_referencia IS NULL)
       LEFT JOIN cotizaciones cot ON (
         (a.pedido_id::TEXT = cot.id_cotizacion::TEXT) OR 
         (a.pedido_id::TEXT = cot.numero_cotizacion::TEXT)
       ) AND (UPPER(TRIM(a.tipo_referencia)) = 'COTIZACION_VENTA' OR a.tipo_referencia IS NULL)
       WHERE a.estado = 'en_ruta'`
    );
    resumen.asignaciones_activas = routes;

       // Si es cotizacion de VENTA, se devuelve a lista de espera
    const { rows: waitlist } = await db.query(
      `-- Contratos en espera (fuente: contratos.estado_logistica)
       SELECT c.id_contrato::TEXT as pedido_id,
              'CONTRATO' as tipo_referencia,
              c.numero_contrato,
              cl.nombre as cliente_nombre,
              COALESCE(c.fecha_inicio, c.fecha_contrato) as fecha_compromiso
       FROM contratos c
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       WHERE c.estado_logistica = 'en_espera'

       UNION ALL

       -- Cotizaciones VENTA en espera (fuente: logistica_asignaciones)
       SELECT la.pedido_id::TEXT,
              la.tipo_referencia,
              COALESCE(cot.numero_cotizacion, cot.id_cotizacion::TEXT) as numero_contrato,
              COALESCE(cl2.nombre, cot.contacto_nombre) as cliente_nombre,
              cot.fecha_cotizacion as fecha_compromiso
       FROM logistica_asignaciones la
       -- LEFT JOIN para mantener registros aun cuando falle el match con cotizaciones
       -- Cast a TEXT para maxima compatibilidad de JOIN
       LEFT JOIN cotizaciones cot ON (
         (la.pedido_id::TEXT = cot.id_cotizacion::TEXT) OR 
         (la.pedido_id::TEXT = cot.numero_cotizacion::TEXT)
       )
       LEFT JOIN clientes cl2 ON cot.id_cliente = cl2.id_cliente
       WHERE la.estado = 'en_espera' 
         AND UPPER(TRIM(la.tipo_referencia)) = 'COTIZACION_VENTA'

       ORDER BY fecha_compromiso ASC NULLS LAST`
    );
    resumen.asignaciones_espera = waitlist;
    console.log(`[Logistica] Dashboard: ${waitlist.length} pedidos en espera encontrados.`);

    // --- Recolecciones Pendientes ---
    // Consulta dinamica: contratos entregados por vencer sin recoleccion en curso.
    const { rows: recolecciones } = await db.query(
      `SELECT c.id_contrato::TEXT as pedido_id,
              'CONTRATO' as tipo_referencia,
              c.numero_contrato,
              cl.nombre as cliente_nombre,
              c.fecha_fin as fecha_compromiso
       FROM contratos c
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       WHERE c.estado_logistica = 'entregado'
         AND c.estado NOT ILIKE '%cancelado%'
         AND c.fecha_fin <= CURRENT_DATE + INTERVAL '3 days'
         AND NOT EXISTS (
           SELECT 1 FROM logistica_asignaciones la 
           WHERE la.pedido_id::TEXT = c.id_contrato::TEXT 
             AND UPPER(TRIM(la.tipo_movimiento)) = 'RECOLECCION'
             AND la.estado IN ('en_espera', 'en_ruta')
         )
       ORDER BY c.fecha_fin ASC`
    );
    resumen.recolecciones_espera = recolecciones;

    const { rows: mantPend } = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM vehiculos
       WHERE estatus = 'mantenimiento'`
    );
    resumen.mantenimientos_pendientes = mantPend[0]?.total || 0;

    const { rows: retrasos } = await db.query(
      `SELECT a.id, a.pedido_id, a.fecha_asignacion, a.estado,
              v.economico AS vehiculo_economico,
              (e.nombre || ' ' || COALESCE(e.apellidos,'')) AS chofer_nombre,
              COALESCE(c.numero_contrato, cot.numero_cotizacion) AS folio_referencia
       FROM logistica_asignaciones a
       LEFT JOIN vehiculos v ON a.vehiculo_id = v.id
       LEFT JOIN rh_empleados e ON a.chofer_id = e.id
       LEFT JOIN contratos c ON a.pedido_id::TEXT = c.id_contrato::TEXT
         AND (a.tipo_referencia = 'CONTRATO' OR a.tipo_referencia IS NULL)
       LEFT JOIN cotizaciones cot ON (
         (a.pedido_id::TEXT = cot.id_cotizacion::TEXT) OR 
         (a.pedido_id::TEXT = cot.numero_cotizacion::TEXT)
       ) AND (UPPER(TRIM(a.tipo_referencia)) = 'COTIZACION_VENTA' OR a.tipo_referencia IS NULL)
       WHERE a.estado = 'en_ruta'
         AND a.fecha_asignacion <= NOW() - INTERVAL '6 hours'
       ORDER BY a.fecha_asignacion ASC`
    );
    resumen.retrasos_entregas = retrasos;

    // Licencias por vencer (flexible ante diferentes nombres de columna en BD)
    let licencias = [];
    try {
      const { rows: cols } = await db.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'rh_empleados_detalles'
           AND column_name IN ('licencia_vencimiento', 'fecha_vencimiento_licencia', 'licencia_fecha_vencimiento')`
      );

      const licenciaCol = cols[0]?.column_name;
      if (licenciaCol) {
        const queryLic = `
          SELECT d.${licenciaCol}::date AS fecha_vencimiento,
                 e.id AS chofer_id,
                 (e.nombre || ' ' || COALESCE(e.apellidos,'')) AS chofer_nombre
          FROM rh_empleados_detalles d
          JOIN rh_empleados e ON e.id = d.empleado_id
          JOIN rh_puestos p ON p.id = e.puesto_id
          WHERE LOWER(p.nombre) LIKE '%chofer%'
            AND e.estado = 'Activo'
            AND d.${licenciaCol} IS NOT NULL
            AND d.${licenciaCol}::date <= CURRENT_DATE + INTERVAL '30 days'
          ORDER BY d.${licenciaCol}::date ASC`;

        const { rows: rowsLic } = await db.query(queryLic);
        licencias = rowsLic;
      }
    } catch (_) {
      licencias = [];
    }
    resumen.licencias_por_vencer = licencias;

    res.json(resumen);
  } catch (error) {
    res.status(500).json({ error: 'Error en dashboard: ' + error.message });
  }
};

// Helper para notificar al chofer por email con la Hoja de Pedido adjunta
const notificarChoferPorEmail = async (chofer_id, asignacion_id, pedido_id) => {
  try {
    console.log(`[Logistica] Iniciando notificacion por email para chofer ${chofer_id}...`);

    const { rows: empleados } = await db.query(
      `SELECT (nombre || ' ' || COALESCE(apellidos,'')) AS nombre, correo_empresa AS email
       FROM rh_empleados WHERE id = $1`,
      [chofer_id]
    );
    if (empleados.length === 0 || !empleados[0].email) {
      console.warn(`[Logistica] Chofer ${chofer_id} sin correo configurado o no existe en rh_empleados.`);
      return;
    }
    const chofer = empleados[0];

    const { rows: asignRows } = await db.query(
      `SELECT a.pedido_id,
              a.tipo_movimiento,
              COALESCE(c.numero_contrato, cot.numero_cotizacion) AS folio_referencia
       FROM logistica_asignaciones a
       LEFT JOIN contratos c ON a.pedido_id::TEXT = c.id_contrato::TEXT
         AND (a.tipo_referencia = 'CONTRATO' OR a.tipo_referencia IS NULL)
       LEFT JOIN cotizaciones cot ON (
         (a.pedido_id::TEXT = cot.id_cotizacion::TEXT) OR 
         (a.pedido_id::TEXT = cot.numero_cotizacion::TEXT)
       ) AND (UPPER(TRIM(a.tipo_referencia)) = 'COTIZACION_VENTA' OR a.tipo_referencia IS NULL)
       WHERE a.id = $1
       LIMIT 1`,
      [asignacion_id]
    );

    const pedidoBase = asignRows[0]?.pedido_id || pedido_id;
    const folioVisible = asignRows[0]?.folio_referencia || pedidoBase;
    const tipoMovimiento = String(asignRows[0]?.tipo_movimiento || 'ENTREGA').toUpperCase();
    const esRecoleccion = tipoMovimiento === 'RECOLECCION';
    const operacion = esRecoleccion ? 'recoleccion' : 'entrega';
    const operacionTitulo = esRecoleccion ? 'Recoleccion' : 'Entrega';
    const accionMapa = esRecoleccion ? 'Ver Mapa y Detalles de Recoleccion' : 'Ver Mapa y Detalles de Ruta';

    console.log(`[Logistica] Generando PDF de Hoja de Pedido para ${folioVisible}...`);
    const pdfBuffer = await pdfService.generarHojaPedidoPDF(pedidoBase);

    const trackingUrl = `${process.env.APP_URL || 'http://localhost:3001'}/templates/pages/entrega_detalle.html?id=${asignacion_id}`;

    const mailOptions = {
      to: chofer.email,
      subject: `Nueva asignacion de logistica (${operacionTitulo}) - Folio ${folioVisible}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background: #1e3a8a; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">Asignacion de Logistica</h1>
          </div>
          <div style="padding: 24px; color: #1e293b;">
            <p>Hola <strong>${chofer.nombre}</strong>,</p>
            <p>Se te ha asignado un nuevo pedido para ${operacion}. A continuacion los detalles importantes:</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #1e3a8a; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Folio:</strong> ${folioVisible}</p>
              <p style="margin: 5px 0;"><strong>ID de Ruta:</strong> ${asignacion_id}</p>
              <p style="margin: 5px 0;"><strong>Operacion:</strong> ${operacionTitulo}</p>
            </div>
            <p>Puedes ver el mapa interactivo y registrar el progreso de la ${operacion} en el siguiente enlace:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">${accionMapa}</a>
            </div>
            <p style="font-size: 14px; color: #64748b;"><strong>Nota:</strong> Se adjunta la hoja de pedido oficial para tu referencia.</p>
          </div>
          <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
            (c) ${new Date().getFullYear()} Andamios Torres - Sistema de Gestion SAPT
          </div>
        </div>
      `,
      attachments: [{
        filename: `Hoja_Pedido_${folioVisible}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    };

    await EmailService.sendMail(mailOptions);
    console.log(`[Logistica] Email de notificacion enviado a ${chofer.email}`);
  } catch (error) {
    console.error('[Logistica] Error al notificar chofer por email:', error);
  }
};
// Helper para procesar asignacion automatica (se usa desde el controlador o desde contratos)
// tipo_logistica: 'metropolitana' | 'foranea'
// Regla: pedidos foraneos -> SOLO ROGELIO VELAZQUEZ (puede ambos tipos)
//        pedidos metropolitanos -> cualquier chofer disponible
const procesarAsignacionAutomatica = async (pedido_id, tipo_referencia = 'CONTRATO', tipo_logistica = 'metropolitana') => {
  try {
    const tipoLogNorm = (tipo_logistica || 'metropolitana').toLowerCase();
    const esForaneo = tipoLogNorm.includes('foran');
    console.log(`[Logistica] Procesando asignacion automatica. Pedido: ${pedido_id}, Tipo: ${tipoLogNorm}`);

    // 1. Buscar vehiculo disponible
    const { rows: vehiculos } = await db.query(
      "SELECT id FROM vehiculos WHERE estatus = 'activo' ORDER BY id ASC LIMIT 1"
    );

    if (vehiculos.length === 0) {
      const { rows: asignacionEspera } = await db.query(
        "INSERT INTO logistica_asignaciones (pedido_id, tipo_referencia, estado) VALUES ($1, $2, 'en_espera') RETURNING id",
        [pedido_id, tipo_referencia]
      );
      await registrarEventoSeguimiento(
        asignacionEspera[0].id,
        'en_preparacion',
        'Material en preparacion. Tu pedido fue registrado y esta pendiente de asignacion logistica.',
        'Bodega Andamios Torres',
        {
          tipo_operacion: tipo_referencia,
          tipo_logistica: tipoLogNorm,
          estado_logistica: 'en_espera',
          motivo: 'sin_vehiculo'
        }
      );
      console.warn('[Logistica] Sin vehiculos disponibles. Pedido en espera.');
      return { success: true, estado: 'en_espera', motivo: 'sin_vehiculo', id_asignacion: asignacionEspera[0].id };
    }

    const vehiculo_id = vehiculos[0].id;

    // 2. Buscar chofer segun regla de logistica
    //    Foraneo: SOLO Rogelio Velazquez (puede ambos tipos)
    //    Metropolitano: cualquier chofer activo disponible
    let choferQuery;
    if (esForaneo) {
      choferQuery = `
        SELECT e.id
        FROM rh_empleados e
        JOIN rh_puestos p ON e.puesto_id = p.id
        WHERE LOWER(p.nombre) LIKE '%chofer%'
          AND e.estado = 'Activo'
          AND UPPER(e.nombre) LIKE '%ROGELIO%'
          AND UPPER(COALESCE(e.apellidos,'')) LIKE '%VELAZQUEZ%'
          AND e.id NOT IN (
            SELECT chofer_id FROM logistica_asignaciones
            WHERE estado = 'en_ruta' AND chofer_id IS NOT NULL
          )
        LIMIT 1`;
    } else {
      choferQuery = `
        SELECT e.id
        FROM rh_empleados e
        JOIN rh_puestos p ON e.puesto_id = p.id
        WHERE LOWER(p.nombre) LIKE '%chofer%'
          AND e.estado = 'Activo'
          AND e.id NOT IN (
            SELECT chofer_id FROM logistica_asignaciones
            WHERE estado = 'en_ruta' AND chofer_id IS NOT NULL
          )
        ORDER BY e.nombre ASC
        LIMIT 1`;
    }

    const { rows: choferes } = await db.query(choferQuery);

    if (choferes.length === 0) {
      const { rows: asignacionEspera } = await db.query(
        "INSERT INTO logistica_asignaciones (pedido_id, tipo_referencia, vehiculo_id, estado) VALUES ($1, $2, $3, 'en_espera') RETURNING id",
        [pedido_id, tipo_referencia, vehiculo_id]
      );
      const motivo = esForaneo ? 'rogelio_no_disponible' : 'sin_choferes';
      await registrarEventoSeguimiento(
        asignacionEspera[0].id,
        'en_preparacion',
        'Material en preparacion. Tu pedido fue registrado y esta pendiente de asignacion de chofer.',
        'Bodega Andamios Torres',
        {
          tipo_operacion: tipo_referencia,
          tipo_logistica: tipoLogNorm,
          estado_logistica: 'en_espera',
          motivo
        }
      );
      console.warn(`[Logistica] Sin choferes disponibles para tipo '${tipoLogNorm}'. Motivo: ${motivo}`);
      return { success: true, estado: 'en_espera', motivo, id_asignacion: asignacionEspera[0].id };
    }

    const chofer_id = choferes[0].id;

    // 2.1 Obtener etiquetas descriptivas
    const { rows: vInfo } = await db.query("SELECT economico FROM vehiculos WHERE id = $1", [vehiculo_id]);
    const { rows: cInfo } = await db.query(
      "SELECT (nombre || ' ' || COALESCE(apellidos,'')) AS nombre, correo_empresa AS email FROM rh_empleados WHERE id = $1",
      [chofer_id]
    );

    // 3. Crear asignacion activa
    const { rows: asignacion } = await db.query(
      `INSERT INTO logistica_asignaciones (vehiculo_id, chofer_id, pedido_id, tipo_referencia, estado, fecha_asignacion)
       VALUES ($1, $2, $3, $4, 'en_ruta', CURRENT_TIMESTAMP) RETURNING id`,
      [vehiculo_id, chofer_id, pedido_id, tipo_referencia]
    );

    // 4. Marcar vehiculo como ocupado
    await db.query("UPDATE vehiculos SET estatus = 'ocupado' WHERE id = $1", [vehiculo_id]);

    // 4.5. Actualizar estado logistico del contrato
    if (tipo_referencia === 'CONTRATO') {
      await db.query("UPDATE contratos SET estado_logistica = 'asignado' WHERE id_contrato = $1", [pedido_id]);
    }

    // 5. Notificacion por email al chofer (canal principal)
    const asignacion_id = asignacion[0].id;
    if (asignacion_id) {
      await registrarEventoSeguimiento(
        asignacion_id,
        'en_preparacion',
        'Material en preparacion. Tu pedido fue asignado y se encuentra listo para programar salida.',
        'Bodega Andamios Torres',
        {
          tipo_operacion: tipo_referencia,
          tipo_logistica: tipoLogNorm,
          estado_logistica: 'en_ruta',
          vehiculo_id,
          chofer_id
        }
      );
      notificarChoferPorEmail(chofer_id, asignacion_id, pedido_id);
    }

    console.log(`[Logistica] Asignacion creada. Chofer: ${cInfo[0]?.nombre}, Vehiculo: ${vInfo[0]?.economico}, Tipo: ${tipoLogNorm}`);

    return {
      success: true,
      estado: 'en_ruta',
      id_asignacion: asignacion_id,
      vehiculo_id,
      chofer_id,
      tipo_logistica: tipoLogNorm,
      vehiculo_nombre: vInfo[0]?.economico || 'Unidad',
      chofer_nombre: cInfo[0]?.nombre || 'Asignado'
    };
  } catch (error) {
    console.error('Error en procesarAsignacionAutomatica:', error);
    throw error;
  }
};

exports.asignacionAutomatica = async (req, res) => {
  const { pedido_id, tipo_referencia, tipo_logistica } = req.body;
  try {
    const result = await procesarAsignacionAutomatica(
      pedido_id,
      tipo_referencia || 'CONTRATO',
      tipo_logistica || 'metropolitana'
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error en asignacion: ' + error.message });
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
    const tracking = rows[0];
    broadcastEvent({
      tipo: 'ubicacion',
      asignacion_id: tracking.asignacion_id,
      lat: Number(tracking.latitud),
      lng: Number(tracking.longitud),
      velocidad: Number(tracking.velocidad || 0),
      timestamp: tracking.timestamp
    });

    res.status(201).json(tracking);
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar tracking: ' + error.message });
  }
};

exports.obtenerTrackingsActivos = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT t.*, a.pedido_id, v.economico,
              (e.nombre || ' ' || COALESCE(e.apellidos,'')) AS chofer_nombre
       FROM logistica_tracking t
       INNER JOIN (
         SELECT asignacion_id, MAX(timestamp) as max_timestamp
         FROM logistica_tracking
         GROUP BY asignacion_id
       ) latest ON t.asignacion_id = latest.asignacion_id AND t.timestamp = latest.max_timestamp
       JOIN logistica_asignaciones a ON t.asignacion_id = a.id
       LEFT JOIN vehiculos v ON a.vehiculo_id = v.id
       LEFT JOIN rh_empleados e ON a.chofer_id = e.id
       WHERE a.estado IN ('en_ruta', 'asignado')`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener trackings activos: ' + error.message });
  }
};

exports.obtenerHistorialEntregas = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT a.id, a.pedido_id, a.estado as logistica_estado, a.fecha_fin as fecha_entrega, a.evidencia_url, a.recibio_nombre, a.observaciones,
              a.tipo_movimiento,
              v.economico as vehiculo,
              (e.nombre || ' ' || COALESCE(e.apellidos,'')) AS chofer,
              COALESCE(cl.nombre, cl_cot.nombre, cot.contacto_nombre) as cliente, 
              COALESCE(c.numero_contrato, cot.numero_cotizacion) as numero_contrato
       FROM logistica_asignaciones a
       LEFT JOIN vehiculos v ON a.vehiculo_id = v.id
       LEFT JOIN rh_empleados e ON a.chofer_id = e.id
       LEFT JOIN contratos c ON a.pedido_id::TEXT = c.id_contrato::TEXT AND (a.tipo_referencia = 'CONTRATO' OR a.tipo_referencia IS NULL)
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       LEFT JOIN cotizaciones cot ON (
         (a.pedido_id::TEXT = cot.id_cotizacion::TEXT) OR 
         (a.pedido_id::TEXT = cot.numero_cotizacion::TEXT)
       ) AND (UPPER(TRIM(a.tipo_referencia)) = 'COTIZACION_VENTA' OR a.tipo_referencia IS NULL)
       LEFT JOIN clientes cl_cot ON cot.id_cliente = cl_cot.id_cliente
       WHERE a.estado IN ('completado', 'fallido')
       ORDER BY a.fecha_fin DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial: ' + error.message });
  }
};

exports.completarAsignacionEvidencia = async (req, res) => {
  const { id } = req.params;
  const asignacionId = parseInt(id);
  const { evidenciaBase64, recibio_nombre } = req.body;

  try {
    const { rows: asignacionRow } = await db.query(
      `SELECT a.*, 
              COALESCE(c.numero_contrato, cot.numero_cotizacion) as numero_contrato, 
              COALESCE(cl.email, cl_cot.email) as cliente_email, 
              COALESCE(cl.nombre, cl_cot.nombre, cot.contacto_nombre) as cliente_nombre,
              (e.nombre || ' ' || COALESCE(e.apellidos,'')) as chofer_nombre_ref
       FROM logistica_asignaciones a
       LEFT JOIN contratos c ON a.pedido_id::TEXT = c.id_contrato::TEXT AND (a.tipo_referencia = 'CONTRATO' OR a.tipo_referencia IS NULL)
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       LEFT JOIN cotizaciones cot ON (
         (a.pedido_id::TEXT = cot.id_cotizacion::TEXT) OR 
         (a.pedido_id::TEXT = cot.numero_cotizacion::TEXT)
       ) AND (UPPER(TRIM(a.tipo_referencia)) = 'COTIZACION_VENTA' OR a.tipo_referencia IS NULL)
       LEFT JOIN clientes cl_cot ON cot.id_cliente = cl_cot.id_cliente
       LEFT JOIN rh_empleados e ON a.chofer_id = e.id
       WHERE a.id = $1`, [asignacionId]
    );

    if (asignacionRow.length === 0) {
      return res.status(404).json({ error: 'Asignacion no encontrada' });
    }
    const asignacion = asignacionRow[0];


    // Cargar y guardar imagen fisicamente
    let evidenciaUrl = null;
    let filePath = null;
    if (evidenciaBase64) {
      const matches = evidenciaBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const buffer = Buffer.from(matches[2], 'base64');
        const fileName = `evidencia-${asignacionId}-${Date.now()}.jpg`;
        const dirPath = path.join(__dirname, '../../../public/uploads/evidencias');
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        filePath = path.join(dirPath, fileName);
        fs.writeFileSync(filePath, buffer);
        evidenciaUrl = `/uploads/evidencias/${fileName}`;
      }
    }

    // Actualizar BD (Asignacion y tracking finish)
    console.log('[DEBUG] Completando asignación. datos antes del UPDATE:', asignacion);
    
    await db.query(
      `UPDATE logistica_asignaciones 
       SET estado = 'completado', 
           fecha_fin = CURRENT_TIMESTAMP, 
           evidencia_url = $1,
           recibio_nombre = $2
       WHERE id = $3`,
      [evidenciaUrl, recibio_nombre || null, asignacionId]
    );
    
    // Verificar que se guardó correctamente
    const { rows: verifyRows } = await db.query(
      `SELECT id, pedido_id, tipo_referencia, estado FROM logistica_asignaciones WHERE id = $1`,
      [asignacionId]
    );
    
    if (verifyRows.length > 0) {
      console.log('[DEBUG] Asignación despues del UPDATE:', verifyRows[0]);
      if (!verifyRows[0].pedido_id) {
        console.error('[CRITICO] ¡pedido_id es NULL después del UPDATE en completar!');
      }
    }

    if (asignacion.tipo_referencia === 'CONTRATO') {
       const isRecoleccion = (asignacion.tipo_movimiento && asignacion.tipo_movimiento.toUpperCase() === 'RECOLECCION');
       const finalLogisticaEstado = isRecoleccion ? 'recolectado' : 'entregado';
       await db.query(`UPDATE contratos SET estado_logistica = $1 WHERE id_contrato = $2`, [finalLogisticaEstado, asignacion.pedido_id]);
    }

    // Liberar la unidad (pasarla de ocupado a activo nuevamente)
    if (asignacion.vehiculo_id) {
       await db.query(`UPDATE vehiculos SET estatus = 'activo' WHERE id = $1`, [asignacion.vehiculo_id]);
    }

    // Preparar el correo de notificacion usando la instancia ya existente
    const mailer = require('../services/emailService');
    
    let attachments = [];
    if (filePath) {
      attachments.push({
         filename: 'evidencia_entrega.jpg',
         path: filePath,
         cid: 'evidencia_img'
      });
    }

    const isVenta = (asignacion.tipo_referencia === 'COTIZACION_VENTA');
    const emailDest = asignacion.cliente_email || (isVenta ? 'ventas@andamiostorres.com' : 'rentas@andamiostorres.com');
    const emailCc = isVenta ? 'ventas@andamiostorres.com' : 'rentas@andamiostorres.com';

    try {
      const isRecoleccion = (asignacion.tipo_movimiento && asignacion.tipo_movimiento.toUpperCase() === 'RECOLECCION');
      const operacion = isRecoleccion ? 'recoleccion' : 'entrega';
      const operacionTitulo = isRecoleccion ? 'Recoleccion' : 'Entrega';
      await mailer.sendMail({
        to: emailDest,
        cc: emailDest !== emailCc ? emailCc : undefined,
        subject: `${operacionTitulo} completada - Folio ${asignacion.numero_contrato || asignacion.pedido_id}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">${operacionTitulo} concluida satisfactoriamente</h2>
            </div>
            <div style="padding: 20px;">
              <p>Hola <strong>${asignacion.cliente_nombre || 'Cliente'}</strong>,</p>
              <p>Te notificamos que la ${operacion} correspondiente al folio <strong>${asignacion.numero_contrato || asignacion.pedido_id}</strong> ha sido completada con exito por nuestro equipo de logistica.</p>
              ${evidenciaUrl ? `<p>A continuacion se adjunta la evidencia de la ${operacion}:</p><div style="text-align:center;"><img src="cid:evidencia_img" style="max-width:100%; border-radius:8px; margin-top:10px; border:2px solid #ddd;" /></div>` : ''}
              <hr style="margin:20px 0; border:none; border-top:1px solid #eee;">
              <p style="color:#888; font-size:12px; text-align:center;">Sistema Administrador de Procesos Torres (SAPT)<br>Andamios y Proyectos Torres S.A de C.V.</p>
            </div>
          </div>
        `,
        attachments: attachments
      });
    } catch(mailErr) {
      console.error('[Evidencia] Error enviando correo de conclusion:', mailErr);
    }

    // ========== REGISTRAR EVENTO DE SEGUIMIENTO: COMPLETADO ==========
    const tipoMovimiento = asignacion.tipo_movimiento || 'ENTREGA';
    const estadoDescripcion = tipoMovimiento === 'RECOLECCION'
      ? `Equipos recolectados satisfactoriamente. Recibió: ${recibio_nombre || 'No registrado'}`
      : `Equipos entregados satisfactoriamente. Recibió: ${recibio_nombre || 'No registrado'}`;
    
    await registrarEventoSeguimiento(
      asignacionId,
      'completado',
      estadoDescripcion,
      'Sitio de trabajo',
      {
        tipo_operacion: tipoMovimiento,
        recibio_por: recibio_nombre,
        evidencia_url: evidenciaUrl,
        chofer_id: asignacion.chofer_id
      }
    );

    broadcastEvent({
      tipo: 'vehiculo_llego',
      asignacion_id: asignacionId,
      pedido_id: asignacion.pedido_id,
      mensaje: `Pedido ${asignacion.numero_contrato || asignacion.pedido_id} completado`
    });

    res.json({ message: 'Ruta concluida exitosamente', evidencia_url: evidenciaUrl });

  } catch (error) {
    console.error('Error completando asignacion:', error);
    res.status(500).json({ error: 'Error al concluir ruta: ' + error.message });
  }
};

exports.obtenerAsignacionDetalle = async (req, res) => {
  const { id } = req.params;
  const asignacionId = parseInt(id);

  if (isNaN(asignacionId)) {
    return res.status(400).json({ error: 'ID de asignacion invalido' });
  }

  try {
    console.log('Obteniendo detalle de asignacion:', asignacionId);
    
    // First get the asignacion raw data for debugging
    const { rows: rawAssignment } = await db.query(
      `SELECT a.id, a.pedido_id, a.tipo_referencia, a.estado FROM logistica_asignaciones a WHERE a.id = $1`,
      [asignacionId]
    );
    
    if (rawAssignment.length === 0) {
      return res.status(404).json({ error: 'Asignacion no encontrada' });
    }
    
    const rawData = rawAssignment[0];
    console.log('[DEBUG] Raw asignacion data:', rawData);
    
    if (!rawData.pedido_id) {
      console.error('[ERROR] pedido_id es NULL en asignacion ID:', asignacionId);
      return res.status(400).json({ error: 'La asignación cambio pedido_id a NULL. Contacte soporte.' });
    }
    
    const { rows } = await db.query(
      `SELECT a.*, v.economico as vehiculo_economico,
              (e.nombre || ' ' || COALESCE(e.apellidos,'')) AS chofer_nombre,
              e.correo_empresa AS chofer_email, e.celular_empresa AS chofer_celular,
              COALESCE(cl.nombre, cl_cot.nombre, cot.contacto_nombre) as cliente, 
              COALESCE(c.numero_contrato, cot.numero_cotizacion) as numero_contrato,
              COALESCE(c.calle, cot.entrega_calle) as calle, 
              COALESCE(c.numero_externo, cot.entrega_numero_ext) as numero_externo, 
              COALESCE(c.colonia, cot.entrega_colonia) as colonia, 
              COALESCE(c.municipio, cot.entrega_municipio) as municipio, 
              COALESCE(c.tipo_logistica, cot.tipo_zona) as tipo_logistica
       FROM logistica_asignaciones a
       LEFT JOIN vehiculos v ON a.vehiculo_id = v.id
       LEFT JOIN rh_empleados e ON a.chofer_id = e.id
       LEFT JOIN contratos c ON a.pedido_id::TEXT = c.id_contrato::TEXT AND (a.tipo_referencia = 'CONTRATO' OR a.tipo_referencia IS NULL)
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       LEFT JOIN cotizaciones cot ON (
         (a.pedido_id::TEXT = cot.id_cotizacion::TEXT) OR 
         (a.pedido_id::TEXT = cot.numero_cotizacion::TEXT)
       ) AND (UPPER(TRIM(a.tipo_referencia)) = 'COTIZACION_VENTA' OR UPPER(TRIM(a.tipo_referencia)) = 'COTIZACION')
       LEFT JOIN clientes cl_cot ON cot.id_cliente = cl_cot.id_cliente
       WHERE a.id = $1`,
      [asignacionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Asignacion no encontrada' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error en obtenerAsignacionDetalle:', error);
    res.status(500).json({ error: 'Error al obtener detalle: ' + error.message });
  }
};

exports.actualizarAsignacion = async (req, res) => {
  const { id } = req.params;
  const { vehiculo_id, chofer_id, estado } = req.body;

  const vId = vehiculo_id ? parseInt(vehiculo_id) : null;
  const cId = chofer_id || null;   // chofer_id es VARCHAR (rh_empleados.id)
  const asignacionId = parseInt(id);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener datos actuales de la asignacion
    const { rows: current } = await client.query(
      "SELECT vehiculo_id, chofer_id, pedido_id, tipo_referencia FROM logistica_asignaciones WHERE id = $1",
      [asignacionId]
    );

    if (current.length === 0) throw new Error('Asignacion no encontrada');

    const oldVehiculoId = current[0].vehiculo_id;
    const oldChoferId = current[0].chofer_id;

    // 2. Si el vehiculo cambio, liberar el anterior y ocupar el nuevo
    if (vId && vId != oldVehiculoId) {
      if (oldVehiculoId) {
        await client.query("UPDATE vehiculos SET estatus = 'activo' WHERE id = $1", [oldVehiculoId]);
      }
      await client.query("UPDATE vehiculos SET estatus = 'ocupado' WHERE id = $1", [vId]);
    }

    // 3. Actualizar la asignacion
    await client.query(
      `UPDATE logistica_asignaciones 
       SET vehiculo_id = COALESCE($1, vehiculo_id), 
           chofer_id = COALESCE($2, chofer_id),
           estado = COALESCE($3, estado)
       WHERE id = $4`,
      [vId, cId, estado, asignacionId]
    );

    // 4. Notificar al nuevo chofer si cambio (email como canal principal)
    if (cId && cId !== oldChoferId) {
      // Email de reasignacion
      notificarChoferPorEmail(cId, id, current[0].pedido_id);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Asignacion actualizada correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en actualizarAsignacion:', error);
    res.status(500).json({ error: 'Error al actualizar asignacion: ' + error.message });
  } finally {
    client.release();
  }
};

exports.marcarAsignacionFallida = async (req, res) => {
  const { id } = req.params;
  const asignacionId = parseInt(id);
  const { observaciones } = req.body;

  try {
    // 1. Marcar como fallido en logistica_asignaciones
    const { rows } = await db.query(
      `UPDATE logistica_asignaciones 
       SET estado = 'fallido', fecha_fin = CURRENT_TIMESTAMP, observaciones = $1
       WHERE id = $2 RETURNING *`,
      [observaciones, asignacionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Asignacion no encontrada' });
    }

    const asignacion = rows[0];

    // 2. Regresar la unidad a estado activo
    if (asignacion.vehiculo_id) {
       await db.query(`UPDATE vehiculos SET estatus = 'activo' WHERE id = $1`, [asignacion.vehiculo_id]);
    }

    // 4.5. Actualizar estado logistico del contrato
    if (asignacion.tipo_referencia === 'CONTRATO') {
       const isRecoleccion = (asignacion.tipo_movimiento && asignacion.tipo_movimiento.toUpperCase() === 'RECOLECCION');
       // Si fallo al recoger, vuelve a 'entregado'. Si fallo al entregar, vuelve a 'en_espera'.
       const bounceEstado = isRecoleccion ? 'entregado' : 'en_espera';
       await db.query(`UPDATE contratos SET estado_logistica = $1 WHERE id_contrato = $2`, [bounceEstado, asignacion.pedido_id]);
    } else {
       // Si es cotizacion de VENTA, se devuelve a lista de espera
       await db.query(
         `INSERT INTO logistica_asignaciones (pedido_id, tipo_referencia, estado) VALUES ($1, $2, 'en_espera')`, 
         [asignacion.pedido_id, asignacion.tipo_referencia]
       );
    }

    // ========== REGISTRAR EVENTO DE SEGUIMIENTO: FALLIDO ==========
    const tipoMovimiento = asignacion.tipo_movimiento || 'ENTREGA';
    const estadoDescripcion = tipoMovimiento === 'RECOLECCION'
      ? `Fallo en recolección. Motivo: ${observaciones || 'No especificado'}`
      : `Fallo en entrega. Motivo: ${observaciones || 'No especificado'}`;
    
    await registrarEventoSeguimiento(
      asignacionId,
      'fallido',
      estadoDescripcion,
      'Sitio de trabajo',
      {
        tipo_operacion: tipoMovimiento,
        motivo_fallo: observaciones,
        chofer_id: asignacion.chofer_id,
        reintento: true
      }
    );

    res.json({ message: 'Viaje reportado como Fallido y Retornado a Espera', id: asignacionId, asignacion });
  } catch (error) {
    console.error('Error al marcar asignacion como fallida:', error);
    res.status(500).json({ error: 'Error al reportar fallo: ' + error.message });
  }
};

// ============================================================================
// ENDPOINT: Iniciar Ruta (Cambiar estado a EN_CAMINO)
// Se llama cuando el chofer presiona el botón "Iniciar Ruta"
// Registra evento y broadcast por WebSocket para actualizar clientes en tiempo real
// ============================================================================
exports.iniciarRuta = async (req, res) => {
  const { id } = req.params;
  const asignacionId = parseInt(id);

  try {
    // 1. Obtener datos actuales de la asignación
    const { rows: [asignacion] } = await db.query(
      `SELECT * FROM logistica_asignaciones WHERE id = $1`,
      [asignacionId]
    );

    if (!asignacion) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    // 2. Cambiar estado a 'en_camino'
    const { rows: actualizado } = await db.query(
      `UPDATE logistica_asignaciones 
       SET estado = 'en_camino', fecha_inicio_ruta = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [asignacionId]
    );

    // 3. Registrar evento de seguimiento
    const tipoMovimiento = asignacion.tipo_movimiento || 'ENTREGA';
    const estadoDescripcion = tipoMovimiento === 'RECOLECCION'
      ? 'Ruta iniciada. Chofer en camino a sitio de recolección'
      : 'Ruta iniciada. Chofer en camino a sitio de entrega';
    
    await registrarEventoSeguimiento(
      asignacionId,
      'en_camino',
      estadoDescripcion,
      'En ruta',
      {
        tipo_operacion: tipoMovimiento,
        vehiculo_economico: asignacion.vehiculo_id,
        chofer_id: asignacion.chofer_id,
        fecha_inicio_ruta: new Date().toISOString()
      }
    );

    // 4. Obtener datos del chofer para broadcast
    const { rows: [chofer] } = asignacion.chofer_id 
      ? await db.query(
          `SELECT id, nombre, apellidos, celular_empresa FROM rh_empleados WHERE id = $1`,
          [asignacion.chofer_id]
        )
      : { rows: [null] };

    // 5. Obtener datos del vehículo para broadcast
    const { rows: [vehiculo] } = asignacion.vehiculo_id
      ? await db.query(
          `SELECT id, economico, placa FROM vehiculos WHERE id = $1`,
          [asignacion.vehiculo_id]
        )
      : { rows: [null] };

    // 6. Broadcast WebSocket - Notificar a todos los clientes que la ruta fue iniciada
    broadcastEvent({
      tipo: 'ruta_iniciada',
      asignacion_id: asignacionId,
      estado: 'en_camino',
      pedido_id: asignacion.pedido_id,
      numero_contrato: asignacion.numero_contrato,
      chofer: chofer ? {
        id: chofer.id,
        nombre: `${chofer.nombre} ${chofer.apellidos || ''}`.trim(),
        celular: chofer.celular_empresa
      } : null,
      vehiculo: vehiculo ? {
        id: vehiculo.id,
        economico: vehiculo.economico,
        placa: vehiculo.placa
      } : null,
      timestamp: new Date().toISOString()
    });

    // 7. Enviar notificaciones al cliente (SMS, Email, Push)
    try {
      const { rows: [clienteInfo] } = await db.query(
        `SELECT c.id_cliente, c.email, c.telefono
         FROM clientes c
         WHERE c.id_cliente = $1`,
        [asignacion.cliente_id]
      );

      if (clienteInfo) {
        const notificacionesService = require('../services/notificacionesService');
        
        // For now, log that notifications would be sent
        // Full SMS/Email/Push integration happens asynchronously
        setImmediate(async () => {
          try {
            await notificacionesService.notificarCambioEstado(
              {
                estado: 'en_camino',
                descripcion: 'Tu pedido está en camino. El chofer comenzó la ruta.',
                numero_contrato: asignacion.numero_contrato
              },
              {
                cliente_id: clienteInfo.id_cliente,
                email: clienteInfo.email,
                telefono: clienteInfo.telefono,
                urlSeguimientoPublico: `${req.protocol}://${req.get('host')}/seguimiento-publico.html`
              }
            );
          } catch (err) {
            console.error('[Notificaciones] Error enviando:', err.message);
            // No fallar la operación principal
          }
        });
      }
    } catch (err) {
      console.warn('[Notificaciones] Error preparando notificaciones:', err.message);
    }

    res.json({
      success: true,
      mensaje: 'Ruta iniciada exitosamente. Notificaciones enviadas al cliente.',
      asignacion: actualizado[0],
      evento_registrado: true
    });
  } catch (error) {
    console.error('Error al iniciar ruta:', error);
    res.status(500).json({ error: 'Error al iniciar ruta: ' + error.message });
  }
};

// ============================================================================
// ENDPOINT: Obtener seguimiento completo de una asignación
// Retorna eventos con duración entre estados para mostrar en cliente
// ============================================================================
exports.obtenerSeguimiento = async (req, res) => {
  const { asignacionId } = req.params;

  try {
    // 1. Obtener eventos de seguimiento ordenados por fecha
    const { rows: eventos } = await db.query(
      `SELECT 
        se.id,
        se.asignacion_id,
        se.estado,
        se.descripcion,
        se.ubicacion,
        se.metadata,
        se.created_at as fecha
       FROM seguimiento_eventos se
       WHERE se.asignacion_id = $1
       ORDER BY se.created_at ASC`,
      [asignacionId]
    );

    if (eventos.length === 0) {
      return res.status(404).json({ error: 'No hay eventos de seguimiento para esta asignación' });
    }

    // 2. Obtener datos de la asignación y del pedido
    const { rows: [asignacion] } = await db.query(
      `SELECT a.*, 
              COALESCE(c.numero_contrato, cot.numero_cotizacion) as numero_referencia,
              COALESCE(cl.nombre, cl_cot.nombre, cot.contacto_nombre) as cliente_nombre,
              COALESCE(c.equipo, cot.descripcion, cot.descripcion_cotizacion, 'Andamio Torre') as descripcion_producto
       FROM logistica_asignaciones a
       LEFT JOIN contratos c ON a.pedido_id::TEXT = c.id_contrato::TEXT
       LEFT JOIN cotizaciones cot ON a.pedido_id::TEXT = cot.id_cotizacion::TEXT
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       LEFT JOIN clientes cl_cot ON cot.id_cliente = cl_cot.id_cliente
       WHERE a.id = $1`,
      [asignacionId]
    );

    if (!asignacion) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    // 3. Determinar ventana de entrega
    const hoyCompleto = new Date(eventos[eventos.length - 1].fecha).toDateString() === new Date().toDateString();
    const ventana = hoyCompleto ? 'Llegó hoy' : 'En proceso';

    // 4. Construir respuesta con estructura esperada por el frontend
    const respuesta = {
      tracking: `TRK-${asignacionId}`,
      producto: {
        nombre: asignacion.descripcion_producto || 'Andamio Torre',
        cantidad: 1,
        vendedor: 'Andamios Torres'
      },
      ventanaEntrega: {
        texto: ventana,
        horaInicio: '08:00',
        horaFin: '18:00'
      },
      cliente: asignacion.cliente_nombre || 'Cliente',
      eventos: eventos.map(evt => ({
        id: evt.id,
        estado: evt.estado,
        descripcion: evt.descripcion,
        fecha: evt.fecha.toISOString(),  // Convertir a ISO para que el frontend pueda calcular duraciones
        ubicacion: evt.ubicacion,
        metadata: evt.metadata
      }))
    };

    res.json(respuesta);
  } catch (error) {
    console.error('Error al obtener seguimiento:', error);
    res.status(500).json({ error: 'Error al obtener seguimiento: ' + error.message });
  }
};

// ============================================================================
// ENDPOINT: Generar Token QR Público
// Crea un link sin autenticación para compartir por WhatsApp/SMS
// ============================================================================
exports.generarTokenQRPublico = async (req, res) => {
  const { id } = req.params;
  const asignacionId = parseInt(id);
  const { cliente_email, cliente_telefono } = req.body;

  try {
    // 1. Verificar que la asignación existe
    const { rows: [asignacion] } = await db.query(
      `SELECT * FROM logistica_asignaciones WHERE id = $1`,
      [asignacionId]
    );

    if (!asignacion) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
    }

    // 2. Generar UUID aleatorio
    const crypto = require('crypto');
    const tokenUUID = crypto.randomUUID();

    // 3. Insertar token en BD
    const { rows: [token] } = await db.query(
      `INSERT INTO seguimiento_tokens_publicos 
       (asignacion_id, token_uuid, cliente_email, cliente_telefono, activo)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, token_uuid, created_at, expires_at`,
      [asignacionId, tokenUUID, cliente_email || null, cliente_telefono || null]
    );

    // 4. Generar URL pública del seguimiento
    const protocol = req.protocol;
    const host = req.get('host');
    const urlPublica = `${protocol}://${host}/pages/seguimiento-publico.html?token=${tokenUUID}`;

    // 5. Generar QR (se puede usar librería qrcode)
    // Por ahora devolvemos la URL y el cliente puede generar el QR
    const qrDataURL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(urlPublica)}`;

    res.json({
      success: true,
      token_uuid: tokenUUID,
      url_publica: urlPublica,
      qr_image_url: qrDataURL,
      mensaje: 'Token QR generado exitosamente. Comparte este link por WhatsApp',
      token_expires_at: token.expires_at
    });
  } catch (error) {
    console.error('Error al generar QR público:', error);
    res.status(500).json({ error: 'Error al generar QR: ' + error.message });
  }
};

// ============================================================================
// ENDPOINT: Obtener Seguimiento Público (Sin Autenticación)
// Recibe token UUID y devuelve tracking del pedido
// ============================================================================
exports.obtenerVapidPublicKey = async (req, res) => {
  try {
    if (!process.env.VAPID_PUBLIC_KEY) {
      return res.status(404).json({ error: 'VAPID public key no configurada' });
    }

    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  } catch (error) {
    console.error('Error al obtener VAPID public key:', error);
    res.status(500).json({ error: 'Error al obtener VAPID public key: ' + error.message });
  }
};

exports.guardarSuscripcionPush = async (req, res) => {
  const { asignacionId, subscription } = req.body || {};

  try {
    if (!asignacionId) {
      return res.status(400).json({ error: 'asignacionId es requerido' });
    }

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'subscription es invalida o incompleta' });
    }

    const { rows: [asignacion] } = await db.query(
      `SELECT cliente_id
       FROM logistica_asignaciones
       WHERE id = $1`,
      [asignacionId]
    );

    if (!asignacion) {
      return res.status(404).json({ error: 'Asignacion no encontrada' });
    }

    if (!asignacion.cliente_id) {
      return res.status(400).json({ error: 'La asignacion no tiene cliente_id asociado' });
    }

    const notificacionesService = require('../services/notificacionesService');
    const suscripcionId = await notificacionesService.guardarSuscripcionPush({
      cliente_id: asignacion.cliente_id,
      push_subscription: subscription,
      user_agent: req.get('user-agent') || null
    });

    if (!suscripcionId) {
      return res.status(500).json({ error: 'No se pudo guardar la suscripcion push' });
    }

    try {
      await db.query(
        `INSERT INTO cliente_notificaciones (cliente_id, preferencia_push, updated_at)
         VALUES ($1, true, CURRENT_TIMESTAMP)
         ON CONFLICT (cliente_id) DO UPDATE SET
            preferencia_push = true,
            updated_at = CURRENT_TIMESTAMP`,
        [asignacion.cliente_id]
      );
    } catch (prefError) {
      console.warn('[Push] No se pudo actualizar preferencia_push:', prefError.message);
    }

    res.status(201).json({
      success: true,
      suscripcion_id: suscripcionId,
      cliente_id: asignacion.cliente_id
    });
  } catch (error) {
    console.error('Error al guardar suscripcion push:', error);
    res.status(500).json({ error: 'Error al guardar suscripcion push: ' + error.message });
  }
};

exports.desactivarSuscripcionPush = async (req, res) => {
  const { endpoint } = req.body || {};

  try {
    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint es requerido' });
    }

    const { rows } = await db.query(
      `UPDATE cliente_push_subscriptions
       SET activa = false, updated_at = CURRENT_TIMESTAMP
       WHERE endpoint = $1
       RETURNING id, cliente_id`,
      [endpoint]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Suscripcion no encontrada' });
    }

    res.json({
      success: true,
      suscripcion_id: rows[0].id,
      cliente_id: rows[0].cliente_id
    });
  } catch (error) {
    console.error('Error al desactivar suscripcion push:', error);
    res.status(500).json({ error: 'Error al desactivar suscripcion push: ' + error.message });
  }
};

exports.obtenerSeguimientoPublico = async (req, res) => {
  const { token } = req.query;

  if (!token || token.length !== 36) {
    return res.status(400).json({ error: 'Token inválido' });
  }

  try {
    // 1. Buscar token válido en BD
    const { rows: [tokenRow] } = await db.query(
      `SELECT * FROM seguimiento_tokens_publicos
       WHERE token_uuid = $1
       AND activo = true
       AND expires_at > CURRENT_TIMESTAMP`,
      [token]
    );

    if (!tokenRow) {
      return res.status(401).json({ error: 'Token no válido o expirado' });
    }

    // 2. Registrar acceso para auditoría
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    
    await db.query(
      `INSERT INTO seguimiento_accesos_publicos (token_id, ip_address, user_agent)
       VALUES ($1, $2, $3)`,
      [tokenRow.id, ip, userAgent]
    );

    // 3. Actualizar contador y última consulta
    await db.query(
      `UPDATE seguimiento_tokens_publicos 
       SET used_count = used_count + 1, ultima_consulta = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [tokenRow.id]
    );

    // 4. Obtener datos del seguimiento (igual que endpoint autenticado)
    const asignacionId = tokenRow.asignacion_id;
    
    const { rows: eventos } = await db.query(
      `SELECT 
        se.id,
        se.asignacion_id,
        se.estado,
        se.descripcion,
        se.ubicacion,
        se.metadata,
        se.created_at as fecha
       FROM seguimiento_eventos se
       WHERE se.asignacion_id = $1
       ORDER BY se.created_at ASC`,
      [asignacionId]
    );

    if (eventos.length === 0) {
      return res.status(404).json({ error: 'No hay eventos para este pedido' });
    }

    // 5. Obtener datos de asignación
    const { rows: [asignacion] } = await db.query(
      `SELECT 
        a.id, a.pedido_id, a.numero_contrato, a.estado, 
        a.tipo_movimiento, a.fecha_inicio, a.fecha_fin,
        v.economico, v.placa,
        COALESCE(e.nombre || ' ' || COALESCE(e.apellidos, ''), 'No asignado') AS chofer_nombre,
        c.nombre AS cliente_nombre, c.email, c.telefono
       FROM logistica_asignaciones a
       LEFT JOIN vehiculos v ON a.vehiculo_id = v.id
       LEFT JOIN rh_empleados e ON a.chofer_id = e.id
       LEFT JOIN clientes c ON a.cliente_id = c.id_cliente
       WHERE a.id = $1`,
      [asignacionId]
    );

    // 6. Retornar datos sin información sensible
    const respuesta = {
      estado: asignacion.estado,
      numero_contrato: asignacion.numero_contrato,
      vehiculo: {
        economico: asignacion.economico,
        placa: asignacion.placa
      },
      chofer: asignacion.chofer_nombre,
      fecha_inicio: asignacion.fecha_inicio?.toISOString(),
      eventos: eventos.map(evt => ({
        id: evt.id,
        estado: evt.estado,
        descripcion: evt.descripcion,
        fecha: evt.fecha.toISOString(),
        ubicacion: evt.ubicacion
      }))
    };

    res.json(respuesta);
  } catch (error) {
    console.error('Error al obtener seguimiento público:', error);
    res.status(500).json({ error: 'Error al obtener seguimiento: ' + error.message });
  }
};
