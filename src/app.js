const express = require('express');
const cors = require('cors');
const clientesRoutes = require('./routes/clientes');
const equiposRoutes = require('./routes/equipos');
const movimientosRoutes = require('./routes/movimientos');
const notificacionesRoutes = require('./routes/notificaciones');
const analisisRoutes = require('./routes/analisis');
const contratosRoutes = require('./routes/contratos');
const facturasRoutes = require('./routes/facturas');
const entregasRoutes = require('./routes/entregas');
const usuariosRoutes = require('./routes/usuarios');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use('/api/clientes', clientesRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/analisis', analisisRoutes);
app.use('/api/contratos', contratosRoutes);
app.use('/api/facturas', facturasRoutes);
app.use('/api/entregas', entregasRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/dashboard', dashboardRoutes);


app.get('/', (req, res) => res.send('API Inventario funcionando'));

module.exports = app; 
