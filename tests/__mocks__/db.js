// Mock de la base de datos para tests
const mockPool = {
    query: jest.fn(),
    connect: jest.fn(() => Promise.resolve({
        query: jest.fn(),
        release: jest.fn()
    })),
    end: jest.fn()
};

module.exports = {
    query: mockPool.query,
    pool: mockPool
};
