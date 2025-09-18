// Usar el pool centralizado (respeta .env, DATABASE_URL y DB_SSL)
const { pool } = require('./src/db');

async function verificarTablas() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando tablas de encuestas...');
    
    // Verificar si las tablas existen
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('encuestas_satisfaccionsg', 'respuestas_encuestasg')
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tablas encontradas:');
    if (tablesResult.rows.length === 0) {
      console.log('   ❌ No se encontraron las tablas de encuestas');
      console.log('   💡 Necesitas ejecutar la migración primero');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`   ✓ ${row.table_name}`);
      });
    }
    
    // Verificar estructura de las tablas si existen
    if (tablesResult.rows.length > 0) {
      console.log('\n🏗️  Estructura de las tablas:');
      
      for (const table of tablesResult.rows) {
        console.log(`\n   📊 ${table.table_name}:`);
        const structure = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table.table_name]);
        
        structure.rows.forEach(col => {
          console.log(`      - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error al verificar tablas:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Ejecutar verificación
verificarTablas().catch(console.error);




