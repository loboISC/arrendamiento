-- Migración: Ampliar tabla contratos para capturar todos los datos del formulario

-- Agregar columnas faltantes a la tabla contratos
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS numero_contrato character varying(50) UNIQUE;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS tipo character varying(20) DEFAULT 'RENTA';
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS requiere_factura character varying(2) DEFAULT 'SI';
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS fecha_contrato date;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS id_cotizacion integer;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) DEFAULT 0;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS impuesto numeric(12,2) DEFAULT 0;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS descuento numeric(12,2) DEFAULT 0;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS total numeric(12,2) DEFAULT 0;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS tipo_garantia character varying(50);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS importe_garantia numeric(12,2) DEFAULT 0;

-- Agregar campos de domicilio de entrega
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS calle character varying(255);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS numero_externo character varying(20);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS numero_interno character varying(20);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS colonia character varying(255);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS codigo_postal character varying(10);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS entre_calles character varying(255);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS pais character varying(100) DEFAULT 'México';
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS estado_entidad character varying(100) DEFAULT 'México';
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS municipio character varying(255);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS notas_domicilio text;

-- Agregar campos de auditoría
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS fecha_creacion timestamp DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS fecha_actualizacion timestamp DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS usuario_creacion character varying(80);

-- Agregar campos para guardar referencias a PDFs
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS pdf_contrato character varying(255);
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS pdf_nota character varying(255);

-- Crear tabla para los items/equipos del contrato
CREATE TABLE IF NOT EXISTS public.contrato_items (
    id_contrato_item integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    id_contrato integer NOT NULL REFERENCES public.contratos(id_contrato) ON DELETE CASCADE,
    clave character varying(50),
    descripcion text NOT NULL,
    cantidad integer DEFAULT 1,
    precio_unitario numeric(10,2) NOT NULL,
    garantia numeric(12,2) DEFAULT 0,
    total numeric(12,2) NOT NULL,
    fecha_creacion timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_contratos_numero ON public.contratos(numero_contrato);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente ON public.contratos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_contratos_estado ON public.contratos(estado);
CREATE INDEX IF NOT EXISTS idx_contrato_items_contrato ON public.contrato_items(id_contrato);

-- Comentarios descriptivos
COMMENT ON TABLE public.contratos IS 'Tabla principal de contratos de renta de equipos';
COMMENT ON COLUMN public.contratos.numero_contrato IS 'Número único del contrato (ej: CONT-2024-156)';
COMMENT ON COLUMN public.contratos.tipo_garantia IS 'Tipo de garantía (ej: PAGARE, DEPOSITO, etc)';
COMMENT ON TABLE public.contrato_items IS 'Items/equipos incluidos en cada contrato';
