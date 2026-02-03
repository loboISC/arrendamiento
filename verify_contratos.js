require('dotenv').config();
const { pool } = require('./src/db');

async function verificarContratos() {
  try {
    // Obtener TODOS los contratos con sus fechas para entender la distribución
    const result = await pool.query(
      `SELECT numero_contrato, fecha_contrato FROM contratos 
       WHERE numero_contrato LIKE 'CT-%'
       ORDER BY numero_contrato DESC
       LIMIT 30`
    );

    console.log('Últimos 30 contratos:');
    result.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.numero_contrato} - ${row.fecha_contrato}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

verificarContratos();
