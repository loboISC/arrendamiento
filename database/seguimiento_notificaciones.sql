-- ============================================================================
-- TABLAS: Notificaciones del Cliente (SMS, Email, Push)
-- NOTA: Estas tablas requieren que exista la tabla 'clientes' con columna 'id_cliente'
-- ============================================================================

-- IMPORTANTE: Si recibe error de foreign key, ajuste cliente_id a la columna correcta en su tabla clientes
-- Opciones comunes: id_cliente, cliente_id, rut_cliente, etc.

-- Tabla para gestionar preferencias de notificación del cliente
CREATE TABLE IF NOT EXISTS cliente_notificaciones (
    id SERIAL PRIMARY KEY,
    cliente_id INT REFERENCES clientes(id_cliente) ON DELETE CASCADE,
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
    cliente_id INT REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh VARCHAR(150) NOT NULL,  -- Curva elíptica pública
    auth VARCHAR(150) NOT NULL,    -- Token HMAC
    user_agent TEXT,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de auditoría de notificaciones enviadas
CREATE TABLE IF NOT EXISTS notificaciones_historial (
    id SERIAL PRIMARY KEY,
    asignacion_id INT REFERENCES logistica_asignaciones(id) ON DELETE SET NULL,
    cliente_id INT REFERENCES clientes(id_cliente) ON DELETE SET NULL,
    tipo_notificacion VARCHAR(50),  -- 'sms', 'email', 'push'
    estado_evento VARCHAR(50),  -- 'en_preparacion', 'en_camino', etc.
    destinatario VARCHAR(255),  -- Número, email, o endpoint
    exitosa BOOLEAN,
    mensaje_error TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_cliente_notif ON cliente_notificaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_cliente ON cliente_push_subscriptions(cliente_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_activa ON cliente_push_subscriptions(activa);
CREATE INDEX IF NOT EXISTS idx_notif_historial_asig ON notificaciones_historial(asignacion_id);
CREATE INDEX IF NOT EXISTS idx_notif_historial_tipo ON notificaciones_historial(tipo_notificacion);
CREATE INDEX IF NOT EXISTS idx_notif_historial_fecha ON notificaciones_historial(sent_at);

COMMIT;
