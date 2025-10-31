-- Agregar campos condiciones y accesorios_seleccionados a la tabla cotizaciones
-- Fecha: 2025-10-31

-- Agregar campo condiciones (texto para términos y condiciones)
ALTER TABLE public.cotizaciones 
ADD COLUMN IF NOT EXISTS condiciones TEXT;

-- Agregar campo accesorios_seleccionados (JSON para accesorios)
ALTER TABLE public.cotizaciones 
ADD COLUMN IF NOT EXISTS accesorios_seleccionados JSONB DEFAULT '[]'::jsonb;

-- Comentarios
COMMENT ON COLUMN public.cotizaciones.condiciones 
IS 'Términos y condiciones de la cotización (pago, entrega, vigencia, etc.)';

COMMENT ON COLUMN public.cotizaciones.accesorios_seleccionados 
IS 'Array JSON con los accesorios seleccionados en la cotización';

-- Verificar que se agregaron correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cotizaciones' 
AND column_name IN ('condiciones', 'accesorios_seleccionados');
