-- 7. Tablas para Grafos e Inteligencia Logística
CREATE TABLE IF NOT EXISTS logistica_nodos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    latitud DECIMAL(10,8) NOT NULL,
    longitud DECIMAL(11,8) NOT NULL,
    creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logistica_tramos (
    id SERIAL PRIMARY KEY,
    nodo_origen_id INTEGER REFERENCES logistica_nodos(id) ON DELETE CASCADE,
    nodo_destino_id INTEGER REFERENCES logistica_nodos(id) ON DELETE CASCADE,
    distancia_km DECIMAL(10,3) NOT NULL,
    velocidad_promedio_kmh INTEGER DEFAULT 40,
    es_sentido_unico BOOLEAN DEFAULT FALSE,
    creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices para busqueda geografica rapida
CREATE INDEX IF NOT EXISTS idx_logistica_nodos_coords ON logistica_nodos(latitud, longitud);

-- Datos de ejemplo (Nodos principales en una ciudad hipotetica)
-- Almacen Central
INSERT INTO logistica_nodos (nombre, latitud, longitud) VALUES ('Almacen Central', 19.432608, -99.133209);
-- Interseccion Norte
INSERT INTO logistica_nodos (nombre, latitud, longitud) VALUES ('Interseccion Norte', 19.452608, -99.133209);
-- Interseccion Sur
INSERT INTO logistica_nodos (nombre, latitud, longitud) VALUES ('Interseccion Sur', 19.412608, -99.133209);
-- Interseccion Este
INSERT INTO logistica_nodos (nombre, latitud, longitud) VALUES ('Interseccion Este', 19.432608, -99.113209);

-- Tramos de ejemplo (Conexiones)
INSERT INTO logistica_tramos (nodo_origen_id, nodo_destino_id, distancia_km, velocidad_promedio_kmh) VALUES (1, 2, 2.5, 50);
INSERT INTO logistica_tramos (nodo_origen_id, nodo_destino_id, distancia_km, velocidad_promedio_kmh) VALUES (2, 1, 2.5, 50);
INSERT INTO logistica_tramos (nodo_origen_id, nodo_destino_id, distancia_km, velocidad_promedio_kmh) VALUES (1, 3, 2.2, 45);
INSERT INTO logistica_tramos (nodo_origen_id, nodo_destino_id, distancia_km, velocidad_promedio_kmh) VALUES (3, 1, 2.2, 45);
INSERT INTO logistica_tramos (nodo_origen_id, nodo_destino_id, distancia_km, velocidad_promedio_kmh) VALUES (1, 4, 2.0, 40);
INSERT INTO logistica_tramos (nodo_origen_id, nodo_destino_id, distancia_km, velocidad_promedio_kmh) VALUES (4, 1, 2.0, 40);
INSERT INTO logistica_tramos (nodo_origen_id, nodo_destino_id, distancia_km, velocidad_promedio_kmh) VALUES (2, 4, 3.5, 55);
INSERT INTO logistica_tramos (nodo_origen_id, nodo_destino_id, distancia_km, velocidad_promedio_kmh) VALUES (4, 2, 3.5, 55);
