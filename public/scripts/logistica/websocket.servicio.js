/**
 * SERVICIO WEBSOCKET - LOGISTICA
 * Conexion global unica con reconexion automatica.
 */
const LogisticaWebSocket = (function() {
    let ws = null;
    let reconnectTimer = null;
    let reconnectAttempts = 0;
    let closedByUser = false;
    const listeners = new Set();
    const pendingQueue = [];

    function getUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}/ws/logistica`;
    }

    function isConnected() {
        return ws && ws.readyState === WebSocket.OPEN;
    }

    function flushQueue() {
        if (!isConnected()) return;
        while (pendingQueue.length) {
            ws.send(pendingQueue.shift());
        }
    }

    function connect() {
        if (isConnected() || (ws && ws.readyState === WebSocket.CONNECTING)) return;
        closedByUser = false;

        try {
            ws = new WebSocket(getUrl());

            ws.onopen = () => {
                reconnectAttempts = 0;
                flushQueue();
                notify({ tipo: 'ws_estado', estado: 'conectado' });
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    notify(data);
                } catch (_) {
                    // Ignorar mensajes no JSON
                }
            };

            ws.onclose = () => {
                notify({ tipo: 'ws_estado', estado: 'desconectado' });
                if (closedByUser) return;
                scheduleReconnect();
            };

            ws.onerror = () => {
                // El onclose maneja reintentos
            };
        } catch (_) {
            scheduleReconnect();
        }
    }

    function scheduleReconnect() {
        clearTimeout(reconnectTimer);
        reconnectAttempts += 1;
        const delay = Math.min(10000, 1500 * reconnectAttempts);
        reconnectTimer = setTimeout(connect, delay);
    }

    function disconnect() {
        closedByUser = true;
        clearTimeout(reconnectTimer);
        if (ws) {
            try { ws.close(); } catch (_) {}
        }
    }

    function send(payload) {
        const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
        if (isConnected()) {
            ws.send(text);
        } else {
            pendingQueue.push(text);
            connect();
        }
    }

    function onMessage(handler) {
        if (typeof handler !== 'function') return () => {};
        listeners.add(handler);
        return () => listeners.delete(handler);
    }

    function notify(data) {
        listeners.forEach((handler) => {
            try { handler(data); } catch (_) {}
        });
    }

    return {
        connect,
        disconnect,
        send,
        onMessage,
        isConnected
    };
})();

window.LogisticaWebSocket = LogisticaWebSocket;

