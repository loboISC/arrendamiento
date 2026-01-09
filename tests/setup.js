require('dotenv').config({ path: '.env.test' });

// Mock del módulo de base de datos ANTES de que se cargue en cualquier otro módulo
jest.mock('../src/db', () => {
    const mockPool = {
        query: jest.fn(() => Promise.resolve({ rows: [], rowCount: 0 })),
        connect: jest.fn(() => Promise.resolve({
            query: jest.fn(),
            release: jest.fn()
        })),
        end: jest.fn()
    };

    return {
        query: mockPool.query,
        pool: mockPool
    };
});

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
    console.log('🧪 Iniciando suite de tests...');
});

// Cleanup después de todos los tests
afterAll(async () => {
    console.log('✅ Tests completados');
});
