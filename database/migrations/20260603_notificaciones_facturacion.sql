-- Migración 20260603: Extender tabla notificaciones para módulo de facturación
-- =============================================================================
-- Agrega columnas para rastrear: módulo, referencia, responsable y metadata

ALTER TABLE notificaciones
  ADD COLUMN IF NOT EXISTS modulo         VARCHAR(40),
  ADD COLUMN IF NOT EXISTS referencia_tipo VARCHAR(40),
  ADD COLUMN IF NOT EXISTS referencia_id   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS id_usuario_accion INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata        JSONB;

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_notif_modulo ON notificaciones(modulo);
CREATE INDEX IF NOT EXISTS idx_notif_fecha  ON notificaciones(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_notif_leida  ON notificaciones(leida) WHERE leida = false;
