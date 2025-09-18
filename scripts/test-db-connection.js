require('dotenv').config();
const { pool } = require('../src/db');

(async () => {
  try {
    console.log('Probando conexión a la base de datos...');
    const res = await pool.query('SELECT current_database() as db, current_user as user, inet_server_addr() as host, inet_server_port() as port');
    console.log('Conexión OK:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Error de conexión:', err.message);
    process.exit(1);
  }
})();
