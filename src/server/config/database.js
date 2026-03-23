const { Pool } = require('pg');
require('dotenv').config();

const sslFlag = String(process.env.DB_SSL || '').toLowerCase();
const useSSL = sslFlag === 'true' || sslFlag === '1' || sslFlag === 'yes';
const isProduction = process.env.NODE_ENV === 'production';
const defaultHost = process.env.DB_HOST || (isProduction ? 'db' : 'localhost');
const defaultPort = Number(process.env.DB_PORT || 5432);
const defaultDatabase = process.env.DB_NAME || 'torresdb';
const defaultUser = process.env.DB_USER || 'postgres';
const defaultPassword = process.env.DB_PASSWORD || 'TorresControl_2026!';

let dbConfig;
if (process.env.DATABASE_URL) {
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    keepAlive: true,
    connectionTimeoutMillis: 10000,
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  };
} else {
  dbConfig = {
    host: defaultHost,
    port: defaultPort,
    database: defaultDatabase,
    user: defaultUser,
    password: defaultPassword,
    keepAlive: true,
    connectionTimeoutMillis: 10000,
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

if (process.env.NODE_ENV !== 'test') {
  console.log('Configuracion de BD:', {
    mode: process.env.DATABASE_URL ? 'DATABASE_URL' : 'separate_vars',
    host: dbConfig.host || '(via URL)',
    port: dbConfig.port || '(via URL)',
    database: dbConfig.database || '(via URL)',
    user: dbConfig.user || '(via URL)',
    password: (process.env.DB_PASSWORD || process.env.DATABASE_URL || defaultPassword) ? '***' : 'undefined',
    ssl: useSSL ? 'enabled' : 'disabled'
  });
}

const pool = new Pool(dbConfig);

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const client = await pool.connect();
      console.log('Conexion a la base de datos exitosa.');
      client.release();
    } catch (err) {
      console.error('FATAL: Error al conectar a la base de datos:', err.stack);
      process.exit(1);
    }
  })();
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
