-- ============================================================================
-- TABLA: seguimiento_eventos
-- Módulo de Logística - Seguimiento y Rastreo de Asignaciones
-- Sistema SAPT - Andamios Torres
-- 
-- Propósito: Registrar cada cambio de estado en las asignaciones logísticas
-- con timestamp exacto para calcular tiempos entre estados
-- ============================================================================

DROP TABLE IF EXISTS seguimiento_eventos CASCADE;

CREATE TABLE IF NOT EXISTS seguimiento_eventos (
    id SERIAL PRIMARY KEY,
    asignacion_id INTEGER NOT NULL REFERENCES logistica_asignaciones(id) ON DELETE CASCADE,
    estado VARCHAR(50) NOT NULL,                          -- en_preparacion, en_ruta, llegada, en_entrega, completado, fallido
    descripcion TEXT NOT NULL,                            -- Descripción legible del evento
    ubicacion VARCHAR(255),                               -- Ubicación del evento (opcional)
    metadata JSONB DEFAULT NULL,                          -- Datos adicionales (coordenadas, temperatura, etc)
    creado_por VARCHAR(20) REFERENCES rh_empleados(id) DEFAULT NULL,  -- Referencia a rh_empleados que usa VARCHAR(20)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimización
CREATE INDEX idx_seguimiento_asignacion ON seguimiento_eventos(asignacion_id);
CREATE INDEX idx_seguimiento_estado ON seguimiento_eventos(estado);
CREATE INDEX idx_seguimiento_fecha ON seguimiento_eventos(created_at);
CREATE INDEX idx_seguimiento_asignacion_fecha ON seguimiento_eventos(asignacion_id, created_at);

-- ============================================================================
-- DATOS DE EJEMPLO - Seguimiento de Andamio Torre
-- ============================================================================

-- Escenario: Arrendamiento de andamio torre en sitio de construcción
INSERT INTO seguimiento_eventos (asignacion_id, estado, descripcion, ubicacion, metadata, created_at) 
VALUES
    -- Evento 1: Preparación en bodega
    (1, 'en_preparacion', 
     'Andamio torre verificado y asegurado en bodega principal', 
     'Bodega Andamios Torres - Centro',
     '{"verificacion": "seguridad OK", "equipo_id": "AND-2026-001", "altura": "15m", "peso": "2.5 ton"}',
     '2026-05-01 09:36:00'),
    
    -- Evento 2: En ruta hacia obra
    (1, 'en_ruta', 
     'Vehículo de carga salió de bodega rumbo a sitio de obra', 
     'Carretera Central',
     '{"conductor": "Juan Pérez", "economico": "LOG-2026", "temperatura_bodega": "25°C"}',
     '2026-05-04 14:21:00'),
    
    -- Evento 3: En viaje - llegada a obra
    (1, 'llegada', 
     'Equipo llegó al sitio de construcción, iniciando descarga', 
     'Obra: Edificio Comercial Centro - Calle 5 #123',
     '{"gps_lat": 19.4326, "gps_lon": -99.1332, "horario_descarga": "15:33", "supervisor_obra": "Carlos García"}',
     '2026-05-04 15:33:00'),
    
    -- Evento 4: En entrega - Instalación
    (1, 'en_entrega', 
     'Personal técnico instalando andamio torre en obra', 
     'Obra: Edificio Comercial Centro - Nivel 3',
     '{"personal": "2 técnicos", "duracion_estimada": "4 horas", "certificacion": "OSHA"}',
     '2026-05-04 16:00:00'),
    
    -- Evento 5: Completado - Instalación exitosa
    (1, 'completado', 
     'Andamio torre instalado correctamente. Cliente ha recibido equipo e instrucciones de seguridad', 
     'Obra: Edificio Comercial Centro - Nivel 3',
     '{"firma_cliente": "recibido", "fecha_fin_arrendamiento": "2026-06-04", "condiciones": "bueno", "foto_evidencia": "https://..."}',
     '2026-05-04 19:45:00');

-- ============================================================================
-- VISTA PARA OBTENER SEGUIMIENTO CON DURACIONES CALCULADAS
-- ============================================================================

CREATE OR REPLACE VIEW vw_seguimiento_con_duraciones AS
SELECT 
    se.id,
    se.asignacion_id,
    se.estado,
    se.descripcion,
    se.ubicacion,
    se.created_at as fecha_evento,
    -- Calcular duración desde evento anterior
    CASE 
        WHEN LAG(se.created_at) OVER (PARTITION BY se.asignacion_id ORDER BY se.created_at) IS NOT NULL
        THEN EXTRACT(EPOCH FROM (se.created_at - LAG(se.created_at) OVER (PARTITION BY se.asignacion_id ORDER BY se.created_at))) / 60
        ELSE 0
    END as minutos_desde_anterior,
    -- Estado anterior
    LAG(se.estado) OVER (PARTITION BY se.asignacion_id ORDER BY se.created_at) as estado_anterior,
    -- Descripción anterior
    LAG(se.descripcion) OVER (PARTITION BY se.asignacion_id ORDER BY se.created_at) as descripcion_anterior
FROM seguimiento_eventos se;

-- ============================================================================
-- QUERY AUXILIAR PARA OBTENER EL SEGUIMIENTO COMPLETO DE UNA ASIGNACIÓN
-- ============================================================================
-- SELECT * FROM vw_seguimiento_con_duraciones WHERE asignacion_id = 1 ORDER BY fecha_evento;
