const db = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { sendToN8n } = require('../services/n8n'); // Importar la nueva función

// Helper to robustly convert database data (Buffer or String) to a Data URL for the frontend
const toDataURL = (dbData) => {
  // Case 1: It's a Buffer
  if (dbData instanceof Buffer) {
    // Check if the buffer contains a data URL (double-encoded case)
    const bufferStr = dbData.toString('utf8');
    if (bufferStr.startsWith('data:image')) {
      // Buffer contains a data URL string directly - return it
      return bufferStr;
    }
    // Buffer contains raw image data - encode to base64
    const base64 = dbData.toString('base64');
    // Check if the base64 decodes to a data URL (triple-encoded edge case)
    try {
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      if (decoded.startsWith('data:image')) {
        return decoded;
      }
    } catch (e) { /* ignore */ }
    return `data:image/jpeg;base64,${base64}`;
  }
  // Case 2: It's already a valid data URL string
  if (typeof dbData === 'string' && dbData.startsWith('data:image')) {
    // Check if the base64 part is itself a data URL (double-encoded)
    const parts = dbData.split(',');
    if (parts.length === 2) {
      try {
        const decoded = Buffer.from(parts[1], 'base64').toString('utf8');
        if (decoded.startsWith('data:image')) {
          return decoded;
        }
      } catch (e) { /* ignore */ }
    }
    return dbData;
  }
  // Case 3: It's a base64 string without prefix
  if (typeof dbData === 'string' && dbData.length > 0) {
    try {
      const decoded = Buffer.from(dbData, 'base64').toString('utf8');
      if (decoded.startsWith('data:image')) {
        return decoded;
      }
      return `data:image/jpeg;base64,${dbData}`;
    } catch (error) {
      return null;
    }
  }
  return null;
};

// Helper to convert a Data URL from the client to a Buffer for the database
const toBuffer = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const trimmed = dataUrl.trim();
  // Handle generic data URLs like data:image/*, data:application/octet-stream, etc.
  if (trimmed.startsWith('data:')) {
    const parts = trimmed.split(',', 2);
    if (parts.length === 2) {
      try { return Buffer.from(parts[1], 'base64'); } catch (_) { return null; }
    }
    return null;
  }
  // If it's plain base64 without prefix
  try {
    return Buffer.from(trimmed, 'base64');
  } catch (error) {
    console.log('Error processing data for buffer:', error);
    return null;
  }
};


// Obtener todos los usuarios
exports.getAll = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id_usuario, nombre, correo, rol, estado, foto FROM usuarios ORDER BY id_usuario');
    // Process each user to ensure the photo is in the correct Data URL format
    const users = rows.map(u => ({ ...u, foto: toDataURL(u.foto) }));
    res.json(users);
  } catch (err) {
    console.error('Error in getAll users:', err);
    res.status(500).json({ error: err.message });
  }
};

// Crear usuario (registro)
exports.create = async (req, res) => {
  const { nombre, correo, rol, estado, password, foto } = req.body;
  if (!nombre || !correo || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contraseña son requeridos' });
  }
  try {
    // Verificar si el correo ya existe ANTES de intentar crear el usuario.
    const { rows: existingUser } = await db.query('SELECT id_usuario FROM usuarios WHERE correo = $1', [correo]);
    if (existingUser.length > 0) {
      // Si existe, devuelve un error 409 (Conflicto) con un mensaje claro.
      return res.status(409).json({ error: 'El correo electrónico ya está en uso.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const photoBuffer = toBuffer(foto); // Convert to Buffer for DB
    const { rows } = await db.query(
      `INSERT INTO usuarios (nombre, correo, rol, estado, password_hash, foto)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id_usuario, nombre, correo, rol, estado, foto`,
      [nombre, correo, rol, estado, hash, photoBuffer]
    );
    // Convert the returned photo back to Data URL for the client
    const newUser = { ...rows[0], foto: toDataURL(rows[0].foto) };

    // Enviar notificación a n8n
    sendToN8n('user_created', { id: newUser.id_usuario, nombre: newUser.nombre, correo: newUser.correo, rol: newUser.rol });
    res.status(201).json(newUser);
  } catch (err) {
    console.error('Error in create user:', err);
    // Si el error es por la codificación, damos un mensaje más específico.
    if (err.code === '22021') {
      return res.status(500).json({ error: 'Error de codificación de datos. Verifica que la columna "foto" en la tabla "usuarios" sea de tipo BYTEA.' });
    }
    res.status(500).json({ error: 'Error interno del servidor al crear el usuario.' });
  }
};

// Actualizar usuario
exports.update = async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, rol, estado, foto } = req.body;
  try {
    console.log('=== ACTUALIZANDO USUARIO ===');
    console.log('ID:', id, '| Foto recibida:', foto ? foto.substring(0, 30) + '...' : 'null');

    const photoBuffer = toBuffer(foto);
    console.log('Buffer creado:', photoBuffer ? `${photoBuffer.length} bytes` : 'null');

    const { rows } = await db.query(
      `UPDATE usuarios SET nombre=$1, correo=$2, rol=$3, estado=$4, foto=$5 WHERE id_usuario=$6 RETURNING id_usuario, nombre, correo, rol, estado, foto`,
      [nombre, correo, rol, estado, photoBuffer, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const updatedUser = { ...rows[0], foto: toDataURL(rows[0].foto) };
    console.log('Foto guardada OK, respuesta:', updatedUser.foto ? updatedUser.foto.substring(0, 30) + '...' : 'null');
    console.log('=== FIN ACTUALIZACIÓN ===');
    res.json(updatedUser);
  } catch (err) {
    console.error('Error in update user:', err);
    res.status(500).json({ error: err.message });
  }
};

// Eliminar usuario
exports.delete = async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await db.query('DELETE FROM usuarios WHERE id_usuario=$1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    console.error('Error in delete user:', err);
    res.status(500).json({ error: err.message });
  }
};

// Login (autenticación)
exports.login = async (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña requeridos' });
  }
  try {
    const { rows } = await db.query('SELECT * FROM usuarios WHERE correo=$1', [correo]);
    if (rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Credenciales inválidas' });

    // Generar JWT (sin foto)
    const token = jwt.sign(
      { id: user.id_usuario, nombre: user.nombre, correo: user.correo, rol: user.rol },
      process.env.JWT_SECRET || 'secreto',
      { expiresIn: '8h' }
    );

    // Preparar el objeto de usuario para el cliente (con foto en formato Data URL)
    const userForClient = {
      id: user.id_usuario,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
      foto: toDataURL(user.foto)
    };

    res.json({ token, user: userForClient });
  } catch (err) {
    console.error('Error in login:', err);
    res.status(500).json({ error: err.message });
  }
};

// Exportar utilidades de imagen para uso en otros controladores (después de definir toBuffer)
exports.toDataURL = toDataURL;
exports.toBuffer = toBuffer;

// --- INICIO: LÓGICA DE RECUPERACIÓN DE CONTRASEÑA ---

// 1. Solicitar reseteo de contraseña
exports.forgotPassword = async (req, res) => {
  const { correo } = req.body;
  if (!correo) return res.status(400).json({ error: 'El correo es requerido' });

  try {
    const { rows } = await db.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
    const user = rows[0];

    if (!user) {
      // Por seguridad, no revelamos si el usuario existe
      return res.json({ message: 'Si el correo está registrado, recibirás un enlace en breve.' });
    }

    // Generar un token seguro
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hora de validez

    // Construir la URL dinámica
    const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3001';
    const recoveryUrl = `${origin}/recuperar.html?token=${token}`;

    // Guardar token y expiración
    await db.query('UPDATE usuarios SET reset_password_token = $1, reset_password_expires = $2 WHERE id_usuario = $3', [token, expires, user.id_usuario]);

    const emailService = require('../services/emailService');
    const path = require('path');
    const fs = require('fs');
    const headerImagePath = path.join(process.cwd(), 'public/assets/images/restablecer contraseña.png');
    const attachments = [];
    if (fs.existsSync(headerImagePath)) {
      attachments.push({ filename: 'header.png', path: headerImagePath, cid: 'reset_header' });
    }

    // Enviar el correo
    await emailService.sendMail({
      to: user.correo,
      subject: 'Recuperación de Contraseña — SAPT Andamios Torres',
      attachments: attachments,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e3e8ef;border-radius:18px;overflow:hidden;background:#ffffff;box-shadow:0 10px 25px rgba(0,0,0,0.05);">
          ${fs.existsSync(headerImagePath) ? `
          <div style="text-align:center;background:#000;line-height:0;">
            <img src="cid:reset_header" alt="Verification" style="width:100%;max-width:520px;display:block;" />
          </div>
          ` : `
          <div style="background:#1b3c5e;padding:28px 24px;text-align:center;"><h2 style="color:#fff;margin:0;">Recuperación de Contraseña</h2></div>
          `}
          <div style="padding:40px 32px;text-align:center;">
            <p style="color:#374151;font-size:1.1rem;margin-top:0;">Hola <strong>${user.nombre}</strong></p>
            <p style="color:#6b7280;font-size:1rem;line-height:1.6;margin-bottom:30px;">
              Has solicitado restablecer tu contraseña para acceder al sistema SAPT.
            </p>
            <div style="margin-bottom:35px;">
              <a href="${recoveryUrl}" style="background:#1b3c5e;color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:1.05rem;display:inline-block;box-shadow:0 8px 20px rgba(27,60,94,0.3);">
                Restablecer Contraseña
              </a>
            </div>
            <p style="color:#9ca3af;font-size:0.88rem;margin:0;">
              Este enlace es válido por <strong>1 hora</strong>.<br>
              Si no solicitaste este cambio, puedes ignorar este mensaje.
            </p>
          </div>
          <div style="background:#f8fafc;padding:20px;text-align:center;font-size:0.8rem;color:#9ca3af;border-top:1px solid #f1f5f9;">
            © 2025 Andamios Torres S.A. de C.V. — Sistema SAPT
          </div>
        </div>
      `
    });

    res.json({ message: 'Se ha enviado un correo con las instrucciones para resetear tu contraseña.' });

  } catch (err) {
    console.error('Error en forgotPassword:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud de recuperación.' });
  }
};

// 2. Resetear la contraseña con el token
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
      [token]
    );
    const user = rows[0];

    if (!user) {
      return res.status(400).json({ error: 'El token de reseteo es inválido o ha expirado.' });
    }

    // Mejora de seguridad: Verificar si la nueva contraseña es igual a la anterior.
    const isSamePassword = await bcrypt.compare(password, user.password_hash);
    if (isSamePassword) {
      return res.status(400).json({ error: 'La nueva contraseña no puede ser igual a la anterior.' });
    }

    // Hashear la nueva contraseña
    const hash = await bcrypt.hash(password, 10);

    // Actualizar la contraseña y limpiar el token
    await db.query(
      'UPDATE usuarios SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id_usuario = $2',
      [hash, user.id_usuario]
    );

    res.json({ message: 'Tu contraseña ha sido actualizada exitosamente.' });

  } catch (err) {
    console.error('Error en resetPassword:', err);
    res.status(500).json({ error: 'Error al resetear la contraseña.' });
  }
};

// 3. Actualización directa de contraseña (Admin)
exports.updatePassword = async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'La contraseña es requerida' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rowCount } = await db.query(
      'UPDATE usuarios SET password_hash = $1 WHERE id_usuario = $2',
      [hash, id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('Error en updatePassword:', err);
    res.status(500).json({ error: 'Error al actualizar la contraseña' });
  }
};
