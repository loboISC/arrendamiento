const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'torresdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'irving',
};

console.log('Configuración de BD:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  password: dbConfig.password ? '***' : 'undefined'
});

const pool = new Pool(dbConfig);

// Test the connection
(async () => {
  try {
    const client = await pool.connect();
    console.log('Conexión a la base de datos exitosa.');
    client.release();
  } catch (err) {
    console.error('FATAL: Error al conectar a la base de datos:', err.stack);
    process.exit(1);
  }
})();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
}; 