-- =============================================================================
-- SCRIPT PARA IMPLEMENTAR JERARQUÍA DE DEPARTAMENTOS (MADRE-HIJO)
-- =============================================================================

DO $$ 
BEGIN
    -- 1. Agregar la columna padre_id si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rh_departamentos' AND column_name = 'padre_id') THEN
        ALTER TABLE rh_departamentos ADD COLUMN padre_id INTEGER REFERENCES rh_departamentos(id);
    END IF;

    -- 2. Crear los "Departamentos Madre" (IDs 100+)
    INSERT INTO rh_departamentos (id, nombre, estatus) VALUES 
    (101, 'ADMINISTRATIVOS', 'Activo'),
    (102, 'PRODUCCION', 'Activo'),
    (103, 'SERVICIOS', 'Activo')
    ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre;

    -- 3. Vincular los departamentos existentes a sus Madres
    -- Administrativos
    UPDATE rh_departamentos SET padre_id = 101 WHERE nombre ILIKE 'ADMIN - %';
    UPDATE rh_departamentos SET padre_id = 101 WHERE nombre ILIKE 'INGENIERIA - %';
    
    -- Producción
    UPDATE rh_departamentos SET padre_id = 102 WHERE nombre ILIKE 'PRODUCCION - %';
    
    -- Servicios
    UPDATE rh_departamentos SET padre_id = 103 WHERE nombre ILIKE 'SERVICIOS - %';

END $$;
