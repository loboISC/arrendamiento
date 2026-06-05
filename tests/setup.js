require('dotenv').config({ path: '.env.test' });

// Mock de xmlService para evitar errores de ESM de sus dependencias en Jest
jest.mock('../src/server/services/facturacion/xmlService', () => ({
    construirCfdi40: jest.fn(),
    sellarXml: jest.fn()
}), { virtual: true });

// Mock del módulo de base de datos usando el mock compartido
const mockDb = require('./__mocks__/db');

// Configurar default mock implementation para query para evitar que retorne undefined por defecto
mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 });

jest.mock('../src/db', () => mockDb, { virtual: true });
jest.mock('../src/server/config/database', () => mockDb, { virtual: true });


// Mock de console para tests más limpios
const originalLog = console.log;
const originalError = console.error;

global.console = {
    ...console,
    log: jest.fn((...args) => {
        // Silenciar logs de conexión de DB en tests
        const msg = args.join(' ');
        if (msg.includes('Conexión a la base de datos') || msg.includes('Configuración de BD')) {
            return;
        }
        originalLog(...args);
    }),
    error: originalError,
    warn: console.warn,
};

// Timeout global para tests
jest.setTimeout(10000);

// Setup global antes de todos los tests
beforeAll(async () => {
    console.log(' Iniciando suite de tests...');
});

// Cleanup después de todos los tests
afterAll(async () => {
    console.log(' Tests completados');
});
