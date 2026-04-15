-- ============================================================================
-- SCRIPT DE DIAGNÓSTICO - Verificar estructura de tabla clientes
-- Ejecuta esto primero para identificar el problema
-- ============================================================================

-- 1. Verificar si la tabla clientes existe
\dt clientes

-- 2. Ver estructura completa de la tabla clientes
\d clientes

-- 3. Listar todas las columnas de clientes
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'clientes' 
ORDER BY ordinal_position;

-- 4. Ver si hay primary keys en clientes
SELECT 
    a.attname as column_name,
    format_type(a.atttypid, a.atttypmod) as data_type,
    a.attnotnull as not_null
FROM pg_index i
JOIN pg_attribute a ON a.attrelid = i.indrelid
WHERE i.indisprimary 
  AND i.indrelid = 'clientes'::regclass
ORDER BY a.attnum;

-- 5. Ver todas las tablas que existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- RESULTADOS ESPERADOS:
-- ============================================================================
-- Si ves:
--   Column Name      | Data Type
--   ───────────────────────────
--   id               | integer
--   → ¡Ok! Usa: REFERENCES clientes(id)

-- Si ves:
--   Column Name      | Data Type
--   ───────────────────────────
--   id_cliente       | integer
--   → Cambia a: REFERENCES clientes(id_cliente)

-- Si ves:
--   Column Name      | Data Type
--   ───────────────────────────
--   cliente_id       | integer
--   → Cambia a: REFERENCES clientes(cliente_id)

-- ============================================================================
