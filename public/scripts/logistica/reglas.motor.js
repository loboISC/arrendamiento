/**
 * MOTOR DE REGLAS - LOGÍSTICA
 * Se encarga de procesar eventos y disparar acciones automáticas.
 */
const LogisticaEventos = (function() {
    const eventos = {};

    function suscribir(nombre, fn) {
        if (!eventos[nombre]) eventos[nombre] = [];
        eventos[nombre].push(fn);
    }

    function emitir(nombre, data) {
        console.log(`[EVENTO] ${nombre}:`, data);
        if (eventos[nombre]) {
            eventos[nombre].forEach(fn => fn(data));
        }

        // --- MOTOR DE REGLAS LÓGICO ---
        switch(nombre) {
            case 'DOCUMENTO_VENCIDO':
                LogisticaNotificaciones.mostrarAlerta(`El documento ${data.tipo} del vehículo ${data.economico} ha vencido.`, 'danger');
                break;
            case 'NUEVA_ASIGNACION':
                LogisticaNotificaciones.notificacionNavegador('Nueva Asignación', `Se ha asignado un nuevo pedido a la unidad ${data.unidad}.`);
                break;
            case 'ERROR_GPS':
                LogisticaNotificaciones.mostrarAlerta(`Error en GPS: ${data}`, 'warning');
                break;
        }
    }

    return {
        suscribir,
        emitir
    };
})();
