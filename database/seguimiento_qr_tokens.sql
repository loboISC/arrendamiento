-- ============================================================================
-- TABLA: seguimiento_tokens_publicos
-- Permite generar links públicos para compartir en WhatsApp sin autenticación
-- ============================================================================

CREATE TABLE IF NOT EXISTS seguimiento_tokens_publicos (
    id SERIAL PRIMARY KEY,
    asignacion_id INT NOT NULL REFERENCES logistica_asignaciones(id) ON DELETE CASCADE,
    token_uuid VARCHAR(36) UNIQUE NOT NULL,
    cliente_email VARCHAR(255),
    cliente_telefono VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days',
    used_count INT DEFAULT 0,
    ultima_consulta TIMESTAMP,
    activo BOOLEAN DEFAULT true
);

-- Índices para optimizar búsquedas
CREATE INDEX idx_token_uuid ON seguimiento_tokens_publicos(token_uuid);
CREATE INDEX idx_asignacion_id_token ON seguimiento_tokens_publicos(asignacion_id);
CREATE INDEX idx_token_expires ON seguimiento_tokens_publicos(expires_at);

-- Vista para verificar tokens válidos
CREATE OR REPLACE VIEW vw_tokens_publicos_validos AS
SELECT *
FROM seguimiento_tokens_publicos
WHERE activo = true
  AND expires_at > CURRENT_TIMESTAMP;

-- Tabla para auditoría de accesos públicos
CREATE TABLE IF NOT EXISTS seguimiento_accesos_publicos (
    id SERIAL PRIMARY KEY,
    token_id INT REFERENCES seguimiento_tokens_publicos(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para auditoría
CREATE INDEX idx_acceso_token ON seguimiento_accesos_publicos(token_id);
CREATE INDEX idx_acceso_fecha ON seguimiento_accesos_publicos(accessed_at);

COMMIT;
