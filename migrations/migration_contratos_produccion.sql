-- ============================================================
-- MIGRACIÓN: Tabla contratos → Producción
-- Fecha: 2026-04-21
-- Descripción: Agrega columnas faltantes en producción para
--              igualar el esquema con el entorno de desarrollo.
--
-- ✅ Seguro para ejecutar: usa ADD COLUMN IF NOT EXISTS
--    No afecta columnas que ya existan.
-- ============================================================

-- 1. Verificar columnas actuales ANTES de migrar (opcional/diagnóstico)
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'contratos'
-- ORDER BY ordinal_position;

-- ============================================================
-- COLUMNAS FALTANTES
-- ============================================================

-- Datos del usuario que creó el contrato
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS usuario_creacion CHARACTER VARYING(80);

-- Entidad federativa / Estado
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS estado_entidad CHARACTER VARYING(100) DEFAULT 'México';

-- PDFs generados
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS pdf_contrato CHARACTER VARYING(255);

ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS pdf_nota CHARACTER VARYING(255);

-- Descripción del equipo principal
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS equipo CHARACTER VARYING(255);

-- Días de renta pactados
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS dias_renta CHARACTER VARYING(100);

-- Contacto en obra
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS contacto_obra CHARACTER VARYING(200);

ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS telefono_obra CHARACTER VARYING(20);

ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS celular_obra CHARACTER VARYING(20);

-- Horarios de entrega / recolección
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS hora_inicio TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS hora_fin TIMESTAMP WITHOUT TIME ZONE;

-- Número de nota de entrega
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS numero_nota CHARACTER VARYING(50);

-- Precio por día (renta diaria)
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS precio_por_dia NUMERIC(15,2) DEFAULT 0;

-- Motivo de cancelación
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS "M_cancelado" TEXT;

-- Historial de prórrogas en JSON
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS historial_prorrogas JSONB DEFAULT '[]'::jsonb;

-- ⚠️ COLUMNAS CRÍTICAS — Estas son las que causan el error 500 en producción
-- Método de entrega (Sucursal / Domicilio)
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS metodo_entrega CHARACTER VARYING(50) DEFAULT 'Sucursal';

-- Estado logístico del contrato
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS estado_logistica CHARACTER VARYING(20) DEFAULT 'en_espera';

-- Tipo de logística (metropolitana / foranea)
ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS tipo_logistica CHARACTER VARYING(20) DEFAULT 'metropolitana';

-- ============================================================
-- ÍNDICES (igual que desarrollo)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_contratos_cliente
    ON public.contratos USING btree (id_cliente ASC NULLS LAST)
    WITH (fillfactor=100, deduplicate_items=True)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_contratos_estado
    ON public.contratos USING btree (estado ASC NULLS LAST)
    WITH (fillfactor=100, deduplicate_items=True)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_contratos_historial_prorrogas
    ON public.contratos USING gin (historial_prorrogas)
    WITH (fastupdate=True, gin_pending_list_limit=4194304)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_contratos_numero
    ON public.contratos USING btree (numero_contrato ASC NULLS LAST)
    WITH (fillfactor=100, deduplicate_items=True)
    TABLESPACE pg_default;

-- ============================================================
-- COMENTARIOS EN TABLA (documentación)
-- ============================================================

COMMENT ON TABLE public.contratos IS 'Tabla principal de contratos de renta de equipos';
COMMENT ON COLUMN public.contratos.numero_contrato IS 'Número único del contrato (ej: CT-2026-001)';
COMMENT ON COLUMN public.contratos.tipo_garantia IS 'Tipo de garantía (ej: PAGARE, DEPOSITO, etc)';
COMMENT ON COLUMN public.contratos.equipo IS 'Descripción del equipo principal del contrato';
COMMENT ON COLUMN public.contratos.dias_renta IS 'Días de renta pactados en el contrato';
COMMENT ON COLUMN public.contratos.contacto_obra IS 'Nombre de la persona que recibe en obra';
COMMENT ON COLUMN public.contratos.telefono_obra IS 'Teléfono de contacto en obra';
COMMENT ON COLUMN public.contratos.celular_obra IS 'Celular de contacto en obra';
COMMENT ON COLUMN public.contratos.historial_prorrogas IS 'Almacena el historial de extensiones y prórrogas del contrato en formato JSON';
COMMENT ON COLUMN public.contratos.metodo_entrega IS 'Método de entrega: Sucursal (cliente recoge) o domicilio (se entrega en obra)';
COMMENT ON COLUMN public.contratos.estado_logistica IS 'Estado actual en el flujo logístico: sucursal, en_espera, en_ruta, entregado';
COMMENT ON COLUMN public.contratos.tipo_logistica IS 'Clasificación geográfica de la entrega: metropolitana o foranea';

-- ============================================================
-- VERIFICACIÓN FINAL (ejecutar después para confirmar)
-- ============================================================
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'contratos'
-- ORDER BY ordinal_position;
