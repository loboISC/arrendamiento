const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { sendToN8n } = require('../services/n8n'); // Importar la nueva función

// Helper to robustly convert database data (Buffer or String) to a Data URL for the frontend
const toDataURL = (dbData) => {
  console.log('toDataURL called with:', typeof dbData, dbData instanceof Buffer ? 'Buffer' : 'not Buffer');
  // Case 1: It's a Buffer (the correct, new format)
  if (dbData instanceof Buffer) {
    console.log('Processing as Buffer');
    return `data:image/jpeg;base64,${dbData.toString('base64')}`;
  }
  // Case 2: It's already a valid data URL string (from old data)
  if (typeof dbData === 'string' && dbData.startsWith('data:image')) {
    console.log('Processing as valid data URL');
    return dbData;
  }
  // Case 3: It's a string that might be base64 encoded data URL
  if (typeof dbData === 'string' && dbData.length > 0) {
    console.log('Processing as string, length:', dbData.length);
    try {
      // Check if it's already a data URL by decoding
      const decoded = Buffer.from(dbData, 'base64').toString();
      console.log('Decoded string starts with data:image:', decoded.startsWith('data:image'));
      if (decoded.startsWith('data:image')) {
        console.log('Detected double-encoded data URL, fixing...');
        return decoded;
      }
      // If it's just base64 data, convert to data URL
      console.log('Converting base64 to data URL');
      return `data:image/jpeg;base64,${dbData}`;
    } catch (error) {
      console.log('Error processing photo data:', error);
      return null;
    }
  }
  // Fallback for other cases (null, empty, etc.)
  console.log('No valid data found, returning null');
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
    const photoBuffer = toBuffer(foto); // Convert to Buffer for DB
    const { rows } = await db.query(
      `UPDATE usuarios SET nombre=$1, correo=$2, rol=$3, estado=$4, foto=$5 WHERE id_usuario=$6 RETURNING id_usuario, nombre, correo, rol, estado, foto`,
      [nombre, correo, rol, estado, photoBuffer, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    // Convert the returned photo back to Data URL for the client
    const updatedUser = { ...rows[0], foto: toDataURL(rows[0].foto) };
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
  try {
    const { rows } = await db.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
    const user = rows[0];

    if (!user) {
      // Por seguridad, no revelamos si el usuario existe o no.
      return res.json({ message: 'Si existe una cuenta con ese correo, se ha enviado un enlace de recuperación.' });
    }

    // Generar un token seguro
    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hora de validez

    // Construir la URL HTTP. El backend ahora sirve los archivos estáticos.
    const recoveryUrl = `http://localhost:3001/recuperar.html?token=${token}`;

    // Guardar token y expiración en la BD
    await db.query('UPDATE usuarios SET reset_password_token = $1, reset_password_expires = $2 WHERE id_usuario = $3', [token, expires, user.id_usuario]);

    // Configurar el transportador de correo (usando variables de entorno)
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      // `secure` es true solo para el puerto 465 (SSL). Para el 587 (STARTTLS) debe ser false.
      secure: process.env.EMAIL_PORT == 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Crear el correo
    const mailOptions = {
      to: user.correo,
      from: `Soporte ScaffoldPro <${process.env.EMAIL_USER}>`,
      subject: 'Recuperación de Contraseña - ScaffoldPro',
      text: `Has solicitado un reseteo de contraseña.\n\n` +
            `Por favor, haz clic en el siguiente enlace o pégalo en tu navegador para completar el proceso:\n\n` +
            `${recoveryUrl}\n\n` + // Usar la URL HTTP que ahora funciona en cualquier navegador
            `Si no solicitaste esto, por favor ignora este correo y tu contraseña permanecerá sin cambios.\n`
    };

    // Enviar el correo
    await transporter.sendMail(mailOptions);

    res.json({ message: 'Se ha enviado un correo con las instrucciones para resetear tu contraseña.' });

  } catch (err) {
    console.error('Error en forgotPassword:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
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
