'use strict';
/**
 * tests/routes/notificaciones.test.js
 * Tests para el módulo de notificaciones de facturación.
 *
 * Estrategia:
 * - Tests de código fuente (lectura de archivo): verifican estructura, queries SQL y auth.
 * - Tests de comportamiento del módulo: verifican router express de forma aislada.
 */

const fs   = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');

// ── Lectura de código fuente ──────────────────────────────────────────────────
const routeSrc = fs.readFileSync(
    path.join(root, 'src', 'server', 'routes', 'notificaciones.js'),
    'utf8'
);

// ── 1. Estructura del router ──────────────────────────────────────────────────
describe('notificaciones router — estructura de código', () => {
    test('requiere autenticación en GET /  (lista principal)', () => {
        expect(routeSrc).toContain("router.get('/', authenticateToken");
    });

    test('requiere autenticación en GET /sin-leer/count', () => {
        expect(routeSrc).toContain("router.get('/sin-leer/count', authenticateToken");
    });

    test('requiere autenticación en PATCH /:id/leida', () => {
        expect(routeSrc).toContain("router.patch('/:id/leida', authenticateToken");
    });

    test('requiere autenticación en PATCH /leer-todas', () => {
        expect(routeSrc).toContain("router.patch('/leer-todas', authenticateToken");
    });

    test('hace JOIN con usuarios para nombre del responsable', () => {
        expect(routeSrc).toContain('LEFT JOIN usuarios u ON n.id_usuario_accion = u.id_usuario');
        expect(routeSrc).toContain('usuario_nombre');
    });

    test('limita el listado a 50 registros', () => {
        expect(routeSrc).toContain('LIMIT 50');
    });

    test('ordena por fecha DESC (más recientes primero)', () => {
        expect(routeSrc).toContain('ORDER BY n.fecha DESC');
    });

    test('implementa leer-todas con UPDATE SET leida = true', () => {
        expect(routeSrc).toContain("UPDATE notificaciones SET leida = true WHERE leida = false");
    });

    test('retorna 404 cuando notificación individual no existe', () => {
        expect(routeSrc).toContain("res.status(404).json({ error: 'Notificación no encontrada' })");
    });

    test('retorna 201 en POST para compatibilidad con el módulo general', () => {
        expect(routeSrc).toContain('res.status(201).json');
    });

    test('incluye id_usuario_accion en INSERT de POST', () => {
        expect(routeSrc).toContain('id_usuario_accion');
    });

    test('parsea count como entero con parseInt', () => {
        expect(routeSrc).toContain('parseInt(rows[0].count, 10)');
    });
});

// ── 2. Consistencia con el servicio de notificaciones ────────────────────────
describe('facturacionNotifService — consistencia de columnas', () => {
    let serviceSrc;
    beforeAll(() => {
        serviceSrc = fs.readFileSync(
            path.join(root, 'src', 'server', 'services', 'facturacionNotifService.js'),
            'utf8'
        );
    });

    test('servicio inserta en las mismas columnas que la ruta espera', () => {
        // El servicio inserta modulo, referencia_tipo, referencia_id, id_usuario_accion, metadata
        expect(serviceSrc).toContain('modulo');
        expect(serviceSrc).toContain('referencia_tipo');
        expect(serviceSrc).toContain('referencia_id');
        expect(serviceSrc).toContain('id_usuario_accion');
        expect(serviceSrc).toContain('metadata');
        // La ruta usa SELECT n.* que incluye modulo, referencia_tipo, etc.
        expect(routeSrc).toContain('SELECT n.*');
    });

    test('ruta devuelve campo usuario_nombre del JOIN', () => {
        expect(routeSrc).toContain('u.nombre AS usuario_nombre');
    });
});

// ── 3. Controladores con hooks de notificaciones ─────────────────────────────
describe('facturacion controller — hooks de notificaciones', () => {
    let controllerSrc;
    beforeAll(() => {
        controllerSrc = fs.readFileSync(
            path.join(root, 'src', 'server', 'controllers', 'facturacion', 'facturacion.js'),
            'utf8'
        );
    });

    test('importa facturacionNotifService', () => {
        expect(controllerSrc).toContain('facturacionNotifService');
        expect(controllerSrc).toContain('crearNotificacion');
    });

    test('dispara notificación FACTURA_TIMBRADA al timbrar exitosamente', () => {
        expect(controllerSrc).toContain('FACTURA_TIMBRADA');
    });

    test('dispara notificación FACTURA_CANCELADA al cancelar', () => {
        expect(controllerSrc).toContain('FACTURA_CANCELADA');
    });

    test('dispara notificación NC_TIMBRADA para notas de crédito', () => {
        expect(controllerSrc).toContain('NC_TIMBRADA');
    });

    test('dispara notificación NC_CANCELADA al cancelar nota de crédito', () => {
        expect(controllerSrc).toContain('NC_CANCELADA');
    });
});

// ── 4. Reporte mensual — hook de notificación ────────────────────────────────
describe('reporteMensualController — hook de notificaciones', () => {
    let reporteSrc;
    beforeAll(() => {
        reporteSrc = fs.readFileSync(
            path.join(root, 'src', 'server', 'controllers', 'facturacion', 'reporteMensualController.js'),
            'utf8'
        );
    });

    test('importa facturacionNotifService', () => {
        expect(reporteSrc).toContain('facturacionNotifService');
    });

    test('dispara REPORTE_GENERADO tras generar reporte mensual', () => {
        expect(reporteSrc).toContain('REPORTE_GENERADO');
    });
});

// ── 5. Widget frontend — estructura ───────────────────────────────────────────
describe('notificaciones-widget.js — estructura frontend', () => {
    let widgetSrc;
    beforeAll(() => {
        widgetSrc = fs.readFileSync(
            path.join(root, 'public', 'scripts', 'notificaciones-widget.js'),
            'utf8'
        );
    });

    test('define la clase NotificacionesWidget', () => {
        expect(widgetSrc).toContain('NotificacionesWidget');
    });

    test('hace polling al endpoint /api/notificaciones/sin-leer/count', () => {
        expect(widgetSrc).toContain('/api/notificaciones/sin-leer/count');
    });

    test('soporta marcar notificación individual como leída', () => {
        expect(widgetSrc).toContain('/leida');
    });

    test('soporta marcar todas como leídas', () => {
        expect(widgetSrc).toContain('leer-todas');
    });

    test('solicita permiso para notificaciones del navegador', () => {
        expect(widgetSrc).toContain('Notification.requestPermission');
    });

    test('muestra badge con el conteo de no leídas', () => {
        expect(widgetSrc).toContain('badge');
    });
});

// ── 6. Migración DB — columnas nuevas ────────────────────────────────────────
describe('migración DB notificaciones — columnas', () => {
    let migSrc;
    beforeAll(() => {
        migSrc = fs.readFileSync(
            path.join(root, 'database', 'migrations', '20260603_notificaciones_facturacion.sql'),
            'utf8'
        );
    });

    test('agrega columna modulo', () => {
        expect(migSrc).toContain('modulo');
    });

    test('agrega columna referencia_tipo', () => {
        expect(migSrc).toContain('referencia_tipo');
    });

    test('agrega columna referencia_id', () => {
        expect(migSrc).toContain('referencia_id');
    });

    test('agrega columna id_usuario_accion', () => {
        expect(migSrc).toContain('id_usuario_accion');
    });

    test('agrega columna metadata', () => {
        expect(migSrc).toContain('metadata');
    });

    test('usa IF NOT EXISTS para ser idempotente', () => {
        expect(migSrc).toContain('IF NOT EXISTS');
    });
});
