-- Agregar soporte para coordenadas geograficas en pedidos
-- Esto permite que el algoritmo de Dijkstra funcione correctamente

-- En Contratos
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS latitud DECIMAL(10,8);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS longitud DECIMAL(11,8);

-- En Cotizaciones (Si no existe latitud/longitud como campos individuales)
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS latitud DECIMAL(10,8);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS longitud DECIMAL(11,8);

-- Actualizar cotizaciones si tienen coordenadas_entrega en formato "lat,lng"
-- Nota: Esto es un intento de parseo simple, puede variar segun el formato real
UPDATE cotizaciones 
SET 
    latitud = CAST(SPLIT_PART(coordenadas_entrega, ',', 1) AS DECIMAL),
    longitud = CAST(SPLIT_PART(coordenadas_entrega, ',', 2) AS DECIMAL)
WHERE coordenadas_entrega LIKE '%,%' AND latitud IS NULL;
