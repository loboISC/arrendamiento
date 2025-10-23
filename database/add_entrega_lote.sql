-- MIGRACIÓN: Agregar campo entrega_lote a tabla cotizaciones
-- Solo agregamos el campo de lote, los datos de contacto se obtienen del cliente

DO $$
BEGIN
    -- Campo de lote para entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='entrega_lote') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN entrega_lote character varying(50) COLLATE pg_catalog."default";
        COMMENT ON COLUMN public.cotizaciones.entrega_lote IS 'Número de lote para la dirección de entrega';
    END IF;

END $$;

-- Crear índice para búsquedas por lote
CREATE INDEX IF NOT EXISTS idx_cotizaciones_entrega_lote
    ON public.cotizaciones USING btree (entrega_lote COLLATE pg_catalog."default" ASC NULLS LAST);
