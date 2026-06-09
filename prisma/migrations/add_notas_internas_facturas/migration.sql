-- AlterTable facturas: add notas_internas column
ALTER TABLE public.facturas
ADD COLUMN IF NOT EXISTS notas_internas TEXT DEFAULT '';
