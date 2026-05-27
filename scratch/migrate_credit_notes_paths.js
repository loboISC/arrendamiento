const db = require('../src/server/config/database');

async function main() {
  console.log('Aplicando migración: agregar pdf_path y xml_path a credit_notes...');

  await db.query(`
    ALTER TABLE credit_notes
      ADD COLUMN IF NOT EXISTS pdf_path TEXT DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS xml_path TEXT DEFAULT NULL
  `);

  console.log('✅ Columnas pdf_path y xml_path agregadas (o ya existían).');

  // Verificar
  const r = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'credit_notes'"
  );
  console.log('Columnas actuales:', r.rows.map(c => c.column_name).join(', '));
  process.exit(0);
}

main().catch(e => { console.error('❌ Error en migración:', e.message); process.exit(1); });
