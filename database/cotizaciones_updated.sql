-- Table: public.cotizaciones (ACTUALIZADA)
-- Incluye mejoras para historial, clonación, vendedores y generación de PDF

-- DROP TABLE IF EXISTS public.cotizaciones;

CREATE TABLE IF NOT EXISTS public.cotizaciones
(
    id_cotizacion integer NOT NULL DEFAULT nextval('cotizaciones_id_cotizacion_seq'::regclass),
    numero_cotizacion character varying(50) COLLATE pg_catalog."default" NOT NULL,
    id_cliente integer,
    tipo character varying(20) COLLATE pg_catalog."default" NOT NULL DEFAULT 'RENTA'::character varying,
    fecha_cotizacion date NOT NULL DEFAULT CURRENT_DATE,
    periodo character varying(20) COLLATE pg_catalog."default" DEFAULT 'Inmediato'::character varying,
    dias_periodo integer DEFAULT 15,
    descripcion text COLLATE pg_catalog."default",
    direccion_entrega text COLLATE pg_catalog."default",
    tipo_envio character varying(20) COLLATE pg_catalog."default" DEFAULT 'local'::character varying,
    distancia_km numeric(10,2) DEFAULT 0,
    costo_envio numeric(10,2) DEFAULT 0,
    detalle_calculo text COLLATE pg_catalog."default",
    subtotal numeric(12,2) DEFAULT 0,
    iva numeric(12,2) DEFAULT 0,
    total numeric(12,2) DEFAULT 0,
    notas text COLLATE pg_catalog."default",
    estado character varying(30) COLLATE pg_catalog."default" DEFAULT 'Borrador'::character varying,
    prioridad character varying(20) COLLATE pg_catalog."default" DEFAULT 'Media'::character varying,
    fecha_seguimiento date,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    creado_por integer,
    modificado_por integer,
    id_almacen integer,
    nombre_almacen character varying(100) COLLATE pg_catalog."default",
    ubicacion_almacen character varying(100) COLLATE pg_catalog."default",
    numero_folio character varying(50) COLLATE pg_catalog."default",
    fecha_inicio date,
    fecha_fin date,
    moneda character varying(10) COLLATE pg_catalog."default" DEFAULT 'MXN'::character varying,
    tipo_cambio numeric(10,4) DEFAULT 1.0000,
    precio_por_dia numeric(12,2) DEFAULT 0,
    precio_semanal numeric(12,2) DEFAULT 0,
    precio_mensual numeric(12,2) DEFAULT 0,
    descuento_porcentaje numeric(5,2) DEFAULT 0,
    descuento_monto numeric(12,2) DEFAULT 0,
    tipo_cliente character varying(50) COLLATE pg_catalog."default" DEFAULT 'Público en General'::character varying,
    contacto_nombre character varying(100) COLLATE pg_catalog."default",
    contacto_telefono character varying(20) COLLATE pg_catalog."default",
    contacto_email character varying(100) COLLATE pg_catalog."default",
    requiere_entrega boolean DEFAULT true,
    direccion_completa text COLLATE pg_catalog."default",
    coordenadas_entrega point,
    fecha_entrega_solicitada date,
    hora_entrega_solicitada time without time zone,
    instrucciones_entrega text COLLATE pg_catalog."default",
    garantia_monto numeric(12,2) DEFAULT 0,
    garantia_porcentaje numeric(5,2) DEFAULT 0,
    costo_adicional numeric(12,2) DEFAULT 0,
    concepto_adicional character varying(200) COLLATE pg_catalog."default",
    notas_internas jsonb,
    configuracion_especial jsonb,
    productos_seleccionados jsonb,
    version integer DEFAULT 1,
    cotizacion_origen integer,
    es_clon boolean DEFAULT false,
    precio_unitario numeric(12,2) DEFAULT 0,
    cantidad_total integer DEFAULT 0,
    aplica_iva boolean DEFAULT true,
    porcentaje_iva numeric(5,2) DEFAULT 16.00,
    reduce_inventario boolean DEFAULT false,
    productos_reservados boolean DEFAULT false,
    fecha_reserva timestamp without time zone,
    terminos_pago character varying(50) COLLATE pg_catalog."default" DEFAULT 'Contado'::character varying,
    dias_credito integer DEFAULT 0,
    metodo_pago character varying(50) COLLATE pg_catalog."default" DEFAULT 'Efectivo'::character varying,
    id_vendedor integer,
    comision_vendedor numeric(12,2) DEFAULT 0,
    porcentaje_comision numeric(5,2) DEFAULT 0,
    requiere_factura boolean DEFAULT false,
    datos_facturacion jsonb,
    uso_cfdi character varying(10) COLLATE pg_catalog."default" DEFAULT 'G03'::character varying,
    
    -- ===== CAMPOS NUEVOS PARA FUNCIONALIDADES MEJORADAS =====
    
    -- HISTORIAL Y AUDITORÍA
    historial_cambios jsonb DEFAULT '[]'::jsonb,
    motivo_cambio text COLLATE pg_catalog."default",
    usuario_ultima_accion integer,
    fecha_ultima_accion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    
    -- CLONACIÓN MEJORADA
    numero_clones integer DEFAULT 0,
    clon_de_folio character varying(50) COLLATE pg_catalog."default",
    fecha_clonacion timestamp without time zone,
    usuario_clono integer,
    cambios_en_clon jsonb,
    
    -- VENDEDOR Y COMISIONES EXTENDIDO
    sucursal_vendedor character varying(100) COLLATE pg_catalog."default",
    supervisor_vendedor integer,
    
    -- GENERACIÓN DE PDF
    pdf_generado boolean DEFAULT false,
    fecha_pdf timestamp without time zone,
    usuario_genero_pdf integer,
    ruta_pdf text COLLATE pg_catalog."default",
    hash_pdf character varying(64) COLLATE pg_catalog."default",
    plantilla_pdf character varying(50) COLLATE pg_catalog."default" DEFAULT 'standard'::character varying,
    configuracion_pdf jsonb,
    
    -- WORKFLOW Y APROBACIONES
    requiere_aprobacion boolean DEFAULT false,
    nivel_aprobacion_requerido integer DEFAULT 1,
    aprobaciones jsonb DEFAULT '[]'::jsonb,
    fecha_aprobacion timestamp without time zone,
    usuario_aprobo integer,
    comentarios_aprobacion text COLLATE pg_catalog."default",
    
    -- SEGUIMIENTO Y NOTIFICACIONES
    notificaciones_enviadas jsonb DEFAULT '[]'::jsonb,
    recordatorios_programados jsonb DEFAULT '[]'::jsonb,
    fecha_vencimiento date,
    dias_vigencia integer DEFAULT 30,
    
    -- INTEGRACIÓN Y SINCRONIZACIÓN
    sincronizado_erp boolean DEFAULT false,
    fecha_sincronizacion timestamp without time zone,
    id_externo character varying(100) COLLATE pg_catalog."default",
    sistema_origen character varying(50) COLLATE pg_catalog."default" DEFAULT 'SISTEMA_RENTA'::character varying,
    
    -- MÉTRICAS Y ANÁLISIS
    tiempo_elaboracion interval,
    numero_revisiones integer DEFAULT 0,
    tasa_conversion numeric(5,2) DEFAULT 0,
    valor_potencial numeric(12,2) DEFAULT 0,
    probabilidad_cierre numeric(5,2) DEFAULT 50.00,
    
    CONSTRAINT cotizaciones_pkey PRIMARY KEY (id_cotizacion),
    CONSTRAINT cotizaciones_numero_cotizacion_key UNIQUE (numero_cotizacion),
    CONSTRAINT cotizaciones_cotizacion_origen_fkey FOREIGN KEY (cotizacion_origen)
        REFERENCES public.cotizaciones (id_cotizacion) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT cotizaciones_creado_por_fkey FOREIGN KEY (creado_por)
        REFERENCES public.usuarios (id_usuario) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT cotizaciones_id_almacen_fkey FOREIGN KEY (id_almacen)
        REFERENCES public.almacenes (id_almacen) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT cotizaciones_id_cliente_fkey FOREIGN KEY (id_cliente)
        REFERENCES public.clientes (id_cliente) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT cotizaciones_id_vendedor_fkey FOREIGN KEY (id_vendedor)
        REFERENCES public.usuarios (id_usuario) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT cotizaciones_modificado_por_fkey FOREIGN KEY (modificado_por)
        REFERENCES public.usuarios (id_usuario) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION,
    CONSTRAINT cotizaciones_usuario_ultima_accion_fkey FOREIGN KEY (usuario_ultima_accion)
        REFERENCES public.usuarios (id_usuario) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT cotizaciones_usuario_clono_fkey FOREIGN KEY (usuario_clono)
        REFERENCES public.usuarios (id_usuario) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT cotizaciones_supervisor_vendedor_fkey FOREIGN KEY (supervisor_vendedor)
        REFERENCES public.usuarios (id_usuario) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT cotizaciones_usuario_genero_pdf_fkey FOREIGN KEY (usuario_genero_pdf)
        REFERENCES public.usuarios (id_usuario) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT cotizaciones_usuario_aprobo_fkey FOREIGN KEY (usuario_aprobo)
        REFERENCES public.usuarios (id_usuario) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE SET NULL,
    CONSTRAINT check_tipo_cotizacion CHECK (tipo::text = ANY (ARRAY['RENTA'::character varying, 'VENTA'::character varying]::text[])),
    CONSTRAINT check_probabilidad_cierre CHECK (probabilidad_cierre >= 0 AND probabilidad_cierre <= 100),
    CONSTRAINT check_dias_vigencia CHECK (dias_vigencia > 0),
    CONSTRAINT check_nivel_aprobacion CHECK (nivel_aprobacion_requerido >= 1 AND nivel_aprobacion_requerido <= 5)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.cotizaciones
    OWNER to postgres;

-- ===== COMENTARIOS ACTUALIZADOS =====

COMMENT ON TABLE public.cotizaciones
    IS 'Tabla para almacenar las cotizaciones del sistema con funcionalidades extendidas de historial, clonación y PDF';

-- Comentarios campos existentes (los más importantes)
COMMENT ON COLUMN public.cotizaciones.dias_periodo
    IS 'Días del período: para renta es días de renta, para venta puede ser días de entrega';

COMMENT ON COLUMN public.cotizaciones.estado
    IS 'Estado de la cotización: Borrador, Enviada, Revisada, Aprobada, Rechazada, Convertida a Contrato';

COMMENT ON COLUMN public.cotizaciones.version
    IS 'Versión de la cotización para control de cambios';

COMMENT ON COLUMN public.cotizaciones.cotizacion_origen
    IS 'ID de la cotización original si esta es un clon';

COMMENT ON COLUMN public.cotizaciones.es_clon
    IS 'Indica si esta cotización es un clon de otra';

-- Comentarios campos nuevos
COMMENT ON COLUMN public.cotizaciones.historial_cambios
    IS 'Array JSON con el historial completo de cambios realizados a la cotización';

COMMENT ON COLUMN public.cotizaciones.motivo_cambio
    IS 'Descripción del motivo del último cambio realizado';

COMMENT ON COLUMN public.cotizaciones.usuario_ultima_accion
    IS 'Usuario que realizó la última acción en la cotización';

COMMENT ON COLUMN public.cotizaciones.numero_clones
    IS 'Contador de cuántas veces se ha clonado esta cotización';

COMMENT ON COLUMN public.cotizaciones.clon_de_folio
    IS 'Número de folio de la cotización original (para referencia visual)';

COMMENT ON COLUMN public.cotizaciones.cambios_en_clon
    IS 'JSON con los cambios específicos realizados al crear el clon';

COMMENT ON COLUMN public.cotizaciones.vendedor_nombre
    IS 'Nombre completo del vendedor (desnormalizado para reportes)';

COMMENT ON COLUMN public.cotizaciones.supervisor_vendedor
    IS 'ID del supervisor del vendedor asignado';

COMMENT ON COLUMN public.cotizaciones.pdf_generado
    IS 'Indica si se ha generado el PDF de esta cotización';

COMMENT ON COLUMN public.cotizaciones.ruta_pdf
    IS 'Ruta del archivo PDF generado en el sistema de archivos';

COMMENT ON COLUMN public.cotizaciones.hash_pdf
    IS 'Hash SHA-256 del PDF para verificar integridad';

COMMENT ON COLUMN public.cotizaciones.plantilla_pdf
    IS 'Plantilla utilizada para generar el PDF (standard, premium, custom)';

COMMENT ON COLUMN public.cotizaciones.configuracion_pdf
    IS 'Configuración específica utilizada para la generación del PDF';

COMMENT ON COLUMN public.cotizaciones.aprobaciones
    IS 'Array JSON con el historial de aprobaciones de la cotización';

COMMENT ON COLUMN public.cotizaciones.nivel_aprobacion_requerido
    IS 'Nivel de aprobación requerido (1-5) basado en monto o cliente';

COMMENT ON COLUMN public.cotizaciones.notificaciones_enviadas
    IS 'Registro de notificaciones enviadas (email, SMS, etc.)';

COMMENT ON COLUMN public.cotizaciones.dias_vigencia
    IS 'Días de vigencia de la cotización desde su creación';

COMMENT ON COLUMN public.cotizaciones.sincronizado_erp
    IS 'Indica si la cotización ha sido sincronizada con sistema ERP externo';

COMMENT ON COLUMN public.cotizaciones.tiempo_elaboracion
    IS 'Tiempo total invertido en elaborar la cotización';

COMMENT ON COLUMN public.cotizaciones.tasa_conversion
    IS 'Tasa de conversión histórica del vendedor (%)';

COMMENT ON COLUMN public.cotizaciones.probabilidad_cierre
    IS 'Probabilidad estimada de cierre de la cotización (0-100%)';

-- ===== ÍNDICES ACTUALIZADOS =====

-- Índices existentes
CREATE INDEX IF NOT EXISTS idx_cotizaciones_almacen
    ON public.cotizaciones USING btree
    (id_almacen ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente
    ON public.cotizaciones USING btree
    (id_cliente ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado
    ON public.cotizaciones USING btree
    (estado COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha
    ON public.cotizaciones USING btree
    (fecha_cotizacion ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_vendedor
    ON public.cotizaciones USING btree
    (id_vendedor ASC NULLS LAST)
    TABLESPACE pg_default;

-- Nuevos índices para funcionalidades extendidas
CREATE INDEX IF NOT EXISTS idx_cotizaciones_pdf_generado
    ON public.cotizaciones USING btree
    (pdf_generado ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_es_clon
    ON public.cotizaciones USING btree
    (es_clon ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_cotizacion_origen
    ON public.cotizaciones USING btree
    (cotizacion_origen ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha_vencimiento
    ON public.cotizaciones USING btree
    (fecha_vencimiento ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_usuario_ultima_accion
    ON public.cotizaciones USING btree
    (usuario_ultima_accion ASC NULLS LAST)
    TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_requiere_aprobacion
    ON public.cotizaciones USING btree
    (requiere_aprobacion ASC NULLS LAST)
    WHERE requiere_aprobacion = true;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_sincronizado_erp
    ON public.cotizaciones USING btree
    (sincronizado_erp ASC NULLS LAST)
    TABLESPACE pg_default;

-- Índice compuesto para búsquedas de historial
CREATE INDEX IF NOT EXISTS idx_cotizaciones_historial
    ON public.cotizaciones USING btree
    (id_vendedor ASC NULLS LAST, fecha_cotizacion DESC NULLS LAST, estado COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default;

-- Índice para clones y versiones
CREATE INDEX IF NOT EXISTS idx_cotizaciones_clones
    ON public.cotizaciones USING btree
    (clon_de_folio COLLATE pg_catalog."default" ASC NULLS LAST, version ASC NULLS LAST)
    TABLESPACE pg_default;

-- ===== FUNCIONES Y TRIGGERS ACTUALIZADOS =====

-- Función para actualizar historial de cambios
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

-- Función para manejar clonación
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

-- Crear triggers
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

-- Mantener triggers existentes
CREATE OR REPLACE TRIGGER trigger_generar_folio
    BEFORE INSERT
    ON public.cotizaciones
    FOR EACH ROW
    EXECUTE FUNCTION public.generar_numero_folio();

CREATE OR REPLACE TRIGGER trigger_update_cotizacion_modification
    BEFORE UPDATE 
    ON public.cotizaciones
    FOR EACH ROW
    EXECUTE FUNCTION public.update_cotizacion_modification();

CREATE OR REPLACE TRIGGER trigger_validar_cotizacion_tipo
    BEFORE INSERT OR UPDATE 
    ON public.cotizaciones
    FOR EACH ROW
    EXECUTE FUNCTION public.validar_cotizacion_tipo();

-- ===== VISTAS ÚTILES =====

-- Vista para historial de cotizaciones por cliente
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

-- Vista para seguimiento de PDFs
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

-- Vista para análisis de vendedores
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

COMMENT ON VIEW public.v_historial_cotizaciones_cliente 
    IS 'Vista para consultar el historial completo de cotizaciones por cliente';

COMMENT ON VIEW public.v_seguimiento_pdfs 
    IS 'Vista para seguimiento del estado de generación de PDFs';

COMMENT ON VIEW public.v_analisis_vendedores 
    IS 'Vista para análisis de desempeño de vendedores';
