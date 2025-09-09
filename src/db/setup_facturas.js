const db = require('./index');
const fs = require('fs');
const path = require('path');

async function setupFacturasTable() {
    try {
        console.log('Creando tabla de facturas...');
        
        const sqlPath = path.join(__dirname, 'create_facturas_table.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        await db.query(sql);
        
        console.log('✅ Tabla de facturas creada exitosamente');
        
        // Verificar que la tabla existe
        const result = await db.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'facturas'
        `);
        
        if (result.rows.length > 0) {
            console.log('✅ Tabla facturas verificada en la base de datos');
        } else {
            console.log('❌ Error: La tabla facturas no se creó correctamente');
        }
        
    } catch (error) {
        console.error('❌ Error creando tabla de facturas:', error.message);
    } finally {
        process.exit();
    }
}

setupFacturasTable(); 