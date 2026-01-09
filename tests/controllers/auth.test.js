const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

describe('Auth Controller', () => {
    // Mock data
    const mockUser = {
        id_usuario: 1,
        nombre: 'Test User',
        correo: 'test@example.com',
        password_hash: '', // Se generará en beforeAll
        rol: 'admin',
        estado: 'Activo'
    };

    beforeAll(async () => {
        // Generar password hash para el usuario mock
        mockUser.password_hash = await bcrypt.hash('password123', 10);
    });

    afterEach(() => {
        // Limpiar mocks después de cada test
        jest.clearAllMocks();
    });

    describe('POST /api/auth/login', () => {
        it('debería retornar token con credenciales válidas', async () => {
            // Mock de la query de base de datos
            db.query.mockResolvedValueOnce({
                rows: [mockUser],
                rowCount: 1
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'test@example.com',
                    password: 'password123'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('user');
            expect(res.body.user).not.toHaveProperty('password_hash');
            expect(res.body.message).toBe('Login exitoso');
        });

        it('debería retornar 400 sin credenciales', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({});

            expect(res.statusCode).toBe(400);
            expect(res.body).toHaveProperty('error');
            expect(res.body.error).toBe('Usuario y contraseña son requeridos');
        });

        it('debería retornar 401 con usuario inexistente', async () => {
            // Mock retorna usuario no encontrado
            db.query.mockResolvedValueOnce({
                rows: [],
                rowCount: 0
            });

            // Segunda consulta también vacía (por correo)
            db.query.mockResolvedValueOnce({
                rows: [],
                rowCount: 0
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'noexiste@example.com',
                    password: 'password123'
                });

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Credenciales inválidas');
        });

        it('debería retornar 401 con contraseña incorrecta', async () => {
            db.query.mockResolvedValueOnce({
                rows: [mockUser],
                rowCount: 1
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'test@example.com',
                    password: 'wrongpassword'
                });

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Credenciales inválidas');
        });

        it('debería manejar errores de base de datos', async () => {
            db.query.mockRejectedValueOnce(new Error('Database error'));
            db.query.mockRejectedValueOnce(new Error('Database error'));

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'test@example.com',
                    password: 'password123'
                });

            expect(res.statusCode).toBe(401);
        });
    });

    describe('POST /api/auth/verify-token', () => {
        it('debería verificar un token válido', async () => {
            const token = jwt.sign(
                { id: mockUser.id_usuario, username: mockUser.nombre },
                process.env.JWT_SECRET || 'secreto',
                { expiresIn: '1h' }
            );

            db.query.mockResolvedValueOnce({
                rows: [{
                    id_usuario: mockUser.id_usuario,
                    nombre: mockUser.nombre,
                    correo: mockUser.correo,
                    rol: mockUser.rol
                }],
                rowCount: 1
            });

            const res = await request(app)
                .post('/api/auth/verify-token')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('valid', true);
            expect(res.body).toHaveProperty('user');
        });

        it('debería retornar 401 sin token', async () => {
            const res = await request(app)
                .post('/api/auth/verify-token');

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Token requerido');
        });

        it('debería retornar 401 con token inválido', async () => {
            const res = await request(app)
                .post('/api/auth/verify-token')
                .set('Authorization', 'Bearer invalid_token');

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Token inválido');
        });

        it('debería retornar 401 con token expirado', async () => {
            const expiredToken = jwt.sign(
                { id: mockUser.id_usuario, username: mockUser.nombre },
                process.env.JWT_SECRET || 'secreto',
                { expiresIn: '-1h' } // Token expirado
            );

            const res = await request(app)
                .post('/api/auth/verify-token')
                .set('Authorization', `Bearer ${expiredToken}`);

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Token inválido');
        });
    });

    describe('POST /api/auth/verify-password', () => {
        it('debería verificar contraseña correcta', async () => {
            const token = jwt.sign(
                { id: mockUser.id_usuario, id_usuario: mockUser.id_usuario },
                process.env.JWT_SECRET || 'secreto',
                { expiresIn: '1h' }
            );

            db.query.mockResolvedValueOnce({
                rows: [{ password_hash: mockUser.password_hash }],
                rowCount: 1
            });

            const res = await request(app)
                .post('/api/auth/verify-password')
                .set('Authorization', `Bearer ${token}`)
                .send({ password: 'password123' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('valid', true);
        });

        it('debería retornar false con contraseña incorrecta', async () => {
            const token = jwt.sign(
                { id: mockUser.id_usuario, id_usuario: mockUser.id_usuario },
                process.env.JWT_SECRET || 'secreto',
                { expiresIn: '1h' }
            );

            db.query.mockResolvedValueOnce({
                rows: [{ password_hash: mockUser.password_hash }],
                rowCount: 1
            });

            const res = await request(app)
                .post('/api/auth/verify-password')
                .set('Authorization', `Bearer ${token}`)
                .send({ password: 'wrongpassword' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('valid', false);
        });

        it('debería retornar 400 sin contraseña', async () => {
            const token = jwt.sign(
                { id: mockUser.id_usuario, id_usuario: mockUser.id_usuario },
                process.env.JWT_SECRET || 'secreto',
                { expiresIn: '1h' }
            );

            const res = await request(app)
                .post('/api/auth/verify-password')
                .set('Authorization', `Bearer ${token}`)
                .send({});

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Contraseña es requerida');
        });
    });
});
