const { pool } = require('./src/db/index');

async function migrate() {
    try {
        console.log('Agregando columna horario_entrega a la tabla contratos...');
        await pool.query(`
      ALTER TABLE contratos 
      ADD COLUMN IF NOT EXISTS horario_entrega character varying
    `);
        console.log('Columna agregada exitosamente.');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

migrate();
