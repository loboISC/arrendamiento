const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: '192.168.0.140',
  database: 'torresdb',
  password: 'irving',
  port: 5432,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error conectando:', err);
  } else {
    console.log('Conexión exitosa! Hora del servidor:', res.rows[0].now);
  }
  pool.end();
});