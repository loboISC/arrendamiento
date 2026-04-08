-- ──────────────────────────────────────────────────────────
-- ESQUEMA DE RECURSOS HUMANOS (RH) - 3ra Forma Normal (3NF)
-- ──────────────────────────────────────────────────────────

-- 1. Catálogo de Departamentos
CREATE TABLE IF NOT EXISTS rh_departamentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    estatus VARCHAR(20) DEFAULT 'Activo'
);

-- 2. Catálogo de Puestos
CREATE TABLE IF NOT EXISTS rh_puestos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    departamento_id INT REFERENCES rh_departamentos(id) ON DELETE SET NULL,
    nivel VARCHAR(50), -- Operativo, Administrativo, Gerencial
    sueldo_base_sugerido DECIMAL(12,2) DEFAULT 0,
    estatus VARCHAR(20) DEFAULT 'Activo'
);

-- 3. Catálogo de Turnos
CREATE TABLE IF NOT EXISTS rh_turnos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    entrada TIME NOT NULL,
    salida TIME NOT NULL,
    dias VARCHAR(50) DEFAULT 'L-V',
    tolerancia_minutos INT DEFAULT 10
);

-- 4. Tabla Maestra de Empleados
CREATE TABLE IF NOT EXISTS rh_empleados (
    id VARCHAR(20) PRIMARY KEY, -- Usamos el ID del Excel como llave primaria (ej. 089, 102)
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100),
    fecha_nac DATE,
    curp VARCHAR(18) UNIQUE,
    rfc VARCHAR(13) UNIQUE,
    puesto_id INT REFERENCES rh_puestos(id),
    turno_id INT REFERENCES rh_turnos(id),
    fecha_ingreso DATE,
    bio_id INT UNIQUE, -- ID para el reloj biométrico
    estado VARCHAR(20) DEFAULT 'Activo', -- Activo, Baja, Inactivo
    foto_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Información de Nómina y Seguridad Social (1:1 con empleado)
CREATE TABLE IF NOT EXISTS rh_empleados_nomina (
    empleado_id VARCHAR(20) PRIMARY KEY REFERENCES rh_empleados(id) ON DELETE CASCADE,
    nss VARCHAR(20),
    reg_patronal VARCHAR(50),
    tipo_prestaciones VARCHAR(50) DEFAULT 'DE LEY',
    salario_diario DECIMAL(12,2) DEFAULT 0,
    sdi DECIMAL(12,2) DEFAULT 0, -- Salario Diario Integrado
    nomina_asignada VARCHAR(50), -- Quincenal, Semanal
    tipo_contrato VARCHAR(50) DEFAULT 'INDETERMINADO'
);

-- 6. Detalles de Contacto (1:1 con empleado)
CREATE TABLE IF NOT EXISTS rh_empleados_detalles (
    empleado_id VARCHAR(20) PRIMARY KEY REFERENCES rh_empleados(id) ON DELETE CASCADE,
    telefono VARCHAR(20),
    direccion TEXT,
    tipo_sangre VARCHAR(5),
    contacto_emergencia TEXT
);

-- 7. Registro de Asistencias
CREATE TABLE IF NOT EXISTS rh_asistencia (
    id SERIAL PRIMARY KEY,
    empleado_id VARCHAR(20) REFERENCES rh_empleados(id),
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    tipo VARCHAR(20), -- Entrada, Salida
    metodo VARCHAR(50) DEFAULT 'Biométrico', -- Biométrico, Manual
    status VARCHAR(20) DEFAULT 'OK' -- OK, Retardo, Falta, Justificado
);

-- 8. Solicitudes de Vacaciones y Permisos
CREATE TABLE IF NOT EXISTS rh_vacaciones_solicitudes (
    id SERIAL PRIMARY KEY,
    empleado_id VARCHAR(20) REFERENCES rh_empleados(id),
    tipo VARCHAR(50), -- Vacaciones, Permiso con goce, Médico, etc.
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias_solicitados INT,
    motivo TEXT,
    status VARCHAR(20) DEFAULT 'Pendiente', -- Pendiente, Aprobado, Rechazado
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8.1 Historial de Ajustes Manuales de Vacaciones
CREATE TABLE IF NOT EXISTS rh_vacaciones_ajustes (
    id SERIAL PRIMARY KEY,
    empleado_id VARCHAR(20) REFERENCES rh_empleados(id),
    cantidad INT NOT NULL, -- Ej: -6 para días ya tomados, +2 para bonos
    motivo TEXT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario VARCHAR(100) -- Quién hizo el ajuste
);

-- 9. Registro de Incidencias
CREATE TABLE IF NOT EXISTS rh_incidencias (
    id SERIAL PRIMARY KEY,
    empleado_id VARCHAR(20) REFERENCES rh_empleados(id),
    tipo VARCHAR(50), -- Retardo, Falta, Amonestación, Incapacidad
    fecha DATE NOT NULL,
    comentarios TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Configuración Global de RH
CREATE TABLE IF NOT EXISTS rh_config_global (
    id INT PRIMARY KEY DEFAULT 1,
    asistencia_tolerancia_min INT DEFAULT 10,
    asistencia_umbral_retardo_min INT DEFAULT 15,
    asistencia_entrada_std TIME DEFAULT '08:00',
    asistencia_salida_std TIME DEFAULT '18:00',
    vacaciones_dias_base INT DEFAULT 12,
    vacaciones_max_seguidos INT DEFAULT 10,
    vacaciones_anticipacion_dias INT DEFAULT 15,
    vacaciones_permitir_acumular BOOLEAN DEFAULT TRUE,
    -- Configuración Biométrico (ZKTeco)
    bio_ip VARCHAR(50) DEFAULT '192.168.100.24',
    bio_port INT DEFAULT 4370,
    bio_key VARCHAR(50) DEFAULT '1',
    bio_device_id INT DEFAULT 2,
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Poblar configuración inicial si no existe
INSERT INTO rh_config_global (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 11. Historial de Auditoría (RH)
CREATE TABLE IF NOT EXISTS rh_auditoria (
    id SERIAL PRIMARY KEY,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario VARCHAR(100),
    accion TEXT,
    modulo VARCHAR(50) DEFAULT 'Configuración'
);

-- ──────────────────────────────────────────────────────────
-- POBLACIÓN INICIAL DE CATÁLOGOS (Basado en tu Excel)
-- ──────────────────────────────────────────────────────────

INSERT INTO rh_departamentos (nombre) VALUES ('GENERAL'), ('OPERACIONES'), ('VENTAS'), ('ADMINISTRACION')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO rh_puestos (nombre, departamento_id) VALUES 
('AYUDANTE GENERAL', (SELECT id FROM rh_departamentos WHERE nombre='GENERAL')),
('INGENIERO INDUSTRIAL', (SELECT id FROM rh_departamentos WHERE nombre='GENERAL')),
('CHOFER', (SELECT id FROM rh_departamentos WHERE nombre='GENERAL'))
ON CONFLICT DO NOTHING;

INSERT INTO rh_turnos (nombre, entrada, salida, dias) VALUES 
('Matutino Estándar', '08:00:00', '18:00:00', 'L-V')
ON CONFLICT DO NOTHING;
