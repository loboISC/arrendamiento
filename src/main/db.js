// Placeholder paconst { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
  .then(() => console.log('✅ Conectado a PostgreSQL con DATABASE_URL'))
  .catch(err => console.error('❌ Error de conexión:', err));

module.exports = pool;

// Aquí se configurará la conexión y utilidades de base de datos
