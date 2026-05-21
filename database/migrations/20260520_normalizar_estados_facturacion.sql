-- Normaliza estados historicos de facturas y notas de credito.
-- Ejecutar una sola vez antes de usar el nuevo flujo.

UPDATE public.facturas
SET estado = CASE
    WHEN UPPER(COALESCE(estado, '')) LIKE 'CANCEL%' THEN 'CANCELADA'
    WHEN UPPER(COALESCE(estado, '')) LIKE 'PENDIENTE%' THEN 'PENDIENTE_PAGO'
    WHEN UPPER(COALESCE(estado, '')) IN ('EMITIDO', 'EMITIDA', 'FACTURADA', 'TIMBRADO', 'TIMBRADA') THEN 'TIMBRADA'
    WHEN COALESCE(estado, '') = '' THEN 'TIMBRADA'
    ELSE UPPER(estado)
END;

ALTER TABLE public.facturas
ALTER COLUMN estado SET DEFAULT 'TIMBRADA';

UPDATE public.credit_notes
SET estado = CASE
    WHEN UPPER(COALESCE(estado, '')) LIKE 'CANCEL%' THEN 'CANCELADA'
    WHEN UPPER(COALESCE(estado, '')) IN ('TIMBRADO', 'TIMBRADA') THEN 'TIMBRADA'
    WHEN UPPER(COALESCE(estado, '')) IN ('APROBADA') THEN 'APLICADA'
    WHEN COALESCE(estado, '') = '' THEN 'BORRADOR'
    ELSE UPPER(estado)
END;

ALTER TABLE public.credit_notes
ALTER COLUMN estado SET DEFAULT 'BORRADOR';
