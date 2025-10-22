-- MIGRACIÓN: Agregar nuevos campos a tabla cotizaciones existente
-- Este script agrega los campos nuevos sin afectar los datos existentes

-- Verificar si los campos ya existen antes de agregarlos
DO $$
BEGIN
    -- HISTORIAL Y AUDITORÍA
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='historial_cambios') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN historial_cambios jsonb DEFAULT '[]'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='motivo_cambio') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN motivo_cambio text COLLATE pg_catalog."default";
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='usuario_ultima_accion') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN usuario_ultima_accion integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='fecha_ultima_accion') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN fecha_ultima_accion timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    -- CLONACIÓN MEJORADA
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='numero_clones') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN numero_clones integer DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='clon_de_folio') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN clon_de_folio character varying(50) COLLATE pg_catalog."default";
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='fecha_clonacion') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN fecha_clonacion timestamp without time zone;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='usuario_clono') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN usuario_clono integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='cambios_en_clon') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN cambios_en_clon jsonb;
    END IF;
    
    -- VENDEDOR Y COMISIONES EXTENDIDO
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='sucursal_vendedor') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN sucursal_vendedor character varying(100) COLLATE pg_catalog."default";
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='supervisor_vendedor') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN supervisor_vendedor integer;
    END IF;
    
    -- GENERACIÓN DE PDF
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='pdf_generado') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN pdf_generado boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='fecha_pdf') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN fecha_pdf timestamp without time zone;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='usuario_genero_pdf') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN usuario_genero_pdf integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='ruta_pdf') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN ruta_pdf text COLLATE pg_catalog."default";
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='hash_pdf') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN hash_pdf character varying(64) COLLATE pg_catalog."default";
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='plantilla_pdf') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN plantilla_pdf character varying(50) COLLATE pg_catalog."default" DEFAULT 'standard'::character varying;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='configuracion_pdf') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN configuracion_pdf jsonb;
    END IF;
    
    -- WORKFLOW Y APROBACIONES
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='requiere_aprobacion') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN requiere_aprobacion boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='nivel_aprobacion_requerido') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN nivel_aprobacion_requerido integer DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='aprobaciones') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN aprobaciones jsonb DEFAULT '[]'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='fecha_aprobacion') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN fecha_aprobacion timestamp without time zone;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='usuario_aprobo') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN usuario_aprobo integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='comentarios_aprobacion') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN comentarios_aprobacion text COLLATE pg_catalog."default";
    END IF;
    
    -- SEGUIMIENTO Y NOTIFICACIONES
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='notificaciones_enviadas') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN notificaciones_enviadas jsonb DEFAULT '[]'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='recordatorios_programados') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN recordatorios_programados jsonb DEFAULT '[]'::jsonb;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='fecha_vencimiento') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN fecha_vencimiento date;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='dias_vigencia') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN dias_vigencia integer DEFAULT 30;
    END IF;
    
    -- INTEGRACIÓN Y SINCRONIZACIÓN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='sincronizado_erp') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN sincronizado_erp boolean DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='fecha_sincronizacion') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN fecha_sincronizacion timestamp without time zone;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='id_externo') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN id_externo character varying(100) COLLATE pg_catalog."default";
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='sistema_origen') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN sistema_origen character varying(50) COLLATE pg_catalog."default" DEFAULT 'SISTEMA_RENTA'::character varying;
    END IF;
    
    -- MÉTRICAS Y ANÁLISIS
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='tiempo_elaboracion') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN tiempo_elaboracion interval;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='numero_revisiones') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN numero_revisiones integer DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='tasa_conversion') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN tasa_conversion numeric(5,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='valor_potencial') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN valor_potencial numeric(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cotizaciones' AND column_name='probabilidad_cierre') THEN
        ALTER TABLE public.cotizaciones ADD COLUMN probabilidad_cierre numeric(5,2) DEFAULT 50.00;
    END IF;

END $$;

-- Agregar foreign keys solo si no existen
DO $$
BEGIN
    -- FK para usuario_ultima_accion
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='cotizaciones_usuario_ultima_accion_fkey') THEN
        ALTER TABLE public.cotizaciones 
        ADD CONSTRAINT cotizaciones_usuario_ultima_accion_fkey 
        FOREIGN KEY (usuario_ultima_accion) REFERENCES public.usuarios (id_usuario) 
        ON UPDATE NO ACTION ON DELETE SET NULL;
    END IF;
    
    -- FK para usuario_clono
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='cotizaciones_usuario_clono_fkey') THEN
        ALTER TABLE public.cotizaciones 
        ADD CONSTRAINT cotizaciones_usuario_clono_fkey 
        FOREIGN KEY (usuario_clono) REFERENCES public.usuarios (id_usuario) 
        ON UPDATE NO ACTION ON DELETE SET NULL;
    END IF;
    
    -- FK para supervisor_vendedor
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='cotizaciones_supervisor_vendedor_fkey') THEN
        ALTER TABLE public.cotizaciones 
        ADD CONSTRAINT cotizaciones_supervisor_vendedor_fkey 
        FOREIGN KEY (supervisor_vendedor) REFERENCES public.usuarios (id_usuario) 
        ON UPDATE NO ACTION ON DELETE SET NULL;
    END IF;
    
    -- FK para usuario_genero_pdf
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='cotizaciones_usuario_genero_pdf_fkey') THEN
        ALTER TABLE public.cotizaciones 
        ADD CONSTRAINT cotizaciones_usuario_genero_pdf_fkey 
        FOREIGN KEY (usuario_genero_pdf) REFERENCES public.usuarios (id_usuario) 
        ON UPDATE NO ACTION ON DELETE SET NULL;
    END IF;
    
    -- FK para usuario_aprobo
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='cotizaciones_usuario_aprobo_fkey') THEN
        ALTER TABLE public.cotizaciones 
        ADD CONSTRAINT cotizaciones_usuario_aprobo_fkey 
        FOREIGN KEY (usuario_aprobo) REFERENCES public.usuarios (id_usuario) 
        ON UPDATE NO ACTION ON DELETE SET NULL;
    END IF;

END $$;

-- Agregar constraints de validación
DO $$
BEGIN
    -- Check constraint para probabilidad_cierre
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name='check_probabilidad_cierre') THEN
        ALTER TABLE public.cotizaciones 
        ADD CONSTRAINT check_probabilidad_cierre 
        CHECK (probabilidad_cierre >= 0 AND probabilidad_cierre <= 100);
    END IF;
    
    -- Check constraint para dias_vigencia
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name='check_dias_vigencia') THEN
        ALTER TABLE public.cotizaciones 
        ADD CONSTRAINT check_dias_vigencia 
        CHECK (dias_vigencia > 0);
    END IF;
    
    -- Check constraint para nivel_aprobacion
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name='check_nivel_aprobacion') THEN
        ALTER TABLE public.cotizaciones 
        ADD CONSTRAINT check_nivel_aprobacion 
        CHECK (nivel_aprobacion_requerido >= 1 AND nivel_aprobacion_requerido <= 5);
    END IF;

END $$;

-- Crear índices nuevos solo si no existen
CREATE INDEX IF NOT EXISTS idx_cotizaciones_pdf_generado
    ON public.cotizaciones USING btree (pdf_generado ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_es_clon
    ON public.cotizaciones USING btree (es_clon ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_cotizacion_origen
    ON public.cotizaciones USING btree (cotizacion_origen ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha_vencimiento
    ON public.cotizaciones USING btree (fecha_vencimiento ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_usuario_ultima_accion
    ON public.cotizaciones USING btree (usuario_ultima_accion ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_requiere_aprobacion
    ON public.cotizaciones USING btree (requiere_aprobacion ASC NULLS LAST)
    WHERE requiere_aprobacion = true;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_sincronizado_erp
    ON public.cotizaciones USING btree (sincronizado_erp ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_historial
    ON public.cotizaciones USING btree 
    (id_vendedor ASC NULLS LAST, fecha_cotizacion DESC NULLS LAST, estado COLLATE pg_catalog."default" ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_clones
    ON public.cotizaciones USING btree 
    (clon_de_folio COLLATE pg_catalog."default" ASC NULLS LAST, version ASC NULLS LAST);

-- Crear funciones y triggers
CREATE OR REPLACE FUNCTION public.actualizar_historial_cotizacion()
    RETURNS trigger
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE
AS $BODY$
BEGIN
    -- Solo para UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- Actualizar campos de auditoría
        NEW.fecha_modificacion = CURRENT_TIMESTAMP;
        NEW.fecha_ultima_accion = CURRENT_TIMESTAMP;
        NEW.numero_revisiones = COALESCE(OLD.numero_revisiones, 0) + 1;
        
        -- Agregar entrada al historial si hay cambios significativos
        IF OLD.estado IS DISTINCT FROM NEW.estado 
           OR OLD.total IS DISTINCT FROM NEW.total 
           OR OLD.id_vendedor IS DISTINCT FROM NEW.id_vendedor THEN
            
            NEW.historial_cambios = COALESCE(OLD.historial_cambios, '[]'::jsonb) || 
                jsonb_build_object(
                    'fecha', CURRENT_TIMESTAMP,
                    'usuario', NEW.modificado_por,
                    'cambios', jsonb_build_object(
                        'estado_anterior', OLD.estado,
                        'estado_nuevo', NEW.estado,
                        'total_anterior', OLD.total,
                        'total_nuevo', NEW.total,
                        'vendedor_anterior', OLD.id_vendedor,
                        'vendedor_nuevo', NEW.id_vendedor
                    ),
                    'motivo', COALESCE(NEW.motivo_cambio, 'Modificación automática')
                );
        END IF;
        
        -- Calcular fecha de vencimiento
        IF NEW.fecha_vencimiento IS NULL AND NEW.dias_vigencia IS NOT NULL THEN
            NEW.fecha_vencimiento = NEW.fecha_cotizacion + (NEW.dias_vigencia || ' days')::interval;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$BODY$;

CREATE OR REPLACE FUNCTION public.procesar_clonacion_cotizacion()
    RETURNS trigger
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE
AS $BODY$
BEGIN
    -- Solo para INSERT de clones
    IF TG_OP = 'INSERT' AND NEW.es_clon = true AND NEW.cotizacion_origen IS NOT NULL THEN
        -- Actualizar contador de clones en la cotización origen
        UPDATE public.cotizaciones 
        SET numero_clones = COALESCE(numero_clones, 0) + 1
        WHERE id_cotizacion = NEW.cotizacion_origen;
        
        -- Obtener folio de la cotización origen para referencia
        SELECT numero_folio INTO NEW.clon_de_folio
        FROM public.cotizaciones 
        WHERE id_cotizacion = NEW.cotizacion_origen;
        
        -- Establecer fecha de clonación
        NEW.fecha_clonacion = CURRENT_TIMESTAMP;
        
        -- Resetear campos específicos del clon
        NEW.pdf_generado = false;
        NEW.fecha_pdf = NULL;
        NEW.ruta_pdf = NULL;
        NEW.hash_pdf = NULL;
        NEW.aprobaciones = '[]'::jsonb;
        NEW.fecha_aprobacion = NULL;
        NEW.usuario_aprobo = NULL;
    END IF;
    
    RETURN NEW;
END;
$BODY$;

-- Crear triggers solo si no existen
DROP TRIGGER IF EXISTS trigger_actualizar_historial_cotizacion ON public.cotizaciones;
CREATE TRIGGER trigger_actualizar_historial_cotizacion
    BEFORE UPDATE 
    ON public.cotizaciones
    FOR EACH ROW
    EXECUTE FUNCTION public.actualizar_historial_cotizacion();

DROP TRIGGER IF EXISTS trigger_procesar_clonacion_cotizacion ON public.cotizaciones;
CREATE TRIGGER trigger_procesar_clonacion_cotizacion
    BEFORE INSERT 
    ON public.cotizaciones
    FOR EACH ROW
    EXECUTE FUNCTION public.procesar_clonacion_cotizacion();

-- Crear vistas
CREATE OR REPLACE VIEW public.v_historial_cotizaciones_cliente AS
SELECT 
    c.id_cotizacion,
    c.numero_cotizacion,
    c.numero_folio,
    c.fecha_cotizacion,
    c.estado,
    c.total,
    c.id_cliente,
    cl.nombre as cliente_nombre,
    cl.empresa as cliente_empresa,
    c.id_vendedor,
    u.nombre as vendedor_nombre,
    c.es_clon,
    c.clon_de_folio,
    c.numero_clones,
    c.pdf_generado,
    c.fecha_vencimiento,
    CASE 
        WHEN c.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDA'
        WHEN c.fecha_vencimiento <= CURRENT_DATE + interval '7 days' THEN 'POR_VENCER'
        ELSE 'VIGENTE'
    END as estado_vigencia
FROM public.cotizaciones c
LEFT JOIN public.clientes cl ON c.id_cliente = cl.id_cliente
LEFT JOIN public.usuarios u ON c.id_vendedor = u.id_usuario
ORDER BY c.fecha_cotizacion DESC;

CREATE OR REPLACE VIEW public.v_seguimiento_pdfs AS
SELECT 
    c.id_cotizacion,
    c.numero_folio,
    c.pdf_generado,
    c.fecha_pdf,
    c.plantilla_pdf,
    c.ruta_pdf,
    u.nombre as usuario_genero,
    c.hash_pdf,
    CASE 
        WHEN c.pdf_generado THEN 'GENERADO'
        ELSE 'PENDIENTE'
    END as estado_pdf
FROM public.cotizaciones c
LEFT JOIN public.usuarios u ON c.usuario_genero_pdf = u.id_usuario
WHERE c.estado != 'Borrador'
ORDER BY c.fecha_pdf DESC NULLS LAST;

CREATE OR REPLACE VIEW public.v_analisis_vendedores AS
SELECT 
    v.id_usuario as id_vendedor,
    v.nombre as vendedor_nombre,
    v.correo as vendedor_email,
    v.rol as vendedor_rol,
    COUNT(c.id_cotizacion) as total_cotizaciones,
    COUNT(CASE WHEN c.estado = 'Aprobada' THEN 1 END) as cotizaciones_aprobadas,
    COUNT(CASE WHEN c.es_clon THEN 1 END) as cotizaciones_clonadas,
    AVG(c.total) as promedio_monto,
    SUM(c.total) as monto_total,
    AVG(c.probabilidad_cierre) as probabilidad_promedio,
    COUNT(CASE WHEN c.pdf_generado THEN 1 END) as pdfs_generados,
    c.sucursal_vendedor
FROM public.usuarios v
LEFT JOIN public.cotizaciones c ON v.id_usuario = c.id_vendedor
WHERE v.rol IN ('Rentas', 'Ventas', 'director general', 'Ingeniero en Calidad', 'Ingeniero en Proyectos', 'Ingeniero en Sistemas')
GROUP BY v.id_usuario, v.nombre, v.correo, v.rol, c.sucursal_vendedor
ORDER BY monto_total DESC NULLS LAST;

-- Comentarios en vistas
COMMENT ON VIEW public.v_historial_cotizaciones_cliente 
    IS 'Vista para consultar el historial completo de cotizaciones por cliente';

COMMENT ON VIEW public.v_seguimiento_pdfs 
    IS 'Vista para seguimiento del estado de generación de PDFs';

COMMENT ON VIEW public.v_analisis_vendedores 
    IS 'Vista para análisis de desempeño de vendedores';

-- Mensaje de finalización
SELECT 'MIGRACIÓN COMPLETADA: Se han agregado todos los campos nuevos a la tabla cotizaciones existente' as resultado;
