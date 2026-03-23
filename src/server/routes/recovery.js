const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../config/database');

/**
 * Protocolo de Acceso de Emergencia
 * POST /api/recovery/reset-admin
 * Headers: recovery-key: <CLAVE_MAESTRA>
 * Body: { correo: 'admin@dominio.com', nuevaPassword: '...' }
 */
router.post('/reset-admin', async (req, res) => {
    const recoveryKeyHeader = req.headers['recovery-key'];
    const masterKey = process.env.RECOVERY_KEY;

    if (!masterKey || recoveryKeyHeader !== masterKey) {
        console.warn(`Intento de recuperación fallido desde IP: ${req.ip}`);
        return res.status(401).json({ error: 'Acceso no autorizado al protocolo de emergencia' });
    }

    const { correo, nuevaPassword } = req.body;

    if (!correo || !nuevaPassword) {
        return res.status(400).json({ error: 'Correo y nueva contraseña son requeridos' });
    }

    try {
        const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
        
        const result = await db.query(
            'UPDATE usuarios SET password_hash = $1, estado = \'Activo\' WHERE correo = $2 RETURNING id_usuario, nombre',
            [hashedPassword, correo]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        console.log(`EMERGENCIA: Contraseña reseteada para usuario: ${correo}`);
        res.json({ 
            message: 'Protocolo de emergencia ejecutado con éxito',
            usuario: result.rows[0].nombre 
        });
    } catch (error) {
        console.error('Error en protocolo de emergencia:', error);
        res.status(500).json({ error: 'Error interno del servidor durante la recuperación' });
    }
});

module.exports = router;
