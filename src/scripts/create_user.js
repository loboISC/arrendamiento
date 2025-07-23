const db = require('../db');
const bcrypt = require('bcrypt');

async function createUser({ nombre, correo, rol, estado, password }) {
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO usuarios (nombre, correo, rol, estado, password_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING id_usuario, nombre, correo, rol, estado`,
      [nombre, correo, rol, estado, hash]
    );
    console.log('Usuario creado:', rows[0]);
  } catch (err) {
    console.error('Error al crear usuario:', err.message);
  }
}

// Llama a todos los createUser aquí
Promise.all([
  createUser({
    nombre: 'David',
    correo: 'gestiondecalidad@andamiostorres.com',
    rol: 'sistema de gestion de Calidad',
    estado: 'Activo',
    password: '1234'
  }),
  createUser({
    nombre: 'bryan',
    correo: 'direccion@andamiostorres.com',
    rol: 'director general',
    estado: 'Activo',
    password: '1234'
  }),
  createUser({
    nombre: 'nancy',
    correo: 'jefaturaingenieria@andamiostorres.com',
    rol: 'ingeniera de proyectos',
    estado: 'Activo',
    password: '1234'
  }),
  createUser({
    nombre: 'IRVING',
    correo: 'sistemas@andamiostorres.com',
    rol: 'encargado de sistemas',
    estado: 'Activo',
    password: '1234'
  }),
  createUser({
    nombre: 'zambrano',
    correo: 'sistemas@andamiostorres.com',
    rol: 'auxiliar de sitemas',
    estado: 'Activo',
    password: '1234'
  }),
  createUser({
    nombre: 'rosi',
    correo: 'administracion@andamiostorres.com',
    rol: 'auxiliar contable',
    estado: 'Activo',
    password: '1234'
  }),
  createUser({
    nombre: 'Karla',
    correo: 'rentas@andamiostorres.com',
    rol: 'rentas',
    estado: 'Activo',
    password: '1234'
  }),
  createUser({
    nombre: 'America',
    correo: 'ventas@andamiostorres.com',
    rol: 'ventas',
    estado: 'Activo',
    password: '1234'
  }),
  createUser({
    nombre: 'recepcion',
    correo: 'contacto@andamiostorres.com',
    rol: 'recepcion',
    estado: 'Activo',
    password: '1234'
  })
]).finally(() => {
  db.pool.end();
});