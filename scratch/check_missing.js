const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgres://postgres:irving@192.168.100.5:5433/torresdb"
});

async function checkMissing() {
    try {
        const res = await pool.query("SELECT id, nombre, apellidos FROM rh_empleados WHERE puesto_id IS NULL");
        console.log('--- EMPLEADOS SIN PUESTO (DESARROLLO) ---');
        console.table(res.rows);
        await pool.end();
    } catch (err) {
        console.error('Error conectando a Desarrollo:', err.message);
        process.exit(1);
    }
}

checkMissing();
