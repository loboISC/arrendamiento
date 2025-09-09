-- Create productos and relations for components, accessories, and images
BEGIN;

-- Productos master
CREATE TABLE IF NOT EXISTS public.productos (
  id_producto SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(120),
  venta BOOLEAN DEFAULT false,
  renta BOOLEAN DEFAULT false,
  precio_venta NUMERIC(14,2) DEFAULT 0,
  tarifa_renta NUMERIC(14,2) DEFAULT 0,
  estado VARCHAR(30) DEFAULT 'Activo',
  imagen BYTEA, -- imagen principal opcional
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Imagenes adicionales del producto
CREATE TABLE IF NOT EXISTS public.productos_imagenes (
  id_producto_imagen SERIAL PRIMARY KEY,
  id_producto INTEGER NOT NULL REFERENCES public.productos(id_producto) ON DELETE CASCADE,
  imagen BYTEA NOT NULL
);

-- Componentes ligados al producto (detalle/snapshot)
CREATE TABLE IF NOT EXISTS public.productos_componentes (
  id_producto_componente SERIAL PRIMARY KEY,
  id_producto INTEGER NOT NULL REFERENCES public.productos(id_producto) ON DELETE CASCADE,
  id_componente INTEGER,
  clave VARCHAR(40),
  nombre VARCHAR(150),
  precio NUMERIC(14,2) DEFAULT 0,    -- venta
  tarifa NUMERIC(14,2) DEFAULT 0,    -- renta
  cantidad INTEGER DEFAULT 1,
  imagen BYTEA
);

-- Accesorios ligados al producto (detalle/snapshot)
-- Nota: la tabla accesorios existente usa PK id_equipo
CREATE TABLE IF NOT EXISTS public.productos_accesorios (
  id_producto_accesorio SERIAL PRIMARY KEY,
  id_producto INTEGER NOT NULL REFERENCES public.productos(id_producto) ON DELETE CASCADE,
  id_accesorio INTEGER REFERENCES public.accesorios(id_equipo) ON DELETE SET NULL,
  tipo VARCHAR(10) CHECK (tipo IN ('venta','renta')),
  clave VARCHAR(40),
  nombre VARCHAR(150),
  precio NUMERIC(14,2) DEFAULT 0,    -- venta
  tarifa NUMERIC(14,2) DEFAULT 0,    -- renta
  cantidad INTEGER DEFAULT 1,
  imagen BYTEA
);

-- Trigger to keep fecha_modificacion updated
CREATE OR REPLACE FUNCTION public.update_producto_modification() RETURNS trigger AS $$
BEGIN
  NEW.fecha_modificacion = CURRENT_TIMESTAMP;
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_productos_mod ON public.productos;
CREATE TRIGGER trg_productos_mod BEFORE UPDATE ON public.productos
FOR EACH ROW EXECUTE FUNCTION public.update_producto_modification();

COMMIT;


