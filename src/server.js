require('dotenv').config(); // <-- Esta línea DEBE IR AL PRINCIPIO

// No tumbar el proceso en desarrollo: loggear y continuar
process.on('uncaughtException', err => {
  console.error('[server] Uncaught Exception:', err);
  // NO process.exit en dev; podríamos notificar y seguir corriendo
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[server] Unhandled Rejection at:', promise, 'reason:', reason);
  // NO process.exit en dev
});

const app = require('./app'); // Suponiendo que 'app' se exporta desde otro archivo (ej. app.js)

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
console.log('Puerto:', PORT);

// Lista de IPs permitidas
const ALLOWED_IPS = ['127.0.0.1', '192.168.0.103'];

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor escuchando en http://127.0.0.1:${PORT}`);
  console.log('Backend server is actively listening for requests.');
});

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
  try { process.on(sig, () => graceful(sig)); } catch {}
});

// A partir de aquí, 'app' (tu aplicación Express) puede usar estas variables en sus rutas y controladores.
// Sin embargo, es más común pasar estas variables como configuración a los módulos que las necesitan,
// o acceder a ellas directamente con `process.env.NOMBRE_VARIABLE` en cualquier archivo del proyecto
// DESPUÉS de que `dotenv.config()` ha sido llamado.