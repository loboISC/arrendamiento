const db = require('./index');
const fs = require('fs');
const path = require('path');

async function setupProductosTables(){
  try{
    console.log('Creando tablas de productos, imagenes, componentes y accesorios...');
    const sqlPath = path.join(__dirname, 'create_productos_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await db.query(sql);
    console.log('✅ Tablas de productos creadas/verificadas.');
  }catch(err){
    console.error('❌ Error creando tablas de productos:', err.message);
  }finally{
    process.exit();
  }
}

setupProductosTables();
