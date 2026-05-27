const db = require('../src/server/config/database');
async function main() {
  const r = await db.query(
    "SELECT id, status, uuid, folio, pdf_path, xml_path FROM credit_notes WHERE id = $1::uuid OR uuid = $1::text",
    ['6d4185e7-d070-4e4b-9279-09f4c7c9a7ea']
  );
  console.log('Credit note info:', JSON.stringify(r.rows, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
