const db = require('../config/database');
const EmailService = require('../services/emailService');
const PDFServiceClass = require('../services/pdfService');
const pdfService = new PDFServiceClass();
const path = require('path');
const fs = require('fs');

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
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO logistica_asignaciones (vehiculo_id, chofer_id, pedido_id, tipo_referencia, estado)
       VALUES ($1, $2, $3, $4, 'en_ruta') RETURNING *`,
      [vehiculo_id, chofer_id, pedido_id, tipo_referencia]
    );

    // 4. Actualizar estado del vehículo a 'ocupado'
    await client.query("UPDATE vehiculos SET estatus = 'ocupado' WHERE id = $1", [vehiculo_id]);

    // 4.5. Limpiar de "Pedidos en Espera" (Cambiar de 'en_espera' a 'asignado')
    if (tipo_referencia === 'CONTRATO') {
       await client.query("UPDATE contratos SET estado_logistica = 'asignado' WHERE id_contrato = $1", [pedido_id]);
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en crearAsignacion:', error);
    res.status(500).json({ error: 'Error en asignación: ' + error.message });
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

    const { rows: routes } = await db.query(
      `SELECT a.*, v.economico as vehiculo_economico, u.nombre as chofer_nombre 
       FROM logistica_asignaciones a 
       LEFT JOIN vehiculos v ON a.vehiculo_id = v.id 
       LEFT JOIN usuarios u ON a.chofer_id = u.id_usuario 
       WHERE a.estado = 'en_ruta'`
    );
    resumen.asignaciones_activas = routes;

    // --- Pedidos en espera: contratos que aún no tienen ruta asignada ---
    const { rows: waitlist } = await db.query(
      `SELECT c.id_contrato as pedido_id, c.numero_contrato, cl.nombre as cliente_nombre, 
              c.fecha_inicio as fecha_compromiso
       FROM contratos c
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       WHERE c.estado_logistica = 'en_espera'
       ORDER BY c.id_contrato ASC`
    );
    resumen.asignaciones_espera = waitlist;

    res.json(resumen);
  } catch (error) {
    res.status(500).json({ error: 'Error en dashboard: ' + error.message });
  }
};

// Helper para notificar al chofer por email con la Hoja de Pedido adjunta
const notificarChoferPorEmail = async (chofer_id, asignacion_id, pedido_id) => {
  try {
    console.log(`[Logistica] Iniciando notificación por email para chofer ${chofer_id}...`);
    
    // 1. Obtener datos del chofer
    const { rows: usuarios } = await db.query('SELECT nombre, email FROM usuarios WHERE id_usuario = $1', [chofer_id]);
    if (usuarios.length === 0 || !usuarios[0].email) {
      console.warn(`[Logistica] Chofer ${chofer_id} no tiene email configurado o no existe.`);
      return;
    }
    const chofer = usuarios[0];

    // 2. Generar PDF de la Hoja de Pedido (Usando el servicio de Puppeteer)
    console.log(`[Logistica] Generando PDF de Hoja de Pedido para contrato ${pedido_id}...`);
    const pdfBuffer = await pdfService.generarHojaPedidoPDF(pedido_id);
    
    // 3. Preparar opciones del correo
    const trackingUrl = `${process.env.APP_URL || 'http://localhost:3001'}/templates/pages/entrega_detalle.html?id=${asignacion_id}`;
    
    const mailOptions = {
      to: chofer.email,
      subject: `🚚 Nueva Asignación de Pedido: ${pedido_id}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background: #1e3a8a; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 20px;">Asignación de Logística</h1>
          </div>
          <div style="padding: 24px; color: #1e293b;">
            <p>Hola <strong>${chofer.nombre}</strong>,</p>
            <p>Se te ha asignado un nuevo pedido para entrega. A continuación los detalles importantes:</p>
            
            <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid #1e3a8a; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Pedido:</strong> ${pedido_id}</p>
              <p style="margin: 5px 0;"><strong>ID de Ruta:</strong> ${asignacion_id}</p>
            </div>

            <p>Puedes ver el mapa interactivo y registrar el progreso de la entrega en el siguiente enlace:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ver Mapa y Detalles de Ruta</a>
            </div>

            <p style="font-size: 14px; color: #64748b;">
              <strong>Nota:</strong> Se adjunta la Hoja de Pedido oficial a este correo para tu referencia.
            </p>
          </div>
          <div style="background: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b;">
            © ${new Date().getFullYear()} Andamios Torres - Sistema de Gestión SAPT
          </div>
        </div>
      `,
      attachments: [{
        filename: `Hoja_Pedido_${pedido_id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    };

    // 4. Enviar
    await EmailService.sendMail(mailOptions);
    console.log(`[Logistica] Email de notificación enviado a ${chofer.email}`);

  } catch (error) {
    console.error(`[Logistica] Error al notificar chofer por email:`, error);
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

    // 4.5. Limpiar de "Pedidos en Espera" (Cambiar de 'en_espera' a 'asignado')
    if (tipo_referencia === 'CONTRATO') {
       await db.query("UPDATE contratos SET estado_logistica = 'asignado' WHERE id_contrato = $1", [pedido_id]);
    }

    // 5. Notificar al Chofer (RF3/RF4)
    try {
      await db.query(
        `INSERT INTO notificaciones (tipo, mensaje, id_usuario, id_contrato, prioridad, leida) 
         SELECT 'logistica', $1, $2, (SELECT id_contrato FROM contratos WHERE id_contrato = $3), 'media', false`,
        [`Se te ha asignado un pedido para entrega (Contrato #${pedido_id}).`, chofer_id, tipo_referencia === 'CONTRATO' ? parseInt(pedido_id) : null]
      );
      
      // Notificación adicional por Email (con PDF adjunto)
      if (asignacion_id) {
        notificarChoferPorEmail(chofer_id, asignacion_id, pedido_id);
      }

    } catch (notifErr) {
      console.error('Error al crear notificación para chofer:', notifErr);
    }

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

exports.obtenerTrackingsActivos = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT t.*, a.pedido_id, v.economico, u.nombre as chofer_nombre
       FROM logistica_tracking t
       INNER JOIN (
         SELECT asignacion_id, MAX(timestamp) as max_timestamp
         FROM logistica_tracking
         GROUP BY asignacion_id
       ) latest ON t.asignacion_id = latest.asignacion_id AND t.timestamp = latest.max_timestamp
       JOIN logistica_asignaciones a ON t.asignacion_id = a.id
       LEFT JOIN vehiculos v ON a.vehiculo_id = v.id
       LEFT JOIN usuarios u ON a.chofer_id = u.id_usuario
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
      `SELECT a.id, a.pedido_id, a.fecha_fin as fecha_entrega, a.evidencia_url, a.recibio_nombre,
              v.economico as vehiculo, u.nombre as chofer,
              cl.nombre as cliente, c.numero_contrato
       FROM logistica_asignaciones a
       LEFT JOIN vehiculos v ON a.vehiculo_id = v.id
       LEFT JOIN usuarios u ON a.chofer_id = u.id_usuario
       LEFT JOIN contratos c ON a.pedido_id = c.id_contrato
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       WHERE a.estado = 'completado'
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
      `SELECT a.*, c.numero_contrato, cl.email as cliente_email, cl.nombre as cliente_nombre
       FROM logistica_asignaciones a
       LEFT JOIN contratos c ON a.pedido_id = c.id_contrato
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       WHERE a.id = $1`, [asignacionId]
    );

    if (asignacionRow.length === 0) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
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

    // Actualizar BD (Asignación y tracking finish)
    await db.query(
      `UPDATE logistica_asignaciones 
       SET estado = 'completado', 
           fecha_fin = CURRENT_TIMESTAMP, 
           evidencia_url = $1,
           recibio_nombre = $2
       WHERE id = $3`,
      [evidenciaUrl, recibio_nombre || null, asignacionId]
    );

    if (asignacion.tipo_referencia === 'CONTRATO') {
       await db.query(`UPDATE contratos SET estado_logistica = 'entregado' WHERE id_contrato = $1`, [asignacion.pedido_id]);
    }

    // Liberar la unidad (pasarla de ocupado a activo nuevamente)
    if (asignacion.vehiculo_id) {
       await db.query(`UPDATE vehiculos SET estatus = 'activo' WHERE id = $1`, [asignacion.vehiculo_id]);
    }

    // Preparar el correo de notificación usando la instancia ya existente
    const mailer = require('../services/emailService');
    
    let attachments = [];
    if (filePath) {
      attachments.push({
         filename: 'evidencia_entrega.jpg',
         path: filePath,
         cid: 'evidencia_img'
      });
    }

    const emailDest = asignacion.cliente_email || 'ventas@andamiostorres.com';
    const emailBcc = process.env.SMTP_USER || 'ventas@andamiostorres.com'; // Backup

    try {
      await mailer.sendMail({
        to: emailDest,
        bcc: emailBcc,
        subject: `✅ Entrega Completada - Pedido ${asignacion.numero_contrato || asignacion.pedido_id}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
            <div style="background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">Entrega Concluida Satisfactoriamente</h2>
            </div>
            <div style="padding: 20px;">
              <p>Hola <strong>${asignacion.cliente_nombre || 'Cliente'}</strong>,</p>
              <p>Te notificamos que la entrega correspondiente al pedido <strong>${asignacion.numero_contrato || asignacion.pedido_id}</strong> ha sido completada con éxito por nuestro equipo de logística.</p>
              ${evidenciaUrl ? `<p>A continuación se adjunta la evidencia de la entrega:</p><div style="text-align:center;"><img src="cid:evidencia_img" style="max-width:100%; border-radius:8px; margin-top:10px; border:2px solid #ddd;" /></div>` : ''}
              <hr style="margin:20px 0; border:none; border-top:1px solid #eee;">
              <p style="color:#888; font-size:12px; text-align:center;">Sistema Administrador de Procesos Torres (SAPT)<br>Andamios y Proyectos Torres S.A de C.V.</p>
            </div>
          </div>
        `,
        attachments: attachments
      });
    } catch(mailErr) {
      console.error('[Evidencia] Error enviando correo de conclusión:', mailErr);
    }

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
    return res.status(400).json({ error: 'ID de asignación inválido' });
  }

  try {
    console.log('Obteniendo detalle de asignacion:', asignacionId);
    const { rows } = await db.query(
      `SELECT a.*, v.economico as vehiculo_economico, u.nombre as chofer_nombre,
              cl.nombre as cliente, c.numero_contrato,
              c.calle, c.numero_externo, c.colonia, c.municipio
       FROM logistica_asignaciones a
       LEFT JOIN vehiculos v ON a.vehiculo_id = v.id
       LEFT JOIN usuarios u ON a.chofer_id = u.id_usuario
       LEFT JOIN contratos c ON a.pedido_id = c.id_contrato
       LEFT JOIN clientes cl ON c.id_cliente = cl.id_cliente
       WHERE a.id = $1`,
      [asignacionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Asignación no encontrada' });
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
  const cId = chofer_id ? parseInt(chofer_id) : null;
  const asignacionId = parseInt(id);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener datos actuales de la asignación
    const { rows: current } = await client.query(
      "SELECT vehiculo_id, chofer_id, pedido_id, tipo_referencia FROM logistica_asignaciones WHERE id = $1",
      [asignacionId]
    );

    if (current.length === 0) throw new Error('Asignación no encontrada');

    const oldVehiculoId = current[0].vehiculo_id;
    const oldChoferId = current[0].chofer_id;

    // 2. Si el vehículo cambió, liberar el anterior y ocupar el nuevo
    if (vId && vId != oldVehiculoId) {
      if (oldVehiculoId) {
        await client.query("UPDATE vehiculos SET estatus = 'activo' WHERE id = $1", [oldVehiculoId]);
      }
      await client.query("UPDATE vehiculos SET estatus = 'ocupado' WHERE id = $1", [vId]);
    }

    // 3. Actualizar la asignación
    await client.query(
      `UPDATE logistica_asignaciones 
       SET vehiculo_id = COALESCE($1, vehiculo_id), 
           chofer_id = COALESCE($2, chofer_id),
           estado = COALESCE($3, estado)
       WHERE id = $4`,
      [vId, cId, estado, asignacionId]
    );

    // 4. Notificar al nuevo Chofer si cambió
    if (cId && cId != oldChoferId) {
      await client.query(
        `INSERT INTO notificaciones (tipo, mensaje, id_usuario, id_contrato, prioridad, leida) 
         SELECT 'logistica', $1, $2, (SELECT id_contrato FROM contratos WHERE id_contrato = $3), 'alta', false`,
        [`REASIGNACIÓN: Se te ha asignado el pedido (Contrato #${current[0].pedido_id}).`, cId, current[0].tipo_referencia === 'CONTRATO' ? parseInt(current[0].pedido_id) : null]
      );

      // Notificación Email (RF3/RF4)
      notificarChoferPorEmail(cId, id, current[0].pedido_id);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Asignación actualizada correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en actualizarAsignacion:', error);
    res.status(500).json({ error: 'Error al actualizar asignación: ' + error.message });
  } finally {
    client.release();
  }
};
