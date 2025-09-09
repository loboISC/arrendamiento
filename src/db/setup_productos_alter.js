const db = require('./index');
const fs = require('fs');
const path = require('path');

async function setupProductosAlter(){
  try{
    console.log('Aplicando ALTER TABLE para public.productos...');
    const files = [
      'alter_productos_add_columns.sql',
      'alter_productos_add_descripcion.sql',
      'alter_productos_componentes_cantidades.sql'
    ];
    for (const f of files) {
      const p = path.join(__dirname, f);
      if (fs.existsSync(p)) {
        console.log('Ejecutando', f);
        const sql = fs.readFileSync(p, 'utf8');
        await db.query(sql);
      } else {
        console.warn('No encontrado', f);
      }
    }
    console.log('✅ Alteraciones aplicadas');
  }catch(err){
    console.error('❌ Error en ALTER productos:', err.message);
  }finally{
    process.exit();
  }
}

setupProductosAlter();
