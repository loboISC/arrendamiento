DROP TABLE IF EXISTS imagenes_producto CASCADE;
DROP TABLE IF EXISTS especificaciones CASCADE;
DROP TABLE IF EXISTS precios CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS subcategorias CASCADE;
DROP TABLE IF EXISTS almacenes CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;

-- Creación de la tabla de categorías
CREATE TABLE categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(50) UNIQUE NOT NULL
);

-- Creación de la tabla de subcategorías
CREATE TABLE subcategorias (
    id_subcategoria SERIAL PRIMARY KEY,
    nombre_subcategoria VARCHAR(50) UNIQUE NOT NULL,
    id_categoria INTEGER REFERENCES categorias(id_categoria) ON DELETE CASCADE
);

-- Creación de la tabla de almacenes
CREATE TABLE almacenes (
    id_almacen SERIAL PRIMARY KEY,
    nombre_almacen VARCHAR(100) UNIQUE NOT NULL,
    ubicacion TEXT
);

-- Creación de la tabla de productos
CREATE TABLE productos (
    id_producto SERIAL PRIMARY KEY,
    clave VARCHAR(50) UNIQUE NOT NULL,
    nombre_del_producto VARCHAR(100) NOT NULL,
    descripcion TEXT,
    marca VARCHAR(50),
    modelo VARCHAR(50),
    material VARCHAR(50),
    id_categoria INTEGER REFERENCES categorias(id_categoria) ON DELETE SET NULL,
    id_subcategoria INTEGER REFERENCES subcategorias(id_subcategoria) ON DELETE SET NULL,
    peso DECIMAL(10, 2),
    capacidad_de_carga DECIMAL(10, 2),
    largo DECIMAL(10, 2),
    ancho DECIMAL(10, 2),
    alto DECIMAL(10, 2),
    id_almacen INTEGER REFERENCES almacenes(id_almacen) ON DELETE SET NULL,
    precio_de_venta DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tarifa_renta DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    stock_total INTEGER DEFAULT 0,
    stock_disponible INTEGER DEFAULT 0,
    en_renta INTEGER DEFAULT 0,
    reservado INTEGER DEFAULT 0,
    en_mantenimiento INTEGER DEFAULT 0,
    estado VARCHAR(20),
    condicion VARCHAR(20),
    codigo_de_barras BYTEA
);

-- Creación de la tabla de precios
CREATE TABLE precios (
    id_precio SERIAL PRIMARY KEY,
    id_producto INTEGER REFERENCES productos(id_producto) ON DELETE CASCADE,
    precio_de_venta DECIMAL(10, 2),
    renta_diaria DECIMAL(10, 2),
    renta_semanal DECIMAL(10, 2),
    renta_mensual DECIMAL(10, 2),
    renta_anual DECIMAL(10, 2)
);

-- Creación de la tabla de especificaciones
CREATE TABLE especificaciones (
    id_especificacion SERIAL PRIMARY KEY,
    id_producto INTEGER REFERENCES productos(id_producto) ON DELETE CASCADE,
    nombre_especificacion VARCHAR(100),
    valor VARCHAR(255)
);

-- Creación de la tabla de imágenes
CREATE TABLE imagenes_producto (
    id_imagen SERIAL PRIMARY KEY,
    id_producto INTEGER REFERENCES productos(id_producto) ON DELETE CASCADE,
    imagen_data BYTEA,
    nombre_archivo VARCHAR(255)
);

-- Insertar categorías si no existen
INSERT INTO categorias (id_categoria, nombre_categoria) VALUES
(1, 'ANDAMIO MARCO Y CRUCETA'),
(2, 'MULTIDIRECCIONAL'),
(3, 'TEMPLETES'),
(4, 'ACCESORIOS')
ON CONFLICT (id_categoria) DO NOTHING;

-- Insertar subcategorías relacionadas con 'ACCESORIOS' (id_categoria = 4)
INSERT INTO subcategorias (nombre_subcategoria, id_categoria) VALUES
('escaleras', 4),
('ruedas', 4),
('plataformas', 4),
('tornillos', 4)
ON CONFLICT (nombre_subcategoria) DO NOTHING;

-- Insertar almacenes
INSERT INTO almacenes (nombre_almacen, ubicacion) VALUES
('bodega 68 CDMX', 'CDMX'),
('texcoco', 'Estado de México'),
('mexicali', 'Baja California')
ON CONFLICT (nombre_almacen) DO NOTHING;
