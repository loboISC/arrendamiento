'use strict';

/**
 * tests/services/facturacionNotifService.test.js
 * Tests unitarios para el servicio de notificaciones de facturación.
 */

const path = require('path');
const fs   = require('fs');

// ── helpers de lectura de código fuente ───────────────────────────────────────
const root = path.join(__dirname, '..', '..');

const serviceSrc = fs.readFileSync(
    path.join(root, 'src', 'server', 'services', 'facturacionNotifService.js'),
    'utf8'
);

// ── 1. Tests de estructura del código fuente ──────────────────────────────────
describe('facturacionNotifService — estructura de código', () => {
    test('exporta crearNotificacion', () => {
        expect(serviceSrc).toContain('module.exports');
        expect(serviceSrc).toContain('crearNotificacion');
    });

    test('usa fire-and-forget: no lanza errores al exterior', () => {
        // La función captura errores internamente
        expect(serviceSrc).toContain('console.warn');
        expect(serviceSrc).toContain('return; // fire-and-forget');
    });

    test('inserta en tabla notificaciones con todas las columnas nuevas', () => {
        expect(serviceSrc).toContain('INSERT INTO notificaciones');
        expect(serviceSrc).toContain('modulo');
        expect(serviceSrc).toContain('referencia_tipo');
        expect(serviceSrc).toContain('referencia_id');
        expect(serviceSrc).toContain('id_usuario_accion');
        expect(serviceSrc).toContain('metadata');
        expect(serviceSrc).toContain('prioridad');
    });

    test('serializa metadata como JSON antes de insertar', () => {
        expect(serviceSrc).toContain('JSON.stringify(metadata)');
    });

    test('convierte referencia_id a String para evitar overflow bigint', () => {
        expect(serviceSrc).toContain('String(referencia_id)');
    });

    test('convierte id_usuario_accion a Number', () => {
        expect(serviceSrc).toContain('Number(id_usuario_accion)');
    });

    test('integra VAPID web-push de forma opcional', () => {
        expect(serviceSrc).toContain('VAPID_PUBLIC_KEY');
        expect(serviceSrc).toContain('VAPID_PRIVATE_KEY');
        expect(serviceSrc).toContain('enviarPushInterno');
    });

    test('soporta tipos de evento de facturación', () => {
        expect(serviceSrc).toContain('FACTURA_TIMBRADA');
        expect(serviceSrc).toContain('FACTURA_CANCELADA');
        expect(serviceSrc).toContain('NC_TIMBRADA');
        expect(serviceSrc).toContain('NC_CANCELADA');
        expect(serviceSrc).toContain('REPORTE_GENERADO');
        expect(serviceSrc).toContain('ERROR_TIMBRADO');
        expect(serviceSrc).toContain('COMPLEMENTO_TIMBRADO');
    });
});

// ── 2. Tests de comportamiento con mock de DB ─────────────────────────────────
describe('facturacionNotifService — comportamiento', () => {
    let crearNotificacion;
    let mockQuery;

    beforeEach(() => {
        // Mock de la base de datos
        mockQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 1 });

        jest.resetModules();
        jest.doMock(
            path.join(root, 'src', 'server', 'config', 'database'),
            () => ({ query: mockQuery }),
            { virtual: false }
        );

        ({ crearNotificacion } = require(
            path.join(root, 'src', 'server', 'services', 'facturacionNotifService')
        ));
    });

    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    test('no llama a query si mensaje está vacío', async () => {
        await crearNotificacion({ tipo: 'FACTURA_TIMBRADA', mensaje: '' });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('llama a INSERT con los parámetros correctos', async () => {
        await crearNotificacion({
            tipo:              'FACTURA_TIMBRADA',
            mensaje:           'Factura F-001 timbrada exitosamente',
            modulo:            'facturacion',
            referencia_tipo:   'factura',
            referencia_id:     'abc-123',
            id_usuario_accion: 5,
            metadata:          { folio: 'F-001', total: 1000 },
            prioridad:         'Alta',
        });

        expect(mockQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain('INSERT INTO notificaciones');
        expect(params[0]).toBe('FACTURA_TIMBRADA');
        expect(params[1]).toBe('Factura F-001 timbrada exitosamente');
        expect(params[2]).toBe('facturacion');
        expect(params[3]).toBe('factura');
        expect(params[4]).toBe('abc-123');   // String(referencia_id)
        expect(params[5]).toBe(5);            // Number(id_usuario_accion)
        expect(params[6]).toContain('"folio"'); // JSON.stringify(metadata)
        expect(params[7]).toBe('Alta');
    });

    test('pasa null cuando no se envían campos opcionales', async () => {
        await crearNotificacion({ tipo: 'NC_TIMBRADA', mensaje: 'NC timbrada' });

        expect(mockQuery).toHaveBeenCalledTimes(1);
        const [, params] = mockQuery.mock.calls[0];
        expect(params[3]).toBeNull(); // referencia_tipo
        expect(params[4]).toBeNull(); // referencia_id
        expect(params[5]).toBeNull(); // id_usuario_accion
        expect(params[6]).toBeNull(); // metadata
    });

    test('no lanza excepción cuando la DB falla (fire-and-forget)', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

        await expect(
            crearNotificacion({ tipo: 'ERROR_TIMBRADO', mensaje: 'Error al timbrar' })
        ).resolves.not.toThrow();
    });

    test('defaults correctos: tipo INFO, modulo facturacion, prioridad Normal', async () => {
        await crearNotificacion({ mensaje: 'Evento genérico' });

        const [, params] = mockQuery.mock.calls[0];
        expect(params[0]).toBe('INFO');
        expect(params[2]).toBe('facturacion');
        expect(params[7]).toBe('Normal');
    });
});
