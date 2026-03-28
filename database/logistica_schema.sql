-- Script de creación de tablas para el módulo de Logística (RF1 Reforzado - FIX ENCODING)
-- Sistema SAPT - Andamios Torres

DROP TABLE IF EXISTS logistica_tracking CASCADE;
DROP TABLE IF EXISTS logistica_eventos CASCADE;
DROP TABLE IF EXISTS logistica_asignaciones CASCADE;
DROP TABLE IF EXISTS mantenimientos CASCADE;
DROP TABLE IF EXISTS documentos_vehiculo CASCADE;
DROP TABLE IF EXISTS vehiculos CASCADE;

-- 1. Tabla de Vehículos
CREATE TABLE IF NOT EXISTS vehiculos (
    id SERIAL PRIMARY KEY,
    economico VARCHAR(50) UNIQUE NOT NULL, 
    placa VARCHAR(20) UNIQUE NOT NULL,
    marca VARCHAR(50),
    modelo VARCHAR(50) NOT NULL,
    anio INTEGER NOT NULL, -- Cambiado de año a anio para evitar errores de codificación
    estatus VARCHAR(20) DEFAULT 'activo', -- activo, mantenimiento, baja
    tipo_vehiculo VARCHAR(30),
    capacidad_carga DECIMAL(10,2),
    kilometraje_inicial BIGINT DEFAULT 0,
    creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Documentos de Vehículos (RF1)
CREATE TABLE IF NOT EXISTS documentos_vehiculo (
    id SERIAL PRIMARY KEY,
    vehiculo_id INTEGER REFERENCES vehiculos(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- seguro, verificacion, placa
    fecha_inicio DATE,
    fecha_fin DATE NOT NULL,
    estatus VARCHAR(20) DEFAULT 'vigente', -- vigente, vencido, por_vencer
    folio VARCHAR(100),
    archivo_url VARCHAR(255),
    creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Mantenimientos
CREATE TABLE IF NOT EXISTS mantenimientos (
    id SERIAL PRIMARY KEY,
    vehiculo_id INTEGER REFERENCES vehiculos(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- preventivo, correctivo
    descripcion TEXT NOT NULL,
    costo DECIMAL(12,2) DEFAULT 0.00,
    fecha DATE NOT NULL,
    kilometraje BIGINT,
    creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabla de Asignaciones Logísticas (Se mantiene para RF3)
CREATE TABLE IF NOT EXISTS logistica_asignaciones (
    id SERIAL PRIMARY KEY,
    vehiculo_id INTEGER REFERENCES vehiculos(id),
    chofer_id INTEGER REFERENCES usuarios(id_usuario),
    pedido_id INTEGER,
    tipo_referencia VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'programada',
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_inicio TIMESTAMP,
    fecha_fin TIMESTAMP,
    observaciones TEXT
);

-- 5. Tabla de Tracking
CREATE TABLE IF NOT EXISTS logistica_tracking (
    id SERIAL PRIMARY KEY,
    asignacion_id INTEGER REFERENCES logistica_asignaciones(id) ON DELETE CASCADE,
    latitud DECIMAL(10,8) NOT NULL,
    longitud DECIMAL(11,8) NOT NULL,
    velocidad DECIMAL(5,2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabla de Eventos
CREATE TABLE IF NOT EXISTS logistica_eventos (
    id SERIAL PRIMARY KEY,
    tipo_evento VARCHAR(50) NOT NULL,
    id_referencia INTEGER,
    data_json JSONB,
    procesado BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_vehiculos_placa ON vehiculos(placa);
CREATE INDEX idx_docs_vencimiento ON documentos_vehiculo(fecha_fin);
CREATE INDEX idx_mantenimientos_vehiculo ON mantenimientos(vehiculo_id);



falta tabla logistica_tracking