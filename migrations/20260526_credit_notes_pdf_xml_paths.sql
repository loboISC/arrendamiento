-- Migración: 20260526_credit_notes_pdf_xml_paths.sql
-- Agrega columnas pdf_path y xml_path a la tabla credit_notes
-- para almacenar las rutas relativas de archivos generados al timbrar.

ALTER TABLE credit_notes
  ADD COLUMN IF NOT EXISTS pdf_path TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS xml_path TEXT DEFAULT NULL;

COMMENT ON COLUMN credit_notes.pdf_path IS 'Ruta relativa del PDF generado al timbrar (dentro del directorio de almacenamiento)';
COMMENT ON COLUMN credit_notes.xml_path IS 'Ruta relativa del XML timbrado descargado del PAC (dentro del directorio de almacenamiento)';
