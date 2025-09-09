require('dotenv').config();
const db = require('../db');

async function setupDatabase() {
  try {
    console.log('🔧 Configurando base de datos...');

    // Crear tabla usuarios si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id_usuario SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        correo VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(50) DEFAULT 'usuario',
        estado VARCHAR(20) DEFAULT 'Activo',
        foto BYTEA,
        reset_password_token VARCHAR(255),
        reset_password_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla usuarios creada/verificada');

    // Crear tabla equipos si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS equipos (
        id_equipo SERIAL PRIMARY KEY,
        nombre VARCHAR(200) NOT NULL,
        clave VARCHAR(100) UNIQUE NOT NULL,
        categoria VARCHAR(100),
        ubicacion VARCHAR(200),
        condicion VARCHAR(50),
        peso DECIMAL(10,2),
        descripcion TEXT,
        precio_unitario DECIMAL(10,2),
        garantia VARCHAR(100),
        importe DECIMAL(10,2),
        stock INTEGER DEFAULT 1,
        venta BOOLEAN DEFAULT false,
        renta BOOLEAN DEFAULT true,
        imagen BYTEA,
        estado VARCHAR(50) DEFAULT 'Disponible',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla equipos creada/verificada');

    // Crear tabla clientes si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id_cliente SERIAL PRIMARY KEY,
        nombre VARCHAR(200) NOT NULL,
        rfc VARCHAR(20),
        correo VARCHAR(100),
        telefono VARCHAR(20),
        direccion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla clientes creada/verificada');

    // Crear tabla contratos si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS contratos (
        id_contrato SERIAL PRIMARY KEY,
        id_cliente INTEGER REFERENCES clientes(id_cliente),
        fecha_inicio DATE,
        fecha_fin DATE,
        estado VARCHAR(50) DEFAULT 'Activo',
        total DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla contratos creada/verificada');

    // Crear tabla facturas si no existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS facturas (
        id_factura SERIAL PRIMARY KEY,
        id_cliente INTEGER REFERENCES clientes(id_cliente),
        id_contrato INTEGER REFERENCES contratos(id_contrato),
        numero_factura VARCHAR(50) UNIQUE,
        fecha_emision DATE,
        subtotal DECIMAL(10,2),
        iva DECIMAL(10,2),
        total DECIMAL(10,2),
        estado VARCHAR(50) DEFAULT 'Pendiente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla facturas creada/verificada');

    // Insertar usuario de prueba si no existe
    const bcrypt = require('bcrypt');
    const { rows: existingUser } = await db.query('SELECT id_usuario FROM usuarios WHERE correo = $1', ['admin@scaffoldpro.com']);
    
    if (existingUser.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.query(`
        INSERT INTO usuarios (nombre, correo, password_hash, rol, estado)
        VALUES ($1, $2, $3, $4, $5)
      `, ['Administrador', 'admin@scaffoldpro.com', hashedPassword, 'Director General', 'Activo']);
      console.log('✅ Usuario de prueba creado (admin@scaffoldpro.com / admin123)');
    } else {
      console.log('✅ Usuario de prueba ya existe');
    }

    // Insertar algunos equipos de prueba si no existen
    const { rows: existingEquipos } = await db.query('SELECT id_equipo FROM equipos LIMIT 1');
    
    if (existingEquipos.length === 0) {
      await db.query(`
        INSERT INTO equipos (nombre, clave, categoria, ubicacion, condicion, peso, descripcion, precio_unitario, garantia, importe, stock, venta, renta, estado)
        VALUES 
        ('Marco 200', 'MAR-200-001', 'Andamio marco y cruceta', 'Bodega CDMX 68', 'Nuevo', 25.5, 'Marco de andamio estándar de 2 metros', 120.00, '12 meses', 1200.00, 10, true, true, 'Disponible'),
        ('Cruceta 200', 'CRU-200-001', 'Andamio marco y cruceta', 'Bodega CDMX 68', 'Nuevo', 15.2, 'Cruceta de refuerzo para marco 200', 85.00, '12 meses', 850.00, 15, true, true, 'Disponible'),
        ('Plataforma 200', 'PLA-200-001', 'Plataformas', 'Bodega Texcoco', 'Usado', 30.0, 'Plataforma de trabajo 2x1 metros', 200.00, '6 meses', 2000.00, 8, true, true, 'Disponible'),
        ('Escalera 3m', 'ESC-300-001', 'Escaleras', 'Bodega CDMX 68', 'Nuevo', 12.5, 'Escalera de aluminio 3 metros', 150.00, '12 meses', 1500.00, 5, true, true, 'Disponible')
      `);
      console.log('✅ Equipos de prueba creados');
    } else {
      console.log('✅ Equipos de prueba ya existen');
    }

    console.log('🎉 Base de datos configurada exitosamente');
    
  } catch (error) {
    console.error('❌ Error configurando base de datos:', error);
  } finally {
    process.exit();
  }
}

setupDatabase(); 