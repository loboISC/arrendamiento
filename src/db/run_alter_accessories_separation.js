require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./index');

(async () => {
  const sqlPath = path.join(__dirname, 'alter_accessories_separation.sql');
  try {
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('🛠 Ejecutando migración de separación de accesorios...');
    await db.query(sql);
    console.log('✅ Migración aplicada correctamente.');
  } catch (err) {
    console.error('❌ Error al aplicar migración:', err.message);
    console.error('Detalle:', err.stack);
  } finally {
    try { db.pool.end && db.pool.end(); } catch(_) {}
    process.exit();
  }
})();
