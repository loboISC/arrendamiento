/**
 * SERVICIO DE NOTIFICACIONES - LOGÍSTICA
 * Utiliza SweetAlert2 y la API nativa de Notificaciones.
 */
const LogisticaNotificaciones = (function() {
    
    // Configuración Base de SweetAlert2 Toast
    const Toast = (typeof Swal !== 'undefined') ? Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    }) : null;

    function mostrarAlerta(mensaje, tipo = 'success') {
        if (Toast) {
            Toast.fire({
                icon: tipo, // 'success', 'error', 'warning', 'info'
                title: mensaje
            });
        } else {
            console.warn(`[NOTIF] ${tipo.toUpperCase()}: ${mensaje}`);
            alert(mensaje);
        }
    }

    /**
     * Muestra una notificación del sistema (Push)
     */
    function sistema(titulo, cuerpo) {
        if (!("Notification" in window)) {
            console.error("Este navegador no soporta notificaciones de escritorio");
            return;
        }

        if (Notification.permission === "granted") {
            const n = new Notification(titulo, { 
                body: cuerpo,
                icon: '/assets/images/LOGO_ANDAMIOS_02.png'
            });
            n.onclick = () => window.focus();
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    sistema(titulo, cuerpo);
                }
            });
        }
    }

    return {
        mostrarAlerta,
        notificacionNavegador: sistema, // Alias para compatibilidad
        sistema
    };
})();
