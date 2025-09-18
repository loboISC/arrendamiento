// Usar el pool centralizado (respeta .env, DATABASE_URL y DB_SSL)
const { pool } = require('./src/db');

// Función para agregar columnas faltantes a la tabla clientes
async function migrarTablaClientes() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Iniciando migración de tabla clientes...');
    
    // Lista de columnas a agregar con sus tipos
    const columnasAAgregar = [
      'estado VARCHAR(50) DEFAULT \'Activo\'',
      'empresa VARCHAR(255)',
      'telefono_alt VARCHAR(20)',
      'contacto VARCHAR(255)',
      'sitio_web VARCHAR(255)',
      'nit VARCHAR(50)',
      'segmento VARCHAR(100)',
      'limite_credito DECIMAL(15,2) DEFAULT 0.00',
      'deuda_actual DECIMAL(15,2) DEFAULT 0.00',
      'terminos_pago VARCHAR(100)',
      'metodo_pago VARCHAR(100)',
      'cal_general INTEGER CHECK (cal_general >= 1 AND cal_general <= 5)',
      'cal_pago INTEGER CHECK (cal_pago >= 1 AND cal_pago <= 5)',
      'cal_comunicacion INTEGER CHECK (cal_comunicacion >= 1 AND cal_comunicacion <= 5)',
      'cal_equipos INTEGER CHECK (cal_equipos >= 1 AND cal_equipos <= 5)',
      'cal_satisfaccion INTEGER CHECK (cal_satisfaccion >= 1 AND cal_satisfaccion <= 5)',
      'fecha_evaluacion DATE',
      'notas_evaluacion TEXT',
      'notas_generales TEXT',
      'atencion_nombre VARCHAR(255)',
      'tipo_cliente VARCHAR(100)',
      'ciudad VARCHAR(255)',
      'rfc VARCHAR(50)',
      'proyectos INTEGER DEFAULT 0',
      'valor_total DECIMAL(15,2) DEFAULT 0.00',
      'fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
    ];
    
    // Verificar qué columnas ya existen
    const existingColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clientes' AND table_schema = 'public'
    `);
    
    const columnasExistentes = existingColumns.rows.map(row => row.column_name);
    console.log('📋 Columnas existentes:', columnasExistentes);
    
    // Agregar solo las columnas que no existen
    for (const columnaDefinicion of columnasAAgregar) {
      const nombreColumna = columnaDefinicion.split(' ')[0];
      
      if (!columnasExistentes.includes(nombreColumna)) {
        try {
          await client.query(`ALTER TABLE clientes ADD COLUMN ${columnaDefinicion}`);
          console.log(`✅ Columna agregada: ${nombreColumna}`);
        } catch (error) {
          console.log(`⚠️  Error agregando columna ${nombreColumna}:`, error.message);
        }
      } else {
        console.log(`⏭️  Columna ya existe: ${nombreColumna}`);
      }
    }
    
    console.log('✅ Migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Función para insertar un cliente
async function insertarCliente(cliente) {
  const client = await pool.connect();
  
  try {
    const query = `
      INSERT INTO clientes (
        nombre, email, telefono, direccion, tipo, estado, empresa, telefono_alt, 
        contacto, sitio_web, nit, segmento, limite_credito, deuda_actual, 
        terminos_pago, metodo_pago, cal_general, cal_pago, cal_comunicacion, 
        cal_equipos, cal_satisfaccion, fecha_evaluacion, notas_evaluacion, 
        notas_generales, atencion_nombre, tipo_cliente, ciudad, rfc, 
        proyectos, valor_total, fecha_creacion
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
      ) RETURNING id_cliente
    `;
    
    const values = [
      cliente.nombre || cliente.empresa || cliente.atencion_nombre || 'Cliente Sin Nombre',
      cliente.email || null,
      cliente.telefono || null,
      cliente.direccion || null,
      cliente.tipo || cliente.tipo_cliente || 'Individual',
      cliente.estado || 'Activo',
      cliente.empresa || null,
      cliente.telefono_alt || null,
      cliente.contacto || null,
      cliente.sitio_web || null,
      cliente.nit || null,
      cliente.segmento || null,
      cliente.limite_credito || 0.00,
      cliente.deuda_actual || 0.00,
      cliente.terminos_pago || null,
      cliente.metodo_pago || null,
      cliente.cal_general || null,
      cliente.cal_pago || null,
      cliente.cal_comunicacion || null,
      cliente.cal_equipos || null,
      cliente.cal_satisfaccion || null,
      cliente.fecha_evaluacion || null,
      cliente.notas_evaluacion || null,
      cliente.notas_generales || null,
      cliente.atencion_nombre || null,
      cliente.tipo_cliente || null,
      cliente.ciudad || null,
      cliente.rfc || null,
      cliente.proyectos || 0,
      cliente.valor_total || 0.00,
      cliente.fecha_creacion || new Date()
    ];
    
    const result = await client.query(query, values);
    return result.rows[0];
    
  } catch (error) {
    console.error('❌ Error insertando cliente:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Función para insertar múltiples clientes
async function insertarClientesMasivo(clientes) {
  console.log(`🔄 Insertando ${clientes.length} clientes...`);
  
  let insertados = 0;
  let errores = 0;
  
  for (const cliente of clientes) {
    try {
      await insertarCliente(cliente);
      insertados++;
      console.log(`✅ Cliente insertado: ${cliente.nombre}`);
    } catch (error) {
      errores++;
      console.error(`❌ Error insertando ${cliente.nombre}:`, error.message);
    }
  }
  
  console.log(`\n📊 Resumen:`);
  console.log(`✅ Clientes insertados: ${insertados}`);
  console.log(`❌ Errores: ${errores}`);
  console.log(`📋 Total procesados: ${clientes.length}`);
}

// Ejecutar migración si se ejecuta directamente
if (require.main === module) {
  migrarTablaClientes()
    .then(() => {
      console.log('🎉 Migración completada. Ahora puedes ejecutar insertar-clientes-datos.js');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error en la migración:', error);
      process.exit(1);
    });
}

module.exports = {
  migrarTablaClientes,
  insertarCliente,
  insertarClientesMasivo
};
