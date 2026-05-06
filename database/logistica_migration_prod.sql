-- SCRIPT DE MIGRACIÓN COMPLETO PARA MÓDULO DE LOGÍSTICA Y RH
-- Sistema SAPT - Andamios Torres
-- Fecha: 2026-05-05

-- 0. EXTENSIONES REQUERIDAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ──────────────────────────────────────────────────────────
-- 1. ESQUEMA DE RECURSOS HUMANOS (RH)
-- ──────────────────────────────────────────────────────────

-- 1.1 Catálogo de Departamentos
CREATE TABLE IF NOT EXISTS rh_departamentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    responsable VARCHAR(100),
    estatus VARCHAR(20) DEFAULT 'Activo'
);

-- 1.2 Catálogo de Puestos
CREATE TABLE IF NOT EXISTS rh_puestos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    departamento_id INT REFERENCES rh_departamentos(id) ON DELETE SET NULL,
    nivel VARCHAR(50), 
    sueldo_base_sugerido DECIMAL(12,2) DEFAULT 0,
    estatus VARCHAR(20) DEFAULT 'Activo'
);

-- 1.3 Catálogo de Turnos
CREATE TABLE IF NOT EXISTS rh_turnos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    entrada TIME NOT NULL,
    salida TIME NOT NULL,
    dias VARCHAR(50) DEFAULT 'L-V',
    tolerancia_minutos INT DEFAULT 10
);

-- 1.4 Tabla Maestra de Empleados
CREATE TABLE IF NOT EXISTS rh_empleados (
    id VARCHAR(20) PRIMARY KEY, -- ID de nómina (ej. 089)
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100),
    fecha_nac DATE,
    curp VARCHAR(18) UNIQUE,
    rfc VARCHAR(13) UNIQUE,
    puesto_id INT REFERENCES rh_puestos(id),
    turno_id INT REFERENCES rh_turnos(id),
    fecha_ingreso DATE,
    bio_id INT UNIQUE,
    estado VARCHAR(20) DEFAULT 'Activo',
    correo_empresa VARCHAR(100),
    celular_empresa VARCHAR(20),
    foto_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1.5 Información de Nómina
CREATE TABLE IF NOT EXISTS rh_empleados_nomina (
    empleado_id VARCHAR(20) PRIMARY KEY REFERENCES rh_empleados(id) ON DELETE CASCADE,
    nss VARCHAR(20),
    reg_patronal VARCHAR(50),
    tipo_prestaciones VARCHAR(50) DEFAULT 'DE LEY',
    salario_diario DECIMAL(12,2) DEFAULT 0,
    sdi DECIMAL(12,2) DEFAULT 0,
    nomina_asignada VARCHAR(50),
    tipo_contrato VARCHAR(50) DEFAULT 'INDETERMINADO'
);

-- 1.6 Detalles de Contacto
CREATE TABLE IF NOT EXISTS rh_empleados_detalles (
    empleado_id VARCHAR(20) PRIMARY KEY REFERENCES rh_empleados(id) ON DELETE CASCADE,
    telefono VARCHAR(20),
    direccion TEXT,
    tipo_sangre VARCHAR(5),
    contacto_emergencia TEXT
);

-- 1.7 Registro de Asistencias
CREATE TABLE IF NOT EXISTS rh_asistencia (
    id SERIAL PRIMARY KEY,
    empleado_id VARCHAR(20) REFERENCES rh_empleados(id),
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    tipo VARCHAR(20), 
    metodo VARCHAR(50) DEFAULT 'Biométrico',
    status VARCHAR(20) DEFAULT 'OK'
);

-- ──────────────────────────────────────────────────────────
-- 2. ESQUEMA DE VENTAS (DEPENDENCIAS DE LOGÍSTICA)
-- ──────────────────────────────────────────────────────────

-- 2.1 Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id_cliente SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    rfc VARCHAR(20),
    email VARCHAR(100),
    telefono VARCHAR(20),
    celular VARCHAR(20),
    direccion TEXT,
    codigo_postal VARCHAR(10),
    colonia VARCHAR(100),
    localidad VARCHAR(100),
    ciudad VARCHAR(100),
    estado_direccion VARCHAR(100),
    pais VARCHAR(50) DEFAULT 'MÉXICO',
    estado VARCHAR(50) DEFAULT 'Activo',
    contacto VARCHAR(255),
    empresa VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE COTIZACIONES
CREATE TABLE IF NOT EXISTS cotizaciones (
    id_cotizacion SERIAL PRIMARY KEY,
    numero_cotizacion VARCHAR(50) UNIQUE NOT NULL,
    id_cliente INTEGER REFERENCES clientes(id_cliente),
    tipo VARCHAR(20) DEFAULT 'RENTA', -- RENTA, VENTA
    fecha_cotizacion DATE DEFAULT CURRENT_DATE,
    subtotal DECIMAL(12,2) DEFAULT 0,
    iva DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    estado VARCHAR(50) DEFAULT 'Enviada',
    prioridad VARCHAR(20) DEFAULT 'Media',
    requiere_entrega BOOLEAN DEFAULT FALSE,
    direccion_entrega TEXT,
    contacto_nombre VARCHAR(255),
    entrega_calle VARCHAR(255),
    entrega_numero_ext VARCHAR(20),
    entrega_colonia VARCHAR(100),
    entrega_cp VARCHAR(10),
    entrega_municipio VARCHAR(100),
    entrega_estado VARCHAR(100),
    tipo_zona VARCHAR(50),
    latitud DECIMAL(10,8),
    longitud DECIMAL(11,8),
    productos_seleccionados JSONB,
    creado_por INTEGER,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA DE CONTRATOS
CREATE TABLE IF NOT EXISTS contratos (
    id_contrato SERIAL PRIMARY KEY,
    numero_contrato VARCHAR(50) UNIQUE NOT NULL,
    id_cliente INTEGER REFERENCES clientes(id_cliente),
    id_cotizacion INTEGER REFERENCES cotizaciones(id_cotizacion),
    tipo VARCHAR(50),
    estado VARCHAR(50) DEFAULT 'Activo',
    fecha_contrato DATE DEFAULT CURRENT_DATE,
    fecha_inicio DATE,
    fecha_fin DATE,
    total DECIMAL(12,2) DEFAULT 0,
    subtotal DECIMAL(12,2) DEFAULT 0,
    impuesto DECIMAL(12,2) DEFAULT 0,
    calle TEXT,
    numero_externo VARCHAR(20),
    colonia VARCHAR(100),
    codigo_postal VARCHAR(10),
    municipio VARCHAR(100),
    estado_entidad VARCHAR(100),
    latitud DECIMAL(10,8),
    longitud DECIMAL(11,8),
    metodo_entrega VARCHAR(50) DEFAULT 'Sucursal',
    estado_logistica VARCHAR(50) DEFAULT 'sucursal', -- en_espera, asignado, en_ruta, completado
    tipo_logistica VARCHAR(50) DEFAULT 'metropolitana',
    historial_prorrogas JSONB DEFAULT '[]'::jsonb,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.4 Items de Contrato
CREATE TABLE IF NOT EXISTS contrato_items (
    id_contrato_item SERIAL PRIMARY KEY,
    id_contrato INTEGER REFERENCES contratos(id_contrato) ON DELETE CASCADE,
    clave VARCHAR(50),
    descripcion TEXT,
    cantidad DECIMAL(10,2),
    total DECIMAL(12,2)
);

-- ──────────────────────────────────────────────────────────
-- 3. ESQUEMA DE LOGÍSTICA
-- ──────────────────────────────────────────────────────────

-- 3.1 Vehículos
CREATE TABLE IF NOT EXISTS vehiculos (
    id SERIAL PRIMARY KEY,
    economico VARCHAR(50) UNIQUE NOT NULL, 
    placa VARCHAR(20) UNIQUE NOT NULL,
    marca VARCHAR(50),
    modelo VARCHAR(50) NOT NULL,
    anio INTEGER NOT NULL,
    estatus VARCHAR(20) DEFAULT 'activo',
    tipo_vehiculo VARCHAR(30),
    capacidad_carga DECIMAL(10,2),
    kilometraje_inicial BIGINT DEFAULT 0,
    creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vista de compatibilidad
CREATE OR REPLACE VIEW logistica_vehiculos AS SELECT * FROM vehiculos;

-- 6. DOCUMENTOS DE VEHÍCULOS
CREATE TABLE IF NOT EXISTS documentos_vehiculo (
    id SERIAL PRIMARY KEY,
    vehiculo_id INTEGER REFERENCES vehiculos(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- seguro, verificacion, placa
    fecha_inicio DATE,
    fecha_fin DATE NOT NULL,
    estatus VARCHAR(20) DEFAULT 'vigente',
    folio VARCHAR(100),
    archivo_url VARCHAR(255),
    creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. MANTENIMIENTOS
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

-- 8. ASIGNACIONES LOGÍSTICAS (Actualizada)
CREATE TABLE IF NOT EXISTS logistica_asignaciones (
    id SERIAL PRIMARY KEY,
    vehiculo_id INTEGER REFERENCES vehiculos(id),
    chofer_id INTEGER, -- Referencia a usuarios(id_usuario)
    pedido_id INTEGER, -- id_contrato o id_cotizacion
    tipo_referencia VARCHAR(50), -- CONTRATO, COTIZACION
    tipo_movimiento VARCHAR(50) DEFAULT 'ENTREGA', -- ENTREGA, RECOLECCION, TRASLADO
    estado VARCHAR(20) DEFAULT 'en_espera', -- en_espera, en_ruta, completado, fallido, cancelado
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_inicio TIMESTAMP,
    fecha_fin TIMESTAMP,
    observaciones TEXT,
    motivo_incidencia VARCHAR(100),
    cliente_id INTEGER REFERENCES clientes(id_cliente)
);

-- 9. TRACKING GPS
CREATE TABLE IF NOT EXISTS logistica_tracking (
    id SERIAL PRIMARY KEY,
    asignacion_id INTEGER REFERENCES logistica_asignaciones(id) ON DELETE CASCADE,
    latitud DECIMAL(10,8) NOT NULL,
    longitud DECIMAL(11,8) NOT NULL,
    velocidad DECIMAL(5,2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. EVENTOS LOGÍSTICOS
CREATE TABLE IF NOT EXISTS logistica_eventos (
    id SERIAL PRIMARY KEY,
    tipo_evento VARCHAR(50) NOT NULL, -- proximidad, cambio_estado, incidencia
    id_referencia INTEGER, -- asignacion_id
    data_json JSONB,
    procesado BOOLEAN DEFAULT FALSE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. NODOS Y TRAMOS (Grafo para Dijkstra)
CREATE TABLE IF NOT EXISTS logistica_nodos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    latitud DECIMAL(10,8) NOT NULL,
    longitud DECIMAL(11,8) NOT NULL,
    creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logistica_tramos (
    id SERIAL PRIMARY KEY,
    nodo_origen_id INTEGER REFERENCES logistica_nodos(id) ON DELETE CASCADE,
    nodo_destino_id INTEGER REFERENCES logistica_nodos(id) ON DELETE CASCADE,
    distancia_km DECIMAL(10,3) NOT NULL,
    velocidad_promedio_kmh INTEGER DEFAULT 40,
    es_sentido_unico BOOLEAN DEFAULT FALSE,
    creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. TOKENS PARA SEGUIMIENTO PÚBLICO
CREATE TABLE IF NOT EXISTS seguimiento_tokens_publicos (
    id SERIAL PRIMARY KEY,
    asignacion_id INTEGER REFERENCES logistica_asignaciones(id) ON DELETE CASCADE,
    token_uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    cliente_email VARCHAR(100),
    cliente_telefono VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. SUSCRIPCIONES PUSH CLIENTE
CREATE TABLE IF NOT EXISTS cliente_push_subscriptions (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. ÍNDICES DE OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_asignaciones_pedido ON logistica_asignaciones(pedido_id, tipo_referencia);
CREATE INDEX IF NOT EXISTS idx_tracking_asignacion ON logistica_tracking(asignacion_id);
CREATE INDEX IF NOT EXISTS idx_tracking_timestamp ON logistica_tracking(timestamp);
CREATE INDEX IF NOT EXISTS idx_tokens_uuid ON seguimiento_tokens_publicos(token_uuid);
CREATE INDEX IF NOT EXISTS idx_nodos_coords ON logistica_nodos(latitud, longitud);
CREATE INDEX IF NOT EXISTS idx_vehiculos_estatus ON vehiculos(estatus);

-- 15. FIXES PARA TABLAS EXISTENTES (En caso de que ya existan en Producción)
DO $$ 
BEGIN 
    -- Agregar columnas a contratos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contratos' AND column_name='estado_logistica') THEN
        ALTER TABLE contratos ADD COLUMN estado_logistica VARCHAR(50) DEFAULT 'sucursal';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contratos' AND column_name='tipo_logistica') THEN
        ALTER TABLE contratos ADD COLUMN tipo_logistica VARCHAR(50) DEFAULT 'metropolitana';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contratos' AND column_name='latitud') THEN
        ALTER TABLE contratos ADD COLUMN latitud DECIMAL(10,8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contratos' AND column_name='longitud') THEN
        ALTER TABLE contratos ADD COLUMN longitud DECIMAL(11,8);
    END IF;

    -- Agregar columnas a logistica_asignaciones
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logistica_asignaciones' AND column_name='tipo_movimiento') THEN
        ALTER TABLE logistica_asignaciones ADD COLUMN tipo_movimiento VARCHAR(50) DEFAULT 'ENTREGA';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logistica_asignaciones' AND column_name='motivo_incidencia') THEN
        ALTER TABLE logistica_asignaciones ADD COLUMN motivo_incidencia VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='logistica_asignaciones' AND column_name='cliente_id') THEN
        ALTER TABLE logistica_asignaciones ADD COLUMN cliente_id INTEGER REFERENCES clientes(id_cliente);
    END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- 6. POBLACIÓN INICIAL DE CATÁLOGOS
-- ──────────────────────────────────────────────────────────

-- Departamentos
INSERT INTO rh_departamentos (nombre) VALUES 
('GENERAL'), ('OPERACIONES'), ('VENTAS'), ('ADMINISTRACION')
ON CONFLICT (nombre) DO NOTHING;

-- Puestos
INSERT INTO rh_puestos (nombre, departamento_id) VALUES 
('AYUDANTE GENERAL', (SELECT id FROM rh_departamentos WHERE nombre='OPERACIONES')),
('INGENIERO INDUSTRIAL', (SELECT id FROM rh_departamentos WHERE nombre='GENERAL')),
('CHOFER', (SELECT id FROM rh_departamentos WHERE nombre='OPERACIONES'))
ON CONFLICT DO NOTHING;

-- Turnos
INSERT INTO rh_turnos (nombre, entrada, salida, dias) VALUES 
('Matutino Estándar', '08:00:00', '18:00:00', 'L-V')
ON CONFLICT DO NOTHING;

-- Configuración Global RH
CREATE TABLE IF NOT EXISTS rh_config_global (
    id INT PRIMARY KEY DEFAULT 1,
    asistencia_tolerancia_min INT DEFAULT 10,
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO rh_config_global (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Choferes Reales (Datos actuales de producción/desarrollo)
INSERT INTO rh_empleados (id, nombre, apellidos, puesto_id, correo_empresa, celular_empresa, estado) 
VALUES 
('0005', 'VICTOR', 'MANUEL FIERROS GARCIA', (SELECT id FROM rh_puestos WHERE nombre = 'CHOFER' LIMIT 1), 'humbertare0214@outlook.com', '5524134274', 'Activo'),
('0010', 'ANTONIO', 'ORTIZ FUERTE', (SELECT id FROM rh_puestos WHERE nombre = 'CHOFER' LIMIT 1), 'antoniochofer28@gmail.com', '56 1057 4890', 'Activo')
ON CONFLICT (id) DO NOTHING;

-- Nodo Almacen Central
INSERT INTO logistica_nodos (nombre, latitud, longitud) 
SELECT 'Almacen Central', 19.432608, -99.133209
WHERE NOT EXISTS (SELECT 1 FROM logistica_nodos WHERE nombre = 'Almacen Central');
