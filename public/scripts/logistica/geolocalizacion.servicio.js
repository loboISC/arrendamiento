/**
 * SERVICIO DE GEOLOCALIZACIÓN - LOGÍSTICA
 * Maneja el tracking en tiempo real del dispositivo (chofer).
 */
const GeolocationServicio = (function() {
    let watchId = null;
    let configuracion = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    function iniciarTracking(idAsignacion, callback) {
        if (!navigator.geolocation) {
            console.error('Geolocalización no soportada por el navegador');
            return;
        }

        detenerTracking(); // Limpiar previo

        watchId = navigator.geolocation.watchPosition(
            async (pos) => {
                const coordenadas = {
                    latitud: pos.coords.latitude,
                    longitud: pos.coords.longitude,
                    velocidad: pos.coords.speed || 0,
                    asignacion_id: idAsignacion
                };

                try {
                    // Enviar al backend
                    await LogisticaServicio.registrarTracking(coordenadas);
                    if (callback) callback(coordenadas);
                } catch (err) {
                    console.error('Error enviando ubicación:', err);
                }
            },
            (err) => {
                console.warn('Error en GPS:', err.message);
                // Notificar error al UI mediante evento
                LogisticaEventos.emitir('ERROR_GPS', err.message);
            },
            configuracion
        );
    }

    function detenerTracking() {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
    }

    return {
        iniciar: iniciarTracking,
        detener: detenerTracking,
        obtenerActual: () => new Promise((res, rej) => {
            navigator.geolocation.getCurrentPosition(res, rej, configuracion);
        })
    };
})();
