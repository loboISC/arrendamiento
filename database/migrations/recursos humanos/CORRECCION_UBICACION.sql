-- =============================================================================
-- CORRECCIÓN DE UBICACIÓN: INGENIERÍA A PLANTA TEXCOCO
-- =============================================================================

DO $$ 
BEGIN
    -- 1. Renombrar las Madres para que sean más claras
    UPDATE rh_departamentos SET nombre = 'CORPORATIVO (CDMX)' WHERE id = 101;
    UPDATE rh_departamentos SET nombre = 'PLANTA (TEXCOCO)' WHERE id = 102;

    -- 2. Mover Ingeniería de Administrativos a Planta Texcoco
    UPDATE rh_departamentos SET padre_id = 102 WHERE nombre ILIKE 'INGENIERIA - %';
    
    -- 3. Asegurar que los departamentos de la Planta estén bajo la Madre 102
    UPDATE rh_departamentos SET padre_id = 102 WHERE nombre ILIKE 'PRODUCCION - %';

END $$;
