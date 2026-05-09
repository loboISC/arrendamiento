-- =============================================
-- MASTER_RH_SCHEMA_FINAL.sql
-- Esquema consolidado para Recursos Humanos
-- Incluye: Jerarquías, Nómina, Detalles y Asistencia
-- =============================================

-- 1. DEPARTAMENTOS (Jerárquicos)
CREATE TABLE IF NOT EXISTS rh_departamentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    responsable VARCHAR(150),
    padre_id INTEGER REFERENCES rh_departamentos(id) ON DELETE SET NULL,
    estatus VARCHAR(20) DEFAULT 'Activo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. PUESTOS
CREATE TABLE IF NOT EXISTS rh_puestos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    departamento_id INTEGER REFERENCES rh_departamentos(id) ON DELETE CASCADE,
    sueldo_base NUMERIC(12,2) DEFAULT 0,
    estatus VARCHAR(20) DEFAULT 'Activo'
);

-- 3. TURNOS
CREATE TABLE IF NOT EXISTS rh_turnos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    hora_entrada TIME NOT NULL,
    hora_salida TIME NOT NULL,
    tolerancia_minutos INTEGER DEFAULT 15
);

-- 4. EMPLEADOS (Núcleo)
CREATE TABLE IF NOT EXISTS rh_empleados (
    id VARCHAR(20) PRIMARY KEY, -- ID Manual/Auto-generado (ej: 0023)
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100),
    fecha_nac DATE,
    curp VARCHAR(18) UNIQUE,
    rfc VARCHAR(13) UNIQUE,
    puesto_id INTEGER REFERENCES rh_puestos(id),
    turno_id INTEGER REFERENCES rh_turnos(id),
    fecha_ingreso DATE,
    bio_id INTEGER, -- ID del biométrico
    estado VARCHAR(20) DEFAULT 'Activo', -- Activo, Inactivo, Baja
    foto_url TEXT,
    correo_empresa VARCHAR(150),
    celular_empresa VARCHAR(20),
    tipo_empleado VARCHAR(50) DEFAULT 'PLANTA', -- PLANTA, RESIDENTE, EXTERNO, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. DETALLES DE EMPLEADOS (Expediente Físico)
CREATE TABLE IF NOT EXISTS rh_empleados_detalles (
    empleado_id VARCHAR(20) PRIMARY KEY REFERENCES rh_empleados(id) ON DELETE CASCADE,
    telefono VARCHAR(20),
    direccion TEXT,
    tipo_sangre VARCHAR(10),
    contacto_emergencia TEXT
);

-- 6. NÓMINA Y SEGURIDAD SOCIAL
CREATE TABLE IF NOT EXISTS rh_empleados_nomina (
    empleado_id VARCHAR(20) PRIMARY KEY REFERENCES rh_empleados(id) ON DELETE CASCADE,
    nss VARCHAR(20),
    reg_patronal VARCHAR(50),
    tipo_prestaciones VARCHAR(50) DEFAULT 'DE LEY',
    salario_diario NUMERIC(12,2) DEFAULT 0,
    sdi NUMERIC(12,2) DEFAULT 0,
    nomina_asignada VARCHAR(50) DEFAULT 'NOMINA QUINCENAL',
    tipo_contrato VARCHAR(50) DEFAULT 'INDETERMINADO',
    num_nomina VARCHAR(20) -- Número interno de nómina si difiere del ID
);

-- 7. ASISTENCIA
CREATE TABLE IF NOT EXISTS rh_asistencia (
    id SERIAL PRIMARY KEY,
    empleado_id VARCHAR(20) REFERENCES rh_empleados(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    tipo VARCHAR(20), -- ENTRADA, SALIDA
    dispositivo VARCHAR(50),
    metodo VARCHAR(20), -- HUELLA, ROSTRO, MANUAL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(empleado_id, fecha, hora, tipo)
);

-- 8. VACACIONES Y AJUSTES
CREATE TABLE IF NOT EXISTS rh_vacaciones (
    id SERIAL PRIMARY KEY,
    empleado_id VARCHAR(20) REFERENCES rh_empleados(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    dias_solicitados INTEGER NOT NULL,
    estado VARCHAR(20) DEFAULT 'Pendiente', -- Pendiente, Aprobado, Rechazado
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. AUDITORÍA DE CONFIGURACIÓN (Opcional pero recomendado)
CREATE TABLE IF NOT EXISTS rh_config_auditoria (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(100),
    accion TEXT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- VISTA DE ORGANIGRAMA (Para reportes)
-- =============================================
CREATE OR REPLACE VIEW v_rh_organigrama AS
SELECT 
    d.id as depto_id,
    d.nombre as depto_nombre,
    p.nombre as depto_padre,
    d.responsable,
    (SELECT COUNT(*) FROM rh_empleados e 
     JOIN rh_puestos ps ON e.puesto_id = ps.id 
     WHERE ps.departamento_id = d.id AND e.estado = 'Activo') as total_empleados
-- =============================================
-- DATOS INICIALES (SEMILLA)
-- =============================================
INSERT INTO rh_departamentos (id, nombre, responsable, padre_id, estatus) 
VALUES 
    (101, 'CORPORATIVO (CDMX)', 'DIRECCIÓN GENERAL', NULL, 'Activo'),
    (102, 'PLANTA (TEXCOCO)', 'GERENCIA DE PLANTA', NULL, 'Activo')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- TRABAJADORES EXTERNOS (INCORPORACIÓN 2026)
-- =============================================
INSERT INTO rh_empleados (id, nombre, apellidos, fecha_nac, curp, rfc, fecha_ingreso, estado, tipo_empleado, puesto_id)
VALUES
    ('EXT-001', 'YUMKAX SANTIAGO', 'CANDELAS HERNANDEZ', NULL, NULL, NULL, '2024-02-20', 'Activo', 'EXTERNO', (SELECT id FROM rh_puestos WHERE nombre = 'SEGURIDAD' LIMIT 1)),
    ('EXT-002', 'ABRAHAM', 'MENDEZ HERNANDEZ', '1993-01-27', 'MEHA930127HDFNRB08', 'MEHA930127T18', NULL, 'Activo', 'EXTERNO', (SELECT id FROM rh_puestos WHERE nombre = 'AYUDANTE GENERAL' LIMIT 1)),
    ('EXT-003', 'CARLOS', 'GOMEZ MORA', '1987-08-19', 'GOMC870819HMCMRR05', 'GOMC8708196H5', '2025-09-01', 'Activo', 'EXTERNO', (SELECT id FROM rh_puestos WHERE nombre = 'AYUDANTE GENERAL' LIMIT 1)),
    ('EXT-004', 'JOSE MIGUEL', 'HERNANDEZ HERNANDEZ', '1998-05-24', 'HEHM980524HDFRRS01', 'HEHM980524D12', '2025-05-15', 'Activo', 'EXTERNO', (SELECT id FROM rh_puestos WHERE nombre = 'AYUDANTE GENERAL' LIMIT 1)),
    ('EXT-005', 'EDUARDO', 'SANTOS LUNA', '1988-10-13', 'SALE881013HDFNND00', 'SALE8810134F1', '2025-06-10', 'Activo', 'EXTERNO', (SELECT id FROM rh_puestos WHERE nombre = 'LIMPIEZA' LIMIT 1)),
    ('EXT-006', 'DANIELA', 'SANCHEZ LOPEZ', '1995-12-05', 'SALD951205MDFNCR09', 'SALD951205G21', '2025-08-20', 'Activo', 'EXTERNO', (SELECT id FROM rh_puestos WHERE nombre = 'LIMPIEZA' LIMIT 1))
ON CONFLICT (id) DO NOTHING;

-- Reiniciar el serial final
SELECT setval('rh_departamentos_id_seq', COALESCE((SELECT MAX(id) FROM rh_departamentos), 1));
