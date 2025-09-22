require('dotenv').config(); // <-- Esta línea DEBE IR AL PRINCIPIO

process.on('uncaughtException', err => {
  console.error('Unhandled Exception  caught:', err);
  process.exit(1); // Salir con un código de error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1); // Salir con un código de error
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${PORT}`);
  console.log('Backend server is actively listening for requests.');
});

// A partir de aquí, 'app' (tu aplicación Express) puede usar estas variables en sus rutas y controladores.
// Sin embargo, es más común pasar estas variables como configuración a los módulos que las necesitan,
// o acceder a ellas directamente con `process.env.NOMBRE_VARIABLE` en cualquier archivo del proyecto
// DESPUÉS de que `dotenv.config()` ha sido llamado.