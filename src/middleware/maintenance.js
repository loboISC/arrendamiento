const db = require('../db');

/**
 * Middleware para manejar el modo mantenimiento
 */
const maintenanceMiddleware = async (req, res, next) => {
    try {
        // Consultar estado de mantenimiento en la base de datos
        const result = await db.query('SELECT modo_mantenimiento FROM configuracion_sistema WHERE id = 1');

        if (result.rows.length > 0 && result.rows[0].modo_mantenimiento) {
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
                '/favicon.ico'
            ];

            const isExcluded = excludedPaths.some(path => url.includes(path));

            if (!isExcluded && req.method === 'GET' && !url.startsWith('/api/')) {
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
                            <h1>Mantenimiento en Curso</h1>
                            <p>Estamos realizando mejoras críticas en el sistema para brindarte un mejor servicio. Por favor, vuelve a intentarlo en unos momentos.</p>
                            <p><small>ScaffoldPro - Gestión de Inventarios</small></p>
                        </div>
                    </body>
                    </html>
                `);
            } else if (!isExcluded) {
                // Si es una petición API, devolver 503 Service Unavailable
                return res.status(503).json({
                    error: 'Sistema en mantenimiento',
                    message: 'El administrador ha activado el modo mantenimiento. Por favor intente más tarde.'
                });
            }
        }
    } catch (error) {
        console.error('Error en middleware de mantenimiento:', error);
        // Si hay error en la DB, dejamos pasar para no romper el acceso administrativo
    }

    next();
};

module.exports = maintenanceMiddleware;
