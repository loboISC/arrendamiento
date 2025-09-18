const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Importar la función toDataURL mejorada desde usuarios.js
const { toDataURL } = require('./usuarios');

// Login de usuario
exports.login = async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }
  
  try {
    console.log('Login attempt:', { username, password: password ? '***' : 'undefined' });

    let rows;
    try {
      // Intento 1: esquema con columna estado='Activo' y campo nombre
      ({ rows } = await db.query(
        'SELECT * FROM usuarios WHERE nombre = $1 AND estado = $2',
        [username, 'Activo']
      ));
    } catch (e1) {
      console.log('Esquema (estado/nombre) no disponible, error:', e1?.code || e1?.message);
      rows = [];
    }

    // Intento 2: si no hay coincidencias, probar variantes de columnas y activo=true
    if (!rows || rows.length === 0) {
      try {
        ({ rows } = await db.query(
          `SELECT * FROM usuarios
           WHERE (nombre = $1 OR username = $1 OR correo = $1 OR email = $1)
             AND (COALESCE(
                    CASE WHEN CAST(COALESCE(activo, true) AS boolean) THEN 'Activo' ELSE 'Inactivo' END,
                    'Activo') = 'Activo')
          `,
          [username]
        ));
      } catch (e2) {
        console.log('Esquema alterno (activo/username/correo) falló:', e2?.code || e2?.message);
        rows = [];
      }
    }

    console.log('Usuarios encontrados:', rows.length);
    if (rows.length > 0) {
      console.log('Usuario encontrado:', {
        id: rows[0].id_usuario,
        nombre: rows[0].nombre || rows[0].username,
        estado: rows[0].estado ?? (rows[0].activo ? 'Activo' : 'Inactivo'),
        hasPassword: !!rows[0].password_hash
      });
    }

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = rows[0];
    
    // Verificar contraseña
    console.log('Verificando contraseña...');
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    console.log('Contraseña válida:', isValidPassword);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    // Actualizar último login (si la columna existe)
    try {
      await db.query(
        'UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP WHERE id_usuario = $1',
        [user.id_usuario]
      );
    } catch (error) {
      // Si la columna ultimo_login no existe, ignorar el error
      console.log('Columna ultimo_login no disponible');
    }
    
    // Generar token JWT
    const token = jwt.sign(
      {
        id: user.id_usuario,
        username: user.nombre || user.username, // Usar nombre o username
        email: user.correo || user.email,       // Usar correo o email
        nombre: user.nombre || user.username,
        rol: user.rol || 'user'
      },
      process.env.JWT_SECRET || 'secreto',
      { expiresIn: '24h' }
    );
    
    // Enviar respuesta sin password_hash
    const { password_hash, ...userWithoutPassword } = user;
    
    // Si hay foto, convertirla usando la función toDataURL mejorada
    if (userWithoutPassword.foto) {
      console.log('Usuario tiene foto, procesando con toDataURL...');
      console.log('Tipo de foto:', typeof userWithoutPassword.foto);
      console.log('Es Buffer:', userWithoutPassword.foto instanceof Buffer);
      if (typeof userWithoutPassword.foto === 'string') {
        console.log('Longitud del string:', userWithoutPassword.foto.length);
        console.log('Primeros 50 caracteres:', userWithoutPassword.foto.substring(0, 50));
      }
      userWithoutPassword.foto = toDataURL(userWithoutPassword.foto);
      console.log('Foto procesada:', userWithoutPassword.foto ? 'Válida' : 'No válida');
      if (userWithoutPassword.foto) {
        console.log('Primeros 50 caracteres de la foto procesada:', userWithoutPassword.foto.substring(0, 50));
      }
    } else {
      console.log('Usuario no tiene foto');
    }
    
    res.json({
      message: 'Login exitoso',
      token,
      user: userWithoutPassword
    });
    
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Verificar token (para validar sesión)
exports.verifyToken = async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) {
      return res.status(401).json({ error: 'Token requerido' });
    }
    
    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto');

    let rows;
    try {
      ({ rows } = await db.query(
        'SELECT id_usuario, nombre, correo, rol FROM usuarios WHERE id_usuario = $1 AND estado = $2',
        [decoded.id, 'Activo']
      ));
    } catch (e1) {
      console.log('verifyToken: esquema (estado) no disponible:', e1?.code || e1?.message);
      rows = [];
    }

    if (!rows || rows.length === 0) {
      try {
        ({ rows } = await db.query(
          `SELECT id_usuario,
                  COALESCE(nombre, username) AS nombre,
                  COALESCE(correo, email)   AS correo,
                  rol
           FROM usuarios
           WHERE id_usuario = $1 AND COALESCE(CAST(COALESCE(activo, true) AS boolean), true) = true`,
          [decoded.id]
        ));
      } catch (e2) {
        console.log('verifyToken: esquema alterno (activo) falló:', e2?.code || e2?.message);
        rows = [];
      }
    }

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    res.json({ valid: true, user: rows[0] });

  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

// Obtener perfil del usuario actual
exports.getProfile = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id_usuario, nombre, correo, rol, foto FROM usuarios WHERE id_usuario = $1',
      [req.user.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const user = rows[0];
    
    // Si hay foto, convertirla usando la función toDataURL mejorada
    if (user.foto) {
      console.log('Perfil: Usuario tiene foto, procesando con toDataURL...');
      user.foto = toDataURL(user.foto);
      console.log('Perfil: Foto procesada:', user.foto ? 'Válida' : 'No válida');
    } else {
      console.log('Perfil: Usuario no tiene foto');
    }
    
    res.json(user);
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 