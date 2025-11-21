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
const encuestasRoutes = require('./routes/encuestas');
const almacenesRoutes = require('./routes/almacenes');
const pdfRoutes = require('./routes/pdf');
const previewRoutes = require('./routes/preview');

const app = express();
// Configuración de CORS para IPs/hostnames específicas
app.use(cors({
  origin: function (origin, callback) {
    try {
      // Permitir solicitudes sin origen (como Postman) o mismas páginas servidas por Express
      if (!origin) return callback(null, true);

      const hostname = new URL(origin).hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || ALLOWED_IPS.includes(hostname)) {
        return callback(null, true);
      }
      return callback(new Error('No permitido por CORS'));
    } catch (e) {
      // Si falla el parseo del origen, no bloquear en dev
      return callback(null, true);
    }
  }
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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
    "connect-src 'self' http://localhost:3001 https://localhost:3001 ws://localhost:3001 wss://localhost:3001"
  );
  next();
});

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
app.use('/api/productos', productosRoutes);
app.use('/api/encuestas', encuestasRoutes);
app.use('/api/almacenes', almacenesRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/preview', previewRoutes);

// Rutas específicas para inventario (alias para equipos)
app.use('/api/inventario', equiposRoutes);

app.get('/', (req, res) => res.send('API Inventario funcionando'));

module.exports = app; 
