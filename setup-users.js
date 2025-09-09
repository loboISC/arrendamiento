const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'torresdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'irving',
});

async function setupUsers() {
  try {
    console.log('Configurando tabla de usuarios...');
    
    // Verificar si la tabla existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'usuarios'
      )
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('⚠️  Tabla usuarios ya existe, recreando...');
      await pool.query('DROP TABLE IF EXISTS usuarios CASCADE');
    }
    
    // Crear tabla usuarios
    await pool.query(`
      CREATE TABLE usuarios (
        id_usuario SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        rol VARCHAR(20) DEFAULT 'user',
        activo BOOLEAN DEFAULT true,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ultimo_login TIMESTAMP
      )
    `);
    
    console.log('✅ Tabla usuarios creada');
    
    // Crear hash de contraseña para admin
    const password = 'admin123';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Insertar usuario admin
    await pool.query(`
      INSERT INTO usuarios (username, email, password_hash, nombre, rol) 
      VALUES ($1, $2, $3, $4, $5)
    `, ['admin', 'admin@scaffoldpro.com', passwordHash, 'Administrador', 'admin']);
    
    console.log('✅ Usuario admin creado');
    console.log('📋 Credenciales de prueba:');
    console.log('   Usuario: admin');
    console.log('   Contraseña: admin123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

setupUsers(); 