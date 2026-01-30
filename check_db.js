const { pool } = require('./src/db');

async function checkColumns() {
    try {
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'contratos'
    `);
        console.log('Columns in contratos table:');
        res.rows.forEach(row => console.log(`- ${row.column_name}`));
        process.exit(0);
    } catch (err) {
        console.error('Error checking columns:', err);
        process.exit(1);
    }
}

checkColumns();
