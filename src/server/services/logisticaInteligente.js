const db = require('../config/database');

/**
 * SERVICIO DE INTELIGENCIA LOGÍSTICA
 * Implementa Dijkstra y cálculos de ETA para optimización de rutas.
 */
class LogisticaInteligenteService {
    
    /**
     * Calcula la distancia Haversine entre dos puntos (Línea recta sobre esfera)
     */
    static calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Obtiene el grafo de la base de datos
     */
    static async cargarGrafo() {
        const { rows: nodos } = await db.query('SELECT * FROM logistica_nodos');
        const { rows: tramos } = await db.query('SELECT * FROM logistica_tramos');

        const grafo = {};
        nodos.forEach(n => {
            grafo[n.id] = { 
                id: n.id, 
                nombre: n.nombre, 
                latitud: n.latitud, 
                longitud: n.longitud,
                vecinos: [] 
            };
        });

        tramos.forEach(t => {
            if (grafo[t.nodo_origen_id]) {
                grafo[t.nodo_origen_id].vecinos.push({
                    id: t.nodo_destino_id,
                    distancia: parseFloat(t.distancia_km),
                    velocidad: t.velocidad_promedio_kmh
                });
            }
        });

        return grafo;
    }

    /**
     * Algoritmo de Dijkstra para encontrar la ruta más corta
     */
    static dijkstra(grafo, inicioId, finId) {
        const distancias = {};
        const previos = {};
        const visitados = new Set();
        const cola = [];

        // Inicializar
        for (let id in grafo) {
            distancias[id] = Infinity;
            previos[id] = null;
        }
        distancias[inicioId] = 0;
        cola.push({ id: inicioId, dist: 0 });

        while (cola.length > 0) {
            // Ordenar cola para actuar como Priority Queue (Estrategia simple)
            cola.sort((a, b) => a.dist - b.dist);
            const { id: actualId } = cola.shift();

            if (actualId == finId) break;
            if (visitados.has(actualId)) continue;
            visitados.add(actualId);

            const nodoActual = grafo[actualId];
            if (!nodoActual) continue;

            for (let vecino of nodoActual.vecinos) {
                if (visitados.has(vecino.id)) continue;

                const nuevaDist = distancias[actualId] + vecino.distancia;
                if (nuevaDist < distancias[vecino.id]) {
                    distancias[vecino.id] = nuevaDist;
                    previos[vecino.id] = actualId;
                    cola.push({ id: vecino.id, dist: nuevaDist });
                }
            }
        }

        // Reconstruir camino
        const camino = [];
        let actual = finId;
        while (actual !== null) {
            camino.unshift(grafo[actual]);
            actual = previos[actual];
        }

        return {
            camino: camino[0]?.id == inicioId ? camino : [],
            distanciaTotal: distancias[finId] === Infinity ? 0 : distancias[finId]
        };
    }

    /**
     * Encuentra el nodo más cercano a una coordenada lat/lng
     */
    static async encontrarNodoMasCercano(lat, lng) {
        const { rows } = await db.query(`
            SELECT id, 
                   (6371 * acos(cos(radians($1)) * cos(radians(latitud)) * cos(radians(longitud) - radians($2)) + sin(radians($1)) * sin(radians(latitud)))) AS distancia
            FROM logistica_nodos
            ORDER BY distancia ASC
            LIMIT 1
        `, [lat, lng]);
        return rows[0];
    }

    /**
     * Calcula la mejor ruta entre dos coordenadas arbitrarias
     */
    static async calcularRutaEntrePuntos(lat1, lng1, lat2, lng2) {
        try {
            // Intentar utilizar OSRM (Open Source Routing Machine) para obtener un trazo real que respete las calles
            const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;
            const osrmRes = await fetch(osrmUrl);
            
            if (osrmRes.ok) {
                const osrmData = await osrmRes.json();
                if (osrmData.routes && osrmData.routes.length > 0) {
                    const route = osrmData.routes[0];
                    const distanceKm = route.distance / 1000;
                    const durationMin = Math.round(route.duration / 60);
                    
                    // Transformar el GeoJSON LineString a nuestro formato de camino [{ latitud, longitud }]
                    const caminoStr = route.geometry.coordinates.map(coord => ({
                        latitud: coord[1],
                        longitud: coord[0]
                    }));

                    return {
                        camino: caminoStr,
                        distanciaTotal: distanceKm,
                        eta_minutos: durationMin + Math.round(durationMin * 0.15), // 15% holgura trafico
                        nodos_recorridos: caminoStr.length,
                        origen: 'osrm_streets'
                    };
                }
            }
        } catch (error) {
            console.error('[OSRM] Error al obtener ruta real, cayendo a Dijkstra fallback:', error);
        }

        // Fallback: Si OSRM falla, usamos nuestro grafo custom con Dijkstra
        const nodoInicio = await this.encontrarNodoMasCercano(lat1, lng1);
        const nodoFin = await this.encontrarNodoMasCercano(lat2, lng2);

        if (!nodoInicio || !nodoFin) return null;

        const grafo = await this.cargarGrafo();
        const resultado = this.dijkstra(grafo, nodoInicio.id, nodoFin.id);

        // Calcular ETA (basado en distancia y velocidad promedio de 40 km/h)
        const velocidadPromedio = 40;
        const etaMinutos = (resultado.distanciaTotal / velocidadPromedio) * 60;
        
        // Agregar holgura del 15% por trafico
        const etaFinal = Math.round(etaMinutos * 1.15);

        return {
            ...resultado,
            eta_minutos: etaFinal,
            nodos_recorridos: resultado.camino.length,
            origen: 'dijkstra_custom'
        };
    }
}

module.exports = LogisticaInteligenteService;
