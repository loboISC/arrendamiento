const express = require('express');
const router = express.Router();
const db = require('../db/index');
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

// Crear tabla al iniciar
createSmtpConfigTable().catch(err => console.error('Error creando tabla SMTP:', err));

// Middleware de autenticación
router.use(authenticateToken);

// ===== GET /api/configuracion/smtp =====
// Obtener todas las configuraciones SMTP del usuario o la empresa
router.get('/', async (req, res) => {
  try {
    const configs = await getAllSmtpConfigs();
    res.json(configs);
  } catch (err) {
    console.error('Error obteniendo configuraciones SMTP:', err);
    res.status(500).json({ error: 'Error al obtener configuraciones SMTP' });
  }
});

// ===== GET /api/configuracion/smtp/:id =====
// Obtener una configuración SMTP específica
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const config = await getSmtpConfigById(id);

    if (!config) {
      return res.status(404).json({ error: 'Configuración SMTP no encontrada' });
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
    console.error('Error creando configuración SMTP:', err);
    res.status(500).json({ error: 'Error al crear configuración SMTP' });
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

    // Obtener configuración actual
    const currentConfig = await db.query(
      'SELECT contrasena FROM configuracion_smtp WHERE id_config_smtp = $1',
      [id]
    );

    if (currentConfig.rows.length === 0) {
      return res.status(404).json({ error: 'Configuración SMTP no encontrada' });
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
    console.error('Error actualizando configuración SMTP:', err);
    res.status(500).json({ error: 'Error al actualizar configuración SMTP' });
  }
});

// ===== DELETE /api/configuracion/smtp/:id =====
// Eliminar una configuración SMTP
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const config = await deleteSmtpConfig(id);

    if (!config) {
      return res.status(404).json({ error: 'Configuración SMTP no encontrada' });
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
// Enviar email de prueba con la configuración SMTP proporcionada
router.post('/test', async (req, res) => {
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
      subject: '✓ Prueba de Configuración SMTP - ScaffoldPro',
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
          <p>Ahora puedes usar esta configuración para enviar correos de encuestas, notificaciones y otros procesos automatizados.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="color: #888; font-size: 0.9em; margin: 0;">
            Enviado desde <strong>ScaffoldPro</strong> el ${new Date().toLocaleString('es-MX')}
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

// ===== Funciones auxiliares =====

// Obtener clave de encriptación (debe ser 32 bytes = 64 caracteres hex)
function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey && envKey.length === 64) {
    return envKey;
  }
  // Clave por defecto para desarrollo (cambiar en producción)
  return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
}

// Cifrar contraseña (usa AES-256-CBC)
function cifrarContrasena(contrasena) {
  const algoritmo = 'aes-256-cbc';
  const clave = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algoritmo, Buffer.from(clave, 'hex'), iv);
  let cifrado = cipher.update(contrasena, 'utf8', 'hex');
  cifrado += cipher.final('hex');
  
  return iv.toString('hex') + ':' + cifrado;
}

// Descifrar contraseña
function descifrarContrasena(contrasena_cifrada) {
  try {
    const algoritmo = 'aes-256-cbc';
    const clave = getEncryptionKey();
    const partes = contrasena_cifrada.split(':');
    
    if (partes.length !== 2) {
      throw new Error('Formato de contraseña cifrada inválido');
    }
    
    const iv = Buffer.from(partes[0], 'hex');
    const cifrado = partes[1];
    
    const decipher = crypto.createDecipheriv(algoritmo, Buffer.from(clave, 'hex'), iv);
    let descifrado = decipher.update(cifrado, 'hex', 'utf8');
    descifrado += decipher.final('utf8');
    
    return descifrado;
  } catch (err) {
    console.error('Error descifrando contraseña:', err);
    // Si falla, retornar la contraseña tal cual
    return contrasena_cifrada;
  }
}

module.exports = router;
