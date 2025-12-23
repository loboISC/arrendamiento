const db = require('../db/index');

// Crear tabla de configuración SMTP (si no existe)
async function createSmtpConfigTable() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS public.configuracion_smtp (
        id_config_smtp      SERIAL PRIMARY KEY,
        alias               VARCHAR(80) NOT NULL,
        host                VARCHAR(120) NOT NULL,
        puerto              INTEGER NOT NULL DEFAULT 465,
        usa_ssl             BOOLEAN NOT NULL DEFAULT TRUE,
        usuario             VARCHAR(150) NOT NULL,
        contrasena          TEXT NOT NULL,
        correo_from         VARCHAR(150) NOT NULL,
        notas               TEXT,
        creado_por          INTEGER REFERENCES public.usuarios(id_usuario),
        fecha_creacion      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Tabla configuracion_smtp creada o ya existía.');
  } catch (err) {
    console.error('Error creando tabla configuracion_smtp:', err);
  }
}

// Obtener todas las configuraciones SMTP
async function getAllSmtpConfigs() {
  try {
    const result = await db.query(`
      SELECT 
        id_config_smtp,
        alias,
        host,
        puerto,
        usa_ssl,
        usuario,
        correo_from,
        notas,
        creado_por,
        fecha_creacion,
        fecha_actualizacion
      FROM configuracion_smtp
      ORDER BY fecha_actualizacion DESC
    `);
    return result.rows;
  } catch (err) {
    console.error('Error en getAllSmtpConfigs:', err);
    throw err;
  }
}

// Obtener una configuración SMTP por ID
async function getSmtpConfigById(id) {
  try {
    const result = await db.query(`
      SELECT 
        id_config_smtp,
        alias,
        host,
        puerto,
        usa_ssl,
        usuario,
        correo_from,
        notas,
        creado_por,
        fecha_creacion,
        fecha_actualizacion
      FROM configuracion_smtp
      WHERE id_config_smtp = $1
    `, [id]);
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error en getSmtpConfigById:', err);
    throw err;
  }
}

// Obtener configuración SMTP por alias
async function getSmtpConfigByAlias(alias) {
  try {
    const result = await db.query(`
      SELECT 
        id_config_smtp,
        alias,
        host,
        puerto,
        usa_ssl,
        usuario,
        contrasena,
        correo_from,
        notas,
        creado_por,
        fecha_creacion,
        fecha_actualizacion
      FROM configuracion_smtp
      WHERE alias = $1
    `, [alias]);
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error en getSmtpConfigByAlias:', err);
    throw err;
  }
}

// Crear una nueva configuración SMTP
async function createSmtpConfig(config) {
  try {
    const { alias, host, puerto, usa_ssl, usuario, contrasena, correo_from, notas, creado_por } = config;
    const result = await db.query(`
      INSERT INTO configuracion_smtp (alias, host, puerto, usa_ssl, usuario, contrasena, correo_from, notas, creado_por, fecha_creacion, fecha_actualizacion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id_config_smtp, alias, host, puerto, usa_ssl, usuario, correo_from, notas, fecha_creacion
    `, [alias, host, puerto || 465, usa_ssl !== false, usuario, contrasena, correo_from || usuario, notas || '', creado_por]);
    return result.rows[0];
  } catch (err) {
    console.error('Error en createSmtpConfig:', err);
    throw err;
  }
}

// Actualizar una configuración SMTP
async function updateSmtpConfig(id, config) {
  try {
    const { alias, host, puerto, usa_ssl, usuario, contrasena, correo_from, notas } = config;
    const result = await db.query(`
      UPDATE configuracion_smtp
      SET alias = $1, host = $2, puerto = $3, usa_ssl = $4, usuario = $5, contrasena = $6, 
          correo_from = $7, notas = $8, fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id_config_smtp = $9
      RETURNING id_config_smtp, alias, host, puerto, usa_ssl, usuario, correo_from, notas, fecha_actualizacion
    `, [alias, host, puerto || 465, usa_ssl !== false, usuario, contrasena, correo_from || usuario, notas || '', id]);
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error en updateSmtpConfig:', err);
    throw err;
  }
}

// Eliminar una configuración SMTP
async function deleteSmtpConfig(id) {
  try {
    const result = await db.query(`
      DELETE FROM configuracion_smtp
      WHERE id_config_smtp = $1
      RETURNING id_config_smtp
    `, [id]);
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error en deleteSmtpConfig:', err);
    throw err;
  }
}

module.exports = {
  createSmtpConfigTable,
  getAllSmtpConfigs,
  getSmtpConfigById,
  getSmtpConfigByAlias,
  createSmtpConfig,
  updateSmtpConfig,
  deleteSmtpConfig
};
