/**
 * SERVICIO DE API - LOGÍSTICA
 * Centraliza todas las llamadas al backend.
 */
const LogisticaServicio = (function() {
    const API_BASE = '/api/logistica';

    async function peticion(url, options = {}) {
        // Prioridad: token de chofer en sessionStorage > token de usuario en localStorage
        const choferToken = sessionStorage.getItem('chofer_token');
        const userToken = localStorage.getItem('token');
        const token = choferToken || userToken;
        
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await fetch(`${API_BASE}${url}`, { ...defaultOptions, ...options });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error en la petición logistica');
        }
        return response.json();
    }

    return {
        obtenerDashboard: () => peticion('/dashboard'),
        obtenerVehiculos: () => peticion('/vehiculos'),
        obtenerVehiculo: (id) => peticion(`/vehiculos/${id}`),
        crearVehiculo: (datos) => peticion('/vehiculos', { 
            method: 'POST', 
            body: JSON.stringify(datos) 
        }),
        obtenerMantenimientosGlobales: () => peticion('/historial-mantenimientos'),
        crearMantenimiento: (datos) => peticion('/mantenimientos', {
            method: 'POST',
            body: JSON.stringify(datos)
        }),
        obtenerChoferes: () => peticion('/choferes/disponibles'),
        obtenerDocsVencidos: () => peticion('/documentos/vencidos'),
        obtenerHistorial: () => peticion('/historial'),
        obtenerTrackingsActivos: () => peticion('/tracking/activos'),
        registrarTracking: (datos) => peticion('/tracking', {
            method: 'POST',
            body: JSON.stringify(datos)
        }),
        crearAsignacion: (datos) => peticion('/asignaciones', {
            method: 'POST',
            body: JSON.stringify(datos)
        }),
        asignacionAutomatica: (datos) => peticion('/asignaciones/automatica', {
            method: 'POST',
            body: JSON.stringify(datos)
        }),
        obtenerSeguimiento: (asignacionId) => peticion(`/asignaciones/${asignacionId}/seguimiento`),
        iniciarRuta: (asignacionId) => peticion(`/asignaciones/${asignacionId}/iniciar-ruta`, {
            method: 'POST'
        }),
        generarTokenQR: (asignacionId, datos) => peticion(`/asignaciones/${asignacionId}/generar-qr`, {
            method: 'POST',
            body: JSON.stringify(datos)
        }),
        obtenerUrlsAsignacion: (asignacionId) => peticion(`/asignaciones/${asignacionId}/urls`),
        obtenerDetallePedido: (id, tipo) => peticion(`/pedidos/${id}?tipo=${tipo}`),
        actualizarDetallePedido: (id, datos) => peticion(`/pedidos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(datos)
        }),
        geocodificarDireccion: (datos) => peticion('/geocodificar', {
            method: 'POST',
            body: JSON.stringify(datos)
        }),
        obtenerRutaInteligente: (asignacionId) => peticion(`/inteligente/ruta/${asignacionId}`)
    };
})();
