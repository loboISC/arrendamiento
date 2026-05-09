const db = require('./src/server/config/database');

async function migrate() {
    try {
        console.log('Iniciando migración para Horas Extras...');
        
        await db.query(`
            CREATE TABLE IF NOT EXISTS rh_asistencia_extras (
                id SERIAL PRIMARY KEY,
                empleado_id INT REFERENCES rh_empleados(id),
                fecha DATE NOT NULL,
                minutos_detectados INT DEFAULT 0,
                minutos_autorizados INT DEFAULT 0,
                motivo TEXT,
                autorizado_por TEXT,
                status VARCHAR(20) DEFAULT 'Pendiente',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Tabla rh_asistencia_extras creada o ya existente.');

        console.log('Migración completada con éxito.');
        process.exit(0);
    } catch (err) {
        console.error('Error durante la migración:', err);
        process.exit(1);
    }
}

migrate();
