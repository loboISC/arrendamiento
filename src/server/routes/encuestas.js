const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const pool = require('../config/database');
const EmailService = require('../services/emailService');
const { getAllSmtpConfigs } = require('../models/configuracionSmtp');
const {
  crearEncuesta,
  obtenerEncuestas,
  obtenerEncuestaPorId,
  guardarRespuesta,
  obtenerEstadisticasEncuestas,
  obtenerRespuestasEncuesta,
  actualizarEstadoEncuesta
} = require('../controllers/encuestas');

// 🔍 MIDDLEWARE DE DEBUG: Registrar todas las peticiones
router.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log(`\n📍 [MIDDLEWARE DEBUG] POST ${req.path}`);
    console.log(`   Headers:`, { 'content-type': req.get('content-type'), 'authorization': req.get('authorization') ? '***' : 'FALTA' });
  }
  next();
});

function getSurveyPublicBaseUrl(req) {
  // PRIORIDAD 1: Usar SURVEY_PUBLIC_BASE_URL para producción
  const envBase = process.env.SURVEY_PUBLIC_BASE_URL;
  if (envBase && String(envBase).trim()) {
    console.log(`🔗 [getSurveyPublicBaseUrl] Usando SURVEY_PUBLIC_BASE_URL: ${envBase}`);
    return String(envBase).replace(/\/$/, '');
  }

  // PRIORIDAD 2: Usar NGROK_URL si está disponible (para testing)
  const ngrokUrl = process.env.NGROK_URL;
  if (ngrokUrl && String(ngrokUrl).trim()) {
    console.log(`🔗 [getSurveyPublicBaseUrl] Usando NGROK_URL: ${ngrokUrl}`);
    return String(ngrokUrl).replace(/\/$/, '');
  }

  // FALLBACK: Detectar automáticamente según el request
  const host = req.get('host') || '';
  const protocol = req.protocol || 'http';
  const fallbackUrl = `${protocol}://${host}`;
  console.log(`🔗 [getSurveyPublicBaseUrl] Usando FALLBACK: ${fallbackUrl}`);
  return fallbackUrl;
}


// ===== GET /api/encuestas/test-smtp =====
// Ruta PÚBLICO temporal de diagnóstico para probar SMTP desde el NAS
router.get('/test-smtp', async (req, res) => {
  const { test_email } = req.query;
  console.log(`--- DIAGNÓSTICO SMTP NAS (TEST_EMAIL: ${test_email || 'DEFAULT'}) ---`);

  const nodemailer = require('nodemailer');
  let config = {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    usuario: process.env.SMTP_USER || 'sistemas@andamiostorres.com',
    contrasena: process.env.SMTP_PASSWORD || 'Sistemas_2025!',
    usa_ssl: true
  };

  // Si nos pasan un email, buscamos su config en la DB
  if (test_email) {
    try {
      const result = await pool.query('SELECT * FROM public.configuracion_smtp WHERE usuario = $1', [test_email]);
      if (result.rows.length > 0) {
        const dbConfig = result.rows[0];
        const { descifrarContrasena } = require('../../utils/smtpEncryption');
        config = {
          host: dbConfig.host,
          port: dbConfig.puerto,
          usuario: dbConfig.usuario,
          contrasena: descifrarContrasena(dbConfig.contrasena),
          usa_ssl: dbConfig.usa_ssl
        };
        console.log(`🔍 Usando configuración encontrada para ${test_email} (Host: ${config.host})`);
      } else {
        return res.status(404).json({ success: false, error: `No se encontró configuración SMTP para ${test_email}` });
      }
    } catch (dbErr) {
      return res.status(500).json({ success: false, error: 'Error consultando DB', details: dbErr.message });
    }
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465 || config.usa_ssl,
    auth: { user: config.usuario, pass: config.contrasena },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });

  try {
    console.log('⏳ Probando verificación...');
    await transporter.verify();

    console.log('⏳ Intentando enviar correo real (con banner)...');
    const path = require('path');
    const fs = require('fs');
    const bannerPath = path.join(__dirname, '../../public/img/Banne-ESC.jpeg');
    const attachments = [];
    if (fs.existsSync(bannerPath)) {
      attachments.push({ filename: 'banner.jpeg', path: bannerPath, cid: 'banner_andamios' });
    }

    const info = await transporter.sendMail({
      from: `"Andamios Torres - Test" <${config.usuario}>`,
      to: test_email || config.usuario,
      subject: 'Prueba Real de SMTP con Banner',
      html: `<h3>Prueba Exitosa</h3><p>Si ves la imagen abajo, todo está perfecto.</p><img src="cid:banner_andamios">`,
      attachments: attachments
    });

    return res.json({
      success: true,
      message: `¡CORREO ENVIADO! Revisa tu bandeja de entrada (${test_email || config.usuario})`,
      message_id: info.messageId,
      config_used: { host: config.host, port: config.port, user: config.usuario }
    });
  } catch (error) {
    console.error('❌ Error SMTP:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      phase: error.command ? `Fallo en comando: ${error.command}` : 'Fallo en proceso',
      config_tested: { host: config.host, port: config.port, user: config.usuario }
    });
  }
});

// Rutas protegidas (requieren autenticación)
router.post('/desde-origen', authenticateToken, async (req, res) => {
  try {
    const {
      origen_tipo,
      origen_id,
      metodo_envio,
      email_cliente,
      telefono_cliente,
      notas,
      fecha_vencimiento
    } = req.body || {};

    if (!origen_tipo || !origen_id) {
      return res.status(400).json({ error: 'origen_tipo y origen_id son requeridos' });
    }

    let cliente = null;
    if (origen_tipo === 'venta') {
      const q = `
        SELECT co.id_cotizacion, co.id_cliente, co.numero_folio,
               c.nombre as cliente_nombre, c.email as cliente_email, c.telefono as cliente_telefono
        FROM public.cotizaciones co
        LEFT JOIN public.clientes c ON c.id_cliente = co.id_cliente
        WHERE co.id_cotizacion = $1 AND co.numero_folio LIKE 'VEN-%'
      `;
      const r = await pool.query(q, [origen_id]);
      if (!r.rows.length) {
        return res.status(404).json({ error: 'Venta no encontrada o no es un folio VEN-*' });
      }
      cliente = r.rows[0];
    } else if (origen_tipo === 'contrato') {
      const q = `
        SELECT ct.id_contrato, ct.id_cliente,
               c.nombre as cliente_nombre, c.email as cliente_email, c.telefono as cliente_telefono
        FROM public.contratos ct
        LEFT JOIN public.clientes c ON c.id_cliente = ct.id_cliente
        WHERE ct.id_contrato = $1
      `;
      const r = await pool.query(q, [origen_id]);
      if (!r.rows.length) {
        return res.status(404).json({ error: 'Contrato no encontrado' });
      }
      cliente = r.rows[0];
    } else {
      return res.status(400).json({ error: 'origen_tipo inválido. Use "venta" o "contrato"' });
    }

    const finalEmail = email_cliente || cliente.cliente_email || null;
    const finalTel = telefono_cliente || cliente.cliente_telefono || null;
    const finalMetodo = metodo_envio || 'link';
    const notasFinal = notas || `origen_tipo=${origen_tipo};origen_id=${origen_id}`;

    const baseUrl = getSurveyPublicBaseUrl(req);
    // URL temporaria para crear el registro
    const tmpUrl = `${baseUrl}/sastifaccion_clienteSG.html?encuesta=${Date.now()}_${cliente.id_cliente || ''}`;

    const insertQuery = `
      INSERT INTO public.encuestas_satisfaccionSG
      (id_cliente, id_proyecto, url_encuesta, email_cliente, telefono_cliente, metodo_envio, notas, fecha_vencimiento, enviada_por)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const insertValues = [
      cliente.id_cliente || null,
      Number(origen_id) || null,
      tmpUrl,
      finalEmail,
      finalTel,
      finalMetodo,
      notasFinal,
      fecha_vencimiento || null,
      req.user?.id || null
    ];

    const created = await pool.query(insertQuery, insertValues);
    const encuesta = created.rows[0];

    // URL final con id_encuesta
    const urlEncuesta = `${baseUrl}/sastifaccion_clienteSG.html?id_encuesta=${encuesta.id_encuesta}`;
    const updated = await pool.query(
      'UPDATE public.encuestas_satisfaccionSG SET url_encuesta = $1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_encuesta = $2 RETURNING *',
      [urlEncuesta, encuesta.id_encuesta]
    );

    return res.status(201).json({
      success: true,
      data: {
        encuesta: updated.rows[0],
        cliente: {
          id_cliente: cliente.id_cliente || null,
          nombre: cliente.cliente_nombre || null,
          email: finalEmail,
          telefono: finalTel
        },
        origen: { tipo: origen_tipo, id: origen_id }
      }
    });
  } catch (error) {
    console.error('Error en /encuestas/desde-origen:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/:id/enviar-email', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📧 [ENVIAR-EMAIL] INICIO - ${new Date().toLocaleTimeString()}`);
  console.log(`${'='.repeat(60)}`);

  try {
    const { id } = req.params;
    const { subject, to, email } = req.body || {};
    const userId = req.user.id_usuario;

    console.log(`📊 Parámetros recibidos:`, { id, email, to, subject, userId });

    // Obtener configuración SMTP del usuario
    const smtpConfigs = await getAllSmtpConfigs(userId);
    const smtpConfig = smtpConfigs && smtpConfigs.length > 0 ? smtpConfigs[0] : null;

    if (smtpConfig) {
      console.log(`✅ Usando SMTP personalizado del usuario: ${smtpConfig.usuario}`);
    } else {
      console.log(`ℹ️ No hay SMTP personalizado, se usará el fallback global`);
    }

    const q = `
      SELECT e.*, c.nombre as cliente_nombre, c.empresa as cliente_empresa, c.email as cliente_email
      FROM public.encuestas_satisfaccionSG e
      LEFT JOIN public.clientes c ON c.id_cliente = e.id_cliente
      WHERE e.id_encuesta = $1
    `;
    const r = await pool.query(q, [id]);

    if (!r.rows.length) {
      return res.status(404).json({ error: 'Encuesta no encontrada' });
    }

    const encuesta = r.rows[0];
    const destino = email || to || encuesta.email_cliente || encuesta.cliente_email;
    if (!destino) {
      return res.status(400).json({ error: 'No hay email destino para el cliente' });
    }

    const asunto = subject || 'Encuesta de satisfacción - Andamios Torres';
    const clienteNombre = encuesta.cliente_nombre || 'Cliente';

    // Recalcular la URL para asegurar que use el entorno actual (no ngrok si estamos en producción)
    const baseUrl = getSurveyPublicBaseUrl(req);
    const url = `${baseUrl}/sastifaccion_clienteSG.html?id_encuesta=${id}`;

    console.log(`⏱️ [ENVIAR-EMAIL] URL calculada. Iniciando DB Update...`);
    // Actualizar estado y URL en la base de datos
    await pool.query(
      `UPDATE public.encuestas_satisfaccionSG
       SET metodo_envio = 'email', 
           estado = 'enviada', 
           fecha_envio = CURRENT_TIMESTAMP, 
           email_cliente = $1, 
           url_encuesta = $2,
           fecha_actualizacion = CURRENT_TIMESTAMP
       WHERE id_encuesta = $3`,
      [destino, url, id]
    );
    console.log(`⏱️ [ENVIAR-EMAIL] DB Update finalizado.`);

    // Intentar enviar el email esperando el resultado para reportar errores
    try {
      console.log(`📤 [ENVIAR-EMAIL] Llamando a EmailService.enviarEncuesta...`);
      const info = await EmailService.enviarEncuesta(destino, asunto, clienteNombre, url, smtpConfig);
      console.log(`✅ [ENVIAR-EMAIL] Éxito: ${info.messageId}`);

      return res.json({
        success: true,
        message: 'Encuesta enviada correctamente',
        messageId: info.messageId
      });
    } catch (sendErr) {
      console.error(`❌ [ENVIAR-EMAIL] Error en envío:`, sendErr.message);
      return res.status(500).json({
        error: 'No se pudo enviar el correo',
        details: sendErr.message,
        config_used: smtpConfig ? smtpConfig.usuario : 'FALLBACK GLOBAL (.env)'
      });
    }

  } catch (error) {
    console.error('❌ Error en /encuestas/:id/enviar-email:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', authenticateToken, crearEncuesta);
router.get('/', authenticateToken, obtenerEncuestas);
router.get('/estadisticas', authenticateToken, obtenerEstadisticasEncuestas);

router.get('/publico/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const q = `
      SELECT e.*, c.nombre as cliente_nombre, c.empresa as cliente_empresa, c.email as cliente_email
      FROM public.encuestas_satisfaccionSG e
      LEFT JOIN public.clientes c ON c.id_cliente = e.id_cliente
      WHERE e.id_encuesta = $1
    `;
    const r = await pool.query(q, [id]);
    if (!r.rows.length) {
      return res.status(404).json({ error: 'Encuesta no encontrada' });
    }

    const encuesta = r.rows[0];
    const estado = String(encuesta.estado || '').toLowerCase();
    const permitido = estado === 'enviada' || estado === 'pendiente';
    if (!permitido) {
      return res.status(409).json({
        error: 'Encuesta no disponible para responder',
        estado: encuesta.estado
      });
    }

    return res.json({
      success: true,
      data: {
        id_encuesta: encuesta.id_encuesta,
        estado: encuesta.estado,
        fecha_vencimiento: encuesta.fecha_vencimiento,
        cliente: {
          id_cliente: encuesta.id_cliente,
          nombre: encuesta.cliente_nombre,
          empresa: encuesta.cliente_empresa,
          email: encuesta.email_cliente || encuesta.cliente_email || null
        }
      }
    });
  } catch (error) {
    console.error('Error en /encuestas/publico/:id:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/publico/:id/responder', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre_cliente,
      email_cliente,
      q1_atencion_ventas,
      q2_calidad_productos,
      q3_tiempo_entrega,
      q4_servicio_logistica,
      q5_experiencia_compra,
      sugerencias
    } = req.body || {};

    const encuestaQuery = `
      SELECT * FROM public.encuestas_satisfaccionSG
      WHERE id_encuesta = $1 AND estado IN ('enviada','pendiente')
    `;
    const encuestaResult = await pool.query(encuestaQuery, [id]);
    if (!encuestaResult.rows.length) {
      return res.status(404).json({ error: 'Encuesta no encontrada o no disponible' });
    }

    const respuestaExistente = await pool.query(
      'SELECT id_respuesta FROM public.respuestas_encuestaSG WHERE id_encuesta = $1',
      [id]
    );
    if (respuestaExistente.rows.length > 0) {
      return res.status(400).json({ error: 'Esta encuesta ya ha sido respondida' });
    }

    const insert = `
      INSERT INTO public.respuestas_encuestaSG
      (id_encuesta, nombre_cliente, email_cliente, q1_atencion_ventas,
       q2_calidad_productos, q3_tiempo_entrega, q4_servicio_logistica,
       q5_experiencia_compra, sugerencias, ip_address, user_agent)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `;

    const values = [
      id,
      nombre_cliente || null,
      email_cliente || null,
      q1_atencion_ventas || null,
      q2_calidad_productos || null,
      q3_tiempo_entrega || null,
      q4_servicio_logistica || null,
      q5_experiencia_compra || null,
      sugerencias || null,
      req.ip,
      req.get('User-Agent')
    ];

    const saved = await pool.query(insert, values);

    await pool.query(
      `UPDATE public.encuestas_satisfaccionSG
       SET estado = 'respondida', fecha_actualizacion = CURRENT_TIMESTAMP
       WHERE id_encuesta = $1`,
      [id]
    );

    // Notificación
    try {
      const nombreNotif = nombre_cliente || 'Cliente';
      await pool.query(
        `INSERT INTO notificaciones (tipo, mensaje, prioridad, fecha)
         VALUES ($1, $2, $3, NOW())`,
        ['ENCUESTA_RESPONDIDA', `Nueva respuesta de encuesta de: ${nombreNotif}`, 'Media']
      );
    } catch (notifError) {
      console.error('Error al crear notificación de encuesta:', notifError);
    }

    return res.status(201).json({ success: true, data: saved.rows[0] });
  } catch (error) {
    console.error('Error en /encuestas/publico/:id/responder:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:id', authenticateToken, obtenerEncuestaPorId);
router.get('/:id/respuestas', authenticateToken, obtenerRespuestasEncuesta);
router.put('/:id/estado', authenticateToken, actualizarEstadoEncuesta);

// Ruta pública para guardar respuestas (no requiere autenticación)
router.post('/:id/respuesta', guardarRespuesta);

module.exports = router;
module.exports.getSurveyPublicBaseUrl = getSurveyPublicBaseUrl;




