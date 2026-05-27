-- Migración: Agregar columnas pdf_path y xml_path a credit_notes
-- Esto permite almacenar las rutas de los archivos PDF y XML generados al timbrar

ALTER TABLE public.credit_notes
ADD COLUMN IF NOT EXISTS pdf_path TEXT NULL,
ADD COLUMN IF NOT EXISTS xml_path TEXT NULL,
ADD COLUMN IF NOT EXISTS stamped_by INTEGER NULL;

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_credit_notes_pdf_path ON credit_notes(pdf_path);
CREATE INDEX IF NOT EXISTS idx_credit_notes_xml_path ON credit_notes(xml_path);
