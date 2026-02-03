require('dotenv').config();
const { pool } = require('./src/db');

async function verificarNuevoSiguiente() {
  try {
    // Contar contratos de TODO 2026
    const result = await pool.query(
      `SELECT COUNT(*) as cantidad FROM contratos WHERE numero_contrato LIKE 'CT-2026-%'`
    );

    const cantidad = parseInt(result.rows[0].cantidad || 0);
    const siguiente = cantidad + 1;

    console.log(`Total de contratos en 2026: ${cantidad}`);
    console.log(`Siguiente número debería ser: CT-2026-02-${String(siguiente).padStart(4, '0')}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

verificarNuevoSiguiente();
