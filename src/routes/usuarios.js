const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db/index');

// Endpoint de prueba para verificar que las rutas funcionan
router.get('/test', (req, res) => {
  res.json({ message: 'Rutas de usuarios funcionando correctamente' });
});

// Endpoint de login
router.post('/login', async (req, res) => {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    // Buscar usuario por correo
    const result = await db.query(
      'SELECT id_usuario, nombre, correo, password_hash, rol, estado, foto FROM usuarios WHERE correo = $1',
      [correo]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const usuario = result.rows[0];

    // Verificar contraseña (asumiendo que está hasheada con bcrypt)
    const passwordValida = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValida) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Verificar que el usuario esté activo
    if (usuario.estado !== 'Activo') {
      return res.status(401).json({ error: 'Usuario inactivo' });
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        correo: usuario.correo,
        rol: usuario.rol
      },
      process.env.JWT_SECRET || 'tu_clave_secreta',
      { expiresIn: '24h' }
    );

    // Enviar respuesta sin la contraseña
    const userResponse = {
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
      estado: usuario.estado,
      foto: usuario.foto ? `data:image/jpeg;base64,${usuario.foto.toString('base64')}` : null
    };

    res.json({
      token,
      user: userResponse,
      message: 'Login exitoso'
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Middleware para verificar token
const verificarToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tu_clave_secreta');
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Obtener perfil del usuario autenticado
router.get('/perfil', verificarToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id_usuario, nombre, correo, rol, estado, foto FROM usuarios WHERE id_usuario = $1',
      [req.usuario.id_usuario]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = result.rows[0];
    const userResponse = {
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
      estado: usuario.estado,
      foto: usuario.foto ? `data:image/jpeg;base64,${usuario.foto.toString('base64')}` : null
    };

    res.json(userResponse);
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint /me para obtener datos del usuario autenticado
router.get('/me', verificarToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id_usuario, nombre, correo, rol, estado, foto FROM usuarios WHERE id_usuario = $1',
      [req.usuario.id_usuario]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuario = result.rows[0];
    const userResponse = {
      id_usuario: usuario.id_usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
      estado: usuario.estado,
      foto: usuario.foto ? `data:image/jpeg;base64,${usuario.foto.toString('base64')}` : null
    };

    res.json(userResponse);
  } catch (error) {
    console.error('Error al obtener datos del usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener todos los usuarios
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM usuarios ORDER BY id_usuario');

    // Convertir las fotos de bytea a base64
    const usuariosConFotos = result.rows.map(usuario => {
      let fotoBase64 = null;
      if (usuario.foto) {
        try {
          fotoBase64 = `data:image/jpeg;base64,${usuario.foto.toString('base64')}`;
        } catch (error) {
          console.error('Error convirtiendo foto a base64:', error);
          fotoBase64 = null;
        }
      }

      return {
        ...usuario,
        foto: fotoBase64,
        password_hash: undefined // No enviar la contraseña en la lista
      };
    });

    res.json(usuariosConFotos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Crear nuevo usuario
router.post('/', async (req, res) => {
  try {
    const { nombre, correo, password, rol, estado, foto } = req.body;

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      'INSERT INTO usuarios (nombre, correo, password_hash, rol, estado, foto) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nombre, correo, hashedPassword, rol, estado, foto]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// Helper para convertir data URL a Buffer
const toBuffer = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const trimmed = dataUrl.trim();
  if (trimmed.startsWith('data:')) {
    const parts = trimmed.split(',', 2);
    if (parts.length === 2) {
      try { return Buffer.from(parts[1], 'base64'); } catch (_) { return null; }
    }
    return null;
  }
  try {
    return Buffer.from(trimmed, 'base64');
  } catch (error) {
    return null;
  }
};

// Helper para convertir Buffer a data URL
const toDataURL = (dbData) => {
  if (dbData instanceof Buffer) {
    const bufferStr = dbData.toString('utf8');
    if (bufferStr.startsWith('data:image')) {
      return bufferStr;
    }
    return `data:image/jpeg;base64,${dbData.toString('base64')}`;
  }
  if (typeof dbData === 'string' && dbData.startsWith('data:image')) {
    return dbData;
  }
  return null;
};

// Actualizar usuario
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, correo, rol, estado, foto } = req.body;

    // Convertir foto a Buffer para guardar correctamente
    const photoBuffer = toBuffer(foto);

    const result = await db.query(
      'UPDATE usuarios SET nombre = $1, correo = $2, rol = $3, estado = $4, foto = $5 WHERE id_usuario = $6 RETURNING *',
      [nombre, correo, rol, estado, photoBuffer, id]
    );

    // Convertir foto de vuelta a data URL para la respuesta
    const user = result.rows[0];
    user.foto = toDataURL(user.foto);

    res.json(user);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// Actualizar contraseña de usuario (Admin)
router.put('/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'La contraseña es requerida' });
    }

    // Hashear contraseña sin restricciones extra
    const hashedPassword = await bcrypt.hash(password, 10);

    // Convertir ID a entero por seguridad
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    const result = await db.query(
      'UPDATE usuarios SET password_hash = $1 WHERE id_usuario = $2 RETURNING id_usuario',
      [hashedPassword, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar contraseña:', error);
    res.status(500).json({ error: `Error del servidor: ${error.message}` });
  }
});

// Eliminar usuario
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM usuarios WHERE id_usuario = $1', [id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;