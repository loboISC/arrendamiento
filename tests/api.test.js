const request = require('supertest');
const app = require('../src/app');

describe('API Health Check', () => {
    it('GET /api/test debería retornar 200 y mensaje de éxito', async () => {
        const res = await request(app).get('/api/test');

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Servidor funcionando correctamente');
        expect(res.body).toHaveProperty('timestamp');
    });
});

describe('Static Files', () => {
    it('debería servir archivos estáticos desde /public', async () => {
        const res = await request(app).get('/');

        expect(res.statusCode).toBe(200);
    });
});
