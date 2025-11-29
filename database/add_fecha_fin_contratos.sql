-- Migración: Agregar campo fecha_fin a la tabla contratos

-- Agregar columna fecha_fin si no existe
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS fecha_fin date;

-- Crear índice para búsquedas por fecha fin
CREATE INDEX IF NOT EXISTS idx_contratos_fecha_fin ON public.contratos(fecha_fin);

-- Comentario descriptivo
COMMENT ON COLUMN public.contratos.fecha_fin IS 'Fecha de terminación del contrato de renta';
