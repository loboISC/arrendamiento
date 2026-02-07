const express = require('express');
const cors = require('cors');
const path = require('path');
const ALLOWED_IPS = require('./config/allowedIps');
const authRoutes = require('./routes/auth');
const clientesRoutes = require('./routes/clientes');
const equiposRoutes = require('./routes/equipos');
const productosRoutes = require('./routes/productos');
const movimientosRoutes = require('./routes/movimientos');
const notificacionesRoutes = require('./routes/notificaciones');
const analisisRoutes = require('./routes/analisis');
const transaccionesRoutes = require('./routes/transacciones');
const contratosRoutes = require('./routes/contratos');
const cotizacionesRoutes = require('./routes/cotizaciones');
const facturasRoutes = require('./routes/facturas');
const entregasRoutes = require('./routes/entregas');
const usuariosRoutes = require('./routes/usuarios');
const dashboardRoutes = require('./routes/dashboard');
const configuracionFacturasRoutes = require('./routes/configuracionfacturasruta');
const configuracionSmtpRoutes = require('./routes/configuracionSmtp');
const encuestasRoutes = require('./routes/encuestas');
const almacenesRoutes = require('./routes/almacenes');
const pdfRoutes = require('./routes/pdf');
const previewRoutes = require('./routes/preview');
const configuracionSistemaRoutes = require('./routes/configuracionSistema');
const envRoutes = require('./routes/env');
const backupScheduler = require('./utils/backupScheduler');

const app = express();

// Configuración de CORS mejorada para IPs/hostnames y dominios públicos
app.use(cors({
  origin: function (origin, callback) {
    try {
      // Permitir solicitudes sin origen (como Postman) o mismas páginas servidas por Express
      if (!origin) return callback(null, true);

      const url = new URL(origin);
      const hostname = url.hostname;
      const protocol = url.protocol;

      // Permitir localhost en cualquier puerto
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return callback(null, true);
      }

      // Permitir IPs permitidas (red local)
      if (ALLOWED_IPS.includes(hostname)) {
        return callback(null, true);
      }

      // Permitir subdominios de andamiositorres.com
      if (hostname.endsWith('andamiositorres.com')) {
        return callback(null, true);
      }

      // Permitir ngrok durante desarrollo
      if (hostname.includes('ngrok') || hostname.includes('ngrok-free')) {
        return callback(null, true);
      }

      // Por defecto, permitir en desarrollo
      return callback(null, true);
    } catch (e) {
      // Si falla el parseo del origen, no bloquear en dev
      return callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware para Content Security Policy
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' http://localhost:3001 https://localhost:3001 blob: data:; " +
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://fonts.googleapis.com https://cdn.jsdelivr.net data:; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.tailwindcss.com data:; " +
    "img-src 'self' data: https: blob:; " +
    "frame-src 'self' http://localhost:3001 https://localhost:3001 blob: data:; " +
    "object-src 'self' http://localhost:3001 https://localhost:3001 blob: data:; " +
    "connect-src 'self' http://localhost:3001 https://localhost:3001 ws://localhost:3001 wss://localhost:3001 https://api.zippopotam.us https://nominatim.openstreetmap.org"
  );
  next();
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Servidor funcionando correctamente', timestamp: new Date().toISOString() });
});

// Middleware de Modo Mantenimiento (Global)
app.use(require('./middleware/maintenance'));

app.use(express.static('public'));

// Servir PDFs desde el directorio public/pdfs
app.use('/pdfs', express.static(path.join(__dirname, '../public/pdfs')));

// Endpoint de prueba simple
app.get('/api/test', (req, res) => {
  res.json({ message: 'Servidor funcionando correctamente', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/analisis', analisisRoutes);
app.use('/api/transacciones', transaccionesRoutes);
app.use('/api/contratos', contratosRoutes);
app.use('/api/cotizaciones', cotizacionesRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/entregas', entregasRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/configuracion-facturas', configuracionFacturasRoutes);
app.use('/api/configuracion/smtp', configuracionSmtpRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/encuestas', encuestasRoutes);
app.use('/api/almacenes', almacenesRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/preview', previewRoutes);
app.use('/api/configuracion/sistema', configuracionSistemaRoutes);
app.use('/api/configuracion/env', envRoutes);
app.use('/api/sistema', require('./routes/sistemaRoutes'));

// Rutas específicas para inventario (alias para equipos)
app.use('/api/inventario', equiposRoutes);

app.get('/', (req, res) => res.send('API Inventario funcionando'));

// Iniciar servicios de automatización (Respaldos y Limpieza)
backupScheduler.init();

module.exports = app;
