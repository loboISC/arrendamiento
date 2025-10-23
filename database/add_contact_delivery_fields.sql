-- MIGRACION: Agregar campos de entrega extendidos a tabla cotizaciones
-- Este script agrega los campos de entrega detallados

-- Verificar si los campos ya existen antes de agregarlos
DO $$
BEGIN
    -- ===== CAMPOS DE ENTREGA EXTENDIDOS =====
    
    -- Notas de entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='entrega_notas') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN entrega_notas text COLLATE pg_catalog."default";
    END IF;
    
    -- Calle de entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='entrega_calle') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN entrega_calle character varying(200) COLLATE pg_catalog."default";
    END IF;
    
    -- Número exterior de entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='entrega_numero_ext') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN entrega_numero_ext character varying(20) COLLATE pg_catalog."default";
    END IF;
    
    -- Número interior de entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='entrega_numero_int') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN entrega_numero_int character varying(20) COLLATE pg_catalog."default";
    END IF;
    
    -- Colonia de entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='entrega_colonia') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN entrega_colonia character varying(100) COLLATE pg_catalog."default";
    END IF;
    
    -- Código postal de entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='entrega_cp') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN entrega_cp character varying(10) COLLATE pg_catalog."default";
    END IF;
    
    -- Municipio de entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='entrega_municipio') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN entrega_municipio character varying(100) COLLATE pg_catalog."default";
    END IF;
    
    -- Estado de entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='entrega_estado') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN entrega_estado character varying(50) COLLATE pg_catalog."default";
    END IF;
    
    -- Referencia de entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='entrega_referencia') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN entrega_referencia text COLLATE pg_catalog."default";
    END IF;
    
    -- Kilómetros de entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='entrega_kilometros') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN entrega_kilometros numeric(10,2) DEFAULT 0;
    END IF;
    
    -- Tipo de zona (Metropolitana/Foránea/Rural)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='tipo_zona') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN tipo_zona character varying(20) COLLATE pg_catalog."default";
    END IF;

END $$;

-- Agregar constraints de validación
DO $$
BEGIN
    -- Check constraint para tipo_zona
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name='check_tipo_zona') THEN
        ALTER TABLE public.cotizaciones 
        ADD CONSTRAINT check_tipo_zona 
        CHECK (tipo_zona IN ('Metropolitana', 'Foránea', 'Rural') OR tipo_zona IS NULL);
    END IF;

END $$;

-- Crear índices para campos de búsqueda frecuente
CREATE INDEX IF NOT EXISTS idx_cotizaciones_entrega_estado
    ON public.cotizaciones USING btree (entrega_estado ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_tipo_zona
    ON public.cotizaciones USING btree (tipo_zona ASC NULLS LAST);

-- Comentarios para documentación
COMMENT ON COLUMN public.cotizaciones.entrega_notas IS 'Notas específicas para la entrega';
COMMENT ON COLUMN public.cotizaciones.entrega_referencia IS 'Referencias para localizar el lugar de entrega';
COMMENT ON COLUMN public.cotizaciones.entrega_kilometros IS 'Distancia en kilómetros para cálculo de envío';
COMMENT ON COLUMN public.cotizaciones.tipo_zona IS 'Tipo de zona para cálculo de envío: Metropolitana, Foránea, Rural';
