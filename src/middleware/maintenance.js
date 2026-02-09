const db = require('../db');

/**
 * Mapeo de módulos a patrones de URL
 */
const moduleRoutes = {
    'Cotizaciones': ['/api/cotizaciones', 'cotizaciones.html', 'cotizacion_venta.html', 'cotizacion_renta.html', 'solicitud_cotizacion.html'],
    'Clientes': ['/api/clientes', 'clientes.html'],
    'Inventario': ['/api/productos', '/api/inventario', '/api/equipos', 'inventario.html', 'equipos.html', 'productos.html'],
    'Facturacion': ['/api/facturas', '/api/configuracion-facturas', 'facturacion.html'],
    'Usuarios': ['/api/usuarios', 'usuarios.html'],
    'Rentas': ['/api/movimientos/renta', 'rentas.html'],
    'Ventas': ['/api/movimientos/venta', 'ventas.html'],
    'Contratos': ['/api/contratos', 'contratos.html'],
    'Logistica': ['/api/entregas', 'logistica.html', 'entregas.html'],
    'Mantenimiento': ['/api/movimientos/mantenimiento', 'mantenimiento.html']
};

const maintenanceMiddleware = async (req, res, next) => {
    try {
        // Consultar estado de mantenimiento en la base de datos
        const result = await db.query('SELECT modo_mantenimiento, modulos_mantenimiento FROM configuracion_sistema WHERE id = 1');

        if (result.rows.length > 0 && result.rows[0].modo_mantenimiento) {
            const { modulos_mantenimiento } = result.rows[0];
            const blockedModules = (modulos_mantenimiento || '').split(',');
            const url = req.originalUrl || req.url;

            // Lista de rutas que SIEMPRE deben estar accesibles (administrativas)
            const excludedPaths = [
                '/configuracion.html',
                '/api/configuracion',
                '/api/sistema',
                '/api/auth',
                '/login.html',
                '/img/',
                '/css/',
                '/scripts/',
                '/fonts/',
                '/favicon.ico',
                '/logo'
            ];

            const isExcluded = excludedPaths.some(path => url.includes(path));
            if (isExcluded) return next();

            // Verificar si la ruta actual pertenece a algún módulo bloqueado
            let isBlocked = false;
            let blockedModuleName = '';

            for (const moduleName of blockedModules) {
                const patterns = moduleRoutes[moduleName.trim()];
                if (patterns && patterns.some(p => url.includes(p))) {
                    isBlocked = true;
                    blockedModuleName = moduleName;
                    break;
                }
            }

            if (isBlocked) {
                if (req.method === 'GET' && !url.startsWith('/api/')) {
                    // Si es una navegación HTML, mostrar página elegante
                    return res.send(`
                        <!DOCTYPE html>
                        <html lang="es">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Mantenimiento en curso - ScaffoldPro</title>
                            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
                            <style>
                                body { font-family: 'Inter', sans-serif; background: #1a1c23; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                                .container { padding: 40px; border-radius: 20px; background: rgba(255,255,255,0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); max-width: 500px; }
                                h1 { color: #2979ff; margin-bottom: 20px; }
                                p { color: #888; line-height: 1.6; }
                                .icon { font-size: 60px; margin-bottom: 20px; color: #2979ff; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="icon">⚙️</div>
                                <h1>Módulo en Mantenimiento</h1>
                                <p>La sección de <strong>${blockedModuleName}</strong> está siendo actualizada. Por favor, vuelve a intentarlo en unos momentos.</p>
                                <a href="dashboard.html" style="display: inline-block; margin-top: 25px; padding: 12px 25px; background: #2979ff; color: #fff; text-decoration: none; border-radius: 10px; font-weight: bold; transition: background 0.2s;">
                                    <i class="fa fa-arrow-left"></i> Volver al Inicio
                                </a>
                                <p style="margin-top: 30px;"><small>ScaffoldPro - Gestión de Inventarios</small></p>
                            </div>
                        </body>
                        </html>
                    `);
                } else {
                    // Si es una petición API, devolver 503 Service Unavailable
                    return res.status(503).json({
                        error: 'Módulo en mantenimiento',
                        message: `El módulo de ${blockedModuleName} está en mantenimiento programado.`
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error en middleware de mantenimiento:', error);
    }

    next();
};

module.exports = maintenanceMiddleware;
