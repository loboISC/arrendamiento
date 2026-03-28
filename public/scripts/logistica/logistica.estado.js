/**
 * MANEJO DE ESTADO - LOGÍSTICA
 * Permite mantener el estado de la aplicación en memoria y persistir cambios.
 */
const LogisticaEstado = (function() {
    let estado = {
        vehiculos: [],
        asignaciones: [],
        choferes: [],
        alertas: [],
        loading: false,
        vistaActual: 'dashboard',
        trackingActivo: false,
        unidadEnSeguimiento: null
    };

    const suscriptores = [];

    function actualizar(nuevoEstado) {
        estado = { ...estado, ...nuevoEstado };
        notificar();
    }

    function notificar() {
        suscriptores.forEach(fn => fn(estado));
    }

    return {
        get: () => ({ ...estado }),
        set: (nuevo) => actualizar(nuevo),
        suscribir: (fn) => suscriptores.push(fn)
    };
})();
