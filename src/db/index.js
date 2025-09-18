const { Pool } = require('pg');
require('dotenv').config();

// Determinar si usar SSL
const sslFlag = String(process.env.DB_SSL || '').toLowerCase();
const useSSL = sslFlag === 'true' || sslFlag === '1' || sslFlag === 'yes';

// Configuración de la base de datos
let dbConfig;
if (process.env.DATABASE_URL) {
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  };
} else {
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'torresdb',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'irving',
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

// Log de configuración (sin exponer password)
console.log('Configuración de BD:', {
  mode: process.env.DATABASE_URL ? 'DATABASE_URL' : 'separate_vars',
  host: dbConfig.host || '(via URL)',
  port: dbConfig.port || '(via URL)',
  database: dbConfig.database || '(via URL)',
  user: dbConfig.user || '(via URL)',
  password: (process.env.DB_PASSWORD || (process.env.DATABASE_URL ? '***' : '')) ? '***' : 'undefined',
  ssl: useSSL ? 'enabled' : 'disabled'
});

const pool = new Pool(dbConfig);

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};