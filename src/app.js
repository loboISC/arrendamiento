const express = require('express');
const cors = require('cors');
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

const app = express();
// Configuración de CORS para IPs/hostnames específicas
app.use(cors({
  origin: function(origin, callback) {
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

app.use(express.static('public'));

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

// Rutas específicas para inventario (alias para equipos)
app.use('/api/inventario', equiposRoutes);

app.get('/', (req, res) => res.send('API Inventario funcionando'));

module.exports = app; 
