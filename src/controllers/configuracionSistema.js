const db = require('../db');

// Obtener configuración global
exports.getConfig = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM configuracion_sistema WHERE id = 1');
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Configuración no encontrada' });
        }
    } catch (error) {
        console.error('Error al obtener configuración:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Actualizar configuración global
exports.updateConfig = async (req, res) => {
    const {
        nombre_sistema, zona_horaria, idioma, moneda,
        empresa_nombre, empresa_rfc, empresa_telefono,
        empresa_direccion, empresa_email, empresa_web, empresa_logo,
        respaldo_automatico, respaldo_frecuencia, modo_mantenimiento, actualizaciones_automaticas
    } = req.body;

    try {
        const query = `
      UPDATE configuracion_sistema 
      SET 
        nombre_sistema = $1, zona_horaria = $2, idioma = $3, moneda = $4,
        empresa_nombre = $5, empresa_rfc = $6, empresa_telefono = $7,
        empresa_direccion = $8, empresa_email = $9, empresa_web = $10,
        empresa_logo = $11, 
        respaldo_automatico = $12, respaldo_frecuencia = $13, 
        modo_mantenimiento = $14, actualizaciones_automaticas = $15,
        fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = 1
      RETURNING *
    `;
        const values = [
            nombre_sistema, zona_horaria, idioma, moneda,
            empresa_nombre, empresa_rfc, empresa_telefono,
            empresa_direccion, empresa_email, empresa_web, empresa_logo,
            respaldo_automatico, respaldo_frecuencia, modo_mantenimiento, actualizaciones_automaticas
        ];

        const result = await db.query(query, values);
        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error al actualizar configuración:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
