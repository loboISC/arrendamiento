-- Migración 20260603: Almacenamiento de UUID relacionado en facturas y notas de crédito
-- =====================================================================================
-- ESTADO: Solo correcciones en controladores (no hay cambios DDL nuevos).
-- Los campos YA EXISTEN en la base de datos:
--
--   facturas.uuid_relacionado     VARCHAR(36)   -- UUID de CFDI relacionado (sustitución / relación)
--   facturas.tipo_relacion        VARCHAR(2)    -- Clave SAT de tipo de relación (01, 02, etc.)
--   credit_notes.invoice_id       UUID          -- UUID de la factura origen relacionada
--   credit_note_relations         tabla         -- Relaciones muchos-a-muchos NC <-> facturas UUID
--
-- CAMBIOS EN CONTROLADOR (facturacion.js):
-- 1. timbrarFactura: INSERT y UPDATE de facturas ahora persisten uuid_relacionado y tipo_relacion
--    cuando se proporciona CfdiRelacionados en la petición.
-- 2. cancelarFactura: Acepta uuidSustitucion en el body. Si motivo='01', guarda
--    uuid_relacionado = uuidSustitucion y tipo_relacion = '01' en la factura cancelada.
-- 3. timbrarNotaCredito: El INSERT en credit_notes ahora incluye invoice_id (UUID de la factura
--    origen) y usa los nombres de columna correctos del esquema real (tax, reason, relation_type,
--    status, customer_id — no impuestos, motivo_sat, tipo_relacion, estado, id_cliente).
-- 4. Tras insertar la NC, también se registra en credit_note_relations para trazabilidad completa.
-- 5. obtenerNotasCredito / cancelarNotaCredito / aprobarNotaCredito: Corregidos nombres de
--    columnas (customer_id, status, updated_by, created_at).

-- Verificación de que los campos existen:
DO $$
BEGIN
    -- facturas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='facturas' AND column_name='uuid_relacionado') THEN
        ALTER TABLE facturas ADD COLUMN uuid_relacionado VARCHAR(36);
        RAISE NOTICE 'Columna uuid_relacionado agregada a facturas';
    ELSE
        RAISE NOTICE 'OK: facturas.uuid_relacionado ya existe';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='facturas' AND column_name='tipo_relacion') THEN
        ALTER TABLE facturas ADD COLUMN tipo_relacion VARCHAR(2);
        RAISE NOTICE 'Columna tipo_relacion agregada a facturas';
    ELSE
        RAISE NOTICE 'OK: facturas.tipo_relacion ya existe';
    END IF;

    -- credit_notes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='credit_notes' AND column_name='invoice_id') THEN
        ALTER TABLE credit_notes ADD COLUMN invoice_id UUID;
        RAISE NOTICE 'Columna invoice_id agregada a credit_notes';
    ELSE
        RAISE NOTICE 'OK: credit_notes.invoice_id ya existe';
    END IF;
END $$;
