const express = require('express');
const router = express.Router();
const db = require('../../../database');
const { authenticateToken } = require('../middleware/auth');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const {
  createSmtpConfigTable,
  getAllSmtpConfigs,
  getSmtpConfigById,
  getSmtpConfigByAlias,
  createSmtpConfig,
  updateSmtpConfig,
  deleteSmtpConfig
} = require('../models/configuracionSmtp');
const { cifrarContrasena, descifrarContrasena } = require('../../utils/smtpEncryption');

// Crear tabla al iniciar
createSmtpConfigTable().catch(err => console.error('Error creando tabla SMTP:', err));

// Middleware de autenticación
router.use(authenticateToken);

// ===== GET /api/configuracion/smtp =====
// Obtener todas las configuraciones SMTP del usuario autenticado
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id_usuario;
    console.log(`[SMTP] Buscando configuraciones para userId: ${userId}`);
    const configs = await getAllSmtpConfigs(userId);
    console.log(`[SMTP] Configuraciones encontradas: ${configs.length}`);
    res.json(configs);
  } catch (err) {
    console.error('Error obteniendo configuraciones SMTP:', err);
    res.status(500).json({ error: 'Error al obtener configuraciones SMTP' });
  }
});

// ===== GET /api/configuracion/smtp/:id =====
// Obtener una configuración SMTP específica del usuario
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id_usuario;
    const config = await getSmtpConfigById(id, userId);

    if (!config) {
      return res.status(404).json({ error: 'Configuración SMTP no encontrada para este usuario' });
    }

    res.json(config);
  } catch (err) {
    console.error('Error obteniendo configuración SMTP:', err);
    res.status(500).json({ error: 'Error al obtener configuración SMTP' });
  }
});

// ===== POST /api/configuracion/smtp =====
// Crear una nueva configuración SMTP
router.post('/', async (req, res) => {
  try {
    const { alias, host, puerto, usa_ssl, usuario, contrasena, correo_from, notas } = req.body;
    const creado_por = req.user.id_usuario;

    // Validaciones
    if (!host || !usuario || !contrasena) {
      return res.status(400).json({ error: 'Host, usuario y contraseña son requeridos' });
    }

    // Cifrar la contraseña
    const contrasena_cifrada = cifrarContrasena(contrasena);

    const config = await createSmtpConfig({
      alias: alias || 'Sin alias',
      host,
      puerto,
      usa_ssl,
      usuario,
      contrasena: contrasena_cifrada,
      correo_from: correo_from || usuario,
      notas,
      creado_por
    });

    res.status(201).json({
      success: true,
      message: 'Configuración SMTP creada correctamente',
      data: config
    });
  } catch (err) {
    console.error('[SMTP] Error creando configuración SMTP:', err.stack || err);
    res.status(500).json({ error: 'Error al crear configuración SMTP: ' + err.message });
  }
});

// ===== PUT /api/configuracion/smtp/:id =====
// Actualizar una configuración SMTP
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { alias, host, puerto, usa_ssl, usuario, contrasena, correo_from, notas } = req.body;

    // Validaciones
    if (!host || !usuario) {
      return res.status(400).json({ error: 'Host y usuario son requeridos' });
    }

    // Obtener configuración actual verificando el usuario (o registros huérfanos con NULL)
    const currentConfig = await db.query(
      'SELECT contrasena FROM configuracion_smtp WHERE id_config_smtp = $1 AND (creado_por = $2 OR creado_por IS NULL)',
      [id, req.user.id_usuario]
    );

    if (currentConfig.rows.length === 0) {
      return res.status(404).json({ error: 'Configuración SMTP no encontrada o no tienes permiso para editarla' });
    }

    // Si se proporciona contraseña nueva, cifrarla; si no, usar la anterior
    let contrasena_cifrada = currentConfig.rows[0].contrasena;
    if (contrasena) {
      contrasena_cifrada = cifrarContrasena(contrasena);
    }

    const config = await updateSmtpConfig(id, {
      alias: alias || 'Sin alias',
      host,
      puerto,
      usa_ssl,
      usuario,
      contrasena: contrasena_cifrada,
      correo_from: correo_from || usuario,
      notas
    });

    res.json({
      success: true,
      message: 'Configuración SMTP actualizada correctamente',
      data: config
    });
  } catch (err) {
    console.error('[SMTP] Error actualizando configuración SMTP:', err.stack || err);
    res.status(500).json({ error: 'Error al actualizar configuración SMTP: ' + err.message });
  }
});

// ===== DELETE /api/configuracion/smtp/:id =====
// Eliminar una configuración SMTP verificando el usuario
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id_usuario;

    const config = await db.query(
      'DELETE FROM configuracion_smtp WHERE id_config_smtp = $1 AND creado_por = $2 RETURNING id_config_smtp',
      [id, userId]
    );

    if (config.rows.length === 0) {
      return res.status(404).json({ error: 'Configuración SMTP no encontrada o no tienes permiso para eliminarla' });
    }

    res.json({
      success: true,
      message: 'Configuración SMTP eliminada correctamente'
    });
  } catch (err) {
    console.error('Error eliminando configuración SMTP:', err);
    res.status(500).json({ error: 'Error al eliminar configuración SMTP' });
  }
});

// ===== POST /api/configuracion/smtp/test =====
router.post('/test', async (req, res) => {
  console.log('[SMTP] Recibida petición de prueba de correo');
  try {
    const { host, puerto, usa_ssl, usuario, contrasena, correo_from } = req.body;
    // Obtener email del usuario autenticado, con fallback a correo_from o usuario
    const email_usuario = req.user?.correo || correo_from || usuario;

    // Validaciones
    if (!host || !usuario || !contrasena) {
      return res.status(400).json({ error: 'Host, usuario y contraseña son requeridos' });
    }

    if (!email_usuario) {
      return res.status(400).json({ error: 'No hay dirección de correo para enviar la prueba. Proporciona correo_from o inicia sesión.' });
    }

    // Si la contraseña viene cifrada desde BD, descifrarla
    let contrasena_plana = contrasena;
    if (contrasena.includes(':')) {
      try {
        contrasena_plana = descifrarContrasena(contrasena);
      } catch (e) {
        // Si falla el desciframiento, usar tal cual
        contrasena_plana = contrasena;
      }
    }

    // Crear transporte SMTP
    const transporter = nodemailer.createTransport({
      host: host,
      port: puerto || 465,
      secure: usa_ssl !== false, // true para SSL/TLS, false para STARTTLS
      auth: {
        user: usuario,
        pass: contrasena_plana
      },
      // Para servidores con certificados auto-firmados (desarrollo)
      tls: {
        rejectUnauthorized: false
      }
    });

    // Enviar email de prueba
    const mailOptions = {
      from: correo_from || usuario,
      to: email_usuario,
      subject: '✓ Prueba de Configuración SMTP - Andamios Torres',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2979ff;">✓ Configuración SMTP Validada</h2>
          <p>¡Felicidades! Tu configuración SMTP está funcionando correctamente.</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Detalles de la configuración:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Servidor: <code>${host}</code></li>
              <li>Puerto: <code>${puerto}</code></li>
              <li>Seguridad: <code>${usa_ssl ? 'SSL/TLS' : 'STARTTLS'}</code></li>
              <li>Usuario: <code>${usuario}</code></li>
              <li>Remitente: <code>${correo_from || usuario}</code></li>
            </ul>
          </div>
          <p>Ahora puedes usar esta configuración para enviar facturas y otras notificaciones.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #888; font-size: 0.9em; margin: 0;">
            Enviado desde <strong>Andamios Torres</strong> el ${new Date().toLocaleString('es-MX')}
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'Email de prueba enviado correctamente',
      email_destino: email_usuario
    });
  } catch (err) {
    console.error('Error enviando email de prueba:', err);
    res.status(500).json({
      error: err.message || 'Error al enviar email de prueba. Verifica las credenciales SMTP.'
    });
  }
});

module.exports = router;
