-- ============================================================================
-- TABLAS: Notificaciones del Cliente (VERSIÓN SIMPLE SIN FOREIGN KEYS)
-- Usa esta versión si tienes errores de columna "id" no existe
-- ============================================================================

-- Tabla para gestionar preferencias de notificación del cliente
CREATE TABLE IF NOT EXISTS cliente_notificaciones (
    id SERIAL PRIMARY KEY,
    cliente_id INT,  -- Sin constraint para evitar errores de columna no existente
    email VARCHAR(255),
    telefono VARCHAR(20),
    preferencia_sms BOOLEAN DEFAULT true,
    preferencia_email BOOLEAN DEFAULT true,
    preferencia_push BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cliente_id)
);

-- Tabla para almacenar suscripciones WebPush del navegador
CREATE TABLE IF NOT EXISTS cliente_push_subscriptions (
    id SERIAL PRIMARY KEY,
    cliente_id INT,  -- Sin constraint para evitar errores
    endpoint TEXT UNIQUE NOT NULL,
    p256dh VARCHAR(150) NOT NULL,
    auth VARCHAR(150) NOT NULL,
    user_agent TEXT,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de auditoría de notificaciones enviadas
CREATE TABLE IF NOT EXISTS notificaciones_historial (
    id SERIAL PRIMARY KEY,
    asignacion_id INT,  -- Sin constraint para evitar errores
    cliente_id INT,     -- Sin constraint para evitar errores
    tipo_notificacion VARCHAR(50),
    estado_evento VARCHAR(50),
    destinatario VARCHAR(255),
    exitosa BOOLEAN,
    mensaje_error TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_cliente_notif ON cliente_notificaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_cliente ON cliente_push_subscriptions(cliente_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_activa ON cliente_push_subscriptions(activa);
CREATE INDEX IF NOT EXISTS idx_notif_historial_asig ON notificaciones_historial(asignacion_id);
CREATE INDEX IF NOT EXISTS idx_notif_historial_cliente ON notificaciones_historial(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notif_historial_tipo ON notificaciones_historial(tipo_notificacion);
CREATE INDEX IF NOT EXISTS idx_notif_historial_fecha ON notificaciones_historial(sent_at);

COMMIT;
