-- =====================================================
-- MIGRACIÓN: Sistema de Encuestas de Satisfacción
-- Fecha: 2025-01-27
-- Descripción: Crear tablas para manejar encuestas de satisfacción
-- =====================================================

-- 1. Tabla para almacenar las encuestas enviadas servicio general
CREATE TABLE IF NOT EXISTS public.encuestas_satisfaccionSG (
    id_encuesta SERIAL PRIMARY KEY,
    id_cliente INTEGER REFERENCES public.clientes(id_cliente) ON DELETE CASCADE,
    id_proyecto INTEGER, -- Referencia opcional a proyecto/contrato
    url_encuesta TEXT NOT NULL,
    fecha_envio TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento DATE,
    estado VARCHAR(20) DEFAULT 'enviada' CHECK (estado IN ('enviada', 'respondida', 'vencida', 'cancelada')),
    enviada_por INTEGER, -- ID del usuario que envió la encuesta
    metodo_envio VARCHAR(20) CHECK (metodo_envio IN ('email', 'whatsapp', 'link', 'presencial')),
    email_cliente VARCHAR(120),
    telefono_cliente VARCHAR(30),
    notas TEXT,
    fecha_creacion TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla para almacenar las respuestas de las encuestas servicio general
CREATE TABLE IF NOT EXISTS public.respuestas_encuestaSG (
    id_respuesta SERIAL PRIMARY KEY,
    id_encuesta INTEGER REFERENCES public.encuestas_satisfaccionSG(id_encuesta) ON DELETE CASCADE,
    nombre_cliente VARCHAR(120),
    email_cliente VARCHAR(120),
    fecha_respuesta TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Preguntas de la encuesta (1-5)
    q1_atencion_ventas VARCHAR(20) CHECK (q1_atencion_ventas IN ('molesto', 'no-satisfecho', 'satisfecho', 'muy-satisfecho')),
    q2_calidad_productos VARCHAR(20) CHECK (q2_calidad_productos IN ('molesto', 'no-satisfecho', 'satisfecho', 'muy-satisfecho')),
    q3_tiempo_entrega VARCHAR(20) CHECK (q3_tiempo_entrega IN ('molesto', 'no-satisfecho', 'satisfecho', 'muy-satisfecho')),
    q4_servicio_logistica VARCHAR(20) CHECK (q4_servicio_logistica IN ('molesto', 'no-satisfecho', 'satisfecho', 'muy-satisfecho')),
    q5_experiencia_compra VARCHAR(20) CHECK (q5_experiencia_compra IN ('molesto', 'no-satisfecho', 'satisfecho', 'muy-satisfecho')),
    
    -- Campos adicionales
    sugerencias TEXT,
    puntuacion_total DECIMAL(3,2), -- Promedio de todas las respuestas (1-4)
    ip_address INET,
    user_agent TEXT,
    fecha_creacion TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_encuestas_cliente ON public.encuestas_satisfaccionSG(id_cliente);
CREATE INDEX IF NOT EXISTS idx_encuestas_estado ON public.encuestas_satisfaccionSG(estado);
CREATE INDEX IF NOT EXISTS idx_encuestas_fecha_envio ON public.encuestas_satisfaccionSG(fecha_envio);
CREATE INDEX IF NOT EXISTS idx_respuestas_encuesta ON public.respuestas_encuestaSG(id_encuesta);
CREATE INDEX IF NOT EXISTS idx_respuestas_fecha ON public.respuestas_encuestaSG(fecha_respuesta);

-- 4. Función para actualizar fecha_actualizacion automáticamente
CREATE OR REPLACE FUNCTION update_encuestas_modification()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para actualizar fecha_actualizacion
DROP TRIGGER IF EXISTS trigger_update_encuestas_modification ON public.encuestas_satisfaccionSG;
CREATE TRIGGER trigger_update_encuestas_modification
    BEFORE UPDATE ON public.encuestas_satisfaccionSG
    FOR EACH ROW
    EXECUTE FUNCTION update_encuestas_modification();

-- 6. Función para calcular puntuación total automáticamente
CREATE OR REPLACE FUNCTION calcular_puntuacion_total()
RETURNS TRIGGER AS $$
DECLARE
    total_puntos INTEGER := 0;
    num_respuestas INTEGER := 0;
    promedio DECIMAL(3,2);
BEGIN
    -- Convertir respuestas a números (molesto=1, no-satisfecho=2, satisfecho=3, muy-satisfecho=4)
    IF NEW.q1_atencion_ventas IS NOT NULL THEN
        total_puntos := total_puntos + CASE NEW.q1_atencion_ventas
            WHEN 'molesto' THEN 1
            WHEN 'no-satisfecho' THEN 2
            WHEN 'satisfecho' THEN 3
            WHEN 'muy-satisfecho' THEN 4
        END;
        num_respuestas := num_respuestas + 1;
    END IF;
    
    IF NEW.q2_calidad_productos IS NOT NULL THEN
        total_puntos := total_puntos + CASE NEW.q2_calidad_productos
            WHEN 'molesto' THEN 1
            WHEN 'no-satisfecho' THEN 2
            WHEN 'satisfecho' THEN 3
            WHEN 'muy-satisfecho' THEN 4
        END;
        num_respuestas := num_respuestas + 1;
    END IF;
    
    IF NEW.q3_tiempo_entrega IS NOT NULL THEN
        total_puntos := total_puntos + CASE NEW.q3_tiempo_entrega
            WHEN 'molesto' THEN 1
            WHEN 'no-satisfecho' THEN 2
            WHEN 'satisfecho' THEN 3
            WHEN 'muy-satisfecho' THEN 4
        END;
        num_respuestas := num_respuestas + 1;
    END IF;
    
    IF NEW.q4_servicio_logistica IS NOT NULL THEN
        total_puntos := total_puntos + CASE NEW.q4_servicio_logistica
            WHEN 'molesto' THEN 1
            WHEN 'no-satisfecho' THEN 2
            WHEN 'satisfecho' THEN 3
            WHEN 'muy-satisfecho' THEN 4
        END;
        num_respuestas := num_respuestas + 1;
    END IF;
    
    IF NEW.q5_experiencia_compra IS NOT NULL THEN
        total_puntos := total_puntos + CASE NEW.q5_experiencia_compra
            WHEN 'molesto' THEN 1
            WHEN 'no-satisfecho' THEN 2
            WHEN 'satisfecho' THEN 3
            WHEN 'muy-satisfecho' THEN 4
        END;
        num_respuestas := num_respuestas + 1;
    END IF;
    
    -- Calcular promedio
    IF num_respuestas > 0 THEN
        promedio := total_puntos::DECIMAL / num_respuestas;
        NEW.puntuacion_total := promedio;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger para calcular puntuación total
DROP TRIGGER IF EXISTS trigger_calcular_puntuacion ON public.respuestas_encuestaSG;
CREATE TRIGGER trigger_calcular_puntuacion
    BEFORE INSERT OR UPDATE ON public.respuestas_encuestaSG
    FOR EACH ROW
    EXECUTE FUNCTION calcular_puntuacion_total();

-- 8. Función para actualizar estado de encuesta cuando se responde
CREATE OR REPLACE FUNCTION actualizar_estado_encuesta()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar el estado de la encuesta a 'respondida'
    UPDATE public.encuestas_satisfaccionSG 
    SET estado = 'respondida', fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id_encuesta = NEW.id_encuesta;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger para actualizar estado de encuesta
DROP TRIGGER IF EXISTS trigger_actualizar_estado_encuesta ON public.respuestas_encuestaSG;
CREATE TRIGGER trigger_actualizar_estado_encuesta
    AFTER INSERT ON public.respuestas_encuestaSG
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_estado_encuesta();

-- 10. Comentarios en las tablas
COMMENT ON TABLE public.encuestas_satisfaccionSG IS 'Tabla para almacenar las encuestas de satisfacción enviadas a los clientes';
COMMENT ON TABLE public.respuestas_encuestaSG IS 'Tabla para almacenar las respuestas de las encuestas de satisfacción';

COMMENT ON COLUMN public.encuestas_satisfaccionSG.id_encuesta IS 'ID único de la encuesta';
COMMENT ON COLUMN public.encuestas_satisfaccionSG.id_cliente IS 'ID del cliente al que se envió la encuesta';
COMMENT ON COLUMN public.encuestas_satisfaccionSG.url_encuesta IS 'URL única de la encuesta';
COMMENT ON COLUMN public.encuestas_satisfaccionSG.estado IS 'Estado de la encuesta: enviada, respondida, vencida, cancelada';
COMMENT ON COLUMN public.encuestas_satisfaccionSG.metodo_envio IS 'Método utilizado para enviar la encuesta';

COMMENT ON COLUMN public.respuestas_encuestaSG.puntuacion_total IS 'Promedio de todas las respuestas (1-4)';
COMMENT ON COLUMN public.respuestas_encuestaSG.q1_atencion_ventas IS 'Respuesta a pregunta 1: Atención del área de ventas';
COMMENT ON COLUMN public.respuestas_encuestaSG.q2_calidad_productos IS 'Respuesta a pregunta 2: Calidad de productos';
COMMENT ON COLUMN public.respuestas_encuestaSG.q3_tiempo_entrega IS 'Respuesta a pregunta 3: Tiempo de entrega';
COMMENT ON COLUMN public.respuestas_encuestaSG.q4_servicio_logistica IS 'Respuesta a pregunta 4: Servicio de logística';
COMMENT ON COLUMN public.respuestas_encuestaSG.q5_experiencia_compra IS 'Respuesta a pregunta 5: Experiencia de compra/renta';

-- 11. Datos de ejemplo (opcional - puedes comentar esta sección)
/*
INSERT INTO public.encuestas_satisfaccionSG (id_cliente, url_encuesta, estado, metodo_envio, email_cliente) 
VALUES 
(1, 'https://tu-dominio.com/sastifaccion_clienteSG.html?encuesta=ENC001', 'enviada', 'email', 'cliente1@ejemplo.com'),
(2, 'https://tu-dominio.com/sastifaccion_clienteSG.html?encuesta=ENC002', 'enviada', 'whatsapp', 'cliente2@ejemplo.com');
*/

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
