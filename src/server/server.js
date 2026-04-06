require('dotenv').config(); // <-- Esta línea DEBE IR AL PRINCIPIO

// No tumbar el proceso en desarrollo: loggear y continuar
process.on('uncaughtException', err => {
  console.error('[server] FATAL: Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[server] FATAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = require('./app'); // Suponiendo que 'app' se exporta desde otro archivo (ej. app.js)
const { setIO, setWSServer, broadcastEvent } = require('./socketGateway');

const PORT = process.env.PORT || 3001;

// Ahora puedes acceder a tus variables de entorno aquí
const facturamaUser = process.env.FACTURAMA_USER;
const facturamaPassword = process.env.FACTURAMA_PASSWORD; // No estaba en tu ejemplo, pero la necesitarás
const facturamaBaseUrl = process.env.FACTURAMA_BASE_URL; // No estaba en tu ejemplo, pero la necesitarás
const databaseUrl = process.env.DATABASE_URL; // Debería ser DATABASE_URL, no DB_HOST
const jwtSecret = process.env.JWT_SECRET;
const csdEncryptKey = process.env.CSD_ENCRYPT_KEY;

// Puedes imprimir algunas para verificar que se están cargando (solo para desarrollo, no en producción)
console.log('Facturama User:', facturamaUser);
console.log('Database URL:', databaseUrl);
console.log('PDF_STORAGE_DIR:', process.env.PDF_STORAGE_DIR);
console.log('Puerto:', PORT);

// Lista de IPs permitidas
const ALLOWED_IPS = ['127.0.0.1', '192.168.0.104'];

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  console.log('Backend server is actively listening for requests.');
});

try {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  setIO(io);
  io.on('connection', (socket) => {
    console.log(`[socket] cliente conectado: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log(`[socket] cliente desconectado: ${socket.id}`);
    });
  });
  console.log('[socket] Socket.IO habilitado.');
} catch (err) {
  console.warn('[socket] Socket.IO no está instalado. Se mantiene modo sin sockets.', err.message);
}

try {
  const { WebSocketServer } = require('ws');
  const wss = new WebSocketServer({ server, path: '/ws/logistica' });
  setWSServer(wss);

  wss.on('connection', (ws) => {
    console.log('[ws] cliente conectado a /ws/logistica');

    ws.on('message', (raw) => {
      try {
        const evento = JSON.parse(raw.toString());
        if (!evento || !evento.tipo) return;

        if (evento.tipo === 'ubicacion') {
          broadcastEvent({
            tipo: 'ubicacion',
            asignacion_id: evento.asignacion_id,
            lat: evento.lat,
            lng: evento.lng,
            velocidad: evento.velocidad || 0,
            timestamp: new Date().toISOString()
          });
          return;
        }

        if (evento.tipo === 'pedido_asignado' || evento.tipo === 'vehiculo_llego' || evento.tipo === 'notificacion') {
          broadcastEvent(evento);
        }
      } catch (_) {
        console.warn('[ws] Mensaje invalido recibido.');
      }
    });

    ws.on('close', () => {
      console.log('[ws] cliente desconectado de /ws/logistica');
    });
  });

  console.log('[ws] WebSocket nativo habilitado en /ws/logistica');
} catch (err) {
  console.warn('[ws] Paquete ws no disponible. Se mantiene modo sin ws nativo.', err.message);
}

server.keepAliveTimeout = 65000; // evitar cortes tempranos en clientes
server.headersTimeout = 66000;

server.on('error', (err) => {
  console.error('[server] HTTP server error:', err);
});

const graceful = (signal) => {
  console.log(`[server] Recibida señal ${signal}. Cerrando servidor...`);
  try {
    server.close((err) => {
      if (err) {
        console.error('[server] Error al cerrar:', err);
      } else {
        console.log('[server] Servidor cerrado limpiamente.');
      }
      // No forzamos exit en dev; dejar que el proceso termine si no hay más eventos
    });
  } catch (e) {
    console.error('[server] Excepción durante cierre:', e);
  }
};

['SIGINT', 'SIGTERM'].forEach(sig => {
  try { process.on(sig, () => graceful(sig)); } catch { }
});

// A partir de aquí, 'app' (tu aplicación Express) puede usar estas variables en sus rutas y controladores.
// Sin embargo, es más común pasar estas variables como configuración a los módulos que las necesitan,
// o acceder a ellas directamente con `process.env.NOMBRE_VARIABLE` en cualquier archivo del proyecto
// DESPUÉS de que `dotenv.config()` ha sido llamado.
