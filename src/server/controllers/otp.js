const db = require('../config/database');
const emailService = require('../services/emailService');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Almacenamiento en memoria de OTPs temporales: { userId: { code, expiresAt, correo } }
const otpStore = new Map();

/**
 * Genera un código OTP de 6 dígitos y lo envía al correo del usuario.
 * Endpoint público — se llama justo después de validar usuario/contraseña.
 * Body: { userId }
 */
exports.sendOtp = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId es requerido' });
  }

  try {
    // Buscar correo y verificar que 2FA está activo
    const { rows } = await db.query(
      'SELECT id_usuario, nombre, correo, dos_factores FROM usuarios WHERE id_usuario = $1 AND estado = $2',
      [userId, 'Activo']
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado o inactivo' });
    }

    const user = rows[0];

    if (!user.correo) {
      return res.status(400).json({ error: 'El usuario no tiene correo electrónico registrado' });
    }

    if (!user.dos_factores) {
      return res.status(400).json({ error: '2FA no está habilitado para este usuario' });
    }

    // Generar código de 6 dígitos
    const code = String(Math.floor(100000 + crypto.randomInt(900000))).padStart(6, '0');
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos

    // Guardar en memoria (reemplaza cualquier OTP previo del mismo usuario)
    otpStore.set(String(userId), { code, expiresAt, correo: user.correo });

    // Limpiar OTP después de expirar
    setTimeout(() => {
      const entry = otpStore.get(String(userId));
      if (entry && entry.expiresAt <= Date.now()) {
        otpStore.delete(String(userId));
      }
    }, 5 * 60 * 1000 + 1000);

    // Buscar imagen de cabecera si existe
    const headerImagePath = path.join(process.cwd(), 'public/assets/images/codigo-verificacion.png');
    const attachments = [];
    if (fs.existsSync(headerImagePath)) {
      attachments.push({
        filename: 'header.png',
        path: headerImagePath,
        cid: 'otp_header'
      });
    }

    // Enviar correo
    await emailService.sendMail({
      to: user.correo,
      subject: 'Código de verificación — SAPT Andamios Torres',
      attachments: attachments,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e3e8ef;border-radius:18px;overflow:hidden;background:#ffffff;box-shadow:0 10px 25px rgba(0,0,0,0.05);">
          ${fs.existsSync(headerImagePath) ? `
          <div style="text-align:center;background:#000;line-height:0;">
            <img src="cid:otp_header" alt="Verification" style="width:100%;max-width:520px;display:block;" />
          </div>
          ` : `
          <div style="background:linear-gradient(90deg,#1b3c5e,#2d6aa6);padding:28px 24px;text-align:center;">
             <h2 style="color:#fff;margin:0;font-size:1.25rem;font-weight:700;letter-spacing:0.5px;">Verificación de Identidad</h2>
          </div>
          `}
          <div style="padding:40px 32px;text-align:center;">
            <p style="color:#374151;font-size:1.1rem;margin-top:0;">Hola <strong>${user.nombre}</strong></p>
            <p style="color:#6b7280;font-size:1rem;line-height:1.6;margin-bottom:30px;">
              Se solicitó el acceso al sistema SAPT. Usa el siguiente código de verificación:
            </p>
            <div style="background:#f0f7ff;border:2px dashed #1b3c5e;border-radius:16px;padding:24px;margin-bottom:30px;">
              <span style="font-size:2.8rem;font-weight:900;letter-spacing:14px;color:#1b3c5e;font-family:monospace;">${code}</span>
            </div>
            <p style="color:#9ca3af;font-size:0.88rem;margin:0;">
              Este código es válido por <strong style="color:#DA3347;">5 minutos</strong>.<br>
              Si no solicitaste este acceso, puedes ignorar este mensaje de forma segura.
            </p>
          </div>
          <div style="background:#f8fafc;padding:20px;text-align:center;font-size:0.8rem;color:#9ca3af;border-top:1px solid #f1f5f9;">
            © 2025 Andamios Torres S.A. de C.V. — Sistema SAPT
          </div>
        </div>
      `
    });

    console.log(`[2FA] OTP enviado a ${user.correo} para usuario ${userId}`);

    // Devolver correo parcialmente enmascarado
    const partes = user.correo.split('@');
    const maskedEmail = partes[0].substring(0, 3) + '***@' + partes[1];

    res.json({
      success: true,
      message: `Código enviado a ${maskedEmail}`,
      maskedEmail
    });

  } catch (err) {
    console.error('[2FA] Error enviando OTP:', err);
    res.status(500).json({ error: 'Error al enviar el código de verificación' });
  }
};

/**
 * Verifica el código OTP ingresado por el usuario.
 * Body: { userId, code }
 */
exports.verifyOtp = async (req, res) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    return res.status(400).json({ error: 'userId y code son requeridos' });
  }

  const entry = otpStore.get(String(userId));

  if (!entry) {
    return res.status(400).json({ error: 'No hay código activo para este usuario. Solicita uno nuevo.' });
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(String(userId));
    return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
  }

  if (entry.code !== String(code).trim()) {
    return res.status(401).json({ error: 'Código incorrecto. Verifica e intenta de nuevo.' });
  }

  // Código válido — eliminar para que no se reutilice
  otpStore.delete(String(userId));

  console.log(`[2FA] OTP verificado correctamente para usuario ${userId}`);
  res.json({ success: true, message: 'Código verificado correctamente' });
};

/**
 * Activa o desactiva el 2FA para el usuario especificado.
 * Ruta protegida (requiere token JWT).
 * Body: { activo: true/false }
 */
exports.setDosFaCtores = async (req, res) => {
  const { id } = req.params;
  const { dos_factores, activo } = req.body;
  const valorFinal = (typeof dos_factores === 'boolean') ? dos_factores : activo;

  if (typeof valorFinal !== 'boolean') {
    return res.status(400).json({ error: 'El campo "dos_factores" o "activo" debe ser true o false' });
  }

  // Solo el propio usuario o un admin puede cambiar su configuración
  const requesterId = req.user?.id_usuario || req.user?.id;
  const targetId = parseInt(id);

  if (requesterId !== targetId) {
    const isAdmin = ['Director General', 'Ingeniero en Sistemas', 'Admin'].includes(req.user?.rol);
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para modificar este usuario' });
    }
  }

  try {
    await db.query(
      'UPDATE usuarios SET dos_factores = $1 WHERE id_usuario = $2',
      [valorFinal, targetId]
    );

    console.log(`[2FA] dos_factores=${valorFinal} para usuario ${targetId}`);
    res.json({ success: true, dos_factores: valorFinal, activo: valorFinal });

  } catch (err) {
    // Si la columna no existe, intentar crearla primero
    if (err.code === '42703') {
      try {
        await db.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS dos_factores BOOLEAN DEFAULT FALSE');
        await db.query('UPDATE usuarios SET dos_factores = $1 WHERE id_usuario = $2', [valorFinal, targetId]);
        return res.json({ success: true, dos_factores: valorFinal, activo: valorFinal });
      } catch (err2) {
        console.error('[2FA] Error creando columna dos_factores:', err2);
      }
    }
    console.error('[2FA] Error actualizando dos_factores:', err);
    res.status(500).json({ error: 'Error al actualizar la configuración de 2FA' });
  }
};

/**
 * Obtiene el estado de 2FA de un usuario.
 * Ruta protegida.
 */
exports.getDosFaCtores = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(
      'SELECT dos_factores FROM usuarios WHERE id_usuario = $1',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const activo = rows[0].dos_factores === true;
    res.json({ dos_factores: activo, activo: activo });

  } catch (err) {
    // Si la columna no existe, retornar false (no activo)
    if (err.code === '42703') {
      return res.json({ activo: false });
    }
    console.error('[2FA] Error obteniendo dos_factores:', err);
    res.status(500).json({ error: 'Error al obtener la configuración de 2FA' });
  }
};
