-- Crear la tabla de almacenes si no existe
CREATE TABLE IF NOT EXISTS almacenes (
  id_almacen INT AUTO_INCREMENT PRIMARY KEY,
  nombre_almacen VARCHAR(100) NOT NULL,
  ubicacion VARCHAR(100),
  direccion TEXT,
  telefono VARCHAR(20),
  activo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar datos iniciales si la tabla está vacía
INSERT INTO almacenes (id_almacen, nombre_almacen, ubicacion, direccion, telefono, activo)
VALUES 
  (1, 'BODEGA 68 CDMX', 'CDMX', 'Dirección CDMX', '5551234567', 1),
  (2, 'TEXCOCO', 'Estado de México', 'Dirección Texcoco', '5557654321', 1),
  (3, 'MEXICALI', 'Baja California', 'Dirección Mexicali', '6861234567', 1)
ON DUPLICATE KEY UPDATE 
  nombre_almacen = VALUES(nombre_almacen),
  ubicacion = VALUES(ubicacion),
  direccion = VALUES(direccion),
  telefono = VALUES(telefono),
  activo = VALUES(activo);
